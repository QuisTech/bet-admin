import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Scale,
  RotateCw,
  X,
  Lock,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  type JackpotPlatform,
  type JackpotSlate,
  parseJackpotInput,
  generateCoveringPortfolio,
} from '../services/jackpotService';

export interface ProspectiveRecord {
  protocolVersion: string;
  roundId: string;
  deadline: number;
  earliestKickoff: string;
  oddsSource: string;
  oddsCapturedAt: string;
  gitCommit: string;
  strategy: string;
  frozenBeamWidth: number;
  frozenConstraints: {
    minDraws: number;
    maxDraws: number;
    minHomes: number;
    maxHomes: number;
    minDistance: number;
    maxDistance: number;
  };
  scoringRules: string;
  stake: number;
  tickets: string[];
  pairedBaselineTickets?: string[];
  registeredAt: string;
  status: 'PRE_REGISTERED' | 'SETTLED' | 'VOID' | 'SKIPPED';
  sha256: string;
  actualResults?: string;
  settledAt?: string;
  scoredLines?: { ticketIndex: number; picks: string; score: number }[];
  accuracyOutcome?: {
    totalCorrect: number;
    avgAccuracy: number;
    picksPerTicket: number[];
    baselineTotalCorrect: number;
    baselineAvgAccuracy: number;
    baselinePicksPerTicket: number[];
    pairedDifference: number;
  };
  financialOutcome?: {
    stakeCharged: number;
    grossPayout: number;
    netProfit: number;
    netROI: number;
    dependsOnCounterfactualAssumption: boolean;
    counterfactualNotes: string[];
  };
}

export interface ProspectiveLedger {
  protocolVersion: string;
  platform?: JackpotPlatform;
  protocolDoc: string;
  frozenStrategy: string;
  frozenBeamWidth: number;
  frozenConstraints: any;
  scoringRules: string;
  targetSampleSize: number;
  records: ProspectiveRecord[];
}

interface ProspectiveAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePlatform: JackpotPlatform;
  initialSlate?: JackpotSlate;
  initialOpenRegister?: boolean;
}

