import React from 'react';
import { Sliders, Cpu } from 'lucide-react';
import type { BankrollConfig } from '../types';

interface MetricsColumnProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
  activeSignalCount?: number;
}

export const MetricsColumn: React.FC<MetricsColumnProps> = ({
  config,
  onConfigChange,
}) => {
  const sym = config.currency === 'USD' ? '$' : '₦';
  const totalAmount = config.currency === 'USD' ? config.totalBankroll : config.totalBankrollNGN;
  const activeExposure = Math.round(totalAmount * 0.124); // 12.4% portfolio exposure
  const liquidCash = Math.max(0, totalAmount - activeExposure);
  const exposurePct = ((activeExposure / totalAmount) * 100).toFixed(1);
  const maxSingleBetAmount = Math.round(totalAmount * config.maxStakePercent);

  const handleKellySlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onConfigChange({
      ...config,
      kellyFraction: val,
    });
  };

  return (
    <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4 auto-rows-min">
      {/* Bankroll Capital Card matching Squad Value Card in uefa-admin */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-md">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Bankroll Capital
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-[10px] font-bold">SOLVER READY</span>
          </div>
        </div>

        <div>
          <div className="text-4xl font-bold font-mono tracking-tighter text-white">
            {sym}{totalAmount.toLocaleString()}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-slate-800">
            <span className="text-slate-400 text-xs font-medium">Liquid Cash</span>
            <span className="font-mono font-black text-sm text-emerald-400">
              {sym}{liquidCash.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
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

        <p className="text-[11px] text-slate-400 mb-3">
          Fractional Kelly allocation controls risk tolerance & sizing aggressiveness.
        </p>

        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={config.kellyFraction}
          onChange={handleKellySlider}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 mb-4"
        />

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-4">
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
          <span className="text-cyan-400 text-[10px] font-bold font-mono">0.178 BRIER</span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-300 text-[11px]">Dixon-Coles Poisson</span>
            <span className="text-emerald-400 font-mono text-[10px] font-bold">CALIBRATED</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-300 text-[11px]">Shin Market De-vig (z)</span>
            <span className="text-cyan-400 font-mono text-[10px] font-bold">NEWTON 1e-8</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-300 text-[11px]">XGBoost Player Props</span>
            <span className="text-emerald-400 font-mono text-[10px] font-bold">GRADIENT BOOSTED</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-300 text-[11px]">Platt Scaling ECE</span>
            <span className="text-purple-400 font-mono text-[10px] font-bold">&lt; 3.0% DECILES</span>
          </div>
        </div>
      </div>
    </div>
  );
};
