import { describe, expect, it } from 'vitest';
import {
  validateJournalEntryInput,
  validateMemoryInput,
  validateConversationInput,
  validateGoalInput,
  validateHabitInput,
  validateCollectionInput,
  validateTimelineEventInput,
  validateInsightInput,
  validateAiInteractionInput,
  validatePreferencesInput,
  validateNotificationInput,
  LIMITS,
} from '../validation';

function tsMock(seconds = 1000) {
  return { seconds, nanoseconds: 0 };
}

const journalOk = {
  title: 'First entry',
  body: 'Body text',
  mode: 'morning',
  mood: 3,
  energy: 50,
  tags: ['work', 'focus'],
  location: { lat: 1, lng: 2, placeName: 'Home' },
  attachments: [],
  favorite: false,
  archived: false,
  private: false,
  aiMetadata: null,
};

describe('validation — journalEntries', () => {
  it('accepts a fully valid input', () => {
    expect(validateJournalEntryInput(journalOk).ok).toBe(true);
  });
  it('rejects unknown top-level fields (schema pollution)', () => {
    expect(validateJournalEntryInput({ ...journalOk, hacker: 'x' }).ok).toBe(false);
  });
  it('rejects a mode outside the enum', () => {
    expect(validateJournalEntryInput({ ...journalOk, mode: 'gibberish' }).ok).toBe(false);
  });
  it('rejects an oversized body', () => {
    expect(validateJournalEntryInput({ ...journalOk, body: 'x'.repeat(LIMITS.body + 1) }).ok).toBe(false);
  });
  it('allows null mood/energy and rejects out-of-range', () => {
    expect(validateJournalEntryInput({ ...journalOk, mood: null, energy: null }).ok).toBe(true);
    expect(validateJournalEntryInput({ ...journalOk, mood: 6 }).ok).toBe(false);
    expect(validateJournalEntryInput({ ...journalOk, energy: -1 }).ok).toBe(false);
  });
  it('rejects empty tags and non-string tags', () => {
    expect(validateJournalEntryInput({ ...journalOk, tags: [''] }).ok).toBe(false);
    expect(validateJournalEntryInput({ ...journalOk, tags: [42] }).ok).toBe(false);
  });
  it('validates nested attachments', () => {
    const goodAttach = [
      { id: 'a1', kind: 'image', url: 'https://cdn', caption: 'c', createdAt: tsMock() },
    ];
    expect(validateJournalEntryInput({ ...journalOk, attachments: goodAttach }).ok).toBe(true);
    expect(validateJournalEntryInput({ ...journalOk, attachments: [{ ...goodAttach[0], kind: 'hack' }] }).ok).toBe(false);
  });
  it('validates aiMetadata bundle', () => {
    expect(validateJournalEntryInput({ ...journalOk, aiMetadata: { summary: 's', suggestedTags: ['a'], emotion: 'calm' } }).ok).toBe(true);
    expect(validateJournalEntryInput({ ...journalOk, aiMetadata: { unknownKey: true } }).ok).toBe(false);
  });
});

describe('validation — memories', () => {
  const ok = {
    type: 'milestone',
    title: 'Launched',
    narrative: 'It shipped.',
    importance: 5,
    confidence: 0.9,
    sourceEntryIds: ['e1'],
    tags: ['work'],
    saved: false,
    occurredAt: tsMock(),
  };
  it('accepts valid memory', () => {
    expect(validateMemoryInput(ok).ok).toBe(true);
  });
  it('rejects invalid memory type', () => {
    expect(validateMemoryInput({ ...ok, type: 'fiction' }).ok).toBe(false);
  });
  it('rejects out-of-range importance/confidence', () => {
    expect(validateMemoryInput({ ...ok, importance: 7 }).ok).toBe(false);
    expect(validateMemoryInput({ ...ok, confidence: 2 }).ok).toBe(false);
  });
});

describe('validation — conversations', () => {
  const ok = {
    title: 'Chat',
    skill: 'reflect',
    messages: [
      { id: 'm1', role: 'user', content: 'hi', timestamp: tsMock(1) },
      { id: 'm2', role: 'model', content: 'hello', timestamp: tsMock(2) },
    ],
  };
  it('accepts valid conversation', () => {
    expect(validateConversationInput(ok).ok).toBe(true);
  });
  it('rejects bad skill', () => {
    expect(validateConversationInput({ ...ok, skill: 'sing' }).ok).toBe(false);
  });
  it('rejects a message with invalid role', () => {
    expect(
      validateConversationInput({
        ...ok,
        messages: [{ id: 'm1', role: 'system', content: 'x', timestamp: tsMock() }],
      }).ok,
    ).toBe(false);
  });
});

