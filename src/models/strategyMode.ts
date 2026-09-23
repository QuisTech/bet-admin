export interface StrategyModeConfig {
  id: 'safe' | 'risky' | 'value';
  name: string;
  badgeClass: string;
  minProb: number;          // Minimum model probability threshold
  minEV: number;            // Minimum EV % threshold
  kellyMultiplier: number;  // Fractional Kelly multiplier
  maxStakePercent: number;  // Max stake % allowed per bet
  oddsRange: string;
  description: string;
  justification: string;
}

export const STRATEGY_MODES: Record<'safe' | 'risky' | 'value', StrategyModeConfig> = {
  safe: {
    id: 'safe',
    name: 'SAFE (Capital Preservation)',
    badgeClass: 'badge-safe',
    minProb: 0.65,
    minEV: 3.0,
    kellyMultiplier: 0.15,
    maxStakePercent: 0.01, // 1% max stake
    oddsRange: '1.30 – 1.70',
    description: 'High-probability selections with conservative 0.15× Fractional Kelly sizing (1% cap).',
    justification: 'Filters for high win-probability matches (>65%). Conservative 0.15x Fractional Kelly minimizes volatility and reduces drawdown risk. Note: Position caps limit single-bet loss, but cannot eliminate correlation or systemic model risk across multiple bets.'
  },
  risky: {
    id: 'risky',
    name: 'RISKY (High Yield Longshots)',
    badgeClass: 'badge-risky',
    minProb: 0.35,
    minEV: 15.0,
    kellyMultiplier: 0.50,
    maxStakePercent: 0.03, // 3% max stake
    oddsRange: '2.50+',
    description: 'High-odds mispriced longshots (+15% EV edge) for aggressive capital expansion.',
    justification: 'Filters for major bookmaker pricing blunders on high-odds markets (odds >2.50). Uses 0.50x Kelly for aggressive bankroll surges while accepting higher short-term volatility.'
  },
  value: {
    id: 'value',
    name: 'VALUE (Optimal Growth - Default)',
    badgeClass: 'badge-value',
    minProb: 0.50,
    minEV: 8.0,
    kellyMultiplier: 0.25,
    maxStakePercent: 0.02, // 2% max stake
    oddsRange: '1.75 – 2.45',
    description: 'Optimal balance of price discount (+EV) and win probability for 9-month compounding.',
    justification: 'The mathematical sweet spot. Targets matches where bookmakers have mispriced odds by >8% EV. Uses standard 0.25x Fractional Kelly for maximum compound logarithmic growth.'
  }
};
