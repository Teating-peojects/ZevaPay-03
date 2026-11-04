"use client";

import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (options: {
    title: string;
    description?: string;
    tone?: ToastTone;
  }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "success" }) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { id, title, description, tone }]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 4200);
    },
    [],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const toneStyles: Record<ToastTone, { icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  success: { icon: CircleCheck, accent: "text-success-fg" },
  error: { icon: CircleAlert, accent: "text-danger-fg" },
  warning: { icon: TriangleAlert, accent: "text-warning-fg" },
  info: { icon: Info, accent: "text-info-fg" },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((item) => {
        const { icon: Icon, accent } = toneStyles[item.tone];
        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-overlay"
          >
            <Icon
              className={cn("mt-0.5 size-4 shrink-0", accent)}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="-mt-0.5 -mr-1 shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-elevated hover:text-ink"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
