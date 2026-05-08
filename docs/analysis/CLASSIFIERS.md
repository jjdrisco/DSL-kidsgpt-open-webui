# DSL KidsGPT — Classifier Results

Five notebooks predict `highlight_sentiment` (1–7, where 1=negative/inappropriate
and 7=positive/appropriate) at increasing levels of specialization.

**Execution order**: `1_classifier_feature_baseline` → `1_classifier_zero_llm` → `1_classifier_few_llm`
→ `1_per_parent` → `1_per_subdomain`. The per-parent and per-subdomain notebooks read
`cv_fewshot_binary.csv` to pick the best k automatically (fallback: k=4).

---

## Target Framings

| Task | Label | Definition |
|---|---|---|
| Binary | `y_binary` | 1 if sentiment ≥5 (positive), 0 otherwise |
| 3-bin ordinal | `y_3bin` | Low (1–3) / Mid (4–5) / High (6–7) |
| 7-class | `y_7class` | Raw 1–7 integer |
| Rating (regression) | `highlight_sentiment` | Raw 1–7 float, evaluated with MAE and Pearson r |

Class distribution (n=200): binary positive (≥5) = 68.5%, negative = 31.5%.
The binary majority baseline predicts all positive: F1 ≈ 0.813.

---

## Notebook 1: `stat_analysis/1_classifier_feature_baseline.ipynb`

Structured features only — no text content from scenarios or responses.

### Feature Groups

| Group | Features | N features |
|---|---|---|
| A | `model_strategy` one-hot (11 codes + `strategy_is_null` indicator) + `parent_motivation` one-hot (9 codes) | 22 |
| B | Scenario/prompt factors: `domain`, `age_band`, `sensitivity_level`, `relationship_frame`, `space_type`, `breakdown_expected`, `trait`, `trait_level`, `gender_identity` | 22 |
| C | Parent demographics: `parent_gender`, `parent_age_group`, `parent_education`, `parent_ethnicity`, `genai_familiarity`, `genai_usage_frequency`, `parent_internet_use_frequency`, `parenting_style` (multi-hot), `is_only_child`, `child_has_ai_use`, `child_ai_use_contexts`, `parent_llm_monitoring_level` | 36 |

**model_strategy NaN handling:** `strategy_is_null=1` indicator added for the 16 selections
where model_strategy is missing (genuine non-response highlights, not unknown).

**parenting_style** is multi-valued (";"-separated); encoded with multi-hot logic.

### Evaluation

Stratified 5-fold CV. `safe_cv()` falls back to unstratified KFold when 7-class
stratification fails due to sparse classes.

### Binary Results (full A+B+C feature set)

| Model | F1 | AUC |
|---|---|---|
| Majority Baseline | 0.813 | 0.500 |
| Logistic Regression | **0.865** | 0.858 |
| SVM (linear) | **0.867** | 0.857 |
| Random Forest | 0.860 | **0.876** |
| LightGBM | 0.839 | 0.844 |
| Decision Tree | 0.850 | 0.804 |
| Naive Bayes | 0.797 | 0.808 |

Best AUC: Random Forest (0.876 ± 0.031). Best F1: SVM linear (0.867 ± 0.043).

### 3-Bin Ordinal Results

| Model | Weighted F1 | MAE |
|---|---|---|
| Logistic Regression | **0.831** | **0.240** |
| Random Forest | 0.810 | 0.245 |
| LightGBM | 0.802 | 0.280 |
| Ordinal LogReg (mord) | 0.728 | 0.325 |
| Decision Tree | 0.721 | 0.330 |
| Naive Bayes | 0.691 | 0.465 |

### 7-Class Results

| Model | Weighted F1 | MAE |
|---|---|---|
| Logistic Regression | **0.600** | **0.850** |
| Naive Bayes | 0.571 | 1.105 |
| Random Forest | 0.577 | 0.820 |
| LightGBM | 0.545 | 0.895 |
| Ordinal LogReg | 0.487 | 0.915 |
| Decision Tree | 0.524 | 1.040 |

7-class is substantially harder (majority baseline F1=0.249). Performance is modest
at this resolution.

### Feature Ablation (Random Forest, binary)

