import React, { useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { backdropVariants, panelVariants } from '../lib/animations';

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
 * Accessible animated dialog: traps focus, closes on Escape / backdrop click,
 * locks scroll, announces itself with role="dialog" + aria-modal.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  iconClassName = 'bg-amber-950/60 border border-amber-800/40 text-amber-400',
  headerExtra,
  footer,
  maxWidthClass = 'max-w-lg',
  dismissOnBackdrop = true,
  children,
}) => {
  const labelledById = useId();
  const describedById = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledById}
          aria-describedby={description ? describedById : undefined}
        >
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={dismissOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            tabIndex={-1}
            className={`relative flex max-h-[90vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-[#262629] bg-[#0E0E10] text-[#E0E0E0] shadow-2xl`}
          >
            <div className="flex items-center justify-between border-b border-[#262629] bg-[#121214] px-6 py-4">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClassName}`}>
                    {icon}
                  </div>
                )}
                <div>
                  <h2 id={labelledById} className="text-lg font-semibold text-[#F1F1F1]">
                    {title}
                  </h2>
                  {description && (
                    <p id={describedById} className="text-xs text-[#888]">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {headerExtra}
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="rounded-lg p-1.5 text-[#888] transition-colors hover:bg-[#1A1A1C] hover:text-[#F1F1F1]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-[#262629] bg-[#121214] px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;