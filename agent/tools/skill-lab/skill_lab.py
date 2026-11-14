#!/usr/bin/env python3
"""Calíope skill lab: every week, find new design skills, test them on Pedro's real brief, report in #feed.

Runs on the VPS (systemd user timer `caliope-skill-lab.timer`, Sunday 21:00 Lisbon). Pedro's request of
2026-11-13: Calíope keeps up with design skills and design repos, tries them weekly on what he is building
(now: the new pedroalmeida.ai) and leaves the results and links in #feed.

Steps
  1. scout:  skills.sh search API (installs, growth since last week) + GitHub repo search (new or pushed design skills).
  2. triage: Claude (as Calíope, no tools) picks up to 3 design skills to test this week.
  3. test:   each picked skill, the current champion and a no-skill baseline build the same brief. Third-party
             skills are untrusted, so each run is a transient systemd unit: no Bash/web tools, /home hidden
             (ProtectHome=tmpfs), read-only system, its own HOME, memory and time caps.
  4. shoot:  headless Google Chrome screenshots, desktop and phone.
  5. judge:  Claude (as Calíope) scores the screenshots blind (labels shuffled) on a fixed rubric.
  6. report: lab/<week>/index.html + lab/ledger.json on caliope.pedroalmeida.ai, one line in #feed.

Usage: skill_lab.py [--max-tests N] [--skill owner/repo/skillId ...] [--no-slack] [--week LABEL]
Owner: Calíope. Created 2026-11-13.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import time
import os
import random
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HOME = Path.home()
HERE = Path(__file__).resolve().parent
BRIEF = HERE / "briefs" / "site-pedro.md"
PUBLIC = HOME / "services/caliope-site/public"
LAB = PUBLIC / "lab"
LEDGER = LAB / "ledger.json"
STATE = HOME / ".local/state/caliope-skill-lab"
SANDBOX_ROOT = Path("/srv/caliope-lab")
LOG = STATE / "skill-lab.log"
SITE = "https://caliope.pedroalmeida.ai"
SLACK = str(HOME / ".claude/scripts/slack-send-message.sh")
CLAUDE_ENV = HOME / ".agency-secrets/claude-code.env"
CHAMPION_DEFAULT = "anthropics/skills/frontend-design"

QUERIES = ["design", "ui design", "frontend design", "web design", "landing page", "website", "tailwind",
           "shadcn", "typography", "brand", "ui ux", "email design", "design system", "taste", "frontend",
           "css", "animation", "motion", "figma", "hero", "react ui", "ux", "accessibility", "color", "font",
           "visual", "portfolio", "creative", "layout", "polish"]
# GitHub, three ways (2026-11-13, Pedro: "there are a lot of good skills on GitHub, make it more deep"):
# repo search, code search for SKILL.md files that talk about design, and the awesome lists people curate.
GITHUB_QUERIES = ['"design" skill claude in:name,description', '"frontend" skill SKILL.md in:readme',
                  '"ui" agent skills in:name,description', '"design skill" in:readme',
                  'claude skills design in:name,description,readme', 'agent skills frontend in:name,description',
                  'SKILL.md landing page in:readme', 'claude code ui ux skill in:readme']
GITHUB_TOPICS = ["claude-skills", "agent-skills", "claude-code-skills", "anthropic-skills", "skills"]
CODE_QUERIES = ["frontend design", "web design", "landing page", "typography", "design system", "visual design",
                "UI design", "tailwind", "shadcn", "brand identity", "animation", "design taste"]
AWESOME_LISTS = ["travisvn/awesome-claude-skills", "VoltAgent/awesome-agent-skills", "ComposioHQ/awesome-claude-skills",
                 "hesreallyhim/awesome-claude-code", "BehiSecc/awesome-claude-skills", "karanb192/awesome-claude-skills"]
DESIGN_WORDS = re.compile(r"design|ui\b|ux|front.?end|landing|typograph|brand|css|tailwind|shadcn|visual|animation|motion|figma|web page|website", re.I)
RUBRIC = {
    "brief": "follows the brief: references, colour mechanism, palette, banned fonts, one CTA, exact proof",
    "hierarchy": "layout and hierarchy: one claim per section, clear reading order, rhythm",
    "type": "typography: pairing, scale, measure, contrast",
    "craft": "craft and originality: no AI-slop tells (generic gradients, emoji, card soup, centred everything)",
    "mobile": "the phone version holds up: no overflow, readable, CTA reachable",
}


def log(msg: str) -> None:
    STATE.mkdir(parents=True, exist_ok=True)
    line = f"{dt.datetime.now().isoformat(timespec='seconds')} {msg}"
    print(line, flush=True)
    with LOG.open("a") as fh:
        fh.write(line + "\n")


def http_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "caliope-skill-lab/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def gh(*args: str):
    out = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=120)
    if out.returncode:
        raise RuntimeError(out.stderr.strip()[:300])
    return json.loads(out.stdout) if out.stdout.strip() else None


def claude_env() -> dict:
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    for line in CLAUDE_ENV.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.replace("export ", "").strip()] = v.strip().strip('"').strip("'")
    return env


def claude_bin() -> str:
    return str(Path(shutil.which("claude") or HOME / ".local/bin/claude").resolve())


def ask_claude(prompt: str, tools: str = "", cwd: Path | None = None, timeout: int = 900) -> dict:
    cmd = [claude_bin(), "-p", prompt, "--model", "sonnet", "--output-format", "text"]
    if tools:
        cmd += ["--allowedTools", tools]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=claude_env(), cwd=str(cwd or STATE))
    m = re.search(r"\{.*\}", out.stdout, re.S)
    if not m:
        raise RuntimeError(f"no JSON from claude: {out.stdout[-300:]} {out.stderr[-300:]}")
    return json.loads(m.group(0))


# ---------------------------------------------------------------- ledger

def load_ledger() -> dict:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text())
    return {"champion": CHAMPION_DEFAULT, "challenger": None, "skills": {}, "weeks": [], "installs": {}}


def save_ledger(ledger: dict) -> None:
    LAB.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger, ensure_ascii=False, indent=1))
    tmp.replace(LEDGER)


# ---------------------------------------------------------------- 1. scout

def scout(ledger: dict) -> list[dict]:
    found: dict[str, dict] = {}
    for q in QUERIES:
        try:
            data = http_json("https://skills.sh/api/search?" + urllib.parse.urlencode({"q": q, "limit": 50}))
        except Exception as exc:
            log(f"skills.sh '{q}' failed: {exc}")
            continue
        for s in data.get("skills", []):
            sid = s["id"]
            prev = ledger["installs"].get(sid)
            found[sid] = {"id": sid, "source": s["source"], "skill": s["skillId"], "installs": s.get("installs", 0),
                          "growth": (s.get("installs", 0) - prev) if prev is not None else None, "via": "skills.sh"}
    n_sh = len(found)

    def add_repo(repo: str, via: str, stars=None, pushed=None, desc="", only=None):
        for skill in (only or skills_in_repo(repo)[:40]):
            sid = f"{repo}/{skill}"
            if sid in found:
                found[sid].setdefault("alsoVia", via)
                continue
            found[sid] = {"id": sid, "source": repo, "skill": skill, "installs": None, "growth": None, "via": via,
                          "stars": stars, "pushed": pushed, "repoDescription": (desc or "")[:200]}

    since = (dt.date.today() - dt.timedelta(days=120)).isoformat()
    repos: dict[str, dict] = {}
    searches = [["search", "repos", q, "--sort", "updated", "--limit", "40"] for q in GITHUB_QUERIES]
    searches += [["search", "repos", "--topic", t, "--sort", "stars", "--limit", "60"] for t in GITHUB_TOPICS]
    for args in searches:
        try:
            for r in gh(*args, "--json", "fullName,description,stargazersCount,pushedAt") or []:
                repos[r["fullName"]] = r
        except Exception as exc:
            log(f"github {' '.join(args[2:4])} failed: {exc}")
    for name, r in repos.items():
        if r["stargazersCount"] < 10 or r["pushedAt"][:10] < since:
            continue
        # a generic skills repo only counts for the skills in it that look like design
        if not DESIGN_WORDS.search(f"{name} {r['description'] or ''}"):
            design = [k for k in skills_in_repo(name) if DESIGN_WORDS.search(k)]
            if not design:
                continue
            add_repo(name, "github", r["stargazersCount"], r["pushedAt"][:10], r["description"], design[:10])
        else:
            add_repo(name, "github", r["stargazersCount"], r["pushedAt"][:10], r["description"])
    n_repo = len(found) - n_sh

    for q in CODE_QUERIES:  # SKILL.md files that say what they are about
        time.sleep(8)  # GitHub code search allows about 10 requests a minute
        try:
            hits = gh("search", "code", q, "--filename", "SKILL.md", "--limit", "50", "--json", "path,repository")
        except Exception as exc:
            log(f"github code '{q}' failed: {exc}")
            continue
        for h in hits or []:
            repo = h["repository"]["nameWithOwner"]
            parts = h["path"].split("/")
            add_repo(repo, "github-code", only=[parts[-2] if len(parts) > 1 else repo.split("/")[1]])
    n_code = len(found) - n_sh - n_repo

    for lst in AWESOME_LISTS:  # curated lists: design-looking lines that link to a GitHub repo
        try:
            text = raw(lst, "README.md").decode("utf-8", "replace")
        except Exception as exc:
            log(f"awesome {lst} failed: {exc}")
            continue
        for line in text.splitlines():
            if not DESIGN_WORDS.search(line):
                continue
            for m in re.finditer(r"github\.com/([\w.-]+/[\w.-]+?)(?:\.git)?(?:/tree/[^/\s)]+/([^\s)#]+))?[)\s#]", line + " "):
                repo, path = m.group(1), m.group(2)
                if repo.lower() == lst.lower():
                    continue
                skill = path.rstrip("/").split("/")[-1] if path else None
                add_repo(repo, f"awesome:{lst.split('/')[0]}", only=[skill] if skill else None)
    n_aw = len(found) - n_sh - n_repo - n_code

    for sid, c in found.items():
        if c["installs"] is not None:
            ledger["installs"][sid] = c["installs"]
    log(f"scout: {len(found)} skills seen (skills.sh {n_sh}, repos {n_repo}, code search {n_code}, awesome lists {n_aw})")
    return list(found.values())


_tree_cache: dict[str, list[str]] = {}


def repo_tree(repo: str) -> list[str]:
    if repo not in _tree_cache:
        try:
            data = gh("api", f"repos/{repo}/git/trees/HEAD?recursive=1")
            _tree_cache[repo] = [t["path"] for t in data.get("tree", []) if t["type"] == "blob"]
        except Exception as exc:
            log(f"tree {repo} failed: {exc}")
            _tree_cache[repo] = []
    return _tree_cache[repo]


def skills_in_repo(repo: str) -> list[str]:
    names = []
    for p in repo_tree(repo):
        if p.endswith("SKILL.md"):
            parts = p.split("/")
            names.append(parts[-2] if len(parts) > 1 else repo.split("/")[1])
    return names


_dir_cache: dict[str, str | None] = {}


def skill_dir(repo: str, skill: str) -> str | None:
    """Folder of a skill in a repo: by folder name, else by the `name:` in its SKILL.md (skills.sh can be stale)."""
    key = f"{repo}/{skill}"
    if key in _dir_cache:
        return _dir_cache[key]
    manifests = [p for p in repo_tree(repo) if p.endswith("SKILL.md")]
    found = None
    for p in manifests:
        parts = p.split("/")
        if (parts[-2] if len(parts) > 1 else repo.split("/")[1]) == skill:
            found = "/".join(parts[:-1])
            break
    if found is None:
        for p in manifests[:30]:
            try:
                head = raw(repo, p).decode("utf-8", "replace")[:600]
            except Exception:
                continue
            if re.search(rf"^name:\s*['\"]?{re.escape(skill)}['\"]?\s*$", head, re.M):
                found = "/".join(p.split("/")[:-1])
                break
    _dir_cache[key] = found
    return found


def raw(repo: str, path: str) -> bytes:
    url = f"https://raw.githubusercontent.com/{repo}/HEAD/{urllib.parse.quote(path)}"
    req = urllib.request.Request(url, headers={"User-Agent": "caliope-skill-lab/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(400_000)


def frontmatter(repo: str, skill: str) -> str:
    d = skill_dir(repo, skill)
    if d is None:
        return ""
    try:
        text = raw(repo, (d + "/" if d else "") + "SKILL.md").decode("utf-8", "replace")
    except Exception:
        return ""
    m = re.search(r"description:\s*(.+)", text)
    return (m.group(1) if m else text[:300]).strip()[:400]


# ---------------------------------------------------------------- 2. triage

def triage(cands: list[dict], ledger: dict, max_tests: int) -> list[dict]:
    recent = {sid for sid, s in ledger["skills"].items()
              if s.get("lastTested", "") >= (dt.date.today() - dt.timedelta(days=56)).isoformat()}
    pool = [c for c in cands if c["id"] not in recent and c["id"] != ledger["champion"]]
    pool = [c for c in pool if DESIGN_WORDS.search(f"{c['id']} {c.get('repoDescription', '')}") or c["via"] == "skills.sh"]
    sh = sorted([c for c in pool if c["via"] == "skills.sh"], key=lambda c: ((c.get("growth") or 0), c.get("installs") or 0), reverse=True)
    gh_ = sorted([c for c in pool if c["via"] != "skills.sh"], key=lambda c: (c.get("stars") or 0), reverse=True)
    pool = sh[:35] + gh_[:35]
    for c in pool:
        c["description"] = frontmatter(c["source"], c["skill"])
    pool = [c for c in pool if c["description"]]  # only skills whose files we can actually fetch
    prompt = f"""You are Calíope, Pedro's design director. Each week you test new agent skills (Claude Code SKILL.md
