# Review format and handoff

Adopted 2026-11-13 from Íris (Pedro Ganço, CC BY 4.0). Full method, rubric and report template in Portuguese: `2. Areas/consilium/caliope/research/iris-ganco-2026-11-13/kit/docs/avaliacao-ux-ui/` (`metodo.md`, `rubrica.md`, `template-relatorio.md`).

## Every finding has seven fields

| Field | What goes in it |
|---|---|
| Problem | What is wrong, in one sentence |
| Location | Screen, component and state |
| Evidence | The observation behind it: screenshot path, measured value, computed style |
| Impact | The likely consequence for the user |
| Priority | Critical, high, medium or low, with the reason |
| Fix | A specific instruction with tokens, values or behaviour. Never "improve the spacing" |
| Acceptance | An observable condition that proves the fix |

Rules:
- Label each finding as usability, consistency or aesthetics. Do not mix them.
- Group findings with one root cause into one ("no spacing scale", not ten margin findings).
- Say what works and must stay, in a few lines.
- No numeric score without a rubric and the evidence next to it.
- With only an image, say what the image allows you to conclude and what still needs interaction.
- Overused patterns found by `scripts/iris/padroes-gastos.mjs` are a question for the person (keep or vary), not a fix, unless the social proof is invented. Record the answer in the project's design decisions so it is not asked again.

## Measure, do not estimate

```bash
cd ~/.agents/skills/pa-caliope/scripts/iris
node contrast.mjs "<fg>" "<bg>"                     # WCAG 2 and APCA
node screenshot.mjs <url> --theme both --json --out <project>/design/reviews/shots/<date>
node padroes-gastos.mjs <url>                       # 28 overused patterns, with evidence
node tokens.mjs <tokens.json> --lint                 # DTCG tokens to CSS, with lint
node svg-check.mjs icons/*.svg --icon --grid 24
python3 image-audit.py <assets-folder>
```

Extreme content for states: `.../kit/docs/avaliacao-ux-ui/dados-de-pior-caso.md` (pt-PT catalogue: long names, NIF, money, dates, empty and error states). Use it on every data screen, especially the Cliente A/Cliente A Sistema de Gestão.

## Handoff to the builder (Vitruvius or any implementation agent)

When findings go to someone else to build, write one brief per root cause:

- Goal and scope (screens, components, states)
- Tokens or rules that apply, and whether the change is local or belongs in the design system
- Expected behaviour
- The acceptance criteria copied from the findings
- Files only if you have opened them

Full template: `.../kit/skills/brief-implementacao/SKILL.md` and `.../kit/docs/avaliacao-ux-ui/template-brief-agente.md`.

## Re-check after implementation

Repeat the same screenshots (same sizes, themes and states) and compare side by side. For each acceptance criterion mark met, not met or regression. A fix is verified only when seen rendered, never because the code changed.
