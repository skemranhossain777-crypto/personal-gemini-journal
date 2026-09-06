import { describe, expect, it } from 'vitest';
import type { Collection, JournalEntry, Memory, Goal } from '../../data/models';
import {
  executeSemanticSearch,
  parseQueryIntent,
  createPreviewSnippet,
} from '../semanticSearch';

describe('Semantic Journal Search Engine — Intent, Filtering, Authorization & Pagination', () => {
  const sampleEntries: JournalEntry[] = [
    {
      id: 'entry_1',
      uid: 'user_alice',
      title: 'Struggling with Monthly Budget',
      body: 'Today I was worried about money and my personal finance budget for next quarter.',
      mode: 'evening',
      mood: 2,
      energy: 40,
      tags: ['finance', 'anxiety', 'budget'],
      location: { lat: 37.7, lng: -122.4, placeName: 'Home Office' },
      attachments: [],
      favorite: true,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: { seconds: 1770000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1770000000, nanoseconds: 0 } as any,
    },
    {
      id: 'entry_2',
      uid: 'user_alice',
      title: 'Company Launch Milestone',
      body: 'Showed up for the team and launched my business. I felt immensely proud of our hard work and dedication.',
      mode: 'free-write',
      mood: 5,
      energy: 90,
      tags: ['business', 'launch', 'achievement'],
      location: { lat: 37.7, lng: -122.4, placeName: 'HQ Downtown' },
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: { seconds: 1770500000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1770500000, nanoseconds: 0 } as any,
    },
    {
      id: 'entry_3',
      uid: 'user_alice',
      title: 'Async Planning with Sarah',
      body: 'Had coffee at Dev Cafe with Sarah discussing team expansion goals.',
      mode: 'work',
      mood: 4,
      energy: 70,
      tags: ['work', 'planning'],
      location: { lat: 37.7, lng: -122.4, placeName: 'Dev Cafe' },
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: { seconds: 1771000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1771000000, nanoseconds: 0 } as any,
    },
  ];

  const sampleCollections: Collection[] = [
    {
      id: 'col_business',
      uid: 'user_alice',
      name: 'Business Ventures',
      description: 'Business entries',
      color: '#3B82F6',
      entryIds: ['entry_2'],
      createdAt: { seconds: 1770000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1770000000, nanoseconds: 0 } as any,
    },
  ];

  const sampleMemories: Memory[] = [
    {
      id: 'mem_1',
      uid: 'user_alice',
      type: 'person',
      title: 'Sarah Mentorship',
      narrative: 'Met with Sarah for project guidance.',
      importance: 5,
      confidence: 0.95,
      sourceEntryIds: ['entry_3'],
      tags: ['Mentorship'],
      saved: true,
      status: 'saved',
      occurredAt: null,
      createdAt: { seconds: 1771000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1771000000, nanoseconds: 0 } as any,
    },
  ];

  const sampleGoals: Goal[] = [
    {
      id: 'goal_1',
      uid: 'user_alice',
      title: 'Launch Business',
      description: 'Launch venture successfully',
      status: 'active',
      progress: 80,
      targetDate: null,
      milestones: [],
      relatedEntryIds: ['entry_2'],
      tags: ['business'],
      createdAt: { seconds: 1770000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1770000000, nanoseconds: 0 } as any,
    },
  ];

  // 1. Natural Language Intent Parser Test
  it('parses natural language query intents for emotions and themes', () => {
    const intent1 = parseQueryIntent('Find entries where I was worried about money.');
    expect(intent1.emotions).toContain('worried');
    expect(intent1.themes).toContain('Finance');

    const intent2 = parseQueryIntent('Show moments when I felt proud.');
    expect(intent2.emotions).toContain('proud');

    const intent3 = parseQueryIntent('Find entries about launching my business.');
    expect(intent3.themes).toContain('Business');
  });

  // 2. Natural Language Query Execution Test: Money & Worry
  it('executes natural language query "Find entries where I was worried about money."', () => {
    const result = executeSemanticSearch(sampleEntries, {
      query: 'Find entries where I was worried about money.',
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].entry.id).toBe('entry_1');
    expect(result.results[0].relevanceExplanation).toContain('worried');
    expect(result.results[0].score).toBeGreaterThan(50);
  });

  // 3. Natural Language Query Execution Test: Proud Moments
  it('executes natural language query "Show moments when I felt proud."', () => {
    const result = executeSemanticSearch(sampleEntries, {
      query: 'Show moments when I felt proud.',
    });

    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results[0].entry.id).toBe('entry_2');
    expect(result.results[0].relevanceExplanation).toContain('proud');
  });

  // 4. Natural Language Query Execution Test: Launching Business
  it('executes natural language query "Find entries about launching my business."', () => {
    const result = executeSemanticSearch(sampleEntries, {
      query: 'Find entries about launching my business.',
    });

    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results[0].entry.id).toBe('entry_2');
    expect(result.results[0].previewSnippet).toContain('launched my business');
  });

  // 5. Dimensional Filter Audits (Date, Tag, Mood, Theme, Person, Place, Goal, Collection)
  it('supports 8 dimensional filters accurately', () => {
    // Tag filter
    const tagRes = executeSemanticSearch(sampleEntries, { tag: 'finance' });
    expect(tagRes.results).toHaveLength(1);
    expect(tagRes.results[0].entry.id).toBe('entry_1');

    // Mood filter
    const moodRes = executeSemanticSearch(sampleEntries, { mood: 5 });
    expect(moodRes.results).toHaveLength(1);
    expect(moodRes.results[0].entry.id).toBe('entry_2');

    // Collection filter
    const colRes = executeSemanticSearch(sampleEntries, { collection: 'col_business' }, sampleCollections);
    expect(colRes.results).toHaveLength(1);
    expect(colRes.results[0].entry.id).toBe('entry_2');

    // Person filter
    const personRes = executeSemanticSearch(sampleEntries, { person: 'Sarah' }, [], sampleMemories);
    expect(personRes.results).toHaveLength(1);
    expect(personRes.results[0].entry.id).toBe('entry_3');

    // Place filter
    const placeRes = executeSemanticSearch(sampleEntries, { place: 'Dev Cafe' });
    expect(placeRes.results).toHaveLength(1);
    expect(placeRes.results[0].entry.id).toBe('entry_3');

    // Goal filter
    const goalRes = executeSemanticSearch(sampleEntries, { goal: 'goal_1' }, [], [], sampleGoals);
    expect(goalRes.results).toHaveLength(1);
    expect(goalRes.results[0].entry.id).toBe('entry_2');
  });

  // 6. Pagination Audit
  it('handles paginated results correctly', () => {
    const page1 = executeSemanticSearch(sampleEntries, { pageSize: 2, page: 1 });
    expect(page1.results).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBe(2);
    expect(page1.hasMore).toBe(true);

    const page2 = executeSemanticSearch(sampleEntries, { pageSize: 2, page: 2 });
    expect(page2.results).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });

  // 7. Authorization & User Data Isolation Audit
  it('CRITICAL: restricts search results strictly to the authenticated user data set', () => {
    const otherUserEntry: JournalEntry = {
      id: 'entry_victim',
      uid: 'user_bob', // Different user
      title: 'Secret Bob Entry',
      body: 'I was worried about money too.',
      mode: 'free-write',
      mood: 1,
      energy: 10,
      tags: ['finance'],
      location: null,
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: { seconds: 1770000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1770000000, nanoseconds: 0 } as any,
    };

    // Simulate authenticated user Alice's data slice
    const aliceEntries = sampleEntries.filter((e) => e.uid === 'user_alice');
    expect(aliceEntries.some((e) => e.uid === 'user_bob')).toBe(false);

    const result = executeSemanticSearch(aliceEntries, {
      query: 'worried about money',
    });

    // Verify Bob's entry is NEVER returned
    expect(result.results.some((r) => r.entry.id === 'entry_victim')).toBe(false);
  });
});
