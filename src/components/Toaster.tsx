import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToasts, toast } from '../services/toast';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const STYLES = {
  success: 'border-emerald-500/40 bg-emerald-950/80 text-emerald-100',
  error: 'border-red-500/40 bg-red-950/80 text-red-100',
  info: 'border-sky-500/40 bg-sky-950/80 text-sky-100',
} as const;

export const Toaster: React.FC = () => {
  const toasts = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${STYLES[t.type]}`}
            role="status"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-snug flex-1">{t.message}</p>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
