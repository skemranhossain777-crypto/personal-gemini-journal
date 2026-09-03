import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import firebaseFallbackConfig from '../../firebase-applet-config.json';

/**
 * Builds the Firebase config from Vite env vars (VITE_ prefixed), falling back
 * to firebase-applet-config.json for local dev where env vars are absent.
 * (Skill Phase 2 — lazy singleton: every service is created on first use, never
 * at module load, to avoid import-order crashes and keep bundle splitting clean.)
 */
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseFallbackConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseFallbackConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseFallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseFallbackConfig.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseFallbackConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseFallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseFallbackConfig.messagingSenderId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseFallbackConfig.measurementId || '',
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || firebaseFallbackConfig.oAuthClientId || '',
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || firebaseFallbackConfig.recaptchaSiteKey || '',
};

// ── Lazy singletons ───────────────────────────────────────────────────────────
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _appCheckInit = false;

export function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
}

export function getAuthInstance(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

/** Firestore instance, honouring the custom (non-default) database id when set. */
export function getDbInstance(): Firestore {
  if (!_db) {
    const app = getFirebaseApp();
    _db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
  return _db;
}

/**
 * Optional App Check (skill Phase 2 / checklist). Used for Firebase AI Logic in
 * production. Guarded so it only activates when a reCAPTCHA site key (or a local
 * debug token) is present — never blocks local dev that relies on the Express
 * server's server-side API key.
 */
export function ensureAppCheck(): boolean {
  if (_appCheckInit) return true;
  _appCheckInit = true;

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || firebaseConfig.recaptchaSiteKey;
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (!siteKey && !debugToken) {
    return false;
  }

  // Dynamic import keeps App Check out of the main bundle unless configured.
  void import('firebase/app-check')
    .then(async ({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      if (debugToken) {
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      }
      initializeAppCheck(getFirebaseApp(), {
        provider: new ReCaptchaEnterpriseProvider(siteKey ?? 'unused-in-debug-mode'),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((err) => console.warn('[firebase] App Check init skipped:', err));
  return true;
}
