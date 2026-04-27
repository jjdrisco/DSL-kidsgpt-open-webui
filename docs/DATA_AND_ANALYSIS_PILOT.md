# DSL KidsGPT Study — Data and Analysis Index

This document is the entry point for understanding the study data, analysis pipeline,
and current findings. Detailed documentation is in `docs/analysis/`.

---

## Quick Reference

| Document | Contents |
|---|---|
| [DATA_MODEL.md](analysis/DATA_MODEL.md) | Export files, key joins, df_sel build logic, coding pipeline, scenario pool, approved-participants filter |
| [HIGHLIGHT_ANALYSIS_FINDINGS.md](analysis/HIGHLIGHT_ANALYSIS_FINDINGS.md) | Findings from `0_highlight_analysis.ipynb`: strategy/motivation distributions, context effects, realism invariance |
| [CLASSIFIERS.md](analysis/CLASSIFIERS.md) | Results from `1_classifier_sentiment.ipynb` and `1_classifier_llm.ipynb`: structured, embedding, and LLM-based prediction |

---

## Study in One Paragraph

Parents recruited via Prolific reviewed AI-generated responses to child prompts and
highlighted text they found worth flagging, rating each highlight on a 1–7 sentiment
scale (1=negative/inappropriate, 7=positive/appropriate) and providing written rationales.
The primary dataset (pilot 9, export `20260412_183830`) covers 21 parents, 86 sessions,
and 200 unique text selections across 45 of 50 scenarios. Two qualitative codes were
applied per (highlight × rationale) pair: **Model Strategy** (what the AI did) and
**Parent Motivation** (why the parent flagged it). These codes, along with scenario
metadata and parent demographics, are the primary features used in downstream classifiers.

---

## Analysis Notebooks

| Notebook | Purpose |
|---|---|
| `stat_analysis/0_highlight_analysis.ipynb` | Main descriptive + inferential analysis — strategy/motivation distributions, context effects, realism invariance |
| `stat_analysis/0_contextual_analysis.ipynb` | Earlier session-level analysis (df_session grain) |
| `stat_analysis/1_classifier_sentiment.ipynb` | Structured-feature classifiers (Groups A/B/C) predicting highlight_sentiment |
| `stat_analysis/1_classifier_llm.ipynb` | Sentence-embedding and Claude API classifiers |

Python environment for all notebooks: `miniforge/base/envs/open-webui`

---

## Primary Dataset

```
data-exports/20260412_183830/
├── moderation_sessions_export_20260412_183830.csv
├── selections_export_20260412_183830.csv
├── concern_items_export_20260412_183830.csv
├── scenarios_export_20260412_183830.csv
├── exit_quiz_responses_export_20260412_183830.csv
├── users_export_20260412_183830.csv
├── model_strategy_for_notebook.csv          ← human-coded
├── parent_motivation_for_notebook.csv       ← human-coded
└── highlight_analysis_output/
    ├── df_sel.csv                            ← 200-row primary analysis frame
    ├── classifier_output/                    ← all classifier results + caches
    └── *.png / *.csv                         ← analysis output files
```

---

## Key Numbers

| Measure | Value |
|---|---|
| Prolific participants | 21 |
| Completed sessions | 86 |
| Unique text selections | 200 |
| Concern-item rationales | 195 |
| Scenarios covered | 45 / 50 |
| Mean highlight sentiment | 5.33 / 7 |
| Selections with model_strategy coded | 184 (92%) |
| Top model strategy | Prompted Suggestions (44.5%) |
| Top parent motivation | Response Usefulness (45.5%) |
| Best classifier AUC (binary) | 0.876 (Random Forest, structured A+B+C) |

---

## Pilot History

| Export | Label | Notes |
|---|---|---|
| `20260412_183830` | **Pilot 9 (primary)** | Full coding pipeline; all analysis uses this export |
| `20260412_180829_PILOT9` | Pilot 9 alt | Same wave, alternate export |
| `20260409_103819_PILOT8` | Pilot 8 | |
| `20260408_130919_PILOT7` | Pilot 7 | |
| `20260402_141950_PILOT6` | Pilot 6 | |
| `20260325_135722_Pilot_5` | Pilot 5 | |
| `20260315_101829_PILOT_3` | Pilot 3 | First Prolific run |
| Earlier | Dev/test | Not used in analysis |
