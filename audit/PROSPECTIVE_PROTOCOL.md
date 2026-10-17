# Formal Scientific Protocol for Prospective Jackpot Evaluation (Version 1.4.0)

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
2. **Checkpoint Classification (Not Automatic Terminal Proof):**
   * Because 12/12 jackpot events are rare ($\approx 1.5 \times 10^{-5}$ per 8-line portfolio), 50 rounds evaluates consolation prize viability and prediction skill with high statistical power, but cannot fully observe the extreme jackpot tail.
   * At the 50-round mark, outcomes are classified as:
     * **Class A (Positive Edge):** Gate 1 and Gate 2 both pass with 95% bootstrap CI lower bound $> 0$.
     * **Class B (Definitively Negative):** Prediction skill fails to offset negative-sum takeout; consolation payouts cannot sustain ticket costs. Real stakes remain ₦0.
     * **Class C (Inconclusive on Jackpot Tail):** Consolation returns are negative, but model estimates positive tail EV that cannot be confirmed without a multi-year cohort. **Stakes remain strictly at ₦0.**
3. **Strict Slot Consumption Rules:**
   * **Settled Round:** Fixtures played to regulation. Consumes 1 slot. Counted in both accuracy and financial outcomes.
   * **Void Round:** Fixture(s) abandoned, postponed past 48 hours, or cancelled by the operator. Consumes 1 slot. ₦800 stake is recorded as **refunded capital** (net capital outflow = ₦0, gross payout = ₦0). Excluded from paired accuracy $t$-test.
   * **Skipped Round:** Discretionary skipping after seeing match fixtures is strictly prohibited. If a technical outage prevents entry, an explicit justification must be logged before deadline. Consumes 1 slot (₦0 stake, ₦0 payout).
4. **Prohibition of Optional Stopping:** The trial cannot be terminated early due to temporary favorable returns or halted due to intermediate drawdowns. All 50 slots must be consumed before certification.

---

## 4. Canonical Commitment Hashing & Tamper-Evident Verification

To guarantee that predictions cannot be altered or retrofitted post-kickoff:

1. **Full Canonical Serialization:** The SHA-256 fingerprint encompasses the complete experimental commitment:
   * `protocolVersion` ("1.4.0")
   * `roundId` (period number)
   * `deadline` (timestamp)
   * `gitCommit` (short commit SHA)
   * `strategy` ("BALANCED_COVER")
   * `frozenBeamWidth` (2000)
   * `frozenConstraints` (draws, homes, distance bounds)
   * `scoringRules` ("SPORTYBET_SUPER_12_PARIMUTUEL")
   * `stake` (800)
   * `tickets` (8 strategy lines)
   * `pairedBaselineTickets` (8 deterministically seeded random lines)
2. **Pre-Kickoff External Timestamping:**
   * The registered record is committed to `audit/prospective_ledger.json` and pushed to `origin/main` on GitHub prior to the scheduled kickoff time of the earliest match.
   * The public Git commit SHA and GitHub commit timestamp serve as external, third-party proof of pre-kickoff commitment.
3. **Settlement Verification Gate:**
   * When `scripts/prospective_jackpot_tracker.mjs settle <roundId>` is invoked, the engine recomputes the canonical hash from the ledger entry and asserts bit-for-bit equivalence against the stored `sha256`. Any discrepancy aborts settlement immediately.

---

## 5. Explicit Commercial Gates & Decision Architecture

Experimental validity and commercial profitability are decoupled into two distinct sequential gates:

### Gate 1 — Scientific & Prediction Integrity (Robustness & Multi-Testing Control)
* **Scope:** Verification that predictions are genuinely prospective, tamper-evident, and statistically superior to chance.
* **Requirements:**
  1. **Strict Pre-Kickoff Commitment:** Canonical SHA-256 hash committed to `origin/main` before kickoff.
  2. **Primary Benchmark & Test:** Paired Student's $t$-test (df = 49) and 10,000-iteration sign-flip permutation test against deterministic PRNG baseline (`periodNumber + 1337`).
  3. **Probabilistic Scoring:** Multi-class Brier Score ($BS$) and Log Loss ($LL$) evaluated against closing pre-match devigged probabilities.
  4. **Multiple Testing Correction:** When testing $K$ strategies simultaneously (`BALANCED_COVER`, `CONTRARIAN_HIGH_EV`), apply **Holm-Bonferroni step-down correction** to maintain family-wise error rate at $\alpha = 0.05$.
* **Significance:** Passing Gate 1 proves predictive skill exists beyond chance, but **does not prove commercial profitability**.

### Gate 2 — Commercial Viability & Expected Net Profitability
* **Scope:** Demonstration of repeatable, positive expected net return after accounting for operator takeout, ticket costs, and parimutuel prize dilution.
* **Requirements:**
  1. **Complete Payout Distribution Model:** Expected net value must account for the full 13-state score distribution:
     $$E[\text{Net}] = \sum_{j=0}^{12} P(\text{score} = j) \times E[\text{Payout} \mid j] - \text{Ticket Costs}$$
     where for $j < 10$, $E[\text{Payout} \mid j] \equiv 0$. Probabilities $P(j)$ and conditional dilution expectations $E[\text{Payout} \mid j]$ must be estimated strictly ex-ante using pre-match odds and crowd competition models, with zero post-hoc tuning.
  2. **Uncertainty Quantification:** Realized net return must be evaluated with full confidence bounds (95% bootstrap confidence interval on cumulative net return). A single lucky win or point estimate $> 0$ does not satisfy Gate 2 if the lower confidence bound is deeply negative.
  3. **Settlement Rule Verification:** Consolation funding allocations (12% for 11/12, 3% for 10/12) and zero-winner rollover rules must be verified against official written SportyBet terms, distinguishing confirmed operator payouts from theoretical simulation models.
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
2. **Jackpot Tail Skewness:** The theoretical probability of hitting a 12/12 Super Jackpot with 8 tickets on an individual round is $\approx 1.5 \times 10^{-5}$. Across 50 rounds, the cumulative probability of observing a 12/12 hit is $< 0.1\%$.
3. **Settlement Model Status:**
   * **Tier 1 (Empirically Confirmed):** Rounds in `public/data/sportybet_history.json` where public winners existed reflect actual official SportyBet cash settlements.
   * **Tier 2 (Unverified Assumption / Counterfactual):** Zero-winner consolation pool treatment (whether 11/12 or 10/12 pools roll over, are retained by operator, or absorbed into 12/12) remains an unverified hypothesis pending written operator terms. All reported payouts depending on this assumption are explicitly tagged as `UNVERIFIED_COUNTERFACTUAL`.
   * **Tier 3 (Operator Takeout Bounds):** Modeled house rake is bounded between $25\%$ and $30\%$.
4. **Commercial Decision Rule:**
   * Gate 1 Fail $\rightarrow$ Prediction model has no edge.
   * Gate 1 Pass + Gate 2 Fail $\rightarrow$ Prediction edge exists, but house rake and crowd sharing make real betting negative-EV. **Real stakes remain strictly at ₦0.**
   * Gate 1 Pass + Gate 2 Inconclusive $\rightarrow$ Tail EV cannot be certified without larger sample. **Real stakes remain strictly at ₦0.**
   * Gate 1 Pass + Gate 2 Pass $\rightarrow$ Potential commercial deployment authorized under strict Kelly-fraction bankroll limits.

