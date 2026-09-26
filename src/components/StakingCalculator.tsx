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
  const [activeMarketIndex, setActiveMarketIndex] = useState(marketIndex);
  const [kellyFraction, setKellyFraction] = useState(config.kellyFraction);
  const [copied, setCopied] = useState(false);
  const [liveOddsInput, setLiveOddsInput] = useState<Record<number, string>>({});

  React.useEffect(() => {
    setActiveMarketIndex(marketIndex);
  }, [marketIndex]);

  const sym = config.currency === 'USD' ? '$' : '₦';

  if (!match) return null;

  const market = match.markets[activeMarketIndex] || match.markets[0];
  if (!market) return null;

  const enteredOddsStr = liveOddsInput[activeMarketIndex];
  const customOdds = enteredOddsStr && parseFloat(enteredOddsStr) > 1.0 ? parseFloat(enteredOddsStr) : null;
  const currentOdds = customOdds ?? market.sportyBetOdds;
  const isCustomOdds = customOdds !== null && customOdds !== market.sportyBetOdds;

  const impliedProb = 1 / currentOdds;
  const modelProb = market.consensusProb ?? market.ensembleProb;
  const edge = modelProb - impliedProb;

  const customConfig = { ...config, kellyFraction };
  const kelly = calculateKellyStake(modelProb, currentOdds, customConfig);
  const evPct = calculateEV(modelProb, currentOdds);
  const isPositiveEV = evPct > 0;
  const projectedReturn = Math.round(kelly.stakeNGN * currentOdds);
  const netProfit = projectedReturn - kelly.stakeNGN;

  const formattedEv = evPct >= 0 ? `+${evPct.toFixed(1)}%` : `${evPct.toFixed(1)}%`;
  const formattedEdge = edge >= 0 ? `+${(edge * 100).toFixed(1)}%` : `${(edge * 100).toFixed(1)}%`;

  const handleCopy = () => {
    const text = `🎯 BET HORIZON QUANT EVALUATION\nMatch: ${match.homeTeam} vs ${match.awayTeam}\nLeague: ${match.league}\nSelection: ${market.selection} (${market.marketType})\nOdds: ${currentOdds.toFixed(2)}${isCustomOdds ? ` (Adjusted from feed ${market.sportyBetOdds.toFixed(2)})` : ''}\nModel Fair Prob: ${(modelProb * 100).toFixed(1)}%\nEdge: ${formattedEv}\nKelly Recommendation: ${isPositiveEV ? `${sym}${kelly.stakeNGN.toLocaleString()} ${config.currency}` : `${sym}0 (Pass / Negative EV)`}`;
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

          {/* Market Switcher Tabs */}
          {match.markets && match.markets.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-3 mb-2">
              {match.markets.map((m, idx) => {
                const mEv = m.evPercent ?? calculateEV(m.ensembleProb, m.sportyBetOdds);
                const isAct = idx === activeMarketIndex;
                return (
                  <button
                    key={`${m.selection}-${idx}`}
                    onClick={() => setActiveMarketIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isAct
                        ? 'bg-slate-800 text-white border-slate-600 shadow-md'
                        : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:bg-slate-900'
                    }`}
                  >
                    <span>{m.selection}</span>
                    <span
                      className={`text-[10px] font-mono font-black ${
                        mEv > 0 ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {mEv > 0 ? `+${mEv.toFixed(1)}%` : `${mEv.toFixed(1)}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

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

        {/* Interactive Live Odds Recalculator */}
        <div
          className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
            isCustomOdds
              ? 'bg-slate-950/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
              : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold text-slate-200">
              Test Current Bookmaker Odds:
            </span>
            {isCustomOdds && (
              <button
                onClick={() => {
                  const next = { ...liveOddsInput };
                  delete next[activeMarketIndex];
                  setLiveOddsInput(next);
                }}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
              >
                Reset to {market.sportyBetOdds.toFixed(2)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.01"
                min="1.01"
                max="100"
                value={liveOddsInput[activeMarketIndex] ?? ''}
                placeholder={`Enter odds on your book (feed: ${market.sportyBetOdds.toFixed(2)})`}
                onChange={(e) => {
                  setLiveOddsInput({
                    ...liveOddsInput,
                    [activeMarketIndex]: e.target.value,
                  });
                }}
                className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white placeholder:text-slate-500 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 pointer-events-none">
                ODDS
              </span>
            </div>
            <div className="flex flex-col text-right shrink-0">
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                {isCustomOdds ? 'Adjusted EV' : 'Live EV'}
              </span>
              <span
                className={`text-sm font-mono font-black ${
                  isPositiveEV ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formattedEv}
              </span>
            </div>
          </div>
        </div>

        {/* Odds & Model Comparison Cards */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/80 rounded-2xl border border-slate-800 text-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <span>Bookmaker Odds</span>
              {isCustomOdds && (
                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-mono font-bold">
                  TESTED
                </span>
              )}
            </div>
            <div className={`text-lg font-mono font-bold mt-0.5 ${isCustomOdds ? 'text-emerald-400' : 'text-white'}`}>
              {currentOdds.toFixed(2)}
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              {isCustomOdds ? `Feed: ${market.sportyBetOdds.toFixed(2)}` : `Implied: ${(impliedProb * 100).toFixed(1)}%`}
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
