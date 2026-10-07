/**
 * 1xBet Slip Parser & 1-Click Sync Bookmarklet Generator
 * Powers seamless extraction and automated synchronization from 1xBet to Bet Horizon.
 * Engineered to understand both 1xBet's live DOM structure (data-test attributes) and copied text/HTML.
 */

import type { LoggedBet, BetOutcome } from '../types';

export interface ParsedOneXBetSlip {
  id: string;
  date: string;
  match: string;
  league: string;
  selection: string;
  odds: number;
  stake: number;
  potentialWin: number;
  status: 'Win' | 'Loss' | 'Unsettled' | 'Sold' | 'OPEN';
  outcome: BetOutcome;
  payout: number;
}

/**
 * Parses raw HTML string copied directly from 1xBet inspect/source.
 * Leverages 1xBet's stable data-test attributes.
 */
export function parse1xBetHTML(html: string): ParsedOneXBetSlip[] {
  const slips: ParsedOneXBetSlip[] = [];
  if (!html) return slips;

  // Check if this is an official 1xBet statement / email export
  if (html.includes('cupHisNew') || html.includes('cupHis') || html.includes('journalResult')) {
    return parse1xBetEmailHTML(html);
  }

  // Split by coupon row or table item
  const blocks = html.split(/class="[^"]*bets-history-coupon-row/i).slice(1);

  for (const block of blocks) {
    // 1. Slip ID
    const idM =
      block.match(/data-test="betting-bets-history-default-coupon-id"[^>]*>[\s\S]*?<span[^>]*class="[^"]*value[^"]*"[^>]*>\s*(\d+)/i) ||
      block.match(/Bet slip<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>\s*(\d+)/i) ||
      block.match(/\b(87\d{8,10}|\d{10,12})\b/);
    if (!idM) continue;
    const slipId = idM[1].trim();

    // 2. Game Name
    const gameM =
      block.match(/data-test="betting-bets-history-default-coupon-game-name"[^>]*>([^<]+)<\/span>/i) ||
      block.match(/bets-history-coupon-row-event__name[^>]*>([^<]+)<\/span>/i);
    const matchName = gameM ? gameM[1].trim().replace(/\s*-\s*/g, ' vs ') : 'Football Match';

    // 3. League
    const champM =
      block.match(/data-test="betting-bets-history-default-coupon-champ-name"[^>]*>([^<]+)<\/span>/i) ||
      block.match(/bets-history-coupon-row-event__champ[^>]*>([^<]+)<\/span>/i);
    const league = champM ? champM[1].trim() : 'Sportsbook Market';

    // 4. Status
    const statusM =
      block.match(/data-test="betting-bets-history-default-coupon-status-label"[^>]*>([^<]+)<\/span>/i) ||
      block.match(/ui-status[^>]*>([^<]+)<\/span>/i);
    const rawStatus = statusM ? statusM[1].trim() : 'Unsettled';

    let status: 'Win' | 'Loss' | 'Unsettled' | 'Sold' | 'OPEN' = 'Unsettled';
    let outcome: BetOutcome = 'OPEN';
    let payout = 0;

    if (/Loss/i.test(rawStatus)) {
      status = 'Loss';
      outcome = 'LOST';
      payout = 0;
    } else if (/Win/i.test(rawStatus)) {
      status = 'Win';
      outcome = 'WON';
    } else if (/Sold|Cashed/i.test(rawStatus)) {
      status = 'Sold';
      outcome = 'CASHOUT';
    } else {
      status = 'Unsettled';
      outcome = 'OPEN';
    }

    // 5. Date
    const dateM =
      block.match(/data-test="betting-bets-history-default-coupon-date"[^>]*>[\s\S]*?<span[^>]*class="[^"]*value[^"]*"[^>]*>\s*([^<]+)<\/span>/i) ||
      block.match(/(\d{2}\/\d{2}\/\d{4}\s*[/,]\s*\d{2}:\d{2})/);
    const dateStr = dateM ? dateM[1].replace(/\s*\/\s*/, ' ').trim() : '';

    // 6. Bet Amount (Stake)
    const amountM =
      block.match(/data-test="betting-bets-history-default-coupon-amount"[^>]*>[\s\S]*?([0-9.,]+)\s*NGN/i) ||
      block.match(/bets-history-coupon-row-amount[^>]*>[\s\S]*?([0-9.,]+)\s*NGN/i);
    const stake = amountM ? parseFloat(amountM[1].replace(/,/g, '')) : 0;

    // 7. Odds
    const oddsM =
      block.match(/data-test="betting-bets-history-default-coupon-total-coef"[^>]*>[\s\S]*?([0-9.]+)\s*<\/span>/i) ||
      block.match(/bets-history-default-coupon-row__coefficient[^>]*>([0-9.]+)<\/span>/i);
    const odds = oddsM ? parseFloat(oddsM[1]) : 0;

    // 8. Win Amount
    const winM =
      block.match(/data-test="betting-bets-history-default-coupon-win-amount"[^>]*>[\s\S]*?([0-9.,]+)\s*NGN/i) ||
      block.match(/bets-history-coupon-row-received-amount[^>]*>[\s\S]*?([0-9.,]+)\s*NGN/i);
    const potentialWin = winM ? parseFloat(winM[1].replace(/,/g, '')) : 0;

    if (status === 'Sold') {
      payout = potentialWin > 0 ? potentialWin : Math.round(stake * (odds < 1.0 ? odds : 0.94) * 100) / 100;
    } else if (status === 'Win') {
      payout = potentialWin > 0 ? potentialWin : Math.round(stake * odds * 100) / 100;
    }

    // Determine Selection
    let selection = 'Value Selection';
    if (matchName.toLowerCase().includes("players' stats")) {
      selection = 'Anytime Goalscorer / Player Prop';
    } else if (odds >= 4.5 && odds <= 6.5) {
      selection = 'Draw (1X2)';
    } else if (odds >= 1.6 && odds <= 1.95) {
      selection = 'Double Chance (1X)';
    } else {
      selection = 'Match Outcome (1X2)';
    }

    slips.push({
      id: slipId,
      date: dateStr,
      match: matchName,
      league,
      selection,
      odds,
      stake,
      potentialWin,
      status,
      outcome,
      payout,
    });
  }

  return slips;
}

/**
 * Parses official 1xBet Email Statement HTML (contains cupHisNew / hisCof / hisName).
 */
