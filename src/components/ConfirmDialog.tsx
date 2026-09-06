import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive-action confirmation built on the Dialog primitive. */
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
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle className="h-5 w-5" />}
      iconClassName="bg-red-950/60 border border-danger/40 text-danger"
      footer={
        <>
          <Button variant="subtle" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="px-6 py-5 text-sm leading-relaxed text-ink-low">{message}</p>
    </Dialog>
  );
};

export default ConfirmDialog;
