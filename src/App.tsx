import React, { useState, useEffect, useMemo } from 'react';
import { MotionConfig } from 'motion/react';
import {
  subscribeUserInteractions,
  deleteUserInteraction,
} from './services/firestore';
import { dataService } from './services/data';
import { toast } from './services/toast';
import { Toaster } from './components/Toaster';
import type { JournalInteraction } from './types';
import { Navbar } from './components/Navbar';
import { AuthLanding } from './components/AuthLanding';
import { HistorySidebar } from './components/HistorySidebar';
import { JournalEditor } from './components/JournalEditor';
import { ConfirmDialog } from './components/ConfirmDialog';
import type { CommandPaletteItem } from './components/CommandPalette';
import {
  journalEntriesApi,
  memoriesApi,
  goalsApi,
  habitsApi,
  timelineEventsApi,
  insightsApi,
} from './data';
import type { JournalEntry, Memory, Goal, Habit, TimelineEvent, Insight } from './data/models';

const ThreatModelModal = React.lazy(() =>
  import('./components/ThreatModelModal').then((m) => ({ default: m.ThreatModelModal })),
);
const AdminDashboard = React.lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const NotificationSettingsModal = React.lazy(() =>
  import('./components/NotificationSettings').then((m) => ({ default: m.NotificationSettingsModal })),
);
const CommandPalette = React.lazy(() =>
  import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);
