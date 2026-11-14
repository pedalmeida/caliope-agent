---
title: Calíope knowledge base, UI references and component sources
verified: 2026-11-12
source report: research/2026-11-12-ui-reference-sources.md
rule: references give mechanisms, never a look to copy. Re-verify MCP commands every 90 days.
---

# Calíope knowledge base: where to look and what to pull

Read this at the reference step (`pa-caliope` method step 3). It says where to look for each kind of job, what each source is good for, and which tools you can call. Owner: Calíope. Re-verify the MCP list every 90 days (next: 2027-02-10).

## 0. What is wired today (verified 2026-11-12, one real query each in a new session on the VPS)

| MCP | Mac | VPS (your Slack bot) | Auth | Tools you will use |
|---|---|---|---|---|
| Mobbin | yes | yes | OAuth (Pro plan) | `search_screens`, `search_flows`, `search_sections` |
| 21st | yes | yes | API key `API_KEY_21ST` in `~/.agency-secrets/21st.env`, loaded by a wrapper | `search`, `get_inspiration`, `search_logo`, `get_component` (free plan: 2 component copies a day, search unlimited) |
| Inspo | yes | yes | none | `search_screens`, `recommend`, `find_similar` (real sites with a DESIGN.md each) |
| shadcn | yes | yes | none | `search_items_in_registries`, `view_items_in_registries`, `get_add_command_for_items` |
| Made Good Designs | yes | yes | none | `search_design_inspiration` (type, brand, print: your out-of-category reference) |

Not wired yet, need Pedro's OAuth sign-in (SSH tunnel pattern, see `tools/README.md`): Email Love (free account, the best email source), Figma (client files). Refero and Page Flows need a paid plan: not bought. Resend sends email, so it stays off until Pedro asks.

## 1. Pedro's own library comes first

Pedro saves sites he likes in his Chrome bookmarks folder "Site Dump". A daily job captures and categorises each one: `library/site-dump.json` next to this file (category, tags, why it is good, what to take, what not to copy, measured fonts and colours, score 1 to 5, `bestFor`). Screenshots on the VPS in `/home/hermes/services/caliope-site/public/shots/<id>-{desktop,long,mobile}.jpg`; the browsable page is `https://caliope.pedroalmeida.ai` (private).

Each reference also has a deep study under `deep` in its entry (since 2026-11-13): art direction (palette with roles, type, imagery, layout, shapes, motion, signature moves), content (audience, positioning, topics, proof, CTA strategy), copywriting style (voice, person, headline formula, sample lines, CTA labels, rhythm) and one card per module with what to take and what to skip; module crops in `shots/deep/<id>-mNN.jpg`. Read the `deep` block before opening the site. For Pedro's own personal site, start from `library/personal-board.json` (page `/personal.html`): his homepage section by section, each with the modules of his saved personal sites to borrow from.

Rule: when Pedro asks for something, start from the sites he saved in that category before any external source. A personal site starts from `category == "personal-site"`; a landing from `saas-landing`, `agency` or `course-event`; a local business from `local-business`; a retreat from `wellness-retreat`. Filter by `bestFor` too. Name the saved sites you used in the reference board, and say when none fits. Ignore entries whose `status` is not `ok`.

## 2. Design skills lab: which design skill to use

Every Sunday at 21:00 the skill lab (`tools/skill-lab/`, VPS timer `caliope-skill-lab.timer`) scouts new design skills on skills.sh and GitHub, picks up to three, and builds Pedro's current brief (now the new pedroalmeida.ai homepage, `tools/skill-lab/briefs/site-pedro.md`) with each of them, with the current champion and with no skill. You judge the screenshots blind, and the report goes to `https://caliope.pedroalmeida.ai/lab/` and one line in #feed.

