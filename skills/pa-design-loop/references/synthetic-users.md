# Step 9: synthetic users

Three persona subagents, in parallel, model Sonnet. Each gets the preview URL or a local server for the build, its persona, and the brief's 3 jobs written as tasks. Nothing else: no screenshots, no evals, no design notes. They should meet the screen as a user would.

## Personas

Write three for the project in `brief.md`. Defaults for Pedro's internal tools:

1. **Pedro on his phone, 8 a.m., 2 minutes.** 375 × 812 viewport, impatient, scans, does not read paragraphs. Wants to know what needs him and leave.
2. **Pedro at his desk, deep dive.** 1280 × 900, wants to understand one agent's or one project's state fully and find a specific past item.
3. **A newcomer.** A teammate or a new agent seeing the product for the first time, no context, no internal vocabulary. 1280 × 900.

Client products swap in their real user types from PRODUCT.md.

## Protocol

For each task, the persona drives the build with Python Playwright (screenshots after each step into `rounds/<n>/synthetic/<persona>/`), thinking aloud:

```
Task: <task>
Steps: 1. saw ... clicked ... 2. ...
Hesitations: <where it was unsure and why, quoting the label it misread>
Result: success / partial / fail | steps: <n> | expected minimum: <n>
Would say: "<one sentence, in the persona's voice>"
```

A task fails if the persona gives up, picks the wrong item, or takes more than twice the minimum steps. Return all three tasks, then the single biggest confusion.

## Limits

Synthetic users catch findability, labelling, flow and phone-ergonomics problems well. They do not judge taste, trust or delight, and they read text more literally than people do. Report them as "synthetic tests", never as user research.
