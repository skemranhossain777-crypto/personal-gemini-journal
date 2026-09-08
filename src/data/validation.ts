import type { Timestamp } from 'firebase/firestore';
import {
  COMPANION_SKILLS,
  GOAL_STATUSES,
  HABIT_FREQUENCIES,
  INSIGHT_KINDS,
  MEMORY_TYPES,
  NOTIFICATION_KINDS,
  REFLECTION_MODES,
  TIMELINE_EVENT_TYPES,
  type Attachment,
  type Collection,
  type Conversation,
  type Goal,
  type Habit,
  type Insight,
  type JournalEntry,
  type Memory,
  type Notification,
  type TimelineEvent,
  type UserPreferences,
  type AiInteraction,
} from './models';

/**
 * Client-side validation for the user-scoped data layer.
 *
 * These validators are the exact mirror of the Firestore security rules
 * (`firestore.rules`): same enums, same length caps, same immutability rules.
 * They exist to give users immediate, friendly feedback and to prevent wasted
 * network round-trips — the rules remain the enforcement point, so a client
 * that skips validation still gets rejected by the database.
 *
 * Keep every constant below in sync with `firestore.rules`.
 */

// ─── Shared bounds (MUST match firestore.rules) ──────────────────────────────

export const LIMITS = {
  docIdLength: 128,
  uidLength: 128,
  title: 200,
  description: 2000,
  body: 50_000,
  messageContent: 120_000,
  messageCount: 200,
  messagesPerInteraction: 200,
  tagsCount: 50,
  tagLength: 32,
  stringListCount: 200,
  stringListElement: 200,
  attachmentsCount: 20,
  urlLength: 2000,
  narrative: 20_000,
  content: 100_000,
  summary: 50_000,
  emotions: ['low', 'neutral', 'high'] as const,
} as const;

export type ValidationResult = { ok: true; errors: string[] } | { ok: false; errors: string[] };

function fail(...errors: string[]): ValidationResult {
  return { ok: false, errors };
}
const pass: ValidationResult = { ok: true, errors: [] };

// ─── Low-level guards (duck-typed so tests don't need the SDK) ───────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasOnlyKeys(v: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(v).every((k) => keys.includes(k));
}

function isTimestamp(v: unknown): v is Timestamp {
  return (
    isRecord(v) &&
    typeof v.seconds === 'number' &&
    typeof v.nanoseconds === 'number' &&
    !Number.isNaN(v.seconds)
  );
}

function isString(v: unknown, maxLen?: number): v is string {
  return typeof v === 'string' && (maxLen === undefined || v.length <= maxLen);
}

function inEnum<T extends string>(v: unknown, set: readonly T[]): v is T {
  return typeof v === 'string' && (set as readonly string[]).includes(v);
}

function stringList(v: unknown, maxCount: number, maxLen: number): boolean {
  return (
    Array.isArray(v) &&
    v.length <= maxCount &&
    v.every((item) => typeof item === 'string' && item.length >= 1 && item.length <= maxLen)
  );
}

function nullable(v: unknown): v is null {
  return v === null;
}

function optionalString(v: unknown, maxLen?: number): boolean {
  return v === undefined || isString(v, maxLen);
}

function optionalTimestamp(v: unknown): boolean {
  return v === undefined || v === null || isTimestamp(v);
}

function optionalBool(v: unknown): boolean {
  return v === undefined || typeof v === 'boolean';
}

function optionalNumber(v: unknown): boolean {
  return v === undefined || v === null || typeof v === 'number';
}

function nonEmptyString(v: unknown, maxLen: number, label: string): boolean {
  return typeof v === 'string' && v.length >= 1 && v.length <= maxLen;
}

/**
 * A document id must be a sane string: non-empty, bounded, and free of path
 * separators and reserved segments. Mirrors `assertSafeId` in paths.ts and the
 * rules `isValidId` — prevents cross-collection / path escapes in ref fields.
 */
