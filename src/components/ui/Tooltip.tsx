import React, { cloneElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'bottom';
  /** A single focusable element receives the tooltip trigger handlers. */
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}

/**
 * Accessible tooltip: opens on hover and on keyboard focus, announces via
 * `role="tooltip"` + `aria-describedby`, dismissed by blur, Escape, or leaving.
 */
export const Tooltip: React.FC<TooltipProps> = ({ content, side = 'bottom', children, className }) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const ref = useRef<HTMLElement | null>(null);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const triggerProps = children.props as React.HTMLAttributes<HTMLElement>;

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      ref.current = node;
      if (typeof (children as ReactElement<{ ref?: unknown }>).props.ref === 'function') {
        (children.props.ref as (n: HTMLElement | null) => void)?.(node);
      }
    },
    'aria-describedby': open ? tooltipId : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      show();
      triggerProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      hide();
      triggerProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      show();
      triggerProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      hide();
      triggerProps.onBlur?.(e);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape') hide();
      triggerProps.onKeyDown?.(e);
    },
  });

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        className={[
          'pointer-events-none absolute left-1/2 z-[80] -translate-x-1/2',
          'whitespace-nowrap rounded-lg border border-line-strong bg-surface-4 px-2.5 py-1.5',
          'text-xs font-medium text-ink-hi shadow-pop transition-opacity duration-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          open ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {content}
      </span>
    </span>
  );
};

export default Tooltip;
