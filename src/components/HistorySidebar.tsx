import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  MessageSquare,
  Tag,
  Filter,
  Flame,
  FileText,
  PenLine,
} from 'lucide-react';
import type { JournalInteraction, ReflectionMode } from '../types';

interface HistorySidebarProps {
  interactions: JournalInteraction[];
  selectedId: string | null;
  onSelect: (interaction: JournalInteraction) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  isLoading: boolean;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  interactions,
  selectedId,
  onSelect,
  onNew,
  onDelete,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      const matchesFilter = selectedFilter === 'all' || item.mode === selectedFilter;
      if (!matchesFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const summaryMatch = item.summary?.toLowerCase().includes(q);
      const tagsMatch = item.tags?.some((t) => t.toLowerCase().includes(q));
      const messageMatch = item.messages?.some((m) => m.content.toLowerCase().includes(q));

      return titleMatch || summaryMatch || tagsMatch || messageMatch;
    });
  }, [interactions, searchQuery, selectedFilter]);

  const getModeBadge = (mode: ReflectionMode) => {
    switch (mode) {
      case 'summarize':
        return { label: 'Summary', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' };
      case 'brainstorm':
        return { label: 'Brainstorm', color: 'bg-amber-950/40 text-amber-400 border-amber-800/40' };
      case 'chat':
        return { label: 'Dialogue', color: 'bg-blue-950/40 text-blue-400 border-blue-800/40' };
      case 'reflect':
      default:
        return { label: 'Reflect', color: 'bg-purple-950/40 text-purple-400 border-purple-800/40' };
    }
  };

  // Journaling stats: total entries, total words written, and current streak.
  const stats = useMemo(() => {
    let totalWords = 0;
    let totalMessages = 0;
    const days = new Set<string>();
    interactions.forEach((item) => {
      totalMessages += item.messages?.length || 0;
      (item.messages || []).forEach((m) => {
        const trimmed = m.content.trim();
        totalWords += trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
      });
      const d = new Date(item.createdAt || item.updatedAt);
      if (!isNaN(d.getTime())) days.add(d.toISOString().slice(0, 10));
    });

    let streak = 0;
    const cursor = new Date();
    const todayKey = cursor.toISOString().slice(0, 10);
    if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { totalWords, totalMessages, streak };
  }, [interactions]);

  const formatRelativeTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'Recently';
      const diffMs = Date.now() - d.getTime();
      const minutes = Math.floor(diffMs / 60_000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      const oneWeekAgo = new Date();
      oneWeekAgo.setHours(0, 0, 0, 0);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
      if (d >= oneWeekAgo) {
        return d.toLocaleDateString(undefined, { weekday: 'short' });
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const fullDateLabel = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <aside className="flex flex-col h-full border-r border-[#262629] bg-[#121214] text-[#E0E0E0]">
      {/* Sidebar Header & New Button */}
      <div className="p-4 border-b border-[#262629] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#888]">
            Past Reflections
          </h2>
          <span className="text-xs font-medium text-[#666]">
            {interactions.length} {interactions.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        <button
          id="history-new-btn"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1A1A1C] border border-[#333338] py-2.5 px-3 text-xs font-medium text-[#F1F1F1] shadow-sm hover:bg-[#242428] hover:border-[#44444C] active:scale-98 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>New Journal Entry</span>
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666]" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Search entries, keywords, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#262629] bg-[#161619] pl-8 pr-3 py-1.5 text-xs text-[#F1F1F1] placeholder:text-[#666] focus:border-[#444] focus:bg-[#1A1A1C] focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <Filter className="h-3 w-3 text-[#666] shrink-0" />
          {[
            { id: 'all', label: 'All' },
            { id: 'reflect', label: 'Reflect' },
            { id: 'summarize', label: 'Summary' },
            { id: 'brainstorm', label: 'Ideas' },
            { id: 'chat', label: 'Dialogue' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`rounded-md px-2 py-0.5 whitespace-nowrap transition-colors ${
                selectedFilter === tab.id
                  ? 'bg-[#24242A] text-[#F1F1F1] font-medium border border-[#3E3E44]'
                  : 'bg-[#161619] text-[#888] border border-transparent hover:text-[#E0E0E0] hover:bg-[#1C1C20]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && interactions.length === 0 ? (
          <div className="space-y-2" aria-label="Loading reflections">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-[#262629] bg-[#141416] p-3 animate-pulse"
              >
                <div className="h-3 w-2/3 rounded bg-[#262629]" />
                <div className="h-2.5 w-full rounded bg-[#1E1E24]" />
                <div className="h-2.5 w-1/2 rounded bg-[#1E1E24]" />
                <div className="mt-1 flex items-center justify-between">
                  <div className="h-4 w-16 rounded bg-[#262629]" />
                  <div className="h-3 w-12 rounded bg-[#1E1E24]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredInteractions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#888] space-y-3">
            <div className="h-10 w-10 rounded-full bg-[#161619] border border-[#262629] flex items-center justify-center text-[#666]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#E0E0E0]">No reflections found</p>
              <p className="text-[11px] text-[#666]">
                {searchQuery ? 'Try a different search term' : 'Start your first reflection with Gemini'}
              </p>
            </div>
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const isSelected = item.id === selectedId;
            const badge = getModeBadge(item.mode);
            const turnCount = item.messages ? item.messages.length : 0;

            return (
              <div
                key={item.id}
                id={`history-item-${item.id}`}
                onClick={() => onSelect(item)}
                className={`group relative flex flex-col rounded-xl border p-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#44444C] bg-[#1A1A1C] shadow-sm'
                    : 'border-[#262629] bg-[#141416] hover:border-[#36363C] hover:bg-[#18181B]'
                }`}
              >
                {/* Top row: Title and delete button */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-xs text-[#F1F1F1] line-clamp-1">
                    {item.title || 'Untitled Reflection'}
                  </h3>
                  <button
                    id={`delete-entry-${item.id}`}
                    onClick={(e) => onDelete(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#666] hover:text-red-400 hover:bg-red-950/40 rounded transition-all shrink-0"
                    title="Delete reflection"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Summary or latest snippet */}
                <p className="mt-1 text-[11px] text-[#888] line-clamp-2 leading-relaxed">
                  {item.summary ||
                    (item.messages && item.messages.length > 0
                      ? item.messages[item.messages.length - 1].content
                      : 'No content')}
                </p>

                {/* Bottom row: Mode badge, turns, and timestamp */}
                <div className="mt-3 flex items-center justify-between gap-1 text-[10px] text-[#666]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 font-medium border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[#888]">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {turnCount}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 shrink-0 text-[#666] font-mono" title={fullDateLabel(item.updatedAt || item.createdAt)}>
                    <Calendar className="h-2.5 w-2.5" />
                    {formatRelativeTime(item.updatedAt || item.createdAt)}
                  </span>
                </div>

                {/* Tags if present */}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 overflow-hidden">
                    <Tag className="h-2.5 w-2.5 text-[#666] shrink-0" />
                    <div className="flex items-center gap-1 truncate text-[10px] text-[#888]">
                      {item.tags.slice(0, 3).map((t, idx) => (
                        <span key={idx} className="bg-[#1A1A1C] border border-[#262629] rounded px-1.5 py-0.5">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Journaling Stats Footer */}
      <div className="shrink-0 border-t border-[#262629] bg-[#121214] px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[#262629] bg-[#141416] px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] text-[#888]">
              <FileText className="h-3 w-3 text-amber-400" />
              <span>Entries</span>
            </div>
            <p className="mt-0.5 text-base font-bold text-[#F1F1F1] leading-none">
              {interactions.length}
            </p>
          </div>
          <div className="rounded-lg border border-[#262629] bg-[#141416] px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] text-[#888]">
              <PenLine className="h-3 w-3 text-emerald-400" />
              <span>Words</span>
            </div>
            <p className="mt-0.5 text-base font-bold text-[#F1F1F1] leading-none">
              {stats.totalWords.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-[#262629] bg-[#141416] px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] text-[#888]">
              <Flame className="h-3 w-3 text-orange-400" />
              <span>Streak</span>
            </div>
            <p className="mt-0.5 text-base font-bold text-[#F1F1F1] leading-none">
              {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
