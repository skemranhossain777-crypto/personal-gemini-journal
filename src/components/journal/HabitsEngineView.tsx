import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  CheckCircle2,
  Circle,
  PlusCircle,
  Sparkles,
  Calendar,
  Clock,
  BookOpen,
  X,
  Edit3,
  Trash2,
  MessageSquareHeart,
  ShieldCheck,
  RotateCcw,
  Check,
  Search,
} from 'lucide-react';
import type { Habit, HabitFrequency, JournalEntry } from '../../data/models';
import {
  filterUserHabits,
  calculateHabitsStats,
  logHabitCompletion,
  findHabitJournalEvidence,
  suggestHabitsFromJournal,
  toMidnight,
  type HabitSuggestionProposal,
} from '../../services/habitsEngine';
import { formatEntryDate, formatShortDate, buildSnippet } from '../../journal/format';
import { Timestamp } from 'firebase/firestore';

export interface HabitsEngineViewProps {
  habits: Habit[];
  entries: JournalEntry[];
  currentUserId: string;
  onCreateHabit?: (newHabitInput: Partial<Habit>) => void;
  onUpdateHabit?: (habitId: string, updates: Partial<Habit>) => void;
  onDeleteHabit?: (habitId: string) => void;
  onOpenEntry?: (entryId: string) => void;
  onCreateHabitReflection?: (habit: Habit) => void;
  className?: string;
}

