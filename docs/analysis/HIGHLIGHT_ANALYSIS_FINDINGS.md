# DSL KidsGPT — Highlight Analysis Findings

Notebook: `stat_analysis/0_highlight_analysis.ipynb`
Dataset: pilot 9 (`data-exports/20260412_183830`), n=200 selections, n=86 sessions, n=21 parents

All outputs saved to `data-exports/20260412_183830/highlight_analysis_output/`.

---

## Notebook Structure

| Cell | Label | Content |
|---|---|---|
| 0–3 | Setup | Imports, config, helpers |
| 4 | Load | All exports + coded CSVs |
| 5–6 | Metadata | Scenario enrichment; parent covariates from exit quiz |
| 7 | Filter | Approved-participant filter |
| 8 | df_session | Session-level dataframe (79 rows) |
| 9 | df_sel | Selection-level dataframe (200 rows) — core build cell |
| 10–11 | Descriptives | Session + selection summaries, histograms, frequency tables |
| 12–14 | Part 1 | Model Strategy: by prompt factors (1a), by subdomain (1c), by sentiment (1b) |
| 15–19 | Part 2 | Parent Motivation: by prompt factors (2a), by demographics (2c), by sentiment (2b) |
| 20–22 | Part 3 | Strategy × Motivation co-occurrence crosstab + logistic |
| 23–26 | Part 4 | Context effects on concern/sentiment |
| 27–34 | Part 5 | Realism invariance (7 sub-analyses) |
| 35–36 | Export | Save df_sel, frequency tables, output PNGs |

---

## Configuration Constants

| Constant | Value | Meaning |
|---|---|---|
| `ALPHA` | 0.05 | Significance threshold |
| `EQUIVALENCE_BOUND` | 0.5 | TOST bound for correlation equivalence tests |
| `VALENCE_POSITIVE_THRESHOLD` | 5 | concern_level ≥5 = positive session |
| `VALENCE_NEGATIVE_THRESHOLD` | 3 | concern_level ≤3 = negative session |
| `MIN_CODE_PREVALENCE` | 0.05 | Codes below 5% prevalence are excluded from logistic models |
| `MAX_LEVELS_FOR_HEATMAP` | 8 | Factors with >8 levels get their own full-width heatmap |

**SCENARIO_FACTORS** (used in Parts 1, 2, 4):
`age_band`, `domain`, `sensitivity_level`, `relationship_frame`, `space_type`,
`breakdown_expected`, `trait`, `trait_level`, `gender_identity`

**EXIT_QUIZ_KEYS** (demographic covariates):
`parent_gender`, `parent_age_group`, `area_of_residency`, `parent_education`,
`parent_ethnicity`, `genai_familiarity`, `genai_usage_frequency`,
`parent_internet_use_frequency`, `parenting_style`, `is_only_child`,
`child_has_ai_use`, `child_ai_use_contexts`, `parent_llm_monitoring_level`

---

## Part 1: Model Strategy

### 1a — Strategy × Prompt Factors

Chi-square summary (strategy × each SCENARIO_FACTOR) with Cramér's V as effect size.
Reference levels: `domain=Casual Knowledge`, `age_band=9-12`, `sensitivity_level=available`,
`relationship_frame=tool`, `space_type=shared_family_space`, `breakdown_expected=no`,
`trait_level=low`, `gender_identity=boy`.

A `safe_ref()` helper falls back to the most-common level when a factor has no entry in
`REFERENCE_LEVELS` (e.g., `trait`).

**Heatmap grid**: factors with ≤8 unique levels are shown in a 3-column grid; high-cardinality
factors (e.g., `trait`) get a separate full-width heatmap saved individually.

**Per-code logistic**: for each code with ≥5% prevalence, a binomial logistic regression
is fit with all usable prompt factors as predictors. Significant ORs (p<0.05) are displayed.

### 1c — Strategy × Subdomain

