import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { liveTransactions, liveTxsOf, openDatabase } from '../src/lib/db'
import { dashboardTotals, personSummary, splitSettled, summariesByPerson } from '../src/lib/ledger'
import { formatMoney, parseAmountToFils } from '../src/lib/money'
import { formatDate } from '../src/lib/dates'
import * as repo from '../src/lib/repo'
import { allData, clearAllData } from '../src/lib/backup'
import { allDataXLSX, personStatementPDF, statementByCurrency, statementText } from '../src/lib/exporters'
import { parseVCards } from '../src/lib/contacts'

let n = 0
let db = openDatabase('t0')
beforeEach(() => {
  db = openDatabase(`test-${++n}`)
})

const bal = (txs: Parameters<typeof personSummary>[0], c = 'AED') => personSummary(txs).byCurrency.get(c)?.balance ?? 0

async function ahmedExample() {
  const ahmed = await repo.addPerson({ name: 'Ahmed', phone: '050 123 4567' })
  await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 50000, reason: 'Rent', date: '2026-11-01' })
  await repo.addTransaction({ personId: ahmed.id, direction: 'received', amountInFils: 20000, date: '2026-11-02' })
  await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 10000, reason: 'Fuel', date: '2026-11-03' })
  return ahmed
}

describe('basics', () => {
  it('parses decimal amounts exactly', () => {
    expect(parseAmountToFils('0.1')).toBe(10)
    expect(parseAmountToFils('1,234.56')).toBe(123456)
    expect(parseAmountToFils('0')).toBeNull()
    expect(parseAmountToFils('-5')).toBeNull()
    expect(formatMoney(10 + 20, 'AED', true)).toBe('AED 0.30')
  })
  it('uses one date format: 03-Nov-26', () => {
    expect(formatDate('2026-11-03')).toBe('03-Nov-26')
  })
  it('requires name and a mobile number', async () => {
    await expect(repo.addPerson({ name: 'No phone' })).rejects.toThrow('mobile')
    await expect(repo.addPerson({ name: 'Bad', phone: '123' })).rejects.toThrow('mobile')
    await expect(repo.addPerson({ name: '', phone: '0501234567' })).rejects.toThrow('name')
    expect((await repo.addPerson({ name: 'Ok', phone: '+971 50 123 4567' })).phone).toBe('+971501234567')
  })
})

