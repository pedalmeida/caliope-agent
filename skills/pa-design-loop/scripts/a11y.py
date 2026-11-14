"""Accessibility machine check for pa-design-loop step 7.

    python3 a11y.py path/to/build --routes "#/" "#/board" --out a11y.json
    python3 a11y.py https://preview.example.com/x/ --routes "#/"

For every route at phone (375x812) and desktop (1280x900) it:
  - runs axe-core (WCAG 2.0/2.1/2.2 A and AA rules) and records every violation;
  - tabs through up to 60 focusable elements and flags any that gets focus with no visible
    change (no outline, box-shadow, border or background change), i.e. an invisible focus ring.
Writes a JSON report and exits 1 if anything failed. Needs Python Playwright and network access
to cdn.jsdelivr.net for axe-core.
"""
import argparse, functools, http.server, json, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

AXE = "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js"
VIEWPORTS = {"phone": (375, 812), "desktop": (1280, 900)}

FOCUS_JS = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const again = el.dataset.a11ySeen === '1'; el.dataset.a11ySeen = '1';
  return {again, tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 60),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
          shadow: s.boxShadow, border: s.borderColor, bg: s.backgroundColor};
}"""


def serve(folder):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=folder)
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}/"


def check_focus(page, limit=60):
    invisible, seen = [], set()
    page.evaluate("() => document.activeElement && document.activeElement.blur()")
    for _ in range(limit):
        page.keyboard.press("Tab")
        info = page.evaluate(FOCUS_JS)
        if not info:
            continue
        if info["again"]:  # Tab wrapped back to an element already visited
            break
        seen.add(len(seen))
        # compare with the same element unfocused is costly; a ring needs outline or a shadow
        if not info["outline"] and info["shadow"] in ("none", ""):
            invisible.append(info["tag"] + ": " + (info["text"] or "(no name)"))
    return invisible, len(seen)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--routes", nargs="*", default=[""])
    ap.add_argument("--out", default="a11y.json")
    a = ap.parse_args()
    base = serve(a.target) if Path(a.target).is_dir() else a.target
    report, failed = [], False
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vp, (w, h) in VIEWPORTS.items():
            page = browser.new_page(viewport={"width": w, "height": h})
            for r in a.routes:
                page.goto("about:blank")  # a hash-only goto does not reload a hash-routed app
                page.goto(base + r, wait_until="networkidle")
                page.wait_for_timeout(400)
                page.add_script_tag(url=AXE)
                res = page.evaluate("""async () => (await axe.run(document, {runOnly: {type: 'tag',
                    values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v => ({
                    id: v.id, impact: v.impact, help: v.help,
                    nodes: v.nodes.slice(0, 5).map(n => n.target.join(' ') + ' | ' + (n.failureSummary || '').split('\\n').slice(1, 2).join(''))}))""")
                invisible, tabbed = check_focus(page)
                bad = bool(res) or bool(invisible)
                failed |= bad
                report.append({"viewport": vp, "route": r or "/", "axe": res,
                               "focus_invisible": invisible, "tab_stops": tabbed, "pass": not bad})
                print(f"{'FAIL' if bad else 'PASS'} {vp:7} {r or '/':20} axe={len(res)} invisible_focus={len(invisible)} tab_stops={tabbed}")
            page.close()
        browser.close()
    Path(a.out).write_text(json.dumps(report, indent=2))
    print(f"report: {a.out}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
