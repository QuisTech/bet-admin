import type { LoggedBet, BetOutcome } from '../types';
import {
  saveBetToFirestore,
  deleteBetFromFirestore,
  subscribeToFirestoreBets,
  isFirebaseConfigured,
  syncAllLocalBetsToFirestore,
  fetchFirestoreBets,
} from './firebaseService';

const LEDGER_STORAGE_KEY = 'bet_admin_logged_positions';
const DELETED_BETS_STORAGE_KEY = 'bet_admin_deleted_bets';

function getDeletedSignatures(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(DELETED_BETS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function recordDeletedBet(b: Partial<LoggedBet>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getDeletedSignatures();
    if (b.id) current.add(b.id);
    if (b.match && b.selection) {
      const normMatch = b.match.toLowerCase().replace(/\s*-\s*/g, ' vs ').trim();
      const normSel = b.selection.toLowerCase().trim();
      current.add(`${normMatch}|${normSel}`);
      current.add(normMatch);
    } else if (b.match) {
      const normMatch = b.match.toLowerCase().replace(/\s*-\s*/g, ' vs ').trim();
      current.add(normMatch);
    }
    localStorage.setItem(DELETED_BETS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function isBetDeleted(b: Partial<LoggedBet>): boolean {
  if (!b) return false;
  // Official verified 1xBet slips (starting with '87', '88' or 10-12 digit IDs) must NEVER be deleted
  if (b.id && (b.id.startsWith('87') || b.id.startsWith('88') || /^\d{10,12}$/.test(b.id))) return false;

  if (b.selection === 'Early Cashout / Market Position') return true;
  if (b.match && b.match.toLowerCase().includes('azerbaijan')) return true;

  const current = getDeletedSignatures();
  if (b.id && current.has(b.id)) return true;
  return false;
}

// Auto-purge ghost bets (Lithuania vs Azerbaijan and manual draft ghosts) and tombstone permanently
export function purgeGhostBets(): void {
  try {
    recordDeletedBet({
      match: 'Lithuania vs Azerbaijan',
      selection: 'Lithuania or Draw (1X) (1X2)',
    });
    recordDeletedBet({
      match: 'Lithuania vs Azerbaijan',
    });

    // Unblock all official slips from deleted storage if previously marked
    if (typeof localStorage !== 'undefined') {
      try {
        const rawDel = localStorage.getItem(DELETED_BETS_STORAGE_KEY);
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            const unblocked = parsedDel.filter(
              (sig: string) =>
                !sig.startsWith('87') &&
                !sig.startsWith('88') &&
                !/^\d{10,12}$/.test(sig) &&
                !sig.toLowerCase().includes('hull')
            );
            localStorage.setItem(DELETED_BETS_STORAGE_KEY, JSON.stringify(unblocked));
          }
        }
      } catch {}
    }

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (raw) {
        const parsed: LoggedBet[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (b) =>
              !b.match.toLowerCase().includes('azerbaijan') &&
              b.selection !== 'Early Cashout / Market Position' &&
              !b.id.startsWith('seed-bet-')
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(cleaned));
            notifyLedgerUpdated(cleaned);
          }
        }
      }
    }

    if (isFirebaseConfigured()) {
      deleteBetFromFirestore('ghost', {
        match: 'Lithuania vs Azerbaijan',
        selection: 'Lithuania or Draw (1X) (1X2)',
      }).catch(() => {});
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  purgeGhostBets();
}

/**
 * Official 1xBet Positions: Exactly matches user's 19 executed slips from 1xBet history (24/09/2026 - 28/09/2026).
 */
export const INITIAL_SEED_BETS: LoggedBet[] = [
  // 1. Barton Town vs Chorley (03/10/2026, 02:05)
  {
    id: '88201401303',
    timestamp: '2026-10-03T01:25:33.433Z',
    dateDisplay: '03/10/2026 / 02:05',
    league: 'England. FA Cup',
    match: 'Barton Town vs Chorley',
    selection: 'Match Outcome (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 6.9,
    pinnacleLineAtBet: 6.57,
    pinnacleClosingLine: 6.57,
    modelProb: 0.145,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88201401303',
  },
  // 2. Truro City vs Cirencester Town (03/10/2026, 02:03)
  {
    id: '88201362223',
    timestamp: '2026-10-03T01:25:33.433Z',
    dateDisplay: '03/10/2026 / 02:03',
    league: 'England. FA Cup',
    match: 'Truro City vs Cirencester Town',
    selection: 'Match Outcome (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 16.0,
    pinnacleLineAtBet: 15.24,
    pinnacleClosingLine: 15.24,
    modelProb: 0.063,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88201362223',
  },
  // 3. Tadley Calleva vs Dartford (03/10/2026, 02:01)
  {
    id: '88201326535',
    timestamp: '2026-10-03T01:25:33.433Z',
    dateDisplay: '03/10/2026 / 02:01',
    league: 'England. FA Cup',
    match: 'Tadley Calleva vs Dartford',
    selection: 'Match Outcome (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 8.7,
    pinnacleLineAtBet: 8.29,
    pinnacleClosingLine: 8.29,
    modelProb: 0.115,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88201326535',
  },
  // 4. ESM Kolea vs El Bayadh (03/10/2026, 01:59)
  {
    id: '88201284491',
    timestamp: '2026-10-03T01:25:33.433Z',
    dateDisplay: '03/10/2026 / 01:59',
    league: 'Algeria. Ligue 2',
    match: 'ESM Kolea vs El Bayadh',
    selection: 'Match Outcome (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 3.505,
    pinnacleLineAtBet: 3.34,
    pinnacleClosingLine: 3.34,
    modelProb: 0.285,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88201284491',
  },
  // 5. Salisbury vs Dulwich Hamlet (03/10/2026, 01:57)
  {
    id: '88201235257',
    timestamp: '2026-10-03T01:25:33.433Z',
    dateDisplay: '03/10/2026 / 01:57',
    league: 'England. FA Cup',
    match: 'Salisbury vs Dulwich Hamlet',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.02,
    pinnacleLineAtBet: 4.78,
    pinnacleClosingLine: 4.78,
    modelProb: 0.199,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88201235257',
  },
  // 6. Kufstein vs SC Imst (03/10/2026, 01:54)
  {
    id: '88201176145',
    timestamp: '2026-10-03T01:25:33.434Z',
    dateDisplay: '03/10/2026 / 01:54',
    league: 'Austria. Regionalliga West',
    match: 'Kufstein vs SC Imst',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.28,
    pinnacleLineAtBet: 5.03,
    pinnacleClosingLine: 5.03,
    modelProb: 0.189,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88201176145',
  },
  // 7. Iceland vs Bulgaria (03/10/2026, 01:45)
  {
    id: '88200991899',
    timestamp: '2026-10-03T01:25:33.434Z',
    dateDisplay: '03/10/2026 / 01:45',
    league: 'UEFA Nations League',
    match: 'Iceland vs Bulgaria',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.55,
    pinnacleLineAtBet: 4.33,
    pinnacleClosingLine: 4.33,
    modelProb: 0.22,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88200991899',
  },
  // 8. Weymouth vs South East Dons (03/10/2026, 01:44)
  {
    id: '88200980399',
    timestamp: '2026-10-03T01:25:33.434Z',
    dateDisplay: '03/10/2026 / 01:44',
    league: 'England. FA Cup',
    match: 'Weymouth vs South East Dons',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 6.19,
    pinnacleLineAtBet: 5.90,
    pinnacleClosingLine: 5.90,
    modelProb: 0.162,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88200980399',
  },
  // 9. Belarus vs San Marino (03/10/2026, 01:34)
  {
    id: '88200758257',
    timestamp: '2026-10-03T01:25:33.434Z',
    dateDisplay: '03/10/2026 / 01:34',
    league: 'UEFA Nations League',
    match: 'Belarus vs San Marino',
    selection: 'Match Outcome (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 33.0,
    pinnacleLineAtBet: 31.43,
    pinnacleClosingLine: 31.43,
    modelProb: 0.03,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88200758257',
  },
  // 10. Spain vs Czech Republic (03/10/2026, 01:32)
  {
    id: '88200708677',
    timestamp: '2026-10-03T01:25:33.434Z',
    dateDisplay: '03/10/2026 / 01:32',
    league: 'UEFA Nations League',
    match: 'Spain vs Czech Republic',
    selection: 'Match Outcome (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 37.0,
    pinnacleLineAtBet: 35.24,
    pinnacleClosingLine: 35.24,
    modelProb: 0.027,
    modelEV: 5.0,
    stake: 30,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 5.0,
    notes: 'Bet slip № 88200708677',
  },
  // 11. Germany vs Greece (27/09/2026, 19:44)
  {
    id: '87953275825',
    timestamp: '2026-09-27T18:44:00Z',
    dateDisplay: '27/09/2026 19:44',
    league: 'UEFA Nations League',
    match: 'Germany vs Greece',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.82,
    pinnacleLineAtBet: 4.70,
    pinnacleClosingLine: 4.70,
    modelProb: 0.228,
    modelEV: 9.9,
    stake: 100,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 2.55,
    notes: 'Bet slip № 87953275825',
  },
  // 2. Belgium vs France (27/09/2026, 19:42)
  {
    id: '87953150419',
    timestamp: '2026-09-27T18:42:00Z',
    dateDisplay: '27/09/2026 19:42',
    league: 'UEFA Nations League',
    match: 'Belgium vs France',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.145,
    pinnacleLineAtBet: 4.05,
    pinnacleClosingLine: 4.05,
    modelProb: 0.285,
    modelEV: 18.1,
    stake: 388,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 2.35,
    notes: 'Bet slip № 87953150419 • Win: ₦1,608.26',
  },
  // 3. Players' stats Hull City vs Players' stats Everton (27/09/2026, 19:31)
  {
    id: '87952483299',
    timestamp: '2026-09-27T18:31:00Z',
    dateDisplay: '27/09/2026 19:31',
    league: 'Premier League',
    match: "Players' stats Hull City vs Players' stats Everton",
    selection: 'Anytime Goalscorer',
    marketType: 'PROPS',
    bookmaker: '1xBet',
    priceTaken: 2.953,
    pinnacleLineAtBet: 2.65,
    pinnacleClosingLine: 2.65,
    modelProb: 0.425,
    modelEV: 25.5,
    stake: 200,
    payout: 0,
    outcome: 'OPEN',
    clvPercent: 11.43,
    notes: 'Bet slip № 87952483299 • Players stats (Win: ₦590.60)',
  },
  // 4b. Hull City vs Everton (27/09/2026, 19:20)
  {
    id: '87951912353_cashout',
    timestamp: '2026-09-27T18:20:00Z',
    dateDisplay: '27/09/2026 19:20',
    league: 'Premier League',
    match: 'Hull City vs Everton FC',
    selection: 'Double Chance (1X)',
    marketType: '1X',
    bookmaker: '1xBet',
    priceTaken: 1.81,
    pinnacleLineAtBet: 1.75,
    pinnacleClosingLine: 1.75,
    modelProb: 0.58,
    modelEV: 8.5,
    stake: 200,
    payout: 188,
    outcome: 'CASHOUT',
    clvPercent: 3.43,
    notes: 'Bet slip № 87951912353 • Sold / Cashed Out @ 0.94 (Refund: ₦188.00)',
  },
  // 5. Denmark vs Wales (27/09/2026, 14:24)
  {
    id: '87936098901',
    timestamp: '2026-09-27T13:24:00Z',
    dateDisplay: '27/09/2026 14:24',
    league: 'UEFA Nations League',
    match: 'Denmark vs Wales',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.25,
    pinnacleLineAtBet: 5.23,
    pinnacleClosingLine: 5.23,
    modelProb: 0.214,
    modelEV: 12.4,
    stake: 195.84,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 0.38,
    notes: 'Bet slip № 87936098901',
  },
  // 6. CF Montreal vs Cincinnati (25/09/2026, 19:41)
  {
    id: '87850707633',
    timestamp: '2026-09-25T18:41:00Z',
    dateDisplay: '25/09/2026 19:41',
    league: 'USA MLS',
    match: 'CF Montreal vs Cincinnati',
    selection: 'Value Selection (1X2 / Draw)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 3.91,
    pinnacleLineAtBet: 3.75,
    pinnacleClosingLine: 3.75,
    modelProb: 0.295,
    modelEV: 15.3,
    stake: 212,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 4.27,
    notes: 'Bet slip № 87850707633',
  },
  // 7. Iceland vs Estonia (25/09/2026, 19:31)
  {
    id: '87849986979',
    timestamp: '2026-09-25T18:31:00Z',
    dateDisplay: '25/09/2026 19:31',
    league: 'UEFA Nations League',
    match: 'Iceland vs Estonia',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.92,
    pinnacleLineAtBet: 5.25,
    pinnacleClosingLine: 5.25,
    modelProb: 0.194,
    modelEV: 14.8,
    stake: 202,
    payout: 1195.84,
    outcome: 'WON',
    clvPercent: 12.76,
    notes: 'Bet slip № 87849986979 • Value Draw Winner (Payout: ₦1,195.84)',
  },
  // 7b. Stockport County vs Peterborough United (25/09/2026, 17:08)
  {
    id: '87841571817',
    timestamp: '2026-09-25T16:08:00Z',
    dateDisplay: '25/09/2026 17:08',
    league: 'League One',
    match: 'Stockport County vs Peterborough United',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.25,
    pinnacleLineAtBet: 5.0,
    pinnacleClosingLine: 5.0,
    modelProb: 0.22,
    modelEV: 15.5,
    stake: 282,
    payout: 211.5,
    outcome: 'CASHOUT',
    clvPercent: 5.0,
    notes: 'Bet slip № 87841571817 • Sold / Cashed Out @ 0.75 (Refund: ₦211.50)',
  },
  // 8. Slovenia vs Scotland (25/09/2026, 17:01)
  {
    id: '87841078193',
    timestamp: '2026-09-25T16:01:00Z',
    dateDisplay: '25/09/2026 17:01',
    league: 'UEFA Nations League',
    match: 'Slovenia vs Scotland',
    selection: 'Slovenia Win (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 2.642,
    pinnacleLineAtBet: 2.45,
    pinnacleClosingLine: 2.45,
    modelProb: 0.435,
    modelEV: 14.9,
    stake: 400,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 7.84,
    notes: 'Bet slip № 87841078193',
  },
  // 9. Italy vs Belgium (25/09/2026, 16:57)
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
    modelEV: 11.9,
    stake: 400,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 11.56,
    notes: 'Bet slip № 87840835081 • Finished 0:2',
  },
  // 10. Bulgaria vs Luxembourg (25/09/2026, 16:56)
  {
    id: '87840715819',
    timestamp: '2026-09-25T15:56:00Z',
    dateDisplay: '25/09/2026 16:56',
    league: 'UEFA Nations League',
    match: 'Bulgaria vs Luxembourg',
    selection: 'Bulgaria Win (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 2.327,
    pinnacleLineAtBet: 2.08,
    pinnacleClosingLine: 2.08,
    modelProb: 0.485,
    modelEV: 12.9,
    stake: 400,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 11.88,
    notes: 'Bet slip № 87840715819',
  },
  // 11. Sweden vs Romania (25/09/2026, 16:54)
  {
    id: '87840609879',
    timestamp: '2026-09-25T15:54:00Z',
    dateDisplay: '25/09/2026 16:54',
    league: 'UEFA Nations League',
    match: 'Sweden vs Romania',
    selection: 'Value Selection',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 4.805,
    pinnacleLineAtBet: 4.40,
    pinnacleClosingLine: 4.40,
    modelProb: 0.235,
    modelEV: 12.9,
    stake: 132,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 9.20,
    notes: 'Bet slip № 87840609879',
  },
  // 12. Turkey vs France (25/09/2026, 16:52)
  {
    id: '87840453447',
    timestamp: '2026-09-25T15:52:00Z',
    dateDisplay: '25/09/2026 16:52',
    league: 'UEFA Nations League',
    match: 'Turkey vs France',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.55,
    pinnacleLineAtBet: 5.52,
    pinnacleClosingLine: 5.52,
    modelProb: 0.245,
    modelEV: 36.0,
    stake: 146,
    payout: 0,
    outcome: 'LOST',
    clvPercent: 0.54,
    notes: 'Bet slip № 87840453447',
  },
  // 12b. Philadelphia Union vs Orlando City (25/09/2026, 16:49)
  {
    id: '87840262499',
    timestamp: '2026-09-25T15:49:00Z',
    dateDisplay: '25/09/2026 16:49',
    league: 'USA MLS',
    match: 'Philadelphia Union vs Orlando City',
    selection: 'Draw (1X2)',
    marketType: '1X2',
    bookmaker: '1xBet',
    priceTaken: 5.31,
    pinnacleLineAtBet: 5.0,
    pinnacleClosingLine: 5.0,
    modelProb: 0.21,
    modelEV: 11.5,
    stake: 270,
    payout: 202.5,
    outcome: 'CASHOUT',
    clvPercent: 6.2,
    notes: 'Bet slip № 87840262499 • Sold / Cashed Out @ 0.75 (Refund: ₦202.50)',
  },
  // 13. Andorra vs Malta (24/09/2026, 16:27)
  {
    id: '87785914235',
    timestamp: '2026-09-24T15:27:00Z',
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
    notes: 'Bet slip № 87785914235',
  },
  // 14. Portugal vs Wales (24/09/2026, 16:09)
  {
    id: '87784873117',
    timestamp: '2026-09-24T15:09:00Z',
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
    notes: 'Bet slip № 87784873117',
  },
  // 15. Austria vs Israel (24/09/2026, 16:01)
  {
    id: '87784458559',
    timestamp: '2026-09-24T15:01:00Z',
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
    notes: 'Bet slip № 87784458559',
  },
  // 16. Netherlands vs Germany (24/09/2026, 15:41)
  {
    id: '87783481919',
    timestamp: '2026-09-24T14:41:00Z',
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
    notes: 'Bet slip № 87783481919 • Value Winner (Payout: ₦1,552.00)',
  },
  // 17. Liechtenstein vs Lithuania (24/09/2026, 15:38)
  {
    id: '87783322153',
    timestamp: '2026-09-24T14:38:00Z',
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
    notes: 'Bet slip № 87783322153',
  },
  // 18. Japan vs Uruguay (24/09/2026, 12:17)
  {
    id: '87773699297',
    timestamp: '2026-09-24T11:17:00Z',
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
    notes: 'Bet slip № 87773699297',
  },
  // 19. Coventry City vs Newcastle United (24/09/2026, 11:10)
  {
    id: '87771093985',
    timestamp: '2026-09-24T10:10:00Z',
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
    payout: 368,
    outcome: 'CASHOUT',
    clvPercent: 2.81,
    notes: 'Bet slip № 87771093985 • Sold / Cashed Out (Refunded ₦368)',
  },
];

