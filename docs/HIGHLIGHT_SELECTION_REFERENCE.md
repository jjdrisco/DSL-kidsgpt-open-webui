# Highlight/Selection Feature Reference

This document collects everything related to the user highlights (a.k.a. "selections") that
parents can make when moderating an AI response.  It is intended as a quick look‑up for
engineers chasing bugs or extending the feature.

---

## Database schema

### `selection` table – one row per highlight interaction

| column        | type           | notes |
|---------------|----------------|-------|
| `id`          | TEXT (uuid)    | primary key |
| `user_id`     | TEXT           | Prolific or anonymized user ID |
| `assignment_id` | TEXT         | FK to `scenario_assignments` |
| `scenario_id` | TEXT           | copied from assignment; backfilled by migration `zz_add_scenario_id_to_moderation` |
| `start_offset`| INTEGER NULL   | character index within response text |
| `end_offset`  | INTEGER NULL   | ditto |
| `selected_text`| TEXT          | literal snippet the user dragged |
| `created_at`  | BIGINT         | ms since epoch |

`start_offset`/`end_offset` were added when the new capture logic rolled out; older
rows simply have them NULL.  No schema migration was required, only an application-level
backfill was possible from session JSON if needed.

### `moderation_session` table

Session state is stored here; in particular the `highlighted_texts` JSON column now
contains a list of objects.  After normalization every element looks like either:

```json
{"text": "…", "start": N, "end": M}
```

(The code still accepts a plain string, or the older `{"text":"…"}` object.)
The notebook helper `render_highlighted_scenario()` handles all three formats.


## Backend code

* **Models**
  * `SelectionForm` / `SelectionTable` – accept `start_offset`/`end_offset` and
    populate the columns; infer `scenario_id` from assignment when missing.
  * `ModerationSessionForm` / `ModerationSessionTable.upsert()` – accepts
    `highlighted_texts: Optional[List[Union[str, dict]]]` and normalizes the list to the
    notebook‑friendly shape (text + start/end); backfills `scenario_id` the same way as selections.
  * `ModerationSessionModel` uses `Optional[List[dict]]` for the field.
* **Routers**
  * `POST /moderation/highlights` and `/moderation/sessions` process incoming payloads
    and delegate to the above models.  `highlights` now accepts optional
    `scenario_id` and offsets.  Session start/complete endpoints call
    `ModerationSessions.upsert()` to record timings.
* **Helpers**
  * `getCurrentScenarioId()` – ensures the payload always includes a scenario ID.
  * `session-saving` wrapper logs the payload to the console during development.


## Frontend

* **State**
  * `scenarioStates` map holds per‑scenario moderation drafts.
  * `HighlightInfo` interface now includes `startOffset?: number`, `endOffset?: number`,
    and `text`.
* **Logic**
  * `handleTextSelection()` computes absolute character offsets by walking the
    scenario container’s text nodes and adding `range.startOffset`/`endOffset`.
    These offsets are stored in local highlight state.
  * `saveSelection()` sends `{assignmentId, scenarioId, text, start_offset?, end_offset?}`
    to `POST /moderation/highlights`.
  * All calls to `saveModerationSession()` include whatever highlight objects are
    in state; the TS type now allows `string | Record<string, any>`.
  * Existing session‑restore code checks `h.start ?? h.start_offset ?? -1` so
    old and new payloads are understood.
* **Network**
  * Inspectable in the browser console; payloads now include offsets and show either a
    string or object depending on how the highlight was produced.


## Notebook / analysis

* `render_highlighted_scenario()` first tries to parse the JSON and expects
  a list‑of‑dicts.  It looks for numeric start/end pairs first (range highlights),
  then falls back to substring matches.
* Guard code prints counts of rows with non‑null offsets and with text‑only highlights.


## Export & backfill

Local script and Heroku export both select `ms.highlighted_texts` and
`sel.start_offset`, `sel.end_offset` so analysts can use whichever representation they
prefer.  Offsets could be backfilled from the JSON column if necessary, but we haven’t
needed to run that.


## Migration & troubleshooting

* No schema migration was required; the physical columns already existed.
* `scenario_id` was back‑filled earlier by migration `zz_add_scenario_id_to_moderation`.
* A one‑off ad‑hoc SQL to copy offsets from `moderation_session.highlighted_texts`
  into the new columns could be written if desired.

### Debugging tips

* If a highlight row lacks offsets, check whether the frontend capture code was
  executed (older interactions did not record them).
* If `highlighted_texts` in a session is a bare string, the session predates the
  offset rollout.
* A 500 on save used to be caused by Pydantic validation; that has since been fixed.
* The notebook can handle any of the three formats described above and even
  understands explicit ranges.


today's reference sheet belongs here; keep a copy when chasing the next bug.
