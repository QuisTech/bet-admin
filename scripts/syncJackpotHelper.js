import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADERS = {
  'accept': '*/*',
  'clientid': 'web',
  'countrycode': 'ng',
  'currency': 'NGN',
  'operid': '2',
  'platform': 'web',
  'referer': 'https://shop.sportybet.com/ng/jackpot',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
};

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${body.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchRoundWithRetry(opt, retries = 2) {
  const url = `https://shop.sportybet.com/api/ng/jackpot/previous?periodNumber=${opt.periodNumber}&periodId=${opt.id}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchJson(url);
      if (res && res.data && res.data.elements && res.data.elements.length === 12) {
        const d = res.data;
        const resMap = { 1: '1', 2: 'X', 3: '2' };
        return {
          periodNumber: d.periodNumber,
          periodId: d.id,
          deadline: d.deadline,
          maxWinnings: d.maxWinnings,
          sales: parseFloat(d.sales || '0'),
          totalCombinationsBought: Math.round(parseFloat(d.sales || '0') / 100),
          winnings: (d.winnings || []).map(w => ({
            correctEvents: w.correctEvents,
            winNum: w.winNum,
            perWinnings: parseFloat(w.perWinnings || '0')
          })),
          isJackpotWon: (d.winnings || []).some(w => w.correctEvents === 12 && w.winNum > 0),
          matches: d.elements.map(el => {
            const homeOdds = parseFloat(el.outcomes && el.outcomes[0] ? el.outcomes[0].odds : '0');
            const drawOdds = parseFloat(el.outcomes && el.outcomes[1] ? el.outcomes[1].odds : '0');
            const awayOdds = parseFloat(el.outcomes && el.outcomes[2] ? el.outcomes[2].odds : '0');

            return {
              no: el.index,
              home: el.home,
              away: el.away,
              homeScore: parseInt(el.homeScore || '0', 10),
              awayScore: parseInt(el.awayScore || '0', 10),
              actualResult: resMap[el.result] || '1',
              odds: {
                home: homeOdds,
                draw: drawOdds,
                away: awayOdds
              }
            };
          })
        };
      }
      return null;
    } catch (err) {
      if (attempt === retries) return null;
      await delay(200);
    }
  }
  return null;
}

export async function syncJackpotRounds() {
  const publicPath = path.join(__dirname, '..', 'public', 'data', 'sportybet_history.json');

  let existingArchive = [];
  if (fs.existsSync(publicPath)) {
    try {
      existingArchive = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    } catch (e) {
      existingArchive = [];
    }
  }

  const existingIds = new Set(existingArchive.map(r => r.periodNumber));

  const optionsRes = await fetchJson('https://shop.sportybet.com/api/ng/jackpot/periodOptions');
  if (!optionsRes || !optionsRes.data) {
    throw new Error('Failed to fetch periodOptions from SportyBet CMS');
  }

  const allAvailable = optionsRes.data;
  const missingOptions = allAvailable.filter(opt => !existingIds.has(opt.periodNumber));

  if (missingOptions.length === 0) {
    return {
      success: true,
      totalCount: existingArchive.length,
      newAddedCount: 0,
      newRounds: [],
      message: `All rounds already up to date (${existingArchive.length} rounds archived).`,
      allRounds: existingArchive
    };
  }

  const newResults = [];
  for (const opt of missingOptions) {
    const roundData = await fetchRoundWithRetry(opt);
    if (roundData) {
      newResults.push(roundData);
    }
    await delay(120);
  }

  const combined = [...newResults, ...existingArchive];
  combined.sort((a, b) => parseInt(b.periodNumber, 10) - parseInt(a.periodNumber, 10));

  fs.writeFileSync(publicPath, JSON.stringify(combined, null, 2), 'utf8');

  return {
    success: true,
    totalCount: combined.length,
    newAddedCount: newResults.length,
    newRounds: newResults,
    message: `Successfully synced ${newResults.length} new round(s)! Total: ${combined.length} rounds.`,
    allRounds: combined
  };
}
