// Cloud auto-sync. The phone's database stays the main copy; every change is queued in the
// "outbox" and uploaded to the user's own private Firestore area (users/{uid}/...).
// Changes from other devices stream back in. For the same record the newest edit wins.
import { liveQuery } from 'dexie'
import { firebaseConfig } from '../config/firebase'
import { db } from './db'
import { PROFILE_KEYS, type Person, type Settings, type Transaction } from './types'
import { getSettings, saveSettings } from './repo'

export type SyncStatus = 'off' | 'starting' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  email?: string
  pending: number
  lastSyncAt?: string
  error?: string
}

let state: SyncState = { status: firebaseConfig ? 'starting' : 'off', pending: 0 }
const listeners = new Set<() => void>()
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const getSyncState = () => state
export const subscribeSync = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const syncAvailable = () => !!firebaseConfig

// ---- Firebase (loaded only when configured) ----

type FB = Awaited<ReturnType<typeof loadFirebase>>
let fb: FB | null = null
let stopFns: (() => void)[] = []
let uid: string | null = null
let flushing = false
let again = false

async function loadFirebase() {
  const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
  const app = initializeApp(firebaseConfig!)
  const a = auth.getAuth(app)
  const store = fs.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: fs.memoryLocalCache() })
  return { auth, fs, a, store }
}

const LAST_UID = 'myledger.syncUid'
const SEEDED = 'myledger.seeded.'

export async function initSync() {
  if (!firebaseConfig || fb) return
  try {
    fb = await loadFirebase()
  } catch (e) {
    set({ status: 'error', error: 'Could not start cloud sync.' })
    console.warn(e)
    return
  }
  fb.auth.onAuthStateChanged(fb.a, (user) => {
    if (user) start(user.uid, user.email ?? undefined)
    else stop('signed-out')
  })
  window.addEventListener('online', () => flush())
  window.addEventListener('offline', () => uid && set({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && flush())
}

function stop(status: SyncStatus) {
  stopFns.forEach((f) => f())
  stopFns = []
  uid = null
  set({ status, email: undefined })
}

async function start(userId: string, email?: string) {
  const prev = localStorage.getItem(LAST_UID)
  const hasLocal = (await db.people.count()) + (await db.transactions.count()) > 0
  if (prev && prev !== userId && hasLocal) {
    // Never mix one account's records into another account.
    await fb!.auth.signOut(fb!.a)
    set({ status: 'error', error: 'This phone holds another account’s ledger. Use Settings → Clear all data before signing in with a different account.' })
    return
  }
  localStorage.setItem(LAST_UID, userId)
  uid = userId
  set({ status: navigator.onLine ? 'syncing' : 'offline', email, error: undefined })

  // First sign-in on this device: upload everything already here (merges with the cloud copy).
  if (!localStorage.getItem(SEEDED + userId)) {
    const t = new Date().toISOString()
    const [p, tx] = await Promise.all([db.people.toCollection().primaryKeys(), db.transactions.toCollection().primaryKeys()])
    await db.outbox.bulkPut([
      ...p.map((id) => ({ key: `people:${id}`, table: 'people' as const, id: String(id), queuedAt: t })),
      ...tx.map((id) => ({ key: `transactions:${id}`, table: 'transactions' as const, id: String(id), queuedAt: t })),
    ])
    localStorage.setItem(SEEDED + userId, '1')
  }

  const { fs, store } = fb!
  for (const table of ['people', 'transactions'] as const) {
    const unsub = fs.onSnapshot(
      fs.collection(store, 'users', userId, table),
      (snap) => {
        const incoming = snap
          .docChanges()
          .filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites)
          .map((c) => c.doc.data() as Person | Transaction)
        if (incoming.length) applyRemote(table, incoming)
        if (!snap.metadata.hasPendingWrites && state.pending === 0) set({ status: 'synced', lastSyncAt: new Date().toISOString() })
      },
      (err) => set({ status: 'error', error: err.message }),
    )
    stopFns.push(unsub)
  }

  // Name / branding / currency follow the account to every phone.
  const profileRef = fs.doc(store, 'users', userId, 'meta', 'profile')
  stopFns.push(
    fs.onSnapshot(profileRef, async (snap) => {
      if (snap.metadata.hasPendingWrites) return
      const remote = snap.data() as (Partial<Settings> & { updatedAt?: string }) | undefined
      const local = await getSettings()
      if (remote?.updatedAt && remote.updatedAt > (local.profileUpdatedAt ?? '')) {
        const patch: Partial<Settings> = { profileUpdatedAt: remote.updatedAt, onboarded: true }
        for (const k of PROFILE_KEYS) if (remote[k] !== undefined) (patch as Record<string, unknown>)[k] = remote[k]
        await saveSettings(patch, true)
      } else if (local.profileUpdatedAt && local.profileUpdatedAt > (remote?.updatedAt ?? '')) pushProfile()
    }),
  )
  const profSub = liveQuery(() => db.settings.get('app')).subscribe((row) => {
    if (row?.profileUpdatedAt && row.profileUpdatedAt !== lastProfilePush) pushProfile()
  })
  stopFns.push(() => profSub.unsubscribe())

  // Upload whenever the outbox changes.
  let timer: number | undefined
  const sub = liveQuery(() => db.outbox.count()).subscribe((n) => {
    set({ pending: n })
    window.clearTimeout(timer)
    if (n > 0) timer = window.setTimeout(flush, 600)
  })
  stopFns.push(() => sub.unsubscribe())
}

let lastProfilePush = ''
async function pushProfile() {
  if (!fb || !uid) return
  const local = await getSettings()
  if (!local.profileUpdatedAt || local.profileUpdatedAt === lastProfilePush) return
  lastProfilePush = local.profileUpdatedAt
  const data: Record<string, unknown> = { updatedAt: local.profileUpdatedAt }
  for (const k of PROFILE_KEYS) data[k] = local[k] ?? null
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.store, 'users', uid, 'meta', 'profile'), data)
  } catch (e) {
    lastProfilePush = ''
    console.warn('Profile sync failed', e)
  }
}

