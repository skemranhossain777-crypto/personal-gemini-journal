import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  BookOpen,
  Brain,
  Target,
  Trophy,
  Flag,
  Compass,
  Lightbulb,
  Sparkles,
  Search,
  Filter,
  Tag,
  MapPin,
  Heart,
  Zap,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Clock,
  ArrowUpDown,
  SlidersHorizontal,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, TimelineEvent, TimelineEventType } from '../../data/models';
import {
  synthesizeTimelineItems,
  queryTimelineItems,
  getPaginatedTimeline,
  groupTimelineByMonth,
  ALL_TIMELINE_TYPES,
  TIMELINE_TYPE_CONFIG,
  type UnifiedTimelineItem,
} from '../../services/lifeTimeline';
import { formatEntryDate, formatShortDate } from '../../journal/format';

export interface LifeTimelineViewProps {
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  timelineEvents?: TimelineEvent[];
  onOpenEntry?: (entryId: string) => void;
  className?: string;
}

export const LifeTimelineView: React.FC<LifeTimelineViewProps> = ({
  entries,
  memories = [],
  goals = [],
  timelineEvents = [],
  onOpenEntry,
  className = '',
}) => {
  // Filters & State
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [selectedTypes, setSelectedTypes] = useState<TimelineEventType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [pageSize, setPageSize] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);
  const [activeItemModal, setActiveItemModal] = useState<UnifiedTimelineItem | null>(null);

  // 1. Synthesize timeline items from all user entities
  const rawItems = useMemo(
    () =>
      synthesizeTimelineItems({
        timelineEvents,
        entries,
        memories,
        goals,
      }),
    [timelineEvents, entries, memories, goals]
  );

  // 2. Extract distinct tags for tag filter bar
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of rawItems) {
      for (const t of item.tags) set.add(t);
    }
    return Array.from(set).slice(0, 15);
  }, [rawItems]);

  // 3. Query & filter items
  const { filteredItems, availableYears, availableMonths } = useMemo(
    () =>
      queryTimelineItems(rawItems, {
        year: selectedYear,
        month: selectedMonth,
        types: selectedTypes,
        tag: selectedTag,
        searchQuery,
        sortOrder,
      }),
    [rawItems, selectedYear, selectedMonth, selectedTypes, selectedTag, searchQuery, sortOrder]
  );

  // Reset page when filters change
  const handleYearSelect = (yr: number | 'all') => {
    setSelectedYear(yr);
    setSelectedMonth('all');
    setCurrentPage(1);
  };

  const handleMonthSelect = (mo: number | 'all') => {
    setSelectedMonth(mo);
    setCurrentPage(1);
  };

  const handleTypeToggle = (t: TimelineEventType) => {
    setCurrentPage(1);
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleTagClick = (t: string) => {
    setCurrentPage(1);
    setSelectedTag((prev) => (prev === t ? null : t));
  };

  // 4. Paginate results
  const paginatedResult = useMemo(
    () => getPaginatedTimeline(filteredItems, currentPage, pageSize),
    [filteredItems, currentPage, pageSize]
  );

  // 5. Group paginated items by Month for timeline section rendering
  const monthGroups = useMemo(
    () => groupTimelineByMonth(paginatedResult.items),
    [paginatedResult.items]
  );

  // Icon mapping helper
  const renderTypeIcon = (type: TimelineEventType, className = 'w-4 h-4') => {
    switch (type) {
      case 'journal':
        return <BookOpen className={className} />;
      case 'memory':
        return <Brain className={className} />;
      case 'goal':
        return <Target className={className} />;
      case 'achievement':
        return <Trophy className={className} />;
      case 'milestone':
        return <Flag className={className} />;
      case 'trip':
        return <Compass className={className} />;
      case 'idea':
        return <Lightbulb className={className} />;
      case 'important-event':
        return <Sparkles className={className} />;
      default:
        return <Calendar className={className} />;
    }
  };

  const monthNamesShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Emotional Life Timeline Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-950/60 via-slate-900/90 to-indigo-950/50 p-6 md:p-8 border border-purple-800/30 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>JOURNAL∞ Life Story tapestry</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-100 via-indigo-100 to-sky-200 bg-clip-text text-transparent">
              Your Life Timeline
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Every thought, memory, journey, and milestone woven into a continuous, living narrative.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-100">{rawItems.length}</div>
                <div className="text-xs text-slate-400">Total Moments</div>
              </div>
            </div>
            {availableYears.length > 0 && (
              <>
                <div className="h-8 w-px bg-slate-800" />
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-100">{availableYears.length}</div>
                    <div className="text-xs text-slate-400">Years Tracked</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar & Navigation */}
      <div className="space-y-4">
        {/* Top Filter Row: Search & Mobile Filter Drawer Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search life events, memories, tags, or places..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Order Toggle */}
            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
              title="Toggle Sort Order"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>

            {/* Mobile Filter Toggle Button */}
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="sm:hidden inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-900/40 border border-purple-700/50 text-xs font-medium text-purple-200"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {selectedTypes.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-500 text-[10px] text-white flex items-center justify-center font-bold">
                  {selectedTypes.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Year Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Year:
          </span>
          <button
            onClick={() => handleYearSelect('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedYear === 'all'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            All Years ({rawItems.length})
          </button>
          {availableYears.map((yr) => {
            const count = rawItems.filter((i) => i.year === yr).length;
            const isSelected = selectedYear === yr;
            return (
              <button
                key={yr}
                onClick={() => handleYearSelect(yr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {yr} <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Month Navigation Bar (Visible when year is selected or always) */}
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Month:
            </span>
            <button
              onClick={() => handleMonthSelect('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                selectedMonth === 'all'
                  ? 'bg-indigo-600/80 text-white'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-800/80 hover:text-slate-200'
              }`}
            >
              All
            </button>
            {availableMonths.map((mo) => (
              <button
                key={mo}
                onClick={() => handleMonthSelect(mo)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  selectedMonth === mo
                    ? 'bg-indigo-600/80 text-white'
                    : 'bg-slate-900/50 text-slate-400 border border-slate-800/80 hover:text-slate-200'
                }`}
              >
                {monthNamesShort[mo - 1]}
              </button>
            ))}
          </div>
        )}

        {/* Event Type Filter Chips (Desktop & Expanded Mobile) */}
        <div className={`sm:block ${mobileFilterOpen ? 'block' : 'hidden'} space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-purple-400" /> Event Type Filters
            </div>
            {selectedTypes.length > 0 && (
              <button
                onClick={() => setSelectedTypes([])}
                className="text-[11px] text-purple-400 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_TIMELINE_TYPES.map((typeKey) => {
              const cfg = TIMELINE_TYPE_CONFIG[typeKey];
              const isSelected = selectedTypes.includes(typeKey);
              return (
                <button
                  key={typeKey}
                  onClick={() => handleTypeToggle(typeKey)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? `${cfg.badgeBg} border ring-1 ring-purple-500/40 shadow-sm`
                      : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className={isSelected ? cfg.colorClass : 'text-slate-400'}>
                    {renderTypeIcon(typeKey, 'w-3.5 h-3.5')}
                  </span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Popular Tag Filters */}
          {allTags.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
                <Tag className="w-3 h-3 text-slate-500" /> Tags:
              </span>
              {allTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      isSelected
                        ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Timeline View Canvas */}
      {paginatedResult.items.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No Life Moments Found</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Try adjusting your search criteria, selected year, month, or event type filters.
          </p>
          {(selectedYear !== 'all' || selectedTypes.length > 0 || searchQuery || selectedTag) && (
            <button
              onClick={() => {
                setSelectedYear('all');
                setSelectedMonth('all');
                setSelectedTypes([]);
                setSearchQuery('');
                setSelectedTag(null);
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 hover:bg-purple-500 transition"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="relative space-y-8">
          {/* Vertical Central Connecting Line for Desktop */}
          <div className="hidden sm:block absolute left-8 top-4 bottom-4 w-0.5 bg-gradient-to-b from-purple-500/50 via-indigo-500/30 to-slate-800 pointer-events-none" />

          {monthGroups.map((group) => (
            <div key={`${group.year}-${group.month}`} className="space-y-6">
              {/* Month & Year Section Sticky Marker */}
              <div className="sticky top-4 z-20 flex items-center gap-3">
                <div className="sm:w-16 flex justify-center">
                  <div className="px-3 py-1 rounded-full bg-slate-900 border border-purple-500/40 text-purple-300 text-xs font-bold shadow-lg shadow-black/50 backdrop-blur-md flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>
                      {group.monthName} {group.year}
                    </span>
                  </div>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
              </div>

              {/* Event Cards under this Month */}
              <div className="space-y-4 sm:ml-16">
                {group.items.map((item) => {
                  const cfg = TIMELINE_TYPE_CONFIG[item.type] || TIMELINE_TYPE_CONFIG.journal;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setActiveItemModal(item)}
                      className={`group relative cursor-pointer rounded-2xl bg-slate-900/70 border border-slate-800 p-5 backdrop-blur-md transition-all duration-300 ${cfg.borderGlow} hover:bg-slate-900/90 shadow-lg`}
                    >
                      {/* Node Connector Dot */}
                      <div className="hidden sm:flex absolute -left-[2.15rem] top-6 w-4 h-4 rounded-full bg-slate-950 border-2 border-purple-400 items-center justify-center group-hover:scale-125 transition-transform shadow-md shadow-purple-500/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          {/* Header badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeBg}`}>
                              {renderTypeIcon(item.type, 'w-3 h-3')}
                              <span>{cfg.label}</span>
                            </span>

                            <span className="text-xs text-slate-400 font-medium">
                              {formatShortDate(item.date)}
                            </span>

                            {item.mood && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
                                <Heart className="w-3 h-3 text-rose-400" /> Mood {item.mood}/5
                              </span>
                            )}

                            {item.energy !== undefined && item.energy !== null && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                                <Zap className="w-3 h-3 text-amber-400" /> Energy {item.energy}%
                              </span>
                            )}

                            {item.locationName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-300">
                                <MapPin className="w-3 h-3 text-teal-400" /> {item.locationName}
                              </span>
                            )}
                          </div>

                          {/* Event Title */}
                          <h3 className="text-base sm:text-lg font-semibold text-slate-100 group-hover:text-purple-200 transition">
                            {item.title}
                          </h3>

                          {/* Snippet Description */}
                          {item.description && (
                            <p className="text-sm text-slate-300/90 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {/* Progress bar for goal */}
                          {item.type === 'goal' && item.progress !== undefined && (
                            <div className="w-full max-w-xs space-y-1 pt-1">
                              <div className="flex justify-between text-[11px] text-slate-400">
                                <span>Goal Progress</span>
                                <span>{item.progress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Tags */}
                          {item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {item.tags.map((t) => (
                                <span
                                  key={t}
                                  className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] text-slate-400 border border-slate-700/50"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Direct View Source Entry Action button if available */}
                        {item.sourceEntryId && onOpenEntry && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEntry(item.sourceEntryId!);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-800/50 border border-purple-700/40 text-purple-300 text-xs font-medium transition self-start sm:self-auto shrink-0"
                            title="View full source journal entry"
                          >
                            <span>Source Entry</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
            <div>
              Showing {paginatedResult.items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} moments
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-semibold text-slate-200">
                Page {currentPage} of {paginatedResult.totalPages}
              </span>
              <button
                disabled={currentPage >= paginatedResult.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>Per page:</span>
              {[20, 30, 50, 100].map((sz) => (
                <button
                  key={sz}
                  onClick={() => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    pageSize === sz ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal / Drawer */}
      <AnimatePresence>
        {activeItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl"
            >
              {/* Modal Close Button */}
              <button
                onClick={() => setActiveItemModal(null)}
                className="absolute right-4 top-4 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      TIMELINE_TYPE_CONFIG[activeItemModal.type]?.badgeBg
                    }`}
                  >
                    {renderTypeIcon(activeItemModal.type, 'w-3.5 h-3.5')}
                    <span>{TIMELINE_TYPE_CONFIG[activeItemModal.type]?.label}</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatEntryDate(activeItemModal.date)}
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-slate-100">
                  {activeItemModal.title}
                </h2>
              </div>

              {/* Metadata row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block">Occurred On</span>
                  <span className="font-semibold text-slate-200">
                    {formatShortDate(activeItemModal.date)}
                  </span>
                </div>
                {activeItemModal.mood && (
                  <div>
                    <span className="text-slate-500 block">Mood Rating</span>
                    <span className="font-semibold text-rose-300 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-400" /> {activeItemModal.mood}/5
                    </span>
                  </div>
                )}
                {activeItemModal.energy !== undefined && activeItemModal.energy !== null && (
                  <div>
                    <span className="text-slate-500 block">Energy Level</span>
                    <span className="font-semibold text-amber-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> {activeItemModal.energy}%
                    </span>
                  </div>
                )}
                {activeItemModal.locationName && (
                  <div>
                    <span className="text-slate-500 block">Location</span>
                    <span className="font-semibold text-teal-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-teal-400" /> {activeItemModal.locationName}
                    </span>
                  </div>
                )}
                {activeItemModal.importance && (
                  <div>
                    <span className="text-slate-500 block">Importance</span>
                    <span className="font-semibold text-purple-300">
                      {activeItemModal.importance}/5 ⭐
                    </span>
                  </div>
                )}
                {activeItemModal.status && (
                  <div>
                    <span className="text-slate-500 block">Status</span>
                    <span className="font-semibold text-emerald-300 capitalize">
                      {activeItemModal.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Description Body */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Narrative & Content
                </h4>
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {activeItemModal.description || 'No detailed narrative recorded for this event.'}
                </div>
              </div>

              {/* Tags */}
              {activeItemModal.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Associated Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activeItemModal.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300 border border-slate-700"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Entry Action Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={() => setActiveItemModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                >
                  Close
                </button>

                {activeItemModal.sourceEntryId && onOpenEntry && (
                  <button
                    onClick={() => {
                      const entryId = activeItemModal.sourceEntryId!;
                      setActiveItemModal(null);
                      onOpenEntry(entryId);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition"
                  >
                    <span>View Source Entry</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
