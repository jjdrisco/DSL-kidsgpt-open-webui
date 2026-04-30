# DSL KidsGPT — Data Model and Export Pipeline

## Study Overview

Parents recruited via Prolific review AI-generated responses to child prompts. For each
scenario they:

1. **Highlight** text in the AI response they find worth flagging
2. **Rate** each highlight on a 1–7 sentiment scale (1 = negative/inappropriate, 7 = positive/appropriate)
3. **Justify** each rating with a written rationale (multiple rationales per highlight are possible)

**Important:** `highlight_sentiment` is a sentiment scale, not a concern scale. Higher
values mean the parent judged the highlighted text as more positive and appropriate for the
child. This distinction is critical for all classifier and analysis framing.

The primary dataset (pilot 9, export `20260412_183830`) covers **21 Prolific participants**,
**86 completed sessions** (mean 4.1 scenarios/participant), **200 unique text selections**,
and **195 concern-item rationales** across **45 of 50 scenarios**.

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

All analysis documented here uses `20260412_183830`.

---

## Export Files

Each export directory contains timestamped CSVs:

| File | Grain | Key fields |
|---|---|---|
| `moderation_sessions_export` | 1 row per parent × scenario attempt | `user_id`, `scenario_id`, `attempt_number`, `is_final_version`, `concern_level`, `realism_level`, `initial_decision` |
| `selections_export` | 1 row per text highlight | `id` (highlight UUID), `user_id`, `scenario_id`, `selected_text`, `start_offset`, `end_offset`, `prolific_pid`, `source` |
| `concern_items_export` | 1 row per rationale block | `id`, `user_id`, `scenario_id`, `text` (rationale), `linked_highlights` (JSON array), `highlight_levels` (JSON dict text→rating) |
| `scenarios_export` | 1 row per scenario | `scenario_id`, `domain`, `age_band`, `trait`, `n_assigned`, `n_completed` |
| `assignment_time_export` | 1 row per assignment | Timing metadata |
| `exit_quiz_responses_export` | 1 row per participant | Post-study questionnaire answers |
| `child_profiles_export` | 1 row per child profile | Child age, gender, traits |
| `users_export` | 1 row per user account | `id`, `prolific_pid`, `role` |

---

## Key Relationships

```
moderation_sessions (user_id, scenario_id)
    │
    ├── selections         one session → many highlights
    │       └── concern_items.linked_highlights   highlight text ↔ rationale (substring match)
    │
    └── concern_items      one session → many rationale blocks
            └── highlight_levels  {highlight_text: sentiment_rating}  ← authoritative per-highlight rating
```

**Join note:** `concern_items.linked_highlights` stores highlight texts as a JSON array;
`concern_items.highlight_levels` stores `{highlight_text: rating}`. Neither stores foreign
keys to `selections`. Joins are made by substring-matching stored text against
`selections.selected_text`, scoped to `(user_id, scenario_id)`.

---

## Sentiment and Rating Fields

| Field | Source | Grain | Scale | Use |
|---|---|---|---|---|
| `concern_level` | `moderation_sessions` | Session | 1–7 | Overall session concern |
| `realism_level` | `moderation_sessions` | Session | 1–7 | Scenario realism |
| `highlight_sentiment` | `concern_items.highlight_levels[text]` | Selection | 1–7 | Per-highlight sentiment — **primary outcome** |

`highlight_sentiment` is authoritative for selection-level analysis. It is extracted from
the `highlight_levels` JSON dict during the `df_sel` build, not stored as a dedicated column.

---

## Scenario Pool

**50 scenarios** across 3 domains, 4 age bands, and 16 subdomains.

| Domain | N | Subdomains |
|---|---|---|
| Casual Knowledge Domain | 35 | Common Sense, Behavioral Norms, Health, Internet Interaction, STEM, Privacy, Finance, Politics, Protective Measures, Human Nature, Community Engagement |
| Relationship Domain | 9 | Friendship, Self, Family |
| Academic Domain | 6 | HW, STEM, Academic Standing |

