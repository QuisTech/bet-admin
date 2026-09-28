import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bookmark,
  Copy,
  Check,
  ClipboardPaste,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import {
  generateOneXBetBookmarklet,
  getOneXBetCleanScript,
  parse1xBetInput,
  convertParsedSlipsToLoggedBets,
  type ParsedOneXBetSlip,
} from '../services/oneXBetParser';
import { getLoggedBets, saveLoggedBets, notifyLedgerUpdated } from '../services/ledgerService';
import { isFirebaseConfigured, syncAllLocalBetsToFirestore } from '../services/firebaseService';

interface OneXBetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (count: number) => void;
}

export const OneXBetSyncModal: React.FC<OneXBetSyncModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'bookmarklet' | 'paste'>('console');
  const [copiedConsole, setCopiedConsole] = useState(false);
  const [copiedBookmark, setCopiedBookmark] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsedSlips, setParsedSlips] = useState<ParsedOneXBetSlip[]>([]);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  const bookmarkLinkRef = useRef<HTMLAnchorElement>(null);
  const bookmarkletCode = generateOneXBetBookmarklet('bet-admin-8d3fc');
  const cleanConsoleScript = getOneXBetCleanScript('bet-admin-8d3fc');

  useEffect(() => {
    if (bookmarkLinkRef.current) {
      bookmarkLinkRef.current.setAttribute('href', bookmarkletCode);
      bookmarkLinkRef.current.setAttribute('draggable', 'true');
    }
  }, [bookmarkletCode, activeTab, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCopyConsole = () => {
    navigator.clipboard.writeText(cleanConsoleScript);
    setCopiedConsole(true);
    setTimeout(() => setCopiedConsole(false), 3000);
  };

  const handleCopyBookmark = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmark(true);
    setTimeout(() => setCopiedBookmark(false), 3000);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    setImportSuccess(null);
    if (text.trim().length > 20) {
      const results = parse1xBetInput(text);
      setParsedSlips(results);
    } else {
      setParsedSlips([]);
    }
  };

  const handleImportSlips = async () => {
    if (parsedSlips.length === 0) return;

    const newBets = convertParsedSlipsToLoggedBets(parsedSlips);
    const existing = getLoggedBets();
    const merged = [...existing];

    for (const nb of newBets) {
      const idx = merged.findIndex(
        (b) =>
          b.id === nb.id ||
          (b.match.toLowerCase().replace(/\s*-\s*/g, ' vs ').trim() ===
            nb.match.toLowerCase().replace(/\s*-\s*/g, ' vs ').trim() &&
            b.dateDisplay?.split(' ')[0] === nb.dateDisplay?.split(' ')[0])
      );

      if (idx >= 0) {
        const old = merged[idx];
        // Intelligent reconciliation: Adopt 1xBet real settlement outcome, payout, and official slip ID,
        // while preserving rich model probabilities, Pinnacle CLV, and EV if already calculated.
        merged[idx] = {
          ...old,
          ...nb,
          id: nb.id || old.id,
          modelProb: old.modelProb && old.modelProb !== Math.round((1 / (old.priceTaken || 2.0)) * 1000) / 1000 ? old.modelProb : nb.modelProb,
          modelEV: typeof old.modelEV === 'number' && old.modelEV !== 5.0 ? old.modelEV : nb.modelEV,
          pinnacleLineAtBet: old.pinnacleLineAtBet || nb.pinnacleLineAtBet,
          pinnacleClosingLine: old.pinnacleClosingLine || nb.pinnacleClosingLine,
          clvPercent: typeof old.clvPercent === 'number' && old.clvPercent !== 5.0 ? old.clvPercent : nb.clvPercent,
          outcome: nb.outcome,
          payout: nb.payout,
          priceTaken: nb.priceTaken || old.priceTaken,
          stake: nb.stake || old.stake,
          notes: old.notes && !old.notes.includes(nb.id) ? `${old.notes} • Slip № ${nb.id}` : (nb.notes || old.notes),
        };
      } else {
        merged.push(nb);
      }
    }

    saveLoggedBets(merged);
    notifyLedgerUpdated(merged);

    if (isFirebaseConfigured()) {
      await syncAllLocalBetsToFirestore(merged);
    }

    setImportSuccess(newBets.length);
    if (onImportComplete) {
      onImportComplete(newBets.length);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                ⚡ 1xBet ➔ Bet Horizon Sync
              </h2>
              <p className="text-xs text-slate-400">
                1-Click live extraction & cloud ledger synchronization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/30 p-2 gap-2">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'console'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1-Click Console (Fastest)</span>
          </button>
          <button
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'bookmarklet'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Browser Bookmark</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Quick-Paste (Mobile)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* TAB 1: CONSOLE SNIPPET (FOOLPROOF, 100% RELIABLE ACROSS ALL BROWSERS) */}
          {activeTab === 'console' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black text-emerald-400 flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Run on 1xBet in 2 Seconds:
                  </div>
                  <button
                    onClick={handleCopyConsole}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    {copiedConsole ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Code Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>📋 Copy Console Code</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Clean, unencoded JavaScript that instantly bypasses browser security and directly mounts the floating <strong>⚡ Bet Horizon Sync</strong> widget onto your 1xBet screen.
                </p>
              </div>

              {/* 3 Step Instructions */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quick 3 Steps on 1xBet:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-[11px]">
                      1
                    </div>
                    <div className="font-bold text-slate-200">Open 1xBet</div>
                    <div className="text-[11px] text-slate-400">
                      Go to your 1xBet account &amp; open <strong>Bet History</strong>.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-[11px]">
                      2
                    </div>
                    <div className="font-bold text-slate-200">Open Console</div>
                    <div className="text-[11px] text-slate-400">
                      Press <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-200">F12</kbd> (or right-click anywhere ➔ <strong>Inspect</strong> ➔ <strong>Console</strong>).
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-[11px]">
                      3
                    </div>
                    <div className="font-bold text-slate-200">Paste &amp; Enter</div>
                    <div className="text-[11px] text-slate-400">
                      Paste the copied code and press <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-200">Enter</kbd>. Done!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOOKMARKLET */}
          {activeTab === 'bookmarklet' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-3">
                <div className="text-sm font-black text-emerald-400 flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Add to Browser Bookmarks Bar:
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    ref={bookmarkLinkRef}
                    href={bookmarkletCode}
                    draggable="true"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-grab active:cursor-grabbing border border-emerald-300"
                    title="Drag me to your Bookmarks Bar!"
                  >
                    <span>⚡ Sync to Bet Horizon</span>
                  </a>
                  <button
                    onClick={handleCopyBookmark}
                    className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
                  >
                    {copiedBookmark ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Bookmark URL Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>📋 Copy Bookmarklet URL</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                  <div className="font-bold text-emerald-400">If dragging is disabled by Chrome:</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>Click <strong>Copy Bookmarklet URL</strong> above.</li>
                    <li>Right-click your browser Bookmarks Bar ➔ Click <strong>"Add page..."</strong> (or "Add bookmark").</li>
                    <li>Name it <code>⚡ 1xBet Sync</code> and paste the copied URL into the <strong>URL</strong> field.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUICK-PASTE (MOBILE / ZERO SETUP) */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Paste 1xBet Bet History Text or HTML:
                </label>
                <textarea
                  value={rawText}
                  onChange={handleTextChange}
                  placeholder={`Paste either:\n1. Regular text copied from 1xBet history (Ctrl+A, Ctrl+C)\n2. Or raw HTML element (<div class="bets-history-layout__body">...)\n\nBoth are automatically detected and parsed!`}
                  className="w-full h-36 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/60 resize-none"
                />
              </div>

              {/* Parsed Live Preview */}
              {parsedSlips.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Detected {parsedSlips.length} Verified Slips
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Ready to import into ledger
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {parsedSlips.map((s, idx) => (
                      <div
                        key={s.id || idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                      >
                        <div className="truncate max-w-[240px]">
                          <span className="font-mono text-slate-400 text-[10px] mr-1.5">
                            #{s.id.slice(-6)}
                          </span>
                          <strong className="text-slate-200">{s.match}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 font-bold">
                            @{s.odds}
                          </span>
                          <span className="font-mono text-slate-300">
                            ₦{s.stake}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              s.outcome === 'WON'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : s.outcome === 'LOST'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : s.outcome === 'CASHOUT'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleImportSlips}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>🚀 Import &amp; Sync {parsedSlips.length} Slips to Ledger</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {importSuccess !== null && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Successfully synchronized {importSuccess} tickets! Your ledger and cloud are fully updated.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Target: bet-admin-8d3fc (Cloud Firestore)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
