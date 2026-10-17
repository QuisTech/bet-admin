# Formal Scientific Protocol for Prospective Jackpot Evaluation (Version 1.6.0)

## 1. Executive Summary & Core Objective

This protocol establishes a pre-registered, prospective evaluation framework for pool betting strategies across live, untouched rounds on **SportyBet Super 12**.

The primary objective is to evaluate whether any prediction edge can overcome operator rake, ticket costs, and parimutuel prize dilution to achieve sustainably positive expected net returns—and to enforce a strict zero-stake policy (₦0 real capital at risk) until such evidence is independently demonstrated.

---

## 2. Frozen Algorithm & Parameter Specification

To eliminate post-hoc tuning, lookahead bias, and parameter cherry-picking:

* **Strategy Objective:** `BALANCED_COVER` (benchmarked against `CONTRARIAN_HIGH_EV` and `RANDOM_RUSH`)
* **Frozen Codebase Baseline:** Git commit `9a8d144` (with forward-looking macro constraint pruning)
* **Beam Search Exploration Width:** Exactly `2,000` candidate combinations
* **Fixed Portfolio Size:** Exactly `8 lines` per round (₦800 stake per slate)
* **Pre-Fixed Macro Constraints:**
  * Minimum Draws: 2 | Maximum Draws: 5
  * Minimum Homes: 3 | Maximum Homes: 9
  * Pairwise Minimum Distance: 2 to 4 picks per ticket pair

---

## 3. Predefined 50-Round Denominator & Slot Accounting

To prevent survivor bias and selective slate entry:

1. **Cohort Definition:** The prospective trial comprises a pre-registered checkpoint of **50 consecutive scheduled live rounds** of SportyBet Super 12 starting from the first registered round.
2. **Checkpoint Classification & Model-Estimated Tail Probability:**
   * Because pairwise Hamming distance $\ge 2$ ensures all 8 tickets are mutually exclusive for 12/12 on any given round, the portfolio jackpot win probability on round $r$ is:
     $$P(\text{portfolio wins 12/12}) = \sum_{t=1}^8 P(t = 12) = \sum_{t=1}^8 \prod_{m=1}^{12} p_{m, t[m]}$$
     *Critical Epistemic Caveat:* This formula strictly assumes fixture conditional independence given closing market odds and well-calibrated odds de-vigging. The resulting figure ($\approx 1.5 \times 10^{-5}$ per round) is a **model estimate**, not an empirically verified real-world frequency.
   * With an estimated win probability of $\approx 1.5 \times 10^{-5}$ per round, the cumulative probability of observing at least one 12/12 hit over 50 rounds is only $\approx 0.075\%$.
   * Consequently, a non-parametric bootstrap over 50 observed rounds cannot estimate rare jackpot contributions that never occurred in the sample. Outcomes at 50 rounds are formally classified as:
     * **Class A (Positive Edge):** Both Gate 1 and Gate 2 pass with 95% bootstrap CI lower bound $> 0$.
     * **Class B (Definitively Negative):** Prediction skill fails to offset negative-sum takeout; consolation payouts cannot sustain ticket costs. Real stakes remain ₦0.
     * **Class C (Inconclusive on Jackpot Tail):** Consolation returns are negative, and tail EV cannot be confirmed without a multi-year cohort. **Stakes remain strictly at ₦0.**
3. **Strict Slot Consumption Rules:**
   * **Settled Round:** Fixtures played to regulation. Consumes 1 slot. Counted in both accuracy and financial outcomes.
   * **Void Round:** Fixture(s) abandoned, postponed past 48 hours, or cancelled by the operator. Consumes 1 slot. ₦800 stake is recorded as **refunded capital** (net capital outflow = ₦0, gross payout = ₦0). Excluded from paired accuracy $t$-test.
   * **Skipped Round:** Discretionary skipping after seeing match fixtures is strictly prohibited. If a technical outage prevents entry, an explicit justification must be logged before deadline. Consumes 1 slot (₦0 stake, ₦0 payout).
4. **Prohibition of Optional Stopping:** The trial cannot be terminated early due to temporary favorable returns or halted due to intermediate drawdowns. All 50 slots must be consumed before certification.

---

## 4. Canonical Commitment Hashing & Tamper-Evident Verification

To guarantee that predictions cannot be altered or retrofitted post-kickoff:

1. **Full Canonical Serialization:** The SHA-256 fingerprint encompasses the complete experimental commitment:
   * `protocolVersion` ("1.6.0")
   * `roundId` (period number)
   * `deadline` (timestamp)
   * `earliestKickoff` (ISO timestamp of earliest kickoff across all 12 fixtures)
   * `oddsSource` (originating source tag, e.g. "SPORTYBET_NG_OFFICIAL_PRE_MATCH")
   * `oddsCapturedAt` (ISO timestamp of odds recording)
   * `gitCommit` (short commit SHA)
   * `strategy` ("BALANCED_COVER")
   * `frozenBeamWidth` (2000)
   * `frozenConstraints` (draws, homes, distance bounds)
   * `scoringRules` ("SPORTYBET_SUPER_12_PARIMUTUEL")
   * `stake` (800)
   * `matchOddsSnapshot` (fixture names, match numbers, closing pre-match market odds)
   * `tickets` (8 strategy lines)
   * `pairedBaselineTickets` (8 deterministically seeded random lines)
