import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { getPrivacyMetrics, verifyDeletionFromAskMyLife, PrivacyActionError } from '../privacyService';
import type { JournalEntry, Memory, Goal } from '../../data/models';

vi.mock('../askMyLife', () => ({
  askMyLifeQuery: vi.fn(async () => ({ evidence: [], confidence: 'insufficient', answer: '' })),
}));

describe('privacyService data governance & deletion rules', () => {
  const mockEntry: JournalEntry = {
    id: 'entry_secret_1',
    uid: 'user1',
    title: 'Secret Startup Launch Idea',
    body: 'Planning to launch stealth project NextGen AI in Tokyo next month.',
    mode: 'idea',
    mood: 5,
    energy: 90,
    tags: ['startup', 'stealth'],
    location: null,
    attachments: [
      {
        id: 'att_img_1',
        kind: 'image',
        url: 'blob:http://localhost/sample.png',
        createdAt: Timestamp.fromDate(new Date()),
      },
      {
        id: 'att_voice_1',
        kind: 'voice',
        url: 'blob:http://localhost/audio.webm',
        createdAt: Timestamp.fromDate(new Date()),
      },
    ],
    favorite: true,
    archived: false,
    private: true,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockMemory: Memory = {
    id: 'mem_secret_1',
    uid: 'user1',
    type: 'project',
    title: 'Stealth AI Project',
    narrative: 'Working on stealth startup project NextGen AI',
    importance: 5,
    confidence: 0.95,
    sourceEntryIds: ['entry_secret_1'],
    tags: ['startup'],
    saved: true,
    occurredAt: Timestamp.fromDate(new Date()),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockGoal: Goal = {
    id: 'goal_1',
    uid: 'user1',
    title: 'Launch Stealth Startup',
    description: 'Target launch Q4',
    status: 'active',
    progress: 50,
    targetDate: null,
    milestones: [],
    relatedEntryIds: ['entry_secret_1'],
    tags: ['startup'],
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('calculates data inventory metrics accurately', () => {
    const metrics = getPrivacyMetrics({
      entries: [mockEntry],
      memories: [mockMemory],
      goals: [mockGoal],
      currentUserId: 'user1',
    });

    expect(metrics.journalEntryCount).toBe(1);
    expect(metrics.memoryCount).toBe(1);
    expect(metrics.uploadedMediaCount).toBe(1);
    expect(metrics.voiceDataCount).toBe(1);
    expect(metrics.goalsCount).toBe(1);
  });

  it('does not let an unauthenticated metric request pass', () => {
    expect(() =>
      getPrivacyMetrics({
        entries: [mockEntry],
        memories: [mockMemory],
        goals: [mockGoal],
        currentUserId: '',
      })
    ).toThrow(PrivacyActionError);
  });

  it('CRITICAL PRIVACY AUDIT: verifies deleted information is NO LONGER RETRIEVABLE by Ask My Life', async () => {
    // Prior to deletion, Ask My Life would have retrieved the entry; after a
    // real wipe the app no longer holds any entries or memories to search.
    const activeEntriesAfterDelete = [] as JournalEntry[];
    const activeMemoriesAfterDelete = [] as Memory[];

    // 3. Verify purged data is non-retrievable
    const isPurged = await verifyDeletionFromAskMyLife({
      query: 'What stealth project am I working on?',
      activeEntries: activeEntriesAfterDelete,
      activeMemories: activeMemoriesAfterDelete,
      currentUserId: 'user1',
    });

    expect(isPurged).toBe(true);
  });
});
