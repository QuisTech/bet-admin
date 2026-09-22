/**
 * Expected Value (+EV) Engine & Fractional Kelly Staking
 */

import type { BankrollConfig } from '../types';

/**
 * Strips bookmaker margin (vig) using proportional normalization
 */
export function removeVigProportional(oddsList: number[]): number[] {
  const impliedProbs = oddsList.map(o => 1 / o);
  const overround = impliedProbs.reduce((sum, p) => sum + p, 0);
  return impliedProbs.map(p => p / overround);
}

/**
 * Calculates Expected Value percentage (+EV %)
 * Formula: EV % = (Model Probability * Decimal Odds) - 1
 */
export function calculateEV(modelProb: number, odds: number): number {
  const ev = (modelProb * odds) - 1.0;
  return Math.round(ev * 1000) / 10; // Convert to percentage e.g. +12.5%
}

/**
 * Fractional Kelly Criterion Staking Algorithm
 * Formula: f* = (p * b - q) / b
 * Stake NGN = Total Bankroll * Math.min(MaxStakePercent, f* * KellyFraction)
 */
export function calculateKellyStake(
  modelProb: number,
  odds: number,
  config: BankrollConfig
): { stakeNGN: number; stakePercent: number } {
  const b = odds - 1.0;
  const q = 1.0 - modelProb;
  const kellyFull = (modelProb * b - q) / b;

  if (kellyFull <= 0) {
    return { stakeNGN: 0, stakePercent: 0 };
  }

  // Apply Fractional Kelly multiplier (e.g. 0.25x Kelly)
  const fractionalKelly = kellyFull * config.kellyFraction;

  // Cap at maximum safe per-bet percentage (e.g. 2% max per bet)
  const finalStakePercent = Math.min(fractionalKelly, config.maxStakePercent);
  const stakeNGN = Math.round(config.totalBankrollNGN * finalStakePercent);

  return {
    stakeNGN,
    stakePercent: Math.round(finalStakePercent * 1000) / 10,
  };
}
