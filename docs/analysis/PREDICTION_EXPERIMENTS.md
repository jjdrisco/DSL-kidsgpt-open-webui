# DSL KidsGPT — Span Selection Prediction Experiments (`pilot_3_prediction`)

Two-stage pipeline predicting which AI-response sentences a parent will highlight (Stage A)
and what concern level they will assign (Stage B). All experiments use pilot 9 data
(`data-exports/20260412_183830`), n=20 parents, n=83 (parent, scenario) pairs, n=1,612 spans.

---

## Data

| Artifact | Path | Shape | Notes |
|---|---|---|---|
| Panel + metadata | `traces/panel_meta.pkl` | 1612 × 31 | One row per sentence × parent × scenario; `y=1` if highlighted |
| Span text | `traces/span_universe_df.pkl` | 836 × 9 | Sentences indexed by `span_id`, `scenario_id`, `sent_idx` |
| Highlights (dedup) | `traces/df_sel_dedup.pkl` | 200 × 48 | One row per unique highlight; includes `rationale_text` |
| Stage A features | `traces/X_stage_a.pkl` | — | Structured features for statistical Stage A models |
| Stage B features | `traces/X_stage_b.pkl` | — | Features for concern-level prediction |
| LLM response cache | `traces/llm_selection_cache.json` | — | Keyed by `{condition}|{parent_id}|{scenario_id}` |

**Positive rate**: 10.4% (168 highlighted spans / 1,612 total). Majority-class baseline
predicts all 0: accuracy=0.896, F1-macro≈0.473.

---

## Stage A: Span Selection

Predicts `y` (binary: will this sentence be highlighted?) for each sentence in each
AI response, for each parent.

**Evaluation**: leave-one-scenario-out within each parent (each parent holds out one of
their ~5 scenarios in turn, trains/conditions on the rest).

### 1. Statistical Models (`1_regression/2_stage_a.ipynb`)

Structured features from `X_stage_a.pkl`. Evaluated with `GroupKFold(n_splits=5)`
grouped by `parent_id`.

| Model | Notes |
|---|---|
| Elastic Net | L1+L2 logistic regression |
| Bayesian Logistic Regression | Laplace prior |
| Simple Logistic Regression | No penalty, `solver='lbfgs'` |
| Decision Tree (depth-3) | `min_samples_leaf=10` |
| Decision Tree (depth-5) | `min_samples_leaf=5` |

**Key finding**: PR-AUC ≈0.33 vs majority-class baseline ≈0.10; ROC-AUC only marginally
above 0.5. None of the statistical models establish sufficient predictive signal for
stable Wave 2 hypotheses. The task is fundamentally semantic — hand-crafted structural
features do not capture why individual sentences stand out to parents.

### 2. LLM Models — Conditions (`2_llm/6_llm_selection.ipynb`)

Claude `claude-sonnet-4-6` with extended thinking (`budget_tokens=4000`, `max_tokens=5000`).
Binary output: `{"selected": [2, 5]}` → parsed into binary vector aligned with the panel.
Prompts delivered via Anthropic Message Batches API (~83 requests per condition).

**Condition definitions:**

| Condition | Examples given | Source |
|---|---|---|
| `zero_shot` | None | — |
| `global` | 6 highlights from other parents | Cross-parent pool |
| `per_parent` | All of this parent's highlights from other scenarios | Parent's own history |
| `per_parent_rationale` | Same as per_parent, but rationale-first format; system prompt asks model to adopt parent's perspective | `7_llm_rationale.ipynb` |

**System prompt framing** (`zero_shot` / `global` / `per_parent`): neutral observer —
"identify which sentences would most stand out to a parent." Highly selective; explicit
permission to select none.

**System prompt framing** (`per_parent_rationale`): perspective-taking — "study their
reasoning pattern ... thinking as this parent would, identify which sentences they would
most likely pause on." Examples lead with `Why it caught their attention:` before the
flagged sentence.

**Pooled results (leave-one-scenario-out, all parents):**

| Condition | F1-macro | Precision | Recall | Accuracy | Sel-rate |
|---|---|---|---|---|---|
| Majority baseline | 0.473 | 0.000 | 0.000 | 0.896 | 0.000 |
| zero_shot | 0.565 | 0.264 | 0.167 | 0.865 | 0.066 |
| global | 0.566 | 0.278 | 0.161 | 0.869 | 0.060 |
| per_parent | **0.595** | **0.322** | **0.220** | 0.870 | 0.071 |
| per_parent_rationale | *pending metric computation* | — | — | — | — |

Actual highlight rate: 10.4%.

**Key findings:**
- All three completed LLM conditions beat the majority-class F1-macro baseline (0.473).
- `per_parent` improves over `zero_shot` on all metrics: F1-macro +0.030, precision +0.058, recall +0.053.
- `global` examples from other parents provide negligible benefit over zero-shot, suggesting that cross-parent patterns do not transfer well.
- Per-parent improvement is heterogeneous: some parents see large F1 gains while others do not benefit, consistent with the hypothesis that highlighting behavior is idiosyncratic.
- `per_parent_rationale` batch (83 requests) completed successfully; metric computation pending.

**Cache**: `traces/llm_selection_cache.json` — 332 total entries (83 per condition × 4 conditions). Re-runs are free.

---

## Stage B: Concern-Level Prediction

Predicts concern level (ordinal, 1–5 or similar) for highlighted spans. Notebook:
`1_regression/3_stage_b.ipynb`. Validation in `4_validation.ipynb`; interpretation in
`5_interpret.ipynb`. See those notebooks for results.

---

## Notebook Map (`pilot_3_prediction/`)

| Notebook | Purpose |
|---|---|
| `1_regression/0_data_audit.ipynb` | Data integrity checks, span alignment |
| `1_regression/1_features.ipynb` | Feature engineering for Stage A + B; exports to `traces/` |
| `1_regression/2_stage_a.ipynb` | Statistical span selection models |
| `1_regression/3_stage_b.ipynb` | Ordinal concern-level prediction (Stage B) |
| `1_regression/4_validation.ipynb` | End-to-end pipeline validation |
| `1_regression/5_interpret.ipynb` | Feature importance, decision tree interpretation |
| `2_llm/6_llm_selection.ipynb` | LLM span selection: zero_shot / global / per_parent batches |
| `2_llm/7_llm_rationale.ipynb` | LLM span selection: per_parent_rationale batch; cross-condition comparison |

---

## Related Pilot Analyses

| Directory | Focus |
|---|---|
| `pilot_1_sentiment/` | Highlight sentiment (concern level) analysis and classification. Descriptive R4/R5 notebooks, LLM-coded strategy, sentiment classifiers (structured + LLM few-shot), mixed-effects models, BLUP demographics. See `docs/analysis/CLASSIFIERS.md`. |
| `pilot_2_motivation/` | Parent motivation prediction: baseline structured model, LLM zero-shot and few-shot, per-parent and per-subdomain specialization. |
| `pilot_3_prediction/` | This document. Two-stage span selection + concern-level prediction. |
