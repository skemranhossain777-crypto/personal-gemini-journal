import React, { useEffect, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Archive, ArrowLeft, CalendarDays, FolderOpen, Image as ImageIcon, Loader2, Trash2, Mic } from 'lucide-react';
import type { Collection, JournalEntry } from '../../data';
import { LIMITS } from '../../data';
import { toast } from '../../services/toast';
import { removeEmbedding } from '../../services/embeddingSync';
import {
  useDraftEntry,
  useMemoryExtraction,
  useEmbeddingSync,
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
import { MemoryExtractionBar } from '../../components/journal/MemoryExtractionBar';
import { ImageJournalView } from '../../components/journal/ImageJournalView';
import { VoiceJournalView } from '../../components/journal/VoiceJournalView';
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
  /** Optional authenticated uid used by the image journaling view. */
  currentUserId?: string;
  /** Optional jump to the Memory Engine's Candidates tab (after extraction). */
  onReviewCandidates?: () => void;
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
  currentUserId = '',
  onReviewCandidates,
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

  // AI Memory Engine: auto-extract candidates once after a new entry is saved
  // (never blocking the journal), with manual retry for existing entries.
  const memoryExtraction = useMemoryExtraction(entry, { autoExtract: entryId === null });
  const memoryExtractionHint =
    entryId === null
      ? 'New entries are reviewed for memory candidates automatically. Extraction never changes or blocks your writing.'
      : 'Memory extraction is optional and never changes your entry. Any candidates appear in the Memory Engine for your review.';

  // G3 semantic retrieval: best-effort embedding sync after every save
  // (create + in-place edits). Idempotent server-side via text hash.
  useEmbeddingSync(entry);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [imagePanelOpen, setImagePanelOpen] = useState(false);
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
        // G3 semantic retrieval: fire-and-forget vector cleanup.
        void removeEmbedding('entry', entry.id);
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

  // Adds an image attachment produced by ImageJournalView into the draft.
  const handleAddImageAttachment = (att: JournalEntry['attachments'][number]) => {
    if (draft.attachments.length >= LIMITS.attachmentsCount) {
      toast.error(`You can attach at most ${LIMITS.attachmentsCount} files.`);
      return;
    }
    patch({ attachments: [...draft.attachments, att] });
    toast.success('Image attached.');
  };

  // Adds a voice attachment produced by ImageJournalView/voice panel.
  const handleAddVoiceAttachment = (att: JournalEntry['attachments'][number]) => {
    if (draft.attachments.length >= LIMITS.attachmentsCount) {
      toast.error(`You can attach at most ${LIMITS.attachmentsCount} files.`);
      return;
    }
    patch({ attachments: [...draft.attachments, att] });
  };

  const handleRemoveImageAttachment = (attachmentId: string) => {
    patch({ attachments: draft.attachments.filter((a) => a.id !== attachmentId) });
    if (attachmentStore) {
      const att = draft.attachments.find((a) => a.id === attachmentId);
      if (att) void attachmentStore.remove(att);
    }
  };

  // Applies a transcribed voice draft into the canonical JournalDraft.
  const handleVoiceDraft = (v: {
    title: string;
    body: string;
    mode: JournalDraft['mode'];
    tags: string[];
    keepAudioAttachment: boolean;
    audioBlob?: Blob;
    aiMetadata?: {
      modality: 'voice';
      transcript: string;
      summary: string;
      emotion: string;
      suggestedTags: string[];
      modelUsed: string;
    };
  }) => {
    const next: Partial<JournalDraft> = {
      title: v.title,
      body: v.body,
      mode: v.mode,
      tags: v.tags,
    };
    if (v.aiMetadata) {
      next.aiMetadata = {
        modality: 'voice',
        transcript: v.aiMetadata.transcript,
        summary: v.aiMetadata.summary,
        emotion: v.aiMetadata.emotion,
        suggestedTags: v.aiMetadata.suggestedTags,
        generatedBy: 'gemini',
        modelUsed: v.aiMetadata.modelUsed,
      };
    }
    if (v.keepAudioAttachment && v.audioBlob) {
      const id = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const audioAttachment: JournalEntry['attachments'][number] = {
        id,
        kind: 'voice',
        url: URL.createObjectURL(v.audioBlob),
        caption: `Voice note — ${new Date().toLocaleDateString()}`,
        createdAt: Timestamp.fromDate(new Date()),
      };
      next.attachments = [...draft.attachments, audioAttachment];
    }
    patch(next);
    setVoicePanelOpen(false);
    toast.success('Voice draft applied to your entry.');
  };

  // Applies a structured image analysis into the canonical JournalDraft.
  const handleImageDraft = (img: {
    body: string;
    caption?: string;
    summary?: string;
    emotion?: string;
    tags?: string[];
    suggestedTags?: string[];
    modelUsed?: string;
  }) => {
    const title = img.caption?.trim() ? `Image Reflection — ${img.caption.trim()}` : `Image Reflection — ${new Date().toLocaleDateString()}`;
    const next: Partial<JournalDraft> = {
      title,
      body: img.body.trim() || draft.body,
      tags: Array.from(new Set(['image-journal', ...(img.tags ?? []), ...(img.suggestedTags ?? [])])),
      aiMetadata: {
        summary: img.summary ?? '',
        suggestedTags: Array.from(new Set(img.tags ?? [])),
        emotion: img.emotion ?? 'Reflective',
        generatedBy: 'gemini',
        modality: 'image',
        modelUsed: img.modelUsed,
      },
    };
    patch(next);
    setImagePanelOpen(false);
    toast.success('Image reflection applied to your entry.');
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

            {/* AI Memory Engine extraction status */}
            <MemoryExtractionBar
              {...memoryExtraction}
              hint={memoryExtractionHint}
              onReviewCandidates={onReviewCandidates}
            />

            {/* Voice & Image journaling entry points */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                variant={voicePanelOpen ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setVoicePanelOpen((o) => !o)}
                icon={<Mic className="h-4 w-4" aria-hidden="true" />}
              >
                {voicePanelOpen ? 'Close Voice Journal' : 'Voice Journal'}
              </Button>
              <Button
                variant={imagePanelOpen ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setImagePanelOpen((o) => !o)}
                icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
              >
                {imagePanelOpen ? 'Close Image Journal' : 'Image Journal'}
              </Button>
            </div>

            {voicePanelOpen && (
              <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-4">
                <VoiceJournalView onSaveDraft={handleVoiceDraft} />
              </div>
            )}

            {imagePanelOpen && (
              <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-4">
                <ImageJournalView
                  attachments={draft.attachments}
                  currentUserId={currentUserId}
                  onAddAttachment={handleAddImageAttachment}
                  onRemoveAttachment={handleRemoveImageAttachment}
                  onUseDraft={handleImageDraft}
                />
              </div>
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
