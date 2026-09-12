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
  Target,
  Search,
  X,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, Habit, TimelineEvent, Insight } from '../../data/models';
import type { JournalInteraction } from '../../types';
import {
  type UserIdentity,
  buildInitials,
  resolveDisplayName,
  resolveEmail,
  resolvePhotoURL,
} from './identity';
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
const HabitsEngineView = React.lazy(() =>
  import('../journal/HabitsEngineView').then((m) => ({ default: m.HabitsEngineView })),
);
const GoalsEngineView = React.lazy(() =>
  import('../journal/GoalsEngineView').then((m) => ({ default: m.GoalsEngineView })),
);
const ReflectionReportsView = React.lazy(() =>
  import('../journal/ReflectionReportsView').then((m) => ({ default: m.ReflectionReportsView })),
);
const SemanticSearchView = React.lazy(() =>
  import('../journal/SemanticSearchView').then((m) => ({ default: m.SemanticSearchView })),
);
import type { TabMode } from '../journal/MemoryEngineView';

export type NavTab = 'home' | 'journal' | 'memories' | 'growth' | 'timeline' | 'ask-my-life' | 'profile';

export interface ResponsiveNavigationShellProps {
  currentUserId: string;
  /** Real Firebase user identity for display. Falls back to non-UID defaults. */
  user?: UserIdentity;
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  habits: Habit[];
  timelineEvents: TimelineEvent[];
  insights?: Insight[];
  onSignOut?: () => void;
  /** Demo (guest) sessions must not see export or destructive data actions. */
  isDemo?: boolean;
  /** AI companion session history — feeds the Privacy Center AI Conversations metric. */
  aiSessions?: JournalInteraction[];
  initialTab?: NavTab;
  initialEntryId?: string | null;
  initialComposerNew?: boolean;
  initialJournalSubview?: 'journal' | 'companion';
  companionWorkspace?: React.ReactNode;
}

