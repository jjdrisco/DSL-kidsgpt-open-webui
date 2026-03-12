---
name: data-analyst
description: Data analysis for the DSL KidsGPT Prolific study. Use when exporting, loading, or analyzing participant data from moderation sessions, child profiles, assignment timings, or exit-survey responses.
tools: Read, Grep, Glob, Bash
model: sonnet
---

## Key Files

- `scripts/export_local_data.py` — Exports all tables from `backend/data/webui.db` to a timestamped `data-exports/<YYYYMMDD_HHMMSS>/` folder and copies the latest analysis notebook.
- `scripts/export_heroku_data.py` — Same export from a Heroku Postgres instance (uses `DATABASE_URL` env var).
- `data-exports/<timestamp>/analysis_<timestamp>.ipynb` — Analysis notebook; auto-detects the export timestamp from CSV filenames in its directory.
- `data-exports/<timestamp>/moderation_sessions_export_<timestamp>.csv` — Core table: one row per scenario attempt per participant. Key columns: `user_id`, `prolific_pid`, `child_id`, `scenario_id`, `attempt_number`, `session_number`, `concern_level`, `concern_reason`, `highlighted_texts`, `strategies`, `satisfaction_level`, `initial_decision`, `is_final_version`, `is_attention_check`, `attention_check_passed`.
- `data-exports/<timestamp>/assignment_time_export_<timestamp>.csv` — Per-scenario time-on-task. Key columns: `user_id`, `assignment_id`, `total_time_seconds`, `active_time_seconds`.
- `data-exports/<timestamp>/child_profiles_export_<timestamp>.csv` — Participant-reported child characteristics (`child_age`, `child_gender`, `child_characteristics`).
- `data-exports/<timestamp>/exit_quiz_responses_export_<timestamp>.csv` — Post-task exit survey answers.
- `data-exports/<timestamp>/scenarios_export_<timestamp>.csv` — Scenario bank metadata (domain, polarity, trait).

## How It Works

1. Run `python scripts/export_local_data.py` (local) or `python scripts/export_heroku_data.py` (Heroku) to produce a fresh timestamped export folder.
2. Open the copied notebook inside that folder — it auto-detects the timestamp and loads all CSVs.
3. The notebook filters to **Prolific participants only** (rows where `prolific_pid` is non-null) using the `users_export` to build a `prolific_user_ids` set, then subsets every dataframe.
4. Analysis sections cover: time-per-session, time distribution, attention-check pass rates, skips vs. highlighted, exit-survey summary, and highlights broken down by scenario characteristics.
5. `is_final_version=True` marks the definitive submission for each scenario; filter to this before computing per-participant statistics to avoid double-counting earlier attempts.
6. Attention checks are identified by `is_attention_check=True`; exclude these rows from moderation-quality metrics.

## Important Rules

- Always filter to `is_final_version=True` before computing moderation statistics — earlier `attempt_number` rows for the same participant + scenario are drafts.
- Prolific filter: build the allowed user-id set from `users_export` first; fall back to `moderation_sessions_export` `prolific_pid` column if the users file is missing.
- `highlighted_texts` and `strategies` are JSON strings — call `json.loads()` before counting; empty values may be `None`, `"[]"`, or `""`.
- `concern_level` is an integer 1–5 (or null when the scenario was skipped); treat nulls as skipped, not zero-concern.
- Export CSVs contain both Prolific and non-Prolific rows (admin/test accounts) — always apply the Prolific filter before analysis.
