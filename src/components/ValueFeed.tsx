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
  ArrowUpDown,
  Calculator,
  Target,
  BookmarkPlus,
} from 'lucide-react';
import type { MatchData, BankrollConfig, ModelPipelineMode } from '../types';
import { STRATEGY_MODES } from '../models/strategyMode';
import { evaluateOpportunities, type OpportunityItem } from '../models/opportunityEngine';
import { addLoggedBet } from '../services/ledgerService';

interface ValueFeedProps {
  matches: MatchData[];
  config: BankrollConfig;
  onSelectMatch: (match: MatchData, marketIndex?: number) => void;
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
  const getMarketIndexForOpt = (opt: OpportunityItem): number => {
    const rawSel = opt.selection.split(' (')[0];
    const idx = opt.match.markets.findIndex(
      (m) =>
        m.selection === opt.selection ||
        m.selection === rawSel ||
        opt.selection.startsWith(m.selection) ||
        m.selection.startsWith(rawSel)
    );
    return idx >= 0 ? idx : 0;
  };

  const [filter, setFilter] = useState<'ALL' | 'PROPS' | 'MATCH' | 'FAST_GREEN'>('ALL');
  const [internalPipelineFilter, setInternalPipelineFilter] =
    useState<ModelPipelineMode>('ALL_CONSENSUS');
  const pipelineFilter = propsPipelineFilter ?? internalPipelineFilter;
  const setPipelineFilter = onPipelineFilterChange ?? setInternalPipelineFilter;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'terminal'>('cards');
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [sortBy, setSortBy] = useState<
    'evDesc' | 'probDesc' | 'fastGreen' | 'agreementAsc' | 'returnDesc' | 'oddsAsc' | 'oddsDesc'
  >('evDesc');
  const [liveOddsInput, setLiveOddsInput] = useState<Record<string, string>>({});

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
  const fastGreenMarkets = useMemo(
    () => allOpportunities.filter((o) => o.modelProb >= 0.50),
    [allOpportunities]
  );
  const qualifyingFastGreen = useMemo(
    () => qualifyingOpportunities.filter((o) => o.modelProb >= 0.50),
    [qualifyingOpportunities]
  );

  const displayedOpportunities = useMemo(() => {
    const list = (showAllMarkets ? allOpportunities : qualifyingOpportunities).filter((o) => {
      if (filter === 'FAST_GREEN') return o.modelProb >= 0.50;
      if (filter === 'PROPS') return o.type === 'PROPS';
      if (filter === 'MATCH') return o.type === 'MATCH';
      return true;
    });

    return list.slice().sort((a, b) => {
      if (sortBy === 'fastGreen') {
        const isAHigh = a.modelProb >= 0.50 ? 1 : 0;
        const isBHigh = b.modelProb >= 0.50 ? 1 : 0;
        if (isAHigh !== isBHigh) return isBHigh - isAHigh;
        return b.evPercent - a.evPercent;
      }
      if (sortBy === 'evDesc') return b.evPercent - a.evPercent;
      if (sortBy === 'probDesc') return b.modelProb - a.modelProb;
      if (sortBy === 'agreementAsc') return a.modelDelta - b.modelDelta;
      if (sortBy === 'returnDesc') {
        const profitA = a.stakeAmount * (a.sportyBetOdds - 1);
        const profitB = b.stakeAmount * (b.sportyBetOdds - 1);
        return profitB - profitA;
      }
      if (sortBy === 'oddsAsc') return a.sportyBetOdds - b.sportyBetOdds;
      if (sortBy === 'oddsDesc') return b.sportyBetOdds - a.sportyBetOdds;
      return b.evPercent - a.evPercent;
    });
  }, [allOpportunities, qualifyingOpportunities, showAllMarkets, filter, sortBy]);

