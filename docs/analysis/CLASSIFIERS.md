# DSL KidsGPT — Classifier Results

Two notebooks predict `highlight_sentiment` (1–7, where 1=negative/inappropriate
and 7=positive/appropriate) from different feature sets.

---

## Target Framings

| Task | Label | Definition |
|---|---|---|
| Binary | `y_binary` | 1 if sentiment ≥5 (positive), 0 otherwise |
| 3-bin ordinal | `y_3bin` | Low (1–3) / Mid (4–5) / High (6–7) |
| 7-class | `y_7class` | Raw 1–7 integer |

Class distribution (n=200): binary positive (≥5) = 68.5%, negative = 31.5%.
The binary baseline majority predicts all positive: F1 ≈ 0.813.

---

## Notebook 1: `stat_analysis/1_classifier_sentiment.ipynb`

Structured features only — no text content from scenarios or responses.

### Feature Groups

| Group | Features | N features |
|---|---|---|
| A | `model_strategy` one-hot (11 codes + `strategy_is_null` indicator) + `parent_motivation` one-hot (9 codes) | 22 |
| B | Scenario/prompt factors: `domain`, `age_band`, `sensitivity_level`, `relationship_frame`, `space_type`, `breakdown_expected`, `trait`, `trait_level`, `gender_identity` | 22 |
| C | Parent demographics: `parent_gender`, `parent_age_group`, `parent_education`, `parent_ethnicity`, `genai_familiarity`, `genai_usage_frequency`, `parent_internet_use_frequency`, `parenting_style` (multi-hot), `is_only_child`, `child_has_ai_use`, `child_ai_use_contexts`, `parent_llm_monitoring_level` | 36 |

**model_strategy NaN handling:** `strategy_is_null=1` indicator added for the 16 selections
where model_strategy is missing (genuine non-response highlights, not unknown).

**parenting_style** is multi-valued (";"-separated); one-hot encoded with multi-hot logic.

### Evaluation

Stratified nested k-fold cross-validation:
- Outer: 5-fold (test split)
- Inner: 3-fold (hyperparameter validation)
- `safe_cv()`: falls back to unstratified KFold when 7-class stratification fails due to sparse classes

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

Logistic Regression is best on both metrics for 3-bin ordinal.

### 7-Class Results

| Model | Weighted F1 | MAE |
|---|---|---|
| Logistic Regression | **0.600** | **0.850** |
| Naive Bayes | 0.571 | 1.105 |
| Random Forest | 0.577 | 0.820 |
| LightGBM | 0.545 | 0.895 |
| Ordinal LogReg | 0.487 | 0.915 |
| Decision Tree | 0.524 | 1.040 |

7-class is substantially harder (majority baseline F1=0.249). Logistic Regression
leads but performance is modest at this resolution.

### Feature Ablation (Random Forest, binary)

| Feature set | N features | F1 | AUC |
|---|---|---|---|
| A only | 22 | 0.866 | 0.820 |
| A + B | 44 | 0.831 | 0.826 |
| A + B + C | 80 | 0.860 | **0.876** |

Group A alone achieves the highest F1 (0.866), showing that coded behaviors and parent
motivations are the most predictive features. Adding B and C improves AUC but not F1,
suggesting scenario context and demographics add calibration without changing the
classification boundary much.

---

## Notebook 2: `stat_analysis/1_classifier_llm.ipynb`

Text-based features via sentence embeddings and direct Claude API prediction.

### Data Join

`df_sel` is joined to `moderation_sessions_export` on `scenario_id` (deduplicated,
keeping first unique `original_response` per scenario — the AI response is static
per scenario). This adds three text columns per row: `scenario_prompt`,
`original_response`, `highlight_text`.

### Approach A: Sentence Embeddings

Model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim, no API cost).

Three embedding variants:

| Variant | Input text |
|---|---|
| `emb_highlight` | `highlight_text` only |
| `emb_context` | `[SCENARIO] {scenario_prompt} [HIGHLIGHT] {highlight_text}` |
| `emb_full` | `[PROMPT] {scenario_prompt} [RESPONSE] {original_response} [HIGHLIGHT] {highlight_text}` |

PCA (50 components) inside Pipeline to prevent leakage. Arrays cached to
`classifier_output/embeddings/` as `.npy` files.

**Binary results (best per variant):**

| Model label | F1 | AUC |
|---|---|---|
| RF + PCA [emb:full] | 0.813 | 0.678 |
| LR + PCA [emb:context] | 0.819 | 0.674 |
| LightGBM + PCA [emb:full] | 0.779 | 0.649 |
| Majority Baseline | 0.813 | 0.500 |

