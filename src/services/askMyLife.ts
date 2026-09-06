import type { JournalEntry, Memory, Goal, TimelineEvent } from '../data/models';
import type { AskMyLifeInput, AskMyLifeOutput, ContextDocument } from '../../server/gemini/types';
import { authService } from './auth';

export interface AskMyLifeQueryOptions {
  question: string;
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  timelineEvents?: TimelineEvent[];
}

/**
 * Client-Side Contextual Retrieval & Intent Detection Engine for Ask My Life
 * CRITICAL RULE: Never sends the entire database. Performs intent detection, date filtering,
 * relevance ranking, and context compression to send only relevant user-owned documents.
 */

interface ScoredDoc {
  doc: ContextDocument;
  score: number;
}

export function detectQueryIntent(question: string): {
  intents: Array<'happiness' | 'goals' | 'challenges' | 'projects' | 'timeline' | 'general'>;
  dateBounds?: { startDate?: string; endDate?: string };
} {
  const q = question.toLowerCase();
  const intents: Array<'happiness' | 'goals' | 'challenges' | 'projects' | 'timeline' | 'general'> = [];

  if (/happy|happiest|joy|proud|gratitude|celebrate|highlight|best|smile/i.test(q)) {
    intents.push('happiness');
  }
  if (/goal|postpone|delay|target|milestone|future|plan/i.test(q)) {
    intents.push('goals');
  }
  if (/challenge|struggle|difficult|hard|problem|frustrat|stuck|obstacle/i.test(q)) {
    intents.push('challenges');
  }
  if (/project|work|build|code|launch|dev|architecture|system/i.test(q)) {
    intents.push('projects');
  }
  if (/when|date|last write|first time|timeline|history|recent|this year|last month/i.test(q)) {
    intents.push('timeline');
  }

  if (intents.length === 0) {
    intents.push('general');
  }

  // Date filtering heuristic
  let dateBounds: { startDate?: string; endDate?: string } | undefined;
  const currentYear = new Date().getFullYear();

  if (q.includes('this year')) {
    dateBounds = { startDate: `${currentYear}-01-01` };
  } else if (q.includes('last year')) {
    dateBounds = { startDate: `${currentYear - 1}-01-01`, endDate: `${currentYear - 1}-12-31` };
  }

  return { intents, dateBounds };
}

export function scoreAndRankDocuments(
  question: string,
  allDocs: ContextDocument[],
  intents: string[]
): ContextDocument[] {
  const queryTerms = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['what', 'when', 'how', 'show', 'tell', 'have', 'been', 'this', 'that', 'with', 'from'].includes(t));

  const scoredDocs: ScoredDoc[] = allDocs.map((doc) => {
    let score = 0;
    const docText = `${doc.title} ${doc.content} ${(doc.tags || []).join(' ')}`.toLowerCase();

    // 1. Keyword match scoring
    for (const term of queryTerms) {
      if (docText.includes(term)) {
        score += 3;
        // Extra weight if term appears in title
        if (doc.title.toLowerCase().includes(term)) {
          score += 5;
        }
      }
    }

    // 2. Intent-based scoring boost
    if (intents.includes('happiness')) {
      if (docText.includes('happy') || docText.includes('proud') || docText.includes('gratitude') || docText.includes('accomplish')) {
        score += 4;
      }
    }
    if (intents.includes('goals')) {
      if (doc.type === 'goal' || docText.includes('goal') || docText.includes('postponed') || docText.includes('target')) {
        score += 4;
      }
    }
    if (intents.includes('challenges')) {
      if (docText.includes('challenge') || docText.includes('difficult') || docText.includes('struggle') || docText.includes('obstacle')) {
        score += 4;
      }
    }

    return { doc, score };
  });

  // Filter out completely irrelevant docs (score === 0) unless query was very short
  const relevantScored = scoredDocs.filter((d) => d.score > 0 || queryTerms.length === 0);

  // Sort descending by relevance score
  relevantScored.sort((a, b) => b.score - a.score);

  // Context Compression & Token Limit Enforcement: Max 15 top documents / 12,000 characters
  const selectedDocs: ContextDocument[] = [];
  let currentLength = 0;

  for (const item of relevantScored) {
    const docLen = item.doc.content.length + item.doc.title.length + 50;
    if (currentLength + docLen > 12000 || selectedDocs.length >= 15) {
      break;
    }
    selectedDocs.push(item.doc);
    currentLength += docLen;
  }

  return selectedDocs;
}