packages) that could make the web pages you build better. This week's test brief: Pedro's new personal/consultant
site homepage (light theme, editorial, high craft).
Pick at most {max_tests} skills from the list to test, the ones most likely to improve visual design of a web page
(design, UI, frontend, typography, brand, landing pages). Skip skills about code architecture, testing, mobile-only
apps, marketing copy, SEO, or anything unrelated to how a web page looks. Prefer skills that are rising (growth),
new, or highly installed and never tested. Answer ONE JSON object only:
{{"picks": [{{"id": "...", "why": "one sentence"}}], "skipped_note": "one sentence on what else you saw"}}
No em dashes.
Candidates: {json.dumps(pool, ensure_ascii=False)}"""
    out = ask_claude(prompt)
    ids = {c["id"]: c for c in pool}
    picks = []
    for p in out.get("picks", [])[:max_tests]:
        if p.get("id") in ids:
            c = dict(ids[p["id"]], why=p.get("why", ""))
            picks.append(c)
    log(f"triage: {[p['id'] for p in picks]}")
    return picks


# ---------------------------------------------------------------- 3. test (sandboxed)

def fetch_skill(c: dict, dest: Path) -> bool:
    d = skill_dir(c["source"], c["skill"])
    if d is None:
        log(f"no SKILL.md for {c['id']}")
        return False
    prefix = (d + "/") if d else ""
    files = [p for p in repo_tree(c["source"]) if p.startswith(prefix) and (d or p.count("/") <= 2)]
    target = dest / ".claude/skills" / c["skill"]
    n = 0
    for p in files[:80]:
        rel = p[len(prefix):]
        if not rel or ".." in rel.split("/"):
            continue
        try:
            data = raw(c["source"], p)
        except Exception:
            continue
        out = target / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        n += 1
    log(f"fetched {c['id']}: {n} files")
    return (target / "SKILL.md").exists()


def run_build(label: str, c: dict | None, week_dir: Path) -> dict:
    run_id = f"{week_dir.name}-{label}"
    box = SANDBOX_ROOT / run_id
    if box.exists():
        shutil.rmtree(box)
    (box / "home").mkdir(parents=True)
    shutil.copy(BRIEF, box / "brief.md")
    result = {"label": label, "skill": c["id"] if c else None}
    if c and not fetch_skill(c, box):
        result["error"] = "skill files not found"
        return result
    instruction = ("Read brief.md and build the page it describes as a single file index.html in the current folder. "
                   + (f"Use the `{c['skill']}` skill (installed in .claude/skills) and follow it. " if c else
                      "Use your own judgement. ")
                   + "You cannot run commands or browse; write the file directly. Finish with index.html written.")
    started = dt.datetime.now()
    cmd = ["sudo", "systemd-run", "--wait", "--collect", "--quiet", "--uid=hermes", "--gid=hermes",
           f"--unit=caliope-lab-{run_id.lower()}",
           "-p", "ProtectHome=tmpfs", "-p", "ProtectSystem=strict", "-p", "PrivateTmp=yes",
           "-p", "NoNewPrivileges=yes", "-p", f"ReadWritePaths={box}",
           "-p", f"BindReadOnlyPaths={claude_bin()}",
           "-p", f"EnvironmentFile={CLAUDE_ENV}", "-p", "MemoryMax=1200M", "-p", "RuntimeMaxSec=1800",
           "-p", f"WorkingDirectory={box}", "-p", f"StandardOutput=append:{box}/run.log",
           "-p", f"StandardError=append:{box}/run.log", f"--setenv=HOME={box / 'home'}", "--setenv=DISABLE_AUTOUPDATER=1",
           "--setenv=CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1",
           claude_bin(), "-p", instruction, "--model", "sonnet",
           "--allowedTools", "Read,Write,Edit,Glob,Grep,Skill",
           "--disallowedTools", "Bash,WebFetch,WebSearch,Task,NotebookEdit"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=2000)
    result["seconds"] = int((dt.datetime.now() - started).total_seconds())
    page = box / "index.html"
    if not page.exists():
        result["error"] = f"no index.html (exit {proc.returncode})"
        tail = (box / "run.log").read_text()[-300:] if (box / "run.log").exists() else proc.stderr[-300:]
        log(f"{label}: {result['error']} {tail}")
        return result
    out = week_dir / "runs" / label
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy(page, out / "index.html")
    if (box / "run.log").exists():  # the build's final reply: shows whether the skill was really used
        shutil.copy(box / "run.log", out / "run.log")
    result["page"] = f"runs/{label}/index.html"
    shutil.rmtree(box, ignore_errors=True)
    log(f"{label}: built in {result['seconds']}s")
    return result


# ---------------------------------------------------------------- 4. shoot

def shoot(week_dir: Path, r: dict) -> None:
    page = week_dir / r["page"]
    for kind, size in (("desktop", "1440,2600"), ("mobile", "390,1600")):
        target = week_dir / "runs" / r["label"] / f"{kind}.png"
        subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                        f"--window-size={size}", "--virtual-time-budget=8000", f"--screenshot={target}",
                        f"file://{page}"], capture_output=True, timeout=120)
        if target.exists():
            r.setdefault("shots", {})[kind] = f"runs/{r['label']}/{kind}.png"


# ---------------------------------------------------------------- 5. judge

def judge(week_dir: Path, results: list[dict]) -> dict:
    ok = [r for r in results if r.get("shots")]
    letters = list("ABCDEFG")[: len(ok)]
    random.shuffle(ok)
    blind = {letters[i]: r for i, r in enumerate(ok)}
    files = "\n".join(f"{k}: desktop {week_dir / r['shots'].get('desktop', '')}  phone {week_dir / r['shots'].get('mobile', '')}"
                      for k, r in blind.items())
    prompt = f"""You are Calíope, Pedro's design director, judging {len(blind)} versions of the same homepage,
