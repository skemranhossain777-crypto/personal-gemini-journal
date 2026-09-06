import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  generateJsonExport,
  generateMarkdownExport,
  generateCsvExport,
  exportJournalDataAsync,
  verifyExportIntegrity,
  sanitizeCsvField,
  ExportError,
} from '../dataExportService';
import type { JournalEntry, Memory, Goal } from '../../data/models';

describe('dataExportService multi-format export & security rules', () => {
  const mockEntry1: JournalEntry = {
    id: 'entry_1',
    uid: 'user1',
    title: 'Morning Reflection',
    body: 'Felt calm and inspired. Planned tasks for today.',
    mode: 'morning',
    mood: 5,
    energy: 90,
    tags: ['calm', 'planning'],
    location: { placeName: 'Tokyo Coffee Shop', lat: 35.68, lng: 139.76 },
    attachments: [],
    favorite: true,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockEntryMaliciousCsv: JournalEntry = {
    id: 'entry_2',
    uid: 'user1',
    title: '=cmd| " /C calc"!A0', // Potential CSV injection payload
    body: '@SUM(1+1)',
    mode: 'free-write',
    mood: 3,
    energy: 50,
    tags: [],
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
    type: 'place',
    title: 'Tokyo Coffee Shop',
    narrative: 'Favorite quiet spot for morning writing',
    importance: 4,
    confidence: 0.9,
    sourceEntryIds: ['entry_1'],
    tags: ['coffee'],
    saved: true,
    occurredAt: Timestamp.fromDate(new Date()),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockGoal: Goal = {
    id: 'goal_1',
    uid: 'user1',
    title: 'Write Daily',
    description: 'Maintain 30-day journaling streak',
    status: 'active',
    progress: 50,
    targetDate: null,
    milestones: [],
    relatedEntryIds: ['entry_1'],
    tags: ['habit'],
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('generates valid JSON export payload strictly excluding other user data and credentials', () => {
    const foreignEntry: JournalEntry = { ...mockEntry1, id: 'foreign_1', uid: 'user2' };
    const jsonStr = generateJsonExport({
      entries: [mockEntry1, foreignEntry],
      memories: [mockMemory],
      goals: [mockGoal],
      habits: [],
      currentUserId: 'user1',
    });

    const parsed = JSON.parse(jsonStr);
    expect(parsed.userId).toBe('user1');
    expect(parsed.counts.journalEntries).toBe(1);
    expect(parsed.journalEntries.some((e: any) => e.id === 'foreign_1')).toBe(false);
    expect(jsonStr).not.toContain('secret');
    expect(jsonStr).not.toContain('api_key');
  });

  it('generates well-formatted Markdown document archive', () => {
    const md = generateMarkdownExport({
      entries: [mockEntry1],
      memories: [mockMemory],
      goals: [mockGoal],
      currentUserId: 'user1',
    });

    expect(md).toContain('# JOURNAL∞ Personal Life Archive');
    expect(md).toContain('### 1. Morning Reflection');
    expect(md).toContain('- **Location:** Tokyo Coffee Shop');
    expect(md).toContain('## 🧠 Personal Memories');
    expect(md).toContain('## 🎯 Personal Goals');
  });

  it('sanitizes CSV fields and prevents CSV formula injection attacks', () => {
    expect(sanitizeCsvField('=1+1')).toBe(`"\'=1+1"`);
    expect(sanitizeCsvField('@cmd')).toBe(`"\'@cmd"`);
    expect(sanitizeCsvField('Normal Text')).toBe(`"Normal Text"`);
  });

  it('generates safe CSV export with formula escaping', () => {
    const csv = generateCsvExport({
      entries: [mockEntry1, mockEntryMaliciousCsv],
      currentUserId: 'user1',
    });

    expect(csv).toContain('"ID","Title","Date"');
    expect(csv).toContain('"Morning Reflection"');
    // Formula payload escaped with leading single quote
    expect(csv).toContain(`"\'=cmd| "" /C calc""!A0"`);
  });

  it('handles async chunked export processing for large journals', async () => {
    const largeEntriesArray: JournalEntry[] = Array.from({ length: 60 }, (_, i) => ({
      ...mockEntry1,
      id: `entry_${i}`,
    }));

    const progressPcts: number[] = [];
    const result = await exportJournalDataAsync({
      entries: largeEntriesArray,
      currentUserId: 'user1',
      format: 'json',
      onProgress: (pct) => progressPcts.push(pct),
    });

    expect(result.itemCount).toBe(60);
    expect(result.mimeType).toBe('application/json');
    expect(progressPcts.length).toBeGreaterThan(1);
    expect(progressPcts[progressPcts.length - 1]).toBe(100);
  });

  it('verifies export content integrity across formats', () => {
    const jsonStr = generateJsonExport({
      entries: [mockEntry1],
      memories: [mockMemory],
      goals: [mockGoal],
      habits: [],
      currentUserId: 'user1',
    });
    expect(verifyExportIntegrity(jsonStr, 'json')).toBe(true);
    expect(verifyExportIntegrity('{ invalid json', 'json')).toBe(false);

    const md = generateMarkdownExport({
      entries: [mockEntry1],
      memories: [],
      goals: [],
      currentUserId: 'user1',
    });
    expect(verifyExportIntegrity(md, 'markdown')).toBe(true);

    const csv = generateCsvExport({
      entries: [mockEntry1],
      currentUserId: 'user1',
    });
    expect(verifyExportIntegrity(csv, 'csv')).toBe(true);
  });
});
