import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Layers,
  Terminal,
  Bookmark,
  Check,
  Copy,
  TrendingUp,
  BookmarkPlus,
  Trash2,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import type { BankrollConfig } from '../types';
import { calculateShinDevig } from '../models/shinDevig';
import { calculateKellyStake, calculateEV } from '../models/evEngine';
import { addLoggedBet } from '../services/ledgerService';
import {
  parseOddsPortalText,
  getWholePageOddsPortalScript,
  generateWholePageBookmarklet,
  type ParsedOddsMatch,
} from '../services/oddsTextParser';

interface BatchSlateModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BankrollConfig;
  initialMatches?: ParsedOddsMatch[];
  onPositionLogged?: () => void;
}

export const BatchSlateModal: React.FC<BatchSlateModalProps> = ({
  isOpen,
  onClose,
  config,
  initialMatches,
  onPositionLogged,
}) => {
  const [matches, setMatches] = useState<ParsedOddsMatch[]>([]);
  const [retailBookmaker, setRetailBookmaker] = useState('1xBet');
  const [selectedWays, setSelectedWays] = useState<Record<number, 0 | 1 | 2>>({});
  const [retailOddsMap, setRetailOddsMap] = useState<Record<number, string>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'edgeOnly' | 'subZero'>('edgeOnly');
  const [sortBy, setSortBy] = useState<'edgeDesc' | 'kellyDesc' | 'original'>('edgeDesc');
  const [maxOddsCap, setMaxOddsCap] = useState<number>(5.0);
  const [loggedIndices, setLoggedIndices] = useState<Record<number, boolean>>({});
  const [bulkLoggedSuccess, setBulkLoggedSuccess] = useState(false);

  // Script & Drawer state
  const [rawPasteText, setRawPasteText] = useState('');
  const [showScriptDrawer, setShowScriptDrawer] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  const sym = config.currency === 'USD' ? '$' : '₦';
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bet-admin-iota.vercel.app';
  const cleanWholePageScript = useMemo(() => getWholePageOddsPortalScript(appOrigin), [appOrigin]);
  const wholePageBookmarklet = useMemo(() => generateWholePageBookmarklet(appOrigin), [appOrigin]);

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute('href', wholePageBookmarklet);
    }
  }, [wholePageBookmarklet, showScriptDrawer]);

  // Load initialMatches (e.g. from #importSlate=)
  useEffect(() => {
    if (initialMatches && initialMatches.length > 0 && isOpen) {
      setMatches(initialMatches);
      setLoggedIndices({});
    }
  }, [initialMatches, isOpen]);

  // Handle parsing when pasting into the raw text box
  const handleProcessPaste = (text: string) => {
    setRawPasteText(text);
    if (!text || text.trim().length === 0) return;
    const parsed = parseOddsPortalText(text);
    if (parsed.length > 0) {
      setMatches(parsed);
      setLoggedIndices({});
    }
  };

  const handleClipboardRead = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) handleProcessPaste(text);
      }
    } catch {
      const el = document.getElementById('slate-paste-input');
      if (el) el.focus();
    }
  };

  const handleCopyScript = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanWholePageScript);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    }
  };

  const handleCopyBookmarklet = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(wholePageBookmarklet);
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 3000);
    }
  };

  // Evaluate each match across Shin De-Vig
  const evaluatedSlate = useMemo(() => {
    return matches.map((m, idx) => {
      let fairOddsArr = [m.homeOdds, m.drawOdds, m.awayOdds];
      let fairProbArr = [1 / m.homeOdds, 1 / m.drawOdds, 1 / m.awayOdds];
      let margin = 0;

      try {
        const shin = calculateShinDevig([m.homeOdds, m.drawOdds, m.awayOdds]);
        fairOddsArr = shin.fairOdds;
        fairProbArr = shin.fairProbabilities;
        margin = Math.round(shin.margin * 10) / 10;
      } catch {
        fairOddsArr = fairOddsArr.map((o) => Math.round(o * 100) / 100);
      }

      // Calculate the edge for all 3 ways using default market odds
      const wayEdges = [0, 1, 2].map((way) => {
        const retail = way === 0 ? m.homeOdds : way === 1 ? m.drawOdds : m.awayOdds;
        const fo = fairOddsArr[way] || retail;
        return fo > 1.0 ? Math.round(((retail / fo) - 1.0) * 1000) / 10 : -100;
      });

      // Best way prioritizing realistic odds (within maxOddsCap)
      const validWays = [0, 1, 2].filter((way) => {
        const retail = way === 0 ? m.homeOdds : way === 1 ? m.drawOdds : m.awayOdds;
        return maxOddsCap === 999 || retail <= maxOddsCap;
      });

      let bestWay: 0 | 1 | 2 = 0;
      if (validWays.length > 0) {
        const validEdges = validWays.map((w) => wayEdges[w]);
        const maxValidEdge = Math.max(...validEdges);
        const bestValidIndex = validWays[validEdges.indexOf(maxValidEdge)];
        bestWay = (bestValidIndex >= 0 && bestValidIndex <= 2 ? bestValidIndex : 0) as 0 | 1 | 2;
      } else {
        const maxEdge = Math.max(...wayEdges);
        bestWay = (wayEdges.indexOf(maxEdge) as 0 | 1 | 2) || 0;
      }

      const maxEdge = wayEdges[bestWay];
      const hasAnyPositiveEdge = maxEdge > 0;

      // Current selected target way: User override, or default to best edge
      const targetWay = selectedWays[idx] !== undefined ? selectedWays[idx] : bestWay;

      const fairOdds = fairOddsArr[targetWay] || (targetWay === 0 ? m.homeOdds : targetWay === 1 ? m.drawOdds : m.awayOdds);
      const fairProb = fairProbArr[targetWay] || (1 / fairOdds);

      // Retail Price Taken: User custom override, or fallback to market line
      const defaultRetail = targetWay === 0 ? m.homeOdds : targetWay === 1 ? m.drawOdds : m.awayOdds;
      const userPrice = parseFloat(retailOddsMap[idx]);
      const priceTaken = !isNaN(userPrice) && userPrice > 1.0 ? userPrice : defaultRetail;

      // CLV Edge % for the CURRENT selection
      const clvPercent = fairOdds > 1.0
        ? Math.round(((priceTaken / fairOdds) - 1.0) * 1000) / 10
        : 0;

      // EV %
      const evPercent = calculateEV(fairProb, priceTaken);
      const isPositiveEV = evPercent > 0;

      // Kelly Staking
      const kelly = calculateKellyStake(fairProb, priceTaken, config);

      return {
        index: idx,
        match: m,
        targetWay,
        bestWay,
        wayEdges,
        maxEdge,
        hasAnyPositiveEdge,
        fairOdds,
        fairProb,
        margin,
        priceTaken,
        clvPercent,
        evPercent,
        isPositiveEV,
        kelly,
        isLogged: !!loggedIndices[idx],
      };
    });
  }, [matches, selectedWays, retailOddsMap, config, loggedIndices, maxOddsCap]);

  // Filtered views with STABLE sorting
  const filteredItems = useMemo(() => {
    let items = [...evaluatedSlate];

    // Filter by Max Odds Cap:
    if (maxOddsCap !== 999) {
      items = items.filter((item) => {
        if (filterMode === 'edgeOnly') {
          return item.priceTaken <= maxOddsCap && item.clvPercent > 0;
        }
        return item.priceTaken <= maxOddsCap;
      });
    } else {
      if (filterMode === 'edgeOnly') {
        items = items.filter((item) => item.hasAnyPositiveEdge || item.clvPercent > 0);
      } else if (filterMode === 'subZero') {
        items = items.filter((item) => !item.hasAnyPositiveEdge && item.clvPercent <= 0);
      }
    }

    if (sortBy === 'edgeDesc') {
      items.sort((a, b) => b.clvPercent - a.clvPercent);
    } else if (sortBy === 'kellyDesc') {
      items.sort((a, b) => b.kelly.stakeNGN - a.kelly.stakeNGN);
    }
    return items;
  }, [evaluatedSlate, filterMode, sortBy, maxOddsCap]);

  const positiveEdgeCount = useMemo(() => {
    return evaluatedSlate.filter((item) => item.clvPercent > 0 && (maxOddsCap === 999 || item.priceTaken <= maxOddsCap)).length;
  }, [evaluatedSlate, maxOddsCap]);

  const totalPositiveStake = useMemo(() => {
    return evaluatedSlate
      .filter((item) => item.clvPercent > 0 && !item.isLogged)
      .reduce((sum, item) => sum + item.kelly.stakeNGN, 0);
  }, [evaluatedSlate]);

  // Log single bet to ledger
  const handleLogSingle = (item: (typeof evaluatedSlate)[0]) => {
    const selectionName =
      item.targetWay === 0
        ? `${item.match.matchName.split(' vs ')[0] || 'Home'} Win (1)`
        : item.targetWay === 1
        ? 'Draw (X)'
        : `${item.match.matchName.split(' vs ')[1] || 'Away'} Win (2)`;

    const stake = item.kelly.stakeNGN > 0 ? item.kelly.stakeNGN : 200;

    addLoggedBet({
      league: item.match.league || 'OddsPortal Slate Ingest',
      match: item.match.matchName,
      selection: selectionName,
      marketType: '1X2',
      bookmaker: retailBookmaker.trim() || 'Retail Book',
      priceTaken: item.priceTaken,
      pinnacleLineAtBet: item.fairOdds,
      pinnacleClosingLine: item.fairOdds,
      modelProb: item.fairProb,
      modelEV: item.evPercent,
      stake,
      payout: 0,
      outcome: 'OPEN',
      notes: `Batch Slate CLV Checked (${item.clvPercent > 0 ? '+' : ''}${item.clvPercent}%, Fair: ${item.fairOdds.toFixed(2)})`,
    });

    setLoggedIndices((prev) => ({ ...prev, [item.index]: true }));
    onPositionLogged?.();
  };

  // Bulk log all positive edge bets
  const handleLogAllPositive = () => {
    const positiveItems = evaluatedSlate.filter((item) => item.clvPercent > 0 && !item.isLogged);
    if (positiveItems.length === 0) return;

    positiveItems.forEach((item) => {
      handleLogSingle(item);
    });

    setBulkLoggedSuccess(true);
    setTimeout(() => setBulkLoggedSuccess(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-5xl rounded-3xl border border-slate-700/80 shadow-2xl bg-slate-950/95 p-5 sm:p-7 relative max-h-[95vh] overflow-y-auto space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="pr-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Whole-Page Batch Slate Scanner
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
              Multi-Match Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Scan 20 to 50 matches at once from OddsPortal. Computes Shin true fair lines across the entire slate, strips bookmaker vig, and highlights <strong>ONLY the bets that beat CLV</strong>.
          </p>
        </div>

        {/* Scanner Toolbar & Quick Ingestion Box */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/40 rounded-2xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-black text-white">
                Whole-Page Ingestion &amp; F12 Grabber
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClipboardRead}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Paste full slate copied to clipboard"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste Whole Page</span>
              </button>

              <button
                type="button"
                onClick={() => setShowScriptDrawer(!showScriptDrawer)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Whole-Page F12 Grabber</span>
                {showScriptDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>

              {matches.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMatches([]);
                    setRawPasteText('');
                    setLoggedIndices({});
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Slate</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick-Paste Input Box */}
          <div className="relative">
            <input
              id="slate-paste-input"
              type="text"
              placeholder="Paste entire text or JSON copied from OddsPortal match list..."
              value={rawPasteText}
              onChange={(e) => handleProcessPaste(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none pr-8"
            />
          </div>

          {/* F12 WHOLE-PAGE SCRIPT DRAWER */}
          {showScriptDrawer && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs text-slate-300 space-y-2.5 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  1-Click Whole-Page Console Grabber (Zero Manual Typing)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Scrapes 20–50 games in 1 sec</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Run this script on any OddsPortal match schedule or tournament page. It automatically captures all games on the screen and opens them directly in this scanner!
              </p>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Script Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5" />
                      <span>📋 Copy Whole-Page F12 Script</span>
                    </>
                  )}
                </button>

                <a
                  ref={bookmarkletRef}
                  href={wholePageBookmarklet}
                  draggable="true"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs shadow-sm transition cursor-grab active:cursor-grabbing"
                  title="Drag me to your browser Bookmarks Bar!"
                  onClick={(e) => {
                    e.preventDefault();
                    handleCopyBookmarklet();
                  }}
                >
                  <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Drag Whole-Page Bookmarklet</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyBookmarklet}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedBookmarklet ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied Bookmark URL!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Bookmark URL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-400">How to scan an entire OddsPortal page:</div>
                <div>1. On OddsPortal, press <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-200">F12</kbd> (Inspect ➔ Console).</div>
                <div>2. Paste the copied script and press <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-200">Enter</kbd>.</div>
                <div>3. Click <strong>🚀 Import All into Bet Admin</strong> on the floating popup. All 30+ games load instantly!</div>
              </div>
            </div>
          )}
        </div>

        {/* Global Controls & Filter Ribbon */}
        {matches.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Matches ({matches.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('edgeOnly')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  filterMode === 'edgeOnly'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+CLV Plays ({positiveEdgeCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('subZero')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  filterMode === 'subZero'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sub-Zero ({matches.length - positiveEdgeCount})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-emerald-400 font-bold text-xs outline-none cursor-pointer"
              >
                <option value="edgeDesc" className="bg-slate-950 text-slate-200">🔥 Highest Edge First</option>
                <option value="kellyDesc" className="bg-slate-950 text-slate-200">💰 Highest Stake First</option>
                <option value="original" className="bg-slate-950 text-slate-200">📄 Original Schedule</option>
              </select>
            </div>

            {/* Odds Cap Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Odds Filter:</span>
              <select
                value={maxOddsCap}
                onChange={(e) => setMaxOddsCap(parseFloat(e.target.value))}
                className="bg-transparent text-cyan-300 font-bold text-xs outline-none cursor-pointer"
              >
                <option value={5.0} className="bg-slate-950 text-slate-200">🎯 ≤ 5.0 (Realistic Plays)</option>
                <option value={3.5} className="bg-slate-950 text-slate-200">🛡️ ≤ 3.5 (Lower Variance)</option>
                <option value={2.5} className="bg-slate-950 text-slate-200">⚡ ≤ 2.5 (Favorites Only)</option>
                <option value={999} className="bg-slate-950 text-slate-200">🚀 No Cap (Include 20.0+ Longshots)</option>
              </select>
            </div>

            {/* Target Bookmaker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Retail Bookmaker:
              </span>
              <input
                type="text"
                value={retailBookmaker}
                onChange={(e) => setRetailBookmaker(e.target.value)}
                placeholder="e.g. 1xBet, SportyBet"
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-100 font-bold focus:border-emerald-500 outline-none w-28 sm:w-36"
              />
            </div>

            {/* Bulk Log All Action */}
            {positiveEdgeCount > 0 && (
              <button
                type="button"
                onClick={handleLogAllPositive}
                disabled={bulkLoggedSuccess}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg cursor-pointer ${
                  bulkLoggedSuccess
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {bulkLoggedSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>All Positive Plays Logged!</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Stake All {positiveEdgeCount} +CLV Plays ({sym}{totalPositiveStake.toLocaleString()})</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Matches Slate Table / Card List */}
        {matches.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
              ⚡
            </div>
            <h3 className="text-base font-black text-white">No Slate Loaded Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Copy any match list or tournament page from OddsPortal and click <strong>Paste Whole Page</strong>, or run the F12 Console Script on OddsPortal to import all matches in 1 click!
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
            No matches match the selected filter ({filterMode}).
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
            {filteredItems.map((item, rankIdx) => {
              const isPositive = item.clvPercent > 0;
              return (
                <div
                  key={`${item.match.matchName}-${item.index}`}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    item.isLogged
                      ? 'bg-slate-950/60 border-slate-800 opacity-60'
                      : isPositive
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Match & Odds Info */}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Rank Badge */}
                        {isPositive && sortBy === 'edgeDesc' && (
                          rankIdx === 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/50 text-amber-300 text-[10px] font-black font-mono shadow-[0_0_10px_rgba(245,158,11,0.25)] flex items-center gap-1">
                              🥇 #1 Top Edge Play
                            </span>
                          ) : rankIdx === 1 ? (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/25 border border-cyan-400/50 text-cyan-300 text-[10px] font-black font-mono flex items-center gap-1">
                              🥈 #2 Top Play
                            </span>
                          ) : rankIdx === 2 ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-[10px] font-black font-mono flex items-center gap-1">
                              🥉 #3 Top Play
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono font-bold">
                              #{rankIdx + 1}
                            </span>
                          )
                        )}

                        <span className="font-black text-xs sm:text-sm text-slate-100">
                          {item.match.matchName}
                        </span>
                        {item.isLogged ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3 text-emerald-400" /> Logged
                          </span>
                        ) : isPositive ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-black flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +{item.clvPercent}% CLV Edge
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-500 border border-slate-800 text-[10px] font-mono">
                            Sub-Zero ({item.clvPercent}%)
                          </span>
                        )}
                      </div>

                      {/* Raw Market vs Fair Reference */}
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 flex-wrap">
                        <span>
                          Market: <b>{item.match.homeOdds}</b> / <b>{item.match.drawOdds}</b> / <b>{item.match.awayOdds}</b>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>
                          Fair Line: <b className="text-cyan-300">{item.fairOdds.toFixed(2)}</b> (Shin)
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>Margin: {item.margin}%</span>
                      </div>

                      {/* Best value indicator / helper if sub-zero selected */}
                      {item.targetWay !== item.bestWay && item.hasAnyPositiveEdge && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedWays((prev) => ({
                                ...prev,
                                [item.index]: item.bestWay,
                              }))
                            }
                            className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <span>⚡ Value play is on <b>{item.bestWay === 0 ? 'Home (1)' : item.bestWay === 1 ? 'Draw (X)' : 'Away (2)'}</b> (+{item.maxEdge}%). Click to switch!</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Target Selection & Price Input */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* 1 X 2 Target Selector */}
                      <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
                        {(['1', 'X', '2'] as const).map((wayLabel, wayIdx) => {
                          const isSelected = item.targetWay === wayIdx;
                          const isBest = item.bestWay === wayIdx && item.hasAnyPositiveEdge;
                          const edgeForWay = item.wayEdges[wayIdx];
                          return (
                            <button
                              key={wayLabel}
                              type="button"
                              onClick={() =>
                                setSelectedWays((prev) => ({
                                  ...prev,
                                  [item.index]: wayIdx as 0 | 1 | 2,
                                }))
                              }
                              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? isPositive
                                    ? 'bg-emerald-400 text-slate-950 font-black shadow'
                                    : 'bg-rose-500 text-white font-black'
                                  : isBest
                                  ? 'text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title={`${wayLabel}: ${edgeForWay > 0 ? '+' : ''}${edgeForWay}% CLV Edge`}
                            >
                              <span>{wayLabel}</span>
                              {isBest && <span className="text-[10px]">⚡</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Retail Price Override */}
                      <div className="w-20">
                        <input
                          type="number"
                          step="0.01"
                          min="1.01"
                          placeholder={item.priceTaken.toFixed(2)}
                          value={retailOddsMap[item.index] ?? ''}
                          onChange={(e) =>
                            setRetailOddsMap((prev) => ({
                              ...prev,
                              [item.index]: e.target.value,
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-300 text-center focus:border-amber-400 outline-none"
                          title="Your bookmaker price"
                        />
                      </div>

                      {/* Kelly Stake Badge */}
                      <div className="w-24 text-right">
                        <div className="text-xs font-black font-mono text-white">
                          {isPositive ? `${sym}${item.kelly.stakeNGN.toLocaleString()}` : `${sym}0`}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">
                          {isPositive ? `${item.kelly.stakePercent.toFixed(1)}% Kelly` : '0% Pass'}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        disabled={item.isLogged || !isPositive}
                        onClick={() => handleLogSingle(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                          item.isLogged
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : isPositive
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                            : 'bg-slate-900 hover:bg-slate-850 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        {item.isLogged ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Logged</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            <span>Log Bet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
