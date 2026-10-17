# Formal Protocol for Prospective Jackpot Evaluation

## 1. Executive Summary & Objective

This protocol governs the prospective, holdout evaluation of the **BALANCED_COVER** pool betting strategy against live, unseen slates on **SportyBet Super 12** and **1xBet TOTO-14**.

The objective is to establish an unassailable empirical ledger that tests whether the historical accuracy edge (+0.836 correct picks / ticket, $p = 1.43 \times 10^{-13}$) replicates out-of-sample and whether it translates into commercial financial viability under operator rake and parimutuel prize thresholds.

---

## 2. Frozen Algorithm & Strategy Specification

To eliminate lookahead bias, parameter tuning, and post-hoc data snooping:

* **Strategy Name:** `BALANCED_COVER`
* **Baseline Engine Commit:** `fbfa5af`
* **Beam Search Width:** `2,000` candidates
* **Target Ticket Volume:** Exactly 8 lines (₦800 stake per round)
* **Macro Diversity Constraints:**
  * Minimum Draws: 2 | Maximum Draws: 5
  * Minimum Homes: 3 | Maximum Homes: 8
  * Pairwise Minimum Distance: 2 to 4 picks per ticket pair

---

## 3. Pre-Registered Hypotheses & Evaluation Metrics

Prediction accuracy and financial return are decoupled and tracked as distinct primary outcomes:

### Primary Outcome 1: Prospective Pick Accuracy
* **Null Hypothesis ($H_0$):** The mean paired accuracy difference between `BALANCED_COVER` and the deterministic random baseline is zero ($\mu_{\text{diff}} = 0$).
* **Alternative Hypothesis ($H_1$):** `BALANCED_COVER` achieves superior mean accuracy ($\mu_{\text{diff}} > 0$).
* **Baseline Comparator:** Deterministic PRNG Random Rush generated with seed `periodNumber + 1337`, evaluated on identical slates.
* **Evaluation Test:** Paired Student's $t$-test and 10,000 sign-flip permutation test at significance level $\alpha = 0.05$.

### Primary Outcome 2: Realized Financial ROI
* **Commercial Success Threshold:** Cumulative Realized Net ROI > 0%.
* **Reporting Standard:** Realized ROI is evaluated independently under:
  1. **Directly Verified Operator Payouts:** Official prize payouts documented in archive settlements.
  2. **Counterfactually Diluted Payouts:** Parimutuel share allocations where user variants enter existing winner pools.

---

## 4. Pre-Registration & Tamper-Evident Timestamping

1. **Pre-Kickoff Commitment:** Every prospective slate must be pre-registered using `scripts/prospective_jackpot_tracker.mjs register <roundPeriodNumber>` **before** the official deadline / kickoff of the earliest fixture.
2. **SHA-256 Fingerprint:** The system computes a cryptographic hash of `roundId`, `deadline`, `gitCommit`, and all 8 ticket combinations.
3. **Public External Timestamping:** The updated `audit/prospective_ledger.json` must be committed and pushed to GitHub (`origin/main`) prior to kickoff. The Git commit SHA and GitHub commit timestamp serve as third-party proof that predictions were frozen before match results were knowable.

---

## 5. Lifecycle Accounting Rules

To prevent selective reporting and survivor bias, every eligible round must be recorded according to strict lifecycle states:

| Lifecycle State | Stake Recognized | Payout Accounting | Effect on Accuracy Test | Audit Handling |
|---|---|---|---|---|
| **PRE_REGISTERED** | ₦800 (Earmarked) | Pending match completion | Pending | SHA-256 committed to ledger |
| **SETTLED** | ₦800 (Capital Spent) | Official Parimutuel Payout | Counted in paired $t$-test | Appended to `auditTrail` |
| **VOID** | ₦0 (Refunded ₦800) | ₦0 Gross Payout | Excluded from test | Reason logged; ₦0 net P&L |
| **SKIPPED** | ₦0 | ₦0 Gross Payout | Excluded from test | Pre-declared opt-out logged |
| **CORRECTED** | Retains original | Adjusted with justification | Recalculated | Never overwrites; logged to `correctionHistory` |

---

## 6. Pre-Declared Sample Size & Termination

* **Target Evaluation Window:** Exactly **50 consecutive eligible live rounds** (approx. 6–12 months of live operational slates).
* **Prohibition on Optional Stopping:** The trial will not be terminated early or prolonged due to intermediate statistical significance or favorable ROI spikes.
* **Final Audit Report:** Upon reaching 50 completed rounds, the cumulative ledger will be audited, and the two primary outcomes will be reported without modification.
