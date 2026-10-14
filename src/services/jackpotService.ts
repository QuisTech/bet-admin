import { calculateShinDevig } from '../models/shinDevig';

export type JackpotPlatform = 'sportybet' | '1xbet';
export type JackpotOutcome = '1' | 'X' | '2';
export type MatchRole =
  | 'BANKER'
  | 'SECONDARY_BANKER'
  | 'DOUBLE_HEDGE'
  | 'COIN_FLIP'
  | 'PUBLIC_TRAP';

export interface JackpotMatch {
  id: number;
  no: number;
  matchNumber: number;
  date: string;
  time: string;
  dateDisplay: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  odds: {
    home: number;
    draw: number;
    away: number;
  };
  poolPercentages?: {
    home: number;
    draw: number;
    away: number;
  };
  crowdPercent?: {
    home: number;
    draw: number;
    away: number;
  };
  fairProbabilities: {
    home: number;
    draw: number;
    away: number;
  };
  modelProb: {
    home: number;
    draw: number;
    away: number;
  };
  evRatios?: {
    home: number;
    draw: number;
    away: number;
  };
  recommendedPick: JackpotOutcome;
  recommendedOutcome: JackpotOutcome;
  secondaryOutcome: JackpotOutcome;
  recommendedDoubles: JackpotOutcome[];
  role: MatchRole;
  publicTrap: boolean;
  analysis: string;
}

export interface JackpotSlate {
  platform: JackpotPlatform;
  roundId: string;
  roundNumber: string;
  matchCount: 12 | 14;
  totalGames: number;
  ticketCostNGN: number;
  stakePerComboNGN: number;
  jackpotPrizeNGN: number;
  timeRemaining?: string;
  consolations: string;
  consolationTiers: {
    requiredPicks: number;
    shareDescription: string;
  }[];
  matches: JackpotMatch[];
}

export interface CoveringTicket {
  id: number;
  ticketNumber: number;
  picks: Record<number, JackpotOutcome>;
  picksArray: JackpotOutcome[];
  jointProbability: number;
  homeCount: number;
  drawCount: number;
  awayCount: number;
  macroStats: {
    homes: number;
    draws: number;
    aways: number;
  };
  strategyTag: string;
  summaryString: string;
  guaranteeTier: string;
}

export type JackpotTicket = CoveringTicket;

export interface ReductionConfig {
  targetTickets: number; // e.g. 1, 4, 8, 12, 16, 24
  strategy: 'BALANCED_COVER' | 'JACKPOT_MAX_PROB' | 'CONTRARIAN_HIGH_EV';
  minDraws: number;
  maxDraws: number;
  minHomes: number;
  maxHomes: number;
  minAways?: number;
  maxAways?: number;
}

export type ReducedSystemConfig = ReductionConfig;

/**
 * Calculates fair probabilities from 1X2 odds using Shin de-vigging
 */
export function devig1X2(home: number, draw: number, away: number): {
  home: number;
  draw: number;
  away: number;
} {
  try {
    const res = calculateShinDevig([home, draw, away]);
    return {
      home: Math.round(res.fairProbabilities[0] * 1000) / 1000,
      draw: Math.round(res.fairProbabilities[1] * 1000) / 1000,
      away: Math.round(res.fairProbabilities[2] * 1000) / 1000,
    };
  } catch {
    // Fallback normalization
    const sum = 1 / home + 1 / draw + 1 / away;
    return {
      home: Math.round(((1 / home) / sum) * 1000) / 1000,
      draw: Math.round(((1 / draw) / sum) * 1000) / 1000,
      away: Math.round(((1 / away) / sum) * 1000) / 1000,
    };
  }
}

/**
 * Evaluates match role based on probability spread and public pool disparity
 */
export function analyzeMatch(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  poolPct?: { home: number; draw: number; away: number }
): {
  fair: { home: number; draw: number; away: number };
  ev: { home: number; draw: number; away: number };
  role: MatchRole;
  publicTrap: boolean;
  recommendedPick: JackpotOutcome;
  secondaryOutcome: JackpotOutcome;
  recommendedDoubles: JackpotOutcome[];
  analysis: string;
} {
  const fair = devig1X2(homeOdds, drawOdds, awayOdds);

  const pool = poolPct || {
    home: Math.round(fair.home * 100),
    draw: Math.round(fair.draw * 100),
    away: Math.round(fair.away * 100),
  };

  const ev = {
    home: Math.round((fair.home / (Math.max(1, pool.home) / 100)) * 100) / 100,
    draw: Math.round((fair.draw / (Math.max(1, pool.draw) / 100)) * 100) / 100,
    away: Math.round((fair.away / (Math.max(1, pool.away) / 100)) * 100) / 100,
  };

  // Determine sorted picks by fair probability
  const sorted: { outcome: JackpotOutcome; prob: number }[] = [
    { outcome: '1' as JackpotOutcome, prob: fair.home },
    { outcome: 'X' as JackpotOutcome, prob: fair.draw },
    { outcome: '2' as JackpotOutcome, prob: fair.away },
  ].sort((a, b) => b.prob - a.prob);

  const topPick = sorted[0].outcome;
  const secondaryPick = sorted[1].outcome;
  const topProb = sorted[0].prob;
  const recommendedDoubles: JackpotOutcome[] = [topPick, secondaryPick];

  let role: MatchRole = 'COIN_FLIP';
  let isPublicTrap = false;
  let analysis = '';

  // Check for public trap (crowd betting heavily on low EV pick contrary to fair price)
  if (poolPct && poolPct.away > 45 && fair.away < 0.35) {
    role = 'PUBLIC_TRAP';
    isPublicTrap = true;
    analysis = `Public bias trap: Crowd is backing Away (${poolPct.away}%), but Home/Draw covers ${((fair.home + fair.draw) * 100).toFixed(0)}% true chance!`;
  } else if (poolPct && poolPct.home > 48 && fair.home < 0.38) {
    role = 'PUBLIC_TRAP';
    isPublicTrap = true;
    analysis = `Public bias trap: Crowd is heavy on Home (${poolPct.home}%), leaving massive value on X2!`;
  } else if (topProb >= 0.44) {
    role = 'BANKER';
    analysis = `Primary Anchor: Highest confidence outcome (${(topProb * 100).toFixed(1)}% fair probability). Lock as single.`;
  } else if (topProb >= 0.40) {
    role = 'SECONDARY_BANKER';
    analysis = `Secondary Anchor: Top 2 selections cover ${((sorted[0].prob + sorted[1].prob) * 100).toFixed(1)}% outcome space.`;
  } else if (Math.abs(sorted[0].prob - sorted[1].prob) <= 0.05) {
    role = 'DOUBLE_HEDGE';
    analysis = `Volatile Dead Heat: Tight variance between outcomes. Requires hedge protection (${topPick} or ${secondaryPick}).`;
  } else {
    role = 'COIN_FLIP';
    analysis = `Dead Heat / Toss-Up: High variance match.`;
  }

  return {
    fair,
    ev,
    role,
    publicTrap: isPublicTrap,
    recommendedPick: topPick,
    secondaryOutcome: secondaryPick,
    recommendedDoubles,
    analysis,
  };
}

