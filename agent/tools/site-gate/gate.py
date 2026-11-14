#!/usr/bin/env python3
"""Password gate for caliope.pedroalmeida.ai, the same pattern as pedroalmeida.ai/worker/gate.ts.

Caddy asks this service on every request (forward_auth to /_auth). A request with the
right `pa_gate` cookie passes; anything else gets the branded password page. The form
posts to /_gate, which sets the cookie for 30 days and sends the visitor back.

The password is never here: only its SHA-256 after normalising (lowercase, no spaces),
read from CALIOPE_GATE_HASH (EnvironmentFile ~/.agency-secrets/caliope-site.env).
Stdlib only, listens on 127.0.0.1:8791.
"""
import hashlib
import hmac
import html
import os
import re
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

HASH = os.environ["CALIOPE_GATE_HASH"].strip()
COOKIE = "pa_gate"
DAYS = 30
PORT = int(os.environ.get("CALIOPE_GATE_PORT", "8791"))

LOGO = """<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 140" role="img" aria-label="Pedro Almeida">
<text x="0" y="56" textLength="300" lengthAdjust="spacingAndGlyphs" font-family="Archivo" font-weight="900" font-size="66" font-stretch="62%" fill="#190D0A">PEDRO</text>
<rect x="0" y="72" width="300" height="60" rx="10" fill="#190D0A"/>
<text x="14" y="117" textLength="238" lengthAdjust="spacingAndGlyphs" font-family="Archivo" font-weight="900" font-size="44" font-stretch="88%" fill="#FBF8F1">ALMEIDA</text>
<rect x="264" y="86" width="16" height="34" fill="#F26B1F"/></svg>"""


def page(nxt: str, wrong: bool) -> bytes:
    err = '<p class="erro" role="alert">Password errada. Tenta outra vez.</p>' if wrong else ""
    return f"""<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calíope · Pedro Almeida</title><meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F1EA;color:#190D0A;
font-family:Archivo,system-ui,sans-serif;line-height:1.5;padding:24px;-webkit-font-smoothing:antialiased}}
.box{{width:100%;max-width:470px;background:#FBF8F1;border:2px solid #190D0A;border-radius:12px;box-shadow:5px 5px 0 #190D0A;padding:34px 30px}}
.logo{{width:120px;height:auto;display:block;margin-bottom:30px}}
.k{{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C93A12;margin-bottom:12px}}
h1{{font-size:clamp(30px,7vw,40px);font-weight:900;line-height:1;letter-spacing:-.03em}}
p.l{{margin-top:14px;color:#75584C;font-size:16px;max-width:38ch}}
form{{margin-top:28px;display:flex;gap:10px;flex-wrap:wrap}}
input{{flex:1 1 200px;font:600 16px Archivo,sans-serif;padding:13px 15px;border:2px solid #190D0A;border-radius:10px;background:#fff;color:#190D0A;outline:none}}
input:focus{{box-shadow:3px 3px 0 #F26B1F}}
button{{font:800 15px Archivo,sans-serif;padding:13px 22px;border:2px solid #190D0A;border-radius:10px;background:#F26B1F;color:#190D0A;cursor:pointer;box-shadow:3px 3px 0 #190D0A}}
button:hover{{transform:translate(-1px,-1px);box-shadow:4px 4px 0 #190D0A}}
.erro{{margin-top:16px;font-weight:700;font-size:14px;background:#FFDCCB;border:2px solid #190D0A;border-radius:8px;display:inline-block;padding:6px 12px}}
.f{{margin-top:26px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#75584C}}
</style></head><body><main class="box">{LOGO}
<div class="k">Calíope · acesso reservado</div>
<h1>Biblioteca de referências</h1>
<p class="l">Os sites que guardaste, o laboratório de skills de design e a análise módulo a módulo. Introduz a password para entrar.</p>
<form method="POST" action="/_gate"><input type="hidden" name="next" value="{html.escape(nxt)}">
<input type="password" name="p" placeholder="Password" autofocus autocomplete="current-password" aria-label="Password">
<button type="submit">Entrar</button></form>{err}
<p class="f">caliope.pedroalmeida.ai</p></main></body></html>""".encode()


def safe_next(value: str) -> str:
    # only same-site paths, never an open redirect
    return value if re.fullmatch(r"/[^\s\\]*", value or "") and not value.startswith("//") else "/"


class Gate(BaseHTTPRequestHandler):
    server_version = "caliope-gate"

    def log_message(self, fmt, *args):  # quiet: Caddy already logs
        pass

    def has_cookie(self) -> bool:
        c = SimpleCookie(self.headers.get("Cookie", ""))
        return COOKIE in c and hmac.compare_digest(c[COOKIE].value, HASH)

    def send_page(self, nxt: str, wrong: bool) -> None:
        body = page(nxt, wrong)
        self.send_response(401)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.has_cookie():
            self.send_response(200)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        nxt = self.headers.get("X-Forwarded-Uri") or urlsplit(self.path).path
        self.send_page(safe_next(nxt), False)

    do_HEAD = do_GET

    def do_POST(self):
        size = min(int(self.headers.get("Content-Length") or 0), 4096)
        form = parse_qs(self.rfile.read(size).decode("utf-8", "replace"))
        nxt = safe_next((form.get("next") or ["/"])[0])
        tried = re.sub(r"\s+", "", (form.get("p") or [""])[0].lower())
        if hmac.compare_digest(hashlib.sha256(tried.encode()).hexdigest(), HASH):
            self.send_response(303)
            self.send_header("Location", nxt)
            self.send_header("Set-Cookie", f"{COOKIE}={HASH}; Path=/; Max-Age={DAYS * 86400}; HttpOnly; Secure; SameSite=Lax")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_page(nxt, True)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Gate).serve_forever()
