import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { db } from '../lib/db'
import { DEFAULT_SETTINGS, type Settings, type Transaction } from '../lib/types'
import { Button, Sheet, cx } from './ui'

export type QuickAddKind = 'given' | 'received'

export interface QuickAddRequest {
  kind?: QuickAddKind
  personId?: string
  editTx?: Transaction
}

interface ConfirmOpts {
  title: string
  message: ReactNode
  confirmText?: string
  danger?: boolean
  /** User must type this word to confirm (for very destructive actions). */
  typeToConfirm?: string
}

interface Ctx {
  settings: Settings
  /** false until settings have loaded from the database */
  ready: boolean
  toast: (msg: string, kind?: 'ok' | 'error') => void
  confirm: (o: ConfirmOpts) => Promise<boolean>
  openAdd: (req?: QuickAddRequest) => void
  addRequest: QuickAddRequest | null
  closeAdd: () => void
}

const AppCtx = createContext<Ctx | null>(null)

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}

export function AppProvider({ children }: { children: ReactNode }) {
  const loaded = useLiveQuery(async () => ({ row: await db.settings.get('app') }), [])
  const row = loaded?.row
  const ready = loaded !== undefined
  const settings = useMemo<Settings>(() => ({ ...DEFAULT_SETTINGS, ...(row ?? {}) }), [row])

  // Theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      // Branding colour (the default near-black is lifted in dark mode so buttons stay visible)
      const accent = settings.accent || '#0f172a'
      document.documentElement.style.setProperty('--brand', dark && accent === '#0f172a' ? '#475569' : accent)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f8fafc')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme, settings.accent])

  useEffect(() => {
    document.title = settings.appTitle || 'MY LEDGER'
  }, [settings.appTitle])

  // Toasts
  const [toastState, setToast] = useState<{ msg: string; kind: 'ok' | 'error'; id: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    window.clearTimeout(timer.current)
    setToast({ msg, kind, id: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 4000 : 2200)
  }, [])

  // Confirm dialog
  const [confirmState, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const [typed, setTyped] = useState('')
  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setTyped('')
        setConfirm({ ...o, resolve })
      }),
    [],
  )
  const finish = (v: boolean) => {
    confirmState?.resolve(v)
    setConfirm(null)
  }

  // Quick add
  const [addRequest, setAddRequest] = useState<QuickAddRequest | null>(null)
  const openAdd = useCallback((req: QuickAddRequest = {}) => setAddRequest(req), [])
  const closeAdd = useCallback(() => setAddRequest(null), [])

  const value = useMemo(() => ({ settings, ready, toast, confirm, openAdd, addRequest, closeAdd }), [settings, ready, toast, confirm, openAdd, addRequest, closeAdd])
  const blocked = !!confirmState?.typeToConfirm && typed.trim().toUpperCase() !== confirmState.typeToConfirm.toUpperCase()

  return (
    <AppCtx.Provider value={value}>
      {children}

      <Sheet open={!!confirmState} onClose={() => finish(false)} title={confirmState?.title ?? ''}>
        <div className="space-y-4 pb-2">
          <div className="text-[15px] text-slate-600 dark:text-slate-300">{confirmState?.message}</div>
          {confirmState?.typeToConfirm && (
            <input
              autoFocus
              className="w-full rounded-xl bg-slate-100 px-3.5 py-3 dark:bg-slate-800"
              placeholder={`Type ${confirmState.typeToConfirm} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => finish(false)}>
              Cancel
            </Button>
            <Button variant={confirmState?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => finish(true)}>
              {confirmState?.confirmText ?? 'Confirm'}
            </Button>
          </div>
        </div>
      </Sheet>

      {toastState && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
          <div
            key={toastState.id}
            role="status"
            className={cx(
              'animate-fade flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg',
              toastState.kind === 'ok' ? 'bg-slate-900 dark:bg-slate-700' : 'bg-red-600',
            )}
          >
            {toastState.kind === 'ok' ? <CheckCircle2 size={18} className="text-green-400" /> : <AlertTriangle size={18} />}
            {toastState.msg}
          </div>
        </div>
      )}
    </AppCtx.Provider>
  )
}
