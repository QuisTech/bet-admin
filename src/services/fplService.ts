/**
 * FPL Live Data Ingestion Service
 * Connects to the official Premier League API via Vite proxy (/api/fpl/bootstrap-static/)
 * to extract underlying player metrics (xG90, xA90, xMins, injuries) and team strength ratings.
 */

import type { PlayerFeatures } from '../models/propEnsembleEngine';

export interface FPLPlayer {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number; // Team ID (1 to 20)
  element_type: number; // 1: GK, 2: DEF, 3: MID, 4: FWD
  expected_goals_per_90: string;
  expected_assists_per_90: string;
  expected_goal_involvements_per_90: string;
  minutes: number;
  chance_of_playing_next_round: number | null;
  news: string;
  status: string; // 'a': available, 'd': doubtful, 'i': injured, 's': suspended
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface FPLBootstrapData {
  players: FPLPlayer[];
  teams: FPLTeam[];
  currentGameweek: number;
  lastUpdated: string;
  isLive: boolean;
}

/**
 * Fetches live bootstrap data from official FPL API.
 */
export async function fetchLiveFPLBootstrap(): Promise<FPLBootstrapData> {
  try {
    const res = await fetch('/api/fpl/bootstrap-static/');
    if (!res.ok) {
      throw new Error(`FPL API responded with HTTP ${res.status}`);
    }

    const json = await res.json();
    const players: FPLPlayer[] = (json.elements || []).map((el: any) => ({
      id: el.id,
      web_name: el.web_name,
      first_name: el.first_name,
      second_name: el.second_name,
      team: el.team,
      element_type: el.element_type,
      expected_goals_per_90: el.expected_goals_per_90 || '0.00',
      expected_assists_per_90: el.expected_assists_per_90 || '0.00',
      expected_goal_involvements_per_90: el.expected_goal_involvements_per_90 || '0.00',
      minutes: el.minutes || 0,
      chance_of_playing_next_round: el.chance_of_playing_next_round,
      news: el.news || '',
      status: el.status || 'a',
    }));

    const teams: FPLTeam[] = (json.teams || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
      strength_attack_home: t.strength_attack_home || 1100,
      strength_attack_away: t.strength_attack_away || 1100,
      strength_defence_home: t.strength_defence_home || 1100,
      strength_defence_away: t.strength_defence_away || 1100,
    }));

    const currentEvent = (json.events || []).find((ev: any) => ev.is_current) || { id: 1 };

    console.log(`[bet-admin] Successfully synced ${players.length} FPL players & ${teams.length} teams.`);

    return {
      players,
      teams,
      currentGameweek: currentEvent.id || 1,
      lastUpdated: new Date().toLocaleTimeString(),
      isLive: true,
    };
  } catch (err) {
    console.warn('[bet-admin] Using offline fallback for FPL bootstrap:', err);
    return getOfflineFPLBootstrap();
  }
}

/**
 * Transforms an FPL player into feature inputs for our XGBoost Prop Engine,
 * applying Bayesian shrinkage to small sample sizes and realistic expected minutes.
 */
export function buildPlayerPropFeatures(
  player: FPLPlayer,
  opponentTeam: FPLTeam | null,
  isHome: boolean
): PlayerFeatures {
  const rawXG90 = parseFloat(player.expected_goals_per_90) || 0;
  const rawXA90 = parseFloat(player.expected_assists_per_90) || 0;

  // Bayesian shrinkage for small sample sizes:
  // Forward: ~0.30 xG90 baseline, Midfielder: ~0.16 xG90 baseline, Defender: ~0.05 xG90 baseline
  const baselineXG = player.element_type === 4 ? 0.30 : player.element_type === 3 ? 0.16 : 0.05;
  const baselineXA = player.element_type === 4 ? 0.12 : player.element_type === 3 ? 0.18 : 0.08;

  // Weight towards empirical data increases with sample size (confidence reaches 1.0 at 450 minutes = 5 full games)
  const sampleConfidence = Math.min(1.0, Math.max(0.12, (player.minutes || 0) / 450));
  const xG90 = Math.round((rawXG90 * sampleConfidence + baselineXG * (1.0 - sampleConfidence)) * 100) / 100;
  const xA90 = Math.round((rawXA90 * sampleConfidence + baselineXA * (1.0 - sampleConfidence)) * 100) / 100;

  // Realistic expected minutes based on historical playing time
  // Starter: > 450 mins -> 80 mins
  // Rotation Starter: 250-450 mins -> 60 mins
  // Regular Sub: 100-250 mins -> 30 mins
  // Bench / Fringe Sub: < 100 mins -> 15 mins
  let xMins =
    player.minutes > 450
      ? 80
      : player.minutes > 250
      ? 60
      : player.minutes > 100
      ? 30
      : 15;

  if (player.chance_of_playing_next_round === 0) xMins = 0;
  else if (player.chance_of_playing_next_round === 50) xMins = Math.round(xMins * 0.5);
  else if (player.chance_of_playing_next_round === 75) xMins = Math.round(xMins * 0.75);

  // Normalize opponent defensive rating (baseline: 1100 -> 1.30 goals conceded)
  const oppDef = opponentTeam
    ? isHome
      ? opponentTeam.strength_defence_away
      : opponentTeam.strength_defence_home
    : 1100;
  const opponentConcededPer90 = (2200 - oppDef) / 800; // Scaled ~0.8 to 1.8

  return {
    xG90,
    xA90,
    xMins,
    opponentConcededPer90: Math.max(0.7, Math.min(2.1, opponentConcededPer90)),
    isHome,
    teamAttackingRating: 1.55,
  };
}

/**
 * Offline fallback data when FPL API is unreachable
 */
function getOfflineFPLBootstrap(): FPLBootstrapData {
  return {
    players: [
      { id: 1, web_name: 'Haaland', first_name: 'Erling', second_name: 'Haaland', team: 13, element_type: 4, expected_goals_per_90: '0.88', expected_assists_per_90: '0.15', expected_goal_involvements_per_90: '1.03', minutes: 720, chance_of_playing_next_round: 100, news: '', status: 'a' },
      { id: 2, web_name: 'Palmer', first_name: 'Cole', second_name: 'Palmer', team: 7, element_type: 3, expected_goals_per_90: '0.62', expected_assists_per_90: '0.41', expected_goal_involvements_per_90: '1.03', minutes: 710, chance_of_playing_next_round: 100, news: '', status: 'a' },
      { id: 3, web_name: 'Saka', first_name: 'Bukayo', second_name: 'Saka', team: 1, element_type: 3, expected_goals_per_90: '0.45', expected_assists_per_90: '0.52', expected_goal_involvements_per_90: '0.97', minutes: 690, chance_of_playing_next_round: 100, news: '', status: 'a' },
      { id: 4, web_name: 'Salah', first_name: 'Mohamed', second_name: 'Salah', team: 12, element_type: 3, expected_goals_per_90: '0.68', expected_assists_per_90: '0.45', expected_goal_involvements_per_90: '1.13', minutes: 720, chance_of_playing_next_round: 100, news: '', status: 'a' },
    ],
    teams: [
      { id: 1, name: 'Arsenal', short_name: 'ARS', strength_attack_home: 1260, strength_attack_away: 1240, strength_defence_home: 1340, strength_defence_away: 1320 },
      { id: 7, name: 'Chelsea', short_name: 'CHE', strength_attack_home: 1190, strength_attack_away: 1170, strength_defence_home: 1180, strength_defence_away: 1150 },
      { id: 12, name: 'Liverpool', short_name: 'LIV', strength_attack_home: 1280, strength_attack_away: 1250, strength_defence_home: 1300, strength_defence_away: 1280 },
      { id: 13, name: 'Man City', short_name: 'MCI', strength_attack_home: 1320, strength_attack_away: 1290, strength_defence_home: 1310, strength_defence_away: 1290 },
    ],
    currentGameweek: 6,
    lastUpdated: 'Offline Benchmark',
    isLive: false,
  };
}
