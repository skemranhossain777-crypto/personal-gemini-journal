import { describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  generateReflectionReport,
  clearReportCache,
  getReportCacheKey,
} from '../reflectionReports';
import type { JournalEntry, Memory, Goal } from '../../data/models';

describe('reflectionReports service', () => {
  beforeEach(() => {
    clearReportCache();
  });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const mockEntry1: JournalEntry = {
    id: 'entry_1',
    uid: 'user1',
    title: 'Productive Launch Day',
    body: 'I am so proud of launching the project today! Realized that persistence pays off.',
    mode: 'free-write',
    mood: 5,
    energy: 90,
    tags: ['launch', 'work'],
    location: null,
    attachments: [],
    favorite: true,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockEntry2: JournalEntry = {
    id: 'entry_2',
    uid: 'user1',
    title: 'Tired Evening',
    body: 'Felt stress and worry about deadline. Need to organize tasks better tomorrow.',
    mode: 'evening',
    mood: 2,
    energy: 30,
    tags: ['stress', 'work'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockMemory: Memory = {
    id: 'mem_1',
    uid: 'user1',
    type: 'achievement',
    title: 'Project Launch',
    narrative: 'Successfully launched project on schedule',
    importance: 5,
    confidence: 0.95,
    sourceEntryIds: ['entry_1'],
    tags: ['launch'],
    saved: true,
    occurredAt: Timestamp.fromDate(new Date()),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockGoal: Goal = {
    id: 'goal_1',
    uid: 'user1',
    title: 'Publish Journaling App',
    description: 'Complete full feature set',
    status: 'active',
    progress: 80,
    targetDate: null,
    milestones: [],
    relatedEntryIds: ['entry_1'],
    tags: ['app'],
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('generates a weekly reflection report containing all 8 required sections', () => {
    const report = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1, mockEntry2],
      memories: [mockMemory],
      goals: [mockGoal],
      currentUserId: 'user1',
    });

    expect(report.highlights.length).toBeGreaterThan(0);
    expect(report.difficultMoments.length).toBeGreaterThan(0);
    expect(report.lessons.length).toBeGreaterThan(0);
    expect(report.recurringThemes.length).toBeGreaterThan(0);
    expect(report.goalProgress.length).toBeGreaterThan(0);
    expect(report.unfinishedIntentions.length).toBeGreaterThan(0);
    expect(report.meaningfulMemories.length).toBeGreaterThan(0);
    expect(report.suggestedFocus.length).toBeGreaterThan(0);
  });

  it('accurately calculates stats without fabricating numbers', () => {
    const report = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1, mockEntry2],
      memories: [mockMemory],
      goals: [mockGoal],
      currentUserId: 'user1',
    });

    expect(report.stats.totalEntries).toBe(2);
    expect(report.stats.totalWords).toBeGreaterThan(20);
    expect(report.stats.activeGoalsCount).toBe(1);
    expect(report.stats.memoriesFormedCount).toBe(1);
  });

  it('distinguishes observed evidence from AI interpretation and links source entries', () => {
    const report = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1],
      currentUserId: 'user1',
    });

    const highlight = report.highlights[0];
    expect(highlight.observedEvidence).toContain('Productive Launch Day');
    expect(highlight.aiInterpretation).toBeDefined();
    expect(highlight.sourceEntryId).toBe('entry_1');
    expect(report.sourceEntries[0].id).toBe('entry_1');
  });

  it('caches generated reports and re-uses cache when forceRegenerate is false', () => {
    const report1 = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1],
      currentUserId: 'user1',
    });

    expect(report1.isCached).toBe(false);

    const report2 = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1],
      currentUserId: 'user1',
    });

    expect(report2.isCached).toBe(true);
  });

  it('bypasses cache when forceRegenerate is true', () => {
    generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1],
      currentUserId: 'user1',
    });

    const regenerated = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1],
      currentUserId: 'user1',
      forceRegenerate: true,
    });

    expect(regenerated.isCached).toBe(false);
  });

  it('enforces multi-user ownership privacy and excludes foreign user entries', () => {
    const foreignEntry: JournalEntry = {
      ...mockEntry1,
      id: 'foreign_1',
      uid: 'user2',
    };

    const report = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1, foreignEntry],
      currentUserId: 'user1',
    });

    expect(report.stats.totalEntries).toBe(1);
    expect(report.sourceEntries.some((e) => e.id === 'foreign_1')).toBe(false);
  });

  it('includes anti-diagnosis and grounding disclaimer', () => {
    const report = generateReflectionReport({
      kind: 'weekly',
      periodStart,
      periodEnd,
      entries: [mockEntry1],
      currentUserId: 'user1',
    });

    expect(report.disclaimer).toMatch(/Gemini does not diagnose medical conditions/);
  });
});
