export interface StrategyModeConfig {
  id: 'safe' | 'value' | 'aggressive';
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

export const STRATEGY_MODES: Record<'safe' | 'value' | 'aggressive', StrategyModeConfig> = {
  safe: {
    id: 'safe',
    name: 'SAFE (Bankroll Shield)',
    badgeClass: 'badge-safe',
    minProb: 0.65,
    minEV: 3.0,
    kellyMultiplier: 0.15,
    maxStakePercent: 0.01, // 1% max stake
    oddsRange: '1.30 – 1.70',
    description: 'High-probability match locks with strict 1% stake capping to protect your pool.',
    justification: 'Filters for matches with >65% win probability. Uses conservative 0.15x Fractional Kelly to ensure near-zero drawdown risk while maintaining high hit-rate consistency.'
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
  },
  aggressive: {
    id: 'aggressive',
    name: 'RISKY (High Yield Longshots)',
    badgeClass: 'badge-risky',
    minProb: 0.35,
    minEV: 15.0,
    kellyMultiplier: 0.50,
    maxStakePercent: 0.03, // 3% max stake
    oddsRange: '2.50+',
    description: 'High-odds mispriced longshots (+15% EV edge) for aggressive capital expansion.',
    justification: 'Filters for major bookmaker pricing blunders on high-odds markets (odds >2.50). Uses 0.50x Kelly for aggressive bankroll surges while accepting higher short-term volatility.'
  }
};
