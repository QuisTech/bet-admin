import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Bookmark,
  Copy,
  Check,
  ClipboardPaste,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  generateOneXBetBookmarklet,
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
  const [activeTab, setActiveTab] = useState<'bookmarklet' | 'paste'>('bookmarklet');
  const [copiedCode, setCopiedCode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsedSlips, setParsedSlips] = useState<ParsedOneXBetSlip[]>([]);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  const bookmarkLinkRef = useRef<HTMLAnchorElement>(null);
  const bookmarkletCode = generateOneXBetBookmarklet('bet-admin-8d3fc');

  useEffect(() => {
    if (bookmarkLinkRef.current) {
      bookmarkLinkRef.current.setAttribute('href', bookmarkletCode);
    }
  }, [bookmarkletCode, activeTab, isOpen]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
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
        // Update existing position with verified 1xBet ticket
        merged[idx] = nb;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
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
                Automated 1-click sync & seamless slip import
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
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'bookmarklet'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>1-Click Bookmarklet (Desktop)</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'paste'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Quick-Paste Text or HTML</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {activeTab === 'bookmarklet' && (
            <div className="space-y-5">
              {/* Highlight Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-3">
                <div className="text-sm font-black text-emerald-400 flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Drag this button into your Bookmarks Bar:
                </div>
                <div className="flex items-center gap-3">
                  <a
                    ref={bookmarkLinkRef}
                    onClick={(e) => {
                      e.preventDefault();
                      alert('👉 Drag this button up to your browser Bookmarks Bar (Ctrl+Shift+B if hidden)!');
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-grab active:cursor-grabbing border border-emerald-300"
                    title="Drag me to your Bookmarks Bar!"
                  >
                    <span>⚡ Sync to Bet Horizon</span>
                  </a>
                  <button
                    onClick={handleCopyCode}
                    className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Code Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-slate-200">Ctrl + Shift + B</kbd> (or Cmd+Shift+B on Mac) if your browser bookmarks bar is currently hidden.
                </p>
              </div>

              {/* 3 Step Instructions */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  How It Works in 3 Seconds:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
                      1
                    </div>
                    <div className="font-bold text-slate-200">Open 1xBet</div>
                    <div className="text-[11px] text-slate-400">
                      Go to your 1xBet account and open your <strong>Bet History</strong> page.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs">
                      2
                    </div>
                    <div className="font-bold text-slate-200">Click Bookmark</div>
                    <div className="text-[11px] text-slate-400">
                      Click the <strong>⚡ Sync to Bet Horizon</strong> bookmark on your toolbar.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
                      3
                    </div>
                    <div className="font-bold text-slate-200">Instant Sync!</div>
                    <div className="text-[11px] text-slate-400">
                      All your slips are sent straight to your Cloud Ledger and visible on all devices.
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>100% Safe &amp; Undetectable:</strong> The bookmarklet never asks for your 1xBet password or makes bot calls. It simply reads the tickets already visible on your active screen using native DOM attributes and sends them to your personal Firebase database.
                </span>
              </div>
            </div>
          )}

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
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
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
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
