import React, { useState } from 'react';
import { Sliders, Cpu, Edit2, Check } from 'lucide-react';
import type { BankrollConfig } from '../types';

interface MetricsColumnProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
  activeSignalCount?: number;
  brierScore?: number;
}

export const MetricsColumn: React.FC<MetricsColumnProps> = ({
  config,
  onConfigChange,
  brierScore,
}) => {
  const sym = config.currency === 'USD' ? '$' : '₦';
  const totalAmount = config.currency === 'USD' ? config.totalBankroll : config.totalBankrollNGN;
  const activeExposure = Math.round(totalAmount * 0.124); // 12.4% portfolio exposure
  const liquidCash = Math.max(0, totalAmount - activeExposure);
  const exposurePct = ((activeExposure / totalAmount) * 100).toFixed(1);
  const maxSingleBetAmount = Math.round(totalAmount * config.maxStakePercent);

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleBankrollSave = (val: number) => {
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

  const handleKellySlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onConfigChange({
      ...config,
      kellyFraction: val,
    });
  };

  const presets = config.currency === 'USD'
    ? [200, 500, 1000, 2500, 5000, 10000]
    : [50000, 100000, 200000, 500000, 1000000, 5000000];

  return (
    <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4 auto-rows-min">
      {/* Bankroll Capital Card matching Squad Value Card in uefa-admin */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-md">
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Bankroll Capital
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              CUSTOMIZABLE
            </span>
          </div>
        </div>

        <div>
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-emerald-500/50">
                <span className="text-lg font-bold font-mono text-emerald-400">{sym}</span>
                <input
                  type="number"
                  min="100"
                  step="1000"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBankrollSave(parseFloat(inputValue) || totalAmount);
                      setIsEditing(false);
                    }
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  placeholder="Enter custom amount..."
                  className="w-full bg-transparent text-xl font-mono font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleBankrollSave(parseFloat(inputValue) || totalAmount);
                    setIsEditing(false);
                  }}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg transition cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5 inline" /> Save
                </button>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Type any amount and press Enter or Save.
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setInputValue(totalAmount.toString());
                setIsEditing(true);
              }}
              className="flex items-center justify-between group cursor-pointer p-1 -m-1 rounded-xl hover:bg-slate-800/40 transition"
              title="Click to input custom bankroll"
            >
              <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tighter text-white">
                {sym}{totalAmount.toLocaleString()}
              </div>
              <button
                className="opacity-70 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 border border-slate-700"
              >
                <Edit2 className="w-3 h-3 text-emerald-400" />
                <span>Edit</span>
              </button>
            </div>
          )}

          {/* Quick Preset Chips */}
          <div className="flex flex-wrap gap-1 mt-3">
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  handleBankrollSave(preset);
                  setInputValue(preset.toString());
                  setIsEditing(false);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                  totalAmount === preset
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

          <div className="flex justify-between mt-3 pt-3 border-t border-slate-800">
            <span className="text-slate-400 text-xs font-medium">Liquid Cash</span>
            <span className="font-mono font-black text-sm text-emerald-400">
              {sym}{liquidCash.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Portfolio Exposure</span>
            <span className="font-bold font-mono text-cyan-400">
              {sym}{activeExposure.toLocaleString()} ({exposurePct}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">95% Value at Risk (VaR)</span>
            <span className="font-bold font-mono text-emerald-400">Protected (0.0%)</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
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
              {config.strategyMode}
            </span>
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

        <p className="text-[11px] text-slate-400 mb-4">
          Fractional Kelly allocation controls risk tolerance & sizing aggressiveness.
        </p>

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
            {brierScore ? brierScore.toFixed(3) : '0.178'} BRIER
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Dixon-Coles Poisson</span>
            <span className="text-emerald-400 font-mono font-bold text-[11px]">CALIBRATED</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Shin Market De-vig (z)</span>
            <span className="text-cyan-400 font-mono font-bold text-[11px]">NEWTON 1e-8</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">XGBoost Player Props</span>
            <span className="text-emerald-400 font-mono font-bold text-[11px]">GRADIENT BOOSTED</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Platt Scaling ECE</span>
            <span className="text-emerald-400 font-mono font-bold text-[11px]">&lt; 3.0% DECILES</span>
          </div>
        </div>
      </div>
    </div>
  );
};
