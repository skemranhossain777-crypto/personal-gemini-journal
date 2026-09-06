import React, {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

interface BaseField {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Sub-label shown on the right of the label row. */
  labelRight?: ReactNode;
  className?: string;
}

const CONTROL_STYLES = (hasError: boolean) =>
  [
    'w-full rounded-xl border bg-surface-3 px-3 text-sm text-ink-hi',
    'placeholder:text-ink-faint',
    hasError ? 'border-danger/70' : 'border-line',
    'transition-colors duration-150',
  ].join(' ');

const ERROR_STYLES = 'mt-1.5 flex items-start gap-1.5 text-xs text-danger';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseField {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, labelRight, className, ...rest },
  ref,
) {
  const id = useId();
  const controlId = `input-${id}`;
  const errorId = `input-error-${id}`;
  const hintId = `input-hint-${id}`;

  return (
    <div className={`${className ?? ''}`}>
      {(label || labelRight) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={controlId} className="text-xs font-medium text-ink-low">
              {label}
            </label>
          )}
          {labelRight}
        </div>
      )}
      <input
        ref={ref}
        id={controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
        }
        className={`h-9 ${CONTROL_STYLES(Boolean(error))}`}
        {...rest}
      />
      {error && (
        <p id={errorId} className={ERROR_STYLES} role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseField {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, labelRight, className, ...rest },
  ref,
) {
  const id = useId();
  const controlId = `textarea-${id}`;
  const errorId = `textarea-error-${id}`;
  const hintId = `textarea-hint-${id}`;

  return (
    <div className={`${className ?? ''}`}>
      {(label || labelRight) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={controlId} className="text-xs font-medium text-ink-low">
              {label}
            </label>
          )}
          {labelRight}
        </div>
      )}
      <textarea
        ref={ref}
        id={controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
        }
        className={`min-h-24 py-2.5 leading-relaxed ${CONTROL_STYLES(Boolean(error))}`}
        {...rest}
      />
      {error && (
        <p id={errorId} className={ERROR_STYLES} role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, BaseField {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, labelRight, className, children, ...rest },
  ref,
) {
  const id = useId();
  const controlId = `select-${id}`;
  const errorId = `select-error-${id}`;
  const hintId = `select-hint-${id}`;

  return (
    <div className={`${className ?? ''}`}>
      {(label || labelRight) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={controlId} className="text-xs font-medium text-ink-low">
              {label}
            </label>
          )}
          {labelRight}
        </div>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
          }
          className={`h-9 appearance-none pr-8 ${CONTROL_STYLES(Boolean(error))}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      </div>
      {error && (
        <p id={errorId} className={ERROR_STYLES} role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