/** Writes remote records locally when they are newer. Does not queue them again. */
async function applyRemote(table: 'people' | 'transactions', rows: (Person | Transaction)[]) {
  const tbl = table === 'people' ? db.people : db.transactions
  await db.transaction('rw', tbl, async () => {
    const local = await tbl.bulkGet(rows.map((r) => r.id))
    const newer = rows.filter((r, i) => !local[i] || (r.updatedAt ?? '') > (local[i]!.updatedAt ?? ''))
    if (newer.length) await (tbl as typeof db.people).bulkPut(newer as Person[])
  })
}

export async function flush() {
  if (!fb || !uid || !navigator.onLine) return
  if (flushing) {
    again = true
    return
  }
  flushing = true
  try {
    do {
      again = false
      const items = await db.outbox.orderBy('queuedAt').limit(400).toArray()
      if (!items.length) break
      set({ status: 'syncing' })
      const batch = fb.fs.writeBatch(fb.store)
      for (const it of items) {
        const rec = await (it.table === 'people' ? db.people.get(it.id) : db.transactions.get(it.id))
        if (rec) batch.set(fb.fs.doc(fb.store, 'users', uid, it.table, it.id), rec)
      }
      await batch.commit()
      // Remove only items that weren't changed again while uploading.
      await db.transaction('rw', db.outbox, async () => {
        const now = await db.outbox.bulkGet(items.map((i) => i.key))
        await db.outbox.bulkDelete(items.filter((i, k) => now[k]?.queuedAt === i.queuedAt).map((i) => i.key))
      })
      if (items.length === 400) again = true
    } while (again)
    set({ status: 'synced', lastSyncAt: new Date().toISOString(), error: undefined })
  } catch (e) {
    console.warn('Sync upload failed', e)
    set({ status: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
  } finally {
    flushing = false
  }
}

// ---- Account actions ----

/** Error with the Firebase code kept, so the screen can react (e.g. offer "create account"). */
export class SyncAuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address is not valid.',
    'auth/missing-password': 'Please enter a password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/email-already-in-use': 'An account with this email already exists — sign in instead.',
    'auth/invalid-credential': 'Email or password not recognised.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with this email — create one.',
    'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
    'auth/network-request-failed': 'No internet connection.',
  }
  return map[code] ?? 'Something went wrong. Please try again.'
}

export async function signIn(email: string, password: string, create: boolean) {
  if (!fb) await initSync()
  if (!fb) throw new Error('Cloud sync is not available.')
  try {
    if (create) await fb.auth.createUserWithEmailAndPassword(fb.a, email.trim(), password)
    else await fb.auth.signInWithEmailAndPassword(fb.a, email.trim(), password)
  } catch (e) {
    throw new SyncAuthError((e as { code?: string })?.code ?? '', friendly(e))
  }
}

export async function resetPassword(email: string) {
  if (!fb) throw new Error('Cloud sync is not available.')
  try {
    await fb.auth.sendPasswordResetEmail(fb.a, email.trim())
  } catch (e) {
    throw new Error(friendly(e))
  }
}

export async function signOutSync() {
  if (fb) await fb.auth.signOut(fb.a)
}

/** After "Clear all data" the phone may be used with a different account. */
export function forgetSyncAccount() {
  const prev = localStorage.getItem(LAST_UID)
  localStorage.removeItem(LAST_UID)
  if (prev) localStorage.removeItem(SEEDED + prev)
}
