# Concern Mapping Feature

## Overview

The **Concern Mapping** feature enhances the granularity of parental feedback in the
moderation-scenario survey workflow. Instead of capturing a single free-text explanation for why a
parent finds an AI response concerning, parents can now:

1. **Work from the text** — for each highlighted passage, describe what specifically concerns them
   about it.
2. **Build a shared concern pool** — newly described concerns join a session-wide pool so the same
   concern can be quickly reused for subsequent highlights.
3. **Rate each concern** — assign a 1–5 Likert severity rating to every concern added.

This produces richer, structured data that analysts can use to understand _which_ highlighted
passages drove _which_ parental concerns, with the direction of the relationship anchored in the
text itself rather than imposed top-down.

---

## User-Facing Workflow

### Step 1 — Highlight (unchanged)

Parents drag over text in the prompt/response to mark passages that concern them. Each highlight is
saved immediately to the `selection` table (per-row) and accumulated in `highlightedTexts1`.

### Step 2 — Add Concerns for Each Highlight (updated)

Step 2 is now a single, highlight-centric step. For every highlighted passage parents must:

1. **Select existing concerns** (if any) — checkboxes show all concerns already added for previous
   highlights. Selecting one links it to the current highlight too. **A red × icon lets the parent
   remove any concern from the pool; the deletion is propagated to every highlight and synced to
   the backend instantly.**
2. **Add a new concern** — type a description in the inline text field and click **+ Add**. The
   concern is created in the shared pool _and_ immediately linked to this highlight.
3. **Rate each linked concern** — a per-concern Likert scale (1 = Not at all → 5 = Very) appears
   for every concern linked to the current highlight.

A progress bar at the top of Step 2 shows how many highlights have been addressed so far.

#### Validation rules

| Condition                                              | Blocked? |
| ------------------------------------------------------ | -------- |
| Any highlight has no concern linked to it              | ✅ Yes   |
| Any concern with text has no Likert rating             | ✅ Yes   |
| Any concern in the pool is not linked to any highlight | ✅ Yes   |

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
	concernLevel: number | null; // Per-concern Likert rating (1–5); null until rated
}
```

> **Schema change (v3):** The `linkedHighlights` array has been removed from `ConcernItem`.
> Concern items are now standalone objects in a shared pool; the mapping between highlights and
> concerns is stored separately in `highlightConcerns` (frontend) and
> `session_metadata.highlight_concerns` (backend).

### `highlightConcerns` (frontend state)

```typescript
// Maps each highlight's text to the IDs of concerns linked to it
highlightConcerns: Record<string, string[]>;
// Example: { "you can look this up": ["a1b2-...", "e5f6-..."], "without asking": ["a1b2-..."] }
```

### Backend persistence

Two structures are written to `session_metadata` on the `moderation_session` table when Step 2 is
submitted:

```json
{
	"highlight_concerns": {
		"you can look this up yourself": ["a1b2c3d4-..."],
		"without asking your parents": ["a1b2c3d4-...", "e5f6g7h8-..."]
	}
}
```

Concern items themselves (text + per-concern Likert) are persisted to the dedicated `concern_item`
table via `POST /api/v1/moderation/concern-items/batch`. The `linked_highlights` column on
`concern_item` is derived from `highlight_concerns` at save time (for backward compatibility with
existing analytics queries on that column).

### Backward-compatible `concern_reason`

The existing `concern_reason` text column on `moderation_session` is still populated for all
sessions using a derived string built from the concern pool and `highlightConcerns`:

```
<concern text> (relates to: "<highlight 1>", "<highlight 2>"); <concern 2 text> ...
```

This ensures that existing analytics queries on `concern_reason` continue to work without
modification.

---

## Frontend Implementation

### File

`src/routes/(app)/moderation-scenario/+page.svelte`

### State variables

| Variable            | Type                       | Purpose                                                                 |
| ------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `concernMappings`   | `ConcernItem[]`            | Shared pool of parent-specified concerns (no longer carries linked IDs) |
| `highlightConcerns` | `Record<string, string[]>` | Maps each highlight text to the array of concern IDs linked to it       |
| `newConcernInputs`  | `Record<string, string>`   | Tracks the "new concern" text field value for each highlight row        |

### Helper functions

| Function                    | Signature                                                              | Purpose                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `addConcernForHighlight`    | `(highlightText: string) => void`                                      | Creates a new concern from `newConcernInputs[highlightText]`, adds it to the pool, and links it to the highlight |
| `addConcernItem`            | `() => void`                                                           | Appends a blank `ConcernItem` to the pool (used internally)                                                      |
| `removeConcernItem`         | `(id: string) => void`                                                 | Removes a concern from the pool and all highlight links                                                          |
| `handleRemoveConcern`        | `(id: string) => Promise<void>`                                        | Wrapper that also syncs the updated pool to the backend (called by the UI delete button) |
| `toggleConcernLink`         | `(highlightText: string, concernId: string, checked: boolean) => void` | Adds or removes a concern ID from `highlightConcerns[highlightText]`                                             |
| `deriveConcernReason`       | `(mappings: ConcernItem[]) => string`                                  | Produces the backward-compatible `concern_reason` string                                                         |
| `getUnmatchedHighlights`    | `() => HighlightInfo[]`                                                | Returns highlights not yet linked to any concern                                                                 |
| `allHighlightsMatched`      | `() => boolean`                                                        | Returns true when every highlight has ≥ 1 concern linked                                                         |
| `allConcernsHaveHighlights` | `() => boolean`                                                        | Returns true when every non-empty concern is referenced by ≥ 1 highlight                                         |

### State persistence

- **localStorage** — `highlightConcerns` and `concernMappings` are both saved via
  `saveCurrentScenarioState()` → `scenarioStates` Map. Restored in
  `restoreFromLocalStorageIfMissing()`.
- **Backend (concern_item table)** — concern items saved via `saveConcernItemsBatch()` with
  `linked_highlights` derived from `highlightConcerns`.
- **Backend (session_metadata)** — `highlight_concerns` dict saved inside `session_metadata` when
  `completeStep2()` posts to `/api/v1/moderation/sessions`.

**Restoration priority** (in `loadScenario`):

1. `session_metadata.highlight_concerns` (newest sessions)
2. Derived from `concern_item.linked_highlights` (older sessions)
3. Derived from legacy `session_metadata.concern_mappings[].linkedHighlights` (earliest sessions)

### Attention check compatibility

The attention check step-2 tracking scans all `concernMappings[].text` entries for the string
`"attention check"` (case-insensitive):

```javascript
state.attentionCheckStep2Passed = concernMappings.some((c) =>
	c.text.toLowerCase().includes('attention check')
);
```

The attention check instruction text directs the participant to:

> Step 2: For the highlighted text, type "attention check" in the concern text field and click
> "+ Add", then rate your concern level. Click "Submit".

---

## Backend

The backend `concern_item` table and `moderation_session.session_metadata` JSONField accept the new
data without schema migration. Key points:

- `ConcernItemRow.linked_highlights` remains in the table; it is now **derived** at save time from
  the `highlightConcerns` mapping rather than stored directly on the concern object.
- The canonical source of truth for highlight ↔ concern associations is
  `session_metadata.highlight_concerns`.

---

## Analytics / Export

### 1. Highlight-centric (recommended for new analyses)

```sql
SELECT
    ms.id,
    ms.user_id,
    ms.child_id,
    ms.scenario_id,
    hc.key   AS highlight_text,
    hc.value AS concern_ids
