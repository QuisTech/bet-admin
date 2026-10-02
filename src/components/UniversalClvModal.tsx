import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Calculator,
  TrendingUp,
  BookmarkPlus,
  Check,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste,
  Sparkles,
  Copy,
  Bookmark,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { BankrollConfig } from '../types';
import { calculateShinDevig } from '../models/shinDevig';
import { calculateKellyStake, calculateEV } from '../models/evEngine';
import { addLoggedBet } from '../services/ledgerService';
import {
  parseOddsPortalText,
  generateOddsPortalBookmarklet,
  type ParsedOddsMatch,
} from '../services/oddsTextParser';

export interface UniversalClvInitialData {
  matchName?: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  retailOdds?: number;
  selection?: string;
  bookmaker?: string;
  league?: string;
  targetWay?: 0 | 1 | 2;
}

interface UniversalClvModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BankrollConfig;
  onPositionLogged?: () => void;
  initialData?: UniversalClvInitialData | null;
}

export const UniversalClvModal: React.FC<UniversalClvModalProps> = ({
  isOpen,
  onClose,
  config,
  onPositionLogged,
  initialData,
}) => {
  const [matchName, setMatchName] = useState('');
  const [selection, setSelection] = useState('Home Win');
  const [bookmaker, setBookmaker] = useState('1xBet');
  const [league, setLeague] = useState('');
  const [bookOdds, setBookOdds] = useState('2.40');

  // Benchmark method: 'direct' or '3way'
  const [benchmarkMode, setBenchmarkMode] = useState<'direct' | '3way'>('direct');
  const [directFairOdds, setDirectFairOdds] = useState('2.15');

  // 3-way line inputs for Shin De-vig
  const [rawHome, setRawHome] = useState('2.20');
  const [rawDraw, setRawDraw] = useState('3.30');
  const [rawAway, setRawAway] = useState('3.50');
  const [selectedWay, setSelectedWay] = useState<0 | 1 | 2>(0); // 0=Home, 1=Draw, 2=Away

  // Optional model prob override
  const [probOverride, setProbOverride] = useState('');

  // Quick-Paste & Multi-Match State
  const [quickPasteInput, setQuickPasteInput] = useState('');
  const [detectedMatches, setDetectedMatches] = useState<ParsedOddsMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [pasteSuccessNotice, setPasteSuccessNotice] = useState<string | null>(null);

  // Bookmarklet drawer state
  const [showBookmarkletGuide, setShowBookmarkletGuide] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const bookmarkletAnchorRef = useRef<HTMLAnchorElement>(null);

  const [loggedSuccess, setLoggedSuccess] = useState(false);

  const sym = config.currency === 'USD' ? '$' : '₦';

  // Bookmarklet JS URI
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bet-admin-iota.vercel.app';
  const bookmarkletCode = useMemo(() => generateOddsPortalBookmarklet(appOrigin), [appOrigin]);

  useEffect(() => {
    if (bookmarkletAnchorRef.current) {
      bookmarkletAnchorRef.current.setAttribute('href', bookmarkletCode);
    }
  }, [bookmarkletCode, showBookmarkletGuide]);

  // Load initialData when passed (e.g. from Bookmarklet or URL hash)
  useEffect(() => {
    if (initialData && isOpen) {
      if (initialData.matchName) setMatchName(initialData.matchName);
      if (initialData.homeOdds) {
        setBenchmarkMode('3way');
        setRawHome(initialData.homeOdds.toFixed(2));
      }
      if (initialData.drawOdds) setRawDraw(initialData.drawOdds.toFixed(2));
      if (initialData.awayOdds) setRawAway(initialData.awayOdds.toFixed(2));
      if (initialData.retailOdds) setBookOdds(initialData.retailOdds.toFixed(2));
      if (initialData.bookmaker) setBookmaker(initialData.bookmaker);
      if (initialData.league) setLeague(initialData.league);
      if (typeof initialData.targetWay === 'number') {
        setSelectedWay(initialData.targetWay);
        if (initialData.targetWay === 0) setSelection('Home Win (1)');
        else if (initialData.targetWay === 1) setSelection('Draw (X)');
        else setSelection('Away Win (2)');
      }
      setPasteSuccessNotice(`⚡ Loaded from URL / Bookmarklet: ${initialData.matchName || 'Match'}`);
    }
  }, [initialData, isOpen]);

  // Helper to load a parsed match item into state
  const applyParsedMatch = (m: ParsedOddsMatch, index: number = 0) => {
    setActiveMatchIndex(index);
    setMatchName(m.matchName);
    setBenchmarkMode('3way');
    setRawHome(m.homeOdds.toFixed(2));
    setRawDraw(m.drawOdds.toFixed(2));
    setRawAway(m.awayOdds.toFixed(2));
    if (m.retailOdds) setBookOdds(m.retailOdds.toFixed(2));
    if (m.bookmaker) setBookmaker(m.bookmaker);
    if (m.league) setLeague(m.league);
    setPasteSuccessNotice(`✅ Ingested: ${m.matchName} (${m.homeOdds} / ${m.drawOdds} / ${m.awayOdds})`);
    setTimeout(() => setPasteSuccessNotice(null), 4000);
  };

  // Process text input (from paste or typing)
  const processRawText = (text: string) => {
    setQuickPasteInput(text);
    if (!text || text.trim().length === 0) {
      setDetectedMatches([]);
      return;
    }
    const results = parseOddsPortalText(text);
    if (results.length > 0) {
      setDetectedMatches(results);
      applyParsedMatch(results[0], 0);
    } else {
      setDetectedMatches([]);
    }
  };

  // Paste from native clipboard button
  const handleClipboardRead = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          processRawText(text);
        }
      }
    } catch {
      // If browser clipboard permission prompt is blocked, focus the input
      const el = document.getElementById('clv-quick-paste-input');
      if (el) el.focus();
    }
  };

  const handleCopyBookmarklet = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(bookmarkletCode);
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 3000);
    }
  };

  // Compute fair odds & probability
  const { fairOdds, modelProb, devigMargin, devigZ } = useMemo(() => {
    const parsedBookOdds = parseFloat(bookOdds) || 2.0;

    if (benchmarkMode === 'direct') {
      const fOdds = parseFloat(directFairOdds) || parsedBookOdds;
      const parsedOverride = parseFloat(probOverride);
      const prob = !isNaN(parsedOverride) && parsedOverride > 0 && parsedOverride <= 100
        ? parsedOverride / 100
        : fOdds > 1.0 ? 1 / fOdds : 0.5;

      return {
        fairOdds: fOdds,
        modelProb: prob,
        devigMargin: 0,
        devigZ: 0,
      };
    } else {
      const h = parseFloat(rawHome) || 2.0;
      const d = parseFloat(rawDraw) || 3.2;
      const a = parseFloat(rawAway) || 3.5;

      try {
        const shin = calculateShinDevig([h, d, a]);
        const fOdds = shin.fairOdds[selectedWay] || h;
        const parsedOverride = parseFloat(probOverride);
        const prob = !isNaN(parsedOverride) && parsedOverride > 0 && parsedOverride <= 100
          ? parsedOverride / 100
          : shin.fairProbabilities[selectedWay] || (1 / fOdds);

        return {
          fairOdds: Math.round(fOdds * 100) / 100,
          modelProb: prob,
          devigMargin: Math.round(shin.margin * 10) / 10,
          devigZ: Math.round(shin.z * 1000) / 10,
        };
      } catch {
        return {
          fairOdds: h,
          modelProb: 1 / h,
          devigMargin: 0,
          devigZ: 0,
        };
      }
    }
  }, [benchmarkMode, directFairOdds, rawHome, rawDraw, rawAway, selectedWay, probOverride, bookOdds]);

  const parsedBookOdds = parseFloat(bookOdds) || 1.01;

  // Closing Line Value % = ((Price Taken / Fair Benchmark) - 1) * 100
  const clvPercent = fairOdds > 1.0
    ? Math.round(((parsedBookOdds / fairOdds) - 1.0) * 1000) / 10
    : 0;

  // Expected Value % = (ModelProb * BookOdds - 1) * 100
  const evPercent = calculateEV(modelProb, parsedBookOdds);
  const isPositiveEV = evPercent > 0;

  // Kelly Staking
  const kelly = calculateKellyStake(modelProb, parsedBookOdds, config);
  const projectedReturn = Math.round(kelly.stakeNGN * parsedBookOdds);
  const netProfit = projectedReturn - kelly.stakeNGN;

  const handleSaveToLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBookOdds <= 1.0) return;

    const finalMatch = matchName.trim() || 'Custom Tested Fixture';
    const finalSelection = selection.trim() || (selectedWay === 0 ? 'Home Win (1)' : selectedWay === 1 ? 'Draw (X)' : 'Away Win (2)');
    const finalLeague = league.trim() || 'Global Odds Ingestion';
    const finalStake = kelly.stakeNGN > 0 ? kelly.stakeNGN : 200;

    addLoggedBet({
      league: finalLeague,
      match: finalMatch,
      selection: finalSelection,
      marketType: '1X2',
      bookmaker: bookmaker.trim() || 'Retail Book',
      priceTaken: parsedBookOdds,
      pinnacleLineAtBet: fairOdds,
      pinnacleClosingLine: fairOdds,
      modelProb: modelProb,
      modelEV: evPercent,
      stake: finalStake,
      payout: 0,
      outcome: 'OPEN',
      notes: `Custom CLV Checked (CLV: ${clvPercent > 0 ? '+' : ''}${clvPercent}%, Fair: ${fairOdds.toFixed(2)})`,
    });

    setLoggedSuccess(true);
    onPositionLogged?.();
    setTimeout(() => {
      setLoggedSuccess(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-700/80 shadow-2xl bg-slate-950/95 p-5 sm:p-7 relative max-h-[94vh] overflow-y-auto space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Header */}
        <div className="pr-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Calculator className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Universal CLV & Price Edge Inspector
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test any game on earth before placing it on 1xBet, SportyBet, or any bookmaker. Compute pure <strong>Closing Line Value (CLV)</strong>, de-vigged fair lines, and optimal Kelly stake.
          </p>
        </div>

        {/* ⚡ OPTION 1 & 3: INSTANT QUICK-PASTE & BOOKMARKLET HERO SECTION */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/40 rounded-2xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-black text-white">
                ⚡ Instant OddsPortal / Text Quick-Paste
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClipboardRead}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Paste whatever text is currently in your clipboard"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste Clipboard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBookmarkletGuide(!showBookmarkletGuide)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>🔖 Bookmarklet</span>
                {showBookmarkletGuide ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Quick-Paste Input Box */}
          <div className="relative">
            <input
              id="clv-quick-paste-input"
              type="text"
              placeholder="Paste OddsPortal line (e.g. [20:45 Bosnia-Sweden] 2.74 3.59 2.45 or multiple matches)..."
              value={quickPasteInput}
              onChange={(e) => processRawText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none pr-8"
            />
            {quickPasteInput && (
              <button
                type="button"
                onClick={() => {
                  setQuickPasteInput('');
                  setDetectedMatches([]);
                }}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Multi-Match Pills Ribbon */}
          {detectedMatches.length > 1 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Found {detectedMatches.length} Matches in pasted text — Click to inspect:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {detectedMatches.map((m, idx) => (
                  <button
                    key={`${m.matchName}-${idx}`}
                    type="button"
                    onClick={() => applyParsedMatch(m, idx)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer border ${
                      activeMatchIndex === idx
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {idx + 1}. {m.matchName} ({m.homeOdds}/{m.drawOdds}/{m.awayOdds})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toast Notification of Successful Parse */}
          {pasteSuccessNotice && (
            <div className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg animate-in fade-in">
              {pasteSuccessNotice}
            </div>
          )}

          {/* 🔖 OPTION 3: BOOKMARKLET SETUP DRAWER */}
          {showBookmarkletGuide && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs text-slate-300 space-y-2.5 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                  1-Click OddsPortal Bookmarklet
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Zero Typing on Oddsportal</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Add this bookmarklet to your browser. Whenever you visit an OddsPortal match, click it to automatically capture the match name, Pinnacle odds, and open Bet Admin pre-filled!
              </p>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  ref={bookmarkletAnchorRef}
                  href={bookmarkletCode}
                  draggable="true"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-md transition cursor-grab active:cursor-grabbing border border-cyan-300"
                  title="Drag me to your browser Bookmarks Bar!"
                  onClick={(e) => {
                    e.preventDefault();
                    handleCopyBookmarklet();
                  }}
                >
                  <span>⚡ Grab OddsPortal CLV</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyBookmarklet}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedBookmarklet ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied URL!</span>
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
                <div className="font-bold text-slate-200">How to install in 5 seconds:</div>
                <div>1. Drag the cyan button above directly to your browser's Bookmarks Bar (or click Copy Bookmark URL ➔ Add Bookmark ➔ Paste into URL).</div>
                <div>2. On OddsPortal, click <strong>⚡ Grab OddsPortal CLV</strong>.</div>
                <div>3. Done! It automatically captures the match and loads into Bet Admin.</div>
              </div>
            </div>
          )}
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSaveToLedger} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Match / Fixture (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Real Sociedad vs Valencia"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Target Market / Selection
              </label>
              <input
                type="text"
                placeholder="e.g. Home Win, Over 2.5, Draw (1X2)"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                required
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Bookmaker / Site
              </label>
              <input
                type="text"
                placeholder="e.g. 1xBet, SportyBet, Bet9ja"
                value={bookmaker}
                onChange={(e) => setBookmaker(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-amber-400 font-black block mb-1">
                Retail Odds (Price Taken)
              </label>
              <input
                type="number"
                step="0.001"
                min="1.01"
                placeholder="e.g. 2.40"
                value={bookOdds}
                onChange={(e) => setBookOdds(e.target.value)}
                required
                className="w-full bg-slate-900/90 border border-amber-500/50 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                League (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. La Liga, NPFL, Serie B"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Benchmark Mode Selector */}
          <div className="p-3.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Sharp Benchmark Source
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setBenchmarkMode('direct')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    benchmarkMode === 'direct'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Direct Fair Line
                </button>
                <button
                  type="button"
                  onClick={() => setBenchmarkMode('3way')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    benchmarkMode === '3way'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Shin De-Vig (3-Way 1X2)
                </button>
              </div>
            </div>

            {benchmarkMode === 'direct' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Pinnacle / Sharp Fair Reference Line
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="1.01"
                    value={directFairOdds}
                    onChange={(e) => setDirectFairOdds(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-500 outline-none"
                    placeholder="e.g. 2.15"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Use Pinnacle's no-vig line or sharp exchange closing price
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Model Win Probability % (Optional Override)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={probOverride}
                    onChange={(e) => setProbOverride(e.target.value)}
                    placeholder={`Implied: ${(modelProb * 100).toFixed(1)}%`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-emerald-500 outline-none"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Defaults to sharp implied prob: {(modelProb * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <span className="text-[10px] text-slate-400 block">
                  Enter Pinnacle Raw 1X2 Market Lines (Shin 1993 strips bookmaker margin):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">1 (Home)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={rawHome}
                      onChange={(e) => setRawHome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">X (Draw)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={rawDraw}
                      onChange={(e) => setRawDraw(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">2 (Away)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={rawAway}
                      onChange={(e) => setRawAway(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[10px] flex-wrap">
                  <span className="text-slate-400 font-bold">Your Target:</span>
                  {(['Home (1)', 'Draw (X)', 'Away (2)'] as const).map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setSelectedWay(idx as 0 | 1 | 2);
                        if (idx === 0) setSelection('Home Win (1)');
                        else if (idx === 1) setSelection('Draw (X)');
                        else setSelection('Away Win (2)');
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
                        selectedWay === idx
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="text-[9px] font-mono text-slate-500 ml-auto">
                    Margin: {devigMargin}% • z: {devigZ}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Results Display Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {/* CLV */}
            <div className={`p-3 rounded-2xl border ${
              clvPercent > 0
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                CLV Edge %
              </div>
              <div className={`text-xl font-mono font-black mt-1 ${
                clvPercent > 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {clvPercent > 0 ? `+${clvPercent}%` : `${clvPercent}%`}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                vs Fair {fairOdds.toFixed(2)}
              </div>
            </div>

            {/* EV */}
            <div className={`p-3 rounded-2xl border ${
              evPercent > 0
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Expected Value (EV)
              </div>
              <div className={`text-xl font-mono font-black mt-1 ${
                evPercent > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {evPercent > 0 ? `+${evPercent.toFixed(1)}%` : `${evPercent.toFixed(1)}%`}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                P(Win): {(modelProb * 100).toFixed(1)}%
              </div>
            </div>

            {/* Kelly Recommended Stake */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Kelly Stake
              </div>
              <div className="text-xl font-mono font-black text-white mt-1">
                {sym}{kelly.stakeNGN.toLocaleString()}
              </div>
              <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
                {isPositiveEV ? `${kelly.stakePercent.toFixed(1)}% Bankroll` : '0% (Pass)'}
              </div>
            </div>

            {/* Projected Net Profit */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Projected Profit
              </div>
              <div className={`text-xl font-mono font-black mt-1 ${
                netProfit > 0 ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {netProfit > 0 ? `+${sym}${netProfit.toLocaleString()}` : `${sym}0`}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                Returns {sym}{projectedReturn.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Mathematical Verdict Badge */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono ${
            clvPercent > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {clvPercent > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-bold">
                {clvPercent > 0
                  ? `🟢 Beats Sharp Benchmark (+${(parsedBookOdds - fairOdds).toFixed(2)}) • Pure Price Edge!`
                  : `🔴 Sub-Zero Edge: Retail odds (${parsedBookOdds}) below sharp fair price (${fairOdds.toFixed(2)})`}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Shin Implied Fair: {fairOdds.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 transition cursor-pointer"
            >
              Close
            </button>

            <button
              type="submit"
              disabled={loggedSuccess}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer ${
                loggedSuccess
                  ? 'bg-emerald-400 text-slate-950 font-black'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              {loggedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Logged to Ledger!</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  <span>+ Log Directly to Ledger ({sym}{kelly.stakeNGN > 0 ? kelly.stakeNGN : 200})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
