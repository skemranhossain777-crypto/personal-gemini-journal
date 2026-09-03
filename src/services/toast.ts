import { useEffect, useState } from 'react';

/**
 * Minimal toast notification helper (skill Phase 6.2). A tiny pub/sub store lets
 * any module fire a toast without prop drilling; the <Toaster/> component
 * subscribes and renders them.
 */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

function push(type: Toast['type'], message: string, duration = 4000): void {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts = [...toasts, { id, type, message }];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, duration);
}

export const toast = {
  success: (m: string) => push('success', m),
  error: (m: string) => push('error', m),
  info: (m: string) => push('info', m),
};

export function useToasts(): Toast[] {
  const [snapshot, setSnapshot] = useState<Toast[]>([]);
  useEffect(() => {
    const listener: Listener = (next) => setSnapshot(next);
    listeners.add(listener);
    listener(toasts);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}
