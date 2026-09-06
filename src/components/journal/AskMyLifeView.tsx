import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  HelpCircle,
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Brain,
  Target,
  Calendar,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, TimelineEvent } from '../../data/models';
import { askMyLifeQuery } from '../../services/askMyLife';
import type { AskMyLifeOutput, EvidenceCitation } from '../../../server/gemini/types';
import { toast } from '../../services/toast';

interface AskMyLifeViewProps {
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  timelineEvents?: TimelineEvent[];
  onOpenEntry?: (entryId: string) => void;
  className?: string;
}

export const SAMPLE_QUESTIONS = [
  'What made me happiest this year?',
  'What goals have I repeatedly postponed?',
  'When did I last write about this project?',
  'What challenges keep appearing?',
  'Show me moments where I felt proud.',
  'What have I learned about this project?',
];

export const AskMyLifeView: React.FC<AskMyLifeViewProps> = ({
  entries,
  memories = [],
  goals = [],
  timelineEvents = [],
  onOpenEntry,
  className = '',
}) => {
  const [question, setQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [result, setResult] = useState<AskMyLifeOutput | null>(null);
  const [lastAskedQuestion, setLastAskedQuestion] = useState('');

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk || question).trim();
    if (!q || isQuerying) return;

    setQuestion(q);
    setLastAskedQuestion(q);
    setIsQuerying(true);
    setResult(null);

    try {
      const output = await askMyLifeQuery({
        question: q,
        entries,
        memories,
        goals,
        timelineEvents,
      });

      setResult(output);
    } catch (err: any) {
      console.error('Ask My Life query failed:', err);
      toast.error(err.message || 'Failed to query your journal history.');
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div
      data-testid="ask-my-life-view"
      className={`flex flex-col h-full bg-[#070B16] text-[#D9E2F5] p-4 sm:p-6 space-y-6 overflow-y-auto ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#223056] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#EEF4FF]">
              Ask My Life
            </h2>
            <p className="text-xs text-[#888]">
              Talk to your personal journal history. Answers are grounded in your actual entries and memories with verified evidence citations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Anti-Hallucination Enforced</span>
          </span>
        </div>
      </div>

      {/* Query Composer Box */}
      <div className="rounded-2xl border border-[#223056] bg-[#0E1730] p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="ask-question-input" className="text-xs font-semibold text-[#EEF4FF] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>Ask anything about your past thoughts, goals, milestones, or patterns</span>
          </label>
          <span className="text-[11px] text-[#666] font-mono">
            {entries.length} Entries • {memories.length} Memories
          </span>
        </div>

        {/* Input Bar */}
        <div className="relative">
          <textarea
            id="ask-question-input"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder='e.g., "What made me happiest this year?" or "When did I last write about this project?"'
            className="w-full resize-none rounded-xl border border-[#223056] bg-[#121E40] p-3 pr-24 text-sm text-[#EEF4FF] placeholder:text-[#666] focus:outline-none focus:border-sky-500/60"
          />

          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={!question.trim() || isQuerying}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 transition-all disabled:opacity-40"
          >
            {isQuerying ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            <span>{isQuerying ? 'Searching...' : 'Ask'}</span>
          </button>
        </div>

        {/* Quick Sample Prompts */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666]">
            Sample Inspiration Queries
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUESTIONS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(sample)}
                className="rounded-lg border border-[#223056] bg-[#121E40] px-2.5 py-1 text-xs text-[#9FB0D4] hover:border-sky-500/40 hover:bg-[#1C2C5E] hover:text-[#EEF4FF] transition-colors"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isQuerying && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#223056] bg-[#0E1730] p-6 text-center space-y-3"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <Brain className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#EEF4FF]">
              Consulting Your Journal History...
            </h3>
            <p className="text-xs text-[#888] mt-0.5">
              Performing intent detection, retrieving relevant entries & memories, and verifying evidence citations.
            </p>
          </div>
        </motion.div>
      )}

      {/* Structured Answer Result Card */}
      {result && !isQuerying && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#223056] bg-[#0E1730] p-5 sm:p-6 space-y-5 shadow-md"
        >
          {/* Question Title & Grounding Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#223056] pb-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666]">
                Query Result
              </span>
              <h3 className="font-serif text-lg font-bold text-[#EEF4FF]">
                "{lastAskedQuestion}"
              </h3>
            </div>

            {/* Confidence & Evidence Badge */}
            <div className="flex items-center gap-2">
              {result.hasSufficientEvidence ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    {result.confidence === 'high' ? 'High Evidence Grounding' : 'Grounded in Evidence'}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-amber-800/40 bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span>Insufficient Journal Evidence</span>
                </span>
              )}

              <span className="text-[11px] font-mono text-[#888] rounded-md bg-[#121E40] border border-[#223056] px-2 py-0.5">
                {result.modelUsed}
              </span>
            </div>
          </div>

          {/* Insufficient Evidence Warning Banner */}
          {!result.hasSufficientEvidence && (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-200">Insufficient Journal History</p>
                <p className="mt-0.5 text-amber-300/90 leading-relaxed">
                  Your journal entries do not contain sufficient evidence to answer this question accurately. Ask My Life never fabricates history.
                </p>
              </div>
            </div>
          )}

          {/* Main Answer Content */}
          <div className="prose prose-invert max-w-none text-sm text-[#EEF4FF] leading-relaxed">
            <Markdown>{result.answer}</Markdown>
          </div>

          {/* Cites Evidence Grid */}
          {result.evidence && result.evidence.length > 0 && (
            <div className="space-y-3 border-t border-[#223056] pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                  <span>Cited Evidence Documents ({result.evidence.length})</span>
                </h4>
                <span className="text-[10px] text-[#666]">
                  Verified sources used for this answer
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.evidence.map((item, idx) => {
                  const isEntry = item.type === 'entry';
                  return (
                    <div
                      key={idx}
                      data-testid={`evidence-citation-${idx}`}
                      className="rounded-xl border border-[#223056] bg-[#121E40] p-3.5 space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono uppercase font-semibold text-sky-400">
                            • {item.type}
                          </span>
                          {item.date && (
                            <span className="text-[#666] font-mono">{item.date}</span>
                          )}
                        </div>

                        <h5 className="text-xs font-semibold text-[#EEF4FF] line-clamp-1">
                          {item.title}
                        </h5>

                        {item.snippet && (
                          <p className="text-[11px] text-[#D9E2F5]/80 italic line-clamp-2">
                            "{item.snippet}"
                          </p>
                        )}
                      </div>

                      {/* View Source Button */}
                      {isEntry && onOpenEntry && item.id && (
                        <div className="pt-2 border-t border-[#223056]/60">
                          <button
                            type="button"
                            onClick={() => onOpenEntry(item.id)}
                            className="flex items-center gap-1 text-[11px] text-sky-400 hover:underline font-mono"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View Source Entry</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
