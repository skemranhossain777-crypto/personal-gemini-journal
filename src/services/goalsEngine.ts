import type { Goal, GoalStatus, Milestone, JournalEntry } from '../data/models';
import { toDate } from '../journal/format';

export interface GoalEvidenceProposal {
  goalId: string;
  suggestedEntryIds: string[];
  proposedProgress: number;
  completedMilestoneIds: string[];
  reasoning: string;
  groundedEvidence: string[];
  requiresUserConfirmation: boolean;
}

export interface GoalsSummaryStats {
  total: number;
  active: number;
  completed: number;
  paused: number;
  archived: number;
  totalMilestones: number;
  completedMilestones: number;
  overallCompletionRate: number;
}

/**
 * Filter goals strictly by user ownership boundaries.
 */
export function filterUserGoals(goals: Goal[], currentUserId: string): Goal[] {
  if (!currentUserId) return [];
  return goals.filter((g) => g.uid === currentUserId);
}

/**
 * Validate goal ownership boundaries. Throws an error if ownership is violated.
 */
export function assertGoalOwnership(goal: Goal, currentUserId: string): void {
  if (!currentUserId || goal.uid !== currentUserId) {
    throw new Error(`Security Violation: Goal ${goal.id} does not belong to user ${currentUserId}`);
  }
}

/**
 * Validate that both goal and journal entry belong to the same authenticated user.
 */
export function assertAssociationOwnership(goal: Goal, entry: JournalEntry, currentUserId: string): void {
  assertGoalOwnership(goal, currentUserId);
  if (!entry.uid || entry.uid !== currentUserId) {
    throw new Error(`Security Violation: Journal entry ${entry.id} does not belong to user ${currentUserId}`);
  }
}

/**
 * Calculate goal statistics (total, active, completed, milestone completion rate).
 */
export function calculateGoalsStats(goals: Goal[]): GoalsSummaryStats {
  const total = goals.length;
  let active = 0;
  let completed = 0;
  let paused = 0;
  let archived = 0;
  let totalMilestones = 0;
  let completedMilestones = 0;

  for (const g of goals) {
    if (g.status === 'active') active++;
    else if (g.status === 'completed') completed++;
    else if (g.status === 'paused') paused++;
    else if (g.status === 'archived') archived++;

    for (const m of g.milestones || []) {
      totalMilestones++;
      if (m.done) completedMilestones++;
    }
  }

  const overallCompletionRate = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : (total > 0 ? Math.round((completed / total) * 100) : 0);

  return {
    total,
    active,
    completed,
    paused,
    archived,
    totalMilestones,
    completedMilestones,
    overallCompletionRate,
  };
}

/**
 * Recalculate progress percentage based on completed milestones (if milestones exist).
 */
export function calculateProgressFromMilestones(milestones: Milestone[]): number {
  if (!milestones || milestones.length === 0) return 0;
  const doneCount = milestones.filter((m) => m.done).length;
  return Math.round((doneCount / milestones.length) * 100);
}

/**
 * Toggle a milestone's done state and update goal progress.
 */
export function toggleGoalMilestone(goal: Goal, milestoneId: string): Goal {
  const updatedMilestones = goal.milestones.map((m) =>
    m.id === milestoneId ? { ...m, done: !m.done } : m
  );
  const newProgress = calculateProgressFromMilestones(updatedMilestones);
  const isAllDone = updatedMilestones.length > 0 && updatedMilestones.every((m) => m.done);
  const newStatus: GoalStatus = isAllDone ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;

  return {
    ...goal,
    milestones: updatedMilestones,
    progress: newProgress,
    status: newStatus,
  };
}

/**
 * Add a new milestone to a goal.
 */
export function addGoalMilestone(goal: Goal, milestoneTitle: string): Goal {
  const titleTrimmed = milestoneTitle.trim();
  if (!titleTrimmed) return goal;

  const newMilestone: Milestone = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: titleTrimmed,
    done: false,
  };

  const updatedMilestones = [...goal.milestones, newMilestone];
  const newProgress = calculateProgressFromMilestones(updatedMilestones);

  return {
    ...goal,
    milestones: updatedMilestones,
    progress: newProgress,
  };
}

/**
 * Delete a milestone from a goal.
 */