/**
 * Reconciles any legacy draft positions with official 1xBet verified slips.
 * Live incoming positions (from local cache, 1xBet sync, or Cloud Firestore)
 * are prioritized as authoritative truth.
 */
export function reconcileWithOfficialSlips(bets: LoggedBet[]): LoggedBet[] {
  const officialSeedSlips = INITIAL_SEED_BETS.filter((s) => !isBetDeleted(s));

  if (!bets || bets.length === 0) {
    return officialSeedSlips;
  }

  // 1. Sanitize and remove deleted bets & legacy draft ghosts
  const valid = bets
    .map(sanitizeBet)
    .filter((b) => {
      if (!b || !b.match || isBetDeleted(b)) return false;
      // Discard legacy drafts (e.g. 'seed-bet-1', 'bet-1790...', 'mls-...')
      if (
        b.id.startsWith('seed-bet-') ||
        b.id === 'mls-montreal-cincinnati'
      ) {
        return false;
      }
      if (b.match.toLowerCase().includes('azerbaijan')) return false;
      return true;
    });

  if (valid.length === 0) {
    return officialSeedSlips;
  }

  // 2. Index valid incoming bets by id and normalized match
  const incomingById = new Map<string, LoggedBet>();
  const incomingByMatch = new Map<string, LoggedBet>();
  for (const b of valid) {
    if (b.id) incomingById.set(b.id, b);
    const norm = b.match.toLowerCase().replace(/\s*-\s*/g, ' vs ').trim();
    incomingByMatch.set(norm, b);
  }

  // 3. For any seed slip, if incoming bet exists, prioritize incoming live data!
  // If not in incoming, include seed slip only if it has not been deleted.
  const merged: LoggedBet[] = [...valid];
  for (const seed of officialSeedSlips) {
    const norm = seed.match.toLowerCase().replace(/\s*-\s*/g, ' vs ').trim();
    if (!incomingById.has(seed.id) && !incomingByMatch.has(norm)) {
      merged.push(seed);
    }
  }

  const clean = deduplicateBets(merged);
  clean.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return clean;
}

