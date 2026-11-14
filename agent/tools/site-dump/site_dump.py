#!/usr/bin/env python3
"""Calíope Site Dump: Pedro's Chrome "Site Dump" bookmarks become a categorised reference library.

Daily job (Mac launchd `com.pedro.caliope-site-dump`). Runs on the Mac because the bookmarks
file only exists there. For every bookmark not yet in the library it:
  1. captures the site with the installed Google Chrome (desktop 1440x900 and phone 390x844),
     and measures fonts and colours from computed styles;
  2. asks Claude (headless, Sonnet, read-only) to categorise it and say why it is a good reference;
  3. writes the library JSON into the vault (Calíope reads it on the VPS through vault-sync);
  4. rsyncs the page, JSON and screenshots to hermes:~/services/caliope-site/public
     (served by Caddy at caliope.pedroalmeida.ai, behind the branded password gate);
  5. posts one line to Slack #feed when something new came in.
New references also get the deep pass (deep.py): module by module study (art direction,
content, copywriting, one card per module with crop) and, for personal sites, the board
for Pedro's own site (library/personal-board.json, page personal.html).

Usage: site_dump.py [--limit N] [--no-deploy] [--no-slack] [--recheck URL]
                    [--deep] [--deep-limit N] [--deep-url URL] [--board]
Owner: Calíope (routine), plumbing Vitruvius. Created 2026-11-12.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deep  # noqa: E402

HOME = Path.home()
BOOKMARK_FILES = [
    HOME / "Library/Application Support/Google/Chrome/Default/AccountBookmarks",
    HOME / "Library/Application Support/Google/Chrome/Default/Bookmarks",
]
FOLDER_NAME = "Site Dump"
HERE = Path(__file__).resolve().parent
CALIOPE = HERE.parent.parent  # 2. Areas/consilium/caliope
LIBRARY_JSON = CALIOPE / "library" / "site-dump.json"
BOARD_JSON = CALIOPE / "library" / "personal-board.json"
WEB_SRC = HERE / "web"
BUILD = HOME / ".local/share/caliope-site-dump/public"
SHOTS = BUILD / "shots"
LOG = HOME / ".claude/session-logs/caliope-site-dump.log"
REMOTE = "hermes:/home/hermes/services/caliope-site/public/"
SITE_URL = "https://caliope.pedroalmeida.ai"
CLAUDE = str(HOME / ".local/bin/claude")
SLACK = str(HOME / ".claude/scripts/slack-send-message.sh")

CATEGORIES = {
    "personal-site": "Personal site of one person (founder, consultant, creator, freelancer)",
    "saas-landing": "Landing or marketing site of a software product or AI tool",
    "agency": "Agency or studio site selling services (web, marketing, AI, automation)",
    "portfolio": "Portfolio or showcase of design and creative work",
    "e-commerce": "Online shop or product catalogue",
    "local-business": "Local service or venue (trades, restaurant, café, park, clinic)",
    "course-event": "Course, training, programme, community or event landing",
    "wellness-retreat": "Retreat, yoga, wellness, therapy or spiritual offer",
    "dashboard-app": "Logged-in product UI, dashboard or web app screen",
    "template-theme": "Template, theme or website builder demo",
    "ui-components": "UI component library, effect or design resource",
    "gallery": "Inspiration gallery or designer profile (Dribbble, Awwwards)",
    "email": "Email design",
    "not-a-reference": "Not a design reference (tool login, document, PDF, piracy, error page)",
}
SKIP_PATTERNS = [
    r"^file:", r"^chrome:", r"\.pdf($|\?)", r"docs\.google\.com", r"drive\.google\.com",
    r"app\.gohighlevel\.com", r"piratebay", r"^https?://(localhost|127\.0\.0\.1)[:/]",
]

MEASURE_JS = r"""
() => {
  const pick = (el) => { if (!el) return null; const s = getComputedStyle(el);
    return {font: s.fontFamily.split(',')[0].replace(/["']/g,'').trim(), size: s.fontSize,
            weight: s.fontWeight, color: s.color}; };
  const h1 = document.querySelector('h1');
  const bodyStyle = getComputedStyle(document.body);
  const colors = {};
  for (const el of Array.from(document.querySelectorAll('body *')).slice(0, 1500)) {
    const r = el.getBoundingClientRect(); if (r.width * r.height < 2000) continue;
    const s = getComputedStyle(el);
    for (const c of [s.backgroundColor, s.color]) {
      if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') continue;
      colors[c] = (colors[c] || 0) + r.width * r.height;
    }
  }
  const top = Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]);
  const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;
  return {
    title: document.title, description: meta('description') || meta('og:description'),
    lang: document.documentElement.lang || null,
    h1: h1 ? h1.innerText.trim().slice(0, 200) : null,
    heading: pick(h1), body: pick(document.body), bodyBg: bodyStyle.backgroundColor,
    colors: top, height: document.documentElement.scrollHeight,
    text: document.body.innerText.replace(/\s+/g,' ').slice(0, 1500),
  };
}
"""


def log(msg: str) -> None:
    line = f"{dt.datetime.now().isoformat(timespec='seconds')} {msg}"
    print(line, flush=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as fh:
        fh.write(line + "\n")


def read_bookmarks() -> list[dict]:
    """Every URL inside the Site Dump folder (subfolders included), newest file wins on duplicates."""
    found: dict[str, dict] = {}
    for path in BOOKMARK_FILES:
        if not path.exists():
            continue
        data = json.loads(path.read_text())

        def walk(node, folder_path):
            if node.get("type") == "folder":
                inside = folder_path is not None
                if node.get("name") == FOLDER_NAME and not inside:
                    sub = []
                elif inside:
                    sub = folder_path + [node["name"]]
                else:
                    sub = None
                for child in node.get("children", []):
                    walk(child, sub)
            elif node.get("type") == "url" and folder_path is not None:
                url = node["url"]
                if url not in found:
                    found[url] = {
                        "url": url,
                        "name": node.get("name", ""),
                        "subfolder": "/".join(folder_path) or None,
                        "added": chrome_time(node.get("date_added")),
                    }

        for root in data.get("roots", {}).values():
            if isinstance(root, dict):
                walk(root, None)
    return list(found.values())


def chrome_time(value) -> str | None:
    try:
        micro = int(value)
    except (TypeError, ValueError):
        return None
    if not micro:
        return None
    return (dt.datetime(1601, 1, 1) + dt.timedelta(microseconds=micro)).date().isoformat()


def site_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:10]


def capture(items: list[dict]) -> None:
    """Screenshots and measures, in one browser, sequentially (the Mac stays usable)."""
    from playwright.sync_api import sync_playwright

    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for item in items:
            sid = item["id"]
            try:
                ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1,
                                          locale="pt-PT", ignore_https_errors=True)
                page = ctx.new_page()
                page.goto(item["url"], wait_until="domcontentloaded", timeout=45000)
                try:
                    page.wait_for_load_state("networkidle", timeout=12000)
                except Exception:
                    pass
                page.wait_for_timeout(2500)
                dismiss_banners(page)
                item["measured"] = page.evaluate(MEASURE_JS)
                item["finalUrl"] = page.url
                page.screenshot(path=str(SHOTS / f"{sid}-desktop.jpg"), type="jpeg", quality=72)
                # a taller strip so the library shows more than the hero
                page.set_viewport_size({"width": 1440, "height": 2400})
                page.wait_for_timeout(800)
                page.screenshot(path=str(SHOTS / f"{sid}-long.jpg"), type="jpeg", quality=60)
                ctx.close()
                mctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                           is_mobile=True, has_touch=True, locale="pt-PT", ignore_https_errors=True)
                m = mctx.new_page()
                m.goto(item["url"], wait_until="domcontentloaded", timeout=45000)
                m.wait_for_timeout(3000)
                dismiss_banners(m)
                m.screenshot(path=str(SHOTS / f"{sid}-mobile.jpg"), type="jpeg", quality=70)
                mctx.close()
                item["shots"] = {k: f"shots/{sid}-{k}.jpg" for k in ("desktop", "long", "mobile")}
                item["status"] = "captured"
                log(f"captured {item['url']}")
            except Exception as exc:  # one bad site never stops the run
                item["status"] = "capture-failed"
                item["error"] = str(exc).splitlines()[0][:200]
                log(f"capture failed {item['url']}: {item['error']}")
        browser.close()


def dismiss_banners(page) -> None:
    for label in ["Aceitar", "Aceitar todos", "Accept", "Accept all", "Rejeitar", "Reject all", "Got it", "OK"]:
        try:
            btn = page.get_by_role("button", name=label, exact=True)
            if btn.count() and btn.first.is_visible():
                btn.first.click(timeout=1500)
                page.wait_for_timeout(500)
                return
        except Exception:
            continue


PROMPT = """You are Calíope, a design director, cataloguing a site Pedro saved as a design reference.
Pedro builds web apps on shadcn/ui, landing pages, personal sites and emails, mostly for Portuguese small businesses and his own AI agency.
Look at the desktop screenshot at {shot} (use the Read tool) and the measured data below, then answer with ONE JSON object and nothing else:
{{"category": one of {cats},
 "tags": 3 to 6 short lowercase tags about the design (layout, style, technique),
 "summary": "what the site is, one sentence",
 "why": "why it is a good design reference, 2 sentences, concrete (layout, type, imagery, motion, copy structure), never generic praise",
 "take": "the one mechanism to reuse, one sentence",
 "avoid": "what not to copy, one short sentence, or null",
 "score": 1 to 5, how strong a reference it is,
 "bestFor": list from ["web-app","landing","personal-site","email","local-business-site"],
 "blocked": true only if the screenshot is an error, bot-check, not-found or empty page instead of the real site}}
