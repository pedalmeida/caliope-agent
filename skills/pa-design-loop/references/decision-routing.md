# Decision routing

> Pedro, 2026-11-13: "find me references, frame them as directions, decisions etc, and then you can have the right agents [decide] based on what makes more sense based on the work we do". He tested it on the Forum: Calíope and Claudius answered the interview and Calíope picked the direction.

Default mode of the loop. Pedro is asked only when a decision is his alone (below) or when he asks to answer himself. Every other decision goes to the Consilium agent whose work it is.

## 1. Frame every open choice as a decision

From the references, write each open choice as a decision card in `decisions.md` (in the loop folder):

```
### D<n>. <question in plain words>
- Options: A <label> (ref image) | B <label> (ref image) [| C]
- Owner: <agent> (+ second opinion: <agent>)
- Answer: <pick> | Reason: <one line, grounded in a file the agent owns>
- Second opinion: <pick> | Reason: ...
- Final: <pick or merge> | Rule used: <see 3>
```

The this-or-that pairs (step 3) and the direction pick (step 5) are decisions like any other.

## 2. Route to the owner

| Decision is about | Owner | Grounded in |
|---|---|---|
| Look: layout, density, type, colour, components, personality | Calíope | `caliope/taste/references.md`, `caliope/lessons.md`, the brand profile, standing rubric D |
| How Pedro uses it: what needs him, phone or desk, approvals, Slack links, wording he uses | Claudius | `USER.md`, `claudius/lessons.md`, Pedro's messages in this thread |
| Operations: health, routines, incidents, what counts as broken or late | Agrippa | `agrippa/AGENTS.md`, registry, health checks |
| Build: data source, feasibility, stack, performance, hosting | Vitruvius | the repo, `agency/infra/inventario-infra.md` |
| Numbers: KPI definitions, money, cost, targets | Ábaco | `abaco/AGENTS.md`, finance sources |
| Growth: conversion, offer, client-facing copy and funnels | Hormozius | `hormozius/AGENTS.md`, offer docs |

Each decision gets the owner plus at most one second opinion from the agent the choice touches next (look decisions on a tool Pedro uses daily: Calíope + Claudius). Run each agent as a fresh subagent (Sonnet) given its files and the decision card, never the builder's preference.

## 3. Settle disagreements

In this order: Pedro's own words (brief, earlier messages) > the owner agent > the second opinion. A merge ("A on desktop, B on phone") is allowed when both reasons survive. Write the rule used.

## 4. Pedro-only decisions

Never routed: anything published to clients or the public for the first time, a change to a production brand, new recurring cost, or overriding something Pedro said in his own words. These go to him as a this-or-that with pictures.

## 5. Pedro sees the log, not the questions

At review (step 11) Pedro gets the decision log next to the screenshots: question, final pick, who decided, one-line reason. He overrides by reacting or replying; an override becomes a D check in `standing-rubric.md` and a lesson for the agent that decided, so the same agent decides better next time.

## 6. Fix-loop decisions

A panel finding often forces a choice (drop a tile, translate content, rename a lane). Route it like any other decision when it touches what the owner cares about. When it is a plain fix, log it as "not routed, builder from panel evidence". Never present a fix-loop choice as an agent's decision when no agent was asked (Forum run, 2026-11-13: D8 and D9 were first logged as agent decisions and corrected).
