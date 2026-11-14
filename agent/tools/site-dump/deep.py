"""Deep pass of the Site Dump: every reference read module by module.

For each site it scrolls the whole page (lazy content loads), splits it into its visual
modules (nav, hero, proof, services, about, CTA, footer...) from the DOM, crops one image per
module from the live page, and asks Claude (Sonnet, read-only) for a structured study:
art direction, content and topics, copywriting style, and one card per module with what
to take and what to skip. A second step synthesises the personal sites into one board for
Pedro's own site. Called by site_dump.py (daily, for new sites) or by hand:
  site_dump.py --deep [--deep-limit N] [--deep-url URL] [--board]
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

BLOCKS_JS = r"""
() => {
  const H = document.documentElement.scrollHeight;
  const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
  const box = (el) => { const r = el.getBoundingClientRect(); return {top: r.top + scrollY, h: r.height, w: r.width}; };
  const tallKids = (el, min) => Array.from(el.children).filter(k => vis(k) && box(k).h >= min && box(k).w > 300);
  let list = tallKids(document.body, 40);
  for (let round = 0; round < 6; round++) {
    let changed = false, next = [];
    for (const el of list) {
      const kids = tallKids(el, 60);
      if (box(el).h > 0.40 * H && kids.length >= 2) { next.push(...kids); changed = true; }
      else if (box(el).h > 0.40 * H && kids.length === 1) { next.push(kids[0]); changed = true; }
      else next.push(el);
    }
    list = next; if (!changed) break;
  }
  let blocks = list.map(el => ({el, ...box(el)})).filter(b => b.h >= 40).sort((a, b) => a.top - b.top);
  // drop blocks fully inside an earlier one (fixed headers, overlays)
  blocks = blocks.filter((b, i) => !blocks.some((o, j) => j !== i && o.h > b.h && b.top >= o.top && b.top + b.h <= o.top + o.h));
  // merge thin neighbours so each module is a real section
  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && (b.h < 220 || last.h < 120) && merged.length > 1 && !/^(header|nav|footer)$/i.test(b.el.tagName))
      { last.els.push(b.el); last.h = Math.max(last.h, b.top + b.h - last.top); }
    else merged.push({els: [b.el], top: b.top, h: b.h});
  }
  while (merged.length > 16) {  // too many: join the smallest adjacent pair
    let k = 0, best = 1e9;
    for (let i = 0; i < merged.length - 1; i++) { const s = merged[i].h + merged[i+1].h; if (s < best) { best = s; k = i; } }
    const a = merged[k], b = merged[k+1];
    a.els.push(...b.els); a.h = b.top + b.h - a.top; merged.splice(k + 1, 1);
  }
  const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return null; };
  const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
  return merged.map((m, i) => {
    const q = (sel) => m.els.flatMap(e => Array.from(e.querySelectorAll(sel)));
    const heads = q('h1,h2,h3,h4').map(h => txt(h.innerText)).filter(Boolean).slice(0, 8);
    const ctas = q('a,button').filter(a => { const s = getComputedStyle(a); const t = txt(a.innerText);
        return t && t.length < 40 && (a.tagName === 'BUTTON' || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') || parseFloat(s.borderWidth) > 0); })
      .map(a => txt(a.innerText)).filter((v, j, arr) => arr.indexOf(v) === j).slice(0, 6);
    const first = m.els[0];
    return {index: i + 1, top: Math.round(m.top), height: Math.round(m.h), tag: first.tagName.toLowerCase(),
      idClass: ((first.id ? '#' + first.id : '') + ' ' + (typeof first.className === 'string' ? first.className : '')).trim().slice(0, 80),
      headings: heads, ctas, images: q('img,picture,video,svg').length, background: bg(first),
      text: txt(m.els.map(e => e.innerText).join(' ')).slice(0, 700)};
  });
}
"""

SCROLL_JS = r"""
async () => {
  const step = Math.max(500, innerHeight * 0.8);
  for (let y = 0; y < document.documentElement.scrollHeight && y < 30000; y += step) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 180));
  }
  scrollTo(0, document.documentElement.scrollHeight); await new Promise(r => setTimeout(r, 600));
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 900));
  // reveal-on-scroll elements that stayed hidden: make them visible for the capture
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (parseFloat(s.opacity) === 0 && el.getBoundingClientRect().height > 20 && !el.closest('[aria-hidden="true"]')) el.style.opacity = '1';
  }
  return document.documentElement.scrollHeight;
}
"""

MODULE_TYPES = ["nav", "hero", "logos", "proof-metrics", "testimonials", "services", "offer-pricing", "about",
                "story", "case-studies", "portfolio", "process", "features", "content-writing", "media-talks",
                "faq", "newsletter", "cta", "contact", "footer", "other"]

DEEP_PROMPT = """You are Calíope, Pedro's design director. Study this saved reference module by module so that, months from now, a designer can reuse its ideas without opening the site again. Pedro is an AI consultant and trainer in Portugal building his own personal site (pedroalmeida.ai: training, discovery, development for Portuguese SMB owners, one CTA "book a call") and client sites.

