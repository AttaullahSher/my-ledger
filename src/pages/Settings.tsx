import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, KeyRound, Lock, Palette, ScanFace, Trash2 } from 'lucide-react'
import { useApp } from '../components/AppContext'
import { useDangerGuard } from '../components/PinGuard'
import { SyncCard } from '../components/SyncCard'
import { useFileShare } from '../components/useFileShare'
import { useSync } from '../components/useSync'
import { BrandingSheet } from '../components/Welcome'
import { Button, Chip, Segmented, Sheet, cx } from '../components/ui'
import { allData, clearAllData } from '../lib/backup'
import { alive, db } from '../lib/db'
import { allDataXLSX } from '../lib/exporters'
import * as repo from '../lib/repo'
import { biometricsAvailable, registerBiometrics, verifyBiometrics } from '../lib/security'
import { forgetSyncAccount } from '../lib/sync'
import { CURRENCIES, type ThemeSetting } from '../lib/types'

const APP_VERSION = '2.1.0'

export function SettingsPage() {
  const nav = useNavigate()
  const { settings, toast } = useApp()
  const guard = useDangerGuard()
  const sync = useSync()
  const { share, busy, sheet } = useFileShare()
  const [branding, setBranding] = useState(false)
  const [pinSheet, setPinSheet] = useState(false)
  const [bio, setBio] = useState(false)
  const counts = useLiveQuery(async () => ({ people: await db.people.filter(alive).count(), txs: await db.transactions.filter(alive).count() }), [])

  useEffect(() => {
    const anchor = location.hash.split('#').pop()
    if (anchor && anchor !== '/settings') setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 100)
    biometricsAvailable().then(setBio)
  }, [])

  async function clearEverything() {
    const signedIn = !!sync.email
    const ok = await guard({
      title: 'Clear all data?',
      message: (
        <>
          Deletes <b>all people and entries</b>
          {signedIn ? (
            <>
              {' '}
              on this phone <b>and in your account</b>
            </>
          ) : (
            ' on this phone'
          )}
          . This cannot be undone.
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

        <Title id="sync">Account & sync</Title>
        <SyncCard />

        <Title>Security</Title>
        <Group>
          <Row icon={<KeyRound size={20} />} title={settings.pinHash ? 'Change PIN' : 'Set a PIN'} sub="Opens the app and protects deleting" onClick={() => setPinSheet(true)} chevron />
          <Toggle icon={<Lock size={20} />} title="Lock app when opened" sub="Asks for Face ID or PIN" on={!!settings.lockOnOpen && !!settings.pinHash} onChange={toggleLock} />
          {bio && <Toggle icon={<ScanFace size={20} />} title="Use Face ID" sub="Unlock with Face ID / Touch ID" on={!!settings.faceIdCredId} onChange={toggleFaceId} />}
        </Group>

        <Title>Preferences</Title>
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-slate-500">Default currency for new entries</div>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <Chip key={c} active={settings.currency === c} onClick={() => repo.saveSettings({ currency: c })}>
                  {c}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">You can still pick AED, PKR or USD on each entry. Balances are kept separately per currency.</p>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-slate-500">Theme</div>
            <Segmented<ThemeSetting>
              value={settings.theme}
              onChange={(v) => repo.saveSettings({ theme: v })}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </div>

        <Title>Danger zone</Title>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-red-200 dark:bg-slate-900 dark:ring-red-900">
          <Button variant="secondary" className="w-full text-red-600 dark:text-red-400" onClick={clearEverything} disabled={!total}>
            <Trash2 size={18} /> Clear all data
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">Protected by confirmation + PIN</p>
        </div>

        <div className="pb-6 pt-8 text-center text-xs text-slate-400">
          <button
            type="button"
            disabled={!total || !!busy}
            onClick={() => share('xlsx', async () => [await allDataXLSX(await allData(), { owner: settings.ownerName })], 'My Ledger data')}
            className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-slate-500 underline-offset-2 hover:underline disabled:opacity-50"
          >
            <Download size={13} /> {busy === 'xlsx' ? 'Preparing…' : 'Download all data (Excel)'}
          </button>
          <div>
            {counts?.people ?? 0} people · {counts?.txs ?? 0} entries
          </div>
          <div>
            {settings.appTitle || 'MY LEDGER'} · v{APP_VERSION} · Made by Attaullah Sher
          </div>
        </div>
      </div>

      <BrandingSheet open={branding} onClose={() => setBranding(false)} />
      <PinSheet open={pinSheet} onClose={() => setPinSheet(false)} />
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
    <div className="flex w-full items-center gap-3 px-4 py-3">
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
      await repo.saveSettings({ lockOnOpen: true })
      toast('PIN saved')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={hasPin ? 'Change PIN' : 'Set a PIN'} footer={<Button className="w-full" onClick={save}>Save PIN</Button>}>
      <div className="space-y-3 pb-2">
        <p className="text-sm text-slate-500">4 to 6 digits. Used to open the app and to confirm deleting.</p>
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
      </div>
    </Sheet>
  )
}