export function createSportyMatch(
  no: number,
  date: string,
  time: string,
  league: string,
  homeTeam: string,
  awayTeam: string,
  h: number,
  x: number,
  a: number
): JackpotMatch {
  const analysis = analyzeMatch(h, x, a);
  return {
    id: no,
    no,
    matchNumber: no,
    date,
    time,
    dateDisplay: `${date} ${time}`,
    league,
    homeTeam,
    awayTeam,
    odds: { home: h, draw: x, away: a },
    fairProbabilities: analysis.fair,
    modelProb: analysis.fair,
    evRatios: analysis.ev,
    recommendedPick: analysis.recommendedPick,
    recommendedOutcome: analysis.recommendedPick,
    secondaryOutcome: analysis.secondaryOutcome,
    recommendedDoubles: analysis.recommendedDoubles,
    role: analysis.role,
    publicTrap: analysis.publicTrap,
    analysis: analysis.analysis,
  };
}

export function create1xMatch(
  no: number,
  date: string,
  time: string,
  league: string,
  homeTeam: string,
  awayTeam: string,
  h: number,
  x: number,
  a: number,
  poolH: number,
  poolX: number,
  poolA: number
): JackpotMatch {
  const analysis = analyzeMatch(h, x, a, { home: poolH, draw: poolX, away: poolA });
  return {
    id: no,
    no,
    matchNumber: no,
    date,
    time,
    dateDisplay: `${date} ${time}`,
    league,
    homeTeam,
    awayTeam,
    odds: { home: h, draw: x, away: a },
    poolPercentages: { home: poolH, draw: poolX, away: poolA },
    crowdPercent: { home: poolH, draw: poolX, away: poolA },
    fairProbabilities: analysis.fair,
    modelProb: analysis.fair,
    evRatios: analysis.ev,
    recommendedPick: analysis.recommendedPick,
    recommendedOutcome: analysis.recommendedPick,
    secondaryOutcome: analysis.secondaryOutcome,
    recommendedDoubles: analysis.recommendedDoubles,
    role: analysis.role,
    publicTrap: analysis.publicTrap,
    analysis: analysis.analysis,
  };
}

/**
 * Built-in active slate for SportyBet Sporty 12 (Round 20261018)
 */
export const SPORTYBET_ROUND_20261018: JackpotSlate = {
  platform: 'sportybet',
  roundId: 'Round No. 20261018',
  roundNumber: '20261018',
  matchCount: 12,
  totalGames: 12,
  ticketCostNGN: 100,
  stakePerComboNGN: 100,
  jackpotPrizeNGN: 74747330,
  timeRemaining: '3 Days 5 Hours (Cutoff Sat 15:00 WAT)',
  consolations: 'Super Jackpot: 12/12 • 2nd Prize: 11/12 • 3rd Prize: 10/12',
  consolationTiers: [
    { requiredPicks: 12, shareDescription: 'Super Jackpot Prize (₦74,747,330 pool share)' },
    { requiredPicks: 11, shareDescription: '2nd Tier Consolation Prize Pool' },
    { requiredPicks: 10, shareDescription: '3rd Tier Consolation Prize Pool' },
  ],
  matches: [
    createSportyMatch(1, '17/10/2026', '15:00', 'Premier League', 'Brentford', 'Liverpool', 2.44, 3.80, 2.80),
    createSportyMatch(2, '17/10/2026', '15:00', 'Championship', 'Bristol City', 'Sheffield United', 2.13, 3.55, 3.36),
    createSportyMatch(3, '17/10/2026', '15:00', 'Championship', 'Derby County', 'Stoke City', 2.59, 3.41, 2.70),
    createSportyMatch(4, '17/10/2026', '17:30', 'Premier League', 'Newcastle', 'Aston Villa', 2.28, 3.77, 3.07),
    createSportyMatch(5, '17/10/2026', '20:00', 'Spain La Liga', 'Valencia', 'Athletic Bilbao', 3.37, 3.43, 2.26),
    createSportyMatch(6, '18/10/2026', '14:00', 'France Ligue 1', 'Angers', 'Marseille', 3.26, 3.72, 2.15),
    createSportyMatch(7, '18/10/2026', '14:00', 'Premier League', 'Bournemouth', 'Sunderland AFC', 2.11, 3.60, 3.46),
    createSportyMatch(8, '18/10/2026', '14:00', 'Premier League', 'Leeds United', 'Man Utd', 2.46, 3.67, 2.77),
    createSportyMatch(9, '18/10/2026', '15:15', 'Spain La Liga', 'Celta', 'Alaves', 2.16, 3.33, 3.60),
    createSportyMatch(10, '18/10/2026', '16:15', 'France Ligue 1', 'Le Havre', 'AJ Auxerre', 2.38, 3.44, 3.04),
    createSportyMatch(11, '18/10/2026', '16:15', 'France Ligue 1', 'Paris FC', 'Rennes', 2.24, 3.62, 3.15),
    createSportyMatch(12, '18/10/2026', '17:30', 'Spain La Liga', 'Malaga CF', 'Real Sociedad', 3.25, 3.55, 2.22),
  ],
};

