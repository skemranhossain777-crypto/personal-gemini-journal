import type { JournalEntry } from '../data';
import type { Memory } from '../data/models';

/**
 * Competition Demo Environment & Safety Boundary Manager
 *
 * Rules:
 * 1. Demo data NEVER mixes with real user Firestore data. Demo users (isDemo: true)
 *    are scoped strictly to isolated local storage buckets (`gemini_journal_entries_demo_*`, etc.).
 * 2. Every demo item carries an explicit `[DEMO SAMPLE]` tag or `isDemoData: true` metadata flag.
 * 3. The demonstration is 100% repeatable via `resetDemoEnvironment()`.
 */

export interface DemoStepInfo {
  stepNumber: number;
  id: string;
  title: string;
  targetDurationSeconds: number;
  description: string;
  speakingPoint: string;
  actionGuidance: string;
}

export const DEMO_PIPELINE_STEPS: DemoStepInfo[] = [
  {
    stepNumber: 1,
    id: 'sign-in',
    title: 'Sign In / Instant Demo Launch',
    targetDurationSeconds: 20,
    description: 'Launch Instant Demo mode as Guest Explorer with local sandbox isolation.',
    speakingPoint: 'JOURNAL∞ isolates demo sessions entirely client-side. Zero demo data touches production Firestore collections.',
    actionGuidance: 'Click "🏆 Try Instant Demo (5-Min Tour)" on the landing page or header.',
  },
  {
    stepNumber: 2,
    id: 'create-entry',
    title: 'Create Journal Entry',
    targetDurationSeconds: 40,
    description: 'Compose a new entry using Free Write or structured Morning/Evening modes.',
    speakingPoint: 'The editor features continuous 500ms autosave, local crash recovery, and rich metadata tracking (mood, energy, tags, location).',
    actionGuidance: 'Click "+ New Entry", select "morning" or "free-write" mode, and write about an engineering milestone.',
  },
  {
    stepNumber: 3,
    id: 'gemini-reflection',
    title: 'Gemini AI Reflection',
    targetDurationSeconds: 45,
    description: 'Trigger real-time AI reflection on the journal entry.',
    speakingPoint: 'Gemini 2.5 Flash analyzes emotional tone, extracts core themes, flags unconscious patterns, and delivers actionable advice.',
    actionGuidance: 'Click "✨ Gemini AI Reflection" in the entry side panel and inspect the structured reflection dimensions.',
  },
  {
    stepNumber: 4,
    id: 'memory-candidate',
    title: 'Memory Candidate Proposal',
    targetDurationSeconds: 35,
    description: 'Extract typed memory candidates without auto-saving.',
    speakingPoint: 'Crucial security feature: AI candidate extractions are un-saved proposals (saved: false). The AI never mutates your personal memory without approval.',
    actionGuidance: 'Observe the proposed memory candidate badge in the Memory Engine under "Unreviewed Candidates".',
  },
  {
    stepNumber: 5,
    id: 'approve-memory',
    title: 'Approve Memory',
    targetDurationSeconds: 25,
    description: 'Review, edit, and approve candidate memory into personal memory store.',
    speakingPoint: 'Approving converts the candidate into a permanent personal memory with normalized 1-5 importance ratings.',
    actionGuidance: 'Click "Approve & Save" on the memory candidate card.',
  },
  {
    stepNumber: 6,
    id: 'ask-my-life',
    title: 'Ask My Life RAG Query',
    targetDurationSeconds: 45,
    description: 'Query personal life history using RAG contextual retrieval.',
    speakingPoint: 'Ask My Life compresses user context under 12,000 characters and queries Gemini using strict system-prompt isolation.',
    actionGuidance: 'Navigate to "Ask My Life" and click the sample question: "What milestone did we achieve today with Gemini?".',
  },
  {
    stepNumber: 7,
    id: 'evidence-answer',
    title: 'Evidence-Backed Answer & Citations',
    targetDurationSeconds: 35,
    description: 'Inspect grounded AI response with exact entry quotes and timestamps.',
    speakingPoint: 'Gemini outputs verified evidence citations. If a fact is missing from the journal, it reports insufficient evidence rather than hallucinating.',
    actionGuidance: 'Review the evidence quotes and citation tags under the AI response card.',
  },
  {
    stepNumber: 8,
    id: 'timeline',
    title: 'Life Timeline Overview',
    targetDurationSeconds: 30,
    description: 'Explore chronological event cards and memory milestones on the timeline.',
    speakingPoint: 'The Life Timeline automatically plots entries and approved memories into a searchable life history.',
    actionGuidance: 'Navigate to "Life Timeline", filter by year/milestone, and click an event card to view source entry context.',
  },
  {
    stepNumber: 9,
    id: 'privacy-center',
    title: 'Privacy Center & OWASP Defense',
    targetDurationSeconds: 25,
    description: 'Inspect privacy rules, prompt injection immunity, and data export/wipe.',
    speakingPoint: 'Complete user ownership: 1-click JSON/MD exports, OWASP prompt injection defenses with <RETRIEVED_CONTENT> XML isolation, and full account wipe.',
    actionGuidance: 'Navigate to "Privacy Center", review the isolation metrics, and inspect the OWASP security checklist.',
  },
];

const createTs = (daysAgo: number) => ({
  seconds: Math.floor((Date.now() - 86400000 * daysAgo) / 1000),
  nanoseconds: 0,
});

