import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  authService,
  type SessionUser,
} from './services/auth';
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
import { ThreatModelModal } from './components/ThreatModelModal';
import { AdminDashboard } from './components/AdminDashboard';
import { NotificationSettingsModal } from './components/NotificationSettings';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CommandPalette, type CommandPaletteItem } from './components/CommandPalette';
import {
  Sparkles,
  WifiOff,
  FilePlus2,
  Shield,
  Bell,
  Crown,
  LogOut,
  PenLine,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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

  // Monitor Firebase Auth state (observable pub/sub, skill Phase 3)
  useEffect(() => {
    let cancelled = false;

    // Instant hydration from the local-first cache while auth resolves.
    const cachedUid = authService.currentUser?.uid;
    if (cachedUid) dataService.markHydrated(cachedUid);

    const unsubUser = authService.subscribe(async (user) => {
      if (cancelled) return;
      setCurrentUser(user);
      setIsAuthLoading(false);

      if (user && !user.isDemo) {
        try {
          const token = await authService.idToken;
          if (token) {
            setAuthToken(token);
            // Check admin role via server
            const resp = await fetch('/api/admin/seed-role', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (resp.ok) {
              const data = await resp.json();
              setIsAdmin(data.isAdmin === true);
            }
          }
          if (user.source) dataService.markHydrated(user.uid);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setAuthToken('');
        setIsAdmin(false);
      }
    });

    // Complete any in-progress redirect sign-in (fire-and-forget; the auth
    // pub/sub will re-emit the authenticated user when it resolves).
    authService.completeRedirectSignIn().catch((err) => {
      console.error('Failed to complete redirect sign-in:', err);
      setIsAuthLoading(false);
    });

    return () => {
      cancelled = true;
      unsubUser();
    };
  }, []);

  // Subscribe to real-time user-isolated Firestore entries
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

  const selectedInteraction =
    interactions.find((item) => item.id === selectedInteractionId) || null;

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      try {
        // Popup shows the Google authorization window directly (provider is now
        // enabled). Falls back to redirect on popup-blocked, handled below.
        await authService.signInWithGoogle('popup');
      } catch (e: any) {
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
          // Fall back to full-page redirect which is immune to popup blockers.
          try {
            await authService.signInWithGoogle('redirect');
          } catch (re: any) {
            if (re?.message !== 'REDIRECT_IN_PROGRESS') throw re;
          }
          if (authService.firebaseUser) {
            await authService.completeRedirectSignIn();
          }
          return;
        }
        throw e;
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    const demoUser = authService.signInAsDemo();
    setCurrentUser(demoUser);
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setSelectedInteractionId(null);
    setInteractions([]);
    setIsAdmin(false);
    setAuthToken('');
  };

  const handleNewEntry = () => {
    setSelectedInteractionId(null);
    setMobileTab('editor');
  };

  const handleSelectInteraction = (interaction: JournalInteraction) => {
    setSelectedInteractionId(interaction.id);
    setMobileTab('editor');
  };

  const handleDeleteInteraction = async (id: string, e: React.MouseEvent) => {
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
      onSelect: () => (currentUser ? handleNewEntry() : handleSignIn()),
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
            onSelect: () => void handleSignOut(),
          },
        ]
      : [
          {
            id: 'demo',
            label: 'Try the demo experience',
            hint: 'Explore Gemini journal with a sample session',
            keywords: 'demo sample try explore guest',
            icon: <PenLine className="h-3.5 w-3.5" />,
            onSelect: () => handleDemoSignIn(),
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

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <AnimatePresence mode="wait">
        {isAuthLoading ? (
          // Initial Auth Loading Screen
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-screen w-screen items-center justify-center bg-[#0A0A0B] text-[#E0E0E0]"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#262629] border-t-amber-500" />
              <p className="text-xs font-medium text-[#888]">Initializing Gemini Reflection Studio...</p>
            </div>
          </motion.div>
        ) : !currentUser ? (
          // Unauthenticated Landing Page
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-screen flex-col bg-[#0A0A0B] text-[#E0E0E0]"
          >
            <Navbar
              user={null}
              onSignOut={() => {}}
              onNewEntry={() => {}}
              onOpenThreatModel={() => setIsThreatModalOpen(true)}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />
            {!isOnline && <OfflineBanner />}
            <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
              <AuthLanding
                onSignIn={handleSignIn}
                onDemoSignIn={handleDemoSignIn}
                isLoading={isAuthLoading}
                onOpenThreatModel={() => setIsThreatModalOpen(true)}
              />
            </main>
            <ThreatModelModal
              isOpen={isThreatModalOpen}
              onClose={() => setIsThreatModalOpen(false)}
            />
          </motion.div>
        ) : (
          // Authenticated Private Dashboard
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex h-screen flex-col overflow-hidden bg-[#0A0A0B] text-[#E0E0E0]"
          >
            {/* Top Navbar */}
            <Navbar
              user={currentUser}
              onSignOut={handleSignOut}
              onNewEntry={handleNewEntry}
              onOpenThreatModel={() => setIsThreatModalOpen(true)}
              onOpenNotifications={() => setIsNotificationSettingsOpen(true)}
              onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
              onSignInGoogle={handleSignIn}
              isAdmin={isAdmin}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />

            {!isOnline && <OfflineBanner />}

            {/* Mobile Tab Switcher */}
            <div className="flex gap-2 border-b border-[#262629] bg-[#121214] px-4 py-2 text-xs md:hidden">
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
                  className={`relative flex-1 rounded-lg py-1.5 text-center font-medium transition-colors ${
                    mobileTab === tab.id
                      ? 'text-[#F1F1F1]'
                      : 'bg-[#161619] text-[#888] hover:text-[#E0E0E0]'
                  }`}
                >
                  {mobileTab === tab.id && (
                    <motion.span
                      layoutId="mobile-tab-pill"
                      className="absolute inset-0 rounded-lg border border-[#333338] bg-[#1A1A1C]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Main Full-Height Workspace */}
            <div id="main" tabIndex={-1} className="flex min-h-0 flex-1 overflow-hidden focus:outline-none">
              {/* Left History Sidebar */}
              <div
                className={`h-full min-h-0 w-full shrink-0 md:block md:w-80 lg:w-96 ${
                  mobileTab === 'history' ? 'block' : 'hidden'
                }`}
              >
                <HistorySidebar
                  interactions={interactions}
                  selectedId={selectedInteractionId}
                  onSelect={handleSelectInteraction}
                  onNew={handleNewEntry}
                  onDelete={handleDeleteInteraction}
                  isLoading={isInteractionsLoading}
                />
              </div>

              {/* Right Editor Workspace */}
              <div
                className={`h-full min-h-0 min-w-0 flex-1 ${
                  mobileTab === 'editor' ? 'block' : 'hidden md:block'
                }`}
              >
                <JournalEditor
                  userId={currentUser.uid}
                  interaction={selectedInteraction}
                  onInteractionUpdated={handleInteractionUpdated}
                  onNewEntry={handleNewEntry}
                />
              </div>
            </div>

            {/* Threat Model Modal */}
            <ThreatModelModal
              isOpen={isThreatModalOpen}
              onClose={() => setIsThreatModalOpen(false)}
              userUid={currentUser.uid}
            />

            {/* Admin Dashboard Modal */}
            {isAdmin && authToken && (
              <AdminDashboard
                isOpen={isAdminDashboardOpen}
                onClose={() => setIsAdminDashboardOpen(false)}
                authToken={authToken}
                adminEmail={currentUser.email || ''}
              />
            )}

            {/* Notification Settings Modal */}
            {authToken && (
              <NotificationSettingsModal
                isOpen={isNotificationSettingsOpen}
                onClose={() => setIsNotificationSettingsOpen(false)}
                authToken={authToken}
              />
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
              isOpen={pendingDelete !== null}
              title="Delete Reflection?"
              message={`This will permanently delete "${pendingDelete?.title || ''}" and all of its conversation history from your isolated Firestore partition. This action cannot be undone.`}
              confirmLabel="Delete Reflection"
              cancelLabel="Cancel"
              onConfirm={confirmDeleteInteraction}
              onCancel={() => setPendingDelete(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

      <Toaster />
    </MotionConfig>
  );
}

function OfflineBanner() {
  return (
    <div
      className="flex animate-slide-down-in items-center justify-center gap-2 border-b border-amber-900/40 bg-amber-950/40 px-4 py-1.5 text-[11px] font-medium text-amber-300"
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
