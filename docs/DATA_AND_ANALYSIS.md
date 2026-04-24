# DSL KidsGPT Study — Data and Analysis

This document describes the study data structure, the pilot history, and the analysis
notebooks used to examine parent moderation behavior.

---

## Study Overview

Parents recruited via Prolific review AI-generated responses to child prompts. For each
scenario they:

1. **Highlight** text in the AI response they find concerning
2. **Rate** each highlight on a 1–7 concern scale
3. **Justify** each rating with a written rationale (multiple rationales per highlight are possible)

The final export (pilot 9, `20260412_183830`) covers **21 Prolific participants**, **86
completed sessions** (mean 4.1 scenarios/participant), **253 text selections**, and
**195 concern-item rationales** across **45 of 50 scenarios**.

---

## Pilot History

| Export directory | Label | Notes |
|---|---|---|
| `20260221_184350` | Early dev | Dev/test data only |
| `20260303_DEPLOY_DB` | Deploy DB | Infrastructure migration |
| `20260314_082139_DEV_TEST` | Dev test | Pre-pilot validation |
| `20260315_101829_PILOT_3` | Pilot 3 | First Prolific run |
| `20260325_135722_Pilot_5` | Pilot 5 | |
| `20260402_141950_PILOT6` | Pilot 6 | |
| `20260408_130919_PILOT7` | Pilot 7 | |
| `20260409_103819_PILOT8` | Pilot 8 | |
| `20260412_180829_PILOT9` | Pilot 9 (alt export) | Same wave as 183830 |
| `20260412_183830` | **Pilot 9 (primary)** | Full coding pipeline applied |

The `20260412_183830` export is the primary dataset for all analysis documented here.

---

## Data Model

### Tables / Export Files

Each export directory contains timestamped CSVs from the following tables:

| File | Grain | Key fields |
|---|---|---|
| `moderation_sessions_export` | 1 row per parent × scenario attempt | `user_id`, `scenario_id`, `attempt_number`, `is_final_version`, `concern_level`, `realism_level`, `initial_decision` |
| `selections_export` | 1 row per text highlight | `id` (highlight UUID), `user_id`, `scenario_id`, `selected_text`, `start_offset`, `end_offset`, `prolific_pid` |
| `concern_items_export` | 1 row per rationale block | `id`, `user_id`, `scenario_id`, `text` (rationale), `linked_highlights` (JSON array), `highlight_levels` (JSON dict text→rating) |
| `scenarios_export` | 1 row per scenario | `scenario_id`, `domain`, `age_band`, `trait`, `n_assigned`, `n_completed` |
| `assignment_time_export` | 1 row per assignment | Timing metadata |
| `exit_quiz_responses_export` | 1 row per participant | Post-study questionnaire answers |
| `child_profiles_export` | 1 row per child profile | Child age, gender, traits used during session |
| `users_export` | 1 row per user account | `id`, `prolific_pid`, `role` |

### Key Relationships

```
moderation_sessions (user_id, scenario_id)
    │
    ├── selections         one session → many highlights
    │       └── concern_items.linked_highlights   highlight text ↔ rationale (substring match)
    │
    └── concern_items      one session → many rationale blocks
            └── highlight_levels  {highlight_text: concern_rating}  ← authoritative per-highlight rating
```

**Important join note:** `concern_items.linked_highlights` stores highlight texts as a
JSON array; `concern_items.highlight_levels` stores `{highlight_text: rating}`. Neither
stores foreign keys to `selections`. Joins are made by substring-matching stored text
against `selections.selected_text`, scoped to `(user_id, scenario_id)`.

### Sentiment / Rating Fields

| Field | Source | Grain | Use |
|---|---|---|---|
| `concern_level` | `moderation_sessions` | Session | Overall session concern (1–7) |
| `realism_level` | `moderation_sessions` | Session | Scenario realism (1–7) |
| `highlight_sentiment` | `concern_items.highlight_levels[text]` | Selection | Per-highlight concern rating (1–7) — **authoritative** |

