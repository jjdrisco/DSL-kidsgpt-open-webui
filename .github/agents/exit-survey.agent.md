---
name: ExitSurvey
description: Exit survey feature context — use when working on survey form persistence, draft autosave, the reset flow, or the exit-quiz backend endpoints.
---

## Key Files

- `src/routes/(app)/exit-survey/+page.svelte` — Main survey UI; handles form state, read-only view, autosave, draft hydration, submit, and reset.
- `src/lib/apis/exit-quiz/index.ts` — API client; `createExitQuiz`, `listExitQuiz` (with `allAttempts` flag), `resetExitQuiz`.
- `src/lib/apis/workflow/index.ts` — `getWorkflowDraft`, `saveWorkflowDraft`, `deleteWorkflowDraft` used to persist in-progress responses.
- `backend/open_webui/routers/exit_quiz.py` — REST endpoints: `POST /exit-quiz`, `GET /exit-quiz` (`all_attempts` param), `POST /exit-quiz/reset`, `PUT/DELETE /exit-quiz/{id}`.
- `backend/open_webui/models/exit_quiz.py` — `ExitQuizResponse` ORM (table: `exit_quiz_response`); `ExitQuizTable` class with `insert_new_response`, `get_responses_by_user`, `delete_responses_by_user_child`.
- `backend/open_webui/routers/workflow.py` — `exit_survey_completed` flag in `/workflow/state`; reads any row for the user across all attempts (no attempt filter).

## How It Works

1. On mount and after navigation, `loadSavedResponses()` calls `listExitQuiz(token, childId, allAttempts=true)`. If a submitted response exists, it populates the form and sets `isSaved = true` (read-only view). Otherwise, it falls back to the workflow draft.
2. While editing, `$: if (isLoaded) { surveyResponses; saveDraft(); }` reactively triggers a debounced (400 ms) `POST /workflow/draft` on every change. The `isLoaded` flag prevents autosave from firing before hydration completes (race-condition guard).
3. `submitSurvey()` validates all 19 required fields, calls `POST /exit-quiz`, then clears the draft and sets `isSaved = true`. Fires a `workflow-updated` DOM event so the sidebar reflects completion.
4. When `isSaved` is true, the read-only view renders all answers plus an **Edit** button (calls `startEditing()`) and a **Reset survey** link (opens `showResetSurveyModal`).
5. Confirming the reset modal calls `resetExitSurvey()`: POSTs to `/exit-quiz/reset` (deletes all DB rows for that child), deletes the draft, resets `surveyResponses` to `EMPTY_SURVEY_RESPONSES`, and sets `isSaved = false`.

## Important Rules

- `POST /exit-quiz/reset` **must be registered before** `GET/PUT/DELETE /exit-quiz/{id}` in the router file; otherwise FastAPI matches `reset` as an `{id}` and returns 405.
- `get_responses_by_user` accepts `attempt_number=None` to return all attempts — pass `None` (not a number) when `all_attempts=True` in the router.
- Child profile changes clear state intentionally (`loadSavedResponses` re-runs via `afterNavigate`); do not restore state from a mismatched `child_id`.
- `workflow.py` checks `exit_survey_completed` by looking for **any** row for the user (no `attempt_number` filter); deleting all rows via reset correctly resets completion status.
