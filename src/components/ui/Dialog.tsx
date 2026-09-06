import React, { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required by default for accessibility; pass a node to customize. */
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  /** Overrides `size` with an arbitrary Tailwind max-width class. */
  maxWidthClass?: string;
  dismissOnBackdrop?: boolean;
  hideClose?: boolean;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}

const SIZE_MAP: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 14 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 32 },
  },
  exit: { opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.16, ease: 'easeIn' } },
};

/**
 * Accessible centered dialog: traps focus, closes on Escape / backdrop click,
 * locks scroll, announces with role="dialog" + aria-modal.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  iconClassName = 'border-blue-800/40 bg-depth/60 text-accent',
  headerExtra,
  footer,
  size = 'md',
  maxWidthClass,
  dismissOnBackdrop = true,
  hideClose = false,
  closeLabel = 'Close dialog',
  className,
  children,
}) => {
  const labelledById = useId();
  const describedById = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? labelledById : undefined}
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
            className={`relative flex max-h-[90vh] w-full ${maxWidthClass ?? SIZE_MAP[size]} flex-col overflow-hidden rounded-2xl border border-line bg-surface-1 text-ink-mid shadow-pop ${className ?? ''}`}
          >
            {(title || icon || headerExtra || !hideClose) && (
              <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {icon && (
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconClassName}`}
                    >
                      {icon}
                    </div>
                  )}
                  {(title || description) && (
                    <div className="min-w-0">
                      {title && (
                        <h2 id={labelledById} className="truncate text-lg font-semibold text-ink-hi">
                          {title}
                        </h2>
                      )}
                      {description && (
                        <p id={describedById} className="truncate text-xs text-ink-faint">
                          {description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {headerExtra}
                  {!hideClose && (
                    <button
                      onClick={onClose}
                      aria-label={closeLabel}
                      className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-4 hover:text-ink-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Dialog;