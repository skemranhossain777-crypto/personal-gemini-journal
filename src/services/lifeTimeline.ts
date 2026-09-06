import type { TimelineEventType, JournalEntry, Memory, Goal, TimelineEvent } from '../data/models';
import { toDate } from '../journal/format';

export interface UnifiedTimelineItem {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  date: Date;
  year: number;
  month: number; // 1..12
  day: number;
  sourceType: 'timeline-event' | 'journal' | 'memory' | 'goal';
  sourceId: string;
  sourceEntryId?: string;
  tags: string[];
  mood?: number | null;
  energy?: number | null;
  locationName?: string;
  importance?: number;
  confidence?: number;
  status?: string;
  progress?: number;
  createdAt: Date;
}

export interface TimelineFilterOptions {
  year?: number | 'all';
  month?: number | 'all'; // 1..12 or 'all'
  types?: TimelineEventType[];
  tag?: string | null;
  searchQuery?: string;
  sortOrder?: 'desc' | 'asc';
}

export interface PaginatedTimelineResult {
  items: UnifiedTimelineItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  availableYears: number[];
  availableMonths: number[];
}

export const ALL_TIMELINE_TYPES: TimelineEventType[] = [
  'journal',
  'memory',
  'goal',
  'achievement',
  'milestone',
  'trip',
  'idea',
  'important-event',
];

export const TIMELINE_TYPE_CONFIG: Record<
  TimelineEventType,
  { label: string; iconName: string; colorClass: string; badgeBg: string; borderGlow: string }
> = {
  journal: {
    label: 'Journal Entry',
    iconName: 'BookOpen',
    colorClass: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    borderGlow: 'hover:border-sky-500/50 hover:shadow-sky-500/10',
  },
  memory: {
    label: 'Memory',
    iconName: 'Brain',
    colorClass: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    borderGlow: 'hover:border-purple-500/50 hover:shadow-purple-500/10',
  },
  goal: {
    label: 'Goal',
    iconName: 'Target',
    colorClass: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    borderGlow: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
  },
  achievement: {
    label: 'Achievement',
    iconName: 'Trophy',
    colorClass: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    borderGlow: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
  },
  milestone: {
    label: 'Milestone',
    iconName: 'Flag',
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    borderGlow: 'hover:border-rose-500/50 hover:shadow-rose-500/10',
  },
  trip: {
    label: 'Trip & Travel',
    iconName: 'Compass',
    colorClass: 'text-teal-400',
    badgeBg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    borderGlow: 'hover:border-teal-500/50 hover:shadow-teal-500/10',
  },
  idea: {
    label: 'Idea',
    iconName: 'Lightbulb',
    colorClass: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    borderGlow: 'hover:border-yellow-500/50 hover:shadow-yellow-500/10',
  },
  'important-event': {
    label: 'Important Event',
    iconName: 'Sparkles',
    colorClass: 'text-pink-400',
    badgeBg: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
    borderGlow: 'hover:border-pink-500/50 hover:shadow-pink-500/10',
  },
};

/**
 * Maps raw MemoryType string to TimelineEventType.
 */
export function mapMemoryTypeToTimelineType(memType: string): TimelineEventType {
  switch (memType) {
    case 'milestone':
      return 'milestone';
    case 'trip':
      return 'trip';
    case 'idea':
      return 'idea';
    case 'achievement':
      return 'achievement';
    case 'event':
      return 'important-event';
    default:
      return 'memory';
  }
}

/**
 * Synthesizes all user entities (TimelineEvent, JournalEntry, Memory, Goal) into a unified timeline item list.
 */