export function parse1xBetEmailHTML(rawHtml: string): ParsedOneXBetSlip[] {
  const slips: ParsedOneXBetSlip[] = [];
  if (!rawHtml) return slips;

  const blocks = rawHtml.split('<div class="cupHisNew ');

  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const idMatch = b.match(/№(\d+)/);
    const timeMatch = b.match(/<time>(.*?)<\/time>/);
    const nameMatch = b.match(/class="hisName"[^>]*>([\s\S]*?)<\/label>/);
    const oddsMatch = b.match(/class="hisCof"[^>]*>\s*([\d\.]+)\s*<\/div>/);
    
    const betMatch = b.match(/<td[^>]*class="ce"[^>]*>\s*([0-9.,]+)\s*NGN\s*<\/td>/);
    const winMatch = b.match(/<td[^>]*class="ce"[^>]*>\s*<b>(.*?)<\/b>\s*<\/td>/);
    const selMatch = b.match(/<td[^>]*class="ce"[^>]*rowspan="2"[^>]*>\s*([\s\S]*?)\s*<\/td>/i);

    const slipId = idMatch ? idMatch[1] : '';
    if (!slipId) continue;

    const rawTime = timeMatch ? timeMatch[1].trim() : '';
    const dateStr = rawTime.replace(/\./g, '/').replace(/\s*\|\s*/, ' ').trim();

    let fullTitle = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    let league = 'Sportsbook Market';
    let matchName = fullTitle;
    if (fullTitle.includes('.')) {
      const parts = fullTitle.split('.');
      if (parts.length >= 2) {
        const remaining = parts.slice(1).join('.').trim();
        const leagues = ['UEFA Nations League', 'Premier League', 'MLS', 'League One', 'Friendlies'];
        for (const l of leagues) {
          if (remaining.includes(l)) {
            league = l;
            matchName = remaining.replace(l, '').trim();
            break;
          }
        }
      }
    }
    matchName = matchName.replace(/\s*-\s*/g, ' vs ').replace(/^vs\s+/, '').trim();

    const currentOdds = oddsMatch ? parseFloat(oddsMatch[1]) : 0;
    const stake = betMatch ? parseFloat(betMatch[1].replace(/,/g, '')) : 0;
    const winText = winMatch ? winMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const rawSel = selMatch ? selMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

    let selection = 'Match Outcome (1X2)';
    if (rawSel === 'X') selection = 'Draw (1X2)';
    else if (rawSel === 'W1') selection = 'Home Win (1X2)';
    else if (rawSel === 'W2') selection = 'Away Win (1X2)';
    else if (rawSel === '1X') selection = 'Double Chance (1X)';
    else if (rawSel === '2X' || rawSel === 'X2') selection = 'Double Chance (2X)';
    else if (rawSel === '12') selection = 'Double Chance (12)';
    else if (rawSel.toLowerCase().includes('score a goal')) selection = 'Anytime Goalscorer';
    else if (rawSel) selection = rawSel;

    let status: 'Win' | 'Loss' | 'Unsettled' | 'Sold' | 'OPEN' = 'Unsettled';
    let outcome: BetOutcome = 'OPEN';
    let payout = 0;

    // Check if Cashout / Sold:
    // In 1xBet email, sold bets have odds < 1.0 (e.g. 0.94, 0.75, 0.92) or winText is empty / "NGN"
    if (currentOdds > 0 && currentOdds < 1.0) {
      status = 'Sold';
      outcome = 'CASHOUT';
      payout = Math.round(stake * currentOdds * 100) / 100;
    } else if (winText.includes('Loss') || b.includes('background: #ec3636') || b.includes('background: #EC3636')) {
      status = 'Loss';
      outcome = 'LOST';
      payout = 0;
    } else if (winText.includes('NGN') && parseFloat(winText)) {
      status = 'Win';
      outcome = 'WON';
      payout = parseFloat(winText.replace(/[^0-9.]/g, '')) || Math.round(stake * currentOdds * 100) / 100;
    } else if (b.includes('unsettled')) {
      status = 'Unsettled';
      outcome = 'OPEN';
      payout = 0;
    }

    slips.push({
      id: slipId,
      date: dateStr,
      match: matchName,
      league,
      selection,
      odds: currentOdds,
      stake,
      potentialWin: payout,
      status,
      outcome,
      payout,
    });
  }

  return slips;
}

/**
 * Universal Parser that accepts either raw HTML (website or email statement) or plain copied text from 1xBet.
 */
export function parse1xBetInput(input: string): ParsedOneXBetSlip[] {
  if (!input) return [];

  // Check if input is JSON (e.g. copied from sync bookmarklet or cloud export)
  const trimmed = input.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson) && parsedJson.length > 0 && parsedJson[0].id) {
        return parsedJson.map((item: any) => ({
          id: String(item.id),
          date: item.dateDisplay || item.date || '',
          match: (item.match || 'Football Match').replace(/\s*-\s*/g, ' vs '),
          league: item.league || 'Sportsbook Market',
          selection: item.selection || 'Match Outcome (1X2)',
          odds: parseFloat(item.priceTaken || item.odds) || 2.0,
          stake: parseFloat(item.stake) || 0,
          potentialWin: parseFloat(item.payout) || 0,
          status: item.outcome === 'WON' ? 'Win' : item.outcome === 'LOST' ? 'Loss' : item.outcome === 'CASHOUT' ? 'Sold' : 'OPEN',
          outcome: item.outcome || 'OPEN',
          payout: parseFloat(item.payout) || 0,
        }));
      }
    } catch {}
  }

  // Check if input is 1xBet Email Statement HTML (contains cupHisNew)
  if (input.includes('cupHisNew')) {
    const emailSlips = parse1xBetEmailHTML(input);
    if (emailSlips.length > 0) return emailSlips;
  }

  // Check if input is HTML (contains HTML tags or 1xBet DOM attributes)
  if (input.includes('<div') || input.includes('data-test=') || input.includes('bets-history-')) {
    const htmlSlips = parse1xBetHTML(input);
    if (htmlSlips.length > 0) return htmlSlips;
  }

  // Otherwise fallback to text parsing
  return parse1xBetText(input);
}

/**
 * Parses raw text copied from 1xBet "Bet history" page.
 */
