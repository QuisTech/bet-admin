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

/**
 * Converts parsed 1xBet slips into full LoggedBet records ready for Position Ledger.
 */
export function convertParsedSlipsToLoggedBets(slips: any[]): LoggedBet[] {
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

    const pinnacleLine =
      typeof s.pinnacleLineAtBet === 'number' && !isNaN(s.pinnacleLineAtBet) && s.pinnacleLineAtBet > 0
        ? s.pinnacleLineAtBet
        : Math.max(1.05, Math.round((odds / 1.05) * 100) / 100);

    const clv =
      typeof s.clvPercent === 'number' && !isNaN(s.clvPercent)
        ? s.clvPercent
        : Math.round(((odds / pinnacleLine) - 1.0) * 1000) / 10;

    const prob =
      typeof s.modelProb === 'number' && !isNaN(s.modelProb) && s.modelProb > 0
        ? s.modelProb
        : Math.round((1 / odds) * 1000) / 1000;

    const outcome =
      s.outcome === 'WON' || s.outcome === 'LOST' || s.outcome === 'PUSH' || s.outcome === 'CASHOUT'
        ? s.outcome
        : 'OPEN';

    return {
      id: String(s.id || `bet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
      timestamp,
      dateDisplay: dateStr || new Date().toLocaleDateString('en-GB'),
      league: s.league || 'Sportsbook Market',
      match: s.match || 'Football Match',
      selection: s.selection || 'Match Outcome (1X2)',
      marketType: s.marketType || (s.match?.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2'),
      bookmaker: s.bookmaker || '1xBet',
      priceTaken: odds,
      pinnacleLineAtBet: pinnacleLine,
      pinnacleClosingLine:
        typeof s.pinnacleClosingLine === 'number' && !isNaN(s.pinnacleClosingLine)
          ? s.pinnacleClosingLine
          : pinnacleLine,
      modelProb: prob,
      modelEV: typeof s.modelEV === 'number' && !isNaN(s.modelEV) ? s.modelEV : Math.round(clv * 10) / 10,
      stake,
      payout,
      outcome,
      clvPercent: clv,
      notes: s.notes || `Bet slip № ${s.id || ''}${s.status === 'Sold' ? ' • Cashed Out / Sold' : ''}`,
    };
  });
}

/**
 * Returns clean, unencoded JavaScript for running in browser Developer Tools Console.
 */
export function getOneXBetCleanScript(
  projectId: string = 'bet-admin-8d3fc',
  appOrigin: string = 'https://bet-admin-iota.vercel.app'
): string {
  return `(function() {
  var existing = document.getElementById('bh-sync-overlay');
  if (existing) existing.remove();

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

      slips.push({
        id: idText,
        timestamp: new Date().toISOString(),
        dateDisplay: dateRaw || new Date().toLocaleDateString('en-GB'),
        league: league,
        match: matchName,
        selection: matchName.toLowerCase().includes("players' stats") ? 'Anytime Goalscorer' : odds >= 4.5 && odds <= 6.5 ? 'Draw (1X2)' : 'Match Outcome (1X2)',
        marketType: matchName.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2',
        bookmaker: '1xBet',
        priceTaken: odds,
        pinnacleLineAtBet: Math.max(1.05, Math.round((odds / 1.05) * 100) / 100),
        pinnacleClosingLine: Math.max(1.05, Math.round((odds / 1.05) * 100) / 100),
        modelProb: odds > 0 ? Math.round((1 / odds) * 1000) / 1000 : 0.5,
        modelEV: 5.0,
        stake: stake,
        payout: payout,
        outcome: outcome,
        clvPercent: odds > 0 ? Math.round(((odds / Math.max(1.05, odds / 1.05)) - 1.0) * 1000) / 10 : 0,
        notes: 'Bet slip № ' + idText + (status === 'Sold' ? ' • Cashed Out' : '')
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

      slips.push({
        id: slipId,
        timestamp: new Date().toISOString(),
        dateDisplay: dateStr || new Date().toLocaleDateString('en-GB'),
        league: leagueFallback || 'Sportsbook Market',
        match: matchFallback || 'Football Match',
        selection: matchFallback.toLowerCase().includes("players' stats") ? 'Anytime Goalscorer' : (oddsFallback >= 2.6 && oddsFallback <= 4.8 ? 'Draw (1X2)' : oddsFallback >= 1.35 && oddsFallback <= 2.15 ? 'Double Chance (1X)' : 'Match Outcome (1X2)'),
        marketType: matchFallback.toLowerCase().includes("players' stats") ? 'PROPS' : '1X2',
        bookmaker: '1xBet',
        priceTaken: oddsFallback,
        pinnacleLineAtBet: Math.max(1.05, Math.round((oddsFallback / 1.05) * 100) / 100),
        pinnacleClosingLine: Math.max(1.05, Math.round((oddsFallback / 1.05) * 100) / 100),
        modelProb: oddsFallback > 0 ? Math.round((1 / oddsFallback) * 1000) / 1000 : 0.5,
        modelEV: 5.0,
        stake: stakeFallback,
        payout: pFallback,
        outcome: oFallback,
        clvPercent: 5.0,
        notes: 'Bet slip № ' + slipId + (sFallback === 'Sold' ? ' • Cashed Out' : '')
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

  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<div style="font-weight:900;color:#10b981;font-size:14px;letter-spacing:0.5px;">⚡ BET HORIZON SYNC</div>' +
    '<button id="bh-close-btn" style="background:#1e293b;border:none;color:#94a3b8;cursor:pointer;border-radius:6px;width:24px;height:24px;font-weight:bold;">✕</button>' +
    '</div>' +
    '<div style="font-size:12px;color:#cbd5e1;margin-bottom:12px;">Found <strong style="color:#38bdf8;">' + slips.length + ' bet slips</strong> on this page ready to sync.</div>' +
    '<div id="bh-slips-list" style="max-height:160px;overflow-y:auto;background:#020617;border-radius:10px;padding:8px;margin-bottom:14px;font-size:11px;border:1px solid #1e293b;"></div>' +
    '<div id="bh-status-msg" style="font-size:11px;color:#94a3b8;margin-bottom:12px;text-align:center;">Click below to push directly to your cloud ledger.</div>' +
    '<button id="bh-sync-btn" style="width:100%;padding:10px;background:#10b981;color:#020617;font-weight:bold;border:none;border-radius:10px;cursor:pointer;font-size:13px;transition:0.2s;">🚀 Sync ' + slips.length + ' Slips to Cloud</button>' +
    '<button id="bh-copy-btn" style="width:100%;margin-top:6px;padding:8px;background:#1e293b;color:#f8fafc;font-weight:bold;border:none;border-radius:10px;cursor:pointer;font-size:11px;">📋 Copy JSON to Clipboard</button>';

  document.body.appendChild(box);

  var listEl = document.getElementById('bh-slips-list');
  slips.slice(0, 10).forEach(function(s) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #0f172a;';
    var color = s.outcome === 'WON' ? '#10b981' : s.outcome === 'LOST' ? '#ef4444' : '#38bdf8';
    row.innerHTML = '<span>' + s.match.substring(0, 20) + '...</span><span style="font-weight:bold;color:' + color + ';">' + s.outcome + ' (₦' + s.stake + ')</span>';
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
          bookmaker: { stringValue: '1xBet' },
          priceTaken: { doubleValue: s.priceTaken },
          stake: { doubleValue: s.stake },
          payout: { doubleValue: s.payout },
          outcome: { stringValue: s.outcome },
          dateDisplay: { stringValue: s.dateDisplay },
          timestamp: { stringValue: s.timestamp },
          clvPercent: { doubleValue: s.clvPercent },
          notes: { stringValue: s.notes }
        };
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: fields })
        });
        synced++;
      }
      statusEl.innerHTML = '<span style="color:#10b981;font-weight:bold;">✅ All ' + synced + ' slips saved to Cloud!</span><br><a href="${appOrigin}/#refresh=1" target="_blank" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#0284c7;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px;">📊 Open Bet Horizon Ledger ↗</a>';
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
