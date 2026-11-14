# Brand profiles

A brand profile is everything brand-specific Calíope needs for one project: tokens, palette, type, shapes, motion, icon and illustration language, pinned exceptions, taste references, and the production source of truth. It lives in the project, never in this skill. Calíope loads one per piece of work and asks which one when the project is ambiguous.

## Format

Default: the two files Impeccable reads, at the project root.

- `PRODUCT.md`: platform, stack, users, purpose, positioning, operating context, constraints.
- `DESIGN.md`: colour tokens with use and contrast notes, type roles, shape and depth, spacing, icons and illustration, motion, components, browser surfaces, and a closing section of **deliberate exceptions** pinned by the owner so nobody "fixes" them. Google's DESIGN.md format (YAML tokens plus prose) is accepted too and can be linted with `npx @google/design.md lint`.

Optional: `docs/references/` for reference boards, and a taste file listing admired and hated references with one sentence each.

A project with an older brand file (for example `BRAND.md` + `tokens.css`) keeps it; the profile entry below points to it and Calíope reads it as the DESIGN.md.

## Creating a profile

1. Existing product or site: `impeccable document` derives DESIGN.md from the code; measure the live site's computed styles to confirm.
2. New product: `impeccable init` for PRODUCT.md, then the reference step and a direction, then DESIGN.md from the chosen direction.
3. Show the owner, take their edits as the source of truth, then add a row below.

## Registry

| Profile | Production source of truth | Taste and references | Notes |
|---|---|---|---|
| Pedro Almeida (personal brand, pedroalmeida.ai ecosystem) | `2. Areas/brand-v2/BRAND.md` + `tokens.css` (EMBER) until v3 is approved | `2. Areas/consilium/caliope/taste/references.md`; v3 work in `2. Areas/consilium/caliope/directions/` (direction A, Ledger) | Brand rules in `2. Areas/consilium/caliope/profiles/pedro-almeida.md`. Deploys via `pa-pedro-web-brand`, decks via `pedro-deck-builder` |
| Sadhana Intensive Companion | `2. Areas/am/sadhana-intensive/DESIGN.md` + `PRODUCT.md` | `docs/2026-10-23-companion-v3-plan.md` | Pinned exceptions listed at the end of its DESIGN.md |

Add one row per project that gets a profile.