export function parse1xBetText(rawText: string): ParsedOneXBetSlip[] {
  const slips: ParsedOneXBetSlip[] = [];
  if (!rawText) return slips;

  // Split into chunks by "Bet slip" delimiter
  const rawChunks = rawText.split(/Bet\s+slip/i);

  for (let i = 1; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const prevChunk = rawChunks[i - 1];

    // Find 10-12 digit ID at start of chunk (e.g. 87953275825)
    const idMatch = chunk.match(/\b(87\d{8,10}|\d{10,12})\b/);
    if (!idMatch) continue;
    const slipId = idMatch[1];

    // Extract Date
    const dateMatch =
      chunk.match(/Date\s*[\n\r]+\s*(\d{2}\/\d{2}\/\d{4}[^0-9]+\d{2}:\d{2})/i) ||
      chunk.match(/(\d{2}\/\d{2}\/\d{4}[^0-9]+\d{2}:\d{2})/);
    const dateStr = dateMatch ? dateMatch[1].replace(/[^0-9/:]/g, ' ').trim() : '';

    // Extract Stake (Bet)
    const betMatch =
      chunk.match(/Bet[\s\S]*?([0-9.,]+)\s*(?:NGN|\$|€|£)?/i) ||
      chunk.match(/([0-9.,]+)\s*NGN/i);
    const stake = betMatch ? parseFloat(betMatch[1].replace(/,/g, '')) : 0;

    // Extract Odds
    const oddsMatch = chunk.match(/Odds[\s\S]*?([0-9.]+)/i);
    const odds = oddsMatch ? parseFloat(oddsMatch[1]) : 0;

    // Extract Win / Potential Payout
    const winMatch = chunk.match(/Win[\s\S]*?([0-9.,]+)/i);
    const potentialWin = winMatch ? parseFloat(winMatch[1].replace(/,/g, '')) : 0;

    // Determine Status & Outcome from the context directly above the bet slip
    let status: 'Win' | 'Loss' | 'Unsettled' | 'Sold' | 'OPEN' = 'OPEN';
    let outcome: BetOutcome = 'OPEN';
    let payout = 0;

    const prevLines = prevChunk
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const last3Lines = prevLines.slice(-4).join(' ');

    if (/Sold|Cashed/i.test(last3Lines) || /Sold|Cashed/i.test(chunk)) {
      status = 'Sold';
      outcome = 'CASHOUT';
      payout = potentialWin > 0 ? potentialWin : Math.round(stake * (odds < 1.0 ? odds : 0.94) * 100) / 100;
    } else if (/\bLoss\b/i.test(last3Lines)) {
      status = 'Loss';
      outcome = 'LOST';
      payout = 0;
    } else if (/\bWin\b/i.test(last3Lines)) {
      status = 'Win';
      outcome = 'WON';
      payout = potentialWin > 0 ? potentialWin : Math.round(stake * odds * 100) / 100;
    } else if (/\bUnsettled\b/i.test(last3Lines) || /\bPending\b/i.test(last3Lines)) {
      status = 'Unsettled';
      outcome = 'OPEN';
      payout = 0;
    }

    // Match extraction: Look for lines with "-" or "vs" before the status in prevLines
    let matchName = '';
    let league = '';
    for (let j = prevLines.length - 1; j >= 0; j--) {
      const line = prevLines[j];
      if (/Win|Loss|Unsettled|Sold|Single bet|NGN|Date|Repeat/i.test(line)) continue;
      if (line.includes(' - ') || line.includes(' vs ')) {
        matchName = line.replace(/\s*-\s*/g, ' vs ');
        if (prevLines[j + 1] && !/Win|Loss|Unsettled|Sold|Single bet|NGN/i.test(prevLines[j + 1])) {
          league = prevLines[j + 1];
        }
        break;
      }
    }

    if (!matchName) {
      const chunkLines = chunk.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
      for (const line of chunkLines) {
        if ((line.includes(' - ') || line.includes(' vs ')) && !line.includes('Single bet')) {
          matchName = line.replace(/\s*-\s*/g, ' vs ');
          break;
        }
      }
    }

    // Determine Selection
    let selection = 'Value Selection';
    if (matchName.toLowerCase().includes("players' stats")) {
      selection = 'Anytime Goalscorer / Player Prop';
    } else if (odds >= 2.6 && odds <= 4.8) {
      selection = 'Draw (1X2)';
    } else if (odds >= 1.35 && odds <= 2.15) {
      selection = 'Double Chance (1X)';
    } else {
      selection = 'Match Outcome (1X2)';
    }

    slips.push({
      id: slipId,
      date: dateStr,
      match: matchName || 'Football Match',
      league: league || 'Sportsbook Market',
      selection,
      odds,
      stake,
      potentialWin,
      status,
      outcome,
      payout,
    });
  }

  return slips;
}

const LEDGER_STORAGE_KEY = 'bet_admin_logged_positions';

/**
 * Normalizes a team or match string for reliable correlation between
 * 1xBet DOM formats and Bet Horizon logged match names.
 */