Site: {name}  URL: {url}  Category: {category}
Measured (fonts, colours, meta): {measured}

The page was split into {n} modules from the DOM, top to bottom. For each, read the crop image with the Read tool (all of them, in order), and use the extracted text below. Files and text:
{blocks}

Answer with ONE JSON object and nothing else, in English, concrete and specific (name sizes, weights, positions, colours as hex when you can see them, words actually used). No generic praise, no em dashes. Quote real copy only in short fragments (under 15 words each).
{{
 "oneLiner": "what this site is and the single idea that makes it work, 1 sentence",
 "artDirection": {{
   "concept": "the visual idea in 1 to 2 sentences",
   "palette": [{{"hex": "#...", "role": "background / text / accent / surface ...", "share": "dominant / secondary / accent"}}],
   "typography": {{"display": "family, weight, case, tracking, approx size on desktop", "body": "family, size, measure", "accents": "mono, serif italics, labels... or null", "hierarchy": "how levels are separated"}},
   "imagery": "photography / illustration / 3D / UI shots / none; how it is treated (crop, grade, frames)",
   "layout": "grid, max width, alignment, whitespace, density, section rhythm",
   "shapesAndTexture": "radius, borders, shadows, grain, gradients, dividers",
   "motion": "what moves or is likely to move (infer from layout if not visible), or null",
   "signatureMoves": ["3 to 5 distinctive, reusable devices"]
 }},
 "content": {{
   "audience": "who it speaks to",
   "positioning": "the claim it makes, 1 sentence",
   "topics": ["themes and subjects covered, in page order"],
   "proofTypes": ["logos, numbers, testimonials, press, credentials, case studies... as actually used"],
   "ctaStrategy": "how many CTAs, labels, where they repeat, what they ask for",
   "navigation": ["nav items as shown"],
   "languages": "languages offered"
 }},
 "copy": {{
   "voice": "tone in 3 to 5 adjectives plus one sentence of explanation",
   "person": "first person singular / plural / third person / second person",
   "headlineFormula": "the pattern behind the headlines, as a reusable template",
   "sampleLines": ["up to 4 short real fragments that show the voice"],
   "ctaLabels": ["labels as written"],
   "rhythm": "sentence length, use of lists, numbers, questions, humour",
   "wordsTheyUse": ["recurring key words or phrases"]
 }},
 "modules": [{{
   "index": 1,
   "type": one of {types},
   "name": "short human name, e.g. 'Hero with split portrait'",
   "purpose": "the job this module does in the story",
   "layout": "structure: columns, alignment, sizes, order of elements",
   "visual": "colours, type, imagery, decoration specific to this module",
   "copy": "what it says and how (headline pattern, length, CTA)",
   "take": "what Pedro could reuse from this module, concrete",
   "skip": "what not to copy, or null",
   "rating": 1 to 5, how strong this module is as a reference
 }}],
 "forPedro": {{
   "take": ["3 to 5 elements worth bringing to his personal site, each naming the module"],
   "avoid": ["1 to 3 things that would not fit him"],
   "fit": "1 to 2 sentences on how this reference maps to his homepage"
 }}
}}
One entry in "modules" per module listed above, same index. If two consecutive modules are clearly one section, still describe both and say so in "purpose".
"""

BOARD_PROMPT = """You are Calíope, Pedro's design director. Pedro said: "I'm going to do a personal website, it should include elements from personal websites I like (those that are there)". Below are your deep studies of the personal sites he saved. Build the reference board for his site.

