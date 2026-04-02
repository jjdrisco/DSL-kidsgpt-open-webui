---
name: exit-survey
description: Exit survey feature — form persistence, draft autosave, reset flow, and exit-quiz backend endpoints.
tools: Read, Grep, Glob
model: sonnet
---

## Key Files

- `src/routes/(app)/exit-survey/+page.svelte` — Main survey UI (~1790 lines); handles form state, read-only view, autosave, draft hydration, submit, and reset. Includes an attention check question (Q6).
- `src/lib/apis/exit-quiz/index.ts` — API client; `createExitQuiz`, `listExitQuiz` (with `allAttempts` flag), `resetExitQuiz`.
- `src/lib/apis/workflow/index.ts` — `getWorkflowDraft`, `saveWorkflowDraft`, `deleteWorkflowDraft` used to persist in-progress responses.
- `backend/open_webui/routers/exit_quiz.py` — REST endpoints: `POST /exit-quiz`, `GET /exit-quiz` (`all_attempts` param), `POST /exit-quiz/reset`, `PUT/DELETE /exit-quiz/{id}`.
- `backend/open_webui/models/exit_quiz.py` — `ExitQuizResponse` ORM (table: `exit_quiz_response`); `ExitQuizTable` class with `insert_new_response`, `get_responses_by_user`, `delete_responses_by_user_child`.
- `backend/open_webui/routers/workflow.py` — `exit_survey_completed` flag in `/workflow/state`; reads any row for the user across all attempts (no attempt filter).

## How It Works

1. On mount and after navigation, `loadSavedResponses()` calls `listExitQuiz(token, childId, allAttempts=true)`. If a submitted response exists, it populates the form and sets `isSaved = true` (read-only view). Otherwise, it falls back to the workflow draft via `getWorkflowDraft(token, childId, 'exit_survey')`.
2. While editing, reactive block `$: if (isLoaded) { surveyResponses; saveDraft(); }` triggers a debounced (400ms) `POST /workflow/draft` on every change. The `isLoaded` flag prevents autosave from firing before hydration completes (race-condition guard).
3. `submitSurvey()` validates all 20 required fields (including `attentionCheck`), resolves child ID, calls `POST /exit-quiz` with `{ child_id, answers, meta }`, then clears the draft and sets `isSaved = true`. Fires a `workflow-updated` DOM event so the sidebar reflects completion.
4. When `isSaved` is true, the read-only view renders all answers plus an **Edit** button (calls `startEditing()` to set `isSaved = false`) and a **Reset survey** link (opens `showResetSurveyModal` confirmation modal).
5. Confirming the reset modal calls `resetExitSurvey()`: POSTs to `/exit-quiz/reset` with `{ child_id }` (backend deletes all rows for that user+child via `delete_responses_by_user_child`), deletes the draft, resets `surveyResponses` to `EMPTY_SURVEY_RESPONSES`, and sets `isSaved = false`. Toast confirms success.
6. Survey fields (20 total): `parentGender`, `parentAge`, `areaOfResidency`, `parentEducation`, `parentEthnicity`, `genaiFamiliarity`, `genaiUsageFrequency`, `parentInternetUseFrequency`, `parentingStyle` (array), `attentionCheck`, `isOnlyChild`, `childHasAIUse`, `childAIUseContexts`, `parentLLMMonitoringLevel`, `childInternetUseFrequency`, `childPersonalitySubCharacteristics` (Big Five), `childAdditionalInfo`, plus dynamic fields `childGenderOther`, `childAIUseContextsOther`, `parentLLMMonitoringOther`.

## Attention Check (Q6)

Question 6 is a classic instructed-response attention check using a 5-point Likert scale (Strongly agree → Strongly disagree). The question text instructs participants to select "Strongly disagree." The correct answer value is `strongly_disagree`. The field is stored as `attentionCheck` in the `answers` JSON. Validation only checks the field is answered — it does **not** enforce correctness. Researchers evaluate pass/fail during data analysis by filtering rows where `answers.attentionCheck !== 'strongly_disagree'`.

## Important Rules

- Backend route order matters: `POST /exit-quiz/reset` **must be registered before** `GET/PUT/DELETE /exit-quiz/{id}` in the router file; otherwise FastAPI matches `reset` as an `{id}` path variable and returns 405 Method Not Allowed.
- `get_responses_by_user(attempt_number)` accepts `None` to return all attempts — pass `None` (not a number) when `all_attempts=True` in the router; otherwise it filters to a specific attempt.
- Child profile changes clear state intentionally (`loadSavedResponses` re-runs via `afterNavigate`); do not restore state from a mismatched `child_id`.
- `workflow.py` checks `exit_survey_completed` by looking for **any** row for the user (no `attempt_number` filter); deleting all rows via reset correctly resets completion status to false.
- Draft autosave bug prevention: `$: saveDraft()` with zero dependencies only fires once; always include `surveyResponses` as a dependency and guard with `isLoaded` to prevent race conditions.
