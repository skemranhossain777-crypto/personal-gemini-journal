import { useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '../data';
import { ensureEmbedding, isSemanticRetrievalEnabledClient } from '../services/embeddingSync';

export interface EmbeddingSyncController {
  synced: boolean;
  lastStatus: 'idle' | 'done' | 'skipped';
}

/**
 * Best-effort G3 embedding sync for journal entries. Fires whenever the saved
 * entry snapshot changes (new id or changed title/body/tags), which covers both
 * create and in-place edits. The server is idempotent via text hash, so
 * repeated autosave flushes resolve to `unchanged` without a re-embed.
 * Never throws; flag-gated client-side so off/default installs skip entirely.
 */
export function useEmbeddingSync(
  entry: JournalEntry | null,
  options: { enabled?: boolean } = {}
): EmbeddingSyncController {
  const enabled = options.enabled ?? isSemanticRetrievalEnabledClient();
  const [lastStatus, setLastStatus] = useState<'idle' | 'done' | 'skipped'>('idle');
  const lastRef = useRef<{ id?: string; text?: string }>({});

  useEffect(() => {
    if (!enabled || !entry) return;
    const text = `${entry.title || ''}\n${entry.body || ''}\n${(entry.tags || []).join(',')}`;
    const last = lastRef.current;
    if (last.id === entry.id && last.text === text) return;
    lastRef.current = { id: entry.id, text };
    let cancelled = false;
    void ensureEmbedding('entry', entry.id).then((result) => {
      if (cancelled) return;
      setLastStatus(
        result && (result.status === 'written' || result.status === 'unchanged') ? 'done' : 'skipped'
      );
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, entry]);

  return { synced: lastStatus === 'done', lastStatus };
}