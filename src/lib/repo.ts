// All database writes go through here so validation, timestamps and sync queueing are consistent.
import Dexie from 'dexie'
import { db, liveTxsOf, newId, nowISO, queue } from './db'
import { isValidISODate } from './dates'
import { normalizePhone } from './phone'
import { curOf, personSummary, settlementFor } from './ledger'
import { CURRENCIES, DEFAULT_CURRENCY, DEFAULT_SETTINGS, PROFILE_KEYS, type Direction, type Person, type Settings, type Transaction } from './types'

export class ValidationError extends Error {}

function assertAmount(fils: number) {
  if (!Number.isSafeInteger(fils) || fils <= 0) throw new ValidationError('Amount must be greater than zero.')
}
function assertDate(date: string) {
  if (!isValidISODate(date)) throw new ValidationError('Please choose a valid date.')
}
/** Accepts UAE, Pakistan, US and international formats; see phone.ts. */
export const cleanPhone = normalizePhone
function assertCurrency(c?: string) {
  if (c && !(CURRENCIES as readonly string[]).includes(c)) throw new ValidationError('Currency must be AED, PKR or USD.')
}

const clean = (s?: string | null) => {
  const v = (s ?? '').trim()
  return v ? v : undefined
}

function isDuplicate(err: unknown) {
  return err instanceof Dexie.ConstraintError || (err as { name?: string })?.name === 'ConstraintError'
}

const rw = <T>(fn: () => Promise<T>) => db.transaction('rw', [db.people, db.transactions, db.outbox], fn)

// ---------- People ----------

export async function addPerson(input: { name: string; phone?: string; notes?: string; id?: string }): Promise<Person> {
  const name = clean(input.name)
  if (!name) throw new ValidationError('Please enter a name.')
  const phone = cleanPhone(input.phone)
  if (!phone) throw new ValidationError('Please enter a valid mobile number.')
  const ts = nowISO()
  const person: Person = {
    id: input.id ?? newId(),
    name,
    phone,
    notes: clean(input.notes),
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
    deletedAt: null,
  }
  await rw(async () => {
    try {
      await db.people.add(person)
      await queue('people', [person.id])
    } catch (e) {
      if (!isDuplicate(e)) throw e
    }
  })
  return person
}

/** Returns the existing person with this mobile number, or adds a new one. Avoids duplicates. */
export async function findOrAddPerson(input: { name: string; phone?: string }): Promise<{ person: Person; existed: boolean }> {
  const phone = cleanPhone(input.phone)
  if (phone) {
    const tail = phone.replace(/\D/g, '').slice(-9)
    const existing = (await db.people.toArray()).find((p) => !p.deletedAt && p.phone && p.phone.replace(/\D/g, '').slice(-9) === tail)
    if (existing) return { person: existing, existed: true }
  }
  return { person: await addPerson(input), existed: false }
}

/** Adds several people at once (contacts import). Skips names that already exist or have no mobile. */
export async function addPeople(list: { name: string; phone?: string }[]): Promise<number> {
  const existing = new Set((await db.people.toArray()).filter((p) => !p.deletedAt).map((p) => p.name.toLowerCase()))
  let added = 0
  for (const c of list) {
    const name = clean(c.name)
    if (!name || !cleanPhone(c.phone) || existing.has(name.toLowerCase())) continue
    await addPerson({ name, phone: c.phone })
    existing.add(name.toLowerCase())
    added++
  }
  return added
}

async function touchPerson(id: string, patch: Partial<Person>) {
  await rw(async () => {
    await db.people.update(id, { ...patch, updatedAt: nowISO() })
    await queue('people', [id])
  })
}

export async function updatePerson(id: string, input: { name: string; phone?: string; notes?: string }) {
  const name = clean(input.name)
  if (!name) throw new ValidationError('Please enter a name.')
  const phone = cleanPhone(input.phone)
  if (!phone) throw new ValidationError('Please enter a valid mobile number.')
  await touchPerson(id, { name, phone, notes: clean(input.notes) })
}

export const archivePerson = (id: string) => touchPerson(id, { archivedAt: nowISO() })
export const restorePerson = (id: string) => touchPerson(id, { archivedAt: null })