function isSafeId(v: unknown, maxLen: number = LIMITS.docIdLength): boolean {
  return (
    typeof v === 'string' &&
    v.length >= 1 &&
    v.length <= maxLen &&
    !v.includes('/') &&
    !v.includes('\\') &&
    !['.', '..', '__proto__', 'constructor', 'prototype'].includes(v) &&
    !/^__proto__$/.test(v) &&
    !/^constructor$/.test(v)
  );
}

/** A `{ collection, docId }` reference with both segments validated. */
function isValidRef(ref: unknown): boolean {
  return (
    isRecord(ref) &&
    hasOnlyKeys(ref, ['collection', 'docId']) &&
    nonEmptyString(ref.collection, 64, 'ref collection') &&
    isSafeId(ref.docId)
  );
}

/** `resources.entryIds`-style lists must be arrays of safe doc ids. */
function safeIdList(v: unknown, maxCount: number): boolean {
  return Array.isArray(v) && v.length <= maxCount && v.every((item) => isSafeId(item));
}

// ─── Model validators (MUST match firestore.rules) ───────────────────────────

export function validateJournalEntryInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Journal entry must be an object.');
  if (!hasOnlyKeys(input, ['title', 'body', 'mode', 'mood', 'energy', 'tags', 'location', 'attachments', 'favorite', 'archived', 'private', 'aiMetadata'])) {
    return fail('Journal entry contains fields that are not allowed.');
  }
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail(`title must be a string of 1..${LIMITS.title} characters.`);
  if (!isString(input.body, LIMITS.body)) return fail(`body must be a string up to ${LIMITS.body} characters.`);
  if (!inEnum(input.mode, REFLECTION_MODES)) return fail('mode is not a valid reflection mode.');
  if (!(nullable(input.mood) || (typeof input.mood === 'number' && input.mood >= 1 && input.mood <= 5))) {
    return fail('mood must be null or an integer 1..5.');
  }
  if (!(nullable(input.energy) || (typeof input.energy === 'number' && input.energy >= 0 && input.energy <= 100))) {
    return fail('energy must be null or a number 0..100.');
  }
  if (!stringList(input.tags, LIMITS.tagsCount, LIMITS.tagLength)) {
    return fail(`tags must be a list of 1..${LIMITS.tagLength}-character strings (max ${LIMITS.tagsCount}).`);
  }
  if (input.location !== null && input.location !== undefined) {
    if (
      !isRecord(input.location) ||
      !hasOnlyKeys(input.location, ['lat', 'lng', 'placeName', 'address']) ||
      typeof input.location.lat !== 'number' ||
      typeof input.location.lng !== 'number' ||
      !nonEmptyString(input.location.placeName, LIMITS.title, 'placeName') ||
      !optionalString(input.location.address, 500)
    ) {
      return fail('location must be null or { lat, lng, placeName, address? }.');
    }
  }
  if (!Array.isArray(input.attachments) || input.attachments.length > LIMITS.attachmentsCount) {
    return fail(`attachments must be a list of at most ${LIMITS.attachmentsCount} items.`);
  }
  if (
    !input.attachments.every(
      (a: unknown) =>
        isRecord(a) &&
        hasOnlyKeys(a, ['id', 'kind', 'url', 'caption', 'createdAt']) &&
        nonEmptyString(a.id, LIMITS.docIdLength, 'attachment id') &&
        inEnum(a.kind, ['image', 'voice', 'file']) &&
        isString(a.url, LIMITS.urlLength) &&
        optionalString(a.caption, 1000) &&
        isTimestamp(a.createdAt),
    )
  ) {
    return fail('Each attachment must be { id, kind, url, caption?, createdAt }.');
  }
  if (typeof input.favorite !== 'boolean') return fail('favorite must be a boolean.');
  if (typeof input.archived !== 'boolean') return fail('archived must be a boolean.');
  if (typeof input.private !== 'boolean') return fail('private must be a boolean.');
  if (input.aiMetadata !== null && input.aiMetadata !== undefined) {
    if (
      !isRecord(input.aiMetadata) ||
      !hasOnlyKeys(input.aiMetadata, ['summary', 'suggestedTags', 'emotion', 'generatedBy', 'modality', 'transcript']) ||
      !optionalString(input.aiMetadata.summary, LIMITS.summary) ||
      !optionalString(input.aiMetadata.emotion, 64) ||
      !optionalString(input.aiMetadata.generatedBy, 64) ||
      !(input.aiMetadata.modality === undefined || input.aiMetadata.modality === 'image' || input.aiMetadata.modality === 'voice') ||
      !(input.aiMetadata.transcript === undefined || optionalString(input.aiMetadata.transcript, 120000)) ||
      !(input.aiMetadata.suggestedTags === undefined || stringList(input.aiMetadata.suggestedTags, LIMITS.tagsCount, LIMITS.tagLength))
    ) {
      return fail(
        'aiMetadata must be null or { summary?, suggestedTags?, emotion?, generatedBy?, modality?, transcript? }.'
      );
    }
  }
  return pass;
}

