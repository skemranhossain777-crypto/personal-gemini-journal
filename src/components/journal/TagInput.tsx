import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LIMITS } from '../../data';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

/** Free-form tag entry: Enter or comma commits a tag; chips are removable.
 * Enforced caps mirror the data layer (50 tags × 32 chars). */
export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, disabled = false }) => {
  const [text, setText] = useState('');

  const commit = (raw: string) => {
    const tag = raw.trim().replace(/,$/, '').slice(0, LIMITS.tagLength);
    if (!tag) return;
    if (tags.length >= LIMITS.tagsCount) return;
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange([...tags, tag]);
    }
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(text);
    } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor="tag-input" className="text-xs font-medium text-ink-low">
          Tags
        </label>
        {tags.length >= LIMITS.tagsCount && (
          <span className="text-xs text-ink-faint">max {LIMITS.tagsCount}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface-3 p-1.5 focus-within:border-line-strong">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface-4 px-2 py-0.5 text-xs text-ink-mid"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => remove(tag)}
              disabled={disabled}
              className="text-ink-faint hover:text-danger"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          type="text"
          value={text}
          maxLength={LIMITS.tagLength}
          placeholder={tags.length === 0 ? 'Add a tag, press Enter…' : ''}
          disabled={disabled || tags.length >= LIMITS.tagsCount}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(text)}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-ink-hi placeholder:text-ink-faint focus:outline-none"
        />
      </div>
    </div>
  );
};

export default TagInput;
