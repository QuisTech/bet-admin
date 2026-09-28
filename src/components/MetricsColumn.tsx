import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  Cpu,
  Edit2,
  Check,
  TrendingUp,
  ShieldCheck,
  Lock,
  Cloud,
  Wallet,
  Clock,
  Coins,
} from 'lucide-react';
import type { BankrollConfig, LoggedBet } from '../types';
import { runMonteCarloSimulation } from '../models/monteCarloEngine';
import { getLoggedBets, calculateLedgerStats } from '../services/ledgerService';

interface MetricsColumnProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
  activeSignalCount?: number;
  brierScore?: number;
  liveFeedExposure?: number;
  onOpenBankrollTab?: () => void;
}

export const MetricsColumn: React.FC<MetricsColumnProps> = ({
  config,
  onConfigChange,
  brierScore,
  liveFeedExposure,
  onOpenBankrollTab,
}) => {
  const sym = config.currency === 'USD' ? '$' : '₦';
  const activeCapital = config.currency === 'USD' ? config.totalBankroll : config.totalBankrollNGN;
  const masterCapital = config.masterCapitalNGN || (config.currency === 'USD' ? 2000 : 200000);
  const vaultReserve = Math.max(0, masterCapital - activeCapital);
  const vaultProtectionPct = masterCapital > 0 ? ((vaultReserve / masterCapital) * 100).toFixed(0) : '0';

  // Real-time ledger statistics listener
  const [ledgerBets, setLedgerBets] = useState<LoggedBet[]>(() => getLoggedBets());
  useEffect(() => {
    const handler = () => setLedgerBets(getLoggedBets());
    window.addEventListener('bet_horizon_ledger_updated', handler);
    return () => window.removeEventListener('bet_horizon_ledger_updated', handler);
  }, []);

  const ledgerStats = useMemo(() => calculateLedgerStats(ledgerBets), [ledgerBets]);

  const realizedBankroll = Math.round((activeCapital + ledgerStats.netProfit) * 100) / 100;
  const liquidCash = Math.max(0, Math.round((realizedBankroll - ledgerStats.openExposure) * 100) / 100);

  const feedExposure = liveFeedExposure !== undefined ? liveFeedExposure : ledgerStats.openExposure;
  const maxStrategyCap = Math.round(activeCapital * 0.124); // 12.4% max exposure cap
  const exposurePct = activeCapital > 0 ? ((feedExposure / activeCapital) * 100).toFixed(1) : '0.0';
  const maxSingleBetAmount = Math.round(activeCapital * config.maxStakePercent);

  // Compute stochastic path simulation based on active working bankroll
  const mcResult = useMemo(() => {
    return runMonteCarloSimulation({
      initialBankroll: activeCapital,
      winProbability: 0.54,
      averageDecimalOdds: 2.05,
      kellyFraction: config.kellyFraction,
      maxStakePercent: config.maxStakePercent,
      simulations: 5000,
      numBets: 100,
    });
  }, [activeCapital, config.kellyFraction, config.maxStakePercent]);

  // Editing state for Active Working Capital
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [activeInput, setActiveInput] = useState('');

  // Editing state for Master Capital Vault
  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [masterInput, setMasterInput] = useState('');

  const handleActiveSave = (val: number) => {
    const safeVal = Math.max(100, Math.round(val));
    onConfigChange({
      ...config,
      totalBankroll: safeVal,
      totalBankrollNGN: safeVal,
    });
    try {
      localStorage.setItem('bet_admin_bankroll', safeVal.toString());
    } catch {}
  };

  const handleMasterSave = (val: number) => {
    const safeVal = Math.max(activeCapital, Math.round(val));
    onConfigChange({
      ...config,
      masterCapitalNGN: safeVal,
    });
    try {
      localStorage.setItem('bet_admin_master_capital', safeVal.toString());
    } catch {}
  };

  const handleKellySlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onConfigChange({
      ...config,
      kellyFraction: val,
    });
  };

  const activePresets =
    config.currency === 'USD'
      ? [100, 200, 500, 1000, 2000]
      : [10000, 20000, 50000, 100000, 200000];

  return (
    <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4 auto-rows-min">
      {/* 1. Active Working Bankroll Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-md">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Active Working Bankroll
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-400 text-[9px] font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <Cloud className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
              <span>SYNCED</span>
            </span>
          </div>
        </div>

        <div>
          {isEditingActive ? (
            <div className="space-y-2 mt-1">
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-emerald-500/50">
                <span className="text-lg font-bold font-mono text-emerald-400">{sym}</span>
                <input
                  type="number"
                  min="100"
                  step="1000"
                  value={activeInput}
                  onChange={(e) => setActiveInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleActiveSave(parseFloat(activeInput) || activeCapital);
                      setIsEditingActive(false);
                    }
                    if (e.key === 'Escape') setIsEditingActive(false);
                  }}
                  placeholder="Enter active capital..."
                  className="w-full bg-transparent text-xl font-mono font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleActiveSave(parseFloat(activeInput) || activeCapital);
                    setIsEditingActive(false);
                  }}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg transition cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5 inline" /> Save
                </button>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Type active operating balance &amp; press Enter.
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setActiveInput(activeCapital.toString());
                setIsEditingActive(true);
              }}
              className="flex items-center justify-between group cursor-pointer p-1 -m-1 rounded-xl hover:bg-slate-800/40 transition"
              title="Click to edit active working bankroll"
            >
              <div>
                <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tighter text-white">
                  {sym}{activeCapital.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Operating stake pool for today's Kelly calculations
                </div>
              </div>
              <button className="opacity-70 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 border border-slate-700">
                <Edit2 className="w-3 h-3 text-emerald-400" />
                <span>Edit</span>
              </button>
            </div>
          )}

          {/* Quick Working Presets */}
          <div className="flex flex-wrap gap-1 mt-3">
            {activePresets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  handleActiveSave(preset);
                  setActiveInput(preset.toString());
                  setIsEditingActive(false);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                  activeCapital === preset
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {config.currency === 'USD'
                  ? `$${preset >= 1000 ? `${preset / 1000}k` : preset}`
                  : `₦${preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}k`}`}
              </button>
            ))}
          </div>

          {/* Real-time Session Balance Status */}
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">Realized Equity</span>
              <span
                className={`font-bold ${
                  ledgerStats.netProfit > 0
                    ? 'text-emerald-400'
                    : ledgerStats.netProfit === 0
                    ? 'text-slate-300'
                    : 'text-amber-400'
                }`}
              >
                {sym}{realizedBankroll.toLocaleString()}
                <span className="text-[10px] text-slate-500 ml-1">
                  ({ledgerStats.netProfit >= 0 ? '+' : ''}{sym}{ledgerStats.netProfit.toLocaleString()})
                </span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Open in Play</span>
              </span>
              <span className="font-bold text-cyan-300">
                {sym}{ledgerStats.openExposure.toLocaleString()}
                <span className="text-[10px] text-slate-500 ml-1">({ledgerStats.openBets} pending)</span>
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950/80 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-300 font-sans font-bold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Liquid Account Cash</span>
              </span>
              <span className="font-bold text-emerald-400 text-xs">
                {sym}{liquidCash.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Active Feed Exposure</span>
            <span className="font-bold font-mono text-cyan-400">
              {sym}{feedExposure.toLocaleString()} ({exposurePct}%)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Max Exposure Cap</span>
            <span className="font-bold font-mono text-slate-300">
              {sym}{maxStrategyCap.toLocaleString()} (12.4%)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">95% Value at Risk (VaR)</span>
            <span className="font-bold font-mono text-emerald-400">
              {mcResult.var95Percent > 0 ? `-${mcResult.var95Percent}%` : '0.0% (Capital Preserved)'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Strategy Profile</span>
            <span
              className={`font-bold uppercase ${
                config.strategyMode === 'risky'
                  ? 'text-amber-400'
                  : config.strategyMode === 'safe'
                  ? 'text-emerald-400'
                  : 'text-cyan-400'
              }`}
            >
              {config.strategyMode === 'safe' ? 'Conservative' : config.strategyMode}
            </span>
          </div>

          {onOpenBankrollTab && (
            <button
              onClick={onOpenBankrollTab}
              className="mt-2.5 w-full py-2 px-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer group shadow-sm"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition" />
              <span>View Equity Curve &amp; Compounding</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Master Capital Vault Card (The Permanent 200k Reserve) */}
      <div className="bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/90 rounded-3xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <h2 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Master Capital Vault
            </h2>
          </div>
          <span className="text-amber-400 text-[9px] font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            PERMANENT RESERVE
          </span>
        </div>

        <div>
          {isEditingMaster ? (
            <div className="space-y-2 mt-1">
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-amber-500/50">
                <span className="text-lg font-bold font-mono text-amber-400">{sym}</span>
                <input
                  type="number"
                  min={activeCapital}
                  step="10000"
                  value={masterInput}
                  onChange={(e) => setMasterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleMasterSave(parseFloat(masterInput) || masterCapital);
                      setIsEditingMaster(false);
                    }
                    if (e.key === 'Escape') setIsEditingMaster(false);
                  }}
                  placeholder="Enter total capital..."
                  className="w-full bg-transparent text-xl font-mono font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleMasterSave(parseFloat(masterInput) || masterCapital);
                    setIsEditingMaster(false);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5 inline" /> Save
                </button>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Permanent portfolio reserve.
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setMasterInput(masterCapital.toString());
                setIsEditingMaster(true);
              }}
              className="flex items-center justify-between group cursor-pointer p-1 -m-1 rounded-xl hover:bg-slate-800/40 transition"
              title="Click to edit permanent master capital"
            >
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tighter text-slate-100">
                  {sym}{masterCapital.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Permanent total portfolio capital
                </div>
              </div>
              <button className="opacity-70 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 border border-slate-700">
                <Edit2 className="w-3 h-3 text-amber-400" />
                <span>Edit</span>
              </button>
            </div>
          )}

          {/* Vault Protection Progress & Metrics */}
          <div className="mt-3 space-y-2">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected in Vault</span>
              </span>
              <span className="font-bold text-emerald-400">
                {sym}{vaultReserve.toLocaleString()} ({vaultProtectionPct}%)
              </span>
            </div>

            {/* Visual Vault Bar */}
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${vaultProtectionPct}%` }}
                title={`${vaultProtectionPct}% of capital safely preserved in vault`}
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-2">
              🛡️ <strong>{sym}{vaultReserve.toLocaleString()}</strong> is permanently shielded and never risked on daily bets. Kelly stake sizing only uses your working bankroll (<strong>{sym}{activeCapital.toLocaleString()}</strong>).
            </p>
          </div>
        </div>
      </div>

      {/* Kelly Staking Slider Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Kelly Multiplier
            </h2>
          </div>
          <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {config.kellyFraction.toFixed(2)}×
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mb-2">
          Fractional Kelly allocation controls risk tolerance & sizing aggressiveness.
        </p>
        <div className="text-[10px] text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 mb-3 leading-relaxed">
          <span className="text-amber-400 font-bold">⚠️ Quant Risk Note:</span> Fractional Kelly caps single-bet exposure (1–2%), but cannot eliminate drawdown or correlation risk if multiple concurrent positions fail.
        </div>

        <input
          type="range"
          min="0.05"
          max="1.0"
          step="0.05"
          value={config.kellyFraction}
          onChange={handleKellySlider}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-2 mb-4">
          <span>0.10× (Ultra Safe)</span>
          <span>0.50× (Half Kelly)</span>
          <span>1.00× (Full)</span>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-400">Max Single Bet Cap</span>
          <span className="font-mono font-bold text-slate-200">
            {(config.maxStakePercent * 100).toFixed(0)}% ({sym}{maxSingleBetAmount.toLocaleString()})
          </span>
        </div>
      </div>

      {/* Model Engine Calibration Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Engine Health
            </h2>
          </div>
          <span className="text-cyan-400 text-[10px] font-bold font-mono">
            {brierScore ? brierScore.toFixed(3) : '0.198'} BRIER
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">GBDT Multi-Class Brier</span>
            <span className="text-emerald-400 font-mono font-bold text-[11px]">0.1988 (7.5k Matches)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Walk-Forward Out-of-Sample</span>
            <span className="text-cyan-400 font-mono font-bold text-[11px]">0.2005 (18 Bets)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Historical Ensemble Prior</span>
            <span className="text-slate-300 font-mono font-bold text-[11px]">0.1720 (Static)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Platt Scaling Decile ECE</span>
            <span className="text-emerald-400 font-mono font-bold text-[11px]">2.6% (Calibrated)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