His site: pedroalmeida.ai. AI consultant and trainer in Portugal (training 50%, discovery/consulting 30%, fractional AI PM 20%), visitors are SMB owners deciding if he can really solve their problem, success is a booked call (one CTA, cal.com/pealmeida). His brand: Archivo + JetBrains Mono, cream #FBF8F1, warm ink #190D0A, orange #F26B1F as fill only (#C93A12 for orange text), 2px ink borders and hard offset shadows, craft-forward, "this person really builds things". Proof he has: career logos (Deloitte, Fidelidade, Critical Techworks, Sword, NOS, EDP, Galp, Brisa, TAP, European Commission) and three measured results.

Studies (JSON per site):
{studies}

Answer with ONE JSON object and nothing else, English, concrete, no em dashes:
{{
 "summary": "2 to 3 sentences: what these sites have in common and where Pedro's site should differ",
 "patterns": [{{"title": "a pattern seen across the sites", "seenIn": ["site names"], "why": "why it works for a one-person expert brand"}}],
 "sections": [{{
   "slot": "section of Pedro's homepage in recommended order, e.g. 'Hero', 'Proof bar', 'Services', 'About', 'Writing', 'Final CTA', 'Footer'",
   "recommendation": "what this section should do on his site, 2 sentences",
   "picks": [{{"site": "site name", "url": "url", "module": module index in that site's study, "take": "exactly which element to borrow and how to adapt it to his brand"}}],
   "copyAngle": "a headline pattern or angle for this section, inspired by the sources, in his voice, not copied"
 }}],
 "artDirection": {{"keep": ["from the references, compatible with his brand"], "translate": ["reference ideas that need adapting to his palette/type"], "reject": ["things these sites do that he should not"]}},
 "copyStyle": {{"voice": "the voice to aim for", "do": ["..."], "dont": ["..."]}},
 "openQuestions": ["decisions Pedro has to make, max 4"]
}}
Use 6 to 9 sections. Every pick must point to a real module index from the studies.
"""


def run_claude(prompt: str, add_dir: Path, env: dict, claude: str, timeout: int = 900, tries: int = 2) -> dict:
    # Engine per ~/.claude/scripts/engines.conf (codex since 2026-11-13), Claude sonnet as fallback.
    cmd = [str(Path.home() / ".claude/scripts/agent-run.sh"), "--job", "caliope-site-dump", "--claude-model", "sonnet",
           "--tools", "Read", "--cwd", str(add_dir), "--add-dir", str(add_dir), "--timeout", str(timeout - 20), "--", prompt]
    for attempt in range(tries):  # a long answer sometimes comes back as broken JSON: ask once more
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=str(add_dir), env=env)
        start = out.stdout.find("{")
        try:
            if start < 0:
                raise RuntimeError(f"no JSON from claude: {out.stdout[:200]} {out.stderr[:200]}")
            text = out.stdout[start:].replace("—", ",").replace("–", "-")
            return json.JSONDecoder().raw_decode(text)[0]  # first object only, ignore any text after it
        except (ValueError, RuntimeError):
            if attempt == tries - 1:
                raise


def deep_capture(items: list[dict], shots: Path, dismiss, log) -> None:
    """Full-page scroll, module split, one crop per module. Sequential, one browser."""
    from playwright.sync_api import sync_playwright

    out = shots / "deep"
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for item in items:
            sid = item["id"]
            try:
                ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1,
                                          locale="pt-PT", ignore_https_errors=True)
                page = ctx.new_page()
                page.goto(item.get("finalUrl") or item["url"], wait_until="domcontentloaded", timeout=45000)
                try:
                    page.wait_for_load_state("networkidle", timeout=12000)
                except Exception:
                    pass
                page.wait_for_timeout(2000)
                dismiss(page)
                height = page.evaluate(SCROLL_JS)
                page.wait_for_timeout(800)
                blocks = page.evaluate(BLOCKS_JS)
                if not blocks:
                    raise RuntimeError("no modules found")
                for old in out.glob(f"{sid}-m*.jpg"):
                    old.unlink()
                for b in blocks:
                    h = max(60, min(b["height"], 1800))
                    path = out / f"{sid}-m{b['index']:02d}.jpg"
                    page.screenshot(path=str(path), type="jpeg", quality=62, full_page=True,
                                    clip={"x": 0, "y": max(0, b["top"]), "width": 1440, "height": h})
                    b["shot"] = f"shots/deep/{path.name}"
                    b["cropped"] = b["height"] > 1800
                item["deepBlocks"] = blocks
                item["pageHeight"] = height
                ctx.close()
                log(f"deep captured {item['url']} ({len(blocks)} modules)")
            except Exception as exc:
                item["deepError"] = str(exc).splitlines()[0][:200]
                log(f"deep capture failed {item['url']}: {item['deepError']}")
        browser.close()


def deep_analyse(item: dict, shots: Path, env: dict, claude: str) -> dict:
    blocks = item["deepBlocks"]
    lines = []
    for b in blocks:
        lines.append(f"[{b['index']}] file {shots.parent / b['shot']} | {b['height']}px tall{' (cropped at 1800)' if b.get('cropped') else ''}"
                     f" | <{b['tag']}> {b['idClass']} | bg {b['background']} | images {b['images']}\n"
                     f"    headings: {json.dumps(b['headings'], ensure_ascii=False)}\n"
                     f"    ctas: {json.dumps(b['ctas'], ensure_ascii=False)}\n    text: {b['text'][:500]}")
    measured = {k: v for k, v in (item.get("measured") or {}).items() if k != "text"}
    prompt = DEEP_PROMPT.format(name=item["name"], url=item["url"], category=item.get("category"),
                                measured=json.dumps(measured, ensure_ascii=False)[:1500], n=len(blocks),
                                blocks="\n".join(lines), types=json.dumps(MODULE_TYPES))
    data = run_claude(prompt, shots, env, claude)
    by_index = {b["index"]: b for b in blocks}
    for m in data.get("modules", []):
        b = by_index.get(m.get("index"))
        if b:
            m["shot"] = b["shot"]
            m["top"], m["height"] = b["top"], b["height"]
    return data


PERSONAL_EXTRA = ("solofounder.pt",)  # one-person brands Pedro saved under other categories


def is_personal(site: dict) -> bool:
    return site.get("status") == "ok" and (site.get("category") == "personal-site"
                                           or any(d in site["url"] for d in PERSONAL_EXTRA))


def personal_sites(lib: dict) -> list[dict]:
    seen, out = set(), []
    for s in lib["sites"]:
        if is_personal(s) and s.get("deep"):
            host = re.sub(r"^www\.", "", re.sub(r"^https?://", "", s["url"]).split("/")[0])
            if host in seen:
                continue
            seen.add(host)
            out.append(s)
    return out


def build_board(lib: dict, shots: Path, env: dict, claude: str) -> dict:
    sites = personal_sites(lib)
    studies = []
    for s in sites:
        d = s["deep"]
        studies.append({"site": s["name"], "url": s["url"], "oneLiner": d.get("oneLiner"),
                        "artDirection": d.get("artDirection"), "content": d.get("content"), "copy": d.get("copy"),
                        "modules": [{k: m.get(k) for k in ("index", "type", "name", "purpose", "layout", "visual", "copy", "take", "rating")}
                                    for m in d.get("modules", [])]})
    board = run_claude(BOARD_PROMPT.format(studies=json.dumps(studies, ensure_ascii=False)), shots, env, claude, timeout=1200)
    lookup = {s["url"]: s for s in sites}
    names = {s["name"]: s for s in sites}
    for sec in board.get("sections", []):
        for pk in sec.get("picks", []):
            s = lookup.get(pk.get("url")) or names.get(pk.get("site"))
            if not s:
                continue
            pk["id"] = s["id"]
            mod = next((m for m in s["deep"].get("modules", []) if m.get("index") == pk.get("module")), None)
            if mod:
                pk["shot"], pk["moduleName"] = mod.get("shot"), mod.get("name")
    board["sites"] = [{"id": s["id"], "name": s["name"], "url": s["url"], "shot": (s.get("shots") or {}).get("desktop")} for s in sites]
    return board