export function validateMemoryInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Memory must be an object.');
  if (!hasOnlyKeys(input, ['type', 'title', 'narrative', 'importance', 'confidence', 'sourceEntryIds', 'tags', 'saved', 'status', 'occurredAt'])) {
    return fail('Memory contains fields that are not allowed.');
  }
  if (!inEnum(input.type, MEMORY_TYPES)) return fail('type is not a valid memory type.');
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail('title is required.');
  if (!isString(input.narrative, LIMITS.narrative)) return fail(`narrative must be a string up to ${LIMITS.narrative} characters.`);
  if (typeof input.importance !== 'number' || input.importance < 1 || input.importance > 5) {
    return fail('importance must be a number 1..5.');
  }
  if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
    return fail('confidence must be a number 0..1.');
  }
  if (!safeIdList(input.sourceEntryIds, LIMITS.stringListCount)) {
    return fail('sourceEntryIds must be a list of document ids.');
  }
  if (!stringList(input.tags, LIMITS.tagsCount, LIMITS.tagLength)) return fail('tags is invalid.');
  if (typeof input.saved !== 'boolean') return fail('saved must be a boolean.');
  if (input.status !== undefined && !inEnum(input.status, ['candidate', 'saved', 'ignored', 'forgotten'] as const)) {
    return fail('status must be one of candidate, saved, ignored, or forgotten.');
  }
  if (!optionalTimestamp(input.occurredAt)) return fail('occurredAt must be a timestamp or null.');
  return pass;
}

export function validateConversationInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Conversation must be an object.');
  if (!hasOnlyKeys(input, ['title', 'skill', 'messages', 'summary', 'modelUsed'])) {
    return fail('Conversation contains fields that are not allowed.');
  }
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail('title is required.');
  if (!inEnum(input.skill, COMPANION_SKILLS)) return fail('skill is not a valid companion skill.');
  if (!Array.isArray(input.messages) || input.messages.length > LIMITS.messageCount) {
    return fail(`messages must be a list of at most ${LIMITS.messageCount} turns.`);
  }
  if (
    !input.messages.every(
      (m: unknown) =>
        isRecord(m) &&
        hasOnlyKeys(m, ['id', 'role', 'content', 'timestamp']) &&
        nonEmptyString(m.id, LIMITS.docIdLength, 'message id') &&
        inEnum(m.role, ['user', 'model']) &&
        isString(m.content, LIMITS.messageContent) &&
        isTimestamp(m.timestamp),
    )
  ) {
    return fail('Each message must be { id, role, content, timestamp }.');
  }
  if (!optionalString(input.summary, LIMITS.summary)) return fail('summary is invalid.');
  if (!optionalString(input.modelUsed, 128)) return fail('modelUsed is invalid.');
  return pass;
}

