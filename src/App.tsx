import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ValueFeed } from './components/ValueFeed';
import { BankrollManager } from './components/BankrollManager';
import { ModelDiagnostics } from './components/ModelDiagnostics';
import { MatchModal } from './components/MatchModal';
import type { MatchData, BankrollConfig } from './types';
import { fetchLiveFPLData, BASE_MATCHES } from './data/matchRepository';

export function App() {
  const [config, setConfig] = useState<BankrollConfig>({
    totalBankrollNGN: 200000,
    kellyFraction: 0.25,
    maxStakePercent: 0.02,
    currency: 'NGN'
  });

  const [activeTab, setActiveTab] = useState<'feed' | 'bankroll' | 'models'>('feed');
  const [riskMode, setRiskMode] = useState<'safe' | 'aggressive' | 'value'>('safe');
  const [fuel, setFuel] = useState<'dixon-coles' | 'xgboost' | 'market-fusion'>('xgboost');

  const [matches, setMatches] = useState<MatchData[]>(BASE_MATCHES);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);

  useEffect(() => {
    fetchLiveFPLData().then(liveMatches => {
      setMatches(liveMatches);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-fpl-green selection:text-slate-950">
      <div className="max-w-7xl w-full mx-auto px-4 py-4 flex-1 flex flex-col">
        <Header
          config={config}
          onConfigChange={setConfig}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          riskMode={riskMode}
          setRiskMode={setRiskMode}
          fuel={fuel}
          setFuel={setFuel}
        />

        <main className="flex-1 w-full">
          {activeTab === 'feed' && (
            <ValueFeed
              matches={matches}
              config={config}
              onSelectMatch={setSelectedMatch}
              riskMode={riskMode}
            />
          )}

          {activeTab === 'bankroll' && (
            <BankrollManager
              config={config}
              onConfigChange={setConfig}
            />
          )}

          {activeTab === 'models' && (
            <ModelDiagnostics
              match={selectedMatch || matches[0]}
            />
          )}
        </main>
      </div>

      <MatchModal
        match={selectedMatch}
        config={config}
        onClose={() => setSelectedMatch(null)}
      />

      <footer className="border-t border-fpl-border bg-slate-950 py-4 text-center text-[10px] uppercase tracking-widest text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BET HORIZON V3 • Generative AI & Fractional Kelly Bankroll Optimization Engine</span>
          <span className="text-fpl-green">Decision-Support Platform Only</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
