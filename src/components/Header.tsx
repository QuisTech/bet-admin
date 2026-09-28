import React from 'react';
import { Globe, Trophy } from 'lucide-react';
import type { BankrollConfig } from '../types';
import { SUPPORTED_LEAGUES } from '../types';
import { STRATEGY_MODES } from '../models/strategyMode';

interface HeaderProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
  activeSignalCount: number;
  averageEV?: number;
  brierScore?: number;
  onOpenSettings?: () => void;
  isOddsLive?: boolean;
  isFplLive?: boolean;
  selectedLeagueId: string;
  onLeagueChange: (leagueId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onConfigChange,
  activeSignalCount,
  averageEV = 0,
  brierScore = 0.174,
  onOpenSettings,
  isOddsLive = false,
  isFplLive = false,
  selectedLeagueId,
  onLeagueChange,
}) => {
  return (
    <header className="col-span-12 flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between mb-4">
      {/* Title & Branding */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-700 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-500/20 shrink-0">
          B
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              BET <span className="text-emerald-400 font-black">HORIZON</span>
            </h1>
            <span className="bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">
              QUANT V3
            </span>
            <span className="bg-slate-900 text-emerald-400 text-[8px] font-mono px-2 py-0.5 rounded border border-emerald-500/30">
              DUAL ML ENGINE
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-light uppercase tracking-widest">
            Institutional Sports Betting & Multi-League +EV Optimization Engine
          </p>
        </div>
      </div>

      {/* Controls Bar matching uefa-admin / fpl-admin */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between xl:justify-end gap-3 sm:gap-4 bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-800 w-full xl:w-auto">
        <div className="flex flex-wrap items-stretch sm:items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full xl:w-auto">
          {/* Global League Selector */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 text-left sm:text-right font-medium flex items-center gap-1">
              <Trophy className="w-3 h-3 text-emerald-400 inline" />
              Active League
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg mt-1 border border-slate-800">
              <select
                value={selectedLeagueId}
                onChange={(e) => onLeagueChange(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-emerald-400 focus:outline-none cursor-pointer px-1.5 py-0.5"
              >
                {SUPPORTED_LEAGUES.map((l) => (
                  <option key={l.id} value={l.id} className="bg-slate-900 text-slate-200">
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Strategy Mode Toggle */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 text-left sm:text-right font-medium">
              Strategy Mode
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg mt-1 border border-slate-800">
              {(['safe', 'risky', 'value'] as const).map((modeKey) => {
                const mode = STRATEGY_MODES[modeKey];
                const active = config.strategyMode === modeKey;
                const activeColor =
                  modeKey === 'safe'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : modeKey === 'risky'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-cyan-500 text-slate-950 shadow';

                return (
                  <button
                    key={modeKey}
                    onClick={() =>
                      onConfigChange({
                        ...config,
                        strategyMode: modeKey,
                        kellyFraction: mode.kellyMultiplier,
                        maxStakePercent: mode.maxStakePercent,
                      })
                    }
                    className={`px-2.5 py-1 text-[10px] rounded font-extrabold uppercase transition-all cursor-pointer ${
                      active ? activeColor : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {modeKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency Toggle */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 text-left sm:text-right font-medium">
              Currency
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg mt-1 border border-slate-800">
              <button
                onClick={() => onConfigChange({ ...config, currency: 'NGN' })}
                className={`px-2 py-1 text-[10px] rounded font-bold transition-all cursor-pointer ${
                  config.currency !== 'USD'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ₦ NGN
              </button>
              <button
                onClick={() => onConfigChange({ ...config, currency: 'USD' })}
                className={`px-2 py-1 text-[10px] rounded font-bold transition-all cursor-pointer ${
                  config.currency === 'USD'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                $ USD
              </button>
            </div>
          </div>

          {/* Model Odds Feed & Settings Toggle */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 text-left sm:text-right font-medium">
              Data Feeds
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-extrabold rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500/40 transition cursor-pointer"
              >
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>{isOddsLive ? 'LIVE ODDS' : 'SHIN PINNACLE'}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFplLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="h-px xl:h-8 w-full xl:w-px bg-slate-800 my-1 xl:my-0"></div>

        {/* Expected Yield / Signal Count */}
        <div className="flex items-center justify-between xl:justify-end gap-4 xl:gap-6 w-full xl:w-auto">
          <div className="flex flex-col text-left xl:text-right">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Projected Edge
            </span>
            <div className="flex items-baseline gap-1.5 xl:justify-end">
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  averageEV > 0
                    ? 'text-emerald-400'
                    : averageEV < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {averageEV > 0 ? '+' : ''}
                {averageEV.toFixed(1)}% EV
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 hidden sm:inline">
              {activeSignalCount} Active Opportunities • Brier {brierScore.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
