# Calíope tools

What is wired for Calíope and how to keep it running. The source list and when to use each one: `../reference-sources.md`.

## Design MCPs (user scope, Mac and VPS)

Added 2026-11-12 to `~/.claude.json` on the Mac and on `hermes` (where `claude-threads@caliope` runs), so every new Claude session sees them. Check with `claude mcp list` (on the VPS, prefix `export PATH=$HOME/.local/bin:$HOME/.local/opt/node24/bin:$PATH`).

| Name | How | Secret |
|---|---|---|
| `mobbin` | `https://api.mobbin.com/mcp`, OAuth | Claude's own OAuth store |
| `21st` | shell wrapper that loads the key, then `npx -y mcp-remote@0.1.29 https://21st.dev/api/mcp --header "x-api-key:$API_KEY_21ST"` | `~/.agency-secrets/21st.env` (Mac and VPS) |
| `inspo` | `https://inspomcp.dev/api/mcp` | none |
| `shadcn` | `npx -y shadcn@latest mcp` | none (private registries take a bearer token from the project's `.env.local`) |
| `madegood` | `https://madegooddesigns.com/inspiration/mcp` | none |

The key never sits in a config file: the wrapper reads it from `~/.agency-secrets` at start, the same pattern as `firecrawl`.

**Adding an OAuth MCP on the VPS** (Mobbin pattern, 2026-11-12): `claude mcp add --transport http --scope user --callback-port 33418 <name> <url>` on the VPS, then Pedro opens `ssh -t -L 33418:localhost:33418 hermes`, runs `claude`, `/mcp`, and signs in. Before restarting the bot, check it has no turn open (`turn_open` in `~/bin/consilium-mandato.py`).

## Site Dump library (`site-dump/`)

Daily job `com.pedro.caliope-site-dump` (Mac launchd, 07:30). `site-dump/site_dump.py` reads Pedro's Chrome bookmarks folder "Site Dump" (`~/Library/Application Support/Google/Chrome/Default/AccountBookmarks`, subfolders included), and for each new bookmark:

1. captures it with the installed Google Chrome (Playwright, `channel="chrome"`): desktop 1440x900, a 1440x2400 strip and a phone 390x844, and measures fonts and colours;
2. asks Claude Sonnet (headless, read-only, token from `claude-code.env`) for category, tags, why, what to take, what not to copy, score and `bestFor`;
3. writes `../library/site-dump.json` (vault, so Calíope reads it on the VPS);
4. rsyncs the page (`site-dump/web/`), the public JSON and the screenshots to `hermes:/home/hermes/services/caliope-site/public/`, served by Caddy at `caliope.pedroalmeida.ai` behind the password gate (below);
5. posts one line to Slack `#feed` as Calíope when new sites came in.

Sites that show an error or a bot check are kept as bookmarks with status `blocked` and are never retried or worked around. Documents, tool logins and PDFs are skipped. Log: `~/.claude/session-logs/caliope-site-dump.log`. Manual run: `python3 site_dump.py [--limit N] [--no-deploy] [--no-slack] [--recheck URL]`. A watchdog stops a run after 90 minutes.

Why the Mac: the bookmarks file only exists there, and the Mac has Chrome. The VPS only serves the files.

**Deep pass** (`site-dump/deep.py`, added 2026-11-13 at Pedro's request: "as much detail as necessary to use it in the future"). Every new reference, and the backlog with `--deep`, is studied module by module: the job scrolls the whole page, splits it into its modules from the DOM (nav, hero, proof, services, about, CTA, footer...), crops one image per module into `shots/deep/<id>-mNN.jpg`, and Claude Sonnet writes `deep` into the site's entry: `artDirection` (concept, palette with roles, typography, imagery, layout, shapes, motion, signature moves), `content` (audience, positioning, topics in page order, proof types, CTA strategy, navigation), `copy` (voice, person, headline formula, sample lines, CTA labels, rhythm, recurring words), one card per module (`type`, `name`, `purpose`, `layout`, `visual`, `copy`, `take`, `skip`, `rating`, crop) and `forPedro`. The page `site.html?id=<id>` shows it all.

**Personal-site board**: when a personal site (category `personal-site`, plus the one-person brands in `deep.PERSONAL_EXTRA`) gets a deep study, the job rebuilds `../library/personal-board.json`: the sections of Pedro's homepage in recommended order, each with the modules from his saved personal sites to borrow from, plus art direction keep/translate/reject, copy style and his open decisions. Page `personal.html`.

Manual: `python3 site_dump.py --deep [--deep-limit N]`, `--deep-url URL` (again for one site), `--board`. Set `SITE_DUMP_MAX_SECONDS=9000` for a full backlog run.

## Password gate (`site-gate/gate.py`)

Same pattern as Pedro's private pages on pedroalmeida.ai (`worker/gate.ts`): one simple password, a branded password page, a `pa_gate` cookie for 30 days. Since 2026-11-13 it replaces basic auth. VPS `systemd --user` service `caliope-gate.service` runs a copy at `~/services/caliope-site/gate.py` on `127.0.0.1:8791` (copy it again with `scp` after editing the vault file, then `systemctl --user restart caliope-gate`). Caddy asks it on every request (`forward_auth` to `/_auth`); the form posts to `/_gate`. Only the SHA-256 of the normalised password (lowercase, no spaces) is on the VPS: `CALIOPE_GATE_HASH` in `~/.agency-secrets/caliope-site.env`; the plaintext `CALIOPE_SITE_PASSWORD` is in the same file on the Mac. To change it: new password and hash in that file on both machines, restart the service.

## Look

Every page (gate, library, site studies, personal board, lab index and weekly reports) uses Pedro's brand v2 (`2. Areas/brand-v2/`): `site-dump/web/brand.css` and the shared top bar `site-dump/web/chrome.js`, served at the site root, so the lab pages written on the VPS link `/brand.css` too.

## Design skills lab (`skill-lab/`)

Pedro's request of 2026-11-13: keep up with design skills and repos, test them weekly on what he is building, report in #feed. VPS, `systemd --user` timer `caliope-skill-lab.timer` (Sundays 21:00 Lisbon), service `caliope-skill-lab.service` runs `skill-lab/skill_lab.py` from `vault-sync` (the VPS writes nothing into the vault).

1. Scout (deepened 2026-11-13, about 3,200 skills seen per run): skills.sh search API (30 design queries, install counts, growth since last week); GitHub repo search and the topics `claude-skills`, `agent-skills`, `claude-code-skills`, `anthropic-skills`, `skills` (10+ stars, pushed in the last 120 days; generic skill collections count only for their design-looking skills); GitHub code search for `SKILL.md` files about design (throttled, 8 s between queries); and the design lines of the curated awesome lists (`AWESOME_LISTS`).
2. Triage: the 35 strongest from skills.sh (growth, installs) and the 35 strongest from GitHub (stars), design-only, then Claude Sonnet as Calíope picks up to 3 not tested in the last 8 weeks.
3. Test: base (no skill), champion (starts as `anthropics/skills/frontend-design`) and each pick build `skill-lab/briefs/site-pedro.md`. Each build is a transient root-started unit dropped to `hermes` (`sudo systemd-run --uid=hermes`): `ProtectHome=tmpfs` (no home, no secrets), `ProtectSystem=strict`, writable only `/srv/caliope-lab/<run>`, the Claude binary bind-mounted read-only, the token passed by `EnvironmentFile`, tools limited to Read/Write/Edit/Glob/Grep/Skill (no Bash, no web), 1.2 GB and 30 min caps. Verified 2026-11-13: a run inside cannot read `~/.agency-secrets` or `~/.claude.json`. Skills that need scripts are tested without them.
4. Screenshots with headless Google Chrome (desktop 1440, phone 390). Generated pages are served with a `Content-Security-Policy: sandbox` header (Caddy) so they cannot act as the site's origin.
5. Judge: Claude Sonnet as Calíope scores blind (labels shuffled) on brief, hierarchy, type, craft and mobile.
6. Learn: Claude reads the scores, notes and the design loop's standing rubric and proposes at most 2 changes to the method (a new binary check for `pa-design-loop/references/standing-rubric.md`, or a lesson for `../lessons.md`), only when the run shows a gap or a repeated failure. Stored in `ledger.json` (`learnings`) and posted one per message in #decisoes as `🧪 Proposta de método [L2026W47-1]`. `skill-lab/apply_learnings.py` runs on the Mac at the end of the daily Site Dump job: ✅ appends it to its target and replies in the thread where, ❌ drops it, a thread reply leaves it to Calíope's bot, nothing for 21 days expires it.
7. Report: `lab/<ISO week>/index.html`, `lab/index.html`, `lab/ledger.json` under `~/services/caliope-site/public/`, and one line as Calíope in #feed (#decisoes when a skill earns a proposal: beats the champion by 0.5+ two weeks running).

Log `~/.local/state/caliope-skill-lab/skill-lab.log` on the VPS. Manual run: `systemctl --user start caliope-skill-lab.service`, or the script with `--skill owner/repo/skill`, `--max-tests N`, `--no-slack`.