describe('validation — goals', () => {
  const ok = {
    title: 'Run a marathon',
    description: 'Train',
    status: 'active',
    progress: 25,
    targetDate: null,
    milestones: [{ id: 'm1', title: '5k', done: true }],
    relatedEntryIds: ['e1'],
    tags: ['fitness'],
  };
  it('accepts valid goal', () => {
    expect(validateGoalInput(ok).ok).toBe(true);
  });
  it('rejects progress out of range', () => {
    expect(validateGoalInput({ ...ok, progress: 120 }).ok).toBe(false);
  });
  it('rejects bad status', () => {
    expect(validateGoalInput({ ...ok, status: 'on-fire' }).ok).toBe(false);
  });
});

describe('validation — habits', () => {
  const ok = {
    name: 'Meditate',
    description: '',
    frequency: 'daily',
    daysOfWeek: [0, 1, 2],
    streak: 5,
    log: [{ date: tsMock(), done: true }],
  };
  it('accepts a valid habit', () => {
    expect(validateHabitInput(ok).ok).toBe(true);
  });
  it('rejects non-integer day of week', () => {
    expect(validateHabitInput({ ...ok, daysOfWeek: [1.5] }).ok).toBe(false);
  });
  it('rejects negative streak', () => {
    expect(validateHabitInput({ ...ok, streak: -1 }).ok).toBe(false);
  });
});

describe('validation — collections', () => {
  const ok = { name: 'Work', description: '', color: '#1f2d5a', entryIds: ['e1'] };
  it('accepts a valid collection', () => {
    expect(validateCollectionInput(ok).ok).toBe(true);
  });
  it('rejects a bad hex color', () => {
    expect(validateCollectionInput({ ...ok, color: 'red' }).ok).toBe(false);
  });
});

describe('validation — timelineEvents', () => {
  const ok = {
    type: 'milestone',
    title: 'Trip',
    description: '',
    occurredAt: tsMock(),
    year: 2026,
    month: 9,
    day: 5,
    source: null,
    tags: [],
  };
  it('accepts a valid timeline event', () => {
    expect(validateTimelineEventInput(ok).ok).toBe(true);
  });
  it('rejects out-of-range month', () => {
    expect(validateTimelineEventInput({ ...ok, month: 13 }).ok).toBe(false);
  });
});

describe('validation — insights', () => {
  const ok = {
    kind: 'weekly',
    title: 'Week 1',
    narrative: '',
    content: 'long',
    periodStart: tsMock(1),
    periodEnd: tsMock(2),
    themes: ['growth'],
    sourceIds: [],
    saved: false,
  };
  it('accepts a valid insight', () => {
    expect(validateInsightInput(ok).ok).toBe(true);
  });
});

describe('validation — aiInteractions', () => {
  const ok = {
    skill: 'ask-my-life',
    prompt: 'question',
    response: 'answer',
    contextRefs: [{ collection: 'journalEntries', docId: 'e1' }],
  };
  it('accepts a valid interaction', () => {
    expect(validateAiInteractionInput(ok).ok).toBe(true);
  });
  it('rejects a context ref with a bad doc id', () => {
    expect(
      validateAiInteractionInput({ ...ok, contextRefs: [{ collection: 'journalEntries', docId: 'a/b' }] }).ok,
    ).toBe(false);
  });
});

describe('validation — settings preferences', () => {
  const ok = {
    aiPreferences: {
      reflectionSuggestions: true,
      patternDetection: true,
      weeklySummaries: false,
      memorySuggestions: true,
      askBeforeSavingMemory: true,
      allowHistoricalContext: true,
    },
    writingAssistant: { suggestions: true, grammar: false, rewriting: false },
    notificationPreferences: { reflectionReminders: true, memorySuggestions: false, goalReminders: false },
    language: 'en',
    timezone: 'UTC',
  };
  it('accepts valid preferences', () => {
    expect(validatePreferencesInput(ok).ok).toBe(true);
  });
  it('rejects a non-boolean flag', () => {
    expect(validatePreferencesInput({ ...ok, aiPreferences: { ...ok.aiPreferences, reflectionSuggestions: 'yes' } }).ok).toBe(
      false,
    );
  });
});

describe('validation — notifications', () => {
  const ok = { kind: 'system', title: 'Hi', body: 'msg', data: null, read: false };
  it('accepts a valid notification', () => {
    expect(validateNotificationInput(ok).ok).toBe(true);
  });
});
