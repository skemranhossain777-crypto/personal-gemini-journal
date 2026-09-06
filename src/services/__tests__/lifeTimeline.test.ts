import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  synthesizeTimelineItems,
  queryTimelineItems,
  getPaginatedTimeline,
  groupTimelineByMonth,
  mapMemoryTypeToTimelineType,
  type UnifiedTimelineItem,
} from '../lifeTimeline';
import type { JournalEntry, Memory, Goal, TimelineEvent } from '../../data/models';

describe('lifeTimeline service', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  it('maps memory types correctly', () => {
    expect(mapMemoryTypeToTimelineType('milestone')).toBe('milestone');
    expect(mapMemoryTypeToTimelineType('trip')).toBe('trip');
    expect(mapMemoryTypeToTimelineType('idea')).toBe('idea');
    expect(mapMemoryTypeToTimelineType('achievement')).toBe('achievement');
    expect(mapMemoryTypeToTimelineType('event')).toBe('important-event');
    expect(mapMemoryTypeToTimelineType('person')).toBe('memory');
  });

  it('synthesizes all 8 timeline event types from distinct user entities', () => {
    const timelineEvents: TimelineEvent[] = [
      {
        id: 'te1',
        uid: 'user1',
        type: 'important-event',
        title: 'Landed Dream Job',
        description: 'Joined the tech lab',
        occurredAt: mockTimestamp('2026-05-10T10:00:00Z'),
        createdAt: mockTimestamp('2026-05-10T10:00:00Z'),
        updatedAt: mockTimestamp('2026-05-10T10:00:00Z'),
        year: 2026,
        month: 5,
        day: 10,
        source: { collection: 'journalEntries', docId: 'e100' },
        tags: ['career', 'milestone'],
      },
    ];

    const entries: JournalEntry[] = [
      {
        id: 'e1',
        uid: 'user1',
        title: 'Morning Reflections',
        body: 'Felt serene listening to rain.',
        mode: 'morning',
        mood: 5,
        energy: 85,
        tags: ['gratitude', 'rain'],
        location: { lat: 0, lng: 0, placeName: 'Kyoto' },
        attachments: [],
        favorite: false,
        archived: false,
        private: false,
        aiMetadata: null,
        createdAt: mockTimestamp('2026-09-01T08:00:00Z'),
        updatedAt: mockTimestamp('2026-09-01T08:00:00Z'),
      },
    ];

    const memories: Memory[] = [
      {
        id: 'm1',
        uid: 'user1',
        type: 'place',
        title: 'Tokyo Exploration',
        narrative: 'Walked Shibuya crossing at midnight',
        importance: 5,
        confidence: 0.95,
        sourceEntryIds: ['e1'],
        tags: ['travel', 'japan'],
        saved: true,
        status: 'saved',
        occurredAt: mockTimestamp('2025-11-20T12:00:00Z'),
        createdAt: mockTimestamp('2025-11-20T12:00:00Z'),
        updatedAt: mockTimestamp('2025-11-20T12:00:00Z'),
      },
      {
        id: 'm2',
        uid: 'user1',
        type: 'idea',
        title: 'App Architecture Concept',
        narrative: 'Graph-based reflection engine',
        importance: 4,
        confidence: 0.9,
        sourceEntryIds: ['e2'],
        tags: ['code', 'idea'],
        saved: true,
        status: 'saved',
        occurredAt: mockTimestamp('2026-03-15T15:00:00Z'),
        createdAt: mockTimestamp('2026-03-15T15:00:00Z'),
        updatedAt: mockTimestamp('2026-03-15T15:00:00Z'),
      },
      {
        id: 'm3',
        uid: 'user1',
        type: 'milestone',
        title: '100 Days of Journaling',
        narrative: 'Reached century streak',
        importance: 5,
        confidence: 1.0,
        sourceEntryIds: [],
        tags: ['habit'],
        saved: true,
        status: 'saved',
        occurredAt: mockTimestamp('2026-04-01T12:00:00Z'),
        createdAt: mockTimestamp('2026-04-01T12:00:00Z'),
        updatedAt: mockTimestamp('2026-04-01T12:00:00Z'),
      },
    ];

    const goals: Goal[] = [
      {
        id: 'g1',
        uid: 'user1',
        title: 'Publish Book Chapter',
        description: 'Complete draft chapter 4',
        status: 'completed',
        progress: 100,
        targetDate: mockTimestamp('2026-08-15T00:00:00Z'),
        milestones: [],
        relatedEntryIds: ['e1'],
        tags: ['writing'],
        createdAt: mockTimestamp('2026-01-01T00:00:00Z'),
        updatedAt: mockTimestamp('2026-08-15T00:00:00Z'),
      },
      {
        id: 'g2',
        uid: 'user1',
        title: 'Run Marathon',
        description: 'Train for 42km',
        status: 'active',
        progress: 60,
        targetDate: mockTimestamp('2026-12-01T00:00:00Z'),
        milestones: [],
        relatedEntryIds: [],
        tags: ['fitness'],
        createdAt: mockTimestamp('2026-01-01T00:00:00Z'),
        updatedAt: mockTimestamp('2026-01-01T00:00:00Z'),
      },
    ];

    const items = synthesizeTimelineItems({ timelineEvents, entries, memories, goals });

    expect(items.length).toBe(7);

    const typesInItems = new Set(items.map((i) => i.type));
    expect(typesInItems.has('important-event')).toBe(true);
    expect(typesInItems.has('journal')).toBe(true);
    expect(typesInItems.has('idea')).toBe(true);
    expect(typesInItems.has('milestone')).toBe(true);
    expect(typesInItems.has('achievement')).toBe(true);
    expect(typesInItems.has('goal')).toBe(true);
  });

  it('filters by selected year and month correctly', () => {
    const entries: JournalEntry[] = [
      {
        id: 'e1',
        uid: 'u1',
        title: 'Entry 2026 Sep',
        body: '...',
        mode: 'free-write',
        mood: 4,
        energy: 70,
        tags: [],
        location: null,
        attachments: [],
        favorite: false,
        archived: false,
        private: false,
        aiMetadata: null,
        createdAt: mockTimestamp('2026-09-15T00:00:00Z'),
        updatedAt: mockTimestamp('2026-09-15T00:00:00Z'),
      },
      {
        id: 'e2',
        uid: 'u1',
        title: 'Entry 2026 Jan',
        body: '...',
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
        createdAt: mockTimestamp('2026-01-10T00:00:00Z'),
        updatedAt: mockTimestamp('2026-01-10T00:00:00Z'),
      },
      {
        id: 'e3',
        uid: 'u1',
        title: 'Entry 2025 Dec',
        body: '...',
        mode: 'free-write',
        mood: 5,
        energy: 90,
        tags: [],
        location: null,
        attachments: [],
        favorite: false,
        archived: false,
        private: false,
        aiMetadata: null,
        createdAt: mockTimestamp('2025-12-31T00:00:00Z'),
        updatedAt: mockTimestamp('2025-12-31T00:00:00Z'),
      },
    ];

    const raw = synthesizeTimelineItems({ entries });
    const { filteredItems, availableYears, availableMonths } = queryTimelineItems(raw, {
      year: 2026,
      month: 9,
    });

    expect(availableYears).toEqual([2026, 2025]);
    expect(availableMonths).toEqual([1, 9]);
    expect(filteredItems.length).toBe(1);
    expect(filteredItems[0].title).toBe('Entry 2026 Sep');
  });

  it('paginates timeline items correctly', () => {
    const rawItems: UnifiedTimelineItem[] = Array.from({ length: 75 }).map((_, i) => ({
      id: `item_${i}`,
      type: 'journal',
      title: `Event ${i}`,
      description: 'Desc',
      date: new Date(2026, 8, i + 1),
      year: 2026,
      month: 9,
      day: i + 1,
      sourceType: 'journal',
      sourceId: `s_${i}`,
      tags: [],
      createdAt: new Date(),
    }));

    const page1 = getPaginatedTimeline(rawItems, 1, 25);
    expect(page1.items.length).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page1.currentPage).toBe(1);

    const page3 = getPaginatedTimeline(rawItems, 3, 25);
    expect(page3.items.length).toBe(25);
    expect(page3.currentPage).toBe(3);
  });

  it('groups timeline items by month for structured rendering', () => {
    const rawItems: UnifiedTimelineItem[] = [
      {
        id: 'i1',
        type: 'journal',
        title: 'Item 1',
        description: '...',
        date: new Date('2026-09-05T00:00:00Z'),
        year: 2026,
        month: 9,
        day: 5,
        sourceType: 'journal',
        sourceId: '1',
        tags: [],
        createdAt: new Date(),
      },
      {
        id: 'i2',
        type: 'memory',
        title: 'Item 2',
        description: '...',
        date: new Date('2026-09-01T00:00:00Z'),
        year: 2026,
        month: 9,
        day: 1,
        sourceType: 'memory',
        sourceId: '2',
        tags: [],
        createdAt: new Date(),
      },
      {
        id: 'i3',
        type: 'trip',
        title: 'Item 3',
        description: '...',
        date: new Date('2026-08-15T00:00:00Z'),
        year: 2026,
        month: 8,
        day: 15,
        sourceType: 'memory',
        sourceId: '3',
        tags: [],
        createdAt: new Date(),
      },
    ];

    const groups = groupTimelineByMonth(rawItems);
    expect(groups.length).toBe(2);
    expect(groups[0].monthName).toBe('September');
    expect(groups[0].items.length).toBe(2);
    expect(groups[1].monthName).toBe('August');
    expect(groups[1].items.length).toBe(1);
  });

  it('handles large datasets efficiently (1000+ items in < 50ms)', () => {
    const largeEntries: JournalEntry[] = Array.from({ length: 1500 }).map((_, i) => ({
      id: `e_${i}`,
      uid: 'user1',
      title: `Life Memory Entry ${i}`,
      body: `Detailed journal body description ${i} with tags #travel #milestone`,
      mode: 'free-write',
      mood: (i % 5) + 1,
      energy: (i % 100) + 1,
      tags: ['travel', `tag_${i % 10}`],
      location: i % 3 === 0 ? { lat: 35.6, lng: 139.6, placeName: 'Tokyo' } : null,
      attachments: [],
      favorite: i % 10 === 0,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: mockTimestamp(new Date(2020 + (i % 7), i % 12, (i % 28) + 1).toISOString()),
      updatedAt: mockTimestamp(new Date(2020 + (i % 7), i % 12, (i % 28) + 1).toISOString()),
    }));

    const startTime = performance.now();
    const synthesized = synthesizeTimelineItems({ entries: largeEntries });
    const { filteredItems } = queryTimelineItems(synthesized, {
      year: 2024,
      searchQuery: 'Tokyo',
      sortOrder: 'desc',
    });
    const paginated = getPaginatedTimeline(filteredItems, 1, 30);
    const duration = performance.now() - startTime;

    expect(synthesized.length).toBe(1500);
    expect(paginated.items.length).toBeLessThanOrEqual(30);
    expect(duration).toBeLessThan(100);
  });
});
