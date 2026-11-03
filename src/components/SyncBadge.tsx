import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useSync } from './useSync'
import { cx } from './ui'

/** Settings button with a small dot showing sync status: green synced, amber waiting, red problem. */
export function SettingsButton() {
  const s = useSync()
  const nav = useNavigate()
  const dot =
    s.status === 'synced' ? 'bg-pos' : s.status === 'error' ? 'bg-neg' : s.status === 'offline' || s.status === 'syncing' ? 'bg-amber-500' : null
  const label =
    s.status === 'synced' ? 'Settings — all changes synced' : s.status === 'offline' ? `Settings — offline, ${s.pending} change(s) waiting` : s.status === 'error' ? 'Settings — sync problem' : 'Settings'
  return (
    <button type="button" aria-label={label} title={label} onClick={() => nav('/settings')} className="relative grid h-11 w-11 place-items-center rounded-full text-slate-700 active:bg-slate-200 dark:text-slate-200 dark:active:bg-slate-800">
      <Settings size={21} />
      {dot && <span className={cx('absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-slate-50 dark:ring-black', dot)} />}
    </button>
  )
}