// Baseline repeatable demo entries
export const DEMO_SAMPLE_ENTRIES: Omit<JournalEntry, 'id' | 'uid'>[] = [
  {
    title: '🚀 Launching JOURNAL∞ with Gemini 2.5 Architecture',
    body: 'Today we finalized the core architecture for JOURNAL∞ on Google Cloud Run. The integration of Gemini 2.5 Flash allows 1M token context windows, structured JSON schema parsing, and sub-second RAG retrieval. Our team solved the context compression challenge by capping prompt context at 12k characters while preserving evidence citations.',
    mode: 'work',
    mood: 5,
    energy: 100,
    tags: ['[DEMO SAMPLE]', 'milestone', 'gemini-2.5', 'cloud-run', 'architecture'],
    location: { placeName: 'Google Cloud HQ / Dev Studio', lat: 37.422, lng: -122.084 },
    attachments: [],
    favorite: true,
    archived: false,
    private: false,
    aiMetadata: {
      summary: 'Engineered JOURNAL∞ on Cloud Run with Gemini 2.5 Flash RAG context compression.',
      suggestedTags: ['cloud-run', 'architecture', 'gemini-2.5'],
      emotion: 'Optimistic & Highly Focused',
      generatedBy: 'gemini-3.7-flash',
    },
    createdAt: createTs(2) as JournalEntry['createdAt'],
    updatedAt: createTs(2) as JournalEntry['updatedAt'],
  },
  {
    title: '🌿 Morning Reflection: High Energy & Goal Focus',
    body: 'Started the morning with a 30-minute walk and meditation. Reflecting on my personal goal to maintain physical energy while building high-performance AI tools. Noticed that sleeping 8 hours directly correlates with +2 points higher energy score during complex coding tasks.',
    mode: 'morning',
    mood: 4,
    energy: 90,
    tags: ['[DEMO SAMPLE]', 'wellness', 'habits', 'morning-routine'],
    location: { placeName: 'Palo Alto Trail', lat: 37.4419, lng: -122.143 },
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: createTs(1) as JournalEntry['createdAt'],
    updatedAt: createTs(1) as JournalEntry['updatedAt'],
  },
];

// Baseline repeatable demo memories
export const DEMO_SAMPLE_MEMORIES: Partial<Memory>[] = [
  {
    id: 'demo-memory-1',
    uid: 'demo-local-user',
    type: 'milestone',
    title: '[DEMO SAMPLE] Launched JOURNAL∞ on Google Cloud Run',
    narrative: 'Successfully deployed production container to Google Cloud Run with Gemini 2.5 Flash integration.',
    importance: 5,
    confidence: 0.99,
    sourceEntryIds: ['demo-entry-1'],
    tags: ['[DEMO SAMPLE]', 'milestone', 'cloud-run'],
    saved: true,
    status: 'saved',
    occurredAt: createTs(2) as Memory['occurredAt'],
    createdAt: createTs(2) as Memory['createdAt'],
    updatedAt: createTs(2) as Memory['updatedAt'],
  },
  {
    id: 'demo-memory-2',
    uid: 'demo-local-user',
    type: 'idea',
    title: '[DEMO SAMPLE] 8-Hour Sleep Boosts Daily Energy Score',
    narrative: 'Noticed strong correlation between 8 hours of sleep and high energy scores during intense technical tasks.',
    importance: 4,
    confidence: 0.92,
    sourceEntryIds: ['demo-entry-2'],
    tags: ['[DEMO SAMPLE]', 'habit', 'wellness'],
    saved: false,
    status: 'candidate',
    occurredAt: createTs(1) as Memory['occurredAt'],
    createdAt: createTs(1) as Memory['createdAt'],
    updatedAt: createTs(1) as Memory['updatedAt'],
  },
];

/**
 * Checks if the demo environment is initialized and seeds baseline sample entries if empty.
 */
export function seedDemoEnvironment(uid: string = 'demo-local-user'): void {
  if (typeof localStorage === 'undefined') return;

  const entriesKey = `gemini_journal_entries_demo_${uid}`;
  const memoriesKey = `gemini_memories_demo_${uid}`;

  try {
    const existingEntries = localStorage.getItem(entriesKey);
    if (!existingEntries || JSON.parse(existingEntries).length === 0) {
      const formattedEntries: JournalEntry[] = DEMO_SAMPLE_ENTRIES.map((e, index) => ({
        ...e,
        id: `demo-entry-${index + 1}`,
        uid,
      }));
      localStorage.setItem(entriesKey, JSON.stringify(formattedEntries));
    }

    const existingMemories = localStorage.getItem(memoriesKey);
    if (!existingMemories || JSON.parse(existingMemories).length === 0) {
      localStorage.setItem(memoriesKey, JSON.stringify(DEMO_SAMPLE_MEMORIES));
    }
  } catch (err) {
    console.warn('[DemoEnvironment] Failed to seed local demo storage:', err);
  }
}

/**
 * Resets the demo environment back to pristine baseline sample state.
 * Allows judges and presenters to re-run the 9-step demo repeatably.
 */
export function resetDemoEnvironment(uid: string = 'demo-local-user'): void {
  if (typeof localStorage === 'undefined') return;

  const entriesKey = `gemini_journal_entries_demo_${uid}`;
  const memoriesKey = `gemini_memories_demo_${uid}`;

  try {
    localStorage.removeItem(entriesKey);
    localStorage.removeItem(memoriesKey);
    seedDemoEnvironment(uid);
  } catch (err) {
    console.warn('[DemoEnvironment] Reset failed:', err);
  }
}
