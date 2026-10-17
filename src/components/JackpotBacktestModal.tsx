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
  type BacktestSummary,
  runHistoricalBacktest,
} from '../services/jackpotService';

interface JackpotBacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalRounds: HistoricalRound[];
  onLoadRoundToOptimizer?: (periodNumber: string) => void;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export const JackpotBacktestModal: React.FC<JackpotBacktestModalProps> = ({
  isOpen,
  onClose,
  historicalRounds,
  onLoadRoundToOptimizer,
  onSync,
  isSyncing = false,
}) => {
  const [strategy, setStrategy] = useState<'BALANCED_COVER' | 'JACKPOT_MAX_PROB' | 'CONTRARIAN_HIGH_EV' | 'RANDOM_RUSH'>('BALANCED_COVER');
  const [ticketsPerRound, setTicketsPerRound] = useState<number>(8);
  const [sampleRoundsCount, setSampleRoundsCount] = useState<number>(50);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'ROUNDS_TABLE' | 'VS_RUSH'>('SUMMARY');

  // Filtered rounds to evaluate (default to latest 50, or all available)
  const activeRounds = useMemo(() => {
    if (historicalRounds.length === 0) return [];
    return historicalRounds.slice(0, Math.min(historicalRounds.length, sampleRoundsCount));
  }, [historicalRounds, sampleRoundsCount]);

  // Backtest result state
  const [summary, setSummary] = useState<BacktestSummary | null>(null);

  // Automatically compute backtest as soon as rounds are available or inputs change
  useEffect(() => {
    if (isOpen && activeRounds.length > 0) {
      const res = runHistoricalBacktest(activeRounds, strategy, ticketsPerRound);
      setSummary(res);
    }
  }, [isOpen, activeRounds, strategy, ticketsPerRound]);

  // Benchmark: SportyBet Random Rush result on same rounds
  const rushBenchmark = useMemo<BacktestSummary | null>(() => {
    if (activeRounds.length === 0) return null;
    return runHistoricalBacktest(activeRounds, 'RANDOM_RUSH', ticketsPerRound);
  }, [activeRounds, ticketsPerRound]);

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
      const res = runHistoricalBacktest(activeRounds, strategy, ticketsPerRound);
      setSummary(res);
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
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">Historical Covering Backtester</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono">
                  {historicalRounds.length} Rounds (2018–2026)
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
                title="Sync newest settled rounds from SportyBet"
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
                <option value="RANDOM_RUSH">SportyBet Quick Pick (Random Rush)</option>
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
                <option value="4">4 Lines (₦400/wk)</option>
                <option value="8">8 Lines (₦800/wk - Sweetspot)</option>
                <option value="16">16 Lines (₦1,600/wk)</option>
                <option value="32">32 Lines (₦3,200/wk)</option>
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
                <option value="25">25 Rounds (~6 Mos)</option>
                <option value="50">50 Rounds (~1 Year)</option>
                <option value="100">100 Rounds (~2 Yrs)</option>
                <option value="200">200 Rounds (~4 Yrs)</option>
                <option value="390">All 390 Rounds (2018–2026)</option>
              </select>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunTest}
            disabled={isRunning}
            className="py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50 transition shrink-0 text-xs"
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
                ? 'border-amber-400 text-amber-300'
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
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Head-to-Head vs Rush</span>
          </button>
          <button
            onClick={() => setActiveTab('ROUNDS_TABLE')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ROUNDS_TABLE'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>All Rounds Archive ({activeRounds.length})</span>
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
                    {summary.totalRounds} rounds × {summary.ticketsPerRound} lines
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
                    {summary.averageScorePerTicket.toFixed(2)} / 12
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    vs 4.0 / 12 for Random Rush
                  </span>
                </div>
              </div>

              {/* Consolation Tier Breakdown */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Consolation Tier Captures Across {summary.totalRounds} Rounds</span>
                  </h3>
                  <span className="text-[10px] font-mono text-amber-300">
                    Best Single Win: ₦{Math.round(summary.bestSingleRoundWinNGN).toLocaleString()}
                  </span>
                </div>

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

                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Profitable round hit rate: <strong className="text-white">{summary.profitableRounds} of {summary.totalRounds} rounds ({summary.winRateRoundsPct.toFixed(1)}%)</strong> produced consolation/jackpot returns exceeding the round's ticket cost.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Head-to-Head vs SportyBet Rush */}
          {summary && rushBenchmark && activeTab === 'VS_RUSH' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 mb-0.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mathematical Comparison: Covering Algorithms vs SportyBet "Jackpot Rush"</span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  SportyBet's Jackpot Rush uses <code className="font-mono text-amber-400">Math.ceil(3 * Math.random())</code>, assigning a uniform 33.3% to each outcome. Here is how your algorithm directly compares against the same number of tickets over the exact same historical rounds.
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
                      <span className="text-slate-400">11/12 &amp; 10/12 Hits:</span>
                      <span className="font-bold text-emerald-400">{summary.total11Hits + summary.total10Hits} total hits</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Avg Accuracy:</span>
                      <span className="font-bold text-amber-300">{summary.averageScorePerTicket.toFixed(2)} / 12</span>
                    </div>
                  </div>
                </div>

                {/* Sporty Rush Box */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Dices className="w-3.5 h-3.5 text-slate-500" />
                      <span>SportyBet Jackpot Rush</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                      Math.random()
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
                      <span className="text-slate-400">11/12 &amp; 10/12 Hits:</span>
                      <span className="font-bold text-slate-400">{rushBenchmark.total11Hits + rushBenchmark.total10Hits} hits</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Avg Accuracy:</span>
                      <span className="font-bold text-slate-400">{rushBenchmark.averageScorePerTicket.toFixed(2)} / 12</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Rounds Table */}
          {summary && activeTab === 'ROUNDS_TABLE' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Showing {summary.roundDetails.length} completed rounds</span>
                <span className="font-mono text-emerald-400">Click &quot;Load&quot; to inspect any past round in the optimizer</span>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] sticky top-0 z-10">
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
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {summary.roundDetails.map((rd) => (
                      <tr key={rd.periodNumber} className="hover:bg-slate-800/40 transition">
                        <td className="py-1.5 px-3 font-bold text-white">
                          Round {rd.periodNumber}
                        </td>
                        <td className="py-1.5 px-3 text-slate-400">
                          {new Date(rd.deadline).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rd.bestTicketScore >= 10
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : rd.bestTicketScore >= 8
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'text-slate-400'
                          }`}>
                            {rd.bestTicketScore} / 12
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-cyan-400 font-bold">
                          {rd.hits10 > 0 ? `${rd.hits10}x` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-emerald-400 font-bold">
                          {rd.hits11 > 0 ? `${rd.hits11}x` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-amber-400 font-bold">
                          {rd.hits12 > 0 ? `${rd.hits12}x` : '-'}
                        </td>
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
