import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, CloudOff, CloudUpload, Search, Settings, UserPlus, Users } from 'lucide-react'
import { useApp } from '../components/AppContext'
import { PersonForm } from '../components/PersonForm'
import { SyncBadge } from '../components/SyncBadge'
import { Welcome } from '../components/Welcome'
import { Avatar, Empty, IconButton, cx, inputCls } from '../components/ui'
import { livePeople, liveTransactions } from '../lib/db'
import { daysSince, relativeDay } from '../lib/dates'
import { dashboardTotals, totalsByPerson, type PersonTotals } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import { useSync } from '../components/useSync'
import type { Person } from '../lib/types'

const PAGE = 15

export function HomePage() {
  const { settings } = useApp()
  const nav = useNavigate()
  const sync = useSync()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [showSettled, setShowSettled] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const data = useLiveQuery(async () => {
    const [people, txs] = await Promise.all([livePeople(), liveTransactions()])
    return { people, totals: totalsByPerson(txs), dash: dashboardTotals(txs) }
  }, [])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const rows = (data?.people ?? [])
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.phone?.replace(/\s/g, '').includes(s.replace(/\s/g, '')))
      .map((p) => ({ p, t: data!.totals.get(p.id) }))
    const recent = (r: { p: Person; t?: PersonTotals }) => r.t?.lastDate ?? r.p.createdAt.slice(0, 10)
    return {
      open: rows.filter((r) => !r.p.archivedAt && (r.t?.balance ?? 0) !== 0).sort((a, b) => Math.abs(b.t!.balance) - Math.abs(a.t!.balance)),
      settled: rows.filter((r) => !r.p.archivedAt && (r.t?.balance ?? 0) === 0).sort((a, b) => recent(b).localeCompare(recent(a))),
      archived: rows.filter((r) => !!r.p.archivedAt).sort((a, b) => a.p.name.localeCompare(b.p.name)),
    }
  }, [data, q])

  const c = settings.currency
  const searching = !!q.trim()
  const hasData = !!data?.people.length
  const days = daysSince(settings.lastBackupAt)
  // Only nag when the records are NOT protected by auto-sync.
  const unsafe = hasData && !sync.email && settings.backupReminder > 0 && days >= settings.backupReminder

  return (
    <>
      <header className="pt-safe sticky top-0 z-20 bg-slate-50/85 backdrop-blur-xl dark:bg-black/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold tracking-tight">{settings.appTitle || 'MY LEDGER'}</h1>
            {settings.ownerName && <div className="-mt-0.5 truncate text-sm text-slate-500">{settings.ownerName}</div>}
          </div>
          <div className="flex shrink-0 items-center">
            <SyncBadge />
            <IconButton label="Add person" onClick={() => setAdding(true)}>
              <UserPlus size={21} />
            </IconButton>
            <IconButton label="Settings" onClick={() => nav('/settings')}>
              <Settings size={21} />
            </IconButton>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {unsafe && (
          <Link to="/settings#backup" className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900">
            {sync.status === 'off' || sync.status === 'signed-out' ? <CloudUpload size={20} className="shrink-0" /> : <CloudOff size={20} className="shrink-0" />}
            <div>
              <b>Protect your records.</b> {sync.status === 'signed-out' ? 'Turn on auto-sync' : 'Save a backup'} so nothing is lost if you change or lose your phone.
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-pos-line bg-pos-soft p-4 dark:border-green-900 dark:bg-green-950/40">
            <div className="text-[13px] font-medium text-pos">They owe me</div>
            <div className="tabular mt-1 truncate text-[22px] font-bold text-pos">{formatMoney(data?.dash.theyOweMe ?? 0, c)}</div>
          </div>
          <div className="rounded-2xl border border-neg-line bg-neg-soft p-4 dark:border-red-900 dark:bg-red-950/40">
            <div className="text-[13px] font-medium text-neg">I owe them</div>
            <div className="tabular mt-1 truncate text-[22px] font-bold text-neg">{formatMoney(data?.dash.iOweThem ?? 0, c)}</div>
          </div>
        </div>
        {hasData && (
          <div className="mt-2 px-1 text-[13px] text-slate-500">
            Net{' '}
            <b className={cx('tabular', (data?.dash.net ?? 0) > 0 ? 'text-pos' : (data?.dash.net ?? 0) < 0 ? 'text-neg' : '')}>
              {formatMoney(Math.abs(data?.dash.net ?? 0), c)}
            </b>{' '}
            {(data?.dash.net ?? 0) >= 0 ? 'in my favour' : 'against me'} · {data?.dash.openCount ?? 0} open
          </div>
        )}

        {hasData && (
          <div className="relative mt-4">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'bg-white pl-10 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900')} placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}

        {data && !hasData && (
          <Empty
            icon={<Users size={26} />}
            title="No one here yet"
            text="Tap “Add entry” to record money you gave or received — add the person right there. Or add people first."
            action={
              <button className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white" onClick={() => setAdding(true)}>
                Add person
              </button>
            }
          />
        )}

        {hasData && (
          <>
            <Section title={`Open balances${groups.open.length ? ` (${groups.open.length})` : ''}`}>
              {groups.open.length ? (
                <Paged rows={groups.open} render={(r) => <PersonRow key={r.p.id} p={r.p} t={r.t} currency={c} />} />
              ) : (
                <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-slate-500 ring-1 ring-slate-900/5 dark:bg-slate-900">
                  {searching ? 'No open balances match.' : 'Everyone is settled 🎉'}
                </div>
              )}
            </Section>

            {groups.settled.length > 0 && (
              <Collapsible title={`Settled & closed (${groups.settled.length})`} open={showSettled || searching} onToggle={() => setShowSettled((v) => !v)}>
                <Paged rows={groups.settled} render={(r) => <PersonRow key={r.p.id} p={r.p} t={r.t} currency={c} compact />} />
              </Collapsible>
            )}

            {groups.archived.length > 0 && (
              <Collapsible title={`Archived (${groups.archived.length})`} open={showArchived || searching} onToggle={() => setShowArchived((v) => !v)}>
                <Paged rows={groups.archived} render={(r) => <PersonRow key={r.p.id} p={r.p} t={r.t} currency={c} compact />} />
              </Collapsible>
            )}
          </>
        )}
      </div>

      <PersonForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => nav(`/people/${id}`)} />
      <Welcome />
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  )
}

