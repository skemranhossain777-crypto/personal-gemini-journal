import type { Timestamp } from 'firebase/firestore';

/**
 * Typed data models for the user-scoped Firestore layer.
 *
 * Every document lives under `users/{uid}/<collection>/<id>` and carries the
 * owning `uid` as a first-class immutable field (defense in depth — the
 * security rules verify it equals `request.auth.uid`).
 *
 * Timestamps are stored as Firestore `Timestamp` values (`serverTimestamp()`
 * on write). The client never trusts client-supplied clocks for pedigree
 * fields; `createdAt`/`occurredAt` for user-authorable dates are separate.
 */

// ─── Scalars & shared shapes ─────────────────────────────────────────────────

export type ReflectionMode =
  | 'free-write'
  | 'morning'
  | 'evening'
  | 'deep'
  | 'gratitude'
  | 'idea'
  | 'goal'
  | 'work'
  | 'learning'
  | 'travel';

export type CompanionSkill =
  | 'reflect'
  | 'challenge'
  | 'coach'
  | 'summarize'
  | 'explore'
  | 'remember'
  | 'connect'
  | 'reframe'
  | 'celebrate'
  | 'ask-my-life';

export type MemoryType =
  | 'person'
  | 'place'
  | 'project'
  | 'goal'
  | 'achievement'
  | 'important-event'
  | 'idea'
  | 'preference'
  | 'lesson'
  | 'milestone'
  | 'recurring-theme';

export type TimelineEventType =
  | 'journal'
  | 'memory'
  | 'goal'
  | 'achievement'
  | 'trip'
  | 'milestone'
  | 'idea'
  | 'important-event';

export type InsightKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'pattern';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export type NotificationKind = 'reflection-prompt' | 'memory-suggestion' | 'goal-reminder' | 'system';

export interface SessionCoordinates {
  lat: number;
  lng: number;
}

export interface JournalLocation extends SessionCoordinates {
  placeName: string;
  address?: string;
}

export interface Attachment {
  id: string;
  kind: 'image' | 'voice' | 'file';
  url: string;
  caption?: string;
  createdAt: Timestamp;
}

export interface AiMetadata {
  summary?: string;
  suggestedTags?: string[];
  emotion?: string;
  generatedBy?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Timestamp;
}

/** Alias of `ConversationMessage` — collection rules treat them identically. */
export type JournalMessage = ConversationMessage;

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

export interface HabitLogEntry {
  date: Timestamp;
  done: boolean;
}

export interface ResourceRef {
  collection: string;
  docId: string;
}

// ─── Base ────────────────────────────────────────────────────────────────────

