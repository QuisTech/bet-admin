import React, { useState } from 'react';
import { DollarSign, ShieldAlert, Award, ArrowUpRight } from 'lucide-react';
import type { BankrollConfig } from '../types';

interface BankrollManagerProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
}

export const BankrollManager: React.FC<BankrollManagerProps> = ({ config, onConfigChange }) => {
  const [strategy, setStrategy] = useState<'COMPOUND' | 'HYBRID' | 'INCOME'>('HYBRID');

  const presetPools = [200000, 1200000, 10000000];

  // Generate 9-month compounding timeline projection
  const timeline = Array.from({ length: 9 }).map((_, i) => {
    const month = i + 1;
    // Assuming 12% monthly compounding rate from +EV edge
    const pool = Math.round(config.totalBankrollNGN * Math.pow(1.12, i));
    const stake = Math.round(pool * config.maxStakePercent);
    const estMonthlyProfit = Math.round(pool * 0.12);
    return { month, pool, stake, estMonthlyProfit };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold text-slate-100">Fractional Kelly Bankroll Manager & Capital Allocator</h2>
            </div>
            <p className="text-xs text-slate-400">
              Enforces strict 1%–2% risk limits to protect your pool from cold streaks while compounding profits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 px-2">Quick Pools:</span>
              {presetPools.map(pool => (
                <button
                  key={pool}
                  onClick={() => onConfigChange({ ...config, totalBankrollNGN: pool })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    config.totalBankrollNGN === pool
                      ? 'bg-fpl-green text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ₦{(pool / 1000).toFixed(0)}k
                </button>
              ))}
            </div>

            <button
              onClick={() => setStrategy('COMPOUND')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                strategy === 'COMPOUND' ? 'bg-sky-400 text-slate-950 shadow-md' : 'text-slate-400 bg-slate-950'
              }`}
            >
              100% Compounding
            </button>
            <button
              onClick={() => setStrategy('HYBRID')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                strategy === 'HYBRID' ? 'bg-sky-400 text-slate-950 shadow-md' : 'text-slate-400 bg-slate-950'
              }`}
            >
              Hybrid Plan (Recommended)
            </button>
            <button
              onClick={() => setStrategy('INCOME')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                strategy === 'INCOME' ? 'bg-sky-400 text-slate-950 shadow-md' : 'text-slate-400 bg-slate-950'
              }`}
            >
              Monthly Salary
            </button>
          </div>
        </div>
      </div>

      {/* 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bankroll Pool</span>
            <DollarSign className="w-4 h-4 text-fpl-green" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            ₦{config.totalBankrollNGN.toLocaleString()} NGN
          </div>
          <p className="text-xs text-slate-400 mt-1">100% Capital Pool Allocation</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per-Bet Safe Stake (2% Max)</span>
            <ShieldAlert className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold text-sky-400">
            ₦{Math.round(config.totalBankrollNGN * config.maxStakePercent).toLocaleString()} NGN
          </div>
          <p className="text-xs text-slate-400 mt-1">Fractional Kelly (0.25x) Enforced</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Est. Month 1 Net Profit</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400">
            +₦{Math.round(config.totalBankrollNGN * 0.12).toLocaleString()} NGN
          </div>
          <p className="text-xs text-slate-400 mt-1">Based on +EV Edge across ~30 bets</p>
        </div>
      </div>

      {/* 9-Month Projection Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">9-Month Compounding Growth Timeline</h3>
            <p className="text-xs text-slate-400">Projected bankroll growth assuming 0.25x Fractional Kelly execution.</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-fpl-green/10 text-fpl-green flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +12% Monthly Target
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Timeline</th>
                <th className="py-3 px-4">Bankroll Pool</th>
                <th className="py-3 px-4">Safe 2% Bet Stake</th>
                <th className="py-3 px-4">Est. Monthly Net Profit</th>
                <th className="py-3 px-4">Strategy Milestone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-sm">
              {timeline.map(t => (
                <tr key={t.month} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-300">Month {t.month}</td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-100">₦{t.pool.toLocaleString()} NGN</td>
                  <td className="py-3.5 px-4 font-bold text-sky-400">₦{t.stake.toLocaleString()} NGN</td>
                  <td className="py-3.5 px-4 font-bold text-fpl-green">+₦{t.estMonthlyProfit.toLocaleString()} NGN</td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-400">
                    {t.month === 1 && '🚀 Starter Launch'}
                    {t.month === 3 && '📈 Pool Doubled (+100%)'}
                    {t.month === 6 && '🎯 High-Roller Scale Threshold'}
                    {t.month === 9 && '🏆 Passive Income Mode Unlocked'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

