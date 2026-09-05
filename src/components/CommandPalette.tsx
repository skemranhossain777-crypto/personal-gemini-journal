import React, { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, FileText, Search, Sparkles } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { listItemVariants, stagger } from '../lib/animations';

export interface CommandPaletteItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface EntryRef {
  id: string;
  title: string;
  subtitle?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandPaletteItem[];
  entries: EntryRef[];
  onSelectEntry: (id: string) => void;
}

const highlight = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${q})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="text-sky-300">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

/**
 * Ctrl/Cmd+K power-user palette: quick actions + cross-entry search & jump.
 * Full keyboard support (Up/Down/Enter/Esc), combobox+listbox semantics.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
  entries,
  onSelectEntry,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  type PaletteResultItem =
  | (CommandPaletteItem & { kind: 'action' })
  | { kind: 'entry'; id: string; label: string; hint?: string; onSelect: () => void };

interface PaletteGroup {
  group: string;
  items: PaletteResultItem[];
}

  const results: PaletteGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actionHits = actions.filter((a) =>
      q ? `${a.label} ${a.keywords ?? ''}`.toLowerCase().includes(q) : true,
    );
    const entryHits = entries.filter((e) =>
      q ? `${e.title} ${e.subtitle ?? ''}`.toLowerCase().includes(q) : true,
    );
    const cappedEntries = q ? entryHits.slice(0, 6) : entryHits.slice(0, 4);
    return [
      { group: 'Actions', items: actionHits.map((a) => ({ ...a, kind: 'action' as const })) },
      {
        group: 'Journal entries',
        items: cappedEntries.map((e) => ({
          id: `entry:${e.id}`,
          label: e.title,
          hint: e.subtitle,
          keywords: `${e.title} ${e.subtitle ?? ''}`,
          kind: 'entry' as const,
          entryId: e.id,
          onSelect: () => onSelectEntry(e.id),
        })),
      },
    ].filter((g) => g.items.length > 0);
  }, [query, actions, entries, onSelectEntry]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);
  const flatCount = flat.length;

  const reset = () => {
    setQuery('');
    setActiveIndex(0);
  };

  const close = () => {
    reset();
    onClose();
  };

  const selectAt = (index: number) => {
    if (index < 0 || index >= flat.length) return;
    const item = flat[index];
    item.onSelect();
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(flatCount, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(flatCount, 1)) % Math.max(flatCount, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectAt(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#27386B] bg-[#0B1226] shadow-2xl"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-[#223056] px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-[#666]" aria-hidden="true" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-autocomplete="list"
                aria-label="Search commands and journal entries"
                type="text"
                placeholder="Search actions, entries, tags..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="w-full bg-transparent text-sm text-[#EEF4FF] placeholder:text-[#666] focus:outline-none"
              />
              <kbd className="shrink-0 rounded border border-[#31447F] bg-[#121E40] px-1.5 py-0.5 text-[10px] text-[#888]">
                Esc
              </kbd>
            </div>

            <div
              id="command-palette-list"
              role="listbox"
              aria-label="Results"
              className="max-h-[46vh] overflow-y-auto p-2"
            >
              {flatCount === 0 && (
                <p className="px-3 py-8 text-center text-xs text-[#666]">
                  No results for “{query}”
                </p>
              )}
              {results.map((group) => (
                <div key={group.group}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#666]">
                    {group.group}
                  </p>
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={stagger(0.04)}
                    className="space-y-0.5"
                  >
                    {group.items.map((item) => {
                      const globalIdx = flat.findIndex((f) => f === item);
                      const isActive = activeIndex === globalIdx;
                      return (
                        <motion.button
                          key={item.id}
                          variants={listItemVariants}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          onClick={() => selectAt(globalIdx)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-[#1C2C5E]' : ''
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isActive
                                ? 'bg-blue-950/60 text-sky-400'
                                : 'bg-[#17254F] text-[#888]'
                            }`}
                          >
                            {(item.kind === 'action' && item.icon)
                                ? item.icon
                                : item.kind === 'entry'
                                  ? <FileText className="h-3.5 w-3.5" />
                                  : <Sparkles className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-[#EEF4FF]">
                              {highlight(item.label, query.trim())}
                            </span>
                            {item.hint && (
                              <span className="block truncate text-[11px] text-[#888]">{item.hint}</span>
                            )}
                          </span>
                          {isActive && (
                            <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[#666]" aria-hidden="true" />
                          )}
                          {item.kind === 'entry' && !isActive && (
                            <span className="shrink-0 rounded bg-[#121E40] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#666]">
                              Jump
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 border-t border-[#223056] bg-[#0E1730] px-4 py-2.5 text-[10px] text-[#666]">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[#31447F] bg-[#121E40] px-1 py-0.5">↑</kbd>
                <kbd className="rounded border border-[#31447F] bg-[#121E40] px-1 py-0.5">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[#31447F] bg-[#121E40] px-1 py-0.5">↵</kbd>
                to select
              </span>
              <span className="ml-auto tracking-widest text-[#555]">⌘K / Ctrl+K to reopen</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;