Before choosing a design skill for real work, read the ledger on the VPS: `/home/hermes/services/caliope-site/public/lab/ledger.json` (`champion`, `challenger`, every skill tested with its scores). Use the champion unless the job needs something else, and say which skill you used. A skill that beats the champion by 0.5 or more two weeks in a row is proposed to Pedro in #decisoes; installing it into your own skill needs his yes. When Pedro's focus changes (a new kind of site, an app, emails), change the brief and say so in the next report. The lab also proposes improvements to your method (new rubric checks, lessons) in #decisoes; the ones Pedro approves land in the design loop's standing rubric, section E, and in `lessons.md`.

## A. Decision table: for this job, start here, then here

| Job | Start here | Then | Build with | Avoid |
|---|---|---|---|---|
| Web app screen or flow (dashboard, settings, onboarding, table, form) | Mobbin MCP `search_screens` / `search_flows`, one intent per query | Refero MCP (if subscribed) or Page Flows in a browser for recorded flows | shadcn MCP: core components and blocks, then `@coss`, `@kibo-ui` | Dribbble concepts, animated landing libraries inside app UI |
| SaaS landing page | Inspo MCP `recommend(brief)` and its DESIGN.md | Mobbin `search_sections`, SaaS Landing Page and Land-book by section | shadcn MCP with `@tailark`, `@magicui`, shadcn blocks; 21st MCP `search` for a specific section | Copying one famous site's palette and type (everyone extracts the same ten) |
| Personal site or portfolio | Recent (formerly Godly), Awwwards, Land-book portfolio category | Inspo for structure, one out-of-category reference (editorial, print, signage) | shadcn base plus `@react-bits`, `@aceternity`, `@magicui` for one signature motion | More than one heavy effect per page |
| Marketing email | Email Love MCP `search_emails` then `get_email_html` | Really Good Emails in a browser; React Email templates for structure | React Email components (or Maily editor); send tests with Resend MCP | Web components and CSS that email clients drop |
| Component or interaction detail (a pricing table, a marquee, a command menu) | shadcn MCP search across configured registries | 21st MCP `search` / `get_inspiration`; Magic UI MCP | Install via registry so code lands in the repo | Pasting code from a page without the registry (no updates, no deps) |
| Brand, type, logo | Made Good Designs MCP (type, brand references) | 21st `search_logo` for SVG logos | Pencil or Figma MCP for the canvas | Treating a gallery screenshot as a brand system |
| Existing Figma file from a client | Figma MCP (OAuth) on that file | Duplicate Community files into drafts first so the MCP can read them | Figma MCP output, then shadcn tokens | Writing to the canvas without a paid seat |

## B. Source cards

### shadcn/ui (core, blocks, MCP, registry directory)
- URL: https://ui.shadcn.com , blocks https://ui.shadcn.com/blocks , directory https://ui.shadcn.com/r/registries.json
- Take: the component API and composition rules, free blocks (dashboards, sidebars, login), and the registry directory as a map of 464 healthy libraries.
- Access: MCP, local. `pnpm dlx shadcn@latest mcp init --client claude` (writes project `.mcp.json`). Skill: `pnpm dlx skills add shadcn/ui`.
- Login: none. Cost: free.
- Gotchas: Base UI is the default since July 2026, so check `components.json` base before copying Radix examples. Private registries take a bearer token from `.env.local`, never from the file. Check a registry's health in the directory before relying on it (Aceternity, Tailark and shadcnblocks were "degraded" on 12 Nov).

### Mobbin
- URL: https://mobbin.com
- Take: how shipped products solve a screen or a flow; section patterns for marketing pages.
- Access: MCP remote `https://api.mobbin.com/mcp`, OAuth. Already connected (`mcp__mobbin__*`). Fresh setup: claude.ai connector plus `claude /login`, or `claude plugin marketplace add mobbin/skills` then `claude plugin install mobbin@mobbin`.
- Login: Mobbin account. Cost: Pro $10/mo yearly, $15/mo quarterly; free has no MCP. REST API only on Team and Enterprise.
- Gotchas: ask for a link to every example (it can name apps without showing them); it repeats examples; it can return the client's own product. Image URLs expire, download what you keep.

