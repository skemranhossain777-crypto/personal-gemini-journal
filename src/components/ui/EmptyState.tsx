import React, { type ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** Calm, warm invitation placeholder (spec §44: never ship an empty-feeling page). */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actions,
  compact = false,
  className,
}) => {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-10' : 'gap-4 px-6 py-16 md:py-20',
        className ?? '',
      ].join(' ')}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-3 text-ink-low">
        {icon}
      </div>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-display-sm">{title}</h3>
        {description && <p className="text-prose">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{actions}</div>}
    </div>
  );
};

export default EmptyState;
