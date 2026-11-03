// Whole-ledger helpers: everything for the Excel download, and "clear all data".
import { alive, db, nowISO, queue } from './db'
import type { Person, Transaction } from './types'

export interface AllData {
  people: Person[]
  transactions: Transaction[]
}

export async function allData(): Promise<AllData> {
  const [people, transactions] = await Promise.all([db.people.filter(alive).toArray(), db.transactions.filter(alive).toArray()])
  return { people, transactions }
}

/**
 * signedIn = true: removes everything here AND in the account (deletions sync).
 * signedIn = false: wipes this phone only; the account copy is untouched.
 */
export async function clearAllData(signedIn: boolean) {
  await db.transaction('rw', [db.people, db.transactions, db.outbox], async () => {
    if (!signedIn) {
      await Promise.all([db.people.clear(), db.transactions.clear(), db.outbox.clear()])
      return
    }
    const ts = nowISO()
    const p = await db.people.filter(alive).toArray()
    const t = await db.transactions.filter(alive).toArray()
    await db.people.bulkPut(p.map((r) => ({ ...r, deletedAt: ts, updatedAt: ts })))
    await db.transactions.bulkPut(t.map((r) => ({ ...r, deletedAt: ts, updatedAt: ts })))
    await queue('people', p.map((r) => r.id))
    await queue('transactions', t.map((r) => r.id))
  })
}
