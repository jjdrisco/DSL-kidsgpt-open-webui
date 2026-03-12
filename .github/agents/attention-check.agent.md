---
name: AttentionCheck
description: Covert attention check system — one randomly-selected AI response silently appends a code; a neutral identical bar on every Step 1 accepts entry; pass/fail recorded without UI feedback or workflow impact.
---

## Key Files

- `src/lib/components/moderation/AttentionCheckBar.svelte` — Neutral gray bar shown on every Step 1; `code` prop used only for internal validation, never displayed; `passed` prop controls disabled state after submission.
- `src/routes/(app)/moderation-scenario/+page.svelte` — Hosts the bar above the child prompt bubble; `on:submit` handler updates `scenarioStates` Map and calls `saveCurrentScenarioState()`; PATCH call lives inside `loadRandomScenarios()`.
- `backend/open_webui/routers/moderation_scenarios.py` — `PATCH /moderation/scenarios/assignments/{assignment_id}/attention-code`; generates a 5-char alphanumeric code, persists to DB, returns it; uses `ScenarioAssignment` ORM directly (not the Pydantic helper).
- `backend/open_webui/models/scenarios.py` — `ScenarioAssignment` ORM has `attention_check_code = Column(String, nullable=True)`; `ScenarioAssignmentModel` Pydantic has `attention_check_code: Optional[str] = None`.

## How It Works

1. `loadRandomScenarios()` in `+page.svelte` calls `assignScenario()` for each of the 4 slots; after the loop, one winner is chosen at random and a `PATCH …/attention-code` request fires.
2. The PATCH endpoint generates a code via `_generate_attention_code()` (5 uppercase chars + digits), saves it to `scenario_assignments.attention_check_code`, and returns `{ assignment_id, attention_check_code }`.
3. The winning assignment's response text is amended with `\n\n[Attention code: XXXXX]` — both in the new-assignments path (post-PATCH) and the existing-assignments path (re-load from DB).
4. `scenarioStates` Map stores `attention_check_code` and `attentionCheckPassed` per scenario identifier; the bar receives these as props.
5. On submit, `AttentionCheckBar` immediately sets `localSubmitted = true`, clears input, dispatches the entered value; parent sets `state.attentionCheckPassed = (entry === state.attention_check_code)` and calls `saveCurrentScenarioState()`.
6. `passed` prop becomes non-null once recorded, locking the bar for that scenario; switching to a fresh scenario passes `passed = null`, resetting `localSubmitted` automatically.

## Important Rules

- **Never use `ScenarioAssignments.get_by_id()` in the PATCH endpoint** — it returns a Pydantic model, not an ORM object; `db.add(pydantic_model)` will throw a 500. Always query `db.query(ScenarioAssignment).filter(...).first()` inside `get_db()`.
- The bar is **identical on all scenarios** — do not add visual distinction, hints, or right/wrong feedback; covert design is intentional.
- The `scenarioAssignment.ts` service file has its own PATCH call but is **not used** by the active code path; all assignment work happens directly in `loadRandomScenarios()` in `+page.svelte`.
- `attention_check_code` column was added by migration `z33a44b55c66_add_attention_code_to_assignments.py`; `down_revision = 'z22a33b44c55'`.
- "I read the instructions" button must remain clickable regardless of attention check state — never gate `toggleModerationSelection` on `attentionCheckPassed`.