function formatDate(ts: unknown): string {
  if (!ts) return '';
  if (typeof ts === 'string') return ts.slice(0, 10);
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  if (typeof ts === 'object') {
    if ('toDate' in ts && typeof (ts as any).toDate === 'function') {
      return (ts as any).toDate().toISOString().slice(0, 10);
    }
    if ('seconds' in ts && typeof (ts as any).seconds === 'number') {
      return new Date((ts as any).seconds * 1000).toISOString().slice(0, 10);
    }
  }
  return '';
}

const queryCache = new Map<string, { timestamp: number; result: AskMyLifeOutput }>();
const QUERY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function askMyLifeQuery(options: AskMyLifeQueryOptions): Promise<AskMyLifeOutput> {
  const { question, entries, memories = [], goals = [], timelineEvents = [] } = options;

  // Check TTL cache for identical prompt + entity count
  const cacheKey = `${question.trim().toLowerCase()}_${entries.length}_${memories.length}_${goals.length}_${timelineEvents.length}`;
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL_MS) {
    return cached.result;
  }

  // 1. Intent Detection & Date Filtering
  const { intents, dateBounds } = detectQueryIntent(question);

  // 2. Convert user models into ContextDocuments
  const allDocs: ContextDocument[] = [];

  // Entries
  for (const entry of entries) {
    // Basic date filter check if present
    const dateStr = formatDate(entry.createdAt);
    if (dateBounds?.startDate && dateStr && dateStr < dateBounds.startDate) continue;
    if (dateBounds?.endDate && dateStr && dateStr > dateBounds.endDate) continue;

    allDocs.push({
      id: entry.id,
      title: entry.title || 'Untitled Entry',
      content: entry.body,
      type: 'entry',
      date: dateStr,
      tags: entry.tags,
    });
  }

  // Saved Memories only
  for (const memory of memories) {
    if (!memory.saved && memory.status !== 'saved') continue;
    const dateStr = formatDate(memory.createdAt);

    allDocs.push({
      id: memory.id,
      title: memory.title,
      content: memory.narrative,
      type: 'memory',
      date: dateStr,
      tags: memory.tags,
    });
  }

  // Goals
  for (const goal of goals) {
    allDocs.push({
      id: goal.id,
      title: goal.title,
      content: `Goal: ${goal.title}. Description: ${goal.description}. Status: ${goal.status}. Progress: ${goal.progress}%.`,
      type: 'goal',
      tags: goal.tags,
    });
  }

  // Timeline Events
  for (const te of timelineEvents) {
    allDocs.push({
      id: te.id,
      title: te.title,
      content: te.description,
      type: 'timeline',
      date: formatDate(te.occurredAt),
      tags: te.tags,
    });
  }

  // 3. Relevance Ranking & Context Compression
  const contextDocuments = scoreAndRankDocuments(question, allDocs, intents);

  if (authService.currentUser?.isDemo) {
    const aiRequiredResult: AskMyLifeOutput = {
      answer: 'Live Gemini AI is available after signing in with Google.',
      evidence: [],
      confidence: 'insufficient',
      hasSufficientEvidence: false,
      modelUsed: 'none',
    };
    queryCache.set(cacheKey, { timestamp: Date.now(), result: aiRequiredResult });
    return aiRequiredResult;
  }

  if (contextDocuments.length === 0) {
    const insufficientResult: AskMyLifeOutput = {
      answer: 'There is not enough information in your journal history to answer this question.',
      evidence: [],
      confidence: 'insufficient',
      hasSufficientEvidence: false,
      modelUsed: 'local-retrieval',
    };
    queryCache.set(cacheKey, { timestamp: Date.now(), result: insufficientResult });
    return insufficientResult;
  }

  // 4. Send to server-side Gemini Service endpoint
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await authService.getIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch('/api/gemini/ask-my-life', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      question,
      contextDocuments,
      dateFilter: dateBounds,
    }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.error || `Ask My Life query failed with status ${resp.status}`);
  }

  const data = await resp.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to process Ask My Life response');
  }

  const finalOutput: AskMyLifeOutput = {
    answer: data.answer || data.result?.answer || 'No answer generated.',
    evidence: data.evidence || data.result?.evidence || [],
    confidence: data.confidence || data.result?.confidence || 'insufficient',
    hasSufficientEvidence: data.hasSufficientEvidence ?? data.result?.hasSufficientEvidence ?? false,
    modelUsed: data.modelUsed || data.result?.modelUsed || 'gemini-3.7-flash',
  };

  queryCache.set(cacheKey, { timestamp: Date.now(), result: finalOutput });
  return finalOutput;
}