export function deleteGoalMilestone(goal: Goal, milestoneId: string): Goal {
  const updatedMilestones = goal.milestones.filter((m) => m.id !== milestoneId);
  const newProgress = updatedMilestones.length > 0 ? calculateProgressFromMilestones(updatedMilestones) : goal.progress;

  return {
    ...goal,
    milestones: updatedMilestones,
    progress: newProgress,
  };
}

/**
 * Associate a journal entry with a goal.
 */
export function linkEntryToGoal(goal: Goal, entry: JournalEntry, currentUserId: string): Goal {
  assertAssociationOwnership(goal, entry, currentUserId);
  if (goal.relatedEntryIds.includes(entry.id)) return goal;

  return {
    ...goal,
    relatedEntryIds: [...goal.relatedEntryIds, entry.id],
  };
}

/**
 * Unlink a journal entry from a goal.
 */
export function unlinkEntryFromGoal(goal: Goal, entryId: string): Goal {
  return {
    ...goal,
    relatedEntryIds: goal.relatedEntryIds.filter((id) => id !== entryId),
  };
}

/**
 * Mark a goal as completed (progress = 100, status = 'completed', all milestones done).
 */
export function completeGoal(goal: Goal): Goal {
  const completedMilestones = (goal.milestones || []).map((m) => ({ ...m, done: true }));
  return {
    ...goal,
    status: 'completed',
    progress: 100,
    milestones: completedMilestones,
  };
}

/**
 * Analyze journal evidence and suggest candidate connections & progress updates for a goal.
 * CRITICAL RULE: Never falsely claim progress or invent evidence. Requires user confirmation.
 */
export function analyzeGoalEvidence(goal: Goal, userEntries: JournalEntry[], currentUserId: string): GoalEvidenceProposal {
  assertGoalOwnership(goal, currentUserId);

  // Filter entries belonging strictly to current user
  const ownEntries = userEntries.filter((e) => e.uid === currentUserId && !e.archived);

  const goalKeywords = [
    ...goal.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    ...(goal.tags || []).map((t) => t.toLowerCase()),
  ];

  const suggestedEntryIds: string[] = [];
  const groundedEvidence: string[] = [];
  const completedMilestoneIds: string[] = [];

  for (const entry of ownEntries) {
    const text = `${entry.title} ${entry.body}`.toLowerCase();

    // Check keyword matches
    const isKeywordMatch = goalKeywords.some((kw) => text.includes(kw));
    if (isKeywordMatch) {
      if (!suggestedEntryIds.includes(entry.id)) {
        suggestedEntryIds.push(entry.id);
      }

      // Extract grounded evidence snippet
      const titleSnippet = entry.title || 'Untitled Entry';
      const dateStr = toDate(entry.createdAt)?.toLocaleDateString() || '';
      groundedEvidence.push(`Journal Entry "${titleSnippet}" (${dateStr}): mentions keywords related to ${goal.title}`);
    }

    // Check milestone mentions
    for (const milestone of goal.milestones || []) {
      if (!milestone.done && text.includes(milestone.title.toLowerCase())) {
        if (!completedMilestoneIds.includes(milestone.id)) {
          completedMilestoneIds.push(milestone.id);
          groundedEvidence.push(`Milestone "${milestone.title}" mentioned as completed in "${entry.title}"`);
        }
      }
    }
  }

  // Estimate progress proposal grounded only in evidence
  let proposedProgress = goal.progress;
  if (completedMilestoneIds.length > 0 && goal.milestones.length > 0) {
    const totalDone = goal.milestones.filter((m) => m.done).length + completedMilestoneIds.length;
    proposedProgress = Math.min(100, Math.round((totalDone / goal.milestones.length) * 100));
  }

  const reasoning = groundedEvidence.length > 0
    ? `Found ${suggestedEntryIds.length} related journal entries and ${completedMilestoneIds.length} potential milestone updates based on your actual journal reflections.`
    : `No new evidence found in your journal entries for "${goal.title}". Progress remains unchanged at ${goal.progress}%.`;

  return {
    goalId: goal.id,
    suggestedEntryIds,
    proposedProgress,
    completedMilestoneIds,
    reasoning,
    groundedEvidence,
    requiresUserConfirmation: true,
  };
}
