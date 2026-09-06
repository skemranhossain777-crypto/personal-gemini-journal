import React, { type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface InlineErrorProps {
  message: ReactNode;
  onRetry?: () => void;
  className?: string;
}

/** Inline alert-card error with optional retry (friendly copy only, no traces). */
export const InlineError: React.FC<InlineErrorProps> = ({ message, onRetry, className }) => {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-danger/40 bg-red-950/30 p-4 text-sm text-danger ${className ?? ''}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <div className="leading-relaxed">{message}</div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw />}
            onClick={onRetry}
            className="mt-2 text-danger"
          >
            Try again
          </Button>
        )}
      </div>
    </div>
  );
};

interface FullPageErrorProps extends InlineErrorProps {
  title?: ReactNode;
}

/** Full-bleed error for screen-level failures. */
export const FullPageError: React.FC<FullPageErrorProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      role="alert"
      className={`flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-14 text-center ${className ?? ''}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/40 bg-red-950/40 text-danger">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-display-sm">{title}</h3>
      <p className="max-w-md text-prose">{message}</p>
      {onRetry && (
        <Button variant="secondary" icon={<RefreshCw />} onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
};

export default InlineError;