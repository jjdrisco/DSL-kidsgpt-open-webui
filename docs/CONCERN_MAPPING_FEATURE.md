# Concern Mapping Feature

## Overview

The **Concern Mapping** feature enhances the granularity of parental feedback in the
moderation-scenario survey workflow. Instead of capturing a single free-text explanation for why a
parent finds an AI response concerning, parents can now:

1. **Enumerate specific concerns** — add one or more named concern items, each describing a
   discrete issue with the scenario.
2. **Link each concern to highlights** — connect each concern to the specific text passages
   highlighted in Step 1, creating an explicit many-to-many mapping between concerns and evidence.

This produces richer, structured data that analysts can use to understand _which_ highlighted
passages drove _which_ parental concerns, rather than attempting to extract that relationship from
unstructured prose.

---

## User-Facing Workflow

### Step 1 — Highlight (unchanged)

Parents drag over text in the prompt/response to mark passages that concern them. Each highlight is
saved immediately to the `selection` table (per-row) and accumulated in `highlightedTexts1`.

### Step 2 — Rate, Create Concerns & Match Highlights (updated)

Parents now complete four sub-tasks across two sub-steps:

#### Step 2a — Rate & Create Concerns

1. **Rate overall concern level** — Likert scale (1 = Not concerned at all → 5 = Concerned).
2. **Enumerate specific concerns** — click **+ Add Concern** to add named concern items. Each item
   has a free-text field: _"Describe this concern…"_
3. Click **Continue to Matching** to proceed.

#### Step 2b — Match Highlights to Concerns

4. **Match every highlight to ≥ 1 concern** — A highlight-centric interface lists each highlight
   from Step 1 with checkboxes for every concern created in Step 2a. Parents must match _all_
   highlights before submitting. A progress bar shows matched vs. remaining highlights.

#### Validation rules

| Condition                                                    | Blocked?                                          |
| ------------------------------------------------------------ | ------------------------------------------------- |
| No concern level selected                                    | ✅ Yes (Step 2a)                                  |
| No concern items added                                       | ✅ Yes (Step 2a)                                  |
| All concern items have empty text                            | ✅ Yes (Step 2a)                                  |
| Any highlight not matched to ≥ 1 concern                     | ✅ Yes (Step 2b)                                  |
| Any non-empty concern not linked to ≥ 1 highlight            | ✅ Yes (Step 2b)                                  |
| No highlights exist (scenario fully free-text)               | ✅ Concerns without linked highlights are allowed |

### Submit

Pressing **Submit** completes Step 2, marks the scenario as final, and persists data to the
backend.

---

## Data Model

### `ConcernItem` (frontend type)

```typescript
interface ConcernItem {
	id: string; // UUID generated client-side
	text: string; // Parent's free-text description of this concern
	linkedHighlights: string[]; // Highlight text strings that this concern relates to
}
```

### Backend persistence

Concern mappings are stored in the existing `session_metadata` JSON column on the
`moderation_session` table — no schema migration is required.

```json
{
	"concern_mappings": [
		{
			"id": "a1b2c3d4-...",
			"text": "The AI suggested the child could find this information online without parental guidance",
			"linkedHighlights": ["you can look this up yourself", "without asking your parents"]
		},
		{
			"id": "e5f6g7h8-...",
			"text": "Response tone was too adult for the child's age",
			"linkedHighlights": ["as an adult you understand"]
		}
	]
}
```

### Backward-compatible `concern_reason`

The existing `concern_reason` text column on `moderation_session` is still populated for all
sessions using a derived string built from `concernMappings`:

```
<concern text> (relates to: "<highlight 1>", "<highlight 2>"); <concern 2 text> ...
```

This ensures that existing analytics queries on `concern_reason` continue to work without
modification.

---

## Frontend Implementation

### File

`src/routes/(app)/moderation-scenario/+page.svelte`

### New state variables

| Variable          | Type                    | Purpose                                           |
| ----------------- | ----------------------- | ------------------------------------------------- |
| `concernMappings` | `ConcernItem[]`         | Ordered list of parent-specified concerns         |
| `step2SubStep`    | `'rate' \| 'match'`     | Current sub-step within Step 2 (create vs. match) |

### New helper functions