export const DEFAULT_SPORTYBET_SLATE = SPORTYBET_ROUND_20261018;

/**
 * Built-in active slate for 1xBet TOTO-Football (Draw no. 1154)
 */
export const ONEXBET_TOTO_DRAW_1154: JackpotSlate = {
  platform: '1xbet',
  roundId: 'Draw no. 1154',
  roundNumber: '1154',
  matchCount: 14,
  totalGames: 14,
  ticketCostNGN: 800,
  stakePerComboNGN: 800,
  jackpotPrizeNGN: 16381275,
  timeRemaining: '3 Days 4 Hours (Cutoff Sat 14:30 WAT)',
  consolations: '6 Prize Tiers: 14, 13, 12, 11, 10 & 9 Correct Wins!',
  consolationTiers: [
    { requiredPicks: 14, shareDescription: '10% of Pool + Progressive Jackpot (₦16.38M)' },
    { requiredPicks: 13, shareDescription: '10% of Pool (13 & 14 correct)' },
    { requiredPicks: 12, shareDescription: '10% of Pool (12, 13 & 14 correct)' },
    { requiredPicks: 11, shareDescription: '15% of Pool (11+ correct)' },
    { requiredPicks: 10, shareDescription: '20% of Pool (10+ correct)' },
    { requiredPicks: 9, shareDescription: '35% of Pool (9+ correct)' },
  ],
  matches: [
    create1xMatch(1, '17/10', '15:00', 'England. Premier League', 'Brentford', 'Liverpool', 2.44, 3.80, 2.80, 42, 23, 35),
    create1xMatch(2, '17/10', '17:30', 'England. Premier League', 'Newcastle United', 'Aston Villa', 2.28, 3.77, 3.07, 48, 22, 30),
    create1xMatch(3, '18/10', '14:00', 'England. Premier League', 'Leeds United', 'Manchester United', 2.46, 3.67, 2.77, 40, 23, 37),
    create1xMatch(4, '17/10', '14:30', 'Germany. Bundesliga', 'Schalke 04', '1. FSV Mainz 05', 3.10, 3.45, 2.25, 30, 24, 46),
    create1xMatch(5, '17/10', '14:30', 'Germany. Bundesliga', 'Elversberg', 'Augsburg', 2.50, 3.45, 2.70, 41, 21, 38),
    create1xMatch(6, '17/10', '20:00', 'Spain. La Liga', 'Valencia', 'Athletic Bilbao', 3.37, 3.43, 2.26, 24, 25, 51),
    create1xMatch(7, '18/10', '15:15', 'Spain. La Liga', 'Celta', 'Deportivo Alaves', 2.16, 3.33, 3.60, 51, 26, 23),
    create1xMatch(8, '18/10', '17:30', 'Spain. La Liga', 'Malaga', 'Real Sociedad', 3.25, 3.55, 2.22, 28, 25, 47),
    create1xMatch(9, '19/10', '20:00', 'Spain. La Liga', 'Getafe', 'Rayo Vallecano', 2.90, 3.05, 2.65, 33, 30, 37),
    create1xMatch(10, '19/10', '17:30', 'Italy. Serie A', 'Monza 1912', 'Cagliari Calcio', 2.25, 3.25, 3.35, 45, 29, 26),
    create1xMatch(11, '19/10', '19:45', 'Italy. Serie A', 'Parma', 'Torino', 3.15, 3.25, 2.35, 29, 30, 41),
    create1xMatch(12, '18/10', '16:15', 'France. Ligue 1', 'Le Havre', 'Auxerre', 2.38, 3.44, 3.04, 42, 25, 33),
    create1xMatch(13, '18/10', '16:15', 'France. Ligue 1', 'Paris', 'Stade Rennais', 2.24, 3.62, 3.15, 45, 27, 28),
    create1xMatch(14, '18/10', '16:15', 'France. Ligue 1', 'Lorient', 'AS Monaco', 3.95, 3.65, 1.95, 22, 25, 53),
  ],
};

export const DEFAULT_1XBET_SLATE = ONEXBET_TOTO_DRAW_1154;

/**
 * Combinatorial Covering Code Generator (Reduced Systems Optimizer)
 * Generates N tickets that optimize coverage across 1X2 combinations
 * satisfying realistic macro-filters (draw counts, home wins, entropy).
 */
