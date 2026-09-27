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
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { LoggedBet } from '../types';

export const FIREBASE_CONFIG_STORAGE_KEY = 'bet_admin_firebase_config';
const POSITIONS_COLLECTION = 'positions';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/**
 * Retrieves the active Firebase configuration from localStorage or Vite environment variables.
 */
export function getSavedFirebaseConfig(): FirebaseConfigOptions | null {
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

  // Fallback to Vite environment variables if defined (e.g. in Vercel project settings)
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
  source: 'LOCAL_STORAGE' | 'ENV' | 'NONE';
} {
  const config = getSavedFirebaseConfig();
  if (!config) {
    return { isConfigured: false, projectId: null, source: 'NONE' };
  }

  const isLocalStored =
    typeof localStorage !== 'undefined' &&
    !!localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);

  return {
    isConfigured: true,
    projectId: config.projectId,
    source: isLocalStored ? 'LOCAL_STORAGE' : 'ENV',
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
 * Deletes a position document from Firestore.
 */
export async function deleteBetFromFirestore(betId: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !betId) return false;

  try {
    const docRef = doc(db, POSITIONS_COLLECTION, betId);
    await deleteDoc(docRef);
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