| Age band | N |
|---|---|
| 9–12 | 14 |
| 13–15 | 13 |
| 16–18 | 12 |
| 6–8 | 11 |

Scenario metadata is enriched at analysis time with parsed `safety_notes` fields:

| Derived field | Values |
|---|---|
| `sensitivity_level` | `available` / `sensitive` / `intimate` |
| `relationship_frame` | Framing of child's relationship to the topic |
| `space_type` | Physical/social context |
| `breakdown_expected` | Whether a structured breakdown was expected |

---

## Approved Participants Filter

Both notebooks filter to approved Prolific participants defined by a TSV block
(`APPROVED_PARTICIPANTS_TSV`) in the config cell. The filter is a triple-key match:
`prolific_pid` + `study_id` + `session_id` (with legacy `session_id=1` fallback).

Applied to: `moderation_df`, `selections_df`, `exit_quiz_df`.
**Not applied to:** `concern_items_df` — the full 195 items are kept for `highlight_levels`
lookup in the `df_sel` build.

---

## df_sel Build

`df_sel` is the primary analysis dataframe. Two analysis rounds use different grains:

| Round | Notebook | Grain | Rows | Coding source |
|---|---|---|---|---|
| R4 | `0_R4_highlight_analysis.ipynb` | 1 row per unique selection | 200 | `model_strategy_for_notebook.csv` + `parent_motivation_for_notebook.csv` |
| R5 | `0_R5_highlight_analysis.ipynb` | 1 row per highlight × rationale pair | 267 | `R5_highlights_coded` |

**R4 build (Cell 9, 200 rows):**

1. Filter `selections_export` to approved-participant sessions via `df_session` keys
2. Explode `concern_items.linked_highlights` and substring-match against `selections.selected_text`
   scoped to `(user_id, scenario_id)` — uses the full unfiltered 195 concern items
3. Extract `highlight_sentiment` from `concern_items.highlight_levels[hl_text]`
4. Deduplicate on `(selection_id, rationale_text)` → 267 intermediate rows
5. Attach `parent_motivation` codes via `(concern_item_id, selection_id)`, collapse to
   pipe-joined string per selection
6. Collapse to one row per selection (`drop_duplicates('selection_id')`)
7. Attach `model_strategy` via `selection_id` only
8. Merge scenario metadata and parent covariates from exit quiz

**R5 build (Cell 9, 267 rows):**

Same as R4 through step 4, then:

5. Filter to the canonical 267 (highlight_id, concern_item_id) pairs from
   `highlights_for_coding_export.tsv` (removes 5 spurious duplicates where two concern
   items have identical rationale text but different IDs)
6. Attach `parent_motivation` via `(selection_id, concern_item_id)` — no collapsing;
   each rationale is a separate analysis unit
7. Attach `model_strategy` via `selection_id` (same code for all rationales of a highlight)
8. Merge scenario metadata and parent covariates

**`source` field:** Each selection carries a `source` value (`'response'` | `'prompt'`)
indicating whether the parent highlighted text from the AI response or from the child's
question. 19 of 267 rows have `source='prompt'`. Prompt-source highlights cannot be
assigned a Model Strategy code (strategy only applies to AI response text), and correspond
to a subset of the null model_strategy entries in `df_sel`.

**model_strategy NaN:** 16 rows in `df_sel` have null model_strategy. These include
prompt-source highlights and highlights of non-response structural elements (headers,
formatting). They are genuine missing values, not an "unknown" category. An indicator
`strategy_is_null` is added in classifier feature engineering.

---

## Qualitative Coding

Two codes per (highlight × rationale) pair. Code names were standardized from earlier pilot
labels via `LABEL_MAP` in `0_llm_coder.ipynb`; the canonical names below are used throughout.

**Model Strategy** — what the AI response did that the parent flagged:

