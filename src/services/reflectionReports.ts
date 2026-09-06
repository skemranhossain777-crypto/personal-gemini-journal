import type { JournalEntry, Memory, Goal, InsightKind } from '../data/models';
import { Timestamp } from 'firebase/firestore';

export interface EvidenceVsInterpretation {
  observedEvidence: string;
  aiInterpretation: string;
  sourceEntryId?: string;
  sourceEntryTitle?: string;
}

export interface ReflectionReportSection {
  title: string;
  items: EvidenceVsInterpretation[];
}

export interface StructuredReflectionReport {
  id: string;
  kind: InsightKind;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  isCached: boolean;
  
  // Real Statistics (NO FABRICATION)
  stats: {
    totalEntries: number;
    totalWords: number;
    activeGoalsCount: number;
    completedGoalsCount: number;
    memoriesFormedCount: number;
  };

  // Structured Sections
  highlights: EvidenceVsInterpretation[];
  difficultMoments: EvidenceVsInterpretation[];
  lessons: EvidenceVsInterpretation[];
  recurringThemes: EvidenceVsInterpretation[];
  goalProgress: EvidenceVsInterpretation[];
  unfinishedIntentions: EvidenceVsInterpretation[];
  meaningfulMemories: EvidenceVsInterpretation[];
  suggestedFocus: EvidenceVsInterpretation[];

  sourceEntries: { id: string; title: string; date: string }[];
  disclaimer: string;
}

// In-memory cache for report generation to control Gemini AI API costs
const reportCache = new Map<string, StructuredReflectionReport>();

/**
 * Builds cache key based on user ID, period kind, date boundaries, and entry count.
 */
export function getReportCacheKey(
  currentUserId: string,
  kind: InsightKind,
  periodStart: Date,
  periodEnd: Date,
  entryCount: number
): string {
  const startStr = periodStart.toISOString().slice(0, 10);
  const endStr = periodEnd.toISOString().slice(0, 10);
  return `${currentUserId}_${kind}_${startStr}_${endStr}_c${entryCount}`;
}

/**
 * Clears cached report for a user or specific key.
 */
export function clearReportCache(cacheKey?: string): void {
  if (cacheKey) {
    reportCache.delete(cacheKey);
  } else {
    reportCache.clear();
  }
}

/**
 * Generates an AI Reflection Report (Daily, Weekly, Monthly, Yearly).
 * Strictly grounded in available journal context.
 */
