import React from 'react';
import { X, Sparkles, Cpu, ShieldCheck } from 'lucide-react';
import type { MatchData, BankrollConfig } from '../types';

interface MatchModalProps {
  match: MatchData | null;
  config: BankrollConfig;
  onClose: () => void;
}

export const MatchModal: React.FC<MatchModalProps> = ({ match, config, onClose }) => {
  if (!match) return null;

  const sym = config.currency === 'USD' ? '$' : '₦';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card max-w-2xl w-full p-6 bg-slate-900/95 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Header */}
        <div className="mb-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            {match.league} • {match.kickoff}
          </div>
          <h2 className="text-xl font-extrabold text-slate-100">
            {match.homeTeam} vs {match.awayTeam}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
            <span>Expected Goals (xG): <strong className="text-fpl-green">{match.homeXG}</strong> - <strong className="text-sky-400">{match.awayXG}</strong></span>
          </div>
        </div>

        {/* Markets Section */}
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-fpl-green" />
            Evaluated Markets & Model Inputs
          </h3>

          <div className="space-y-3">
            {match.markets.map((mk, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-400">{mk.marketType}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-100">{mk.selection}</div>
                    {mk.evPercent >= 8 && mk.ensembleProb >= 0.20 ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                        ✓ Value Qualified
                      </span>
                    ) : mk.ensembleProb < 0.20 ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                        ⚠ Extreme Longshot ({(mk.ensembleProb * 100).toFixed(1)}% Prob)
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    SportyBet Odds: <strong className="text-amber-400">{mk.sportyBetOdds.toFixed(2)}</strong> | Model Prob: <strong className="text-sky-400">{(mk.ensembleProb * 100).toFixed(1)}%</strong>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block px-2.5 py-0.5 rounded-full badge-ev text-xs font-bold mb-1">
                    +{mk.evPercent}% EV Edge
                  </div>
                  <div className="text-xs text-slate-300 font-semibold">
                    Stake: <strong className="text-fpl-green">{sym}{Math.round(config.totalBankrollNGN * mk.recommendedStakePercent).toLocaleString()} {config.currency}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Player Props Section */}
        {match.playerProps.length > 0 && (
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-sky-400" />
              XGBoost Player Prop Breakdown
            </h3>

            <div className="space-y-3">
              {match.playerProps.map(prop => (
                <div key={prop.id} className="p-4 rounded-xl bg-slate-950/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-100">{prop.playerName} ({prop.team})</div>
                    <div className="text-xs font-semibold text-fpl-green">
                      {prop.propType === 'GOAL' ? 'Anytime Goalscorer' : prop.propType === 'SOT' ? `Over ${prop.threshold || 1.5} Shots on Target` : 'To Assist'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      xG/90: {prop.xG90} | xA/90: {prop.xA90} | Expected Mins: {prop.xMins}m
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">{prop.sportyBetOdds.toFixed(2)} Odds</div>
                    <div className="text-xs text-sky-400 font-bold">{(prop.modelProb * 100).toFixed(1)}% Prob</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Quant Ensemble Checked
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
