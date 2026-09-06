import React, { forwardRef, type ReactNode } from 'react';

interface TextProps {
  variant?:
    | 'display'
    | 'displaySm'
    | 'title'
    | 'body'
    | 'prose'
    | 'caption'
    | 'eyebrow'
    | 'monoLabel';
  /** Semantic element to render (defaults vary by variant). */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children: ReactNode;
}

const CLASSES: Record<NonNullable<TextProps['variant']>, string> = {
  display: 'text-display',
  displaySm: 'text-display-sm',
  title: 'text-title',
  body: 'text-body',
  prose: 'text-prose',
  caption: 'text-caption',
  eyebrow: 'text-eyebrow',
  monoLabel: 'text-mono-label',
};

const DEFAULT_TAG: Record<NonNullable<TextProps['variant']>, NonNullable<TextProps['as']>> = {
  display: 'h1',
  displaySm: 'h2',
  title: 'h3',
  body: 'p',
  prose: 'p',
  caption: 'p',
  eyebrow: 'p',
  monoLabel: 'code',
};

/** Typography primitive wrapping the JOURNAL∞ type scale. */
export const Text: React.FC<TextProps> = ({ variant = 'body', as, className, children }) => {
  const Tag = (as ?? DEFAULT_TAG[variant]) as keyof React.JSX.IntrinsicElements;
  return <Tag className={`${CLASSES[variant]} ${className ?? ''}`}>{children}</Tag>;
};

export default Text;