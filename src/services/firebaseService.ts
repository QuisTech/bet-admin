/**
 * Institutional Firebase Cloud Sync Service
 * Powers real-time cross-device synchronization (Phone <-> PC)
 * for Bet Horizon position ledger with offline-first persistence.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { LoggedBet, BankrollConfig, MatchData } from '../types';

export const FIREBASE_CONFIG_STORAGE_KEY = 'bet_admin_firebase_config';
const POSITIONS_COLLECTION = 'positions';
const BANKROLL_DOC_ID = 'config_bankroll';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

/**
 * Retrieves the active Firebase configuration from localStorage or Vite environment variables
 * (configured securely via Vercel without committing secrets to GitHub).
 */
export function getSavedFirebaseConfig(): FirebaseConfigOptions | null {
  // 1. Check user-configured override in browser localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.projectId && parsed.apiKey) {
          return parsed as FirebaseConfigOptions;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading saved Firebase config from localStorage:', e);
  }

  // 2. Vite environment variables securely managed via Vercel CLI (zero secrets in GitHub)
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
}

/**
 * Saves or clears custom Firebase configuration in localStorage.
 */
export function saveFirebaseConfig(config: FirebaseConfigOptions | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!config) {
      localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    } else {
      localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
  }
}

/**
 * Intelligent parser that extracts Firebase options from JSON or raw JS snippets pasted by users.
 * Example input:
 * const firebaseConfig = {
 *   apiKey: "AIzaSy...",
 *   projectId: "my-bet-project"
 * };
 */
