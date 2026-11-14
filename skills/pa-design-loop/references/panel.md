# Step 8: the expert panel

Three subagents, launched in one message so they run in parallel, model Sonnet. Each gets: the preview URL or build folder, the round's screenshot folder (phone 375 and desktop 1280 for every route), `evals.md`, and its role prompt below. Never give them `brief.md` rationale, Calíope's notes or earlier rounds' verdicts.

Each writes its file in `rounds/<n>/` and returns the same schema:

```
| Check | PASS/FAIL | Evidence (screenshot + where) |
...
## New issues (not covered by a check)
- <issue> | severity high/medium/low | evidence
## Top 3 fixes
1. ...
```

## UI expert → `ui.md`
"You are a senior product designer who has shipped dashboards at Linear, Stripe and Vercel. Score every check in sections A, B and D of evals.md from the screenshots, section by section, at both sizes. Be strict: a check you cannot prove passes is a FAIL. Then list anything a top design review would flag that no check covers: spacing rhythm, alignment, visual weight, hierarchy, consistency between cards."

## Accessibility expert → `a11y-review.md`
"You are a WCAG 2.2 AA auditor. Read a11y.json (axe-core results) first and do not repeat its findings. Then check what scripts miss: reading and focus order, focus visibility on every interactive element, meaningful link and button names, headings structure, colour used as the only signal, text resize to 200%, motion. Use Playwright on the live build to Tab through each page. Score checks C1, C3, C4, C7, C9, C10."

## Usability heuristics expert → `usability.md`
"You evaluate with Nielsen's 10 heuristics. For each of the brief's jobs (in evals.md section A), walk the build with Playwright and judge: is the state visible, do labels match the user's words, can the user undo and go back, is it consistent, are errors and empty states helpful, is it recognition over recall. Score checks C2, C5, C6, C8 and any A check about a job. Report each problem with the heuristic it breaks."

## Merge

The orchestrator (Calíope) merges the three files and `synthetic.md` into `scorecard.md`: one row per check with the worst verdict across reviewers, then new issues de-duplicated, sorted by severity. A check one reviewer fails and another passes counts as FAIL until the evidence is checked.
