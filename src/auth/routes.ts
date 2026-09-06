/**
 * Minimal SPA route model for this app. Everything is served from index.html
 * (Firebase Hosting rewrite), so "routes" are expressed via path + hash.
 *
 *   `/`                    → home (landing when signed out, journal when signed in)
 *   `#/app`                → companion workspace (legacy) — PROTECTED
 *   `#/journal[/<id>]`     → journal engine (list, or an entry editor) — PROTECTED
 *   `#/journal/new`        → new-entry editor with crash-recovery — PROTECTED
 *   `#/design`             → public design-system gallery
 *   anything else          → unknown (falls back to landing/workspace handling)
 */

export type AppRoute = 'home' | 'app' | 'design' | 'journal' | 'unknown';

export interface RouteParts {
  pathname: string;
  hash: string;
}

export function getRoute(parts: RouteParts): AppRoute {
  const hash = (parts.hash || '').replace(/^#/, '');
  const normalizedHash = hash.startsWith('/') ? hash : `/${hash}`;

  if (normalizedHash === '/design') return 'design';
  if (normalizedHash === '/app') return 'app';
  if (normalizedHash === '/journal' || normalizedHash.startsWith('/journal/')) return 'journal';
  if ((parts.pathname === '/' || parts.pathname === '') && !hash) return 'home';
  return 'unknown';
}

export function isProtectedRoute(route: AppRoute): boolean {
  return route === 'app' || route === 'journal';
}

/** Reads the current route from the browser location. */
export function currentRoute(): AppRoute {
  return getRoute({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
  });
}

const JOURNAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Parses the journal hash (`#/journal`, `#/journal/<id>`, `#/journal/new`)
 * into the target the workspace should render.
 */
export function parseJournalLocation(hash: string): { entryId?: string; isNew: boolean } {
  const h = (hash || '').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] !== 'journal') return { isNew: false };
  const [, target] = parts;
  if (target === 'new') return { isNew: true };
  if (target && JOURNAL_ID_PATTERN.test(target)) return { entryId: target, isNew: false };
  return { isNew: false };
}

/** Navigates to a hash route (fires `hashchange`, which the app listens for). */
export function navigateTo(hash: string): void {
  window.location.hash = hash;
}
