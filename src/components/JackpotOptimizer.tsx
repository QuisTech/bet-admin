import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Target,
  Sparkles,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Zap,
  Info,
  Layers,
  Download,
  BookOpen,
  Filter,
  Flame,
  CheckCircle2,
  BookmarkPlus,
  Dices,
  BarChart3,
  Activity,
  RotateCw,
} from 'lucide-react';
import type { LoggedBet } from '../types';
import { getLoggedBets, saveLoggedBets, notifyLedgerUpdated } from '../services/ledgerService';
import { isFirebaseConfigured, saveBetToFirestore } from '../services/firebaseService';
import {
  type JackpotPlatform,
  type JackpotOutcome,
  type JackpotSlate,
  type CoveringTicket,
  type ReductionConfig,
  type MonteCarloResult,
  SPORTYBET_ROUND_20261018,
  ONEXBET_TOTO_DRAW_1154,
  generateCoveringPortfolio,
  generateSportyBetConsoleScript,
  generateOneXBetConsoleScript,
  generateOneXBetBatchFormat,
  parseJackpotInput,
  runJackpotMonteCarlo,
} from '../services/jackpotService';

export const JackpotOptimizer: React.FC = () => {
  const [platform, setPlatform] = useState<JackpotPlatform>('sportybet');
  const [slate, setSlate] = useState<JackpotSlate>(SPORTYBET_ROUND_20261018);

  // Custom user match locks: matchNo -> array of chosen outcomes ['1', 'X']
  const [userSelections, setUserSelections] = useState<{ [matchNo: number]: JackpotOutcome[] }>({});

  // Switch slate when platform changes
  const handlePlatformChange = (p: JackpotPlatform) => {
    setPlatform(p);
    if (p === 'sportybet') {
      setSlate(SPORTYBET_ROUND_20261018);
    } else {
      setSlate(ONEXBET_TOTO_DRAW_1154);
    }
    setUserSelections({});
    setCopiedTicketId(null);
    setCopiedConsoleId(null);
    setCopiedBatch(false);
  };

  // Solver Configuration
  const [targetTickets, setTargetTickets] = useState<number>(8);
  const [strategy, setStrategy] = useState<'BALANCED_COVER' | 'JACKPOT_MAX_PROB' | 'CONTRARIAN_HIGH_EV'>('BALANCED_COVER');
  const [minDraws, setMinDraws] = useState<number>(2);
  const [maxDraws, setMaxDraws] = useState<number>(4);
  const [minHomes, setMinHomes] = useState<number>(4);
  const [maxHomes, setMaxHomes] = useState<number>(8);

  // Explanatory Strategy Modal / Guide
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Manual Ingest State
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [rawHtmlInput, setRawHtmlInput] = useState('');
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Copy Feedback
  const [copiedTicketId, setCopiedTicketId] = useState<number | null>(null);
  const [copiedConsoleId, setCopiedConsoleId] = useState<number | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);

  // Ledger Logging Feedback
  const [loggedTicketIds, setLoggedTicketIds] = useState<Set<number>>(new Set());
  const [loggedAllSuccess, setLoggedAllSuccess] = useState(false);

  // Toggle match outcome selection (Lock single banker, or double/triple)
  const toggleOutcome = (matchNo: number, outcome: JackpotOutcome) => {
    setUserSelections((prev) => {
      const current = prev[matchNo] || [];
      let updated: JackpotOutcome[];
      if (current.includes(outcome)) {
        updated = current.filter((o) => o !== outcome);
        // Avoid empty selection
        if (updated.length === 0) {
          const match = slate.matches.find((m) => m.no === matchNo);
          updated = [match?.recommendedOutcome || '1'];
        }
      } else {
        updated = [...current, outcome];
      }
      return { ...prev, [matchNo]: updated };
    });
  };

  // Reset selections to AI Recommended
  const handleResetToAI = () => {
    setUserSelections({});
  };

  // Compute total combinations in user selections
  const fullCombinationCount = useMemo(() => {
    return slate.matches.reduce((acc, m) => {
      const picks = userSelections[m.no] || m.recommendedDoubles;
      return acc * Math.max(1, picks.length);
    }, 1);
  }, [slate, userSelections]);

  const fullPermutationCost = fullCombinationCount * slate.stakePerComboNGN;

  // Generate Portfolio using Covering Codes
  const reductionConfig: ReductionConfig = useMemo(() => {
    return {
      targetTickets,
      strategy,
      minDraws,
      maxDraws,
      minHomes,
      maxHomes,
    };
  }, [targetTickets, strategy, minDraws, maxDraws, minHomes, maxHomes]);

  const generatedTickets: CoveringTicket[] = useMemo(() => {
    return generateCoveringPortfolio(slate, reductionConfig, userSelections);
  }, [slate, reductionConfig, userSelections]);

  // Monte Carlo Simulation Engine State
  const [mcIterations, setMcIterations] = useState<number>(25000);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSeed, setSimSeed] = useState<number>(0);

  const monteCarloResult: MonteCarloResult = useMemo(() => {
    return runJackpotMonteCarlo(slate, generatedTickets, mcIterations);
  }, [slate, generatedTickets, mcIterations, simSeed]);

  const handleRerunMonteCarlo = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setSimSeed((s) => s + 1);
      setIsSimulating(false);
    }, 150);
  };

  // Handle Raw Ingest
  const handleIngestSubmit = () => {
    setIngestError(null);
    const parsed = parseJackpotInput(rawHtmlInput, platform);
    if (parsed) {
      setSlate(parsed);
      setUserSelections({});
      setIsIngestOpen(false);
      setRawHtmlInput('');
    } else {
      setIngestError('Could not parse valid matches from the input. Make sure to paste the full HTML or text from the page.');
    }
  };

  // Copy Helpers
  const copyText = (text: string, onSuccess: () => void) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(onSuccess);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onSuccess();
    }
  };

  // Download 1xBet Batch File
  const handleDownloadBatchFile = () => {
    const batch = generateOneXBetBatchFormat(generatedTickets, slate.stakePerComboNGN);
    const blob = new Blob([batch], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `1xbet_toto_draw_${slate.roundNumber}_batch.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Log Single Ticket to BetLedger
  const handleLogTicketToLedger = (ticket: CoveringTicket) => {
    const betId = `pool_${platform}_${slate.roundNumber}_t${ticket.id}_${Date.now()}`;
    const newBet: LoggedBet = {
      id: betId,
      timestamp: new Date().toISOString(),
      dateDisplay: `${new Date().toLocaleDateString('en-GB')} / ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      league: platform === 'sportybet' ? 'SportyBet Super Jackpot' : '1xBet TOTO Football',
      match: `${platform === 'sportybet' ? 'Sporty 12' : 'TOTO-14'} (Round ${slate.roundNumber}) - Ticket #${ticket.id}`,
      selection: `${slate.totalGames}-Fold System: ${ticket.summaryString}`,
      marketType: 'POOL_JACKPOT',
      bookmaker: platform === 'sportybet' ? 'SportyBet' : '1xBet',
      priceTaken: Math.round(slate.jackpotPrizeNGN / slate.stakePerComboNGN),
      pinnacleLineAtBet: 1000.0,
      pinnacleClosingLine: 1000.0,
      modelProb: ticket.jointProbability,
      modelEV: 15.0,
      stake: slate.stakePerComboNGN,
      payout: 0,
      outcome: 'OPEN',
      notes: `${ticket.strategyTag} | Tier: ${ticket.guaranteeTier} | Macro: ${ticket.homeCount}H-${ticket.drawCount}X-${ticket.awayCount}A`,
    };

    const currentBets = getLoggedBets();
    const updated = [newBet, ...currentBets.filter((b) => b.id !== betId)];
    saveLoggedBets(updated);
    notifyLedgerUpdated(updated);
    if (isFirebaseConfigured()) {
      saveBetToFirestore(newBet).catch((err) => console.warn('Firestore pool save error:', err));
    }
    setLoggedTicketIds((prev) => new Set([...prev, ticket.id]));
  };

  // Log All Generated Tickets to BetLedger
  const handleLogAllTicketsToLedger = () => {
    const currentBets = getLoggedBets();
    const newBets: LoggedBet[] = [];
    const newLoggedIds = new Set(loggedTicketIds);

    generatedTickets.forEach((ticket, i) => {
      const betId = `pool_${platform}_${slate.roundNumber}_t${ticket.id}_${Date.now()}_${i}`;
      newLoggedIds.add(ticket.id);
      newBets.push({
        id: betId,
        timestamp: new Date().toISOString(),
        dateDisplay: `${new Date().toLocaleDateString('en-GB')} / ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        league: platform === 'sportybet' ? 'SportyBet Super Jackpot' : '1xBet TOTO Football',
        match: `${platform === 'sportybet' ? 'Sporty 12' : 'TOTO-14'} (Round ${slate.roundNumber}) - Ticket #${ticket.id}`,
        selection: `${slate.totalGames}-Fold System: ${ticket.summaryString}`,
        marketType: 'POOL_JACKPOT',
        bookmaker: platform === 'sportybet' ? 'SportyBet' : '1xBet',
        priceTaken: Math.round(slate.jackpotPrizeNGN / slate.stakePerComboNGN),
        pinnacleLineAtBet: 1000.0,
        pinnacleClosingLine: 1000.0,
        modelProb: ticket.jointProbability,
        modelEV: 15.0,
        stake: slate.stakePerComboNGN,
        payout: 0,
        outcome: 'OPEN',
        notes: `${ticket.strategyTag} | Tier: ${ticket.guaranteeTier}`,
      });
    });

    const updated = [...newBets, ...currentBets];
    saveLoggedBets(updated);
    notifyLedgerUpdated(updated);
    if (isFirebaseConfigured()) {
      newBets.forEach((b) => saveBetToFirestore(b).catch(() => {}));
    }
    setLoggedTicketIds(newLoggedIds);
    setLoggedAllSuccess(true);
    setTimeout(() => setLoggedAllSuccess(false), 3000);
  };

  const totalCostNGN = generatedTickets.length * slate.stakePerComboNGN;
  const savingsPercent = fullPermutationCost > 0
    ? Math.max(0, ((fullPermutationCost - totalCostNGN) / fullPermutationCost) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header & Platform Switcher */}
      <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Jackpot &amp; Football Pool Combinatorial Solver</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                PRO SYNDICATE
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Replaces blind luck with combinatorial covering codes, Shin de-vigged fair probabilities, and game-theoretic public bias fading.
          </p>
        </div>

        {/* Action Controls: Platform Switcher & Help Modal Button */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-400 hover:text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="How does this help? Read the mathematical edge & syndicate strategy"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>How Does This Help?</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => handlePlatformChange('sportybet')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                platform === 'sportybet'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Sporty 12 (₦74.7M)</span>
            </button>
            <button
              onClick={() => handlePlatformChange('1xbet')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                platform === '1xbet'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>1xBet TOTO-14 (₦16.4M+)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Educational "How Does This Help?" Guide Drawer/Modal */}
      {isHelpOpen && (
        <div className="p-6 rounded-3xl bg-slate-950 border border-amber-500/40 space-y-4 shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                🧠
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  How Combinatorial Algorithms Beat Casual Jackpot Bettors
                </h3>
                <span className="text-[11px] text-slate-400">
                  The 4 Mathematical Edges of Football Pool Syndicates
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
            >
              Close Guide
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Card 1 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>1. De-Vigged Fair Edge</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Bookmakers add 6%–10% juice to 1X2 odds. We strip the vig using Shin de-vigging to calculate true mathematical chances, identifying true anchors (bankers) vs disguised toss-ups.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Flame className="w-4 h-4 shrink-0" />
                <span>2. Fading Public Crowd Bias</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                In pools, you play against the public. Casual players heavily under-pick Draws (only 21%–23%) and over-pick big brand names. Fading the crowd yields massive positive EV and solo prize shares.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>3. Ternary Covering Codes</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Playing all combinations costs tens of thousands. Covering algorithms find the smallest subset of tickets (e.g. 8 or 16) that guarantees 100% capture of consolation tiers (10/12 or 11/14).
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                <Filter className="w-4 h-4 shrink-0" />
                <span>4. Macro-Statistical Filters</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Historical jackpots rarely end with 0 draws or 7 draws. The historical peak is 2 to 4 draws and 4 to 7 home wins. Outliers are purged, eliminating wasted stakes.
              </p>
            </div>
          </div>

          {/* Platform Specific Rules Box */}
          <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300">
                {platform === 'sportybet' ? '⚡ Sporty 12 Specific Rules:' : '⚡ 1xBet TOTO Football Specific Rules:'}
              </span>
              <p className="text-slate-400">
                {platform === 'sportybet'
                  ? 'Predict 12 matches. Super Jackpot (₦74.7M) split for 12/12. Consolation prizes awarded for 11/12 and 10/12. If 1 match voided: 30% Super Jackpot awarded; 2+ voided: all bets refunded.'
                  : 'Predict 14 matches. 90% of pool distributed across 6 tiers (14, 13, 12, 11, 10, 9 correct). Minimum bet ₦800 per combo. Batch betting supported.'}
              </p>
            </div>
            <span className="font-mono text-cyan-400 font-bold shrink-0">
              {platform === 'sportybet' ? 'Stake: ₦100/line' : 'Stake: ₦800/line'}
            </span>
          </div>
        </div>
      )}

      {/* 3. Slate Prize & Rules Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Jackpot Pool */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              {platform === 'sportybet' ? 'Super Jackpot Prize Pool' : 'Current Minimum Jackpot'}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              {platform === 'sportybet' ? `Round ${slate.roundNumber}` : `Draw no. ${slate.roundNumber}`}
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              ₦{slate.jackpotPrizeNGN.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-300/80 font-medium mt-0.5">
              {slate.consolations}
            </div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Info className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{slate.timeRemaining}</span>
          </div>
        </div>

        {/* Card 2: Strategic Covering Summary */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Covering Optimization
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {generatedTickets.length} Covering Lines
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              ₦{totalCostNGN.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Full Permutation: ₦{fullPermutationCost.toLocaleString()} ({fullCombinationCount} combos)</span>
              {savingsPercent > 0 && (
                <span className="text-emerald-400 font-bold font-mono">
                  (-{savingsPercent.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{platform === 'sportybet' ? '10/12 & 11/12 Consolation Cover' : '6 Tiers Consolation Cover (9-13/14)'}</span>
          </div>
        </div>

        {/* Card 3: Action & Ingest Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Slate Ingest &amp; Live DOM
            </span>
            <button
              onClick={() => setIsIngestOpen(!isIngestOpen)}
              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              {isIngestOpen ? 'Close Ingest' : 'Paste New Round HTML'}
            </button>
          </div>
          <div className="my-1 text-xs text-slate-300 leading-relaxed">
            {platform === 'sportybet'
              ? 'Sporty 12: Oct 17-18 Weekend Slate Loaded'
              : '1xBet TOTO: Draw 1154 European Slate Loaded'}
          </div>
          {platform === '1xbet' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const batch = generateOneXBetBatchFormat(generatedTickets, slate.stakePerComboNGN);
                  copyText(batch, () => {
                    setCopiedBatch(true);
                    setTimeout(() => setCopiedBatch(false), 2500);
                  });
                }}
                className="flex-1 py-1.5 px-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copiedBatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBatch ? 'Copied Batch Bet!' : 'Copy Batch Lines'}</span>
              </button>
              <button
                onClick={handleDownloadBatchFile}
                className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                title="Download .txt batch file for 1xBet batch bet window"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.txt</span>
              </button>
            </div>
          )}
          {platform === 'sportybet' && (
            <div className="text-[10px] text-slate-400 font-mono">
              Individual console auto-fillers ready below for 1-click execution.
            </div>
          )}
        </div>
      </div>

      {/* Ingest Accordion */}
      {isIngestOpen && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white">
                Paste Raw HTML or Text from {platform === 'sportybet' ? 'SportyBet Jackpot' : '1xBet TOTO'}
              </h4>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono">
              📱 Smartphone friendly: Copy text directly off your phone screen or paste raw HTML from desktop.
            </span>
          </div>

          <textarea
            rows={4}
            value={rawHtmlInput}
            onChange={(e) => setRawHtmlInput(e.target.value)}
            placeholder={`📱 Smartphone: Select & copy visible match text from ${
              platform === 'sportybet' ? 'sportybet.com/ng/jackpot' : '1xbet.com/en/toto/football'
            } and paste here...\n💻 Desktop: You can also paste raw container HTML.`}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
          />

          {ingestError && (
            <div className="text-xs text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{ingestError}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleIngestSubmit}
              disabled={!rawHtmlInput.trim()}
              className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              Parse &amp; Load New Slate
            </button>
            <button
              onClick={() => {
                setIsIngestOpen(false);
                setIngestError(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 4. Mathematical Probability & Interactive Selections Matrix */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Match Probabilities &amp; Strategic Roles ({slate.totalGames} Games)</span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Click 1, X, or 2 to lock Bankers or Double Covers)
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToAI}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
            >
              Reset to AI Recommendations
            </button>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                BANKER (44%+)
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                SECONDARY (40%+)
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                DOUBLE HEDGE
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                PUBLIC TRAP
              </span>
            </div>
          </div>
        </div>

        {/* Matches Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Date / Match</th>
                <th className="py-2.5 px-3 text-center">1 (Home)</th>
                <th className="py-2.5 px-3 text-center">X (Draw)</th>
                <th className="py-2.5 px-3 text-center">2 (Away)</th>
                <th className="py-2.5 px-3 text-center">Role</th>
                <th className="py-2.5 px-3 text-center">Your Selection</th>
                <th className="py-2.5 px-3 text-left min-w-[280px]">Analysis &amp; Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {slate.matches.map((m) => {
                const chosen = userSelections[m.no] || m.recommendedDoubles;
                const isBankerLocked = chosen.length === 1;

                return (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-400">{m.matchNumber}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{m.homeTeam}</span>
                        <span className="text-slate-500 text-[11px]">vs</span>
                        <span>{m.awayTeam}</span>
                        {m.publicTrap && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold"
                            title="Public crowd over-picking this outcome contrary to fair price"
                          >
                            ⚠️ TRAP
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {m.dateDisplay} • {m.league}
                      </div>
                    </td>

                    {/* 1 Home Button */}
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => toggleOutcome(m.no, '1')}
                        className={`w-full py-1.5 px-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center border ${
                          chosen.includes('1')
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-black shadow-sm'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs">{(m.fairProbabilities.home * 100).toFixed(0)}%</span>
                        <span className="text-[9px] text-slate-500">
                          {m.odds ? m.odds.home.toFixed(2) : `${m.crowdPercent?.home}%`}
                        </span>
                      </button>
                    </td>

                    {/* X Draw Button */}
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => toggleOutcome(m.no, 'X')}
                        className={`w-full py-1.5 px-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center border ${
                          chosen.includes('X')
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-black shadow-sm'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs">{(m.fairProbabilities.draw * 100).toFixed(0)}%</span>
                        <span className="text-[9px] text-slate-500">
                          {m.odds ? m.odds.draw.toFixed(2) : `${m.crowdPercent?.draw}%`}
                        </span>
                      </button>
                    </td>

                    {/* 2 Away Button */}
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => toggleOutcome(m.no, '2')}
                        className={`w-full py-1.5 px-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center border ${
                          chosen.includes('2')
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-black shadow-sm'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs">{(m.fairProbabilities.away * 100).toFixed(0)}%</span>
                        <span className="text-[9px] text-slate-500">
                          {m.odds ? m.odds.away.toFixed(2) : `${m.crowdPercent?.away}%`}
                        </span>
                      </button>
                    </td>

                    {/* Role Badge */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.role === 'BANKER'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : m.role === 'SECONDARY_BANKER'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : m.role === 'DOUBLE_HEDGE'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : m.role === 'PUBLIC_TRAP'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {m.role === 'SECONDARY_BANKER' ? 'SECONDARY' : m.role}
                      </span>
                    </td>

                    {/* User Selection Display */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                        {chosen.map((c) => (
                          <span
                            key={c}
                            className={`px-1.5 py-0.5 rounded text-xs font-black ${
                              c === '1'
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : c === 'X'
                                ? 'text-cyan-400 bg-cyan-500/10'
                                : 'text-purple-400 bg-purple-500/10'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                        {isBankerLocked && (
                          <span className="text-[9px] text-amber-400 font-bold ml-1">🔒 Single</span>
                        )}
                      </div>
                    </td>

                    {/* Analysis & Edge Full Text */}
                    <td className="py-2.5 px-3 font-sans text-[11px] text-slate-300 min-w-[280px] whitespace-normal leading-relaxed">
                      {(() => {
                        const colonIdx = m.analysis.indexOf(':');
                        if (colonIdx !== -1) {
                          const tag = m.analysis.slice(0, colonIdx);
                          const rest = m.analysis.slice(colonIdx + 1);
                          return (
                            <span>
                              <span className="font-semibold text-slate-200">{tag}:</span>
                              <span className="text-slate-300 ml-1">{rest}</span>
                            </span>
                          );
                        }
                        return <span>{m.analysis}</span>;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Portfolio Generator & Covering Controls */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Combinatorial Covering Reduction Engine
            </h3>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Optimized Portfolio: <span className="font-bold text-emerald-400">₦{totalCostNGN.toLocaleString()}</span> ({generatedTickets.length} lines)
          </div>
        </div>

        {/* Sliders & Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Portfolio Size Selector */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Portfolio Lines (Tickets)
            </label>
            <div className="flex flex-wrap gap-1">
              {[1, 4, 8, 12, 16, 24].map((count) => (
                <button
                  key={count}
                  onClick={() => setTargetTickets(count)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    targetTickets === count
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {count === 1 ? '1 Line' : `${count} Lines`}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              ₦{(targetTickets * slate.stakePerComboNGN).toLocaleString()} investment
            </div>
          </div>

          {/* Strategy Mode */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Optimization Strategy
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="BALANCED_COVER">Balanced Cover (Guaranteed Consolation)</option>
              <option value="JACKPOT_MAX_PROB">Jackpot Hunter (Maximum Probability)</option>
              <option value="CONTRARIAN_HIGH_EV">Contrarian (+EV Crowd Fade)</option>
            </select>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Ternary Hamming distance greedy covering
            </div>
          </div>

          {/* Draw Range Filter */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Draw Filter Range (2 to 5)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Min:</span>
              <input
                type="number"
                min="0"
                max="6"
                value={minDraws}
                onChange={(e) => setMinDraws(parseInt(e.target.value, 10) || 0)}
                className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-mono text-xs text-white"
              />
              <span className="text-xs font-mono text-slate-400">Max:</span>
              <input
                type="number"
                min="1"
                max="8"
                value={maxDraws}
                onChange={(e) => setMaxDraws(parseInt(e.target.value, 10) || 4)}
                className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-mono text-xs text-white"
              />
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Eliminates improbable 0 or 8-draw outliers
            </div>
          </div>

          {/* Home Wins Filter */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Home Wins Range (4 to 8)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Min:</span>
              <input
                type="number"
                min="1"
                max="9"
                value={minHomes}
                onChange={(e) => setMinHomes(parseInt(e.target.value, 10) || 4)}
                className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-mono text-xs text-white"
              />
              <span className="text-xs font-mono text-slate-400">Max:</span>
              <input
                type="number"
                min="4"
                max="12"
                value={maxHomes}
                onChange={(e) => setMaxHomes(parseInt(e.target.value, 10) || 8)}
                className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-mono text-xs text-white"
              />
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Historical pool peak: 4.8 home wins
            </div>
          </div>
        </div>
      </div>

      {/* 6. Monte Carlo Stress-Testing Engine */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Monte Carlo Portfolio Stress-Testing Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                  {monteCarloResult.iterations.toLocaleString()} Runs
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Empirical hit rates, consolation prize probabilities, and public pool dividend simulation ({monteCarloResult.durationMs}ms)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              {[10000, 25000, 50000].map((count) => (
                <button
                  key={count}
                  onClick={() => setMcIterations(count)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    mcIterations === count
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {(count / 1000).toFixed(0)}k Runs
                </button>
              ))}
            </div>

            <button
              onClick={handleRerunMonteCarlo}
              disabled={isSimulating}
              className="py-1.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Simulating...' : 'Re-Run'}</span>
            </button>
          </div>
        </div>

        {/* 4 Hero KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Any Prize Hit Frequency */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Any Prize Win Rate
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Strike Rate
              </span>
            </div>
            <div className="text-xl font-black font-mono text-emerald-400">
              {monteCarloResult.anyPrizeOddsRatio}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {monteCarloResult.anyPrizeHitRatePct}% slates ({monteCarloResult.anyPrizeWinningSlates.toLocaleString()} slates • {monteCarloResult.anyPrizeWinningTickets.toLocaleString()} winning tickets)
            </div>
          </div>

          {/* Card 2: Jackpot Probability */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Jackpot Hit Odds
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Solo: {monteCarloResult.crowdAnalysis.soloJackpotChancePct}%
              </span>
            </div>
            <div className="text-xl font-black font-mono text-amber-400">
              {monteCarloResult.jackpotOddsRatio}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {monteCarloResult.jackpotHitRatePct}% probability ({monteCarloResult.jackpotWinningSlates} slates • {monteCarloResult.jackpotWinningTickets} tix)
            </div>
          </div>

          {/* Card 3: Expected Value & Simulated ROI */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Simulated Net EV
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                  monteCarloResult.roiPct >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {monteCarloResult.roiPct >= 0 ? '+' : ''}{monteCarloResult.roiPct}% ROI
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white">
              ₦{monteCarloResult.expectedReturnPerSlateNGN.toLocaleString()}
              <span className="text-xs text-slate-500 font-normal ml-1">/ ₦{monteCarloResult.costPerSlateNGN.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Est. gross return vs ₦{monteCarloResult.costPerSlateNGN.toLocaleString()} ticket cost
            </div>
          </div>

          {/* Card 4: Bankroll Runway Guidance */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Suggested Runway
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {monteCarloResult.recommendation.recommendedBankrollSlates} Slates
              </span>
            </div>
            <div className="text-xl font-black font-mono text-cyan-400">
              ₦{monteCarloResult.recommendation.recommendedBankrollNGN.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Recommended buffer for {monteCarloResult.recommendation.recommendedBankrollSlates} rounds of play
            </div>
          </div>
        </div>

        {/* Detailed Panels: Tiers Table + Score Histogram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Prize Tier Breakdown Table (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Prize Tier Hit Distribution & Diluted Payouts
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Parimutuel Split Model
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase">
                    <th className="pb-2">Tier</th>
                    <th className="pb-2 text-center">Score</th>
                    <th className="pb-2 text-center">Slate Odds</th>
                    <th className="pb-2 text-center">Tickets Won</th>
                    <th className="pb-2 text-right">Avg Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  {monteCarloResult.tiers.map((t) => (
                    <tr key={t.requiredScore} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2 font-sans font-bold text-slate-200">
                        {t.tierName}
                      </td>
                      <td className="py-2 text-center font-bold text-emerald-400">
                        {t.requiredScore}/{slate.matchCount}
                      </td>
                      <td className="py-2 text-center text-slate-300">
                        <div>{t.slateOddsRatio}</div>
                        <div className="text-[9px] text-slate-500 font-mono">({t.slateWinRatePct.toFixed(2)}%)</div>
                      </td>
                      <td className="py-2 text-center text-slate-400">
                        <span className="font-mono font-bold text-slate-300">{t.winningTickets.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-500 block">
                          ({t.winningSlates.toLocaleString()} slates
                          {t.multiTierSlates > 0 ? (
                            <span
                              className="text-cyan-400 font-mono ml-1"
                              title={`${t.peakScoreSlates.toLocaleString()} slates where ${t.requiredScore}/${slate.matchCount} was your best ticket + ${t.multiTierSlates.toLocaleString()} slates where it was won alongside a higher tier`}
                            >
                              • {t.peakScoreSlates} peak + {t.multiTierSlates} multi
                            </span>
                          ) : null}
                          )
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold text-amber-300">
                        ₦{t.estimatedAvgPayoutNGN.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Multi-tier note explaining why Tier Slates >= Peak Histogram */}
            <div className="pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[10px] text-slate-400 font-mono">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-300">Multi-Tier Coverage:</strong> When you hit a top tier (e.g. 11/12), companion hedge tickets also cash 10/12 consolation prizes. The <em>Score Curve</em> records each slate by its single highest ticket, while this table tallies all winning slates per tier.
              </span>
            </div>
          </div>

          {/* Right: Score Histogram & Contrarian Leverage Insight (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
            {/* Score Distribution Chart */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2.5 flex-1">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Portfolio Score Curve
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono" title="Each slate is categorized by its single highest-scoring ticket (percentages sum to 100%)">
                  Highest Ticket per Slate
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {Array.from({ length: 7 }, (_, i) => slate.matchCount - 6 + i)
                  .filter((score) => score >= (slate.matchCount === 12 ? 6 : 8))
                  .map((score) => {
                    const count = monteCarloResult.scoreHistogram[score] || 0;
                    const pct = (count / monteCarloResult.iterations) * 100;
                    const isJackpot = score === slate.matchCount;
                    const isConsolation =
                      slate.matchCount === 12 ? score >= 10 : score >= 9;

                    return (
                      <div key={score} className="space-y-0.5 text-[10px] font-mono">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className={`font-bold ${isJackpot ? 'text-amber-400' : isConsolation ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {score}/{slate.matchCount} {isJackpot ? '🏆' : isConsolation ? '✨' : ''}
                          </span>
                          <span>
                            {pct.toFixed(1)}% ({count.toLocaleString()})
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isJackpot
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                                : isConsolation
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                                : 'bg-slate-700'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct * 2.2))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Contrarian & Dividend Edge Alert Box */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-purple-500/30 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                <Activity className="w-3.5 h-3.5" />
                <span>Syndicate Leverage Assessment</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {monteCarloResult.crowdAnalysis.verdict}
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono pt-1 border-t border-slate-800/80">
                {monteCarloResult.recommendation.riskOfRuinText}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Generated Covering Tickets Ready to Play */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Generated Ready-to-Play Portfolio ({generatedTickets.length} Tickets)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogAllTicketsToLedger}
              className="py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Add all tickets to Position Ledger to track in bankroll PnL"
            >
              {loggedAllSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
              <span>{loggedAllSuccess ? 'All Logged to Ledger!' : '📓 Log All to Ledger'}</span>
            </button>
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Track open exposure in Position Ledger
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {generatedTickets.map((t) => {
            const isCopiedTicket = copiedTicketId === t.id;
            const isCopiedConsole = copiedConsoleId === t.id;
            const isLogged = loggedTicketIds.has(t.id);

            return (
              <div
                key={t.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 transition group"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs">
                      Ticket #{t.id}
                    </span>
                    <span className="text-[11px] text-amber-400 font-mono font-medium">
                      ₦{slate.stakePerComboNGN}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {t.guaranteeTier}
                  </span>
                </div>

                {/* Picks Grid Matrix */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-center">
                    {Array.from({ length: slate.totalGames }, (_, i) => i + 1).map((gameNum) => {
                      const pick = t.picks[gameNum] || '1';
                      return (
                        <div key={gameNum} className="space-y-0.5">
                          <div className="text-[9px] text-slate-500 font-mono">G{gameNum}</div>
                          <div
                            className={`py-1 rounded font-mono font-bold text-xs transition ${
                              pick === '1'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : pick === 'X'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {pick}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Macro Distribution Stats */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <div>
                    Homes: <span className="text-white font-bold">{t.homeCount}</span> • Draws:{' '}
                    <span className="text-cyan-400 font-bold">{t.drawCount}</span> • Aways:{' '}
                    <span className="text-purple-400 font-bold">{t.awayCount}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Joint Prob: {(t.jointProbability * 100000).toFixed(2)}x
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  {/* Copy Picks String */}
                  <button
                    onClick={() => {
                      copyText(t.summaryString, () => {
                        setCopiedTicketId(t.id);
                        setTimeout(() => setCopiedTicketId(null), 2000);
                      });
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Copy picks string (e.g. 1-1-X-2-1...)"
                  >
                    {isCopiedTicket ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedTicket ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* Copy Console Auto-Fill Script */}
                  <button
                    onClick={() => {
                      const script =
                        platform === 'sportybet'
                          ? generateSportyBetConsoleScript(t)
                          : generateOneXBetConsoleScript(t);
                      copyText(script, () => {
                        setCopiedConsoleId(t.id);
                        setTimeout(() => setCopiedConsoleId(null), 2000);
                      });
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-400/50 text-amber-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    title="Copy JavaScript code to paste into Chrome Console on SportyBet / 1xBet"
                  >
                    {isCopiedConsole ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{isCopiedConsole ? 'Script Copied' : 'Console Script'}</span>
                  </button>

                  {/* Log to Position Ledger Button */}
                  <button
                    onClick={() => handleLogTicketToLedger(t)}
                    className="py-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    title="Log this ticket to Position Ledger to track in bankroll PnL"
                  >
                    {isLogged ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isLogged ? 'Logged' : 'Log'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
