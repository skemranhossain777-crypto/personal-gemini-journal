import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Plus, Copy, Check, Feather } from 'lucide-react';
import type { ReflectionMode } from '../../data';
import { getJournalMode, type PromptItem } from '../../journal/modes';
import { toast } from '../../services/toast';

interface JournalPromptsPanelProps {
  mode: ReflectionMode;
  onInsertPrompt: (text: string) => void;
  onSwitchToFreeWrite?: () => void;
  className?: string;
}

export const JournalPromptsPanel: React.FC<JournalPromptsPanelProps> = ({
  mode,
  onInsertPrompt,
  onSwitchToFreeWrite,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const modeDef = getJournalMode(mode);
  const prompts = modeDef.prompts;

  if (!prompts || prompts.length === 0) {
    return null;
  }

  const handleCopyPrompt = (prompt: PromptItem) => {
    const textToCopy = prompt.starter
      ? `${prompt.question}\n${prompt.starter}`
      : prompt.question;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(prompt.id);
    toast.success('Prompt copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (prompt: PromptItem) => {
    const insertText = prompt.starter
      ? `${prompt.question}\n${prompt.starter}`
      : prompt.question;

    onInsertPrompt(insertText);
    toast.success('Inserted prompt into entry.');
  };

  return (
    <div
      role="region"
      aria-label={`${modeDef.name} Optional Prompts`}
      className={`rounded-2xl border border-line bg-surface-2 p-3.5 transition-all ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={`Toggle ${modeDef.name} optional prompts`}
          className="flex items-center gap-2 text-xs font-semibold text-ink-hi hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent rounded py-0.5"
        >
          <HelpCircle className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{modeDef.name} Prompts</span>
          <span className="rounded-full bg-surface-4 px-2 py-0.5 text-[10px] text-ink-mid">
            Optional ({prompts.length})
          </span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
          )}
        </button>

        {mode !== 'free-write' && onSwitchToFreeWrite && (
          <button
            type="button"
            onClick={onSwitchToFreeWrite}
            className="flex items-center gap-1 text-[11px] text-ink-low hover:text-ink-hi focus:outline-none focus:ring-1 focus:ring-accent rounded px-1.5 py-0.5"
          >
            <Feather className="h-3 w-3" aria-hidden="true" />
            <span>Free Write</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-ink-low">
            Tap any prompt to insert it into your journal entry. Prompts are optional helpers and never lock your writing.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="group flex flex-col justify-between rounded-xl border border-line bg-surface-3 p-3 transition-colors hover:border-line-strong hover:bg-surface-4"
              >
                <div>
                  <p className="text-xs font-medium text-ink-hi leading-snug">
                    {prompt.question}
                  </p>
                  {prompt.starter && (
                    <p className="mt-1 text-[11px] text-ink-faint italic line-clamp-2">
                      "{prompt.starter}"
                    </p>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(prompt)}
                    className="flex items-center gap-1 text-ink-low hover:text-ink-hi focus:outline-none focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                    aria-label={`Copy prompt: ${prompt.question}`}
                  >
                    {copiedId === prompt.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInsert(prompt)}
                    className="flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-1 font-medium text-accent hover:bg-accent/25 focus:outline-none focus:ring-2 focus:ring-accent"
                    aria-label={`Insert prompt: ${prompt.question}`}
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    <span>Insert</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
