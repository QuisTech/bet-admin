const https = require('https');
const fs = require('fs');
const path = require('path');

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
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${body.substring(0, 100)}`));
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

async function main() {
  const isForceAll = process.argv.includes('--force-all');
  const publicPath = path.join(__dirname, '..', 'public', 'data', 'sportybet_history.json');

  let existingArchive = [];
  if (fs.existsSync(publicPath) && !isForceAll) {
    try {
      existingArchive = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    } catch (e) {
      existingArchive = [];
    }
  }

  const existingIds = new Set(existingArchive.map(r => r.periodNumber));

  console.log(`[Historical Sync] Checking for new completed SportyBet jackpot rounds...`);
  const optionsRes = await fetchJson('https://shop.sportybet.com/api/ng/jackpot/periodOptions');
  if (!optionsRes || !optionsRes.data) {
    console.error('Failed to fetch periodOptions');
    return;
  }

  const allAvailable = optionsRes.data;
  console.log(`[Historical Sync] Total rounds archived in SportyBet CMS: ${allAvailable.length}`);
  console.log(`[Historical Sync] Local rounds currently stored: ${existingArchive.length}`);

  // Find missing rounds (e.g. newly completed rounds)
  const missingOptions = isForceAll 
    ? allAvailable 
    : allAvailable.filter(opt => !existingIds.has(opt.periodNumber));

  if (missingOptions.length === 0) {
    console.log(`[Historical Sync] ✅ All rounds are already up to date! (${existingArchive.length} rounds, from ${existingArchive[existingArchive.length - 1].periodNumber} to ${existingArchive[0].periodNumber}).`);
    return;
  }

  console.log(`[Historical Sync] Found ${missingOptions.length} new round(s) to fetch:`, missingOptions.map(o => o.periodNumber).join(', '));

  const newResults = [];
  for (let i = 0; i < missingOptions.length; i++) {
    const opt = missingOptions[i];
    process.stdout.write(`Fetching Round ${opt.periodNumber} [${i + 1}/${missingOptions.length}]... `);
    const roundData = await fetchRoundWithRetry(opt);
    if (roundData) {
      newResults.push(roundData);
      console.log(`Done (${roundData.isJackpotWon ? 'Jackpot Won' : 'Rollover'}).`);
    } else {
      console.log(`Failed or not yet settled.`);
    }
    await delay(120);
  }

  const combined = isForceAll ? newResults : [...newResults, ...existingArchive];
  combined.sort((a, b) => parseInt(b.periodNumber, 10) - parseInt(a.periodNumber, 10));

  fs.writeFileSync(publicPath, JSON.stringify(combined, null, 2), 'utf8');
  console.log(`[Historical Sync] ✅ Saved updated archive! Total rounds now: ${combined.length} (${publicPath}).`);
}

main().catch(console.error);
