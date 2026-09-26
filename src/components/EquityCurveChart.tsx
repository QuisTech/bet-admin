import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Sparkles, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { BankrollConfig } from '../types';
import { runMonteCarloSimulation } from '../models/monteCarloEngine';

interface EquityCurveChartProps {
  config: BankrollConfig;
}

type StrategyPreset = 'high-winrate' | 'balanced' | 'aggressive';

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ config }) => {
  const [strategyPreset, setStrategyPreset] = useState<StrategyPreset>('high-winrate');
  const [timelineView, setTimelineView] = useState<'months' | 'bets'>('months');

  const sym = config.currency === 'USD' ? '$' : '₦';
  const initialCapital = config.currency === 'USD' ? config.totalBankroll : config.totalBankrollNGN;
  const cushionThreshold = Math.round(initialCapital * 1.20); // +20% profit threshold (₦240,000)

  // Configure parameters based on preset
  const presetParams = useMemo(() => {
    switch (strategyPreset) {
      case 'high-winrate':
        return {
          title: 'High Win-Rate Core (Double Chance 1X & Strikers)',
          winProbability: 0.63,
          averageDecimalOdds: 1.82,
          description: 'High hit rate (~63%). Minimal early drawdowns; reaches the green cushion fastest.',
          badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
        };
      case 'aggressive':
        return {
          title: 'Alpha / Underdogs & Longshots',
          winProbability: 0.35,
          averageDecimalOdds: 3.10,
          description: 'Lower hit rate (~35%), wilder swings. Higher potential upside but spends longer in the red.',
          badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
        };
      case 'balanced':
      default:
        return {
          title: 'Balanced Optimal Consensus (+EV Mixed)',
          winProbability: 0.54,
          averageDecimalOdds: 1.95,
          description: 'Balanced mix of match lines and props. Standard geometric Kelly compounding.',
          badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
        };
    }
  }, [strategyPreset]);

  // Run 10,000-path stochastic simulation for this bankroll & strategy
  const simulation = useMemo(() => {
    return runMonteCarloSimulation({
      initialBankroll: initialCapital,
      numBets: 250,
      winProbability: presetParams.winProbability,
      averageDecimalOdds: presetParams.averageDecimalOdds,
      kellyFraction: config.kellyFraction,
      maxStakePercent: config.maxStakePercent,
      simulations: 10000,
    });
  }, [initialCapital, presetParams, config.kellyFraction, config.maxStakePercent]);

  // Format chart data starting at Point 0 (Starting Bankroll)
  const chartData = useMemo(() => {
    const points = [
      {
        label: timelineView === 'months' ? 'Start' : 'Bet 0',
        p5: initialCapital,
        p50: initialCapital,
        p95: initialCapital,
        bandWidth: 0,
        month: 0,
        betNum: 0,
      },
    ];

    simulation.monthlyTrajectories.forEach((m) => {
      const approxBets = Math.round(m.month * (250 / 9));
      points.push({
        label: timelineView === 'months' ? `Mo ${m.month}` : `Bet ${approxBets}`,
        p5: m.p5,
        p50: m.p50,
        p95: m.p95,
        bandWidth: m.p95 - m.p5,
        month: m.month,
        betNum: approxBets,
      });
    });

    return points;
  }, [simulation, initialCapital, timelineView]);

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Bankroll Compounding Trajectory & Zone Transition
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
              10,000 Paths
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualizes when your bankroll exits the early Danger Zone (Red) and transitions into the permanent Profit Cushion (Green).
          </p>
        </div>

        {/* View & Preset Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeline Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setTimelineView('months')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                timelineView === 'months' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              9-Month View
            </button>
            <button
              onClick={() => setTimelineView('bets')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                timelineView === 'bets' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              250-Bet View
            </button>
          </div>

          {/* Strategy Presets */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStrategyPreset('high-winrate')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                strategyPreset === 'high-winrate'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Focuses on Double Chance 1X & consistent strikers"
            >
              🛡️ High Win-Rate (Fast Green)
            </button>
            <button
              onClick={() => setStrategyPreset('balanced')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                strategyPreset === 'balanced'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Standard balanced mix of +EV plays"
            >
              ⚖️ Balanced (+EV)
            </button>
            <button
              onClick={() => setStrategyPreset('aggressive')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                strategyPreset === 'aggressive'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Underdogs & high odds props"
            >
              🚀 Aggressive
            </button>
          </div>
        </div>
      </div>

      {/* Preset Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs">
        <div>
          <span className="font-bold text-slate-200">{presetParams.title}: </span>
          <span className="text-slate-400">{presetParams.description}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-slate-300">
            Win Rate: <strong className="text-emerald-400">{(presetParams.winProbability * 100).toFixed(0)}%</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-slate-300">
            Avg Odds: <strong className="text-cyan-400">{presetParams.averageDecimalOdds.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      {/* Interactive Recharts Chart Area */}
      <div className="w-full h-80 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
            <defs>
              {/* Bull Case Gradient */}
              <linearGradient id="bullGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              {/* Median Expected Gradient */}
              <linearGradient id="medianGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v) => {
                if (v >= 1000000) return `${sym}${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${sym}${(v / 1000).toFixed(0)}k`;
                return `${sym}${v}`;
              }}
              domain={['auto', 'auto']}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                const isUnderStart = d.p50 < initialCapital;
                const isAboveCushion = d.p50 >= cushionThreshold;

                return (
                  <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-white">{d.label}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAboveCushion
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isUnderStart
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isAboveCushion
                          ? '🟢 Safe Cushion Zone'
                          : isUnderStart
                          ? '🔴 Danger Zone (Below Start)'
                          : '🟡 Lift-off Transition'}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono">
                      <div className="flex justify-between text-emerald-400">
                        <span>95th %ile (Bull):</span>
                        <span className="font-bold">{sym}{d.p95.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-cyan-300">
                        <span>50th %ile (Expected):</span>
                        <span className="font-bold">{sym}{d.p50.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>5th %ile (Worst Case):</span>
                        <span className="font-bold">{sym}{d.p5.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800/80">
                      Net Gain (Median):{' '}
                      <span className={d.p50 >= initialCapital ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {d.p50 >= initialCapital ? '+' : ''}
                        {sym}{(d.p50 - initialCapital).toLocaleString()} (
                        {(((d.p50 - initialCapital) / initialCapital) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Baseline Starting Capital Reference Line (Red Zone below) */}
            <ReferenceLine
              y={initialCapital}
              stroke="#f43f5e"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Starting Baseline (${sym}${(initialCapital / 1000).toFixed(0)}k)`,
                fill: '#fb7185',
                position: 'insideBottomLeft',
                fontSize: 10,
              }}
            />

            {/* Permanent Green Cushion Reference Line */}
            <ReferenceLine
              y={cushionThreshold}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Green Cushion (+20% Profit / ${sym}${(cushionThreshold / 1000).toFixed(0)}k)`,
                fill: '#34d399',
                position: 'insideTopLeft',
                fontSize: 10,
              }}
            />

            {/* Bull Band (95th %ile) */}
            <Area
              type="monotone"
              dataKey="p95"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#bullGradient)"
              name="Bull Case (95th %ile)"
            />

            {/* Median Expected Line (50th %ile) */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#06b6d4"
              strokeWidth={3}
              dot={{ r: 3, fill: '#06b6d4', stroke: '#083344', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#22d3ee', stroke: '#fff', strokeWidth: 2 }}
              name="Expected (50th %ile)"
            />

            {/* Bear Line (5th %ile) */}
            <Line
              type="monotone"
              dataKey="p5"
              stroke="#f43f5e"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Bear Floor (5th %ile)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* The 3 Educational Explanatory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        {/* Phase 1: Danger Zone */}
        <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Phase 1: The Danger Zone</span>
          </div>
          <div className="text-[11px] font-mono text-rose-300">
            Bets 1 to 30 • &lt; {sym}{initialCapital.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Zero profit cushion. Early bad luck can push the chart into the red. You must strictly obey fractional Kelly and never chase losses here.
          </p>
        </div>

        {/* Phase 2: The Lift-Off */}
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Phase 2: The Lift-Off</span>
          </div>
          <div className="text-[11px] font-mono text-amber-300">
            Bets 30 to 80 • {sym}{initialCapital.toLocaleString()} to {sym}{cushionThreshold.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            The +EV edge starts overpowering random noise. The chart oscillates upward, breaking away from the red starting baseline.
          </p>
        </div>

        {/* Phase 3: The Permanent Cushion */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Phase 3: The Profit Cushion</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-300">
            Bets 80+ • &gt; {sym}{cushionThreshold.toLocaleString()} (+20%+)
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            You hold an earned profit buffer. Even when normal 4-game losing streaks hit, the drawdown happens inside profit—you stay green!
          </p>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Expected 9-Month Compounding:{' '}
            <strong className="text-white font-mono">
              {sym}{simulation.medianEndingBankroll.toLocaleString()}
            </strong>{' '}
            (
            <span className="text-emerald-400 font-bold">
              +{(((simulation.medianEndingBankroll - initialCapital) / initialCapital) * 100).toFixed(0)}%
            </span>
            )
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>
            95% VaR Floor: <strong className="text-rose-400">-{simulation.var95Percent}%</strong>
          </span>
          <span>•</span>
          <span>
            Median Max Drawdown: <strong className="text-amber-400">{simulation.maxExpectedDrawdown}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
