// Full backup / restore, plus automatic on-device safety snapshots.
import { alive, db, newId, nowISO, queue } from './db'
import { isValidISODate } from './dates'
import type { Person, Snapshot, Transaction } from './types'

export const BACKUP_FORMAT = 2
const MAX_SNAPSHOTS = 14

export interface BackupData {
  app: 'MY LEDGER'
  format: number
  exportedAt: string
  people: Person[]
  transactions: Transaction[]
}

export async function buildBackup(): Promise<BackupData> {
  const [people, transactions] = await Promise.all([db.people.filter(alive).toArray(), db.transactions.filter(alive).toArray()])
  return { app: 'MY LEDGER', format: BACKUP_FORMAT, exportedAt: nowISO(), people, transactions }
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `my-ledger-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}

// ---------- Validation ----------

export interface ValidationResult {
  ok: boolean
  errors: string[]
  data?: BackupData
  summary?: { exportedAt: string; people: number; transactions: number; earliest?: string; latest?: string }
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isFils = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0

export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['This file is not a MY LEDGER backup.'] }
  const o = raw as Record<string, unknown>
  if (o.app !== 'MY LEDGER') errors.push('This file is not a MY LEDGER backup.')
  if (typeof o.format !== 'number' || o.format > BACKUP_FORMAT) errors.push('This backup was made by a newer version of the app.')
  for (const k of ['people', 'transactions'] as const) if (!Array.isArray(o[k])) errors.push(`Missing "${k}" list.`)
  if (errors.length) return { ok: false, errors }

  const people = (o.people as Person[]).filter((p) => !p?.deletedAt)
  const transactions = (o.transactions as Transaction[]).filter((t) => !t?.deletedAt)
  const personIds = new Set<string>()

  people.forEach((p, i) => {
    if (!isStr(p?.id) || !isStr(p?.name)) errors.push(`Person #${i + 1} is missing an id or name.`)
    else personIds.add(p.id)
  })
  transactions.forEach((t, i) => {
    const n = `Entry #${i + 1}`
    if (!isStr(t?.id)) errors.push(`${n}: missing id.`)
    if (!personIds.has(t?.personId)) errors.push(`${n}: belongs to an unknown person.`)
    if (!isFils(t?.amountInFils)) errors.push(`${n}: invalid amount.`)
    if (t?.direction !== 'given' && t?.direction !== 'received') errors.push(`${n}: invalid direction.`)
    if (!['given', 'received', 'settlement'].includes(t?.type)) errors.push(`${n}: invalid type.`)
    if (!isValidISODate(t?.date)) errors.push(`${n}: invalid date.`)
  })
  const ids = [...people, ...transactions].map((r) => r?.id)
  if (new Set(ids).size !== ids.length) errors.push('The backup contains duplicate record ids.')
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) }

  const dates = transactions.map((r) => r.date).sort()
  const data: BackupData = { app: 'MY LEDGER', format: o.format as number, exportedAt: isStr(o.exportedAt) ? o.exportedAt : '', people, transactions }
  return {
    ok: true,
    errors: [],
    data,
    summary: { exportedAt: data.exportedAt, people: people.length, transactions: transactions.length, earliest: dates[0], latest: dates[dates.length - 1] },
  }
}

export function parseBackupText(text: string): ValidationResult {
  try {
    return validateBackup(JSON.parse(text))
  } catch {
    return { ok: false, errors: ['The file could not be read. Is it a .json backup?'] }
  }
}

// ---------- Restore ----------

export interface RestoreResult {
  added: number
  updated: number
  skipped: number
}

const stamp = <T extends { updatedAt?: string; createdAt?: string }>(r: T) => r.updatedAt ?? r.createdAt ?? ''

/**
 * replace: everything currently in the app is removed and the backup is loaded (snapshot taken first).
 * merge:   adds missing records; for the same id the newer edit wins. Never duplicates.
 */