| Feature set | N features | F1 | AUC |
|---|---|---|---|
| A only | 22 | 0.866 | 0.820 |
| A + B | 44 | 0.831 | 0.826 |
| A + B + C | 80 | 0.860 | **0.876** |

Group A alone achieves the highest F1 (0.866). Adding B and C improves AUC but not F1,
suggesting scenario context and demographics add calibration without shifting the
classification boundary much.

---

## Notebook 2: `stat_analysis/1_classifier_zero_llm.ipynb`

Text-based features via sentence embeddings and direct Claude API prediction (zero-shot).

### Data Join

`df_sel` joined to `moderation_sessions_export` on `scenario_id` (deduplicated).
Adds: `scenario_prompt`, `original_response`, `highlight_text`.

### Approach A: Sentence Embeddings

Model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim). Three input variants:

| Variant | Input |
|---|---|
| `highlight` | `highlight_text` only |
| `context` | `[SCENARIO] {scenario_prompt} [HIGHLIGHT] {highlight_text}` |
| `full` | `[PROMPT] {scenario_prompt} [RESPONSE] {original_response} [HIGHLIGHT] {highlight_text}` |

PCA (50 components) fitted inside CV fold. Arrays cached to `classifier_output/embeddings/`.

**Binary results (best per variant):**

| Model | F1 | AUC |
|---|---|---|
| RF + PCA [emb:full] | 0.813 | 0.678 |
| LR + PCA [emb:context] | 0.819 | 0.674 |
| LightGBM + PCA [emb:full] | 0.779 | 0.649 |

All embedding models fail to beat the structured baseline (AUC 0.678 vs 0.876).

### Approach B: Claude Zero-Shot Prediction

Two framings: binary (predict ≥5 vs <5) and 1–7 rating. Full scenario context given.
Prompt caching via `cache_control: ephemeral` on system instructions.
Cache: `classifier_output/llm_predictions_cache.json` — cache key format: `{task}_{row_id}`.

| Model | F1 | AUC |
|---|---|---|
| Claude zero-shot binary | 0.821 | 0.573 |
| Structured A+B+C best | 0.867 | 0.876 |

Claude predicted positive sentiment 91% of the time (182/200), yielding low AUC.
Root cause: no calibration examples — fixed by few-shot prompting (Notebook 3).

### Consolidated Binary Results (Notebooks 1–2)

| Approach | Best model | F1 | AUC |
|---|---|---|---|
| Structured A+B+C | SVM (linear) | 0.867 | 0.857 |
| Structured A+B+C | Random Forest | 0.860 | **0.876** |
| Sentence embeddings | LR + PCA [context] | 0.819 | 0.674 |
| Claude zero-shot | Binary prediction | 0.821 | 0.573 |

---

## Notebook 3: `stat_analysis/1_classifier_few_llm.ipynb`

Extends Notebook 2 with few-shot prompting to correct the zero-shot positivity bias.

### Design

**CV is manual** (5-fold): sklearn `cross_validate` cannot pass fold-specific examples
to Claude. Explicit loop over `StratifiedKFold(n_splits=5)`.

**Sampling**: for each test fold, sample `k` examples from the training fold only
(no leakage), stratified by binary class — k//2 negative/neutral (<5), k//2 positive (≥5).
This directly targets the 91% positivity bias.

**Shot counts**: k=2, 4, 8.

**Batch API**: all k values bundled into one batch (~1,200 requests). 50% cost saving at
Opus 4.7 rates. Batch ID saved to `batch_ids.json` (key `fewshot`) for recovery.

**Cache keys**: `fewshot_k{k}_fold{fold}_{task}_pos{pos}` — `pos` is the positional index
from `test_idx` (not `selection_id`, which is non-unique in `df`). Never overwrite zero-shot cache.

**Few-shot user message format:**
```
EXAMPLES (use these to calibrate your prediction of the parent's sentiment rating):

[EXAMPLE 1 — TRUE RATING: 3 (NEGATIVE/NEUTRAL (<5))]
AGE BAND: 13-15
DOMAIN: Relationship Domain
CHILD'S QUESTION: ...
FULL AI RESPONSE: ...
HIGHLIGHTED TEXT: "..."

[EXAMPLE 2 — TRUE RATING: 7 (POSITIVE (≥5))]
...

Now predict for the following new case:
AGE BAND: ...
```

System prompts are identical to zero-shot; examples go in the user message only.

### Results

**Binary classification (AUC by k):**

| k | AUC | F1 | % Predicted positive |
|---|---|---|---|
| 0 (zero-shot) | 0.573 | 0.821 | 91% |
| 2 | ~0.527 | — | 78–79% |
| 4 | ~0.561 | — | 78–79% |
| 8 | ~0.578 | — | 78–79% |

**Key finding**: Stratified few-shot examples reduce the positivity bias from 91% to
~79% but do not eliminate it. AUC improves modestly with k but never approaches the
structured baseline (0.876). Calibration via examples is insufficient for Claude to
learn the sentiment signal that structured codes capture.

**Rating task (Pearson r by k):**

| k | r | MAE |
|---|---|---|
| 2 | ~0.293 | — |
| 4 | ~0.312 | — |
| 8 | ~0.331 | — |

Rating performance is weak (r≈0.33 at best). The structural approach (Ridge on A+B+C)
substantially outperforms LLM on the regression task.

Outputs: `cv_fewshot_binary.csv`, `cv_fewshot_rating.csv` per k; `consolidated_fewshot_binary.csv`.
Best k (by AUC) is read automatically by Notebooks 4 and 5.

---

## Notebook 4: `stat_analysis/1_per_parent.ipynb`

Does knowing the **parent** improve prediction beyond the population-level model?

### Dataset facts

20 participants, 4–35 selections each (median ≈ 11). Three participants have only 4–5
selections — their per-parent AUC estimates are unreliable; interpret aggregate LOPO
metrics instead.

### Evaluation: Leave-One-Participant-Out CV (LOPO)

Train on 19 participants, test on the 20th. Repeats 20 times. Harder than standard
k-fold because the model never sees the held-out parent during training — the realistic
scenario for a new study participant.

Both binary (F1/AUC) and rating (MAE/Pearson r) tasks run in every LOPO approach.

### Part 1 — Universal structured (baseline)

Existing 80-feature Group A+B+C, LOPO-CV. Establishes the fair comparison point.

Models (binary): DummyClassifier, LogisticRegression, SVM (linear), RandomForestClassifier.
Models (rating): MeanRegressor (training mean), Ridge, RandomForestRegressor.

Outputs: `per_parent_lopo_universal.csv`, `per_parent_lopo_universal_rating.csv`.

### Part 2 — Universal + population history (Group D-parent)

Adds three aggregate statistics computed from the *training participants only*:

| Feature | Description |
|---|---|
| `hist_mean_sentiment` | Population mean of training selections' sentiment |
| `hist_pct_positive` | Fraction rated ≥5 in training set |
| `hist_strategy_entropy` | Shannon entropy of model_strategy distribution in training set |

These are population-level constants for the held-out parent's rows (their own history
is never used — that would be leakage). Because these features vary <5% across LOPO
folds (removing 1/20 participants barely shifts population statistics), linear models
assign them near-zero weight. The resulting comparison shows negligible improvement
over the baseline for Ridge/LR; RF may shift slightly.

Outputs: `per_parent_lopo_history.csv`, `per_parent_lopo_history_rating.csv`.

### Part 3 — Universal + per-participant history

Adds four features computed from the **held-out parent's own other selections** within
each fold (within-participant LOO — row i is excluded from its own feature computation):

| Feature | Description |
|---|---|
| `parent_mean_sentiment` | Mean of this parent's other selections' sentiment |
| `parent_pct_positive` | Fraction of their other selections rated ≥5 |
| `parent_strategy_entropy` | Shannon entropy of model_strategy in their other selections |
| `parent_n_prior` | Count of their other selections (0 → population fallback) |

**No leakage**: row i's own label is never used to compute row i's features.
Training participants use their complete history (all their rows are in training);
test participants use within-LOO history (all their rows minus current).

Fallback: when a participant has no other rows (n_prior=0), population training mean
is used for continuous features and 0 for count. Minimum participant size is 4 rows,
so each test row has ≥3 history rows in practice.

Feature matrix: `np.hstack([X_struct, per_participant_features])` — 80 + 4 = 84 features.

**3-way rating comparison** (base | +population history | +per-participant history):

| model | MAE (base) | r (base) | MAE (+pop) | r (+pop) | MAE (+pp) | r (+pp) |
|---|---|---|---|---|---|---|
| MeanRegressor | — | — | — | — | — | — |
| Ridge | — | — | — | — | — | — |
| RandomForest | — | — | — | — | — | — |

Outputs: `per_parent_lopo_per_participant.csv`, `per_parent_lopo_per_participant_rating.csv`,
`per_parent_rating_comparison.csv`.

### Part 4 — Parent-conditioned few-shot Claude

Examples drawn from the training pool (other 19 participants) plus the held-out
parent's **demographic profile** injected as a prompt header.

Parent profile fields: gender, age group, education, area of residency, GenAI familiarity,
LLM monitoring level, parenting style.

Cache key format: `parent_k{k}_pid{pid_idx}_{task}_pos{pos}`.
Batch ID saved to `batch_ids.json` (key `per_parent`).

Outputs: `per_parent_summary.csv` (one row per participant, all approaches),
`per_parent_aggregate.csv`, `per_parent_auc_comparison.png`, `per_parent_delta_vs_n.png`.

---

## Notebook 5: `stat_analysis/1_per_subdomain.ipynb`

Does prediction accuracy vary by **subdomain**, and can subdomain-specific modeling
improve on the universal baseline?

### Dataset facts

16 subdomains, 1–57 selections each:

| Subdomain | n | Flag |
|---|---|---|
| Human Nature | 1 | AUC undefined — excluded from LOSO |
| Politics | 4 | Sparse |
| Family | 6 | Sparse |
| STEM | 7 | Sparse |
| Internet Interaction | 9 | |
| Academic Standing | 10 | |
| Community Engagement | 10 | |
| Protective Measures | 11 | |
| Behavioral Norms | 12 | |
| Friendship | 12 | |
| Finance | 13 | |
| Self | 26 | |
| HW | 28 | |
| Health | 30 | |
| Privacy | 31 | |
| Common Sense | 57 | |

Sparse threshold: n < 5. All subdomains included; NaN AUC reported where test fold
has only one class.

### Part 1 — Universal model, per-subdomain breakdown

Standard 5-fold CV with RF; out-of-fold predictions disaggregated by subdomain post-hoc.
Shows which subdomains the universal model already handles well without any specialization.

### Part 2a — Leave-One-Subdomain-Out (LOSO) CV

Train on 15 subdomains, test on the 16th. Measures cross-subdomain generalization.
Subdomains where LOSO AUC drops sharply below universal AUC have patterns not captured
by the global feature distribution.

### Part 2b — LOSO + per-subdomain history features

Adds four within-subdomain history features (same pattern as per-participant in Notebook 4,
but grouped by subdomain):

| Feature | Description |
|---|---|
| `sd_mean_sentiment` | Mean sentiment of other selections in this subdomain |
| `sd_pct_positive` | Fraction of other subdomain selections rated ≥5 |
| `sd_strategy_entropy` | Shannon entropy of model_strategy within this subdomain |
| `sd_n_prior` | Count of other subdomain selections |

**Fallback for sparse subdomains**: when a subdomain has no other rows, falls back to
domain-level statistics (not global) — more informative for sparse subdomains that
share a domain with richer ones.

Both binary (ΔAUC comparison table) and rating (MAE/r) tasks are evaluated.

Outputs: `per_subdomain_loso_base_rating.csv`, `per_subdomain_loso_per_subdomain.csv`,
`per_subdomain_loso_per_subdomain_rating.csv`, `per_subdomain_rating_comparison.csv`.

### Part 3 — Subdomain-conditioned few-shot Claude

Few-shot examples drawn from the *same subdomain's training rows*. Sparse subdomain
fallback: if pool < k, uses same-domain examples instead. Subdomain name included as
`SUBDOMAIN CONTEXT` header in prompt.

Cache key format: `subdomain_sd{sd_idx}_k{k}_{task}_pos{pos}`.
Batch ID saved to `batch_ids.json` (key `per_subdomain`).

Outputs: `per_subdomain_fewshot.csv`, `per_subdomain_summary.csv` (all three AUC
columns + best approach flag), `per_subdomain_heatmap.png`, `per_subdomain_bar.png`.

The 3 subdomains with lowest LOSO AUC are candidates for qualitative deep-dive.

---

## Key Conclusions

