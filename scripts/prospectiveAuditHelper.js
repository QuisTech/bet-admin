import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SPORTY_LEDGER_PATH = path.resolve(ROOT_DIR, 'audit/prospective_ledger.json');
const ONEX_LEDGER_PATH = path.resolve(ROOT_DIR, 'audit/prospective_ledger_1xbet.json');
const SPORTY_HISTORY_PATH = path.resolve(ROOT_DIR, 'public/data/sportybet_history.json');
const ONEX_HISTORY_PATH = path.resolve(ROOT_DIR, 'public/data/1xbet_history.json');

function getLedgerPath(platform = 'sportybet') {
  return platform === '1xbet' ? ONEX_LEDGER_PATH : SPORTY_LEDGER_PATH;
}

function getHistoryPath(platform = 'sportybet') {
  return platform === '1xbet' ? ONEX_HISTORY_PATH : SPORTY_HISTORY_PATH;
}

export function loadProspectiveLedger(platform = 'sportybet') {
  const p = getLedgerPath(platform);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error(`Error reading prospective ledger at ${p}:`, e);
    }
  }
  return {
    protocolVersion: '1.6.0',
    platform,
    protocolDoc: 'audit/PROSPECTIVE_PROTOCOL.md',
    frozenStrategy: 'BALANCED_COVER',
    frozenBeamWidth: 2000,
    frozenConstraints: {
      minDraws: 2,
      maxDraws: 5,
      minHomes: platform === '1xbet' ? 5 : 3,
      maxHomes: 9,
      minDistance: 2,
      maxDistance: 4
    },
    scoringRules: platform === '1xbet' ? 'ONEXBET_TOTO_14_PARIMUTUEL' : 'SPORTYBET_SUPER_12_PARIMUTUEL',
    targetSampleSize: 50,
    records: []
  };
}

export function saveProspectiveLedger(ledger, platform = 'sportybet') {
  const p = getLedgerPath(platform);
  fs.writeFileSync(p, JSON.stringify(ledger, null, 2), 'utf8');
}

