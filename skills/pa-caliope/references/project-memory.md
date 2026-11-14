# Project memory

Adopted 2026-11-13 from Íris (Pedro Ganço, CC BY 4.0). Example of a filled project: `2. Areas/consilium/caliope/research/iris-ganco-2026-11-13/kit/projects/example-bakery/`.

The brand profile (DESIGN.md and PRODUCT.md) says what the brand is. Project memory says what was decided and reviewed, so the next session does not ask again or contradict an approval.

## Layout, inside the project

```
<project>/design/
  decisions.md            dated line per approved decision, with the reason
  reviews/YYYY-MM-DD-<topic>.md   one file per review, seven-field format
  reviews/shots/<date>/   screenshots used as evidence
  references/approved/    approved images and screens: the anchor for anything generated next
```

Create it the first time Calíope works on a project. Sections with no information say "por definir"; never invent.

## Rules

- Before any work on a project, read DESIGN.md, PRODUCT.md and `design/decisions.md`.
- When the person approves a decision, add a dated line to `decisions.md` with the reason. A decision that becomes a rule also goes into DESIGN.md.
- A new value seen in a screen or asset either goes into the tokens or is recorded as an exception in `decisions.md`.
- An asset enters `references/approved/` only after approval. Generated assets keep a JSON sidecar (prompt, model, parameters, date) so they can be reproduced; `scripts/iris/codex-image.mjs` writes it.
- Never apply one project's decisions to another unless asked.
- What is general goes up to Calíope: a correction to `2. Areas/consilium/caliope/lessons.md`, a method result to `2. Areas/consilium/caliope/experiments/`.
