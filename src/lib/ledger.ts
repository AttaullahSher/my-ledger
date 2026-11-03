// Pure balance logic — no database access, so it is easy to test.
import type { Person, Transaction } from './types'
import { formatMoney } from './money'

/** Effect of one transaction on "they owe me". Given = +, received = -. */
export function effectOf(t: Pick<Transaction, 'direction' | 'amountInFils'>): number {
  return t.direction === 'given' ? t.amountInFils : -t.amountInFils
}

export interface PersonTotals {
  given: number
  received: number
  /** Positive = they owe me. Negative = I owe them. Zero = settled. */
  balance: number
  count: number
  lastDate?: string
}

export function personTotals(txs: Transaction[]): PersonTotals {
  let given = 0
  let received = 0
  let lastDate: string | undefined
  for (const t of txs) {
    if (t.direction === 'given') given += t.amountInFils
    else received += t.amountInFils
    if (!lastDate || t.date > lastDate) lastDate = t.date
  }
  return { given, received, balance: given - received, count: txs.length, lastDate }
}

/** Totals per person — each person is computed only from their own transactions. */
export function totalsByPerson(txs: Transaction[]): Map<string, PersonTotals> {
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    const list = groups.get(t.personId)
    if (list) list.push(t)
    else groups.set(t.personId, [t])
  }
  const out = new Map<string, PersonTotals>()
  for (const [id, list] of groups) out.set(id, personTotals(list))
  return out
}

export interface DashboardTotals {
  theyOweMe: number
  iOweThem: number
  net: number
  openCount: number
}

export function dashboardTotals(txs: Transaction[]): DashboardTotals {
  let theyOweMe = 0
  let iOweThem = 0
  let openCount = 0
  for (const t of totalsByPerson(txs).values()) {
    if (t.balance > 0) theyOweMe += t.balance
    else if (t.balance < 0) iOweThem += -t.balance
    if (t.balance !== 0) openCount++
  }
  return { theyOweMe, iOweThem, net: theyOweMe - iOweThem, openCount }
}

/**
 * Splits a person's history into "settled & closed" (everything up to the last moment the
 * balance was zero) and "open" (entries after that). Both returned newest first.
 */
export function splitSettled(txs: Transaction[]) {
  const rows = withRunningBalance(txs)
  let cut = -1
  rows.forEach((r, i) => {
    if (r.balance === 0) cut = i
  })
  const closed = rows.slice(0, cut + 1).reverse()
  const open = rows.slice(cut + 1).reverse()
  return { open, closed }
}

/** Sort oldest → newest (date, then creation time) for statements and running balances. */
export function sortChronological<T extends { date: string; createdAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

export function sortNewestFirst<T extends { date: string; createdAt: string }>(list: T[]): T[] {
  return sortChronological(list).reverse()
}

/** Rows with running balance, oldest first. openingBalance = balance before the first row. */
export function withRunningBalance(txs: Transaction[], openingBalance = 0) {
  let bal = openingBalance
  return sortChronological(txs).map((t) => {
    bal += effectOf(t)
    return { tx: t, balance: bal }
  })
}

/** The settlement that brings the balance to zero, or null when already settled. */
export function settlementFor(balance: number): { direction: 'given' | 'received'; amountInFils: number } | null {
  if (balance === 0) return null
  // They owe me → they pay me (received). I owe them → I pay them (given).
  return balance > 0
    ? { direction: 'received', amountInFils: balance }
    : { direction: 'given', amountInFils: -balance }
}

export function balanceSentence(name: string, balance: number, currency: string): string {
  if (balance > 0) return `${name} owes me ${formatMoney(balance, currency)}.`
  if (balance < 0) return `I owe ${name} ${formatMoney(-balance, currency)}.`
  return `${name} and I are settled.`
}

export function balanceLabel(balance: number): 'They owe me' | 'I owe them' | 'All settled' {
  if (balance > 0) return 'They owe me'
  if (balance < 0) return 'I owe them'
  return 'All settled'
}

export function typeLabel(t: Pick<Transaction, 'type' | 'direction'>): string {
  if (t.type === 'settlement') return t.direction === 'received' ? 'Settled (received)' : 'Settled (paid)'
  return t.type === 'given' ? 'Money given' : 'Money received'
}

export function activePeople(people: Person[]) {
  return people.filter((p) => !p.archivedAt)
}
