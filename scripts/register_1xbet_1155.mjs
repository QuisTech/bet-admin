import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Deterministic Mulberry32 PRNG for paired random baseline comparison
function createSeededRandom(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t >>> 0) / 4294967296;
  };
}

const roundId = '1155';
const deadline = new Date('2026-10-20T19:00:00.000Z').getTime(); // 20:00 WAT is 19:00 UTC
const earliestKickoff = '2026-10-20T19:00:00.000Z';
const oddsCapturedAt = '2026-10-18T15:00:00+01:00';
const registeredAt = new Date().toISOString();
const gitCommit = '30fb21c';

const matchOddsSnapshot = [
  { no: 1, home: 'Paris Saint-Germain', away: 'Barcelona', odds: { home: 2.38, draw: 5.88, away: 2.44 } },
  { no: 2, home: 'VfB Stuttgart', away: 'Atletico Madrid', odds: { home: 3.13, draw: 4.76, away: 2.13 } },
  { no: 3, home: 'Lille OSC', away: 'Galatasaray', odds: { home: 2.04, draw: 4.55, away: 3.45 } },
  { no: 4, home: 'Como', away: 'Manchester United', odds: { home: 2.22, draw: 4.55, away: 3.03 } },
  { no: 5, home: 'Club Brugge', away: 'RC Lens', odds: { home: 1.96, draw: 4.55, away: 3.70 } },
  { no: 6, home: 'Bayern Munich', away: 'Arsenal', odds: { home: 2.04, draw: 4.76, away: 3.33 } },
  { no: 7, home: 'Celtic', away: 'Celta', odds: { home: 3.13, draw: 4.17, away: 2.27 } },
  { no: 8, home: 'Bournemouth', away: 'Milan', odds: { home: 2.08, draw: 4.35, away: 3.45 } },
  { no: 9, home: 'TSG 1899 Hoffenheim', away: 'Lyon', odds: { home: 1.82, draw: 5.00, away: 4.00 } },
  { no: 10, home: 'Celje', away: 'FC Salzburg', odds: { home: 5.26, draw: 5.00, away: 1.64 } },
  { no: 11, home: 'Jagiellonia Bialystok', away: 'Anderlecht', odds: { home: 3.13, draw: 4.17, away: 2.27 } },
  { no: 12, home: 'Besiktas', away: 'Crystal Palace', odds: { home: 2.08, draw: 4.55, away: 3.33 } },
  { no: 13, home: 'Crvena Zvezda', away: 'Copenhagen', odds: { home: 2.44, draw: 4.35, away: 2.78 } },
  { no: 14, home: 'Ajax', away: 'Atalanta', odds: { home: 3.03, draw: 4.35, away: 2.27 } }
];

const tickets = [
  '121X112112211X',
  '1211112X12211X',
  '121111211221XX',
  '12111121122X1X'
];

// Generate 4 paired random baseline tickets
const rng = createSeededRandom(parseInt(roundId, 10) + 1337);
const pairedBaselineTickets = [];
for (let t = 0; t < 4; t++) {
  const line = [];
  for (let m = 0; m < 14; m++) {
    const rand = Math.floor(rng() * 3) + 1;
    line.push(rand === 1 ? '1' : rand === 2 ? 'X' : '2');
  }
  pairedBaselineTickets.push(line.join(''));
}

const frozenConstraints = {
  minDraws: 2,
  maxDraws: 5,
  minHomes: 5,
  maxHomes: 9,
  minDistance: 2,
  maxDistance: 4
};

const recordForHash = {
  protocolVersion: '1.6.0',
  roundId,
  deadline,
  earliestKickoff,
  oddsSource: 'ONEXBET_TOTO_14_OFFICIAL_PRE_MATCH',
  oddsCapturedAt,
  gitCommit,
  strategy: 'BALANCED_COVER',
  frozenBeamWidth: 2000,
  frozenConstraints,
  scoringRules: 'ONEXBET_TOTO_14_PARIMUTUEL',
  stake: 3200,
  matchOddsSnapshot,
  pairedBaselineTickets: [...pairedBaselineTickets].sort(),
  tickets: [...tickets].sort()
};

const canonicalString = JSON.stringify(recordForHash);
const sha256 = crypto.createHash('sha256').update(canonicalString).digest('hex');

const fullRecord = {
  ...recordForHash,
  tickets, // retain natural order
  pairedBaselineTickets,
  registeredAt,
  status: 'PRE_REGISTERED',
  sha256,
  auditTrail: [
    {
      event: 'PRE_REGISTERED',
      timestamp: registeredAt,
      gitCommit,
      canonicalHash: sha256,
      ticketsCount: 4
    }
  ]
};

const ledger = {
  protocolVersion: '1.6.0',
  platform: '1xbet',
  protocolDoc: 'audit/PROSPECTIVE_PROTOCOL.md',
  frozenStrategy: 'BALANCED_COVER',
  frozenBeamWidth: 2000,
  frozenConstraints,
  scoringRules: 'ONEXBET_TOTO_14_PARIMUTUEL',
  targetSampleSize: 50,
  records: [fullRecord]
};

const ledgerPath = path.resolve('audit/prospective_ledger_1xbet.json');
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');

console.log('✅ Registered 1xBet Draw 1155 successfully!');
console.log('SHA-256 Fingerprint:', sha256);
console.log('Tickets count:', tickets.length);
console.log('Paired baseline count:', pairedBaselineTickets.length);
console.log('File written to:', ledgerPath);