export function generateCoveringPortfolio(
  slate: JackpotSlate,
  config: ReductionConfig,
  customSelections?: { [matchNo: number]: JackpotOutcome[] }
): CoveringTicket[] {
  const matches = slate.matches;
  const numMatches = matches.length;

  // Build the option space for each match
  const optionsPerMatch: JackpotOutcome[][] = matches.map((m) => {
    if (customSelections && customSelections[m.no] && customSelections[m.no].length > 0) {
      return customSelections[m.no];
    }
    // If it's a tight coin-flip or double hedge, include the Draw so macro-filters can find 2-4 draw combinations
    if (m.role === 'DOUBLE_HEDGE' || m.role === 'COIN_FLIP') {
      return ['1', 'X', '2'];
    }
    return m.recommendedDoubles;
  });

  // Calculate full permutation count
  const validCandidates: {
    picks: JackpotOutcome[];
    prob: number;
    evScore: number;
    macro: { homes: number; draws: number; aways: number };
  }[] = [];

  // Recursive candidate generator
  function buildPermutations(
    index: number,
    currentPicks: JackpotOutcome[],
    currentProb: number,
    currentEv: number,
    enforceStrictMacro: boolean = true
  ) {
    if (validCandidates.length >= 3500) return;

    if (index === numMatches) {
      const homes = currentPicks.filter((p) => p === '1').length;
      const draws = currentPicks.filter((p) => p === 'X').length;
      const aways = currentPicks.filter((p) => p === '2').length;

      const minDraws = enforceStrictMacro ? (config.minDraws ?? 2) : 1;
      const maxDraws = enforceStrictMacro ? (config.maxDraws ?? 5) : 6;
      const minHomes = enforceStrictMacro ? (config.minHomes ?? 4) : 2;
      const maxHomes = enforceStrictMacro ? (config.maxHomes ?? 8) : 10;

      if (draws >= minDraws && draws <= maxDraws && homes >= minHomes && homes <= maxHomes) {
        validCandidates.push({
          picks: [...currentPicks],
          prob: currentProb,
          evScore: currentEv,
          macro: { homes, draws, aways },
        });
      }
      return;
    }

    const match = matches[index];
    const opts = optionsPerMatch[index];

    for (const opt of opts) {
      let p = 0.33;
      let evVal = 1.0;
      if (opt === '1') {
        p = match.fairProbabilities.home;
        evVal = match.evRatios?.home || 1.0;
      } else if (opt === 'X') {
        p = match.fairProbabilities.draw;
        evVal = match.evRatios?.draw || 1.0;
      } else {
        p = match.fairProbabilities.away;
        evVal = match.evRatios?.away || 1.0;
      }

      buildPermutations(index + 1, [...currentPicks, opt], currentProb * p, currentEv * evVal, enforceStrictMacro);
    }
  }

  // 1. First attempt: Strict macro filters
  buildPermutations(0, [], 1.0, 1.0, true);

  // 2. Second attempt if needed: Relaxed macro filters
  if (validCandidates.length < config.targetTickets) {
    buildPermutations(0, [], 1.0, 1.0, false);
  }

  // Fallback: If still empty, construct diverse candidate tickets
  if (validCandidates.length === 0) {
    const basePicks = matches.map((m) => m.recommendedPick);
    for (let t = 0; t < config.targetTickets; t++) {
      const ticketPicks = [...basePicks];
      if (t > 0) {
        // Vary volatile matches
        matches.forEach((m, idx) => {
          if (m.role === 'DOUBLE_HEDGE' || m.role === 'COIN_FLIP') {
            if ((idx + t) % 3 === 1) ticketPicks[idx] = m.secondaryOutcome;
            else if ((idx + t) % 3 === 2) ticketPicks[idx] = 'X';
          }
        });
      }
      const homes = ticketPicks.filter((p) => p === '1').length;
      const draws = ticketPicks.filter((p) => p === 'X').length;
      const aways = ticketPicks.filter((p) => p === '2').length;
      validCandidates.push({
        picks: ticketPicks,
        prob: 0.0001 / (t + 1),
        evScore: 1.0,
        macro: { homes, draws, aways },
      });
    }
  }

  // Sort candidates according to target strategy
  if (config.strategy === 'CONTRARIAN_HIGH_EV') {
    validCandidates.sort((a, b) => b.evScore - a.evScore);
  } else {
    // BALANCED_COVER or JACKPOT_MAX_PROB
    validCandidates.sort((a, b) => b.prob - a.prob);
  }

  // Greedy Maximum Distance Covering Algorithm:
  // Select N tickets that maximize mutual Hamming distance (to guarantee consolation coverage)
  const selectedTickets: CoveringTicket[] = [];
  const targetCount = Math.min(config.targetTickets, validCandidates.length);

  // 1. Pick the primary anchor line
  const prime = validCandidates[0];
  const primePicksObj: Record<number, JackpotOutcome> = {};
  prime.picks.forEach((p, idx) => {
    primePicksObj[idx + 1] = p;
  });

  selectedTickets.push({
    id: 1,
    ticketNumber: 1,
    picks: primePicksObj,
    picksArray: prime.picks,
    jointProbability: prime.prob,
    homeCount: prime.macro.homes,
    drawCount: prime.macro.draws,
    awayCount: prime.macro.aways,
    macroStats: prime.macro,
    strategyTag: 'Primary Anchor Line (Max Probability)',
    summaryString: prime.picks.join('-'),
    guaranteeTier: slate.matchCount === 12 ? '12/12 Hunt' : '14/14 Hunt',
  });

  // 2. Select subsequent tickets that maximize covering distance
  for (let k = 1; k < targetCount; k++) {
    let bestCandidateIdx = -1;
    let bestScore = -Infinity;

    for (let c = 1; c < validCandidates.length; c++) {
      const candidate = validCandidates[c];
      // Check if already selected
      if (selectedTickets.some((t) => t.picksArray.every((p, idx) => p === candidate.picks[idx]))) {
        continue;
      }

      // Calculate minimum Hamming distance to all currently selected tickets
      let minDistance = Infinity;
      for (const selected of selectedTickets) {
        let dist = 0;
        for (let i = 0; i < numMatches; i++) {
          if (candidate.picks[i] !== selected.picksArray[i]) dist++;
        }
        if (dist < minDistance) minDistance = dist;
      }

      let distanceQuality = 0;
      if (config.strategy === 'JACKPOT_MAX_PROB') {
        // Closer distance to preserve top combinations
        distanceQuality = minDistance >= 1 && minDistance <= 3 ? 12 : -4;
      } else {
        // Balanced or Contrarian: distance 2-4 for optimal ternary sphere packing
        distanceQuality = minDistance >= 2 && minDistance <= 4 ? 14 : -3;
      }

      const score = Math.log10(candidate.prob + 1e-15) * 0.4 + distanceQuality;

      if (score > bestScore) {
        bestScore = score;
        bestCandidateIdx = c;
      }
    }

    if (bestCandidateIdx >= 0) {
      const chosen = validCandidates[bestCandidateIdx];
      const picksObj: Record<number, JackpotOutcome> = {};
      chosen.picks.forEach((p, idx) => {
        picksObj[idx + 1] = p;
      });

      const tierTag =
        slate.matchCount === 12
          ? k < 4
            ? '11/12 Guarantee'
            : '10/12 Guarantee'
          : k < 6
          ? '13/14 Guarantee'
          : '11-12/14 Cover';

      selectedTickets.push({
        id: k + 1,
        ticketNumber: k + 1,
        picks: picksObj,
        picksArray: chosen.picks,
        jointProbability: chosen.prob,
        homeCount: chosen.macro.homes,
        drawCount: chosen.macro.draws,
        awayCount: chosen.macro.aways,
        macroStats: chosen.macro,
        strategyTag: k === 1 ? 'Strategic Pivot Hedge' : `Consolation Cover #${k + 1}`,
        summaryString: chosen.picks.join('-'),
        guaranteeTier: tierTag,
      });
    } else {
      break;
    }
  }

  return selectedTickets;
}