export const ResponsiveNavigationShell: React.FC<ResponsiveNavigationShellProps> = ({
  currentUserId,
  user,
  entries,
  memories,
  goals,
  habits,
  timelineEvents,
  insights = [],
  onSignOut,
  isDemo = false,
  aiSessions = [],
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
  const [growthSubview, setGrowthSubview] = useState<'habits' | 'goals'>('habits');
  const [memoriesSubview, setMemoriesSubview] = useState<'memories' | 'reports'>('memories');
  // Landing tab for the Memory Engine; set when arriving from the composer's
  // "Review candidates" action, reset to the default on ordinary navigation.
  const [memoryOpenTab, setMemoryOpenTab] = useState<TabMode | undefined>(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Presentation-only identity resolution. `currentUserId` (uid) remains the
  // ownership key for Firestore data; it is never shown as the visible name.
  const identity = user ?? { uid: currentUserId };
  const displayName = resolveDisplayName(identity);
  const email = resolveEmail(identity);
  const photoURL = resolvePhotoURL(identity);
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
  }, [photoURL]);

  const NAV_ITEMS: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'journal', label: 'Journal', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'memories', label: 'Memories', icon: <Brain className="w-5 h-5" /> },
    { id: 'growth', label: 'Growth', icon: <Target className="w-5 h-5" /> },
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
      if (tabId === 'memories') setMemoryOpenTab(undefined);
      setActiveTab(tabId as NavTab);
    }
  };

  const handleOpenReflectionReports = () => {
    setActiveTab('memories');
    setMemoriesSubview('reports');
  };

  const handleOpenMemoryCandidates = () => {
    setEditingEntryId(null);
    setIsComposerNew(false);
    setMemoriesSubview('memories');
    setMemoryOpenTab('candidates');
    setActiveTab('memories');
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
        return;
      }
      if (hash === '#/growth' || hash.startsWith('#/growth/')) {
        setActiveTab('growth');
        const sub = hash.replace(/^#\/growth\/?/, '');
        if (sub === 'goals') {
          setGrowthSubview('goals');
        } else {
          setGrowthSubview('habits');
        }
        return;
      }
      if (hash === '#/memories/reports') {
        setActiveTab('memories');
        setMemoriesSubview('reports');
        setMemoryOpenTab(undefined);
        return;
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

          {/* Search */}
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search Journal Entries"
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>Search</span>
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
          <div className="flex items-center gap-2 min-w-0">
            {photoURL && !avatarFailed ? (
              <img
                src={photoURL}
                alt={`${displayName} profile photo`}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-800"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-xs shrink-0" aria-hidden="true">
                {buildInitials(displayName, email, currentUserId)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs text-slate-300 truncate font-medium">{displayName}</div>
              {email && <div className="text-[10px] text-slate-500 truncate">{email}</div>}
            </div>
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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm" aria-hidden="true">
            ∞
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white tracking-wide">JOURNAL∞</div>
            <div className="text-[10px] text-slate-400 truncate max-w-[10rem]">{displayName}{email ? ` · ${email}` : ''}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search Journal Entries"
            className="p-2 rounded-xl bg-slate-800 text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            title="Search"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={() => handleOpenComposer()}
            aria-label="Create New Journal Entry"
            className="p-2 rounded-xl bg-purple-600 text-white min-h-[44px] min-w-[44px] flex items-center justify-center shadow-md active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            title="New Journal Entry"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
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
                onOpenReflectionReports={handleOpenReflectionReports}
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
                    onOpenMemoryCandidates={handleOpenMemoryCandidates}
                  />
                )}
              </div>
            )}

            {activeTab === 'memories' && (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit"
                  role="tablist"
                  aria-label="Memories view"
                >
                  {(
                    [
                      { id: 'memories', label: 'Memories' },
                      { id: 'reports', label: 'Reports' },
                    ] as const
                  ).map((sub) => {
                    const isActive = memoriesSubview === sub.id;
                    return (
                      <button
                        key={sub.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setMemoriesSubview(sub.id)}
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

                {memoriesSubview === 'reports' ? (
                  <ReflectionReportsView
                    entries={entries}
                    memories={memories}
                    goals={goals}
                    currentUserId={currentUserId}
                    onSelectEntry={handleOpenEntry}
                  />
                ) : (
                  <MemoryEngineView
                    userId={currentUserId}
                    memories={memories}
                    onViewSourceEntry={handleOpenEntry}
                    initialTab={memoryOpenTab}
                  />
                )}
              </div>
            )}

            {activeTab === 'growth' && (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit"
                  role="tablist"
                  aria-label="Growth view"
                >
                  {(
                    [
                      { id: 'habits', label: 'Habits' },
                      { id: 'goals', label: 'Goals' },
                    ] as const
                  ).map((sub) => {
                    const isActive = growthSubview === sub.id;
                    return (
                      <button
                        key={sub.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setGrowthSubview(sub.id)}
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

                {growthSubview === 'habits' ? (
                  <HabitsEngineView
                    habits={habits}
                    entries={entries}
                    currentUserId={currentUserId}
                    onOpenEntry={handleOpenEntry}
                  />
                ) : (
                  <GoalsEngineView
                    goals={goals}
                    entries={entries}
                    currentUserId={currentUserId}
                    onOpenEntry={handleOpenEntry}
                  />
                )}
              </div>
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
                isDemo={isDemo}
                aiSessions={aiSessions}
              />
            )}
          </React.Suspense>
        </div>
      </main>

      {/* ── Global Search Overlay ── */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#070B16] overflow-y-auto" role="dialog" aria-label="Search Journal">
          <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">Search Your Journal</h2>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              aria-label="Close Search"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <React.Suspense fallback={<LoadingState label="Loading search..." />}>
              <SemanticSearchView
                entries={entries}
                memories={memories}
                goals={goals}
                onOpenEntry={(id) => { setIsSearchOpen(false); handleOpenEntry(id); }}
              />
            </React.Suspense>
          </div>
        </div>
      )}

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
                if (item.id === 'memories') setMemoryOpenTab(undefined);
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
