---
name: pa-design-loop
description: Calíope's design loop for any new screen, page, app view or visual world. Brief with the jobs the screen must do, real references, "this or that" decisions routed to the right Consilium agent (Pedro only when he asks or the decision is his alone), answers turned into binary evals, two directions, then a build judged by machine checks, a fresh expert panel (UI, accessibility, usability) and synthetic users, fixed in at most 3 rounds, reviewed by Pedro, and his feedback written back as permanent checks. pa-caliope calls it for every new surface; Vitruvius and any agent building UI can use it. Trigger on "design loop", "corre o loop de design", "entrevista-me com referências", "isto ou aquilo", "avalia este design", "evals de UI", "testes de usabilidade sintéticos", or when pa-caliope starts a new surface. Not for token fixes or small changes to an approved screen (pa-caliope's ship gate alone covers those).
---

# PA Design Loop

> Created 2026-11-13 from Pedro's ask after the Forum v1 ("too dark, too dense"): "before designing she should grab me relevant references online and tell me 'is it more like this or more like that', interview me, then transform those in evals, then have sub agents evaluate her work (UI expert, accessibility expert, usability tester), even conduct usability tests with synthetic users and improve with feedback". Approved as a 12-step loop the same day.

Calíope (`pa-caliope`) owns taste and the brand profile. This skill is the process she runs around a new surface so that Pedro is asked about taste once, early, with pictures, and never again finds a broken or bland screen himself.

## The loop

**Decisions are routed** (Pedro, 2026-11-13): every open choice is framed as a decision with references and answered by the Consilium agent whose work it is (Calíope for the look, Claudius for how Pedro uses it, Vitruvius for the build, Agrippa for operations, Ábaco for numbers, Hormozius for growth), with one second opinion. Pedro gets the decision log at review and overrides by reacting. He is asked directly only for Pedro-only decisions (first public or client release, production brand, new recurring cost, overriding his own words) or when he asks to answer himself. Method: `references/decision-routing.md`. Steps marked **Decide** follow it. Evaluators are fresh-context subagents that did not build the piece (marked **Fresh**).

### Before design
1. **Brief.** Write `brief.md`: what it is, for whom, surface, Impeccable mode, refinement or redesign, and the **3 jobs** the screen must do, written as questions the user asks ("what needs me right now?"). Real data source named. The jobs become the synthetic users' tasks in step 9.
2. **References.** Run `pa-caliope`'s reference step (`~/.agents/skills/pa-caliope/references/references-step.md`): Site Dump first, Mobbin, 21st, Inspo, Dribbble or galleries, one out-of-category. Keep 8 to 12 cards with images saved in the project. Any reference Pedro already sent is a card and counts as a strong signal.
3. **This or that (Decide).** Build the interview from the references: 5 to 7 pairs, one design axis per pair, each side a real image. Owners pick A, B or neither (Calíope for the look, Claudius for use) and write a never-list; Pedro answers himself only if he asks to. Format and axes: `references/interview.md`.
4. **Answers to evals.** Turn every answer into binary checks, merge them with the standing rubric (`references/standing-rubric.md`) and write `evals.md`. When Pedro answered himself, show him his section and let him sign off or edit before any build; when the answers were routed, his sign-off moves to the step 11 review. Method: `references/evals.md`.

