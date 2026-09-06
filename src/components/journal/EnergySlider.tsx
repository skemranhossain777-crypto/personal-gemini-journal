import React from 'react';

interface EnergySliderProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** 0–100 energy selector. Null means "untracked". */
export const EnergySlider: React.FC<EnergySliderProps> = ({ value, onChange }) => {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-low" id="energy-label">
          Energy
        </span>
        <span className="text-xs text-ink-faint">
          {value === null ? 'not tracked' : `${value}%`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value ?? 0}
          aria-labelledby="energy-label"
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-[--accent]"
        />
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs whitespace-nowrap text-ink-faint underline-offset-2 hover:text-ink-mid hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default EnergySlider;
