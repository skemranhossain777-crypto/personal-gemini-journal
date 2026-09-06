import React, { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export type SheetSize = 'sm' | 'md' | 'lg' | 'full';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: SheetSize;
  /** Force a side instead of auto (auto: bottom on <md, right on ≥md). */
  side?: 'auto' | 'bottom' | 'right';
  dismissOnBackdrop?: boolean;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}

const WIDTH_MAP: Record<SheetSize, string> = {
  sm: 'md:w-80',
  md: 'md:w-96',
  lg: 'md:w-[28rem]',
  full: 'md:w-full',
};

const bottomVariants: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { type: 'spring', stiffness: 360, damping: 34 } },
  exit: { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
};

const rightVariants: Variants = {
  hidden: { x: '100%' },
  show: { x: 0, transition: { type: 'spring', stiffness: 360, damping: 34 } },
  exit: { x: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
};

/**
 * Responsive panel: bottom sheet on mobile, right-side drawer on ≥md.
 * Shares the focus-trap / Escape / scroll-lock behavior of Dialog.
 */
export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  side = 'auto',
  dismissOnBackdrop = true,
  closeLabel = 'Close panel',
  className,
  children,
}) => {
  const labelledById = useId();
  const describedById = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const resolvedSide: 'bottom' | 'right' =
    side === 'auto' ? (isDesktop ? 'right' : 'bottom') : side;
  const variants = resolvedSide === 'bottom' ? bottomVariants : rightVariants;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70]"
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
            variants={variants}
            initial="hidden"
            animate="show"
            exit="exit"
            tabIndex={-1}
            className={[
              resolvedSide === 'bottom'
                ? 'absolute inset-x-0 bottom-0 max-h-[88vh] w-full rounded-t-2xl border-x-0 border-t'
                : 'absolute inset-y-0 right-0 h-full',
              WIDTH_MAP[size],
              'flex flex-col overflow-hidden border border-line bg-surface-1 text-ink-mid shadow-pop',
              resolvedSide === 'right' ? 'rounded-l-2xl' : 'rounded-b-none',
              className ?? '',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
              <div className="min-w-0">
                {title && (
                  <h2 id={labelledById} className="truncate text-base font-semibold text-ink-hi">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={describedById} className="truncate text-xs text-ink-faint">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label={closeLabel}
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-4 hover:text-ink-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
};

export default Sheet;
