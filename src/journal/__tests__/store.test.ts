import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { createDemoJournalStore } from '../store';
import { emptyDraft } from '../types';
import { formatEntryDate, formatRelativeTime, formatShortDate, toDate, toFirestoreTimestamp, toPlain } from '../format';

function stubLocalStorage() {
  const map = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal('localStorage', localStorageMock);
  return map;
}

describe('demo journal store', () => {
  let map: Map<string, string>;
  beforeEach(() => {
    map = stubLocalStorage();
    vi.stubGlobal('crypto', { randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` });
  });

  it('persists entries to a per-user bucket', async () => {
    const store = createDemoJournalStore('demo-user-a');
    const entry = await store.create({ ...emptyDraft(), title: 'Hello', body: 'First' });
    expect(entry.uid).toBe('demo-user-a');
    expect(map.has('gemini_journal_entries_demo_demo-user-a')).toBe(true);
  });

  it('isolates different demo users', async () => {
    const a = createDemoJournalStore('demo-a');
    const b = createDemoJournalStore('demo-b');
    await a.create({ ...emptyDraft(), title: 'A', body: 'a' });
    await b.create({ ...emptyDraft(), title: 'B', body: 'b' });
    expect((await a.list()).map((e) => e.title)).toEqual(['A']);
    expect((await b.list()).map((e) => e.title)).toEqual(['B']);
  });

  it('supports update and get', async () => {
    const store = createDemoJournalStore('demo-user-c');
    const created = await store.create({ ...emptyDraft(), title: 'T', body: 'v1', mood: 3 });
    const updated = await store.update(created.id, { ...emptyDraft(), title: 'T', body: 'v2', mood: 5 });
    expect(updated.mood).toBe(5);
    expect((await store.get(created.id)).body).toBe('v2');
  });

  it('supports delete', async () => {
    const store = createDemoJournalStore('demo-user-d');
    const created = await store.create({ ...emptyDraft(), title: 'T', body: 'v1' });
    await store.remove(created.id);
    expect(await store.list()).toHaveLength(0);
    await expect(store.get(created.id)).rejects.toThrow('not found');
  });

  it('validates writes (rejects invalid mood/energy)', async () => {
    const store = createDemoJournalStore('demo-user-e');
    await expect(
      store.create({ ...emptyDraft(), title: 'T', mood: 99 as number }),
    ).rejects.toThrow('mood');
  });

  it('sorts list by updatedAt descending', async () => {
    const store = createDemoJournalStore('demo-user-f');
    const first = await store.create({ ...emptyDraft(), title: 'First', body: '1' });
    await store.create({ ...emptyDraft(), title: 'Second', body: '2' });
    await store.create({ ...emptyDraft(), title: 'Third', body: '3' });
    // Touch `first` so it sorts latest.
    await store.update(first.id, { ...emptyDraft(), title: 'First', body: '1 updated' });
    const titles = (await store.list()).map((e) => e.title);
    expect(titles[0]).toBe('First');
  });

  it('emits the current entries through subscribe', async () => {
    const store = createDemoJournalStore('demo-user-g');
    await store.create({ ...emptyDraft(), title: 'S', body: 'x' });
    const seen: string[] = [];
    store.subscribe((items) => seen.push(items.map((e) => e.title).join(',')));
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual(['S']);
  });
});

describe('format helpers', () => {
  const ts = new Date(2026, 2, 5, 12, 30).getTime();
  const plain = { seconds: Math.floor(ts / 1000), nanoseconds: (ts % 1000) * 1e6 } as const;

  it('toDate converts structural timestamps', () => {
    expect(toDate(plain)).toBeInstanceOf(Date);
    expect(toDate(plain)?.getTime()).toBe(ts);
  });

  it('toDate returns null for nullish', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });

  it('toPlain and toFirestoreTimestamp round-trip', () => {
    const t = toFirestoreTimestamp(plain);
    expect(toPlain(t)).toEqual(plain);
  });

  it('toFirestoreTimestamp passes through real Timestamps', () => {
    const real = new Timestamp(123, 0);
    expect(toFirestoreTimestamp(real)).toBe(real);
  });

  it('formats dates', () => {
    expect(formatEntryDate(plain)).toBe('Mar 5, 2026');
    expect(formatShortDate(plain)).toBe('Mar 5');
  });

  it('formats relative time', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 10_000), now)).toBe('just now');
    expect(formatRelativeTime(new Date(now - 5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000), now)).toBe('3h ago');
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000), now)).toMatch(/\d+d ago/);
  });
});
