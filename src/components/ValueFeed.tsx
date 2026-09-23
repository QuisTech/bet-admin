import React, { useState } from 'react';
import { Sparkles, Copy, Check, Info, Flame, Shield, LayoutGrid, Table2 } from 'lucide-react';
import type { MatchData, BankrollConfig } from '../types';
import { STRATEGY_MODES } from '../models/strategyMode';

interface ValueFeedProps {
  matches: MatchData[];
  config: BankrollConfig;
  onSelectMatch: (match: MatchData) => void;
  riskMode: 'safe' | 'risky' | 'value';
}

export const ValueFeed: React.FC<ValueFeedProps> = ({ matches, config, onSelectMatch, riskMode }) => {
  const [filter, setFilter] = useState<'ALL' | 'PROPS' | 'MATCH'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'terminal'>('cards');

  const strategy = STRATEGY_MODES[riskMode];

  const matchMarkets = matches.flatMap(m =>
    m.markets.map(mk => {
      const stakePct = strategy.maxStakePercent;
      return {
        match: m,
        type: 'MATCH' as const,
        id: `${m.id}-${mk.marketType}-${mk.selection}`,
        title: `${m.homeTeam} vs ${m.awayTeam}`,
        selection: `${mk.selection} (${mk.marketType})`,
        sportyBetOdds: mk.sportyBetOdds,
        pinnacleOdds: mk.pinnacleOdds,
        modelProb: mk.ensembleProb,
        evPercent: mk.evPercent,
        recommendedStakePercent: stakePct,
        stakeNGN: Math.round(config.totalBankrollNGN * stakePct)
      };
    })
  );

  const playerPropMarkets = matches.flatMap(m =>
    m.playerProps.map(p => {
      const stakePct = strategy.maxStakePercent;
      return {
        match: m,
        type: 'PROPS' as const,
        id: p.id,
        title: `${p.playerName} (${p.team})`,
        selection: `${p.propType === 'GOAL' ? 'Anytime Goalscorer' : p.propType === 'SOT' ? `Over ${p.threshold || 1.5} Shots on Target` : 'To Assist'} vs ${p.opponent}`,
        sportyBetOdds: p.sportyBetOdds,
        pinnacleOdds: p.pinnacleFairOdds,
        modelProb: p.modelProb,
        evPercent: p.evPercent,
        recommendedStakePercent: stakePct,
        stakeNGN: Math.round(config.totalBankrollNGN * stakePct)
      };
    })
  );

  const allOpportunities = [...matchMarkets, ...playerPropMarkets].sort((a, b) => b.evPercent - a.evPercent);

  const filteredOpportunities = allOpportunities.filter(o => {
    if (o.modelProb < strategy.minProb && riskMode === 'safe') return false;
    if (o.evPercent < strategy.minEV) return false;
    if (filter === 'PROPS') return o.type === 'PROPS';
    if (filter === 'MATCH') return o.type === 'MATCH';
    return true;
  });

  const handleCopySignal = (opt: typeof allOpportunities[0]) => {
    const text = `🎯 BET HORIZON +EV SIGNAL\nMatch: ${opt.title}\nSelection: ${opt.selection}\nSportyBet Odds: ${opt.sportyBetOdds.toFixed(2)}\nModel Fair Prob: ${(opt.modelProb * 100).toFixed(1)}%\nEdge: +${opt.evPercent}%\nStrategy: ${strategy.name}\nRecommended Stake: ₦${opt.stakeNGN.toLocaleString()} NGN`;
    navigator.clipboard.writeText(text);
    setCopiedId(opt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-fpl-green/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
              <h2 className="text-lg font-black text-slate-100">Live Price Mismatch (+EV) Bargain Feed</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${strategy.badgeClass}`}>
                {strategy.name}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Scanned across FPL API, XGBoost Prop Regressors, Dixon-Coles Matrices, and Pinnacle De-Vigged Odds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="view-toggle">
              <button
                onClick={() => setViewMode('cards')}
                className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              >
                <LayoutGrid style={{ width: 14, height: 14 }} />
                Cards
              </button>
              <button
                onClick={() => setViewMode('terminal')}
                className={`view-toggle-btn ${viewMode === 'terminal' ? 'active' : ''}`}
              >
                <Table2 style={{ width: 14, height: 14 }} />
                Terminal
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                  filter === 'ALL' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                All ({allOpportunities.length})
              </button>
              <button
                onClick={() => setFilter('PROPS')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                  filter === 'PROPS' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                Props ({playerPropMarkets.length})
              </button>
              <button
                onClick={() => setFilter('MATCH')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                  filter === 'MATCH' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                Match ({matchMarkets.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== QUANT TERMINAL TABLE VIEW ===== */}
      {viewMode === 'terminal' && (
        <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="quant-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Selection</th>
                  <th style={{ textAlign: 'right' }}>SportyBet</th>
                  <th style={{ textAlign: 'right' }}>Pinnacle</th>
                  <th style={{ textAlign: 'right' }}>Model Prob</th>
                  <th style={{ textAlign: 'right' }}>+EV%</th>
                  <th style={{ textAlign: 'right' }}>Kelly Stake</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.map(opt => (
                  <tr key={opt.id} onClick={() => onSelectMatch(opt.match)}>
                    <td className="col-match">{opt.title}</td>
                    <td className="col-selection">{opt.selection}</td>
                    <td className="col-odds" style={{ textAlign: 'right' }}>{opt.sportyBetOdds.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{opt.pinnacleOdds.toFixed(2)}</td>
                    <td className="col-prob" style={{ textAlign: 'right' }}>{(opt.modelProb * 100).toFixed(1)}%</td>
                    <td className="col-ev" style={{ textAlign: 'right' }}>+{opt.evPercent.toFixed(1)}%</td>
                    <td className="col-stake" style={{ textAlign: 'right' }}>₦{opt.stakeNGN.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopySignal(opt); }}
                        style={{
                          background: copiedId === opt.id ? 'var(--color-fpl-green)' : 'var(--bg-elevated)',
                          color: copiedId === opt.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'Inter, sans-serif',
                          transition: 'all 150ms',
                        }}
                      >
                        {copiedId === opt.id ? '✓' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredOpportunities.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No signals match current strategy filters.
            </div>
          )}
        </div>
      )}

      {/* ===== CARDS VIEW ===== */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredOpportunities.map(opt => (
            <div key={opt.id} className="glass-card p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
              <div>
                {/* Header Info */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-950 px-2.5 py-1 rounded">
                    {opt.match.league} • {opt.match.kickoff}
                  </span>
                  <span className="text-xs font-black px-3 py-1 rounded-full badge-ev flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-fpl-green" />
                    +{opt.evPercent}% EV Edge
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-100 mb-1 tracking-tight">{opt.title}</h3>
                <p className="text-sm font-bold text-fpl-green mb-4">{opt.selection}</p>

                {/* Odds & Model Comparison Table */}
                <div className="bg-slate-950/90 rounded-xl p-3 mb-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-slate-900/60">
                      <div className="text-[9px] uppercase font-bold text-slate-400">SportyBet Odds</div>
                      <div className="text-base font-black text-amber-400 font-mono">{opt.sportyBetOdds.toFixed(2)}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Pinnacle Fair Odds</div>
                      <div className="text-base font-black text-slate-300 font-mono">{opt.pinnacleOdds.toFixed(2)}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Model Fair Prob</div>
                      <div className="text-base font-black text-sky-400 font-mono">{(opt.modelProb * 100).toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Model Probability Visual Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>Model Confidence</span>
                      <span className="text-fpl-green font-mono">{(opt.modelProb * 100).toFixed(1)}%</span>
                    </div>
                    <div className="prob-bar-container">
                      <div
                        className="prob-bar-fill"
                        style={{ width: `${Math.min(100, opt.modelProb * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stake Calculation & Action Button Box */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-fpl-green" />
                    Recommended Stake ({strategy.name}):
                  </div>
                  <div className="text-base font-black text-fpl-green mt-0.5 font-mono">
                    ₦{opt.stakeNGN.toLocaleString()} NGN
                    <span className="text-xs font-medium text-slate-400 ml-1.5">
                      (Returns ₦{Math.round(opt.stakeNGN * opt.sportyBetOdds).toLocaleString()})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectMatch(opt.match)}
                    className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
                    title="Inspect Model Diagnostics"
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopySignal(opt)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fpl-green hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-fpl-green/20"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    {copiedId === opt.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Signal
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
