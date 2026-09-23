import React, { useState } from 'react';
import { Sparkles, Copy, Check, Info, Flame, Shield, LayoutGrid, Table2, Filter } from 'lucide-react';
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
  const [showAllMarkets, setShowAllMarkets] = useState(false);

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

  // Evaluate whether each opportunity satisfies the selected strategy
  const opportunitiesWithStatus = allOpportunities.map(o => {
    const meetsProb = o.modelProb >= strategy.minProb || riskMode !== 'safe';
    const meetsEV = o.evPercent >= strategy.minEV;
    const qualifies = meetsProb && meetsEV;
    return {
      ...o,
      qualifies,
      filterReason: !meetsProb
        ? `Model Prob ${(o.modelProb * 100).toFixed(1)}% < ${Math.round(strategy.minProb * 100)}% SAFE floor`
        : !meetsEV
        ? `EV +${o.evPercent}% < +${strategy.minEV}% min threshold`
        : null
    };
  });

  const qualifyingOpportunities = opportunitiesWithStatus.filter(o => o.qualifies);
  const qualifyingProps = qualifyingOpportunities.filter(o => o.type === 'PROPS');
  const qualifyingMatches = qualifyingOpportunities.filter(o => o.type === 'MATCH');

  const displayedOpportunities = (showAllMarkets ? opportunitiesWithStatus : qualifyingOpportunities).filter(o => {
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

          <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filter === 'ALL' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                All ({showAllMarkets ? allOpportunities.length : qualifyingOpportunities.length})
              </button>
              <button
                onClick={() => setFilter('MATCH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filter === 'MATCH' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                Match Lines ({showAllMarkets ? matchMarkets.length : qualifyingMatches.length})
              </button>
              <button
                onClick={() => setFilter('PROPS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filter === 'PROPS' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                Props ({showAllMarkets ? playerPropMarkets.length : qualifyingProps.length})
              </button>
            </div>
          </div>
        </div>

        {/* Strategy Context & Filter Toggle Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Showing <strong className="text-slate-200">{displayedOpportunities.length}</strong> {showAllMarkets ? 'total market opportunities' : `opportunities meeting ${strategy.name} threshold`} (from {matches.length} matches).
            </span>
          </div>

          <button
            onClick={() => setShowAllMarkets(!showAllMarkets)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
              showAllMarkets
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Filter className="w-3 h-3" />
            {showAllMarkets ? 'Switch to Strategy-Filtered Only' : `View All ${allOpportunities.length} Opportunities (${allOpportunities.length - qualifyingOpportunities.length} in other modes)`}
          </button>
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
                  <th style={{ textAlign: 'right' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Kelly Stake</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedOpportunities.map(opt => (
                  <tr key={opt.id} onClick={() => onSelectMatch(opt.match)} className={!opt.qualifies ? 'opacity-60 bg-slate-950/40' : ''}>
                    <td className="col-match">{opt.title}</td>
                    <td className="col-selection">{opt.selection}</td>
                    <td className="col-odds" style={{ textAlign: 'right' }}>{opt.sportyBetOdds.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{opt.pinnacleOdds.toFixed(2)}</td>
                    <td className="col-prob" style={{ textAlign: 'right' }}>{(opt.modelProb * 100).toFixed(1)}%</td>
                    <td className="col-ev" style={{ textAlign: 'right' }}>+{opt.evPercent.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', fontSize: 10, fontFamily: 'monospace' }}>
                      {opt.qualifies ? (
                        <span className="text-emerald-400 font-bold">✓ Active</span>
                      ) : (
                        <span className="text-amber-400">Locked ({opt.filterReason})</span>
                      )}
                    </td>
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
          {displayedOpportunities.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No signals match current strategy filters. Switch to <strong>VALUE</strong> or <strong>RISKY</strong> mode above.
            </div>
          )}
        </div>
      )}

      {/* ===== CARDS VIEW ===== */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayedOpportunities.map(opt => (
            <div
              key={opt.id}
              className={`glass-card p-6 flex flex-col justify-between gap-5 relative overflow-hidden transition-all ${
                !opt.qualifies ? 'border-dashed border-amber-500/30 opacity-75 bg-slate-950/40' : ''
              }`}
            >
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

                {/* Sub-qualification banner if showing all */}
                {!opt.qualifies && (
                  <div className="mb-3 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono flex items-center justify-between">
                    <span>⚠️ Below {strategy.name} threshold: {opt.filterReason}</span>
                    <span className="font-bold underline cursor-pointer">Unlocked in VALUE mode</span>
                  </div>
                )}

                {/* Match title */}
                <h3 className="text-sm font-bold text-slate-300 mb-1">
                  {opt.title}
                </h3>
                <div className="text-lg font-black text-slate-100 mb-4 flex items-center justify-between">
                  <span>{opt.selection}</span>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {opt.type === 'PROPS' ? 'PLAYER PROP' : 'MATCH MARKET'}
                  </span>
                </div>

                {/* Quantitative Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SportyBet Odds</span>
                    <span className="text-sm font-mono font-black text-slate-200">{opt.sportyBetOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pinnacle Fair</span>
                    <span className="text-sm font-mono font-black text-slate-400">{opt.pinnacleOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model Prob</span>
                    <span className="text-sm font-mono font-black text-fpl-green">{(opt.modelProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Confidence</span>
                    <span className="text-sm font-mono font-black text-cyan-400">{(opt.modelProb * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Staking Recommendation */}
                <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 px-3.5 py-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-fpl-green" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">
                        Recommended Stake ({strategy.name}):
                      </div>
                      <div className="text-xs font-mono font-black text-slate-100">
                        ₦{opt.stakeNGN.toLocaleString()} NGN
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          (Returns ₦{Math.round(opt.stakeNGN * opt.sportyBetOdds).toLocaleString()})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-mono text-slate-400">
                      Kelly: {(strategy.kellyMultiplier).toFixed(2)}x
                    </div>
                    <div className="text-[9px] font-mono text-emerald-400 font-bold">
                      {(strategy.maxStakePercent * 100).toFixed(1)}% Bankroll
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => onSelectMatch(opt.match)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  Detailed Model Breakdown
                </button>

                <button
                  onClick={() => handleCopySignal(opt)}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    copiedId === opt.id
                      ? 'bg-fpl-green text-slate-950 shadow-[0_0_15px_rgba(0,255,135,0.4)]'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {copiedId === opt.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Signal
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {displayedOpportunities.length === 0 && (
        <div className="glass-card p-12 text-center space-y-3">
          <Shield className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">
            No Opportunities Meet the Strict {strategy.name} Gate
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {strategy.justification}
          </p>
          <div className="pt-2">
            <button
              onClick={() => setShowAllMarkets(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              View All {allOpportunities.length} Market Opportunities
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
