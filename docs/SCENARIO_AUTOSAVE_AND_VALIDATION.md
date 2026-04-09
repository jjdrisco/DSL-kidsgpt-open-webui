# Scenario Review: Autosave, Progress Indicators, and Validation

## Overview

The moderation scenario review page (`src/routes/(app)/moderation-scenario/+page.svelte`) has three systems that work together to prevent data loss and guide users through the 2-step flow:

1. **Autosave** — debounced draft persistence for Step 1 and Step 2 progress
2. **Progress indicators** — per-section and per-highlight completion badges
3. **Inline validation errors** — persistent error messages on failed submit

All three were added in April 2026 to address participant data loss caused by page refresh or navigation mid-scenario.

---

## 1. Autosave via Workflow Draft

### How It Works

The autosave uses the existing `workflow_draft` system (same backend table and API as exit-survey, but with `draft_type: 'moderation'`). A single draft blob per `(user_id, child_id, 'moderation')` stores data for all scenarios.

**Draft blob structure:**

```json
{
	"moderation_finalized": true,
	"scenario_drafts": {
		"<scenario_identifier>": {
			"highlightedTexts1": [{ "text": "...", "startOffset": 0, "endOffset": 10 }],
			"responseHighlightedHTML": "<html>...",
			"promptHighlightedHTML": "<html>...",
			"step1Completed": true,
			"highlightRatings": { "text": 5 },
			"concernMappings": [{ "id": "uuid", "text": "reason" }],
			"highlightConcerns": { "text": ["concern_id"] },
			"realismLevel": 4,
			"concernReason": "derived string"
		}
	}
}
```

### Save Trigger

A Svelte reactive block fires `saveModerationDraft()` (debounced at 500ms) whenever any of these reactive dependencies change and the scenario is not yet submitted (`!step2Completed`):

- `highlightedTexts1` (Step 1)
- `highlightRatings`, `concernMappings`, `highlightConcerns`, `realismLevel` (Step 2)

The guard `if (isLoadingScenario) return` prevents save loops during restoration.

### Save Flow (read-modify-write)

Each save:

1. Reads the existing draft via `getWorkflowDraft(token, childId, 'moderation')`
2. Merges the current scenario's data under `scenario_drafts[scenarioId]`
3. Writes the full blob back via `saveWorkflowDraft(...)`

This preserves the `moderation_finalized` flag and other scenarios' drafts.

### Restore Flow

In `loadScenario()`, after checking the backend `ModerationSession` and in-memory `scenarioStates` Map:

- If no `backendSession` exists and no data has been restored from the Map, the draft is checked
- Step 1 data (highlights, highlighted HTML, step1Completed) is restored first
- Step 2 data (ratings, concerns, links, realism) is restored if present

### Cleanup

- On successful Step 2 submit (`completeStep2`): the scenario's entry is deleted from `scenario_drafts`
- On finalization (`proceedToNextStep`): existing draft is read and `moderation_finalized: true` is merged in (not overwritten)

### Data Restoration Priority

1. **Backend `ModerationSession`** — primary source (only exists after Step 1 "Continue")
2. **In-memory `scenarioStates` Map** — session-only fallback (lost on page refresh)
3. **Workflow draft** — new fallback (survives page refresh, cleared on submit)

---

## 2. Progress Indicators

### Section 2a: Scenario Realism

A progress bar between the "2a. Scenario Realism" heading and the rating buttons:

- **Before rating:** "0 of 1 rated" / "Rating needed" (amber), empty bar
- **After rating:** "1 of 1 rated" / "Complete" (green), full bar

### Section 2b: Per-Highlight Progress

A progress bar above the highlight cards:

- Shows "X of N highlights complete (rated + linked to a reason)"
- Bar color: blue (in progress) or green (all complete)
- "All addressed!" or "N remaining" counter on the right

### Per-Highlight Status Badges

Each highlight card shows two inline badges between the number circle and the highlight text:

- **"Rated"** (green) or **"Needs rating"** (red) — whether `highlightRatings[text]` is set
- **"Linked"** (green) or **"Needs reason"** (red) — whether `highlightConcerns[text]` has entries

The card border also changes: green when fully addressed, amber when incomplete.

---

## 3. Inline Validation Errors

### State Variable

```typescript
let submitValidationErrors: Record<string, { missingRating: boolean; missingConcern: boolean }> =
	{};
```

### Validation Flow (`completeStep2`)

Instead of returning on the first toast error, the function:

1. Checks realism level first (toast + scroll to `#realism-rating` if missing)
2. Collects per-highlight errors into `submitValidationErrors`
3. Checks for missing concerns and unlinked concerns (toast)
4. If any errors: sets `submitValidationErrors`, scrolls to first incomplete highlight card (`#highlight-card-{index}`), returns

### Inline Error Display

Below each highlight's rating buttons, if `submitValidationErrors[highlight.text]` is set:

- "Please select a sentiment rating above" (red, with warning icon)
- "Please link at least one reason to this highlight below" (red, with warning icon)

### Error Clearing

Errors clear reactively:

- **Rating selected** (`on:click` on rating button): clears `missingRating` for that highlight
- **Concern linked** (`toggleConcernLink`): clears `missingConcern` for that highlight
- **Scenario navigation** (`loadScenario`): resets entire `submitValidationErrors` object
- **Re-submit** (`completeStep2`): clears all errors before re-validating

---

## Key Files

| File                                                | What                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/routes/(app)/moderation-scenario/+page.svelte` | All frontend logic: autosave, progress bars, validation                      |
| `src/lib/apis/workflow/index.ts`                    | `saveWorkflowDraft`, `getWorkflowDraft`, `deleteWorkflowDraft` API functions |
| `backend/open_webui/models/workflow_draft.py`       | `WorkflowDraft` ORM model (table: `workflow_drafts`)                         |
| `backend/open_webui/routers/workflow.py`            | Draft CRUD endpoints (`/workflow/draft`)                                     |

## API Endpoints Used

| Method   | Path                                               | Purpose             |
| -------- | -------------------------------------------------- | ------------------- |
| `GET`    | `/workflow/draft?child_id=X&draft_type=moderation` | Read existing draft |
| `POST`   | `/workflow/draft`                                  | Upsert draft blob   |
| `DELETE` | `/workflow/draft?child_id=X&draft_type=moderation` | Delete draft        |
