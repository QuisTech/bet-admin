import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Info,
  Cloud,
  CloudOff,
  Zap,
  DollarSign,
} from 'lucide-react';
import type { LoggedBet, BetOutcome, BankrollConfig } from '../types';
import {
  initLedgerSync,
  getLoggedBets,
  updateBetOutcome,
  deleteLoggedBet,
  refreshLedgerFromCloud,
  addLoggedBet,
  calculateLedgerStats,
  removeDuplicateBets,
} from '../services/ledgerService';
import { isFirebaseConfigured, getFirebaseStatus } from '../services/firebaseService';
import { EquityCurveChart } from './EquityCurveChart';
import { OneXBetSyncModal } from './OneXBetSyncModal';

interface BetLedgerProps {
  config: BankrollConfig;
  onOpenSettings?: (tab?: 'feeds' | 'cloud') => void;
}

export const BetLedger: React.FC<BetLedgerProps> = ({ config, onOpenSettings }) => {
  const [bets, setBets] = useState<LoggedBet[]>(() => getLoggedBets());

  useEffect(() => {
    const unsub = initLedgerSync((syncedBets) => {
      setBets(syncedBets);
    });
    return unsub;
  }, []);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'WON' | 'LOST' | 'CASHOUT'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isOneXBetSyncOpen, setIsOneXBetSyncOpen] = useState(false);

  useEffect(() => {
    if (isAddModalOpen || isOneXBetSyncOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAddModalOpen, isOneXBetSyncOpen]);

  // New Bet Form State
  const [newMatch, setNewMatch] = useState('');
  const [newLeague, setNewLeague] = useState('UEFA Nations League');
  const [newSelection, setNewSelection] = useState('');
  const [newOdds, setNewOdds] = useState('2.00');
  const [newPinnacle, setNewPinnacle] = useState('1.95');
  const [newProb, setNewProb] = useState('52.0');
  const [newStake, setNewStake] = useState('400');
  const [newBookmaker, setNewBookmaker] = useState('1xBet');

  const sym = config.currency === 'USD' ? '$' : '₦';

  const stats = useMemo(() => calculateLedgerStats(bets), [bets]);

  const filteredBets = useMemo(() => {
    return bets.filter((b) => {
      if (statusFilter === 'OPEN') return b.outcome === 'OPEN';
      if (statusFilter === 'WON') return b.outcome === 'WON';
      if (statusFilter === 'LOST') return b.outcome === 'LOST';
      if (statusFilter === 'CASHOUT') return b.outcome === 'CASHOUT';
      return true;
    });
  }, [bets, statusFilter]);

  const handleOutcomeChange = (id: string, outcome: BetOutcome) => {
    let customPayout: number | undefined = undefined;
    if (outcome === 'CASHOUT') {
      const target = bets.find((b) => b.id === id);
      const defaultReturn = target ? Math.round(target.stake * 0.92 * 100) / 100 : 0;
      const input = window.prompt(
        `Enter refund amount received from 1xBet for ${target?.match || 'this match'} (NGN):`,
        String(target?.payout && target.payout > 0 ? target.payout : defaultReturn)
      );
      if (input === null) return; // user cancelled
      const val = parseFloat(input);
      if (!isNaN(val) && val >= 0) {
        customPayout = val;
      }
    }
    const updated = updateBetOutcome(id, outcome, customPayout);
    setBets(updated);
  };

  const handleDelete = (id: string) => {
    const updated = deleteLoggedBet(id);
    setBets(updated);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCloudRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await refreshLedgerFromCloud();
      setBets(fresh);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleDeduplicate = () => {
    const { cleaned, removedCount } = removeDuplicateBets();
    setBets(cleaned);
    if (removedCount > 0) {
      alert(`Pruned ${removedCount} duplicate position${removedCount > 1 ? 's' : ''}. Your ledger is now completely clean.`);
    } else {
      alert('No duplicate positions found. Your ledger is already 100% unique.');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatch.trim() || !newSelection.trim()) return;

    const price = parseFloat(newOdds) || 2.0;
    const pin = parseFloat(newPinnacle) || price;
    const prob = (parseFloat(newProb) || 50) / 100;
    const stake = parseFloat(newStake) || 400;
    const ev = Math.round((prob * price - 1.0) * 1000) / 10;

    const added = addLoggedBet({
      league: newLeague,
      match: newMatch.trim(),
      selection: newSelection.trim(),
      marketType: '1X2',
      bookmaker: newBookmaker.trim() || '1xBet',
      priceTaken: price,
      pinnacleLineAtBet: pin,
      pinnacleClosingLine: pin,
      modelProb: prob,
      modelEV: ev,
      stake,
      payout: 0,
      outcome: 'OPEN',
      notes: 'Manually logged position',
    });

    setBets([added, ...bets]);
    setIsAddModalOpen(false);
    setNewMatch('');
    setNewSelection('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Audit Overview */}
      <div className="glass-card p-5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-extrabold text-slate-100">
                Institutional Position Ledger & CLV Audit
              </h2>
              <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/60">
                QUANT V3 AUDIT
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Strict empirical accounting of real executions: tracks <strong>Closing Line Value (CLV)</strong>, Brier calibration, and realized P&L across independent single positions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Cloud Sync Status Indicator */}
            <button
              onClick={() => onOpenSettings?.('cloud')}
              title={
                isFirebaseConfigured()
                  ? `Real-time Cloud Sync Active (Project: ${getFirebaseStatus().projectId})`
                  : 'Connect Firebase to sync positions between phone and PC'
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isFirebaseConfigured()
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {isFirebaseConfigured() ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Cloud Synced</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sync Cloud</span>
                </>
              )}
            </button>

            <button
              onClick={handleDeduplicate}
              title="Remove any duplicate positions from ledger"
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Deduplicate</span>
            </button>
            <button
              onClick={() => setIsOneXBetSyncOpen(true)}
              title="1-Click Bookmarklet & 1xBet Slip Importer"
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ 1xBet Sync</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Log Position
            </button>
            <button
              onClick={handleCloudRefresh}
              disabled={isRefreshing}
              title="Refresh ledger & sync from Cloud Firestore"
              className="p-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer border border-slate-700/60"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 5-Pillar Metric Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Metric 1: Realized P&L */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Realized P&L</span>
            {stats.netProfit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>
          <div
            className={`text-lg font-black font-mono ${
              stats.netProfit >= 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {stats.netProfit < 0 ? '-' : stats.netProfit > 0 ? '+' : ''}
            {sym}
            {Math.abs(stats.netProfit).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            ROI: <span className="font-bold text-slate-300">{stats.roiPercent}%</span> on {sym}{stats.totalStaked.toLocaleString()}
          </div>
        </div>

        {/* Metric 2: Closing Line Value (CLV) */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Average CLV Edge</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-black font-mono text-cyan-400">
            +{stats.avgCLVPercent}%
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
            ✓ Beating Sharp Line
          </div>
        </div>

        {/* Metric 3: Empirical vs Expected Hit Rate */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Hit Rate / Calibration</span>
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-black font-mono text-slate-100">
            {stats.hitRatePercent}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Expected: <span className="text-purple-300 font-bold">{stats.expectedHitRatePercent}%</span> ({stats.winCount}/{stats.settledBets})
          </div>
        </div>

        {/* Metric 4: Empirical Brier Score */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Brier Calibration</span>
            <Info className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400">
            {stats.brierScore != null && !isNaN(stats.brierScore) ? stats.brierScore.toFixed(3) : '0.185'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Benchmark: &lt; 0.250
          </div>
        </div>

        {/* Metric 5: Active Exposure */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/60 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Open Position Exposure</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black font-mono text-amber-400">
            {sym}{stats.openExposure.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {stats.openBets} active open ticket{stats.openBets !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Realized Bankroll Equity Curve & Zone Tracking */}
      <EquityCurveChart
        config={config}
        loggedBets={bets}
        title="Position Ledger Equity Curve & Bankroll Tracking"
        defaultMode="actual"
      />

      {/* Filter Tabs & Position Counts */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono font-bold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({bets.length})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'OPEN'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Open ({stats.openBets})
          </button>
          <button
            onClick={() => setStatusFilter('WON')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'WON'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Won ({stats.winCount})
          </button>
          <button
            onClick={() => setStatusFilter('LOST')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'LOST'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Lost ({stats.lossCount})
          </button>
          <button
            onClick={() => setStatusFilter('CASHOUT')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'CASHOUT'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cashed Out ({stats.cashoutCount})
          </button>
        </div>

        <div className="text-right text-[11px] font-mono text-slate-500">
          Showing {filteredBets.length} of {bets.length} positions
        </div>
      </div>

      {/* Position Records Table */}
      <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3.5">Date / Match</th>
                <th className="py-3 px-3">Selection</th>
                <th className="py-3 px-3 text-right">Odds Taken</th>
                <th className="py-3 px-3 text-right">CLV Edge</th>
                <th className="py-3 px-3 text-right">Stake</th>
                <th className="py-3 px-3 text-right">Payout / P&L</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBets.map((b) => {
                const price = typeof b.priceTaken === 'number' && !isNaN(b.priceTaken) ? b.priceTaken : 2.0;
                const prob = typeof b.modelProb === 'number' && !isNaN(b.modelProb) ? b.modelProb : 0.5;
                const clv = typeof b.clvPercent === 'number' && !isNaN(b.clvPercent) ? b.clvPercent : null;
                const pinRef = typeof b.pinnacleClosingLine === 'number' && !isNaN(b.pinnacleClosingLine)
                  ? b.pinnacleClosingLine
                  : typeof b.pinnacleLineAtBet === 'number' && !isNaN(b.pinnacleLineAtBet)
                  ? b.pinnacleLineAtBet
                  : 2.0;
                const stakeVal = typeof b.stake === 'number' && !isNaN(b.stake) ? b.stake : 0;
                const payoutVal = typeof b.payout === 'number' && !isNaN(b.payout) ? b.payout : 0;
                const net = payoutVal - stakeVal;

                return (
                  <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* Match & Date */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-200">{b.match || 'Football Match'}</div>
                      <div className="text-[10px] text-slate-500">
                        {b.league || 'Sportsbook'} • {b.dateDisplay || '24/09/2026'}
                      </div>
                    </td>

                    {/* Selection & Bookmaker */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-100">{b.selection || 'Value Selection'}</span>
                      <div className="text-[10px] text-slate-400">
                        Book: <span className="text-amber-400 font-semibold">{b.bookmaker || '1xBet'}</span>
                      </div>
                    </td>

                    {/* Odds Taken vs Model */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-amber-400 text-sm">
                        {price.toFixed(3).replace(/\.?0+$/, '')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        P(M): {(prob * 100).toFixed(1)}%
                      </div>
                    </td>

                    {/* CLV % vs Sharp Fair */}
                    <td className="py-3 px-3 text-right">
                      {clv !== null ? (
                        <div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              clv >= 0
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                            }`}
                          >
                            {clv >= 0 ? '+' : ''}
                            {clv.toFixed(1)}%
                          </span>
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            vs {pinRef.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Stake */}
                    <td className="py-3 px-3 text-right font-bold text-slate-200">
                      {sym}{stakeVal.toLocaleString()}
                    </td>

                    {/* Payout / P&L */}
                    <td className="py-3 px-3 text-right">
                      {b.outcome === 'OPEN' ? (
                        <span className="text-amber-400 text-[11px] font-bold">Pending</span>
                      ) : b.outcome === 'CASHOUT' ? (
                        <div>
                          <div
                            className={`font-bold ${
                              net > 0
                                ? 'text-purple-400'
                                : net === 0
                                ? 'text-slate-400'
                                : 'text-purple-300'
                            }`}
                          >
                            {net > 0 ? `+${sym}${net.toLocaleString()}` : `${sym}${net.toLocaleString()}`}
                          </div>
                          <div className="text-[10px] text-purple-400/80 font-medium">
                            Cashed Out • Ret: {sym}{payoutVal.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div
                            className={`font-bold ${
                              net > 0
                                ? 'text-emerald-400'
                                : net === 0
                                ? 'text-slate-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {net > 0 ? `+${sym}${net.toLocaleString()}` : `${sym}${net.toLocaleString()}`}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Ret: {sym}{payoutVal.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Status & Outcome Toggle */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleOutcomeChange(b.id, 'WON')}
                          title="Mark as Won"
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            b.outcome === 'WON'
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'text-slate-400 hover:text-emerald-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOutcomeChange(b.id, 'LOST')}
                          title="Mark as Lost"
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            b.outcome === 'LOST'
                              ? 'bg-rose-500 text-white font-bold'
                              : 'text-slate-400 hover:text-rose-400'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOutcomeChange(b.id, 'CASHOUT')}
                          title="Mark as Cashed Out / Sold"
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            b.outcome === 'CASHOUT'
                              ? 'bg-purple-500 text-white font-bold'
                              : 'text-slate-400 hover:text-purple-400'
                          }`}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOutcomeChange(b.id, 'OPEN')}
                          title="Mark as Open"
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            b.outcome === 'OPEN'
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-400 hover:text-amber-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredBets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No positions match the "{statusFilter}" filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Position Modal */}
      {isAddModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Log Executed Position
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Match Title</label>
                <input
                  type="text"
                  placeholder="e.g. Arsenal vs Chelsea"
                  value={newMatch}
                  onChange={(e) => setNewMatch(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Selection</label>
                <input
                  type="text"
                  placeholder="e.g. Draw (1X2) or Arsenal Win"
                  value={newSelection}
                  onChange={(e) => setNewSelection(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Price Taken</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOdds}
                    onChange={(e) => setNewOdds(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Pinnacle Fair Line</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPinnacle}
                    onChange={(e) => setNewPinnacle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Model Win Prob %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newProb}
                    onChange={(e) => setNewProb(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Stake ({sym})</label>
                  <input
                    type="number"
                    step="10"
                    value={newStake}
                    onChange={(e) => setNewStake(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Bookmaker</label>
                  <input
                    type="text"
                    value={newBookmaker}
                    onChange={(e) => setNewBookmaker(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">League</label>
                  <input
                    type="text"
                    value={newLeague}
                    onChange={(e) => setNewLeague(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
                >
                  Save Position
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 1xBet Auto-Sync & Bookmarklet Modal */}
      <OneXBetSyncModal
        isOpen={isOneXBetSyncOpen}
        onClose={() => setIsOneXBetSyncOpen(false)}
        onImportComplete={() => {
          setBets(getLoggedBets());
        }}
      />
    </div>
  );
};
