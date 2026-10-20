import { parseJackpotInput, generateCoveringPortfolio } from '../src/services/jackpotService.ts';
import { registerProspectiveRound } from './prospectiveAuditHelper.js';

const rawInput = `Round No. 20261025Print
No.	Date	Match	H2H	1(Home)	X(Draw)	2(Away)
1	24/10/2026 15:00	Coventry City
Fulham	
2.93
3.57
2.45
2	24/10/2026 17:00	Napoli
Roma	
2.83
3.41
2.61
3	24/10/2026 17:30	Valencia
Villarreal	
3.20
3.67
2.25
4	24/10/2026 19:45	Lens
Paris FC	
2.34
3.68
2.93
5	25/10/2026 14:30	PSV Eindhoven
Feyenoord	
2.03
4.11
3.08
6	25/10/2026 15:00	Genoa
Venezia FC	
2.15
3.48
3.49
7	25/10/2026 15:00	Monaco
Lille	
2.19
3.48
3.38
8	25/10/2026 15:00	Crystal Palace
Newcastle	
2.82
3.64
2.44
9	25/10/2026 15:00	Liverpool
Brighton	
2.19
3.78
3.13
10	25/10/2026 15:30	Hoffenheim
Bayer Leverkusen	
2.70
3.96
2.40
11	25/10/2026 16:15	Celta
Betis	
2.81
3.48
2.52
12	25/10/2026 17:30	Sunderland AFC
Leeds United	
2.94
3.30
2.52`;

const parsed = parseJackpotInput(rawInput, 'sportybet');
if (!parsed) {
  console.error('Failed to parse SportyBet slate!');
  process.exit(1);
}

const targetTickets = 8;
const tickets = generateCoveringPortfolio(parsed, {
  targetTickets,
  strategy: 'BALANCED_COVER',
  minDraws: 2,
  maxDraws: 5,
  minHomes: 3,
  maxHomes: 9
});

const ticketStrings = tickets.map(t => t.picksArray.join(''));

// Earliest kickoff: Coventry City vs Fulham on 24/10/2026 at 15:00 WAT (14:00 UTC)
const earliestKickoff = '2026-10-24T14:00:00.000Z';
const deadline = new Date(earliestKickoff).getTime();

const matchOddsSnapshot = parsed.matches.map(m => ({
  no: m.no,
  home: m.homeTeam,
  away: m.awayTeam,
  odds: {
    home: m.odds.home,
    draw: m.odds.draw,
    away: m.odds.away
  }
}));

const result = registerProspectiveRound({
  platform: 'sportybet',
  roundId: '20261025',
  deadline,
  earliestKickoff,
  oddsSource: 'SPORTYBET_NG_OFFICIAL_PRE_MATCH',
  oddsCapturedAt: new Date().toISOString(),
  matchOddsSnapshot,
  tickets: ticketStrings,
  stake: 800
});

console.log('=============================================================');
console.log('✅ Round 20261025 Pre-Registered Successfully!');
console.log('Canonical SHA-256 Fingerprint:', result.canonicalHash);
console.log('Git Commit:', result.record.gitCommit);
console.log('Earliest Kickoff:', result.record.earliestKickoff);
console.log('Registered Tickets (8 Lines):');
result.record.tickets.forEach((t, i) => console.log(`  Line #${i + 1}: ${t}`));
console.log('Paired Random Baseline Tickets:');
result.record.pairedBaselineTickets.forEach((t, i) => console.log(`  Baseline #${i + 1}: ${t}`));
console.log('=============================================================');