built blind by different design skills. Read the brief at {week_dir / 'brief.md'} and every screenshot below with the
Read tool. Score each version 1 to 5 on: {json.dumps(RUBRIC)}. Be strict and concrete; a generic dark AI-agency
look or an ignored brief scores low. Answer ONE JSON object only:
{{"scores": {{"A": {{"brief": n, "hierarchy": n, "type": n, "craft": n, "mobile": n, "note": "two sentences: best and worst thing"}}}},
 "winner": "letter", "verdict": "two sentences on what separated the best from the rest"}}
No em dashes.
{files}"""
    out = ask_claude(prompt, tools="Read", cwd=week_dir, timeout=1200)
    for k, r in blind.items():
        s = out.get("scores", {}).get(k, {})
        nums = [s[x] for x in RUBRIC if isinstance(s.get(x), (int, float))]
        r["scores"] = {x: s.get(x) for x in RUBRIC}
        r["score"] = round(sum(nums) / len(nums), 2) if nums else None
        r["note"] = s.get("note", "")
        r["blind"] = k
    winner = blind.get(out.get("winner"))
    names = {k: (r["skill"].split("/")[-1] if r.get("skill") else "the no-skill base") for k, r in blind.items()}
    verdict = re.sub(r"\b([A-G])\b", lambda m: names.get(m.group(1), m.group(1)), out.get("verdict", ""))
    for r in blind.values():
        r["note"] = re.sub(r"\b([A-G])\b", lambda m: names.get(m.group(1), m.group(1)), r.get("note", ""))
    return {"winner": winner["label"] if winner else None, "verdict": verdict}


# ---------------------------------------------------------------- 6. report

def esc(s) -> str:
    return html.escape(str(s if s is not None else ""))


HEAD = """<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>{title}</title><link rel="icon" href="/caliope.jpg">
<link rel="stylesheet" href="/brand.css"></head><body><script src="/chrome.js" data-root="/" data-page="lab"></script>"""
FOOT = '<footer class="foot"><div class="wrap">Lab semanal da Calíope · domingos às 21:00 no VPS · mesmo brief para todas as skills, avaliação às cegas</div></footer></body></html>'


def write_report(week_dir: Path, week: str, picks: list[dict], results: list[dict], j: dict, ledger: dict) -> None:
    rows = []
    for r in sorted(results, key=lambda r: -(r.get("score") or 0)):
        skill = r.get("skill")
        link = (f'<a href="https://skills.sh/{esc(skill)}" target="_blank" rel="noopener">{esc(skill)}</a>'
                if skill else "sem skill (base)")
        why = next((p.get("why", "") for p in picks if p["id"] == skill), "")
        if r.get("error"):
            rows.append(f'<article class="box"><h4>{esc(r["label"])}</h4><p><b>{link}</b></p>'
                        f'<p class="muted">Falhou: {esc(r["error"])}</p></article>')
            continue
        sc = "".join(f'<span class="tag">{esc(k)} {esc(v)}</span> ' for k, v in (r.get("scores") or {}).items())
        win = r["label"] == j.get("winner")
        rows.append(f'''<article class="module">
  <div class="shots" style="grid-template-columns:minmax(0,1fr) 150px;gap:14px">
    <a href="{esc(r['page'])}" target="_blank"><img loading="lazy" src="{esc(r['shots'].get('desktop',''))}" alt="desktop"></a>
    <a href="{esc(r['page'])}" target="_blank"><img loading="lazy" src="{esc(r['shots'].get('mobile',''))}" alt="telemóvel"></a>
  </div>
  <div><div class="meta">{'<span class="tag hot">vencedora</span>' if win else ''}<span class="tag">{esc(r['label'])}</span><span class="stars">nota {esc(r.get('score'))}</span></div>
    <h3>{link}</h3>
    {f'<p class="muted" style="margin-bottom:10px">{esc(why)}</p>' if why else ''}
    <div class="chips" style="margin:0 0 12px">{sc}</div>
    <p>{esc(r.get('note'))}</p>
    <p class="note"><a href="{esc(r['page'])}" target="_blank">Abrir a página gerada ↗</a> · {esc(r.get('seconds'))} s</p></div></article>''')
    page = (HEAD.format(title=f"Lab de skills · {esc(week)} · Calíope") + f'''
<section class="hero"><div class="wrap"><div class="k">Lab de skills · {esc(week)}</div>
<h1>Que skill de design <em>constrói melhor</em> o teu site?</h1>
<p class="lead">Mesmo brief para todas (<a href="brief.md">a homepage do pedroalmeida.ai</a>), avaliação às cegas pela Calíope. Campeã atual: {esc(ledger['champion'])}.</p>
<div class="box" style="margin-top:22px;max-width:860px"><h4>Veredicto</h4><p>{esc(j.get('verdict'))}</p></div>
<p class="note"><a href="../">← todas as semanas</a></p></div></section>
<section class="band alt"><div class="wrap">{''.join(rows)}</div></section>''' + FOOT)
    (week_dir / "index.html").write_text(page)


def write_lab_index(ledger: dict) -> None:
    weeks = "".join(f'<a class="card" href="{esc(w["week"])}/"><div class="body"><div class="row"><span class="tag hot">{esc(w["week"])}</span>'
                    f'<span class="note" style="margin:0">vencedora: {esc(w.get("winnerSkill") or "base")}</span></div>'
                    f'<p class="take">{esc(w.get("verdict", ""))}</p></div></a>'
                    for w in reversed(ledger["weeks"]))
    skills = "".join(f'<tr><td><a href="https://skills.sh/{esc(k)}" target="_blank">{esc(k)}</a></td>'
                     f'<td>{esc(v.get("lastScore"))}</td><td>{esc(v.get("tests"))}</td><td>{esc(v.get("status"))}</td></tr>'
                     for k, v in sorted(ledger["skills"].items(), key=lambda kv: -(kv[1].get("lastScore") or 0)))
    page = (HEAD.format(title="Lab de skills · Calíope") + f'''
<section class="hero"><div class="wrap"><div class="k">Lab de skills de design</div>
<h1>Todas as semanas, <em>as skills novas contra a campeã</em>.</h1>
<p class="lead">A Calíope procura skills de design novas (skills.sh e GitHub), testa até três contra a campeã e uma base sem skill, no mesmo brief, e avalia às cegas. Campeã atual: <b>{esc(ledger["champion"])}</b>{(" · desafiante: " + esc(ledger["challenger"])) if ledger.get("challenger") else ""}.</p></div></section>
<section class="band alt"><div class="wrap"><div class="sh"><span class="k">01</span><h2>Semanas</h2></div><div class="grid" style="margin:0">{weeks}</div></div></section>
<section class="band"><div class="wrap"><div class="sh"><span class="k">02</span><h2>Skills testadas</h2></div>
<div class="box" style="overflow-x:auto"><table class="lab"><thead><tr><th>Skill</th><th>Última nota</th><th>Testes</th><th>Estado</th></tr></thead><tbody>{skills}</tbody></table></div></div></section>''' + FOOT)
    (LAB / "index.html").write_text(page)


def update_ledger(ledger: dict, week: str, results: list[dict], j: dict) -> str | None:
    today = dt.date.today().isoformat()
    by_label = {r["label"]: r for r in results}
    champ = by_label.get("champion")
    proposal = None
    for r in results:
        sid = r.get("skill")
        if not sid or r.get("score") is None:
            continue
        s = ledger["skills"].setdefault(sid, {"tests": 0, "history": []})
        s["tests"] += 1
        s["lastTested"] = today
        s["lastScore"] = r["score"]
        s["history"].append({"week": week, "score": r["score"]})
        s["status"] = "campeã" if sid == ledger["champion"] else s.get("status", "testada")
    if champ and champ.get("score") is not None:
        best = max((r for r in results if r["label"].startswith("t") and r.get("score") is not None),
                   key=lambda r: r["score"], default=None)
        if best and best["score"] >= champ["score"] + 0.5:
            if ledger.get("challenger") == best["skill"]:
                proposal = best["skill"]
                ledger["skills"][best["skill"]]["status"] = "proposta para adotar"
            else:
                ledger["challenger"] = best["skill"]
                ledger["skills"][best["skill"]]["status"] = "desafiante"
        elif ledger.get("challenger") and ledger["challenger"] in [r.get("skill") for r in results]:
            ledger["skills"][ledger["challenger"]]["status"] = "testada"
            ledger["challenger"] = None
    win = by_label.get(j.get("winner") or "", {})
    ledger["weeks"].append({"week": week, "winnerSkill": win.get("skill"), "verdict": j.get("verdict", ""),
                            "tested": [r.get("skill") for r in results]})
    return proposal


# ---------------------------------------------------------------- 6. learn (improve the method)

RUBRIC_FILE = HOME / ".agents/skills/pa-design-loop/references/standing-rubric.md"
LEARN_PROMPT = """You are Calíope, Pedro's design director. Your weekly skill lab just built the same brief (Pedro's homepage)
with several design skills, and you judged them blind. Your own method is the design loop; its standing rubric of binary
checks is below. Find what the lab teaches about the METHOD, not about which skill won:
- a gap: something the best-scoring page did well (or every page got wrong) that no check in the rubric covers;
- a repeated failure the rubric should have caught.
Propose AT MOST 2 changes, only if the evidence is clear. Zero is a fine answer. Each must be either a new binary check for
the standing rubric (target "rubric": one sentence a reviewer can mark pass or fail on a screenshot) or a working lesson
(target "lessons": how Calíope should work, one sentence). Never duplicate an existing check or an earlier proposal.
Answer ONE JSON object only, no em dashes:
{{"proposals": [{{"target": "rubric" | "lessons", "text": "...", "evidence": "which page and score shows it, 1 sentence"}}]}}

