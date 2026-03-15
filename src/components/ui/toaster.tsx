"use client"

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/* ── icon + accent colour per variant ──────────────────────────────────── */
function ToastIcon({ variant }: { variant?: string | null }) {
  if (variant === 'destructive') {
    return (
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#fef2f2' }}>
        <XCircle className="h-4 w-4" style={{ color: '#ef4444' }} />
      </div>
    );
  }
  if (variant === 'warning') {
    return (
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#fffbeb' }}>
        <AlertCircle className="h-4 w-4" style={{ color: '#f59e0b' }} />
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#f0fdf4' }}>
      <CheckCircle2 className="h-4 w-4" style={{ color: '#22c55e' }} />
    </div>
  );
}

function accentColor(variant?: string | null) {
  if (variant === 'destructive') return '#ef4444';
  if (variant === 'warning')     return '#f59e0b';
  return '#22c55e';
}

/* ── Toaster ────────────────────────────────────────────────────────────── */
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          {/* Coloured left accent strip */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: accentColor(variant) }}
          />

          {/* Icon */}
          <ToastIcon variant={variant} />

          {/* Text */}
          <div className="flex-1 min-w-0 pr-5">
            {title       && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>

          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