Use "not-a-reference" when it is not a design reference (a login screen of a tool, a document, an error page). No em dashes.
Bookmark name: {name}
Bookmark subfolder: {subfolder}
URL: {url}
Measured: {measured}
"""


def classify(item: dict) -> dict:
    shot = SHOTS / f"{item['id']}-desktop.jpg"
    prompt = PROMPT.format(
        shot=shot, cats=json.dumps(list(CATEGORIES)), name=item["name"], subfolder=item.get("subfolder"),
        url=item["url"], measured=json.dumps({k: v for k, v in (item.get("measured") or {}).items()}, ensure_ascii=False)[:2500],
    )
    # Engine per ~/.claude/scripts/engines.conf (codex since 2026-11-13), Claude sonnet as fallback.
    cmd = [str(HOME / ".claude/scripts/agent-run.sh"), "--job", "caliope-site-dump", "--claude-model", "sonnet",
           "--tools", "Read", "--cwd", str(SHOTS), "--add-dir", str(SHOTS), "--image", str(shot),
           "--timeout", "280", "--", prompt]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=300, cwd=str(SHOTS), env=claude_env())
    match = re.search(r"\{.*\}", out.stdout, re.S)
    if not match:
        raise RuntimeError(f"no JSON from claude: {out.stdout[:200]} {out.stderr[:200]}")
    data = json.loads(match.group(0))
    if data.get("category") not in CATEGORIES:
        data["category"] = "not-a-reference" if data.get("category") is None else "saas-landing"
    for key in ("why", "take", "avoid", "summary"):
        if isinstance(data.get(key), str):
            data[key] = data[key].replace("—", ",").replace("–", "-")
    return data


def claude_env() -> dict:
    """Headless login: the long-lived token in claude-code.env, never the API key (same as lucid-run.sh)."""
    env = dict(os.environ)
    env.pop("ANTHROPIC_API_KEY", None)
    secrets = HOME / ".agency-secrets/claude-code.env"
    if secrets.exists():
        for line in secrets.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, _, val = line.partition("=")
                env[key.replace("export ", "").strip()] = val.strip().strip('"').strip("'")
    return env


def load_library() -> dict:
    if LIBRARY_JSON.exists():
        return json.loads(LIBRARY_JSON.read_text())
    return {"categories": CATEGORIES, "sites": []}


def save_library(lib: dict) -> None:
    lib["categories"] = CATEGORIES
    lib["updated"] = dt.datetime.now().isoformat(timespec="seconds")
    lib["sites"].sort(key=lambda s: (s.get("added") or "", s["url"]), reverse=True)
    LIBRARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    tmp = LIBRARY_JSON.with_suffix(".tmp")
    tmp.write_text(json.dumps(lib, ensure_ascii=False, indent=1))
    tmp.replace(LIBRARY_JSON)


def build_public(lib: dict) -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    for f in WEB_SRC.iterdir():
        if f.is_file():
            (BUILD / f.name).write_bytes(f.read_bytes())
    public = {"updated": lib["updated"], "categories": CATEGORIES,
              "sites": [{k: v for k, v in s.items() if k not in ("error", "deepBlocks", "deepError")} for s in lib["sites"]]}
    if BOARD_JSON.exists():
        (BUILD / "board.json").write_text(BOARD_JSON.read_text())
    for s in public["sites"]:
        (s.get("measured") or {}).pop("text", None)
    (BUILD / "library.json").write_text(json.dumps(public, ensure_ascii=False))


def deploy() -> None:
    subprocess.run(["ssh", "hermes", "mkdir -p /home/hermes/services/caliope-site/public"], check=True, timeout=60)
    # lab/ belongs to the VPS skill lab: never delete it from here
    subprocess.run(["rsync", "-az", "--delete", "--exclude", "lab/", f"{BUILD}/", REMOTE], check=True, timeout=900)
    log("deployed to VPS")


def main() -> int:
    import faulthandler
    # watchdog: a hung page must never keep the job alive forever (prints the stack, then exits)
    faulthandler.dump_traceback_later(int(os.environ.get("SITE_DUMP_MAX_SECONDS", "5400")), exit=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="process at most N new bookmarks")
    ap.add_argument("--no-deploy", action="store_true")
    ap.add_argument("--no-slack", action="store_true")
    ap.add_argument("--recheck", help="process this URL again")
    ap.add_argument("--deep", action="store_true", help="deep pass on references that do not have one yet")
    ap.add_argument("--deep-limit", type=int, default=0)
    ap.add_argument("--deep-url", action="append", default=[], help="deep pass on this URL (again)")
    ap.add_argument("--board", action="store_true", help="rebuild the personal-site board")
    args = ap.parse_args()

    lib = load_library()
    known = {s["url"]: s for s in lib["sites"]}
    if args.recheck and args.recheck in known:
        lib["sites"] = [s for s in lib["sites"] if s["url"] != args.recheck]
        known.pop(args.recheck)
    bookmarks = read_bookmarks()
    log(f"{len(bookmarks)} bookmarks in {FOLDER_NAME}, {len(known)} already in the library")
    current = {b["url"] for b in bookmarks}
    for s in lib["sites"]:  # keep removed bookmarks, but mark them
        s["inFolder"] = s["url"] in current
    # retry failed captures once a day
    retry = [s for s in lib["sites"] if s.get("status") in ("capture-failed", "classify-failed") and s["inFolder"]]
    new = [{k: s[k] for k in ("url", "name", "subfolder", "added") if k in s} for s in retry] + [
        b for b in bookmarks if b["url"] not in known]
    if args.limit:
        new = new[: args.limit]
    redo = {b["url"] for b in new}
    lib["sites"] = [s for s in lib["sites"] if s["url"] not in redo]

    todo, added = [], []
    for b in new:
        item = dict(b, id=site_id(b["url"]), inFolder=True, captured=dt.date.today().isoformat())
        if any(re.search(p, b["url"], re.I) for p in SKIP_PATTERNS):
            item.update(status="skipped", category="not-a-reference", why="Not a website (document, tool or file).")
            lib["sites"].append(item)
            continue
        todo.append(item)

    if todo:
        capture(todo)
        captured = [i for i in todo if i.get("status") == "captured"]
        with cf.ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(classify, i): i for i in captured}
            for fut in cf.as_completed(futures):
                item = futures[fut]
                try:
                    item.update(fut.result())
                    if item.pop("blocked", False):
                        # error or bot-check page: kept as a bookmark only, never retried or worked around
                        item["status"] = "blocked"
                    else:
                        item["status"] = "ok"
                        added.append(item)
                    log(f"classified {item['url']} -> {item['category']}")
                except Exception as exc:
                    item["status"] = "classify-failed"
                    item["error"] = str(exc)[:200]
                    log(f"classify failed {item['url']}: {item['error']}")
        lib["sites"].extend(todo)

    # deep pass: new references every day, the backlog with --deep, single sites with --deep-url
    want = {s["url"] for s in added}
    if args.deep:
        want |= {s["url"] for s in lib["sites"] if s.get("status") == "ok" and not s.get("deep")}
    want |= set(args.deep_url)
    deep_todo = [s for s in lib["sites"] if s["url"] in want and s.get("status") == "ok"
                 and s.get("category") != "not-a-reference"]
    deep_todo.sort(key=lambda s: (not deep.is_personal(s), -(s.get("score") or 0)))  # personal sites first
    if args.deep_limit:
        deep_todo = deep_todo[: args.deep_limit]
    board_dirty = args.board
    if deep_todo:
        log(f"deep pass on {len(deep_todo)} site(s)")
        for chunk in [deep_todo[i:i + 6] for i in range(0, len(deep_todo), 6)]:  # save as we go
            deep.deep_capture(chunk, SHOTS, dismiss_banners, log)
            ready = [s for s in chunk if s.get("deepBlocks") and s["url"] in {c["url"] for c in chunk}]
            with cf.ThreadPoolExecutor(max_workers=3) as pool:
                futures = {pool.submit(deep.deep_analyse, s, SHOTS, claude_env(), CLAUDE): s for s in ready}
                for fut in cf.as_completed(futures):
                    s = futures[fut]
                    try:
                        s["deep"] = fut.result()
                        s["deep"]["analysed"] = dt.date.today().isoformat()
                        s.pop("deepError", None)
                        board_dirty = board_dirty or deep.is_personal(s)
                        log(f"deep analysed {s['url']} ({len(s['deep'].get('modules', []))} modules)")
                    except Exception as exc:
                        s["deepError"] = str(exc)[:200]
                        log(f"deep analysis failed {s['url']}: {s['deepError']}")
            save_library(lib)
    if board_dirty and deep.personal_sites(lib):
        try:
            board = deep.build_board(lib, SHOTS, claude_env(), CLAUDE)
            board["updated"] = dt.datetime.now().isoformat(timespec="seconds")
            BOARD_JSON.write_text(json.dumps(board, ensure_ascii=False, indent=1))
            log(f"personal board rebuilt from {len(board['sites'])} sites")
        except Exception as exc:
            log(f"board failed: {str(exc)[:200]}")

    save_library(lib)
    build_public(lib)
    if not args.no_deploy:
        deploy()

    # method changes Pedro approved with ✅ in #decisoes (proposed by the weekly skill lab)
    try:
        subprocess.run([sys.executable, str(HERE.parent / "skill-lab" / "apply_learnings.py")], timeout=300, check=True)
    except Exception as exc:
        log(f"apply_learnings failed: {exc}")

    ok = [s for s in added if s.get("category") != "not-a-reference"]
    failed = [s for s in lib["sites"] if s.get("status") in ("capture-failed", "classify-failed")]
    log(f"done: {len(added)} new, {len(ok)} references, {len(failed)} failing")
    if ok and not args.no_slack:
        cats: dict[str, int] = {}
        for s in ok:
            cats[s["category"]] = cats.get(s["category"], 0) + 1
        resumo = ", ".join(f"{n} {c}" for c, n in sorted(cats.items(), key=lambda x: -x[1]))
        msg = f"🎨 Biblioteca Site Dump: {len(ok)} site(s) novo(s) ({resumo}). {SITE_URL}"
        subprocess.run([SLACK, "--agent", "caliope", "--no-wake", "feed", msg], timeout=120)
    return 0


if __name__ == "__main__":
    sys.exit(main())
