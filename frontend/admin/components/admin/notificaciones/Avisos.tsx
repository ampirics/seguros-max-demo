'use client'

import { Toaster } from 'react-hot-toast'
import { Toaster as ToasterSonner } from '@/components/ui/sonner'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'

// El panel usa tres librerías de avisos: react-hot-toast (casi todo), sonner y el toast de components/ui.
function ToasterUI() {
  const { toasts } = useToast()
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose aria-label="Cerrar aviso" />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export function Avisos() {
  return (
    <>
      <Toaster
        position="top-center"
        containerStyle={{ top: 72 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            maxWidth: 'min(28rem, calc(100vw - 2rem))',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--card)' } },
          error: { duration: 6000, iconTheme: { primary: 'var(--destructive)', secondary: 'var(--card)' } },
        }}
      />
      <ToasterSonner position="bottom-right" />
      <ToasterUI />
    </>
  )
}