export function computeCanonicalCommitmentHash(commitment) {
  const canonical = {
    deadline: commitment.deadline,
    earliestKickoff: commitment.earliestKickoff,
    frozenBeamWidth: commitment.frozenBeamWidth,
    frozenConstraints: commitment.frozenConstraints,
    gitCommit: commitment.gitCommit,
    matchOddsSnapshot: commitment.matchOddsSnapshot,
    oddsCapturedAt: commitment.oddsCapturedAt,
    oddsSource: commitment.oddsSource,
    pairedBaselineTickets: [...(commitment.pairedBaselineTickets || [])].sort(),
    protocolVersion: commitment.protocolVersion,
    roundId: String(commitment.roundId),
    scoringRules: commitment.scoringRules,
    stake: commitment.stake,
    strategy: commitment.strategy,
    tickets: [...commitment.tickets].sort()
  };
  const serialized = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export function settleProspectiveRound(platform, roundId) {
  const ledger = loadProspectiveLedger(platform);
  const rec = ledger.records.find(r => String(r.roundId) === String(roundId));

  if (!rec) {
    throw new Error(`Round ${roundId} is not found in the ${platform} prospective ledger.`);
  }

  // 1. Verify Canonical SHA-256 Hash
  const recomputedHash = computeCanonicalCommitmentHash(rec);
  const hashMatches = recomputedHash === rec.sha256;
  if (!hashMatches) {
    throw new Error(`Canonical commitment hash mismatch for round ${roundId}! Expected: ${rec.sha256}, Got: ${recomputedHash}`);
  }

  // 2. Load History to find official results
  const histPath = getHistoryPath(platform);
  if (!fs.existsSync(histPath)) {
    throw new Error(`History file not found at ${histPath}`);
  }
  const history = JSON.parse(fs.readFileSync(histPath, 'utf8'));
  const round = history.find(r => String(r.periodNumber || r.drawNumber) === String(roundId));

  if (!round || !round.matches || !round.matches.every(m => m.actualResult)) {
    throw new Error(`Round ${roundId} does not yet have official settled actualResults in operator history.`);
  }

  const numMatches = platform === '1xbet' ? 14 : 12;
  const actuals = round.matches.map(m => m.actualResult);
  let totalScore = 0;
  const scoredLines = [];

  for (let i = 0; i < rec.tickets.length; i++) {
    const t = rec.tickets[i].split('');
    let score = 0;
    for (let m = 0; m < numMatches; m++) {
      if (t[m] === actuals[m]) score++;
    }
    totalScore += score;
    scoredLines.push({ ticketIndex: i + 1, picks: rec.tickets[i], score });
  }

  // Score baseline tickets
  let baselineTotalScore = 0;
  const baselineScoredLines = [];
  const baseLines = rec.pairedBaselineTickets || [];
  for (let i = 0; i < baseLines.length; i++) {
    const t = baseLines[i].split('');
    let score = 0;
    for (let m = 0; m < numMatches; m++) {
      if (t[m] === actuals[m]) score++;
    }
    baselineTotalScore += score;
    baselineScoredLines.push({ ticketIndex: i + 1, picks: baseLines[i], score });
  }

  // Calculate payouts
  let totalPayout = 0;
  let dependsOnCounterfactualAssumption = false;
  const counterfactualNotes = [];

  if (platform === 'sportybet') {
    const hits12 = scoredLines.filter(s => s.score === 12).length;
    const hits11 = scoredLines.filter(s => s.score === 11).length;
    const hits10 = scoredLines.filter(s => s.score === 10).length;

    const w12 = round.winnings?.find(w => w.correctEvents === 12);
    const w11 = round.winnings?.find(w => w.correctEvents === 11);
    const w10 = round.winnings?.find(w => w.correctEvents === 10);

    const pub12 = w12 ? w12.winNum : 0;
    const pub11 = w11 ? w11.winNum : 0;
    const pub10 = w10 ? w10.winNum : 0;

    let pay12 = 0;
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
        counterfactualNotes.push(`11/12 Consolation: 0 public winners recorded; strictly credited ₦0.`);
      }
    }

    let pay10 = 0;
    if (hits10 > 0) {
      if (pub10 > 0 && w10?.perWinnings > 0) {
        dependsOnCounterfactualAssumption = true;
        pay10 = (hits10 / (pub10 + hits10)) * (pub10 * w10.perWinnings);
        counterfactualNotes.push(`10/12 Consolation: Diluted official payout among ${pub10} public + ${hits10} simulated.`);
      } else {
        counterfactualNotes.push(`10/12 Consolation: 0 public winners recorded; strictly credited ₦0.`);
      }
    }

    totalPayout = pay12 + pay11 + pay10;
  } else {
    // 1xBet parimutuel categories (14, 13, 12, 11, 10, 9)
    const catMap = {};
    if (Array.isArray(round.categories)) {
      round.categories.forEach(c => { catMap[c.countEvents] = c.payoutOn1CurrUnit || 0; });
    }
    const stakePerLine = rec.stake / rec.tickets.length;
    scoredLines.forEach(line => {
      let linePay = 0;
      for (let sc = line.score; sc >= 9; sc--) {
        if (catMap[sc]) linePay += catMap[sc] * stakePerLine;
      }
      totalPayout += linePay;
    });
  }

  const netProfit = totalPayout - rec.stake;
  const netROI = (netProfit / rec.stake) * 100;
  const now = new Date().toISOString();

  rec.status = 'SETTLED';
  rec.settledAt = now;
  rec.actualResults = actuals.join('');
  rec.scoredLines = scoredLines;

  rec.accuracyOutcome = {
    totalCorrect: totalScore,
    avgAccuracy: totalScore / rec.tickets.length,
    picksPerTicket: scoredLines.map(s => s.score),
    baselineTotalCorrect: baselineTotalScore,
    baselineAvgAccuracy: baseLines.length > 0 ? baselineTotalScore / baseLines.length : 0,
    baselinePicksPerTicket: baselineScoredLines.map(s => s.score),
    pairedDifference: (totalScore - baselineTotalScore) / rec.tickets.length
  };

  rec.financialOutcome = {
    stakeCharged: rec.stake,
    grossPayout: totalPayout,
    netProfit: netProfit,
    netROI: netROI,
    dependsOnCounterfactualAssumption,
    counterfactualNotes
  };

  rec.auditTrail = rec.auditTrail || [];
  rec.auditTrail.push({
    event: 'SETTLED',
    timestamp: now,
    actualResults: actuals.join(''),
    accuracyOutcome: rec.accuracyOutcome,
    financialOutcome: rec.financialOutcome
  });

  saveProspectiveLedger(ledger, platform);

  return {
    success: true,
    roundId,
    canonicalHash: rec.sha256,
    actualResults: actuals.join(''),
    accuracyOutcome: rec.accuracyOutcome,
    financialOutcome: rec.financialOutcome,
    scoredLines,
    baselineScoredLines,
    updatedLedger: ledger
  };
}
