import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Leading icon hint; nested inside the label. */
  icon?: ReactNode;
  /** The icon replaces the label entirely (icon-only button). */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-deep text-white border border-accent-deep hover:bg-accent-strong hover:border-accent-strong active:bg-accent',
  secondary:
    'bg-surface-4 text-ink-hi border border-line-strong hover:bg-surface-5 hover:border-line-accent',
  subtle: 'bg-surface-3 text-ink-mid border border-line hover:bg-surface-4 hover:text-ink-hi',
  ghost: 'bg-transparent text-ink-low border border-transparent hover:bg-surface-3 hover:text-ink-hi',
  outline:
    'bg-transparent text-ink-mid border border-line hover:border-line-strong hover:text-ink-hi',
  danger:
    'bg-danger-deep text-white border border-danger-deep hover:bg-danger hover:border-danger',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5',
  md: 'h-9 px-4 text-sm gap-2 [&>svg]:h-4 [&>svg]:w-4',
  lg: 'h-11 px-5 text-sm gap-2 [&>svg]:h-4 [&>svg]:w-4',
};

const ICON_ONLY: Record<ButtonSize, string> = {
  sm: 'px-2',
  md: 'px-2.5',
  lg: 'px-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconOnly = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex select-none items-center justify-center rounded-xl font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        iconOnly ? ICON_ONLY[size] : '',
        fullWidth ? 'w-full' : '',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} accent="current" /> : icon}
      {!iconOnly && <span className="truncate">{children}</span>}
    </button>
  );
});

export default Button;
