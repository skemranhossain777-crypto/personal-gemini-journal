import React from 'react';
import { Sparkles, Shield, LogOut, Plus, User as UserIcon } from 'lucide-react';
import type { User } from 'firebase/auth';

interface NavbarProps {
  user: User | null;
  onSignOut: () => void;
  onNewEntry: () => void;
  onOpenThreatModel: () => void;
  onSignInGoogle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onNewEntry,
  onOpenThreatModel,
  onSignInGoogle,
}) => {
  const isDemo = user?.uid?.startsWith('demo-');

  return (
    <header className="sticky top-0 z-40 border-b border-[#262629] bg-[#121214]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-sm shadow-amber-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold tracking-tight text-[#F1F1F1]">
                Gemini Reflections
              </span>
              <span className="hidden sm:inline-flex items-center rounded-md bg-[#1A1A1C] px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-[#262629]">
                Gemini 3.6 Flash
              </span>
              {isDemo && (
                <span className="inline-flex items-center rounded-md bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-800/60">
                  Demo Workspace
                </span>
              )}
            </div>
            <p className="hidden text-xs text-[#888] md:block">
              {isDemo ? 'Exploring in local demo mode — connect Google to sync to Firestore' : 'Authenticated & User-Isolated Journaling'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connect Google button if in Demo mode */}
          {isDemo && onSignInGoogle && (
            <button
              onClick={onSignInGoogle}
              className="flex items-center gap-1.5 rounded-lg border border-amber-800/70 bg-amber-950/40 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-900/50 transition-colors"
              title="Authenticate with Google to enable Firestore cloud sync"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign In with Google</span>
            </button>
          )}

          {/* Security / Threat Model Button */}
          <button
            id="threat-model-btn"
            onClick={onOpenThreatModel}
            className="flex items-center gap-1.5 rounded-lg border border-[#262629] bg-[#161619] px-3 py-1.5 text-xs font-medium text-[#E0E0E0] hover:bg-[#1E1E22] hover:text-[#F1F1F1] hover:border-[#3A3A40] transition-colors"
            title="Inspect 5 Threat Zones & Firestore Isolation"
          >
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Security Posture</span>
          </button>

          {user && (
            <>
              {/* New Entry Button */}
              <button
                id="new-entry-btn"
                onClick={onNewEntry}
                className="flex items-center gap-1.5 rounded-lg bg-[#1A1A1C] border border-[#333338] px-3 py-1.5 text-xs font-medium text-[#F1F1F1] shadow-sm hover:bg-[#242428] hover:border-[#44444C] transition-all active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Reflection</span>
              </button>

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 rounded-lg border border-[#262629] bg-[#161619] px-2 py-1">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-6 w-6 rounded-full object-cover border border-[#262629]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#262629] text-[#E0E0E0] text-xs font-semibold">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="hidden max-w-[120px] truncate text-xs font-medium text-[#E0E0E0] lg:inline-block">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                id="sign-out-btn"
                onClick={onSignOut}
                className="flex items-center gap-1 rounded-lg border border-[#262629] bg-[#161619] p-2 text-[#888] hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