### Refero
- URL: https://refero.design , docs https://doc.refero.design
- Take: a second screen and flow catalogue, plus styles; useful when Mobbin keeps returning the same apps.
- Access: MCP remote. `claude mcp add --transport http refero https://api.refero.design/mcp` (OAuth), or add `--header "Authorization: Bearer <token>"`.
- Login: yes. Cost: paid plan required (Pro, Team, Lifetime); price not verified on the vendor page. 8,000 MCP calls per month per user. No trial.
- Gotchas: third-party "Refero styles" MCPs are not official. One directory reports a catalogue block for its client; test once before relying on it.

### 21st.dev (21st MCP, ex Magic MCP)
- URL: https://21st.dev , key at https://21st.dev/mcp
- Take: a specific section or component pattern from the community; logo SVGs; inspiration search.
- Access: MCP remote `https://21st.dev/api/mcp`, header `x-api-key`. Install `npx @21st-dev/cli@latest init --client claude` or `claude mcp add --transport http 21st https://21st.dev/api/mcp --header "x-api-key: $API_KEY_21ST"`.
- Login: account to get a key. Cost: free 2 component copies/day, unlimited inspiration and logo search; Builder $6/mo yearly for unlimited MCP retrieval; AI generation from $15/mo.
- Gotchas: old Magic keys were reset. Take the pattern, not the look (React/Tailwind community code varies in quality). `generate` only appears with AI access. Store the key in `~/.agency-secrets/`, never in the repo.

### Inspo (inspomcp.dev)
- URL: https://inspomcp.dev , repo Nutlope/inspo
- Take: real production sites with desktop and mobile captures, palette, fonts, a fold-by-fold breakdown and a DESIGN.md per site; 68 reference components with JSX.
- Access: MCP remote, no auth. `claude mcp add --transport http inspo https://inspomcp.dev/api/mcp` or `npx -y inspo-mcp install`.
- Login: none. Cost: free, MIT (Together AI).
- Gotchas: 832 sites is small; the same sites will recur. Use `find_similar` and then leave the archive. Screens belong to their designers.

### Email Love
- URL: https://emaillove.com
- Take: real marketing emails by brand and journey, with the HTML.
- Access: MCP remote. `claude mcp add --scope user --transport http email-love https://chat.emaillove.com/mcp`, then `/mcp` to sign in. REST API also free.
- Login: free Email Love account (OAuth). Cost: free for now; builder tools follow the Builder plan.
- Gotchas: per-minute rate limit. `get_email_html` is for study, never for resending someone's email.

### React Email (and Resend MCP)
- URL: https://react.email , templates https://react.email/templates
- Take: email-safe components, 23 open templates (Stripe, Linear, Vercel, Notion styles), embeddable editor.
- Access: npm library. Resend MCP for sending tests: `claude mcp add --transport http resend https://mcp.resend.com/mcp` (OAuth).
- Login: none for the library; Resend account for the MCP. Cost: free MIT; Resend plans for sending.
- Gotchas: the Resend MCP sends HTML, it does not render React. Test in Gmail and Outlook before calling a template done.

### Magic UI
- URL: https://magicui.design
- Take: one signature motion (marquee, text reveal, grid background) for landing and personal sites.
- Access: MCP local. `npx @magicuidesign/cli@latest install claude` or `claude mcp add magicui -- npx -y @magicuidesign/mcp@latest`. Also registry `@magicui` via shadcn MCP.
- Login: none. Cost: free components; Pro $199 one-time for blocks and templates.
- Gotchas: three generic tools only; the shadcn MCP route is enough if you already have it.

### Aceternity UI
- URL: https://ui.aceternity.com
- Take: bold hero effects and interactions for personal sites and launches.
- Access: registry `"@aceternity": "https://ui.aceternity.com/registry/{name}.json"` through the shadcn MCP. Pro: `ACETERNITY_PRO_TOKEN` in `.env.local` as a bearer header.
- Login: dashboard for Pro. Cost: free 100+; $169/yr or $199 lifetime.
- Gotchas: the house look is recognisable and heavy; use one piece, restyled. Registry health "degraded" on 12 Nov.

