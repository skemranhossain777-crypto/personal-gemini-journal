import React from 'react';
import { AlertCircle, Brain, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import type { MemoryExtractionController } from '../../journal/useMemoryExtraction';

/**
 * Compact, non-blocking status for the AI Memory Engine in the entry composer.
 * Renders the required lifecycle states: loading, candidates available,
 * no candidates, extraction failed + retry, all in the JOURNAL∞ visual
 * language. Extraction never blocks writing — this bar only reflects state.
 */
export const MemoryExtractionBar: React.FC<MemoryExtractionController> = ({
  phase,
  candidatesCreated,
  message,
  run,
  isRunning,
  canRun,
}) => {
  if (phase === 'running' || isRunning) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink-mid">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
        <span>Gemini is reviewing this entry for memory candidates…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {phase === 'success' && (
        <span
          className="inline-flex items-center gap-1.5 text-xs text-ink-low"
          data-testid="memory-extraction-status"
        >
          {candidatesCreated > 0 ? (
            <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          ) : (
            <Brain className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
          )}
          {message}
        </span>
      )}

      {phase === 'error' && (
        <span
          className="inline-flex items-center gap-1.5 text-xs text-amber-300"
          data-testid="memory-extraction-status"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {message || 'Memory extraction failed. Please try again.'}
        </span>
      )}

      {canRun && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => run(true)}
          disabled={!canRun}
          aria-label={phase === 'error' ? 'Retry memory extraction' : 'Extract memory candidates'}
          data-testid="extract-memories-button"
          icon={<Brain className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {phase === 'error' ? 'Retry' : 'Extract memories'}
        </Button>
      )}
    </div>
  );
};

export default MemoryExtractionBar;