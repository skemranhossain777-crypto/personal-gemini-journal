import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  Sparkles,
  Calendar,
  Tag,
  Smile,
  User,
  MapPin,
  Target,
  Folder,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import type { Collection, JournalEntry, Memory, Goal } from '../../data/models';
import {
  executeSemanticSearch,
  type SemanticSearchFilters,
  type SemanticSearchResult,
} from '../../services/semanticSearch';

interface SemanticSearchViewProps {
  entries: JournalEntry[];
  collections?: Collection[];
  memories?: Memory[];
  goals?: Goal[];
  onOpenEntry: (entryId: string) => void;
  className?: string;
}

export const SAMPLE_SEMANTIC_QUERIES = [
  'Find entries where I was worried about money.',
  'Show moments when I felt proud.',
  'Find entries about launching my business.',
  'Show entries with high energy and productivity.',
  'Where did I reflect on career growth?',
];

export const SemanticSearchView: React.FC<SemanticSearchViewProps> = ({
  entries,
  collections = [],
  memories = [],
  goals = [],
  onOpenEntry,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | ''>('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Available unique tags from entries
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [entries]);

  // Execute Semantic Search
  const searchPage = useMemo(() => {
    const filters: SemanticSearchFilters = {
      query,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      tag: selectedTag || undefined,
      mood: selectedMood !== '' ? Number(selectedMood) : undefined,
      theme: selectedTheme || undefined,
      person: selectedPerson || undefined,
      place: selectedPlace || undefined,
      goal: selectedGoal || undefined,
      collection: selectedCollection || undefined,
      page,
      pageSize: 6,
    };

    return executeSemanticSearch(entries, filters, collections, memories, goals);
  }, [
    entries,
    query,
    startDate,
    endDate,
    selectedTag,
    selectedMood,
    selectedTheme,
    selectedPerson,
    selectedPlace,
    selectedGoal,
    selectedCollection,
    page,
    collections,
    memories,
    goals,
  ]);

  const clearAllFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedTag('');
    setSelectedMood('');
    setSelectedTheme('');
    setSelectedPerson('');
    setSelectedPlace('');
    setSelectedGoal('');
    setSelectedCollection('');
    setPage(1);
  };

  const hasActiveFilters =
    query ||
    startDate ||
    endDate ||
    selectedTag ||
    selectedMood !== '' ||
    selectedTheme ||
    selectedPerson ||
    selectedPlace ||
    selectedGoal ||
    selectedCollection;

  return (
    <div
      data-testid="semantic-search-view"
      className={`flex flex-col h-full bg-[#070B16] text-[#D9E2F5] p-4 sm:p-6 space-y-6 overflow-y-auto ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#223056] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#EEF4FF]">
              Semantic Journal Search
            </h2>
            <p className="text-xs text-[#888]">
              Natural-language search over your journal history with 8-dimensional filters, relevance explanations, and owner security.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Owner Authorization Verified</span>
          </span>
        </div>
      </div>

      {/* Main Search Input & Controls */}
      <div className="rounded-2xl border border-[#223056] bg-[#0E1730] p-4 sm:p-5 space-y-3 shadow-sm">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#666]" />
          <input
            type="text"
            data-testid="semantic-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder='Try: "Find entries where I was worried about money" or "Show moments when I felt proud"'
            className="w-full rounded-xl border border-[#223056] bg-[#121E40] pl-10 pr-24 py-3 text-sm text-[#EEF4FF] placeholder:text-[#666] focus:outline-none focus:border-sky-500"
          />

          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-sky-500/50 bg-sky-500/20 text-sky-200'
                  : 'border-[#223056] bg-[#0E1730] text-[#888] hover:text-[#EEF4FF]'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Quick Sample Query Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666]">
            Try Sample Queries:
          </span>
          {SAMPLE_SEMANTIC_QUERIES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(sample);
                setPage(1);
              }}
              className="rounded-lg border border-[#223056] bg-[#121E40] px-2.5 py-1 text-xs text-[#9FB0D4] hover:border-sky-500/40 hover:bg-[#1C2C5E] hover:text-[#EEF4FF] transition-colors"
            >
              "{sample}"
            </button>
          ))}
        </div>

        {/* Expandable 8-Dimensional Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-[#223056] pt-3 mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs"
            >
              {/* 1. Date Range */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Date Range</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1 text-[11px] text-[#EEF4FF] focus:outline-none"
                  />
                  <span className="text-[#666]">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1 text-[11px] text-[#EEF4FF] focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Tag */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => {
                    setSelectedTag(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                >
                  <option value="">All Tags</option>
                  {availableTags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Mood */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Mood (1..5)</label>
                <select
                  value={selectedMood}
                  onChange={(e) => {
                    setSelectedMood(e.target.value ? Number(e.target.value) : '');
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                >
                  <option value="">All Moods</option>
                  <option value="1">1/5 — Low</option>
                  <option value="2">2/5 — Subdued</option>
                  <option value="3">3/5 — Neutral</option>
                  <option value="4">4/5 — Good</option>
                  <option value="5">5/5 — Excellent</option>
                </select>
              </div>

              {/* 4. Theme */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Theme</label>
                <select
                  value={selectedTheme}
                  onChange={(e) => {
                    setSelectedTheme(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                >
                  <option value="">All Themes</option>
                  <option value="Finance">Finance / Money</option>
                  <option value="Career">Career / Work</option>
                  <option value="Health">Health / Wellness</option>
                  <option value="Learning">Learning</option>
                  <option value="Travel">Travel</option>
                </select>
              </div>

              {/* 5. Person */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Person</label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Sarah"
                  value={selectedPerson}
                  onChange={(e) => {
                    setSelectedPerson(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                />
              </div>

              {/* 6. Place */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Place / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Coffee shop, Home"
                  value={selectedPlace}
                  onChange={(e) => {
                    setSelectedPlace(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                />
              </div>

              {/* 7. Goal */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Goal</label>
                <select
                  value={selectedGoal}
                  onChange={(e) => {
                    setSelectedGoal(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                >
                  <option value="">All Goals</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 8. Collection */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1">Collection</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => {
                    setSelectedCollection(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                >
                  <option value="">All Collections</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clear Filters bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between border-t border-[#223056]/60 pt-2 text-xs">
            <span className="text-[11px] text-[#888]">
              Filtering entries with active criteria
            </span>
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
            >
              <X className="h-3 w-3" />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Results Header & Summary */}
      <div className="flex items-center justify-between text-xs text-[#888]">
        <div>
          <span>
            Found <strong className="text-[#EEF4FF] font-semibold">{searchPage.total}</strong> matching entries
          </span>
          {searchPage.total > 0 && (
            <span className="ml-1 font-mono text-[11px]">
              (Page {searchPage.page} of {searchPage.totalPages})
            </span>
          )}
        </div>
      </div>

      {/* Search Results List */}
      <div className="space-y-4 flex-1">
        {searchPage.results.length === 0 ? (
          <div className="rounded-2xl border border-[#223056] bg-[#0E1730] p-12 text-center space-y-3 max-w-md mx-auto my-8">
            <BookOpen className="mx-auto h-8 w-8 text-[#555]" />
            <h3 className="text-sm font-semibold text-[#EEF4FF]">No Matching Entries Found</h3>
            <p className="text-xs text-[#888]">
              Try adjusting your query or clearing some filters to broaden your search results.
            </p>
          </div>
        ) : (
          searchPage.results.map((res) => {
            const entry = res.entry;
            const dateStr = entry.createdAt
              ? new Date(entry.createdAt as any).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '';

            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onOpenEntry(entry.id)}
                className="group cursor-pointer rounded-2xl border border-[#223056] bg-[#0E1730] p-5 space-y-3 hover:border-sky-500/50 hover:bg-[#121E40] transition-all shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-base font-bold text-[#EEF4FF] group-hover:text-sky-300 transition-colors">
                      {entry.title || 'Untitled Reflection'}
                    </h3>
                    <span className="text-xs text-[#666] font-mono">• {dateStr}</span>
                  </div>

                  {/* Relevance Score & Explanation */}
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-300 font-mono">
                      {res.score}% Match
                    </span>
                  </div>
                </div>

                {/* Relevance Explanation */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#888]">
                  <Sparkles className="h-3 w-3 text-sky-400 shrink-0" />
                  <span className="italic font-medium text-sky-200/90">{res.relevanceExplanation}</span>
                </div>

                {/* Preview Snippet */}
                <p className="text-xs text-[#D9E2F5]/90 leading-relaxed font-sans">
                  {res.previewSnippet}
                </p>

                {/* Footer Badges & Tags */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#223056]/60 pt-3 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.mood !== null && (
                      <span className="flex items-center gap-1 text-amber-400 bg-amber-950/30 border border-amber-800/40 px-2 py-0.5 rounded-md">
                        <Smile className="h-3 w-3" />
                        <span>Mood {entry.mood}/5</span>
                      </span>
                    )}

                    {entry.location && (
                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                        <MapPin className="h-3 w-3" />
                        <span>{entry.location.placeName}</span>
                      </span>
                    )}

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {entry.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-[#17254F] border border-[#223056] px-1.5 py-0.5 text-[10px] text-sky-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="flex items-center gap-1 text-[#888] group-hover:text-sky-400 font-medium">
                    <span>Open Entry</span>
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {searchPage.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#223056] pt-4 text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 font-medium text-[#EEF4FF] hover:bg-[#1A2957] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <span className="font-mono text-[#888]">
            Page {searchPage.page} of {searchPage.totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(searchPage.totalPages, p + 1))}
            disabled={!searchPage.hasMore}
            className="flex items-center gap-1 rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 font-medium text-[#EEF4FF] hover:bg-[#1A2957] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
