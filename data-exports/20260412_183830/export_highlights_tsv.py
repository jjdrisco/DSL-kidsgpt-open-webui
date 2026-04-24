"""
Export highlight selections to TSV for qualitative coding in Google Sheets.

Output: highlights_for_coding_export.tsv
- One row per text selection from a completed moderation session
- concern_item rationale (item_rationale) and per-highlight rating (item_concern_level)
  are joined from concern_items_export via linked_highlights text matching
- Sorted by domain → age_band → scenario_id for scenario-grouped coding
- Blank coding columns at the right edge (response_characteristic_codes, concern_codes, coder_notes)
- highlight_id is the join key for feeding coded data back into contextual_analysis.ipynb
"""

import json
import pandas as pd
from pathlib import Path

DIR = Path(__file__).parent

# Load
sel = pd.read_csv(DIR / "selections_export_20260412_183830.csv")
sess = pd.read_csv(DIR / "moderation_sessions_export_20260412_183830.csv")
scen = pd.read_csv(DIR / "scenarios_export_20260412_183830.csv")
ci = pd.read_csv(DIR / "concern_items_export_20260412_183830.csv")

print(f"Loaded: {len(sel)} selections, {len(sess)} sessions, {len(scen)} scenarios, {len(ci)} concern items")

# Filter to completed sessions (pattern from contextual_analysis.ipynb Cell 6)
sess["is_final_version"] = sess["is_final_version"].astype(str).str.strip().str.lower()
sess_final = sess[sess["is_final_version"].isin(["true", "1"])].copy()
print(f"Completed sessions: {len(sess_final)} of {len(sess)}")

# Keep needed session columns
sess_cols = sess_final[["user_id", "scenario_id", "concern_level",
                         "realism_level", "initial_decision",
                         "scenario_prompt", "original_response"]]

# Inner join: drops any selection without a completed session
df = sel.merge(sess_cols, on=["user_id", "scenario_id"], how="inner")
print(f"Selections after filtering to completed sessions: {len(df)} of {len(sel)}")

# Drop admin/test accounts (no prolific_pid = not a real participant)
before = len(df)
df = df[df["prolific_pid"].notna()]
print(f"Dropped {before - len(df)} rows from non-participant accounts")

# Enrich with scenario metadata
scen_cols = scen[["scenario_id", "set_name", "domain", "subdomain", "age_band",
                   "gender_identity", "trait", "trait_level",
                   "piaget_stage", "intent"]]
df = df.merge(scen_cols, on="scenario_id", how="left")

# Rename id → highlight_id (notebook join key in Cells 27 + 30)
df = df.rename(columns={"id": "highlight_id"})

# ---------------------------------------------------------------------------
# Join per-highlight rationale from concern_items via linked_highlights text
# ---------------------------------------------------------------------------
ci["linked_highlights"] = ci["linked_highlights"].apply(
    lambda x: json.loads(x) if pd.notna(x) and str(x).strip() not in ("", "[]") else []
)
ci_exp = ci.explode("linked_highlights").rename(columns={"linked_highlights": "hl_text"})
ci_exp = ci_exp[["id", "user_id", "scenario_id", "hl_text", "text", "concern_level"]].rename(
    columns={"id": "concern_item_id", "text": "item_rationale", "concern_level": "item_concern_level"}
)
ci_exp = ci_exp[ci_exp["hl_text"].notna() & (ci_exp["hl_text"].astype(str).str.strip() != "")]

# Merge on user+scenario, then filter to rows where hl_text ⊂ selected_text or vice versa
df = df.merge(ci_exp, on=["user_id", "scenario_id"], how="left")

def texts_match(row):
    if pd.isna(row["hl_text"]):
        return True  # no concern item linked — keep row, columns will be NaN
    return str(row["hl_text"]) in str(row["selected_text"]) or str(row["selected_text"]) in str(row["hl_text"])

df = df[df.apply(texts_match, axis=1)].drop(columns=["hl_text"])
before_dedup = len(df)
df = df.drop_duplicates(subset=["highlight_id", "item_rationale"])
print(f"Selections after concern_item join: {len(df)} (dropped {before_dedup - len(df)} duplicate rationale rows)")

# Sort for coding workflow: scenario groups ordered by domain/age_band
df = df.sort_values(["domain", "age_band", "scenario_id", "prolific_pid"],
                    na_position="last")

# Blank coding columns (singular code per cell)
df["model_strategy"] = ""
df["parent_motivation"] = ""

OUTPUT_COLS = [
    "highlight_id", "concern_item_id",
    "scenario_id", "set_name", "domain", "subdomain", "age_band",
    "gender_identity", "trait", "trait_level",
    "piaget_stage", "intent", "scenario_prompt",
    "original_response",
    "source", "selected_text", "start_offset", "end_offset",
    "concern_level", "item_concern_level", "item_rationale",
    "realism_level", "initial_decision",
    "prolific_pid",
    "model_strategy", "parent_motivation"
]

# Escape embedded newlines so TSV rows stay intact when opened in Google Sheets
for col in ["scenario_prompt", "original_response", "selected_text", "item_rationale"]:
    df[col] = df[col].fillna("").str.replace("\n", "\\n", regex=False)

out_path = DIR / "highlights_for_coding_export.tsv"
df[OUTPUT_COLS].to_csv(out_path, sep="\t", index=False, encoding="utf-8")
print(f"\nExported {len(df)} rows → {out_path}")
print(f"Unique scenarios covered: {df['scenario_id'].nunique()}")
print(f"Unique participants: {df['prolific_pid'].nunique()}")
print(f"\nColumn order:\n  " + "\n  ".join(OUTPUT_COLS))
