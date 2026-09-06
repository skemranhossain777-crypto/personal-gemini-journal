import React, { type ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
  className?: string;
}

/** Key-cap hint (e.g. ⌘K). */
export const Kbd: React.FC<KbdProps> = ({ children, className }) => {
  return (
    <kbd
      className={[
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-3',
        'px-1.5 font-mono text-[10px] font-medium text-ink-faint',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </kbd>
  );
};

export default Kbd;