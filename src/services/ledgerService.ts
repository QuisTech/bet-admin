import type { LoggedBet, BetOutcome } from '../types';

const LEDGER_STORAGE_KEY = 'bet_admin_logged_positions';

/**
 * Initial historical seed: Matches user's exact executed 1xBet positions from 24/09/2026.
 */
const INITIAL_SEED_BETS: LoggedBet[] = [
  {
    id: 'seed-bet-1',
    timestamp: '2026-09-24T15:41:00Z',
    dateDisplay: '24/09/2026 15:41',
    league: 'UEFA Nations League',
    match: 'Netherlands vs Germany',
    selection: 'Netherlands Win (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 3.88,
    pinnacleLineAtBet: 3.71,
    pinnacleClosingLine: 3.71,
    modelProb: 0.302,
    modelEV: 17.2,
    stake: 400,
    payout: 1552,
    outcome: 'WON',
    clvPercent: 4.58,
    notes: 'Value longshot winner; covered 5 multi-match losses',
  },
  {
    id: 'seed-bet-2',
    timestamp: '2026-09-24T16:27:00Z',
    dateDisplay: '24/09/2026 16:27',
    league: 'UEFA Nations League',
    match: 'Andorra vs Malta',
    selection: 'Andorra Win (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.045,
    pinnacleLineAtBet: 3.90,
    pinnacleClosingLine: 3.90,
    modelProb: 0.358,
    modelEV: 43.1,
    stake: 400,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 3.72,
    notes: 'Model overlay at 4.045 vs sharp 3.90',
  },
  {
    id: 'seed-bet-3',
    timestamp: '2026-09-24T16:09:00Z',
    dateDisplay: '24/09/2026 16:09',
    league: 'UEFA Nations League',
    match: 'Portugal vs Wales',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 8.20,
    pinnacleLineAtBet: 7.63,
    pinnacleClosingLine: 7.63,
    modelProb: 0.176,
    modelEV: 58.4,
    stake: 365,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 7.47,
    notes: 'Fractional-Kelly sized below 2% cap',
  },
  {
    id: 'seed-bet-4',
    timestamp: '2026-09-24T15:38:00Z',
    dateDisplay: '24/09/2026 15:38',
    league: 'UEFA Nations League',
    match: 'Liechtenstein vs Lithuania',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.905,
    pinnacleLineAtBet: 4.30,
    pinnacleClosingLine: 4.30,
    modelProb: 0.249,
    modelEV: 24.5,
    stake: 213,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 14.07,
    notes: 'Kelly sized at 1.07% bankroll',
  },
  {
    id: 'seed-bet-5',
    timestamp: '2026-09-24T16:01:00Z',
    dateDisplay: '24/09/2026 16:01',
    league: 'UEFA Nations League',
    match: 'Austria vs Israel',
    selection: 'Value Selection',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.855,
    pinnacleLineAtBet: 4.40,
    pinnacleClosingLine: 4.40,
    modelProb: 0.220,
    modelEV: 16.8,
    stake: 144,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 10.34,
    notes: 'Sized to 0.72% bankroll',
  },
  {
    id: 'seed-bet-6',
    timestamp: '2026-09-24T12:17:00Z',
    dateDisplay: '24/09/2026 12:17',
    league: 'Friendlies',
    match: 'Japan vs Uruguay',
    selection: 'Value Test Selection',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 2.35,
    pinnacleLineAtBet: 2.30,
    pinnacleClosingLine: 2.30,
    modelProb: 0.420,
    modelEV: 8.5,
    stake: 100,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 2.17,
    notes: 'Exploratory micro-stake test',
  },
  {
    id: 'seed-bet-7',
    timestamp: '2026-09-24T11:10:00Z',
    dateDisplay: '24/09/2026 11:10',
    league: 'Premier League',
    match: 'Coventry City vs Newcastle United',
    selection: 'Coventry or Draw (1X)',
    marketType: '1X',
    bookmaker: '1xBet',
    priceTaken: 1.758,
    pinnacleLineAtBet: 1.71,
    pinnacleClosingLine: 1.71,
    modelProb: 0.636,
    modelEV: 11.8,
    stake: 400,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 2.81,
    notes: 'Active early CLV position for Oct 12',
  },
  {
    id: '87840835081',
    timestamp: '2026-09-25T15:57:00Z',
    dateDisplay: '25/09/2026 16:57',
    league: 'UEFA Nations League',
    match: 'Italy vs Belgium',
    selection: 'Italy Win (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 2.22,
    pinnacleLineAtBet: 1.99,
    pinnacleClosingLine: 1.99,
    modelProb: 0.504,
    modelEV: 12.8,
    stake: 400,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 11.56,
    notes: 'Bet slip № 87840835081 • Finished 0:2',
  },
];

