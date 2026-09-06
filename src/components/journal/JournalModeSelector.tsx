import React from 'react';
import {
  PenTool,
  Sun,
  Moon,
  Compass,
  Heart,
  Lightbulb,
  Target,
  Briefcase,
  BookOpen,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { ReflectionMode } from '../../data';
import { ALL_JOURNAL_MODES, getJournalMode } from '../../journal/modes';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PenTool,
  Sun,
  Moon,
  Compass,
  Heart,
  Lightbulb,
  Target,
  Briefcase,
  BookOpen,
  MapPin,
};

interface JournalModeSelectorProps {
  currentMode: ReflectionMode;
  onSelectMode: (mode: ReflectionMode) => void;
  className?: string;
}

export const JournalModeSelector: React.FC<JournalModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  className = '',
}) => {
  const activeDef = getJournalMode(currentMode);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-low flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span>Journal Mode</span>
        </label>
        {currentMode !== 'free-write' && (
          <button
            type="button"
            onClick={() => onSelectMode('free-write')}
            className="text-xs font-medium text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-accent rounded px-1"
          >
            Switch to Free Write
          </button>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Journal Mode Selection"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth focus:outline-none"
      >
        {ALL_JOURNAL_MODES.map((modeDef) => {
          const isSelected = currentMode === modeDef.id;
          const IconComponent = ICON_MAP[modeDef.iconName] || PenTool;

          return (
            <button
              key={modeDef.id}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${modeDef.name} mode: ${modeDef.description}`}
              onClick={() => onSelectMode(modeDef.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-accent',
                isSelected
                  ? 'border-accent bg-accent/15 text-accent shadow-sm'
                  : 'border-line bg-surface-2 text-ink-mid hover:border-line-strong hover:bg-surface-3 hover:text-ink-hi',
              ].join(' ')}
              data-testid={`mode-chip-${modeDef.id}`}
            >
              <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{modeDef.name}</span>
            </button>
          );
        })}
      </div>

      {activeDef && (
        <p className="text-[11px] text-ink-faint italic px-0.5">
          {activeDef.description}
        </p>
      )}
    </div>
  );
};
