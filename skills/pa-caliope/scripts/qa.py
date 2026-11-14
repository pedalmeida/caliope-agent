"""Functional QA gate for any web surface Calíope ships. Generalised from
`2. Areas/am/sadhana-intensive/scripts/qa.py`, which caught a back link covered by a decorative
numeral and a 4 px horizontal scroll that a visual skim had missed.

    python3 qa.py path/to/build                    # serves the folder locally and checks it
    python3 qa.py https://preview.example.com/x/   # checks a live or preview URL
    python3 qa.py build --routes "#/" "#/about" --shots qa-shots --media

It starts from the given page, adds any --routes, and crawls internal links (same origin, plus
hash routes like "#/class/3") up to --max-pages. On every page, at phone (375x812) and desktop
(1280x900), it fails on:
  - a JavaScript error, an HTTP error, or an empty page;
  - horizontal scroll;
  - a visible link or button that another element covers (checked with elementFromPoint at its
    centre after scrollIntoView), unless the cover is a fixed or sticky layer (tab bar, sheet,
    modal backdrop) or matches --fixed-ui;
  - an internal link that leads to an empty or broken page;
  - an image that does not load;
  - with --media, an audio or video element that does not start playing within 6 s.
With --shots DIR it also saves a full-page screenshot of every page at both sizes, for the
visual review step. Exit code 0 means every check passed. Needs Python Playwright.
"""
import argparse, functools, http.server, re, sys, threading
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse
from playwright.sync_api import sync_playwright

VIEWPORTS = {"phone": (375, 812), "desktop": (1280, 900)}


# Use whichever Playwright Chromium is already on disk, so the check never has to download one.
def chromium_path():
    cache = Path.home() / "Library/Caches/ms-playwright"
    for pattern in ("chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell",
                    "chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium",
                    "chromium-*/chrome-linux*/chrome"):
        found = sorted(cache.glob(pattern), reverse=True)
        if found:
            return str(found[0])
    return None


# For every visible link or button: scroll it to the middle of the screen and ask the browser
# which element is really at its centre. If it is not the element (or inside it), it is covered.
COVERED_JS = """([root, fixedUi]) => {
  const bad = [];
  const scope = document.querySelector(root) || document.body;
  // Fixed or sticky layers (tab bars, sheets, modal backdrops) are expected to sit over content.
  const layer = (n) => { for (let x = n; x && x !== document.body; x = x.parentElement) {
    const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return x; } return null; };
  const isFixed = (n) => (fixedUi && n.closest(fixedUi)) || layer(n);
  for (const el of scope.querySelectorAll('a[href], button')) {
    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height || getComputedStyle(el).visibility === 'hidden' || el.closest('[hidden], details:not([open]) > :not(summary)')) continue;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 12);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || el.contains(hit) || hit.contains(el)) continue;
    if (isFixed(hit) && layer(hit) !== layer(el)) continue;   // overlay UI over content is expected
    bad.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 40)}" covered by ${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 40)}`);
  }
  return bad;
}"""

TEXT_JS = "(root) => (document.querySelector(root) || document.body).innerText.trim().length"
BROKEN_IMG_JS = """() => [...document.images].filter(i => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight)
  .filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.getAttribute('src'))"""
LINKS_JS = "() => [...document.querySelectorAll('a[href]')].map(a => a.href)"


def serve(path):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = functools.partial(Quiet, directory=str(path))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_port}/"


def internal(href, base):
    """Return the page key for an internal link, or None. Hash routes (#/...) count as pages."""
    b, h = urlparse(base), urlparse(href)
    if h.scheme not in ("http", "https") or h.netloc != b.netloc or not h.path.startswith(b.path.rsplit("/", 1)[0]):
        return None
    if re.search(r"\.(pdf|zip|png|jpe?g|webp|gif|svg|mp3|mp4|m4a|webm|json|xml|txt)$", h.path, re.I):
        return None
    url, frag = urldefrag(href)
    url = re.sub(r"/index\.html?$", "/", url)
    return url + "#" + frag if frag.startswith("/") or frag.startswith("!") else url


