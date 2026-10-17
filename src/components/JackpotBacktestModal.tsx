import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Trophy,
  BarChart3,
  ShieldCheck,
  Dices,
  Layers,
  Calendar,
  Zap,
  Info,
  RotateCw,
} from 'lucide-react';
import {
  type HistoricalRound,
  type Historical1xBetDraw,
  type BacktestSummary,
  type JackpotPlatform,
  runHistoricalBacktest,
  run1xBetHistoricalBacktest,
} from '../services/jackpotService';

interface JackpotBacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: JackpotPlatform;
  historicalRounds: HistoricalRound[];
  historical1xBetDraws?: Historical1xBetDraw[];
  onLoadRoundToOptimizer?: (periodNumber: string) => void;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export const JackpotBacktestModal: React.FC<JackpotBacktestModalProps> = ({
  isOpen,
  onClose,
  platform = 'sportybet',
  historicalRounds,
  historical1xBetDraws = [],
  onLoadRoundToOptimizer,
  onSync,
  isSyncing = false,
}) => {
  const is1xBet = platform === '1xbet';
  const currentMatchCount = is1xBet ? 14 : 12;
  const totalAvailable = is1xBet ? historical1xBetDraws.length : historicalRounds.length;

  const [strategy, setStrategy] = useState<'BALANCED_COVER' | 'JACKPOT_MAX_PROB' | 'CONTRARIAN_HIGH_EV' | 'RANDOM_RUSH'>('BALANCED_COVER');
  const [ticketsPerRound, setTicketsPerRound] = useState<number>(8);
  const [sampleRoundsCount, setSampleRoundsCount] = useState<number>(50);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'ROUNDS_TABLE' | 'VS_RUSH'>('SUMMARY');

  // Filtered rounds to evaluate (default to latest 50, or all available)
  const activeSportyRounds = useMemo(() => {
    if (historicalRounds.length === 0) return [];
    return historicalRounds.slice(0, Math.min(historicalRounds.length, sampleRoundsCount));
  }, [historicalRounds, sampleRoundsCount]);

  const active1xDraws = useMemo(() => {
    if (historical1xBetDraws.length === 0) return [];
    return historical1xBetDraws.slice(0, Math.min(historical1xBetDraws.length, sampleRoundsCount));
  }, [historical1xBetDraws, sampleRoundsCount]);

  // Backtest result state
  const [summary, setSummary] = useState<BacktestSummary | null>(null);

  // Automatically compute backtest as soon as rounds are available or inputs change
  useEffect(() => {
    if (!isOpen) return;
    if (is1xBet && active1xDraws.length > 0) {
      const res = run1xBetHistoricalBacktest(active1xDraws, strategy, ticketsPerRound);
      setSummary(res);
    } else if (!is1xBet && activeSportyRounds.length > 0) {
      const res = runHistoricalBacktest(activeSportyRounds, strategy, ticketsPerRound);
      setSummary(res);
    }
  }, [isOpen, is1xBet, active1xDraws, activeSportyRounds, strategy, ticketsPerRound]);

  // Benchmark: Quick Pick / Random Rush result on same rounds
  const rushBenchmark = useMemo<BacktestSummary | null>(() => {
    if (is1xBet) {
      if (active1xDraws.length === 0) return null;
      return run1xBetHistoricalBacktest(active1xDraws, 'RANDOM_RUSH', ticketsPerRound);
    } else {
      if (activeSportyRounds.length === 0) return null;
      return runHistoricalBacktest(activeSportyRounds, 'RANDOM_RUSH', ticketsPerRound);
    }
  }, [is1xBet, active1xDraws, activeSportyRounds, ticketsPerRound]);

  const benchmarkAccuracyText = rushBenchmark
    ? `${rushBenchmark.averageScorePerTicket.toFixed(2)} / ${currentMatchCount} for ${is1xBet ? 'Quick Pick' : 'Random Rush'}`
    : `${(currentMatchCount / 3).toFixed(1)} / ${currentMatchCount} for ${is1xBet ? 'Quick Pick' : 'Random Rush'}`;

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const handleRunTest = () => {
    setIsRunning(true);
    setTimeout(() => {
      if (is1xBet) {
        const res = run1xBetHistoricalBacktest(active1xDraws, strategy, ticketsPerRound);
        setSummary(res);
      } else {
        const res = runHistoricalBacktest(activeSportyRounds, strategy, ticketsPerRound);
        setSummary(res);
      }
      setIsRunning(false);
    }, 80);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Compact Modal Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              is1xBet
                ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}>
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">
                  {is1xBet ? '1xBet TOTO-14 Covering Backtester' : 'SportyBet 12 Covering Backtester'}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider font-mono ${
                  is1xBet
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                }`}>
                  {is1xBet
                    ? `${historical1xBetDraws.length} Draws (#1153 down to #903)`
                    : `${historicalRounds.length} Rounds (2018–2026)`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSync && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-emerald-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title={is1xBet ? 'Sync newest settled draws from 1xBet CMS' : 'Sync newest settled rounds from SportyBet CMS'}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync History'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Single-Row Controls Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Strategy Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Strategy:</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="BALANCED_COVER">Balanced Consolation Cover (Sweetspot)</option>
                <option value="JACKPOT_MAX_PROB">Jackpot Max Probability Anchor</option>
                <option value="CONTRARIAN_HIGH_EV">Contrarian High EV (Fade Public)</option>
                <option value="RANDOM_RUSH">
                  {is1xBet ? '1xBet Quick Pick (Uniform Random)' : 'SportyBet Quick Pick (Random Rush)'}
                </option>
              </select>
            </div>

            {/* Lines Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Lines:</span>
              <select
                value={ticketsPerRound}
                onChange={(e) => setTicketsPerRound(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="4">4 Lines (₦400/round)</option>
                <option value="8">8 Lines (₦800/round - Sweetspot)</option>
                <option value="16">16 Lines (₦1,600/round)</option>
                <option value="32">32 Lines (₦3,200/round)</option>
              </select>
            </div>

            {/* Sample Size Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Sample:</span>
              <select
                value={sampleRoundsCount}
                onChange={(e) => setSampleRoundsCount(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="25">25 {is1xBet ? 'Draws' : 'Rounds'} (~6 Mos)</option>
                <option value="50">50 {is1xBet ? 'Draws' : 'Rounds'} (~1 Year)</option>
                <option value="100">100 {is1xBet ? 'Draws' : 'Rounds'} (~2 Yrs)</option>
                <option value="200">200 {is1xBet ? 'Draws' : 'Rounds'} (~4 Yrs)</option>
                <option value="500">All {totalAvailable} {is1xBet ? 'Draws' : 'Rounds'}</option>
              </select>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunTest}
            disabled={isRunning}
            className={`py-1.5 px-3.5 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 transition shrink-0 text-xs ${
              is1xBet
                ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-400/20'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>{isRunning ? 'Calculating...' : 'Run Test'}</span>
          </button>
        </div>

        {/* Compact Tabs */}
        <div className="flex items-center gap-2 px-5 pt-2 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <button
            onClick={() => setActiveTab('SUMMARY')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SUMMARY'
                ? is1xBet ? 'border-cyan-400 text-cyan-300' : 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Summary &amp; Performance</span>
          </button>
          <button
            onClick={() => setActiveTab('VS_RUSH')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'VS_RUSH'
                ? is1xBet ? 'border-cyan-400 text-cyan-300' : 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>{is1xBet ? 'Head-to-Head vs Quick Pick' : 'Head-to-Head vs Rush'}</span>
          </button>
          <button
            onClick={() => setActiveTab('ROUNDS_TABLE')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ROUNDS_TABLE'
                ? is1xBet ? 'border-cyan-400 text-cyan-300' : 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>All Historical {is1xBet ? 'Draws' : 'Rounds'} ({summary ? summary.roundDetails.length : 0})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {summary && activeTab === 'SUMMARY' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* 4 Main KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* Total Invested */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Total Invested
                  </span>
                  <div className="text-lg font-black font-mono text-white mt-0.5">
                    ₦{summary.totalStakeNGN.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {summary.totalRounds} {is1xBet ? 'draws' : 'rounds'} × {summary.ticketsPerRound} lines
                  </span>
                </div>

                {/* Total Winnings */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Total Winnings
                  </span>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                    ₦{Math.round(summary.totalPayoutNGN).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Consolations &amp; Jackpots
                  </span>
                </div>

                {/* Net Profit / Loss */}
                <div className={`p-3 rounded-2xl bg-slate-950/70 border ${
                  summary.netProfitNGN >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'
                }`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
                    <span>Net Profit / ROI</span>
                    {summary.netProfitNGN >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-rose-400" />
                    )}
                  </span>
                  <div className={`text-lg font-black font-mono mt-0.5 ${
                    summary.netProfitNGN >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {summary.netProfitNGN >= 0 ? '+' : ''}₦{Math.round(summary.netProfitNGN).toLocaleString()}
                  </div>
                  <span className={`text-[10px] font-bold font-mono ${
                    summary.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {summary.roiPct >= 0 ? '+' : ''}{summary.roiPct.toFixed(1)}% ROI
                  </span>
                </div>

                {/* Average Accuracy */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Avg Ticket Accuracy
                  </span>
                  <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
                    {summary.averageScorePerTicket.toFixed(2)} / {currentMatchCount}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    vs {benchmarkAccuracyText}
                  </span>
                </div>
              </div>

              {/* Consolation Tier Breakdown */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Consolation Tier Captures Across {summary.totalRounds} {is1xBet ? 'Draws' : 'Rounds'}</span>
                  </h3>
                  <span className="text-[10px] font-mono text-amber-300">
                    Best Single Win: ₦{Math.round(summary.bestSingleRoundWinNGN).toLocaleString()}
                  </span>
                </div>

                {/* Platform Tiers: 6 for 1xBet, 3 for SportyBet */}
                {is1xBet ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 text-[11px] block">14/14 Jackpot</span>
                      <span className="font-mono text-base font-black text-amber-400 mt-1">
                        {summary.total14Hits || 0} Hits
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 text-[11px] block">13/14 (10% Pool)</span>
                      <span className="font-mono text-base font-black text-amber-300 mt-1">
                        {summary.total13Hits || 0} Hits
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 text-[11px] block">12/14 (10% Pool)</span>
                      <span className="font-mono text-base font-black text-emerald-400 mt-1">
                        {summary.total12Hits || 0} Hits
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 text-[11px] block">11/14 (15% Pool)</span>
                      <span className="font-mono text-base font-black text-emerald-300 mt-1">
                        {summary.total11Hits || 0} Hits
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 text-[11px] block">10/14 (20% Pool)</span>
                      <span className="font-mono text-base font-black text-cyan-400 mt-1">
                        {summary.total10Hits || 0} Hits
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 text-[11px] block">9/14 (35% Pool)</span>
                      <span className="font-mono text-base font-black text-cyan-300 mt-1">
                        {summary.total9Hits || 0} Hits
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 text-[11px] block">12/12 Super Jackpot</span>
                        <span className="font-mono text-base font-black text-amber-400">
                          {summary.total12Hits} Hits
                        </span>
                      </div>
                      <Trophy className="w-5 h-5 text-amber-400/30" />
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 text-[11px] block">11/12 Tier (12% Pool)</span>
                        <span className="font-mono text-base font-black text-emerald-400">
                          {summary.total11Hits} Hits
                        </span>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400/30" />
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 text-[11px] block">10/12 Tier (3% Pool)</span>
                        <span className="font-mono text-base font-black text-cyan-400">
                          {summary.total10Hits} Hits
                        </span>
                      </div>
                      <Layers className="w-5 h-5 text-cyan-400/30" />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Profitable round hit rate: <strong className="text-white">{summary.profitableRounds} of {summary.totalRounds} {is1xBet ? 'draws' : 'rounds'} ({summary.winRateRoundsPct.toFixed(1)}%)</strong> produced returns exceeding the ticket cost.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Head-to-Head vs Sporty Rush / 1xBet Quick Pick */}
          {summary && rushBenchmark && activeTab === 'VS_RUSH' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 mb-0.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Mathematical Comparison: Covering Algorithms vs {is1xBet ? '1xBet Quick Pick' : 'SportyBet Jackpot Rush'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  {is1xBet
                    ? '1xBet Quick Pick uses uniform random selection (33.3% per outcome across 14 matches, mathematical EV expectation 4.67 / 14). Here is how your algorithmic covering portfolio performs over the same draws.'
                    : 'SportyBet Jackpot Rush uses Math.ceil(3 * Math.random()), assigning a uniform 33.3% to each outcome (mathematical EV expectation 4.0 / 12). Here is how your algorithm directly compares.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Algorithm Box */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Your Covering Algorithm</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      {strategy}
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Total Winnings:</span>
                      <span className="font-bold text-white">₦{Math.round(summary.totalPayoutNGN).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Net Profit / Loss:</span>
                      <span className={`font-bold ${summary.netProfitNGN >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {summary.netProfitNGN >= 0 ? '+' : ''}₦{Math.round(summary.netProfitNGN).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Consolation Hits:</span>
                      <span className="font-bold text-emerald-400">
                        {is1xBet
                          ? (summary.total14Hits || 0) + (summary.total13Hits || 0) + (summary.total12Hits || 0) + (summary.total11Hits || 0) + (summary.total10Hits || 0) + (summary.total9Hits || 0)
                          : summary.total11Hits + summary.total10Hits} hits
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Avg Accuracy:</span>
                      <span className="font-bold text-amber-300">{summary.averageScorePerTicket.toFixed(2)} / {currentMatchCount}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Pick Box */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Dices className="w-3.5 h-3.5 text-slate-500" />
                      <span>{is1xBet ? '1xBet Quick Pick' : 'SportyBet Jackpot Rush'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                      Uniform Random
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Total Winnings:</span>
                      <span className="font-bold text-slate-400">₦{Math.round(rushBenchmark.totalPayoutNGN).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Net Profit / Loss:</span>
                      <span className="font-bold text-rose-400">
                        -₦{rushBenchmark.totalStakeNGN.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Consolation Hits:</span>
                      <span className="font-bold text-slate-400">
                        {is1xBet
                          ? (rushBenchmark.total14Hits || 0) + (rushBenchmark.total13Hits || 0) + (rushBenchmark.total12Hits || 0) + (rushBenchmark.total11Hits || 0) + (rushBenchmark.total10Hits || 0) + (rushBenchmark.total9Hits || 0)
                          : rushBenchmark.total11Hits + rushBenchmark.total10Hits} hits
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Avg Accuracy:</span>
                      <span className="font-bold text-slate-400">{rushBenchmark.averageScorePerTicket.toFixed(2)} / {currentMatchCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Rounds / Draws Table */}
          {summary && activeTab === 'ROUNDS_TABLE' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Showing {summary.roundDetails.length} completed {is1xBet ? 'draws' : 'rounds'}</span>
                <span className="font-mono text-emerald-400">Click &quot;Load&quot; to inspect any past {is1xBet ? 'draw' : 'round'} in the optimizer</span>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] sticky top-0 z-10">
                    {is1xBet ? (
                      <tr>
                        <th className="py-2 px-3">Draw</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Best Score</th>
                        <th className="py-2 px-2.5 text-center">9/14</th>
                        <th className="py-2 px-2.5 text-center">10/14</th>
                        <th className="py-2 px-2.5 text-center">11/14</th>
                        <th className="py-2 px-2.5 text-center">12/14</th>
                        <th className="py-2 px-2.5 text-center">13/14</th>
                        <th className="py-2 px-2.5 text-center">14/14</th>
                        <th className="py-2 px-3">Stake</th>
                        <th className="py-2 px-3">Payout</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="py-2 px-3">Round</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Best Score</th>
                        <th className="py-2 px-3">10/12</th>
                        <th className="py-2 px-3">11/12</th>
                        <th className="py-2 px-3">12/12</th>
                        <th className="py-2 px-3">Stake</th>
                        <th className="py-2 px-3">Payout</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {summary.roundDetails.map((rd) => (
                      <tr key={rd.periodNumber} className="hover:bg-slate-800/40 transition">
                        <td className="py-1.5 px-3 font-bold text-white">
                          {is1xBet ? `Draw #${rd.periodNumber}` : `Round ${rd.periodNumber}`}
                        </td>
                        <td className="py-1.5 px-3 text-slate-400">
                          {new Date(rd.deadline).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rd.bestTicketScore >= (is1xBet ? 11 : 10)
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : rd.bestTicketScore >= (is1xBet ? 9 : 8)
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'text-slate-400'
                          }`}>
                            {rd.bestTicketScore} / {currentMatchCount}
                          </span>
                        </td>

                        {is1xBet ? (
                          <>
                            <td className="py-1.5 px-2.5 text-center text-cyan-300 font-bold">
                              {(rd.hits9 || 0) > 0 ? `${rd.hits9}x` : '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-center text-cyan-400 font-bold">
                              {rd.hits10 > 0 ? `${rd.hits10}x` : '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-center text-emerald-300 font-bold">
                              {rd.hits11 > 0 ? `${rd.hits11}x` : '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-center text-emerald-400 font-bold">
                              {rd.hits12 > 0 ? `${rd.hits12}x` : '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-center text-amber-300 font-bold">
                              {(rd.hits13 || 0) > 0 ? `${rd.hits13}x` : '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-center text-amber-400 font-bold">
                              {(rd.hits14 || 0) > 0 ? `${rd.hits14}x` : '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-1.5 px-3 text-cyan-400 font-bold">
                              {rd.hits10 > 0 ? `${rd.hits10}x` : '-'}
                            </td>
                            <td className="py-1.5 px-3 text-emerald-400 font-bold">
                              {rd.hits11 > 0 ? `${rd.hits11}x` : '-'}
                            </td>
                            <td className="py-1.5 px-3 text-amber-400 font-bold">
                              {rd.hits12 > 0 ? `${rd.hits12}x` : '-'}
                            </td>
                          </>
                        )}

                        <td className="py-1.5 px-3 text-slate-400">
                          ₦{rd.stakeNGN.toLocaleString()}
                        </td>
                        <td className={`py-1.5 px-3 font-bold ${
                          rd.payoutNGN > 0 ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {rd.payoutNGN > 0 ? `₦${Math.round(rd.payoutNGN).toLocaleString()}` : '₦0'}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {onLoadRoundToOptimizer && (
                            <button
                              onClick={() => {
                                onLoadRoundToOptimizer(rd.periodNumber);
                                onClose();
                              }}
                              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-[10px] font-bold transition cursor-pointer"
                            >
                              Load
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