export function validateGoalInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Goal must be an object.');
  if (!hasOnlyKeys(input, ['title', 'description', 'status', 'progress', 'targetDate', 'milestones', 'relatedEntryIds', 'tags'])) {
    return fail('Goal contains fields that are not allowed.');
  }
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail('title is required.');
  if (!isString(input.description, LIMITS.description)) return fail('description is invalid.');
  if (!inEnum(input.status, GOAL_STATUSES)) return fail('status is not a valid goal status.');
  if (typeof input.progress !== 'number' || input.progress < 0 || input.progress > 100) {
    return fail('progress must be a number 0..100.');
  }
  if (!optionalTimestamp(input.targetDate)) return fail('targetDate must be a timestamp or null.');
  if (
    !Array.isArray(input.milestones) ||
    input.milestones.length > LIMITS.stringListCount ||
    !input.milestones.every(
      (m: unknown) =>
        isRecord(m) &&
        hasOnlyKeys(m, ['id', 'title', 'done']) &&
        nonEmptyString(m.id, LIMITS.docIdLength, 'milestone id') &&
        nonEmptyString(m.title, LIMITS.title, 'milestone title') &&
        typeof m.done === 'boolean',
    )
  ) {
    return fail('milestones is invalid.');
  }
  if (!safeIdList(input.relatedEntryIds, LIMITS.stringListCount)) {
    return fail('relatedEntryIds is invalid.');
  }
  if (!stringList(input.tags, LIMITS.tagsCount, LIMITS.tagLength)) return fail('tags is invalid.');
  return pass;
}

export function validateHabitInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Habit must be an object.');
  if (!hasOnlyKeys(input, ['name', 'description', 'frequency', 'daysOfWeek', 'streak', 'log'])) {
    return fail('Habit contains fields that are not allowed.');
  }
  if (!nonEmptyString(input.name, LIMITS.title, 'name')) return fail('name is required.');
  if (!isString(input.description, LIMITS.description)) return fail('description is invalid.');
  if (!inEnum(input.frequency, HABIT_FREQUENCIES)) return fail('frequency is invalid.');
  if (
    !Array.isArray(input.daysOfWeek) ||
    input.daysOfWeek.length > 7 ||
    !input.daysOfWeek.every((d: unknown) => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)
  ) {
    return fail('daysOfWeek must be a list of integers 0..6.');
  }
  if (typeof input.streak !== 'number' || !Number.isInteger(input.streak) || input.streak < 0 || input.streak > 100000) {
    return fail('streak must be a non-negative integer.');
  }
  if (
    !Array.isArray(input.log) ||
    input.log.length > 3660 ||
    !input.log.every(
      (e: unknown) => isRecord(e) && hasOnlyKeys(e, ['date', 'done']) && isTimestamp(e.date) && typeof e.done === 'boolean',
    )
  ) {
    return fail('log is invalid.');
  }
  return pass;
}

export function validateCollectionInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Collection must be an object.');
  if (!hasOnlyKeys(input, ['name', 'description', 'color', 'entryIds'])) {
    return fail('Collection contains fields that are not allowed.');
  }
  if (!nonEmptyString(input.name, LIMITS.title, 'name')) return fail('name is required.');
  if (!isString(input.description, LIMITS.description)) return fail('description is invalid.');
  if (typeof input.color !== 'string' || !/^#([0-9a-fA-F]{6})$/.test(input.color)) {
    return fail('color must be a hex color like #1f2d5a.');
  }
  if (!safeIdList(input.entryIds, LIMITS.stringListCount)) {
    return fail('entryIds is invalid.');
  }
  return pass;
}