| Code | N | % |
|---|---|---|
| Prompted Suggestions | 89 | 44.5% |
| Emphasize Emotional Support | 32 | 16.0% |
| Emphasize Risk Awareness | 15 | 7.5% |
| Unprompted Suggestions | 14 | 7.0% |
| Clarify Child's Intent | 11 | 5.5% |
| Consider Age Group | 7 | 3.5% |
| Redirect with Alternatives | 6 | 3.0% |
| Explain Problems in Prompt | 6 | 3.0% |
| Defer to Resources | 2 | 1.0% |
| Encourage Introspection | 1 | 0.5% |
| Refuse Response and Explain | 1 | 0.5% |

**Parent Motivation** — why the parent flagged the highlight:

Response-level codes (assigned when `source='response'`):

| Code | N | % of selections |
|---|---|---|
| Response Usefulness | 91 | 45.5% |
| Response Risk Awareness | 38 | 19.0% |
| Response Organization | 16 | 8.0% |
| Response Could Evoke Strong Emotions | 15 | 7.5% |
| Response Identification of Root Cause | 12 | 6.0% |
| Response Complexity | 10 | 5.0% |
| Response Confirmation / Contradiction | 1 | 0.5% |

Prompt-level codes (assigned when `source='prompt'`):

| Code | N | % of selections |
|---|---|---|
| Child Intentions | 16 | 8.0% |
| Parents Trust of Model Capabilities | 1 | 0.5% |
| Children Could Become Overdependent | 0 | — |

### Coding Pipeline

```
selections_export + concern_items_export
    │
    ▼ export_highlights_tsv.py
highlights_for_coding_export.tsv   (267 rows: highlight × rationale pairs)
    │
    ├── R4 human coding in Google Sheets
    │       │
    │       ▼ R4_highlights_coded.tsv  (998 data rows)
    │       │
    │       ▼ import_coded_tsv.py
    │       model_strategy_for_notebook.csv    (253 rows)
    │       parent_motivation_for_notebook.csv (272 rows)
    │       │
    │       ▼ 0_R4_highlight_analysis.ipynb
    │       df_sel (200 rows — one per unique selection)
    │
    ├── LLM coding Round 4 (0_llm_coder.ipynb)
    │       │
    │       ▼ llm_coding_output/R4_llm_coded_highlights.tsv
    │         R4_cache_strategy.json  (248 entries)
    │         R4_cache_motivation.json (267 entries)
    │         R4_validation_report.csv
    │
    └── R5 adjudicated coding
            R5_motivation_coded.tsv     (267-row three-way: R4 | LLM | R5 adjudicated)
            R5_highlights_coded         (full R5 coding, 998 data rows)
            R5_strategy_coded           (strategy adjudication)
            │
            ▼ 0_R5_highlight_analysis.ipynb
            df_sel (267 rows — one per highlight × rationale pair)
```

The current working caches (`cache_strategy.json`, `cache_motivation.json`,
`llm_coded_highlights.tsv`) reflect the most recent LLM coding run.

**Pilot 9 coding coverage:**

| Measure | N |
|---|---|
| Unique selections (df_sel R4) | 200 |
| Highlight × rationale pairs (df_sel R5) | 267 |
| Selections with model_strategy coded | 184 |
| Selections with parent_motivation coded | 200 |
| Selections with highlight_sentiment | 200 |
| Mean highlight sentiment | 5.33 / 7 |

---

## LLM Coding

**Notebook:** `stat_analysis/0_llm_coder.ipynb`
**Model:** `claude-opus-4-7`
**Input:** `highlights_for_coding_export.tsv` (267 rows — highlight × rationale pairs)
**Purpose:** Validate an LLM-based coder against single-coder human labels to enable
scalable coding in the main study without per-row manual effort.

### Design

