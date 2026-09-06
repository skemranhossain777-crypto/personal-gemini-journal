import type { Collection, JournalEntry, Memory, Goal } from '../data/models';

export interface SemanticSearchFilters {
  query?: string;
  startDate?: string;
  endDate?: string;
  tag?: string;
  mood?: number | { min?: number; max?: number };
  theme?: string;
  person?: string;
  place?: string;
  goal?: string;
  collection?: string;
  page?: number;
  pageSize?: number;
}

export interface SemanticSearchResult {
  entry: JournalEntry;
  score: number; // 0 to 100
  previewSnippet: string;
  relevanceExplanation: string;
  matchedFilters: string[];
}

export interface SemanticSearchPage {
  results: SemanticSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Natural Language Semantic Intent Parser
 * Extracts emotional tone, themes, and entity concepts from queries like:
 * - "Find entries where I was worried about money."
 * - "Show moments when I felt proud."
 * - "Find entries about launching my business."
 */
export function parseQueryIntent(query: string): {
  emotions: string[];
  themes: string[];
  entities: string[];
  keywords: string[];
} {
  const q = query.toLowerCase().trim();
  const emotions: string[] = [];
  const themes: string[] = [];
  const entities: string[] = [];

  // Emotion intent detection
  if (/worried|worry|anxious|anxiety|stressed|stress|scared|fear|afraid|nervous/i.test(q)) {
    emotions.push('worried', 'anxious');
  }
  if (/proud|pride|accomplished|achievement|triumph|success|victor/i.test(q)) {
    emotions.push('proud', 'accomplished');
  }
  if (/happy|happiest|joy|joyful|grateful|gratitude|excited|thrilled/i.test(q)) {
    emotions.push('happy', 'grateful');
  }
  if (/sad|depressed|unhappy|lonely|grief|heartbroken/i.test(q)) {
    emotions.push('sad');
  }

  // Theme intent detection
  if (/money|finance|financial|budget|cost|debt|income|salary|wealth|savings|expensive/i.test(q)) {
    themes.push('Finance', 'Money');
  }
  if (/business|startup|company|work|job|career|launch|project|client|product/i.test(q)) {
    themes.push('Business', 'Career', 'Work');
  }
  if (/health|fitness|exercise|gym|diet|sleep|wellness|mental/i.test(q)) {
    themes.push('Health', 'Wellness');
  }
  if (/learning|study|read|course|book|skill|knowledge/i.test(q)) {
    themes.push('Learning');
  }
  if (/travel|trip|vacation|flight|hotel|explore|visit/i.test(q)) {
    themes.push('Travel');
  }

  // Extract clean non-stop words
  const stopWords = new Set([
    'find', 'show', 'entries', 'where', 'when', 'i', 'was', 'felt', 'about', 'my', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'with', 'moments', 'entries'
  ]);

  const keywords = q
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return { emotions, themes, entities, keywords };
}

/**
 * Generate preview snippet with highlighted query context around matching words.
 */
export function createPreviewSnippet(body: string, keywords: string[], maxLen = 160): string {
  if (!body) return '';

  const cleanBody = body.trim();
  if (keywords.length === 0) {
    return cleanBody.length > maxLen ? cleanBody.slice(0, maxLen) + '...' : cleanBody;
  }

  const lowerBody = cleanBody.toLowerCase();
  let firstMatchIdx = -1;

  for (const kw of keywords) {
    const idx = lowerBody.indexOf(kw.toLowerCase());
    if (idx !== -1 && (firstMatchIdx === -1 || idx < firstMatchIdx)) {
      firstMatchIdx = idx;
    }
  }

  if (firstMatchIdx === -1) {
    return cleanBody.length > maxLen ? cleanBody.slice(0, maxLen) + '...' : cleanBody;
  }

  const start = Math.max(0, firstMatchIdx - 40);
  const end = Math.min(cleanBody.length, firstMatchIdx + maxLen - 40);
  const snippet = cleanBody.slice(start, end);

  return (start > 0 ? '...' : '') + snippet + (end < cleanBody.length ? '...' : '');
}

function getIsoDateString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (typeof val === 'number') return new Date(val).toISOString().slice(0, 10);
  if (typeof val === 'object') {
    if ('toDate' in val && typeof (val as any).toDate === 'function') {
      return (val as any).toDate().toISOString().slice(0, 10);
    }
    if ('seconds' in val && typeof (val as any).seconds === 'number') {
      return new Date((val as any).seconds * 1000).toISOString().slice(0, 10);
    }
  }
  return '';
}

