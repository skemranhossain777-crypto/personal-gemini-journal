import type { JournalEntry, Memory, Goal, AiInteraction } from '../data/models';
import { askMyLifeQuery } from './askMyLife';

export interface PrivacyMetrics {
  journalEntryCount: number;
  memoryCount: number;
  uploadedMediaCount: number;
  goalsCount: number;
  aiInteractionsCount: number;
  voiceDataCount: number;
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
 * Verifies that purged/deleted information is NO LONGER RETRIEVABLE by Ask My Life system.
 *
 * NOTE: Deletion itself is a REAL Firestore operation and lives in
 * `privacyGovernance.ts`. This helper runs an AI-level purge check against the
 * remaining in-memory payload any viewer passes it.
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