export interface BaseEntity {
  id: string;
  /** Owning UID — immutable, verified against `request.auth.uid` in the rules. */
  uid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Collection models ───────────────────────────────────────────────────────

export interface JournalEntry extends BaseEntity {
  title: string;
  body: string;
  mode: ReflectionMode;
  /** 1..5 or null when the user does not track mood. */
  mood: number | null;
  /** 0..100 or null when the user does not track energy. */
  energy: number | null;
  tags: string[];
  location: JournalLocation | null;
  attachments: Attachment[];
  favorite: boolean;
  archived: boolean;
  private: boolean;
  aiMetadata: AiMetadata | null;
}

export type MemoryStatus = 'candidate' | 'saved' | 'ignored' | 'forgotten';

export interface Memory extends BaseEntity {
  type: MemoryType;
  title: string;
  narrative: string;
  /** 1..5 importance, AI-suggested and user-editable. */
  importance: number;
  /** 0..1 confidence that the memory is real before user review. */
  confidence: number;
  sourceEntryIds: string[];
  tags: string[];
  saved: boolean;
  /** Provenance status: candidate, saved, ignored, or forgotten */
  status?: MemoryStatus;
  /** When the memory happened (user-authorable), for timeline rendering. */
  occurredAt: Timestamp | null;
}

export interface Conversation extends BaseEntity {
  title: string;
  skill: CompanionSkill;
  messages: ConversationMessage[];
  summary?: string;
  modelUsed?: string;
}

export interface Goal extends BaseEntity {
  title: string;
  description: string;
  status: GoalStatus;
  /** 0..100 — AI may propose evidence-based progress, never fabricate it. */
  progress: number;
  targetDate: Timestamp | null;
  milestones: Milestone[];
  relatedEntryIds: string[];
  tags: string[];
}

export interface Habit extends BaseEntity {
  name: string;
  description: string;
  frequency: HabitFrequency;
  /** 0..6 for `weekly` frequency (Firestore `getDay()` convention). */
  daysOfWeek: number[];
  streak: number;
  log: HabitLogEntry[];
}

export interface Collection extends BaseEntity {
  name: string;
  description: string;
  color: string;
  entryIds: string[];
}

export interface TimelineEvent extends BaseEntity {
  type: TimelineEventType;
  title: string;
  description: string;
  occurredAt: Timestamp;
  /** Precomputed from `occurredAt` for On-This-Day / timeline queries. */
  year: number;
  month: number;
  day: number;
  source: ResourceRef | null;
  tags: string[];
}

export interface Insight extends BaseEntity {
  kind: InsightKind;
  title: string;
  narrative: string;
  content: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  themes: string[];
  sourceIds: string[];
  /** False until the user chooses to keep it (no silent auto-persistence). */
  saved: boolean;
}

export interface AiInteraction extends BaseEntity {
  skill: CompanionSkill;
  prompt: string;
  response: string;
  contextRefs: ResourceRef[];
  modelUsed?: string;
  durationMs?: number;
}

export interface UserPreferences extends BaseEntity {
  aiPreferences: {
    reflectionSuggestions: boolean;
    patternDetection: boolean;
    weeklySummaries: boolean;
    memorySuggestions: boolean;
    askBeforeSavingMemory: boolean;
    allowHistoricalContext: boolean;
  };
  writingAssistant: {
    suggestions: boolean;
    grammar: boolean;
    rewriting: boolean;
  };
  notificationPreferences: {
    reflectionReminders: boolean;
    memorySuggestions: boolean;
    goalReminders: boolean;
  };
  language: string;
  timezone: string;
}

export interface Notification extends BaseEntity {
  kind: NotificationKind;
  title: string;
  body: string;
  data: ResourceRef | null;
  read: boolean;
}

// ─── Type maps for rules parity ──────────────────────────────────────────────

export const REFLECTION_MODES: readonly ReflectionMode[] = [
  'free-write',
  'morning',
  'evening',
  'deep',
  'gratitude',
  'idea',
  'goal',
  'work',
  'learning',
  'travel',
];

export const COMPANION_SKILLS: readonly CompanionSkill[] = [
  'reflect',
  'challenge',
  'coach',
  'summarize',
  'explore',
  'remember',
  'connect',
  'reframe',
  'celebrate',
  'ask-my-life',
];

export const MEMORY_TYPES: readonly MemoryType[] = [
  'person',
  'place',
  'project',
  'goal',
  'achievement',
  'important-event',
  'idea',
  'preference',
  'lesson',
  'milestone',
  'recurring-theme',
];

export const TIMELINE_EVENT_TYPES: readonly TimelineEventType[] = [
  'journal',
  'memory',
  'goal',
  'achievement',
  'trip',
  'milestone',
  'idea',
  'important-event',
];

export const INSIGHT_KINDS: readonly InsightKind[] = ['daily', 'weekly', 'monthly', 'yearly', 'pattern'];

export const GOAL_STATUSES: readonly GoalStatus[] = ['active', 'paused', 'completed', 'archived'];

export const HABIT_FREQUENCIES: readonly HabitFrequency[] = ['daily', 'weekly', 'monthly'];

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'reflection-prompt',
  'memory-suggestion',
  'goal-reminder',
  'system',
];

/** The `settings` subcollection hosts exactly one document. */
export const SETTINGS_DOC_ID = 'preferences' as const;

export const OWNER_SCOPED_COLLECTIONS = [
  'journalEntries',
  'memories',
  'conversations',
  'goals',
  'habits',
  'collections',
  'timelineEvents',
  'insights',
  'aiInteractions',
  'settings',
  'notifications',
] as const;

export type OwnerScopedCollection = (typeof OWNER_SCOPED_COLLECTIONS)[number];