export function parseFirebaseConfigInput(rawInput: string): FirebaseConfigOptions | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();

  // 1. Try direct JSON parse
  try {
    const directObj = JSON.parse(trimmed);
    if (directObj && typeof directObj === 'object' && directObj.projectId && directObj.apiKey) {
      return {
        apiKey: String(directObj.apiKey).trim(),
        authDomain: directObj.authDomain ? String(directObj.authDomain).trim() : undefined,
        projectId: String(directObj.projectId).trim(),
        storageBucket: directObj.storageBucket ? String(directObj.storageBucket).trim() : undefined,
        messagingSenderId: directObj.messagingSenderId ? String(directObj.messagingSenderId).trim() : undefined,
        appId: directObj.appId ? String(directObj.appId).trim() : undefined,
      };
    }
  } catch {}

  // 2. Extract key-value pairs using regex (for JS object syntax without double quotes on keys)
  const extractVal = (keyName: string): string | undefined => {
    const regex = new RegExp(`['"]?${keyName}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i');
    const match = trimmed.match(regex);
    return match ? match[1].trim() : undefined;
  };

  const apiKey = extractVal('apiKey');
  const projectId = extractVal('projectId');

  if (apiKey && projectId) {
    return {
      apiKey,
      projectId,
      authDomain: extractVal('authDomain') || `${projectId}.firebaseapp.com`,
      storageBucket: extractVal('storageBucket') || `${projectId}.firebasestorage.app`,
      messagingSenderId: extractVal('messagingSenderId'),
      appId: extractVal('appId'),
    };
  }

  return null;
}

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let lastUsedConfigStr: string | null = null;

/**
 * Gets or initializes the Firebase App singleton.
 */
export function getFirebaseApp(): FirebaseApp | null {
  const config = getSavedFirebaseConfig();
  if (!config) return null;

  const configStr = JSON.stringify(config);
  if (cachedApp && lastUsedConfigStr === configStr) {
    return cachedApp;
  }

  try {
    const existingApps = getApps();
    const app = existingApps.length > 0 ? getApp() : initializeApp(config);
    cachedApp = app;
    lastUsedConfigStr = configStr;
    cachedDb = getFirestore(app);
    return app;
  } catch (e) {
    console.error('Failed to initialize Firebase App:', e);
    return null;
  }
}

/**
 * Gets or initializes the Firestore DB instance.
 */
export function getFirebaseDb(): Firestore | null {
  if (cachedDb && cachedApp) return cachedDb;
  getFirebaseApp();
  return cachedDb;
}

/**
 * Checks if Firebase has valid configuration active.
 */
export function isFirebaseConfigured(): boolean {
  const config = getSavedFirebaseConfig();
  return !!(config && config.apiKey && config.projectId);
}

/**
 * Returns connection diagnostic status for UI badges.
 */
export function getFirebaseStatus(): {
  isConfigured: boolean;
  projectId: string | null;
  source: 'LOCAL_STORAGE' | 'ENV' | 'DEFAULT' | 'NONE';
} {
  const config = getSavedFirebaseConfig();
  if (!config) {
    return { isConfigured: false, projectId: null, source: 'NONE' };
  }

  const isLocalStored =
    typeof localStorage !== 'undefined' &&
    !!localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
  const isEnv = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

  return {
    isConfigured: true,
    projectId: config.projectId,
    source: isLocalStored ? 'LOCAL_STORAGE' : isEnv ? 'ENV' : 'DEFAULT',
  };
}

/**
 * Writes or updates a single position document in Firestore.
 */
export async function saveBetToFirestore(bet: LoggedBet): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !bet || !bet.id) return false;

  try {
    const docRef = doc(db, POSITIONS_COLLECTION, bet.id);
    await setDoc(docRef, bet, { merge: true });
    return true;
  } catch (e) {
    console.error(`Failed to save bet ${bet.id} to Firestore:`, e);
    return false;
  }
}

/**
 * Deletes a position document from Firestore thoroughly across ID and match signatures.
 */
export async function deleteBetFromFirestore(
  betId: string,
  extraMatch?: { match?: string; selection?: string }
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !betId) return false;

  try {
    const batch = writeBatch(db);
    let count = 0;

    // 1. Direct doc deletion by betId
    const docRef = doc(db, POSITIONS_COLLECTION, betId);
    batch.delete(docRef);
    count++;

    // 2. Query any documents where field 'id' == betId
    try {
      const q = query(collection(db, POSITIONS_COLLECTION), where('id', '==', betId));
      const snaps = await getDocs(q);
      snaps.forEach((s) => {
        batch.delete(s.ref);
        count++;
      });
    } catch {}

    // 3. Query any documents matching the exact match & selection if provided
    if (extraMatch && extraMatch.match && extraMatch.selection) {
      try {
        const q2 = query(
          collection(db, POSITIONS_COLLECTION),
          where('match', '==', extraMatch.match)
        );
        const snaps2 = await getDocs(q2);
        snaps2.forEach((s) => {
          const data = s.data();
          if (data && data.selection === extraMatch.selection) {
            batch.delete(s.ref);
            count++;
          }
        });
      } catch {}
    }

    if (count > 0) {
      await batch.commit();
    }
    return true;
  } catch (e) {
    console.error(`Failed to delete bet ${betId} from Firestore:`, e);
    return false;
  }
}

/**
 * Bulk uploads all local bets to Firestore (e.g. for initial cloud migration).
 */
export async function syncAllLocalBetsToFirestore(
  localBets: LoggedBet[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { success: false, count: 0, error: 'Firebase is not initialized or configured.' };
  }

  if (!localBets || localBets.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    // Firestore batches allow up to 500 writes per batch
    const batch = writeBatch(db);
    let count = 0;

    for (const b of localBets) {
      if (!b.id) continue;
      const ref = doc(db, POSITIONS_COLLECTION, b.id);
      batch.set(ref, b, { merge: true });
      count++;
      if (count >= 490) break; // stay safely within 500-limit per single transaction
    }

    await batch.commit();
    return { success: true, count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Failed to batch upload local bets to Firestore:', e);
    return { success: false, count: 0, error: msg };
  }
}

/**
 * Subscribes to real-time updates from Firestore.
 * Triggers `onUpdate` whenever any device adds, edits, or deletes a bet.
 */
export function subscribeToFirestoreBets(
  onUpdate: (bets: LoggedBet[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const colRef = collection(db, POSITIONS_COLLECTION);
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const bets: LoggedBet[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LoggedBet;
          if (data && data.match) {
            bets.push({
              ...data,
              id: data.id || docSnap.id,
            });
          }
        });
        // Sort descending by timestamp
        bets.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onUpdate(bets);
      },
      (error) => {
        console.error('Firestore onSnapshot subscription error:', error);
        if (onError) onError(error);
      }
    );
    return unsub;
  } catch (e) {
    console.error('Failed to set up Firestore snapshot listener:', e);
    return null;
  }
}

function parseFirestoreRestDoc(docObj: any): LoggedBet | null {
  if (!docObj || !docObj.fields) return null;
  const f = docObj.fields;
  const docId = docObj.name ? docObj.name.split('/').pop() : '';
  if (!docId || docId === BANKROLL_DOC_ID || docId.startsWith('odds_cache_')) return null;

  const match = f.match?.stringValue;
  if (!match) return null;

  const price = f.priceTaken?.doubleValue ?? f.priceTaken?.integerValue ?? 2.0;
  const hasRealPin = (f.pinnacleLineAtBet?.doubleValue ?? f.pinnacleLineAtBet?.integerValue ?? 0) > 1.0;
  const pin = hasRealPin
    ? (f.pinnacleLineAtBet?.doubleValue ?? f.pinnacleLineAtBet?.integerValue)
    : (f.pinnacleClosingLine?.doubleValue ?? f.pinnacleClosingLine?.integerValue ?? price);
  const pinClose = f.pinnacleClosingLine?.doubleValue ?? f.pinnacleClosingLine?.integerValue ?? pin;
  const prob = f.modelProb?.doubleValue ?? f.modelProb?.integerValue ?? (price > 0 ? Math.round((1 / price) * 1000) / 1000 : 0.5);
  const clv = f.clvPercent?.doubleValue ?? f.clvPercent?.integerValue ?? (hasRealPin && pinClose > 0 ? Math.round(((price / pinClose) - 1.0) * 1000) / 10 : undefined);
  const ev = f.modelEV?.doubleValue ?? f.modelEV?.integerValue ?? (clv !== undefined ? clv : 0);
  const stake = f.stake?.doubleValue ?? f.stake?.integerValue ?? 0;
  const payout = f.payout?.doubleValue ?? f.payout?.integerValue ?? 0;

  return {
    id: f.id?.stringValue || docId,
    timestamp: f.timestamp?.stringValue || new Date().toISOString(),
    dateDisplay: f.dateDisplay?.stringValue || '',
    league: f.league?.stringValue || 'Sportsbook Market',
    match,
    selection: f.selection?.stringValue || 'Match Outcome (1X2)',
    marketType: f.marketType?.stringValue || '1X2',
    bookmaker: f.bookmaker?.stringValue || '1xBet',
    priceTaken: price,
    pinnacleLineAtBet: pin,
    pinnacleClosingLine: pinClose,
    modelProb: prob,
    modelEV: ev,
    stake,
    payout,
    outcome: (f.outcome?.stringValue as any) || 'OPEN',
    clvPercent: clv,
    notes: f.notes?.stringValue || '',
  };
}

/**
 * Fetches all active bet positions from Cloud Firestore once.
 * Incorporates a resilient HTTP REST fallback if WebChannel / Firestore client is blocked.
 */
export async function fetchFirestoreBets(): Promise<LoggedBet[]> {
  const config = getSavedFirebaseConfig();
  const db = getFirebaseDb();
  let bets: LoggedBet[] = [];

  // 1. Try Firebase JS SDK
  if (db) {
    try {
      const colRef = collection(db, POSITIONS_COLLECTION);
      const snap = await getDocs(colRef);
      snap.forEach((docSnap) => {
        // Exclude system configs and caches
        if (docSnap.id === BANKROLL_DOC_ID || docSnap.id.startsWith('odds_cache_')) return;
        const data = docSnap.data() as LoggedBet;
        if (data && data.match) {
          bets.push({
            ...data,
            id: data.id || docSnap.id,
          });
        }
      });
    } catch (e) {
      console.warn('Firebase JS SDK getDocs failed, attempting HTTP REST fallback:', e);
    }
  }

  // 2. If SDK returned empty or failed, use HTTP REST API fallback
  if (bets.length === 0 && config && config.projectId) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${POSITIONS_COLLECTION}?pageSize=300${config.apiKey ? `&key=${config.apiKey}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const docs = json.documents || [];
        for (const d of docs) {
          const parsed = parseFirestoreRestDoc(d);
          if (parsed) bets.push(parsed);
        }
      }
    } catch (e) {
      console.error('Firestore REST API fallback failed:', e);
    }
  }

  // Sort descending by timestamp
  bets.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return bets;
}

