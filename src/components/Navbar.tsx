import React from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Shield,
  LogOut,
  Plus,
  User as UserIcon,
  Bell,
  LayoutDashboard,
  Search,
} from 'lucide-react';
import type { SessionUser } from '../services/auth';
import { AdminBadge } from './AdminBadge';

interface NavbarProps {
  user: SessionUser | null;
  onSignOut: () => void;
  onNewEntry: () => void;
  onOpenThreatModel: () => void;
  onOpenNotifications?: () => void;
  onOpenAdminDashboard?: () => void;
  onSignInGoogle?: () => void;
  onOpenCommandPalette?: () => void;
  isAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onNewEntry,
  onOpenThreatModel,
  onOpenNotifications,
  onOpenAdminDashboard,
  onSignInGoogle,
  onOpenCommandPalette,
  isAdmin = false,
}) => {
  const isDemo = user?.uid?.startsWith('demo-');

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="sticky top-0 z-40 border-b border-[#223056] bg-[#0E1730]/95 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-500 text-white shadow-sm shadow-sky-500/20">
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, repeatDelay: 2 }}
              className="flex"
            >
              <Sparkles className="h-5 w-5" />
            </motion.span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold tracking-tight text-[#EEF4FF]">
                Gemini Reflections
              </span>
              <span
                className="hidden items-center rounded-md border border-[#223056] bg-[#17254F] px-2 py-0.5 text-[10px] font-medium text-sky-400 sm:inline-flex"
                title="5-model Gemini Flash fallback ladder"
              >
                Gemini 3.x Flash
              </span>
              {isDemo && (
                <span className="inline-flex items-center rounded-md border border-blue-800/60 bg-blue-950/50 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                  Demo Workspace
                </span>
              )}
              {isAdmin && <AdminBadge />}
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
              className="flex items-center gap-1.5 rounded-lg border border-blue-800/70 bg-blue-950/40 px-2.5 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-blue-900/50"
              title="Authenticate with Google to enable Firestore cloud sync"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign In with Google</span>
            </button>
          )}

          {/* Command Palette Toggle (Ctrl+K) */}
          {onOpenCommandPalette && (
            <button
              id="command-palette-btn"
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs font-medium text-[#888] transition-colors hover:border-[#3B518E] hover:bg-[#1C2C5E] hover:text-[#EEF4FF]"
              title="Quick access (Ctrl+K)"
              aria-label="Open command palette (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search...</span>
              <kbd className="hidden rounded border border-[#31447F] bg-[#0E1730] px-1 py-0.5 text-[9px] text-[#666] lg:inline">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Security / Threat Model Button */}
          <button
            id="threat-model-btn"
            onClick={onOpenThreatModel}
            className="flex items-center gap-1.5 rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs font-medium text-[#D9E2F5] transition-colors hover:border-[#3B518E] hover:bg-[#1C2C5E] hover:text-[#EEF4FF]"
            title="Inspect 8 Threat Zones & Firestore Isolation"
          >
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Security Posture</span>
          </button>

          {/* Notification Settings (authenticated users) */}
          {user && onOpenNotifications && (
            <button
              id="notification-settings-btn"
              onClick={onOpenNotifications}
              className="flex items-center gap-1.5 rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs font-medium text-[#D9E2F5] transition-colors hover:border-[#3B518E] hover:bg-[#1C2C5E] hover:text-[#EEF4FF]"
              title="Configure Slack & Discord notifications"
            >
              <Bell className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">Alerts</span>
            </button>
          )}

          {/* Admin Dashboard (admin-only) */}
          {user && isAdmin && onOpenAdminDashboard && (
            <button
              id="admin-dashboard-btn"
              onClick={onOpenAdminDashboard}
              className="flex items-center gap-1.5 rounded-lg border border-blue-900/50 bg-blue-950/30 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-blue-900/50"
              title="Open Admin Dashboard"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {user && (
            <>
              {/* New Entry Button */}
              <button
                id="new-entry-btn"
                onClick={onNewEntry}
                className="flex items-center gap-1.5 rounded-lg border border-[#31447F] bg-[#17254F] px-3 py-1.5 text-xs font-medium text-[#EEF4FF] shadow-sm transition-all hover:border-[#4A63A3] hover:bg-[#26376B] active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Reflection</span>
              </button>

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 rounded-lg border border-[#223056] bg-[#121E40] px-2 py-1">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-6 w-6 rounded-full border border-[#223056] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#223056] text-xs font-semibold text-[#D9E2F5]">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="hidden max-w-[120px] truncate text-xs font-medium text-[#D9E2F5] lg:inline-block">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                id="sign-out-btn"
                onClick={onSignOut}
                className="flex items-center gap-1 rounded-lg border border-[#223056] bg-[#121E40] p-2 text-[#888] transition-colors hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-400"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
};