export async function restoreBackup(data: BackupData, mode: 'replace' | 'merge'): Promise<RestoreResult> {
  await takeSnapshot(mode === 'replace' ? 'Before restore (replace)' : 'Before restore (merge)', true)
  const result: RestoreResult = { added: 0, updated: 0, skipped: 0 }
  const ts = nowISO()

  await db.transaction('rw', [db.people, db.transactions, db.outbox], async () => {
    if (mode === 'replace') {
      const keepP = new Set(data.people.map((p) => p.id))
      const keepT = new Set(data.transactions.map((t) => t.id))
      const goneP = (await db.people.filter(alive).toArray()).filter((p) => !keepP.has(p.id))
      const goneT = (await db.transactions.filter(alive).toArray()).filter((t) => !keepT.has(t.id))
      await db.people.bulkPut(goneP.map((p) => ({ ...p, deletedAt: ts, updatedAt: ts })))
      await db.transactions.bulkPut(goneT.map((t) => ({ ...t, deletedAt: ts, updatedAt: ts })))
      // Restored records get a fresh timestamp so they win over older copies on other devices.
      await db.people.bulkPut(data.people.map((p) => ({ ...p, deletedAt: null, updatedAt: ts })))
      await db.transactions.bulkPut(data.transactions.map((t) => ({ ...t, deletedAt: null, updatedAt: ts })))
      await queue('people', [...goneP.map((p) => p.id), ...data.people.map((p) => p.id)])
      await queue('transactions', [...goneT.map((t) => t.id), ...data.transactions.map((t) => t.id)])
      result.added = data.people.length + data.transactions.length
      return
    }
    for (const [table, rows] of [
      ['people', data.people],
      ['transactions', data.transactions],
    ] as const) {
      const tbl = table === 'people' ? db.people : db.transactions
      const changed: string[] = []
      for (const row of rows as (Person | Transaction)[]) {
        const existing = await tbl.get(row.id)
        if (!existing) result.added++
        else if (stamp(row) > stamp(existing)) result.updated++
        else {
          result.skipped++
          continue
        }
        await (tbl as typeof db.people).put(row as Person)
        changed.push(row.id)
      }
      await queue(table, changed)
    }
  })
  return result
}

// ---------- Safety snapshots (kept inside the app) ----------

export async function takeSnapshot(reason: string, force = false): Promise<Snapshot | null> {
  const data = await buildBackup()
  const counts = { people: data.people.length, transactions: data.transactions.length }
  if (counts.people + counts.transactions === 0) return null
  const json = JSON.stringify(data)
  const last = await db.snapshots.orderBy('createdAt').last()
  if (!force && last) {
    if ((Date.now() - new Date(last.createdAt).getTime()) / 3_600_000 < 24) return null
    if (strip(last.json) === strip(json)) return null
  }
  const snap: Snapshot = { id: newId(), createdAt: nowISO(), reason, counts, json }
  await db.snapshots.add(snap)
  const all = await db.snapshots.orderBy('createdAt').toArray()
  if (all.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(all.slice(0, all.length - MAX_SNAPSHOTS).map((s) => s.id))
  return snap
}

const strip = (json: string) => json.replace(/"exportedAt":"[^"]*"/, '')

/**
 * signedIn = true: removes everything here AND from the cloud copy (deletions sync).
 * signedIn = false: wipes this device completely; a cloud copy (if any) is untouched.
 * A safety snapshot is kept on this device either way.
 */
export async function clearAllData(signedIn: boolean) {
  await takeSnapshot('Before "Clear all data"', true)
  if (!signedIn) {
    await db.transaction('rw', [db.people, db.transactions, db.outbox], async () => {
      await Promise.all([db.people.clear(), db.transactions.clear(), db.outbox.clear()])
    })
    return
  }
  const ts = nowISO()
  await db.transaction('rw', [db.people, db.transactions, db.outbox], async () => {
    const p = await db.people.filter(alive).toArray()
    const t = await db.transactions.filter(alive).toArray()
    await db.people.bulkPut(p.map((r) => ({ ...r, deletedAt: ts, updatedAt: ts })))
    await db.transactions.bulkPut(t.map((r) => ({ ...r, deletedAt: ts, updatedAt: ts })))
    await queue('people', p.map((r) => r.id))
    await queue('transactions', t.map((r) => r.id))
  })
}
