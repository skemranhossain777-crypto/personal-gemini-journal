import React, { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, CalendarDays, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import type { Collection, JournalEntry } from '../../data';
import { LIMITS } from '../../data';
import { toast } from '../../services/toast';
import {
  useDraftEntry,
  type AttachmentStore,
  type DraftSnapshot,
  type JournalDraft,
  type JournalStore,
} from '../../journal';
import { AttachmentList } from '../../components/journal/AttachmentList';
import { CollectionPicker } from '../../components/journal/CollectionPicker';
import { EnergySlider } from '../../components/journal/EnergySlider';
import { MoodPicker } from '../../components/journal/MoodPicker';
import { SaveIndicator } from '../../components/journal/SaveIndicator';
import { TagInput } from '../../components/journal/TagInput';
import { JournalModeSelector } from '../../components/journal/JournalModeSelector';
import { JournalPromptsPanel } from '../../components/journal/JournalPromptsPanel';
import { getModePlaceholder } from '../../journal';
import { LocationPicker } from '../../components/LocationPicker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import type { JournalLocation } from '../../types';

interface EntryEditorProps {
  store: JournalStore;
  attachmentStore: AttachmentStore | null;
  entryId: string | null;
  serverEntry: JournalEntry | null;
  loading: boolean;
  collections: Collection[];
  canUseCollections: boolean;
  onToggleCollection: (collection: Collection, add: boolean) => Promise<void>;
  onNavigateHome: () => void;
  onDeleted: () => void;
  autosaveDebounceMs?: number;
}

/** Full-screen composer for one journal entry. The entire document surface is
 * the body textarea — metadata (mood, energy, tags, location, attachments) lives
 * in collapsible details sections so mobile writers focus on the words. */
export const EntryEditor: React.FC<EntryEditorProps> = ({
  store,
  attachmentStore,
  entryId,
  serverEntry,
  loading,
  collections,
  canUseCollections,
  onToggleCollection,
  onNavigateHome,
  onDeleted,
  autosaveDebounceMs,
}) => {
  const {
    draft,
    snapshot,
    setFields,
    flush,
    retry,
    entry,
  } = useDraftEntry({
    store,
    serverEntry,
    requestedEntryId: entryId,
    debounceMs: autosaveDebounceMs,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Keep focus for the primary writing surface.
  useEffect(() => {
    if (!loading && !serverEntry && entryId === null && bodyRef.current) {
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(0, 0);
    }
  }, [loading, serverEntry, entryId]);

  const patch = (p: Partial<JournalDraft>) => setFields(p);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Land any pending autosave first so the local draft can't resurrect the
      // entry after deletion.
      await flush();
      if (entry) {
        await store.remove(entry.id);
      }
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the entry.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleAddFile = async (file: File, kind: JournalEntry['attachments'][number]['kind']) => {
    if (!attachmentStore) {
      toast.error('Attachments need Firebase Storage, which is not configured here.');
      return;
    }
    setUploading(true);
    try {
      if (draft.attachments.length >= LIMITS.attachmentsCount) {
        toast.error(`You can attach at most ${LIMITS.attachmentsCount} files.`);
        return;
      }
      const attachment = await attachmentStore.upload(file, kind);
      patch({ attachments: [...draft.attachments, attachment] });
      toast.success('Attachment added.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (attachment: JournalEntry['attachments'][number]) => {
    if (attachmentStore) {
      void attachmentStore.remove(attachment);
    }
    patch({ attachments: draft.attachments.filter((a) => a.id !== attachment.id) });
  };

  const handleToggleCollection = async (collection: Collection, add: boolean) => {
    await onToggleCollection(collection, add);
  };

  const handleInsertPromptText = (text: string) => {
    const current = draft.body;
    const nextBody = current.trim().length === 0 ? text : `${current}\n\n${text}`;
    patch({ body: nextBody });
    if (bodyRef.current) {
      bodyRef.current.focus();
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface-1/95 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-mid hover:bg-surface-3 hover:text-ink-hi"
          aria-label="Back to journal"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-ink-hi">
            {entry ? entry.title : 'New entry'}
          </h1>
          <div className="flex items-center gap-2">
            <SaveIndicator snapshot={snapshot} onRetry={retry} />
          </div>
        </div>
        <Button variant="ghost" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} iconOnly onClick={() => setConfirmDelete(true)} aria-label="Delete entry" />
      </header>

      {snapshot.recovered && (
        <div className="border-b border-amber-800/40 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200">
          We recovered unsent changes from this device and are saving them now.
        </div>
      )}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-16 pt-4">
        {loading && (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-ink-low" aria-hidden="true" />
          </div>
        )}

        {!loading && (
          <>
            {/* Journal Mode Selector & Optional Prompts */}
            <JournalModeSelector
              currentMode={draft.mode}
              onSelectMode={(mode) => patch({ mode })}
              className="mb-4"
            />

            {draft.mode !== 'free-write' && (
              <JournalPromptsPanel
                mode={draft.mode}
                onInsertPrompt={handleInsertPromptText}
                onSwitchToFreeWrite={() => patch({ mode: 'free-write' })}
                className="mb-4"
              />
            )}

            {/* Free-writing surface (primary) */}
            <textarea
              ref={bodyRef}
              role="textbox"
              aria-multiline="true"
              aria-label="Write your entry"
              value={draft.body}
              maxLength={LIMITS.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder={getModePlaceholder(draft.mode)}
              className="min-h-[60vh] w-full flex-1 resize-y bg-transparent py-2 text-lg leading-relaxed text-ink-hi placeholder:text-ink-faint focus:outline-none"
              data-testid="entry-body"
            />

            {/* Metadata */}
            <details className="mt-4 rounded-2xl border border-line bg-surface-2 px-4 py-3" open={false}>
              <summary className="cursor-pointer select-none text-sm font-medium text-ink-mid">Details</summary>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-wrap gap-6">
                  <MoodPicker value={draft.mood} onChange={(mood) => patch({ mood })} />
                  <div className="w-56 max-w-full">
                    <EnergySlider value={draft.energy} onChange={(energy) => patch({ energy })} />
                  </div>
                </div>

                <TagInput tags={draft.tags} onChange={(tags) => patch({ tags })} />

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-ink-low">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                    Location
                  </span>
                  <LocationPicker
                    location={draft.location as JournalLocation | null}
                    onLocationChange={(location) => patch({ location: location as JournalEntry['location'] | null })}
                  />
                </div>

                <AttachmentList
                  attachments={draft.attachments}
                  uploading={uploading}
                  onAddFile={handleAddFile}
                  onRemove={handleRemoveAttachment}
                />

                {canUseCollections ? (
                  <CollectionPicker
                    collections={collections}
                    entryId={entry?.id ?? null}
                    onToggle={handleToggleCollection}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    Collections need a Google account.
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-ink-low">
                  <input
                    type="checkbox"
                    checked={draft.private}
                    onChange={(e) => patch({ private: e.target.checked })}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  />
                  Keep private to me
                </label>
              </div>
            </details>
          </>
        )}
      </main>

      {/* Floating save state for mobile (always visible while composing). */}
      {!loading && snapshot.status !== 'idle' && (
        <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-1/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <SaveIndicator snapshot={snapshot} onRetry={retry} />
            <span className="text-[11px] text-ink-faint">{draft.body.length.toLocaleString()} chars</span>
          </div>
        </footer>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete entry?"
        message="This permanently deletes the entry. Autosaved drafts for it are removed too — this cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default EntryEditor;
