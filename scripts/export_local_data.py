#!/usr/bin/env python3
"""
Export study data from the local SQLite database into a timestamped
data-exports/<YYYYMMDD_HHMMSS>/ folder, then copy the latest analysis
notebook into the same folder (renamed with the new timestamp) so it
is ready to run immediately.

Usage:
    python scripts/export_local_data.py [--db-path PATH] [--output-dir PATH]

Defaults:
    --db-path     backend/open_webui/data/webui.db  (relative to repo root)
    --output-dir  data-exports/<timestamp>

Requirements:
    - Python stdlib only (sqlite3, csv, shutil, etc.) — no extra packages needed.
"""

import argparse
import csv
import glob
import os
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


DEFAULT_DB_PATH = "backend/data/webui.db"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def open_connection(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        print(
            f"ERROR: SQLite database not found at: {db_path}\n"
            "       Make sure the local server has been run at least once.",
            file=sys.stderr,
        )
        sys.exit(1)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row  # allows column access by name
    # Enable WAL mode so we don't block any running server process
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def export_query_to_csv(
    conn: sqlite3.Connection, query: str, output_path: Path, label: str
) -> int:
    """Execute *query*, stream results to *output_path*, return row count."""
    total = 0
    cur = conn.cursor()
    cur.execute(query)
    headers = [desc[0] for desc in cur.description]
    with open(output_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(headers)
        while True:
            rows = cur.fetchmany(1000)
            if not rows:
                break
            writer.writerows(rows)
            total += len(rows)
            print(f"  {label}: {total} rows written ...", end="\r", flush=True)
    print(f"  {label}: {total} rows  ✓                    ")
    cur.close()
    return total


# ---------------------------------------------------------------------------
# SQL queries
# NOTE: SQLite does not support the Postgres `::text` cast — JSON columns are
#       stored as plain TEXT in SQLite, so no casting is needed.
# NOTE: SQLite uses double-quoted identifiers; `"user"` works fine.
# ---------------------------------------------------------------------------

USER_QUERY = """
SELECT
    u.id,
    u.email,
    u.username,
    u.role,
    u.name,
    u.prolific_pid,
    u.study_id,
    u.current_session_id,
    u.session_number,
    u.consent_given,
    u.parent_id,
    u.last_active_at,
    u.created_at,
    u.updated_at,
    u.workflow_reset_at,
    u.instructions_completed_at,
    u.current_attempt_number
FROM "user" u
ORDER BY u.created_at;
"""

CHILD_QUERY = """
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
    u.name             AS user_name,
    u.email            AS user_email,
    u.role             AS user_role,
    u.prolific_pid,
    u.session_number   AS user_session_number,
    u.consent_given
FROM child_profile cp
LEFT JOIN "user" u ON cp.user_id = u.id
ORDER BY cp.user_id, cp.created_at;
"""

MOD_QUERY = """
SELECT
    ms.id,
    ms.user_id,
    ms.child_id,
    ms.scenario_id,
    ms.scenario_index,
    ms.attempt_number,
    ms.version_number,
    ms.session_number,
    ms.scenario_prompt,
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
    u.name             AS user_name,
    u.email            AS user_email,
    u.role             AS user_role,
    u.prolific_pid,
    cp.name            AS child_name,
    cp.child_age,
    cp.child_gender,
    cp.child_characteristics
FROM moderation_session ms
LEFT JOIN "user"         u  ON ms.user_id  = u.id
LEFT JOIN child_profile  cp ON ms.child_id = cp.id
ORDER BY ms.user_id, ms.child_id, ms.scenario_index,
         ms.attempt_number, ms.version_number;
"""

EXIT_QUERY = """
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
    u.name             AS user_name,
    u.email            AS user_email,
    u.role             AS user_role,
    u.prolific_pid,
    cp.name            AS child_name,
    cp.child_age,
    cp.child_gender
FROM exit_quiz_response eq
LEFT JOIN "user"        u  ON eq.user_id  = u.id
LEFT JOIN child_profile cp ON eq.child_id = cp.id
ORDER BY eq.user_id, eq.child_id, eq.created_at;
"""

SCENARIOS_QUERY = """
SELECT
    s.scenario_id,
    s.set_name,
    s.trait,
    s.polarity,
    s.prompt_style,
    s.domain,
    s.subdomain,
    s.age_band,
    s.gender_identity,
    s.trait_level,
    s.piaget_stage,
    s.intent,
    s.source,
    s.model_name,
    s.is_active,
    s.n_assigned,
    s.n_completed,
    s.n_skipped,
    s.n_abandoned,
    s.created_at,
    s.updated_at
FROM scenarios s
ORDER BY s.trait, s.polarity, s.scenario_id;
"""

ASSIGNMENT_TIME_QUERY = """
SELECT
    ata.id,
    ata.user_id,
    ata.session_number,
    ata.active_ms_delta,
    ata.cumulative_ms,
    ata.created_at,
    u.name             AS user_name,
    u.email            AS user_email,
    u.role             AS user_role,
    u.prolific_pid
FROM assignment_session_activity ata
LEFT JOIN "user" u ON ata.user_id = u.id
ORDER BY ata.user_id, ata.session_number, ata.created_at;
"""


# ---------------------------------------------------------------------------
# Notebook copy
# ---------------------------------------------------------------------------


def find_latest_notebook(data_exports_root: Path) -> Path | None:
    """
    Search all data-exports subdirectories for analysis_*.ipynb files and
    return the one whose parent folder timestamp is most recent.
    """
    pattern = str(data_exports_root / "*" / "analysis_*.ipynb")
    candidates = sorted(glob.glob(pattern))
    if not candidates:
        # also check ARCHIVE subdirs
        pattern_archive = str(
            data_exports_root / "ARCHIVE" / "*" / "analysis_*.ipynb"
        )
        candidates = sorted(glob.glob(pattern_archive))
    return Path(candidates[-1]) if candidates else None


def copy_notebook(notebook_src: Path, export_dir: Path, ts: str) -> Path | None:
    dest = export_dir / f"analysis_{ts}.ipynb"
    try:
        shutil.copy2(notebook_src, dest)
        return dest
    except OSError as exc:
        print(f"WARNING: Could not copy notebook: {exc}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export study data from the local SQLite database."
    )
    parser.add_argument(
        "--db-path",
        default=None,
        help=(
            f"Path to the SQLite database file "
            f"(default: <repo-root>/{DEFAULT_DB_PATH})"
        ),
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory path (default: data-exports/<timestamp>)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    ts = timestamp()
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    data_exports_root = repo_root / "data-exports"

    db_path = (
        Path(args.db_path)
        if args.db_path
        else repo_root / DEFAULT_DB_PATH
    )
    # Resolve relative paths from cwd
    if not db_path.is_absolute():
        db_path = Path(os.getcwd()) / db_path

    export_dir = Path(args.output_dir) if args.output_dir else data_exports_root / ts
    export_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("  Local SQLite data export")
    print(f"  DB:         {db_path}")
    print(f"  Output dir: {export_dir}")
    print("=" * 60)

    conn = open_connection(db_path)

    # Verify expected tables exist
    existing_tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table';"
        ).fetchall()
    }

    required_tables = {
        "user",
        "child_profile",
        "moderation_session",
        "exit_quiz_response",
        "scenarios",
        "assignment_session_activity",
    }
    missing = required_tables - existing_tables
    if missing:
        print(
            f"WARNING: The following tables are missing from the database "
            f"and will be skipped: {', '.join(sorted(missing))}",
            file=sys.stderr,
        )

    # Define each export: (label, query, filename_prefix, required_table)
    exports = [
        ("users",               USER_QUERY,            "users_export",               "user"),
        ("child_profiles",      CHILD_QUERY,           "child_profiles_export",      "child_profile"),
        ("scenarios",           SCENARIOS_QUERY,       "scenarios_export",            "scenarios"),
        ("moderation_sessions", MOD_QUERY,             "moderation_sessions_export", "moderation_session"),
        ("exit_quiz_responses", EXIT_QUERY,            "exit_quiz_responses_export", "exit_quiz_response"),
        ("assignment_time",     ASSIGNMENT_TIME_QUERY, "assignment_time_export",     "assignment_session_activity"),
    ]

    results: list[tuple[str, Path, int]] = []

    try:
        for label, query, prefix, table in exports:
            if table not in existing_tables:
                print(f"  Skipping {label} — table '{table}' not found.")
                continue
            csv_path = export_dir / f"{prefix}_{ts}.csv"
            print(f"Exporting {label} -> {csv_path.name}")
            try:
                row_count = export_query_to_csv(conn, query, csv_path, label)
                results.append((label, csv_path, row_count))
            except sqlite3.OperationalError as exc:
                print(
                    f"  WARNING: Could not export {label}: {exc}",
                    file=sys.stderr,
                )
    finally:
        conn.close()

    # ------------------------------------------------------------------
    # Copy analysis notebook
    # ------------------------------------------------------------------
    print("\nLooking for latest analysis notebook ...")
    notebook_src = find_latest_notebook(data_exports_root)
    notebook_dest: Path | None = None

    if notebook_src:
        print(f"Found: {notebook_src.relative_to(repo_root)}")
        notebook_dest = copy_notebook(notebook_src, export_dir, ts)
        if notebook_dest:
            print(f"Copied -> {notebook_dest.name}  ✓")
    else:
        print("WARNING: No existing analysis notebook found — skipping copy.")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"  Export complete — {export_dir.relative_to(repo_root)}")
    print("=" * 60)
    print(f"  {'File':<45} {'Rows':>6}")
    print(f"  {'-'*45} {'-'*6}")
    for label, csv_path, row_count in results:
        print(f"  {csv_path.name:<45} {row_count:>6}")
    if notebook_dest:
        print(f"  {notebook_dest.name:<45} {'(nb)':>6}")
    print("=" * 60)
    print(
        f"\nNext step:\n"
        f"  cd {export_dir.relative_to(repo_root)}\n"
        f"  jupyter notebook analysis_{ts}.ipynb\n"
    )


if __name__ == "__main__":
    main()
