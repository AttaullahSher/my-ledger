import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { liveTransactions, liveTxsOf, openDatabase } from '../src/lib/db'
import { dashboardTotals, personTotals, splitSettled, totalsByPerson } from '../src/lib/ledger'
import { formatMoney, parseAmountToFils } from '../src/lib/money'
import * as repo from '../src/lib/repo'
import { buildBackup, clearAllData, restoreBackup, takeSnapshot, validateBackup } from '../src/lib/backup'
import { fullCSVs, fullXLSX, personCSV, statementRows, statementText } from '../src/lib/exporters'
import { parseVCards } from '../src/lib/contacts'

let n = 0
let db = openDatabase('t0')
beforeEach(() => {
  db = openDatabase(`test-${++n}`)
})

const opts = { currency: 'AED', dateFormat: 'YYYY-MM-DD' as const }

async function ahmedExample() {
  const ahmed = await repo.addPerson({ name: 'Ahmed' })
  await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 50000, reason: 'Rent', date: '2026-11-01' })
  await repo.addTransaction({ personId: ahmed.id, direction: 'received', amountInFils: 20000, date: '2026-11-02' })
  await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 10000, reason: 'Fuel', date: '2026-11-03' })
  return ahmed
}

describe('money', () => {
  it('parses decimal AED amounts exactly', () => {
    expect(parseAmountToFils('0.1')).toBe(10)
    expect(parseAmountToFils('1,234.56')).toBe(123456)
    expect(parseAmountToFils('.5')).toBe(50)
    expect(parseAmountToFils('0')).toBeNull()
    expect(parseAmountToFils('-5')).toBeNull()
    expect(parseAmountToFils('1.234')).toBeNull()
  })
  it('adds decimals without floating-point error', () => {
    expect(formatMoney(10 + 20, 'AED', true)).toBe('AED 0.30')
  })
})

describe('person balances', () => {
  it('giving increases and receiving decreases balance (Ahmed example)', async () => {
    const ahmed = await ahmedExample()
    const t = personTotals(await liveTxsOf(ahmed.id))
    expect([t.given, t.received, t.balance]).toEqual([60000, 20000, 40000])
  })

  it('editing and deleting recalculate totals', async () => {
    const ahmed = await ahmedExample()
    const [first] = (await liveTxsOf(ahmed.id)).filter((t) => t.date === '2026-11-01')
    await repo.updateTransaction(first.id, { ...first, amountInFils: 30000 })
    expect(personTotals(await liveTxsOf(ahmed.id)).balance).toBe(20000)
    await repo.deleteTransaction(first.id)
    expect(personTotals(await liveTxsOf(ahmed.id)).balance).toBe(-10000)
  })

  it('settlement brings balance to zero, keeps history and collapses settled period', async () => {
    const ahmed = await ahmedExample()
    const s = await repo.clearBalance(ahmed.id, '2026-11-04', 'Paid cash')
    expect(s?.direction).toBe('received')
    const txs = await liveTxsOf(ahmed.id)
    expect(txs).toHaveLength(4)
    expect(personTotals(txs).balance).toBe(0)
    expect(await repo.clearBalance(ahmed.id, '2026-11-04')).toBeNull()
    await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 500, date: '2026-11-05' })
    const split = splitSettled(await liveTxsOf(ahmed.id))
    expect(split.closed).toHaveLength(4)
    expect(split.open).toHaveLength(1)
  })

  it('keeps multiple people independent', async () => {
    const ahmed = await ahmedExample()
    const bilal = await repo.addPerson({ name: 'Bilal' })
    await repo.addTransaction({ personId: bilal.id, direction: 'received', amountInFils: 7525, date: '2026-11-02' })
    const all = totalsByPerson(await liveTransactions())
    expect(all.get(ahmed.id)?.balance).toBe(40000)
    expect(all.get(bilal.id)?.balance).toBe(-7525)
    expect(dashboardTotals(await liveTransactions())).toMatchObject({ theyOweMe: 40000, iOweThem: 7525, net: 32475, openCount: 2 })
  })

  it('rejects invalid amounts and ignores double-save', async () => {
    const p = await repo.addPerson({ name: 'X' })
    await expect(repo.addTransaction({ personId: p.id, direction: 'given', amountInFils: 0, date: '2026-11-01' })).rejects.toThrow()
    const input = { id: 'fixed-id', personId: p.id, direction: 'given' as const, amountInFils: 100, date: '2026-11-01' }
    await repo.addTransaction(input)
    await repo.addTransaction(input)
    expect(await liveTxsOf(p.id)).toHaveLength(1)
  })

  it('archives and permanently deletes people', async () => {
    const ahmed = await ahmedExample()
    await repo.archivePerson(ahmed.id)
    expect((await db.people.get(ahmed.id))?.archivedAt).toBeTruthy()
    await repo.restorePerson(ahmed.id)
    await repo.deletePerson(ahmed.id)
    expect(await liveTxsOf(ahmed.id)).toHaveLength(0)
    expect((await db.people.get(ahmed.id))?.deletedAt).toBeTruthy()
  })

  it('queues every change for cloud sync', async () => {
    const ahmed = await ahmedExample()
    expect(await db.outbox.count()).toBe(4)
    await db.outbox.clear()
    await repo.deletePerson(ahmed.id)
    expect(await db.outbox.count()).toBe(4)
  })
})