function Collapsible({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="mt-4">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
        <ChevronDown size={18} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </section>
  )
}

/** Shows rows in pages of 15 with a "Show more" button. */
export function Paged<T>({ rows, render, page = PAGE }: { rows: T[]; render: (r: T) => ReactNode; page?: number }) {
  const [count, setCount] = useState(page)
  return (
    <div className="space-y-2">
      {rows.slice(0, count).map(render)}
      {rows.length > count && (
        <button type="button" onClick={() => setCount((n) => n + page)} className="w-full rounded-xl py-3 text-sm font-semibold text-blue-600 active:bg-slate-100 dark:text-blue-400 dark:active:bg-slate-900">
          Show more ({rows.length - count} more)
        </button>
      )}
    </div>
  )
}

function PersonRow({ p, t, currency, compact }: { p: Person; t?: PersonTotals; currency: string; compact?: boolean }) {
  const { settings } = useApp()
  const bal = t?.balance ?? 0
  return (
    <Link
      to={`/people/${p.id}`}
      className={cx(
        'flex items-center gap-3 rounded-2xl border px-3.5 active:scale-[0.99]',
        compact ? 'py-2.5' : 'py-3',
        bal > 0
          ? 'border-pos-line bg-pos-soft dark:border-green-900 dark:bg-green-950/40'
          : bal < 0
            ? 'border-neg-line bg-neg-soft dark:border-red-900 dark:bg-red-950/40'
            : 'border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900',
      )}
    >
      <Avatar name={p.name} archived={!!p.archivedAt} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{p.name}</div>
        <div className="truncate text-[13px] text-slate-500">
          {t?.lastDate ? `Last: ${relativeDay(t.lastDate, settings.dateFormat)}` : 'No entries yet'}
          {t?.count ? ` · ${t.count} entr${t.count === 1 ? 'y' : 'ies'}` : ''}
        </div>
      </div>
      <div className="text-right">
        {bal === 0 ? (
          <div className="text-sm font-medium text-slate-400">Settled</div>
        ) : (
          <>
            <div className={cx('tabular font-semibold', bal > 0 ? 'text-pos' : 'text-neg')}>{formatMoney(Math.abs(bal), currency)}</div>
            <div className={cx('text-[11px]', bal > 0 ? 'text-pos/80' : 'text-neg/80')}>{bal > 0 ? 'Owes me' : 'I owe'}</div>
          </>
        )}
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </Link>
  )
}
