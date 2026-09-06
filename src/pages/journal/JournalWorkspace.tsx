import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Collection, JournalEntry } from '../../data';
import { collectionsApi } from '../../data';
import { createFirebaseAttachmentStore, createFirestoreJournalStore, createDemoJournalStore, type JournalStore } from '../../journal';
import { useAuth } from '../../auth/AuthContext';
import { toast } from '../../services/toast';
import { EntryEditor } from './EntryEditor';
import { JournalHome } from './JournalHome';

interface JournalWorkspaceProps {
  /** Entry id to open (null = journal home). */
  entryId: string | null;
  /** True when opening the composer for a brand-new entry. */
  isNew: boolean;
  onNavigateHome: () => void;
  onOpenNew: () => void;
  onOpenEntry: (id: string) => void;
}

/** Journal∞ workspace: owns the data sources (per-user store + collections),
 * subscribes them, and routes between the home list and the composer. */
export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  entryId,
  isNew,
  onNavigateHome,
  onOpenNew,
  onOpenEntry,
}) => {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const isDemo = user?.isDemo ?? false;

  const store = useMemo<JournalStore>(
    () => (isDemo || !uid ? createDemoJournalStore(uid || 'demo') : createFirestoreJournalStore()),
    [isDemo, uid],
  );

  const attach = useMemo(() => (isDemo ? null : createFirebaseAttachmentStore()), [isDemo]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);

  // Server entry for the composer (editing an existing entry).
  const [serverEntry, setServerEntry] = useState<JournalEntry | null>(null);
  const [entryLoading, setEntryLoading] = useState(isNew ? false : entryId !== null);
  const activeEntryId = useRef<string | null>(null);

  // Entries subscription.
  useEffect(() => {
    setEntriesLoaded(false);
    setEntries([]);
    const unsub = store.subscribe(
      (items) => {
        setEntries(items);
        setEntriesLoaded(true);
      },
      (err) => {
        setEntriesLoaded(true);
        toast.error(err.message);
      },
    );
    return unsub;
  }, [store]);

  // Collections subscription (real users only).
  useEffect(() => {
    if (isDemo) {
      setCollections([]);
      setCollectionsLoaded(true);
      return;
    }
    setCollectionsLoaded(false);
    const unsub = collectionsApi.subscribe(
      (items) => {
        setCollections(items);
        setCollectionsLoaded(true);
      },
      (err) => {
        setCollectionsLoaded(true);
        console.warn('[journal] collections subscription failed:', err);
      },
    );
    return unsub;
  }, [isDemo]);

  // Load the server entry when the composer opens an existing entry.
  useEffect(() => {
    activeEntryId.current = entryId;
    if (entryId === null || isNew) {
      setServerEntry(null);
      setEntryLoading(false);
      return;
    }
    let cancelled = false;
    setEntryLoading(true);
    store
      .get(entryId)
      .then((entry) => {
        if (!cancelled) setServerEntry(entry);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Could not open the entry.');
        setServerEntry(null);
      })
      .finally(() => {
        if (!cancelled) setEntryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId, isNew, store]);

  const updateEntryFlags = useCallback(
    async (entry: JournalEntry, patch: Partial<Pick<JournalEntry, 'favorite' | 'archived'>>) => {
      try {
        await store.update(entry.id, {
          title: entry.title,
          body: entry.body,
          mode: entry.mode,
          mood: entry.mood,
          energy: entry.energy,
          tags: [...entry.tags],
          location: entry.location ? { ...entry.location } : null,
          attachments: [...entry.attachments],
          favorite: patch.favorite ?? entry.favorite,
          archived: patch.archived ?? entry.archived,
          private: entry.private,
        });
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not update the entry.');
      }
    },
    [store],
  );

  const toggleCollection = useCallback(
    async (collection: Collection, add: boolean) => {
      if (isDemo) return;
      if (!activeEntryId.current) return;
      const entryIdNow = activeEntryId.current;
      const nextIds = add
        ? Array.from(new Set([...(collection.entryIds ?? []), entryIdNow]))
        : (collection.entryIds ?? []).filter((id) => id !== entryIdNow);
      try {
        const saved = await collectionsApi.update(collection.id, { entryIds: nextIds });
        setCollections((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not update the collection.');
      }
    },
    [isDemo],
  );

  const handleDeleted = useCallback(() => {
    toast.success('Entry deleted.');
    onNavigateHome();
  }, [onNavigateHome]);

  // Composer open?
  const inEditor = entryId !== null || isNew;

  return inEditor ? (
    <EntryEditor
      store={store}
      attachmentStore={attach}
      entryId={isNew ? null : entryId}
      serverEntry={serverEntry}
      loading={entryLoading}
      collections={collections}
      canUseCollections={!isDemo && collectionsLoaded}
      onToggleCollection={toggleCollection}
      onNavigateHome={onNavigateHome}
      onDeleted={handleDeleted}
    />
  ) : (
    <JournalHome
      entries={entries}
      collections={collections}
      loading={!entriesLoaded}
      canUseCollections={!isDemo && collectionsLoaded}
      onNewEntry={() => onOpenNew()}
      onOpenEntry={onOpenEntry}
      onToggleFavorite={(e) => void updateEntryFlags(e, { favorite: !e.favorite })}
      onToggleArchive={(e) => void updateEntryFlags(e, { archived: !e.archived })}
    />
  );
};

export default JournalWorkspace;
