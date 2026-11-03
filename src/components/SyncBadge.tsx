import { useNavigate } from 'react-router-dom'
import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { useSync } from './useSync'
import { IconButton, cx } from './ui'

/** Small cloud icon in the header showing auto-sync status. */
export function SyncBadge() {
  const s = useSync()
  const nav = useNavigate()
  if (s.status === 'off') return null
  const map = {
    starting: { icon: Cloud, cls: 'text-slate-400', label: 'Starting sync' },
    'signed-out': { icon: Cloud, cls: 'text-slate-400', label: 'Auto-sync is off' },
    syncing: { icon: RefreshCw, cls: 'text-blue-500 animate-spin [animation-duration:1.5s]', label: 'Syncing' },
    synced: { icon: CloudCheck, cls: 'text-pos', label: 'All changes synced' },
    offline: { icon: CloudOff, cls: 'text-amber-500', label: `Offline — ${s.pending} change(s) will sync later` },
    error: { icon: CloudAlert, cls: 'text-neg', label: 'Sync problem' },
  } as const
  const m = map[s.status]
  const Icon = m.icon
  return (
    <IconButton label={m.label} onClick={() => nav('/settings#sync')}>
      <Icon size={21} className={cx(m.cls)} />
    </IconButton>
  )
}
