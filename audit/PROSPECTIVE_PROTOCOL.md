# Formal Scientific Protocol for Prospective Jackpot Evaluation (Version 1.2.0)

## 1. Executive Summary & Core Objective

This protocol establishes a pre-registered, prospective evaluation framework for the **BALANCED_COVER** pool betting strategy across live, untouched rounds on **SportyBet Super 12**.

The primary objective is to evaluate whether the historical accuracy edge (+0.836 correct picks / ticket, $p = 1.43 \times 10^{-13}$) replicates prospectively on genuinely unseen slates, and whether that accuracy edge is capable of overcoming operator rake, ticket costs, and parimutuel prize thresholds to achieve financial profitability.

---

## 2. Frozen Algorithm & Parameter Specification

To eliminate post-hoc tuning, lookahead bias, and parameter cherry-picking:

* **Strategy Objective:** `BALANCED_COVER`
* **Frozen Codebase Baseline:** Git commit `070f341` (and ancestor `fbfa5af`)
* **Beam Search Exploration Width:** Exactly `2,000` candidate combinations
* **Fixed Portfolio Size:** Exactly `8 lines` per round (₦800 stake per slate)
* **Pre-Fixed Macro Constraints:**
  * Minimum Draws: 2 | Maximum Draws: 5
  * Minimum Homes: 3 | Maximum Homes: 8
  * Pairwise Minimum Distance: 2 to 4 picks per ticket pair

---

## 3. Predefined 50-Round Denominator & Slot Accounting

To prevent survivor bias and selective slate entry:

1. **Cohort Definition:** The prospective trial comprises exactly **50 consecutive scheduled live rounds** of SportyBet Super 12 starting from the first registered round.
2. **Strict Slot Consumption Rules:**
   * **Settled Round:** Fixtures played to regulation. Consumes 1 slot. Counted in both accuracy and financial outcomes.
   * **Void Round:** Fixture(s) abandoned, postponed past 48 hours, or cancelled by the operator. Consumes 1 slot. ₦800 stake is recorded as **refunded capital** (net capital outflow = ₦0, gross payout = ₦0). Excluded from the paired accuracy $t$-test.
   * **Skipped Round:** Discretionary skipping after seeing match fixtures is strictly prohibited. If a technical outage prevents entry, an explicit justification must be logged before deadline. Consumes 1 slot (₦0 stake, ₦0 payout).
3. **Prohibition of Optional Stopping:** The trial cannot be terminated early due to temporary favorable returns or halted due to intermediate drawdowns. All 50 slots must be consumed before final verdict certification.

---

## 4. Canonical Commitment Hashing & Tamper-Evident Verification

To guarantee that predictions cannot be altered or retrofitted post-kickoff:

1. **Full Canonical Serialization:** The SHA-256 fingerprint encompasses the complete experimental commitment:
   * `protocolVersion` ("1.2.0")
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

## 5. Dual-Gate Decision Architecture & Success Criteria

Accuracy and commercial profitability are decoupled into two distinct primary outcomes:

### Primary Outcome 1: Prospective Pick Accuracy (Skill Test)
* **Null Hypothesis ($H_0$):** The mean paired accuracy difference between `BALANCED_COVER` and the paired random baseline is zero ($\mu_{\text{diff}} = 0$).
* **Alternative Hypothesis ($H_1$):** `BALANCED_COVER` achieves superior mean accuracy ($\mu_{\text{diff}} > 0$).
* **Baseline Comparator:** Deterministic PRNG Random Rush generated with seed `periodNumber + 1337`, evaluated over identical slates.
* **Gate 1 Acceptance Criteria:**
  * Primary Test: Paired Student's $t$-test achieves $p < 0.05$ (one-tailed).
  * Robustness Concurrence: 10,000 sign-flip permutation test achieves $p < 0.05$.
  * Both parametric and non-parametric tests must concur to reject $H_0$. Effect size (mean picks/ticket, Cohen's $d$, 95% CI) must be reported.

### Primary Outcome 2: Realized Financial ROI (Commercial Test)
* **Gate 2 Acceptance Criteria:** Cumulative Realized Net ROI > 0% across the 50-round sample.
* **Dual-Track Payout Accounting:**
  1. **Directly Verified Payouts:** Official cash payouts confirmed by operator results.
  2. **Counterfactually Diluted Payouts:** Payouts requiring simulated pool sharing.

### Formal Commercial Decision Rule
* **Gate 1 Pass + Gate 2 Fail:** Confirms statistically significant predictive skill, but **rejects** commercial betting viability. Proves the prediction edge is insufficient to overcome house rake and prize distribution hurdles.
* **Gate 1 Pass + Gate 2 Pass:** Certifies potential commercial viability under live conditions.
* **Gate 1 Fail:** Rejects predictive advantage; historical edge was sample-specific or overfitted.

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

## 7. Epistemic Scope & Sample Boundaries of 50 Rounds

1. **Accuracy Power:** A sample of 50 rounds (400 tickets) provides $> 95\%$ statistical power to detect an accuracy improvement of $\ge 0.5$ picks/ticket at $\alpha = 0.05$.
2. **Jackpot Tail Uncertainty:** The theoretical probability of hitting a 12/12 Super Jackpot with 8 tickets on an individual round is on the order of $1.5 \times 10^{-5}$. Across 50 rounds, the cumulative probability of observing a 12/12 hit is $< 0.1\%$.
3. **Interpretation Discipline:**
   * A negative ROI over 50 rounds proves that standard consolation prize tiers (10/12 and 11/12) are insufficient to sustain an 8-line portfolio without jackpot hits.
   * Conversely, if a single 12/12 jackpot were to occur during the 50 rounds, it must be acknowledged as an empirical sample event, not proof of permanent positive expectation.
