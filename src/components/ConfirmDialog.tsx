import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#0E0E10] border border-[#262629] text-[#E0E0E0] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#262629] px-6 py-4 bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-[#F1F1F1]">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[#888] hover:bg-[#1A1A1C] hover:text-[#F1F1F1] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-[#A0A0A5] leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#262629] bg-[#121214] px-6 py-3">
          <button
            onClick={onCancel}
            className="rounded-xl bg-[#1A1A1C] border border-[#333338] px-4 py-2 text-xs font-medium text-[#888] hover:text-[#F1F1F1] hover:bg-[#242428] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors active:scale-95"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};