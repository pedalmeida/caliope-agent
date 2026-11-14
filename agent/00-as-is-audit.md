# Calíope Phase 0: as-is brand audit

> Written 2026-10-17. Read-only inventory of where Pedro's visual rules live today. Nothing was changed.
> Feeds Phase 0 (taste) and Phase 4 (migration) of [PLAN-caliope.md](PLAN-caliope.md).

## 1. Where the visual rules live (7 places, 4 different looks)

| # | Source | Look it encodes | State |
|---|---|---|---|
| 1 | `2. Areas/brand-v2/BRAND.md` + `tokens.css` | EMBER ramp, Archivo + JetBrains Mono + Silkscreen, vibe C "blend craft" (neobrutalist bones, hard 2px ink borders, offset shadows) | Declared source of truth. Strategy section (positioning, audience, "builds real things") is solid and Calíope inherits it |
| 2 | `~/.agents/skills/pa-pedro-web-brand` | Banner says v2 wins, body still describes Vault v4 | Stale body |
| 3 | `~/.agents/skills/pedro-deck-builder` | Vault v4 (cream `#F2EEE3`, orange `#E2542A`) | Old palette. `#E2542A` was merged into `--anchor` by v2 |
| 4 | `pedroalmeida-ai/CLAUDE.md` | "cream/orange/yellow/ink only", points to `~/Downloads/vault-design-system-v4.md` | Wrong path, old rule |
| 5 | `pedroalmeida-ai/public/style.css` | v2 tokens, but still contains `#FFD93D` (yellow, deprecated in v2) | Partly migrated |
| 6 | `content/instagram/_assets/carousel-look/SPEC.md` | Pixel world on warm cream, 6 locked colours (`#F4EBDD`, `#D96B32`, `#202426`...) | Third palette, not EMBER |
| 7 | `_hyperframes/carousel-engine/template/look1.css` | EMBER colours plus extra darks (`#1c0f0b`, `#0b0605`, `#3a2620`, `#FFF4EC`), Archivo + JetBrains Mono | What actually renders today |

Also in play: signature PNGs in `_assets/brand/`, mascot v1 to v3 in `_assets/mascot/` (v3 has a blue preview), `design-system/` in the site repo (foundations, components, patterns, `build.py`), `crm360/DESIGN_SYSTEM.md`, client token files under `cliente-a`.

## 2. What is already decided (do not reopen without a reason)

- Positioning, audiences, "Esta pessoa constrói coisas a sério" (BRAND.md §1).
- Wordmark is PEDRO ALMEIDA, no `.ai`. Domain lives in a secondary mono lockup.
- Orange law: `#F26B1F` never as text on cream (2.87:1). Text orange is `#C93A12` (4.8:1).
- Deprecated: yellow, olive, pink, `#E2542A`, `#0A0A0A`, `#6B6B6B`.

## 3. The tension Calíope has to resolve

Brand-v2 vibe C is neobrutalist with technical texture (hard shadows, mono kickers, terminals). The Calíope brief says premium, calm, sophisticated, "calma/premium wins over out-of-the-box". Those pull in different directions. Pedro already said v2 "is not differentiated". So the open question for Phase 2 is not the palette, it is whether neobrutalism survives at all or only the evidence-forward, technical-texture idea does.

## 4. Carousels to migrate (Phase 4)

- Engine: `content/instagram/_hyperframes/carousel-engine` (current), one `template/look1.css`. Legacy `_carousel-engine` (single `top5-mcps.js`) is the old Canva-era engine.
- `carousels/` holds C001 to C046 with a gap at C010 to C019, plus `_v2`: 36 numbered folders. I did not check which were published or are still in use. That needs the Notion Content Pipeline status, so it comes before any batch re-render.
- Because carousels render from one template, migration is cheap if the new system lands in `look1.css` plus assets. Cost sits in the pixel-world assets (SPEC.md layers 1 to 4) if the new look drops them.
- `pa-carousel-candidates`, `pa-linkedin-candidates`, `pa-content-factory` read the look. They need a single pointer to the new source, not copies.

## 5. Reference library that already exists

`content/instagram/_assets/referencias/` has `conceito.md` (12 lines), `conteudo.md` (16 lines) and `motion-refs/`. These are content and motion references that feed copy and scenes. They are not visual taste references. Phase 0 still needs Pedro's 8 to 12 admired and 3 hated references with one sentence each. Suggested home: `2. Areas/consilium/caliope/taste/`.

## 6. Proposed single source (to validate in Phase 3)

One folder `2. Areas/consilium/caliope/brand/` holding the brand book and tokens. Every consumer (site, decks, carousels, email, video) reads tokens from there. The seven places above become pointers. Decide DESIGN.md vs BRAND.md at that point (open item in the PLAN).

## 7. Unknowns I did not verify

- Whether pedroalmeida.ai is React/Tailwind (relevant to the 21st MCP, see `tools/21st-mcp.md`).
- Which carousels are published.
- Client-facing surfaces beyond the ones listed (proposals, Google Docs template, LinkedIn banners, email signature).