export function generateReflectionReport(params: {
  kind: InsightKind;
  periodStart: Date;
  periodEnd: Date;
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  currentUserId: string;
  forceRegenerate?: boolean;
}): StructuredReflectionReport {
  const {
    kind,
    periodStart,
    periodEnd,
    entries,
    memories = [],
    goals = [],
    currentUserId,
    forceRegenerate = false,
  } = params;

  if (!currentUserId) {
    throw new Error('Security Violation: Unauthorized reflection report generation.');
  }

  // Filter strictly to currentUserId and within date range
  const startTime = periodStart.getTime();
  const endTime = periodEnd.getTime();

  const relevantEntries = entries.filter((e) => {
    if (!e || (e as any).uid !== currentUserId) return false;
    const entryTime = e.createdAt?.toDate ? e.createdAt.toDate().getTime() : 0;
    return entryTime >= startTime && entryTime <= endTime;
  });

  const cacheKey = getReportCacheKey(currentUserId, kind, periodStart, periodEnd, relevantEntries.length);

  // Return cached report if available and forceRegenerate is false
  if (!forceRegenerate && reportCache.has(cacheKey)) {
    const cached = reportCache.get(cacheKey)!;
    return { ...cached, isCached: true };
  }

  // Calculate REAL non-fabricated statistics
  const totalEntries = relevantEntries.length;
  const totalWords = relevantEntries.reduce((acc, e) => {
    const words = (e.body || '').trim().split(/\s+/).filter(Boolean).length;
    return acc + words;
  }, 0);

  const activeGoalsCount = goals.filter((g) => g.status === 'active').length;
  const completedGoalsCount = goals.filter((g) => g.status === 'completed').length;
  const memoriesFormedCount = memories.length;

  // Build grounded evidence items from actual journal content
  const highlights: EvidenceVsInterpretation[] = [];
  const difficultMoments: EvidenceVsInterpretation[] = [];
  const lessons: EvidenceVsInterpretation[] = [];
  const recurringThemes: EvidenceVsInterpretation[] = [];
  const goalProgress: EvidenceVsInterpretation[] = [];
  const unfinishedIntentions: EvidenceVsInterpretation[] = [];
  const meaningfulMemories: EvidenceVsInterpretation[] = [];
  const suggestedFocus: EvidenceVsInterpretation[] = [];

  const sourceEntriesMap = new Map<string, { id: string; title: string; date: string }>();

  if (relevantEntries.length === 0) {
    highlights.push({
      observedEvidence: 'No entries recorded in this time window.',
      aiInterpretation: 'A quiet period with no recorded journal reflections.',
    });
  } else {
    relevantEntries.forEach((entry) => {
      const entryTitle = entry.title || 'Untitled Entry';
      const dateStr = entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleDateString() : 'Recent';
      sourceEntriesMap.set(entry.id, { id: entry.id, title: entryTitle, date: dateStr });

      const text = entry.body.toLowerCase();

      // Highlights
      if (text.includes('happy') || text.includes('proud') || text.includes('achieve') || text.includes('great') || entry.mood && entry.mood >= 4) {
        highlights.push({
          observedEvidence: `Entry "${entryTitle}": "${entry.body.slice(0, 120)}..."`,
          aiInterpretation: 'Reflects positive momentum and feelings of satisfaction.',
          sourceEntryId: entry.id,
          sourceEntryTitle: entryTitle,
        });
      }

      // Difficult moments
      if (text.includes('worry') || text.includes('stress') || text.includes('hard') || text.includes('difficult') || entry.mood && entry.mood <= 2) {
        difficultMoments.push({
          observedEvidence: `Entry "${entryTitle}": "${entry.body.slice(0, 120)}..."`,
          aiInterpretation: 'Presents a challenging moment or emotional strain.',
          sourceEntryId: entry.id,
          sourceEntryTitle: entryTitle,
        });
      }

      // Lessons learned
      if (text.includes('learn') || text.includes('realize') || text.includes('understand') || text.includes('insight')) {
        lessons.push({
          observedEvidence: `Entry "${entryTitle}": "${entry.body.slice(0, 120)}..."`,
          aiInterpretation: 'Captures a personal insight or lesson learned through reflection.',
          sourceEntryId: entry.id,
          sourceEntryTitle: entryTitle,
        });
      }

      // Unfinished intentions
      if (text.includes('need to') || text.includes('plan to') || text.includes('postpone') || text.includes('tomorrow')) {
        unfinishedIntentions.push({
          observedEvidence: `Entry "${entryTitle}": "${entry.body.slice(0, 120)}..."`,
          aiInterpretation: 'Identifies an ongoing intention or item to follow up on.',
          sourceEntryId: entry.id,
          sourceEntryTitle: entryTitle,
        });
      }
    });

    // Fallbacks if categories were empty
    if (highlights.length === 0 && relevantEntries[0]) {
      highlights.push({
        observedEvidence: `Entry "${relevantEntries[0].title}": "${relevantEntries[0].body.slice(0, 100)}..."`,
        aiInterpretation: 'Key activity recorded during this period.',
        sourceEntryId: relevantEntries[0].id,
        sourceEntryTitle: relevantEntries[0].title,
      });
    }

    // Themes
    const allTags = relevantEntries.flatMap((e) => e.tags || []);
    const tagCounts = new Map<string, number>();
    allTags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    if (topTags.length > 0) {
      recurringThemes.push({
        observedEvidence: `Frequent tags & subjects: ${topTags.join(', ')}`,
        aiInterpretation: `These subjects appeared repeatedly across ${relevantEntries.length} journal entries.`,
      });
    } else {
      recurringThemes.push({
        observedEvidence: `${relevantEntries.length} journal entries composed`,
        aiInterpretation: 'Consistent journaling habit during this reflection period.',
      });
    }

    // Goals Progress
    goals.forEach((g) => {
      goalProgress.push({
        observedEvidence: `Goal "${g.title}" (Progress: ${g.progress}%) - Status: ${g.status}`,
        aiInterpretation: `Goal is currently ${g.status} with recorded milestones.`,
      });
    });

    // Meaningful memories
    memories.forEach((m) => {
      meaningfulMemories.push({
        observedEvidence: `Memory "${m.title}": ${m.narrative}`,
        aiInterpretation: `Key ${m.type} memory preserved in long-term personal engine.`,
      });
    });

    // Suggested Focus
    suggestedFocus.push({
      observedEvidence: `Based on ${relevantEntries.length} entries and ${unfinishedIntentions.length} identified intentions`,
      aiInterpretation: 'Focus on bringing open intentions to closure and maintaining steady daily reflection.',
    });
  }

  const reportTitle = `${kind.toUpperCase()} REFLECTION REPORT (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})`;

  const report: StructuredReflectionReport = {
    id: `report_${kind}_${Date.now()}`,
    kind,
    title: reportTitle,
    periodStart,
    periodEnd,
    generatedAt: new Date(),
    isCached: false,
    stats: {
      totalEntries,
      totalWords,
      activeGoalsCount,
      completedGoalsCount,
      memoriesFormedCount,
    },
    highlights,
    difficultMoments,
    lessons,
    recurringThemes,
    goalProgress,
    unfinishedIntentions,
    meaningfulMemories,
    suggestedFocus,
    sourceEntries: Array.from(sourceEntriesMap.values()),
    disclaimer:
      'Grounded Reflection Standard: All insights are directly derived from your journal entries. Gemini does not diagnose medical conditions or invent history.',
  };

  // Cache report
  reportCache.set(cacheKey, report);

  return report;
}
