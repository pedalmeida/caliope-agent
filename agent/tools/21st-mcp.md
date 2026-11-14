# 21st MCP (formerly Magic MCP): tool evaluation for Calíope

> Status 2026-11-12: INSTALLED on the Mac and the VPS (user scope, free plan, key in `~/.agency-secrets/21st.env`), tested with a real `search`. Setup in `README.md`. History below: evaluated 2026-10-17. Candidate tool for phase 1 (skeleton) of [PLAN-caliope.md](../PLAN-caliope.md).
> Source: https://github.com/21st-dev/magic-mcp (6k stars, ISC license, last push 2026-09-09) and https://21st.dev/mcp

## What it is

An MCP server that gives an editor agent a catalog of React/Tailwind components, themes and templates, plus optional AI UI generation. Magic MCP was replaced by the unified "21st MCP". The `@21st-dev/magic` package is now only a compatibility proxy. Old Magic API keys were reset, so a fresh key is needed.

## Tools (current names)

| Tool | Use | Cost |
|---|---|---|
| `search` | Find components, themes, templates | Free (metadata only) |
| `get_component` | Pull a component's code | Paid retrieval |
| `get_inspiration` | Search ranked against the project's Design Context | Not stated |
| `search_logo` | Brand and UI SVG logos, one query per call | Free |
| `generate` / `iterate_generation` | Generate UI from a prompt | Paid, even on free tier; only listed if AI access is on |

Legacy names (`21st_magic_component_builder`, etc.) are translated by the server.

## Install (when we decide to)

Claude Code plugin: `claude plugin marketplace add 21st-dev/magic-mcp`, then `/plugin install 21st`. Key goes in env var `API_KEY_21ST`, stored in `~/.agency-secrets/`, never in the vault. Alternative: `npx @21st-dev/cli@latest init --client claude`.

## Fit for Calíope: verdict

- Good for: fast component inspiration and code for the site redesign (React/Tailwind), logo lookup.
- Risk: a public catalog of popular components is the opposite of "diferenciação, zero AI slop". Use it as raw material that Calíope restyles with brand tokens, never as the look.
- Stack check needed: the catalog is React/Tailwind. pedroalmeida.ai may not be (confirm before relying on it). WordPress/Elementor client sites would not benefit directly.
- Overlap: Mobbin MCP (already connected) covers real-product references; Pencil covers .pen design files. 21st adds component code, not references.
- Decision pending: whether the paid retrieval and generation are worth it. Check `get_usage.aiGenerationEnabled` after creating a key.

## Next step

Create a free key at 21st.dev/mcp, store it, install the plugin in a throwaway session, run `search` for a hero and a pricing block, and judge output quality against the Phase 0 taste references before wiring it into `pa-caliope`.