export const HabitsEngineView: React.FC<HabitsEngineViewProps> = ({
  habits,
  entries,
  currentUserId,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
  onOpenEntry,
  onCreateHabitReflection,
  className = '',
}) => {
  // Filter user habits strictly by ownership boundary
  const userHabits = useMemo(() => filterUserHabits(habits, currentUserId), [habits, currentUserId]);
  const userEntries = useMemo(
    () => entries.filter((e) => e.uid === currentUserId && !e.archived),
    [entries, currentUserId]
  );

  // Stats
  const stats = useMemo(() => calculateHabitsStats(userHabits), [userHabits]);

  // AI Suggestions
  const aiSuggestions = useMemo(
    () => suggestHabitsFromJournal(userEntries, userHabits, currentUserId),
    [userEntries, userHabits, currentUserId]
  );

  // Modals & State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);
  const [activeEvidenceHabit, setActiveEvidenceHabit] = useState<Habit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');

  // Filtered habits
  const filteredHabits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return userHabits;
    return userHabits.filter(
      (h) => h.name.toLowerCase().includes(q) || h.description.toLowerCase().includes(q)
    );
  }, [userHabits, searchQuery]);

  // Toggle Today's Completion
  const handleToggleToday = (habit: Habit) => {
    const today = new Date();
    const todayMidnight = toMidnight(today).getTime();
    const isLoggedToday = (habit.log || []).some((e) => {
      const d = e.date ? (typeof e.date.toDate === 'function' ? e.date.toDate() : new Date((e.date as any).seconds * 1000)) : null;
      return e.done && d && toMidnight(d).getTime() === todayMidnight;
    });

    const updated = logHabitCompletion(habit, today, !isLoggedToday);
    onUpdateHabit?.(habit.id, {
      log: updated.log,
      streak: updated.streak,
    });
  };

  // Submit Habit Creation
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateHabit?.({
      name: name.trim(),
      description: description.trim(),
      frequency,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      streak: 0,
      log: [],
    });

    setName('');
    setDescription('');
    setFrequency('daily');
    setCreateModalOpen(false);
  };

  // Accept Gemini AI Suggestion
  const handleAcceptSuggestion = (suggestion: HabitSuggestionProposal) => {
    onCreateHabit?.({
      name: suggestion.name,
      description: suggestion.description,
      frequency: suggestion.frequency,
      daysOfWeek: suggestion.daysOfWeek,
      streak: 0,
      log: [],
    });

    setSuggestionsModalOpen(false);
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Hero Banner & Stats */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-950/60 via-slate-900/90 to-amber-950/50 p-6 md:p-8 border border-orange-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-semibold tracking-wide">
              <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              <span>REFLECTION-ANCHORED HABITS</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-100 via-amber-100 to-yellow-200 bg-clip-text text-transparent">
              Habits & Reflective Rhythms
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Habits in JOURNAL∞ are simple reflection anchors. Log your daily rhythms and turn habit check-ins into deeper journal entries.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex items-center gap-4 bg-slate-900/70 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
              <div className="text-center px-2">
                <div className="text-xl font-bold text-orange-400 flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 fill-orange-400" /> {stats.activeStreaks}
                </div>
                <div className="text-[11px] text-slate-400">Active Streaks</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center px-2">
                <div className="text-xl font-bold text-amber-300">{stats.longestStreak}d</div>
                <div className="text-[11px] text-slate-400">Longest Streak</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center px-2">
                <div className="text-xl font-bold text-emerald-300">{stats.completedTodayCount}/{stats.total}</div>
                <div className="text-[11px] text-slate-400">Done Today</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Habit</span>
              </button>

              {aiSuggestions.length > 0 && (
                <button
                  onClick={() => setSuggestionsModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>AI Suggestions ({aiSuggestions.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search habits..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Habits Grid */}
      {filteredHabits.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
            <Flame className="w-6 h-6 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No Habits Configured</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Habits in JOURNAL∞ help anchor your daily reflections. Create a habit to start tracking rhythms.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold shadow-md shadow-orange-600/20 hover:bg-orange-500 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Your First Habit</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredHabits.map((habit) => {
            const todayMidnight = toMidnight(new Date()).getTime();
            const isDoneToday = (habit.log || []).some((e) => {
              const d = e.date ? (typeof e.date.toDate === 'function' ? e.date.toDate() : new Date((e.date as any).seconds * 1000)) : null;
              return e.done && d && toMidnight(d).getTime() === todayMidnight;
            });

            const habitEvidences = findHabitJournalEvidence(habit, userEntries, currentUserId);

            return (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl bg-slate-900/80 border border-slate-800 p-6 backdrop-blur-md hover:border-orange-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Row: Name, Frequency, Streak */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[11px] font-semibold text-orange-300 uppercase tracking-wider">
                          {habit.frequency}
                        </span>
                        {habitEvidences.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-indigo-400" /> {habitEvidences.length} Evidences
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-100">{habit.name}</h3>
                      {habit.description && (
                        <p className="text-sm text-slate-300/90 leading-relaxed line-clamp-2">
                          {habit.description}
                        </p>
                      )}
                    </div>

                    {/* Streak Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-orange-300 font-extrabold text-sm shrink-0">
                      <Flame className="w-4 h-4 fill-orange-400 text-orange-400 animate-pulse" />
                      <span>{habit.streak || 0}d streak</span>
                    </div>
                  </div>

                  {/* Completion Action for Today */}
                  <button
                    onClick={() => handleToggleToday(habit)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition shadow-md ${
                      isDoneToday
                        ? 'bg-emerald-600/90 hover:bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {isDoneToday ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>Completed Today! (Click to Undo)</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 text-slate-400" />
                        <span>Mark Completed Today</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bottom Card Action Bar */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {onCreateHabitReflection && (
                      <button
                        onClick={() => onCreateHabitReflection(habit)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/40 text-purple-200 text-xs font-medium transition"
                        title="Reflect on this habit in your journal"
                      >
                        <MessageSquareHeart className="w-3.5 h-3.5 text-purple-400" />
                        <span>Reflect</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveEvidenceHabit(habit)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/40 text-indigo-200 text-xs font-medium transition"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Evidence ({habitEvidences.length})</span>
                    </button>
                  </div>

                  {onDeleteHabit && (
                    <button
                      onClick={() => onDeleteHabit(habit.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition"
                      title="Delete Habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Habit Journal Evidence Drawer / Modal */}
      <AnimatePresence>
        {activeEvidenceHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl"
            >
              <button
                onClick={() => setActiveEvidenceHabit(null)}
                className="absolute right-4 top-4 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  <span>HABIT JOURNAL EVIDENCE</span>
                </div>
                <h3 className="text-xl font-bold text-slate-100">
                  {activeEvidenceHabit.name}
                </h3>
              </div>

              {(() => {
                const evidences = findHabitJournalEvidence(activeEvidenceHabit, userEntries, currentUserId);
                if (evidences.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 space-y-2">
                      <p>No journal reflections currently mention "{activeEvidenceHabit.name}".</p>
                      <p className="text-slate-500">Write a reflection or tag an entry to connect habit evidence.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {evidences.map((entry) => (
                      <div key={entry.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{entry.title || 'Untitled Entry'}</span>
                          <span className="text-slate-400">{formatEntryDate(entry.createdAt)}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{buildSnippet(entry.body, 140)}</p>
                        {onOpenEntry && (
                          <button
                            onClick={() => {
                              setActiveEvidenceHabit(null);
                              onOpenEntry(entry.id);
                            }}
                            className="text-purple-400 hover:underline font-semibold flex items-center gap-1 pt-1"
                          >
                            <span>Open Source Entry</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={() => setActiveEvidenceHabit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gemini AI Habit Suggestions Modal */}
      <AnimatePresence>
        {suggestionsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-500/40 p-6 md:p-8 space-y-6 shadow-2xl"
            >
              <button
                onClick={() => setSuggestionsModalOpen(false)}
                className="absolute right-4 top-4 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>GEMINI HABIT CANDIDATES</span>
                </div>
                <h3 className="text-xl font-bold text-slate-100">
                  AI Suggested Habit Anchors
                </h3>
                <p className="text-xs text-slate-400">
                  Gemini detected repeating behaviors in your journal reflections. Confirm to create a habit.
                </p>
              </div>

              <div className="space-y-4">
                {aiSuggestions.map((sug) => (
                  <div key={sug.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-sm">{sug.name}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-semibold uppercase">
                          {sug.frequency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{sug.description}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-200">
                      💡 {sug.reasoning}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> User Confirmation Required
                      </span>

                      <button
                        onClick={() => handleAcceptSuggestion(sug)}
                        className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-600/30 transition"
                      >
                        Accept & Create Habit
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={() => setSuggestionsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Habit Creation Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-5 shadow-2xl"
            >
              <button
                onClick={() => setCreateModalOpen(false)}
                className="absolute right-4 top-4 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-orange-400" />
                <span>Create New Habit Anchor</span>
              </h2>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Habit Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Morning Meditation, 20 Min Reading"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the intention behind this habit rhythm..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition shadow-lg shadow-orange-600/30"
                  >
                    Save Habit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