export function validateTimelineEventInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Timeline event must be an object.');
  if (!hasOnlyKeys(input, ['type', 'title', 'description', 'occurredAt', 'year', 'month', 'day', 'source', 'tags'])) {
    return fail('Timeline event contains fields that are not allowed.');
  }
  if (!inEnum(input.type, TIMELINE_EVENT_TYPES)) return fail('type is invalid.');
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail('title is required.');
  if (!isString(input.description, LIMITS.description)) return fail('description is invalid.');
  if (!isTimestamp(input.occurredAt)) return fail('occurredAt must be a timestamp.');
  if (
    typeof input.year !== 'number' ||
    typeof input.month !== 'number' ||
    typeof input.day !== 'number' ||
    !Number.isInteger(input.month) ||
    input.month < 1 ||
    input.month > 12 ||
    !Number.isInteger(input.day) ||
    input.day < 1 ||
    input.day > 31
  ) {
    return fail('year/month/day must be numeric calendar components (month 1..12, day 1..31).');
  }
  if (input.source !== null && input.source !== undefined) {
    if (!isValidRef(input.source)) {
      return fail('source must be null or { collection, docId }.');
    }
  }
  if (!stringList(input.tags, LIMITS.tagsCount, LIMITS.tagLength)) return fail('tags is invalid.');
  return pass;
}

export function validateInsightInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Insight must be an object.');
  if (!hasOnlyKeys(input, ['kind', 'title', 'narrative', 'content', 'periodStart', 'periodEnd', 'themes', 'sourceIds', 'saved'])) {
    return fail('Insight contains fields that are not allowed.');
  }
  if (!inEnum(input.kind, INSIGHT_KINDS)) return fail('kind is invalid.');
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail('title is required.');
  if (!isString(input.narrative, LIMITS.narrative)) return fail('narrative is invalid.');
  if (!isString(input.content, LIMITS.content)) return fail('content is invalid.');
  if (!isTimestamp(input.periodStart) || !isTimestamp(input.periodEnd)) {
    return fail('periodStart and periodEnd must be timestamps.');
  }
  if (!stringList(input.themes, LIMITS.tagsCount, LIMITS.tagLength)) return fail('themes is invalid.');
  if (!safeIdList(input.sourceIds, LIMITS.stringListCount)) return fail('sourceIds is invalid.');
  if (typeof input.saved !== 'boolean') return fail('saved must be a boolean.');
  return pass;
}

export function validateAiInteractionInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('AI interaction must be an object.');
  if (!hasOnlyKeys(input, ['skill', 'prompt', 'response', 'contextRefs', 'modelUsed', 'durationMs'])) {
    return fail('AI interaction contains fields that are not allowed.');
  }
  if (!inEnum(input.skill, COMPANION_SKILLS)) return fail('skill is invalid.');
  if (!nonEmptyString(input.prompt, LIMITS.body, 'prompt')) return fail('prompt is required.');
  if (!isString(input.response, LIMITS.content)) return fail('response is invalid.');
  if (
    !Array.isArray(input.contextRefs) ||
    input.contextRefs.length > LIMITS.stringListCount ||
    !input.contextRefs.every(isValidRef)
  ) {
    return fail('contextRefs must be a list of { collection, docId }.');
  }
  if (!optionalString(input.modelUsed, 128)) return fail('modelUsed is invalid.');
  if (!optionalNumber(input.durationMs) || (typeof input.durationMs === 'number' && input.durationMs < 0)) {
    return fail('durationMs must be a non-negative number.');
  }
  return pass;
}

export function validatePreferencesInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Preferences must be an object.');
  if (!hasOnlyKeys(input, ['aiPreferences', 'writingAssistant', 'notificationPreferences', 'language', 'timezone'])) {
    return fail('Preferences contains fields that are not allowed.');
  }
  const ai = input.aiPreferences;
  if (
    !isRecord(ai) ||
    !hasOnlyKeys(ai, ['reflectionSuggestions', 'patternDetection', 'weeklySummaries', 'memorySuggestions', 'askBeforeSavingMemory', 'allowHistoricalContext']) ||
    Object.values(ai).every((v) => typeof v === 'boolean') === false
  ) {
    return fail('aiPreferences is invalid; all six flags must be booleans.');
  }
  const writing = input.writingAssistant;
  if (
    !isRecord(writing) ||
    !hasOnlyKeys(writing, ['suggestions', 'grammar', 'rewriting']) ||
    !([writing.suggestions, writing.grammar, writing.rewriting].every((v) => typeof v === 'boolean'))
  ) {
    return fail('writingAssistant is invalid; all three flags must be booleans.');
  }
  const notif = input.notificationPreferences;
  if (
    !isRecord(notif) ||
    !hasOnlyKeys(notif, ['reflectionReminders', 'memorySuggestions', 'goalReminders']) ||
    !([notif.reflectionReminders, notif.memorySuggestions, notif.goalReminders].every((v) => typeof v === 'boolean'))
  ) {
    return fail('notificationPreferences is invalid; all three flags must be booleans.');
  }
  if (!isString(input.language, 16) || input.language.length < 2) return fail('language must be a locale string like "en".');
  if (!isString(input.timezone, 64) || input.timezone.length < 1) return fail('timezone must be a tz database name.');
  return pass;
}