2. **Pre-Kickoff External Timestamping & Prospective Integrity:**
   * The registered record is committed to `audit/prospective_ledger.json` and pushed to `origin/main` on GitHub prior to the scheduled kickoff time of the earliest match.
   * The public Git commit SHA and GitHub commit timestamp serve as external, third-party proof of pre-kickoff commitment.
   * *Critical Epistemic Boundary on Cryptographic Proof:* A SHA-256 commitment published to GitHub proves immutability after commitment (that predictions, model inputs, timestamp, and verification procedure were not retrofitted post-kickoff). It cannot independently prove that predictions were generated without lookahead; lookahead prevention requires auditing that input odds and fixtures were pre-match and produced strictly by frozen code without retrospective knowledge.
3. **Settlement Verification Gate & Post-Registration Integrity:**
   * Immediately upon registration, the engine re-reads the committed record from disk and confirms bit-for-bit equivalence of the computed SHA-256 hash.
   * When `scripts/prospective_jackpot_tracker.mjs settle <roundId>` is invoked, the engine recomputes the canonical hash from the ledger entry and asserts bit-for-bit equivalence against the stored `sha256`. Any discrepancy aborts settlement immediately.

---

## 5. Explicit Commercial Gates & Decision Architecture

Experimental validity and commercial profitability are decoupled into two distinct sequential gates:

### Gate 1 — Scientific & Prediction Integrity (Multi-Benchmark & Multi-Testing Control)
* **Scope:** Verification that predictions are genuinely prospective, tamper-evident, and statistically superior to chance.
* **Requirements:**
  1. **Strict Pre-Kickoff Commitment:** Canonical SHA-256 hash committed to `origin/main` before kickoff.
  2. **Pre-Registered Primary Metric & Statistical Test Design:**
     * *Primary Metric:* Mean paired round difference $\Delta = \frac{1}{R} \sum_{r=1}^{R} (\bar{S}_{\text{strat}, r} - \bar{S}_{\text{base}, r})$, where $\bar{S}_r$ is the average accuracy (picks out of 12) across the 8 tickets in round $r$ on identical slates.
     * *Paired Student's $t$-test (df = 49):* Two-tailed test ($\alpha = 0.05$) assuming independent round-level paired differences approximately normally distributed by the Central Limit Theorem across 50 slates.
     * *Sign-Flip Permutation Test (10,000 iterations):* Non-parametric exact test under $H_0: \Delta = 0$ assuming exchangeability and symmetry of paired differences under the null (flipping signs of round-level differences with probability 0.5).
  3. **Secondary Benchmark & Ensemble Procedure:**
     * *Correction on Small-Sample Benchmark:* Requiring a strategy to rank above the 95th percentile of an empirical distribution generated from just 10 random seeds (or assuming $z > 1.645$) is statistically flawed because $N=10$ cannot reliably estimate extreme percentiles or reference distributions.
     * *Descriptive Spread Baseline:* The 10 pre-registered independent random seeds ($s \in \{101, 102, \dots, 110\}$, initialized as `periodNumber + s`) serve strictly as a **descriptive spread baseline** to report ensemble mean, standard error, and empirical range across rounds.
     * *Inferential Comparisons:* All inferential hypothesis tests are conducted on identical rounds to control for slate difficulty. If an inferential ensemble comparison is conducted, it requires a substantially larger pre-registered random-seed ensemble ($B \ge 1,000$ seeds or paired permutation null distribution) evaluated over the fixed 50-round horizon, reporting 95% paired confidence intervals and applying Holm-Bonferroni step-down correction across all evaluated strategies.
  4. **Effect Size & Confidence Bounds:** Must report mean paired difference in picks/ticket, Cohen's $d$, and 95% paired $t$ confidence interval.
  5. **Probabilistic Scoring:** Multi-class Brier Score ($BS$) and Log Loss ($LL$) evaluated against closing pre-match devigged probabilities.
  6. **Multiple Testing Correction:** When testing $K$ strategies simultaneously (`BALANCED_COVER`, `CONTRARIAN_HIGH_EV`), apply **Holm-Bonferroni step-down correction** to maintain family-wise error rate at $\alpha = 0.05$.
* **Significance:** Passing Gate 1 proves predictive skill exists beyond chance, but **does not prove commercial profitability**.

