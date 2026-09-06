import React, { useMemo, useState } from 'react';
import { Archive, FilePlus, Search, Star } from 'lucide-react';
import type { Collection, JournalEntry } from '../../data';
import { EntryCard } from '../../components/journal/EntryCard';
import { EmptyState } from '../../components/ui/EmptyState';

interface JournalHomeProps {
  entries: JournalEntry[];
  collections: Collection[];
  loading: boolean;
  canUseCollections: boolean;
  onNewEntry: () => void;
  onOpenEntry: (id: string) => void;
  onToggleFavorite: (entry: JournalEntry) => void;
  onToggleArchive: (entry: JournalEntry) => void;
}

type Tab = 'all' | 'favorites' | 'archived';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: null },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-3.5 w-3.5" aria-hidden="true" /> },
  { id: 'archived', label: 'Archived', icon: <Archive className="h-3.5 w-3.5" aria-hidden="true" /> },
];

/** Journal entry list + search metadata. Free entry search hits title, body,
 * and tags — matching the fields that define a journal page. */
export const JournalHome: React.FC<JournalHomeProps> = ({
  entries,
  collections,
  loading,
  canUseCollections,
  onNewEntry,
  onOpenEntry,
  onToggleFavorite,
  onToggleArchive,
}) => {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = entries;
    if (tab === 'favorites') rows = rows.filter((e) => e.favorite);
    if (tab === 'archived') rows = rows.filter((e) => e.archived);
    if (tab === 'all') rows = rows.filter((e) => !e.archived);
    if (collectionFilter) {
      const collection = collections.find((c) => c.id === collectionFilter);
      if (collection) rows = rows.filter((e) => collection.entryIds.includes(e.id));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) => e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)));
    }
    return rows;
  }, [entries, tab, query, collectionFilter, collections]);

  const counts = useMemo(
    () => ({
      all: entries.filter((e) => !e.archived).length,
      favorites: entries.filter((e) => e.favorite).length,
      archived: entries.filter((e) => e.archived).length,
    }),
    [entries],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink-hi">Journal</h1>
        <p className="mt-1 text-sm text-ink-low">Free writing, saved automatically.</p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, words, or tags…"
            aria-label="Search entries"
            className="h-10 w-full rounded-xl border border-line bg-surface-3 pl-9 pr-3 text-sm text-ink-hi placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onNewEntry}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent-deep px-3.5 text-sm font-medium text-white hover:bg-accent-strong"
        >
          <FilePlus className="h-4 w-4" aria-hidden="true" />
          New
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Entry filters" className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-surface-4 text-ink-hi' : 'text-ink-low hover:text-ink-hi',
            ].join(' ')}
          >
            {t.icon}
            {t.label}
            <span className="tabular-nums text-ink-faint">{counts[t.id]}</span>
          </button>
        ))}

        <span className="sr-only" aria-hidden="true">{counts[tab]}</span>
      </div>

      {/* Collection filter */}
      {canUseCollections && collections.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCollectionFilter(collectionFilter === c.id ? null : c.id)}
              aria-pressed={collectionFilter === c.id}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                collectionFilter === c.id ? 'border-accent bg-accent/15 text-accent' : 'border-line text-ink-mid hover:border-line-strong',
              ].join(' ')}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm text-ink-faint">Loading entries…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FilePlus className="h-8 w-8" aria-hidden="true" />}
          title={query || collectionFilter || tab !== 'all' ? 'Nothing here' : 'Your first entry is waiting'}
          description={
            query || collectionFilter || tab !== 'all'
              ? 'Try a different search.'
              : 'Tap New to write the first page of your journal.'
          }
          actions={
            <button type="button" onClick={onNewEntry} className="inline-flex items-center gap-1.5 rounded-xl bg-accent-deep px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-strong">
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              New entry
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onOpen={onOpenEntry}
              onToggleFavorite={() => onToggleFavorite(entry)}
              onToggleArchive={() => onToggleArchive(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalHome;