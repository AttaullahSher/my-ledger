import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Database,
  Download,
  FileSpreadsheet,
  History,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Palette,
  RefreshCw,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useApp } from '../components/AppContext'
import { useDangerGuard } from '../components/PinGuard'
import { useFileShare } from '../components/useFileShare'
import { useSync } from '../components/useSync'
import { BrandingSheet } from '../components/Welcome'
import { Button, Field, Segmented, Sheet, cx, inputCls } from '../components/ui'
import { backupFileName, buildBackup, clearAllData, parseBackupText, restoreBackup, takeSnapshot, type ValidationResult } from '../lib/backup'
import { alive, db } from '../lib/db'
import { daysSince, formatDate, formatDateTime } from '../lib/dates'
import { fullCSVs, fullXLSX } from '../lib/exporters'
import * as repo from '../lib/repo'
import { biometricsAvailable, registerBiometrics, verifyBiometrics } from '../lib/security'
import { downloadFile, shareText } from '../lib/share'
import { flush, forgetSyncAccount, resetPassword, signIn, signOutSync } from '../lib/sync'
import { CURRENCIES, type DateFormat, type Snapshot, type ThemeSetting } from '../lib/types'

const APP_VERSION = '2.0.0'

export function SettingsPage() {
  const nav = useNavigate()
  const { settings, toast } = useApp()
  const guard = useDangerGuard()
  const sync = useSync()
  const { share, busy, sheet } = useFileShare()
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ValidationResult | null>(null)
  const [showSnaps, setShowSnaps] = useState(false)
  const [branding, setBranding] = useState(false)
  const [pinSheet, setPinSheet] = useState(false)
  const [bio, setBio] = useState(false)
  const [storage, setStorage] = useState<{ used?: number; persisted?: boolean }>({})
  const counts = useLiveQuery(async () => ({ people: await db.people.filter(alive).count(), txs: await db.transactions.filter(alive).count() }), [])
  const o = { currency: settings.currency, dateFormat: settings.dateFormat, title: settings.appTitle, owner: settings.ownerName, accent: settings.accent }

  useEffect(() => {
    const anchor = location.hash.split('#').pop()
    if (anchor && anchor !== '/settings') setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 100)
    refreshStorage()
    biometricsAvailable().then(setBio)
  }, [])

  async function refreshStorage() {
    const est = await navigator.storage?.estimate?.().catch(() => undefined)
    const persisted = await navigator.storage?.persisted?.().catch(() => undefined)
    setStorage({ used: est?.usage, persisted })
  }

  const backupNow = () =>
    share(
      'backup',
      async () => [new File([JSON.stringify(await buildBackup(), null, 2)], backupFileName(), { type: 'application/json' })],
      'Ledger backup',
      async () => {
        await repo.saveSettings({ lastBackupAt: new Date().toISOString() })
        toast('Backup ready — save it to Files / iCloud Drive')
      },
    )

  async function doRestore(mode: 'replace' | 'merge') {
    if (!preview?.data) return
    if (
      mode === 'replace' &&
      !(await guard({
        title: 'Replace all current data?',
        message: 'Everything in the app (and in auto-sync) is replaced by this backup. A safety snapshot is saved first so you can undo it.',
        confirmText: 'Replace',
      }))
    )
      return
    try {
      const r = await restoreBackup(preview.data, mode)
      setPreview(null)
      toast(mode === 'replace' ? 'Backup restored' : `Merged: ${r.added} added, ${r.updated} updated`)
    } catch (e) {
      console.error(e)
      toast('Restore failed. Your data was not changed.', 'error')
    }
  }

  async function clearEverything() {
    const signedIn = !!sync.email
    const ok = await guard({
      title: 'Clear all data?',
      message: (
        <>
          Deletes <b>all people and entries</b>
          {signedIn ? <> on this phone <b>and in your auto-sync account</b></> : ' on this phone'}. Make a backup first. A safety snapshot is kept on this phone.
        </>
      ),
      confirmText: 'Delete everything',
      typeWord: 'DELETE',
    })
    if (!ok) return
    await clearAllData(signedIn)
    if (!signedIn) forgetSyncAccount()
    toast('All data cleared')
  }

  async function toggleLock(on: boolean) {
    if (on && !settings.pinHash) return setPinSheet(true)
    await repo.saveSettings({ lockOnOpen: on })
    toast(on ? 'App lock on' : 'App lock off')
  }

  async function toggleFaceId(on: boolean) {
    if (!on) {
      await repo.saveSettings({ faceIdCredId: null })
      return toast('Face ID off')
    }
    try {
      const id = await registerBiometrics(settings.ownerName || 'My Ledger')
      await repo.saveSettings({ faceIdCredId: id })
      toast('Face ID on')
    } catch {
      toast('Face ID was not set up', 'error')
    }
  }

  async function shareApp() {
    const url = location.origin + location.pathname
    const text = `A simple private money ledger for your phone — who owes whom. Open in Safari, tap Share → “Add to Home Screen”. Your records stay private to you.\n${url}`
    if ((await shareText(text, 'My Ledger')) === 'downloaded') toast('Link copied')
  }

  const days = daysSince(settings.lastBackupAt)
  const total = (counts?.people ?? 0) + (counts?.txs ?? 0)

  return (
    <>
      <header className="pt-safe sticky top-0 z-20 bg-slate-50/85 backdrop-blur-xl dark:bg-black/80">
        <div className="mx-auto flex max-w-2xl items-center px-2 py-1.5">
          <button type="button" onClick={() => nav('/')} className="flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 font-medium text-blue-600 active:bg-slate-200 dark:text-blue-400 dark:active:bg-slate-800">
            <ChevronLeft size={26} /> Back
          </button>
        </div>
        <h1 className="mx-auto max-w-2xl px-4 pb-2 text-[28px] font-bold tracking-tight">Settings</h1>
      </header>
      <div className="mx-auto max-w-2xl space-y-1 px-4">
        <Group>
          <Row icon={<Palette size={20} />} title="Name & branding" sub={`${settings.ownerName || 'Your name'} · ${settings.appTitle || 'MY LEDGER'}`} onClick={() => setBranding(true)} chevron />
        </Group>

        {/* ---------- Auto-sync ---------- */}
        <Title id="sync">Auto-sync</Title>
        <SyncCard />

        {/* ---------- Security ---------- */}
        <Title>Security</Title>
        <Group>
          <Row icon={<KeyRound size={20} />} title={settings.pinHash ? 'Change PIN' : 'Set a PIN'} sub="Protects the danger zone and app lock" onClick={() => setPinSheet(true)} chevron />
          <Toggle icon={<Lock size={20} />} title="Lock app when opened" sub="Asks for Face ID or PIN" on={!!settings.lockOnOpen && !!settings.pinHash} onChange={toggleLock} />
          {bio && <Toggle icon={<ScanFace size={20} />} title="Use Face ID" sub="Unlock with Face ID / Touch ID" on={!!settings.faceIdCredId} onChange={toggleFaceId} />}
        </Group>

        {/* ---------- Backup ---------- */}
        <Title id="backup">Backup & restore</Title>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10">
          <div className={cx('flex items-start gap-3 rounded-xl p-3 text-sm', total && days >= settings.backupReminder && sync.status !== 'synced' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200' : 'bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-200')}>
            <ShieldCheck size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">{settings.lastBackupAt ? `Last backup file: ${formatDateTime(settings.lastBackupAt, settings.dateFormat)}` : 'No backup file saved yet'}</div>
              A backup file in <b>Files → iCloud Drive</b> is your extra copy{sync.status === 'synced' ? ', on top of auto-sync' : ''}.
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={backupNow} disabled={!!busy}>
              <CloudUpload size={18} /> {busy === 'backup' ? 'Preparing…' : 'Back up now'}
            </Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload size={18} /> Restore
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setPreview(parseBackupText(await f.text()))
            }}
          />
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <div>
              <div className="font-medium">Backup reminder</div>
              <div className="text-slate-500">Shown on the main screen</div>
            </div>
            <select className="rounded-lg bg-slate-100 px-3 py-2 font-medium dark:bg-slate-800" value={settings.backupReminder} onChange={(e) => repo.saveSettings({ backupReminder: Number(e.target.value) })}>
              <option value={1}>Daily</option>
              <option value={3}>Every 3 days</option>
              <option value={7}>Weekly</option>
              <option value={30}>Monthly</option>
              <option value={0}>Never</option>
            </select>
          </div>
        </div>
        <Group>
          <Row icon={<History size={20} />} title="Safety snapshots" sub="Automatic daily copies on this phone (undo mistakes)" onClick={() => setShowSnaps(true)} chevron />
          <Row icon={<FileSpreadsheet size={20} className="text-emerald-700" />} title={busy === 'xlsx' ? 'Preparing…' : 'Export Excel workbook'} sub="People, all entries, balances, summary" onClick={() => share('xlsx', async () => [await fullXLSX(await buildBackup(), o)], 'Ledger export')} />
          <Row icon={<FileSpreadsheet size={20} />} title={busy === 'csv' ? 'Preparing…' : 'Export CSV files'} sub="People and entries" onClick={() => share('csv', async () => fullCSVs(await buildBackup(), o), 'Ledger CSV')} />
        </Group>

        {/* ---------- Preferences ---------- */}
        <Title>Preferences</Title>
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10">
          <Segmented<ThemeSetting>
            value={settings.theme}
            onChange={(v) => repo.saveSettings({ theme: v })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <select className="w-full rounded-xl bg-slate-100 px-3 py-3 font-medium dark:bg-slate-800" value={settings.currency} onChange={(e) => repo.saveSettings({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Date format">
              <select className="w-full rounded-xl bg-slate-100 px-3 py-3 font-medium dark:bg-slate-800" value={settings.dateFormat} onChange={(e) => repo.saveSettings({ dateFormat: e.target.value as DateFormat })}>
                {(['D MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as DateFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {formatDate('2026-11-03', f)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <Title>Share with family & friends</Title>
        <Group>
          <Row icon={<Link2 size={20} />} title="Share app link" sub="Everyone gets their own private ledger" onClick={shareApp} />
        </Group>

        <Title>Storage</Title>
        <div className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10">
          <div className="flex items-center gap-3">
            <Database size={20} className="text-slate-500" />
            <div>
              <div className="font-medium">
                {counts?.people ?? 0} people · {counts?.txs ?? 0} entries
              </div>
              <div className="text-slate-500">
                On this phone{storage.used !== undefined ? ` · ${(storage.used / 1024 / 1024).toFixed(1)} MB` : ''}
                {storage.persisted ? ' · protected ✓' : ''}
              </div>
            </div>
          </div>
          {storage.persisted === false && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                const ok = await navigator.storage?.persist?.()
                await refreshStorage()
                toast(ok ? 'Storage protected' : 'Add the app to your Home Screen for best protection')
              }}
            >
              <ShieldCheck size={18} /> Protect storage
            </Button>
          )}
          <p className="text-slate-500">No ads, no tracking. Records leave this phone only through your own auto-sync account, or when you share or back up.</p>
        </div>

        <Title>Danger zone</Title>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-red-200 dark:bg-slate-900 dark:ring-red-900">
          <Button variant="secondary" className="w-full text-red-600 dark:text-red-400" onClick={clearEverything} disabled={!total}>
            <Trash2 size={18} /> Clear all data
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">Protected by confirmation + PIN</p>
        </div>

        <p className="py-6 text-center text-xs text-slate-400">
          {settings.appTitle || 'MY LEDGER'} · v{APP_VERSION}
          <br />
          Made by Attaullah Sher
        </p>
      </div>

      <BrandingSheet open={branding} onClose={() => setBranding(false)} />
      <PinSheet open={pinSheet} onClose={() => setPinSheet(false)} />
      <RestorePreview result={preview} onClose={() => setPreview(null)} onRestore={doRestore} />
      <SnapshotsSheet open={showSnaps} onClose={() => setShowSnaps(false)} onPreview={(r) => { setShowSnaps(false); setPreview(r) }} />
      {sheet}
    </>
  )
}

// ---------- building blocks ----------

function Title({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="scroll-mt-28 px-1 pb-2 pt-5 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 dark:divide-slate-800 dark:bg-slate-900 dark:ring-white/10">{children}</div>
}

function Row({ icon, title, sub, onClick, chevron }: { icon: ReactNode; title: string; sub?: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {sub && <span className="block truncate text-[13px] text-slate-500">{sub}</span>}
      </span>
      {chevron && <ChevronRight size={18} className="text-slate-300" />}
    </button>
  )
}

function Toggle({ icon, title, sub, on, onChange }: { icon: ReactNode; title: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {sub && <span className="block text-[13px] text-slate-500">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={cx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', on ? 'bg-pos' : 'bg-slate-300 dark:bg-slate-700')}
      >
        <span className={cx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-[2px]')} />
      </button>
    </label>
  )
}

// ---------- Auto-sync card ----------

function SyncCard() {
  const s = useSync()
  const { toast, settings } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [create, setCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const card = 'rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10'

  if (s.status === 'off')
    return (
      <div className={card}>
        <div className="font-semibold">Not available yet</div>
        <p className="mt-1 text-slate-500">Auto-sync will appear here once it is switched on for this app. Meanwhile use “Back up now” regularly.</p>
      </div>
    )

  if (s.email)
    return (
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className={cx('h-2.5 w-2.5 rounded-full', s.status === 'synced' ? 'bg-pos' : s.status === 'error' ? 'bg-neg' : 'bg-amber-500')} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {s.status === 'synced' ? 'All changes saved to your account' : s.status === 'syncing' ? 'Syncing…' : s.status === 'offline' ? `Offline — ${s.pending} change(s) waiting` : 'Sync problem'}
            </div>
            <div className="truncate text-slate-500">
              {s.email}
              {s.lastSyncAt ? ` · ${formatDateTime(s.lastSyncAt, settings.dateFormat)}` : ''}
            </div>
          </div>
        </div>
        {s.error && s.status === 'error' && <p className="mt-2 text-red-600">{s.error}</p>}
        <p className="mt-3 text-slate-500">Every change is saved automatically. On a new phone, install the app and sign in with the same email to get everything back.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => flush()}>
            <RefreshCw size={17} /> Sync now
          </Button>
          <Button variant="secondary" onClick={() => signOutSync().then(() => toast('Signed out — records stay on this phone'))}>
            <LogOut size={17} /> Sign out
          </Button>
        </div>
      </div>
    )

  async function go() {
    setBusy(true)
    setError('')
    try {
      await signIn(email, password, create)
      setPassword('')
      toast(create ? 'Account created — auto-sync is on' : 'Signed in — syncing')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={card}>
      <div className="font-semibold">Never lose your records</div>
      <p className="mt-1 text-slate-500">Create a free private account with your email. Every change is saved automatically and restored on any new phone. Only you can see your records.</p>
      {s.error && <p className="mt-2 text-red-600">{s.error}</p>}
      <div className="mt-3 space-y-2">
        <input className={inputCls} type="email" inputMode="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" autoComplete={create ? 'new-password' : 'current-password'} placeholder={create ? 'Choose a password (6+ characters)' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        {error && <p className="text-red-600">{error}</p>}
        <Button className="w-full" disabled={busy || !email || !password} onClick={go}>
          {busy ? 'Please wait…' : create ? 'Create account & turn on sync' : 'Sign in & sync'}
        </Button>
        <div className="flex justify-between pt-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400">
          <button type="button" onClick={() => setCreate((v) => !v)}>
            {create ? 'I already have an account' : 'Create a new account'}
          </button>
          {!create && (
            <button
              type="button"
              onClick={async () => {
                if (!email) return setError('Enter your email first.')
                try {
                  await resetPassword(email)
                  toast('Password reset email sent')
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- PIN ----------

function PinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, toast } = useApp()
  const [current, setCurrent] = useState('')
  const [verified, setVerified] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const hasPin = !!settings.pinHash

  useEffect(() => {
    if (open) {
      setCurrent('')
      setPin('')
      setPin2('')
      setError('')
      setVerified(false)
    }
  }, [open])

  const field = (v: string, set: (s: string) => void, ph: string) => (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      placeholder={ph}
      aria-label={ph}
      value={v}
      onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      className="w-full rounded-xl bg-slate-100 px-4 py-3.5 text-center text-xl tracking-[0.4em] placeholder:text-base placeholder:tracking-normal dark:bg-slate-800"
    />
  )

  async function save() {
    setError('')
    if (hasPin && !verified && !(await repo.checkPin(current))) return setError('Current PIN is wrong.')
    try {
      if (pin !== pin2) throw new Error('The two new PINs do not match.')
      await repo.setPin(pin)
      toast('PIN saved')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove() {
    if (!verified && !(await repo.checkPin(current))) return setError('Enter your current PIN to remove it.')
    await repo.saveSettings({ pinHash: null, pinSalt: null, lockOnOpen: false })
    toast('PIN removed')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={hasPin ? 'Change PIN' : 'Set a PIN'} footer={<Button className="w-full" onClick={save}>Save PIN</Button>}>
      <div className="space-y-3 pb-2">
        <p className="text-sm text-slate-500">4 to 6 digits. Used to unlock the app and to confirm dangerous actions.</p>
        {hasPin && !verified && (
          <div className="flex gap-2">
            <div className="flex-1">{field(current, setCurrent, 'Current PIN')}</div>
            {settings.faceIdCredId && (
              <Button variant="secondary" aria-label="Verify with Face ID" onClick={async () => setVerified(await verifyBiometrics(settings.faceIdCredId!))}>
                <ScanFace size={20} />
              </Button>
            )}
          </div>
        )}
        {verified && <p className="text-sm font-medium text-pos">Verified with Face ID ✓</p>}
        {field(pin, setPin, 'New PIN')}
        {field(pin2, setPin2, 'Repeat new PIN')}
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        {hasPin && (
          <button type="button" onClick={remove} className="w-full py-2 text-sm font-semibold text-red-600">
            Remove PIN
          </button>
        )}
      </div>
    </Sheet>
  )
}

// ---------- Restore & snapshots ----------

function RestorePreview({ result, onClose, onRestore }: { result: ValidationResult | null; onClose: () => void; onRestore: (m: 'replace' | 'merge') => void }) {
  const { settings } = useApp()
  const s = result?.summary
  return (
    <Sheet open={!!result} onClose={onClose} title={result?.ok ? 'Restore backup' : 'Cannot restore'}>
      {result && !result.ok && (
        <div className="space-y-2 pb-3 text-sm">
          <p className="text-red-600">This file can’t be restored. Your current data was not changed.</p>
          <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && s && (
        <div className="space-y-3 pb-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              ['People', s.people],
              ['Entries', s.transactions],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-100 py-3 dark:bg-slate-800">
                <div className="text-xl font-bold">{v}</div>
                <div className="text-xs text-slate-500">{k}</div>
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-500">
            {s.exportedAt && <>Backup made {formatDateTime(s.exportedAt, settings.dateFormat)}. </>}
            {s.earliest && <>Entries from {formatDate(s.earliest, settings.dateFormat)} to {formatDate(s.latest!, settings.dateFormat)}.</>}
          </div>
          <Button className="w-full" onClick={() => onRestore('merge')}>
            Merge with current data
          </Button>
          <p className="-mt-1 text-xs text-slate-500">Adds what’s missing, keeps the newest version of edited records. No duplicates.</p>
          <Button variant="danger" className="w-full" onClick={() => onRestore('replace')}>
            <RotateCcw size={18} /> Replace all current data
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function SnapshotsSheet({ open, onClose, onPreview }: { open: boolean; onClose: () => void; onPreview: (r: ValidationResult) => void }) {
  const { settings, toast } = useApp()
  const snaps = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []) ?? []
  const download = (s: Snapshot) => {
    const name = `my-ledger-snapshot-${s.createdAt.slice(0, 10)}.json`
    downloadFile(new File([s.json], name, { type: 'application/json' }), name)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Safety snapshots">
      <div className="space-y-3 pb-3">
        <p className="text-sm text-slate-500">Up to 14 automatic copies (one per day of use, and before any restore or “clear all”). They live on this phone only.</p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => toast((await takeSnapshot('Manual snapshot', true)) ? 'Snapshot saved' : 'Nothing to save yet')}
        >
          <History size={18} /> Take snapshot now
        </Button>
        {snaps.length === 0 && <div className="py-6 text-center text-sm text-slate-500">No snapshots yet.</div>}
        {snaps.map((s) => (
          <div key={s.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <div className="text-sm">
              <div className="font-semibold">{formatDateTime(s.createdAt, settings.dateFormat)}</div>
              <div className="text-slate-500">
                {s.reason} · {s.counts.people} people · {s.counts.transactions} entries
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="min-h-10 bg-white text-sm dark:bg-slate-700" onClick={() => onPreview(parseBackupText(s.json))}>
                <RotateCcw size={16} /> Restore
              </Button>
              <Button variant="secondary" className="min-h-10 bg-white text-sm dark:bg-slate-700" onClick={() => download(s)}>
                <Download size={16} /> Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
