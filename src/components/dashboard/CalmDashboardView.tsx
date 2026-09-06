import React, { useMemo } from 'react';
import {
  PenTool,
  Sparkles,
  Brain,
  Target,
  Calendar,
  Clock,
  ChevronRight,
  Sun,
  Moon,
  Compass,
  Award,
  BookOpen,
  Heart,
  Plus,
  ArrowRight,
  History,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, TimelineEvent, Insight } from '../../data/models';
import { getOnThisDayEntries } from '../../services/onThisDay';

export interface CalmDashboardViewProps {
  entries?: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  timelineEvents?: TimelineEvent[];
  insights?: Insight[];
  currentUserId: string;
  onOpenComposer: (mode?: string, initialText?: string) => void;
  onSelectEntry: (entryId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export const CalmDashboardView: React.FC<CalmDashboardViewProps> = ({
  entries = [],
  memories = [],
  goals = [],
  timelineEvents = [],
  insights = [],
  currentUserId,
  onOpenComposer,
  onSelectEntry,
  onNavigateToTab,
}) => {
  const now = new Date();
  const currentHour = now.getHours();

  // Time-aware greeting
  const greeting = useMemo(() => {
    if (currentHour < 12) return { text: 'Good Morning', icon: <Sun className="w-5 h-5 text-amber-400" /> };
    if (currentHour < 18) return { text: 'Good Afternoon', icon: <Sun className="w-5 h-5 text-orange-400" /> };
    return { text: 'Good Evening', icon: <Moon className="w-5 h-5 text-indigo-400" /> };
  }, [currentHour]);

  // Today's entry detection
  const todayEntry = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);
    return entries.find((e) => {
      if (!e || !e.createdAt?.toDate) return false;
      return e.createdAt.toDate().toISOString().slice(0, 10) === todayStr;
    });
  }, [entries, now]);

  // On This Day historical entries
  const onThisDayGroups = useMemo(() => {
    return getOnThisDayEntries({ entries, currentUserId, targetDate: now });
  }, [entries, now, currentUserId]);

  // Active goals
  const activeGoals = useMemo(() => {
    return goals.filter((g) => g.status === 'active').slice(0, 3);
  }, [goals]);

  // Saved memories
  const recentMemories = useMemo(() => {
    return memories.slice(0, 3);
  }, [memories]);

  // Recent timeline events
  const recentTimeline = useMemo(() => {
    return timelineEvents.slice(0, 4);
  }, [timelineEvents]);

  // Daily reflection prompt
  const dailyPrompt = useMemo(() => {
    if (currentHour < 12) {
      return {
        mode: 'morning',
        text: 'What intention or state of mind do you want to cultivate today?',
      };
    } else if (currentHour < 18) {
      return {
        mode: 'work',
        text: 'What progress or meaningful moment stood out during your day so far?',
      };
    } else {
      return {
        mode: 'evening',
        text: 'What are you ready to release from today, and what are you grateful for?',
      };
    }
  }, [currentHour]);

  const latestInsight = insights[0] || null;
  const isNewUser = entries.length === 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Calm Header & Serene Greeting */}
      <div className="relative p-8 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/20 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-12 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            {greeting.icon}
            <span className="text-xs uppercase tracking-widest text-purple-300 font-semibold">
              {greeting.text}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {isNewUser ? 'Welcome to Your Personal Sanctuary' : 'Welcome back to your calm space'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {isNewUser
              ? 'JOURNAL∞ is your private, reflective space. Begin your journey today by capturing your thoughts, memories, and aspirations.'
              : 'Take a slow breath. Take a moment to write, reflect, or review your personal journey.'}
          </p>
        </div>
      </div>

      {/* Primary Call to Action: Today's Journal Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200">
            <PenTool className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold tracking-wide">Today's Journal</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {todayEntry ? (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-100">{todayEntry.title || 'Today\'s Journal Entry'}</span>
              <span className="text-[11px] bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
                Written Today
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{todayEntry.body}</p>
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-slate-400 font-mono">
                {todayEntry.body.split(/\s+/).filter(Boolean).length} words
              </div>
              <button
                onClick={() => onSelectEntry(todayEntry.id)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
              >
                <span>View & Continue Writing</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-slate-950 border border-emerald-500/20 space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-100">You haven't written in your journal today yet.</div>
              <div className="text-xs text-slate-400">
                Capturing just a few sentences daily builds clarity and creates lifelong personal memories.
              </div>
            </div>
            <button
              onClick={() => onOpenComposer(dailyPrompt.mode)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Write Today's Journal Entry</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid: Reflection Prompt & On This Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Reflection Prompt */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-300">
              <Compass className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-wide">Daily Reflection Prompt</h3>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-medium italic leading-relaxed">
              "{dailyPrompt.text}"
            </div>
          </div>

          <button
            onClick={() => onOpenComposer(dailyPrompt.mode, dailyPrompt.text)}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-amber-600/30 hover:border-amber-500/40 text-amber-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Reflect on This Prompt</span>
          </button>
        </div>

        {/* On This Day Card */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-300">
              <History className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-wide">On This Day</h3>
            </div>

            {onThisDayGroups.length > 0 && onThisDayGroups[0].entries.length > 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-indigo-300">
                  {onThisDayGroups[0].yearsAgo} {onThisDayGroups[0].yearsAgo === 1 ? 'Year' : 'Years'} Ago Today
                </div>
                <div className="text-xs text-slate-200 font-medium">
                  {onThisDayGroups[0].entries[0].title || 'Historical Entry'}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{onThisDayGroups[0].entries[0].body}</p>
                <button
                  onClick={() => onSelectEntry(onThisDayGroups[0].entries[0].id)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 pt-1"
                >
                  <span>Open Original Entry</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">No past entries on this exact date yet.</div>
                <div>Write an entry today to create memories for your future self to look back on!</div>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateToTab('on-this-day')}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-indigo-600/30 text-indigo-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition"
          >
            <span>Explore On This Day Memories</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid: Active Goals & Recent Memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Goals */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Target className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-wide">Active Goals</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('goals')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeGoals.length > 0 ? (
            <div className="space-y-3">
              {activeGoals.map((goal) => (
                <div key={goal.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{goal.title}</span>
                    <span className="text-[11px] text-emerald-400 font-mono font-semibold">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <Target className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-300">No active goals yet</div>
              <div className="text-[11px] text-slate-500">Set your first personal goal to track growth over time.</div>
            </div>
          )}
        </div>

        {/* Recent Memories */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Brain className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-wide">Personal Memories</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('memories')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentMemories.length > 0 ? (
            <div className="space-y-3">
              {recentMemories.map((mem) => (
                <div key={mem.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{mem.title}</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 uppercase font-semibold">
                      {mem.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{mem.narrative}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <Brain className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-300">Your memory bank is ready</div>
              <div className="text-[11px] text-slate-500">
                Gemini will propose key memories from your journal entries for your review.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional AI Reflection Insight */}
      {latestInsight && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-sm font-bold tracking-wide">Recent Reflection Insight</h3>
          </div>
          <div className="text-xs font-semibold text-slate-200">{latestInsight.title}</div>
          <p className="text-xs text-slate-300 leading-relaxed">{latestInsight.narrative}</p>
        </div>
      )}
    </div>
  );
};
