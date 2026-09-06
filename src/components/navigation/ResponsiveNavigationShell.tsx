import React, { useState, useEffect } from 'react';
import {
  Home,
  BookOpen,
  Brain,
  Calendar,
  Sparkles,
  Shield,
  Plus,
  LogOut,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, TimelineEvent, Insight } from '../../data/models';
import { CalmDashboardView } from '../dashboard/CalmDashboardView';
import { JournalWorkspace } from '../../pages/journal/JournalWorkspace';
import { LoadingState } from '../ui/LoadingState';

const MemoryEngineView = React.lazy(() =>
  import('../journal/MemoryEngineView').then((m) => ({ default: m.MemoryEngineView })),
);
const LifeTimelineView = React.lazy(() =>
  import('../journal/LifeTimelineView').then((m) => ({ default: m.LifeTimelineView })),
);
const AskMyLifeView = React.lazy(() =>
  import('../journal/AskMyLifeView').then((m) => ({ default: m.AskMyLifeView })),
);
const PrivacyCenterView = React.lazy(() =>
  import('../privacy/PrivacyCenterView').then((m) => ({ default: m.PrivacyCenterView })),
);

export type NavTab = 'home' | 'journal' | 'memories' | 'timeline' | 'ask-my-life' | 'profile';

export interface ResponsiveNavigationShellProps {
  currentUserId: string;
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  timelineEvents: TimelineEvent[];
  insights?: Insight[];
  onSignOut?: () => void;
  onUpdateEntries?: (entries: JournalEntry[]) => void;
  onUpdateMemories?: (memories: Memory[]) => void;
  onUpdateGoals?: (goals: Goal[]) => void;
  initialTab?: NavTab;
  initialEntryId?: string | null;
  initialComposerNew?: boolean;
  initialJournalSubview?: 'journal' | 'companion';
  companionWorkspace?: React.ReactNode;
}