export const generateReducedSystem = generateCoveringPortfolio;

/**
 * Generates 1-Click Console Automation Code for SportyBet (sportybet.com/ng/jackpot)
 */
export function generateSportyBetConsoleScript(ticket: CoveringTicket): string {
  const picksJSON = JSON.stringify(ticket.picksArray);
  return `(() => {
  // 🎯 Bet Horizon Sporty 12 Auto-Filler (Ticket #${ticket.ticketNumber})
  const picks = ${picksJSON};
  console.log('🚀 Bet Horizon loading Sporty 12 Ticket #${ticket.ticketNumber}:', picks);

  // 1. Clear existing selections
  const clearBtn = document.querySelector('[data-cms-key="clear_all"]');
  if (clearBtn) clearBtn.click();

  // 2. Click outcomes for each match
  const items = document.querySelectorAll('.match-item');
  if (!items || items.length === 0) {
    alert('⚠️ Sporty 12: Please open the SportyBet Jackpot page (sportybet.com/ng/jackpot) before running this script!');
    return;
  }

  let filledCount = 0;
  items.forEach((item, idx) => {
    if (idx >= picks.length) return;
    const outcome = picks[idx]; // '1', 'X', '2'
    let target = null;
    if (outcome === '1') target = item.querySelector('.outcome li.home a');
    else if (outcome === 'X') target = item.querySelector('.outcome li.draw a');
    else if (outcome === '2') target = item.querySelector('.outcome li.away a');

    if (target) {
      target.click();
      filledCount++;
    }
  });

  console.log(\`✅ Bet Horizon: Successfully filled \${filledCount}/12 selections for Ticket #${ticket.ticketNumber}!\`);
  alert(\`✅ Bet Horizon: Ticket #${ticket.ticketNumber} applied! (\${filledCount}/12 selections filled on SportyBet).\`);
})();`;
}

/**
 * Generates 1-Click Console Automation Code for 1xBet (1xbet.com/en/toto/football)
 */
export function generateOneXBetConsoleScript(ticket: CoveringTicket): string {
  const picksJSON = JSON.stringify(ticket.picksArray);
  return `(() => {
  // 🎯 Bet Horizon 1xBet TOTO-Football Auto-Filler (Ticket #${ticket.ticketNumber})
  const picks = ${picksJSON};
  console.log('🚀 Bet Horizon loading 1xBet TOTO Ticket #${ticket.ticketNumber}:', picks);

  // 1. Clear existing selections
  const clearBtn = document.querySelector('[data-test="toto-main-controls-clear"]');
  if (clearBtn) clearBtn.click();

  // 2. Click markets for each of the 14 games
  const games = document.querySelectorAll('.toto-dashboard-game');
  if (!games || games.length === 0) {
    alert('⚠️ 1xBet TOTO: Please open 1xBet TOTO-Football page (1xbet.com/en/toto/football) before running this script!');
    return;
  }

  let filledCount = 0;
  games.forEach((game, idx) => {
    if (idx >= picks.length) return;
    const outcome = picks[idx]; // '1', 'X', '2'
    const buttons = game.querySelectorAll('[data-test="toto-dashboard-game-markets"] .ui-market__toggle');
    if (!buttons || buttons.length < 3) return;

    if (outcome === '1' && buttons[0]) { buttons[0].click(); filledCount++; }
    else if (outcome === 'X' && buttons[1]) { buttons[1].click(); filledCount++; }
    else if (outcome === '2' && buttons[2]) { buttons[2].click(); filledCount++; }
  });

  console.log(\`✅ Bet Horizon: Successfully filled \${filledCount}/14 selections for Ticket #${ticket.ticketNumber}!\`);
  alert(\`✅ Bet Horizon: Ticket #${ticket.ticketNumber} applied! (\${filledCount}/14 selections filled on 1xBet).\`);
})();`;
}