def slug(key, base):
    s = key[len(base):] if key.startswith(base) else key
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-") or "home"


def check_page(page, key, tag, args, w, fails):
    errors = []
    on_error = lambda e: errors.append(str(e))
    page.on("pageerror", on_error)
    resp = page.goto(key)
    page.wait_for_timeout(args.wait)
    if resp and resp.status >= 400:
        fails.append(f"{tag}: dead internal link (HTTP {resp.status})")
        page.remove_listener("pageerror", on_error)
        return []
    if page.evaluate(TEXT_JS, args.root) < 40:
        fails.append(f"{tag}: page is empty")
    sw = page.evaluate("document.documentElement.scrollWidth")
    if sw > w + 1:
        fails.append(f"{tag}: horizontal scroll ({sw}px wide in a {w}px window)")
    for b in page.evaluate(COVERED_JS, [args.root, args.fixed_ui]):
        fails.append(f"{tag}: {b}")
    page.evaluate("window.scrollTo(0, 0)")
    for src in page.evaluate(BROKEN_IMG_JS):
        fails.append(f"{tag}: image did not load: {src}")
    if args.media:
        for i in range(page.locator("audio, video").count()):
            ok = page.evaluate("""async (i) => { const m = document.querySelectorAll('audio, video')[i];
              m.muted = true; try { await m.play(); } catch (e) { return false; }
              await new Promise(r => setTimeout(r, 6000)); const ok = m.currentTime > 0.3 && !m.paused; m.pause(); return ok; }""", i)
            if not ok:
                fails.append(f"{tag}: media #{i + 1} did not start within 6 s")
    for e in errors:
        fails.append(f"{tag}: JavaScript error: {e}")
    page.remove_listener("pageerror", on_error)
    return page.evaluate(LINKS_JS)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="build folder or http(s) URL")
    ap.add_argument("--routes", nargs="*", default=[], help="extra routes relative to the target, e.g. '#/about' 'pricing/'")
    ap.add_argument("--max-pages", type=int, default=60)
    ap.add_argument("--root", default="main, #view, #app, body", help="selector for the content area")
    ap.add_argument("--fixed-ui", default="header, nav, [role=dialog], .tabs, .top, .sheet",
                    help="selectors for fixed UI allowed to sit over content")
    ap.add_argument("--wait", type=int, default=700, help="ms to wait after each navigation")
    ap.add_argument("--media", action="store_true", help="also check that audio/video starts")
    ap.add_argument("--shots", help="folder for full-page screenshots at both sizes")
    args = ap.parse_args()

    srv = None
    if re.match(r"https?://", args.target):
        base = args.target
    else:
        srv, base = serve(Path(args.target).resolve())
    base = base if base.endswith("/") or "#" in base else base + "/"
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    fails = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium_path())
        for vp, (w, h) in VIEWPORTS.items():
            ctx = browser.new_context(viewport={"width": w, "height": h}, service_workers="block")
            page = ctx.new_page()
            queue = [base] + [urljoin(base, r) for r in args.routes]
            seen = set()
            while queue and len(seen) < args.max_pages:
                key = queue.pop(0)
                if key in seen:
                    continue
                seen.add(key)
                tag = f"[{vp}] {key[len(base):] or '/'}"
                for href in check_page(page, key, tag, args, w, fails):
                    k = internal(href, base)
                    if k and k not in seen:
                        queue.append(k)
                if shots:
                    page.screenshot(path=str(shots / f"{slug(key, base)}-{vp}.png"), full_page=True)
            if queue:
                print(f"[{vp}] stopped at --max-pages {args.max_pages}; {len(set(queue) - seen)} pages not checked")
            ctx.close()
        browser.close()
    if srv:
        srv.shutdown()
    if fails:
        print(f"QA FAILED ({len(fails)}):")
        for f in fails:
            print(" -", f)
        sys.exit(1)
    print(f"QA passed: {len(VIEWPORTS)} viewports, {len(seen)} pages per viewport." + (f" Screenshots in {shots}." if shots else ""))


if __name__ == "__main__":
    main()
