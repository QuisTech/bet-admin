/**
 * Shin's Market De-Vigging Engine (Shin 1993)
 * Solves for the proportion of insider/informed money (z) and recovers
 * true fair probabilities by stripping bookmaker favorite-longshot bias.
 */

export interface ShinResult {
  fairProbabilities: number[];
  fairOdds: number[];
  z: number; // Estimated proportion of informed trading
  margin: number; // Overround margin (e.g. 0.052 = 5.2%)
  converged: boolean;
  iterations: number;
}

/**
 * Strips bookmaker margin using Shin's algorithm via Newton-Raphson root finding.
 * @param decimalOdds Array of decimal odds [home, draw, away] or [under, over]
 * @param maxIter Maximum Newton-Raphson iterations (default: 50)
 * @param tol Convergence tolerance (default: 1e-8)
 */
export function calculateShinDevig(
  decimalOdds: number[],
  maxIter: number = 50,
  tol: number = 1e-8
): ShinResult {
  const n = decimalOdds.length;
  if (n < 2) {
    throw new Error('Shin de-vigging requires at least 2 outcomes.');
  }

  // Raw implied probabilities
  const rawImplied = decimalOdds.map((o) => (o > 1.0 ? 1 / o : 1.0));
  const overround = rawImplied.reduce((sum, p) => sum + p, 0);
  const margin = Math.max(0, overround - 1.0);

  // If odds have negligible overround, return normalized probabilities
  if (overround <= 1.0001) {
    const fairProbs = rawImplied.map((p) => p / overround);
    return {
      fairProbabilities: fairProbs,
      fairOdds: fairProbs.map((p) => (p > 0 ? Math.round((1 / p) * 1000) / 1000 : 999)),
      z: 0,
      margin: 0,
      converged: true,
      iterations: 0,
    };
  }

  // Beta normalized proportions
  const beta = rawImplied.map((p) => p / overround);

  // Initial guess for z (proportional to margin)
  let z = Math.min(0.25, Math.max(0.001, margin / 2));
  let converged = false;
  let iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    const oneMinusZ = 1 - z;
    const twoOneMinusZ = 2 * oneMinusZ;

    // Evaluate sum(p_i(z)) and sum(p'_i(z))
    let sumP = 0;
    let sumDeriv = 0;

    for (let i = 0; i < n; i++) {
      const term = z * z + 4 * oneMinusZ * beta[i];
      const sqrtTerm = Math.sqrt(Math.max(1e-12, term));
      const p_i = (sqrtTerm - z) / twoOneMinusZ;
      sumP += p_i;

      // Derivative with respect to z
      const dSqrt_dz = (2 * z - 4 * beta[i]) / (2 * sqrtTerm);
      const numerator = dSqrt_dz - 1;
      const dP_dz = (numerator * twoOneMinusZ - (sqrtTerm - z) * -2) / (twoOneMinusZ * twoOneMinusZ);
      sumDeriv += dP_dz;
    }

    const error = sumP - 1.0;
    if (Math.abs(error) < tol) {
      converged = true;
      break;
    }

    if (Math.abs(sumDeriv) < 1e-12) {
      break; // Avoid division by zero
    }

    // Newton step with damping to keep z in [0, 0.45]
    let nextZ = z - error / sumDeriv;
    if (nextZ < 0) nextZ = z / 2;
    if (nextZ >= 0.5) nextZ = (z + 0.5) / 2;

    if (Math.abs(nextZ - z) < tol) {
      z = nextZ;
      converged = true;
      break;
    }

    z = nextZ;
  }

  // Calculate final true probabilities with solved z
  const oneMinusZ = 1 - z;
  const twoOneMinusZ = 2 * oneMinusZ;
  let fairProbabilities = beta.map((b_i) => {
    const sqrtTerm = Math.sqrt(Math.max(1e-12, z * z + 4 * oneMinusZ * b_i));
    return Math.max(0.001, (sqrtTerm - z) / twoOneMinusZ);
  });

  // Final normalization to ensure exact sum to 1.0
  const finalSum = fairProbabilities.reduce((sum, p) => sum + p, 0);
  fairProbabilities = fairProbabilities.map((p) => Math.round((p / finalSum) * 10000) / 10000);

  const fairOdds = fairProbabilities.map((p) => (p > 0 ? Math.round((1 / p) * 100) / 100 : 999));

  return {
    fairProbabilities,
    fairOdds,
    z: Math.round(z * 10000) / 10000,
    margin: Math.round(margin * 10000) / 100,
    converged,
    iterations: iter + 1,
  };
}
