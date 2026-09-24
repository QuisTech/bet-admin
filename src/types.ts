export type MarketType = '1X2' | 'BTTS' | 'OVER_2_5' | 'PLAYER_GOAL' | 'PLAYER_SOT' | 'PLAYER_ASSIST';

export type ConsensusLevel = 'STRONG_AGREEMENT' | 'MODERATE' | 'DIVERGENCE';
export type ModelPipelineMode = 'ALL_CONSENSUS' | 'DOMAIN_ONLY' | 'TRAINED_ML_ONLY';

export interface SupportedLeague {
  id: string; // The Odds API sport key e.g. 'soccer_epl'
  name: string; // e.g. 'Premier League'
  flag: string; // e.g. '🇬🇧'
  country: string; // e.g. 'England'
  tempo: number; // League baseline tempo (e.g. 2.78)
}

export const SUPPORTED_LEAGUES: SupportedLeague[] = [
  { id: 'soccer_uefa_nations_league', name: 'UEFA Nations League', flag: '🇪🇺', country: 'Europe', tempo: 2.65 },
  { id: 'soccer_epl', name: 'Premier League', flag: '🇬🇧', country: 'England', tempo: 2.78 },
  { id: 'soccer_spain_la_liga', name: 'La Liga', flag: '🇪🇸', country: 'Spain', tempo: 2.52 },
  { id: 'soccer_italy_serie_a', name: 'Serie A', flag: '🇮🇹', country: 'Italy', tempo: 2.64 },
  { id: 'soccer_germany_bundesliga', name: 'Bundesliga', flag: '🇩🇪', country: 'Germany', tempo: 3.16 },
  { id: 'soccer_france_ligue_one', name: 'Ligue 1', flag: '🇫🇷', country: 'France', tempo: 2.60 },
  { id: 'soccer_uefa_champs_league', name: 'Champions League', flag: '🏆', country: 'Europe', tempo: 2.95 },
  { id: 'soccer_usa_mls', name: 'Major League Soccer (MLS)', flag: '🇺🇸', country: 'USA', tempo: 3.05 },
  { id: 'soccer_england_league1', name: 'EFL League One', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'England', tempo: 2.70 },
];

export interface BookmakerOdds {
  bookmaker: string; // e.g. 'SportyBet', 'Bet365', 'Pinnacle', 'Betfair'
  selection: string; // e.g. 'HOME_WIN', 'HAALAND_GOAL', 'YES'
  odds: number;      // e.g. 2.10
}

export interface ModelScore {
  modelId: string;         // e.g. 'dixon_coles', 'xgboost_props', 'market_fusion'
  modelName: string;       // e.g. 'Dixon-Coles Poisson', 'XGBoost Prop ML', 'Pinnacle De-Vigged'
  probability: number;     // 0.0 to 1.0
  uncertainty: number;     // e.g. 0.03
}

export interface PlayerProp {
  id: string;
  playerName: string;
  team: string;
  opponent: string;
  propType: 'GOAL' | 'SOT' | 'ASSIST';
  threshold?: number;       // e.g. 1.5 for Over 1.5 SOT
  xG90: number;
  xA90: number;
  xMins: number;
  modelProb: number;        // Active probability (Consensus or selected pipeline)
  domainProb?: number;      // Pipeline 1 (Domain Ensemble: Poisson + FPL + Pinnacle)
  trainedMlProb?: number;   // Pipeline 2 (Offline Trained XGBoost ML Model)
  consensusProb?: number;   // Weighted Dual Consensus (55% Domain / 45% ML)
  modelDelta?: number;      // Absolute delta |Trained ML - Domain|
  consensusLevel?: ConsensusLevel; // Strong agreement, moderate, divergence
  sportyBetOdds: number;
  pinnacleFairOdds: number;
  evPercent: number;        // Expected Value % e.g. +12.5%
  recommendedStakePercent: number; // e.g. 0.02 (2%)
}

export interface MarketSelection {
  marketType: MarketType;
  selection: string;
  sportyBetOdds: number;
  pinnacleOdds: number;
  ensembleProb: number;     // Active probability (Consensus or selected pipeline)
  domainProb?: number;      // Pipeline 1 (Domain Ensemble)
  trainedMlProb?: number;   // Pipeline 2 (Offline Trained XGBoost)
  consensusProb?: number;   // Weighted Dual Consensus
  modelDelta?: number;      // Absolute delta |Trained ML - Domain|
  consensusLevel?: ConsensusLevel;
  evPercent: number;
  recommendedStakePercent: number;
  models: ModelScore[];
}

export interface MatchData {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  homeXG: number;
  awayXG: number;
  dixonColesMatrix: number[][]; // 5x5 goal matrix
  markets: MarketSelection[];
  playerProps: PlayerProp[];
}

export interface BankrollConfig {
  totalBankrollNGN: number;  // e.g. 200000 or 1200000 or 10000000
  totalBankroll: number;     // alias for general formatting
  kellyFraction: number;      // e.g. 0.25 (0.25x Kelly)
  maxStakePercent: number;   // e.g. 0.02 (2%)
  currency: 'NGN' | 'USD';
  strategyMode: 'safe' | 'risky' | 'value';
}

export interface BacktestMetric {
  gameweek: number;
  totalBets: number;
  winRate: number;
  roiPercent: number;
  clvPercent: number;
  bankrollNGN: number;
  brierScore: number;
}