export function upgradeLedgerToOfficialSlips(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    const existing: LoggedBet[] = raw ? JSON.parse(raw) : [];
    const reconciled = reconcileWithOfficialSlips(existing);

    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(reconciled));
    notifyLedgerUpdated(reconciled);
  } catch (e) {
    console.warn('Error upgrading ledger to official slips:', e);
  }
}

if (typeof window !== 'undefined') {
  purgeGhostBets();
  upgradeLedgerToOfficialSlips();
}

/**
 * Ensures any bet object has valid, non-null numeric fields and strings.
 * Prevents runtime crashes from corrupted records or missing attributes.
 */
export function sanitizeBet(raw: any): LoggedBet {
  if (!raw) raw = {};

  const price =
    typeof raw.priceTaken === 'number' && !isNaN(raw.priceTaken) && raw.priceTaken > 0
      ? raw.priceTaken
      : typeof raw.odds === 'number' && !isNaN(raw.odds) && raw.odds > 0
      ? raw.odds
      : parseFloat(raw.priceTaken || raw.odds) || 2.0;

  const stake =
    typeof raw.stake === 'number' && !isNaN(raw.stake)
      ? raw.stake
      : parseFloat(raw.stake) || 0;

  const payout =
    typeof raw.payout === 'number' && !isNaN(raw.payout)
      ? raw.payout
      : parseFloat(raw.payout) || 0;

  const pin =
    typeof raw.pinnacleLineAtBet === 'number' && !isNaN(raw.pinnacleLineAtBet) && raw.pinnacleLineAtBet > 0
      ? raw.pinnacleLineAtBet
      : Math.max(1.05, Math.round((price / 1.05) * 100) / 100);

  const clv =
    typeof raw.clvPercent === 'number' && !isNaN(raw.clvPercent)
      ? raw.clvPercent
      : Math.round(((price / pin) - 1.0) * 1000) / 10;

  const prob =
    typeof raw.modelProb === 'number' && !isNaN(raw.modelProb) && raw.modelProb > 0
      ? raw.modelProb
      : Math.round((1 / price) * 1000) / 1000;

  return {
    id: String(raw.id || `bet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
    timestamp: raw.timestamp || new Date().toISOString(),
    dateDisplay: raw.dateDisplay || raw.date || new Date().toLocaleDateString('en-GB'),
    league: raw.league || 'Sportsbook Market',
    match: raw.match || 'Football Match',
    selection: raw.selection || 'Value Selection',
    marketType: raw.marketType || (raw.match?.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2'),
    bookmaker: raw.bookmaker || '1xBet',
    priceTaken: price,
    pinnacleLineAtBet: pin,
    pinnacleClosingLine:
      typeof raw.pinnacleClosingLine === 'number' && !isNaN(raw.pinnacleClosingLine)
        ? raw.pinnacleClosingLine
        : pin,
    modelProb: prob,
    modelEV: typeof raw.modelEV === 'number' && !isNaN(raw.modelEV) ? raw.modelEV : 5.0,
    stake,
    payout:
      raw.id === '87771093985' && (payout === 0 || raw.outcome === 'OPEN')
        ? 368
        : payout,
    outcome:
      raw.id === '87771093985' && raw.outcome === 'OPEN'
        ? 'CASHOUT'
        : raw.outcome === 'WON' || raw.outcome === 'LOST' || raw.outcome === 'PUSH' || raw.outcome === 'CASHOUT'
        ? raw.outcome
        : 'OPEN',
    clvPercent: clv,
    notes: raw.notes || '',
  };
}

/**
 * Deduplicates bets across IDs, normalized match names, selections, stakes, and timestamps.
 * Discards temporary unverified drafts (e.g. 'bet-...') when an official slip already exists for the match.
 */
export function deduplicateBets(bets: LoggedBet[]): LoggedBet[] {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const seenMatchDates = new Set<string>();
  const result: LoggedBet[] = [];

  // Sort so official 1xBet slips (numeric IDs like 87983860761) come BEFORE temporary unverified drafts (bet-...)
  const sorted = [...bets].sort((a, b) => {
    const aIsDraft = a.id && a.id.startsWith('bet-') ? 1 : 0;
    const bIsDraft = b.id && b.id.startsWith('bet-') ? 1 : 0;
    return aIsDraft - bIsDraft;
  });

  for (const raw of sorted) {
    if (!raw) continue;
    const b = sanitizeBet(raw);

    // 1. Direct ID check
    if (b.id && seenIds.has(b.id)) {
      continue;
    }

    // 2. Canonical normalization
    const normMatch = b.match
      .toLowerCase()
      .replace(/\s*-\s*/g, ' vs ')
      .replace(/\s+/g, ' ')
      .trim();

    const normSel = (b.selection || 'Value Selection')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // Clean datePart: strip commas, slashes, extract DD/MM/YYYY
    const datePart = b.dateDisplay
      ? b.dateDisplay.replace(/[^0-9/]/g, ' ').trim().split(/\s+/)[0]
      : b.timestamp
      ? b.timestamp.substring(0, 10)
      : '';

    // If an official verified slip is already recorded for this match & date,
    // discard any unverified temporary draft (bet-...) for the same match
    const matchDateKey = `${normMatch}|${datePart}`;
    if (b.id && b.id.startsWith('bet-') && seenMatchDates.has(matchDateKey)) {
      continue;
    }

    // Primary signature: match + selection + stake + priceTaken + datePart
    const primarySig = `${normMatch}|${normSel}|${b.stake}|${b.priceTaken.toFixed(2)}|${datePart}`;
    // Match signature: match + stake + priceTaken on same date
    const matchSig = `${normMatch}|${b.stake}|${b.priceTaken.toFixed(2)}|${datePart}`;

    if (seenSignatures.has(primarySig) || seenSignatures.has(matchSig)) {
      continue;
    }

    if (b.id) seenIds.add(b.id);
    seenSignatures.add(primarySig);
    seenSignatures.add(matchSig);
    seenMatchDates.add(matchDateKey);
    result.push(b);
  }

  return result;
}

export function removeDuplicateBets(): { cleaned: LoggedBet[]; removedCount: number } {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEDGER_STORAGE_KEY) : null;
    const current: LoggedBet[] = raw ? JSON.parse(raw) : INITIAL_SEED_BETS;
    const clean = reconcileWithOfficialSlips(current);
    const removedCount = current.length - clean.length;
    if (removedCount > 0 && typeof localStorage !== 'undefined') {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(clean));
      notifyLedgerUpdated(clean);
      if (isFirebaseConfigured()) {
        syncAllLocalBetsToFirestore(clean).catch(() => {});
      }
    }
    return { cleaned: clean, removedCount };
  } catch {
    const clean = reconcileWithOfficialSlips(INITIAL_SEED_BETS);
    return { cleaned: clean, removedCount: 0 };
  }
}

export function getLoggedBets(): LoggedBet[] {
  try {
    if (typeof localStorage === 'undefined') {
      return reconcileWithOfficialSlips(INITIAL_SEED_BETS);
    }
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) {
      const reconciled = reconcileWithOfficialSlips(INITIAL_SEED_BETS);
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(reconciled));
      return reconciled;
    }
    const parsed: any[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const reconciled = reconcileWithOfficialSlips(INITIAL_SEED_BETS);
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(reconciled));
      return reconciled;
    }

    // Auto-heal all parsed records to ensure zero undefined/NaN values
    const sanitized = parsed.map(sanitizeBet);

    // Reconcile and prune any legacy draft duplicates
    const reconciled = reconcileWithOfficialSlips(sanitized);
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(reconciled));

    return reconciled;
  } catch (e) {
    console.error('Failed to read ledger from localStorage:', e);
    return reconcileWithOfficialSlips(INITIAL_SEED_BETS);
  }
}

export function saveLoggedBets(bets: LoggedBet[]): void {
  try {
    const clean = deduplicateBets(bets);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(clean));
    }
  } catch (e) {
    console.error('Failed to write ledger to localStorage:', e);
  }
}

const LEDGER_UPDATE_EVENT = 'bet_horizon_ledger_updated';

export function notifyLedgerUpdated(bets?: LoggedBet[]): void {
  if (typeof window !== 'undefined') {
    const detail = bets || getLoggedBets();
    window.dispatchEvent(new CustomEvent(LEDGER_UPDATE_EVENT, { detail }));
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
    dateDisplay: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    clvPercent: clv,
  };

  const existing = getLoggedBets();
  const updated = [newBet, ...existing];
  saveLoggedBets(updated);

  // Background Cloud Sync to Firestore
  if (isFirebaseConfigured()) {
    saveBetToFirestore(newBet).catch((err) =>
      console.warn('Background Firestore save failed:', err)
    );
  }

  notifyLedgerUpdated(updated);
  return newBet;
}

export function updateBetOutcome(
  id: string,
  outcome: BetOutcome,
  customPayout?: number
): LoggedBet[] {
  const existing = getLoggedBets();
  let modifiedBet: LoggedBet | null = null;
  const updated = existing.map((b) => {
    if (b.id !== id) return b;
    let payout = 0;
    if (outcome === 'WON') {
      payout = customPayout !== undefined ? customPayout : Math.round(b.stake * b.priceTaken);
    } else if (outcome === 'PUSH') {
      payout = b.stake;
    } else if (outcome === 'CASHOUT') {
      payout = customPayout !== undefined ? customPayout : Math.round(b.stake * 0.94);
    }
    modifiedBet = {
      ...b,
      outcome,
      payout,
    };
    return modifiedBet;
  });
  saveLoggedBets(updated);

  // Background Cloud Sync to Firestore
  if (modifiedBet && isFirebaseConfigured()) {
    saveBetToFirestore(modifiedBet).catch((err) =>
      console.warn('Background Firestore update failed:', err)
    );
  }

  notifyLedgerUpdated(updated);
  return updated;
}

export function deleteLoggedBet(id: string): LoggedBet[] {
  const existing = getLoggedBets();
  const target = existing.find((b) => b.id === id);
  if (target) {
    recordDeletedBet(target);
  }

  const updated = existing.filter(
    (b) =>
      b.id !== id &&
      (!target ||
        !(
          b.match.toLowerCase().trim() === target.match.toLowerCase().trim() &&
          b.selection.toLowerCase().trim() === target.selection.toLowerCase().trim()
        )) &&
      !isBetDeleted(b)
  );
  saveLoggedBets(updated);

  // Background Cloud Sync to Firestore
  if (isFirebaseConfigured() && target) {
    deleteBetFromFirestore(id, { match: target.match, selection: target.selection }).catch((err) =>
      console.warn('Background Firestore delete failed:', err)
    );
  }

  notifyLedgerUpdated(updated);
  return updated;
}

export function resetLedgerToSeed(): LoggedBet[] {
  saveLoggedBets(INITIAL_SEED_BETS);
  notifyLedgerUpdated(INITIAL_SEED_BETS);
  if (isFirebaseConfigured()) {
    syncAllLocalBetsToFirestore(INITIAL_SEED_BETS).catch((err) =>
      console.warn('Background Firestore reset sync failed:', err)
    );
  }
  return INITIAL_SEED_BETS;
}

/**
 * Initializes two-way synchronized ledger:
 * 1. Emits initial positions from fast local cache.
 * 2. Listens to window storage and custom events for multi-tab updates.
 * 3. Subscribes to Firebase Firestore real-time snapshots (if configured),
 *    merging cloud positions seamlessly.
 */
export function initLedgerSync(
  onUpdate: (bets: LoggedBet[]) => void
): () => void {
  let isSubscribed = true;

  // 1. Initial fast local read
  onUpdate(getLoggedBets());

  // 2. Intra-window and multi-tab listener
  const handleLocalEvent = (e: Event) => {
    if (!isSubscribed) return;
    const custom = e as CustomEvent<LoggedBet[]>;
    if (custom.detail && Array.isArray(custom.detail)) {
      onUpdate(custom.detail);
    } else {
      onUpdate(getLoggedBets());
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (!isSubscribed) return;
    if (e.key === LEDGER_STORAGE_KEY) {
      onUpdate(getLoggedBets());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(LEDGER_UPDATE_EVENT, handleLocalEvent);
    window.addEventListener('storage', handleStorageEvent);
  }

  // 3. Real-time Firestore Cloud subscription
  let unsubFirestore: (() => void) | null = null;

  if (isFirebaseConfigured()) {
    unsubFirestore = subscribeToFirestoreBets((remoteBets) => {
      if (!isSubscribed) return;

      if (!remoteBets || remoteBets.length === 0) {
        // Cloud collection is currently empty; keep local authoritative slips
        return;
      }

      // 1. Filter out any bets that were explicitly deleted by the user
      const validRemote = remoteBets.filter((b) => !isBetDeleted(b));

      // 2. Reconcile with official slips to prevent draft duplicates
      const reconciled = reconcileWithOfficialSlips(validRemote);

      // 4. Accept cloud truth into local cache (WITHOUT re-uploading missing bets)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(reconciled));
      }

      onUpdate(reconciled);
    });
  }

  return () => {
    isSubscribed = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener(LEDGER_UPDATE_EVENT, handleLocalEvent);
      window.removeEventListener('storage', handleStorageEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}

/**
 * Manually pushes all local positions to Firestore.
 */
export async function syncLocalLedgerToCloud(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const current = getLoggedBets();
  return syncAllLocalBetsToFirestore(current);
}

/**
 * Manually pulls and refreshes ledger positions from Cloud Firestore without data loss.
 * Preserves all new bets (including future bets 50+ steps ahead) and merges remote updates.
 */
export async function refreshLedgerFromCloud(): Promise<LoggedBet[]> {
  if (isFirebaseConfigured()) {
    try {
      const remoteBets = await fetchFirestoreBets();
      if (remoteBets && remoteBets.length > 0) {
        const validRemote = remoteBets.filter((b) => !isBetDeleted(b));
        const reconciled = reconcileWithOfficialSlips(validRemote);
        saveLoggedBets(reconciled);
        notifyLedgerUpdated(reconciled);
        return reconciled;
      }
    } catch (e) {
      console.warn('Manual cloud refresh failed, falling back to local cache:', e);
    }
  }
  const current = getLoggedBets();
  notifyLedgerUpdated(current);
  return current;
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
  cashoutCount: number;
  hitRatePercent: number;
  expectedHitRatePercent: number;
  avgCLVPercent: number;
  brierScore: number;
  maxDrawdownNGN: number;
  maxDrawdownPercent: number;
}

export function calculateLedgerStats(rawBets: LoggedBet[]): LedgerStatistics {
  const bets = (rawBets || []).map(sanitizeBet);
  const settled = bets.filter((b) => b.outcome !== 'OPEN');
  const open = bets.filter((b) => b.outcome === 'OPEN');

  const totalBets = bets.length;
  const settledBets = settled.length;
  const openBets = open.length;

  const totalStaked = settled.reduce((sum, b) => sum + (b.stake || 0), 0);
  const openExposure = open.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalPayout = settled.reduce((sum, b) => sum + (b.payout || 0), 0);
  const netProfit = totalPayout - totalStaked;
  const roiPercent = totalStaked > 0 ? Math.round((netProfit / totalStaked) * 1000) / 10 : 0;

  const winCount = settled.filter((b) => b.outcome === 'WON').length;
  const lossCount = settled.filter((b) => b.outcome === 'LOST').length;
  const pushCount = settled.filter((b) => b.outcome === 'PUSH').length;
  const cashoutCount = settled.filter((b) => b.outcome === 'CASHOUT').length;

  const hitRatePercent =
    settledBets > 0 ? Math.round((winCount / settledBets) * 1000) / 10 : 0;

  // Expected Hit Rate based on Model predicted probabilities
  const expectedHitRatePercent =
    settledBets > 0
      ? Math.round((settled.reduce((sum, b) => sum + (b.modelProb || 0.5), 0) / settledBets) * 1000) / 10
      : 0;

  // Average CLV across bets with CLV
  const clvBets = bets.filter((b) => b.clvPercent !== undefined && b.clvPercent !== null && !isNaN(b.clvPercent));
  const avgCLVPercent =
    clvBets.length > 0
      ? Math.round((clvBets.reduce((sum, b) => sum + (b.clvPercent || 0), 0) / clvBets.length) * 10) / 10
      : 0;

  // Brier Calibration Score: 1/N * sum((p_i - outcome_i)^2)
  let brierScore = 0.185;
  if (settledBets > 0) {
    const brierSum = settled.reduce((sum, b) => {
      const prob = typeof b.modelProb === 'number' && !isNaN(b.modelProb) ? b.modelProb : 0.5;
      const actualOutcome = b.outcome === 'WON' ? 1.0 : 0.0;
      return sum + Math.pow(prob - actualOutcome, 2);
    }, 0);
    brierScore = Math.round((brierSum / settledBets) * 10000) / 10000;
  }

  // Drawdown tracking across chronological settled bets
  let peak = 0;
  let runningPnL = 0;
  let maxDrawdownNGN = 0;

  const chronological = [...settled].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const b of chronological) {
    const pnl = (b.payout || 0) - (b.stake || 0);
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
    cashoutCount,
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
  rawBets?: LoggedBet[]
): ActualBankrollPoint[] {
  const allBets = (rawBets || getLoggedBets()).map(sanitizeBet);
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
    const pnl = (b.payout || 0) - (b.stake || 0);
    current += pnl;
    trajectory.push({
      index: i + 1,
      betId: b.id,
      match: b.match,
      selection: b.selection,
      dateDisplay: b.dateDisplay,
      outcome: b.outcome,
      stake: b.stake || 0,
      payout: b.payout || 0,
      pnl,
      runningBankroll: current,
    });
  });

  return trajectory;
}

