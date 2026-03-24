import sqlite3
from datetime import datetime, timezone

conn = sqlite3.connect("data/webui.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()


def ts(ms):
    if ms is None:
        return "None"
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime(
        "%Y-%m-%d %H:%M:%S UTC"
    )


# Attempt 11 sessions with full detail
c.execute(
    """SELECT scenario_index,
                    initial_decision, is_final_version, concern_level,
                    created_at, updated_at
             FROM moderation_session
             WHERE attempt_number=11
             ORDER BY scenario_index"""
)
rows = c.fetchall()
print("=== Attempt 11 Sessions ===")
for r in rows:
    d = dict(r)
    d["created_at"] = ts(d["created_at"])
    d["updated_at"] = ts(d["updated_at"])
    print(d)

# Check all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
all_tables = [t[0] for t in c.fetchall()]
print("\nAll tables:", all_tables)

# Workflow draft
c.execute(
    "SELECT user_id, section, progress_data, updated_at FROM workflow_draft ORDER BY updated_at DESC LIMIT 3"
)
drafts = c.fetchall()
print("\n=== Workflow Drafts ===")
for d in drafts:
    dd = dict(d)
    dd["updated_at"] = ts(dd["updated_at"])
    print(dd)

# Check exit survey-related tables
exit_tables = [t for t in all_tables if "exit" in t.lower() or "survey" in t.lower()]
print("\nExit/Survey tables:", exit_tables)
for tbl in exit_tables:
    c.execute(f"SELECT * FROM {tbl} ORDER BY rowid DESC LIMIT 3")
    rows2 = c.fetchall()
    print(f"\n--- {tbl} (recent 3) ---")
    for r in rows2:
        print(dict(r))

conn.close()