/** Permanently removes a person and all their entries (PIN-protected in the UI). */
export async function deletePerson(id: string) {
  await rw(async () => {
    const ts = nowISO()
    const txs = await db.transactions.where('personId').equals(id).toArray()
    await db.transactions.bulkUpdate(txs.map((t) => ({ key: t.id, changes: { deletedAt: ts, updatedAt: ts } })))
    await db.people.update(id, { deletedAt: ts, updatedAt: ts })
    await queue('transactions', txs.map((t) => t.id))
    await queue('people', [id])
  })
}

// ---------- Transactions ----------

export interface TransactionInput {
  id?: string
  personId: string
  direction: Direction
  amountInFils: number
  reason?: string
  notes?: string
  date: string
  currency?: string
}

export async function addTransaction(input: TransactionInput): Promise<Transaction> {
  assertAmount(input.amountInFils)
  assertDate(input.date)
  assertCurrency(input.currency)
  if (!input.personId) throw new ValidationError('Please choose a person.')
  const ts = nowISO()
  const tx: Transaction = {
    id: input.id ?? newId(),
    type: input.direction,
    direction: input.direction,
    personId: input.personId,
    amountInFils: input.amountInFils,
    reason: clean(input.reason),
    notes: clean(input.notes),
    date: input.date,
    currency: input.currency || DEFAULT_CURRENCY,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  }
  await rw(async () => {
    const person = await db.people.get(tx.personId)
    if (!person || person.deletedAt) throw new ValidationError('That person no longer exists.')
    try {
      await db.transactions.add(tx)
      await queue('transactions', [tx.id])
    } catch (e) {
      if (!isDuplicate(e)) throw e // same id = already saved (double tap) — ignore
    }
  })
  return tx
}

export async function updateTransaction(id: string, input: TransactionInput) {
  assertAmount(input.amountInFils)
  assertDate(input.date)
  assertCurrency(input.currency)
  await rw(async () => {
    const existing = await db.transactions.get(id)
    if (!existing || existing.deletedAt) throw new ValidationError('Entry not found.')
    await db.transactions.update(id, {
      type: existing.type === 'settlement' ? 'settlement' : input.direction,
      direction: input.direction,
      personId: input.personId,
      amountInFils: input.amountInFils,
      reason: clean(input.reason),
      notes: clean(input.notes),
      date: input.date,
      currency: input.currency || curOf(existing),
      updatedAt: nowISO(),
    })
    await queue('transactions', [id])
  })
}

export async function deleteTransaction(id: string) {
  await rw(async () => {
    const ts = nowISO()
    await db.transactions.update(id, { deletedAt: ts, updatedAt: ts })
    await queue('transactions', [id])
  })
}

/** CLEAR BALANCE: adds one settlement entry per open currency so every balance becomes zero. History is kept. */
export async function clearBalance(personId: string, date: string): Promise<Transaction[]> {
  assertDate(date)
  const ts = nowISO()
  const out: Transaction[] = []
  for (const { currency, balance } of personSummary(await liveTxsOf(personId)).open) {
    const s = settlementFor(balance)!
    out.push({
      id: newId(),
      type: 'settlement',
      direction: s.direction,
      personId,
      amountInFils: s.amountInFils,
      reason: 'Balance cleared',
      date,
      currency,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    })
  }
  if (!out.length) return out
  await rw(async () => {
    await db.transactions.bulkAdd(out)
    await queue('transactions', out.map((t) => t.id))
  })
  return out
}

// ---------- Settings (device only) ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('app')
  const { key: _key, ...rest } = row ?? { key: 'app' }
  return { ...DEFAULT_SETTINGS, ...rest }
}

export async function saveSettings(patch: Partial<Settings>, fromSync = false) {
  const current = await getSettings()
  const profileChanged = !fromSync && PROFILE_KEYS.some((k) => k in patch && patch[k] !== current[k])
  await db.settings.put({ ...current, ...patch, ...(profileChanged ? { profileUpdatedAt: nowISO() } : {}), key: 'app' })
}

// ---------- PIN ----------

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function setPin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new ValidationError('PIN must be 4 to 6 digits.')
  const salt = newId()
  await saveSettings({ pinSalt: salt, pinHash: await sha256(`${salt}:${pin}`) })
}

export async function checkPin(pin: string): Promise<boolean> {
  const s = await getSettings()
  if (!s.pinHash || !s.pinSalt) return false
  return (await sha256(`${s.pinSalt}:${pin}`)) === s.pinHash
}

export async function removePin() {
  await saveSettings({ pinHash: null, pinSalt: null })
}
