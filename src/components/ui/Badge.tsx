import React, { type ReactNode } from 'react';

interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'ink';
  size?: 'sm' | 'md';
  /** Adds a small status dot before the label. */
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const TONES = {
  neutral: 'border-line bg-surface-3 text-ink-low',
  accent: 'border-accent/40 bg-depth/60 text-accent',
  success: 'border-success/40 bg-emerald-950/50 text-success',
  warning: 'border-warning/40 bg-amber-950/50 text-warning',
  danger: 'border-danger/40 bg-red-950/50 text-danger',
  ink: 'border-line-strong bg-surface-4 text-ink-hi',
} as const;

const SIZES = {
  sm: 'h-5 gap-1 px-2 text-[10px] [&>svg]:h-3 [&>svg]:w-3',
  md: 'h-6 gap-1.5 px-2.5 text-[11px] [&>svg]:h-3.5 [&>svg]:w-3.5',
} as const;

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  icon,
  className,
  children,
}) => {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-medium uppercase tracking-wide',
        TONES[tone],
        SIZES[size],
        className ?? '',
      ].join(' ')}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {icon}
      <span className="truncate normal-case">{children}</span>
    </span>
  );
};

export default Badge;
