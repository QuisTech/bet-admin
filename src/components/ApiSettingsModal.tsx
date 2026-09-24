import React, { useState, useEffect, useCallback } from 'react';
import { X, Key, RefreshCw, Check, Globe, Cpu, Activity, AlertCircle } from 'lucide-react';
import {
  getSavedOddsApiKey,
  saveOddsApiKey,
  checkOddsApiUsage,
  getSavedOddsApiUsage,
  type OddsApiUsage,
} from '../services/oddsService';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: (key?: string) => void;
  isFplLive: boolean;
  isOddsLive: boolean;
  oddsSource: string;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  isFplLive,
  isOddsLive,
  oddsSource,
}) => {
  const [apiKey, setApiKey] = useState(getSavedOddsApiKey());
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<OddsApiUsage | null>(() => getSavedOddsApiUsage());
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  const handleTestQuota = useCallback(
    async (customKey?: string) => {
      const keyToTest = (customKey || apiKey).trim();
      if (!keyToTest) return;
      setIsCheckingUsage(true);
      try {
        const result = await checkOddsApiUsage(keyToTest);
        setUsage(result);
      } finally {
        setIsCheckingUsage(false);
      }
    },
    [apiKey]
  );

  useEffect(() => {
    if (isOpen) {
      const savedUsage = getSavedOddsApiUsage();
      if (savedUsage) setUsage(savedUsage);
      if (apiKey && (!savedUsage || savedUsage.requestsRemaining === null)) {
        handleTestQuota(apiKey);
      }
    }
  }, [isOpen, apiKey, handleTestQuota]);

  if (!isOpen) return null;

  const handleSaveAndSync = () => {
    saveOddsApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh(apiKey);
    handleTestQuota(apiKey);
  };

  const totalQuota = (usage?.requestsRemaining ?? 0) + (usage?.requestsUsed ?? 0) || 500;
  const remainingPct =
    usage?.requestsRemaining !== null && usage?.requestsRemaining !== undefined
      ? Math.max(0, Math.min(100, Math.round((usage.requestsRemaining / totalQuota) * 100)))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-emerald-500/30 overflow-hidden shadow-2xl shadow-emerald-950/80 bg-slate-950/95 p-6 relative space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Live Data Feeds & API Integrations</h2>
          </div>
          <p className="text-xs text-slate-400">
            Configure live odds ingestion from global sportsbooks and inspect FPL player stats synchronization.
          </p>
        </div>

        {/* Active Feed Status Indicators */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              FPL Player Metrics
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isFplLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-bold font-mono text-white">
                {isFplLive ? 'CONNECTED' : 'OFFLINE MODE'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Official Premier League API (/api/fpl)</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Sportsbook Feed
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isOddsLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="text-xs font-bold font-mono text-white">
                {isOddsLive ? 'LIVE FEED' : 'BENCHMARK'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate" title={oddsSource}>
              {oddsSource}
            </p>
          </div>
        </div>

        {/* The Odds API Key Configuration */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <label className="text-xs font-bold text-slate-200">The Odds API Key</label>
            </div>
            <a
              href="https://the-odds-api.com/"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-emerald-400 hover:underline font-mono"
            >
              Get Free Key (500 req/mo) →
            </a>
          </div>

          <p className="text-[11px] text-slate-400">
            Paste your API key to fetch minute-by-minute lines from Pinnacle, Betfair Exchange, Bet365, and DraftKings.
          </p>

          <input
            type="password"
            placeholder="Paste your 32-character API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-500">
              Keys are stored securely in local client storage.
            </span>
            {apiKey && (
              <button
                onClick={() => setApiKey('')}
                className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                Clear Key
              </button>
            )}
          </div>
        </div>

        {/* Live API Quota & Usage Meter */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Monthly API Quota & Usage
              </span>
            </div>
            <button
              onClick={() => handleTestQuota()}
              disabled={isCheckingUsage || !apiKey}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer hover:underline"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingUsage ? 'animate-spin' : ''}`} />
              <span>{isCheckingUsage ? 'Testing...' : 'Test Key / Refresh Quota'}</span>
            </button>
          </div>

          {apiKey ? (
            <div className="space-y-2.5">
              {usage?.status === 'invalid' ? (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{usage.message || 'Invalid API Key. Please verify your 32-character key.'}</span>
                </div>
              ) : usage?.status === 'valid' && usage.requestsRemaining !== null ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block uppercase">Requests Remaining</span>
                      <span className="text-base font-black text-emerald-400">
                        {usage.requestsRemaining}
                        <span className="text-xs text-slate-500 font-normal"> / {totalQuota}</span>
                      </span>
                    </div>
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block uppercase">Requests Used</span>
                      <span className="text-base font-black text-slate-200">
                        {usage.requestsUsed ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Quota Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>Quota Available</span>
                      <span className="font-bold text-emerald-400">{remainingPct}% remaining</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (remainingPct ?? 100) > 30
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : (remainingPct ?? 100) > 10
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${remainingPct ?? 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                    <span>Reset cycle: Monthly on registration date</span>
                    {usage.lastChecked && <span>Checked: {usage.lastChecked}</span>}
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>Click "Test Key / Refresh Quota" to inspect usage</span>
                  <button
                    onClick={() => handleTestQuota()}
                    className="text-cyan-400 hover:underline font-bold"
                  >
                    Check Now →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-mono">
              Paste your API key above to monitor live usage and remaining monthly requests.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveAndSync}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            {saved ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            <span>{saved ? 'Saved & Synced!' : 'Save & Sync Live Feeds'}</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
