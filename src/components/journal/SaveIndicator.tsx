import React from 'react';
import { AlertCircle, CheckCircle2, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import type { DraftSnapshot } from '../../journal';
import { formatRelativeTime } from '../../journal';

interface SaveIndicatorProps {
  snapshot: DraftSnapshot;
  onRetry?: () => void;
}

/** Live autosave status. Announcements go through `role="status"` (polite live
 * region) so screen readers hear the outcome without interrupting writing. */
export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ snapshot, onRetry }) => {
  if (snapshot.status === 'idle' && !snapshot.isOffline) return null;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-xs">
      {snapshot.isOffline && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-800/40 bg-amber-950/40 px-2.5 py-1 font-medium text-amber-200">
          <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
          Offline — saved on this device
        </span>
      )}

      {snapshot.status === 'saving' && (
        <span className="inline-flex items-center gap-1.5 text-ink-low">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Saving…
        </span>
      )}

      {snapshot.status === 'saved' && !snapshot.isOffline && (
        <span className="inline-flex items-center gap-1.5 text-ink-faint">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          Saved{snapshot.lastSavedAt ? ` ${formatRelativeTime(new Date(snapshot.lastSavedAt))}` : ''}
        </span>
      )}

      {snapshot.status === 'dirty' && !snapshot.isOffline && (
        <span className="text-ink-low">Unsent changes</span>
      )}

      {snapshot.status === 'error' && (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {snapshot.error ?? 'Save failed'}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 font-medium text-danger hover:bg-danger/10"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default SaveIndicator;