All embedding models fail to beat the structured baseline (AUC 0.678 vs 0.876).
Short highlighted text snippets lack sufficient standalone semantic signal for a
general-purpose sentence encoder.

### Approach B: Claude Direct Prediction

Two framings:

**B-binary:** Claude classifies the highlight as positive sentiment (≥5) or negative (<5).
Returns `{"prediction": 0 or 1, "confidence": 0.0–1.0}`.

**B-rating:** Claude predicts the 1–7 rating directly.
Returns `{"rating": <integer 1-7>}`.

Both calls receive: scenario prompt, age band, domain, highlighted text, full AI response.
Prompt caching: system instructions in `cache_control` block; only per-highlight payload varies.
Results cached to `classifier_output/llm_predictions_cache.json` — re-runs load from cache.

API credentials loaded from `stat_analysis/.env`:
```
CLAUDE_API_BASE_URL=https://api.anthropic.com
CLAUDE_API_KEY=<analysis-specific key>
```

**System prompt framing (critical):** Both prompts explicitly state:
> "1 = very negative or inappropriate for the child and 7 = very positive or appropriate"

**Binary result:**

| Model | F1 | AUC |
|---|---|---|
| Claude binary prediction | 0.821 | 0.573 |
| Structured A+B+C best | 0.867 | 0.876 |

Claude zero-shot predicted positive sentiment 91% of the time (182/200), yielding low AUC
(0.573). The model struggles to distinguish negative cases without few-shot calibration.
The `confidence` field can be used as a soft score but is not well-calibrated at zero-shot.

### Consolidated Binary Results

| Approach | Best model | F1 | AUC |
|---|---|---|---|
| Structured A+B+C | SVM (linear) | 0.867 | 0.857 |
| Structured A+B+C | Random Forest | 0.860 | **0.876** |
| Sentence embeddings | LR + PCA [context] | 0.819 | 0.674 |
| Claude direct | Binary prediction | 0.821 | 0.573 |

Structured features substantially outperform both text-based approaches. This is consistent
with the design: `model_strategy` and `parent_motivation` are human-coded summaries of
exactly the content the embeddings are trying to capture — they compress the signal more
efficiently than raw text vectors.

---

## Key Conclusions

1. **Structured codes (Groups A) are the dominant predictors.** Coded model strategy and
   parent motivation alone achieve F1=0.866, AUC=0.820 — nearly matching the full A+B+C model.

2. **Scenario context (Group B) and demographics (Group C) add modest AUC improvement**
   (0.820 → 0.876) without changing the classification boundary materially.

3. **General-purpose sentence embeddings underperform.** AUC peaks at 0.678. Short highlighted
   text snippets do not carry enough semantic content for `all-MiniLM-L6-v2` to distinguish
   low- vs high-sentiment cases. Domain-specific fine-tuning or longer context windows would
   likely be needed.

4. **Zero-shot Claude binary prediction needs calibration.** The model is biased toward
   predicting positive sentiment and achieves AUC=0.573. Few-shot examples of negative cases
   would be the most direct fix.

5. **Binary framing is the most tractable.** Performance drops substantially for 3-bin
   (F1=0.831) and further for 7-class (F1=0.600), reflecting genuine label ambiguity in
   the mid-range (4–5) and the small training set.

---

## Output Files

Located in `data-exports/20260412_183830/highlight_analysis_output/classifier_output/`:

| File | Description |
|---|---|
| `cv_binary.csv` | Binary CV results, all models |
| `cv_3bin.csv` | 3-bin CV results |
| `cv_7class.csv` | 7-class CV results |
| `ablation_rf_binary.csv` | RF ablation: A / A+B / A+B+C |
| `cv_emb_binary.csv` | Embedding binary CV results |
| `cv_emb_3bin.csv` | Embedding 3-bin CV results |
| `cv_emb_7class.csv` | Embedding 7-class CV results |
| `cv_hybrid_binary.csv` | Structured + embedding combined |
| `consolidated_binary_results.csv` | All approaches in one table |
| `llm_predictions_cache.json` | Cached Claude predictions (200 binary + 200 rating) |
| `embeddings/` | Cached .npy arrays for each embedding variant |
| `confusion_matrices.png` | Confusion matrices by model |
| `feature_importance.png` | RF feature importances |
| `lr_coefficients.png` | LR coefficients plot |
| `claude_binary_confusion.png` | Claude binary confusion matrix |
| `claude_rating_scatter.png` | Claude rating vs. true rating scatter |