### coss ui (formerly Origin UI)
- URL: https://coss.com/ui (originui.com redirects here)
- Take: dense, practical app components on Base UI, from the Cal.com team.
- Access: registry `@coss` (607 items) via the shadcn MCP.
- Login: none. Cost: free, open source.
- Gotchas: old Origin UI links and tutorials point to a different structure.

### Tailark
- URL: https://tailark.com
- Take: marketing page blocks (hero, features, pricing, footer) already on shadcn.
- Access: registry `@tailark` via the shadcn MCP.
- Login: licence for premium. Cost: free tier; $249 / $299 / $499 one-time.
- Gotchas: many sites already use Tailark heroes; change layout and type, not just colour.

### Kibo UI
- URL: https://www.kibo-ui.com
- Take: hard app widgets shadcn lacks (Gantt, Kanban, color picker, dropzone, code block).
- Access: MCP remote `https://www.kibo-ui.com/api/mcp/mcp` (no auth; docs show it through `mcp-remote`): `claude mcp add kibo-ui -- npx -y mcp-remote https://www.kibo-ui.com/api/mcp/mcp`. Registry `@kibo-ui`.
- Login: none. Cost: free.
- Gotchas: now under the shadcnblocks organisation; check last release before a big dependency.

### React Bits
- URL: https://reactbits.dev
- Take: animated text, backgrounds and micro-interactions for personal sites.
- Access: registry `@react-bits` (1,274 items) via shadcn MCP, or its CLI.
- Login: none. Cost: free; Pro tier not reviewed.
- Gotchas: pick the TS + Tailwind variant; performance cost on mobile.

### HyperUI
- URL: https://www.hyperui.dev
- Take: plain Tailwind HTML patterns, incl. neobrutalism, for non-React pages.
- Access: browse and copy. Login: none. Cost: free MIT.
- Gotchas: not shadcn; translate to tokens before using in an app.

### Figma (MCP and Community)
- URL: https://www.figma.com/community , docs https://developers.figma.com/docs/figma-mcp-server
- Take: a client's existing file; Community UI kits as structure.
- Access: MCP remote, OAuth. `claude plugin install figma@claude-plugins-official` or `claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user`.
- Login: Figma account. Cost: free to read; canvas writes need a paid seat (third-party claim).
- Gotchas: reads only files the account can open, so duplicate Community files first.

### Made Good Designs
- URL: https://madegooddesigns.com
- Take: typography, brand and print references; out-of-category input.
- Access: MCP remote, no auth: `claude mcp add --transport http madegood https://madegooddesigns.com/inspiration/mcp`.
- Login: none (boards need Google sign-in). Cost: free.
- Gotchas: small UI set; best as the "outside the category" reference.

### Recent (formerly Godly)
- URL: https://recent.design (godly.website redirects)
- Take: current web, motion and branding taste; launch videos.
- Access: browse-only. Login: none. Cost: free.
- Gotchas: reported to block AI crawlers; open in the app browser and screenshot.

### Land-book
- URL: https://land-book.com
- Take: websites by page type (pricing, about, case study, sign up, portfolio).
- Access: browse-only. Login: to save. Cost: free; Pro $9/mo or $6/mo yearly for boards, filters, copy and download.
- Gotchas: "PRO" items and copy actions are paywalled.

### SaaS Landing Page
- URL: https://saaslandingpage.com
- Take: SaaS sections filtered by type, stack and font (~850 pages).
- Access: browse-only. Login: none. Cost: free.
- Gotchas: sponsored entries mixed in.

### Lapa Ninja
- URL: https://www.lapa.ninja
- Take: landing page gallery by category.
- Access: browse-only, Cloudflare challenge blocks fetchers. Login: none to browse.
- Gotchas: only through the real browser.

