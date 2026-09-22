/**
 * Dixon-Coles Poisson Goal Matrix Engine
 * Calculates expected home & away goals, low-score tau corrections,
 * and outputs 1X2, BTTS, and Over/Under 2.5 probabilities.
 */

function poissonProbability(k: number, lambda: number): number {
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
}

/**
 * Tau low-score correction factor (Dixon & Coles 1997)
 * Adjusts probability for 0-0, 1-0, 0-1, and 1-1 scores.
 */
function tauCorrection(x: number, y: number, lambda: number, mu: number, rho: number = -0.13): number {
  if (x === 0 && y === 0) return 1 - (lambda * mu * rho);
  if (x === 0 && y === 1) return 1 + (lambda * rho);
  if (x === 1 && y === 0) return 1 + (mu * rho);
  if (x === 1 && y === 1) return 1 - rho;
  return 1.0;
}

export interface DixonColesResult {
  matrix: number[][]; // 6x6 score probability matrix [homeGoals][awayGoals]
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  bttsYesProb: number;
  over25Prob: number;
  under25Prob: number;
}

export function calculateDixonColes(
  homeAttack: number,
  awayDefense: number,
  awayAttack: number,
  homeDefense: number,
  homeAdvantage: number = 1.22
): DixonColesResult {
  // Expected goals (lambda = home, mu = away)
  const lambda = Math.max(0.2, homeAttack * (1 / awayDefense) * homeAdvantage);
  const mu = Math.max(0.2, awayAttack * (1 / homeDefense));

  const maxGoals = 5;
  const matrix: number[][] = Array(maxGoals + 1).fill(0).map(() => Array(maxGoals + 1).fill(0));

  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  let bttsYesProb = 0;
  let over25Prob = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const pRaw = poissonProbability(h, lambda) * poissonProbability(a, mu);
      const pCorr = pRaw * tauCorrection(h, a, lambda, mu);
      matrix[h][a] = pCorr;

      if (h > a) homeWinProb += pCorr;
      else if (h === a) drawProb += pCorr;
      else awayWinProb += pCorr;

      if (h > 0 && a > 0) bttsYesProb += pCorr;
      if (h + a > 2.5) over25Prob += pCorr;
    }
  }

  // Normalize matrix sum to 1.0
  const totalProb = homeWinProb + drawProb + awayWinProb;
  homeWinProb /= totalProb;
  drawProb /= totalProb;
  awayWinProb /= totalProb;

  return {
    matrix,
    homeWinProb: Math.round(homeWinProb * 1000) / 1000,
    drawProb: Math.round(drawProb * 1000) / 1000,
    awayWinProb: Math.round(awayWinProb * 1000) / 1000,
    bttsYesProb: Math.round(bttsYesProb * 1000) / 1000,
    over25Prob: Math.round(over25Prob * 1000) / 1000,
    under25Prob: Math.round((1 - over25Prob) * 1000) / 1000,
  };
}
