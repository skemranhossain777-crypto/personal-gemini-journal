import React, { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Mic, Trash2, Upload } from 'lucide-react';
import type { Attachment } from '../../data';
import { LIMITS } from '../../data';

interface AttachmentListProps {
  attachments: Attachment[];
  uploading: boolean;
  disabled?: boolean;
  onAddFile: (file: File, kind: Attachment['kind']) => void;
  onRemove: (attachment: Attachment) => void;
}

/** Attachment manager: image/file uploads, previews, and removal. Calls the
 * parent (which drives the AttachmentStore + entry draft) — this component
 * stays presentation-only so it can be tested in isolation. */
export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  uploading,
  disabled = false,
  onAddFile,
  onRemove,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<Attachment['kind']>('image');
  const full = attachments.length >= LIMITS.attachmentsCount;

  const pick = (kind: Attachment['kind']) => {
    if (full || uploading) return;
    setPendingKind(kind);
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingKind) onAddFile(file, pendingKind);
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept={pendingKind === 'image' ? 'image/*' : pendingKind === 'voice' ? 'audio/*' : undefined}
        className="hidden"
        onChange={handleFile}
      />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-low">Attachments</span>
        {full && <span className="text-xs text-ink-faint">max {LIMITS.attachmentsCount}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <div key={att.id} className="relative group">
            {att.kind === 'image' ? (
              <img
                src={att.url}
                alt={att.caption ?? 'attached image'}
                loading="lazy"
                decoding="async"
                className="h-20 w-20 rounded-xl border border-line object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-3 text-ink-low">
                {att.kind === 'voice' ? (
                  <Mic className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <FileText className="h-5 w-5" aria-hidden="true" />
                )}
                <span className="max-w-[72px] truncate px-1 text-[10px]">{att.caption ?? 'file'}</span>
              </div>
            )}
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => onRemove(att)}
              disabled={disabled}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface-4 text-ink-faint opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}

        {!full && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => pick('image')}
                disabled={disabled || uploading}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-xs text-ink-mid hover:border-line-strong hover:text-ink-hi disabled:opacity-50"
              >
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {uploading ? 'Uploading…' : 'Photo'}
              </button>
              <button
                type="button"
                onClick={() => pick('file')}
                disabled={disabled || uploading}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-xs text-ink-mid hover:border-line-strong hover:text-ink-hi disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                File
              </button>
              <button
                type="button"
                onClick={() => pick('voice')}
                disabled={disabled || uploading}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-xs text-ink-mid hover:border-line-strong hover:text-ink-hi disabled:opacity-50"
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                Voice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttachmentList;