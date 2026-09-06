import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  /** Visual diameter. */
  size?: 'sm' | 'md' | 'lg';
  /** Accent color for the spinning arc. */
  accent?: 'accent' | 'current' | 'muted';
  className?: string;
  'aria-label'?: string;
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-8 w-8' } as const;
const ACCENTS = {
  accent: 'text-accent',
  current: 'text-current',
  muted: 'text-ink-faint',
} as const;

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  accent = 'accent',
  className,
  'aria-label': ariaLabel,
}) => {
  return (
    <Loader2
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      className={`animate-spin ${SIZES[size]} ${ACCENTS[accent]} ${className ?? ''}`}
    />
  );
};

export default Spinner;