1. **Structured codes (Group A) are the dominant predictors.** Coded model strategy and
   parent motivation alone achieve F1=0.866, AUC=0.820 — nearly matching the full A+B+C
   model. These codes capture what parents attend to and how they evaluate it.

2. **Scenario context (Group B) and demographics (Group C) add modest AUC improvement**
   (0.820 → 0.876) without materially shifting the classification boundary.

3. **General-purpose sentence embeddings underperform.** AUC peaks at 0.678. Short
   highlighted text snippets lack sufficient semantic content for `all-MiniLM-L6-v2`.

4. **Few-shot Claude fails to match structured models.** AUC peaks at 0.578 (k=8),
   compared to 0.876 for structured RF. Stratified examples reduce positivity bias from
   91% to ~79% but cannot eliminate it. Claude cannot infer the sentiment signal that
   structured codes make explicit — it lacks access to the underlying representation.

5. **Population-level history features add no signal for linear models.** When the
   held-out parent's rows are the test set, population features from the 19 training
   participants vary <5% across LOPO folds. Ridge and LR assign them ~zero weight.
   RF may show minor gains. These features answer "does knowing population tendencies
   help?" — the answer is largely no.

6. **Per-participant history features are the meaningful individual-level signal.** Within-
   participant LOO (using this parent's own other selections) varies per test row and
   encodes individual parent tendencies. This is the correct operationalization of
   "does knowing this parent help?" — distinct from population history.

7. **Binary framing is the most tractable.** Performance drops for 3-bin (F1=0.831)
   and further for 7-class (F1=0.600), reflecting genuine label ambiguity in the
   mid-range and small training set.

8. **Parent motivation is sentiment-neutral.** The same motivation code (e.g., "Response
   Risk Awareness") spans the full 1–7 sentiment range. Predicting sentiment alone
   loses thematic content; predicting motivation alone loses valence. A complete
   characterization of parent rationale requires joint prediction of motivation + sentiment.

---

## Shared Infrastructure

**Model**: all Claude calls use `claude-opus-4-7`.

**Batch API**: notebooks 3–5 use the Anthropic Message Batch API (50% cost reduction).
Each notebook follows a 4-phase workflow:

| Phase | Action |
|---|---|
| 1 Prepare | Build request objects for all uncached (fold/participant/subdomain, row, task) pairs |
| 2 Submit | `client.messages.batches.create(requests=...)` — batch ID saved to `batch_ids.json` |
| 3 Poll | `client.messages.batches.retrieve(batch_id)` every 30s until `processing_status == 'ended'` |
| 4 Evaluate | Read from cache; no API calls — fully re-runnable |

The poll cell recovers `batch_id` from `batch_ids.json` if the notebook is restarted
mid-run. Batch IDs are keyed by notebook: `fewshot`, `per_parent`, `per_subdomain`.

**Shared prediction cache**: all Claude-based notebooks append to a single
`llm_predictions_cache.json`. Key namespacing prevents collisions.

**Cache key formats** (all use positional index `pos` from `test_idx`, not `selection_id`
which is non-unique in `df`):

| Notebook | Key prefix |
|---|---|
| `1_classifier_zero_llm` | `binary_{row_id}`, `rating_{row_id}` |
| `1_classifier_few_llm` | `fewshot_k{k}_fold{fold}_{task}_pos{pos}` |
| `1_per_parent` | `parent_k{k}_pid{pid_idx}_{task}_pos{pos}` |
| `1_per_subdomain` | `subdomain_sd{sd_idx}_k{k}_{task}_pos{pos}` |

**Feature engineering**: `build_structured_features()` (Groups A+B+C, 80 features) is
replicated in each notebook that needs structured features. All use the same column
set and encoding logic as `1_classifier_feature_baseline.ipynb`.

**Data join**: all LLM notebooks join `df_sel` to `moderation_sessions_export` on
`scenario_id` to retrieve `scenario_prompt` and `original_response`.

---

## Output Files

All files in `data-exports/20260412_183830/highlight_analysis_output/classifier_output/`:

| File | Notebook | Description |
|---|---|---|
| `cv_binary.csv` | 1_feature_baseline | Binary CV results, all models |
| `cv_3bin.csv` | 1_feature_baseline | 3-bin CV results |
| `cv_7class.csv` | 1_feature_baseline | 7-class CV results |
| `ablation_rf_binary.csv` | 1_feature_baseline | RF ablation: A / A+B / A+B+C |
| `cv_emb_binary.csv` | 1_zero_llm | Embedding binary CV results |
| `cv_emb_3bin.csv` | 1_zero_llm | Embedding 3-bin CV results |
| `cv_emb_7class.csv` | 1_zero_llm | Embedding 7-class CV results |
| `cv_hybrid_binary.csv` | 1_zero_llm | Structured + Claude rating combined |
| `consolidated_binary_results.csv` | 1_zero_llm | Notebooks 1–2 in one table |
| `llm_predictions_cache.json` | all | Shared cache for all Claude calls |
| `batch_ids.json` | 1_few_llm, 1_per_parent, 1_per_subdomain | Recovery file: batch IDs keyed by `fewshot`, `per_parent`, `per_subdomain` |
| `embeddings/` | 1_zero_llm | Cached .npy arrays per embedding variant |
| `cv_fewshot_binary.csv` | 1_few_llm | Few-shot binary results per k |
| `cv_fewshot_rating.csv` | 1_few_llm | Few-shot rating results per k |
| `consolidated_fewshot_binary.csv` | 1_few_llm | Notebooks 1–3 in one table |
| `fewshot_confusion_matrices.png` | 1_few_llm | Confusion matrices for k=2,4,8 |
| `fewshot_prediction_distribution.png` | 1_few_llm | Prediction class counts by k |
| `per_parent_lopo_universal.csv` | 1_per_parent | Universal model LOPO binary results |
| `per_parent_lopo_universal_rating.csv` | 1_per_parent | Universal model LOPO rating results |
| `per_parent_lopo_history.csv` | 1_per_parent | Universal + population history LOPO binary |
| `per_parent_lopo_history_rating.csv` | 1_per_parent | Universal + population history LOPO rating |
| `per_parent_lopo_per_participant.csv` | 1_per_parent | Per-participant history LOPO binary |
| `per_parent_lopo_per_participant_rating.csv` | 1_per_parent | Per-participant history LOPO rating |
| `per_parent_rating_comparison.csv` | 1_per_parent | 3-way rating comparison: base / +pop / +pp |
| `per_parent_summary.csv` | 1_per_parent | Per-participant AUC: all approaches |
| `per_parent_aggregate.csv` | 1_per_parent | Aggregate LOPO comparison table |
| `per_parent_auc_comparison.png` | 1_per_parent | Bar chart: universal vs. few-shot per parent |
| `per_parent_delta_vs_n.png` | 1_per_parent | AUC delta vs. n_selections scatter |
| `per_subdomain_universal.csv` | 1_per_subdomain | Universal model per-subdomain breakdown |
| `per_subdomain_loso.csv` | 1_per_subdomain | LOSO binary results per subdomain |
| `per_subdomain_loso_base_rating.csv` | 1_per_subdomain | LOSO base rating results |
| `per_subdomain_loso_per_subdomain.csv` | 1_per_subdomain | LOSO + per-subdomain history binary |
| `per_subdomain_loso_per_subdomain_rating.csv` | 1_per_subdomain | LOSO + per-subdomain history rating |
| `per_subdomain_rating_comparison.csv` | 1_per_subdomain | Rating comparison: base vs. +subdomain history |
| `per_subdomain_fewshot.csv` | 1_per_subdomain | Few-shot LOSO results per subdomain |
| `per_subdomain_summary.csv` | 1_per_subdomain | All three AUC columns + best approach flag |
| `per_subdomain_heatmap.png` | 1_per_subdomain | 16-subdomain × 3-approach AUC heatmap |
| `per_subdomain_bar.png` | 1_per_subdomain | Bar chart per subdomain |
| `confusion_matrices.png` | 1_feature_baseline | Confusion matrices (LR, binary + 3-bin) |
| `feature_importance.png` | 1_feature_baseline | RF + LightGBM top-20 importances |
| `lr_coefficients.png` | 1_feature_baseline | LR coefficients (positive vs. negative) |
| `claude_binary_confusion.png` | 1_zero_llm | Claude zero-shot binary confusion |
| `claude_rating_scatter.png` | 1_zero_llm | Claude zero-shot rating vs. true scatter |