describe('PIN', () => {
  it('sets, checks and removes a PIN', async () => {
    await expect(repo.setPin('12')).rejects.toThrow()
    await repo.setPin('2580')
    expect(await repo.checkPin('2580')).toBe(true)
    expect(await repo.checkPin('0000')).toBe(false)
    await repo.removePin()
    expect(await repo.checkPin('2580')).toBe(false)
  })
})

describe('backup and restore', () => {
  it('round-trips all records (replace)', async () => {
    await ahmedExample()
    const backup = JSON.parse(JSON.stringify(await buildBackup()))
    const v = validateBackup(backup)
    expect(v.ok).toBe(true)
    expect(v.summary).toMatchObject({ people: 1, transactions: 3 })
    db = openDatabase(`restore-${n}`)
    await restoreBackup(v.data!, 'replace')
    const again = await buildBackup()
    const strip = (r: { updatedAt?: string }) => ({ ...r, updatedAt: '' })
    expect(again.people.map(strip)).toEqual(backup.people.map(strip))
    expect(again.transactions.map(strip).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      backup.transactions.map(strip).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)),
    )
  })

  it('merge does not duplicate records', async () => {
    await ahmedExample()
    const r = await restoreBackup(await buildBackup(), 'merge')
    expect(r.added).toBe(0)
    expect(await liveTransactions()).toHaveLength(3)
  })

  it('accepts old backups that still contain personal expenses', () => {
    const old = { app: 'MY LEDGER', format: 1, people: [], transactions: [], expenses: [{ id: 'e1' }] }
    expect(validateBackup(old).ok).toBe(true)
  })

  it('rejects broken backups', () => {
    expect(validateBackup({ foo: 1 }).ok).toBe(false)
    const bad = { app: 'MY LEDGER', format: 2, people: [], transactions: [{ id: 'a', personId: 'missing', amountInFils: 5, direction: 'given', type: 'given', date: '2026-01-01' }] }
    expect(validateBackup(bad).ok).toBe(false)
  })

  it('takes safety snapshots and clears all data', async () => {
    await ahmedExample()
    expect((await takeSnapshot('test', true))?.counts.transactions).toBe(3)
    expect(await takeSnapshot('again')).toBeNull()
    await clearAllData(true)
    expect(await liveTransactions()).toHaveLength(0)
    expect(await db.snapshots.count()).toBe(2)
    await clearAllData(false)
    expect(await db.transactions.count()).toBe(0)
  })
})

describe('exports', () => {
  it('statement rows, CSV and text contain correct data', async () => {
    const ahmed = await ahmedExample()
    const txs = await liveTxsOf(ahmed.id)
    const s = statementRows(txs, { from: '2026-11-02' })
    expect([s.opening, s.closing]).toEqual([50000, 40000])
    const csv = await personCSV(ahmed, txs, {}, opts).text()
    expect(csv).toContain('2026-11-01,Money given,Rent,,500.00,,500.00')
    const text = statementText(ahmed, txs, {}, opts)
    expect(text).toContain('Total given: AED 600')
    expect(text).toContain('You owe me AED 400.')
  })

  it('full exports include every sheet and file', async () => {
    await ahmedExample()
    const b = await buildBackup()
    expect(fullCSVs(b, opts).map((f) => f.name.split('-')[0])).toEqual(['people', 'transactions'])
    const xlsx = await fullXLSX(b, opts)
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await xlsx.arrayBuffer())
    expect(wb.worksheets.map((w) => w.name).sort()).toEqual(['All transactions', 'Individual balances', 'People', 'Summary'])
  })
})

describe('contacts', () => {
  it('parses vCards from iPhone Contacts', () => {
    const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Khan;Ahmed;;;\r\nFN:Ahmed Khan\r\nitem1.TEL;type=CELL:+971 50 123 4567\r\nEND:VCARD\r\nBEGIN:VCARD\nN:Ali;Sara;;;\nTEL:0501112233\nEND:VCARD'
    expect(parseVCards(vcf)).toEqual([
      { name: 'Ahmed Khan', phone: '+971 50 123 4567' },
      { name: 'Sara Ali', phone: '0501112233' },
    ])
  })
})
