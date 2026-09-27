import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Key,
  RefreshCw,
  Check,
  Globe,
  Cpu,
  AlertCircle,
  Cloud,
  CloudOff,
  UploadCloud,
  Database,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  getSavedOddsApiKey,
  saveOddsApiKey,
  checkOddsApiUsage,
  getSavedOddsApiUsage,
  type OddsApiUsage,
} from '../services/oddsService';
import {
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  parseFirebaseConfigInput,
  getFirebaseStatus,
  testFirebaseConnection,
} from '../services/firebaseService';
import { syncLocalLedgerToCloud, getLoggedBets } from '../services/ledgerService';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: (key?: string) => void;
  isFplLive: boolean;
  isOddsLive: boolean;
  oddsSource: string;
  initialTab?: 'feeds' | 'cloud';
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  isFplLive,
  isOddsLive,
  oddsSource,
  initialTab = 'feeds',
}) => {
  const [activeTab, setActiveTab] = useState<'feeds' | 'cloud'>(initialTab);

  // Odds API State
  const [apiKey, setApiKey] = useState(getSavedOddsApiKey());
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<OddsApiUsage | null>(() => getSavedOddsApiUsage());
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  // Firebase Cloud Sync State
  const [fbConfigText, setFbConfigText] = useState('');
  const [fbStatus, setFbStatus] = useState(() => getFirebaseStatus());
  const [isTestingFb, setIsTestingFb] = useState(false);
  const [fbTestResult, setFbTestResult] = useState<{
    success: boolean;
    message: string;
    remoteCount?: number;
  } | null>(null);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [syncLocalResult, setSyncLocalResult] = useState<{
    success: boolean;
    count: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFbStatus(getFirebaseStatus());
      const currentFb = getSavedFirebaseConfig();
      if (currentFb) {
        setFbConfigText(JSON.stringify(currentFb, null, 2));
      } else {
        setFbConfigText('');
      }
    }
  }, [isOpen, initialTab]);

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
    if (isOpen && activeTab === 'feeds') {
      const savedUsage = getSavedOddsApiUsage();
      if (savedUsage) setUsage(savedUsage);
      if (apiKey && (!savedUsage || savedUsage.requestsRemaining === null)) {
        handleTestQuota(apiKey);
      }
    }
  }, [isOpen, apiKey, activeTab, handleTestQuota]);

  if (!isOpen) return null;

  const handleSaveAndSync = () => {
    saveOddsApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh(apiKey);
    handleTestQuota(apiKey);
  };

  const handleSaveFirebaseConfig = () => {
    if (!fbConfigText.trim()) {
      saveFirebaseConfig(null);
      setFbStatus(getFirebaseStatus());
      setFbTestResult({ success: true, message: 'Firebase configuration cleared. Ledger will use local offline storage.' });
      return;
    }

    const parsed = parseFirebaseConfigInput(fbConfigText);
    if (!parsed) {
      setFbTestResult({
        success: false,
        message: 'Could not parse Firebase config. Please paste valid JSON or the firebaseConfig snippet containing apiKey and projectId.',
      });
      return;
    }

    saveFirebaseConfig(parsed);
    setFbStatus(getFirebaseStatus());
    setFbTestResult({
      success: true,
      message: `Config saved! Project: "${parsed.projectId}". Real-time synchronization active.`,
    });
  };

  const handleTestFirebase = async () => {
    setIsTestingFb(true);
    setFbTestResult(null);
    try {
      if (fbConfigText.trim()) {
        const parsed = parseFirebaseConfigInput(fbConfigText);
        if (parsed) {
          saveFirebaseConfig(parsed);
          setFbStatus(getFirebaseStatus());
        }
      }
      const res = await testFirebaseConnection();
      setFbTestResult(res);
    } finally {
      setIsTestingFb(false);
    }
  };

  const handleSyncAllLocalToCloud = async () => {
    setIsSyncingLocal(true);
    setSyncLocalResult(null);
    try {
      const res = await syncLocalLedgerToCloud();
      setSyncLocalResult(res);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const totalQuota = (usage?.requestsRemaining ?? 0) + (usage?.requestsUsed ?? 0) || 500;
  const remainingPct =
    usage?.requestsRemaining !== null && usage?.requestsRemaining !== undefined
      ? Math.max(0, Math.min(100, Math.round((usage.requestsRemaining / totalQuota) * 100)))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-xl rounded-3xl border border-emerald-500/30 overflow-hidden shadow-2xl shadow-emerald-950/80 bg-slate-950/95 p-6 relative max-h-[92vh] overflow-y-auto space-y-5">
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
            {activeTab === 'cloud' ? (
              <Cloud className="w-5 h-5 text-emerald-400" />
            ) : (
              <Globe className="w-5 h-5 text-emerald-400" />
            )}
            <h2 className="text-lg font-bold text-white">System Settings & Data Sync</h2>
          </div>
          <p className="text-xs text-slate-400">
            Configure live sportsbook odds feeds and cross-device Firebase cloud synchronization.
          </p>

          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-1.5 mt-3 p-1 bg-slate-900/90 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('feeds')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'feeds'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Odds & FPL</span>
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'cloud'
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firebase Cloud Sync</span>
              {fbStatus.isConfigured && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* ================= TAB 1: ODDS FEEDS & FPL ================= */}
        {activeTab === 'feeds' && (
          <div className="space-y-4">
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
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-slate-600 outline-none"
              />

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Stored safely in browser localStorage</span>
                {apiKey && (
                  <button
                    onClick={() => {
                      setApiKey('');
                      saveOddsApiKey('');
                      onRefresh('');
                    }}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear Key
                  </button>
                )}
              </div>
            </div>

            {/* Usage Monitoring & Quota Meter */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Quota Health & Rate Limit</span>
                <button
                  onClick={() => handleTestQuota()}
                  disabled={isCheckingUsage || !apiKey}
                  className={`text-[10px] font-mono flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    apiKey
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingUsage ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUsage ? 'Validating...' : 'Refresh Quota'}</span>
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
        )}

        {/* ================= TAB 2: FIREBASE CLOUD SYNC ================= */}
        {activeTab === 'cloud' && (
          <div className="space-y-4">
            {/* Cloud Connection Status Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    fbStatus.isConfigured
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  {fbStatus.isConfigured ? (
                    <Cloud className="w-5 h-5 animate-pulse" />
                  ) : (
                    <CloudOff className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>
                      {fbStatus.isConfigured
                        ? 'Real-Time Cloud Sync Active'
                        : 'Local Cache Only (Offline)'}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-black ${
                        fbStatus.isConfigured
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {fbStatus.isConfigured ? 'CONNECTED' : 'LOCAL'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {fbStatus.projectId ? (
                      <>
                        Project: <strong className="text-cyan-400">{fbStatus.projectId}</strong>{' '}
                        <span className="text-slate-500">
                          ({fbStatus.source === 'ENV' ? 'Vercel Env' : fbStatus.source === 'DEFAULT' ? 'Built-in Auto Sync' : 'Custom Config'})
                        </span>
                      </>
                    ) : (
                      'Positions are stored only in this specific browser'
                    )}
                  </div>
                </div>
              </div>

              {fbStatus.isConfigured && (
                <button
                  onClick={handleTestFirebase}
                  disabled={isTestingFb}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isTestingFb ? 'animate-spin' : ''}`} />
                  <span>{isTestingFb ? 'Testing...' : 'Test Sync'}</span>
                </button>
              )}
            </div>

            {/* Test Result Alert Banner */}
            {fbTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  fbTestResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {fbTestResult.success ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{fbTestResult.message}</div>
                  {fbTestResult.remoteCount !== undefined && (
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Cloud database currently has <strong>{fbTestResult.remoteCount}</strong> positions saved.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Firebase Configuration Paste Box */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <label className="text-xs font-bold text-slate-200">Firebase Web App Config</label>
                </div>
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-cyan-400 hover:underline font-mono flex items-center gap-1"
                >
                  <span>Firebase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Paste your Firebase config object or JSON from your console. Any position you log on your phone or laptop will sync instantaneously.
              </p>

              <textarea
                rows={5}
                value={fbConfigText}
                onChange={(e) => setFbConfigText(e.target.value)}
                placeholder={`Paste your firebaseConfig object here...\ne.g.:\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "my-bet-project"\n};`}
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl p-3 text-xs font-mono text-white placeholder:text-slate-600 outline-none resize-none leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveFirebaseConfig}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                  >
                    Save & Activate
                  </button>
                  <button
                    onClick={handleTestFirebase}
                    disabled={isTestingFb || !fbConfigText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer border border-slate-700"
                  >
                    {isTestingFb ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                {fbStatus.isConfigured && (
                  <button
                    onClick={() => {
                      saveFirebaseConfig(null);
                      setFbConfigText('');
                      setFbStatus(getFirebaseStatus());
                      setFbTestResult({ success: true, message: 'Disconnected from Firebase.' });
                    }}
                    className="text-rose-400 hover:underline cursor-pointer text-xs"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Migration: Sync Local Positions to Cloud */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-cyan-400" />
                  <span>Migrate Local Positions to Cloud</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {getLoggedBets().length} local positions ready
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                Push all existing local ledger positions (including your verified historical slips) to Firestore so they are visible on all your devices.
              </p>

              {syncLocalResult && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-mono ${
                    syncLocalResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {syncLocalResult.success
                    ? `✓ Successfully uploaded ${syncLocalResult.count} positions to cloud!`
                    : `Upload failed: ${syncLocalResult.error}`}
                </div>
              )}

              <button
                onClick={handleSyncAllLocalToCloud}
                disabled={isSyncingLocal || !fbStatus.isConfigured}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  fbStatus.isConfigured
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                    : 'bg-slate-950 text-slate-600 border border-slate-900 cursor-not-allowed'
                }`}
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isSyncingLocal ? 'animate-bounce' : ''}`} />
                <span>
                  {isSyncingLocal
                    ? 'Uploading Positions to Firestore...'
                    : fbStatus.isConfigured
                    ? `Sync ${getLoggedBets().length} Local Positions to Cloud`
                    : 'Connect Firebase Above to Enable Sync'}
                </span>
              </button>
            </div>

            {/* Quick 2-Minute Setup Guide */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 font-mono">
              <div className="font-bold text-slate-300 uppercase text-[10px]">
                ⚡ 2-Minute Setup in Firebase Console:
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Go to <span className="text-cyan-400">console.firebase.google.com</span> & create a project.</li>
                <li>In sidebar, click <strong className="text-slate-200">Firestore Database</strong> → <strong className="text-slate-200">Create Database</strong> (start in Test mode).</li>
                <li>In Project Settings (⚙️) → General → click <strong className="text-slate-200">&lt;/&gt; Web</strong> to add web app.</li>
                <li>Copy the <strong className="text-slate-200">firebaseConfig</strong> code and paste it in the box above!</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
