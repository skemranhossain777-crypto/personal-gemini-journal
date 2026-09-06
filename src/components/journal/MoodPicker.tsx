import React from 'react';

interface MoodPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

const MOOD_LABELS: Record<number, string> = {
  1: 'rough',
  2: 'low',
  3: 'okay',
  4: 'good',
  5: 'great',
};

/** 1–5 mood selector as a radio group (keyboard/axe friendly). */
export const MoodPicker: React.FC<MoodPickerProps> = ({ value, onChange }) => {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1.5 text-xs font-medium text-ink-low">Mood</legend>
      <div role="radiogroup" aria-label="Mood" className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              title={`${n} — ${MOOD_LABELS[n]}`}
              onClick={() => onChange(selected ? null : n)}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                selected
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-line text-ink-mid hover:border-line-strong hover:text-ink-hi',
              ].join(' ')}
            >
              {n}
            </button>
          );
        })}
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-xs text-ink-faint underline-offset-2 hover:text-ink-mid hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </fieldset>
  );
};

export default MoodPicker;