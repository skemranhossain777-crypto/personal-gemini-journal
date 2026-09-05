import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle className="h-5 w-5" />}
      iconClassName="bg-red-950/60 border border-red-800/40 text-red-400"
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-xl border border-[#31447F] bg-[#17254F] px-4 py-2 text-xs font-medium text-[#888] transition-colors hover:bg-[#26376B] hover:text-[#EEF4FF]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-red-500 active:scale-95"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="px-6 py-5 text-sm leading-relaxed text-[#9FB0D4]" id="confirm-message">
        {message}
      </p>
    </Modal>
  );
};

export default ConfirmDialog;