import { Timestamp } from 'firebase/firestore';
import type { PlainTimestamp, TimestampLike } from './types';

/** Is `v` a Firestore `Timestamp` instance? */
export function isFirestoreTimestamp(v: unknown): v is Timestamp {
  return !!v && typeof v === 'object' && typeof (v as Timestamp).toDate === 'function';
}

/** Normalizes any timestamp-like value into a Firestore `Timestamp`. */
export function toFirestoreTimestamp(v: TimestampLike | null | undefined): Timestamp | null {
  if (v === null || v === undefined) return null;
  if (isFirestoreTimestamp(v)) return v;
  const t = v as PlainTimestamp;
  return new Timestamp(t.seconds, t.nanoseconds);
}

/** `{ seconds, nanoseconds }` snapshot of now (structural, JSON-safe). */
export function plainNow(): PlainTimestamp {
  const s = Math.floor(Date.now() / 1000);
  return { seconds: s, nanoseconds: (Date.now() - s * 1000) * 1e6 };
}

/** Converts a runtime timestamp-like to a JSON-safe `{ seconds, nanoseconds }`. */
export function toPlain(v: TimestampLike | null | undefined): PlainTimestamp | null {
  if (v === null || v === undefined) return null;
  if (isFirestoreTimestamp(v)) {
    return { seconds: v.seconds, nanoseconds: v.nanoseconds };
  }
  return { seconds: (v as PlainTimestamp).seconds, nanoseconds: (v as PlainTimestamp).nanoseconds };
}

/** Converts any timestamp-like to a JS Date. */
export function toDate(v: TimestampLike | { seconds: number; nanoseconds: number } | Date | null | undefined): Date | null {
  if (!v) return null;
  if (isFirestoreTimestamp(v)) return v.toDate();
  if (v instanceof Date) return v;
  const t = v as PlainTimestamp;
  return new Date(t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6));
}

/** 'Sep 5, 2026' */
export function formatEntryDate(v: TimestampLike | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 'Sep 5' — short form for list cards. */
export function formatShortDate(v: TimestampLike | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Relative time ("just now", "5m ago", "2h ago", "3d ago", then the date). */
export function formatRelativeTime(v: TimestampLike | Date | null | undefined, now = Date.now()): string {
  const d = toDate(v);
  if (!d) return '';
  const diff = now - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(d);
}

/** Plain-text snippet for list cards, with newlines collapsed to spaces. */
export function buildSnippet(body: string, max = 140): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, max) + (body.replace(/\s+/g, ' ').trim().length > max ? '…' : '');
}