describe('balances', () => {
  it('giving increases and receiving decreases balance (Ahmed example)', async () => {
    const ahmed = await ahmedExample()
    const t = personSummary(await liveTxsOf(ahmed.id)).byCurrency.get('AED')!
    expect([t.given, t.received, t.balance]).toEqual([60000, 20000, 40000])
  })

  it('keeps AED, PKR and USD separate per person', async () => {
    const ahmed = await ahmedExample()
    await repo.addTransaction({ personId: ahmed.id, direction: 'received', amountInFils: 500000, date: '2026-11-03', currency: 'PKR' })
    await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 1000, date: '2026-11-03', currency: 'USD' })
    const s = personSummary(await liveTxsOf(ahmed.id))
    expect(s.open).toEqual(
      expect.arrayContaining([
        { currency: 'AED', balance: 40000 },
        { currency: 'PKR', balance: -500000 },
        { currency: 'USD', balance: 1000 },
      ]),
    )
    const d = dashboardTotals(await liveTransactions())
    expect(d.rows.find((r) => r.currency === 'PKR')).toMatchObject({ theyOweMe: 0, iOweThem: 500000 })
    await expect(repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 1, date: '2026-11-03', currency: 'EUR' })).rejects.toThrow()
  })

  it('editing and deleting recalculate totals', async () => {
    const ahmed = await ahmedExample()
    const [first] = (await liveTxsOf(ahmed.id)).filter((t) => t.date === '2026-11-01')
    await repo.updateTransaction(first.id, { ...first, amountInFils: 30000 })
    expect(bal(await liveTxsOf(ahmed.id))).toBe(20000)
    await repo.deleteTransaction(first.id)
    expect(bal(await liveTxsOf(ahmed.id))).toBe(-10000)
  })

  it('settling clears every currency, keeps history and collapses the settled period', async () => {
    const ahmed = await ahmedExample()
    await repo.addTransaction({ personId: ahmed.id, direction: 'received', amountInFils: 9900, date: '2026-11-03', currency: 'PKR' })
    const s = await repo.clearBalance(ahmed.id, '2026-11-04')
    expect(s.map((t) => t.currency).sort()).toEqual(['AED', 'PKR'])
    const txs = await liveTxsOf(ahmed.id)
    expect(txs).toHaveLength(6)
    expect(personSummary(txs).settled).toBe(true)
    expect(await repo.clearBalance(ahmed.id, '2026-11-04')).toHaveLength(0)
    await repo.addTransaction({ personId: ahmed.id, direction: 'given', amountInFils: 500, date: '2026-11-05' })
    const split = splitSettled(await liveTxsOf(ahmed.id))
    expect(split.closed).toHaveLength(6)
    expect(split.open).toHaveLength(1)
  })

  it('keeps people independent', async () => {
    const ahmed = await ahmedExample()
    const bilal = await repo.addPerson({ name: 'Bilal', phone: '0551112222' })
    await repo.addTransaction({ personId: bilal.id, direction: 'received', amountInFils: 7525, date: '2026-11-02' })
    const all = summariesByPerson(await liveTransactions())
    expect(all.get(ahmed.id)!.open).toEqual([{ currency: 'AED', balance: 40000 }])
    expect(all.get(bilal.id)!.open).toEqual([{ currency: 'AED', balance: -7525 }])
    expect(dashboardTotals(await liveTransactions())).toEqual({ rows: [{ currency: 'AED', theyOweMe: 40000, iOweThem: 7525 }], openPeople: 2 })
  })

  it('ignores double-save and rejects zero', async () => {
    const p = await repo.addPerson({ name: 'X', phone: '0501231234' })
    await expect(repo.addTransaction({ personId: p.id, direction: 'given', amountInFils: 0, date: '2026-11-01' })).rejects.toThrow()
    const input = { id: 'fixed-id', personId: p.id, direction: 'given' as const, amountInFils: 100, date: '2026-11-01' }
    await repo.addTransaction(input)
    await repo.addTransaction(input)
    expect(await liveTxsOf(p.id)).toHaveLength(1)
  })

  it('deletes people permanently and queues every change for sync', async () => {
    const ahmed = await ahmedExample()
    expect(await db.outbox.count()).toBe(4)
    await db.outbox.clear()
    await repo.deletePerson(ahmed.id)
    expect(await liveTxsOf(ahmed.id)).toHaveLength(0)
    expect(await db.outbox.count()).toBe(4)
  })

  it('clears all data', async () => {
    await ahmedExample()
    await clearAllData(true)
    expect(await liveTransactions()).toHaveLength(0)
    await clearAllData(false)
    expect(await db.transactions.count()).toBe(0)
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

describe('statements & export', () => {
  it('statement per currency and WhatsApp text', async () => {
    const ahmed = await ahmedExample()
    await repo.addTransaction({ personId: ahmed.id, direction: 'received', amountInFils: 300000, date: '2026-11-03', currency: 'PKR' })
    const txs = await liveTxsOf(ahmed.id)
    const s = statementByCurrency(txs, { from: '2026-11-02' })
    expect(s.find((x) => x.currency === 'AED')).toMatchObject({ opening: 50000, closing: 40000 })
    const text = statementText(ahmed, txs, {}, { owner: 'Attaullah Sher' })
    expect(text).toContain('You owe me AED 400.')
    expect(text).toContain('I owe you PKR 3,000.')
    expect(text).toContain('Attaullah Sher')
    const pdf = await personStatementPDF(ahmed, txs, {}, { owner: 'Attaullah Sher' })
    expect(pdf.size).toBeGreaterThan(2000)
  })

  it('downloads all data as Excel', async () => {
    await ahmedExample()
    const xlsx = await allDataXLSX(await allData(), {})
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await xlsx.arrayBuffer())
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Balances', 'Entries'])
    expect(wb.getWorksheet('Entries')!.rowCount).toBe(4)
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
