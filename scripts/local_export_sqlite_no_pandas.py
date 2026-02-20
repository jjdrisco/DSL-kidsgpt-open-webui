#!/usr/bin/env python3
"""Export selected tables from local SQLite to CSV without pandas (uses built-in sqlite3 + csv).
This avoids the need for pandas in the runtime used by run_in_terminal.
"""
import sqlite3
import csv
import os
import datetime
from pathlib import Path

DB_PATH = "backend/data/webui.db"
if not Path(DB_PATH).exists():
    raise SystemExit(f"Database not found: {DB_PATH}")

BATCH = 1000

def export_query(conn, query, outpath):
    cur = conn.cursor()
    cur.execute(query)
    headers = [d[0] for d in cur.description]
    with open(outpath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        while True:
            rows = cur.fetchmany(BATCH)
            if not rows:
                break
            writer.writerows(rows)
    return os.path.getsize(outpath)


def main():
    conn = sqlite3.connect(DB_PATH)
    t = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    outdir = Path('data-exports') / t
    outdir.mkdir(parents=True, exist_ok=True)
    print('EXPORT_DIR', outdir)

    child_q = '''
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
    ORDER BY cp.user_id, cp.created_at;'''

    mod_q = '''
    SELECT
      ms.id,
      ms.user_id,
      ms.child_id,
      ms.scenario_index,
      ms.attempt_number,
      ms.version_number,
      ms.session_number,
      ms.scenario_prompt,
      ms.scenario_id,
      ms.original_response,
      ms.initial_decision,
      ms.is_final_version,
      ms.concern_level,
      ms.concern_reason,
      ms.satisfaction_level,
      ms.satisfaction_reason,
      ms.next_action,
      ms.decided_at,
      ms.highlights_saved_at,
      ms.saved_at,
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
    ORDER BY ms.user_id, ms.child_id, ms.scenario_index, ms.attempt_number, ms.version_number;'''

    exit_q = '''
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
    ORDER BY eq.user_id, eq.child_id, eq.created_at;'''

    assign_q = '''
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
    ORDER BY ata.user_id, ata.session_number, ata.created_at;'''

    # Export each
    print('Exporting child_profile...')
    child_csv = outdir / f"child_profiles_export_{t}.csv"
    export_query(conn, child_q, str(child_csv))
    print('Wrote', child_csv)

    print('Exporting moderation_session...')
    mod_csv = outdir / f"moderation_sessions_export_{t}.csv"
    export_query(conn, mod_q, str(mod_csv))
    print('Wrote', mod_csv)

    print('Exporting exit_quiz_response...')
    exit_csv = outdir / f"exit_quiz_responses_export_{t}.csv"
    export_query(conn, exit_q, str(exit_csv))
    print('Wrote', exit_csv)

    print('Exporting assignment_session_activity...')
    assign_csv = outdir / f"assignment_time_export_{t}.csv"
    export_query(conn, assign_q, str(assign_csv))
    print('Wrote', assign_csv)

    # Derive moderation proportion summary by scanning moderation_session
    print('Computing moderation proportion...')
    cur = conn.cursor()
    cur.execute("SELECT initial_decision FROM moderation_session")
    total = moderated = not_mod = 0
    rows = cur.fetchall()
    total = len(rows)
    for (d,) in rows:
        if d == 'moderate':
            moderated += 1
        elif d == 'accept_original':
            not_mod += 1
    proportion = (moderated / total) if total > 0 else 0.0
    prop_csv = outdir / f"moderation_proportion_export_{t}.csv"
    with open(prop_csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['metric','value'])
        w.writerow(['total_scenarios', total])
        w.writerow(['moderated_scenarios', moderated])
        w.writerow(['not_moderated_scenarios', not_mod])
        w.writerow(['proportion_moderated', proportion])
    print('Wrote', prop_csv)

    conn.close()
    print('\nEXPORT_DONE', t)
    return outdir

if __name__ == '__main__':
    main()
