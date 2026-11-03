import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  FileText,
  MessageCircle,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react'
import { useApp } from '../components/AppContext'
import { PersonForm } from '../components/PersonForm'
import { DatePickerRow } from '../components/QuickAdd'
import { TxRow } from '../components/Rows'
import { useFileShare } from '../components/useFileShare'
import { Avatar, Button, Chip, Empty, Field, IconButton, Sheet, cx, inputCls } from '../components/ui'
import { db, liveTxsOf } from '../lib/db'
import { formatDate, todayISO } from '../lib/dates'
import { personStatementPDF, statementText, type DateRange } from '../lib/exporters'
import { balanceLabel, personTotals, splitSettled, typeLabel } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import * as repo from '../lib/repo'
import { whatsappLink } from '../lib/share'
import type { Transaction } from '../lib/types'
import { Paged } from './Home'

type Filter = 'all' | 'given' | 'received'

export function PersonDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { settings, openAdd, confirm, toast } = useApp()
  const c = settings.currency

  const data = useLiveQuery(async () => {
    const [person, txs] = await Promise.all([db.people.get(id), liveTxsOf(id)])
    return { person: person && !person.deletedAt ? person : undefined, txs }
  }, [id])

  const [filter, setFilter] = useState<Filter>('all')
  const [range, setRange] = useState<DateRange>({})
  const [showRange, setShowRange] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [clearing, setClearing] = useState(false)
  const [sharing, setSharing] = useState(false)

  const totals = useMemo(() => personTotals(data?.txs ?? []), [data])
  const split = useMemo(() => splitSettled(data?.txs ?? []), [data])
  const filtering = filter !== 'all' || !!range.from || !!range.to
  const keep = (t: Transaction) => (filter === 'all' || t.direction === filter) && (!range.from || t.date >= range.from) && (!range.to || t.date <= range.to)
  const openRows = split.open.filter((r) => keep(r.tx))
  const closedRows = split.closed.filter((r) => keep(r.tx))
  const back = () => (history.length > 1 ? nav(-1) : nav('/'))

  if (data && !data.person)
    return (
      <>
        <TopBar onBack={() => nav('/')} />
        <Empty icon={<ArchiveRestore />} title="This person was not found" />
      </>
    )
  if (!data?.person) return null
  const person = data.person
  const bal = totals.balance

  async function toggleArchive() {
    if (person.archivedAt) {
      await repo.restorePerson(person.id)
      toast(`${person.name} restored`)
    } else if (
      await confirm({
        title: `Archive ${person.name}?`,
        message: 'They will move to “Archived” at the bottom of your list. All entries are kept and you can restore them any time.',
        confirmText: 'Archive',
      })
    ) {
      await repo.archivePerson(person.id)
      toast(`${person.name} archived`)
    }
  }

  async function del(tx: Transaction) {
    setSelected(null)
    const ok = await confirm({
      title: 'Delete this entry?',
      message: `${typeLabel(tx)} of ${formatMoney(tx.amountInFils, c)} on ${formatDate(tx.date, settings.dateFormat)} will be deleted and the balance recalculated.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (ok) {
      await repo.deleteTransaction(tx.id)
      toast('Entry deleted')
    }
  }

  const row = (r: { tx: Transaction; balance: number }, muted = false) => (
    <TxRow key={r.tx.id} tx={r.tx} currency={c} dateFormat={settings.dateFormat} runningBalance={r.balance} onClick={() => setSelected(r.tx)} muted={muted} />
  )

  return (
    <>
      <TopBar
        onBack={back}
        right={
          <>
            <IconButton label="Edit profile" onClick={() => setEditing(true)}>
              <Pencil size={19} />
            </IconButton>
            <IconButton label={person.archivedAt ? 'Restore person' : 'Archive person'} onClick={toggleArchive}>
              {person.archivedAt ? <ArchiveRestore size={19} /> : <Archive size={19} />}
            </IconButton>
          </>
        }
      />
      <div className="mx-auto max-w-2xl px-4">
        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="scale-125 origin-left">
            <Avatar name={person.name} archived={!!person.archivedAt} />
          </div>
          <div className="ml-2 min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">{person.name}</h1>
            <div className="truncate text-sm text-slate-500">{person.archivedAt ? 'Archived' : `${totals.count} entr${totals.count === 1 ? 'y' : 'ies'}`}</div>
          </div>
        </div>

        {/* Balance */}
        <div
          className={cx(
            'mt-4 rounded-2xl border p-5',
            bal > 0 ? 'border-pos-line bg-pos-soft dark:border-green-900 dark:bg-green-950/40' : bal < 0 ? 'border-neg-line bg-neg-soft dark:border-red-900 dark:bg-red-950/40' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
          )}
        >
          <div className={cx('text-sm font-medium', bal > 0 ? 'text-pos' : bal < 0 ? 'text-neg' : 'text-slate-500')}>
            {bal > 0 ? `${person.name.split(' ')[0]} has to pay me` : bal < 0 ? `I have to pay ${person.name.split(' ')[0]}` : balanceLabel(0)}
          </div>
          <div className={cx('tabular mt-1 text-4xl font-bold tracking-tight', bal > 0 ? 'text-pos' : bal < 0 ? 'text-neg' : 'text-slate-400')}>{formatMoney(Math.abs(bal), c)}</div>
          <div className="mt-3 flex gap-6 text-sm">
            <div>
              <span className="text-slate-500">Given </span>
              <b className="tabular text-pos">{formatMoney(totals.given, c)}</b>
            </div>
            <div>
              <span className="text-slate-500">Received </span>
              <b className="tabular text-neg">{formatMoney(totals.received, c)}</b>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="pos" onClick={() => openAdd({ kind: 'given', personId: person.id })}>
            <ArrowUpRight size={18} /> I gave
          </Button>
          <Button variant="neg" onClick={() => openAdd({ kind: 'received', personId: person.id })}>
            <ArrowDownLeft size={18} /> I received
          </Button>
          <Button variant="secondary" disabled={bal === 0} onClick={() => setClearing(true)}>
            <CheckCheck size={18} /> Clear balance
          </Button>
          <Button variant="secondary" disabled={!data.txs.length} onClick={() => setSharing(true)}>
            <Share2 size={18} /> Statement
          </Button>
        </div>

        {/* History */}
        <div className="mb-2 mt-6 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">History</h2>
          <button className="text-sm font-semibold text-blue-600 dark:text-blue-400" onClick={() => setShowRange((s) => !s)}>
            {range.from || range.to ? 'Dates ✓' : 'Dates'}
          </button>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
          <Chip active={filter === 'given'} onClick={() => setFilter('given')}>Given</Chip>
          <Chip active={filter === 'received'} onClick={() => setFilter('received')}>Received</Chip>
        </div>
        {showRange && <RangePicker range={range} onChange={setRange} />}

        {data.txs.length === 0 ? (
          <Empty icon={<FileText size={24} />} title="No entries yet" text="Use “I gave” or “I received” above." />
        ) : (
          <>
            {openRows.length > 0 ? (
              <Paged rows={openRows} page={20} render={(r) => row(r)} />
            ) : (
              !closedRows.length && <div className="py-6 text-center text-sm text-slate-500">Nothing matches the filter.</div>
            )}
            {closedRows.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowClosed((v) => !v)}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                >
                  <span className="flex items-center gap-2">
                    <CheckCheck size={16} /> Settled & closed · {closedRows.length} entr{closedRows.length === 1 ? 'y' : 'ies'}
                  </span>
                  <ChevronDown size={18} className={cx('transition-transform', (showClosed || filtering) && 'rotate-180')} />
                </button>
                {(showClosed || filtering) && (
                  <div className="mt-2">
                    <Paged rows={closedRows} page={20} render={(r) => row(r, true)} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <PersonForm open={editing} onClose={() => setEditing(false)} person={person} onDeleted={() => nav('/', { replace: true })} />

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? typeLabel(selected) : ''}>
        {selected && (
          <div className="space-y-3 pb-2">
            <div className={cx('rounded-2xl p-4 text-sm', selected.direction === 'given' ? 'bg-pos-soft dark:bg-green-950/40' : 'bg-neg-soft dark:bg-red-950/40')}>
              <div className={cx('tabular text-2xl font-bold', selected.direction === 'given' ? 'text-pos' : 'text-neg')}>{formatMoney(selected.amountInFils, c, true)}</div>
              <div className="mt-1 text-slate-500">
                {formatDate(selected.date, settings.dateFormat)}
                {selected.reason ? ` · ${selected.reason}` : ''}
              </div>
              {selected.notes && <div className="mt-2 whitespace-pre-wrap">{selected.notes}</div>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const tx = selected
                  setSelected(null)
                  openAdd({ editTx: tx })
                }}
              >
                <Pencil size={17} /> Edit
              </Button>
              <Button variant="danger" onClick={() => del(selected)}>
                <Trash2 size={17} /> Delete
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <ClearBalanceSheet open={clearing} onClose={() => setClearing(false)} personId={person.id} name={person.name} balance={bal} />
      <ShareSheet open={sharing} onClose={() => setSharing(false)} personId={person.id} />
    </>
  )
}

function TopBar({ onBack, right }: { onBack: () => void; right?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-slate-50/85 backdrop-blur-xl dark:bg-black/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-2 py-1.5">
        <button type="button" onClick={onBack} className="flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 font-medium text-blue-600 active:bg-slate-200 dark:text-blue-400 dark:active:bg-slate-800">
          <ChevronLeft size={26} /> People
        </button>
        <div className="flex">{right}</div>
      </div>
    </header>
  )
}

function RangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="mb-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <Field label="From">
        <input type="date" className={inputCls} value={range.from ?? ''} onChange={(e) => onChange({ ...range, from: e.target.value || undefined })} />
      </Field>
      <Field label="To">
        <input type="date" className={inputCls} value={range.to ?? ''} onChange={(e) => onChange({ ...range, to: e.target.value || undefined })} />
      </Field>
      <Button variant="ghost" onClick={() => onChange({})} className="px-2">
        Reset
      </Button>
    </div>
  )
}

function ClearBalanceSheet({ open, onClose, personId, name, balance }: { open: boolean; onClose: () => void; personId: string; name: string; balance: number }) {
  const { settings, toast } = useApp()
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const amount = formatMoney(Math.abs(balance), settings.currency)

  async function go() {
    setBusy(true)
    try {
      await repo.clearBalance(personId, date)
      toast(`${name}: balance cleared`)
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Clear balance" footer={<Button className="w-full" disabled={busy || balance === 0} onClick={go}><CheckCheck size={18} /> Clear {amount}</Button>}>
      <div className="space-y-4">
        <p className="text-[15px] text-slate-600 dark:text-slate-300">
          {balance > 0 ? `Records that ${name} paid you ${amount}.` : `Records that you paid ${name} ${amount}.`} The balance becomes zero and older entries move into “Settled & closed”. <b>Nothing is deleted.</b>
        </p>
        <DatePickerRow date={date} onChange={setDate} />
      </div>
    </Sheet>
  )
}

function ShareSheet({ open, onClose, personId }: { open: boolean; onClose: () => void; personId: string }) {
  const { settings } = useApp()
  const [range, setRange] = useState<DateRange>({})
  const { share, busy, sheet } = useFileShare()
  const opts = { currency: settings.currency, dateFormat: settings.dateFormat, title: settings.appTitle, owner: settings.ownerName, accent: settings.accent }
  const data = useLiveQuery(async () => {
    const [person, txs] = await Promise.all([db.people.get(personId), liveTxsOf(personId)])
    return person ? { person, txs } : undefined
  }, [personId])

  // Synchronous on purpose: iPhone only opens WhatsApp straight after a tap.
  function whatsapp() {
    if (!data) return
    window.open(whatsappLink(statementText(data.person, data.txs, range, opts)), '_blank')
  }
  const Row = ({ k, icon, title, sub, onClick }: { k: string; icon: ReactNode; title: string; sub: string; onClick: () => void }) => (
    <button type="button" disabled={!!busy || !data} onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-slate-100 disabled:opacity-60 dark:active:bg-slate-800">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold">{busy === k ? 'Preparing…' : title}</span>
        <span className="block text-[13px] text-slate-500">{sub}</span>
      </span>
    </button>
  )

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Share statement">
        <div className="space-y-1 pb-2">
          <RangePicker range={range} onChange={setRange} />
          <Row
            k="pdf"
            icon={<FileText size={20} className="text-red-600" />}
            title="PDF statement"
            sub="Share sheet — WhatsApp, Mail, Save to Files…"
            onClick={() => data && share('pdf', async () => [await personStatementPDF(data.person, data.txs, range, opts)], `${data.person.name} – statement`)}
          />
          <Row k="wa" icon={<MessageCircle size={20} className="text-green-600" />} title="WhatsApp text summary" sub="Opens WhatsApp — choose the person and press send" onClick={whatsapp} />
        </div>
      </Sheet>
      {sheet}
    </>
  )
}
