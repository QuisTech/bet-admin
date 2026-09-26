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
import { TrendingUp, Sparkles, AlertTriangle, CheckCircle2, Info, BookOpen, Layers } from 'lucide-react';
import type { BankrollConfig, LoggedBet, BetOutcome } from '../types';
import { runMonteCarloSimulation } from '../models/monteCarloEngine';
import { getActualBankrollTrajectory, getLoggedBets } from '../services/ledgerService';

interface ChartPoint {
  label: string;
  actual?: number;
  p5?: number;
  p50?: number;
  p95?: number;
  pnl?: number;
  match?: string;
  selection?: string;
  outcome?: BetOutcome;
  dateDisplay?: string;
  stake?: number;
  payout?: number;
  month?: number;
  betNum?: number;
}

interface EquityCurveChartProps {
  config: BankrollConfig;
  loggedBets?: LoggedBet[];
  title?: string;
  defaultMode?: 'actual' | 'overlay' | 'forecast';
}

type StrategyPreset = 'high-winrate' | 'balanced' | 'aggressive';
type ChartMode = 'actual' | 'overlay' | 'forecast';

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  config,
  loggedBets,
  title,
  defaultMode = 'actual',
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>(defaultMode);
  const [strategyPreset, setStrategyPreset] = useState<StrategyPreset>('high-winrate');
  const [timelineView, setTimelineView] = useState<'months' | 'bets'>('bets');

  const sym = config.currency === 'USD' ? '$' : '₦';
  const initialCapital = config.currency === 'USD' ? config.totalBankroll : config.totalBankrollNGN;
  const cushionThreshold = Math.round(initialCapital * 1.20); // +20% profit threshold

  // Get actual realized trajectory from ledger
  const actualPoints = useMemo(() => {
    return getActualBankrollTrajectory(initialCapital, loggedBets || getLoggedBets());
  }, [initialCapital, loggedBets]);

  const currentActualBankroll = actualPoints[actualPoints.length - 1]?.runningBankroll || initialCapital;
  const totalSettledBets = Math.max(0, actualPoints.length - 1);
  const netActualProfit = currentActualBankroll - initialCapital;
  const actualROI = initialCapital > 0 ? (netActualProfit / initialCapital) * 100 : 0;

  // Preset parameters for theoretical simulation
  const presetParams = useMemo(() => {
    switch (strategyPreset) {
      case 'high-winrate':
        return {
          title: 'High Win-Rate Core (Double Chance 1X & Strikers)',
          winProbability: 0.63,
          averageDecimalOdds: 1.82,
          description: 'High hit rate (~63%). Minimal early drawdowns; reaches the green cushion fastest.',
        };
      case 'aggressive':
        return {
          title: 'Alpha / Underdogs & Longshots',
          winProbability: 0.35,
          averageDecimalOdds: 3.10,
          description: 'Lower hit rate (~35%), wilder swings. Higher upside but spends longer in the red.',
        };
      case 'balanced':
      default:
        return {
          title: 'Balanced Optimal Consensus (+EV Mixed)',
          winProbability: 0.54,
          averageDecimalOdds: 1.95,
          description: 'Standard geometric Kelly compounding across all +EV opportunities.',
        };
    }
  }, [strategyPreset]);

  // Run 10,000-path stochastic simulation
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

  // Build chart dataset depending on active mode
  const chartData: ChartPoint[] = useMemo(() => {
    if (chartMode === 'actual') {
      // 1. Pure Actual Realized Ledger Data
      return actualPoints.map((pt) => ({
        label: pt.index === 0 ? 'Start' : `Bet #${pt.index}`,
        actual: pt.runningBankroll,
        pnl: pt.pnl,
        match: pt.match,
        selection: pt.selection,
        outcome: pt.outcome,
        dateDisplay: pt.dateDisplay,
        stake: pt.stake,
        payout: pt.payout,
      }));
    }

    if (chartMode === 'forecast') {
      // 2. Pure Monte Carlo Simulation
      const points: ChartPoint[] = [
        {
          label: timelineView === 'months' ? 'Start' : 'Bet 0',
          p5: initialCapital,
          p50: initialCapital,
          p95: initialCapital,
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
          month: m.month,
          betNum: approxBets,
        });
      });

      return points;
    }

    // 3. 'overlay' Mode: Combine Actual Realized Points with Simulated Envelope
    // Maps actual bets into the timeline, with projected cone extending forward
    const basePoints: ChartPoint[] = [
      {
        label: 'Start',
        actual: initialCapital,
        p5: initialCapital,
        p50: initialCapital,
        p95: initialCapital,
        betNum: 0,
      },
    ];

    actualPoints.slice(1).forEach((pt) => {
      // Approximate theoretical expectation at this bet step
      const stepRatio = Math.min(1, pt.index / 250);
      const estP50 = initialCapital + (simulation.medianEndingBankroll - initialCapital) * stepRatio;
      const estP95 = initialCapital + (simulation.p95EndingBankroll - initialCapital) * stepRatio;
      const estP5 = initialCapital + (simulation.p5EndingBankroll - initialCapital) * stepRatio;

      basePoints.push({
        label: `Bet ${pt.index}`,
        actual: pt.runningBankroll,
        pnl: pt.pnl,
        match: pt.match,
        selection: pt.selection,
        outcome: pt.outcome,
        p5: Math.round(estP5),
        p50: Math.round(estP50),
        p95: Math.round(estP95),
        betNum: pt.index,
      });
    });

    // Continue the projected fan if actual bets < 250
    simulation.monthlyTrajectories.forEach((m) => {
      const approxBets = Math.round(m.month * (250 / 9));
      if (approxBets > totalSettledBets) {
        basePoints.push({
          label: `Bet ${approxBets}`,
          p5: m.p5,
          p50: m.p50,
          p95: m.p95,
          betNum: approxBets,
        });
      }
    });

    return basePoints;
  }, [chartMode, actualPoints, simulation, initialCapital, timelineView, totalSettledBets]);

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              {title || 'Equity Curve & Realized Bankroll Tracking'}
            </h3>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                netActualProfit >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {totalSettledBets} Logged Bets • {netActualProfit >= 0 ? '+' : ''}{sym}
              {netActualProfit.toLocaleString()} ({actualROI >= 0 ? '+' : ''}{actualROI.toFixed(1)}%)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {chartMode === 'actual'
              ? 'Real-time equity curve computed directly from your Position Ledger bets.'
              : chartMode === 'overlay'
              ? 'Walk-forward execution: Overlays your real logged positions against the 10,000-path Monte Carlo corridor.'
              : 'Theoretical stochastic compounding forecast over 250 bets.'}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Chart Mode Tabs */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setChartMode('actual')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                chartMode === 'actual'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Actual Ledger ({totalSettledBets})</span>
            </button>
            <button
              onClick={() => setChartMode('overlay')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                chartMode === 'overlay'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Actual vs Model</span>
            </button>
            <button
              onClick={() => setChartMode('forecast')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                chartMode === 'forecast'
                  ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>10k-Path Forecast</span>
            </button>
          </div>

          {/* Sub-controls when in Forecast / Overlay Mode */}
          {chartMode !== 'actual' && (
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStrategyPreset('high-winrate')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  strategyPreset === 'high-winrate'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Double Chance 1X & Strikers (~63% Win Rate)"
              >
                🛡️ High Win-Rate
              </button>
              <button
                onClick={() => setStrategyPreset('balanced')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  strategyPreset === 'balanced'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Balanced Consensus"
              >
                ⚖️ Balanced
              </button>
              <button
                onClick={() => setStrategyPreset('aggressive')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  strategyPreset === 'aggressive'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Underdogs / Longshots"
              >
                🚀 Aggressive
              </button>
            </div>
          )}

          {/* Timeline switcher for Forecast mode */}
          {chartMode === 'forecast' && (
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono font-bold">
              <button
                onClick={() => setTimelineView('months')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  timelineView === 'months'
                    ? 'bg-purple-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                9 Mos
              </button>
              <button
                onClick={() => setTimelineView('bets')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  timelineView === 'bets'
                    ? 'bg-purple-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                250 Bets
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Realized Ledger Snapshot Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Bankroll</span>
          <span className="text-base font-mono font-black text-white">
            {sym}{currentActualBankroll.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Realized Net P&L</span>
          <span
            className={`text-base font-mono font-black ${
              netActualProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netActualProfit >= 0 ? '+' : ''}{sym}{netActualProfit.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Zone</span>
          <span
            className={`text-xs font-bold inline-flex items-center gap-1 mt-1 ${
              currentActualBankroll >= cushionThreshold
                ? 'text-emerald-400'
                : currentActualBankroll >= initialCapital
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {currentActualBankroll >= cushionThreshold
              ? '🟢 Profit Cushion Zone'
              : currentActualBankroll >= initialCapital
              ? '🟡 Lift-off Transition'
              : '🔴 Early Danger Zone'}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Green Buffer Remaining</span>
          <span className="text-base font-mono font-bold text-slate-300">
            {currentActualBankroll >= cushionThreshold
              ? `+${sym}${(currentActualBankroll - cushionThreshold).toLocaleString()} (Safe)`
              : `-${sym}${(cushionThreshold - currentActualBankroll).toLocaleString()} to Cushion`}
          </span>
        </div>
      </div>

      {/* Interactive Recharts Canvas */}
      <div className="w-full h-84 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="bullGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
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
                const bankrollVal = d.actual !== undefined ? d.actual : d.p50;
                const isUnderStart = bankrollVal < initialCapital;
                const isAboveCushion = bankrollVal >= cushionThreshold;

                return (
                  <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 max-w-xs">
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
                          ? '🔴 Danger Zone (< Start)'
                          : '🟡 Lift-off Zone'}
                      </span>
                    </div>

                    {/* Match & Bet Details if available */}
                    {d.match && (
                      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-0.5">
                        <div className="font-bold text-slate-200 truncate">{d.match}</div>
                        {d.selection && <div className="text-[11px] text-slate-400 truncate">{d.selection}</div>}
                        {d.outcome && (
                          <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded ${
                                d.outcome === 'WON'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : d.outcome === 'LOST'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {d.outcome}
                            </span>
                            <span className={d.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {d.pnl >= 0 ? '+' : ''}{sym}{d.pnl.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1 font-mono pt-1">
                      {d.actual !== undefined && (
                        <div className="flex justify-between text-amber-400 font-bold text-sm">
                          <span>Actual Bankroll:</span>
                          <span>{sym}{d.actual.toLocaleString()}</span>
                        </div>
                      )}
                      {d.p50 !== undefined && (
                        <div className="flex justify-between text-cyan-300">
                          <span>Model Expected:</span>
                          <span className="font-bold">{sym}{d.p50.toLocaleString()}</span>
                        </div>
                      )}
                      {d.p95 !== undefined && (
                        <div className="flex justify-between text-emerald-400 text-[11px]">
                          <span>95th %ile Bull:</span>
                          <span>{sym}{d.p95.toLocaleString()}</span>
                        </div>
                      )}
                      {d.p5 !== undefined && (
                        <div className="flex justify-between text-rose-400 text-[11px]">
                          <span>5th %ile Bear:</span>
                          <span>{sym}{d.p5.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800/80">
                      Net from Baseline:{' '}
                      <span
                        className={
                          bankrollVal >= initialCapital ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                        }
                      >
                        {bankrollVal >= initialCapital ? '+' : ''}
                        {sym}{(bankrollVal - initialCapital).toLocaleString()} (
                        {(((bankrollVal - initialCapital) / initialCapital) * 100).toFixed(1)}%)
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
                value: `Green Cushion (+20% / ${sym}${(cushionThreshold / 1000).toFixed(0)}k)`,
                fill: '#34d399',
                position: 'insideTopLeft',
                fontSize: 10,
              }}
            />

            {/* Forecast Area Bands when in overlay or forecast mode */}
            {chartMode !== 'actual' && (
              <>
                <Area
                  type="monotone"
                  dataKey="p95"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fill="url(#bullGradient)"
                  name="Bull Case (95th %ile)"
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Model Expected (50th %ile)"
                />
                <Line
                  type="monotone"
                  dataKey="p5"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Bear Floor (5th %ile)"
                />
              </>
            )}

            {/* Actual Realized Curve */}
            {chartMode !== 'forecast' && (
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#f59e0b"
                strokeWidth={3.5}
                dot={{
                  r: 4,
                  fill: '#f59e0b',
                  stroke: '#1e293b',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 7,
                  fill: '#fbbf24',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
                name="Actual Realized Bankroll"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3 Zone Informational Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Phase 1: The Danger Zone</span>
          </div>
          <div className="text-[11px] font-mono text-rose-300">
            &lt; {sym}{initialCapital.toLocaleString()} (Below Baseline)
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Zero profit cushion. If actual bets land here, keep bet stakes strictly to 2% Kelly to prevent capital decay.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Phase 2: The Lift-Off</span>
          </div>
          <div className="text-[11px] font-mono text-amber-300">
            {sym}{initialCapital.toLocaleString()} to {sym}{cushionThreshold.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Your realized curve is building momentum. Accumulating profit to break out into the permanent green buffer.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Phase 3: The Profit Cushion</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-300">
            &gt; {sym}{cushionThreshold.toLocaleString()} (+20% Profit)
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Protected status. Even standard 4-game downswings happen entirely within earned profit without threatening your principal.
          </p>
        </div>
      </div>

      {/* Bottom KPI Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Ledger Execution Status:{' '}
            <strong className="text-white font-mono">
              {sym}{currentActualBankroll.toLocaleString()}
            </strong>{' '}
            (
            <span
              className={
                netActualProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
              }
            >
              {netActualProfit >= 0 ? '+' : ''}{sym}{netActualProfit.toLocaleString()}
            </span>
            )
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>
            Settled Bets: <strong className="text-slate-200">{totalSettledBets}</strong>
          </span>
          <span>•</span>
          <span>
            Pinnacle CLV Edge:{' '}
            <strong className="text-emerald-400">
              +{calculateAverageCLV(loggedBets || getLoggedBets())}%
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};

function calculateAverageCLV(bets: LoggedBet[]): string {
  const withCLV = bets.filter((b) => b.clvPercent !== undefined && b.clvPercent !== null);
  if (withCLV.length === 0) return '0.0';
  const avg = withCLV.reduce((acc, b) => acc + (b.clvPercent || 0), 0) / withCLV.length;
  return avg.toFixed(1);
}
