# Coding Pipeline — Export 20260412_183830

This export contains raw study data, qualitative coding files, and notebook-ready CSVs
for the DSL KidsGPT Prolific study. The pipeline has two stages: **Export** (raw data →
TSV for human coding) and **Import** (coded TSV → CSVs consumed by the analysis notebook).

---

## Stage 1: Export for Coding

**Script:** `export_highlights_tsv.py`  
**Output:** `highlights_for_coding_export.tsv`

Builds one row per (text selection × concern-item rationale) pair from completed
moderation sessions. Each row represents a parent's text highlight and one of the
rationales they wrote for it.

### What it does

1. Loads `selections_export_*.csv`, `moderation_sessions_export_*.csv`,
   `scenarios_export_*.csv`, and `concern_items_export_*.csv`.
2. Filters to sessions where `is_final_version = true` and `prolific_pid` is present.
3. Drops admin/test rows (no `prolific_pid`).
4. Explodes `concern_items.linked_highlights` (JSON array) and substring-matches each
   stored highlight text against `selections.selected_text` to link rationales to
   highlights.
5. Deduplicates on `(highlight_id, item_rationale)` so each unique (highlight, rationale)
   pair appears exactly once.
6. Sorts by `domain → age_band → scenario_id` for scenario-grouped coding.
7. Appends two blank columns at the right edge for coders to fill in:
   - `model_strategy` — one code per row describing the AI response characteristic
   - `parent_motivation` — one code per row describing why the parent flagged the highlight

### Key columns

| Column | Description |
|---|---|
| `highlight_id` | UUID of the text selection (join key back to selections table) |
| `concern_item_id` | UUID of the linked rationale (concern_items table) |
| `selected_text` | The text the parent highlighted |
| `item_rationale` | The parent's written justification for flagging |
| `item_concern_level` | Concern rating the parent assigned to this highlight (1–7) |
| `concern_level` | Session-level concern rating |
| `model_strategy` | **(blank — coder fills in)** |
| `parent_motivation` | **(blank — coder fills in)** |

### Expected row count

267 rows (200 unique highlights × ~1.3 rationales each on average).

---

## Coding in Google Sheets

1. Open `highlights_for_coding_export.tsv` in Google Sheets (File → Import → TSV).
2. Refer to `moderation_codes.tsv` for the code list and definitions.
3. Fill in `model_strategy` and/or `parent_motivation` — **one code per cell**.
   - `model_strategy`: codes describe what the AI response did (e.g., "Emphasize Risk Awareness")
   - `parent_motivation`: codes describe why the parent flagged the highlight
     (e.g., "Response Usefulness")
4. Leave blank any row you do not want to code.
5. Export the sheet as **Tab-separated values (.tsv)** and save it as `highlights_coded.tsv`
   in this directory.

The file must retain the `highlight_id` column (the join key). Column names for the
code columns must be exactly:

| Header in TSV | Maps to |
|---|---|
| `Model Strategy` | `model_strategy_for_notebook.csv` |
| `Parent Motivation` | `parent_motivation_for_notebook.csv` |

---

## Stage 2: Import Coded Data

**Script:** `import_coded_tsv.py`  
**Input:** `highlights_coded.tsv`  
**Outputs:**
- `model_strategy_for_notebook.csv` — `(concern_item_id, highlight_id, response_characteristic_code)`
- `parent_motivation_for_notebook.csv` — `(concern_item_id, highlight_id, concern_code)`

### What it does

1. Reads `highlights_coded.tsv` and drops rows where all code columns are blank.
2. Rebuilds the `(highlight_id, concern_item_id)` compound key by re-running the same
   substring-match join used in the export script (selections ↔ concern_items via
   `linked_highlights` text).
3. Left-joins coded rows onto the mapping to attach `concern_item_id`.
4. Writes one output CSV per code column found in the file, deduplicating on
   `(concern_item_id, highlight_id)`.

### To re-process after editing `highlights_coded.tsv`

```bash
cd data-exports/20260412_183830
python import_coded_tsv.py
```

Expected output:
```
Coded rows (raw): 999          # total rows in TSV (including blank rows from export)
Coded rows after dropping blanks: 267
(highlight_id, concern_item_id) links: 276
  Model Strategy: 253 rows → model_strategy_for_notebook.csv
  Parent Motivation: 272 rows → parent_motivation_for_notebook.csv
```

---

## Stage 3: Analysis Notebook

**Notebook:** `stat_analysis/highlight_analysis.ipynb`

Reads `model_strategy_for_notebook.csv` and `parent_motivation_for_notebook.csv` and
builds `df_sel` — one row per selection (200 rows) — with:

- `model_strategy`: single code per selection
- `parent_motivation`: pipe-joined multiselect string (e.g., `"Response Usefulness | Response Risk Awareness"`)
  for selections that matched multiple rationales with different codes
- `highlight_sentiment`: per-selection concern rating from `highlight_levels` (1–7)

After updating `highlights_coded.tsv` and re-running the import script, re-execute the
notebook to refresh all analysis outputs in
`data-exports/20260412_183830/highlight_analysis_output/`.

---

## File Reference

| File | Role |
|---|---|
| `highlights_for_coding_export.tsv` | TSV sent to coders — do not edit |
| `highlights_coded.tsv` | Coder-filled copy — edit this one |
| `moderation_codes.tsv` | Code list with definitions and examples |
| `export_highlights_tsv.py` | Generates `highlights_for_coding_export.tsv` |
| `import_coded_tsv.py` | Generates notebook-ready CSVs from `highlights_coded.tsv` |
| `model_strategy_for_notebook.csv` | Notebook input — AI response strategy codes |
| `parent_motivation_for_notebook.csv` | Notebook input — parent motivation codes |
| `*_export_20260412_183830.csv` | Raw study data exports (do not edit) |