const DesignSystem = React.lazy(() =>
  import('./pages/DesignSystem').then((m) => ({ default: m.DesignSystem })),
);
const ResponsiveNavigationShell = React.lazy(() =>
  import('./components/navigation/ResponsiveNavigationShell').then((m) => ({
    default: m.ResponsiveNavigationShell,
  })),
);
import {
  AuthErrorScreen,
  AuthLoadingScreen,
  AuthProvider,
  RequireAuth,
  UnauthorizedScreen,
  currentRoute,
  getRoute,
  isProtectedRoute,
  navigateTo,
  parseJournalLocation,
  useAuth,
  type AppRoute,
} from './auth';
import {
  FilePlus2,
  Shield,
  Bell,
  Crown,
  LogOut,
  PenLine,
  WifiOff,
} from 'lucide-react';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const {
    status,
    user: currentUser,
    signIn,
    signInAsDemo,
    signOut,
    error,
    getAccessToken,
    clearError,
  } = useAuth();
  const [route, setRoute] = useState<AppRoute>(() => currentRoute());
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [isInteractionsLoading, setIsInteractionsLoading] = useState(false);
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);
  const [isThreatModalOpen, setIsThreatModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<'editor' | 'history'>('editor');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Owner-scoped collection state fed into the primary navigation shell.
  const isDemo = currentUser?.isDemo ?? false;
  const uid = currentUser?.uid ?? '';
  const [shellEntries, setShellEntries] = useState<JournalEntry[]>([]);
  const [shellMemories, setShellMemories] = useState<Memory[]>([]);
  const [shellGoals, setShellGoals] = useState<Goal[]>([]);
  const [shellHabits, setShellHabits] = useState<Habit[]>([]);
  const [shellTimelineEvents, setShellTimelineEvents] = useState<TimelineEvent[]>([]);
  const [shellInsights, setShellInsights] = useState<Insight[]>([]);

  const isBusy = status === 'initializing' || status === 'signing-in';
  const effectiveRoute: 'design' | 'app' | 'journal' | 'home' =
    route === 'design' ? 'design' : route === 'app' ? 'app' : route === 'journal' ? 'journal' : 'home';

  // Keep the route model in sync with path + hash (design gallery + protected #/app).
  useEffect(() => {
    const onNav = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onNav);
    window.addEventListener('popstate', onNav);
    return () => {
      window.removeEventListener('hashchange', onNav);
      window.removeEventListener('popstate', onNav);
    };
  }, []);

  // Global Ctrl/Cmd+K to open the command palette (power-user shortcut).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Track connectivity so unsaved work is never hidden behind silent failures.
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Resolve the logged-in session into an API token + admin flag.
  useEffect(() => {
    let cancelled = false;
    if (currentUser && !currentUser.isDemo) {
      dataService.markHydrated(currentUser.uid);
      getAccessToken()
        .then(async (token) => {
          if (cancelled || !token) return;
          setAuthToken(token);
          const resp = await fetch('/api/admin/seed-role', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          if (resp.ok) {
            const data = await resp.json();
            setIsAdmin(data.isAdmin === true);
          } else {
            setIsAdmin(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setIsAdmin(false);
            setAuthToken('');
          }
        });
    } else {
      setAuthToken('');
      setIsAdmin(false);
    }
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, getAccessToken]);

  // Subscribe to real-time user-isolated Firestore interactions
  useEffect(() => {
    if (!currentUser) {
      setInteractions([]);
      setSelectedInteractionId(null);
      return;
    }

    setIsInteractionsLoading(true);
    const unsubData = subscribeUserInteractions(
      currentUser.uid,
      (list) => {
        setInteractions(list);
        dataService.cacheInteractions(currentUser.uid, list);
        setIsInteractionsLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to interactions:', err);
        setIsInteractionsLoading(false);
      }
    );

    return () => unsubData();
  }, [currentUser?.uid]);

  // Owner-scoped collection subscriptions for the primary navigation shell.
  // Demo sessions stay purely local (no Firestore reads) — the shell views show
  // empty/entries-only states and the JournalWorkspace owns its own demo store.
  useEffect(() => {
    if (!currentUser || isDemo) {
      setShellEntries([]);
      setShellMemories([]);
      setShellGoals([]);
      setShellHabits([]);
      setShellTimelineEvents([]);
      setShellInsights([]);
      return;
    }
    const unsubs = [
      journalEntriesApi.subscribe(
        (items) => setShellEntries(items),
        (err) => console.warn('[shell] entries subscription failed:', err),
      ),
      memoriesApi.subscribe(
        (items) => setShellMemories(items),
        (err) => console.warn('[shell] memories subscription failed:', err),
      ),
      goalsApi.subscribe(
        (items) => setShellGoals(items),
        (err) => console.warn('[shell] goals subscription failed:', err),
      ),
      habitsApi.subscribe(
        (items) => setShellHabits(items),
        (err) => console.warn('[shell] habits subscription failed:', err),
      ),
      timelineEventsApi.subscribe(
        (items) => setShellTimelineEvents(items),
        (err) => console.warn('[shell] timeline subscription failed:', err),
      ),
      insightsApi.subscribe(
        (items) => setShellInsights(items),
        (err) => console.warn('[shell] insights subscription failed:', err),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [currentUser?.uid, isDemo]);

  const selectedInteraction =
    interactions.find((item) => item.id === selectedInteractionId) || null;

  const goHome = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setRoute(currentRoute());
  };

  const exitDesign = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setRoute(currentRoute());
  };

  const handleNewEntry = () => {
    setSelectedInteractionId(null);
    setMobileTab('editor');
  };

  const handleSelectInteraction = (interaction: JournalInteraction) => {
    setSelectedInteractionId(interaction.id);
    setMobileTab('editor');
  };

  const handleDeleteInteraction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const target = interactions.find((item) => item.id === id);
    setPendingDelete({ id, title: target?.title || 'this reflection' });
  };

  const confirmDeleteInteraction = async () => {
    if (!currentUser || !pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteUserInteraction(currentUser.uid, id);
      if (selectedInteractionId === id) {
        setSelectedInteractionId(null);
      }
      toast.success('Reflection deleted.');
    } catch (err) {
      console.error('Failed to delete interaction:', err);
      toast.error('Could not delete interaction. Please try again.');
    }
  };

  const handleInteractionUpdated = (updated: JournalInteraction) => {
    setSelectedInteractionId(updated.id);
  };

  // Command palette actions (available everywhere, filtered to the signed-in context).
  const paletteActions: CommandPaletteItem[] = [
    {
      id: 'new-entry',
      label: currentUser ? 'New reflection' : 'Sign in to start writing',
      hint: currentUser ? 'Start a fresh journal entry' : 'Google sign-in',
      keywords: 'new entry start write create',
      icon: <FilePlus2 className="h-3.5 w-3.5" />,
      onSelect: () => {
        if (currentUser) {
          navigateTo('#/journal/new');
        } else {
          void signIn();
        }
      },
    },
    {
      id: 'threat-model',
      label: 'Security posture',
      hint: '8 threat zones & deployed defense',
      keywords: 'security threat model posture rbac rules firestore',
      icon: <Shield className="h-3.5 w-3.5" />,
      onSelect: () => setIsThreatModalOpen(true),
    },
    ...(currentUser
      ? [
          {
            id: 'notifications',
            label: 'Notification settings',
            hint: 'Webhook alerts on saved entries',
            keywords: 'notifications webhook slack discord alerts',
            icon: <Bell className="h-3.5 w-3.5" />,
            onSelect: () => setIsNotificationSettingsOpen(true),
          },
          ...(isAdmin
            ? [
                {
                  id: 'admin',
                  label: 'Admin dashboard',
                  hint: 'Users, roles & system overview',
                  keywords: 'admin users roles rbac dashboard',
                  icon: <Crown className="h-3.5 w-3.5" />,
                  onSelect: () => setIsAdminDashboardOpen(true),
                },
              ]
            : []),
          {
            id: 'sign-out',
            label: 'Sign out',
            hint: `Currently signed in as ${currentUser.email || 'you'}`,
            keywords: 'logout sign out exit',
            icon: <LogOut className="h-3.5 w-3.5" />,
            onSelect: () => void signOut(),
          },
        ]
      : [
          {
            id: 'demo',
            label: 'Try the demo experience',
            hint: 'Explore Gemini journal with a sample session',
            keywords: 'demo sample try explore guest',
            icon: <PenLine className="h-3.5 w-3.5" />,
            onSelect: () => signInAsDemo(),
          },
        ]),
  ];

  const paletteEntries = interactions.map((item) => ({
    id: item.id,
    title: item.title || 'Untitled reflection',
    subtitle: new Date(item.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));

  // Route-derived initial state for the shell.
  const journalPart = parseJournalLocation(
    typeof window !== 'undefined' ? window.location.hash : '',
  );
  const initialShellTab = useMemo<{ tab: 'home' | 'journal'; entryId: string | null; isNew: boolean; subview: 'journal' | 'companion' }>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.startsWith('#/app')) return { tab: 'journal', entryId: null, isNew: false, subview: 'companion' };
    if (hash.startsWith('#/journal/new')) return { tab: 'journal', entryId: null, isNew: true, subview: 'journal' };
    if (hash.startsWith('#/journal')) {
      return { tab: 'journal', entryId: journalPart.entryId ?? null, isNew: journalPart.isNew, subview: 'journal' };
    }
    return { tab: 'home', entryId: null, isNew: false, subview: 'journal' };
  }, [journalPart]);

  const companionWorkspace = currentUser ? (
    <div className="flex flex-col md:flex-row overflow-hidden rounded-2xl border border-[#223056] bg-[#070B16] text-[#D9E2F5] min-h-[70vh] md:h-[calc(100vh-9rem)]">
      {/* History Sidebar */}
      <div className={`w-full shrink-0 md:block md:w-72 lg:w-80 border-r border-[#223056] ${mobileTab === 'history' ? 'block' : 'hidden md:block'}`}>
        <HistorySidebar
          interactions={interactions}
          selectedId={selectedInteractionId}
          onSelect={handleSelectInteraction}
          onNew={handleNewEntry}
          onDelete={handleDeleteInteraction}
          isLoading={isInteractionsLoading}
        />
      </div>

      {/* Mobile tab switcher */}
      <div className="flex gap-2 border-b border-[#223056] bg-[#0E1730] px-4 py-2 text-xs md:hidden">
        {(
          [
            { id: 'editor', label: 'Active Reflection' },
            { id: 'history', label: `Past Entries (${interactions.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            aria-pressed={mobileTab === tab.id}
            className={`flex-1 rounded-lg py-1.5 text-center font-medium transition-colors ${
              mobileTab === tab.id ? 'text-[#EEF4FF]' : 'bg-[#121E40] text-[#888] hover:text-[#D9E2F5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor Workspace */}
      <div className={`min-w-0 flex-1 ${mobileTab === 'editor' ? 'block' : 'hidden md:block'}`}>
        <JournalEditor
          userId={currentUser.uid}
          interaction={selectedInteraction}
          onInteractionUpdated={handleInteractionUpdated}
          onNewEntry={handleNewEntry}
        />
      </div>
    </div>
  ) : null;

  const shell = currentUser ? (
    <RequireAuth>
      <ResponsiveNavigationShell
        currentUserId={currentUser.uid}
        user={{
          uid: currentUser.uid,
          displayName: currentUser.source?.displayName ?? currentUser.displayName,
          email: currentUser.source?.email ?? currentUser.email,
          photoURL: currentUser.source?.photoURL ?? currentUser.photoURL,
          providerData: currentUser.source?.providerData ?? [],
        }}
        entries={shellEntries}
        memories={shellMemories}
        goals={shellGoals}
        habits={shellHabits}
        timelineEvents={shellTimelineEvents}
        insights={shellInsights}
        onSignOut={() => void signOut()}
        isDemo={currentUser.isDemo}
        aiSessions={interactions}
        initialTab={initialShellTab.tab}
        initialEntryId={initialShellTab.entryId}
        initialComposerNew={initialShellTab.isNew}
        initialJournalSubview={initialShellTab.subview}
        companionWorkspace={companionWorkspace}
      />
    </RequireAuth>
  ) : null;

  return (
    <MotionConfig reducedMotion="user">
      {!isOnline && <OfflineBanner />}

      {effectiveRoute === 'design' ? (
        <DesignSystem onExit={exitDesign} />
      ) : isBusy ? (
        <AuthLoadingScreen label="Securing your journal…" />
      ) : status === 'restore-failed' ? (
        <AuthErrorScreen onHome={goHome} />
      ) : currentUser ? (
        <React.Suspense fallback={<AuthLoadingScreen label="Loading your journal…" />}>
          {shell}
        </React.Suspense>
      ) : isProtectedRoute(route) ? (
        <RequireAuth fallback={<UnauthorizedScreen onHome={goHome} />}>
          {shell}
        </RequireAuth>
      ) : (
        <div className="flex min-h-screen flex-col bg-[#070B16] text-[#D9E2F5]">
          <Navbar
            user={null}
            onSignOut={() => {}}
            onNewEntry={() => {}}
            onOpenThreatModel={() => setIsThreatModalOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
          <main id="main" tabIndex={-1} className="flex-1">
            <AuthLanding
              onSignIn={() => signIn()}
              onDemoSignIn={signInAsDemo}
              isLoading={isBusy}
              onOpenThreatModel={() => setIsThreatModalOpen(true)}
              error={error}
              onClearError={clearError}
            />
          </main>
        </div>
      )}

      <React.Suspense fallback={null}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          actions={paletteActions}
          entries={paletteEntries}
          onSelectEntry={(id) => {
            const target = interactions.find((item) => item.id === id);
            if (target) handleSelectInteraction(target);
          }}
        />

        {currentUser && (
          <ThreatModelModal
            isOpen={isThreatModalOpen}
            onClose={() => setIsThreatModalOpen(false)}
          />
        )}

        {currentUser && isAdmin && authToken && (
          <AdminDashboard
            isOpen={isAdminDashboardOpen}
            onClose={() => setIsAdminDashboardOpen(false)}
            authToken={authToken}
            adminEmail={currentUser.email || ''}
          />
        )}

        {currentUser && authToken && (
          <NotificationSettingsModal
            isOpen={isNotificationSettingsOpen}
            onClose={() => setIsNotificationSettingsOpen(false)}
            authToken={authToken}
          />
        )}
      </React.Suspense>

      {currentUser && (
        <ConfirmDialog
          isOpen={pendingDelete !== null}
          title="Delete Reflection?"
          message={`This will permanently delete "${pendingDelete?.title || ''}" and all of its conversation history from your isolated Firestore partition. This action cannot be undone.`}
          confirmLabel="Delete Reflection"
          cancelLabel="Cancel"
          onConfirm={() => void confirmDeleteInteraction()}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <Toaster />
    </MotionConfig>
  );
}

function OfflineBanner() {
  return (
    <div
      className="flex animate-slide-down-in items-center justify-center gap-2 border-b border-blue-900/40 bg-blue-950/40 px-4 py-1.5 text-[11px] font-medium text-sky-300"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        You are offline. Your prompt and drafts are preserved locally and will be saved once you reconnect.
      </span>
    </div>
  );
}
