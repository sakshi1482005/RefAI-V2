import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastTone = 'success' | 'error' | 'info'
type ToastInput = { title: string; description?: string; tone?: ToastTone }
type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current.slice(-2), { ...input, id }])
    window.setTimeout(() => dismiss(id), 4200)
  }, [dismiss])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-atomic="true">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info
          return (
            <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} className={cn('toast-enter pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg', item.tone === 'success' ? 'border-emerald-200' : item.tone === 'error' ? 'border-rose-200' : 'border-slate-200')}>
              <Icon className={cn('mt-0.5 size-5 shrink-0', item.tone === 'success' ? 'text-emerald-600' : item.tone === 'error' ? 'text-rose-600' : 'text-slate-600')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                {item.description ? <p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p> : null}
              </div>
              <button type="button" onClick={() => dismiss(item.id)} className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black" aria-label={`Dismiss ${item.title} notification`}>
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
