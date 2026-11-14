# Standing rubric

Copied into every project's `evals.md` (sections B, C, D). First version from the Forum rubric of 2026-11-13 (`2. Areas/consilium/forum/evals/ui-rubric.md`). Section D grows with Pedro's feedback (loop step 12); never remove a D check without his OK.

## B. Calíope principles
B1. Neutrals plus one accent. Status colours (green, amber, red) are used only for status. A second accent fails unless the brand profile names it.
B2. One display voice and one body voice; at most one mono for data.
B3. Sections are told apart by layout and type, not by new colours.
B4. One primary action per screen (at most one filled primary button visible).
B5. Every visual answers a question at a glance. A chart, bar, dot strip or number with no clear reading fails. Status tones match meaning (a low coverage bar is not green).
B6. Evidence beats decoration: no stock imagery, no emoji as decoration, no generic gradients or glow.
B7. Personality lives in one place, applied consistently.
B8. Consistency: repeated cards share padding, alignment, icon position and badge position; labels do not wrap in one card and not another.

## C. Craft floor
C1. Text contrast meets WCAG AA (4.5:1 body, 3:1 large text and UI parts).
C2. No text is cut mid-word or overflows. Truncation ends at a word with an ellipsis and the full text stays reachable.
C3. No horizontal scroll at 375 px, including inside tables and tab strips. Nothing overlaps.
C4. Hierarchy reads in order: page title, summary, sections. Exactly one H1 per page.
C5. Numbers use tabular figures and come with a label and a context line.
C6. Every list has an empty state written for a person.
C7. Interactive things look interactive (hover, visible focus ring, cursor) and work. Nothing looks clickable that is not; no fake inputs or `href="#"`.
C8. Copy uses the user's words, with no internal jargon, file names or raw IDs in primary text.
C9. Keyboard: every action reachable with Tab, in a sensible order, with a visible focus ring.
C10. Touch targets at least 44 × 44 px on phone.

## D. Pedro's learned checks
D1. (2026-11-13) Light by default for app UI; no dark hero blocks or panels. Source: Forum v1 feedback "too dark".
D2. (2026-11-13) Calm density: at most 4 KPI tiles and 4 main sections on an overview. Source: Forum v1 feedback "too dense, too much stuff going on".
D3. (2026-11-13) Built from shadcn/ui components, not bespoke widgets where a standard one exists. Source: Forum v1 feedback "use shadcn".
