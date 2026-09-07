/**
 * Minimal user identity contract for user-facing presentation.
 *
 * Authorization/ownership stays exclusively UID-based (Firestore paths, API
 * tokens, data scoping all use `uid`). These helpers only resolve what to
 * *display*: name → email → photo → initials, with a Google-provider fallback
 * for older sessions where top-level profile fields may be absent.
 */

export interface ProfileProviderData {
  providerId?: string | null;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface UserIdentity {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  providerData?: ProfileProviderData[] | null;
}

const GOOGLE_PROVIDER_ID = 'google.com';

function getGoogleProvider(identity: UserIdentity): ProfileProviderData | undefined {
  return identity.providerData?.find((p) => p?.providerId === GOOGLE_PROVIDER_ID);
}

function emailLocalPart(email?: string | null): string {
  return (email || '').split('@')[0]?.trim() || '';
}

/** Primary display name: top-level, then Google provider, then email local part. */
export function resolveDisplayName(identity: UserIdentity): string {
  return (
    identity.displayName?.trim() ||
    getGoogleProvider(identity)?.displayName?.trim() ||
    emailLocalPart(identity.email) ||
    'Signed-in user'
  );
}

/** Secondary identity line: top-level email, then Google provider email. */
export function resolveEmail(identity: UserIdentity): string {
  return identity.email?.trim() || getGoogleProvider(identity)?.email?.trim() || '';
}

/** Avatar URL: top-level photo, then Google provider photo. Never the UID. */
export function resolvePhotoURL(identity: UserIdentity): string | null {
  return identity.photoURL?.trim() || getGoogleProvider(identity)?.photoURL?.trim() || null;
}

/**
 * Robust initials for the avatar fallback:
 *   Sheikh Emran Hossain → SE
 *   Emran → E
 *   skemranhossain777@gmail.com → SK
 * UID is used only as a last resort when neither a name nor an email exists.
 */
export function buildInitials(displayName: string, email?: string | null, uid?: string | null): string {
  const name = displayName.trim();
  if (name && name !== 'Signed-in user') {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  const local = emailLocalPart(email);
  if (local) {
    const letters = Array.from(local).filter((c) => /[A-Za-z]/.test(c));
    return (letters.slice(0, 2).join('') || local.slice(0, 2)).toUpperCase();
  }
  if (uid) return uid.slice(0, 2).toUpperCase();
  return 'U';
}