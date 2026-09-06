import React, { type ReactNode } from 'react';
import { Spinner } from './Spinner';

interface LoadingStateProps {
  label?: ReactNode;
  inline?: boolean;
  className?: string;
}

/** Full-block loading harness. Combine with Skeleton for list loading. */
export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading…', inline = false, className }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        inline
          ? 'inline-flex items-center gap-2'
          : ['flex flex-col items-center justify-center gap-3', `py-${inline ? 6 : 16}`].join(' '),
        className ?? '',
      ].join(' ')}
    >
      <Spinner size={inline ? 'sm' : 'md'} />
      {label && <span className="text-xs text-ink-faint">{label}</span>}
    </div>
  );
};

export default LoadingState;