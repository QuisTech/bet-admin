import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricsColumn } from './components/MetricsColumn';
import { TopPicksColumn } from './components/TopPicksColumn';
import { ValueFeed } from './components/ValueFeed';
import { BankrollManager } from './components/BankrollManager';
import { BetLedger } from './components/BetLedger';
import { ModelDiagnostics } from './components/ModelDiagnostics';
import { StakingCalculator } from './components/StakingCalculator';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import type { MatchData, BankrollConfig, ModelPipelineMode } from './types';
import { BASE_MATCHES } from './data/matchRepository';
import { fetchLiveFPLBootstrap } from './services/fplService';
import { fetchLiveOddsFeed } from './services/oddsService';
import { evaluateOpportunities } from './models/opportunityEngine';

export default function App() {
  const [config, setConfig] = useState<BankrollConfig>(() => {
    let savedBankroll = 200000;
    let savedCurrency: 'NGN' | 'USD' = 'NGN';
    try {
      const b = localStorage.getItem('bet_admin_bankroll');
      if (b && parseFloat(b) > 0) savedBankroll = parseFloat(b);
      const c = localStorage.getItem('bet_admin_currency');
      if (c === 'USD' || c === 'NGN') savedCurrency = c;
    } catch {}

    return {
      totalBankrollNGN: savedBankroll,
      totalBankroll: savedBankroll,
      kellyFraction: 0.25,
      maxStakePercent: 0.02,
      currency: savedCurrency,
      strategyMode: 'safe',
    };
  });

  const handleConfigChange = (newConfig: BankrollConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('bet_admin_bankroll', newConfig.totalBankrollNGN.toString());
      localStorage.setItem('bet_admin_currency', newConfig.currency);
    } catch {}
  };

  const [tab, setTab] = useState<'feed' | 'ledger' | 'bankroll' | 'diagnostics'>('feed');
  const [diagnosticsSubTab, setDiagnosticsSubTab] = useState<'diagnostics' | 'evolution'>('diagnostics');
  const [tuningLeague, setTuningLeague] = useState<string | undefined>(undefined);
  const [matches, setMatches] = useState<MatchData[]>(BASE_MATCHES);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [selectedMarketIndex, setSelectedMarketIndex] = useState<number>(0);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('soccer_epl');
  const [pipelineFilter, setPipelineFilter] = useState<ModelPipelineMode>('ALL_CONSENSUS');

  const handleSelectMatch = (m: MatchData, marketIndex: number = 0) => {
    setSelectedMatch(m);
    setSelectedMarketIndex(marketIndex);
  };

  const handleOpenEvolution = (league: string) => {
    setTuningLeague(league);
    setDiagnosticsSubTab('evolution');
    setTab('diagnostics');
  };

  // Live Feed Status States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFplLive, setIsFplLive] = useState(false);
  const [isOddsLive, setIsOddsLive] = useState(false);
  const [oddsSource, setOddsSource] = useState('Pinnacle Benchmark');

  const syncDataFeeds = useCallback(
    async (customOddsKey?: string, leagueId?: string, forceRefresh: boolean = false) => {
      const targetLeague = leagueId || selectedLeagueId;

      // 1. Fetch live FPL stats via proxy
      let fplData = null;
      try {
        fplData = await fetchLiveFPLBootstrap();
        setIsFplLive(fplData.isLive);
      } catch {
        setIsFplLive(false);
      }

      // 2. Fetch live odds feed with FPL player props fusion & dual-model evaluation
      try {
        const oddsResult = await fetchLiveOddsFeed(customOddsKey, fplData, targetLeague, forceRefresh);
        setIsOddsLive(oddsResult.isLive);
        setOddsSource(oddsResult.source);
        if (oddsResult.matches && oddsResult.matches.length > 0) {
          setMatches(oddsResult.matches);
        }
      } catch {
        setIsOddsLive(false);
      }
    },
    [selectedLeagueId]
  );

  useEffect(() => {
    syncDataFeeds();
  }, [syncDataFeeds]);

  const handleLeagueChange = (newLeagueId: string) => {
    setSelectedLeagueId(newLeagueId);
  };

  const currentMode = config.strategyMode || 'safe';

  // Dynamic portfolio aggregate statistics
  const slateStats = useMemo(() => {
    return evaluateOpportunities(matches, config, pipelineFilter, currentMode);
  }, [matches, config, pipelineFilter, currentMode]);

  const liveFeedExposure = useMemo(() => {
    return slateStats.qualifyingOpportunities.reduce((sum, o) => sum + o.stakeAmount, 0);
  }, [slateStats]);

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] p-4 sm:p-6 font-sans">
      {/* 12-Column Grid matching fpl-admin and uefa-admin exact structure */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-4 auto-rows-min">
        {/* Top Header (Col 12) */}
        <Header
          config={config}
          onConfigChange={handleConfigChange}
          activeSignalCount={slateStats.activeSignalCount}
          averageEV={slateStats.averageEV}
          brierScore={slateStats.brierScore}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isOddsLive={isOddsLive}
          isFplLive={isFplLive}
          selectedLeagueId={selectedLeagueId}
          onLeagueChange={handleLeagueChange}
        />

        {/* Left Metrics Column (Col 1-3) */}
        <MetricsColumn
          config={config}
          onConfigChange={handleConfigChange}
          activeSignalCount={slateStats.activeSignalCount}
          brierScore={slateStats.brierScore}
          liveFeedExposure={liveFeedExposure}
          onOpenBankrollTab={() => setTab('bankroll')}
        />

        {/* Center Primary Stage (Col 4-9 -> col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-3xl overflow-hidden relative shadow-xl min-h-[600px] backdrop-blur-md flex flex-col">
          <div className="relative z-10 p-4 sm:p-6 h-full flex flex-col">
            {/* Navigation Tabs Row */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-6">
              <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto justify-center">
                <button
                  onClick={() => setTab('feed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    tab === 'feed'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  +EV Feed
                </button>
                <button
                  onClick={() => setTab('ledger')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    tab === 'ledger'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>📓 Position Ledger</span>
                </button>
                <button
                  onClick={() => setTab('bankroll')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    tab === 'bankroll'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Bankroll & PnL
                </button>
                <button
                  onClick={() => setTab('diagnostics')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    tab === 'diagnostics'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>🧬 Model Lab</span>
                </button>
              </div>

              <div className="text-right text-[11px] font-mono text-slate-400">
                <span className="text-emerald-400 font-bold">{slateStats.activeSignalCount}</span>{' '}
                signals active
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1">
              {tab === 'feed' && (
                <ValueFeed
                  matches={matches}
                  config={config}
                  onSelectMatch={handleSelectMatch}
                  riskMode={currentMode}
                  pipelineFilter={pipelineFilter}
                  onPipelineFilterChange={setPipelineFilter}
                  onOpenEvolution={handleOpenEvolution}
                />
              )}

              {tab === 'ledger' && (
                <BetLedger config={config} />
              )}

              {tab === 'bankroll' && (
                <BankrollManager config={config} onConfigChange={handleConfigChange} />
              )}

              {tab === 'diagnostics' && (
                <ModelDiagnostics
                  match={selectedMatch || matches[0]}
                  activeSubTab={diagnosticsSubTab}
                  onSubTabChange={setDiagnosticsSubTab}
                  selectedLeague={tuningLeague}
                  onWeightsUpdated={() => {
                    setMatches((prev) => [...prev]);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <TopPicksColumn
          matches={matches}
          opportunities={slateStats.qualifyingOpportunities.length > 0 ? slateStats.qualifyingOpportunities : slateStats.allOpportunities}
          onSelectMatch={handleSelectMatch}
          isLive={isOddsLive}
          oddsSource={oddsSource}
        />

        {/* Footer & Quant Disclaimer */}
        <footer className="col-span-12 mt-8 pt-6 pb-4 border-t border-slate-900/80 text-center text-xs text-slate-500 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono">
            <span className="text-slate-400 font-bold">BET HORIZON v1.0.0</span>
            <span className="text-slate-700">•</span>
            <span>Dual-Pipeline Ensemble (Dixon-Coles & XGBoost)</span>
            <span className="text-slate-700">•</span>
            <span>Evolutionary Strategy Meta-Learner</span>
            <span className="text-slate-700">•</span>
            <a
              href="https://github.com/QuisTech/bet-admin"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              GitHub (MIT License)
            </a>
          </div>
          <p className="text-[11px] text-slate-500 max-w-3xl mx-auto leading-relaxed">
            <strong>Decision-Support Tool Only:</strong> BET HORIZON does not accept wagers, place bets, or provide real-money gambling services. All probabilities and expected values are mathematical estimations for research and educational purposes. Users are strictly responsible for local legal compliance and responsible bankroll management. Past statistical edge is not indicative of future results.
          </p>
        </footer>
      </div>

      {/* Staking Calculator Modal */}
      {selectedMatch && (
        <StakingCalculator
          match={selectedMatch}
          marketIndex={selectedMarketIndex}
          config={config}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {/* Live Data Feeds / Odds API Key Modal */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRefresh={(customKey) => syncDataFeeds(customKey)}
        isFplLive={isFplLive}
        isOddsLive={isOddsLive}
        oddsSource={oddsSource}
      />
    </div>
  );
}
