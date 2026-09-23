import React, { useState } from 'react';
import { X, Copy, Check, Sliders, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { MatchData, BankrollConfig } from '../types';
import { calculateKellyStake, calculateEV } from '../models/evEngine';

interface StakingCalcProps {
  match: MatchData | null;
  marketIndex?: number;
  config: BankrollConfig;
  onClose: () => void;
}

export const StakingCalculator: React.FC<StakingCalcProps> = ({
  match,
  marketIndex = 0,
  config,
  onClose,
}) => {
  const [kellyFraction, setKellyFraction] = useState(config.kellyFraction);
  const [copied, setCopied] = useState(false);

  const sym = config.currency === 'USD' ? '$' : '₦';

  if (!match) return null;

  const market = match.markets[marketIndex] || match.markets[0];
  if (!market) return null;

  const impliedProb = 1 / market.sportyBetOdds;
  const modelProb = market.ensembleProb;
  const edge = modelProb - impliedProb;

  const customConfig = { ...config, kellyFraction };
  const kelly = calculateKellyStake(modelProb, market.sportyBetOdds, customConfig);
  const evPct = calculateEV(modelProb, market.sportyBetOdds);
  const isPositiveEV = evPct > 0;
  const projectedReturn = Math.round(kelly.stakeNGN * market.sportyBetOdds);
  const netProfit = projectedReturn - kelly.stakeNGN;

  const formattedEv = evPct >= 0 ? `+${evPct.toFixed(1)}%` : `${evPct.toFixed(1)}%`;
  const formattedEdge = edge >= 0 ? `+${(edge * 100).toFixed(1)}%` : `${(edge * 100).toFixed(1)}%`;

  const handleCopy = () => {
    const text = `🎯 BET HORIZON QUANT EVALUATION\nMatch: ${match.homeTeam} vs ${match.awayTeam}\nLeague: ${match.league}\nSelection: ${market.selection} (${market.marketType})\nOdds: ${market.sportyBetOdds.toFixed(2)}\nModel Fair Prob: ${(modelProb * 100).toFixed(1)}%\nEdge: ${formattedEv}\nKelly Recommendation: ${isPositiveEV ? `${sym}${kelly.stakeNGN.toLocaleString()} ${config.currency}` : `${sym}0 (Pass / Negative EV)`}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className={`glass-panel w-full max-w-xl rounded-3xl border ${isPositiveEV ? 'border-emerald-500/30 shadow-emerald-950/80' : 'border-rose-500/30 shadow-rose-950/80'} overflow-hidden shadow-2xl bg-slate-950/95 p-6 relative max-h-[92vh] overflow-y-auto space-y-5`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
            {match.league} • {match.kickoff}
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            {match.homeTeam} vs {match.awayTeam}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold text-slate-200 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              {market.selection} ({market.marketType})
            </span>
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
              isPositiveEV
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
            }`}>
              {formattedEv} EV
            </span>
          </div>
        </div>

        {/* Negative EV Warning Banner */}
        {!isPositiveEV && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-300">Negative Expected Value ({formattedEv} EV) — Pass / No Bet</div>
              <div className="text-[11px] text-rose-400/80 mt-0.5">
                The sportsbook is underpaying on this selection (offering {market.sportyBetOdds.toFixed(2)} vs fair price of {(1 / modelProb).toFixed(2)}).
                The Fractional Kelly solver protects your bankroll by recommending a <strong className="text-slate-200 font-mono">{sym}0 stake</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Odds & Model Comparison Cards */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/80 rounded-2xl border border-slate-800 text-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Bookmaker Odds</div>
            <div className="text-lg font-mono font-bold text-white mt-0.5">
              {market.sportyBetOdds.toFixed(2)}
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Implied: {(impliedProb * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Model Fair Odds</div>
            <div className={`text-lg font-mono font-bold mt-0.5 ${isPositiveEV ? 'text-emerald-400' : 'text-amber-400'}`}>
              {(1 / modelProb).toFixed(2)}
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Fair Prob: {(modelProb * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Net Edge</div>
            <div className={`text-lg font-mono font-bold mt-0.5 ${isPositiveEV ? 'text-cyan-400' : 'text-rose-400'}`}>
              {formattedEdge}
            </div>
            <div className="text-[9px] text-slate-500 font-mono">Edge vs Market</div>
          </div>
        </div>

        {/* Interactive Kelly Fraction Slider */}
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">Adjust Kelly Fraction</span>
            </div>
            <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {kellyFraction.toFixed(2)}×
            </span>
          </div>

          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={kellyFraction}
            onChange={(e) => setKellyFraction(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>0.10× (Conservative)</span>
            <span>0.50× (Half Kelly)</span>
            <span>1.00× (Full Kelly)</span>
          </div>
        </div>

        {/* Stake Calculation Results */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900/90 rounded-2xl border border-slate-800">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Recommended Stake</div>
            <div className={`text-xl font-mono font-bold mt-1 ${isPositiveEV ? 'text-white' : 'text-slate-500'}`}>
              {sym}{kelly.stakeNGN.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {isPositiveEV ? `${kelly.stakePercent.toFixed(1)}% of total bankroll` : '0.0% (Bankroll Protected)'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Projected Profit</div>
            <div className={`text-xl font-mono font-bold mt-1 ${isPositiveEV ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isPositiveEV ? `+${sym}${netProfit.toLocaleString()}` : `${sym}0 (No Bet)`}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Payout: {sym}{projectedReturn.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {isPositiveEV ? (
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Signal Copied to Clipboard!' : 'Copy +EV Signal'}</span>
            </button>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed"
            >
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>Negative EV Line (Pass / No Bet)</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
