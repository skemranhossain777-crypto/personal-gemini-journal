import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Base shimmer placeholder. */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div aria-hidden="true" className={`animate-shimmer rounded-lg ${className ?? 'h-4 w-full'}`} />
);

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** A paragraph-shaped block of shimmer lines. */
export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3, className }) => (
  <div className={`space-y-2.5 ${className ?? ''}`} aria-hidden="true">
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);

export interface SkeletonCardProps {
  header?: boolean;
  lines?: number;
  className?: string;
}

/** A Card-shaped loading placeholder. */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({ header = true, lines = 3, className }) => (
  <div className={`rounded-2xl border border-line bg-surface-1 p-5 ${className ?? ''}`} aria-hidden="true">
    <div className="space-y-3">
      {header && <Skeleton className="h-4 w-1/3" />}
      <SkeletonText lines={lines} />
    </div>
  </div>
);

export default Skeleton;