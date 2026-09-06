import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Sparkles,
  Heart,
  Zap,
  MapPin,
  Star,
  BookOpen,
  Brain,
  PlusCircle,
  ExternalLink,
  Clock,
  ChevronRight,
  MessageSquareHeart,
} from 'lucide-react';
import type { JournalEntry } from '../../data/models';
import { getOnThisDayEntries, type OnThisDayGroup } from '../../services/onThisDay';
import { formatEntryDate, buildSnippet } from '../../journal/format';

export interface OnThisDayViewProps {
  entries: JournalEntry[];
  currentUserId: string;
  targetDate?: Date;
  timeZone?: string;
  onOpenEntry?: (entryId: string) => void;
  onToggleFavorite?: (entry: JournalEntry) => void;
  onCreateReflection?: (sourceEntry?: JournalEntry) => void;
  onCreateMemory?: (sourceEntry: JournalEntry) => void;
  className?: string;
}

export const OnThisDayView: React.FC<OnThisDayViewProps> = ({
  entries,
  currentUserId,
  targetDate = new Date(),
  timeZone,
  onOpenEntry,
  onToggleFavorite,
  onCreateReflection,
  onCreateMemory,
  className = '',
}) => {
  // Compute On This Day groups
  const groups: OnThisDayGroup[] = useMemo(
    () =>
      getOnThisDayEntries({
        entries,
        currentUserId,
        targetDate,
        timeZone,
      }),
    [entries, currentUserId, targetDate, timeZone]
  );

  const formattedTargetDate = useMemo(() => {
    return targetDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }, [targetDate]);

  const totalHistoricalEntries = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.entries.length, 0);
  }, [groups]);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/60 via-slate-900/90 to-purple-950/50 p-6 md:p-8 border border-amber-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wide">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>ON THIS DAY • {formattedTargetDate}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-100 via-purple-100 to-indigo-200 bg-clip-text text-transparent">
              Echoes of Your Past
            </h1>
            <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
              Step back into your personal history and revisit how you felt, thought, and lived on this exact day in previous years.
            </p>
          </div>

          {totalHistoricalEntries > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-center shrink-0">
              <div className="text-2xl font-extrabold text-amber-300">{totalHistoricalEntries}</div>
              <div className="text-xs text-slate-400">Past Memories Found</div>
            </div>
          )}
        </div>
      </div>

      {/* Empty State when no historical entries match */}
      {groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 px-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-5"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-200">
              No Past Memories Recorded for {formattedTargetDate}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Today is a clean canvas. Write a reflection today to leave a meaningful memory for your future self to look back on.
            </p>
          </div>
          {onCreateReflection && (
            <button
              onClick={() => onCreateReflection()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Start Today's Reflection</span>
            </button>
          )}
        </motion.div>
      ) : (
        /* Populated Historical Groups */
        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.yearsAgo} className="space-y-4">
              {/* Group Emotional Header */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-bold shadow-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{group.yearsAgoLabel}</span>
                  <span className="text-xs text-amber-400/80 font-normal">({group.year})</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/30 to-transparent" />
              </div>

              {/* Cards under this historical year */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 backdrop-blur-md hover:border-amber-500/40 hover:bg-slate-900 transition-all duration-300 shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Row: Date, Mode, Favorite */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[11px] font-medium text-purple-300 capitalize">
                            {entry.mode || 'Free Write'}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {formatEntryDate(entry.createdAt)}
                          </span>
                        </div>

                        {/* Favorite Action Button */}
                        <button
                          onClick={() => onToggleFavorite?.(entry)}
                          aria-label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
                          aria-pressed={entry.favorite}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-400 transition"
                          title={entry.favorite ? 'Unfavorite entry' : 'Favorite entry'}
                        >
                          <Star
                            className={`w-4 h-4 ${entry.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`}
                          />
                        </button>
                      </div>

                      {/* Entry Title */}
                      <h3
                        onClick={() => onOpenEntry?.(entry.id)}
                        className="text-base font-bold text-slate-100 group-hover:text-amber-200 cursor-pointer transition line-clamp-1"
                      >
                        {entry.title || 'Untitled Reflection'}
                      </h3>

                      {/* Snippet */}
                      <p className="text-sm text-slate-300/90 leading-relaxed line-clamp-3">
                        {buildSnippet(entry.body, 160)}
                      </p>

                      {/* Metrics: Mood, Energy, Location */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {entry.mood && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
                            <Heart className="w-3 h-3 text-rose-400" /> Mood {entry.mood}/5
                          </span>
                        )}

                        {entry.energy !== null && entry.energy !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                            <Zap className="w-3 h-3 text-amber-400" /> Energy {entry.energy}%
                          </span>
                        )}

                        {entry.location?.placeName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-300">
                            <MapPin className="w-3 h-3 text-teal-400" /> {entry.location.placeName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Toolbar */}
                    <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => onOpenEntry?.(entry.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Entry</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {onCreateReflection && (
                          <button
                            onClick={() => onCreateReflection(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/40 text-purple-200 text-xs font-medium transition"
                            title="Write a new reflection inspired by this past entry"
                          >
                            <MessageSquareHeart className="w-3.5 h-3.5 text-purple-400" />
                            <span>Reflect</span>
                          </button>
                        )}

                        {onCreateMemory && (
                          <button
                            onClick={() => onCreateMemory(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/40 text-indigo-200 text-xs font-medium transition"
                            title="Turn this past entry into a memory candidate"
                          >
                            <Brain className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Memory</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
