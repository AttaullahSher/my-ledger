import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, Plus, Search, UserPlus, X } from 'lucide-react'
import { livePeople, liveTransactions, newId } from '../lib/db'
import { formatDate, todayISO } from '../lib/dates'
import { curOf, summariesByPerson } from '../lib/ledger'
import { filsToPlain, formatMoney, parseAmountToFils } from '../lib/money'
import { formatPhone, phoneMatches } from '../lib/phone'
import * as repo from '../lib/repo'
import { CURRENCIES, REASON_SUGGESTIONS, type Person } from '../lib/types'
import { useApp, type QuickAddKind } from './AppContext'
import { ContactsButton } from './ContactsButton'
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
  const [currency, setCurrency] = useState<string>(editTx ? curOf(editTx) : settings.currency || 'AED')
  const [reason, setReason] = useState(editTx?.reason ?? '')
  const [date, setDate] = useState(editTx?.date ?? todayISO()) // today by default
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftId, setDraftId] = useState(newId) // stable id → double taps can't create duplicates
  const amountRef = useRef<HTMLInputElement>(null)

  const people = useLiveQuery(livePeople, []) ?? []
  const summaries = useLiveQuery(async () => summariesByPerson(await liveTransactions()), [])
  const person = people.find((p) => p.id === personId)

  useEffect(() => {
    if (!isEdit && personId) setTimeout(() => amountRef.current?.focus(), 250)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A person with an open balance in exactly one currency → use that currency.
  function pick(p: Person) {
    setPersonId(p.id)
    const open = summaries?.get(p.id)?.open ?? []
    if (!isEdit && open.length === 1) setCurrency(open[0].currency)
    setTimeout(() => amountRef.current?.focus(), 50)
  }

  const fils = parseAmountToFils(amount)

  async function save(addAnother: boolean) {
    setError('')
    if (!personId) return setError('Choose a person.')
    if (!fils) return setError('Enter an amount greater than zero.')
    setSaving(true)
    try {
      const input = { personId: personId!, direction: kind, amountInFils: fils, reason, notes: editTx?.notes, date, currency }
      if (editTx) await repo.updateTransaction(editTx.id, input)
      else await repo.addTransaction({ ...input, id: draftId })
      toast(`${isEdit ? 'Updated' : 'Saved'}: ${kind === 'given' ? 'Given' : 'Received'} ${formatMoney(fils, currency)}`)
      if (addAnother) {
        setDraftId(newId())
        setAmount('')
        setReason('')
        setSaving(false)
        amountRef.current?.focus()
      } else onClose()
    } catch (e) {
      setSaving(false)
      setError(e instanceof repo.ValidationError ? e.message : 'Could not save. Please try again.')
    }
  }

  const title = isEdit ? (isSettlement ? 'Edit settlement' : 'Edit entry') : 'Add entry'
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

        <PersonPicker people={people} person={person} summaries={summaries} onPick={pick} onClear={() => setPersonId(undefined)} />

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">Amount</span>
          <div className={cx('flex items-baseline gap-2 rounded-2xl border px-4 py-3', kind === 'given' ? 'border-pos-line bg-pos-soft dark:border-green-900 dark:bg-green-950/40' : 'border-neg-line bg-neg-soft dark:border-red-900 dark:bg-red-950/40')}>
            <span className="text-lg font-semibold text-slate-400">{currency}</span>
            <input
              ref={amountRef}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0.00"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && save(false)}
              className={cx('tabular min-w-0 flex-1 bg-transparent text-4xl font-bold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600', kind === 'given' ? 'text-pos' : 'text-neg')}
            />
          </div>
          {!isSettlement && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <Chip key={c} active={currency === c} onClick={() => setCurrency(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
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
      </div>
    </Sheet>
  )
}

function PersonPicker({
  people,
  person,
  summaries,
  onPick,
  onClear,
}: {
  people: Person[]
  person?: Person
  summaries?: ReturnType<typeof summariesByPerson>
  onPick: (p: Person) => void
  onClear: () => void
}) {
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [mobile, setMobile] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const active = people
    const list = s ? active.filter((p) => p.name.toLowerCase().includes(s) || phoneMatches(p.phone, s)) : active
    const last = (p: Person) => summaries?.get(p.id)?.lastDate ?? p.createdAt
    return list.sort((a, b) => last(b).localeCompare(last(a))).slice(0, s ? 20 : 6)
  }, [q, people, summaries])

  async function create() {
    setErr('')
    setBusy(true)
    try {
      const p = await repo.addPerson({ name: newName, phone: mobile })
      setQ('')
      setNewName('')
      setMobile('')
      setAdding(false)
      onPick(p)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (person) {
    const open = summaries?.get(person.id)?.open ?? []
    return (
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">Person</span>
        <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
          <Avatar name={person.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{person.name}</div>
            <div className="truncate text-xs">
              {open.length === 0 && <span className="text-slate-500">All settled</span>}
              {open.map(({ currency, balance }, i) => (
                <span key={currency} className={balance > 0 ? 'text-pos' : 'text-neg'}>
                  {i > 0 && ' · '}
                  {balance > 0 ? 'Owes me ' : 'I owe '}
                  {formatMoney(Math.abs(balance), currency)}
                </span>
              ))}
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
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Person</span>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setNewName(q.trim()); setErr('') }} className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-semibold text-blue-600 active:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">
            <UserPlus size={15} /> New person
          </button>
        )}
      </div>
      {adding ? (
        <div className="space-y-2 rounded-2xl bg-blue-50/60 p-3 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900">
          <input autoFocus className={inputCls} placeholder="Name" autoCapitalize="words" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input type="tel" inputMode="tel" className={inputCls} placeholder="Mobile (any format, e.g. 050 123 4567)" value={mobile} onChange={(e) => setMobile(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="grid grid-cols-3 gap-2">
            <Button disabled={busy} onClick={create} className="px-2">
              <UserPlus size={17} /> Add
            </Button>
            <ContactsButton
              className="px-2"
              onPicked={([c]) => {
                setNewName(c.name)
                setMobile(c.phone ?? '')
                setErr(c.phone ? '' : 'This contact has no mobile number — please type it.')
              }}
            />
            <Button variant="secondary" className="px-2" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
      <>
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
            }
          }}
          placeholder="Search name or mobile"
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
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              {p.phone && <span className="block truncate text-xs text-slate-500">{formatPhone(p.phone)}</span>}
            </span>
          </button>
        ))}
        {matches.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-500">{q.trim() ? 'No one found — tap “New person”.' : 'Tap “New person” to add your first person.'}</div>}
      </div>
      </>
      )}
    </div>
  )
}

/** Today / Yesterday / pick a date — one full-width row, easy to tap on iPhone. Today is the default. */
export function DatePickerRow({ date, onChange, label = 'Date' }: { date: string; onChange: (d: string) => void; label?: string }) {
  const today = todayISO()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const yesterday = todayISO(y)
  const other = date !== today && date !== yesterday
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        <Chip active={date === today} onClick={() => onChange(today)}>
          Today
        </Chip>
        <Chip active={date === yesterday} onClick={() => onChange(yesterday)}>
          Yesterday
        </Chip>
        <label
          className={cx(
            'relative flex items-center justify-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[13px] font-medium',
            other ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          <CalendarDays size={15} />
          <span className="truncate">{other ? formatDate(date) : 'Other date'}</span>
          <input type="date" aria-label="Pick a date" value={date} max="2100-12-31" onChange={(e) => onChange(e.target.value || today)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  )
}
