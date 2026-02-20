# Project Documentation

## Available Documentation

This directory contains project-specific documentation and guides:

- **[PROJECT_CONTINUATION_GUIDE.md](PROJECT_CONTINUATION_GUIDE.md)** - ⭐ **START HERE** - Comprehensive project overview, features, tokens, workflows, and quick start guide
- **[PROJECT_CONTEXT_EXPORT.md](../PROJECT_CONTEXT_EXPORT.md)** - Export of context for continuing work (Heroku, key files, debugging)
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - General contribution guidelines
- **[PULL_REQUEST_WORKFLOW.md](PULL_REQUEST_WORKFLOW.md)** - Detailed PR workflow, GitHub token setup, and troubleshooting
- **[CYPRESS_TEST_SETUP.md](CYPRESS_TEST_SETUP.md)** - Cypress testing setup and configuration
- **[README_DUMP_TRANSFORMATION.md](README_DUMP_TRANSFORMATION.md)** - How to convert database dumps into DataFrames for analysis
- **[CONTEXT_EXPORT.md](CONTEXT_EXPORT.md)** & **[CONTEXT_SUMMARY.txt](CONTEXT_SUMMARY.txt)** - Project context and notes pulled from workspace (useful for newcomers)
- **[GPT5_VALIDATION_GUIDE.md](GPT5_VALIDATION_GUIDE.md)** - Guide for ensuring moderation uses GPT‑5

> **Note:** `child_llm_scenarios.json` has been removed from the repository; scenario data is now managed via the admin UI and backend API.

- **[MODERATION_SURVEY_FLOW.md](MODERATION_SURVEY_FLOW.md)** - Moderation and survey flow documentation
- **[SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md)** - Scenario system documentation
- **[SECURITY.md](SECURITY.md)** - Security guidelines and reporting
- **[HEROKU_DEPLOYMENT.md](HEROKU_DEPLOYMENT.md)** - Heroku deployment guide, debugging history, and troubleshooting

> **Note:** additional Heroku/archived guides (404 fix, backup setup, troubleshooting) have been moved to `docs/ARCHIVE`.

### Archived / Legacy Documents

These files are no longer part of the active documentation but are kept for historical reference:

- `docs/ARCHIVE/apache.md` (legacy self‑hosted Apache/Ollama instructions)
- `docs/ARCHIVE/HEROKU_404_FIX.md` (old 404 troubleshooting, superseded by HEROKU_DEPLOYMENT)
- `docs/ARCHIVE/HEROKU_BACKUP_SETUP.md` (outdated backup notes with old app name)
- `docs/ARCHIVE/HEROKU_TROUBLESHOOTING_GUIDE.md` (merged into HEROKU_DEPLOYMENT)
- `docs/ARCHIVE/STALE_CODE_ANALYSIS.md` (internal code cleanup notes)
- `docs/ARCHIVE/SURVEY_IMPLEMENTATION_DIFFERENCES.md` (historical comparison)
- `docs/ARCHIVE/DEV_MAIN_WORKFLOW_SETUP.md` (branch workflow guide; may be outdated)
- `docs/ARCHIVE/WORKFLOW_FILE_UPDATE_INSTRUCTIONS.md` (old CI workflow tips)
- `docs/ARCHIVE/TESTING_SCENARIO_SELECTION.md` (older survey selection notes)

## Project Workflow

[![](https://mermaid.ink/img/pako:eNq1k01rAjEQhv_KkFNLFe1N9iAUevFSRVl6Cci4Gd1ANtlmsmtF_O_N7iqtHxR76ClhMu87zwyZvcicIpEIpo-KbEavGjceC2lL9EFnukQbIGXygNye5y9TY7DAZTpZLsjXXVYXg3dapRM4hh9mu5A7-3hTfSXtAtJK21Tsj8dPl3USmJZkGVbebWNKD2rNOjAYl6HJHYdkNBwNpb3U9aNZvzFNYE6h8tFiSyZzBUGJG4K1dwVwTSYQrCptlLRvLt5dA5i2la5Ruk51Ux0VKQjuxPVbAwuyiuFlNgHfzJ5DoxtgqQf1813gnZRLZ5lAYcD7WT1lpGtiQKug9C4jZrrp-Fd-1-Y1bdzo4dvnZDLz7lPHyj8sOgfg4x84E7RTuEaZt8yRZqtDfgT_rwG2u3Dv_ERPFOQL1Cqu2F5aAClCTgVJkcSrojVWJkgh7SGmYhXcYmczkQRfUU9UZfQ4baRI1miYDl_QqlPg?type=png)](https://mermaid.live/edit#pako:eNq1k01rAjEQhv_KkFNLFe1N9iAUevFSRVl6Cci4Gd1ANtlmsmtF_O_N7iqtHxR76ClhMu87zwyZvcicIpEIpo-KbEavGjceC2lL9EFnukQbIGXygNye5y9TY7DAZTpZLsjXXVYXg3dapRM4hh9mu5A7-3hTfSXtAtJK21Tsj8dPl3USmJZkGVbebWNKD2rNOjAYl6HJHYdkNBwNpb3U9aNZvzFNYE6h8tFiSyZzBUGJG4K1dwVwTSYQrCptlLRvLt5dA5i2la5Ruk51Ux0VKQjuxPVbAwuyiuFlNgHfzJ5DoxtgqQf1813gnZRLZ5lAYcD7WT1lpGtiQKug9C4jZrrp-Fd-1-Y1bdzo4dvnZDLz7lPHyj8sOgfg4x84E7RTuEaZt8yRZqtDfgT_rwG2u3Dv_ERPFOQL1Cqu2F5aAClCTgVJkcSrojVWJkgh7SGmYhXcYmczkQRfUU9UZfQ4baRI1miYDl_QqlPg)