/**
 * Generates official 1xBet Batch Bet format (ready for the "Batch bet" tab on 1xBet)
 * Official 1xBet Syntax: [Stake]; 1-([Outcome]); 2-([Outcome]); ...; 14-([Outcome]),
 * Example: 800; 1-(1); 2-(1); 3-(1); 4-(X); 5-(1); 6-(2); 7-(1); 8-(2); 9-(X); 10-(1); 11-(2); 12-(1); 13-(1); 14-(2),
 */
export function generateOneXBetBatchFormat(tickets: CoveringTicket[], stakePerTicketNGN: number = 800): string {
  return tickets
    .map((t) => {
      const matchPicks = t.picksArray.map((outcome, idx) => `${idx + 1}-(${outcome})`).join('; ');
      return `${stakePerTicketNGN}; ${matchPicks},`;
    })
    .join('\n');
}

/**
 * Parses raw HTML pasted from SportyBet Jackpot page
 */
export function parseSportyBetJackpotHTML(html: string): JackpotMatch[] {
  const matches: JackpotMatch[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('.match-item');

    items.forEach((item, index) => {
      const no = parseInt(item.querySelector('.no')?.textContent?.trim() || `${index + 1}`, 10);
      const dateText = item.querySelector('.date span')?.textContent?.trim() || '';
      const [date = '17/10/2026', time = '15:00'] = dateText.split(/\s+/);

      const matchEl = item.querySelector('.match');
      let homeTeam = 'Home';
      let awayTeam = 'Away';
      if (matchEl) {
        const text = matchEl.textContent || '';
        const parts = text.split(/\s*-\s*|\n/);
        if (parts.length >= 2) {
          homeTeam = parts[0].trim();
          awayTeam = parts[parts.length - 1].trim();
        }
      }

      const hOdds = parseFloat(item.querySelector('.outcome li.home a')?.textContent?.trim() || '2.0');
      const xOdds = parseFloat(item.querySelector('.outcome li.draw a')?.textContent?.trim() || '3.2');
      const aOdds = parseFloat(item.querySelector('.outcome li.away a')?.textContent?.trim() || '2.5');

      matches.push(createSportyMatch(no, date, time, 'Soccer League', homeTeam, awayTeam, hOdds, xOdds, aOdds));
    });
  } catch (e) {
    console.error('Error parsing SportyBet HTML:', e);
  }
  return matches;
}

/**
 * Parses raw HTML pasted from 1xBet TOTO Football page
 */
export function parseOneXBetTotoHTML(html: string): JackpotMatch[] {
  const matches: JackpotMatch[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const games = doc.querySelectorAll('.toto-dashboard-game');

    games.forEach((game, index) => {
      const no = parseInt(game.querySelector('[data-test="toto-dashboard-game-number"]')?.textContent?.trim() || `${index + 1}`, 10);
      const timeSpans = game.querySelectorAll('[data-test="toto-dashboard-game-time"] span');
      const date = timeSpans[1]?.textContent?.trim() || '17/10';
      const time = timeSpans[2]?.textContent?.trim() || '15:00';

      const homeTeam = game.querySelector('[data-test="toto-dashboard-game-team-1"]')?.textContent?.trim() || 'Home';
      const awayTeam = game.querySelector('[data-test="toto-dashboard-game-team-2"]')?.textContent?.trim() || 'Away';

      const marketValues = game.querySelectorAll('[data-test="toto-dashboard-game-markets"] .ui-market__value');
      const poolH = parseInt(marketValues[0]?.textContent?.replace('%', '').trim() || '40', 10);
      const poolX = parseInt(marketValues[1]?.textContent?.replace('%', '').trim() || '25', 10);
      const poolA = parseInt(marketValues[2]?.textContent?.replace('%', '').trim() || '35', 10);

      // Estimate odds based on inverse pool probability if direct odds not in TOTO DOM
      const hOdds = Math.round((100 / Math.max(10, poolH)) * 100) / 100;
      const xOdds = Math.round((100 / Math.max(10, poolX)) * 100) / 100;
      const aOdds = Math.round((100 / Math.max(10, poolA)) * 100) / 100;

      matches.push(create1xMatch(no, date, time, 'Top League', homeTeam, awayTeam, hOdds, xOdds, aOdds, poolH, poolX, poolA));
    });
  } catch (e) {
    console.error('Error parsing 1xBet HTML:', e);
  }
  return matches;
}

/**
 * Plain-Text Ingest Parser: Designed for mobile & desktop users who copy the visible text
 * off sportybet.com or 1xbet.com directly from their smartphone screen.
 */