export function getLoggedBets(): LoggedBet[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_SEED_BETS;
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(INITIAL_SEED_BETS));
      return INITIAL_SEED_BETS;
    }
    const parsed: LoggedBet[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_SEED_BETS;

    // Ensure official bet slips (such as 87840835081) are merged if missing
    let modified = false;
    for (const seed of INITIAL_SEED_BETS) {
      if (!parsed.some((b) => b.id === seed.id || (b.match === seed.match && b.timestamp === seed.timestamp))) {
        parsed.push(seed);
        modified = true;
      }
    }
    if (modified) {
      parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch (e) {
    console.error('Failed to read ledger from localStorage:', e);
    return INITIAL_SEED_BETS;
  }
}

export function saveLoggedBets(bets: LoggedBet[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(bets));
    }
  } catch (e) {
    console.error('Failed to write ledger to localStorage:', e);
  }
}

export function addLoggedBet(
  betData: Omit<LoggedBet, 'id' | 'timestamp' | 'dateDisplay' | 'clvPercent'>
): LoggedBet {
  const now = new Date();
  const closingRef = betData.pinnacleClosingLine || betData.pinnacleLineAtBet;
  const clv = closingRef > 0 ? Math.round(((betData.priceTaken / closingRef) - 1.0) * 1000) / 10 : 0;

  const newBet: LoggedBet = {
    ...betData,
    id: `bet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    dateDisplay: now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    clvPercent: clv,
  };

  const existing = getLoggedBets();
  const updated = [newBet, ...existing];
  saveLoggedBets(updated);
  return newBet;
}

export function updateBetOutcome(
  id: string,
  outcome: BetOutcome,
  customPayout?: number
): LoggedBet[] {
  const existing = getLoggedBets();
  const updated = existing.map((b) => {
    if (b.id !== id) return b;
    let payout = 0;
    if (outcome === 'WON') {
      payout = customPayout !== undefined ? customPayout : Math.round(b.stake * b.priceTaken);
    } else if (outcome === 'PUSH') {
      payout = b.stake;
    }
    return {
      ...b,
      outcome,
      payout,
    };
  });
  saveLoggedBets(updated);
  return updated;
}

export function deleteLoggedBet(id: string): LoggedBet[] {
  const existing = getLoggedBets();
  const updated = existing.filter((b) => b.id !== id);
  saveLoggedBets(updated);
  return updated;
}

export function resetLedgerToSeed(): LoggedBet[] {
  saveLoggedBets(INITIAL_SEED_BETS);
  return INITIAL_SEED_BETS;
}

export interface LedgerStatistics {
  totalBets: number;
  settledBets: number;
  openBets: number;
  totalStaked: number;
  openExposure: number;
  totalPayout: number;
  netProfit: number;
  roiPercent: number;
  winCount: number;
  lossCount: number;
  pushCount: number;
  hitRatePercent: number;
  expectedHitRatePercent: number;
  avgCLVPercent: number;
  brierScore: number;
  maxDrawdownNGN: number;
  maxDrawdownPercent: number;
}

export function calculateLedgerStats(bets: LoggedBet[]): LedgerStatistics {
  const settled = bets.filter((b) => b.outcome !== 'OPEN');
  const open = bets.filter((b) => b.outcome === 'OPEN');

  const totalBets = bets.length;
  const settledBets = settled.length;
  const openBets = open.length;

  const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
  const openExposure = open.reduce((sum, b) => sum + b.stake, 0);
  const totalPayout = settled.reduce((sum, b) => sum + b.payout, 0);
  const netProfit = totalPayout - totalStaked;
  const roiPercent = totalStaked > 0 ? Math.round((netProfit / totalStaked) * 1000) / 10 : 0;

  const winCount = settled.filter((b) => b.outcome === 'WON').length;
  const lossCount = settled.filter((b) => b.outcome === 'LOST').length;
  const pushCount = settled.filter((b) => b.outcome === 'PUSH').length;

  const hitRatePercent =
    settledBets > 0 ? Math.round((winCount / settledBets) * 1000) / 10 : 0;

  // Expected Hit Rate based on Model predicted probabilities
  const expectedHitRatePercent =
    settledBets > 0
      ? Math.round((settled.reduce((sum, b) => sum + b.modelProb, 0) / settledBets) * 1000) / 10
      : 0;

  // Average CLV across bets with CLV
  const clvBets = bets.filter((b) => b.clvPercent !== undefined && b.clvPercent !== null);
  const avgCLVPercent =
    clvBets.length > 0
      ? Math.round((clvBets.reduce((sum, b) => sum + (b.clvPercent || 0), 0) / clvBets.length) * 10) / 10
      : 0;

  // Brier Calibration Score: 1/N * sum((p_i - outcome_i)^2)
  let brierScore = 0;
  if (settledBets > 0) {
    const brierSum = settled.reduce((sum, b) => {
      const actualOutcome = b.outcome === 'WON' ? 1.0 : 0.0;
      return sum + Math.pow(b.modelProb - actualOutcome, 2);
    }, 0);
    brierScore = Math.round((brierSum / settledBets) * 1000) / 1000;
  }

  // Drawdown tracking across chronological settled bets
  let peak = 0;
  let runningPnL = 0;
  let maxDrawdownNGN = 0;

  const chronological = [...settled].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const b of chronological) {
    const pnl = b.payout - b.stake;
    runningPnL += pnl;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const dd = peak - runningPnL;
    if (dd > maxDrawdownNGN) {
      maxDrawdownNGN = dd;
    }
  }

  const maxDrawdownPercent =
    totalStaked > 0 ? Math.round((maxDrawdownNGN / totalStaked) * 1000) / 10 : 0;

  return {
    totalBets,
    settledBets,
    openBets,
    totalStaked,
    openExposure,
    totalPayout,
    netProfit,
    roiPercent,
    winCount,
    lossCount,
    pushCount,
    hitRatePercent,
    expectedHitRatePercent,
    avgCLVPercent,
    brierScore,
    maxDrawdownNGN,
    maxDrawdownPercent,
  };
}

export interface ActualBankrollPoint {
  index: number;
  betId?: string;
  match?: string;
  selection?: string;
  dateDisplay?: string;
  outcome?: BetOutcome;
  stake: number;
  payout: number;
  pnl: number;
  runningBankroll: number;
}

export function getActualBankrollTrajectory(
  initialBankroll: number,
  bets?: LoggedBet[]
): ActualBankrollPoint[] {
  const allBets = bets || getLoggedBets();
  const settled = allBets.filter((b) => b.outcome !== 'OPEN');
  const chronological = [...settled].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let current = initialBankroll;
  const trajectory: ActualBankrollPoint[] = [
    {
      index: 0,
      stake: 0,
      payout: 0,
      pnl: 0,
      runningBankroll: current,
      dateDisplay: 'Start Baseline',
      match: 'Starting Capital',
    },
  ];

  chronological.forEach((b, i) => {
    const pnl = b.payout - b.stake;
    current += pnl;
    trajectory.push({
      index: i + 1,
      betId: b.id,
      match: b.match,
      selection: b.selection,
      dateDisplay: b.dateDisplay,
      outcome: b.outcome,
      stake: b.stake,
      payout: b.payout,
      pnl,
      runningBankroll: current,
    });
  });

  return trajectory;
}

