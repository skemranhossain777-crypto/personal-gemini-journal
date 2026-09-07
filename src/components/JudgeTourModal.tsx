import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Brain,
  MessageSquareQuote,
  ShieldCheck,
  Zap,
  Lock,
  Compass,
  ArrowRight,
  X,
  Layers,
  Database,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { seedDemoEnvironment, resetDemoEnvironment } from '../services/demoEnvironment';

interface JudgeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchDemo?: () => void;
}

export const JudgeTourModal: React.FC<JudgeTourModalProps> = ({
  isOpen,
  onClose,
  onLaunchDemo,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'memory' | 'ask-my-life' | 'reflection' | 'privacy'>('overview');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#31447F] bg-[#0B132B] shadow-2xl text-[#D9E2F5]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#223056] bg-[#0E1730] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#EEF4FF] flex items-center gap-2">
                  <span>JOURNAL∞</span>
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-400">
                    Judge 5-Minute Tour
                  </span>
                </h2>
                <p className="text-xs text-[#888]">Architecture, Gemini Integration & Signature Experiences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[#888] hover:bg-[#1A284D] hover:text-[#EEF4FF]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto border-b border-[#223056] bg-[#0E1730]/60 px-4 pt-2 text-xs font-medium scrollbar-none">
            {[
              { id: 'overview', label: '1. What & Why', icon: Compass },
              { id: 'memory', label: '2. Personal Memory Engine', icon: Brain },
              { id: 'ask-my-life', label: '3. Ask My Life RAG', icon: MessageSquareQuote },
              { id: 'reflection', label: '4. AI Reflection Loop', icon: Zap },
              { id: 'privacy', label: '5. Privacy & Defense', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-sky-400 text-sky-400 font-semibold'
                      : 'border-transparent text-[#888] hover:text-[#D9E2F5]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-[#223056] bg-[#121E40]/60 p-5 space-y-3">
                  <h3 className="text-base font-bold text-[#EEF4FF] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sky-400" />
                    What is JOURNAL∞?
                  </h3>
                  <p className="text-xs leading-relaxed text-[#A9B8DB]">
                    JOURNAL∞ is an AI-native personal wisdom engine. Rather than leaving daily journal entries as static dead text, JOURNAL∞ uses <strong>Gemini</strong> to extract structured personal memories, generate daily reflections, and allow users to query their past experiences conversationally with Evidence-grounded retrieval designed to reduce unsupported answers.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-2">
                    <div className="font-semibold text-[#EEF4FF] flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-400" />
                      Why does Gemini Matter?
                    </div>
                    <p className="text-[#888] leading-relaxed">
                      Gemini's large context windows enable deep multi-journal RAG synthesis, structured JSON memory extraction, and real-time reflection responses.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-2">
                    <div className="font-semibold text-[#EEF4FF] flex items-center gap-2">
                      <Layers className="h-4 w-4 text-sky-400" />
                      What Makes It Different?
                    </div>
                    <p className="text-[#888] leading-relaxed">
                      <strong>Zero Untrusted Consent Mutations:</strong> AI proposes memory candidates, but NEVER mutates your memory bank automatically. <strong>Untrusted Data Isolation:</strong> Journal entries are treated strictly as data payloads, with defenses designed to reduce prompt-injection risk.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-2">
                    <div className="font-semibold text-[#EEF4FF] flex items-center gap-2">
                      <Database className="h-4 w-4 text-emerald-400" />
                      Google Cloud Foundation
                    </div>
                    <p className="text-[#888] leading-relaxed">
                      Deploys on <strong>Google Cloud Run</strong> with multi-stage Docker containerization, <strong>Google Secret Manager</strong> key injection, <strong>Cloud Logging</strong> structured telemetry, and <strong>Firebase Auth/Firestore</strong> path isolation.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-2">
                    <div className="font-semibold text-[#EEF4FF] flex items-center gap-2">
                      <Lock className="h-4 w-4 text-indigo-400" />
                      Why Would Someone Use This?
                    </div>
                    <p className="text-[#888] leading-relaxed">
                      Daily journaling requires effort to review past insights. JOURNAL∞ builds a lifelong personal knowledge graph automatically, turning fleeting daily thoughts into long-term personal growth.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4 space-y-2">
                  <h3 className="font-bold text-sky-300 text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-sky-400" />
                    Signature Experience #1: Personal Memory Engine
                  </h3>
                  <p className="text-[#A9B8DB] leading-relaxed">
                    The Memory Engine scans raw reflection entries and extracts structured candidate memories across <strong>11 canonical types</strong> (decision, milestone, preference, goal, insight, habit, challenge, value, relationship, location, idea).
                  </p>
                </div>

                <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-3">
                  <h4 className="font-semibold text-[#EEF4FF]">Memory Candidate Pipeline Rules:</h4>
                  <ul className="space-y-2 text-[#888]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Candidate Proposal Only:</strong> Extracted memories are returned as un-saved proposals. The user retains complete authority to accept, modify, or reject candidates.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Importance & Confidence Normalization:</strong> Scores are normalized to 1..5 for importance and 0..1 for confidence with strict fallback to "idea" for unrecognized types.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Firestore Isolation:</strong> Accepted memories store under <code>/users/&#123;uid&#125;/memories/&#123;memoryId&#125;</code> with index filtering.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'ask-my-life' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-2">
                  <h3 className="font-bold text-indigo-300 text-sm flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4 text-indigo-400" />
                    Signature Experience #2: Ask My Life RAG Retrieval
                  </h3>
                  <p className="text-[#A9B8DB] leading-relaxed">
                    Ask My Life allows you to ask open-ended questions about your life history ("What were my main career milestones last year?", "When did I feel most energized?").
                  </p>
                </div>

                <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-3">
                  <h4 className="font-semibold text-[#EEF4FF]">RAG Architecture & Defense In Depth:</h4>
                  <ul className="space-y-2 text-[#888]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Context Compression:</strong> Retained entry contexts exceeding 12,000 characters are intelligently compressed before model submission.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Factual Citations:</strong> Answers explicitly cite entry dates and titles as evidence tags.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Insufficient Evidence Handling:</strong> If retrieved journals contain no relevant information, Gemini responds with clear notice rather than fabricating details.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'reflection' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 space-y-2">
                  <h3 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Signature Experience #3: AI Reflection Loop
                  </h3>
                  <p className="text-[#A9B8DB] leading-relaxed">
                    A real-time thought partner embedded inside the editor. Offers instant reflections, perspective reframing, theme extraction, and contextual coaching while you write.
                  </p>
                </div>

                <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-3">
                  <h4 className="font-semibold text-[#EEF4FF]">Resilience Highlights:</h4>
                  <ul className="space-y-2 text-[#888]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Autosave & Draft Recovery:</strong> In-flight reflections are stored in IndexedDB and sync automatically upon network reconnection.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2">
                  <h3 className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Privacy, Security & OWASP Defense
                  </h3>
                  <p className="text-[#A9B8DB] leading-relaxed">
                    JOURNAL∞ adheres to strict security engineering principles to protect personal user reflections.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-1.5">
                    <div className="font-semibold text-[#EEF4FF]">Firestore Rule Isolation</div>
                    <p className="text-[#888]">Cross-user data access is physically blocked at the database layer using strict `request.auth.uid == userId` rules.</p>
                  </div>
                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-1.5">
                    <div className="font-semibold text-[#EEF4FF]">Server-Side Token Checks</div>
                    <p className="text-[#888]">Express endpoints verify Firebase ID tokens using RS256 JWKS public key cryptography.</p>
                  </div>
                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-1.5">
                    <div className="font-semibold text-[#EEF4FF]">Retrieval Defense</div>
                    <p className="text-[#888]">Retrieved journal text is wrapped in explicit <code>&lt;RETRIEVED_CONTENT&gt;</code> XML tags and marked untrusted to reduce instruction-hijack risk.</p>
                  </div>
                  <div className="rounded-xl border border-[#223056] bg-[#0E1730] p-4 space-y-1.5">
                    <div className="font-semibold text-[#EEF4FF]">Data Export & Permanent Deletion</div>
                    <p className="text-[#888]">Sign in to export JSON/Markdown/CSV archives or permanently delete your journal, memories, or all stored data from the Privacy Center. Deleting data never deletes your Google login.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-[#223056] bg-[#0E1730] px-6 py-4">
            <p className="text-xs text-[#888]">
              Ready to evaluate? Launch Instant Demo Mode to explore the AI journal & reflection loop live with sample data.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  resetDemoEnvironment('demo-local-user');
                  if (onLaunchDemo) {
                    onClose();
                    onLaunchDemo();
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/40 active:scale-95"
                title="Reset demo entries and memories back to pristine baseline sample state"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Demo Environment</span>
              </button>
              {onLaunchDemo && (
                <button
                  onClick={() => {
                    seedDemoEnvironment('demo-local-user');
                    onClose();
                    onLaunchDemo();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-600/20 px-4 py-2 text-xs font-semibold text-sky-300 transition-all hover:bg-sky-600/30 active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Launch Instant Demo Mode</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-xl border border-[#223056] bg-[#121E40] px-4 py-2 text-xs font-medium text-[#D9E2F5] hover:bg-[#1A284D]"
              >
                Close Tour
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
