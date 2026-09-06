import React, { type ReactNode } from 'react';

type GapToken = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

interface StackProps {
  direction?: 'row' | 'column';
  gap?: GapToken;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  className?: string;
  children: ReactNode;
}

/** 4px-grid spacing primitive ("gap" values are multiplied by 4). */
export const Stack: React.FC<StackProps> = ({
  direction = 'column',
  gap = 4,
  align = 'stretch',
  justify = 'start',
  className,
  children,
}) => {
  const gapPx = `${gap * 4}px`;
  const style: React.CSSProperties = { gap: gapPx };

  const alignClass =
    align === 'start' ? 'items-start'
    : align === 'center' ? 'items-center'
    : align === 'end' ? 'items-end'
    : align === 'baseline' ? 'items-baseline'
    : 'items-stretch';

  const justifyClass =
    justify === 'center' ? 'justify-center'
    : justify === 'end' ? 'justify-end'
    : justify === 'between' ? 'justify-between'
    : justify === 'around' ? 'justify-around'
    : 'justify-start';

  return (
    <div
      style={style}
      className={`flex ${direction === 'row' ? 'flex-row' : 'flex-col'} ${alignClass} ${justifyClass} ${className ?? ''}`}
    >
      {children}
    </div>
  );
};

export default Stack;