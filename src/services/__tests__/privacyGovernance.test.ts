import { describe, it, expect, vi } from 'vitest';
import {
  deleteAllJournalEntries,
  deleteAllMemories,
  deleteAllUserData,
  FULL_WIPE_COLLECTIONS,
  LEGACY_INTERACTIONS_COLLECTION,
  GovernanceError,
} from '../privacyGovernance';

function makeDeps(idsByCollection: Record<string, string[]>) {
  const listDocIds = vi.fn(async (name: string) => idsByCollection[name] ?? []);
  const removeDoc = vi.fn(async (_name: string, _uid: string, _id: string) => {});
  return { listDocIds, removeDoc };
}

describe('privacyGovernance persistent deletion', () => {
  it('refuses to delete when no signed-in user exists', async () => {
    const err = await deleteAllJournalEntries().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceError);
    expect((err as GovernanceError).code).toBe('UNAUTHORIZED');
  });

  it('refuses to delete for demo sessions', async () => {
    const err = await deleteAllJournalEntries({ uid: 'demo-local-user' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceError);
    expect((err as GovernanceError).code).toBe('DEMO_SESSION');
  });

  it('refuses to delete when an injected uid is empty', async () => {
    const err = await deleteAllMemories({ uid: '' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceError);
    expect((err as GovernanceError).code).toBe('UNAUTHORIZED');
  });

  it('deletes every journal entry doc under the owner partition', async () => {
    const deps = makeDeps({ journalEntries: ['e1', 'e2', 'e3'] });
    const result = await deleteAllJournalEntries({ uid: 'user-123', ...deps });

    expect(result).toEqual({ collection: 'journalEntries', deleted: 3, failed: 0 });
    expect(deps.removeDoc).toHaveBeenCalledTimes(3);
    for (const id of ['e1', 'e2', 'e3']) {
      expect(deps.removeDoc).toHaveBeenCalledWith('journalEntries', 'user-123', id);
    }
  });

  it('deletes every memory doc under the owner partition', async () => {
    const deps = makeDeps({ memories: ['m1'] });
    const result = await deleteAllMemories({ uid: 'user-123', ...deps });
    expect(result).toEqual({ collection: 'memories', deleted: 1, failed: 0 });
  });

  it('counts per-doc failures instead of aborting the whole wipe', async () => {
    const deps = makeDeps({ journalEntries: ['ok', 'bad', 'ok2'] });
    deps.removeDoc.mockImplementation(async (_name: string, _uid: string, id: string) => {
      if (id === 'bad') throw new Error('permission-denied');
    });
    const result = await deleteAllJournalEntries({ uid: 'user-123', ...deps });
    expect(result).toEqual({ collection: 'journalEntries', deleted: 2, failed: 1 });
  });

  it('surfaces scan failures as DELETE_FAILED', async () => {
    const deps = makeDeps({ journalEntries: [] });
    deps.listDocIds.mockRejectedValue(new Error('network down'));
    const err = await deleteAllJournalEntries({ uid: 'user-123', ...deps }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceError);
    expect((err as GovernanceError).code).toBe('DELETE_FAILED');
  });

  it('full wipe covers every scoped collection including settings and legacy interactions', async () => {
    const collections = FULL_WIPE_COLLECTIONS;
    expect(collections).toContain('settings');
    expect(collections).toContain(LEGACY_INTERACTIONS_COLLECTION);
    expect(collections).toContain('journalEntries');
    expect(collections).toContain('memories');
    expect(collections).toContain('conversations');
    expect(collections).toContain('goals');
    expect(collections).toContain('habits');
    expect(collections).toContain('collections');
    expect(collections).toContain('timelineEvents');
    expect(collections).toContain('insights');
    expect(collections).toContain('aiInteractions');
    expect(collections).toContain('notifications');

    const idsByCollection: Record<string, string[]> = {};
    for (const name of collections) idsByCollection[name] = [`${name}_1`];
    const deps = makeDeps(idsByCollection);

    const results = await deleteAllUserData({ uid: 'user-123', ...deps });

    expect(results).toHaveLength(collections.length);
    for (const r of results) {
      expect(r.failed).toBe(0);
      expect(r.deleted).toBe(1);
    }
    expect(deps.removeDoc).toHaveBeenCalledTimes(collections.length);
    expect(deps.removeDoc).toHaveBeenCalledWith('settings', 'user-123', 'settings_1');
    expect(deps.removeDoc).toHaveBeenCalledWith(
      LEGACY_INTERACTIONS_COLLECTION,
      'user-123',
      `${LEGACY_INTERACTIONS_COLLECTION}_1`,
    );
  });
});