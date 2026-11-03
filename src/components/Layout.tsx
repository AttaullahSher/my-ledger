import { Outlet } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from './AppContext'
import { QuickAdd } from './QuickAdd'

export function Layout() {
  const { openAdd } = useApp()
  return (
    <div className="min-h-dvh">
      <main className="pb-[calc(env(safe-area-inset-bottom)+110px)]">
        <Outlet />
      </main>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}>
        <button
          type="button"
          aria-label="Add entry"
          onClick={() => openAdd()}
          className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-brand pl-5 pr-6 text-[16px] font-semibold text-white shadow-xl shadow-slate-900/30 active:scale-95"
        >
          <Plus size={24} strokeWidth={2.5} /> Add entry
        </button>
      </div>
      <QuickAdd />
    </div>
  )
}