### Gate 2 — Commercial Viability & Expected Net Profitability
* **Scope:** Demonstration of repeatable, positive expected net return after accounting for operator takeout, ticket costs, and parimutuel prize dilution.
* **Requirements:**
  1. **Complete Payout Distribution Model:** Expected net value must account for the full 13-state score distribution:
     $$E[\text{Net}] = \sum_{j=0}^{12} P(\text{score} = j) \times E[\text{Payout} \mid j] - \text{Ticket Costs}$$
     where for $j < 10$, $E[\text{Payout} \mid j] \equiv 0$. Probabilities $P(j)$ and conditional dilution expectations $E[\text{Payout} \mid j]$ must be estimated strictly ex-ante using pre-match odds and crowd competition models, with zero post-hoc tuning.
  2. **Dilution Modeling, Probability Distributions & Stress-Testing:**
     * Expected public winners must be derived from an explicit crowd selection proxy ($Q$), not arbitrary assumptions.
     * *Caution on Stress Tests vs. Probability Distributions:* Stress-testing across three distinct public winner regimes (Solo: $W_{12} = 0$, Moderate: $W_{12} \in [1, 5]$, Heavy: $W_{12} \in [10, 50]$) provides sensitivity bounds, but these scenarios do not constitute an empirical probability distribution. Demonstrating that a strategy passes several hypothetical scenarios does not, by itself, demonstrate positive expected value. To calculate expected value, the model requires defensible estimates or conservative bounds for how likely each competing-winner count is.
  3. **Dual Uncertainty Quantification:**
     * **Consolation Tiers (10/12 and 11/12):** Evaluated via empirical 95% bootstrap confidence interval on cumulative net return over the 50 observed rounds.
     * **Jackpot Tail (12/12):** Evaluated via parametric sensitivity bounds combining exact sum-of-ticket probabilities with conservative crowd dilution scenarios. A point estimate $> 0$ does not satisfy Gate 2 if the lower confidence bound is negative.
  4. **Settlement Rule Verification:** Consolation funding allocations (12% for 11/12, 3% for 10/12) and zero-winner rollover rules must be verified against official written SportyBet terms, distinguishing confirmed operator payouts from theoretical simulation models.
* **Significance:** Passing Gate 1 is a mandatory prerequisite, but **only Gate 2 authorizes risking real capital**. If Gate 2 is not satisfied, the money-making decision is to keep stakes at ₦0.

---

## 6. Lifecycle State Machine & Idempotency Rules

Every round entry in `audit/prospective_ledger.json` follows an immutable append-only event trail:

| Event Type | Conditions & Validation | Ledger State Impact |
|---|---|---|
| **`PRE_REGISTER`** | Executed before kickoff. Uniqueness checked against existing round IDs. | Status = `PRE_REGISTERED`. Stake = ₦800 earmarked. |
| **`SETTLE`** | Executed after official results ingested. Hash verified. Idempotency guard blocks re-settlement. | Status = `SETTLED`. Capital recognized = ₦800. Payout & accuracy computed. |
| **`VOID`** | Triggered if official match is abandoned/voided. | Status = `VOID`. Stake refunded = ₦800. Net P&L = ₦0. Excluded from $t$-test. |
| **`SKIP`** | Requires pre-declared documented justification. | Status = `SKIPPED`. Stake = ₦0. Net P&L = ₦0. |
| **`CORRECT`** | Applied if operator amends settlement. | Appends to `correctionHistory` and `auditTrail`. Never overwrites original settlement record. |

---

## 7. Epistemic Scope, Payout Assumptions & Commercial Verdict

1. **Accuracy Power:** A sample of 50 rounds (400 tickets) provides $> 95\%$ statistical power to detect an accuracy improvement of $\ge 0.5$ picks/ticket at $\alpha = 0.05$.
2. **Jackpot Tail Independence & Mutual Exclusivity:** Because all 8 portfolio tickets have pairwise Hamming distance $\ge 2$, at most one ticket can score 12/12 on any given round. Portfolio jackpot probability is exactly $\sum_{t=1}^8 P(t = 12)$, which averages $\approx 1.5 \times 10^{-5}$ per slate under market odds and independence assumptions (treated as a model estimate, not a verified real-world frequency).
3. **Settlement Model Status:**
   * **Tier 1 (Empirically Confirmed):** Rounds in `public/data/sportybet_history.json` where public winners existed reflect actual official SportyBet cash settlements.
   * **Tier 2 (Unverified Assumption / Counterfactual):** Zero-winner consolation pool treatment (whether 11/12 or 10/12 pools roll over, are retained by operator, or absorbed into 12/12) remains an unverified hypothesis pending written operator terms. All reported payouts depending on this assumption are explicitly tagged as `UNVERIFIED_COUNTERFACTUAL`.
   * **Tier 3 (Operator Takeout Bounds):** Modeled house rake of $25\% - 30\%$ remains a working assumption until confirmed by operator financial disclosures.
4. **Commercial Decision Rule:**
   * Gate 1 Fail $\rightarrow$ Prediction model has no edge.
   * Gate 1 Pass + Gate 2 Fail $\rightarrow$ Prediction edge exists, but house rake and crowd sharing make real betting negative-EV. **Real stakes remain strictly at ₦0.**
   * Gate 1 Pass + Gate 2 Inconclusive $\rightarrow$ Tail EV cannot be certified without larger sample. **Real stakes remain strictly at ₦0.**
   * Gate 1 Pass + Gate 2 Pass $\rightarrow$ Potential commercial deployment authorized under strict Kelly-fraction bankroll limits.