/**
 * Semantic Search Engine: Performs natural-language hybrid search over user entries
 * supporting all 8 filters: date, tag, mood, theme, person, place, goal, collection.
 */
export function executeSemanticSearch(
  entries: JournalEntry[],
  filters: SemanticSearchFilters,
  collections: Collection[] = [],
  memories: Memory[] = [],
  goals: Goal[] = []
): SemanticSearchPage {
  const {
    query = '',
    startDate,
    endDate,
    tag,
    mood,
    theme,
    person,
    place,
    goal,
    collection,
    page = 1,
    pageSize = 10,
  } = filters;

  const intent = parseQueryIntent(query);
  const rawQuery = query.toLowerCase().trim();

  const scoredResults: SemanticSearchResult[] = [];

  for (const entry of entries) {
    const matchedFilters: string[] = [];
    let score = 0;
    const entryTitle = entry.title.toLowerCase();
    const entryBody = entry.body.toLowerCase();
    const entryTags = entry.tags.map((t) => t.toLowerCase());

    // ─── Filter 1: Date Range ───────────────────────────────────────────────
    const dateStr = getIsoDateString(entry.createdAt);

    if (startDate && dateStr && dateStr < startDate) continue;
    if (endDate && dateStr && dateStr > endDate) continue;
    if (startDate || endDate) {
      matchedFilters.push(`Date: ${dateStr}`);
    }

    // ─── Filter 2: Tag ──────────────────────────────────────────────────────
    if (tag) {
      const cleanTag = tag.toLowerCase().replace(/^#/, '');
      if (!entryTags.includes(cleanTag)) continue;
      matchedFilters.push(`Tag: #${tag}`);
    }

    // ─── Filter 3: Mood ─────────────────────────────────────────────────────
    if (mood !== undefined) {
      if (typeof mood === 'number') {
        if (entry.mood !== mood) continue;
      } else if (typeof mood === 'object') {
        if (entry.mood === null) continue;
        if (mood.min !== undefined && entry.mood < mood.min) continue;
        if (mood.max !== undefined && entry.mood > mood.max) continue;
      }
      matchedFilters.push(`Mood: ${entry.mood}/5`);
    }

    // ─── Filter 4: Collection ──────────────────────────────────────────────
    if (collection) {
      const targetCol = collections.find((c) => c.id === collection || c.name.toLowerCase() === collection.toLowerCase());
      if (!targetCol || !targetCol.entryIds.includes(entry.id)) continue;
      matchedFilters.push(`Collection: ${targetCol.name}`);
    }

    // ─── Filter 5: Place / Location ─────────────────────────────────────────
    if (place) {
      const locName = entry.location?.placeName?.toLowerCase() || '';
      const locAddr = entry.location?.address?.toLowerCase() || '';
      if (!locName.includes(place.toLowerCase()) && !locAddr.includes(place.toLowerCase())) continue;
      matchedFilters.push(`Place: ${entry.location?.placeName}`);
    }

    // ─── Filter 6: Person ───────────────────────────────────────────────────
    if (person) {
      const p = person.toLowerCase();
      const matchInContent = entryTitle.includes(p) || entryBody.includes(p);
      const matchInTags = entryTags.includes(p);
      const memoryMatch = memories.some(
        (m) => m.type === 'person' && m.title.toLowerCase().includes(p) && m.sourceEntryIds.includes(entry.id)
      );
      if (!matchInContent && !matchInTags && !memoryMatch) continue;
      matchedFilters.push(`Person: ${person}`);
    }

    // ─── Filter 7: Goal ─────────────────────────────────────────────────────
    if (goal) {
      const g = goal.toLowerCase();
      const matchGoalObj = goals.find((gObj) => gObj.id === goal || gObj.title.toLowerCase().includes(g));
      const goalRelated = matchGoalObj ? matchGoalObj.relatedEntryIds.includes(entry.id) : false;
      const textMatch = entryTitle.includes(g) || entryBody.includes(g);
      if (!goalRelated && !textMatch) continue;
      matchedFilters.push(`Goal: ${matchGoalObj?.title || goal}`);
    }

    // ─── Filter 8: Theme ────────────────────────────────────────────────────
    if (theme) {
      const t = theme.toLowerCase();
      const matchTag = entryTags.some((tagStr) => tagStr.includes(t));
      const matchBody = entryBody.includes(t) || entryTitle.includes(t);
      if (!matchTag && !matchBody) continue;
      matchedFilters.push(`Theme: ${theme}`);
    }

    // ─── Semantic Relevance Scoring ────────────────────────────────────────
    if (rawQuery) {
      // 1. Direct query string match
      if (entryTitle.includes(rawQuery)) score += 40;
      if (entryBody.includes(rawQuery)) score += 30;

      // 2. Keyword overlap score
      for (const kw of intent.keywords) {
        if (entryTitle.includes(kw)) score += 15;
        if (entryBody.includes(kw)) score += 8;
        if (entryTags.some((t) => t.includes(kw))) score += 12;
      }

      // 3. Emotion alignment scoring
      if (intent.emotions.length > 0) {
        for (const emo of intent.emotions) {
          if (entryBody.includes(emo) || entryTitle.includes(emo) || entryTags.includes(emo)) {
            score += 20;
          }
        }
        if (intent.emotions.includes('worried') || intent.emotions.includes('anxious')) {
          if (entry.mood !== null && entry.mood <= 2) score += 10;
        }
        if (intent.emotions.includes('proud') || intent.emotions.includes('happy')) {
          if (entry.mood !== null && entry.mood >= 4) score += 10;
        }
      }

      // 4. Theme alignment scoring
      if (intent.themes.length > 0) {
        for (const th of intent.themes) {
          const thLower = th.toLowerCase();
          if (entryBody.includes(thLower) || entryTitle.includes(thLower) || entryTags.some((t) => t.includes(thLower))) {
            score += 15;
          }
        }
      }

      // Skip entries with 0 relevance score when a query was provided
      if (score === 0 && intent.keywords.length > 0) {
        continue;
      }
    } else {
      // Base score when browsing filters without a text query
      score = 50;
    }

    // Clamp score to max 100
    const finalScore = Math.min(100, Math.max(10, score));

    // Formulate human-readable relevance explanation
    const reasons: string[] = [];
    if (intent.emotions.length > 0) {
      reasons.push(`Matches emotion '${intent.emotions[0]}'`);
    }
    if (intent.themes.length > 0) {
      reasons.push(`Theme: ${intent.themes[0]}`);
    }
    if (intent.keywords.length > 0 && reasons.length === 0) {
      reasons.push(`Keywords matched: ${intent.keywords.slice(0, 3).join(', ')}`);
    }
    if (matchedFilters.length > 0) {
      reasons.push(matchedFilters.join(' • '));
    }

    const relevanceExplanation = reasons.length > 0 ? reasons.join(' | ') : 'Direct text match';
    const previewSnippet = createPreviewSnippet(entry.body, intent.keywords);

    scoredResults.push({
      entry,
      score: finalScore,
      previewSnippet,
      relevanceExplanation,
      matchedFilters,
    });
  }

  // Sort descending by relevance score, then by entry date
  scoredResults.sort((a, b) => b.score - a.score);

  // Pagination logic
  const total = scoredResults.length;
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.ceil(total / safePageSize) || 1;
  const startIndex = (safePage - 1) * safePageSize;
  const pageResults = scoredResults.slice(startIndex, startIndex + safePageSize);

  return {
    results: pageResults,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasMore: safePage < totalPages,
  };
}
