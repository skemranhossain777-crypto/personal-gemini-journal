import React from 'react';
import type { Collection } from '../../data';
import { LIMITS } from '../../data';

interface CollectionPickerProps {
  collections: Collection[];
  entryId: string | null;
  disabled?: boolean;
  onToggle: (collection: Collection, add: boolean) => void;
}

/** Toggles this entry in/out of the user's collections. Membership edits the
 * collection's `entryIds` (a collection references entries — not the reverse),
 * so `entryId` must exist (saved) before toggling is meaningful. */
export const CollectionPicker: React.FC<CollectionPickerProps> = ({
  collections,
  entryId,
  disabled = false,
  onToggle,
}) => {
  if (collections.length === 0) {
    return (
      <p className="text-xs text-ink-faint">No collections yet.</p>
    );
  }

  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1.5 text-xs font-medium text-ink-low">Collections</legend>
      <div className="flex flex-wrap gap-1.5">
        {collections.map((c) => {
          const maxed = c.entryIds.length >= LIMITS.stringListCount;
          const checked = entryId !== null && c.entryIds.includes(entryId);
          const dimmed = checked && entryId === null;
          return (
            <button
              key={c.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              disabled={disabled || entryId === null || (!checked && maxed)}
              title={
                entryId === null
                  ? 'Save the entry first, then add it to collections'
                  : uncheckedLabel(maxed, checked)
              }
              onClick={() => onToggle(c, !checked)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                checked
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line text-ink-mid hover:border-line-strong hover:text-ink-hi',
                dimmed ? 'opacity-40 saturate-0' : '',
                disabled || entryId === null ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              {c.name}
              {c.entryIds.length > 0 && checked && <span className="text-ink-faint">({c.entryIds.length})</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

function uncheckedLabel(maxed: boolean, checked: boolean): string {
  if (checked) return 'Remove from collection';
  return maxed ? 'Collection is full' : 'Add to collection';
}

export default CollectionPicker;
