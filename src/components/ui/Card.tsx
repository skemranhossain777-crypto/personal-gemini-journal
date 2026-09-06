import React, { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: 'flat' | 'elevated' | 'inset';
  /** Renders the card as a button (for selectable/clickable cards). */
  interactive?: boolean;
  selected?: boolean;
  children: ReactNode;
}

const VARIANTS = {
  flat: 'border-line bg-surface-1',
  elevated: 'border-line bg-surface-2 shadow-card',
  inset: 'border-line bg-surface-3',
} as const;

/** Surface container. Compound with CardHeader / CardBody / CardFooter. */
export const Card: React.FC<CardProps> = ({
  variant = 'flat',
  interactive = false,
  selected = false,
  className,
  children,
  ...rest
}) => {
  const classes = [
    'rounded-2xl border overflow-hidden text-ink-mid',
    VARIANTS[variant],
    interactive
      ? 'cursor-pointer transition-colors duration-150 hover:border-line-accent hover:bg-surface-2'
      : '',
    selected ? 'border-accent/60 bg-surface-4' : '',
    className ?? '',
  ].join(' ');

  if (interactive) {
    return (
      <button type="button" className={`${classes} w-full text-left`} {...rest}>
        {children}
      </button>
    );
  }

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <div className={`border-b border-line/70 px-5 py-4 ${className ?? ''}`}>{children}</div>
);

export const CardBody: React.FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => <div className={`p-5 ${className ?? ''}`}>{children}</div>;

export const CardFooter: React.FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <div className={`border-t border-line/70 bg-surface-2/60 px-5 py-3.5 ${className ?? ''}`}>
    {children}
  </div>
);

export default Card;