export const ResponsiveNavigationShell: React.FC<ResponsiveNavigationShellProps> = ({
  currentUserId,
  entries,
  memories,
  goals,
  timelineEvents,
  insights = [],
  onSignOut,
  onUpdateEntries,
  onUpdateMemories,
  onUpdateGoals,
  initialTab,
  initialEntryId = null,
  initialComposerNew = false,
  initialJournalSubview,
  companionWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab ?? 'home');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(initialEntryId ?? null);
  const [isComposerNew, setIsComposerNew] = useState(initialComposerNew ?? false);
  const [journalSubview, setJournalSubview] = useState<'journal' | 'companion'>(initialJournalSubview ?? 'journal');

  const NAV_ITEMS: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'journal', label: 'Journal', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'memories', label: 'Memories', icon: <Brain className="w-5 h-5" /> },
    { id: 'timeline', label: 'Timeline', icon: <Calendar className="w-5 h-5" /> },
    { id: 'ask-my-life', label: 'Ask My Life', icon: <Sparkles className="w-5 h-5" /> },
    { id: 'profile', label: 'Privacy', icon: <Shield className="w-5 h-5" /> },
  ];

  const handleOpenComposer = (mode?: string, initialText?: string) => {
    setIsComposerNew(true);
    setEditingEntryId(null);
    setJournalSubview('journal');
    setActiveTab('journal');
  };

  const handleOpenEntry = (entryId: string) => {
    setIsComposerNew(false);
    setEditingEntryId(entryId);
    setJournalSubview('journal');
    setActiveTab('journal');
  };

  const handleNavigateToTab = (tabId: string) => {
    if (NAV_ITEMS.some((n) => n.id === tabId)) {
      setActiveTab(tabId as NavTab);
    }
  };

  // Sync composer/companion state from hash routes (#/journal, #/journal/new,
  // #/journal/:id, #/app) so deep links and the command palette stay wired to
  // the shell after it mounts.
  useEffect(() => {
    const onNav = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/app')) {
        setActiveTab('journal');
        setJournalSubview('companion');
        return;
      }
      if (hash.startsWith('#/journal/new')) {
        setActiveTab('journal');
        setJournalSubview('journal');
        setIsComposerNew(true);
        setEditingEntryId(null);
        return;
      }
      if (hash.startsWith('#/journal/')) {
        const id = hash.replace(/^#\/journal\//, '');
        if (id && id !== 'new') {
          setActiveTab('journal');
          setJournalSubview('journal');
          setIsComposerNew(false);
          setEditingEntryId(id);
        }
      }
    };
    window.addEventListener('hashchange', onNav);
    return () => window.removeEventListener('hashchange', onNav);
  }, []);

  return (
    <div className="min-h-screen bg-[#070B16] text-[#D9E2F5] flex flex-col md:flex-row overflow-x-hidden selection:bg-purple-500/30">
      {/* Skip to Main Content link for screen reader and keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-xs font-bold"
      >
        Skip to main content
      </a>

      {/* ── Desktop Left Sidebar Navigation (hidden on mobile < 768px) ── */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-slate-950 border-r border-slate-800/80 shrink-0 sticky top-0 h-screen p-5 justify-between z-30">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 font-bold text-lg" aria-hidden="true">
              ∞
            </div>
            <div>
              <div className="text-base font-extrabold text-white tracking-wider">JOURNAL∞</div>
              <div className="text-[10px] text-purple-400 font-medium tracking-widest uppercase">Personal Sanctuary</div>
            </div>
          </div>

          {/* Quick Action */}
          <button
            onClick={() => handleOpenComposer()}
            aria-label="Create New Journal Reflection"
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all transform active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 min-h-[44px]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Reflection</span>
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Desktop Primary Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'journal') {
                      setEditingEntryId(null);
                      setIsComposerNew(false);
                    }
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                    isActive
                      ? 'bg-purple-950/60 text-purple-200 border border-purple-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className={isActive ? 'text-purple-400' : 'text-slate-400'} aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="pt-4 border-t border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-xs shrink-0" aria-hidden="true">
              {currentUserId.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-xs text-slate-300 truncate font-medium">{currentUserId}</div>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              aria-label="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile Top Header (hidden on desktop >= 768px) ── */}
      <header className="md:hidden sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm" aria-hidden="true">
            ∞
          </div>
          <span className="text-sm font-bold text-white tracking-wide">JOURNAL∞</span>
        </div>

        <button
          onClick={() => handleOpenComposer()}
          aria-label="Create New Journal Entry"
          className="p-2 rounded-xl bg-purple-600 text-white min-h-[44px] min-w-[44px] flex items-center justify-center shadow-md active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          title="New Journal Entry"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {/* ── Main Content Area ── */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto focus:outline-none">
        <div className="max-w-6xl mx-auto w-full">
          <React.Suspense fallback={<LoadingState label="Loading view..." />}>
            {activeTab === 'home' && (
              <CalmDashboardView
                entries={entries}
                memories={memories}
                goals={goals}
                timelineEvents={timelineEvents}
                insights={insights}
                currentUserId={currentUserId}
                onOpenComposer={handleOpenComposer}
                onSelectEntry={handleOpenEntry}
                onNavigateToTab={handleNavigateToTab}
              />
            )}

            {activeTab === 'journal' && (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit"
                  role="tablist"
                  aria-label="Journal view"
                >
                  {(
                    [
                      { id: 'journal', label: 'Journal' },
                      { id: 'companion', label: 'AI Companion' },
                    ] as const
                  ).map((sub) => {
                    const isActive = journalSubview === sub.id;
                    return (
                      <button
                        key={sub.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setJournalSubview(sub.id)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] min-w-[44px] ${
                          isActive
                            ? 'bg-purple-950/60 text-purple-200 border border-purple-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>

                {journalSubview === 'companion' && companionWorkspace ? (
                  companionWorkspace
                ) : (
                  <JournalWorkspace
                    entryId={editingEntryId}
                    isNew={isComposerNew}
                    onNavigateHome={() => {
                      setEditingEntryId(null);
                      setIsComposerNew(false);
                    }}
                    onOpenNew={() => handleOpenComposer()}
                    onOpenEntry={(id) => handleOpenEntry(id)}
                  />
                )}
              </div>
            )}

            {activeTab === 'memories' && (
              <MemoryEngineView
                userId={currentUserId}
                memories={memories}
                onViewSourceEntry={handleOpenEntry}
              />
            )}

            {activeTab === 'timeline' && (
              <LifeTimelineView
                entries={entries}
                memories={memories}
                goals={goals}
                timelineEvents={timelineEvents}
                onOpenEntry={handleOpenEntry}
              />
            )}

            {activeTab === 'ask-my-life' && (
              <AskMyLifeView
                entries={entries}
                memories={memories}
                goals={goals}
                timelineEvents={timelineEvents}
                onOpenEntry={handleOpenEntry}
              />
            )}

            {activeTab === 'profile' && (
              <PrivacyCenterView
                entries={entries}
                memories={memories}
                goals={goals}
                currentUserId={currentUserId}
                onUpdateEntries={onUpdateEntries}
                onUpdateMemories={onUpdateMemories}
                onUpdateGoals={onUpdateGoals}
              />
            )}
          </React.Suspense>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation Bar (hidden on desktop >= 768px) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1 flex items-center justify-around pb-safe shadow-2xl"
        aria-label="Mobile Bottom Navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== 'journal') {
                  setEditingEntryId(null);
                  setIsComposerNew(false);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[44px] min-w-[44px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                isActive ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-purple-500/15' : ''}`} aria-hidden="true">
                {item.icon}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