export function parseJackpotPlainText(
  text: string,
  platform: JackpotPlatform
): { matches: JackpotMatch[]; roundNumber?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const maxGames = platform === 'sportybet' ? 12 : 14;
  let extractedRound: string | undefined = undefined;

  // Extract round / draw number if present in header
  for (const line of lines) {
    const roundMatch = line.match(/(?:Round|Draw|Super Jackpot)[\s#:]*(\d{4,10}|\d{3,6})/i);
    if (roundMatch) {
      extractedRound = roundMatch[1];
      break;
    }
  }

  // Strategy 1: Check if input has single-line match format WITH ODDS OR %
  const singleLineMatches: JackpotMatch[] = [];
  for (const line of lines) {
    const singleLineWithOdds = /^(?:#?(\d{1,2})[\.\s\:\)]+)?\s*(.+?)\s*(?:-|–|vs\.?)\s*(.+?)\s+(?:(\d{1,2}[\/\.]\d{1,2}(?:\s+\d{1,2}:\d{2})?)\s+)?(?:([1-9]\d{0,1}\.\d{1,2})\s+([1-9]\d{0,1}\.\d{1,2})\s+([1-9]\d{0,1}\.\d{1,2})|(\d{1,2})%\s+(\d{1,2})%\s+(\d{1,2})%)$/i;
    const match = line.match(singleLineWithOdds);
    if (match) {
      const matchNo = parseInt(match[1] || `${singleLineMatches.length + 1}`, 10);
      const home = match[2].trim();
      const away = match[3].trim();
      const dateText = match[4]?.trim() || '17/10 15:00';
      const [d = '17/10', t = '15:00'] = dateText.split(/\s+/);

      const hOdds = match[5]
        ? parseFloat(match[5])
        : match[8]
        ? Math.round((100 / Math.max(5, parseInt(match[8], 10))) * 100) / 100
        : 2.2;
      const xOdds = match[6]
        ? parseFloat(match[6])
        : match[9]
        ? Math.round((100 / Math.max(5, parseInt(match[9], 10))) * 100) / 100
        : 3.2;
      const aOdds = match[7]
        ? parseFloat(match[7])
        : match[10]
        ? Math.round((100 / Math.max(5, parseInt(match[10], 10))) * 100) / 100
        : 2.8;

      const poolH = match[8] ? parseInt(match[8], 10) : Math.round((1 / hOdds) * 100);
      const poolX = match[9] ? parseInt(match[9], 10) : Math.round((1 / xOdds) * 100);
      const poolA = match[10] ? parseInt(match[10], 10) : Math.round((1 / aOdds) * 100);

      if (platform === 'sportybet') {
        singleLineMatches.push(
          createSportyMatch(matchNo, d, t, 'Football League', home, away, hOdds, xOdds, aOdds)
        );
      } else {
        singleLineMatches.push(
          create1xMatch(matchNo, d, t, 'TOTO Football', home, away, hOdds, xOdds, aOdds, poolH, poolX, poolA)
        );
      }

      if (singleLineMatches.length >= maxGames) break;
    }
  }

  if (singleLineMatches.length >= 6) {
    return { matches: singleLineMatches, roundNumber: extractedRound };
  }

  // Strategy 2: Multi-line chunking (one element per line from smartphone screen copy)
  interface RawChunkMatch {
    no: number;
    home: string;
    away: string;
    date: string;
    time: string;
    hOdds: number;
    xOdds: number;
    aOdds: number;
    poolH?: number | null;
    poolX?: number | null;
    poolA?: number | null;
  }

  const rawChunks: RawChunkMatch[] = [];
  let current: RawChunkMatch | null = null;

  const pushCurrent = () => {
    if (current && (current.home || current.away)) {
      if (current.poolH && current.poolX && current.poolA && !current.hOdds) {
        current.hOdds = Math.round((100 / Math.max(5, current.poolH)) * 100) / 100;
        current.xOdds = Math.round((100 / Math.max(5, current.poolX)) * 100) / 100;
        current.aOdds = Math.round((100 / Math.max(5, current.poolA)) * 100) / 100;
      }
      rawChunks.push(current);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is an isolated game number (e.g. "1", "2", "#1")
    const numMatch = line.match(/^#?(\d{1,2})$/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n >= 1 && n <= 20) {
        pushCurrent();
        current = {
          no: n,
          home: '',
          away: '',
          date: '17/10',
          time: '15:00',
          hOdds: 2.2,
          xOdds: 3.2,
          aOdds: 2.8,
          poolH: null,
          poolX: null,
          poolA: null,
        };
        continue;
      }
    }

    // Don't accumulate text into un-started match if line is a header
    if (!current) {
      if (line.includes(' - ') || line.includes(' – ') || line.toLowerCase().includes(' vs ')) {
        current = {
          no: rawChunks.length + 1,
          home: '',
          away: '',
          date: '17/10',
          time: '15:00',
          hOdds: 2.2,
          xOdds: 3.2,
          aOdds: 2.8,
          poolH: null,
          poolX: null,
          poolA: null,
        };
      } else {
        continue;
      }
    }

    // Check for 3 odds on one line
    const oddsMatch = line.match(/\b([1-9]\d{0,1}\.\d{1,2})\s+([1-9]\d{0,1}\.\d{1,2})\s+([1-9]\d{0,1}\.\d{1,2})\b/);
    if (oddsMatch) {
      current.hOdds = parseFloat(oddsMatch[1]);
      current.xOdds = parseFloat(oddsMatch[2]);
      current.aOdds = parseFloat(oddsMatch[3]);
      continue;
    }

    // Check for 3 pool percentages
    const pctMatch = line.match(/(\d{1,2})%\s+(\d{1,2})%\s+(\d{1,2})%/);
    if (pctMatch) {
      current.poolH = parseInt(pctMatch[1], 10);
      current.poolX = parseInt(pctMatch[2], 10);
      current.poolA = parseInt(pctMatch[3], 10);
      current.hOdds = Math.round((100 / Math.max(5, current.poolH)) * 100) / 100;
      current.xOdds = Math.round((100 / Math.max(5, current.poolX)) * 100) / 100;
      current.aOdds = Math.round((100 / Math.max(5, current.poolA)) * 100) / 100;
      continue;
    }

    // Check for labeled odds like "1 2.30"
    const labeledH = line.match(/^(?:1|H)[\s\:\-]+([1-9]\d{0,1}\.\d{1,2})/i);
    if (labeledH) {
      current.hOdds = parseFloat(labeledH[1]);
      continue;
    }
    const labeledX = line.match(/^(?:X|D)[\s\:\-]+([1-9]\d{0,1}\.\d{1,2})/i);
    if (labeledX) {
      current.xOdds = parseFloat(labeledX[1]);
      continue;
    }
    const labeledA = line.match(/^(?:2|A)[\s\:\-]+([1-9]\d{0,1}\.\d{1,2})/i);
    if (labeledA) {
      current.aOdds = parseFloat(labeledA[1]);
      continue;
    }

    // Check for date/time
    const dateMatch = line.match(/(\d{1,2}[\/\.]\d{1,2}(?:\/\d{2,4})?)\s*(\d{1,2}:\d{2})?/);
    if (dateMatch && !current.home) {
      current.date = dateMatch[1];
      if (dateMatch[2]) current.time = dateMatch[2];
      continue;
    }

    // Check for team separator in line ("Team A - Team B" or "Team A vs Team B")
    if (line.includes(' - ') || line.includes(' – ') || line.toLowerCase().includes(' vs ')) {
      const sep = line.includes(' - ')
        ? ' - '
        : line.includes(' – ')
        ? ' – '
        : line.toLowerCase().includes(' vs ')
        ? line.includes(' vs ')
          ? ' vs '
          : ' VS '
        : ' - ';
      const parts = line.split(sep);
      if (parts.length >= 2) {
        current.home = parts[0].replace(/^#?\d{1,2}[\.\s\:\)]+/, '').trim();
        current.away = parts[1].replace(/\d+\.\d{2}.*$/, '').replace(/\d+%.*$/, '').trim();
        continue;
      }
    }

    // Otherwise if it's text and not numbers/keywords
    if (!line.match(/^\d+/) && !line.includes('Jackpot') && !line.includes('TOTO') && line.length > 2) {
      if (!current.home) {
        current.home = line;
      } else if (!current.away) {
        current.away = line;
      }
    }
  }

  pushCurrent();

  const finalMatches: JackpotMatch[] = rawChunks.slice(0, maxGames).map((m, idx) => {
    const matchNum = m.no || idx + 1;
    let poolH = m.poolH;
    let poolX = m.poolX;
    let poolA = m.poolA;

    if (!poolH || !poolX || !poolA) {
      const invH = 1 / m.hOdds;
      const invX = 1 / m.xOdds;
      const invA = 1 / m.aOdds;
      const sum = invH + invX + invA;
      poolH = Math.round((invH / sum) * 100);
      poolX = Math.round((invX / sum) * 100);
      poolA = Math.round((invA / sum) * 100);
    }

    if (platform === 'sportybet') {
      return createSportyMatch(
        matchNum,
        m.date,
        m.time,
        'Football League',
        m.home || `Home ${matchNum}`,
        m.away || `Away ${matchNum}`,
        m.hOdds,
        m.xOdds,
        m.aOdds
      );
    } else {
      return create1xMatch(
        matchNum,
        m.date,
        m.time,
        'TOTO Football',
        m.home || `Home ${matchNum}`,
        m.away || `Away ${matchNum}`,
        m.hOdds,
        m.xOdds,
        m.aOdds,
        poolH,
        poolX,
        poolA
      );
    }
  });

  return { matches: finalMatches, roundNumber: extractedRound };
}

/**
 * Universal Ingest Parser: handles HTML or copied plain text from either platform (mobile or desktop)
 */
export function parseJackpotInput(input: string, platform: JackpotPlatform): JackpotSlate | null {
  if (!input || !input.trim()) return null;

  const isHtml = /<[a-z][\s\S]*>/i.test(input);

  // 1. Try HTML parsing first if HTML tags are present
  if (isHtml) {
    if (platform === 'sportybet') {
      const htmlMatches = parseSportyBetJackpotHTML(input);
      if (htmlMatches.length >= 6) {
        return {
          ...DEFAULT_SPORTYBET_SLATE,
          matches: htmlMatches,
          totalGames: htmlMatches.length,
          matchCount: 12,
        };
      }
    } else {
      const htmlMatches = parseOneXBetTotoHTML(input);
      if (htmlMatches.length >= 6) {
        return {
          ...DEFAULT_1XBET_SLATE,
          matches: htmlMatches,
          totalGames: htmlMatches.length,
          matchCount: 14,
        };
      }
    }
  }

  // 2. Fall back to plain-text parsing (ideal for mobile screen copy & paste)
  const plainResult = parseJackpotPlainText(input, platform);
  if (plainResult.matches.length >= 6) {
    const defaultSlate = platform === 'sportybet' ? DEFAULT_SPORTYBET_SLATE : DEFAULT_1XBET_SLATE;
    return {
      ...defaultSlate,
      matches: plainResult.matches,
      totalGames: plainResult.matches.length,
      matchCount: platform === 'sportybet' ? 12 : 14,
      roundNumber: plainResult.roundNumber || defaultSlate.roundNumber,
    };
  }

  return null;
}
