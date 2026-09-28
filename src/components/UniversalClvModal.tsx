import React, { useState, useMemo } from 'react';
import {
  X,
  Calculator,
  TrendingUp,
  BookmarkPlus,
  Check,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { BankrollConfig } from '../types';
import { calculateShinDevig } from '../models/shinDevig';
import { calculateKellyStake, calculateEV } from '../models/evEngine';
import { addLoggedBet } from '../services/ledgerService';

interface UniversalClvModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BankrollConfig;
  onPositionLogged?: () => void;
}

export const UniversalClvModal: React.FC<UniversalClvModalProps> = ({
  isOpen,
  onClose,
  config,
  onPositionLogged,
}) => {
  const [matchName, setMatchName] = useState('');
  const [selection, setSelection] = useState('Home Win');
  const [bookmaker, setBookmaker] = useState('1xBet');
  const [league, setLeague] = useState('');
  const [bookOdds, setBookOdds] = useState('2.40');

  // Benchmark method: 'direct' or '3way'
  const [benchmarkMode, setBenchmarkMode] = useState<'direct' | '3way'>('direct');
  const [directFairOdds, setDirectFairOdds] = useState('2.15');

  // 3-way line inputs for Shin De-vig
  const [rawHome, setRawHome] = useState('2.20');
  const [rawDraw, setRawDraw] = useState('3.30');
  const [rawAway, setRawAway] = useState('3.50');
  const [selectedWay, setSelectedWay] = useState<0 | 1 | 2>(0); // 0=Home, 1=Draw, 2=Away

  // Optional model prob override
  const [probOverride, setProbOverride] = useState('');

  const [loggedSuccess, setLoggedSuccess] = useState(false);

  const sym = config.currency === 'USD' ? '$' : '₦';

  // Compute fair odds & probability
  const { fairOdds, modelProb, devigMargin, devigZ } = useMemo(() => {
    const parsedBookOdds = parseFloat(bookOdds) || 2.0;

    if (benchmarkMode === 'direct') {
      const fOdds = parseFloat(directFairOdds) || parsedBookOdds;
      const parsedOverride = parseFloat(probOverride);
      const prob = !isNaN(parsedOverride) && parsedOverride > 0 && parsedOverride <= 100
        ? parsedOverride / 100
        : fOdds > 1.0 ? 1 / fOdds : 0.5;

      return {
        fairOdds: fOdds,
        modelProb: prob,
        devigMargin: 0,
        devigZ: 0,
      };
    } else {
      const h = parseFloat(rawHome) || 2.0;
      const d = parseFloat(rawDraw) || 3.2;
      const a = parseFloat(rawAway) || 3.5;

      try {
        const shin = calculateShinDevig([h, d, a]);
        const fOdds = shin.fairOdds[selectedWay] || h;
        const parsedOverride = parseFloat(probOverride);
        const prob = !isNaN(parsedOverride) && parsedOverride > 0 && parsedOverride <= 100
          ? parsedOverride / 100
          : shin.fairProbabilities[selectedWay] || (1 / fOdds);

        return {
          fairOdds: Math.round(fOdds * 100) / 100,
          modelProb: prob,
          devigMargin: Math.round(shin.margin * 1000) / 10,
          devigZ: Math.round(shin.z * 1000) / 10,
        };
      } catch {
        return {
          fairOdds: h,
          modelProb: 1 / h,
          devigMargin: 0,
          devigZ: 0,
        };
      }
    }
  }, [benchmarkMode, directFairOdds, rawHome, rawDraw, rawAway, selectedWay, probOverride, bookOdds]);

  const parsedBookOdds = parseFloat(bookOdds) || 1.01;

  // Closing Line Value % = ((Price Taken / Fair Benchmark) - 1) * 100
  const clvPercent = fairOdds > 1.0
    ? Math.round(((parsedBookOdds / fairOdds) - 1.0) * 1000) / 10
    : 0;

  // Expected Value % = (ModelProb * BookOdds - 1) * 100
  const evPercent = calculateEV(modelProb, parsedBookOdds);
  const isPositiveEV = evPercent > 0;

  // Kelly Staking
  const kelly = calculateKellyStake(modelProb, parsedBookOdds, config);
  const projectedReturn = Math.round(kelly.stakeNGN * parsedBookOdds);
  const netProfit = projectedReturn - kelly.stakeNGN;

  const handleSaveToLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBookOdds <= 1.0) return;

    const finalMatch = matchName.trim() || 'Custom Tested Fixture';
    const finalSelection = selection.trim() || 'Custom Selection';
    const finalLeague = league.trim() || 'Global Odds Ingestion';
    const finalStake = kelly.stakeNGN > 0 ? kelly.stakeNGN : 200;

    addLoggedBet({
      league: finalLeague,
      match: finalMatch,
      selection: finalSelection,
      marketType: '1X2',
      bookmaker: bookmaker.trim() || 'Retail Book',
      priceTaken: parsedBookOdds,
      pinnacleLineAtBet: fairOdds,
      pinnacleClosingLine: fairOdds,
      modelProb: modelProb,
      modelEV: evPercent,
      stake: finalStake,
      payout: 0,
      outcome: 'OPEN',
      notes: `Custom CLV Checked (CLV: ${clvPercent > 0 ? '+' : ''}${clvPercent}%, Fair: ${fairOdds.toFixed(2)})`,
    });

    setLoggedSuccess(true);
    onPositionLogged?.();
    setTimeout(() => {
      setLoggedSuccess(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-700/80 shadow-2xl bg-slate-950/95 p-5 sm:p-7 relative max-h-[94vh] overflow-y-auto space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Header */}
        <div className="pr-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Calculator className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Universal CLV & Price Edge Inspector
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test any game on earth before placing it on 1xBet, SportyBet, or any bookmaker. Compute pure <strong>Closing Line Value (CLV)</strong>, de-vigged fair lines, and optimal Kelly stake.
          </p>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSaveToLedger} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Match / Fixture (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Real Sociedad vs Valencia"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Target Market / Selection
              </label>
              <input
                type="text"
                placeholder="e.g. Home Win, Over 2.5, Draw (1X2)"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                required
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Bookmaker / Site
              </label>
              <input
                type="text"
                placeholder="e.g. 1xBet, SportyBet, Bet9ja"
                value={bookmaker}
                onChange={(e) => setBookmaker(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-amber-400 font-black block mb-1">
                Retail Odds (Price Taken)
              </label>
              <input
                type="number"
                step="0.001"
                min="1.01"
                placeholder="e.g. 2.40"
                value={bookOdds}
                onChange={(e) => setBookOdds(e.target.value)}
                required
                className="w-full bg-slate-900/90 border border-amber-500/50 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                League (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. La Liga, NPFL, Serie B"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Benchmark Mode Selector */}
          <div className="p-3.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Sharp Benchmark Source
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setBenchmarkMode('direct')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    benchmarkMode === 'direct'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Direct Fair Line
                </button>
                <button
                  type="button"
                  onClick={() => setBenchmarkMode('3way')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    benchmarkMode === '3way'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Shin De-Vig (3-Way 1X2)
                </button>
              </div>
            </div>

            {benchmarkMode === 'direct' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Pinnacle / Sharp Fair Reference Line
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="1.01"
                    value={directFairOdds}
                    onChange={(e) => setDirectFairOdds(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-500 outline-none"
                    placeholder="e.g. 2.15"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Use Pinnacle's no-vig line or sharp exchange closing price
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Model Win Probability % (Optional Override)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={probOverride}
                    onChange={(e) => setProbOverride(e.target.value)}
                    placeholder={`Implied: ${(modelProb * 100).toFixed(1)}%`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-emerald-500 outline-none"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Defaults to sharp implied prob: {(modelProb * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <span className="text-[10px] text-slate-400 block">
                  Enter Pinnacle Raw 1X2 Market Lines (Shin 1993 strips bookmaker margin):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">1 (Home)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={rawHome}
                      onChange={(e) => setRawHome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">X (Draw)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={rawDraw}
                      onChange={(e) => setRawDraw(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">2 (Away)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={rawAway}
                      onChange={(e) => setRawAway(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[10px]">
                  <span className="text-slate-400 font-bold">Your Target:</span>
                  {(['Home (1)', 'Draw (X)', 'Away (2)'] as const).map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSelectedWay(idx as 0 | 1 | 2)}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer border ${
                        selectedWay === idx
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="text-[9px] font-mono text-slate-500 ml-auto">
                    Margin: {devigMargin}% • z: {devigZ}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Results Display Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {/* CLV */}
            <div className={`p-3 rounded-2xl border ${
              clvPercent > 0
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                CLV Edge %
              </div>
              <div className={`text-xl font-mono font-black mt-1 ${
                clvPercent > 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {clvPercent > 0 ? `+${clvPercent}%` : `${clvPercent}%`}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                vs Fair {fairOdds.toFixed(2)}
              </div>
            </div>

            {/* EV */}
            <div className={`p-3 rounded-2xl border ${
              evPercent > 0
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Expected Value (EV)
              </div>
              <div className={`text-xl font-mono font-black mt-1 ${
                evPercent > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {evPercent > 0 ? `+${evPercent.toFixed(1)}%` : `${evPercent.toFixed(1)}%`}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                P(Win): {(modelProb * 100).toFixed(1)}%
              </div>
            </div>

            {/* Kelly Recommended Stake */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Kelly Stake
              </div>
              <div className="text-xl font-mono font-black text-white mt-1">
                {sym}{kelly.stakeNGN.toLocaleString()}
              </div>
              <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
                {isPositiveEV ? `${kelly.stakePercent.toFixed(1)}% Bankroll` : '0% (Pass)'}
              </div>
            </div>

            {/* Projected Net Profit */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Projected Profit
              </div>
              <div className={`text-xl font-mono font-black mt-1 ${
                netProfit > 0 ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {netProfit > 0 ? `+${sym}${netProfit.toLocaleString()}` : `${sym}0`}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                Returns {sym}{projectedReturn.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Mathematical Verdict Badge */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono ${
            clvPercent > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {clvPercent > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-bold">
                {clvPercent > 0
                  ? `🟢 Beats Sharp Benchmark (+${(parsedBookOdds - fairOdds).toFixed(2)}) • Pure Price Edge!`
                  : `🔴 Sub-Zero Edge: Retail odds (${parsedBookOdds}) below sharp fair price (${fairOdds.toFixed(2)})`}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Shin Implied Fair: {fairOdds.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 transition cursor-pointer"
            >
              Close
            </button>

            <button
              type="submit"
              disabled={loggedSuccess}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer ${
                loggedSuccess
                  ? 'bg-emerald-400 text-slate-950 font-black'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              {loggedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Logged to Ledger!</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  <span>+ Log Directly to Ledger ({sym}{kelly.stakeNGN > 0 ? kelly.stakeNGN : 200})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