export function synthesizeTimelineItems(params: {
  timelineEvents?: TimelineEvent[];
  entries?: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
}): UnifiedTimelineItem[] {
  const { timelineEvents = [], entries = [], memories = [], goals = [] } = params;
  const items: UnifiedTimelineItem[] = [];
  const seenSourceIds = new Set<string>();

  // 1. Explicit Timeline Events
  for (const te of timelineEvents) {
    const d = toDate(te.occurredAt || te.createdAt) || new Date();
    const sourceEntryId =
      te.source?.collection === 'journalEntries' || te.source?.collection === 'journal'
        ? te.source.docId
        : undefined;

    items.push({
      id: `te_${te.id}`,
      type: te.type,
      title: te.title,
      description: te.description || '',
      date: d,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      sourceType: 'timeline-event',
      sourceId: te.id,
      sourceEntryId,
      tags: te.tags || [],
      createdAt: toDate(te.createdAt) || d,
    });

    if (te.source?.docId) {
      seenSourceIds.add(`${te.source.collection}:${te.source.docId}`);
    }
  }

  // 2. Journal Entries
  for (const entry of entries) {
    if (entry.archived) continue;
    if (seenSourceIds.has(`journalEntries:${entry.id}`) || seenSourceIds.has(`journal:${entry.id}`)) {
      continue;
    }

    const d = toDate(entry.createdAt) || new Date();
    items.push({
      id: `je_${entry.id}`,
      type: 'journal',
      title: entry.title || 'Untitled Entry',
      description: entry.body || '',
      date: d,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      sourceType: 'journal',
      sourceId: entry.id,
      sourceEntryId: entry.id,
      tags: entry.tags || [],
      mood: entry.mood,
      energy: entry.energy,
      locationName: entry.location?.placeName,
      createdAt: d,
    });
  }

  // 3. Memories (Only saved or non-ignored)
  for (const mem of memories) {
    if (mem.status === 'ignored' || mem.status === 'forgotten') continue;
    if (seenSourceIds.has(`memories:${mem.id}`)) continue;

    const d = toDate(mem.occurredAt || mem.createdAt) || new Date();
    const timelineType = mapMemoryTypeToTimelineType(mem.type);
    const sourceEntryId = mem.sourceEntryIds?.[0];

    items.push({
      id: `mem_${mem.id}`,
      type: timelineType,
      title: mem.title,
      description: mem.narrative || '',
      date: d,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      sourceType: 'memory',
      sourceId: mem.id,
      sourceEntryId,
      tags: mem.tags || [],
      importance: mem.importance,
      confidence: mem.confidence,
      status: mem.status,
      createdAt: toDate(mem.createdAt) || d,
    });
  }

  // 4. Goals
  for (const goal of goals) {
    if (goal.status === 'archived') continue;
    if (seenSourceIds.has(`goals:${goal.id}`)) continue;

    const d = toDate(goal.targetDate || goal.createdAt) || new Date();
    const isCompleted = goal.status === 'completed' || goal.progress >= 100;
    const type: TimelineEventType = isCompleted ? 'achievement' : 'goal';
    const sourceEntryId = goal.relatedEntryIds?.[0];

    items.push({
      id: `goal_${goal.id}`,
      type,
      title: goal.title,
      description: goal.description || '',
      date: d,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      sourceType: 'goal',
      sourceId: goal.id,
      sourceEntryId,
      tags: goal.tags || [],
      status: goal.status,
      progress: goal.progress,
      createdAt: toDate(goal.createdAt) || d,
    });
  }

  return items;
}

/**
 * Filter, sort, and extract available years and months from a list of timeline items.
 */
export function queryTimelineItems(
  items: UnifiedTimelineItem[],
  options: TimelineFilterOptions = {}
): {
  filteredItems: UnifiedTimelineItem[];
  availableYears: number[];
  availableMonths: number[];
} {
  const {
    year = 'all',
    month = 'all',
    types = [],
    tag = null,
    searchQuery = '',
    sortOrder = 'desc',
  } = options;

  // Extract all distinct years from total dataset
  const yearsSet = new Set<number>();
  for (const item of items) {
    yearsSet.add(item.year);
  }
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  // Extract available months for selected year (or all years if year === 'all')
  const monthsSet = new Set<number>();
  for (const item of items) {
    if (year === 'all' || item.year === year) {
      monthsSet.add(item.month);
    }
  }
  const availableMonths = Array.from(monthsSet).sort((a, b) => a - b);

  const queryLower = searchQuery.trim().toLowerCase();
  const typesSet = new Set(types);

  const filtered = items.filter((item) => {
    // Year filter
    if (year !== 'all' && item.year !== year) return false;

    // Month filter
    if (month !== 'all' && item.month !== month) return false;

    // Event type filter
    if (typesSet.size > 0 && !typesSet.has(item.type)) return false;

    // Tag filter
    if (tag && !item.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;

    // Search query filter
    if (queryLower) {
      const inTitle = item.title.toLowerCase().includes(queryLower);
      const inDesc = item.description.toLowerCase().includes(queryLower);
      const inTags = item.tags.some((t) => t.toLowerCase().includes(queryLower));
      const inLocation = item.locationName ? item.locationName.toLowerCase().includes(queryLower) : false;
      if (!inTitle && !inDesc && !inTags && !inLocation) return false;
    }

    return true;
  });

  // Sort by date
  filtered.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    return sortOrder === 'desc' ? -diff : diff;
  });

  return {
    filteredItems: filtered,
    availableYears,
    availableMonths,
  };
}

/**
 * Paginate timeline items for large datasets.
 */
export function getPaginatedTimeline(
  items: UnifiedTimelineItem[],
  page: number = 1,
  pageSize: number = 30
): {
  items: UnifiedTimelineItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
} {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: pageItems,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
  };
}

/**
 * Group timeline items by Month Name for structured visual sectioning.
 */
export interface MonthGroup {
  year: number;
  month: number;
  monthName: string;
  items: UnifiedTimelineItem[];
}

export function groupTimelineByMonth(items: UnifiedTimelineItem[]): MonthGroup[] {
  const groupsMap = new Map<string, MonthGroup>();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  for (const item of items) {
    const key = `${item.year}-${item.month}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        year: item.year,
        month: item.month,
        monthName: monthNames[item.month - 1] || `Month ${item.month}`,
        items: [],
      });
    }
    groupsMap.get(key)!.items.push(item);
  }

  return Array.from(groupsMap.values());
}