export function validateNotificationInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Notification must be an object.');
  if (!hasOnlyKeys(input, ['kind', 'title', 'body', 'data', 'read'])) {
    return fail('Notification contains fields that are not allowed.');
  }
  if (!inEnum(input.kind, NOTIFICATION_KINDS)) return fail('kind is invalid.');
  if (!nonEmptyString(input.title, LIMITS.title, 'title')) return fail('title is required.');
  if (!isString(input.body, LIMITS.description)) return fail('body is invalid.');
  if (input.data !== null && input.data !== undefined) {
    if (!isValidRef(input.data)) {
      return fail('data must be null or { collection, docId }.');
    }
  }
  if (typeof input.read !== 'boolean') return fail('read must be a boolean.');
  return pass;
}

// ─── Full-document validators (post-merge, used before write) ────────────────

type StoredShape = Record<string, unknown>;

export function validateJournalEntryStored(doc: StoredShape, existing?: StoredShape | null): ValidationResult {
  const base = validateJournalEntryInput(doc);
  if (!base.ok) return base;
  if (!isString(doc.id, LIMITS.docIdLength) || !isString(doc.uid, LIMITS.uidLength)) {
    return fail('id and uid must be valid strings.');
  }
  if (!isTimestamp(doc.createdAt) || !isTimestamp(doc.updatedAt)) {
    return fail('createdAt and updatedAt must be timestamps.');
  }
  return immutableGuard(doc, existing, ['id', 'uid', 'createdAt']);
}

function immutableGuard(next: StoredShape, existing: StoredShape | null | undefined, immutableKeys: readonly string[]): ValidationResult {
  if (!existing) return pass;
  for (const key of immutableKeys) {
    if (existing[key] !== next[key]) {
      return fail(`immutable field "${key}" cannot be changed.`);
    }
  }
  return pass;
}

// Exported immutable-key sets for services and tests.
export const IMMUTABLE_KEYS = ['id', 'uid', 'createdAt'] as const;

// ─── Convenience typed guards (used by services to keep TS honest) ───────────

export function isJournalEntry(v: unknown): v is JournalEntry {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isMemory(v: unknown): v is Memory {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isConversation(v: unknown): v is Conversation {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isGoal(v: unknown): v is Goal {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isHabit(v: unknown): v is Habit {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isCollection(v: unknown): v is Collection {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isTimelineEvent(v: unknown): v is TimelineEvent {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isInsight(v: unknown): v is Insight {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isAiInteraction(v: unknown): v is AiInteraction {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isUserPreferences(v: unknown): v is UserPreferences {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}
export function isNotification(v: unknown): v is Notification {
  return isRecord(v) && typeof v.id === 'string' && typeof v.uid === 'string';
}

/**
 * Strip `undefined` values (Firestore rejects them) — applied to every write.
 */
export function withoutUndefined<T>(v: T): T {
  if (v === null || v === undefined) return v as T;
  if (Array.isArray(v)) return v.map(withoutUndefined) as unknown as T;
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) out[k] = withoutUndefined(val);
    }
    return out as unknown as T;
  }
  return v;
}

export type { Attachment, Collection, Conversation, Goal, Habit, Insight, JournalEntry, Memory, Notification, TimelineEvent, UserPreferences, AiInteraction };
