import Dexie, { type Table } from 'dexie'
import type { OutboxItem, Person, SettingsRow, Snapshot, Transaction } from './types'

export class LedgerDB extends Dexie {
  people!: Table<Person, string>
  transactions!: Table<Transaction, string>
  settings!: Table<SettingsRow, string>
  snapshots!: Table<Snapshot, string>
  outbox!: Table<OutboxItem, string>

  constructor(name = 'my-ledger') {
    super(name)
    // Never edit an old version — add a new one. Dexie upgrades existing data automatically.
    this.version(1).stores({
      people: 'id, name, archivedAt, createdAt',
      transactions: 'id, personId, date, type, createdAt',
      expenses: 'id, date, category, createdAt',
      settings: 'key',
      snapshots: 'id, createdAt',
    })
    // v2: ledger is people-only (personal expenses removed), soft deletes + sync outbox.
    this.version(2).stores({
      people: 'id, name, archivedAt, createdAt, updatedAt',
      transactions: 'id, personId, date, type, createdAt, updatedAt',
      expenses: null,
      settings: 'key',
      snapshots: 'id, createdAt',
      outbox: 'key, queuedAt',
    })
  }
}

export let db = new LedgerDB()

/** Tests use this to get a fresh, isolated database. */
export function openDatabase(name: string) {
  db = new LedgerDB(name)
  return db
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const nowISO = () => new Date().toISOString()

export const alive = <T extends { deletedAt?: string | null }>(r: T) => !r.deletedAt

/** All non-deleted people / transactions. */
export const livePeople = () => db.people.filter(alive).toArray()
export const liveTransactions = () => db.transactions.filter(alive).toArray()
export const liveTxsOf = (personId: string) => db.transactions.where('personId').equals(personId).filter(alive).toArray()

/** Mark records as changed so cloud sync uploads them. Call inside the same Dexie transaction. */
export async function queue(table: 'people' | 'transactions', ids: string[]) {
  const t = nowISO()
  await db.outbox.bulkPut(ids.map((id) => ({ key: `${table}:${id}`, table, id, queuedAt: t })))
}
