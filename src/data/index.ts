export { DataError, toDataError, isDataError } from './errors';
export type { DataErrorCode, DataOperation } from './errors';
export {
  OWNER_SCOPED_COLLECTIONS,
  SETTINGS_DOC_ID,
  REFLECTION_MODES,
  COMPANION_SKILLS,
  MEMORY_TYPES,
  TIMELINE_EVENT_TYPES,
  INSIGHT_KINDS,
  GOAL_STATUSES,
  HABIT_FREQUENCIES,
  NOTIFICATION_KINDS,
} from './models';
export type {
  BaseEntity,
  OwnerScopedCollection,
  JournalEntry,
  Memory,
  Conversation,
  Goal,
  Habit,
  Collection,
  TimelineEvent,
  Insight,
  AiInteraction,
  UserPreferences,
  Notification,
  JournalMessage,
  ConversationMessage,
  JournalLocation,
  Attachment,
  AiMetadata,
  SessionCoordinates,
  ReflectionMode,
  CompanionSkill,
  MemoryType,
  TimelineEventType,
  InsightKind,
  GoalStatus,
  HabitFrequency,
  NotificationKind,
  ResourceRef,
} from './models';
export { createCollectionApi } from './crud';
export type { CollectionConfig, CollectionApi, PendingWrite } from './crud';
export { buildPage, normalizePageOptions, MAX_PAGE_SIZE } from './pagination';
export type { Page, ListOptions } from './pagination';
export { requireOwnerUid, assertSafeId, buildDocPath, buildCollectionPath, MAX_DOC_ID_LENGTH } from './paths';
export { LIMITS } from './validation';
export type { ValidationResult } from './validation';

export { journalEntriesApi } from './services/journalEntries';
export { memoriesApi } from './services/memories';
export { conversationsApi } from './services/conversations';
export { goalsApi } from './services/goals';
export { habitsApi } from './services/habits';
export { collectionsApi } from './services/collections';
export { timelineEventsApi } from './services/timelineEvents';
export { insightsApi } from './services/insights';
export { aiInteractionsApi } from './services/aiInteractions';
export { settingsApi } from './services/settings';
export { notificationsApi } from './services/notifications';
