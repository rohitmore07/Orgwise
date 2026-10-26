'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Whether the toast helpers are available (true inside a provider). */
  isToastProvider: boolean;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const ICON_COLORS: Record<ToastVariant, string> = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  info: 'text-cyan-500',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);
  // The toasts mount into a portal on `document.body`, which does not exist during SSR. Rendering the portal on…
  // the client's *first* render while the server HTML has nothing there would fail hydration (React expects the…
  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, variant, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m) => toast(m, 'success'),
      error: (m) => toast(m, 'error'),
      info: (m) => toast(m, 'info'),
      isToastProvider: true,
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              aria-live="polite"
              className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm"
            >
              {toasts.map((item) => {
                const Icon = ICONS[item.variant];
                return (
                  <div
                    key={item.id}
                    role="status"
                    className={cn(
                      'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card/95 p-3.5 shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in',
                      item.variant === 'success' && 'border-emerald-500/30',
                      item.variant === 'error' && 'border-rose-500/30',
                      item.variant === 'info' && 'border-cyan-500/30',
                    )}
                  >
                    <Icon
                      className={cn('mt-0.5 size-4 shrink-0', ICON_COLORS[item.variant])}
                      aria-hidden
                    />
                    <p className="flex-1 text-sm leading-snug text-foreground">{item.message}</p>
                    <button
                      type="button"
                      onClick={() => dismiss(item.id)}
                      aria-label="Dismiss notification"
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Noop fallback so pages can call toast.success/error even outside a
    // provider (e.g. during static render) without crashing.
    return {
      toast: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
      isToastProvider: false,
    };
  }
  return context;
}
