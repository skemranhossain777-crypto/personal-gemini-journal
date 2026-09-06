import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  filterUserGoals,
  assertGoalOwnership,
  assertAssociationOwnership,
  calculateGoalsStats,
  calculateProgressFromMilestones,
  toggleGoalMilestone,
  addGoalMilestone,
  deleteGoalMilestone,
  linkEntryToGoal,
  unlinkEntryFromGoal,
  completeGoal,
  analyzeGoalEvidence,
} from '../goalsEngine';
import type { Goal, JournalEntry } from '../../data/models';

describe('goalsEngine service', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const createGoal = (id: string, uid: string, title: string): Goal => ({
    id,
    uid,
    title,
    description: 'Goal description text',
    status: 'active',
    progress: 50,
    targetDate: mockTimestamp('2026-12-31T00:00:00Z'),
    milestones: [
      { id: 'm1', title: 'Draft chapter 1', done: true },
      { id: 'm2', title: 'Publish book chapter', done: false },
    ],
    relatedEntryIds: ['e1'],
    tags: ['writing'],
    createdAt: mockTimestamp('2026-01-01T00:00:00Z'),
    updatedAt: mockTimestamp('2026-01-01T00:00:00Z'),
  });

  const createEntry = (id: string, uid: string, title: string, body: string): JournalEntry => ({
    id,
    uid,
    title,
    body,
    mode: 'free-write',
    mood: 4,
    energy: 80,
    tags: ['writing'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: mockTimestamp('2026-05-01T00:00:00Z'),
    updatedAt: mockTimestamp('2026-05-01T00:00:00Z'),
  });

  it('filters goals by ownership boundary', () => {
    const goals = [
      createGoal('g1', 'user1', 'User 1 Goal'),
      createGoal('g2', 'user2', 'User 2 Goal'),
    ];

    const result = filterUserGoals(goals, 'user1');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('g1');
  });

  it('asserts goal ownership and throws on violation', () => {
    const goal = createGoal('g1', 'user1', 'My Goal');

    expect(() => assertGoalOwnership(goal, 'user1')).not.toThrow();
    expect(() => assertGoalOwnership(goal, 'user2')).toThrow(/Security Violation/);
  });

  it('asserts association ownership and prevents cross-user entry linking', () => {
    const goal = createGoal('g1', 'user1', 'My Goal');
    const ownEntry = createEntry('e1', 'user1', 'My Entry', 'Body');
    const otherEntry = createEntry('e2', 'user2', 'Other Entry', 'Body');

    expect(() => assertAssociationOwnership(goal, ownEntry, 'user1')).not.toThrow();
    expect(() => assertAssociationOwnership(goal, otherEntry, 'user1')).toThrow(/Security Violation/);
  });

  it('calculates summary statistics correctly', () => {
    const goals = [
      createGoal('g1', 'user1', 'Goal 1'), // 1 done, 1 undone -> 50%
      { ...createGoal('g2', 'user1', 'Goal 2'), status: 'completed' as const, progress: 100 },
    ];

    const stats = calculateGoalsStats(goals);
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.completedMilestones).toBe(2); // 1 from g1, 1 from g2
  });

  it('toggles milestones and recalculates progress', () => {
    const goal = createGoal('g1', 'user1', 'Write Book');
    expect(goal.progress).toBe(50); // 1 of 2 done

    // Toggle m2 to done
    const updated = toggleGoalMilestone(goal, 'm2');
    expect(updated.progress).toBe(100);
    expect(updated.status).toBe('completed');

    // Toggle m1 back to undone
    const toggledBack = toggleGoalMilestone(updated, 'm1');
    expect(toggledBack.progress).toBe(50);
  });

  it('adds and deletes milestones', () => {
    const goal = createGoal('g1', 'user1', 'Write Book'); // 2 milestones (1 done)

    const withNew = addGoalMilestone(goal, 'Edit final draft');
    expect(withNew.milestones.length).toBe(3);
    expect(withNew.progress).toBe(33); // 1 of 3

    const deleted = deleteGoalMilestone(withNew, 'm1');
    expect(deleted.milestones.length).toBe(2);
  });

  it('links and unlinks journal entries with ownership verification', () => {
    const goal = createGoal('g1', 'user1', 'Write Book');
    const newEntry = createEntry('e2', 'user1', 'New Entry', 'Body');

    const linked = linkEntryToGoal(goal, newEntry, 'user1');
    expect(linked.relatedEntryIds).toContain('e2');

    const unlinked = unlinkEntryFromGoal(linked, 'e1');
    expect(unlinked.relatedEntryIds).not.toContain('e1');
    expect(unlinked.relatedEntryIds).toContain('e2');
  });

  it('completes goal setting progress to 100% and all milestones done', () => {
    const goal = createGoal('g1', 'user1', 'Write Book');
    const completed = completeGoal(goal);

    expect(completed.status).toBe('completed');
    expect(completed.progress).toBe(100);
    expect(completed.milestones.every((m) => m.done)).toBe(true);
  });

  it('analyzes goal evidence with Gemini AI and produces grounded proposals', () => {
    const goal = createGoal('g1', 'user1', 'Publish Book');
    const userEntries = [
      createEntry('e100', 'user1', 'Finished publishing book chapter', 'Great progress today, chapter 4 is done!'),
      createEntry('e101', 'user1', 'Unrelated Post', 'Went for a coffee'),
      createEntry('e102', 'user2', 'Publish book chapter', 'Other user entry'), // Should be ignored
    ];

    const proposal = analyzeGoalEvidence(goal, userEntries, 'user1');

    expect(proposal.goalId).toBe('g1');
    expect(proposal.suggestedEntryIds).toContain('e100');
    expect(proposal.suggestedEntryIds).not.toContain('e102'); // Multi-user security
    expect(proposal.groundedEvidence.length).toBeGreaterThan(0);
    expect(proposal.requiresUserConfirmation).toBe(true);
  });
});
