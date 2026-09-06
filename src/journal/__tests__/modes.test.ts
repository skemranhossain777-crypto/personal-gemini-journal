import { describe, expect, it } from 'vitest';
import type { ReflectionMode } from '../../data';
import {
  ALL_JOURNAL_MODES,
  JOURNAL_MODE_DEFINITIONS,
  getJournalMode,
  getModePlaceholder,
  getModePrompts,
} from '../modes';

const REQUIRED_MODES: ReflectionMode[] = [
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

describe('Journal Modes & Prompt Definitions', () => {
  it('defines all 10 required journal modes with non-empty prompts and placeholders', () => {
    expect(ALL_JOURNAL_MODES).toHaveLength(10);

    for (const modeId of REQUIRED_MODES) {
      const modeDef = JOURNAL_MODE_DEFINITIONS[modeId];
      expect(modeDef).toBeDefined();
      expect(modeDef.id).toBe(modeId);
      expect(modeDef.name).toBeTruthy();
      expect(modeDef.description).toBeTruthy();
      expect(modeDef.placeholder).toBeTruthy();
      expect(modeDef.iconName).toBeTruthy();
      expect(Array.isArray(modeDef.prompts)).toBe(true);
      expect(modeDef.prompts.length).toBeGreaterThan(0);

      for (const prompt of modeDef.prompts) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.question).toBeTruthy();
      }
    }
  });

  it('retrieves mode definition via getJournalMode and falls back to free-write for invalid inputs', () => {
    const morning = getJournalMode('morning');
    expect(morning.id).toBe('morning');
    expect(morning.name).toBe('Morning Reflection');

    const invalid = getJournalMode('nonexistent' as ReflectionMode);
    expect(invalid.id).toBe('free-write');

    const nullMode = getJournalMode(null);
    expect(nullMode.id).toBe('free-write');
  });

  it('returns mode prompts via getModePrompts', () => {
    const gratitudePrompts = getModePrompts('gratitude');
    expect(gratitudePrompts.length).toBeGreaterThan(0);
    expect(gratitudePrompts[0].question).toContain('joy');
  });

  it('returns mode placeholder via getModePlaceholder', () => {
    const travelPlaceholder = getModePlaceholder('travel');
    expect(travelPlaceholder).toContain('travel');

    const freeWritePlaceholder = getModePlaceholder('free-write');
    expect(freeWritePlaceholder).toContain('freely');
  });
});
