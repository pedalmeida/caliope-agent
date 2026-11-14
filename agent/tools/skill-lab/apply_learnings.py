#!/usr/bin/env python3
"""Apply the method changes Pedro approved in #decisoes (the lab's learn step proposes them).

The weekly lab (VPS) proposes at most 2 changes to Calíope's method, each posted in #decisoes as
"🧪 Proposta de método [L2026W47-1]". This runs on the Mac (it owns the vault and ~/.agents/skills),
daily at the end of the Site Dump job, and for each open proposal reads its reactions:
  ✅ -> appended to its target, the proposal marked "aplicada", a reply in the thread saying where;
  ❌ -> marked "descartada";
  a thread reply from Pedro -> left open: Calíope's Slack bot handles the discussion;
  nothing after 21 days -> "expirada".
Targets: "rubric" -> pa-design-loop standing rubric, section "E. Lab-learned checks";
         "lessons" -> 2. Areas/consilium/caliope/lessons.md.
State lives in the lab ledger on the VPS (hermes:~/services/caliope-site/public/lab/ledger.json).
"""
from __future__ import annotations

import datetime as dt
import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

HOME = Path.home()
LEDGER = "services/caliope-site/public/lab/ledger.json"
RUBRIC = HOME / ".agents/skills/pa-design-loop/references/standing-rubric.md"
LESSONS = Path(__file__).resolve().parents[2] / "lessons.md"
YES = {"white_check_mark", "heavy_check_mark", "ballot_box_with_check", "+1"}
NO = {"x", "negative_squared_cross_mark", "-1"}


def token() -> str:
    for line in (HOME / ".agency-secrets/slack.env").read_text().splitlines():
        if line.startswith("SLACK_CALIOPE_BOT_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("no Calíope token")


def slack(method: str, tok: str, **params) -> dict:
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(f"https://slack.com/api/{method}", data=data,
                                 headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if not out.get("ok"):
        raise RuntimeError(f"{method}: {out.get('error')}")
    return out


def channel_id(tok: str, name: str = "decisoes") -> str:
    cursor = ""
    while True:
        out = slack("conversations.list", tok, types="public_channel,private_channel", limit=1000, cursor=cursor)
        for c in out["channels"]:
            if c["name"] == name:
                return c["id"]
        cursor = out.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            raise RuntimeError(f"#{name} not visible to Calíope")


def apply(item: dict) -> str:
    today = dt.date.today().isoformat()
    if item["target"] == "rubric":
        text = RUBRIC.read_text()
        if "## E. Lab-learned checks" not in text:
            text = text.rstrip() + "\n\n## E. Lab-learned checks\nChecks the weekly skill lab found missing, each approved by Pedro in #decisoes.\n"
        n = text.split("## E. Lab-learned checks", 1)[1].count("\nE")
        text = text.rstrip() + f"\nE{n + 1}. ({today}) {item['text']} Source: lab {item['week']}, {item['id']}.\n"
        RUBRIC.write_text(text)
        return "a rubrica do design loop (pa-design-loop/references/standing-rubric.md, secção E)"
    with LESSONS.open("a") as f:
        f.write(f"- {today} · [lab-{item['id'].lower()}] {item['text']} (lab {item['week']}, aprovado no #decisoes) · visto 1× · último {today}\n")
    return "as lições da Calíope (consilium/caliope/lessons.md)"


def main() -> int:
    ledger = json.loads(subprocess.run(["ssh", "hermes", f"cat {LEDGER}"], capture_output=True, text=True,
                                       check=True, timeout=60).stdout)
    open_items = [x for x in ledger.get("learnings", []) if x.get("status") == "proposta"]
    if not open_items:
        return 0
    tok = token()
    chan = channel_id(tok)
    oldest = (dt.datetime.now() - dt.timedelta(days=30)).timestamp()
    msgs = slack("conversations.history", tok, channel=chan, oldest=f"{oldest:.0f}", limit=200)["messages"]
    changed = False
    for item in open_items:
        msg = next((m for m in msgs if f"[{item['id']}]" in m.get("text", "")), None)
        if msg is None:
            if item["proposed"] < (dt.date.today() - dt.timedelta(days=21)).isoformat():
                item["status"] = "expirada"
                changed = True
            continue
        names = {r["name"].split("::")[0] for r in msg.get("reactions", [])}
        if names & YES:
            where = apply(item)
            item.update(status="aplicada", applied=dt.date.today().isoformat(), appliedTo=where)
            slack("chat.postMessage", tok, channel=chan, thread_ts=msg["ts"], text=f"Aplicado em {where}.")
            changed = True
        elif names & NO:
            item["status"] = "descartada"
            changed = True
        elif item["proposed"] < (dt.date.today() - dt.timedelta(days=21)).isoformat() and not msg.get("reply_count"):
            item["status"] = "expirada"
            changed = True
    if changed:
        body = json.dumps(ledger, ensure_ascii=False, indent=1)
        # write back atomically on the VPS (the lab only writes it on Sundays at 21:00)
        subprocess.run(["ssh", "hermes", f"cat > {LEDGER}.tmp && mv {LEDGER}.tmp {LEDGER}"], input=body, text=True,
                       check=True, timeout=60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