export function normalizeMatchName(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/players'?\s*stats\s*/gi, '')
    .replace(/\s*-\s*/g, ' vs ')
    .replace(/\s+v\s+/g, ' vs ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two match names refer to the same match.
 * Supports exact normalized match, reversed match, or team-token inclusion.
 */
export function isSameMatch(matchA: string, matchB: string): boolean {
  const normA = normalizeMatchName(matchA);
  const normB = normalizeMatchName(matchB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const partsA = normA.split(/\s+vs\s+/).map((p) => p.trim()).filter(Boolean);
  const partsB = normB.split(/\s+vs\s+/).map((p) => p.trim()).filter(Boolean);

  if (partsA.length === 2 && partsB.length === 2) {
    const [hA, aA] = partsA;
    const [hB, aB] = partsB;
    if ((hA === hB && aA === aB) || (hA === aB && aA === hB)) return true;

    const homeMatch = hA.includes(hB) || hB.includes(hA);
    const awayMatch = aA.includes(aB) || aB.includes(aA);
    if (homeMatch && awayMatch) return true;
  }

  // Fallback: check if major words overlap
  const wordsA = normA.split(' ').filter((w) => w.length > 2 && w !== 'vs' && w !== 'u21');
  const wordsB = normB.split(' ').filter((w) => w.length > 2 && w !== 'vs' && w !== 'u21');
  if (wordsA.length > 0 && wordsB.length > 0) {
    const overlap = wordsA.filter((w) => wordsB.includes(w));
    if (overlap.length >= Math.min(wordsA.length, wordsB.length)) return true;
  }

  return false;
}

/**
 * Normalizes date to DD/MM/YYYY
 */
export function extractDatePart(dateStr?: string, timestamp?: string): string {
  if (dateStr) {
    const dMatch = dateStr.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (dMatch) {
      const d = dMatch[1].padStart(2, '0');
      const m = dMatch[2].padStart(2, '0');
      let y = dMatch[3];
      if (y.length === 2) y = '20' + y;
      return `${d}/${m}/${y}`;
    }
  }
  if (timestamp) {
    try {
      const dt = new Date(timestamp);
      if (!isNaN(dt.getTime())) {
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

/**
 * Searches an array of existing bets to find the matching pre-staked record
 * for an incoming 1xBet slip.
 */
export function findCorrelatedBet(
  slip: {
    id?: string;
    match?: string;
    odds?: number;
    priceTaken?: number;
    stake?: number;
    date?: string;
    dateDisplay?: string;
    timestamp?: string;
  },
  existingBets: LoggedBet[]
): LoggedBet | undefined {
  if (!existingBets || existingBets.length === 0) return undefined;

  const slipId = slip.id ? String(slip.id).trim() : '';
  const slipOdds =
    typeof slip.odds === 'number' && !isNaN(slip.odds)
      ? slip.odds
      : typeof slip.priceTaken === 'number' && !isNaN(slip.priceTaken)
      ? slip.priceTaken
      : 0;
  const slipStake = typeof slip.stake === 'number' && !isNaN(slip.stake) ? slip.stake : 0;
  const slipDate = extractDatePart(slip.dateDisplay || slip.date, slip.timestamp);

  // 1. Direct ID match
  if (slipId) {
    const exactId = existingBets.find((b) => b.id === slipId);
    if (exactId) return exactId;
  }

  // 2. Strong match: Same match name + compatible date
  const candidateByMatchAndDate = existingBets.filter((b) => {
    if (!isSameMatch(b.match, slip.match || '')) return false;
    const bDate = extractDatePart(b.dateDisplay, b.timestamp);
    return !slipDate || !bDate || slipDate === bDate;
  });

  if (candidateByMatchAndDate.length === 1) {
    return candidateByMatchAndDate[0];
  } else if (candidateByMatchAndDate.length > 1) {
    // Disambiguate by odds & stake
    const exactOddsAndStake = candidateByMatchAndDate.find(
      (b) =>
        (slipOdds <= 0 || Math.abs(b.priceTaken - slipOdds) < 0.15) &&
        (slipStake <= 0 || Math.abs(b.stake - slipStake) < 5)
    );
    if (exactOddsAndStake) return exactOddsAndStake;

    const exactOdds = candidateByMatchAndDate.find(
      (b) => slipOdds > 0 && Math.abs(b.priceTaken - slipOdds) < 0.15
    );
    if (exactOdds) return exactOdds;

    return candidateByMatchAndDate[0];
  }

  // 3. Match by Match Name alone (if unique in existingBets)
  const candidateByMatchOnly = existingBets.filter((b) => isSameMatch(b.match, slip.match || ''));
  if (candidateByMatchOnly.length === 1) {
    return candidateByMatchOnly[0];
  }

  // 4. Disambiguate by Odds + Stake on the same date (e.g. if match names had completely different languages/abbreviations)
  if (slipOdds > 0 && slipStake > 0 && slipDate) {
    const candidateByOddsStakeDate = existingBets.find((b) => {
      const bDate = extractDatePart(b.dateDisplay, b.timestamp);
      return (
        bDate === slipDate &&
        Math.abs(b.priceTaken - slipOdds) < 0.05 &&
        Math.abs(b.stake - slipStake) < 2
      );
    });
    if (candidateByOddsStakeDate) return candidateByOddsStakeDate;
  }

  return undefined;
}

/**
 * Merges an incoming 1xBet slip into an existing pre-staked LoggedBet record,
 * strictly preserving genuine Pinnacle lines, original model probability,
 * model EV, and authentic CLV edge.
 */
export function correlateAndMerge(
  incoming: Partial<LoggedBet> & { id: string },
  existing: LoggedBet
): LoggedBet {
  // Preserve real Pinnacle line
  const pin =
    existing.pinnacleLineAtBet && existing.pinnacleLineAtBet > 1.0
      ? existing.pinnacleLineAtBet
      : incoming.pinnacleLineAtBet && incoming.pinnacleLineAtBet > 1.0
      ? incoming.pinnacleLineAtBet
      : existing.priceTaken;

  const pinClose =
    existing.pinnacleClosingLine && existing.pinnacleClosingLine > 1.0
      ? existing.pinnacleClosingLine
      : incoming.pinnacleClosingLine && incoming.pinnacleClosingLine > 1.0
      ? incoming.pinnacleClosingLine
      : pin;

  const price =
    incoming.priceTaken && incoming.priceTaken > 1.0 ? incoming.priceTaken : existing.priceTaken;

  // True CLV calculated against genuine Pinnacle line (not hardcoded 5%!)
  let clv = existing.clvPercent;
  if (typeof clv !== 'number' || isNaN(clv)) {
    clv = pinClose > 0 ? Math.round(((price / pinClose) - 1.0) * 1000) / 10 : 0;
  } else if (incoming.priceTaken && incoming.priceTaken !== existing.priceTaken && pinClose > 0) {
    clv = Math.round(((price / pinClose) - 1.0) * 1000) / 10;
  }

  let notes = existing.notes || '';
  if (incoming.id && !notes.includes(incoming.id)) {
    notes = notes ? `${notes} • Slip № ${incoming.id}` : `Slip № ${incoming.id}`;
  }
  if (incoming.notes && !notes.includes(incoming.notes)) {
    notes = `${notes} • ${incoming.notes}`;
  }

  return {
    ...existing,
    id: incoming.id || existing.id,
    dateDisplay: incoming.dateDisplay || existing.dateDisplay,
    timestamp: incoming.timestamp || existing.timestamp,
    priceTaken: price,
    stake: incoming.stake && incoming.stake > 0 ? incoming.stake : existing.stake,
    payout: typeof incoming.payout === 'number' ? incoming.payout : existing.payout,
    outcome: incoming.outcome || existing.outcome,
    pinnacleLineAtBet: pin,
    pinnacleClosingLine: pinClose,
    clvPercent: clv,
    modelProb:
      existing.modelProb && !isNaN(existing.modelProb)
        ? existing.modelProb
        : incoming.modelProb || Math.round((1 / price) * 1000) / 1000,
    modelEV:
      typeof existing.modelEV === 'number' && !isNaN(existing.modelEV)
        ? existing.modelEV
        : incoming.modelEV || (clv !== undefined ? clv : 0),
    selection:
      existing.selection && !['Match Outcome (1X2)', 'Value Selection'].includes(existing.selection)
        ? existing.selection
        : incoming.selection || existing.selection,
    marketType: existing.marketType || incoming.marketType || '1X2',
    notes,
  };
}

/**
 * Converts parsed 1xBet slips into full LoggedBet records ready for Position Ledger.
 * When existing pre-staked bets are present, correlates and preserves their real Pinnacle lines,
 * model EV, and true CLV edge rather than substituting an arbitrary +5% dummy fallback.
 */
export function convertParsedSlipsToLoggedBets(
  slips: any[],
  existingBets?: LoggedBet[]
): LoggedBet[] {
  let existing = existingBets;
  if (!existing && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (raw) existing = JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  existing = existing || [];

  return (slips || []).map((s) => {
    let timestamp = new Date().toISOString();
    const dateStr = s.dateDisplay || s.date || '';
    if (dateStr) {
      const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/);
      if (parts) {
        const [, d, m, y, h, min] = parts;
        timestamp = new Date(`${y}-${m}-${d}T${h}:${min}:00Z`).toISOString();
      }
    }

    const odds =
      typeof s.odds === 'number' && !isNaN(s.odds) && s.odds > 0
        ? s.odds
        : typeof s.priceTaken === 'number' && !isNaN(s.priceTaken) && s.priceTaken > 0
        ? s.priceTaken
        : parseFloat(s.odds || s.priceTaken) || 2.0;

    const stake =
      typeof s.stake === 'number' && !isNaN(s.stake)
        ? s.stake
        : parseFloat(s.stake) || 0;

    const payout =
      typeof s.payout === 'number' && !isNaN(s.payout)
        ? s.payout
        : parseFloat(s.payout) || 0;

    const outcome =
      s.outcome === 'WON' || s.outcome === 'LOST' || s.outcome === 'PUSH' || s.outcome === 'CASHOUT'
        ? s.outcome
        : 'OPEN';

    // 1. Correlate with pre-staked record if exists
    const matched = findCorrelatedBet(s, existing!);
    if (matched) {
      return correlateAndMerge(
        {
          id: String(s.id || matched.id),
          timestamp,
          dateDisplay: dateStr || matched.dateDisplay,
          priceTaken: odds,
          stake: stake > 0 ? stake : matched.stake,
          payout,
          outcome,
          notes: s.notes,
        },
        matched
      );
    }

    // 2. Uncorrelated slip (placed outside Bet Horizon):
    // Do NOT invent a fake 5% markup! Keep Pinnacle line only if explicitly provided.
    const pin =
      typeof s.pinnacleLineAtBet === 'number' && s.pinnacleLineAtBet > 1.0
        ? s.pinnacleLineAtBet
        : odds;
    const clv =
      typeof s.clvPercent === 'number' && !isNaN(s.clvPercent)
        ? s.clvPercent
        : undefined;

    return {
      id: String(s.id || `bet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
      timestamp,
      dateDisplay: dateStr || new Date().toLocaleDateString('en-GB'),
      league: s.league || 'Sportsbook Market',
      match: s.match || 'Football Match',
      selection:
        s.selection ||
        (s.match?.toLowerCase().includes("players' stats")
          ? 'Anytime Goalscorer'
          : 'Match Outcome (1X2)'),
      marketType:
        s.marketType || (s.match?.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2'),
      bookmaker: s.bookmaker || '1xBet',
      priceTaken: odds,
      pinnacleLineAtBet: pin,
      pinnacleClosingLine:
        typeof s.pinnacleClosingLine === 'number' ? s.pinnacleClosingLine : pin,
      modelProb:
        typeof s.modelProb === 'number' && s.modelProb > 0
          ? s.modelProb
          : Math.round((1 / odds) * 1000) / 1000,
      modelEV:
        typeof s.modelEV === 'number'
          ? s.modelEV
          : clv !== undefined
          ? clv
          : 0,
      stake,
      payout,
      outcome,
      clvPercent: clv,
      notes: s.notes || `Bet slip № ${s.id || ''}`,
    };
  });
}

/**
 * Returns clean, unencoded JavaScript for running in browser Developer Tools Console or Bookmarklet.
 * Asynchronously pre-fetches cloud positions to correlate pre-staked bets and preserve their authentic
 * Pinnacle lines, model EV, and CLV edge.
 */
export function getOneXBetCleanScript(
  projectId: string = 'bet-admin-8d3fc',
  appOrigin: string = 'https://bet-admin-iota.vercel.app'
): string {
  return `(async function() {
  var existing = document.getElementById('bh-sync-overlay');
  if (existing) existing.remove();

  // 1. Fetch existing cloud positions from Firestore to correlate pre-staked bets
  var cloudBets = [];
  try {
    var fetchUrl = 'https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/positions?pageSize=300';
    var res = await fetch(fetchUrl);
    if (res.ok) {
      var data = await res.json();
      (data.documents || []).forEach(function(d) {
        var f = d.fields || {};
        var docId = d.name ? d.name.split('/').pop() : '';
        if (docId === 'bankroll_snapshot' || docId.indexOf('odds_cache_') === 0) return;
        cloudBets.push({
          id: f.id ? f.id.stringValue : docId,
          docName: d.name,
          match: f.match ? f.match.stringValue : '',
          selection: f.selection ? f.selection.stringValue : '',
          marketType: f.marketType ? f.marketType.stringValue : '1X2',
          priceTaken: f.priceTaken ? (f.priceTaken.doubleValue || f.priceTaken.integerValue || 0) : 0,
          pinnacleLineAtBet: f.pinnacleLineAtBet ? (f.pinnacleLineAtBet.doubleValue || f.pinnacleLineAtBet.integerValue) : null,
          pinnacleClosingLine: f.pinnacleClosingLine ? (f.pinnacleClosingLine.doubleValue || f.pinnacleClosingLine.integerValue) : null,
          clvPercent: f.clvPercent ? (f.clvPercent.doubleValue || f.clvPercent.integerValue) : null,
          modelEV: f.modelEV ? (f.modelEV.doubleValue || f.modelEV.integerValue) : null,
          modelProb: f.modelProb ? (f.modelProb.doubleValue || f.modelProb.integerValue) : null,
          stake: f.stake ? (f.stake.doubleValue || f.stake.integerValue || 0) : 0,
          payout: f.payout ? (f.payout.doubleValue || f.payout.integerValue || 0) : 0,
          outcome: f.outcome ? f.outcome.stringValue : 'OPEN',
          notes: f.notes ? f.notes.stringValue : '',
          dateDisplay: f.dateDisplay ? f.dateDisplay.stringValue : ''
        });
      });
    }
  } catch(e) {
    console.warn('Bet Horizon: Could not pre-fetch cloud positions for correlation:', e);
  }

  function norm(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/players'?\\s*stats\\s*/gi, '')
      .replace(/\\s*-\\s*/g, ' vs ')
      .replace(/\\s+v\\s+/g, ' vs ')
      .replace(/[^a-z0-9\\s]/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  function matchSame(a, b) {
    var na = norm(a);
    var nb = norm(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    var pa = na.split(/\\s+vs\\s+/);
    var pb = nb.split(/\\s+vs\\s+/);
    if (pa.length === 2 && pb.length === 2) {
      if ((pa[0] === pb[0] && pa[1] === pb[1]) || (pa[0] === pb[1] && pa[1] === pb[0])) return true;
      if ((pa[0].includes(pb[0]) || pb[0].includes(pa[0])) && (pa[1].includes(pb[1]) || pb[1].includes(pa[1]))) return true;
    }
    return false;
  }

  function findPreStaked(slip) {
    for (var i = 0; i < cloudBets.length; i++) {
      var cb = cloudBets[i];
      if (slip.id && cb.id === slip.id) return cb;
      if (matchSame(slip.match, cb.match)) return cb;
      if (slip.priceTaken > 0 && Math.abs(slip.priceTaken - cb.priceTaken) < 0.05 && slip.stake > 0 && Math.abs(slip.stake - cb.stake) < 2) return cb;
    }
    return null;
  }

  var slips = [];

  // Method 1: Precise DOM Extraction using 1xBet data-test attributes
  var couponRows = document.querySelectorAll('.bets-history-default-coupon-row, [data-test="betting-bets-history-default-coupon-id"]');
  if (couponRows.length > 0) {
    var seenIds = {};
    for (var r = 0; r < couponRows.length; r++) {
      var row = couponRows[r];
      var container = row.closest('.bets-history-default-body__row') || row.closest('.bets-history-default-coupon-row') || row;

      var idEl = container.querySelector('[data-test="betting-bets-history-default-coupon-id"]');
      var idText = idEl ? idEl.textContent.replace(/[^0-9]/g, '').trim() : '';
      if (!idText || seenIds[idText]) continue;
      seenIds[idText] = true;

      var gameEl = container.querySelector('[data-test="betting-bets-history-default-coupon-game-name"]');
      var champEl = container.querySelector('[data-test="betting-bets-history-default-coupon-champ-name"]');
      var statusEl = container.querySelector('[data-test="betting-bets-history-default-coupon-status-label"]');
      var dateEl = container.querySelector('[data-test="betting-bets-history-default-coupon-date"]');
      var amountEl = container.querySelector('[data-test="betting-bets-history-default-coupon-amount"]');
      var oddsEl = container.querySelector('[data-test="betting-bets-history-default-coupon-total-coef"]');
      var winEl = container.querySelector('[data-test="betting-bets-history-default-coupon-win-amount"]');

      var matchName = gameEl ? gameEl.textContent.trim().replace(/\\s*-\\s*/g, ' vs ') : 'Football Match';
      var league = champEl ? champEl.textContent.trim() : 'Sportsbook';
      var rawStatus = statusEl ? statusEl.textContent.trim() : 'Unsettled';

      var dateRaw = dateEl ? dateEl.textContent.trim().replace(/^Date\\s*/i, '') : '';
      var stakeRaw = amountEl ? amountEl.textContent.replace(/[^0-9.]/g, '') : '0';
      var oddsRaw = oddsEl ? oddsEl.textContent.replace(/[^0-9.]/g, '') : '0';
      var winRaw = winEl ? winEl.textContent.replace(/[^0-9.]/g, '') : '0';

      var stake = parseFloat(stakeRaw) || 0;
      var odds = parseFloat(oddsRaw) || 0;
      var potentialWin = parseFloat(winRaw) || 0;

      var status = 'Unsettled';
      var outcome = 'OPEN';
      var payout = 0;

      if (/Loss/i.test(rawStatus)) {
        status = 'Loss';
        outcome = 'LOST';
        payout = 0;
      } else if (/Win/i.test(rawStatus)) {
        status = 'Win';
        outcome = 'WON';
        payout = potentialWin > 0 ? potentialWin : Math.round(stake * odds * 100) / 100;
      } else if (/Sold|Cashed/i.test(rawStatus)) {
        status = 'Sold';
        outcome = 'WON';
        payout = potentialWin > 0 ? potentialWin : Math.round(stake * 0.94 * 100) / 100;
      }

      var matched = findPreStaked({ id: idText, match: matchName, priceTaken: odds, stake: stake });
      var pinAtBet = matched && matched.pinnacleLineAtBet && matched.pinnacleLineAtBet > 1.0 ? matched.pinnacleLineAtBet : null;
      var pinClose = matched && matched.pinnacleClosingLine && matched.pinnacleClosingLine > 1.0 ? matched.pinnacleClosingLine : pinAtBet;
      var finalClv = null;
      if (matched && typeof matched.clvPercent === 'number' && !isNaN(matched.clvPercent)) {
        finalClv = matched.clvPercent;
      } else if (pinClose && pinClose > 1.0 && odds > 0) {
        finalClv = Math.round(((odds / pinClose) - 1.0) * 1000) / 10;
      }
      var finalEv = matched && typeof matched.modelEV === 'number' ? matched.modelEV : (finalClv !== null ? finalClv : null);
      var finalProb = matched && typeof matched.modelProb === 'number' ? matched.modelProb : (odds > 0 ? Math.round((1 / odds) * 1000) / 1000 : null);
      var finalSel = matched && matched.selection && !['Match Outcome (1X2)', 'Value Selection'].includes(matched.selection)
        ? matched.selection
        : (matchName.toLowerCase().includes("players' stats") ? 'Anytime Goalscorer' : odds >= 4.5 && odds <= 6.5 ? 'Draw (1X2)' : 'Match Outcome (1X2)');
      var finalLeague = (matched && matched.league) || league;
      var finalNotes = (matched && matched.notes ? matched.notes + ' • ' : '') + 'Bet slip № ' + idText + (status === 'Sold' ? ' • Cashed Out' : '');
      var oldDraftId = (matched && matched.id && matched.id !== idText && matched.id.startsWith('bet-')) ? matched.id : null;

      slips.push({
        id: idText,
        timestamp: new Date().toISOString(),
        dateDisplay: dateRaw || new Date().toLocaleDateString('en-GB'),
        league: finalLeague,
        match: matchName,
        selection: finalSel,
        marketType: (matched && matched.marketType) || (matchName.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2'),
        bookmaker: '1xBet',
        priceTaken: odds,
        pinnacleLineAtBet: pinAtBet,
        pinnacleClosingLine: pinClose,
        modelProb: finalProb,
        modelEV: finalEv,
        stake: stake,
        payout: payout,
        outcome: outcome,
        clvPercent: finalClv,
        notes: finalNotes,
        originalDraftId: oldDraftId,
        matchedPreStaked: !!matched
      });
    }
  }

  // Method 2: Fallback to text parsing
  if (slips.length === 0) {
    var text = document.body.innerText || '';
    var chunks = text.split(/Bet\\s+slip/i);

    for (var i = 1; i < chunks.length; i++) {
      var chunk = chunks[i];
      var prevChunk = chunks[i - 1];
      var idM = chunk.match(/\\b(87\\d{8,10}|\\d{10,12})\\b/);
      if (!idM) continue;
      var slipId = idM[1];

      var dateM = chunk.match(/(\\d{2}\\/\\d{2}\\/\\d{4}[^0-9]+\\d{2}:\\d{2})/);
      var dateStr = dateM ? dateM[1].replace(/[^0-9\\/:]/g, ' ').trim() : '';

      var betM = chunk.match(/Bet[\\s\\S]*?([0-9.,]+)\\s*(?:NGN|\\$|€|£)?/i) || chunk.match(/([0-9.,]+)\\s*NGN/i);
      var stakeFallback = betM ? parseFloat(betM[1].replace(/,/g, '')) : 0;

      var oddsM = chunk.match(/Odds[\\s\\S]*?([0-9.]+)/i);
      var oddsFallback = oddsM ? parseFloat(oddsM[1]) : 0;

      var winM = chunk.match(/Win[\\s\\S]*?([0-9.,]+)/i);
      var winFallback = winM ? parseFloat(winM[1].replace(/,/g, '')) : 0;

      var prevLines = prevChunk.split(/[\\r\\n]+/).map(function(l) { return l.trim(); }).filter(Boolean);
      var last3 = prevLines.slice(-4).join(' ');
      var sFallback = 'Unsettled';
      var oFallback = 'OPEN';
      var pFallback = 0;

      if (/Sold|Cashed/i.test(last3) || /Sold|Cashed/i.test(chunk)) {
        sFallback = 'Sold';
        oFallback = 'WON';
        pFallback = winFallback > 0 ? winFallback : stakeFallback * 0.94;
      } else if (/\\bLoss\\b/i.test(last3)) {
        sFallback = 'Loss';
        oFallback = 'LOST';
      } else if (/\\bWin\\b/i.test(last3)) {
        sFallback = 'Win';
        oFallback = 'WON';
        pFallback = winFallback > 0 ? winFallback : Math.round(stakeFallback * oddsFallback * 100) / 100;
      }

      var matchFallback = '';
      var leagueFallback = '';
      for (var j = prevLines.length - 1; j >= 0; j--) {
        var line = prevLines[j];
        if (/Win|Loss|Unsettled|Sold|Single bet|NGN|Date|Repeat/i.test(line)) continue;
        if (line.includes(' - ') || line.includes(' vs ')) {
          matchFallback = line.replace(/\\s*-\\s*/g, ' vs ');
          if (prevLines[j + 1] && !/Win|Loss|Unsettled|Sold|Single bet|NGN/i.test(prevLines[j + 1])) {
            leagueFallback = prevLines[j + 1];
          }
          break;
        }
      }

      var matchedFb = findPreStaked({ id: slipId, match: matchFallback, priceTaken: oddsFallback, stake: stakeFallback });
      var pinAtBetFb = matchedFb && matchedFb.pinnacleLineAtBet && matchedFb.pinnacleLineAtBet > 1.0 ? matchedFb.pinnacleLineAtBet : null;
      var pinCloseFb = matchedFb && matchedFb.pinnacleClosingLine && matchedFb.pinnacleClosingLine > 1.0 ? matchedFb.pinnacleClosingLine : pinAtBetFb;
      var finalClvFb = null;
      if (matchedFb && typeof matchedFb.clvPercent === 'number' && !isNaN(matchedFb.clvPercent)) {
        finalClvFb = matchedFb.clvPercent;
      } else if (pinCloseFb && pinCloseFb > 1.0 && oddsFallback > 0) {
        finalClvFb = Math.round(((oddsFallback / pinCloseFb) - 1.0) * 1000) / 10;
      }
      var finalEvFb = matchedFb && typeof matchedFb.modelEV === 'number' ? matchedFb.modelEV : (finalClvFb !== null ? finalClvFb : null);
      var finalProbFb = matchedFb && typeof matchedFb.modelProb === 'number' ? matchedFb.modelProb : (oddsFallback > 0 ? Math.round((1 / oddsFallback) * 1000) / 1000 : null);
      var finalSelFb = matchedFb && matchedFb.selection && !['Match Outcome (1X2)', 'Value Selection'].includes(matchedFb.selection)
        ? matchedFb.selection
        : (matchFallback.toLowerCase().includes("players' stats") ? 'Anytime Goalscorer' : (oddsFallback >= 2.6 && oddsFallback <= 4.8 ? 'Draw (1X2)' : 'Match Outcome (1X2)'));
      var finalLeagueFb = (matchedFb && matchedFb.league) || leagueFallback || 'Sportsbook Market';
      var oldDraftIdFb = (matchedFb && matchedFb.id && matchedFb.id !== slipId && matchedFb.id.startsWith('bet-')) ? matchedFb.id : null;

      slips.push({
        id: slipId,
        timestamp: new Date().toISOString(),
        dateDisplay: dateStr || new Date().toLocaleDateString('en-GB'),
        league: finalLeagueFb,
        match: matchFallback || 'Football Match',
        selection: finalSelFb,
        marketType: (matchedFb && matchedFb.marketType) || (matchFallback.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2'),
        bookmaker: '1xBet',
        priceTaken: oddsFallback,
        pinnacleLineAtBet: pinAtBetFb,
        pinnacleClosingLine: pinCloseFb,
        modelProb: finalProbFb,
        modelEV: finalEvFb,
        stake: stakeFallback,
        payout: pFallback,
        outcome: oFallback,
        clvPercent: finalClvFb,
        notes: (matchedFb && matchedFb.notes ? matchedFb.notes + ' • ' : '') + 'Bet slip № ' + slipId + (sFallback === 'Sold' ? ' • Cashed Out' : ''),
        originalDraftId: oldDraftIdFb,
        matchedPreStaked: !!matchedFb
      });
    }
  }

  if (slips.length === 0) {
    alert('⚠️ Bet Horizon: No bet slips found on this page. Make sure you are on 1xBet "Bet history" page!');
    return;
  }

  // Create floating UI overlay on 1xBet page
  var box = document.createElement('div');
  box.id = 'bh-sync-overlay';
  box.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;background:#090d16;color:#f8fafc;padding:20px;border-radius:18px;border:2px solid #10b981;box-shadow:0 20px 50px rgba(0,0,0,0.85);font-family:sans-serif;width:340px;max-width:90vw;backdrop-filter:blur(10px);';

  var correlatedCount = slips.filter(function(s) { return s.matchedPreStaked; }).length;

  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<div style="font-weight:900;color:#10b981;font-size:14px;letter-spacing:0.5px;">⚡ BET HORIZON SYNC</div>' +
    '<button id="bh-close-btn" style="background:#1e293b;border:none;color:#94a3b8;cursor:pointer;border-radius:6px;width:24px;height:24px;font-weight:bold;">✕</button>' +
    '</div>' +
    '<div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">Found <strong style="color:#38bdf8;">' + slips.length + ' bet slips</strong> on this page.</div>' +
    '<div style="font-size:11px;color:#10b981;margin-bottom:12px;background:rgba(16,185,129,0.1);padding:6px 10px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);">🎯 ' + correlatedCount + ' of ' + slips.length + ' slips matched pre-staked positions! Original CLV preserved.</div>' +
    '<div id="bh-slips-list" style="max-height:160px;overflow-y:auto;background:#020617;border-radius:10px;padding:8px;margin-bottom:14px;font-size:11px;border:1px solid #1e293b;"></div>' +
    '<div id="bh-status-msg" style="font-size:11px;color:#94a3b8;margin-bottom:12px;text-align:center;">Click below to push correlated slips to your cloud ledger.</div>' +
    '<button id="bh-sync-btn" style="width:100%;padding:10px;background:#10b981;color:#020617;font-weight:bold;border:none;border-radius:10px;cursor:pointer;font-size:13px;transition:0.2s;">🚀 Sync ' + slips.length + ' Slips (Preserve CLV)</button>' +
    '<button id="bh-copy-btn" style="width:100%;margin-top:6px;padding:8px;background:#1e293b;color:#f8fafc;font-weight:bold;border:none;border-radius:10px;cursor:pointer;font-size:11px;">📋 Copy JSON to Clipboard</button>';

  document.body.appendChild(box);

  var listEl = document.getElementById('bh-slips-list');
  slips.slice(0, 10).forEach(function(s) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #0f172a;';
    var color = s.outcome === 'WON' ? '#10b981' : s.outcome === 'LOST' ? '#ef4444' : '#38bdf8';
    var clvTag = typeof s.clvPercent === 'number'
      ? '<span style="color:#10b981;font-weight:bold;font-size:10px;margin-left:4px;">🎯 ' + (s.clvPercent >= 0 ? '+' : '') + s.clvPercent.toFixed(1) + '%</span>'
      : '';
    row.innerHTML = '<div><span>' + s.match.substring(0, 16) + '...</span>' + clvTag + '</div><span style="font-weight:bold;color:' + color + ';">' + s.outcome + ' (₦' + s.stake + ')</span>';
    listEl.appendChild(row);
  });
  if (slips.length > 10) {
    var more = document.createElement('div');
    more.style.cssText = 'text-align:center;color:#64748b;padding-top:4px;';
    more.innerText = '+ ' + (slips.length - 10) + ' more slips...';
    listEl.appendChild(more);
  }

  document.getElementById('bh-close-btn').onclick = function() { box.remove(); };

  document.getElementById('bh-copy-btn').onclick = function() {
    navigator.clipboard.writeText(JSON.stringify(slips, null, 2)).then(function() {
      document.getElementById('bh-status-msg').innerHTML = '<span style="color:#10b981;">✅ Copied ' + slips.length + ' slips to clipboard!</span>';
    });
  };

  document.getElementById('bh-sync-btn').onclick = async function() {
    var btn = document.getElementById('bh-sync-btn');
    btn.disabled = true;
    btn.innerText = '⏳ Syncing to Cloud...';
    var statusEl = document.getElementById('bh-status-msg');

    try {
      var synced = 0;
      for (var k = 0; k < slips.length; k++) {
        var s = slips[k];
        var url = 'https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/positions/' + s.id;
        var fields = {
          id: { stringValue: s.id },
          match: { stringValue: s.match },
          league: { stringValue: s.league },
          selection: { stringValue: s.selection },
          marketType: { stringValue: s.marketType || '1X2' },
          bookmaker: { stringValue: '1xBet' },
          priceTaken: { doubleValue: s.priceTaken },
          stake: { doubleValue: s.stake },
          payout: { doubleValue: s.payout },
          outcome: { stringValue: s.outcome },
          dateDisplay: { stringValue: s.dateDisplay },
          timestamp: { stringValue: s.timestamp },
          notes: { stringValue: s.notes }
        };

        if (typeof s.pinnacleLineAtBet === 'number' && !isNaN(s.pinnacleLineAtBet)) {
          fields.pinnacleLineAtBet = { doubleValue: s.pinnacleLineAtBet };
        }
        if (typeof s.pinnacleClosingLine === 'number' && !isNaN(s.pinnacleClosingLine)) {
          fields.pinnacleClosingLine = { doubleValue: s.pinnacleClosingLine };
        }
        if (typeof s.clvPercent === 'number' && !isNaN(s.clvPercent)) {
          fields.clvPercent = { doubleValue: s.clvPercent };
        }
        if (typeof s.modelEV === 'number' && !isNaN(s.modelEV)) {
          fields.modelEV = { doubleValue: s.modelEV };
        }
        if (typeof s.modelProb === 'number' && !isNaN(s.modelProb)) {
          fields.modelProb = { doubleValue: s.modelProb };
        }

        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: fields })
        });

        // If this official slip replaces an old pre-staked draft ID, prune the draft from cloud
        if (s.originalDraftId) {
          try {
            var delUrl = 'https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/positions/' + s.originalDraftId;
            await fetch(delUrl, { method: 'DELETE' });
          } catch(e) {}
        }

        synced++;
      }
      statusEl.innerHTML = '<span style="color:#10b981;font-weight:bold;">✅ All ' + synced + ' slips saved to Cloud with genuine CLV!</span><br><a href="${appOrigin}/#refresh=1" target="_blank" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#0284c7;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px;">📊 Open Bet Horizon Ledger ↗</a>';
      btn.innerText = '✅ Synced Successfully!';
      btn.style.background = '#059669';
    } catch (err) {
      statusEl.innerHTML = '<span style="color:#ef4444;">⚠️ Cloud push blocked by browser. Opening Bet Horizon to complete sync...</span>';
      window.open('${appOrigin}/#import1x=' + encodeURIComponent(JSON.stringify(slips)), '_blank');
      btn.innerText = 'Opened Bet Horizon!';
      btn.disabled = false;
    }
  };
})();`;
}

/**
 * Generates the 1-click JavaScript bookmarklet string that runs on 1xbet.com.
 */
export function generateOneXBetBookmarklet(
  projectId: string = 'bet-admin-8d3fc',
  appOrigin: string = 'https://bet-admin-iota.vercel.app'
): string {
  const scriptBody = getOneXBetCleanScript(projectId, appOrigin);
  const compact = scriptBody.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURI(compact)}`;
}
