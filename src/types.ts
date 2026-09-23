export type MarketType = '1X2' | 'BTTS' | 'OVER_2_5' | 'PLAYER_GOAL' | 'PLAYER_SOT' | 'PLAYER_ASSIST';

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
  modelProb: number;        // Ensemble probability
  sportyBetOdds: number;
  pinnacleFairOdds: number;
  evPercent: number;        // Expected Value % e.g. +12.5%
  recommendedStakePercent: number; // e.g. 0.02 (2%)
}

export interface MatchData {
  id: string;
  league: 'Premier League' | 'La Liga' | 'Serie A' | 'Bundesliga' | 'Champions League';
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  homeXG: number;
  awayXG: number;
  dixonColesMatrix: number[][]; // 5x5 goal matrix
  markets: {
    marketType: MarketType;
    selection: string;
    sportyBetOdds: number;
    pinnacleOdds: number;
    ensembleProb: number;
    evPercent: number;
    recommendedStakePercent: number;
    models: ModelScore[];
  }[];
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