Week: {week}
Judge verdict: {verdict}
Scores and notes: {scores}
Standing rubric:
{rubric}
Earlier proposals: {earlier}
"""


def learn(week: str, results: list[dict], j: dict, ledger: dict) -> list[dict]:
    scored = [{"label": r["label"], "skill": r.get("skill") or "base", "score": r.get("score"), "scores": r.get("scores"),
               "note": r.get("note")} for r in results if r.get("score") is not None]
    if len(scored) < 2:
        return []
    rubric = RUBRIC_FILE.read_text() if RUBRIC_FILE.exists() else "(not found)"
    earlier = [x["text"] for x in ledger.setdefault("learnings", [])]
    out = ask_claude(LEARN_PROMPT.format(week=week, verdict=j.get("verdict", ""), scores=json.dumps(scored, ensure_ascii=False),
                                         rubric=rubric[:12000], earlier=json.dumps(earlier[-30:], ensure_ascii=False)))
    new = []
    for i, p in enumerate(out.get("proposals", [])[:2]):
        if p.get("target") not in ("rubric", "lessons") or not p.get("text"):
            continue
        item = {"id": f"L{week.replace('-', '')}-{i + 1}", "week": week, "target": p["target"],
                "text": p["text"].replace("\u2014", ","), "evidence": p.get("evidence", ""), "status": "proposta",
                "proposed": dt.date.today().isoformat()}
        ledger["learnings"].append(item)
        new.append(item)
    log(f"learn: {len(new)} proposal(s)")
    return new


def post_learnings(items: list[dict], week: str) -> None:
    where = {"rubric": "a rubrica do design loop (pa-design-loop, checks do lab)", "lessons": "as lições da Calíope"}
    for it in items:
        msg = (f"🧪 Proposta de método [{it['id']}], do lab {week}:\n{it['text']}\n"
               f"Porquê: {it['evidence']}\nVai para {where[it['target']]}. ✅ aplica, ❌ descarta, responde no fio para mudar. "
               f"{SITE}/lab/{week}/")
        subprocess.run([SLACK, "--agent", "caliope", "--no-wake", "decisoes", msg], timeout=120)


# ---------------------------------------------------------------- main

def main() -> int:
    import faulthandler
    faulthandler.dump_traceback_later(int(os.environ.get("SKILL_LAB_MAX_SECONDS", "10800")), exit=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-tests", type=int, default=3)
    ap.add_argument("--skill", action="append", help="force a skill id owner/repo/skillId (skips triage)")
    ap.add_argument("--no-slack", action="store_true")
    ap.add_argument("--week")
    args = ap.parse_args()

    week = args.week or dt.date.today().strftime("%G-W%V")
    week_dir = LAB / week
    week_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(BRIEF, week_dir / "brief.md")
    ledger = load_ledger()
    log(f"week {week}, champion {ledger['champion']}")

    cands = scout(ledger)
    if args.skill:
        picks = [{"id": s, "source": "/".join(s.split("/")[:2]), "skill": s.split("/")[2], "why": "forced"} for s in args.skill]
    else:
        picks = triage(cands, ledger, args.max_tests)
    if ledger.get("challenger") and ledger["challenger"] not in [p["id"] for p in picks]:
        ch = ledger["challenger"]
        picks.append({"id": ch, "source": "/".join(ch.split("/")[:2]), "skill": ch.split("/")[2], "why": "desafiante da semana passada, segundo teste"})

    champ = ledger["champion"]
    plan = [("base", None), ("champion", {"id": champ, "source": "/".join(champ.split("/")[:2]), "skill": champ.split("/")[2]})]
    plan += [(f"t{i + 1}", p) for i, p in enumerate(picks)]
    results = []
    for label, c in plan:
        r = run_build(label, c, week_dir)
        if r.get("page"):
            shoot(week_dir, r)
        results.append(r)

    j = judge(week_dir, results) if any(r.get("shots") for r in results) else {"winner": None, "verdict": "Nada foi construído."}
    proposal = update_ledger(ledger, week, results, j)
    try:
        lessons = learn(week, results, j, ledger)
    except Exception as exc:  # learning never breaks the weekly report
        log(f"learn failed: {exc}")
        lessons = []
    save_ledger(ledger)
    write_report(week_dir, week, picks, results, j, ledger)
    write_lab_index(ledger)
    (week_dir / "results.json").write_text(json.dumps({"picks": picks, "results": results, "judge": j}, ensure_ascii=False, indent=1))

    win = next((r for r in results if r["label"] == j.get("winner")), None)
    win_name = (win.get("skill") or "a base sem skill") if win else "ninguém"
    built = [r["skill"].split("/")[-1] for r in results if r["label"].startswith("t") and r.get("score") is not None]
    failed = [r["skill"].split("/")[-1] for r in results if r["label"].startswith("t") and r.get("error")]
    tested = ", ".join(built) or "nenhuma skill nova"
    if failed:
        tested += f" (falhou: {', '.join(failed)})"
    msg = (f"🧪 Lab de skills de design, {week}: testei {tested} contra a campeã ({champ.split('/')[-1]}) e uma base, "
           f"no brief do site novo. Ganhou {win_name} ({win.get('score') if win else '-'}). {SITE}/lab/{week}/")
    if proposal:
        msg += f"\nProposta: adotar {proposal} na pa-caliope, ganhou à campeã duas semanas seguidas. Responde no fio se aprovas."
    log(msg)
    if lessons:
        msg += f"\n{len(lessons)} proposta(s) para melhorar o método em #decisoes."
    if not args.no_slack:
        subprocess.run([SLACK, "--agent", "caliope", "--no-wake", "decisoes" if proposal else "feed", msg], timeout=120)
        post_learnings(lessons, week)
    return 0


if __name__ == "__main__":
    sys.exit(main())
