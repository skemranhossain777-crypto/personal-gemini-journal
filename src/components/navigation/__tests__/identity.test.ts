import { describe, expect, it } from 'vitest';
import {
  buildInitials,
  resolveDisplayName,
  resolveEmail,
  resolvePhotoURL,
  type UserIdentity,
} from '../identity';

describe('user identity resolution', () => {
  const base: UserIdentity = {
    uid: 'firebase-uid-123',
    displayName: null,
    email: null,
    photoURL: null,
    providerData: [],
  };

  it('renders displayName when available', () => {
    const identity = { ...base, displayName: 'Sheikh Emran Hossain', email: 'skemranhossain777@gmail.com' };
    expect(resolveDisplayName(identity)).toBe('Sheikh Emran Hossain');
  });

  it('uses email as the secondary identity', () => {
    const identity = { ...base, displayName: 'Sheikh Emran Hossain', email: 'skemranhossain777@gmail.com' };
    expect(resolveEmail(identity)).toBe('skemranhossain777@gmail.com');
  });

  it('resolves the avatar from photoURL', () => {
    const identity = { ...base, displayName: 'Sheikh Emran Hossain', photoURL: 'https://example.com/p.jpg' };
    expect(resolvePhotoURL(identity)).toBe('https://example.com/p.jpg');
  });

  it('falls back to Google providerData displayName when top-level name is missing', () => {
    const identity: UserIdentity = {
      ...base,
      displayName: null,
      email: null,
      providerData: [{ providerId: 'google.com', displayName: 'Google Profile Name', email: 'g@gmail.com', photoURL: null }],
    };
    expect(resolveDisplayName(identity)).toBe('Google Profile Name');
  });

  it('falls back to Google provider photoURL when top-level photo is missing', () => {
    const identity: UserIdentity = {
      ...base,
      photoURL: null,
      providerData: [{ providerId: 'google.com', displayName: 'Google Profile Name', photoURL: 'https://example.com/g.jpg' }],
    };
    expect(resolvePhotoURL(identity)).toBe('https://example.com/g.jpg');
  });

  it('falls back to a readable email-derived name when no displayName exists', () => {
    const identity = { ...base, displayName: null, email: 'skemranhossain777@gmail.com' };
    expect(resolveDisplayName(identity)).toBe('skemranhossain777');
  });

  it('never exposes the raw Firebase UID as the primary visible name', () => {
    const identity = { ...base, uid: 'abc123firebaseuid', displayName: null, email: null };
    expect(resolveDisplayName(identity)).toBe('Signed-in user');
    expect(resolveDisplayName(identity)).not.toBe('abc123firebaseuid');
  });

  it('produces a neutral fallback when no profile fields exist at all', () => {
    expect(resolveDisplayName(base)).toBe('Signed-in user');
    expect(resolveEmail(base)).toBe('');
    expect(resolvePhotoURL(base)).toBeNull();
  });
});

describe('initials fallback', () => {
  it('derives initials from first and last name words', () => {
    expect(buildInitials('Sheikh Emran Hossain')).toBe('SE');
  });

  it('derives a single-letter initial for one-word names', () => {
    expect(buildInitials('Emran')).toBe('E');
  });

  it('derives two-letter initials from the email local part', () => {
    expect(buildInitials('', 'skemranhossain777@gmail.com')).toBe('SK');
  });

  it('uses the UID only as a last resort when no name or email exists', () => {
    expect(buildInitials('Signed-in user', '', 'firebase-uid-123')).toBe('FI');
  });
});