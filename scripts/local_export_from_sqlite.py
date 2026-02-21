#!/usr/bin/env python3
"""Export local SQLite tables to CSV (creates a timestamped folder under data-exports).
Mirrors `export_study_data.py` but works against the local `backend/data/webui.db` SQLite file.
"""
import sqlite3
import pandas as pd
import os
import datetime
from pathlib import Path

DB_PATH = "backend/data/webui.db"
if not Path(DB_PATH).exists():
    raise SystemExit(f"Database not found: {DB_PATH}")


def export():
    conn = sqlite3.connect(DB_PATH)
    t = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    outdir = Path("data-exports") / t
    outdir.mkdir(parents=True, exist_ok=True)
    print("EXPORT_DIR", outdir)

    child_q = """
    SELECT
      cp.id,
      cp.user_id,
      cp.name,
      cp.child_age,
      cp.child_gender,
      cp.child_characteristics,
      cp.is_only_child,
      cp.child_has_ai_use,
      cp.child_ai_use_contexts,
      cp.parent_llm_monitoring_level,
      cp.attempt_number,
      cp.is_current,
      cp.session_number,
      cp.created_at,
      cp.updated_at,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      u.prolific_pid,
      u.session_number AS user_session_number,
      u.consent_given
    FROM child_profile cp
    LEFT JOIN user u ON cp.user_id = u.id
    ORDER BY cp.user_id, cp.created_at;"""

    mod_q = """
    SELECT
      ms.id,
      ms.user_id,
      ms.child_id,
      ms.scenario_index,
      ms.attempt_number,
      ms.version_number,
      ms.session_number,
      ms.scenario_prompt,
      ms.original_response,
      ms.initial_decision,
      ms.is_final_version,
      ms.strategies,
      ms.custom_instructions,
      ms.highlighted_texts,
      ms.refactored_response,
      ms.session_metadata,
      ms.is_attention_check,
      ms.attention_check_selected,
      ms.attention_check_passed,
      ms.created_at,
      ms.updated_at,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      u.prolific_pid,
      cp.name AS child_name,
      cp.child_age,
      cp.child_gender,
      cp.child_characteristics
    FROM moderation_session ms
    LEFT JOIN user u ON ms.user_id = u.id
    LEFT JOIN child_profile cp ON ms.child_id = cp.id
    ORDER BY ms.user_id, ms.child_id, ms.scenario_index, ms.attempt_number, ms.version_number;"""

    exit_q = """
    SELECT
      eq.id,
      eq.user_id,
      eq.child_id,
      eq.answers,
      eq.score,
      eq.meta,
      eq.attempt_number,
      eq.is_current,
      eq.created_at,
      eq.updated_at,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      u.prolific_pid,
      cp.name AS child_name,
      cp.child_age,
      cp.child_gender
    FROM exit_quiz_response eq
    LEFT JOIN user u ON eq.user_id = u.id
    LEFT JOIN child_profile cp ON eq.child_id = cp.id
    ORDER BY eq.user_id, eq.child_id, eq.created_at;"""

    assign_q = """
    SELECT
      ata.id,
      ata.user_id,
      ata.session_number,
      ata.active_ms_delta,
      ata.cumulative_ms,
      ata.created_at,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      u.prolific_pid
    FROM assignment_session_activity ata
    LEFT JOIN user u ON ata.user_id = u.id
    ORDER BY ata.user_id, ata.session_number, ata.created_at;"""

    # Execute and write
    print("Exporting child_profile...")
    df_child = pd.read_sql_query(child_q, conn)
    child_csv = outdir / f"child_profiles_export_{t}.csv"
    df_child.to_csv(child_csv, index=False)
    print("Wrote", child_csv, "rows=", len(df_child))

    print("Exporting moderation_session...")
    df_mod = pd.read_sql_query(mod_q, conn)
    mod_csv = outdir / f"moderation_sessions_export_{t}.csv"
    df_mod.to_csv(mod_csv, index=False)
    print("Wrote", mod_csv, "rows=", len(df_mod))

    print("Exporting exit_quiz_response...")
    df_exit = pd.read_sql_query(exit_q, conn)
    exit_csv = outdir / f"exit_quiz_responses_export_{t}.csv"
    df_exit.to_csv(exit_csv, index=False)
    print("Wrote", exit_csv, "rows=", len(df_exit))

    print("Exporting assignment_session_activity...")
    df_assign = pd.read_sql_query(assign_q, conn)
    assign_csv = outdir / f"assignment_time_export_{t}.csv"
    df_assign.to_csv(assign_csv, index=False)
    print("Wrote", assign_csv, "rows=", len(df_assign))

    # Derived moderation proportion summary (keeps parity with notebook)
    print("Computing moderation proportion summary...")
    total = len(df_mod)
    moderated = (
        int((df_mod["initial_decision"] == "moderate").sum()) if total > 0 else 0
    )
    not_mod = (
        int((df_mod["initial_decision"] == "accept_original").sum()) if total > 0 else 0
    )
    proportion = float(moderated / total) if total > 0 else 0.0
    summary = pd.DataFrame(
        {
            "metric": [
                "total_scenarios",
                "moderated_scenarios",
                "not_moderated_scenarios",
                "proportion_moderated",
            ],
            "value": [total, moderated, not_mod, proportion],
        }
    )
    prop_csv = outdir / f"moderation_proportion_export_{t}.csv"
    summary.to_csv(prop_csv, index=False)
    print("Wrote", prop_csv)

    conn.close()
    print("\nEXPORT_DONE", t)
    return outdir


if __name__ == "__main__":
    export()
