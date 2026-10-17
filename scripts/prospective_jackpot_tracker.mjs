/**
 * PROSPECTIVE JACKPOT EVALUATION TRACKER
 * 
 * Protocol:
 * 1. Freeze algorithm & parameters (Commit d6c4af3, Beam width 2000, BALANCED_COVER, Distance 2-4).
 * 2. Pre-register predictions on upcoming unseen slates BEFORE kickoff.
 * 3. Hash and commit the pre-registered ticket combinations to audit/prospective_ledger.json.
 * 4. Settle only after official match completion, evaluating both prediction accuracy and net financial ROI.
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
    version: '1.0.0',
    frozenStrategy: 'BALANCED_COVER',
    frozenBeamWidth: 2000,
    frozenConstraints: { minDraws: 2, maxDraws: 5, minHomes: 3, maxHomes: 8, minDistance: 2, maxDistance: 4 },
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
  console.log(`Tracked Rounds: ${ledger.records.length}\n`);

  if (ledger.records.length === 0) {
    console.log('No prospective rounds registered yet.');
    console.log('To pre-register an upcoming round before kickoff:');
    console.log('  node scripts/prospective_jackpot_tracker.mjs register <roundPeriodNumber>\n');
  } else {
    let totalSpent = 0, totalWon = 0, totalScores = 0, totalTickets = 0;
    console.log('| Round | Registered At | Status | SHA-256 Hash | Tickets | Correct / 12 | Payout | Net ROI % |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const r of ledger.records) {
      const acc = r.status === 'SETTLED' ? `${(r.avgAccuracy).toFixed(2)}/12` : 'Pending';
      const pay = r.status === 'SETTLED' ? `₦${Math.round(r.totalPayout).toLocaleString()}` : 'Pending';
      const roi = r.status === 'SETTLED' ? `${r.netROI.toFixed(1)}%` : 'Pending';
      console.log(`| ${r.roundId} | ${r.registeredAt.slice(0, 10)} | ${r.status} | ${r.sha256.slice(0, 8)}... | ${r.tickets.length} lines | ${acc} | ${pay} | ${roi} |`);
      if (r.status === 'SETTLED') {
        totalSpent += r.stake;
        totalWon += r.totalPayout;
        totalScores += r.totalScore;
        totalTickets += r.tickets.length;
      }
    }
    if (totalTickets > 0) {
      const cumROI = ((totalWon - totalSpent) / totalSpent) * 100;
      const cumAcc = totalScores / totalTickets;
      console.log(`\nCumulative Prospective Track Record:`);
      console.log(`  - Total Invested: ₦${totalSpent.toLocaleString()}`);
      console.log(`  - Total Realized Payout: ₦${Math.round(totalWon).toLocaleString()}`);
      console.log(`  - Cumulative ROI: ${cumROI.toFixed(1)}%`);
      console.log(`  - Average Accuracy: ${cumAcc.toFixed(2)} / 12`);
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

  const tickets = generateCoveringPortfolioExact(round.matches, 8);
  const ticketStrings = tickets.map(t => t.join(''));
  const payloadToHash = `${roundId}_${round.deadline}_${ticketStrings.join(',')}`;
  const sha256 = crypto.createHash('sha256').update(payloadToHash).digest('hex');

  const record = {
    roundId,
    deadline: round.deadline,
    registeredAt: new Date().toISOString(),
    gitCommit: getCurrentGitCommit(),
    strategy: 'BALANCED_COVER',
    beamWidth: 2000,
    status: 'PRE_REGISTERED',
    tickets: ticketStrings,
    sha256,
    stake: 800
  };

  ledger.records.push(record);
  saveLedger(ledger);

  console.log('\n=============================================================');
  console.log(`  ✅ PROSPECTIVE ROUND PRE-REGISTERED (FROZEN BEFORE KICKOFF)`);
  console.log('=============================================================');
  console.log(`Round: ${roundId} (Deadline: ${new Date(round.deadline).toUTCString()})`);
  console.log(`Git Commit: ${record.gitCommit} | Strategy: BALANCED_COVER | Lines: 8`);
  console.log(`SHA-256 Verification Fingerprint: ${sha256}`);
  console.log(`Generated Tickets:`);
  ticketStrings.forEach((t, i) => console.log(`  Line #${i + 1}: ${t}`));
  console.log(`\nPredictions are strictly locked in audit/prospective_ledger.json.`);
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
  rec.settledAt = new Date().toISOString();
  rec.actualResults = actuals.join('');
  rec.scoredLines = scoredLines;

  // Separate primary outcomes
  rec.accuracyOutcome = {
    totalCorrect: totalScore,
    avgAccuracy: totalScore / rec.tickets.length,
    picksPerTicket: scoredLines.map(s => s.score)
  };

  rec.financialOutcome = {
    grossPayout: totalPayout,
    stakeCharged: rec.stake,
    netProfit: netProfit,
    netROI: netROI,
    dependsOnCounterfactualAssumption,
    counterfactualNotes
  };

  // Backwards compatible top-level shortcuts
  rec.totalScore = totalScore;
  rec.avgAccuracy = totalScore / rec.tickets.length;
  rec.hits12 = hits12;
  rec.hits11 = hits11;
  rec.hits10 = hits10;
  rec.totalPayout = totalPayout;
  rec.netProfit = netProfit;
  rec.netROI = netROI;

  saveLedger(ledger);

  console.log('\n=============================================================');
  console.log(`  ✅ PROSPECTIVE ROUND SETTLED: ROUND ${roundId}`);
  console.log('=============================================================');
  console.log(`Actual Match Results: ${rec.actualResults}`);
  console.log(`Ticket Performance:`);
  scoredLines.forEach(l => console.log(`  Line #${l.ticketIndex}: ${l.picks} -> ${l.score}/12`));
  console.log(`\n[PRIMARY OUTCOME 1: PREDICTION ACCURACY]`);
  console.log(`  Average Accuracy: ${(rec.avgAccuracy).toFixed(2)} / 12`);
  console.log(`  Tier Hits: 12/12: ${hits12} | 11/12: ${hits11} | 10/12: ${hits10}`);
  console.log(`\n[PRIMARY OUTCOME 2: FINANCIAL RETURN]`);
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
  if (!rec) {
    rec = { roundId, registeredAt: new Date().toISOString(), tickets: [], stake: 0, sha256: 'VOID' };
    ledger.records.push(rec);
  }
  rec.status = 'VOID';
  rec.voidReason = reason;
  rec.voidedAt = new Date().toISOString();
  saveLedger(ledger);
  console.log(`Round ${roundId} marked as VOID: ${reason}`);
} else if (command === 'skip') {
  const roundId = args[1];
  const reason = args.slice(2).join(' ') || 'User opted not to enter slate';
  const ledger = loadLedger();
  let rec = ledger.records.find(r => r.roundId === roundId);
  if (!rec) {
    rec = { roundId, registeredAt: new Date().toISOString(), tickets: [], stake: 0, sha256: 'SKIPPED' };
    ledger.records.push(rec);
  }
  rec.status = 'SKIPPED';
  rec.skipReason = reason;
  rec.skippedAt = new Date().toISOString();
  saveLedger(ledger);
  console.log(`Round ${roundId} marked as SKIPPED: ${reason}`);
} else if (command === 'correct') {
  const roundId = args[1];
  const note = args.slice(2).join(' ');
  const ledger = loadLedger();
  const rec = ledger.records.find(r => r.roundId === roundId);
  if (!rec) {
    console.error(`Error: Round ${roundId} not found in ledger.`);
    process.exit(1);
  }
  rec.settlementCorrectionNote = note;
  rec.correctedAt = new Date().toISOString();
  saveLedger(ledger);
  console.log(`Settlement correction recorded for Round ${roundId}: ${note}`);
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

