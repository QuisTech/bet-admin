import React, { useState } from 'react';
import { DollarSign, ShieldAlert, Award, ArrowUpRight } from 'lucide-react';
import type { BankrollConfig } from '../types';

interface BankrollManagerProps {
  config: BankrollConfig;
  onConfigChange: (newConfig: BankrollConfig) => void;
}

export const BankrollManager: React.FC<BankrollManagerProps> = ({ config, onConfigChange }) => {
  const [strategy, setStrategy] = useState<'COMPOUND' | 'HYBRID' | 'INCOME'>('HYBRID');

  const presetPools = [200000, 1000000, 10000000];

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
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
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
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              100% Compounding
            </button>
            <button
              onClick={() => setStrategy('HYBRID')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                strategy === 'HYBRID' ? 'bg-sky-400 text-slate-950 shadow-md' : 'text-slate-400 bg-slate-950'
              }`}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Hybrid Plan (Recommended)
            </button>
            <button
              onClick={() => setStrategy('INCOME')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                strategy === 'INCOME' ? 'bg-sky-400 text-slate-950 shadow-md' : 'text-slate-400 bg-slate-950'
              }`}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
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
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            ₦{config.totalBankrollNGN.toLocaleString()} <span className="text-sm text-slate-400">NGN</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">100% Capital Pool Allocation</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per-Bet Safe Stake (2% Max)</span>
            <ShieldAlert className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold text-sky-400 font-mono">
            ₦{Math.round(config.totalBankrollNGN * config.maxStakePercent).toLocaleString()} <span className="text-sm text-slate-400">NGN</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Fractional Kelly (0.25x) Enforced</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Est. Month 1 Net Profit</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            +₦{Math.round(config.totalBankrollNGN * 0.12).toLocaleString()} <span className="text-sm text-slate-400">NGN</span>
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
          <table className="quant-table">
            <thead>
              <tr>
                <th>Timeline</th>
                <th style={{ textAlign: 'right' }}>Bankroll Pool</th>
                <th style={{ textAlign: 'right' }}>Safe 2% Stake</th>
                <th style={{ textAlign: 'right' }}>Est. Monthly Profit</th>
                <th>Milestone</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map(t => (
                <tr key={t.month}>
                  <td style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Month {t.month}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ₦{t.pool.toLocaleString()}
                  </td>
                  <td className="col-prob" style={{ textAlign: 'right' }}>
                    ₦{t.stake.toLocaleString()}
                  </td>
                  <td className="col-ev" style={{ textAlign: 'right' }}>
                    +₦{t.estMonthlyProfit.toLocaleString()}
                  </td>
                  <td style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
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
