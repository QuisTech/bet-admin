/**
 * UNTOUCHED HISTORICAL HOLDOUT AUDIT: DIRECT PRODUCTION GENERATOR
 * 
 * Directly imports and evaluates the production `generateCoveringPortfolio()`
 * from `src/services/jackpotService.ts` across all 184 holdout rounds.
 */

import fs from 'fs';
import { generateCoveringPortfolio, createSportyMatch } from '../src/services/jackpotService.ts';

const sportyRounds = JSON.parse(fs.readFileSync('public/data/sportybet_history.json', 'utf8'));
const validSporty = sportyRounds.filter(r => r.sales && r.sales > 0 && r.matches && r.matches.length === 12);
validSporty.sort((a, b) => b.deadline - a.deadline);
const oosSporty = validSporty.slice(0, Math.floor(validSporty.length / 2)); // 184 rounds

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

function evaluateRound(tickets, hr) {
  const actual = hr.matches.map(m => m.actualResult);
  let c12 = 0, c11 = 0, c10 = 0, totalScore = 0;
  for (const t of tickets) {
    let s = 0;
    for (let i = 0; i < 12; i++) {
      const pick = Array.isArray(t) ? t[i] : t.picksArray[i];
      if (pick === actual[i]) s++;
    }
    totalScore += s;
    if (s === 12) c12++;
    else if (s === 11) c11++;
    else if (s === 10) c10++;
  }
  const w12 = hr.winnings.find(w => w.correctEvents === 12);
  const w11 = hr.winnings.find(w => w.correctEvents === 11);
  const w10 = hr.winnings.find(w => w.correctEvents === 10);
  const pub12 = w12 ? w12.winNum : 0;
  const pub11 = w11 ? w11.winNum : 0;
  const pub10 = w10 ? w10.winNum : 0;

  let pay12 = c12 > 0 ? (c12 / (pub12 + c12)) * hr.maxWinnings : 0;
  let pay11 = (c11 > 0 && pub11 > 0 && w11?.perWinnings > 0) ? (c11 / (pub11 + c11)) * (pub11 * w11.perWinnings) : 0;
  let pay10 = (c10 > 0 && pub10 > 0 && w10?.perWinnings > 0) ? (c10 / (pub10 + c10)) * (pub10 * w10.perWinnings) : 0;

  return { payout: pay12 + pay11 + pay10, meanScore: totalScore / tickets.length, c12, c11, c10, isWin: (c10 + c11 + c12) > 0 };
}

const stats = {
  BALANCED_COVER: { payout: 0, scores: [], hits10: 0, hits11: 0, hits12: 0, winRounds: 0 },
  CONTRARIAN_HIGH_EV: { payout: 0, scores: [], hits10: 0, hits11: 0, hits12: 0, winRounds: 0 },
  RANDOM_RUSH: { payout: 0, scores: [], hits10: 0, hits11: 0, hits12: 0, winRounds: 0 }
};

for (let r = 0; r < oosSporty.length; r++) {
  const hr = oosSporty[r];
  const slate = {
    platform: 'sportybet',
    roundId: hr.roundNumber,
    roundNumber: hr.roundNumber,
    matchCount: 12,
    totalGames: 12,
    matches: hr.matches.map(m => createSportyMatch(m.no, '', '', '', '', '', m.odds.home, m.odds.draw, m.odds.away))
  };

  // 1. BALANCED_COVER
  const tBal = generateCoveringPortfolio(slate, { targetTickets: 8, strategy: 'BALANCED_COVER' });
  const rBal = evaluateRound(tBal, hr);
  stats.BALANCED_COVER.payout += rBal.payout;
  stats.BALANCED_COVER.scores.push(rBal.meanScore);
  stats.BALANCED_COVER.hits10 += rBal.c10;
  stats.BALANCED_COVER.hits11 += rBal.c11;
  stats.BALANCED_COVER.hits12 += rBal.c12;
  if (rBal.isWin) stats.BALANCED_COVER.winRounds++;

  // 2. CONTRARIAN_HIGH_EV
  const tCon = generateCoveringPortfolio(slate, { targetTickets: 8, strategy: 'CONTRARIAN_HIGH_EV' });
  const rCon = evaluateRound(tCon, hr);
  stats.CONTRARIAN_HIGH_EV.payout += rCon.payout;
  stats.CONTRARIAN_HIGH_EV.scores.push(rCon.meanScore);
  stats.CONTRARIAN_HIGH_EV.hits10 += rCon.c10;
  stats.CONTRARIAN_HIGH_EV.hits11 += rCon.c11;
  stats.CONTRARIAN_HIGH_EV.hits12 += rCon.c12;
  if (rCon.isWin) stats.CONTRARIAN_HIGH_EV.winRounds++;

  // 3. RANDOM_RUSH
  const rng = createSeededRandom(parseInt(hr.periodNumber, 10) + 42);
  const tRand = [];
  for (let i = 0; i < 8; i++) {
    const picks = [];
    for (let m = 0; m < 12; m++) {
      const v = Math.floor(rng() * 3);
      picks.push(v === 0 ? '1' : v === 1 ? 'X' : '2');
    }
    tRand.push(picks);
  }
  const rRand = evaluateRound(tRand, hr);
  stats.RANDOM_RUSH.payout += rRand.payout;
  stats.RANDOM_RUSH.scores.push(rRand.meanScore);
  stats.RANDOM_RUSH.hits10 += rRand.c10;
  stats.RANDOM_RUSH.hits11 += rRand.c11;
  stats.RANDOM_RUSH.hits12 += rRand.c12;
  if (rRand.isWin) stats.RANDOM_RUSH.winRounds++;
}

const totalStake = 184 * 800;
console.log('========================================================================================');
console.log('   UNTOUCHED HISTORICAL HOLDOUT AUDIT: DIRECT PRODUCTION GENERATOR (184 ROUNDS)');
console.log('========================================================================================\n');
console.log('| Strategy | Invested | Payout | Net P/L | ROI | Accuracy | 10/12 | 11/12 | 12/12 | Cash Rounds |');
console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

for (const [sName, sData] of Object.entries(stats)) {
  const net = sData.payout - totalStake;
  const roi = (net / totalStake) * 100;
  const avgAcc = sData.scores.reduce((a, b) => a + b, 0) / sData.scores.length;
  console.log(`| **${sName}** | ₦${totalStake.toLocaleString()} | ₦${Math.round(sData.payout).toLocaleString()} | ₦${Math.round(net).toLocaleString()} | **${roi.toFixed(1)}%** | ${avgAcc.toFixed(3)} / 12 | ${sData.hits10} | ${sData.hits11} | ${sData.hits12} | ${sData.winRounds} / 184 |`);
}
console.log('\n========================================================================================');
