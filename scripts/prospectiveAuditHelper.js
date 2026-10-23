import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SPORTY_LEDGER_PATH = path.resolve(ROOT_DIR, 'audit/prospective_ledger.json');
const ONEX_LEDGER_PATH = path.resolve(ROOT_DIR, 'audit/prospective_ledger_1xbet.json');
const SPORTY_PUBLIC_LEDGER_PATH = path.resolve(ROOT_DIR, 'public/data/prospective_ledger.json');
const ONEX_PUBLIC_LEDGER_PATH = path.resolve(ROOT_DIR, 'public/data/prospective_ledger_1xbet.json');
const SPORTY_HISTORY_PATH = path.resolve(ROOT_DIR, 'public/data/sportybet_history.json');
const ONEX_HISTORY_PATH = path.resolve(ROOT_DIR, 'public/data/1xbet_history.json');

function getLedgerPath(platform = 'sportybet') {
  return platform === '1xbet' ? ONEX_LEDGER_PATH : SPORTY_LEDGER_PATH;
}

function getPublicLedgerPath(platform = 'sportybet') {
  return platform === '1xbet' ? ONEX_PUBLIC_LEDGER_PATH : SPORTY_PUBLIC_LEDGER_PATH;
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
  try {
    const pub = getPublicLedgerPath(platform);
    fs.writeFileSync(pub, JSON.stringify(ledger, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not mirror ledger to public/data:', err);
  }
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

export function computeLegacyCommitmentHash(commitment) {
  const legacy = {
    protocolVersion: commitment.protocolVersion,
    roundId: String(commitment.roundId),
    deadline: commitment.deadline,
    earliestKickoff: commitment.earliestKickoff,
    oddsSource: commitment.oddsSource,
    oddsCapturedAt: commitment.oddsCapturedAt,
    gitCommit: commitment.gitCommit,
    strategy: commitment.strategy,
    frozenBeamWidth: commitment.frozenBeamWidth,
    frozenConstraints: commitment.frozenConstraints,
    scoringRules: commitment.scoringRules,
    stake: commitment.stake,
    matchOddsSnapshot: commitment.matchOddsSnapshot,
    pairedBaselineTickets: [...(commitment.pairedBaselineTickets || [])].sort(),
    tickets: [...commitment.tickets].sort()
  };
  const serialized = JSON.stringify(legacy);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export function verifyCommitmentHash(rec) {
  const canonicalHash = computeCanonicalCommitmentHash(rec);
  if (canonicalHash === rec.sha256) {
    return { valid: true, recomputedHash: canonicalHash };
  }
  const legacyHash = computeLegacyCommitmentHash(rec);
  if (legacyHash === rec.sha256) {
    return { valid: true, recomputedHash: legacyHash };
  }
  return { valid: false, recomputedHash: canonicalHash };
}

export async function settleProspectiveRound(platform, roundId) {
  const ledger = loadProspectiveLedger(platform);
  const rec = ledger.records.find(r => String(r.roundId) === String(roundId));

  if (!rec) {
    throw new Error(`Round ${roundId} is not found in the ${platform} prospective ledger.`);
  }

  // 1. Verify Canonical SHA-256 Hash
  const hashCheck = verifyCommitmentHash(rec);
  if (!hashCheck.valid) {
    throw new Error(`Canonical commitment hash mismatch for round ${roundId}! Expected: ${rec.sha256}, Got: ${hashCheck.recomputedHash}`);
  }

  // 2. Load History to find official results
  const histPath = getHistoryPath(platform);
  let history = [];
  if (fs.existsSync(histPath)) {
    try {
      history = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    } catch {
      history = [];
    }
  }

  let round = history.find(r => String(r.periodNumber || r.drawNumber) === String(roundId));

  // If round not yet present in history or not settled, auto-sync from live operator API
  if (!round || !round.matches || !round.matches.every(m => m.actualResult)) {
    try {
      if (platform === '1xbet') {
        const { sync1xBetDraws } = await import('./sync1xBetHelper.js');
        await sync1xBetDraws({ maxPages: 4 });
      } else {
        const { syncJackpotRounds } = await import('./syncJackpotHelper.js');
        await syncJackpotRounds();
      }
      if (fs.existsSync(histPath)) {
        history = JSON.parse(fs.readFileSync(histPath, 'utf8'));
        round = history.find(r => String(r.periodNumber || r.drawNumber) === String(roundId));
      }
    } catch (syncErr) {
      console.warn(`Auto-sync for ${platform} round ${roundId} encountered error:`, syncErr?.message || syncErr);
    }
  }

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
      round.categories.forEach(c => {
        const catKey = c.categoryNumber || c.countEvents;
        if (catKey) catMap[catKey] = c.payoutOn1CurrUnit || 0;
      });
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

function getCurrentGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch {
    return '7225d95';
  }
}

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

export function registerProspectiveRound({
  platform = 'sportybet',
  roundId,
  deadline,
  earliestKickoff,
  oddsSource,
  oddsCapturedAt,
  gitCommit,
  matchOddsSnapshot,
  tickets,
  pairedBaselineTickets,
  stake,
}) {
  if (!roundId) throw new Error('Missing roundId');
  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('Missing tickets array');
  }

  const ledger = loadProspectiveLedger(platform);
  const exists = ledger.records.some(r => String(r.roundId) === String(roundId));
  if (exists) {
    throw new Error(`Round ${roundId} is already pre-registered in ${platform} prospective ledger.`);
  }

  const numMatches = platform === '1xbet' ? 14 : 12;
  const commit = gitCommit || getCurrentGitCommit();
  const now = new Date().toISOString();

  // If paired baseline tickets are not provided, generate them deterministically
  let baseline = pairedBaselineTickets;
  if (!baseline || !Array.isArray(baseline) || baseline.length === 0) {
    const rng = createSeededRandom(parseInt(roundId, 10) + 1337);
    baseline = [];
    for (let t = 0; t < tickets.length; t++) {
      const line = [];
      for (let m = 0; m < numMatches; m++) {
        const rand = Math.floor(rng() * 3) + 1;
        line.push(rand === 1 ? '1' : rand === 2 ? 'X' : '2');
      }
      baseline.push(line.join(''));
    }
  }

  const frozenConstraints = platform === '1xbet'
    ? { minDraws: 2, maxDraws: 5, minHomes: 5, maxHomes: 9, minDistance: 2, maxDistance: 4 }
    : { minDraws: 2, maxDraws: 5, minHomes: 3, maxHomes: 9, minDistance: 2, maxDistance: 4 };

  const deadlineMs = typeof deadline === 'number' ? deadline : new Date(deadline).getTime();

  const commitmentPayload = {
    protocolVersion: '1.6.0',
    roundId: String(roundId),
    deadline: deadlineMs,
    earliestKickoff: new Date(earliestKickoff).toISOString(),
    oddsSource: oddsSource || (platform === '1xbet' ? 'ONEXBET_TOTO_14_OFFICIAL_PRE_MATCH' : 'SPORTYBET_NG_OFFICIAL_PRE_MATCH'),
    oddsCapturedAt: oddsCapturedAt || now,
    gitCommit: commit,
    strategy: 'BALANCED_COVER',
    frozenBeamWidth: 2000,
    frozenConstraints,
    scoringRules: platform === '1xbet' ? 'ONEXBET_TOTO_14_PARIMUTUEL' : 'SPORTYBET_SUPER_12_PARIMUTUEL',
    stake: stake || (platform === '1xbet' ? 3200 : 800),
    matchOddsSnapshot: (matchOddsSnapshot || []).map((m, idx) => ({
      no: m.no || idx + 1,
      home: m.home,
      away: m.away,
      odds: {
        home: m.odds?.home ?? null,
        draw: m.odds?.draw ?? null,
        away: m.odds?.away ?? null
      }
    })),
    pairedBaselineTickets: [...baseline].sort(),
    tickets: [...tickets].sort()
  };

  const canonicalHash = computeCanonicalCommitmentHash(commitmentPayload);

  const fullRecord = {
    ...commitmentPayload,
    tickets: [...tickets], // natural order
    pairedBaselineTickets: [...baseline],
    registeredAt: now,
    status: 'PRE_REGISTERED',
    sha256: canonicalHash,
    auditTrail: [
      {
        event: 'PRE_REGISTERED',
        timestamp: now,
        gitCommit: commit,
        canonicalHash,
        ticketsCount: tickets.length
      }
    ]
  };

  ledger.records.push(fullRecord);
  saveProspectiveLedger(ledger, platform);

  // Independent disk verification check
  const diskLedger = loadProspectiveLedger(platform);
  const diskRecord = diskLedger.records.find(r => String(r.roundId) === String(roundId));
  const recomputedDiskHash = computeCanonicalCommitmentHash(diskRecord);
  if (recomputedDiskHash !== canonicalHash) {
    throw new Error(`Integrity verification failed! Disk hash ${recomputedDiskHash} !== computed ${canonicalHash}`);
  }

  return {
    success: true,
    roundId: String(roundId),
    canonicalHash,
    record: fullRecord,
    updatedLedger: ledger
  };
}