### Build and judge
5. **Two directions (Decide).** Two static mockups of the main screen, real data, each already scored against `evals.md` by a fresh reviewer so a failing one is never picked. Calíope picks (second opinion Claudius) with reasons logged in `decisions.md`; one or a stated mix.
6. **Build.** shadcn/ui and the project's tokens, real data, one surface at a time, `pa-caliope` method step 5. **Content pass first** (learned on the Forum, 2026-11-13: content failed rounds 1 and 2 more than layout did): every line the UI shows (item titles, asks, routine and skill names, descriptions) must already be written in the UI language. No ticket IDs, hashes, URLs or slugs in primary text. The agent that owns the data writes the display titles, or a writer subagent drafts them. Data that cannot be fixed yet is listed as a data gap, not shipped raw.
7. **Machine checks.** Free and deterministic, run before any agent judges:
   - `python3 ~/.agents/skills/pa-caliope/scripts/qa.py <build|url> --routes ... --shots <loop>/rounds/<n>/shots`
   - `python3 ~/.agents/skills/pa-design-loop/scripts/a11y.py <build|url> --routes ... --out <loop>/rounds/<n>/a11y.json` (axe-core WCAG 2.2 AA at phone and desktop, plus visible keyboard focus)
   - `npx impeccable detect <target>`
   - From `~/.agents/skills/pa-caliope/scripts/iris/` (added 2026-11-13, from Íris): `node contrast.mjs <fg> <bg>` for every text/background pair in use (WCAG 2 and APCA), `node padroes-gastos.mjs <url>` (28 overused patterns; each hit is a keep-or-vary decision logged in the project's `design/decisions.md`, not an automatic fail), and `node tokens.mjs <tokens.json> --lint` when the project has DTCG tokens. Data screens are filled with the pt-PT worst-case data (`pa-caliope/references/review-format.md`).
   Any failure is fixed before step 8. Agents never spend tokens on what a script already catches.
8. **Expert panel (Fresh).** Three subagents in parallel, each sees only the screenshots, the live build and `evals.md` (never Calíope's reasoning or earlier verdicts): UI expert, accessibility expert, usability heuristics expert. Prompts and output schema: `references/panel.md`. Model: Sonnet (engine split).
9. **Synthetic users (Fresh).** Three personas each try the brief's 3 jobs on the live build with Playwright, out loud: steps taken, where they hesitated, success or fail, time. Personas and protocol: `references/synthetic-users.md`.
10. **Fix loop.** Merge every FAIL into `rounds/<n>/scorecard.md`, fix them all, rerun 7 to 9 with **new** reviewers. A choice made during the fix loop is a decision too: route it per `references/decision-routing.md`, or log it as "not routed, builder from panel evidence" so Pedro sees who took it. Stop when every check passes or after **3 rounds**; whatever still fails goes to Pedro with the score, never hidden.

### Test and learn
11. **Pedro review (Pedro).** Publish to a preview path. Send him: the link, the decision log, screenshots of every screen at phone and desktop with real data, the scorecard (round by round), and the three weakest things left. Never ask him to approve a deploy of anything visual without the screenshots.
12. **Learn.** Every piece of Pedro feedback becomes (a) a new binary check in the project's `evals.md` and, when it is about taste in general, in `references/standing-rubric.md` under "Pedro's learned checks" with the date, and (b) a lesson in `2. Areas/consilium/caliope/lessons.md`. Name the files changed in the report. The same correction should never be needed twice. The weekly skill lab feeds the same rubric: when a lab run shows a gap or a repeated failure the rubric misses, it proposes a check in #decisoes, and once Pedro reacts ✅ it lands under "E. Lab-learned checks" (`2. Areas/consilium/caliope/tools/skill-lab/apply_learnings.py`).

## Where the loop writes

In the project, `design-loop/<YYYY-MM-DD>-<piece>/`:

```
brief.md            step 1
references.md       step 2 (cards; images in refs/)
interview.md        step 3 (pairs, Pedro's picks, never-list)
evals.md            step 4 (Pedro's checks + standing rubric)
directions/         step 5
rounds/<n>/         steps 7-10: shots/, a11y.json, qa.txt, detect.txt, ui.md, a11y-review.md, usability.md, synthetic.md, scorecard.md
review.md           step 11 (link, Pedro's feedback verbatim)
```

## Rules

- Taste questions go to Pedro only in steps 3 to 5, with pictures. After that the evals decide; do not ask him "do you like this" mid-build.
- Reviewers are new every round and never see the builder's rationale or earlier verdicts. Anchoring is the failure this prevents.
- Binary checks only. "Looks premium" is not a check; "white cards on a light grey canvas, no dark panels" is.
- Synthetic users find findability and labelling problems. They do not judge taste; never present their pass as proof the design is good.
- Cost: panel and personas run on Sonnet. A loop is at most 3 rounds × 6 subagents.
- Skip the interview (step 3) only when the surface is a variant of one Pedro already approved through this loop; reuse that `evals.md` and say so.

## Report to Pedro

Lead with the link and the screenshots. Then: score per round (for example 12/21 → 19/21 → 21/21), what the panel and personas found and how it was fixed, what still fails, what was not checked, and which checks his feedback added.