/**
 * Tests live connection to Firestore and returns the number of positions in the cloud.
 */
export async function testFirebaseConnection(): Promise<{
  success: boolean;
  message: string;
  remoteCount?: number;
}> {
  const db = getFirebaseDb();
  if (!db) {
    return {
      success: false,
      message: 'Firebase configuration is missing or invalid. Check apiKey & projectId.',
    };
  }

  try {
    const colRef = collection(db, POSITIONS_COLLECTION);
    const snap = await getDocs(colRef);
    return {
      success: true,
      message: `Successfully connected to Firebase project (${getFirebaseStatus().projectId})!`,
      remoteCount: snap.size,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      message: `Connection failed: ${msg}. Make sure Cloud Firestore is enabled in your Firebase console.`,
    };
  }
}

/**
 * Saves Bankroll Configuration (Active Working Capital & Master Vault Reserve) to Cloud Firestore.
 * Automatically broadcasts to all connected devices in real time.
 */
export async function saveBankrollConfigToFirestore(config: BankrollConfig): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const docRef = doc(db, POSITIONS_COLLECTION, BANKROLL_DOC_ID);
    const payload: any = {
      totalBankrollNGN: config.totalBankrollNGN,
      totalBankroll: config.totalBankroll,
      masterCapitalNGN: config.masterCapitalNGN || config.totalBankrollNGN,
      kellyFraction: config.kellyFraction,
      maxStakePercent: config.maxStakePercent,
      currency: config.currency,
      strategyMode: config.strategyMode,
      updatedAt: new Date().toISOString(),
    };
    if (config.oddsApiKey) {
      payload.oddsApiKey = config.oddsApiKey;
    }
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (e) {
    console.warn('Failed to save bankroll config to Cloud Firestore:', e);
    return false;
  }
}

/**
 * Saves or syncs The Odds API key to Cloud Firestore so all devices share the key automatically.
 */
export async function saveOddsApiKeyToCloud(apiKey: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !apiKey) return false;

  try {
    const docRef = doc(db, POSITIONS_COLLECTION, BANKROLL_DOC_ID);
    await setDoc(
      docRef,
      {
        oddsApiKey: apiKey.trim(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn('Failed to sync Odds API key to Cloud Firestore:', e);
    return false;
  }
}

/**
 * Subscribes to real-time Bankroll Configuration changes from Cloud Firestore across all devices.
 */
export function subscribeToFirestoreBankrollConfig(
  onUpdate: (config: BankrollConfig) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const docRef = doc(db, POSITIONS_COLLECTION, BANKROLL_DOC_ID);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as BankrollConfig & { oddsApiKey?: string };
          if (data && (data.totalBankrollNGN > 0 || data.totalBankroll > 0)) {
            // Automatically sync Odds API key into local device storage if present
            if (data.oddsApiKey && typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem('bet_admin_odds_api_key', data.oddsApiKey);
              } catch {}
            }
            onUpdate({
              totalBankrollNGN: data.totalBankrollNGN || 2500,
              totalBankroll: data.totalBankroll || data.totalBankrollNGN || 2500,
              masterCapitalNGN: data.masterCapitalNGN || 20000,
              kellyFraction: typeof data.kellyFraction === 'number' ? data.kellyFraction : 0.25,
              maxStakePercent: typeof data.maxStakePercent === 'number' ? data.maxStakePercent : 0.02,
              currency: data.currency === 'USD' ? 'USD' : 'NGN',
              strategyMode: data.strategyMode || 'safe',
              updatedAt: data.updatedAt,
              oddsApiKey: data.oddsApiKey,
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore bankroll subscription error:', err);
      }
    );
  } catch (e) {
    console.warn('Failed to subscribe to Firestore bankroll:', e);
    return null;
  }
}

/**
 * Saves processed live odds to Cloud Firestore so all devices/sessions share the same feed
 * without burning The Odds API quota credits.
 */
export async function saveCloudCachedOdds(
  leagueId: string,
  matches: MatchData[]
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !matches || matches.length === 0) return false;

  try {
    const docId = `odds_cache_${leagueId}`;
    const docRef = doc(db, POSITIONS_COLLECTION, docId);
    await setDoc(
      docRef,
      {
        leagueId,
        timestamp: Date.now(),
        updatedAt: new Date().toISOString(),
        matchCount: matches.length,
        matchesJson: JSON.stringify(matches),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn('Failed to save odds cache to Firestore:', e);
    return false;
  }
}

/**
 * Retrieves shared live odds from Cloud Firestore.
 * If data is fresh (< maxAgeMs, default 60 minutes), returns the matches directly from the cloud.
 */
export async function getCloudCachedOdds(
  leagueId: string,
  maxAgeMs: number = 60 * 60 * 1000
): Promise<{ matches: MatchData[]; timestamp: number } | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const docId = `odds_cache_${leagueId}`;
    const docRef = doc(db, POSITIONS_COLLECTION, docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    if (!data || !data.matchesJson || !data.timestamp) return null;

    const age = Date.now() - Number(data.timestamp);
    if (age > maxAgeMs) {
      return null; // Expired, caller can fetch fresh
    }

    const matches = JSON.parse(data.matchesJson);
    if (Array.isArray(matches) && matches.length > 0) {
      const validMatches = matches.filter(
        (m: any) => m && Array.isArray(m.markets) && m.markets.length > 0
      );
      if (validMatches.length > 0) {
        return { matches: validMatches, timestamp: Number(data.timestamp) };
      }
    }
    return null;
  } catch (e) {
    console.warn('Failed to read cloud odds cache:', e);
    return null;
  }
}