FROM moderation_session ms,
     jsonb_each(ms.session_metadata -> 'highlight_concerns') AS hc
WHERE ms.is_final_version = TRUE;
```

Cross-reference concern text via the `concern_item` table:

```sql
SELECT
    ci.session_id,
    ci.text AS concern_text,
    ci.concern_level,
    ci.linked_highlights
FROM concern_item ci
WHERE ci.user_id = '<user_id>'
  AND ci.scenario_index = <index>;
```

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

### `session_metadata.highlight_concerns`

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "highlight_concerns",
	"title": "HighlightConcerns",
	"description": "Maps each highlight text (from Step 1) to the IDs of concerns linked to it",
	"type": "object",
	"additionalProperties": {
		"type": "array",
		"items": {
			"type": "string",
			"format": "uuid",
			"description": "ID of a ConcernItem in the concern_item table"
		}
	}
}
```

### `concern_item` row (unchanged table, updated meaning)

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "concern_item_row",
	"title": "ConcernItemRow",
	"type": "object",
	"required": ["id", "session_id", "user_id", "child_id", "text"],
	"properties": {
		"id": { "type": "string", "format": "uuid" },
		"session_id": { "type": "string" },
		"user_id": { "type": "string" },
		"child_id": { "type": "string" },
		"scenario_index": { "type": "integer" },
		"text": { "type": "string", "minLength": 1 },
		"concern_level": { "type": ["integer", "null"], "minimum": 1, "maximum": 5 },
		"linked_highlights": {
			"type": ["array", "null"],
			"items": { "type": "string" },
			"description": "Derived at save time from highlight_concerns; kept for backward compat"
		}
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
v3 — Highlight-centric single-step concern workflow; `linkedHighlights` moved from `ConcernItem`
to `session_metadata.highlight_concerns`
