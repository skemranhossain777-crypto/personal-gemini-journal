import React, { useState } from 'react';
import { Sparkles, ShieldCheck, BookOpen, Brain, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthLandingProps {
  onSignIn: () => Promise<void>;
  onDemoSignIn?: () => void;
  isLoading: boolean;
  onOpenThreatModel: () => void;
}

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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12 bg-[#0A0A0B] text-[#E0E0E0]">
      <div className="w-full max-w-4xl space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#262629] bg-[#161619] px-3.5 py-1 text-xs font-medium text-amber-400 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>AI-Guided Reflection & Thought Partner</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F1F1F1] leading-tight">
            Reflect deeper, brainstorm ideas, and understand your journey.
          </h1>

          <p className="text-base sm:text-lg text-[#A0A0A5] leading-relaxed">
            A private journaling sanctuary paired with Gemini 3.6 Flash. Write multi-turn reflections, receive thoughtful summaries, and keep your entries strictly isolated to your account.
          </p>

          {/* Authentication Action Box */}
          <div className="pt-4 flex flex-col items-center justify-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="google-signin-btn"
                onClick={handleSignInClick}
                disabled={isLoading}
                className="flex items-center justify-center gap-3 rounded-xl bg-[#1A1A1C] border border-[#333338] px-6 py-3 text-sm font-medium text-[#F1F1F1] shadow-lg shadow-black/40 hover:bg-[#242428] hover:border-[#44444C] focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#161619] border border-[#262629] px-5 py-3 text-sm font-medium text-[#A0A0A5] hover:text-[#F1F1F1] hover:bg-[#1E1E22] hover:border-[#3E3E44] transition-all active:scale-98"
                  title="Explore all reflection features instantly in demo workspace"
                >
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>Instant Demo Mode</span>
                </button>
              )}
            </div>

            {authError && (
              <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-xl p-3 max-w-md space-y-2 text-left">
                <p className="font-medium text-amber-200">{authError}</p>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Open in New Tab &rarr;
                  </a>
                  {onDemoSignIn && (
                    <button
                      onClick={onDemoSignIn}
                      className="inline-flex items-center gap-1 rounded bg-amber-900/40 px-2 py-0.5 text-[11px] text-amber-200 border border-amber-700/50 hover:bg-amber-800/50"
                    >
                      Continue in Demo Mode
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-[#666]">
              No passwords stored. Federated Google authentication via Firebase Auth.
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="rounded-2xl border border-[#262629] bg-[#121214] p-6 shadow-sm hover:border-[#3E3E44] transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A1C] border border-[#262629] text-amber-400 mb-4">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-[#F1F1F1] text-base mb-2">Gemini 3.6 Flash Intelligence</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Provides empathetic reflections, creative brainstorming angles, and executive summaries with automatic fallback resilience.
            </p>
          </div>

          <div className="rounded-2xl border border-[#262629] bg-[#121214] p-6 shadow-sm hover:border-[#3E3E44] transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A1C] border border-[#262629] text-emerald-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-[#F1F1F1] text-base mb-2">Isolated Cloud Firestore</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Every journal entry is stored under your UID. Firestore Security Rules prevent other users from accessing your records.
            </p>
          </div>

          <div className="rounded-2xl border border-[#262629] bg-[#121214] p-6 shadow-sm hover:border-[#3E3E44] transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A1C] border border-[#262629] text-blue-400 mb-4">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-[#F1F1F1] text-base mb-2">Multi-Turn History</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Carry on deep, ongoing discussions or re-read past reflections at any time with full message history and tag categorization.
            </p>
          </div>
        </div>

        {/* Privacy & Threat Model Banner */}
        <div className="rounded-2xl border border-[#262629] bg-[#121214] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1A1A1C] border border-[#262629] text-[#A0A0A5]">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#F1F1F1]">Zero Insecure Defaults</h4>
              <p className="text-xs text-[#888]">
                Built to OWASP Top 10 standards with the 5 Threat Zones modeled and verified.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenThreatModel}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:underline whitespace-nowrap"
          >
            <span>Review Threat Model</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