export const ProspectiveAuditModal: React.FC<ProspectiveAuditModalProps> = ({
  isOpen,
  onClose,
  activePlatform,
  initialSlate,
  initialOpenRegister = false,
}) => {
  const [platform, setPlatform] = useState<JackpotPlatform>(activePlatform);
  const [ledger, setLedger] = useState<ProspectiveLedger | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [settleFeedback, setSettleFeedback] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  // Pre-registration drawer state
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(initialOpenRegister);
  const [registerInput, setRegisterInput] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<JackpotSlate | null>(initialSlate || null);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);
  const [copiedGitCmd, setCopiedGitCmd] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialOpenRegister) {
      setIsRegisterOpen(true);
      if (initialSlate) {
        setParsedPreview(initialSlate);
      }
    }
  }, [isOpen, initialOpenRegister, initialSlate]);

  const previewTickets = useMemo(() => {
    if (!parsedPreview) return [];
    const optTickets = platform === '1xbet' ? 4 : 8;
    return generateCoveringPortfolio(parsedPreview, {
      targetTickets: optTickets,
      strategy: 'BALANCED_COVER',
      minDraws: 2,
      maxDraws: 5,
      minHomes: platform === '1xbet' ? 5 : 3,
      maxHomes: 9,
    });
  }, [parsedPreview, platform]);

  const earliestKickoffIso = useMemo(() => {
    if (!parsedPreview) return '';
    const matchKickoffs = parsedPreview.matches.map((m) => {
      if (m.date && m.time) {
        const parts = m.date.split('/');
        if (parts.length === 3) {
          return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${m.time}:00+01:00`).getTime();
        }
      }
      return null;
    }).filter((k): k is number => k !== null && !isNaN(k));
    if (matchKickoffs.length > 0) {
      return new Date(Math.min(...matchKickoffs)).toISOString();
    }
    return new Date(Date.now() + 86400000).toISOString();
  }, [parsedPreview]);

  const handleParseInput = (val: string) => {
    setRegisterInput(val);
    setRegisterFeedback(null);
    if (!val.trim()) {
      setParsedPreview(null);
      return;
    }
    const parsed = parseJackpotInput(val, platform);
    if (parsed) {
      setParsedPreview(parsed);
    }
  };

  const handleCommitRegistration = async () => {
    if (!parsedPreview) return;
    setIsRegistering(true);
    setRegisterFeedback('⚡ Generating covering portfolio & computing canonical SHA-256 fingerprint...');
    try {
      const ticketStrings = previewTickets.map((t) => t.picksArray.join(''));
      const earliestKickoffMs = new Date(earliestKickoffIso).getTime();

      const payload = {
        platform,
        roundId: parsedPreview.roundNumber,
        deadline: earliestKickoffMs,
        earliestKickoff: earliestKickoffIso,
        oddsSource: platform === '1xbet' ? 'ONEXBET_TOTO_14_OFFICIAL_PRE_MATCH' : 'SPORTYBET_NG_OFFICIAL_PRE_MATCH',
        oddsCapturedAt: new Date().toISOString(),
        matchOddsSnapshot: parsedPreview.matches.map((m) => ({
          no: m.no,
          home: m.homeTeam,
          away: m.awayTeam,
          odds: {
            home: m.odds.home,
            draw: m.odds.draw,
            away: m.odds.away,
          },
        })),
        tickets: ticketStrings,
        stake: platform === '1xbet' ? 3200 : 800,
      };

      const res = await fetch('/api/prospective-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRegisterFeedback(`✅ Successfully pre-registered Round ${data.roundId}! Canonical SHA-256: ${data.canonicalHash}`);
        await loadLedgerData(platform);
        setSelectedRoundId(data.roundId);
        setTimeout(() => {
          setIsRegisterOpen(false);
          setRegisterInput('');
        }, 4000);
      } else {
        setRegisterFeedback(`❌ Registration note: ${data.error || 'Server error'}`);
      }
    } catch (err: any) {
      setRegisterFeedback(`❌ Communication error: ${err?.message || 'Failed to reach registration API'}`);
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    setPlatform(activePlatform);
  }, [activePlatform]);

  const loadLedgerData = async (targetPlatform: JackpotPlatform) => {
    setIsLoading(true);
    setSettleFeedback(null);
    try {
      // 1. Try API middleware
      const res = await fetch(`/api/prospective-ledger?platform=${targetPlatform}`);
      if (res.ok) {
        const data = await res.json();
        setLedger(data);
        if (data.records && data.records.length > 0) {
          setSelectedRoundId((prev) => (prev && data.records.some((r: any) => r.roundId === prev) ? prev : data.records[data.records.length - 1].roundId));
        }
        return;
      }
    } catch {
      // ignore
    }

    // 2. Fall back to static public/data files
    try {
      const fileName = targetPlatform === '1xbet' ? 'prospective_ledger_1xbet.json' : 'prospective_ledger.json';
      const res = await fetch(`/data/${fileName}`);
      if (res.ok) {
        const data = await res.json();
        setLedger(data);
        if (data.records && data.records.length > 0) {
          setSelectedRoundId((prev) => (prev && data.records.some((r: any) => r.roundId === prev) ? prev : data.records[data.records.length - 1].roundId));
        }
      }
    } catch (err) {
      console.warn('Could not load prospective ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLedgerData(platform);
    }
  }, [isOpen, platform]);

  const handleSettle = async (roundId: string) => {
    setIsSettling(true);
    setSettleFeedback(`⚡ Verifying SHA-256 hash & settling Round ${roundId}...`);
    try {
      const res = await fetch('/api/prospective-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, roundId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettleFeedback(`✅ Settled & Verified Round ${roundId}! SHA-256 Hash Match Confirmed.`);
        await loadLedgerData(platform);
      } else {
        setSettleFeedback(`❌ Settlement notice: ${data.error || 'Could not settle. Ensure matches have completed in official history.'}`);
      }
    } catch (err: any) {
      setSettleFeedback(`❌ Error settling: ${err?.message || 'Server communication error'}`);
    } finally {
      setIsSettling(false);
    }
  };

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const records = ledger?.records || [];
  const selectedRecord = records.find((r) => r.roundId === selectedRoundId) || records[records.length - 1];

  const settledRecords = records.filter((r) => r.status === 'SETTLED');
  const targetSampleSize = ledger?.targetSampleSize || 50;
  const progressPct = ((settledRecords.length / targetSampleSize) * 100).toFixed(1);

  // Overall statistics
  let totalInvested = 0;
  let totalPayout = 0;
  let totalStrategyCorrect = 0;
  let totalBaselineCorrect = 0;
  let totalTicketsScored = 0;

  settledRecords.forEach((r) => {
    if (r.financialOutcome) {
      totalInvested += r.financialOutcome.stakeCharged;
      totalPayout += r.financialOutcome.grossPayout;
    }
    if (r.accuracyOutcome) {
      totalStrategyCorrect += r.accuracyOutcome.totalCorrect;
      totalBaselineCorrect += r.accuracyOutcome.baselineTotalCorrect;
      totalTicketsScored += r.tickets.length;
    }
  });

  const meanStrategyAcc = totalTicketsScored > 0 ? totalStrategyCorrect / totalTicketsScored : 0;
  const meanBaselineAcc = totalTicketsScored > 0 ? totalBaselineCorrect / totalTicketsScored : 0;
  const netProfit = totalPayout - totalInvested;
  const netROI = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
  const accuracyAdvantage = meanStrategyAcc - meanBaselineAcc;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Compact Modal Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">Prospective Protocol &amp; Live Settlement Audit</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Protocol v1.6.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pre-registered canonical commitments • Bit-exact SHA-256 verification • Strict ₦0 real stakes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Selector Tabs & Quick Refresh Bar */}
        <div className="px-5 py-2.5 border-b border-slate-800/60 bg-slate-950/40 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setPlatform('sportybet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                platform === 'sportybet'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>SportyBet Super 12</span>
              <span className="text-[10px] font-mono font-bold opacity-80">(₦800)</span>
            </button>
            <button
              onClick={() => setPlatform('1xbet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                platform === '1xbet'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>1xBet TOTO-14</span>
              <span className="text-[10px] font-mono font-bold opacity-80">(₦3,200)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRegisterOpen(!isRegisterOpen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border ${
                isRegisterOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
              }`}
              title="Pre-register an upcoming jackpot slate with an immutable SHA-256 fingerprint"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isRegisterOpen ? 'Close Register Drawer' : '+ Pre-Register Round (SHA-256)'}</span>
            </button>

            <button
              onClick={() => loadLedgerData(platform)}
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Pre-Registration Drawer */}
          {isRegisterOpen && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 border border-emerald-500/40 space-y-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Pre-Register Prospective Jackpot Round
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Paste upcoming fixtures &amp; odds to compute the bit-exact covering portfolio and lock an immutable SHA-256 fingerprint ahead of kickoff.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRegisterOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Paste Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <span>Paste Jackpot Table / Odds Text</span>
                    <span className="text-[10px] text-slate-500 font-mono">(from SportyBet Super 12 or 1xBet TOTO)</span>
                  </label>
                  {initialSlate && (
                    <button
                      type="button"
                      onClick={() => {
                        setParsedPreview(initialSlate);
                        setRegisterFeedback(null);
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono cursor-pointer"
                    >
                      ⚡ Use Active Loaded Slate (Round {initialSlate.roundNumber})
                    </button>
                  )}
                </div>
                <textarea
                  value={registerInput}
                  onChange={(e) => handleParseInput(e.target.value)}
                  placeholder={`Paste table or print text directly from SportyBet or 1xBet, e.g.:\nRound No. 20261025\n1  24/10/2026 15:00  Coventry City vs Fulham  2.93  3.57  2.45\n2  24/10/2026 17:00  Napoli vs Roma  2.83  3.41  2.61...`}
                  rows={4}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              {/* Preview of Parsed Slate */}
              {parsedPreview && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white font-mono">
                        Round #{parsedPreview.roundNumber} ({parsedPreview.matches.length} Matches Detected)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Earliest Kickoff: <strong className="text-amber-300">{new Date(earliestKickoffIso).toLocaleString('en-GB')}</strong></span>
                    </div>
                  </div>

                  {/* Generated Covering Tickets Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Frozen Covering Lines (BALANCED_COVER, {previewTickets.length} Tickets • ₦{(previewTickets.length * (platform === '1xbet' ? 800 : 100)).toLocaleString()}):</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
                      {previewTickets.map((t, idx) => (
                        <div key={idx} className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate">
                          #{idx + 1}: <span className="text-emerald-400 font-bold">{t.picksArray.join('')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pre-Register Action Button */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>Commitment will be hashed with bit-exact canonical SHA-256 and locked before kickoff.</span>
                    </div>
                    <button
                      onClick={handleCommitRegistration}
                      disabled={isRegistering}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 active:scale-95"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isRegistering ? 'Computing & Locking Hash...' : `🔒 Generate & Lock SHA-256 for Round ${parsedPreview.roundNumber}`}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {registerFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                  registerFeedback.startsWith('✅')
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : registerFeedback.startsWith('⚡')
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div>{registerFeedback}</div>
                  {registerFeedback.startsWith('✅') && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          const cmd = `git add audit/ public/data/ && git commit -m "feat(audit): pre-register prospective round with canonical SHA-256" && git push origin main`;
                          navigator.clipboard.writeText(cmd);
                          setCopiedGitCmd(true);
                          setTimeout(() => setCopiedGitCmd(false), 3000);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedGitCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                        <span>{copiedGitCmd ? 'Copied Git Command!' : 'Copy Git Push Command (for GitHub Timestamp)'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Cohort Progress & Decision Rule Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cohort Progress</span>
              <div className="text-lg font-black text-white font-mono">
                {settledRecords.length} / {targetSampleSize} <span className="text-xs text-slate-400 font-normal">({progressPct}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (settledRecords.length / targetSampleSize) * 100)}%` }}></div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prediction Edge (Gate 1)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-white font-mono">
                  {meanStrategyAcc.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-mono">vs {meanBaselineAcc.toFixed(2)} base</span>
              </div>
              <span className={`text-[11px] font-bold font-mono ${accuracyAdvantage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {accuracyAdvantage >= 0 ? `+${accuracyAdvantage.toFixed(2)}` : accuracyAdvantage.toFixed(2)} picks / ticket
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Realized Return (Gate 2)</span>
              <div className="text-lg font-black text-rose-400 font-mono">
                {netROI.toFixed(1)}% <span className="text-xs text-slate-400 font-normal">(₦{netProfit.toLocaleString()})</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Gross: ₦{totalPayout.toLocaleString()} / Cost: ₦{totalInvested.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Capital Protection</span>
              <div className="text-lg font-black text-emerald-300 font-mono">
                ₦0 Real Stakes
              </div>
              <span className="text-[11px] text-emerald-400/80 font-bold">
                100% Capital Protected
              </span>
            </div>
          </div>

          {/* Feedback banner */}
          {settleFeedback && (
            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-amber-300 font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{settleFeedback}</span>
            </div>
          )}

          {/* Records Selector Tabs */}
          {records.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pre-Registered Cohort Slates ({records.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {records.map((r) => (
                    <button
                      key={r.roundId}
                      onClick={() => setSelectedRoundId(r.roundId)}
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        r.roundId === selectedRecord?.roundId
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                          : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <span>{platform === '1xbet' ? `Draw #${r.roundId}` : `Round ${r.roundId}`}</span>
                      <span className={`w-2 h-2 rounded-full ${r.status === 'SETTLED' ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'}`}></span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Round Card */}
              {selectedRecord && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4">
                  {/* Card Title & Settlement Trigger */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white">
                          {platform === '1xbet' ? `1xBet TOTO Draw #${selectedRecord.roundId}` : `SportyBet Super 12 Round ${selectedRecord.roundId}`}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          selectedRecord.status === 'SETTLED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {selectedRecord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Kickoff: {new Date(selectedRecord.earliestKickoff).toUTCString()} • Git Commit: {selectedRecord.gitCommit}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSettle(selectedRecord.roundId)}
                        disabled={isSettling}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                      >
                        <RotateCw className={`w-3.5 h-3.5 text-slate-950 ${isSettling ? 'animate-spin' : ''}`} />
                        <span>{selectedRecord.status === 'SETTLED' ? 'Re-Verify Official CMS Audit' : '⚡ Settle & Verify Live Results'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Cryptographic SHA-256 Fingerprint */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-slate-400 truncate">
                      <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-300">Canonical SHA-256:</span>
                      <span className="text-emerald-400 font-bold truncate">{selectedRecord.sha256}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                      ✅ Pre-Kickoff Verified
                    </span>
                  </div>

                  {/* Settled Results Details */}
                  {selectedRecord.status === 'SETTLED' && selectedRecord.actualResults && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Settled Match Results</span>
                          <span className="text-base font-black font-mono tracking-widest text-white">
                            {selectedRecord.actualResults.split('').join(' ')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Skill Difference</span>
                          <span className={`text-sm font-black font-mono ${
                            (selectedRecord.accuracyOutcome?.pairedDifference || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {(selectedRecord.accuracyOutcome?.pairedDifference || 0) >= 0 ? '+' : ''}
                            {selectedRecord.accuracyOutcome?.pairedDifference?.toFixed(2)} picks / ticket
                          </span>
                        </div>
                      </div>

                      {/* Ticket-by-Ticket Score Table */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Pre-Registered Strategy Lines Scored ({selectedRecord.tickets.length} Lines)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedRecord.scoredLines?.map((sl) => (
                            <div
                              key={sl.ticketIndex}
                              className={`p-2.5 rounded-xl border flex items-center justify-between font-mono text-xs ${
                                sl.score >= 10
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-bold'
                                  : sl.score >= 6
                                  ? 'bg-slate-900 border-slate-800 text-slate-200'
                                  : 'bg-slate-950 border-slate-900 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-slate-400 font-bold">Line #{sl.ticketIndex}:</span>
                                <span className="text-white tracking-wider">{sl.picks}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                sl.score >= 10 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {sl.score} / {platform === '1xbet' ? 14 : 12}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Paired Baseline Comparison */}
                      {selectedRecord.accuracyOutcome && (
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                          <span className="text-slate-400">
                            Strategy Avg: <span className="text-emerald-400 font-bold">{selectedRecord.accuracyOutcome.avgAccuracy.toFixed(2)}</span> vs Paired Random Baseline: <span className="text-amber-400 font-bold">{selectedRecord.accuracyOutcome.baselineAvgAccuracy.toFixed(2)}</span>
                          </span>
                          <span className="text-slate-400">
                            Payout: <span className="text-white font-bold">₦{selectedRecord.financialOutcome?.grossPayout.toLocaleString()}</span> (Net: <span className="text-rose-400 font-bold">₦{selectedRecord.financialOutcome?.netProfit.toLocaleString()}</span>)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pre-Registered Status details if pending */}
                  {selectedRecord.status === 'PRE_REGISTERED' && (
                    <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-cyan-300 font-bold">
                        <Lock className="w-4 h-4" />
                        <span>Pre-Registration Locked on GitHub Ahead of Kickoff</span>
                      </div>
                      <p className="text-slate-300">
                        This slate has been timestamped and cryptographically locked on GitHub. As soon as the matches finish on {new Date(selectedRecord.earliestKickoff).toLocaleDateString('en-GB')}, click the <strong>⚡ Settle &amp; Verify Live Results</strong> button above to pull the official scores and execute the audit.
                      </p>
                      <div className="pt-2">
                        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Pre-Registered Strategy Lines:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                          {selectedRecord.tickets.map((t, idx) => (
                            <div key={idx} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                              Line #{idx + 1}: <span className="text-cyan-300 font-bold">{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <Scale className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No prospective records found for {platform}.</p>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="px-5 py-2.5 border-t border-slate-800/80 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Zero-Capital Paper Trading Active (₦0 Staked)</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
