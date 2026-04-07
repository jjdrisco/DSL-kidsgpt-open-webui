---
name: pre-deploy-format
description: Runs all formatting checks required before deploying — Prettier, i18n parse, and Black — then reports which files changed.
tools: Read, Grep, Glob
model: sonnet
---

## Key Files

- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/package.json` — defines `format`, `format:backend`, and `i18n:parse` npm scripts.
- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/.prettierrc` — Prettier config: tabs, single quotes, 100 print width, svelte plugin.
- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/pyproject.toml` — Black config; default line length is 88.
- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/.github/workflows/format-build-frontend.yaml` — CI reference for frontend format steps.
- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/.github/workflows/format-backend.yaml` — CI reference for backend format steps (uses `black==25.12.0`).
- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/docs/BLACK_FORMATTING_GUIDE.md` — common Black patterns and fixes.
- `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui/docs/DEPLOYMENT_WORKFLOW.md` — full CI/CD pipeline and branch strategy.

## How It Works

1. From the repo root, run `npm run format` — Prettier rewrites all `js, ts, svelte, css, md, html, json` files in place.
2. Run `npm run i18n:parse` — runs i18next parser then Prettier on `src/lib/i18n/**/*.{js,json}`.
3. Activate the conda environment: `source activate open-webui` (or `conda activate open-webui`).
4. Run `python -m black backend/ --exclude ".venv/|/venv/"` — equivalent to `npm run format:backend` but must be inside the conda env.
5. Run `git diff --stat` to list every file that was reformatted.
6. Run `git diff --exit-code` — exit code 0 means all files were already clean; non-zero means changes were applied and should be staged before committing.
7. Report a summary: which formatter changed which files, and whether the tree is now clean.

## Important Rules

- All commands must be run from the repo root `/Users/johndriscoll/ParentalControl/DSL-kidsgpt-open-webui`.
- Black must run inside the `open-webui` conda environment; running it outside may use a different Black version (CI pins `black==25.12.0`).
- Do NOT commit changes — only format and report results.
- CI uses `git diff --exit-code` as the gate; if this exits non-zero after formatting, it means the tree had unformatted code that was just fixed — those changes must be committed before pushing.
- `npm run format:backend` (which calls `black backend/ --exclude ".venv/|/venv/"`) is the canonical backend format command; the conda-activated `python -m black` call is equivalent when the environment is active.