  const handleCopySignal = (
    opt: OpportunityItem,
    customOddsVal?: number,
    customEV?: number,
    customStake?: number
  ) => {
    const odds = customOddsVal ?? opt.sportyBetOdds;
    const ev = customEV ?? opt.evPercent;
    const stake = customStake ?? opt.stakeAmount;
    if (ev <= 0) return;
    const text = `🎯 BET HORIZON +EV SIGNAL\nMatch: ${opt.title}\nSelection: ${
      opt.selection
    }\nLive Odds: ${odds.toFixed(2)}${
      customOddsVal && customOddsVal !== opt.sportyBetOdds
        ? ` (Adjusted from feed ${opt.sportyBetOdds.toFixed(2)})`
        : ''
    }\nPipeline 1 (Domain): ${(opt.domainProb * 100).toFixed(1)}%\nPipeline 2 (Trained ML): ${(
      opt.trainedMlProb * 100
    ).toFixed(1)}%\nDual Consensus: ${(opt.consensusProb * 100).toFixed(1)}%\nEdge: ${
      ev > 0 ? '+' : ''
    }${ev}%\nStrategy: ${strategy.name}\nRecommended Stake: ${currSym}${stake.toLocaleString()} ${
      config.currency
    }`;
    navigator.clipboard.writeText(text);
    setCopiedId(opt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [loggedIds, setLoggedIds] = useState<Record<string, boolean>>({});

  const handleLogPosition = (
    opt: OpportunityItem,
    customOddsVal?: number,
    customEV?: number,
    customStake?: number
  ) => {
    const odds = customOddsVal ?? opt.sportyBetOdds;
    const ev = customEV ?? opt.evPercent;
    const stake = customStake ?? opt.stakeAmount;
    const pin = opt.pinnacleOdds > 1.0 ? opt.pinnacleOdds : odds;

    addLoggedBet({
      league: opt.match.league,
      match: `${opt.match.homeTeam} vs ${opt.match.awayTeam}`,
      selection: opt.selection,
      marketType: opt.type === 'PROPS' ? 'PLAYER_PROP' : '1X2',
      bookmaker: '1xBet',
      priceTaken: odds,
      pinnacleLineAtBet: pin,
      pinnacleClosingLine: pin,
      modelProb: opt.modelProb,
      modelEV: ev,
      stake: stake,
      payout: 0,
      outcome: 'OPEN',
      notes: `Logged from +EV Feed (${strategy.name} mode, EV ${ev > 0 ? '+' : ''}${ev.toFixed(1)}%)`,
    });

    setLoggedIds((prev) => ({ ...prev, [opt.id]: true }));
    setTimeout(() => {
      setLoggedIds((prev) => ({ ...prev, [opt.id]: false }));
    }, 2500);
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
              <button
                onClick={() => setFilter('FAST_GREEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === 'FAST_GREEN'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-900'
                }`}
                style={{ border: 'none', fontFamily: 'Inter, sans-serif' }}
                title="Only show high-floor plays with Model Probability >= 50% (Double Chance & Top Strikers)"
              >
                <span>🟢 Fast Green</span>
                <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-black/25">
                  {showAllMarkets ? fastGreenMarkets.length : qualifyingFastGreen.length}
                </span>
              </button>
            </div>

            {/* Sort Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs shadow-inner">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0">
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="fastGreen" className="bg-slate-900 text-emerald-400 font-bold">
                  🟢 Fast Green Core (Prob ≥ 50% First)
                </option>
                <option value="probDesc" className="bg-slate-900 text-slate-200">
                  🛡️ Highest Win Probability (%)
                </option>
                <option value="evDesc" className="bg-slate-900 text-slate-200">
                  🚀 Highest +EV Edge (%)
                </option>
                <option value="agreementAsc" className="bg-slate-900 text-slate-200">
                  🎯 Strongest Consensus (Lowest Spread)
                </option>
                <option value="returnDesc" className="bg-slate-900 text-slate-200">
                  💰 Highest Projected Profit ({currSym})
                </option>
                <option value="oddsAsc" className="bg-slate-900 text-slate-200">
                  🔒 Heavy Favorites First (Low Odds)
                </option>
                <option value="oddsDesc" className="bg-slate-900 text-slate-200">
                  ⚡ Value Underdogs First (High Odds)
                </option>
              </select>
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
        <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto max-w-full">
            <table className="quant-table">
              <thead>
                <tr>
                  <th style={{ width: '23%' }}>Match & League</th>
                  <th style={{ width: '22%' }}>Selection</th>
                  <th style={{ textAlign: 'right', width: '10%' }}>Live Odds</th>
                  <th style={{ textAlign: 'right', width: '15%' }}>Consensus Prob</th>
                  <th style={{ textAlign: 'center', width: '13%' }}>Consensus Spread</th>
                  <th style={{ textAlign: 'right', width: '12%' }}>+EV% & Stake</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedOpportunities.map((opt) => {
                  const rawSel = opt.selection.split(' (')[0];
                  const fairOdds =
                    opt.pinnacleOdds > 1.0
                      ? opt.pinnacleOdds
                      : Math.round((1 / opt.consensusProb) * 100) / 100;
                  const deltaPct = (opt.modelDelta * 100).toFixed(1);

                  return (
                    <tr
                      key={opt.id}
                      onClick={() => onSelectMatch(opt.match, getMarketIndexForOpt(opt))}
                      className={`cursor-pointer transition-colors ${
                        !opt.qualifies ? 'opacity-65 hover:opacity-90' : ''
                      }`}
                      title={
                        opt.filterReason
                          ? `Filtered: ${opt.filterReason}`
                          : 'Click to inspect detailed model breakdown'
                      }
                    >
                      {/* Match & League */}
                      <td>
                        <div className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                          <span className="truncate max-w-[200px]">{opt.title}</span>
                          {opt.type === 'PROPS' && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-purple-950/80 text-purple-300 rounded border border-purple-800/50 uppercase font-mono font-bold shrink-0">
                              Prop
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                          <span className="truncate max-w-[150px]">{opt.match.league}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">{opt.match.kickoff}</span>
                        </div>
                      </td>

                      {/* Selection */}
                      <td>
                        <div className="font-bold text-slate-200 text-xs truncate max-w-[220px]">
                          {rawSel}
                        </div>
                        <div className="text-[10px] mt-1 flex items-center gap-1 font-mono">
                          <span className="text-cyan-400 font-semibold">
                            {opt.selection.includes('(1X)')
                              ? '1X Double Chance'
                              : opt.type === 'PROPS'
                              ? 'Goalscorer Prop'
                              : '1X2 Match Line'}
                          </span>
                        </div>
                      </td>

                      {/* Live Odds & Fair Price */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="font-mono font-bold text-amber-400 text-sm">
                          @{opt.sportyBetOdds.toFixed(2)}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                          Fair: {fairOdds.toFixed(2)}
                        </div>
                      </td>

                      {/* Consensus Prob & Pipelines */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {(opt.consensusProb * 100).toFixed(1)}%
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            🧬{Math.round((opt.domainWeight ?? 0.56) * 100)}/
                            {Math.round((opt.mlWeight ?? 0.44) * 100)}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5 flex items-center justify-end gap-1.5">
                          <span className="text-cyan-400 font-medium" title="Pipeline 1 (Domain Poisson)">
                            P1: {(opt.domainProb * 100).toFixed(0)}%
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-purple-400 font-medium" title="Pipeline 2 (Offline Trained XGBoost)">
                            P2: {(opt.trainedMlProb * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>

                      {/* Model Agreement */}
                      <td style={{ textAlign: 'center' }}>
                        {opt.consensusLevel === 'STRONG_AGREEMENT' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Strong (Δ{deltaPct}%)
                          </span>
                        ) : opt.consensusLevel === 'MODERATE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Moderate (Δ{deltaPct}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Divergence (Δ{deltaPct}%)
                          </span>
                        )}
                      </td>

                      {/* +EV% & Kelly Stake */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="font-mono font-black text-emerald-400 text-sm">
                          {opt.evPercent > 0
                            ? `+${opt.evPercent.toFixed(1)}%`
                            : `${opt.evPercent.toFixed(1)}%`}
                        </div>
                        <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                          {currSym}
                          {opt.stakeAmount.toLocaleString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleLogPosition(opt)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                              loggedIds[opt.id]
                                ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 hover:border-emerald-500'
                            }`}
                            title="Log position directly to CLV tracker & ledger"
                          >
                            {loggedIds[opt.id] ? (
                              <>
                                <Check className="w-3 h-3" />
                                Logged
                              </>
                            ) : (
                              '+ Log'
                            )}
                          </button>
                          <button
                            onClick={() => handleCopySignal(opt)}
                            disabled={opt.evPercent <= 0}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              copiedId === opt.id
                                ? 'bg-fpl-green text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,135,0.4)]'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                            title="Copy signal to clipboard"
                          >
                            {copiedId === opt.id ? 'Copied' : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CARD GRID VIEW ===== */}
      {viewMode === 'cards' && (
        <div>
          {/* Portfolio Correlation Warning Banner */}
          {riskMode === 'safe' && displayedOpportunities.filter((o) => o.selection.includes('(1X)')).length >= 3 && (
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-xs flex items-start gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <div className="leading-relaxed">
                <span className="font-bold text-amber-300">Portfolio Correlation Notice: </span>
                <span className="text-slate-300">
                  {displayedOpportunities.filter((o) => o.selection.includes('(1X)')).length} active signals share the same 1X Double Chance structure and league meta-weights. Position caps limit single-bet exposure (1%), but concurrent home underperformance creates correlated basket risk.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedOpportunities.map((opt) => {
            const enteredVal = liveOddsInput[opt.id];
            const customOddsNum =
              enteredVal !== undefined && enteredVal !== '' ? parseFloat(enteredVal) : null;
            const effectiveOdds =
              customOddsNum && !isNaN(customOddsNum) && customOddsNum > 1.0
                ? customOddsNum
                : opt.sportyBetOdds;
            const isCustom =
              customOddsNum !== null && !isNaN(customOddsNum) && customOddsNum !== opt.sportyBetOdds;

            const effectiveEV = Math.round((opt.modelProb * effectiveOdds - 1.0) * 1000) / 10;
            const fullKelly = ((opt.modelProb * effectiveOdds) - 1.0) / (effectiveOdds - 1.0);
            const rawStakePct = Math.max(
              0,
              Math.min(strategy.maxStakePercent, fullKelly * strategy.kellyMultiplier)
            );
            const effectiveStakeAmount = Math.round(config.totalBankrollNGN * rawStakePct);

            return (
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
                          effectiveEV > 0 ? 'badge-ev' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {effectiveEV > 0 ? `+${effectiveEV}%` : `${effectiveEV}%`} EV{' '}
                        {isCustom ? '(Adjusted)' : 'Edge'}
                      </div>
                      {opt.modelProb >= 0.50 && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <span>🟢 Fast Green</span>
                          <span className="font-mono">({Math.round(opt.modelProb * 100)}%)</span>
                        </div>
                      )}
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

                  {/* Match Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{opt.title}</h3>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                      {opt.type === 'PROPS' ? 'PLAYER PROP' : 'MATCH MARKET'}
                    </span>
                  </div>

                  {/* High-Visibility Recommended Bet Selection Banner */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/50 mb-3.5 flex items-center justify-between shadow-[0_0_15px_rgba(0,255,135,0.08)]">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 block">
                          🎯 Play This Selection:
                        </span>
                        <span className="text-base font-black text-slate-100">{opt.selection}</span>
                      </div>
                    </div>
                    <div className="text-right pl-3 border-l border-slate-800/80">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Retail Odds</span>
                      <span className="text-base font-black text-amber-400 font-mono">
                        {effectiveOdds.toFixed(2)}
                      </span>
                    </div>
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
                        ✓ Strong Consensus (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                      </span>
                    ) : opt.consensusLevel === 'MODERATE' ? (
                      <span className="text-amber-400 font-semibold">
                        Moderate Spread (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold">
                        ⚠ High Divergence Alert (Δ{(opt.modelDelta * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  {opt.consensusLevel === 'DIVERGENCE' && (
                    <div className="text-[10px] text-rose-300 bg-rose-950/40 border border-rose-900/50 p-1.5 rounded font-mono">
                      ⚠️ Pipeline Divergence (&gt;7pp): Domain Ensemble and Trained ML disagree on probability. Proceed with caution.
                    </div>
                  )}

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

                {/* 3-Way Probability Decomposition (Coherent Distribution Proof) */}
                {opt.type === 'MATCH' && (() => {
                  const hMarket = opt.match.markets.find((m) => m.selection.includes('Win') && !m.selection.includes(opt.match.awayTeam));
                  const dMarket = opt.match.markets.find((m) => m.selection === 'Draw');
                  const aMarket = opt.match.markets.find((m) => m.selection.includes(opt.match.awayTeam) && m.selection.includes('Win'));
                  const pH = hMarket ? Math.round((hMarket.consensusProb ?? hMarket.ensembleProb) * 1000) / 10 : null;
                  const pD = dMarket ? Math.round((dMarket.consensusProb ?? dMarket.ensembleProb) * 1000) / 10 : null;
                  const pA = aMarket ? Math.round((aMarket.consensusProb ?? aMarket.ensembleProb) * 1000) / 10 : null;

                  if (pH !== null && pD !== null && pA !== null) {
                    const isHomePick = opt.selection.includes('Win') && !opt.selection.includes('Draw') && opt.selection.includes(opt.match.homeTeam);
                    const isDrawPick = opt.selection.includes('Draw') && !opt.selection.includes('or Draw');
                    const isAwayPick = opt.selection.includes('Win') && !opt.selection.includes('Draw') && opt.selection.includes(opt.match.awayTeam);
                    const is1XPick = opt.selection.includes('(1X)');

                    return (
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-xs font-mono">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold mb-1.5">
                          <span>Probability Decomposition (1X2)</span>
                          <span className="text-emerald-400 font-bold">Coherent Distribution</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                          <div
                            className={`p-1.5 rounded border transition-all ${
                              isHomePick || is1XPick
                                ? 'bg-emerald-950/70 border-emerald-500/70 ring-1 ring-emerald-500/40'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <span className="text-slate-400 text-[9px] block flex items-center justify-center gap-1">
                              Home Win {(isHomePick || is1XPick) && <span className="text-[8px] text-emerald-400 font-bold">🎯 TARGET</span>}
                            </span>
                            <span className={`font-bold ${isHomePick || is1XPick ? 'text-emerald-300 font-black' : 'text-slate-200'}`}>
                              {pH}%
                            </span>
                          </div>
                          <div
                            className={`p-1.5 rounded border transition-all ${
                              isDrawPick || is1XPick
                                ? 'bg-emerald-950/70 border-emerald-500/70 ring-1 ring-emerald-500/40'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <span className="text-slate-400 text-[9px] block flex items-center justify-center gap-1">
                              Draw {(isDrawPick || is1XPick) && <span className="text-[8px] text-emerald-400 font-bold">🎯 TARGET</span>}
                            </span>
                            <span className={`font-bold ${isDrawPick || is1XPick ? 'text-emerald-300 font-black' : 'text-slate-200'}`}>
                              {pD}%
                            </span>
                          </div>
                          <div
                            className={`p-1.5 rounded border transition-all ${
                              isAwayPick
                                ? 'bg-emerald-950/70 border-emerald-500/70 ring-1 ring-emerald-500/40'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <span className="text-slate-400 text-[9px] block flex items-center justify-center gap-1">
                              Away Win {isAwayPick && <span className="text-[8px] text-emerald-400 font-bold">🎯 TARGET</span>}
                            </span>
                            <span className={`font-bold ${isAwayPick ? 'text-emerald-300 font-black' : 'text-slate-200'}`}>
                              {pA}%
                            </span>
                          </div>
                        </div>
                        {is1XPick && (
                          <div className="text-[10px] text-cyan-400 mt-1.5 text-center pt-1 border-t border-slate-900 font-bold">
                            P(1X Target) = P(Home {pH}%) + P(Draw {pD}%) = <span className="text-emerald-400">{(pH + pD).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Quantitative Odds & Fair Pricing Grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                  <div
                    className={`flex flex-col justify-between p-2.5 rounded-xl border transition-all ${
                      isCustom
                        ? 'bg-emerald-950/40 border-emerald-500/50 shadow-inner'
                        : 'bg-slate-900/60 border-slate-800/60'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                      <span>Retail Odds</span>
                      {isCustom && (
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-mono font-bold">
                          TESTED
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-base font-mono font-black ${
                        isCustom ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {effectiveOdds.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {isCustom ? `Feed: ${opt.sportyBetOdds.toFixed(2)}` : 'Retail Available'}
                    </span>
                  </div>
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      Pinnacle Fair
                    </span>
                    <span className="text-base font-mono font-black text-slate-300">
                      {opt.pinnacleOdds.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Shin De-vigged Ref</span>
                  </div>
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      Active Model
                    </span>
                    <span className="text-base font-mono font-black text-fpl-green">
                      {(opt.modelProb * 100).toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Consensus Probability</span>
                  </div>
                  <div className="flex flex-col justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      Model Fair Odds
                    </span>
                    <span className="text-base font-mono font-black text-cyan-400">
                      {(1 / Math.max(0.01, opt.modelProb)).toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">1 / P(Model)</span>
                  </div>
                </div>

                {/* Edge vs Pinnacle Sharp Line */}
                {opt.pinnacleOdds > 1.0 && (() => {
                  const pinnacleImplied = (1 / opt.pinnacleOdds) * 100;
                  const alphaEdge = (opt.modelProb * 100) - pinnacleImplied;
                  return (
                    <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950/70 px-3.5 py-2.5 rounded-xl border border-slate-800/80 mb-3">
                      <span className="text-slate-400">Edge vs. Pinnacle Sharp Line:</span>
                      <span className={`font-bold ${alphaEdge > 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {alphaEdge > 0 ? `+${alphaEdge.toFixed(1)}pp` : `${alphaEdge.toFixed(1)}pp`} Alpha Claim
                        <span className="text-[9px] text-slate-500 font-normal ml-1.5">
                          (Model {(opt.modelProb * 100).toFixed(1)}% vs Pin {pinnacleImplied.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  );
                })()}

                {/* Interactive Live Odds Recalculator */}
                <div
                  className={`p-3 rounded-2xl border transition-all mb-4 space-y-2 ${
                    isCustom
                      ? 'bg-slate-950/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-950/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                      <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-bold text-slate-200">
                        Test Current Bookmaker Odds:
                      </span>
                    </div>
                    {isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = { ...liveOddsInput };
                          delete next[opt.id];
                          setLiveOddsInput(next);
                        }}
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                      >
                        Reset to {opt.sportyBetOdds.toFixed(2)}
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
                        value={liveOddsInput[opt.id] ?? ''}
                        placeholder={`Enter odds on your book (feed: ${opt.sportyBetOdds.toFixed(2)})`}
                        onChange={(e) => {
                          setLiveOddsInput({
                            ...liveOddsInput,
                            [opt.id]: e.target.value,
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white placeholder:text-slate-500 outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 pointer-events-none">
                        ODDS
                      </span>
                    </div>

                    <div className="flex flex-col text-right shrink-0">
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                        {isCustom ? 'Adjusted EV' : 'Live EV'}
                      </span>
                      <span
                        className={`text-sm font-mono font-black ${
                          effectiveEV > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {effectiveEV > 0 ? `+${effectiveEV.toFixed(1)}%` : `${effectiveEV.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Sharp Line Comparison & EV Verdict */}
                  {opt.pinnacleOdds > 1.0 && (
                    <div className="pt-2 border-t border-slate-900/90 flex flex-col gap-1 text-[10px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">vs Pinnacle Fair ({opt.pinnacleOdds.toFixed(2)}):</span>
                        {effectiveOdds > opt.pinnacleOdds ? (
                          <span className="text-emerald-400 font-bold">
                            🟢 Beats Sharp Benchmark (+{(effectiveOdds - opt.pinnacleOdds).toFixed(2)}) • Pure Price Edge!
                          </span>
                        ) : effectiveOdds === opt.pinnacleOdds ? (
                          <span className="text-cyan-400 font-semibold">
                            ⚪ Equal to Sharp Fair Line
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold">
                            ⚠️ Below Sharp Fair Line (Alpha Claim Only)
                          </span>
                        )}
                      </div>
                      {isCustom && (
                        <div className="flex items-center justify-between text-slate-400 pt-0.5">
                          <span>Verdict at {effectiveOdds.toFixed(2)}:</span>
                          <span
                            className={
                              effectiveEV >= strategy.minEV
                                ? 'text-emerald-400 font-bold'
                                : effectiveEV > 0
                                ? 'text-amber-400 font-semibold'
                                : 'text-rose-400 font-bold'
                            }
                          >
                            {effectiveEV >= strategy.minEV
                              ? `✓ Qualifies for ${strategy.name}`
                              : effectiveEV > 0
                              ? `Edge narrowed below +${strategy.minEV}% ${strategy.name} threshold`
                              : 'Negative Expected Value (Pass)'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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
                        {currSym}{effectiveStakeAmount.toLocaleString()} {config.currency}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          (Returns {currSym}
                          {Math.round(effectiveStakeAmount * effectiveOdds).toLocaleString()})
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
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  onClick={() => onSelectMatch(opt.match, getMarketIndexForOpt(opt))}
                  className="text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  Detailed Model Breakdown
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleLogPosition(opt, effectiveOdds, effectiveEV, effectiveStakeAmount)
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      loggedIds[opt.id]
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : 'bg-slate-950/80 hover:bg-slate-900 text-emerald-400 border border-emerald-500/40 hover:border-emerald-500'
                    }`}
                    title="Log this position directly into the institutional CLV tracker & position ledger"
                  >
                    {loggedIds[opt.id] ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Logged to Ledger!
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        + Log Position
                      </>
                    )}
                  </button>

                  <button
                    onClick={() =>
                      handleCopySignal(opt, effectiveOdds, effectiveEV, effectiveStakeAmount)
                    }
                    disabled={effectiveEV <= 0}
                    className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                      effectiveEV <= 0
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
            </div>
          );
        })}
          </div>
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
