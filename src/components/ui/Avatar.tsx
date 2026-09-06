import React from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  /** Display name used to derive initials and the aria-label. */
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional colored ring for emphasis. */
  ring?: boolean;
  online?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
} as const;

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  ring = false,
  online = false,
  className,
}) => {
  return (
    <span
      className={[
        'relative inline-flex shrink-0',
        className ?? '',
      ].join(' ')}
    >
      <span
        className={[
          'flex items-center justify-center overflow-hidden rounded-full border',
          ring ? 'border-accent/50 shadow-glow' : 'border-line',
          'bg-surface-4 font-semibold text-ink-low',
          SIZES[size],
        ].join(' ')}
        title={name ?? undefined}
        role="img"
        aria-label={name ? `Avatar for ${name}` : 'Anonymous user'}
      >
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : name ? (
          <span>{initials(name)}</span>
        ) : (
          <User className="h-1/2 w-1/2" aria-hidden="true" />
        )}
      </span>
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-page bg-success"
          aria-hidden="true"
        />
      )}
    </span>
  );
};

export default Avatar;
