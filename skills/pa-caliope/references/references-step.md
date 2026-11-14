# The reference step (mandatory)

Runs before any design decision (method step 3). It is the light, per-project version of `pa-research --referencias`: same evidence card, same channels, sized for one piece of work. Why it is mandatory: an agent with no references fills every gap with its statistical average, and naming adjectives does not move it ("2. Areas/consilium/caliope/research/2026-10-23-design-agents-benchmark.md", consensus across all five channels).

## Channels, in order

The full source list, what each is good for and how to reach it: `2. Areas/consilium/caliope/reference-sources.md` (knowledge base, verified 2026-11-12). Read its decision table first.

0. **Pedro's Site Dump library (always first for Pedro's own work and his clients).** `2. Areas/consilium/caliope/library/site-dump.json`: the sites he saved in Chrome, captured and categorised daily, with why, what to take and measured fonts and colours; browsable at `caliope.pedroalmeida.ai`. Filter by `category` and `bestFor` for the brief (a personal site starts from his saved `personal-site` entries) and use only `status == "ok"`. Screenshots on the VPS in `/home/hermes/services/caliope-site/public/shots/`. Each entry's `deep` block is a module-by-module study (art direction, content, copy, one card per module with a crop in `shots/deep/`): use it for the evidence cards. For Pedro's own personal site start from `2. Areas/consilium/caliope/library/personal-board.json`. Name the saved sites you used on the board, or say none fit.
0b. **The design skill to use.** Read the skill lab ledger (`/home/hermes/services/caliope-site/public/lab/ledger.json` on the VPS, or `https://caliope.pedroalmeida.ai/lab/`): use the current champion skill for the build unless the job needs another, and name it in the report.
1. **Design MCPs.**
   - Mobbin: `search_screens` (web or ios), `search_flows`, `search_sections`. One screen or section type per query, no style adjectives ("pricing section", "class summary screen", "Monzo takeaways"). Set `output_destination` to `code` when building. Ask for, and record, the `mobbin_url` of every example. Image URLs expire after 30 days: download the ones you keep into the project.
   - 21st: `search` and `get_inspiration` (installed 2026-11-12, free plan: 2 component copies a day). React/Tailwind, so take the pattern, never the look or the code as-is.
   - Inspo: `recommend`, `search_screens`, `find_similar` for real production sites with a DESIGN.md each (landings, personal sites).
   - shadcn: `search_items_in_registries` to find the standard component or block to build with (registries in the project's `components.json`).
   - Made Good Designs: `search_design_inspiration` for type, brand and print, a good source for the out-of-category reference.
   - Use Mobbin a second time as a critic after the first build: compare each section adversarially against the best example found.
   - Check with ToolSearch whether each MCP is connected. Not connected means "not read" in the board, never silence.
2. **The project's referenced sites.** The project's own taste or references file if it has one; for Pedro's projects without one, `2. Areas/consilium/caliope/taste/references.md`. Open each in the app's browser, screenshot at phone and desktop, and measure computed styles (families, sizes, weights, colours, radii, shadows) with `javascript_tool`. Measured beats described.
3. **Curated galleries.** Recent (ex Godly), Land-book, SaaS Landing Page, Lapa Ninja, Awwwards, One Page Love, Siteinspire, Dribbble (mood only); Really Good Emails for email. Refero and Page Flows need a paid plan we do not have. Pinterest and Are.na only when the project's references live there. Galleries that need a login are declared not read.
4. **One reference outside the category.** Editorial, luxury, physical product, signage, a museum, a game. Same-category references produce the same-category look.
5. **Community practice.** Reuse the latest research report on the theme (index in `~/.agents/skills/pa-research/references/referencias.md`). Run `pa-research --referencias` only when the problem is new and no report under 90 days covers it.

Aim for 5 to 10 cards. More references do not help if nobody says what to take from them.

## The evidence card

Same format as `pa-research --referencias`:

```
### R<n>. <product or source>, <pattern in 3-5 words>
- Source: <canonical URL, e.g. mobbin_url> | channel: <mobbin/21st/site/gallery/out-of-category> | read: <measured/screenshot/title only>
- Surface: <site, app, carousel, deck...>
- Take: <one sentence, the mechanism, not the look>
- Do not copy: <one sentence>
- Measures: <only if measured>
- Image: <local path in the project, if kept>
```

## Output

`<project>/docs/references/YYYY-MM-DD-<piece>.md` with the cards ordered by what they change, then a three-line summary: what the direction takes, what it rejects, which reference is the main one. Example of the result in practice: `2. Areas/am/sadhana-intensive/docs/2026-10-23-companion-v3-plan.md` (Monzo numbered takeaways, Headway insight card, Deepstash covers, Fibery concept map, farejo.pt's own illustration).