- Two separate API calls per row (strategy and motivation) prevent cross-contamination
- No sentiment leakage: the 1–7 `highlight_sentiment` rating is never passed to the model
- Presence-agnostic coding: codes reflect what the parent *considered*, not whether AI
  behavior was objectively present or successful
- CRAFT-structured system prompts with full-scenario few-shot examples from pilot data
  (scenario prompt + full AI response + highlighted text + parent rationale per example)
- Acceptance criterion: Gwet's AC1 ≥ 0.70 per code vs. human ground truth

### Source Filter (strategy only)

19 rows have `source='prompt'` (parent highlighted text from the child's question rather
than the AI response). These rows are excluded from strategy coding — no strategy code is
meaningful when the highlighted span is not AI-generated content. The strategy cache covers
248 response-source rows; all 267 rows are coded for motivation.

### Source-Gated Motivation Taxonomy

Response-level and prompt-level motivation codes are mutually exclusive by design.
`predict_motivation()` selects between two separate system prompts at runtime:

| `source` value | Taxonomy used | Codes available |
|---|---|---|
| `'response'` | Response-level | Response Usefulness, Response Risk Awareness, Response Could Evoke Strong Emotions, Response Identification of Root Cause, Response Complexity, Response Organization, Response Confirmation / Contradiction |
| `'prompt'` | Prompt-level | Child Intentions, Children Could Become Overdependent, Parents Trust of Model Capabilities |

### Two-Turn Context Protocol

Turn 1 sends only the highlighted span and parent rationale (no scenario context) to
minimize prompt length and avoid priming. If the model returns `{"need_context": true}`,
Turn 2 provides the full scenario prompt and AI response.

- Strategy context usage: 54/248 rows (22%) required Turn 2
- Motivation context usage: 17/267 rows (6%) required Turn 2
- Fallback: if Turn 2 also returns `need_context`, the code is set to `null` (this occurs
  when the highlighted text does not appear in the AI response)

### Caching

Predictions are cached incrementally to JSON files keyed by `highlight_id|concern_item_id`.
Re-runs skip cached rows. Cache files are tracked in git under `llm_coding_output/`.

| Cache file | Entries |
|---|---|
| `cache_strategy.json` | 248 |
| `cache_motivation.json` | 267 |

### LABEL_MAP Normalizations

Ground truth labels from earlier pilot coding rounds are normalized to canonical names
before validation:

| Old label | Canonical label |
|---|---|
| Adapt to Age Group | Consider Age Group |
| Response Contradicts Itself | Response Confirmation / Contradiction |
| Response Could Evoke Strong Emotion | Response Could Evoke Strong Emotions |

### Round 1 Validation Results

**Model Strategy** (248 response-source comparable pairs, threshold AC1 ≥ 0.70):

| Code | AC1 | F1 | N_GT | Result |
|---|---|---|---|---|
| Prompted Suggestions | 0.520 | 0.687 | 103 | **FAIL** |
| Emphasize Emotional Support | 0.898 | 0.795 | 43 | PASS |
| Unprompted Suggestions | 0.843 | 0.195 | 28 | PASS |
| Clarify Child's Intent | 0.931 | 0.545 | 22 | PASS |
| Emphasize Risk Awareness | 0.962 | 0.789 | 18 | PASS |
| Redirect with Alternatives | 0.902 | 0.083 | 10 | PASS |
| Explain Problems in Prompt | 0.957 | 0.444 | 9 | PASS |
| Consider Age Group | 0.924 | 0.320 | 7 | PASS |
| Refuse Response and Explain | 0.987 | 0.769 | 5 | PASS |
| Defer to Resources | 0.992 | 0.000 | 2 | PASS |
| Encourage Introspection | 0.983 | 0.333 | 1 | PASS |
| Defer to Parents | 0.988 | 0.000 | 0 | PASS |
| null | 0.971 | 0.000 | 0 | PASS |
| **Overall** | — | 0.382 (macro F1) | — | **12/13 PASS** |

Exact match accuracy: 58.9%

**Parent Motivation** (267 comparable pairs, threshold AC1 ≥ 0.70):

| Code | AC1 | F1 | N_GT | Result |
|---|---|---|---|---|
| Response Usefulness | 0.383 | 0.635 | 117 | **FAIL** |
| Response Risk Awareness | 0.811 | 0.565 | 50 | PASS |
| Response Could Evoke Strong Emotions | 0.902 | — | 24 | PASS |
| Response Identification of Root Cause | 0.877 | 0.121 | 22 | PASS |
| Response Organization | 0.940 | 0.611 | 19 | PASS |
| Child Intentions | 0.987 | 0.914 | 18 | PASS |
| Response Complexity | 0.958 | 0.643 | 13 | PASS |
| Parents Trust of Model Capabilities | 0.992 | 0.500 | 3 | PASS |
| Response Confirmation / Contradiction | 0.992 | 0.500 | 1 | PASS |
| **Overall** | — | 0.503 (macro F1) | — | **9/10 PASS** |

Exact match accuracy: 59.2%

**Interpretation:** The two failing codes are the highest-frequency catch-all codes in each
dimension. *Prompted Suggestions* (44.5% of strategy labels) is confusable with Redirect
with Alternatives, Unprompted Suggestions, and Emphasize Emotional Support when those
strategies co-occur with direct help. *Response Usefulness* (45.5% of motivation labels)
is a broad evaluative catch-all that the model conflates with Response Could Evoke Strong
Emotions and Response Identification of Root Cause in ambiguous cases. Both are targets
for prompt revision in Round 2.

**Limitation:** No human-human IRR baseline exists; single-coder ground truth is the
practical ceiling. AC1 ≥ 0.70 is a pragmatic threshold noted as a study limitation.

### Output Files

Located in `data-exports/20260412_183830/highlight_analysis_output/llm_coding_output/`:

**Round 4 (archived):**

| File | Description |
|---|---|
| `R4_llm_coded_highlights.tsv` | 267 rows: `highlight_id`, `Model Strategy`, `Parent Motivation` |
| `R4_cache_strategy.json` | R4 strategy predictions (248 response-source entries) |
| `R4_cache_motivation.json` | R4 motivation predictions (267 entries) |
| `R4_validation_report.csv` | Per-code AC1, F1, N_GT, N_pred, PASS/FAIL — R4 round |

**Current working files (most recent run):**

| File | Description |
|---|---|
| `llm_coded_highlights.tsv` | 267 rows: `highlight_id`, `Model Strategy`, `Parent Motivation` |
| `cache_strategy.json` | Strategy predictions (248 response-source entries) |
| `cache_motivation.json` | Motivation predictions (267 entries) |

---

## Reproducing the Analysis

```bash
# Raw exports are in data-exports/20260412_183830/*_export_*.csv

# (If re-coding) export highlights for coding
cd data-exports/20260412_183830
python export_highlights_tsv.py          # → highlights_for_coding_export.tsv

# After editing R4_highlights_coded.tsv (selection-level), re-import
python import_coded_tsv.py               # → model_strategy_for_notebook.csv
                                         #    parent_motivation_for_notebook.csv

# Run LLM coder (requires CLAUDE_API_KEY in stat_analysis/.env)
# Skips cached rows on re-run; outputs to llm_coding_output/
jupyter notebook stat_analysis/0_llm_coder.ipynb

# R4 analysis (selection-level, 200 rows)
jupyter notebook stat_analysis/0_R4_highlight_analysis.ipynb

# R5 analysis (rationale-level, 267 rows — uses R5_highlights_coded)
jupyter notebook stat_analysis/0_R5_highlight_analysis.ipynb

jupyter notebook stat_analysis/1_classifier_sentiment.ipynb
jupyter notebook stat_analysis/1_classifier_llm.ipynb
```

Python environment: `miniforge/base/envs/open-webui`
