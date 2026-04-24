"""
Import coded highlights back from Google Sheets and produce notebook input CSVs.

Input: highlights_coded.tsv
  Required columns: highlight_id  (= selections_export.id)
  Code columns (any subset): Model Strategy, Parent Motivation

Maps each coded row to its (concern_item_id, highlight_id) compound key by
rebuilding the linked_highlights substring-match relationship from the raw
exports (same logic as export_highlights_tsv.py). Compound key ensures a 1:1
match with df_highlight rows in the notebook.

Output (one file per code column present and non-empty):
  model_strategy_for_notebook.csv    → concern_item_id, highlight_id, response_characteristic_code
  parent_motivation_for_notebook.csv → concern_item_id, highlight_id, concern_code

Notebook Cell 27 / Cell 30 must join on:
  left_on=['concern_item_id', 'selection_id']
  right_on=['concern_item_id', 'highlight_id']
"""

import json
import pandas as pd
from pathlib import Path

DIR = Path(__file__).parent

coded = pd.read_csv(DIR / "highlights_coded.tsv", sep="\t", dtype=str)
sel   = pd.read_csv(DIR / "selections_export_20260412_183830.csv")
ci    = pd.read_csv(DIR / "concern_items_export_20260412_183830.csv")

print(f"Coded rows (raw): {len(coded)}")

# Drop rows where all code columns are blank
code_cols = [c for c in coded.columns if c != "highlight_id"]
coded = coded[coded[code_cols].apply(
    lambda r: r.notna() & (r.str.strip() != ""), axis=1
).any(axis=1)].copy()
print(f"Coded rows after dropping blanks: {len(coded)}")

# Build (selection_id, concern_item_id) mapping via linked_highlights substring match
ci["linked_highlights"] = ci["linked_highlights"].apply(
    lambda x: json.loads(x) if pd.notna(x) and str(x).strip() not in ("", "[]") else []
)
ci_exp = ci.explode("linked_highlights").rename(columns={"linked_highlights": "hl_text"})
ci_exp = ci_exp[["id", "user_id", "scenario_id", "hl_text"]].rename(columns={"id": "concern_item_id"})
ci_exp = ci_exp[ci_exp["hl_text"].notna() & (ci_exp["hl_text"].astype(str).str.strip() != "")]

mapping = sel[["id", "user_id", "scenario_id", "selected_text"]].rename(columns={"id": "highlight_id"})
mapping = mapping.merge(ci_exp, on=["user_id", "scenario_id"], how="inner")
mapping = mapping[mapping.apply(
    lambda r: str(r["hl_text"]) in str(r["selected_text"]) or str(r["selected_text"]) in str(r["hl_text"]),
    axis=1
)][["highlight_id", "concern_item_id"]].drop_duplicates()

print(f"(highlight_id, concern_item_id) links: {len(mapping)}")

# Join coded data on highlight_id to get concern_item_id
merged = coded.merge(mapping, on="highlight_id", how="left")
unmatched = merged["concern_item_id"].isna().sum()
if unmatched:
    print(f"WARNING: {unmatched} coded rows have no concern_item_id match")

COLUMN_MAP = {
    "Model Strategy":    ("model_strategy_for_notebook.csv",    "response_characteristic_code"),
    "Parent Motivation": ("parent_motivation_for_notebook.csv", "concern_code"),
}

for src_col, (out_filename, notebook_col) in COLUMN_MAP.items():
    if src_col not in merged.columns:
        print(f"  {src_col}: not found in file, skipping")
        continue

    out = merged[["concern_item_id", "highlight_id", src_col]].copy()
    out = out[out[src_col].notna() & (out[src_col].str.strip() != "")]
    out = out[out["concern_item_id"].notna()]
    out = out.drop_duplicates(subset=["concern_item_id", "highlight_id"])
    out = out.rename(columns={src_col: notebook_col})

    out_path = DIR / out_filename
    out.to_csv(out_path, index=False, encoding="utf-8")
    print(f"  {src_col}: {len(out)} rows → {out_path}")
