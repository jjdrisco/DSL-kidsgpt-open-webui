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
| `selections_export` | 1 row per text highlight | `id` (highlight UUID), `user_id`, `scenario_id`, `selected_text`, `start_offset`, `end_offset`, `prolific_pid` |
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

## df_sel Build (`highlight_analysis.ipynb` Cell 9)

`df_sel` is the primary analysis dataframe: 200 rows × 1 row per unique selection.

Build steps:

1. Filter `selections_export` to approved-participant sessions via `df_session` keys
2. Explode `concern_items.linked_highlights` and substring-match against `selections.selected_text`
   scoped to `(user_id, scenario_id)` — uses the full unfiltered 195 concern items
3. Extract `highlight_sentiment` from `concern_items.highlight_levels[hl_text]`
4. Deduplicate on `(selection_id, rationale_text)` → 267 intermediate rows
5. Attach `parent_motivation` codes via `(concern_item_id, selection_id)`, collapse to
   pipe-joined string per selection
6. Collapse to one row per selection (`drop_duplicates('selection_id')`)
7. Attach `model_strategy` via `selection_id` only
8. Merge scenario metadata (domain, subdomain, age_band, trait, sensitivity_level, etc.)
   and parent covariates from exit quiz

**model_strategy NaN:** 16 rows have null model_strategy. These are highlights of non-response
text (e.g., structural elements, headers) rather than AI response content. They are genuine
missing values, not an "unknown" category. An indicator `strategy_is_null` is added in
classifier feature engineering.

---

## Qualitative Coding

Two codes per (highlight × rationale) pair.

**Model Strategy** — what the AI response did that the parent flagged:

| Code | N | % |
|---|---|---|
| Prompted Suggestions | 89 | 44.5% |
| Emphasize Emotional Support | 32 | 16.0% |
| Emphasize Risk Awareness | 15 | 7.5% |
| Unprompted Suggestions | 14 | 7.0% |
| Clarify Child's Intent | 11 | 5.5% |
| Adapt to Age Group | 7 | 3.5% |
| Redirect with Alternatives | 6 | 3.0% |
| Explain Problems in Prompt | 6 | 3.0% |
| Defer to Resources | 2 | 1.0% |
| Encourage Introspection | 1 | 0.5% |
| Refuse Response and Explain | 1 | 0.5% |

**Parent Motivation** — why the parent flagged the highlight:

| Code | N | % of selections |
|---|---|---|
| Response Usefulness | 91 | 45.5% |
| Response Risk Awareness | 38 | 19.0% |
| Child Intentions | 16 | 8.0% |
| Response Organization | 16 | 8.0% |
| Response Could Evoke Strong Emotion | 15 | 7.5% |
| Response Identification of Root Cause | 12 | 6.0% |
| Response Complexity | 10 | 5.0% |
| Parents Trust of Model Capabilities | 1 | 0.5% |
| Response Contradicts Itself | 1 | 0.5% |

### Coding Pipeline

```
selections_export + concern_items_export
    │
    ▼ export_highlights_tsv.py
highlights_for_coding_export.tsv   (267 rows: highlight × rationale pairs)
    │
    ▼ human coding in Google Sheets
highlights_coded.tsv               (Model Strategy + Parent Motivation columns)
    │
    ▼ import_coded_tsv.py
model_strategy_for_notebook.csv    (253 rows)
parent_motivation_for_notebook.csv (272 rows)
    │
    ▼ highlight_analysis.ipynb
df_sel                             (200 rows — one per unique selection)
```

**Pilot 9 coding coverage:**

| Measure | N |
|---|---|
| Unique selections (df_sel) | 200 |
| Selections with model_strategy coded | 184 |
| Selections with parent_motivation coded | 200 |
| Selections with highlight_sentiment | 200 |
| Mean highlight sentiment | 5.33 / 7 |

---

## Reproducing the Analysis

```bash
# Raw exports are in data-exports/20260412_183830/*_export_*.csv

# (If re-coding) export highlights for coding
cd data-exports/20260412_183830
python export_highlights_tsv.py          # → highlights_for_coding_export.tsv

# After editing highlights_coded.tsv, re-import
python import_coded_tsv.py               # → model_strategy_for_notebook.csv
                                         #    parent_motivation_for_notebook.csv

# Run analysis
jupyter notebook stat_analysis/0_highlight_analysis.ipynb
jupyter notebook stat_analysis/1_classifier_sentiment.ipynb
jupyter notebook stat_analysis/1_classifier_llm.ipynb
```

Python environment: `miniforge/base/envs/open-webui`
