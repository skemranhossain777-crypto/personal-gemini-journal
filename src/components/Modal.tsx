import React, { type ReactNode } from 'react';
import { Dialog } from './ui/Dialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  iconClassName?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  dismissOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Legacy alias kept for backward compatibility. New code should use the
 * <Dialog/> primitive directly (additive contract: existing consumers must
 * keep compiling and rendering identically).
 */
export const Modal: React.FC<ModalProps> = (props) => {
  return <Dialog maxWidthClass={props.maxWidthClass ?? 'max-w-lg'} {...props} />;
};

export default Modal;