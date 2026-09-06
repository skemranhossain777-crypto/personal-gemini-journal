import React, { useState } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Eye,
  Lightbulb,
  Compass,
  Copy,
  Check,
  Tag,
  User,
  ShieldCheck,
} from 'lucide-react';
import type { CompanionSkillOutput } from '../../../server/gemini/types';
import { toast } from '../../services/toast';

interface AiAttributionResponseCardProps {
  userPrompt?: string;
  output: CompanionSkillOutput;
  className?: string;
}

export const AiAttributionResponseCard: React.FC<AiAttributionResponseCardProps> = ({
  userPrompt,
  output,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(output.reply);
    setCopied(true);
    toast.success('Reflection copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-testid="ai-attribution-card"
      className={`rounded-2xl border border-line bg-surface-2 p-5 shadow-sm space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-hi flex items-center gap-1.5">
              <span>Gemini Companion</span>
              <span className="capitalize text-accent font-semibold">• {output.skill}</span>
            </h3>
            <p className="text-[11px] text-ink-faint font-mono">
              Model: {output.modelUsed}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-line bg-surface-3 px-2.5 py-1 text-xs font-medium text-ink-mid hover:bg-surface-4 hover:text-ink-hi transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Copy AI response"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Optional User Input Reference Block */}
      {userPrompt && (
        <div className="rounded-xl border border-line/60 bg-surface-3/60 p-3 text-xs">
          <div className="flex items-center gap-1.5 text-ink-low font-semibold uppercase tracking-wider text-[10px] mb-1">
            <User className="h-3 w-3 text-ink-mid" aria-hidden="true" />
            <span>User Entry Content</span>
          </div>
          <p className="text-ink-mid italic line-clamp-2">"{userPrompt}"</p>
        </div>
      )}

      {/* Main Markdown Reply */}
      <div className="prose prose-invert max-w-none text-sm text-ink-hi leading-relaxed">
        <Markdown>{output.reply}</Markdown>
      </div>

      {/* Segmented Attribution Section: Observations, Suggestions, Inferences */}
      <div className="space-y-3 pt-2">
        {/* 1. AI Observations (Grounded Facts) */}
        {output.observations && output.observations.length > 0 && (
          <div
            data-testid="ai-attribution-observations"
            className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-3.5 space-y-1.5"
          >
            <div className="flex items-center justify-between text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>AI Observation</span>
              </span>
              <span className="text-[10px] text-sky-400/70 font-mono">Grounded in User Text</span>
            </div>
            <ul className="list-disc list-inside text-xs text-sky-200/90 space-y-1 pl-0.5">
              {output.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 2. AI Suggestions (Actionable Steps) */}
        {output.suggestions && output.suggestions.length > 0 && (
          <div
            data-testid="ai-attribution-suggestions"
            className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3.5 space-y-1.5"
          >
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>AI Suggestion</span>
              </span>
              <span className="text-[10px] text-emerald-400/70 font-mono">Actionable Options</span>
            </div>
            <ul className="list-disc list-inside text-xs text-emerald-200/90 space-y-1 pl-0.5">
              {output.suggestions.map((sug, idx) => (
                <li key={idx}>{sug}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. AI Inferences (Inferred Connections) */}
        {output.inferences && output.inferences.length > 0 && (
          <div
            data-testid="ai-attribution-inferences"
            className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-3.5 space-y-1.5"
          >
            <div className="flex items-center justify-between text-purple-400 text-xs font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
                <span>AI Inference</span>
              </span>
              <span className="text-[10px] text-purple-400/70 font-mono">Explicitly Labeled as Inferred</span>
            </div>
            <ul className="list-disc list-inside text-xs text-purple-200/90 space-y-1 pl-0.5">
              {output.inferences.map((inf, idx) => (
                <li key={idx}>{inf}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary & Tags */}
      {(output.summary || (output.tags && output.tags.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs">
          {output.summary && (
            <p className="text-ink-low italic text-[11px] flex-1 min-w-[200px]">
              "{output.summary}"
            </p>
          )}

          {output.tags && output.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="h-3 w-3 text-accent" aria-hidden="true" />
              {output.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-surface-3 border border-line px-2 py-0.5 text-[10px] font-medium text-accent"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Control & Safety Disclaimer Footer */}
      <div className="flex items-center gap-1.5 text-[10px] text-ink-faint border-t border-line/40 pt-2">
        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" aria-hidden="true" />
        <span>Grounded reflection partner. You retain full control over your journal content.</span>
      </div>
    </div>
  );
};
