import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MetricsColumn } from './components/MetricsColumn';
import { TopPicksColumn } from './components/TopPicksColumn';
import { ValueFeed } from './components/ValueFeed';
import { BankrollManager } from './components/BankrollManager';
import { ModelDiagnostics } from './components/ModelDiagnostics';
import { StakingCalculator } from './components/StakingCalculator';
import type { MatchData, BankrollConfig } from './types';
import { fetchLiveFPLData, BASE_MATCHES } from './data/matchRepository';
import { STRATEGY_MODES } from './models/strategyMode';

export default function App() {
  const [config, setConfig] = useState<BankrollConfig>({
    totalBankrollNGN: 200000,
    totalBankroll: 10000,
    kellyFraction: 0.25,
    maxStakePercent: 0.02,
    currency: 'USD',
    strategyMode: 'safe',
  });

  const [tab, setTab] = useState<'feed' | 'bankroll' | 'diagnostics'>('feed');
  const [matches, setMatches] = useState<MatchData[]>(BASE_MATCHES);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);

  useEffect(() => {
    fetchLiveFPLData().then((liveMatches) => {
      if (liveMatches && liveMatches.length > 0) {
        setMatches(liveMatches);
      }
    });
  }, []);

  const currentMode = config.strategyMode || 'safe';
  const strategy = STRATEGY_MODES[currentMode];

  const activeSignals = useMemo(() => {
    return [
      ...matches.flatMap((m) =>
        m.markets.filter((mk) => {
          if (mk.ensembleProb < strategy.minProb && currentMode === 'safe') return false;
          return mk.evPercent >= strategy.minEV;
        })
      ),
      ...matches.flatMap((m) =>
        m.playerProps.filter((p) => {
          if (p.modelProb < strategy.minProb && currentMode === 'safe') return false;
          return p.evPercent >= strategy.minEV;
        })
      ),
    ].length;
  }, [matches, strategy, currentMode]);

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] p-4 sm:p-6 font-sans">
      {/* 12-Column Grid matching fpl-admin and uefa-admin exact structure */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-4 auto-rows-min">
        {/* Top Header (Col 12) */}
        <Header
          config={config}
          onConfigChange={setConfig}
          activeSignalCount={activeSignals}
        />

        {/* Left Metrics Column (Col 1-3) */}
        <MetricsColumn
          config={config}
          onConfigChange={setConfig}
          activeSignalCount={activeSignals}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    tab === 'diagnostics'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Model Diagnostics
                </button>
              </div>

              <div className="text-right text-[11px] font-mono text-slate-400">
                <span className="text-emerald-400 font-bold">{activeSignals}</span> signals active
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1">
              {tab === 'feed' && (
                <ValueFeed
                  matches={matches}
                  config={config}
                  onSelectMatch={(m) => setSelectedMatch(m)}
                  riskMode={currentMode}
                />
              )}

              {tab === 'bankroll' && (
                <BankrollManager config={config} onConfigChange={setConfig} />
              )}

              {tab === 'diagnostics' && (
                <ModelDiagnostics match={selectedMatch || matches[0]} />
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Col 10-12 -> col-span-12 lg:col-span-3) */}
        <TopPicksColumn
          matches={matches}
          onSelectMatch={(m) => setSelectedMatch(m)}
        />
      </div>

      {/* Staking Calculator Modal */}
      {selectedMatch && (
        <StakingCalculator
          match={selectedMatch}
          config={config}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
