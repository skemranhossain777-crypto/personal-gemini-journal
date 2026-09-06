import type {
  JournalEntry,
  Memory,
  Goal,
  Habit,
  TimelineEvent,
  Insight,
  AiInteraction,
  UserPreferences,
} from '../data/models';
import { askMyLifeQuery } from './askMyLife';

export interface PrivacyMetrics {
  journalEntryCount: number;
  memoryCount: number;
  uploadedMediaCount: number;
  goalsCount: number;
  aiInteractionsCount: number;
  voiceDataCount: number;
}

export interface UserAiControls {
  enableAiAssistance: boolean;
  enableMemorySuggestions: boolean;
  enableHistoricalContext: boolean;
  enableContextualReflections: boolean;
  excludePrivateEntriesFromAi: boolean;
}

export class PrivacyActionError extends Error {
  constructor(message: string, public readonly code: 'UNAUTHORIZED' | 'CONFIRMATION_REQUIRED') {
    super(message);
    this.name = 'PrivacyActionError';
  }
}

/**
 * Calculates current privacy and data metrics for a user.
 */
export function getPrivacyMetrics(params: {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  aiInteractions?: AiInteraction[];
  currentUserId: string;
}): PrivacyMetrics {
  const { entries, memories, goals, aiInteractions = [], currentUserId } = params;

  if (!currentUserId) {
    throw new PrivacyActionError('Security Violation: Unauthorized privacy audit attempt.', 'UNAUTHORIZED');
  }

  const userEntries = entries.filter((e) => e && (e as any).uid === currentUserId);
  const userMemories = memories.filter((m) => m && (m as any).uid === currentUserId);
  const userGoals = goals.filter((g) => g && (g as any).uid === currentUserId);
  const userAiInteractions = aiInteractions.filter((a) => a && (a as any).uid === currentUserId);

  // Count image & file attachments
  const uploadedMediaCount = userEntries.reduce((acc, entry) => {
    const media = (entry.attachments || []).filter((a) => a.kind === 'image' || a.kind === 'file');
    return acc + media.length;
  }, 0);

  // Count voice attachments
  const voiceDataCount = userEntries.reduce((acc, entry) => {
    const voice = (entry.attachments || []).filter((a) => a.kind === 'voice');
    return acc + voice.length;
  }, 0);

  return {
    journalEntryCount: userEntries.length,
    memoryCount: userMemories.length,
    uploadedMediaCount,
    goalsCount: userGoals.length,
    aiInteractionsCount: userAiInteractions.length,
    voiceDataCount,
  };
}

/**
 * Generates a complete, structured JSON export payload of all user data.
 */
export function exportUserDataPayload(params: {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  habits?: Habit[];
  preferences?: UserPreferences;
  currentUserId: string;
}) {
  const { entries, memories, goals, habits = [], preferences, currentUserId } = params;

  if (!currentUserId) {
    throw new PrivacyActionError('Security Violation: Unauthorized export attempt.', 'UNAUTHORIZED');
  }

  const userEntries = entries.filter((e) => (e as any).uid === currentUserId);
  const userMemories = memories.filter((m) => (m as any).uid === currentUserId);
  const userGoals = goals.filter((g) => (g as any).uid === currentUserId);
  const userHabits = habits.filter((h) => (h as any).uid === currentUserId);

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    userId: currentUserId,
    summary: {
      totalEntries: userEntries.length,
      totalMemories: userMemories.length,
      totalGoals: userGoals.length,
      totalHabits: userHabits.length,
    },
    journalEntries: userEntries,
    memories: userMemories,
    goals: userGoals,
    habits: userHabits,
    preferences: preferences || null,
  };
}

/**
 * Deletes AI Memories for a user. Returns remaining memories array.
 */
export function deleteUserMemories(params: {
  memories: Memory[];
  currentUserId: string;
  confirmed: boolean;
}): Memory[] {
  const { memories, currentUserId, confirmed } = params;

  if (!currentUserId) {
    throw new PrivacyActionError('Security Violation: Unauthorized memory deletion attempt.', 'UNAUTHORIZED');
  }

  if (!confirmed) {
    throw new PrivacyActionError('Explicit confirmation required to delete memories.', 'CONFIRMATION_REQUIRED');
  }

  // Filter out memories belonging to currentUserId
  return memories.filter((m) => (m as any).uid !== currentUserId);
}

/**
 * Deletes Journal Entries for a user. Returns remaining entries array.
 */
export function deleteUserJournalData(params: {
  entries: JournalEntry[];
  currentUserId: string;
  confirmed: boolean;
}): JournalEntry[] {
  const { entries, currentUserId, confirmed } = params;

  if (!currentUserId) {
    throw new PrivacyActionError('Security Violation: Unauthorized journal deletion attempt.', 'UNAUTHORIZED');
  }

  if (!confirmed) {
    throw new PrivacyActionError('Explicit confirmation required to delete journal data.', 'CONFIRMATION_REQUIRED');
  }

  // Filter out entries belonging to currentUserId
  return entries.filter((e) => (e as any).uid !== currentUserId);
}

/**
 * Complete Account Deletion. Purges all user data across collections.
 */
export function deleteUserAccountData(params: {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  habits: Habit[];
  currentUserId: string;
  confirmed: boolean;
}): {
  remainingEntries: JournalEntry[];
  remainingMemories: Memory[];
  remainingGoals: Goal[];
  remainingHabits: Habit[];
} {
  const { entries, memories, goals, habits, currentUserId, confirmed } = params;

  if (!currentUserId) {
    throw new PrivacyActionError('Security Violation: Unauthorized account deletion attempt.', 'UNAUTHORIZED');
  }

  if (!confirmed) {
    throw new PrivacyActionError('Explicit confirmation required for full account deletion.', 'CONFIRMATION_REQUIRED');
  }

  return {
    remainingEntries: entries.filter((e) => (e as any).uid !== currentUserId),
    remainingMemories: memories.filter((m) => (m as any).uid !== currentUserId),
    remainingGoals: goals.filter((g) => (g as any).uid !== currentUserId),
    remainingHabits: habits.filter((h) => (h as any).uid !== currentUserId),
  };
}

/**
 * Verifies that purged/deleted information is NO LONGER RETRIEVABLE by Ask My Life system.
 */
export async function verifyDeletionFromAskMyLife(params: {
  query: string;
  activeEntries: JournalEntry[];
  activeMemories: Memory[];
  currentUserId: string;
}): Promise<boolean> {
  const { query, activeEntries, activeMemories, currentUserId } = params;

  if (!currentUserId) return false;

  const result = await askMyLifeQuery({
    question: query,
    entries: activeEntries,
    memories: activeMemories,
  });

  // If evidence list is empty or confidence is insufficient, purged data is not retrievable
  return result.evidence.length === 0 || result.confidence === 'insufficient';
}