| Function                 | Signature                                                              | Purpose                                                        |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `addConcernItem`         | `() => void`                                                           | Appends a blank `ConcernItem` to `concernMappings`             |
| `removeConcernItem`      | `(id: string) => void`                                                 | Removes a concern item by UUID                                 |
| `toggleHighlightLink`    | `(concernId: string, highlightText: string, checked: boolean) => void` | Adds or removes a highlight link for a concern item            |
| `deriveConcernReason`    | `(mappings: ConcernItem[]) => string`                                  | Produces the backward-compatible `concern_reason` string       |
| `getUnmatchedHighlights` | `() => HighlightInfo[]`                                                | Returns highlights not yet linked to any concern               |
| `allHighlightsMatched`   | `() => boolean`                                                        | Returns true when every highlight is linked to ≥ 1 concern     |
| `allConcernsHaveHighlights` | `() => boolean`                                                     | Returns true when every non-empty concern has ≥ 1 linked highlight |

### State persistence

Concern mappings are persisted through the following paths:

- **localStorage** — via `saveCurrentScenarioState()` → `scenarioStates` Map (keyed by
  assignment/scenario identifier). Restored in `restoreFromLocalStorageIfMissing()`.
- **Backend** — saved in `session_metadata.concern_mappings` when `completeStep2()` posts to
  `/api/v1/moderation/sessions`. Restored during `loadScenario()` from
  `backendSession.session_metadata.concern_mappings`.

### Attention check compatibility

The attention check step-2 tracking (previously looked for `"attention check"` in
`concernReason`) now scans all `concernMappings[].text` entries for the string:

```javascript
state.attentionCheckStep2Passed = concernMappings.some((c) =>
	c.text.toLowerCase().includes('attention check')
);
```

---

## Backend

No backend changes were required. The `concern_mappings` payload fits within the existing
`session_metadata: Optional[dict]` field on `ModerationSessionPayload` and is stored as-is in the
`session_metadata` JSON column.

The attention check instruction text was updated to reflect the new two-sub-step UI flow:

> Step 3: Click "+ Add Concern", type "attention check" in the concern text field, then click
> "Continue to Matching".
> Step 4: Match the highlight to the "attention check" concern, then click "Submit".

---

## Analytics / Export

Analysts can access structured concern data in two ways:

### 1. Structured (recommended for new analyses)

Query `moderation_session.session_metadata` and parse `concern_mappings`:

```sql
SELECT
    ms.id,
    ms.user_id,
    ms.child_id,
    ms.scenario_id,
    cm.value ->> 'text' AS concern_text,
    cm.value ->> 'linkedHighlights' AS linked_highlights
FROM moderation_session ms,
     jsonb_array_elements(ms.session_metadata -> 'concern_mappings') AS cm
WHERE ms.is_final_version = TRUE;
```

_(Adjust JSON operators for your database driver; SQLite uses `json_each` instead of
`jsonb_array_elements`.)_

### 2. Legacy flat string (backward compatible)

```sql
SELECT id, concern_level, concern_reason
FROM moderation_session
WHERE is_final_version = TRUE;
```

`concern_reason` contains all concerns serialized as:
`"<concern 1> (relates to: "<h1>", "<h2>"); <concern 2>"`.

---

## Machine-Readable Schema

The following JSON Schema describes the structure of `session_metadata.concern_mappings`:

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "concern_mappings",
	"title": "ConcernMappings",
	"description": "Array of parental concern items produced in Step 2 of the moderation scenario workflow",
	"type": "array",
	"items": {
		"type": "object",
		"required": ["id", "text", "linkedHighlights"],
		"properties": {
			"id": {
				"type": "string",
				"format": "uuid",
				"description": "Client-generated UUID for the concern item"
			},
			"text": {
				"type": "string",
				"minLength": 1,
				"description": "Parent's free-text description of this specific concern"
			},
			"linkedHighlights": {
				"type": "array",
				"items": { "type": "string" },
				"description": "Highlight text strings from Step 1 that this concern relates to"
			}
		},
		"additionalProperties": false
	}
}
```

---

## Related Files

| Path                                                 | Description                           |
| ---------------------------------------------------- | ------------------------------------- |
| `src/routes/(app)/moderation-scenario/+page.svelte`  | Main workflow UI and logic            |
| `backend/open_webui/models/moderation.py`            | `ModerationSession` SQLAlchemy model  |
| `backend/open_webui/routers/moderation_scenarios.py` | REST API endpoints                    |
| `docs/MODERATION_SURVEY_FLOW.md`                     | High-level survey flow documentation  |
| `docs/HIGHLIGHT_SELECTION_REFERENCE.md`              | Highlight/selection feature reference |
| `docs/SURVEY_IMPLEMENTATION.md`                      | Survey implementation guide           |

---

## Last Updated

2026-02-24  
v2 — Two-sub-step matching workflow (Step 2a: Rate & Create, Step 2b: Match Highlights)
