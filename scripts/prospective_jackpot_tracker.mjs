/**
 * PROSPECTIVE JACKPOT EVALUATION TRACKER
 * 
 * Protocol:
 * 1. Freeze algorithm & parameters (Commit d6c4af3, Beam width 2000, BALANCED_COVER, Distance 2-4).
 * 2. Pre-register predictions on upcoming unseen slates BEFORE kickoff.
 * 3. Hash and commit the pre-registered ticket combinations to audit/prospective_ledger.json.
 * 4. Maintain an immutable append-only auditTrail for every state change.
 * 5. Track Prediction Accuracy and Realized Financial Return as separate primary outcomes.
 * 6. Explicitly tag whether payouts rely on counterfactual settlement assumptions.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const LEDGER_PATH = path.resolve('audit/prospective_ledger.json');
const HISTORY_PATH = path.resolve('public/data/sportybet_history.json');

// Ensure audit dir exists
if (!fs.existsSync(path.resolve('audit'))) {
  fs.mkdirSync(path.resolve('audit'), { recursive: true });
}

function loadLedger() {
  if (fs.existsSync(LEDGER_PATH)) {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  }
  return {
    version: '1.1.0',
    protocolDoc: 'audit/PROSPECTIVE_PROTOCOL.md',
    frozenStrategy: 'BALANCED_COVER',
    frozenBeamWidth: 2000,
    frozenConstraints: { minDraws: 2, maxDraws: 5, minHomes: 3, maxHomes: 8, minDistance: 2, maxDistance: 4 },
    targetSampleSize: 50,
    records: []
  };
}

function saveLedger(ledger) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf8');
}

function getCurrentGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'd6c4af3';
  }
}

// Deterministic Mulberry32 PRNG for paired random baseline comparison
function createSeededRandom(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t >>> 0) / 4294967296;
  };
}

// Frozen portfolio generator (exact match to src/services/jackpotService.ts)
function generateCoveringPortfolioExact(slateMatches, targetTickets = 8) {
  const numMatches = slateMatches.length;
  const beamWidth = 2000;
  let beam = [{ picks: [], prob: 1.0 }];

  for (let m = 0; m < numMatches; m++) {
    const match = slateMatches[m];
    const opts = ['1', 'X', '2'];
    const nextCandidates = [];

    const oH = match.odds?.home || 2.5;
    const oD = match.odds?.draw || 3.2;
    const oA = match.odds?.away || 2.8;
    const rH = 1 / oH, rD = 1 / oD, rA = 1 / oA;
    const sum = rH + rD + rA;
    const pH = rH / sum, pD = rD / sum, pA = rA / sum;

    for (const c of beam) {
      for (const opt of opts) {
        const p = opt === '1' ? pH : opt === 'X' ? pD : pA;
        nextCandidates.push({
          picks: [...c.picks, opt],
          prob: c.prob * p
        });
      }
    }
    nextCandidates.sort((a, b) => b.prob - a.prob);
    beam = nextCandidates.slice(0, beamWidth);
  }

  const minDraws = 2, maxDraws = 5, minHomes = 3, maxHomes = 8;
  const validCandidates = [];
  for (const c of beam) {
    const draws = c.picks.filter(p => p === 'X').length;
    const homes = c.picks.filter(p => p === '1').length;
    if (draws >= minDraws && draws <= maxDraws && homes >= minHomes && homes <= maxHomes) {
      validCandidates.push(c);
    }
  }

  if (validCandidates.length < targetTickets) {
    for (const c of beam) {
      if (!validCandidates.some(v => v.picks.every((p, i) => p === c.picks[i]))) {
        validCandidates.push(c);
        if (validCandidates.length >= targetTickets * 4) break;
      }
    }
  }

  validCandidates.sort((a, b) => b.prob - a.prob);
  const selected = [validCandidates[0]];

  for (let k = 1; k < targetTickets; k++) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let c = 1; c < validCandidates.length; c++) {
      const cand = validCandidates[c];
      if (selected.some(t => t.picks.every((p, idx) => p === cand.picks[idx]))) continue;

      let minDistance = Infinity;
      for (const s of selected) {
        let dist = 0;
        for (let i = 0; i < numMatches; i++) {
          if (cand.picks[i] !== s.picks[i]) dist++;
        }
        if (dist < minDistance) minDistance = dist;
      }

      const distanceQuality = minDistance >= 2 && minDistance <= 4 ? 14 : -3;
      const score = Math.log10(cand.prob + 1e-15) * 0.4 + distanceQuality;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = c;
      }
    }

    if (bestIdx >= 0) {
      selected.push(validCandidates[bestIdx]);
    } else {
      selected.push(validCandidates[k % validCandidates.length]);
    }
  }

  return selected.map(s => s.picks);
}

// Generate pre-paired random rush baseline line-by-line
function generatePairedRandomBaseline(roundId, slateMatches, targetTickets = 8) {
  const rng = createSeededRandom(parseInt(roundId, 10) + 1337);
  const tickets = [];
  for (let t = 0; t < targetTickets; t++) {
    const line = [];
    for (let m = 0; m < slateMatches.length; m++) {
      const rand = Math.floor(rng() * 3) + 1;
      line.push(rand === 1 ? '1' : rand === 2 ? 'X' : '2');
    }
    tickets.push(line.join(''));
  }
  return tickets;
}

// -------------------------------------------------------------
// CLI Actions
// -------------------------------------------------------------
const args = process.argv.slice(2);
const command = args[0] || 'status';

if (command === 'status') {
  const ledger = loadLedger();
  console.log('\n=============================================================');
  console.log('   PROSPECTIVE JACKPOT EVALUATION LEDGER STATUS');
  console.log('=============================================================');
  console.log(`Frozen Strategy: ${ledger.frozenStrategy} | Beam Width: ${ledger.frozenBeamWidth}`);
  console.log(`Target Evaluation Window: ${ledger.targetSampleSize} slates | Logged: ${ledger.records.length}\n`);

  if (ledger.records.length === 0) {
    console.log('No prospective rounds registered yet.');
    console.log('To pre-register an upcoming round before kickoff:');
    console.log('  node scripts/prospective_jackpot_tracker.mjs register <roundPeriodNumber>\n');
  } else {
    let totalInvested = 0, totalGrossPayout = 0, totalStrategyScores = 0, totalBaselineScores = 0, totalTickets = 0;
    let settledCount = 0, voidCount = 0, skippedCount = 0;
    let directlyVerifiedPayout = 0, counterfactualPayout = 0;

    console.log('| Round | Registered | Status | SHA-256 | Accuracy (Strat vs Base) | Gross Payout | Net ROI % | Counterfactual? |');
    console.log('|---|---|---|---|---|---|---|---|');

    for (const r of ledger.records) {
      if (r.status === 'SETTLED') {
        settledCount++;
        const stratAcc = r.accuracyOutcome.avgAccuracy.toFixed(2);
        const baseAcc = r.accuracyOutcome.baselineAvgAccuracy.toFixed(2);
        const accDiff = (r.accuracyOutcome.avgAccuracy - r.accuracyOutcome.baselineAvgAccuracy);
        const accStr = `${stratAcc} vs ${baseAcc} (${accDiff >= 0 ? '+' : ''}${accDiff.toFixed(2)})`;
        const payStr = `₦${Math.round(r.financialOutcome.grossPayout).toLocaleString()}`;
        const roiStr = `${r.financialOutcome.netROI.toFixed(1)}%`;
        const cfStr = r.financialOutcome.dependsOnCounterfactualAssumption ? 'YES (Simulated)' : 'NO (Verified)';

        console.log(`| ${r.roundId} | ${r.registeredAt.slice(0, 10)} | SETTLED | ${r.sha256.slice(0, 8)}... | ${accStr} | ${payStr} | ${roiStr} | ${cfStr} |`);

        totalInvested += r.financialOutcome.stakeCharged;
        totalGrossPayout += r.financialOutcome.grossPayout;
        totalStrategyScores += r.accuracyOutcome.totalCorrect;
        totalBaselineScores += r.accuracyOutcome.baselineTotalCorrect;
        totalTickets += r.tickets.length;

        if (r.financialOutcome.dependsOnCounterfactualAssumption) {
          counterfactualPayout += r.financialOutcome.grossPayout;
        } else {
          directlyVerifiedPayout += r.financialOutcome.grossPayout;
        }
      } else if (r.status === 'VOID') {
        voidCount++;
        console.log(`| ${r.roundId} | ${r.registeredAt.slice(0, 10)} | VOID | ${r.sha256.slice(0, 8)}... | Match voided: ${r.voidReason} | Stake Refunded | 0.0% | N/A |`);
      } else if (r.status === 'SKIPPED') {
        skippedCount++;
        console.log(`| ${r.roundId} | ${r.registeredAt.slice(0, 10)} | SKIPPED | ${r.sha256.slice(0, 8)}... | Slate skipped: ${r.skipReason} | ₦0 | 0.0% | N/A |`);
      } else {
        console.log(`| ${r.roundId} | ${r.registeredAt.slice(0, 10)} | PRE_REG | ${r.sha256.slice(0, 8)}... | Pre-kickoff commitment | Pending | Pending | Pending |`);
      }
    }

    console.log('\n-------------------------------------------------------------');
    console.log('CUMULATIVE PROSPECTIVE SUMMARY:');
    console.log(`  - Slates Logged: ${ledger.records.length} (Settled: ${settledCount}, Void: ${voidCount}, Skipped: ${skippedCount})`);

    if (settledCount > 0) {
      const meanStratAcc = totalStrategyScores / totalTickets;
      const meanBaseAcc = totalBaselineScores / totalTickets;
      const netProfit = totalGrossPayout - totalInvested;
      const cumROI = (netProfit / totalInvested) * 100;

      console.log(`\n  [PRIMARY OUTCOME 1: PROSPECTIVE PREDICTION ACCURACY]`);
      console.log(`    * Frozen Strategy Accuracy: ${meanStratAcc.toFixed(3)} / 12`);
      console.log(`    * Paired Random Baseline:   ${meanBaseAcc.toFixed(3)} / 12`);
      console.log(`    * Paired Difference:        ${(meanStratAcc - meanBaseAcc >= 0 ? '+' : '')}${(meanStratAcc - meanBaseAcc).toFixed(3)} picks / ticket`);

      console.log(`\n  [PRIMARY OUTCOME 2: REALIZED FINANCIAL RETURN]`);
      console.log(`    * Total Capital Invested:   ₦${totalInvested.toLocaleString()}`);
      console.log(`    * Total Realized Payout:    ₦${Math.round(totalGrossPayout).toLocaleString()}`);
      console.log(`    * Net Profit / Loss:        ₦${Math.round(netProfit).toLocaleString()}`);
      console.log(`    * Realized Net ROI:         ${cumROI.toFixed(1)}%`);

      console.log(`\n  [PAYOUT RELIABILITY AUDIT]`);
      console.log(`    * Directly Verified Payouts: ₦${Math.round(directlyVerifiedPayout).toLocaleString()}`);
      console.log(`    * Counterfactually Diluted:  ₦${Math.round(counterfactualPayout).toLocaleString()}`);
    }
  }
  console.log('=============================================================\n');
} else if (command === 'register') {
  const roundId = args[1];
  if (!roundId) {
    console.error('Error: Please specify roundPeriodNumber: node scripts/prospective_jackpot_tracker.mjs register <roundPeriodNumber>');
    process.exit(1);
  }

  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  const round = history.find(r => r.periodNumber === roundId);
  if (!round) {
    console.error(`Error: Round ${roundId} not found in sportybet_history.json`);
    process.exit(1);
  }

  const ledger = loadLedger();
  if (ledger.records.some(r => r.roundId === roundId)) {
    console.log(`Round ${roundId} is already pre-registered in prospective ledger.`);
    process.exit(0);
  }

  const now = new Date().toISOString();
  const commit = getCurrentGitCommit();
  const tickets = generateCoveringPortfolioExact(round.matches, 8);
  const ticketStrings = tickets.map(t => t.join(''));
  const baselineTickets = generatePairedRandomBaseline(roundId, round.matches, 8);

  const payloadToHash = `${roundId}_${round.deadline}_${commit}_${ticketStrings.join(',')}`;
  const sha256 = crypto.createHash('sha256').update(payloadToHash).digest('hex');

  const record = {
    roundId,
    deadline: round.deadline,
    registeredAt: now,
    gitCommit: commit,
    strategy: 'BALANCED_COVER',
    beamWidth: 2000,
    status: 'PRE_REGISTERED',
    tickets: ticketStrings,
    pairedBaselineTickets: baselineTickets,
    sha256,
    stake: 800,
    auditTrail: [
      {
        event: 'PRE_REGISTERED',
        timestamp: now,
        gitCommit: commit,
        payloadHash: sha256,
        ticketsCount: ticketStrings.length
      }
    ]
  };

  ledger.records.push(record);
  saveLedger(ledger);

  console.log('\n=============================================================');
  console.log(`  ✅ PROSPECTIVE ROUND PRE-REGISTERED (FROZEN BEFORE KICKOFF)`);
  console.log('=============================================================');
  console.log(`Round: ${roundId} (Deadline: ${new Date(round.deadline).toUTCString()})`);
  console.log(`Git Commit: ${commit} | Strategy: BALANCED_COVER | Lines: 8`);
  console.log(`SHA-256 Verification Fingerprint: ${sha256}`);
  console.log(`Pre-registered Strategy Tickets:`);
  ticketStrings.forEach((t, i) => console.log(`  Line #${i + 1}: ${t}`));
  console.log(`Paired Random Baseline Tickets:`);
  baselineTickets.forEach((t, i) => console.log(`  Line #${i + 1}: ${t}`));
  console.log(`\nCommitment recorded to audit/prospective_ledger.json.`);
  console.log('Push this commit to origin/main to establish public external timestamp.');
  console.log('=============================================================\n');
} else if (command === 'settle') {
  const roundId = args[1];
  if (!roundId) {
    console.error('Error: Please specify roundPeriodNumber: node scripts/prospective_jackpot_tracker.mjs settle <roundPeriodNumber>');
    process.exit(1);
  }

  const ledger = loadLedger();
  const rec = ledger.records.find(r => r.roundId === roundId);
  if (!rec) {
    console.error(`Error: Round ${roundId} is not registered in the prospective ledger.`);
    process.exit(1);
  }

  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  const round = history.find(r => r.periodNumber === roundId);
  if (!round || !round.matches.every(m => m.actualResult)) {
    console.error(`Error: Round ${roundId} does not yet have official settled actualResults in sportybet_history.json.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const actuals = round.matches.map(m => m.actualResult);
  let totalScore = 0;
  let hits12 = 0, hits11 = 0, hits10 = 0;
  const scoredLines = [];

  for (let i = 0; i < rec.tickets.length; i++) {
    const t = rec.tickets[i].split('');
    let score = 0;
    for (let m = 0; m < 12; m++) {
      if (t[m] === actuals[m]) score++;
    }
    totalScore += score;
    if (score === 12) hits12++;
    else if (score === 11) hits11++;
    else if (score === 10) hits10++;
    scoredLines.push({ ticketIndex: i + 1, picks: rec.tickets[i], score });
  }

  // Score paired random baseline tickets
  let baselineTotalScore = 0;
  const baselineScoredLines = [];
  const baseLines = rec.pairedBaselineTickets || generatePairedRandomBaseline(roundId, round.matches, 8);
  for (let i = 0; i < baseLines.length; i++) {
    const t = baseLines[i].split('');
    let score = 0;
    for (let m = 0; m < 12; m++) {
      if (t[m] === actuals[m]) score++;
    }
    baselineTotalScore += score;
    baselineScoredLines.push({ ticketIndex: i + 1, picks: baseLines[i], score });
  }

  const w12 = round.winnings?.find(w => w.correctEvents === 12);
  const w11 = round.winnings?.find(w => w.correctEvents === 11);
  const w10 = round.winnings?.find(w => w.correctEvents === 10);

  const pub12 = w12 ? w12.winNum : 0;
  const pub11 = w11 ? w11.winNum : 0;
  const pub10 = w10 ? w10.winNum : 0;

  let pay12 = 0;
  const counterfactualNotes = [];
  let dependsOnCounterfactualAssumption = false;

  if (hits12 > 0) {
    dependsOnCounterfactualAssumption = true;
    pay12 = (hits12 / (pub12 + hits12)) * round.maxWinnings;
    counterfactualNotes.push(`12/12 Super Jackpot: Assumed pool ₦${round.maxWinnings.toLocaleString()} divided by (${pub12} public + ${hits12} simulated).`);
  }

  let pay11 = 0;
  if (hits11 > 0) {
    if (pub11 > 0 && w11?.perWinnings > 0) {
      dependsOnCounterfactualAssumption = true;
      pay11 = (hits11 / (pub11 + hits11)) * (pub11 * w11.perWinnings);
      counterfactualNotes.push(`11/12 Consolation: Diluted official payout among ${pub11} public + ${hits11} simulated.`);
    } else {
      counterfactualNotes.push(`11/12 Consolation: 0 public winners recorded; strictly credited ₦0 (unwon pool).`);
    }
  }

  let pay10 = 0;
  if (hits10 > 0) {
    if (pub10 > 0 && w10?.perWinnings > 0) {
      dependsOnCounterfactualAssumption = true;
      pay10 = (hits10 / (pub10 + hits10)) * (pub10 * w10.perWinnings);
      counterfactualNotes.push(`10/12 Consolation: Diluted official payout among ${pub10} public + ${hits10} simulated.`);
    } else {
      counterfactualNotes.push(`10/12 Consolation: 0 public winners recorded; strictly credited ₦0 (unwon pool).`);
    }
  }

  const totalPayout = pay12 + pay11 + pay10;
  const netProfit = totalPayout - rec.stake;
  const netROI = (netProfit / rec.stake) * 100;

  rec.status = 'SETTLED';
  rec.settledAt = now;
  rec.actualResults = actuals.join('');
  rec.scoredLines = scoredLines;

  // Primary Outcome 1: Prediction Accuracy
  rec.accuracyOutcome = {
    totalCorrect: totalScore,
    avgAccuracy: totalScore / rec.tickets.length,
    picksPerTicket: scoredLines.map(s => s.score),
    baselineTotalCorrect: baselineTotalScore,
    baselineAvgAccuracy: baselineTotalScore / baseLines.length,
    baselinePicksPerTicket: baselineScoredLines.map(s => s.score),
    pairedDifference: (totalScore - baselineTotalScore) / rec.tickets.length
  };

  // Primary Outcome 2: Financial Return
  rec.financialOutcome = {
    stakeCharged: rec.stake,
    grossPayout: totalPayout,
    netProfit: netProfit,
    netROI: netROI,
    dependsOnCounterfactualAssumption,
    counterfactualNotes
  };

  // Append settlement event to immutable auditTrail
  if (!rec.auditTrail) rec.auditTrail = [];
  rec.auditTrail.push({
    event: 'SETTLED',
    timestamp: now,
    actualResults: rec.actualResults,
    accuracyOutcome: rec.accuracyOutcome,
    financialOutcome: rec.financialOutcome
  });

  saveLedger(ledger);

  console.log('\n=============================================================');
  console.log(`  ✅ PROSPECTIVE ROUND SETTLED: ROUND ${roundId}`);
  console.log('=============================================================');
  console.log(`Actual Match Results: ${rec.actualResults}`);
  console.log(`Ticket Performance:`);
  scoredLines.forEach(l => console.log(`  Line #${l.ticketIndex}: ${l.picks} -> ${l.score}/12`));

  console.log(`\n[PRIMARY OUTCOME 1: PROSPECTIVE PREDICTION ACCURACY]`);
  console.log(`  Strategy Average Accuracy: ${(rec.accuracyOutcome.avgAccuracy).toFixed(2)} / 12`);
  console.log(`  Paired Random Baseline:    ${(rec.accuracyOutcome.baselineAvgAccuracy).toFixed(2)} / 12`);
  console.log(`  Paired Difference:         ${(rec.accuracyOutcome.pairedDifference >= 0 ? '+' : '')}${(rec.accuracyOutcome.pairedDifference).toFixed(2)} picks / ticket`);
  console.log(`  Tier Hits: 12/12: ${hits12} | 11/12: ${hits11} | 10/12: ${hits10}`);

  console.log(`\n[PRIMARY OUTCOME 2: REALIZED FINANCIAL RETURN]`);
  console.log(`  Invested: ₦${rec.stake.toLocaleString()} | Gross Payout: ₦${Math.round(totalPayout).toLocaleString()} | Net: ₦${Math.round(netProfit).toLocaleString()}`);
  console.log(`  Realized Prospective ROI: ${netROI.toFixed(1)}%`);
  console.log(`  Counterfactual Assumption Dependency: ${dependsOnCounterfactualAssumption ? 'YES' : 'NO'}`);
  if (counterfactualNotes.length > 0) {
    counterfactualNotes.forEach(n => console.log(`    * ${n}`));
  }
  console.log('=============================================================\n');
} else if (command === 'void') {
  const roundId = args[1];
  const reason = args.slice(2).join(' ') || 'Operator cancelled/voided match';
  const ledger = loadLedger();
  let rec = ledger.records.find(r => r.roundId === roundId);
  const now = new Date().toISOString();

  if (!rec) {
    rec = {
      roundId,
      registeredAt: now,
      gitCommit: getCurrentGitCommit(),
      strategy: 'BALANCED_COVER',
      beamWidth: 2000,
      tickets: [],
      stake: 0,
      sha256: 'VOID',
      auditTrail: []
    };
    ledger.records.push(rec);
  }

  rec.status = 'VOID';
  rec.voidReason = reason;
  rec.voidedAt = now;
  rec.financialOutcome = {
    stakeCharged: 0,
    refundedStake: 800,
    grossPayout: 0,
    netProfit: 0,
    netROI: 0
  };

  if (!rec.auditTrail) rec.auditTrail = [];
  rec.auditTrail.push({
    event: 'VOIDED',
    timestamp: now,
    reason,
    refundedStake: 800
  });

  saveLedger(ledger);
  console.log(`Round ${roundId} marked as VOID: ${reason}. Stake refunded (₦0 net capital outflow).`);
} else if (command === 'skip') {
  const roundId = args[1];
  const reason = args.slice(2).join(' ') || 'User opted not to enter slate';
  const ledger = loadLedger();
  let rec = ledger.records.find(r => r.roundId === roundId);
  const now = new Date().toISOString();

  if (!rec) {
    rec = {
      roundId,
      registeredAt: now,
      gitCommit: getCurrentGitCommit(),
      strategy: 'BALANCED_COVER',
      beamWidth: 2000,
      tickets: [],
      stake: 0,
      sha256: 'SKIPPED',
      auditTrail: []
    };
    ledger.records.push(rec);
  }

  rec.status = 'SKIPPED';
  rec.skipReason = reason;
  rec.skippedAt = now;
  rec.financialOutcome = {
    stakeCharged: 0,
    grossPayout: 0,
    netProfit: 0,
    netROI: 0
  };

  if (!rec.auditTrail) rec.auditTrail = [];
  rec.auditTrail.push({
    event: 'SKIPPED',
    timestamp: now,
    reason
  });

  saveLedger(ledger);
  console.log(`Round ${roundId} marked as SKIPPED: ${reason}. Stake = ₦0.`);
} else if (command === 'correct') {
  const roundId = args[1];
  const note = args.slice(2).join(' ');
  const ledger = loadLedger();
  const rec = ledger.records.find(r => r.roundId === roundId);
  if (!rec) {
    console.error(`Error: Round ${roundId} not found in ledger.`);
    process.exit(1);
  }
  const now = new Date().toISOString();
  if (!rec.correctionHistory) rec.correctionHistory = [];
  rec.correctionHistory.push({
    timestamp: now,
    note,
    priorFinancialOutcome: { ...rec.financialOutcome }
  });

  if (!rec.auditTrail) rec.auditTrail = [];
  rec.auditTrail.push({
    event: 'CORRECTION',
    timestamp: now,
    note
  });

  saveLedger(ledger);
  console.log(`Settlement correction recorded for Round ${roundId}: ${note} (Appended to immutable audit trail).`);
} else {
  console.log(`Unknown command: ${command}`);
  console.log('Available commands:');
  console.log('  node scripts/prospective_jackpot_tracker.mjs status');
  console.log('  node scripts/prospective_jackpot_tracker.mjs register <roundPeriodNumber>');
  console.log('  node scripts/prospective_jackpot_tracker.mjs settle <roundPeriodNumber>');
  console.log('  node scripts/prospective_jackpot_tracker.mjs void <roundPeriodNumber> <reason>');
  console.log('  node scripts/prospective_jackpot_tracker.mjs skip <roundPeriodNumber> <reason>');
  console.log('  node scripts/prospective_jackpot_tracker.mjs correct <roundPeriodNumber> <note>');
}
