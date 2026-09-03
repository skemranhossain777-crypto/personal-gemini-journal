import React, { useState, useEffect } from 'react';
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
import { BookOpen, Sparkles } from 'lucide-react';

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
        await authService.signInWithGoogle('redirect');
      } catch (e: any) {
        // REDIRECT_IN_PROGRESS is the expected result of a redirect sign-in
        // (the page reloads right after to complete the handshake).
        if (e?.message !== 'REDIRECT_IN_PROGRESS') {
          throw e;
        }
      }
      if (authService.firebaseUser) {
        await authService.completeRedirectSignIn();
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
    const confirmed = window.confirm('Are you sure you want to delete this reflection?');
    if (!confirmed) return;

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

  // Initial Auth Loading Screen
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0B] text-[#E0E0E0]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#262629] border-t-amber-500" />
          <p className="text-xs font-medium text-[#888]">Initializing Gemini Reflection Studio...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col">
        <Navbar
          user={null}
          onSignOut={() => {}}
          onNewEntry={() => {}}
          onOpenThreatModel={() => setIsThreatModalOpen(true)}
        />
        <main className="flex-1">
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
        <Toaster />
      </div>
    );
  }

  // Authenticated Private Dashboard
  return (
    <div className="flex h-screen flex-col bg-[#0A0A0B] text-[#E0E0E0] overflow-hidden">
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
      />

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden border-b border-[#262629] bg-[#121214] px-4 py-2 gap-2 text-xs">
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-colors ${
            mobileTab === 'editor'
              ? 'bg-[#1A1A1C] border border-[#333338] text-[#F1F1F1]'
              : 'bg-[#161619] border border-[#262629] text-[#888]'
          }`}
        >
          Active Reflection
        </button>
        <button
          onClick={() => setMobileTab('history')}
          className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-colors ${
            mobileTab === 'history'
              ? 'bg-[#1A1A1C] border border-[#333338] text-[#F1F1F1]'
              : 'bg-[#161619] border border-[#262629] text-[#888]'
          }`}
        >
          Past Entries ({interactions.length})
        </button>
      </div>

      {/* Main Full-Height Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left History Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-96 shrink-0 h-full min-h-0 ${
            mobileTab === 'history' ? 'block' : 'hidden md:block'
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
          className={`flex-1 h-full min-h-0 min-w-0 ${
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

      <Toaster />
    </div>
  );
}
