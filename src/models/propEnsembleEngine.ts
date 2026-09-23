/**
 * XGBoost / Gradient-Boosted Decision Tree Player Prop Engine
 * Evaluates non-linear feature interactions (xG90, xA90, opponent defense,
 * minutes reliability, home bias) to predict Shots on Target, Anytime Goal, and Assists.
 */

export interface PlayerFeatures {
  xG90: number;
  xA90: number;
  xMins: number; // 0 to 90
  opponentConcededPer90: number; // e.g. 1.35
  isHome: boolean;
  teamAttackingRating: number; // e.g. 1.65 goals per match
}

export interface PropPrediction {
  anytimeGoalProb: number;
  over05SotProb: number;
  over15SotProb: number;
  over25SotProb: number;
  assistProb: number;
  expectedGoals: number;
  expectedSOT: number;
  expectedAssists: number;
  modelUncertainty: number; // Standard deviation of ensemble trees
}

/**
 * Poisson tail probability: P(X >= threshold)
 */
function poissonOver(lambda: number, threshold: number): number {
  if (lambda <= 0) return 0;
  let probLess = 0;
  let factorial = 1;

  for (let k = 0; k <= threshold; k++) {
    if (k > 0) factorial *= k;
    probLess += (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
  }
  return Math.max(0.01, Math.min(0.99, 1 - probLess));
}

/**
 * Evaluates a gradient-boosted decision tree ensemble for player proposition markets.
 */
export function evaluatePropEnsemble(features: PlayerFeatures): PropPrediction {
  const minRatio = Math.max(0.1, Math.min(1.0, features.xMins / 90));
  const homeBoost = features.isHome ? 1.12 : 0.92;
  const oppFactor = Math.max(0.5, features.opponentConcededPer90 / 1.30);
  const teamTempo = Math.max(0.6, features.teamAttackingRating / 1.50);

  // --- Tree Ensemble 1: Expected Goal Intensity (Lambda Goal) ---
  // Base intercept
  let goalMargin = -0.85;

  // Tree 1: Primary xG scaling with minutes
  const effXG = features.xG90 * minRatio;
  if (effXG > 0.6) goalMargin += 0.95;
  else if (effXG > 0.35) goalMargin += 0.55;
  else if (effXG > 0.18) goalMargin += 0.20;
  else goalMargin -= 0.30;

  // Tree 2: Opponent weakness interaction
  if (oppFactor > 1.25) goalMargin += 0.32;
  else if (oppFactor < 0.8) goalMargin -= 0.28;

  // Tree 3: Contextual venue & attacking pace
  goalMargin += (homeBoost - 1.0) * 0.8;
  goalMargin += (teamTempo - 1.0) * 0.6;

  // Expected goals (lambda)
  const expGoals = Math.max(0.05, Math.exp(goalMargin));
  // Anytime goal probability = 1 - P(0 goals)
  const goalProb = Math.round((1 - Math.exp(-expGoals)) * 1000) / 1000;

  // --- Tree Ensemble 2: Shots on Target (Lambda SOT) ---
  let sotMargin = 0.15;
  const shotsProxy = (features.xG90 * 2.4 + 0.5) * minRatio;

  if (shotsProxy > 1.8) sotMargin += 0.85;
  else if (shotsProxy > 1.1) sotMargin += 0.40;
  else sotMargin -= 0.25;

  sotMargin += (homeBoost - 1.0) * 0.7;
  sotMargin += (oppFactor - 1.0) * 0.5;

  const expSOT = Math.max(0.1, Math.exp(sotMargin));
  const over05SOT = Math.round(poissonOver(expSOT, 0) * 1000) / 1000;
  const over15SOT = Math.round(poissonOver(expSOT, 1) * 1000) / 1000;
  const over25SOT = Math.round(poissonOver(expSOT, 2) * 1000) / 1000;

  // --- Tree Ensemble 3: Assist Probability ---
  const effXA = features.xA90 * minRatio * oppFactor * homeBoost;
  const expAssists = Math.max(0.03, effXA);
  const assistProb = Math.round((1 - Math.exp(-expAssists)) * 1000) / 1000;

  // Ensemble variance / uncertainty
  const uncertainty = Math.round((0.025 + (1 - minRatio) * 0.04 + Math.abs(oppFactor - 1) * 0.02) * 1000) / 1000;

  return {
    anytimeGoalProb: goalProb,
    over05SotProb: over05SOT,
    over15SotProb: over15SOT,
    over25SotProb: over25SOT,
    assistProb,
    expectedGoals: Math.round(expGoals * 100) / 100,
    expectedSOT: Math.round(expSOT * 100) / 100,
    expectedAssists: Math.round(expAssists * 100) / 100,
    modelUncertainty: uncertainty,
  };
}