### Awwwards
- URL: https://www.awwwards.com
- Take: craft and motion for personal sites and portfolios.
- Access: browse-only. Unofficial `npx -y awwwards-mcp` exists (scraper, no keys); do not wire by default.
- Login: none to browse. Cost: free browse.
- Gotchas: juried for craft, not conversion. Weak for SaaS or app patterns.

### Page Flows
- URL: https://pageflows.com
- Take: recorded flows (onboarding, checkout, cancellation) as video.
- Access: browse-only, Cloudflare. Login: paid account, 3-day trial; price unverified.
- Gotchas: overlaps with Mobbin flows; only worth it for motion of a flow.

### Dribbble
- URL: https://dribbble.com
- Take: illustration, icon and mood direction.
- Access: browse-only in practice (API needs a registered OAuth app, 1,440 requests/day).
- Gotchas: concepts, not shipped product. Never use as UI evidence.

### Really Good Emails
- URL: https://reallygoodemails.com
- Take: curated email layouts by type.
- Access: browse-only, no MCP. Login for exports. Cost: $0 (6 exports/mo), $30/mo, $160/mo.

### Maily.to
- URL: https://maily.to , repo arikchakma/maily.to
- Take: open-source email editor on Tiptap and shadcn that outputs React Email.
- Access: npm. Cost: free MIT. Gotchas: last commit July 2026.

### Dropped: Lazyweb
- Was a free design-screens MCP; on 12 Nov 2026 it is an agent-analytics product and its public MCP only answers questions about Lazyweb. Remove from channel lists.

## C. MCPs worth wiring, ranked by value

Keys go in `~/.agency-secrets/`, referenced by variable name only.

| Rank | MCP | Claude Code command | Auth | Note |
|---|---|---|---|---|
| 1 | shadcn | `pnpm dlx shadcn@latest mcp init --client claude` | none (bearer per private registry) | per project; reaches every registry in `components.json` |
| 2 | Mobbin | already connected; else `claude plugin marketplace add mobbin/skills` then `claude plugin install mobbin@mobbin` | OAuth | Pro plan |
| 3 | Inspo | `claude mcp add --scope user --transport http inspo https://inspomcp.dev/api/mcp` | none | free |
| 4 | Email Love | `claude mcp add --scope user --transport http email-love https://chat.emaillove.com/mcp` | OAuth (free account) | email jobs |
| 5 | 21st | `npx @21st-dev/cli@latest init --client claude` | API key (`API_KEY_21ST`) | free key works; Builder $6/mo for unlimited retrieval |
| 6 | Figma | `claude plugin install figma@claude-plugins-official` | OAuth | client files |
| 7 | Resend | `claude mcp add --transport http resend https://mcp.resend.com/mcp` | OAuth | email tests and sends; sending needs Pedro's approval |
| 8 | Refero | `claude mcp add --scope user --transport http refero https://api.refero.design/mcp` | OAuth (or bearer) | only if subscribed |
| 9 | Kibo UI | `claude mcp add kibo-ui -- npx -y mcp-remote https://www.kibo-ui.com/api/mcp/mcp` | none | optional, shadcn MCP covers installs |
| 10 | Magic UI | `claude mcp add magicui -- npx -y @magicuidesign/mcp@latest` | none | optional, shadcn MCP covers installs |
| 11 | Made Good Designs | `claude mcp add --scope user --transport http madegood https://madegooddesigns.com/inspiration/mcp` | none | out-of-category references |

Commands verified verbatim on vendor docs: shadcn, Mobbin plugin, Inspo, Email Love, 21st CLI, Figma, Resend, Refero. Derived from documented endpoints or JSON configs (test once): Kibo UI, Magic UI `claude mcp add` form, Made Good Designs.

Not worth wiring: Lazyweb (pivoted), `awwwards-mcp` (unofficial scraper), `shadcn.exchange` (503 on 12 Nov, unverified).
