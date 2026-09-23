import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Info,
  Flame,
  Shield,
  LayoutGrid,
  Table2,
  Filter,
  GitCompare,
} from 'lucide-react';
import type { MatchData, BankrollConfig, ModelPipelineMode } from '../types';
import { STRATEGY_MODES } from '../models/strategyMode';
import { evaluateOpportunities, type OpportunityItem } from '../models/opportunityEngine';

interface ValueFeedProps {
  matches: MatchData[];
  config: BankrollConfig;
  onSelectMatch: (match: MatchData) => void;
  riskMode: 'safe' | 'risky' | 'value';
  pipelineFilter?: ModelPipelineMode;
  onPipelineFilterChange?: (mode: ModelPipelineMode) => void;
  onOpenEvolution?: (league: string) => void;
}

export const ValueFeed: React.FC<ValueFeedProps> = ({
  matches,
  config,
  onSelectMatch,
  riskMode,
  pipelineFilter: propsPipelineFilter,
  onPipelineFilterChange,
  onOpenEvolution,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PROPS' | 'MATCH'>('ALL');
  const [internalPipelineFilter, setInternalPipelineFilter] =
    useState<ModelPipelineMode>('ALL_CONSENSUS');
  const pipelineFilter = propsPipelineFilter ?? internalPipelineFilter;
  const setPipelineFilter = onPipelineFilterChange ?? setInternalPipelineFilter;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'terminal'>('cards');
  const [showAllMarkets, setShowAllMarkets] = useState(false);

  const strategy = STRATEGY_MODES[riskMode];
  const currSym = config.currency === 'USD' ? '$' : '₦';

  const slateStats = useMemo(() => {
    return evaluateOpportunities(matches, config, pipelineFilter, riskMode);
  }, [matches, config, pipelineFilter, riskMode]);

  const { allOpportunities, qualifyingOpportunities, qualifyingMatches, qualifyingProps } =
    slateStats;

  const matchMarkets = useMemo(
    () => allOpportunities.filter((o) => o.type === 'MATCH'),
    [allOpportunities]
  );
  const playerPropMarkets = useMemo(
    () => allOpportunities.filter((o) => o.type === 'PROPS'),
    [allOpportunities]
  );

  const displayedOpportunities = (
    showAllMarkets ? allOpportunities : qualifyingOpportunities
  ).filter((o) => {
    if (filter === 'PROPS') return o.type === 'PROPS';
    if (filter === 'MATCH') return o.type === 'MATCH';
    return true;
  });

  const handleCopySignal = (opt: OpportunityItem) => {
    if (opt.evPercent <= 0) return;
    const text = `🎯 BET HORIZON +EV SIGNAL\nMatch: ${opt.title}\nSelection: ${
      opt.selection
    }\nSportyBet Odds: ${opt.sportyBetOdds.toFixed(2)}\nPipeline 1 (Domain): ${(
      opt.domainProb * 100
    ).toFixed(1)}%\nPipeline 2 (Trained ML): ${(opt.trainedMlProb * 100).toFixed(
      1
    )}%\nDual Consensus: ${(opt.consensusProb * 100).toFixed(1)}%\nEdge: ${
      opt.evPercent > 0 ? '+' : ''
    }${opt.evPercent}%\nStrategy: ${strategy.name}\nRecommended Stake: ${currSym}${opt.stakeAmount.toLocaleString()} ${
      config.currency
    }`;
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
              <h2 className="text-lg font-black text-slate-100">
                Live Dual-Pipeline (+EV) Bargain Feed
              </h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${strategy.badgeClass}`}>
                {strategy.name}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Comparing <strong>Pipeline 1 (Domain Ensemble)</strong> vs{' '}
              <strong>Pipeline 2 (Offline Trained XGBoost ML)</strong> across Pinnacle de-vigged market lines.
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
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filter === 'ALL'
                    ? 'bg-fpl-green text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                All ({showAllMarkets ? allOpportunities.length : qualifyingOpportunities.length})
              </button>
              <button
                onClick={() => setFilter('MATCH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filter === 'MATCH'
                    ? 'bg-fpl-green text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                Match Lines ({showAllMarkets ? matchMarkets.length : qualifyingMatches.length})
              </button>
              <button
                onClick={() => setFilter('PROPS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filter === 'PROPS'
                    ? 'bg-fpl-green text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                Props ({showAllMarkets ? playerPropMarkets.length : qualifyingProps.length})
              </button>
            </div>
          </div>
        </div>

        {/* Dual Pipeline Selector Row */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              Model View:
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setPipelineFilter('ALL_CONSENSUS')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition ${
                  pipelineFilter === 'ALL_CONSENSUS'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ Dual Consensus (Both Agree)
              </button>
              <button
                onClick={() => setPipelineFilter('DOMAIN_ONLY')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition ${
                  pipelineFilter === 'DOMAIN_ONLY'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏛️ Domain Ensemble (P1)
              </button>
              <button
                onClick={() => setPipelineFilter('TRAINED_ML_ONLY')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition ${
                  pipelineFilter === 'TRAINED_ML_ONLY'
                    ? 'bg-purple-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🤖 Trained XGBoost (P2)
              </button>
            </div>
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
            {showAllMarkets
              ? 'Switch to Strategy-Filtered Only'
              : `View All ${allOpportunities.length} Opportunities (${
                  allOpportunities.length - qualifyingOpportunities.length
                } in other modes)`}
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
                  <th style={{ textAlign: 'right' }}>Domain P1</th>
                  <th style={{ textAlign: 'right' }}>XGBoost P2</th>
                  <th style={{ textAlign: 'right' }}>Consensus</th>
                  <th style={{ textAlign: 'right' }}>Consensus Spread</th>
                  <th style={{ textAlign: 'right' }}>+EV%</th>
                  <th style={{ textAlign: 'right' }}>Kelly Stake</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedOpportunities.map((opt) => (
                  <tr
                    key={opt.id}
                    onClick={() => onSelectMatch(opt.match)}
                    className={!opt.qualifies ? 'opacity-60 bg-slate-950/40' : ''}
                  >
                    <td className="col-match">{opt.title}</td>
                    <td className="col-selection">{opt.selection}</td>
                    <td className="col-odds" style={{ textAlign: 'right' }}>
                      {opt.sportyBetOdds.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#38bdf8', fontFamily: 'monospace' }}>
                      {(opt.domainProb * 100).toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', color: '#c084fc', fontFamily: 'monospace' }}>
                      {(opt.trainedMlProb * 100).toFixed(1)}%
                    </td>
                    <td className="col-prob" style={{ textAlign: 'right' }}>
                      <div className="font-bold text-emerald-400">
                        {(opt.consensusProb * 100).toFixed(1)}%
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        🧬 {Math.round((opt.domainWeight ?? 0.5) * 100)}/{Math.round((opt.mlWeight ?? 0.5) * 100)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 10, fontFamily: 'monospace' }}>
                      {opt.consensusLevel === 'STRONG_AGREEMENT' ? (
                        <span className="text-emerald-400 font-bold">
                          ✓ Strong (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                        </span>
                      ) : opt.consensusLevel === 'MODERATE' ? (
                        <span className="text-amber-400">
                          Moderate (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-red-400 font-bold">
                          Divergence (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="col-ev" style={{ textAlign: 'right' }}>
                      {opt.evPercent > 0
                        ? `+${opt.evPercent.toFixed(1)}%`
                        : `${opt.evPercent.toFixed(1)}%`}
                    </td>
                    <td className="col-stake" style={{ textAlign: 'right' }}>
                      {currSym}
                      {opt.stakeAmount.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopySignal(opt);
                        }}
                        disabled={opt.evPercent <= 0}
                        className="btn-primary"
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          opacity: opt.evPercent <= 0 ? 0.3 : 1,
                        }}
                      >
                        {copiedId === opt.id ? 'Copied!' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CARD GRID VIEW ===== */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedOpportunities.map((opt) => (
            <div
              key={opt.id}
              className={`glass-card p-5 relative overflow-hidden transition-all duration-200 ${
                !opt.qualifies
                  ? 'opacity-60 border-slate-800/40 bg-slate-950/40 hover:opacity-100'
                  : 'hover:border-slate-700/80 hover:shadow-lg'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-400">
                      {opt.match.league} • {opt.match.kickoff}
                    </span>
                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                        opt.evPercent > 0 ? 'badge-ev' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {opt.evPercent > 0 ? `+${opt.evPercent}%` : `${opt.evPercent}%`} EV Edge
                    </div>
                  </div>

                  {/* Sub-qualification banner if showing all */}
                  {!opt.qualifies && (
                    <div className="mb-3 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono flex items-center justify-between">
                      <span>
                        ⚠️ Below {strategy.name} threshold: {opt.filterReason}
                      </span>
                      <span
                        className="font-bold underline cursor-pointer"
                        onClick={() => setShowAllMarkets(true)}
                      >
                        Unlocked in VALUE mode
                      </span>
                    </div>
                  )}

                  {/* Match title */}
                  <h3 className="text-sm font-bold text-slate-300 mb-1">{opt.title}</h3>
                  <div className="text-lg font-black text-slate-100 mb-3 flex items-center justify-between">
                    <span>{opt.selection}</span>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                      {opt.type === 'PROPS' ? 'PLAYER PROP' : 'MATCH MARKET'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantitative Section */}
              <div className="space-y-3 mb-4">
                {/* DUAL-PIPELINE COMPARISON BAR */}
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Domain Ensemble (P1):</span>
                    <span className="font-bold text-cyan-400">
                      {(opt.domainProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Trained XGBoost (P2):</span>
                    <span className="font-bold text-purple-400">
                      {(opt.trainedMlProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-300">Consensus Blend:</span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/50 flex items-center gap-1">
                        🧬 {Math.round((opt.domainWeight ?? 0.5) * 100)}% / {Math.round((opt.mlWeight ?? 0.5) * 100)}% Evolved
                      </span>
                    </div>
                    <span className="font-black text-fpl-green">
                      {(opt.consensusProb * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-slate-500">Pipeline Spread:</span>
                    {opt.consensusLevel === 'STRONG_AGREEMENT' ? (
                      <span className="text-emerald-400 font-bold">
                        ✓ Strong Agreement (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                      </span>
                    ) : opt.consensusLevel === 'MODERATE' ? (
                      <span className="text-amber-400">
                        Moderate Spread (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold">
                        ⚠ Divergence Alert (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>

                  {/* Evolutionary strategy deep-link */}
                  {onOpenEvolution && (
                    <div className="pt-1.5 border-t border-slate-900 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEvolution(opt.match.league);
                        }}
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
                        title="Tune and evolve machine learning consensus weights for this league"
                      >
                        <span>🧬 Tune {opt.match.league} Weights</span>
                        <span>↗</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Quantitative Odds & Fair Pricing Grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      SportyBet Odds
                    </span>
                    <span className="text-base font-mono font-black text-slate-100">
                      {opt.sportyBetOdds.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Pinnacle Fair
                    </span>
                    <span className="text-base font-mono font-black text-slate-300">
                      {opt.pinnacleOdds.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Active Model
                    </span>
                    <span className="text-base font-mono font-black text-fpl-green">
                      {(opt.modelProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Fair Odds
                    </span>
                    <span className="text-base font-mono font-black text-cyan-400">
                      {(1 / Math.max(0.01, opt.modelProb)).toFixed(2)}
                    </span>
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
                        {currSym}{opt.stakeAmount.toLocaleString()} {config.currency}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          (Returns {currSym}
                          {Math.round(opt.stakeAmount * opt.sportyBetOdds).toLocaleString()})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-mono text-slate-400">
                      Kelly: {strategy.kellyMultiplier.toFixed(2)}x
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
                  disabled={opt.evPercent <= 0}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                    opt.evPercent <= 0
                      ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                      : copiedId === opt.id
                      ? 'bg-fpl-green text-slate-950 shadow-[0_0_15px_rgba(0,255,135,0.4)] cursor-pointer'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
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
          <p className="text-xs text-slate-500 max-w-md mx-auto">{strategy.justification}</p>
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
