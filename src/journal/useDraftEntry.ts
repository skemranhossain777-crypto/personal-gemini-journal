import { useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '../data';
import { DraftEngine, type DraftEngineOptions } from './draftEngine';
import type { DraftSnapshot, JournalDraft } from './types';

/**
 * React adapter over `DraftEngine`. Owns the engine lifecycle (manual mode so
 * the hook controls when status flows to React), exposes the live draft and
 * status snapshot, and wires global reload persistence (pagehide /
 * visibilitychange) plus connectivity listeners.
 */
export interface UseDraftEntryOptions extends Omit<DraftEngineOptions, 'onStatusChange' | 'onSaved'> {
  /** Server entry to hydrate (null for a brand-new entry). */
  serverEntry?: JournalEntry | null;
  /** Route-level entry id (drives the local draft key and workflows). */
  requestedEntryId?: string | null;
  onSaved?: (entry: JournalEntry) => void;
}

export interface UseDraftEntryResult {
  draft: JournalDraft;
  snapshot: DraftSnapshot;
  setFields: (patch: Partial<JournalDraft>) => void;
  flush: () => Promise<boolean>;
  retry: () => void;
  /** Confirmed server entry (after any save), else the hydrated server entry. */
  entry: JournalEntry | null;
}

export function useDraftEntry(options: UseDraftEntryOptions): UseDraftEntryResult {
  const { serverEntry, requestedEntryId, onSaved, ...engineOptions } = options;
  const [snapshot, setSnapshot] = useState<DraftSnapshot>({ status: 'idle', saving: false, isOffline: false, lastSavedAt: null, error: null, recovered: false, entryId: requestedEntryId ?? null });
  const [entry, setEntry] = useState<JournalEntry | null>(serverEntry ?? null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const serverEntryRef = useRef(serverEntry);
  serverEntryRef.current = serverEntry;

  const engineRef = useRef<DraftEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new DraftEngine({
      ...engineOptions,
      onStatusChange: (s) => setSnapshot(s),
      onSaved: (saved) => {
        setEntry(saved);
        onSavedRef.current?.(saved);
      },
    });
  }
  const engine = engineRef.current;

  // One-time hydration (per engine instance) with server + local layering.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    engine.hydrate(serverEntryRef.current, requestedEntryId ?? null);
    engine.setMounted(true);
    setSnapshot({ ...engine.snapshot });
    setEntry(serverEntryRef.current ?? null);
    // A recovered (or still-dirty) draft should save itself without waiting
    // for more input — the recovery banner promises exactly that.
    if (engine.snapshot.status === 'dirty') {
      void engine.flush();
    }
    return () => {
      engine.setMounted(false);
      engine.destroy();
    };
    // The engine is created once; hydrate exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connectivity awareness.
  useEffect(() => {
    const goOnline = () => engine.handleConnectivity(true);
    const goOffline = () => engine.handleConnectivity(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global "persist latest on unload" — refresh/navigation/close.
  useEffect(() => {
    const persist = () => {
      void engine.flush();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') void engine.flush();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', hidden);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    draft: engine.fields,
    snapshot,
    setFields: (patch) => engine.setFields(patch),
    flush: () => engine.flush(),
    retry: () => engine.retry(),
    entry,
  };
}