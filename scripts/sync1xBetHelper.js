import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  'referer': 'https://1xbet.ng/en/toto/football/draws',
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${body.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchDrawDetails(drawMeta, retries = 2) {
  const drawNumber = drawMeta.TiragNumber;
  const drawUrl = `https://1xbet.ng/toto-api-v2/web/v1/toto/3/draws/${drawNumber}?curISO=NGN&lng=en`;
  const catUrl = `https://1xbet.ng/toto-api-v2/web/v1/toto/3/draws/${drawNumber}/categories?curISO=NGN&lng=en`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [matchesRes, catRes] = await Promise.all([
        fetchJson(drawUrl),
        fetchJson(catUrl).catch(() => ({ CategoriesList: [] })),
      ]);

      const matches = [];
      (matchesRes.ChampsWithGames || []).forEach((c) => {
        (c.GamesList || []).forEach((g) => {
          const score = g.Score || '0:0';
          const parts = score.split(':').map((x) => parseInt(x.trim(), 10));
          const hScore = isNaN(parts[0]) ? 0 : parts[0];
          const aScore = isNaN(parts[1]) ? 0 : parts[1];
          const actualResult = hScore > aScore ? '1' : hScore === aScore ? 'X' : '2';

          const bukPercents = g.BetsPercents?.map((bp) => bp.BukPercentage) || [33.3, 33.3, 33.3];
          const playerPercents = g.BetsPercents?.map((bp) => bp.PlayerPercentage) || [33.3, 33.3, 33.3];

          // Estimated decimal odds from bookmaker percentage
          const homeOdds = bukPercents[0] > 0 ? parseFloat((100 / bukPercents[0]).toFixed(2)) : 2.5;
          const drawOdds = bukPercents[1] > 0 ? parseFloat((100 / bukPercents[1]).toFixed(2)) : 3.2;
          const awayOdds = bukPercents[2] > 0 ? parseFloat((100 / bukPercents[2]).toFixed(2)) : 2.8;

          matches.push({
            no: g.GameNumber,
            home: g.Opponent1Name,
            away: g.Opponent2Name,
            champ: c.ChampName || 'Football Pool',
            startDate: g.StartDate ? g.StartDate * 1000 : drawMeta.UpdateDate * 1000,
            homeScore: hScore,
            awayScore: aScore,
            score,
            actualResult,
            odds: {
              home: homeOdds,
              draw: drawOdds,
              away: awayOdds,
            },
            publicPercents: {
              home: playerPercents[0] || 33.3,
              draw: playerPercents[1] || 33.3,
              away: playerPercents[2] || 33.3,
            },
            bookPercents: {
              home: bukPercents[0] || 33.3,
              draw: bukPercents[1] || 33.3,
              away: bukPercents[2] || 33.3,
            },
          });
        });
      });

      matches.sort((a, b) => a.no - b.no);

      const categories = (catRes.CategoriesList || []).map((cat) => ({
        categoryNumber: cat.CategoryNumber,
        percent: cat.Percent,
        prizeFund: cat.PrizeFund,
        guessed: cat.Guessed,
        guessedInCurr: cat.GuessedInCurr,
        payoutOn1CurrUnit: cat.PayoutOn1CurrUnit,
      }));

      const isJackpotWon = categories.some((c) => c.categoryNumber === 14 && c.guessed > 0);

      return {
        drawNumber,
        status: drawMeta.StringTiragStatus || 'Settled',
        jackpot: drawMeta.Jackpot,
        pool: drawMeta.Pool,
        prizeFund: drawMeta.PrizeFund,
        countBets: drawMeta.CountBets,
        countVariants: drawMeta.CountVariants,
        countUnique: drawMeta.CountUnique,
        updateDate: drawMeta.UpdateDate * 1000,
        isJackpotWon,
        matches,
        categories,
      };
    } catch (err) {
      if (attempt === retries) return null;
      await delay(250);
    }
  }
  return null;
}

export async function sync1xBetDraws(options = {}) {
  const publicPath = path.join(__dirname, '..', 'public', 'data', '1xbet_history.json');
  const maxPages = options.maxPages || 6; // Up to 250+ draws

  let existingArchive = [];
  if (fs.existsSync(publicPath)) {
    try {
      existingArchive = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    } catch (e) {
      existingArchive = [];
    }
  }

  const existingDrawNums = new Set(existingArchive.map((r) => r.drawNumber));

  // Collect all settled draw metadata across pages
  const drawsToFetch = [];
  for (let page = 1; page <= maxPages; page++) {
    const listRes = await fetchJson(`https://1xbet.ng/toto-api-v2/web/v1/toto/3/draws?page=${page}&curISO=NGN&lng=en&count=50`);
    if (!listRes || !listRes.TiragsList) break;

    const list = listRes.TiragsList;
    for (const d of list) {
      // Only archive settled draws with completed results
      if (d.TiragStatus === 2 && !existingDrawNums.has(d.TiragNumber)) {
        drawsToFetch.push(d);
      }
    }

    if (list.length < 50) break;
    await delay(100);
  }

  if (drawsToFetch.length === 0) {
    return {
      success: true,
      totalCount: existingArchive.length,
      newAddedCount: 0,
      newDraws: [],
      message: `All 1xBet draws already up to date (${existingArchive.length} draws archived).`,
      allDraws: existingArchive,
    };
  }

  const newResults = [];
  for (const drawMeta of drawsToFetch) {
    const drawDetails = await fetchDrawDetails(drawMeta);
    if (drawDetails && drawDetails.matches.length === 14) {
      newResults.push(drawDetails);
    }
    await delay(120);
  }

  const combined = [...newResults, ...existingArchive];
  combined.sort((a, b) => b.drawNumber - a.drawNumber);

  fs.writeFileSync(publicPath, JSON.stringify(combined, null, 2), 'utf8');

  return {
    success: true,
    totalCount: combined.length,
    newAddedCount: newResults.length,
    newDraws: newResults,
    message: `Successfully synced ${newResults.length} new 1xBet draw(s)! Total: ${combined.length} draws.`,
    allDraws: combined,
  };
}
