import React from 'react';
import { Flame, Clock, ArrowUpRight } from 'lucide-react';
import type { MatchData } from '../types';

interface TopPicksColumnProps {
  matches: MatchData[];
  onSelectMatch: (match: MatchData) => void;
  isLive?: boolean;
  oddsSource?: string;
}

export const TopPicksColumn: React.FC<TopPicksColumnProps> = ({
  matches,
  onSelectMatch,
  isLive = false,
  oddsSource = 'Pinnacle Benchmark',
}) => {
  // Extract all value bets across all matches and sort by highest EV edge
  const allBargains = matches
    .flatMap((m) =>
      m.markets
        .filter((market) => market.evPercent > 0)
        .map((market) => ({
          match: m,
          market,
        }))
    )
    .sort((a, b) => b.market.evPercent - a.market.evPercent)
    .slice(0, 5);

  return (
    <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4 auto-rows-min">
      {/* Top Value Picks (+EV) Card matching uefa-admin Top Value Picks */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-400" />
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Top Value Picks (+EV)
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                isLive ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
              {isLive ? 'LIVE CAPTURE' : 'BASELINE SLATE'}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 mb-3 font-mono flex items-center justify-between">
          <span>Ranked by model EV edge.</span>
          <span className="text-[9px] text-slate-400 font-mono">
            {oddsSource.includes('Live') ? 'LIVE' : 'REF'}: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} WAT
          </span>
        </div>

        <div className="space-y-3 flex-grow">
          {allBargains.map((item, idx) => {
            const prob = item.market.consensusProb ?? item.market.ensembleProb;
            const winProb = (prob * 100).toFixed(1);
            const breakevenProb = ((1 / item.market.sportyBetOdds) * 100).toFixed(1);
            const isHighVariance = item.market.sportyBetOdds >= 2.50;

            return (
              <div
                key={`${item.match.id}-${item.market.selection}-${idx}`}
                onClick={() => onSelectMatch(item.match)}
                className="flex items-center justify-between border-b border-slate-800 pb-2.5 last:border-0 last:pb-0 hover:bg-slate-800/40 p-2 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {item.market.selection}
                    </span>
                    <span
                      className={`text-[8px] font-mono px-1 rounded uppercase font-bold ${
                        isHighVariance
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                          : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                      }`}
                    >
                      {isHighVariance ? 'High Var' : 'Mod Var'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">
                    {item.match.homeTeam} vs {item.match.awayTeam}
                  </span>
                  <div className="text-[9px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>@{item.market.sportyBetOdds.toFixed(2)}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">P: {winProb}%</span>
                    <span>•</span>
                    <span className="text-slate-400">BE: {breakevenProb}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    +{item.market.evPercent.toFixed(1)}%
                  </span>
                  <div className="text-[8px] text-slate-500 uppercase font-bold">Edge EV</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixtures Schedule Card matching uefa-admin FixtureList */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Match Schedule
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">LIVE / UPCOMING</span>
        </div>

        <div className="space-y-3">
          {matches.slice(0, 4).map((m) => (
            <div
              key={m.id}
              onClick={() => onSelectMatch(m)}
              className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                <span className="font-semibold text-emerald-400">{m.league}</span>
                <span className="font-mono">{m.kickoff}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-white mb-2">
                <span>{m.homeTeam}</span>
                <span className="text-[10px] text-slate-500">VS</span>
                <span>{m.awayTeam}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
                <span>xG: {m.homeXG.toFixed(2)} - {m.awayXG.toFixed(2)}</span>
                <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                  Analyze <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
