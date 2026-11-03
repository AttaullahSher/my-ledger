import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Search, Settings, UserPlus, Users } from 'lucide-react'
import { useApp } from '../components/AppContext'
import { PersonForm } from '../components/PersonForm'
import { SyncBadge } from '../components/SyncBadge'
import { Welcome } from '../components/Welcome'
import { Avatar, Empty, IconButton, cx, inputCls } from '../components/ui'
import { livePeople, liveTransactions } from '../lib/db'
import { formatDate } from '../lib/dates'
import { dashboardTotals, summariesByPerson, type PersonSummary } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import type { Person } from '../lib/types'

const PAGE = 15

export function HomePage() {
  const { settings } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [showSettled, setShowSettled] = useState(false)

  const data = useLiveQuery(async () => {
    const [people, txs] = await Promise.all([livePeople(), liveTransactions()])
    return { people, sums: summariesByPerson(txs), dash: dashboardTotals(txs) }
  }, [])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const digits = s.replace(/\D/g, '')
    const rows = (data?.people ?? [])
      .filter((p) => !s || p.name.toLowerCase().includes(s) || (digits.length > 2 && p.phone?.replace(/\D/g, '').includes(digits)))
      .map((p) => ({ p, s: data!.sums.get(p.id) }))
    const recent = (r: { p: Person; s?: PersonSummary }) => r.s?.lastDate ?? r.p.createdAt.slice(0, 10)
    const byRecent = (a: typeof rows[number], b: typeof rows[number]) => recent(b).localeCompare(recent(a))
    return {
      open: rows.filter((r) => r.s && !r.s.settled).sort(byRecent),
      settled: rows.filter((r) => !r.s || r.s.settled).sort(byRecent),
    }
  }, [data, q])

  const searching = !!q.trim()
  const hasData = !!data?.people.length
  const rows = data?.dash.rows.length ? data.dash.rows : [{ currency: settings.currency || 'AED', theyOweMe: 0, iOweThem: 0 }]

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
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-pos-line bg-pos-soft p-4 dark:border-green-900 dark:bg-green-950/40">
            <div className="text-[13px] font-medium text-pos">They owe me</div>
            {rows.map((r) => (
              <div key={r.currency} className="tabular mt-1 truncate text-[20px] font-bold leading-tight text-pos">
                {formatMoney(r.theyOweMe, r.currency)}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-neg-line bg-neg-soft p-4 dark:border-red-900 dark:bg-red-950/40">
            <div className="text-[13px] font-medium text-neg">I owe them</div>
            {rows.map((r) => (
              <div key={r.currency} className="tabular mt-1 truncate text-[20px] font-bold leading-tight text-neg">
                {formatMoney(r.iOweThem, r.currency)}
              </div>
            ))}
          </div>
        </div>

        {hasData && (
          <div className="relative mt-4">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'bg-white pl-10 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900')} placeholder="Search name or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}

        {data && !hasData && (
          <Empty
            icon={<Users size={26} />}
            title="No one here yet"
            text="Tap “Add entry” to record money you gave or received — add the person right there."
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
                <Paged rows={groups.open} render={(r) => <PersonRow key={r.p.id} p={r.p} s={r.s} />} />
              ) : (
                <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-slate-500 ring-1 ring-slate-900/5 dark:bg-slate-900">
                  {searching ? 'No open balances match.' : 'Everyone is settled 🎉'}
                </div>
              )}
            </Section>

            {groups.settled.length > 0 && (
              <Collapsible title={`Settled & closed (${groups.settled.length})`} open={showSettled || searching} onToggle={() => setShowSettled((v) => !v)}>
                <Paged rows={groups.settled} render={(r) => <PersonRow key={r.p.id} p={r.p} s={r.s} compact />} />
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

/** Shows rows in pages with a "Show more" button. */
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

function PersonRow({ p, s, compact }: { p: Person; s?: PersonSummary; compact?: boolean }) {
  const open = s?.open ?? []
  const pos = open.length > 0 && open.every((o) => o.balance > 0)
  const neg = open.length > 0 && open.every((o) => o.balance < 0)
  return (
    <Link
      to={`/people/${p.id}`}
      className={cx(
        'flex items-center gap-3 rounded-2xl border px-3.5 active:scale-[0.99]',
        compact ? 'py-2.5' : 'py-3',
        pos ? 'border-pos-line bg-pos-soft dark:border-green-900 dark:bg-green-950/40' : neg ? 'border-neg-line bg-neg-soft dark:border-red-900 dark:bg-red-950/40' : 'border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900',
      )}
    >
      <Avatar name={p.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{p.name}</div>
        <div className="truncate text-[13px] text-slate-500">{s?.lastDate ? `Last: ${formatDate(s.lastDate)}` : p.phone || 'No entries yet'}</div>
      </div>
      <div className="text-right">
        {open.length === 0 ? (
          <div className="text-sm font-medium text-slate-400">Settled</div>
        ) : (
          open.map(({ currency, balance }) => (
            <div key={currency} className={cx('tabular font-semibold leading-tight', balance > 0 ? 'text-pos' : 'text-neg')}>
              {formatMoney(Math.abs(balance), currency)}
              <span className="ml-1 text-[11px] font-medium opacity-80">{balance > 0 ? 'owes me' : 'I owe'}</span>
            </div>
          ))
        )}
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </Link>
  )
}
