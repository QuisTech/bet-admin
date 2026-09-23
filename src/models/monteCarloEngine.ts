/**
 * Monte Carlo 10,000-Path Bankroll & Drawdown Risk Engine
 * Computes stochastic path simulations to derive Value at Risk (VaR 95%),
 * maximum expected drawdown distributions, and compounding confidence intervals.
 */

export interface MonteCarloConfig {
  initialBankroll: number;
  numBets: number;          // e.g. 250 bets over 9 months
  winProbability: number;   // e.g. 0.54 (54% win rate)
  averageDecimalOdds: number; // e.g. 1.98
  kellyFraction: number;    // e.g. 0.25 (Quarter Kelly)
  maxStakePercent: number;  // e.g. 0.02 (2% max cap)
  simulations?: number;     // e.g. 10000 iterations
}

export interface MonthlyTrajectory {
  month: number;
  p5: number;   // 5th percentile (Bear case)
  p50: number;  // 50th percentile (Median case)
  p95: number;  // 95th percentile (Bull case)
}

export interface MonteCarloResult {
  medianEndingBankroll: number;
  p5EndingBankroll: number;
  p95EndingBankroll: number;
  var95Percent: number;          // 95% Value at Risk (e.g. -7.4%)
  var99Percent: number;          // 99% Tail Risk (e.g. -12.1%)
  maxExpectedDrawdown: number;   // Median maximum drawdown % (e.g. 9.8%)
  worstCaseDrawdown: number;     // 99th percentile drawdown % (e.g. 18.2%)
  probDrawdownOver20Pct: number; // Probability of experiencing a 20%+ drawdown
  probDrawdownOver50Pct: number; // Probability of ruin / halving
  monthlyTrajectories: MonthlyTrajectory[];
  executionTimeMs: number;
}

/**
 * Runs 10,000 Monte Carlo paths of geometric bankroll compounding.
 */
export function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResult {
  const startTime = performance.now();
  const numSims = config.simulations || 10000;
  const numBets = config.numBets || 250;
  const pWin = config.winProbability;
  const odds = config.averageDecimalOdds;
  const b = odds - 1.0;

  // Analytical fractional Kelly stake %
  const fullKelly = (pWin * b - (1 - pWin)) / b;
  const targetStakePct = Math.max(
    0.005,
    Math.min(config.maxStakePercent, fullKelly * config.kellyFraction)
  );

  const endingBankrolls = new Float64Array(numSims);
  const maxDrawdowns = new Float64Array(numSims);

  // Track monthly snapshot points (assume ~28 bets per month over 9 months)
  const betsPerMonth = Math.max(1, Math.floor(numBets / 9));
  const monthlySamples: number[][] = Array(9).fill(0).map(() => []);

  for (let s = 0; s < numSims; s++) {
    let bankroll = config.initialBankroll;
    let peak = bankroll;
    let maxDD = 0;

    for (let step = 1; step <= numBets; step++) {
      const stake = bankroll * targetStakePct;
      const isWin = Math.random() < pWin;

      if (isWin) {
        bankroll += stake * b;
      } else {
        bankroll -= stake;
      }

      if (bankroll > peak) {
        peak = bankroll;
      } else {
        const dd = ((peak - bankroll) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      }

      // Record monthly checkpoints
      if (step % betsPerMonth === 0) {
        const monthIdx = Math.min(8, Math.floor(step / betsPerMonth) - 1);
        monthlySamples[monthIdx].push(bankroll);
      }
    }

    endingBankrolls[s] = bankroll;
    maxDrawdowns[s] = maxDD;
  }

  // Sort ending bankrolls to extract percentiles
  endingBankrolls.sort();
  maxDrawdowns.sort();

  const p5Idx = Math.floor(numSims * 0.05);
  const p50Idx = Math.floor(numSims * 0.50);
  const p95Idx = Math.floor(numSims * 0.95);
  const p99Idx = Math.floor(numSims * 0.99);

  const p5Ending = endingBankrolls[p5Idx];
  const p50Ending = endingBankrolls[p50Idx];
  const p95Ending = endingBankrolls[p95Idx];

  // Value at Risk (VaR): loss relative to initial capital
  const var95 = Math.max(0, ((config.initialBankroll - p5Ending) / config.initialBankroll) * 100);
  const p1Ending = endingBankrolls[Math.floor(numSims * 0.01)];
  const var99 = Math.max(0, ((config.initialBankroll - p1Ending) / config.initialBankroll) * 100);

  // Drawdown distribution
  const medianDD = maxDrawdowns[p50Idx];
  const worstDD = maxDrawdowns[p99Idx];

  // Count probability thresholds
  let countDD20 = 0;
  let countDD50 = 0;
  for (let i = 0; i < numSims; i++) {
    if (maxDrawdowns[i] >= 20) countDD20++;
    if (maxDrawdowns[i] >= 50) countDD50++;
  }

  // Monthly Trajectories
  const monthlyTrajectories: MonthlyTrajectory[] = monthlySamples.map((samples, idx) => {
    samples.sort((a, b) => a - b);
    const mP5 = samples[Math.floor(samples.length * 0.05)] || config.initialBankroll;
    const mP50 = samples[Math.floor(samples.length * 0.50)] || config.initialBankroll;
    const mP95 = samples[Math.floor(samples.length * 0.95)] || config.initialBankroll;
    return {
      month: idx + 1,
      p5: Math.round(mP5),
      p50: Math.round(mP50),
      p95: Math.round(mP95),
    };
  });

  const execTime = performance.now() - startTime;

  return {
    medianEndingBankroll: Math.round(p50Ending),
    p5EndingBankroll: Math.round(p5Ending),
    p95EndingBankroll: Math.round(p95Ending),
    var95Percent: Math.round(var95 * 10) / 10,
    var99Percent: Math.round(var99 * 10) / 10,
    maxExpectedDrawdown: Math.round(medianDD * 10) / 10,
    worstCaseDrawdown: Math.round(worstDD * 10) / 10,
    probDrawdownOver20Pct: Math.round((countDD20 / numSims) * 1000) / 10,
    probDrawdownOver50Pct: Math.round((countDD50 / numSims) * 1000) / 10,
    monthlyTrajectories,
    executionTimeMs: Math.round(execTime * 10) / 10,
  };
}
