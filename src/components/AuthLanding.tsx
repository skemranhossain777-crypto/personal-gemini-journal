import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ShieldCheck, BookOpen, Brain, Lock, ArrowRight } from 'lucide-react';
import { fadeUp, stagger } from '../lib/animations';

interface AuthLandingProps {
  onSignIn: () => Promise<void>;
  onDemoSignIn?: () => void;
  isLoading: boolean;
  onOpenThreatModel: () => void;
}

const features = [
  {
    icon: Brain,
    iconColor: 'text-sky-400',
    title: 'Gemini 3.x Flash Intelligence',
    description:
      'Provides empathetic reflections, creative brainstorming angles, and executive summaries with a 5-model automatic fallback ladder.',
  },
  {
    icon: ShieldCheck,
    iconColor: 'text-emerald-400',
    title: 'Isolated Cloud Firestore',
    description:
      'Every journal entry is stored under your UID. Firestore Security Rules prevent other users from accessing your records.',
  },
  {
    icon: BookOpen,
    iconColor: 'text-blue-400',
    title: 'Multi-Turn History',
    description:
      'Carry on deep, ongoing discussions or re-read past reflections at any time with full message history and tag categorization.',
  },
];

export const AuthLanding: React.FC<AuthLandingProps> = ({
  onSignIn,
  onDemoSignIn,
  isLoading,
  onOpenThreatModel,
}) => {
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignInClick = async () => {
    setAuthError(null);
    try {
      await onSignIn();
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in window was closed. Please try again.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else if (err?.code === 'auth/popup-blocked') {
        setAuthError(
          `The sign-in popup was blocked by your browser or iframe security policy. Please open the app in a new tab or use Instant Demo Mode. [${err.code}]`
        );
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError(
          `This domain is pending authorization in Firebase Console. You can explore immediately using Instant Demo Mode or open in a new tab. [${err.code}]`
        );
      } else if (err?.code === 'auth/operation-not-allowed') {
        setAuthError(`Google sign-in is currently unavailable for this Firebase project (provider not fully enabled). [${err.code}]`);
      } else if (err?.code === 'auth/configuration-not-found') {
        setAuthError(`Firebase Auth is not fully provisioned for this project (provider/API not enabled). [${err.code}]`);
      } else {
        setAuthError(`${err?.message || 'Authentication failed. Please try again or use Instant Demo Mode.'} ${err?.code ? `[${err.code}]` : ''}`);
      }
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden bg-[#070B16] px-4 py-12 text-[#D9E2F5]">
      {/* Aurora background blobs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="animate-aurora absolute -left-32 top-16 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="animate-aurora-slow absolute -right-24 top-40 h-[380px] w-[380px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="animate-aurora absolute bottom-0 left-1/3 h-[300px] w-[480px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-4xl space-y-12"
        initial="hidden"
        animate="show"
        variants={stagger(0.1, 0.05)}
      >
        {/* Hero Section */}
        <motion.div variants={fadeUp} className="mx-auto max-w-2xl space-y-4 text-center">
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-[#223056] bg-[#121E40] px-3.5 py-1 text-xs font-medium text-sky-400 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>AI-Guided Reflection & Thought Partner</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-serif text-3xl font-bold leading-tight tracking-tight text-[#EEF4FF] sm:text-4xl lg:text-5xl"
          >
            Reflect deeper, brainstorm ideas, and understand your journey.
          </motion.h1>

          <motion.p variants={fadeUp} className="text-base leading-relaxed text-[#9FB0D4] sm:text-lg">
            A private journaling sanctuary paired with Gemini 3.x Flash. Write multi-turn reflections, receive thoughtful summaries, and keep your entries strictly isolated to your account.
          </motion.p>

          {/* Authentication Action Box */}
          <motion.div variants={fadeUp} className="flex flex-col items-center justify-center gap-3 pt-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="google-signin-btn"
                onClick={handleSignInClick}
                disabled={isLoading}
                className="flex items-center justify-center gap-3 rounded-xl border border-[#31447F] bg-[#17254F] px-6 py-3 text-sm font-medium text-[#EEF4FF] shadow-lg shadow-black/40 transition-all hover:border-[#4A63A3] hover:bg-[#26376B] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{isLoading ? 'Authenticating...' : 'Sign In with Google'}</span>
              </button>

              {onDemoSignIn && (
                <button
                  id="instant-demo-btn"
                  onClick={onDemoSignIn}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#223056] bg-[#121E40] px-5 py-3 text-sm font-medium text-[#9FB0D4] transition-all hover:border-[#41599A] hover:bg-[#1C2C5E] hover:text-[#EEF4FF] active:scale-[0.98]"
                  title="Explore all reflection features instantly in demo workspace"
                >
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  <span>Instant Demo Mode</span>
                </button>
              )}
            </div>

            {authError && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="max-w-md space-y-2 rounded-xl border border-blue-900/60 bg-blue-950/40 p-3 text-left text-xs text-sky-300"
              >
                <p className="font-medium text-sky-200">{authError}</p>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-sky-400 underline hover:text-sky-300"
                  >
                    Open in New Tab &rarr;
                  </a>
                  {onDemoSignIn && (
                    <button
                      onClick={onDemoSignIn}
                      className="inline-flex items-center gap-1 rounded border border-blue-700/50 bg-blue-900/40 px-2 py-0.5 text-[11px] text-sky-200 hover:bg-blue-800/50"
                    >
                      Continue in Demo Mode
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            <p className="text-xs text-[#666]">
              No passwords stored. Federated Google authentication via Firebase Auth.
            </p>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={stagger(0.12, 0.1)}
          className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-3"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -5, borderColor: '#41599A' }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="rounded-2xl border border-[#223056] bg-[#0E1730] p-6 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#223056] bg-[#17254F]">
                  <Icon className={`h-5 w-5 ${f.iconColor}`} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[#EEF4FF]">{f.title}</h3>
                <p className="text-xs leading-relaxed text-[#888]">{f.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Privacy & Threat Model Banner */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#223056] bg-[#0E1730] p-6 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#223056] bg-[#17254F] text-[#9FB0D4]">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#EEF4FF]">Zero Insecure Defaults</h4>
              <p className="text-xs text-[#888]">
                Built to OWASP Top 10 standards with the 8 Threat Zones modeled and verified.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenThreatModel}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-sky-400 transition-colors hover:text-sky-300 hover:underline"
            aria-label="Review the threat model"
          >
            <span>Review Threat Model</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};