---
name: survey-scenario-review
description: Survey scenario review feature context — use when working on scenario assignment, the 2-step moderation flow (highlight + concern rating), attempt tracking, reset, or finalization.
tools: Read, Grep, Glob
model: sonnet
---

## Key Files

- `src/routes/(app)/moderation-scenario/+page.svelte` — Main UI (~8446 lines); orchestrates scenario loading, state, and step navigation.
- `src/lib/apis/moderation/index.ts` — Frontend API client; `assignScenario`, `startScenario`, `completeScenario`, `skipScenario`, `createHighlight`, `getAssignmentsForChild`, `createConcernItems`.
- `src/lib/components/moderation/AttentionCheckBar.svelte` — Code-entry bar for the code-based attention check; accepts `code` prop (never shown to user) and emits `submit` event.
- `backend/open_webui/routers/moderation_scenarios.py` — Scenario assignment/status endpoints; weighted sampling on assign, `issue_any` computed from highlight count on complete, concern-items batch save.
- `backend/open_webui/routers/workflow.py` — `/workflow/state`, `/workflow/reset`, `/workflow/moderation/finalize`; manages `current_attempt_number` and final-version marking.
- `backend/open_webui/models/scenarios.py` — `ScenarioAssignment` ORM (table: `scenario_assignments`); `get_assignments_by_child(child_profile_id, attempt_number)`.
- `backend/open_webui/models/moderation.py` — `ModerationSession` ORM; stores `concern_level`, `initial_decision`, `is_final_version`, `response_highlighted_html`, `prompt_highlighted_html`.
- `backend/open_webui/migrations/versions/aa11bb22cc44_add_highlighted_html_to_moderation_session.py` — Adds `response_highlighted_html` and `prompt_highlighted_html` columns; must run on deploy.

## How It Works

1. On mount, the component: (a) calls `fetchWorkflowStateForModeration()` → reads `/workflow/state` to restore the `moderationFinalized` flag only (not full scenario state); (b) fetches `currentAttemptNumber` via `getCurrentAttempt()`; (c) loads existing assignments via `getAssignmentsForChild()`; (d) calls `assignScenario()` for any remaining slots. No `workflow_draft` is read for scenario state — `loadScenario()` restores per-scenario state from `getModerationSessions()` (backend DB) with the in-memory `scenarioStates` Map as a session-only fallback.
2. `SCENARIOS_PER_SESSION` (default 6) controls how many scenarios are assigned; configurable in Admin → Scenarios → Study Configuration.
3. User reviews each scenario: **Step 1** — drag to highlight concerning text (saved via `createHighlight()`); **Step 2** — Concern Mapping: for each highlighted passage, the parent adds free-text concerns to a shared per-scenario pool, assigns each concern a 1–5 Likert severity rating, and links concerns to highlights. All concern data is validated before submission.
4. Completing Step 2 calls `createConcernItems()` (batch save to `concern_item` table), then `completeScenario()` (which counts highlights and sets `issue_any`). Skipping calls `skipScenario()`. Abandoning triggers automatic reassignment.
5. `saveCurrentScenarioState()` updates the in-memory `scenarioStates` Map only — no backend write, no localStorage write. The reactive auto-save block has been removed. State is only persisted to the backend at step-completion boundaries (Steps 1 and 2) and via `proceedToNextStep()` which writes a minimal `{ moderation_finalized: true }` draft.
6. After all scenarios, `finalizeModeration()` marks the latest `ModerationSession` per scenario as `is_final_version=True`.
7. "Reset survey" fires `onWorkflowResetHandler()` → `resetAllScenarioStates()` + `scenarioList = []` + `deleteWorkflowDraft()` frontend, then `/workflow/reset` backend increments `current_attempt_number` past the max across all tables including `scenario_assignments`.
8. Attention checks use a code-based mechanism: `attention_check_code` is stored on the `scenario_assignments` row at assignment time. `AttentionCheckBar.svelte` renders a text input; the parent compares the user's entry to the code and records pass/fail. No separate API call is needed.

## Important Rules

- The `reset_user_workflow` max computation **must** include `ScenarioAssignment.attempt_number`; omitting it causes resets to land on the same attempt and restore stale assignments.
- `resetAllScenarioStates()` clears all per-scenario flags but does **not** clear `scenarioList` — always do `scenarioList = []` separately after calling it.
- DB table is `scenario_assignments` (with trailing `s`); use this exact name in raw SQL queries.
- Step 2 concern data: `concern_level` on the session row is the **max** of all per-concern ratings (backward compat); `concern_reason` is a derived concatenated string; the canonical data is in the `concern_item` table joined via `(user_id, child_id, scenario_index, attempt_number, version_number, session_number)`.
- `workflow_draft` is now minimal: only `{ moderation_finalized: true }` is written by `proceedToNextStep()`. It is **not** used for full scenario state restoration. `loadScenario()` restores state from `getModerationSessions()` (backend DB) with in-memory `scenarioStates` Map as session-only fallback.
- Content-match normalization: `loadScenario()` strips `[Attention code: ...]` suffixes from `original_response` before comparing to the DB session (via `stripAttentionSuffix` helper). This ensures attention-check scenarios correctly restore `markedNotApplicable = true` even when the suffix was added after the session was saved.
