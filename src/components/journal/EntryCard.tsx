import React from 'react';
import { Archive, Star, Tag } from 'lucide-react';
import type { JournalEntry } from '../../data';
import { buildSnippet, formatShortDate } from '../../journal';

interface EntryCardProps {
  entry: JournalEntry;
  onOpen: (id: string) => void;
  onToggleFavorite?: (entry: JournalEntry) => void;
  onToggleArchive?: (entry: JournalEntry) => void;
}

/** Compact journal-entry card for the home/list grid. */
export const EntryCard: React.FC<EntryCardProps> = ({ entry, onOpen, onToggleFavorite, onToggleArchive }) => {
  const snippet = buildSnippet(entry.body);

  return (
    <article
      onClick={() => onOpen(entry.id)}
      className="group flex cursor-pointer flex-col gap-2 rounded-2xl border border-line bg-surface-2 p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 min-w-0 text-sm font-semibold text-ink-hi">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(entry.id);
            }}
            aria-label={`Open entry: ${entry.title}`}
            className="text-left text-sm font-semibold text-ink-hi hover:text-accent"
          >
            {entry.title}
          </button>
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {entry.favorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Favorite" />}
          {entry.archived && <Archive className="h-3.5 w-3.5 text-ink-faint" aria-label="Archived" />}
        </div>
      </div>

      {snippet && <p className="line-clamp-3 text-xs leading-relaxed text-ink-low">{snippet}</p>}

      <div className="flex items-center gap-2 text-[11px] text-ink-faint">
        <time>{formatShortDate(entry.createdAt)}</time>
        {entry.mood !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5">
            Mood {entry.mood}/5
          </span>
        )}
        {entry.energy !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5">
            Energy {entry.energy}%
          </span>
        )}
      </div>

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-4 px-2 py-0.5 text-[10px] text-ink-mid">
              <Tag className="h-2.5 w-2.5" aria-hidden="true" />
              {tag}
            </span>
          ))}
          {entry.tags.length > 4 && (
            <span className="px-1 py-0.5 text-[10px] text-ink-faint" role="text">
              +{entry.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {(onToggleFavorite || onToggleArchive) && (
        <div className="mt-1 flex items-center gap-1.5" data-testid="entry-actions">
          {onToggleFavorite && (
            <button
              type="button"
              aria-label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={entry.favorite}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(entry);
              }}
              className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-4 hover:text-amber-400"
            >
              <Star className={`h-3.5 w-3.5 ${entry.favorite ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden="true" />
            </button>
          )}
          {onToggleArchive && (
            <button
              type="button"
              aria-label={entry.archived ? 'Unarchive entry' : 'Archive entry'}
              aria-pressed={entry.archived}
              onClick={(e) => {
                e.stopPropagation();
                onToggleArchive(entry);
              }}
              className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-4 hover:text-ink-hi"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default EntryCard;