Extends 1a with a subdomain-specific analysis:
- Chi-square + Cramér's V for the full strategy × subdomain table
- Observation counts by domain × subdomain (to flag sparse cells)
- Full heatmap: all subdomains ordered by parent domain
- Faceted heatmaps: one panel per domain (Casual Knowledge / Relationship / Academic)

Output: `model_strategy_by_subdomain.png`, `model_strategy_by_subdomain_faceted.png`

### 1b — Strategy × Sentiment

Mean highlight sentiment by model_strategy with 95% CIs, plus individual sentiment
distributions per code as violin/strip plots.

---

## Part 2: Parent Motivation

### 2a — Motivation × Prompt Factors

Same structure as 1a but for parent_motivation codes (which are multi-valued per selection;
the dataframe is exploded before analysis). Chi-square summary with Cramér's V, heatmap
grid, per-code logistic.

### 2c — Motivation × Demographics

Chi-square + Cramér's V for each exit-quiz demographic covariate against motivation codes.
Filters to demo columns with ≥10 non-null values and ≥2 unique levels. Heatmap grid and
per-code logistic using most-common level as reference (no REFERENCE_LEVELS for demographics).

Output: `parent_motivation_by_demographics.png`

### 2b — Motivation × Sentiment

Mean highlight sentiment by motivation code with 95% CIs.

---

## Part 3: Strategy × Motivation Co-occurrence

### 3a — Crosstab

Counts and row-percentage crosstab of model_strategy × parent_motivation. Shows which
motivations co-occur most with each strategy.

Output files: `strategy_x_motivation_crosstab.csv`, `strategy_x_motivation_crosstab_pct.csv`

### 3b — Logistic

For each motivation code, logistic regression: `P(motivation=X) ~ model_strategy`.
Reports significant ORs at α=0.05.

---

## Part 4: Context Effects on Concern Intensity

### 4a — Session-level (concern_level ~ scenario factors)

Mixed-effects or OLS regression of `concern_level` on all SCENARIO_FACTORS with
reference-level treatment coding. Significant coefficients are sorted by |coef| and
displayed. A grid of mean concern bar charts per factor is saved.

### 4b — Selection-level (highlight_sentiment ~ scenario factors)

Same structure as 4a on `highlight_sentiment`. Adds a `sentiment_by_all_factors.png`
bar-chart grid.

---

## Part 5: Realism Invariance

Seven sub-analyses testing whether scenario realism confounds ratings.

### Key Statistics (computed from pilot 9 data)

**Realism distribution (5a)**
- n=77 sessions with realism ratings; mean=5.82, SD=1.35, median=6
- 88% rated ≥5 (high realism); only 9% (n=7) rated ≤3 (low realism)
- 3 scenarios with mean realism ≤2.5 (flagged as outliers)
- Distribution is severely right-skewed — statistical comparisons involving the low-realism
  group are underpowered

**Session-level correlations (5b)**

| Statistic | Value | Interpretation |
|---|---|---|
| Pearson r | 0.244 (p=0.033) | Small positive, significant |
| Spearman ρ | 0.352 (p=0.002) | Consistent, slightly stronger |
| Bootstrap 95% CI | [0.030, 0.475] | Excludes zero |
| Cohen's d (hi vs lo) | 0.664 | Medium — but based on 7 low-realism sessions |
| TOST (bound ±0.5) | p=0.005, equivalent | Rules out very large effects |

**Selection-level correlations (5c)**

| Statistic | Value |
|---|---|
| Pearson r | 0.338 (p<0.001) |
| Spearman ρ | 0.426 (p<0.001) |
| Bootstrap 95% CI | [0.200, 0.485] |
| TOST | p=0.003, equivalent |

Selection-level association is stronger and more precise than session-level.
Higher realism → higher highlight sentiment (more positive/appropriate ratings).
One interpretation: when a scenario feels realistic, parents evaluate the AI response
as contextually fitting, inflating positive ratings.

**Realism by scenario factors (5d)**

| Factor | ANOVA F | p |
|---|---|---|
| Domain | 1.08 | 0.345 |
| Age band | 2.01 | 0.120 |

Realism does not vary systematically by domain or age band. This blocks the primary
confounding pathway.

**Partial correlation (5e)**

| Level | Raw r | Partial r (| domain, age) | p |
|---|---|---|---|
| Session | 0.244 | 0.250 | 0.034 |
| Selection | 0.338 | 0.339 | <0.001 |

Partial correlations are essentially unchanged after removing domain and age-band variance.
The realism–outcome association is not mediated by design factors; it is an independent
association.

**Sensitivity analysis (5f)**

| Sample | chi² | p | Cramér's V |
|---|---|---|---|
| Full (n=184) | 52.96 | <0.001 | 0.379 |
| Realism >3 (n=172) | 53.58 | <0.001 | 0.395 |

Excluding low-realism sessions marginally strengthens the domain × strategy effect.
Mean sentiment by domain shifts by ≤0.07 points. Key findings are robust.

### Interpretation Summary

- **Realism has a small, real, positive effect on ratings** (r≈0.24–0.34). This cannot
  be dismissed as noise; the bootstrap CIs exclude zero and partial correlations are stable.
- **Realism does not confound domain or strategy effects.** It is evenly distributed across
  design cells (ANOVA p>0.10) and excluding low-realism sessions does not change the
  main chi-square findings.
- **Practical limitation:** With only n=7 low-realism sessions, all high-vs-low comparisons
  are fragile. The stronger claim is: within the realistic range that covers 91% of data,
  realism variation does not explain domain or strategy differences.
- **Recommended framing for write-up:** Realism is a positive correlate of ratings
  (plausibly reflecting heightened engagement with more realistic scenarios), but does not
  act as a confounder of the design-factor effects of primary interest.

---

## Cramér's V Interpretation Guide

Cramér's V ranges 0–1 and measures association strength independent of table size.
Benchmarks for tables with more than 2 rows or columns:

| V | Strength |
|---|---|
| < 0.10 | Negligible |
| 0.10 – 0.20 | Weak |
| 0.20 – 0.40 | Moderate |
| > 0.40 | Strong |

Note: V is sensitive to table dimensions. A 9×4 table naturally has lower V than a 2×2
table at the same level of association. Do not compare V values across tables with very
different shapes. For individual code effects, the per-code logistic OR/p is more precise
than V.

---

## Output Files

| File | Description |
|---|---|
| `df_sel.csv` | 200-row analysis dataframe (primary output) |
| `model_strategy_freq.csv` | Strategy frequency table |
| `parent_motivation_freq.csv` | Motivation frequency table |
| `strategy_x_motivation_crosstab.csv` | Co-occurrence counts |
| `strategy_x_motivation_crosstab_pct.csv` | Co-occurrence row % |
| `highlight_analysis_summary.txt` | Key counts |
| `model_strategy_by_all_factors.png` | Strategy × prompt factors heatmap grid |
| `model_strategy_by_subdomain.png` | Strategy × subdomain (all) |
| `model_strategy_by_subdomain_faceted.png` | Strategy × subdomain per domain |
| `parent_motivation_by_all_factors.png` | Motivation × prompt factors heatmap grid |
| `parent_motivation_by_demographics.png` | Motivation × demographics heatmap grid |
| `sentiment_by_all_factors.png` | Mean sentiment bar charts per scenario factor |
| `realism_distribution.png` | Session-level realism histogram + per-scenario CI plot |
| `realism_vs_concern_session.png` | Scatter: realism × concern (session) |
| `realism_vs_sentiment_selection.png` | Scatter: realism × sentiment (selection) |
| `realism_by_scenario_factors.png` | Realism boxplots by domain + age band |
