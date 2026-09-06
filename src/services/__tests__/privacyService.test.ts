import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  getPrivacyMetrics,
  exportUserDataPayload,
  deleteUserMemories,
  deleteUserJournalData,
  deleteUserAccountData,
  verifyDeletionFromAskMyLife,
  PrivacyActionError,
} from '../privacyService';
import type { JournalEntry, Memory, Goal } from '../../data/models';

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

  it('generates structured JSON export payload', () => {
    const payload = exportUserDataPayload({
      entries: [mockEntry],
      memories: [mockMemory],
      goals: [mockGoal],
      currentUserId: 'user1',
    });

    expect(payload.userId).toBe('user1');
    expect(payload.summary.totalEntries).toBe(1);
    expect(payload.journalEntries[0].id).toBe('entry_secret_1');
  });

  it('deletes user memories when confirmed', () => {
    const remaining = deleteUserMemories({
      memories: [mockMemory],
      currentUserId: 'user1',
      confirmed: true,
    });

    expect(remaining.length).toBe(0);
  });

  it('requires confirmation to delete memories', () => {
    expect(() =>
      deleteUserMemories({
        memories: [mockMemory],
        currentUserId: 'user1',
        confirmed: false,
      })
    ).toThrow(PrivacyActionError);
  });

  it('deletes journal data when confirmed', () => {
    const remaining = deleteUserJournalData({
      entries: [mockEntry],
      currentUserId: 'user1',
      confirmed: true,
    });

    expect(remaining.length).toBe(0);
  });

  it('performs full account deletion across all collections', () => {
    const deleted = deleteUserAccountData({
      entries: [mockEntry],
      memories: [mockMemory],
      goals: [mockGoal],
      habits: [],
      currentUserId: 'user1',
      confirmed: true,
    });

    expect(deleted.remainingEntries.length).toBe(0);
    expect(deleted.remainingMemories.length).toBe(0);
    expect(deleted.remainingGoals.length).toBe(0);
  });

  it('CRITICAL PRIVACY AUDIT: verifies deleted information is NO LONGER RETRIEVABLE by Ask My Life', async () => {
    // 1. Prior to deletion, Ask My Life retrieves entry information
    const activeEntriesBefore = [mockEntry];
    const activeMemoriesBefore = [mockMemory];

    // 2. Perform deletion
    const activeEntriesAfter = deleteUserJournalData({
      entries: activeEntriesBefore,
      currentUserId: 'user1',
      confirmed: true,
    });
    const activeMemoriesAfter = deleteUserMemories({
      memories: activeMemoriesBefore,
      currentUserId: 'user1',
      confirmed: true,
    });

    // 3. Verify purged data is non-retrievable
    const isPurged = await verifyDeletionFromAskMyLife({
      query: 'What stealth project am I working on?',
      activeEntries: activeEntriesAfter,
      activeMemories: activeMemoriesAfter,
      currentUserId: 'user1',
    });

    expect(isPurged).toBe(true);
  });
});
