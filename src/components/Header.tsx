import React, { useState } from 'react';
import { DollarSign, Shield, TrendingUp, Cpu, Info, Zap } from 'lucide-react';
import type { BankrollConfig } from '../types';
import { STRATEGY_MODES } from '../models/strategyMode';

interface HeaderProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
  activeTab: 'feed' | 'bankroll' | 'models';
  setActiveTab: (tab: 'feed' | 'bankroll' | 'models') => void;
  riskMode: 'safe' | 'aggressive' | 'value';
  setRiskMode: (mode: 'safe' | 'aggressive' | 'value') => void;
  fuel: 'dixon-coles' | 'xgboost' | 'market-fusion';
  setFuel: (fuel: 'dixon-coles' | 'xgboost' | 'market-fusion') => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onConfigChange,
  activeTab,
  setActiveTab,
  riskMode,
  setRiskMode,
  fuel,
  setFuel
}) => {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  const presetBankrolls = [
    { label: '₦200k (Starter Pool)', value: 200000 },
    { label: '₦1.2M (Mid-Tier Scale)', value: 1200000 },
    { label: '₦10M (Quant Fund)', value: 10000000 }
  ];

  const currentStrategy = STRATEGY_MODES[riskMode];

  return (
    <header className="w-full flex flex-col gap-4 mb-6 relative z-30">
      {/* Brand Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl glass-card bg-slate-900/80">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-fpl-purple rounded-xl flex items-center justify-center font-black text-2xl text-fpl-green shadow-xl shrink-0">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">
                BET <span className="gradient-title">HORIZON</span>
              </h1>
              <span className="bg-fpl-pink text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                QUANT ENGINE
              </span>
              <span className="bg-slate-950 text-fpl-green text-[9px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Zap className="w-3 h-3 text-fpl-green fill-fpl-green animate-pulse" />
                AI POWERED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">
              Multi-Horizon Expected Value (+EV) & Fractional Kelly Staking Platform
            </p>
          </div>
        </div>

        {/* Bankroll Pool Selector Box */}
        <div className="flex items-center gap-3 bg-slate-950/90 rounded-xl p-2 px-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <DollarSign className="w-4 h-4 text-fpl-green" />
            <span>Bankroll Pool:</span>
          </div>
          <select
            value={config.totalBankrollNGN}
            onChange={(e) => onConfigChange({ ...config, totalBankrollNGN: Number(e.target.value) })}
            className="bg-slate-900 text-fpl-green font-extrabold text-sm border-none rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
          >
            {presetBankrolls.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <div className="h-5 w-px bg-slate-800/80 mx-1" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400">Max Bet Stake:</span>
            <span className="text-sm font-extrabold text-fpl-green">
              ₦{(config.totalBankrollNGN * currentStrategy.maxStakePercent).toLocaleString()} NGN
            </span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl glass-card relative z-20">
        {/* Left Side: Toggles */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-4 sm:gap-6">
          
          {/* Strategy Mode Toggle with Rationale Tooltip */}
          <div className="flex flex-col relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                Strategy Mode
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="text-slate-400 hover:text-fpl-green transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </span>
              <span className="text-[10px] text-fpl-green font-bold">{(currentStrategy.maxStakePercent * 100).toFixed(0)}% Max Stake</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl mt-1">
              <button
                onClick={() => setRiskMode('safe')}
                className={`px-3.5 py-1.5 text-xs rounded-lg font-black transition-all ${
                  riskMode === 'safe' ? 'bg-fpl-green text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SAFE (1%)
              </button>
              <button
                onClick={() => setRiskMode('value')}
                className={`px-3.5 py-1.5 text-xs rounded-lg font-black transition-all ${
                  riskMode === 'value' ? 'bg-sky-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                VALUE (2%)
              </button>
              <button
                onClick={() => setRiskMode('aggressive')}
                className={`px-3.5 py-1.5 text-xs rounded-lg font-black transition-all ${
                  riskMode === 'aggressive' ? 'bg-fpl-pink text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                RISKY (3%)
              </button>
            </div>

            {/* Rationale Tooltip Popover */}
            {showTooltip && (
              <div className="absolute top-full left-0 mt-2 z-50 w-80 sm:w-96 p-4 rounded-xl bg-slate-950/95 backdrop-blur-xl text-xs shadow-2xl space-y-2 border border-slate-800">
                <div className="font-extrabold text-fpl-green text-sm">{currentStrategy.name}</div>
                <p className="text-slate-300 leading-relaxed">{currentStrategy.description}</p>
                <div className="p-2.5 rounded bg-slate-900 text-[11px] text-slate-400">
                  <strong className="text-sky-400">Mathematical Justification:</strong> {currentStrategy.justification}
                </div>
              </div>
            )}
          </div>

          {/* Fuel Source Toggle */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Fuel Engine</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl mt-1">
              <button
                onClick={() => setFuel('dixon-coles')}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                  fuel === 'dixon-coles' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                DIXON-COLES
              </button>
              <button
                onClick={() => setFuel('xgboost')}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                  fuel === 'xgboost' ? 'bg-fpl-pink text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                XGBOOST ML
              </button>
              <button
                onClick={() => setFuel('market-fusion')}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                  fuel === 'market-fusion' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MARKET-FUSION
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              activeTab === 'feed'
                ? 'bg-fpl-green text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            +EV Feed
          </button>
          <button
            onClick={() => setActiveTab('bankroll')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              activeTab === 'bankroll'
                ? 'bg-fpl-green text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Bankroll Manager
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              activeTab === 'models'
                ? 'bg-fpl-green text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Diagnostics
          </button>
        </nav>
      </div>
    </header>
  );
};

