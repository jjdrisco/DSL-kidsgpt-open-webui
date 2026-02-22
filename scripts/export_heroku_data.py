#!/usr/bin/env python3
"""
Export study data from a Heroku Postgres database into a timestamped
data-exports/<YYYYMMDD_HHMMSS>/ folder, then copy the latest analysis
notebook into the same folder (renamed with the new timestamp) so it
is ready to run immediately.

Usage:
    python scripts/export_heroku_data.py [--app APP_NAME] [--output-dir PATH]

Defaults:
    --app         dsl-kidsgpt-pilot
    --output-dir  data-exports/<timestamp>

Requirements:
    - Heroku CLI installed and authenticated (`heroku login`)
    - psycopg2-binary (auto-installed if missing)
"""

import argparse
import csv
import glob
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

DEFAULT_APP = "dsl-kidsgpt-pilot"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def ensure_psycopg2() -> bool:
    try:
        import psycopg2  # noqa: F401

        return True
    except ImportError:
        print("psycopg2 not found — installing psycopg2-binary ...")
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "psycopg2-binary"],
                check=True,
                capture_output=True,
            )
            import psycopg2  # noqa: F401

            return True
        except Exception as exc:
            print(f"Failed to install psycopg2-binary: {exc}", file=sys.stderr)
            return False


def check_heroku_auth() -> None:
    """Abort early with a clear message if Heroku CLI / auth is missing."""
    try:
        subprocess.run(["heroku", "--version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print(
            "ERROR: Heroku CLI not found. Install it and run `heroku login` first.",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        subprocess.run(["heroku", "auth:whoami"], capture_output=True, check=True)
    except subprocess.CalledProcessError:
        print(
            "ERROR: Not logged into Heroku CLI. Run `heroku login`.", file=sys.stderr
        )
        sys.exit(1)


def get_database_url(app_name: str) -> str:
    print(f"Fetching DATABASE_URL from Heroku app: {app_name} ...")
    try:
        result = subprocess.run(
            ["heroku", "config:get", "DATABASE_URL", "-a", app_name],
            capture_output=True,
            text=True,
            check=True,
        )
        url = result.stdout.strip()
        if not url:
            print(
                f"ERROR: DATABASE_URL is empty for app '{app_name}'. "
                "Check the app name and that the Postgres addon is attached.",
                file=sys.stderr,
            )
            sys.exit(1)
        return url
    except subprocess.CalledProcessError as exc:
        print(f"ERROR: Could not fetch DATABASE_URL: {exc}", file=sys.stderr)
        sys.exit(1)


def open_connection(db_url: str):
    import psycopg2

    parsed = urlparse(db_url)
    return psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        database=parsed.path[1:],
        user=parsed.username,
        password=parsed.password,
        sslmode="require",
    )


def export_query_to_csv(conn, query: str, output_path: Path, label: str) -> int:
    """Execute *query*, stream results to *output_path*, return row count."""
    total = 0
    with conn.cursor() as cur:
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
    return total


# ---------------------------------------------------------------------------
# SQL queries
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
    cp.child_ai_use_contexts::text,
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
    ms.strategies::text,
    ms.custom_instructions::text,
    ms.highlighted_texts::text,
    ms.refactored_response,
    ms.session_metadata::text,
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
LEFT JOIN "user"         u  ON ms.user_id   = u.id
LEFT JOIN child_profile  cp ON ms.child_id  = cp.id
ORDER BY ms.user_id, ms.child_id, ms.scenario_index,
         ms.attempt_number, ms.version_number;
"""

EXIT_QUERY = """
SELECT
    eq.id,
    eq.user_id,
    eq.child_id,
    eq.answers::text,
    eq.score::text,
    eq.meta::text,
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
        pattern_archive = str(data_exports_root / "ARCHIVE" / "*" / "analysis_*.ipynb")
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
        description="Export study data from a Heroku Postgres app."
    )
    parser.add_argument(
        "--app",
        default=DEFAULT_APP,
        help=f"Heroku app name (default: {DEFAULT_APP})",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory path (default: data-exports/<timestamp>)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    app_name: str = args.app

    ts = timestamp()
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    data_exports_root = repo_root / "data-exports"

    export_dir = Path(args.output_dir) if args.output_dir else data_exports_root / ts
    export_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"  Heroku data export")
    print(f"  App:        {app_name}")
    print(f"  Output dir: {export_dir}")
    print("=" * 60)

    check_heroku_auth()

    if not ensure_psycopg2():
        sys.exit(1)

    db_url = get_database_url(app_name)

    print("Connecting to Postgres ...")
    try:
        conn = open_connection(db_url)
    except Exception as exc:
        print(f"ERROR: Failed to connect to database: {exc}", file=sys.stderr)
        sys.exit(1)
    print("Connected.\n")

    # Define each export: (label, query, filename_prefix)
    exports = [
        ("users",                USER_QUERY,            "users_export"),
        ("child_profiles",       CHILD_QUERY,           "child_profiles_export"),
        ("scenarios",            SCENARIOS_QUERY,       "scenarios_export"),
        ("moderation_sessions",  MOD_QUERY,             "moderation_sessions_export"),
        ("exit_quiz_responses",  EXIT_QUERY,            "exit_quiz_responses_export"),
        ("assignment_time",      ASSIGNMENT_TIME_QUERY, "assignment_time_export"),
    ]

    results: list[tuple[str, Path, int]] = []

    try:
        for label, query, prefix in exports:
            csv_path = export_dir / f"{prefix}_{ts}.csv"
            print(f"Exporting {label} -> {csv_path.name}")
            row_count = export_query_to_csv(conn, query, csv_path, label)
            results.append((label, csv_path, row_count))
    except Exception as exc:
        print(f"\nERROR during export: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        try:
            conn.close()
        except Exception:
            pass

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
