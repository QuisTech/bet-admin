import React, { useState, useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { BankrollConfig } from '../types';
import { runMonteCarloSimulation } from '../models/monteCarloEngine';
import { getStandardHistoricalBacktest } from '../models/backtestEngine';

interface BankrollManagerProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
}

export const BankrollManager: React.FC<BankrollManagerProps> = ({ config, onConfigChange }) => {
  const [activeSubTab, setActiveSubTab] = useState<'monte-carlo' | 'backtest'>('monte-carlo');

  const sym = config.currency === 'USD' ? '$' : '₦';
  const presetPools = [200000, 1000000, 10000000];

  // 1. Run 10,000-path Monte Carlo Stochastic Simulation
  const mcResult = useMemo(() => {
    return runMonteCarloSimulation({
      initialBankroll: config.totalBankrollNGN,
      numBets: 250,
      winProbability: 0.54,
      averageDecimalOdds: 1.95,
      kellyFraction: config.kellyFraction,
      maxStakePercent: config.maxStakePercent,
      simulations: 10000,
    });
  }, [config.totalBankrollNGN, config.kellyFraction, config.maxStakePercent]);

  // 2. Run Historical Walk-Forward Temporal Backtest
  const backtestResult = useMemo(() => {
    return getStandardHistoricalBacktest(config);
  }, [config]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Monte Carlo Risk Engine & Walk-Forward Backtester
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Simulates 10,000 stochastic portfolio paths, calculates 95% Value-at-Risk (VaR), and verifies out-of-sample historical execution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 px-2">Presets:</span>
            {presetPools.map((pool) => (
              <button
                key={pool}
                onClick={() => {
                  onConfigChange({ ...config, totalBankrollNGN: pool, totalBankroll: pool });
                  try { localStorage.setItem('bet_admin_bankroll', pool.toString()); } catch {}
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  config.totalBankrollNGN === pool
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {config.currency === 'USD' ? `$${pool >= 1000 ? `${pool / 1000}k` : pool}` : `₦${(pool / 1000).toFixed(0)}k`}
              </button>
            ))}
          </div>

          {/* Interactive Custom Capital Input */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-xl border border-emerald-500/40 focus-within:border-emerald-400 transition-all">
            <span className="text-xs font-mono font-bold text-emerald-400">{sym}</span>
            <input
              type="number"
              min="100"
              step="1000"
              value={config.totalBankrollNGN}
              onChange={(e) => {
                const val = Math.max(100, Math.round(parseFloat(e.target.value) || 0));
                onConfigChange({ ...config, totalBankrollNGN: val, totalBankroll: val });
                try { localStorage.setItem('bet_admin_bankroll', val.toString()); } catch {}
              }}
              className="w-28 bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
              placeholder="Custom pool..."
            />
          </div>
        </div>
      </div>

      {/* Sub-tab Switcher: Monte Carlo vs Walk-Forward Backtest */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('monte-carlo')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'monte-carlo'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          10,000-Path Monte Carlo Simulation
        </button>
        <button
          onClick={() => setActiveSubTab('backtest')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'backtest'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Walk-Forward Historical Backtest (GW 1-6)
        </button>
      </div>

      {activeSubTab === 'monte-carlo' && (
        <div className="space-y-4">
          {/* 4 Risk Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">95% Value at Risk (VaR)</div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                {mcResult.var95Percent > 0 ? `-${mcResult.var95Percent}%` : '0.0% (Protected)'}
              </div>
              <div className="text-[9px] text-slate-500">Max loss at 95% confidence</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Max Expected Drawdown</div>
              <div className="text-lg font-mono font-bold text-amber-400 mt-1">
                {mcResult.maxExpectedDrawdown}%
              </div>
              <div className="text-[9px] text-slate-500">Median peak-to-trough decline</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Ruin Risk (&gt;50% DD)</div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                {mcResult.probDrawdownOver50Pct}%
              </div>
              <div className="text-[9px] text-slate-500">Fractional Kelly capital safety</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Median Ending Bankroll</div>
              <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                {sym}{mcResult.medianEndingBankroll.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500">250-bet compounding (9 mos)</div>
            </div>
          </div>

          {/* 9-Month Trajectory Fan Table */}
          <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  9-Month Compounding Trajectory (Percentile Fan Bands)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Computed from 10,000 independent stochastic paths in {mcResult.executionTimeMs}ms.
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">10,000 RUNS</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-mono">
                    <th className="p-2">Month</th>
                    <th className="p-2 text-rose-400">5th %ile (Bear)</th>
                    <th className="p-2 text-cyan-400">50th %ile (Median Expected)</th>
                    <th className="p-2 text-emerald-400">95th %ile (Bull Growth)</th>
                    <th className="p-2">Kelly Stake Cap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 font-mono text-xs">
                  {mcResult.monthlyTrajectories.map((m) => {
                    const stake = Math.round(m.p50 * config.maxStakePercent);
                    return (
                      <tr key={m.month} className="hover:bg-slate-900/40 transition">
                        <td className="p-2 font-bold text-slate-300">Month {m.month}</td>
                        <td className="p-2 text-rose-300">{sym}{m.p5.toLocaleString()}</td>
                        <td className="p-2 text-cyan-300 font-bold">{sym}{m.p50.toLocaleString()}</td>
                        <td className="p-2 text-emerald-300 font-bold">{sym}{m.p95.toLocaleString()}</td>
                        <td className="p-2 text-slate-400">{sym}{stake.toLocaleString()} ({(config.maxStakePercent * 100).toFixed(0)}%)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'backtest' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Overall Realized ROI</div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                +{backtestResult.roiPercent}%
              </div>
              <div className="text-[9px] text-slate-500">Out-of-sample yield</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Win Rate</div>
              <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                {backtestResult.winRate}%
              </div>
              <div className="text-[9px] text-slate-500">{backtestResult.winCount} of {backtestResult.totalBets} bets</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Sharpe Ratio</div>
              <div className="text-lg font-mono font-bold text-purple-400 mt-1">
                {backtestResult.sharpeRatio}
              </div>
              <div className="text-[9px] text-slate-500">Risk-adjusted return</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Net Realized Profit</div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                +{sym}{backtestResult.netProfit.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500">From {sym}{backtestResult.startingBankroll.toLocaleString()} pool</div>
            </div>
          </div>

          {/* Gameweek by Gameweek Walk-Forward Ledger */}
          <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
              Gameweek-by-Gameweek Walk-Forward Validation Table
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-mono">
                    <th className="p-2">Gameweek</th>
                    <th className="p-2">Bets</th>
                    <th className="p-2">Win Rate</th>
                    <th className="p-2">GW ROI</th>
                    <th className="p-2">Avg CLV</th>
                    <th className="p-2">Brier</th>
                    <th className="p-2">End Bankroll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 font-mono text-xs">
                  {backtestResult.gameweekMetrics.map((gw) => (
                    <tr key={gw.gameweek} className="hover:bg-slate-900/40 transition">
                      <td className="p-2 font-bold text-slate-300">GW {gw.gameweek}</td>
                      <td className="p-2 text-slate-400">{gw.totalBets} bets</td>
                      <td className="p-2 text-cyan-300 font-bold">{gw.winRate}%</td>
                      <td className="p-2 text-emerald-400 font-bold">+{gw.roiPercent}%</td>
                      <td className="p-2 text-amber-300 font-bold">+{gw.clvPercent}%</td>
                      <td className="p-2 text-slate-400">{gw.brierScore}</td>
                      <td className="p-2 text-white font-bold">{sym}{gw.bankrollNGN.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
