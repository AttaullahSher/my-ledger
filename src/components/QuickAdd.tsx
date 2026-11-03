import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, Plus, Search, UserPlus, X } from 'lucide-react'
import { livePeople, liveTransactions, newId } from '../lib/db'
import { formatDate, todayISO } from '../lib/dates'
import { totalsByPerson } from '../lib/ledger'
import { filsToPlain, formatMoney, parseAmountToFils } from '../lib/money'
import * as repo from '../lib/repo'
import { REASON_SUGGESTIONS, type Person } from '../lib/types'
import { useApp, type QuickAddKind } from './AppContext'
import { Avatar, Button, Chip, Field, Segmented, Sheet, cx, inputCls } from './ui'

export function QuickAdd() {
  const { addRequest, closeAdd } = useApp()
  if (!addRequest) return null
  // Re-mount for every request so the form resets cleanly.
  return <QuickAddForm key={JSON.stringify(addRequest)} onClose={closeAdd} />
}

function QuickAddForm({ onClose }: { onClose: () => void }) {
  const { addRequest, toast, settings } = useApp()
  const req = addRequest!
  const editTx = req.editTx
  const isEdit = !!editTx
  const isSettlement = editTx?.type === 'settlement'

  const [kind, setKind] = useState<QuickAddKind>(editTx ? editTx.direction : (req.kind ?? 'given'))
  const [personId, setPersonId] = useState<string | undefined>(editTx?.personId ?? req.personId)
  const [amount, setAmount] = useState(editTx ? filsToPlain(editTx.amountInFils) : '')
  const [reason, setReason] = useState(editTx?.reason ?? '')
  const [date, setDate] = useState(editTx?.date ?? todayISO())
  const [notes, setNotes] = useState(editTx?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftId, setDraftId] = useState(newId) // stable id → double taps can't create duplicates
  const amountRef = useRef<HTMLInputElement>(null)

  const people = useLiveQuery(livePeople, []) ?? []
  const person = people.find((p) => p.id === personId)

  useEffect(() => {
    // Focus the amount when the person is already known (fastest path).
    if (!isEdit && personId) setTimeout(() => amountRef.current?.focus(), 250)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fils = parseAmountToFils(amount)

  async function save(addAnother: boolean) {
    setError('')
    if (!personId) return setError('Choose a person.')
    if (!fils) return setError('Enter an amount greater than zero.')
    setSaving(true)
    try {
      const input = { personId: personId!, direction: kind, amountInFils: fils, reason, notes, date }
      if (editTx) await repo.updateTransaction(editTx.id, input)
      else await repo.addTransaction({ ...input, id: draftId })
      const what = kind === 'given' ? 'Money given' : 'Money received'
      toast(`${isEdit ? 'Updated' : 'Saved'}: ${what} ${formatMoney(fils, settings.currency)}`)
      if (addAnother) {
        setDraftId(newId())
        setAmount('')
        setReason('')
        setNotes('')
        setSaving(false)
        amountRef.current?.focus()
      } else onClose()
    } catch (e) {
      setSaving(false)
      setError(e instanceof repo.ValidationError ? e.message : 'Could not save. Please try again.')
    }
  }

  const title = isEdit ? (isSettlement ? 'Edit settlement' : 'Edit entry') : 'Add transaction'
  const accent = kind === 'given' ? 'pos' : 'neg'

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="space-y-2">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
          <div className={cx('grid gap-2', !isEdit && 'grid-cols-[1fr_auto]')}>
            <Button variant={accent} disabled={saving} onClick={() => save(false)} className="text-base">
              <Check size={18} /> {isEdit ? 'Save changes' : 'Save'}
            </Button>
            {!isEdit && (
              <Button variant="secondary" disabled={saving} onClick={() => save(true)} aria-label="Save and add another">
                <Plus size={18} /> Another
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!isSettlement && (
          <Segmented<QuickAddKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'given', label: 'I gave', activeClass: 'bg-pos text-white shadow-sm' },
              { value: 'received', label: 'I received', activeClass: 'bg-neg text-white shadow-sm' },
            ]}
          />
        )}

        <PersonPicker people={people} person={person} onPick={(p) => { setPersonId(p.id); setTimeout(() => amountRef.current?.focus(), 50) }} onClear={() => setPersonId(undefined)} />

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">Amount</span>
          <div className={cx('flex items-baseline gap-2 rounded-2xl border px-4 py-3', kind === 'given' ? 'border-pos-line bg-pos-soft dark:border-green-900 dark:bg-green-950/40' : 'border-neg-line bg-neg-soft dark:border-red-900 dark:bg-red-950/40')}>
            <span className="text-lg font-semibold text-slate-400">{settings.currency}</span>
            <input
              ref={amountRef}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0.00"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && save(false)}
              className={cx(
                'tabular min-w-0 flex-1 bg-transparent text-4xl font-bold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600',
                kind === 'given' ? 'text-pos' : 'text-neg',
              )}
            />
          </div>
        </div>

        {!isSettlement && (
          <div>
            <Field label="Reason (optional)">
              <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Loan" />
            </Field>
            <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1">
              {REASON_SUGGESTIONS.map((r) => (
                <Chip key={r} active={reason === r} onClick={() => setReason(reason === r ? '' : r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <DatePickerRow date={date} onChange={setDate} />

        <Field label="Note (optional)">
          <textarea className={cx(inputCls, 'min-h-[52px] resize-none')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any detail you want to remember" />
        </Field>
      </div>
    </Sheet>
  )
}

function PersonPicker({ people, person, onPick, onClear }: { people: Person[]; person?: Person; onPick: (p: Person) => void; onClear: () => void }) {
  const { settings } = useApp()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const balances = useLiveQuery(async () => totalsByPerson(await liveTransactions()), [])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const active = people.filter((p) => !p.archivedAt)
    const list = s ? active.filter((p) => p.name.toLowerCase().includes(s) || p.phone?.includes(s)) : active
    // Most recently used first
    return list
      .sort((a, b) => (balances?.get(b.id)?.lastDate ?? b.createdAt).localeCompare(balances?.get(a.id)?.lastDate ?? a.createdAt))
      .slice(0, s ? 20 : 6)
  }, [q, people, balances])

  const exact = people.some((p) => !p.archivedAt && p.name.toLowerCase() === q.trim().toLowerCase())

  async function create() {
    const name = q.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const p = await repo.addPerson({ name })
      setQ('')
      onPick(p)
    } finally {
      setCreating(false)
    }
  }

  if (person) {
    const bal = balances?.get(person.id)?.balance ?? 0
    return (
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">Person</span>
        <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
          <Avatar name={person.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{person.name}</div>
            <div className={cx('text-xs', bal > 0 ? 'text-pos' : bal < 0 ? 'text-neg' : 'text-slate-500')}>
              {bal > 0 ? `They owe me ${formatMoney(bal, settings.currency)}` : bal < 0 ? `I owe them ${formatMoney(-bal, settings.currency)}` : 'All settled'}
            </div>
          </div>
          <button type="button" onClick={onClear} className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 active:bg-slate-200 dark:text-slate-300 dark:active:bg-slate-700">
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">Person</span>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={cx(inputCls, 'pl-10 pr-10')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (matches[0] && q.trim()) onPick(matches[0])
              else create()
            }
          }}
          placeholder="Search or type a new name"
          aria-label="Search people"
          autoCapitalize="words"
        />
        {q && (
          <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl ring-1 ring-slate-900/5 dark:ring-white/10">
        {matches.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 active:bg-slate-100 dark:border-slate-800 dark:active:bg-slate-800"
          >
            <Avatar name={p.name} />
            <span className="flex-1 truncate font-medium">{p.name}</span>
          </button>
        ))}
        {q.trim() && !exact && (
          <button type="button" onClick={create} className="flex w-full items-center gap-3 px-3 py-3 text-left font-semibold text-blue-600 active:bg-slate-100 dark:text-blue-400 dark:active:bg-slate-800">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 dark:bg-blue-950">
              <UserPlus size={18} />
            </span>
            Add “{q.trim()}” as new person
          </button>
        )}
        {!q.trim() && matches.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-500">Type a name to add your first person.</div>}
      </div>
    </div>
  )
}

/** Today / Yesterday / pick a date — one full-width row, easy to tap on iPhone. */
export function DatePickerRow({ date, onChange, label = 'Date' }: { date: string; onChange: (d: string) => void; label?: string }) {
  const { settings } = useApp()
  const today = todayISO()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const yesterday = todayISO(y)
  const other = date !== today && date !== yesterday
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        <Chip active={date === today} onClick={() => onChange(today)}>Today</Chip>
        <Chip active={date === yesterday} onClick={() => onChange(yesterday)}>Yesterday</Chip>
        <label
          className={cx(
            'relative flex items-center justify-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[13px] font-medium',
            other ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          <CalendarDays size={15} />
          <span className="truncate">{other ? formatDate(date, settings.dateFormat) : 'Other date'}</span>
          <input
            type="date"
            aria-label="Pick a date"
            value={date}
            max="2100-12-31"
            onChange={(e) => onChange(e.target.value || today)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  )
}
