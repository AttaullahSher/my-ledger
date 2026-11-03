import type { ReactNode } from 'react'
import { BookLock } from 'lucide-react'
import { useApp } from './AppContext'
import { SyncCard } from './SyncCard'
import { useSync } from './useSync'

/** The ledger is only usable with an account: sign in (or create one) first. */
export function AuthGate({ children }: { children: ReactNode }) {
  const s = useSync()
  const { settings } = useApp()
  if (s.status === 'off' || s.email) return <>{children}</>
  if (s.status === 'starting')
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
      </div>
    )
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white shadow-lg">
          <BookLock size={30} />
        </div>
        <h1 className="text-[28px] font-bold tracking-tight">{settings.appTitle && settings.appTitle !== 'MY LEDGER' ? settings.appTitle : 'My Ledger'}</h1>
        <p className="mt-1 text-slate-500">Sign in to open your private ledger</p>
      </div>
      <SyncCard />
    </div>
  )
}
