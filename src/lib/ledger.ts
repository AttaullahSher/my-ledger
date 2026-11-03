// Pure balance logic — no database access, so it is easy to test.
// Balances are kept per currency (AED, PKR, USD) and never mixed.
import { formatMoney } from './money'
import { DEFAULT_CURRENCY, type Person, type Transaction } from './types'

export const curOf = (t: Pick<Transaction, 'currency'>) => t.currency || DEFAULT_CURRENCY

/** Effect of one transaction on "they owe me". Given = +, received = -. */
export function effectOf(t: Pick<Transaction, 'direction' | 'amountInFils'>): number {
  return t.direction === 'given' ? t.amountInFils : -t.amountInFils
}

export interface Totals {
  given: number
  received: number
  /** Positive = they owe me. Negative = I owe them. Zero = settled. */
  balance: number
}

/** Totals for a list of entries that are all in the same currency. */
export function totalsOf(txs: Transaction[]): Totals {
  let given = 0
  let received = 0
  for (const t of txs) {
    if (t.direction === 'given') given += t.amountInFils
    else received += t.amountInFils
  }
  return { given, received, balance: given - received }
}

export interface PersonSummary {
  /** Totals per currency, e.g. AED → {...}, PKR → {...} */
  byCurrency: Map<string, Totals>
  /** Only currencies with a non-zero balance */
  open: { currency: string; balance: number }[]
  settled: boolean
  count: number
  lastDate?: string
}

export function personSummary(txs: Transaction[]): PersonSummary {
  const groups = new Map<string, Transaction[]>()
  let lastDate: string | undefined
  for (const t of txs) {
    const c = curOf(t)
    groups.set(c, [...(groups.get(c) ?? []), t])
    if (!lastDate || t.date > lastDate) lastDate = t.date
  }
  const byCurrency = new Map<string, Totals>()
  for (const [c, list] of groups) byCurrency.set(c, totalsOf(list))
  const open = [...byCurrency].filter(([, t]) => t.balance !== 0).map(([currency, t]) => ({ currency, balance: t.balance }))
  return { byCurrency, open, settled: open.length === 0, count: txs.length, lastDate }
}

/** Summary per person — each person is computed only from their own entries. */
export function summariesByPerson(txs: Transaction[]): Map<string, PersonSummary> {
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) groups.set(t.personId, [...(groups.get(t.personId) ?? []), t])
  const out = new Map<string, PersonSummary>()
  for (const [id, list] of groups) out.set(id, personSummary(list))
  return out
}

export interface CurrencyTotals {
  currency: string
  theyOweMe: number
  iOweThem: number
}

/** Main-screen totals, one row per currency in use. */
export function dashboardTotals(txs: Transaction[]): { rows: CurrencyTotals[]; openPeople: number } {
  const map = new Map<string, CurrencyTotals>()
  let openPeople = 0
  for (const s of summariesByPerson(txs).values()) {
    if (!s.settled) openPeople++
    for (const { currency, balance } of s.open) {
      const row = map.get(currency) ?? { currency, theyOweMe: 0, iOweThem: 0 }
      if (balance > 0) row.theyOweMe += balance
      else row.iOweThem += -balance
      map.set(currency, row)
    }
  }
  return { rows: [...map.values()], openPeople }
}

/** Sort oldest → newest (date, then creation time). */
export function sortChronological<T extends { date: string; createdAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

export interface Row {
  tx: Transaction
  /** Running balance in this entry's currency, after this entry. */
  balance: number
}

/** Rows with running balance per currency, oldest first. */
export function withRunningBalance(txs: Transaction[], opening: Map<string, number> = new Map()): Row[] {
  const bal = new Map(opening)
  return sortChronological(txs).map((t) => {
    const c = curOf(t)
    const b = (bal.get(c) ?? 0) + effectOf(t)
    bal.set(c, b)
    return { tx: t, balance: b }
  })
}

/**
 * Splits history into "settled & closed" (everything up to the last moment ALL currencies were zero)
 * and "open" (after that). Both newest first.
 */
export function splitSettled(txs: Transaction[]) {
  const rows = withRunningBalance(txs)
  const bal = new Map<string, number>()
  let cut = -1
  rows.forEach((r, i) => {
    bal.set(curOf(r.tx), r.balance)
    if ([...bal.values()].every((v) => v === 0)) cut = i
  })
  return { open: rows.slice(cut + 1).reverse(), closed: rows.slice(0, cut + 1).reverse() }
}

/** The settlement that brings a balance to zero, or null when already settled. */
export function settlementFor(balance: number): { direction: 'given' | 'received'; amountInFils: number } | null {
  if (balance === 0) return null
  return balance > 0 ? { direction: 'received', amountInFils: balance } : { direction: 'given', amountInFils: -balance }
}

export function balanceSentence(name: string, balance: number, currency: string): string {
  if (balance > 0) return `${name} owes me ${formatMoney(balance, currency)}.`
  if (balance < 0) return `I owe ${name} ${formatMoney(-balance, currency)}.`
  return `${name} and I are settled.`
}

export function typeLabel(t: Pick<Transaction, 'type' | 'direction'>): string {
  if (t.type === 'settlement') return t.direction === 'received' ? 'Settled (received)' : 'Settled (paid)'
  return t.type === 'given' ? 'Money given' : 'Money received'
}

export function activePeople(people: Person[]) {
  return people.filter((p) => !p.archivedAt)
}