`highlight_sentiment` is the primary per-selection outcome. It is extracted from the
`highlight_levels` JSON dict during analysis, not stored as a dedicated column.

### Scenario Metadata

The `scenarios_export` is enriched with parsed `safety_notes` fields at analysis time:

| Derived field | Description |
|---|---|
| `sensitivity_level` | `available` / `sensitive` / `intimate` |
| `relationship_frame` | Framing of child's relationship to the topic |
| `space_type` | Physical/social context |
| `breakdown_expected` | Whether a structured breakdown was expected |

Scenario pool: **50 scenarios** across 3 domains and 4 age bands.

| Domain | N |
|---|---|
| Casual Knowledge Domain | 35 |
| Relationship Domain | 9 |
| Academic Domain | 6 |

| Age band | N |
|---|---|
| 9–12 | 14 |
| 13–15 | 13 |
| 16–18 | 12 |
| 6–8 | 11 |

---

## Qualitative Coding

### Code Scheme

Two codes are applied per (highlight × rationale) pair. The full scheme is in
`data-exports/20260412_183830/moderation_codes.tsv`.

**Model Strategy** — what the AI response did that the parent flagged:

| Code | Description |
|---|---|
| Prompted Suggestions | Suggestions made in direct response to the child's prompt |
| Unprompted Suggestions | Extra suggestions not requested by the child |
| Emphasize Emotional Support | Empathetic/supportive framing |
| Emphasize Risk Awareness | Highlighting dangers or warnings |
| Clarify Child's Intent | Asking for clarification before responding |
| Adapt to Age Group | Adjusting language or content for child's age |
| Redirect with Alternatives | Suggesting safer alternatives |
| Explain Problems in Prompt | Pointing out issues in what the child asked |
| Defer to Resources | Suggesting external help |
| Encourage Introspection | Prompting self-reflection |
| Refuse Response and Explain | Declining to answer with justification |

**Parent Motivation** — why the parent flagged the highlight:

| Code | Description |
|---|---|
| Response Usefulness | Whether the response is useful/appropriate |
| Response Risk Awareness | How the response handles risk |
| Child Intentions | Concern about the child's underlying intent |
| Response Organization | Clarity or structure of the response |
| Response Could Evoke Strong Emotion | Emotional impact on the child |
| Response Identification of the Root Cause | Whether the response addresses the real issue |
| Response Complexity | Complexity relative to the child's level |
| Parents Trust of Model Capabilities | Parent's trust in the AI |
| Response Contradicts Itself | Internal inconsistency |

### Coding Pipeline

See `data-exports/20260412_183830/README.md` for the full step-by-step pipeline.
High-level flow:

```
selections_export + concern_items_export
    │
    ▼ export_highlights_tsv.py
highlights_for_coding_export.tsv   (267 rows: highlight × rationale pairs)
    │
    ▼  human coding in Google Sheets
highlights_coded.tsv               (Model Strategy + Parent Motivation columns)
    │
    ▼ import_coded_tsv.py
model_strategy_for_notebook.csv    (253 rows)
parent_motivation_for_notebook.csv (272 rows)
    │
    ▼ highlight_analysis.ipynb
df_sel                             (200 rows — one per unique selection)
```

**Pilot 9 coding coverage (export 20260412_183830):**

| Measure | N |
|---|---|
| Unique text selections (df_sel rows) | 200 |
| Selections with model_strategy coded | 184 |
| Selections with parent_motivation coded | 200 |
| Selections with highlight_sentiment | 200 |
| Mean highlight sentiment | 5.33 / 7 |

---

## Analysis Notebooks

### `stat_analysis/highlight_analysis.ipynb` — Selection-level analysis

The primary analysis notebook. Builds `df_sel` (200 rows × 1 row per selection) and
runs five analysis parts.

**Cell structure:**

