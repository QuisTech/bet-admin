/**
 * Live Odds Ingestion & Pinnacle Shin Market Fusion Service
 * Connects to The Odds API (/api/odds) to fetch real-time sportsbook lines,
 * runs Pinnacle lines through Shin's De-Vigging engine, and detects live +EV pricing blunders.
 */

import type { MatchData } from '../types';
import { calculateShinDevig } from '../models/shinDevig';
import { calculateDixonColes } from '../models/dixonColes';
import { BASE_MATCHES } from '../data/matchRepository';

export interface OddsApiFixture {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string; // e.g. 'pinnacle', 'bet365', 'draftkings', 'williamhill'
    title: string;
    last_update: string;
    markets: {
      key: 'h2h' | 'totals';
      outcomes: {
        name: string; // 'Arsenal', 'Draw', 'Over', etc.
        price: number; // decimal odds e.g. 1.85
        point?: number; // 2.5
      }[];
    }[];
  }[];
}

export interface OddsServiceConfig {
  apiKey?: string;
  sport: 'soccer_epl' | 'soccer_spain_la_liga' | 'soccer_uefa_champs_league';
  regions: 'eu' | 'uk' | 'us';
}

const STORAGE_KEY = 'bet_admin_odds_api_key';

export function getSavedOddsApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveOddsApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to save Odds API key:', e);
  }
}

/**
 * Fetches live bookmaker odds and maps them into our MatchData model with Shin de-vigging.
 */
export async function fetchLiveOddsFeed(customKey?: string): Promise<{
  matches: MatchData[];
  isLive: boolean;
  source: string;
  count: number;
}> {
  const apiKey = customKey || getSavedOddsApiKey();

  // If no API key is provided, use structured baseline matches
  if (!apiKey) {
    return {
      matches: BASE_MATCHES,
      isLive: false,
      source: 'Offline Benchmark Dataset',
      count: BASE_MATCHES.length,
    };
  }

  try {
    // The Odds API endpoint proxied via Vite (/api/odds/sports/soccer_epl/odds/)
    const url = `/api/odds/sports/soccer_epl/odds/?apiKey=${apiKey}&regions=eu,uk&markets=h2h,totals&oddsFormat=decimal`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`The Odds API returned status ${res.status}: ${res.statusText}`);
    }

    const rawFixtures: OddsApiFixture[] = await res.json();
    if (!Array.isArray(rawFixtures) || rawFixtures.length === 0) {
      return {
        matches: BASE_MATCHES,
        isLive: true,
        source: 'Live Feed (0 fixtures found, showing baseline)',
        count: BASE_MATCHES.length,
      };
    }

    // Process and enrich fixtures with Shin's De-Vigging
    const matches: MatchData[] = rawFixtures.slice(0, 10).map((fix) => {
      // Find sharp bookmaker (Pinnacle or Betfair) vs recreational bookmakers
      const sharpBook =
        fix.bookmakers.find((b) => b.key === 'pinnacle') ||
        fix.bookmakers.find((b) => b.key === 'betfair_ex_uk') ||
        fix.bookmakers[0];

      const retailBook =
        fix.bookmakers.find((b) => b.key === 'bet365') ||
        fix.bookmakers.find((b) => b.key === 'williamhill') ||
        fix.bookmakers[fix.bookmakers.length - 1] ||
        sharpBook;

      // Extract 1X2 market
      const sharpH2h = sharpBook?.markets.find((m) => m.key === 'h2h');
      const retailH2h = retailBook?.markets.find((m) => m.key === 'h2h');

      let homeOdds = 2.0;
      let drawOdds = 3.2;
      let awayOdds = 3.5;
      let retailHomeOdds = 2.1;

      if (sharpH2h && sharpH2h.outcomes.length >= 3) {
        homeOdds = sharpH2h.outcomes.find((o) => o.name === fix.home_team)?.price || 2.0;
        drawOdds = sharpH2h.outcomes.find((o) => o.name.toLowerCase() === 'draw')?.price || 3.2;
        awayOdds = sharpH2h.outcomes.find((o) => o.name === fix.away_team)?.price || 3.5;
      }

      if (retailH2h) {
        retailHomeOdds = retailH2h.outcomes.find((o) => o.name === fix.home_team)?.price || homeOdds * 1.05;
      }

      // De-vig sharp odds via Shin's Method
      const shin1X2 = calculateShinDevig([homeOdds, drawOdds, awayOdds]);
      const fairHomeProb = shin1X2.fairProbabilities[0];

      // Estimate Dixon-Coles goal lambdas
      const homeXG = Math.max(0.8, Math.min(2.8, 1 / homeOdds * 2.2));
      const awayXG = Math.max(0.6, Math.min(2.4, 1 / awayOdds * 2.0));
      const dc = calculateDixonColes(homeXG, 1.0, awayXG, 1.0);

      // Compute +EV edge on Home Win
      const evHome = Math.round((fairHomeProb * retailHomeOdds - 1.0) * 1000) / 10;

      const kickoffFormatted = new Date(fix.commence_time).toLocaleDateString('en-GB', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        id: fix.id,
        league: 'Premier League',
        homeTeam: fix.home_team,
        awayTeam: fix.away_team,
        kickoff: kickoffFormatted,
        homeXG: Math.round(homeXG * 100) / 100,
        awayXG: Math.round(awayXG * 100) / 100,
        dixonColesMatrix: dc.matrix,
        markets: [
          {
            marketType: '1X2',
            selection: `${fix.home_team} Win`,
            sportyBetOdds: retailHomeOdds,
            pinnacleOdds: homeOdds,
            ensembleProb: fairHomeProb,
            evPercent: evHome,
            recommendedStakePercent: 0.02,
            models: [
              { modelId: 'dixon_coles', modelName: 'Dixon-Coles Poisson', probability: dc.homeWinProb, uncertainty: 0.02 },
              { modelId: 'shin_devig', modelName: 'Shin Pinnacle De-Vigged', probability: fairHomeProb, uncertainty: 0.01 },
            ],
          },
        ],
        playerProps: [],
      };
    });

    console.log(`[bet-admin] Successfully ingested ${matches.length} live matches from The Odds API.`);
    return {
      matches,
      isLive: true,
      source: 'The Odds API (Live Pinnacle / Bet365 Feed)',
      count: matches.length,
    };
  } catch (err: any) {
    console.warn('[bet-admin] Live odds fetch error, using baseline matches:', err.message);
    return {
      matches: BASE_MATCHES,
      isLive: false,
      source: `Offline Fallback (${err.message})`,
      count: BASE_MATCHES.length,
    };
  }
}