| Cell | Content |
|---|---|
| 0–3 | Imports, config (`DATA_DIR`, `EXPORT_TIMESTAMP`, approved participants, ALPHA, MIN_CODE_PREVALENCE), helpers |
| 4 | Load all exports + coded CSVs |
| 5–6 | Parse scenario metadata; build parent covariates from exit quiz |
| 7 | Approved-participant filter (moderation, selections — concern_items kept unfiltered for join) |
| 8 | Build `df_session` (session-level, 79 rows) |
| 9 | **Build `df_sel`** (200 rows) — core data build cell |
| 10 | Markdown header |
| 11 | Descriptive summary (session + selection level, histograms, frequency tables) |
| 12–14 | Part 1: Model strategy by context; model strategy × sentiment |
| 15–17 | Part 2: Parent motivation by context; motivation × sentiment |
| 18–20 | Part 3: Strategy × motivation co-occurrence crosstab; logistic |
| 21–23 | Part 4: Context effects on concern intensity (session + selection level) |
| 24–25 | Part 5: Realism invariance + TOST |
| 26–27 | Export results to `highlight_analysis_output/` |

**`df_sel` build logic (Cell 9):**

1. Filter `selections_export` to approved-participant sessions via `df_session` keys
2. Explode `concern_items_all_df.linked_highlights` (unfiltered — all 195 concern items)
   and substring-match against `selections.selected_text` scoped to `(user_id, scenario_id)`
3. Extract `highlight_sentiment` from `concern_items.highlight_levels[hl_text]`
4. Deduplicate on `(selection_id, rationale_text)` → 267 intermediate rows
5. Attach `parent_motivation` codes via compound key `(concern_item_id, selection_id)`,
   collapse to pipe-joined string per selection
6. Collapse to one row per selection (`drop_duplicates('selection_id')`)
7. Attach `model_strategy` via `selection_id` only (single code per selection)
8. Merge scenario metadata and parent covariates

**Output files** (`highlight_analysis_output/`):

| File | Description |
|---|---|
| `df_sel.csv` | 200-row analysis dataframe |
| `model_strategy_freq.csv` | Strategy frequency table |
| `parent_motivation_freq.csv` | Motivation frequency table |
| `strategy_x_motivation_crosstab.csv` | Co-occurrence counts |
| `strategy_x_motivation_crosstab_pct.csv` | Co-occurrence row percentages |
| `highlight_analysis_summary.txt` | Key counts summary |
| `*.png` | Descriptive and analysis charts |

### `stat_analysis/contextual_analysis.ipynb` — Session-level analysis

Earlier analysis notebook operating at the session level (`df_session`). Also builds
`df_highlight` (selection × rationale intermediate) for concern-item level analyses.
Updated to use the same selection-first join logic and coded CSV inputs as
`highlight_analysis.ipynb`.

---

## Approved Participants Filter

Both notebooks filter to a set of approved Prolific participants defined by a TSV block
in the config cell (`APPROVED_PARTICIPANTS_TSV`). The filter is a triple-key match:
`prolific_pid` + `study_id` + `session_id` (with legacy `session_id=1` fallback for
early pilots).

The filter is applied to `moderation_df`, `selections_df`, and `exit_quiz_df`.
`concern_items_df` is **not filtered** — the full set of 195 concern items is kept for
the highlight-levels lookup in `df_sel` Cell 9.

---

## Reproducing the Analysis

```bash
# 1. Export the raw data (or use the existing CSVs)
# Raw exports are in data-exports/20260412_183830/*_export_*.csv

# 2. (If re-coding) export highlights for coding
cd data-exports/20260412_183830
python export_highlights_tsv.py          # → highlights_for_coding_export.tsv

# 3. After editing highlights_coded.tsv, re-import
python import_coded_tsv.py               # → model_strategy_for_notebook.csv
                                         #    parent_motivation_for_notebook.csv

# 4. Run the analysis notebook
cd ../../
jupyter notebook stat_analysis/highlight_analysis.ipynb
```

Python environment: `miniforge/base/envs/open-webui`
