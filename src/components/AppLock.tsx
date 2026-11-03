import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ScanFace, Lock } from 'lucide-react'
import { clearAllData } from '../lib/backup'
import * as repo from '../lib/repo'
import { verifyBiometrics } from '../lib/security'
import { forgetSyncAccount, getSyncState, signIn, signOutSync } from '../lib/sync'
import { useApp } from './AppContext'
import { Button, Sheet } from './ui'

const RELOCK_AFTER_MS = 60_000

/** Shows a lock screen (Face ID / PIN) when "Lock app" is on. */
export function AppLock({ children }: { children: ReactNode }) {
  const { settings, ready } = useApp()
  const enabled = !!(settings.lockOnOpen && settings.pinHash)
  const [unlocked, setUnlocked] = useState(false)
  const hiddenAt = useRef<number | null>(null)
  const prevEnabled = useRef<boolean | null>(null)

  // Turning the lock on during this session should not lock you out immediately.
  useEffect(() => {
    if (!ready) return
    if (prevEnabled.current === false && enabled) setUnlocked(true)
    prevEnabled.current = enabled
  }, [ready, enabled])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setUnlocked(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!ready) return <div className="min-h-dvh" />
  if (enabled && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />
  return <>{children}</>
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { settings } = useApp()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const tried = useRef(false)

  async function face() {
    if (settings.faceIdCredId && (await verifyBiometrics(settings.faceIdCredId))) onUnlock()
  }

  useEffect(() => {
    if (!tried.current && settings.faceIdCredId) {
      tried.current = true
      face()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(value: string) {
    if (value.length < 4) return
    if (await repo.checkPin(value)) onUnlock()
    else if (value.length >= 6) {
      setError('Wrong PIN')
      setPin('')
    }
  }

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-8 dark:bg-black">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white">
        <Lock size={28} />
      </div>
      <h1 className="text-2xl font-bold">{settings.appTitle || 'MY LEDGER'}</h1>
      <p className="mt-1 text-slate-500">{settings.ownerName ? `Hi ${settings.ownerName}, enter your PIN` : 'Enter your PIN'}</p>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={6}
        aria-label="PIN"
        autoFocus={!settings.faceIdCredId}
        value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '')
          setPin(v)
          setError('')
          submit(v)
        }}
        className="mt-6 w-56 rounded-2xl bg-white px-4 py-4 text-center text-3xl tracking-[0.6em] shadow-sm ring-1 ring-slate-900/10 outline-none dark:bg-slate-900"
      />
      <div className="mt-2 h-5 text-sm font-medium text-red-600">{error}</div>
      <Button variant="secondary" className="mt-2 w-56" onClick={() => submit(pin).then(() => pin.length >= 4 && setError('Wrong PIN'))}>
        Unlock
      </Button>
      {settings.faceIdCredId && (
        <Button variant="ghost" className="mt-2 w-56" onClick={face}>
          <ScanFace size={20} /> Use Face ID
        </Button>
      )}
      <button type="button" className="mt-6 text-sm font-semibold text-blue-600 dark:text-blue-400" onClick={() => setForgot(true)}>
        Forgot PIN?
      </button>
      <ForgotPin open={forgot} onClose={() => setForgot(false)} onReset={onUnlock} />
    </div>
  )
}

/**
 * Forgot PIN options, safest first:
 * 1) Face ID on this phone   2) cloud-sync account password   3) erase this phone (restore from backup/cloud later)
 */
export function ForgotPin({ open, onClose, onReset }: { open: boolean; onClose: () => void; onReset: () => void }) {
  const { settings, toast } = useApp()
  const sync = getSyncState()
  const [password, setPassword] = useState('')
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reset() {
    await repo.saveSettings({ pinHash: null, pinSalt: null, lockOnOpen: false })
    toast('PIN removed — set a new one in Settings')
    onClose()
    onReset()
  }

  async function viaFace() {
    if (settings.faceIdCredId && (await verifyBiometrics(settings.faceIdCredId))) await reset()
    else setError('Face ID did not match.')
  }

  async function viaAccount() {
    setBusy(true)
    setError('')
    try {
      await signIn(sync.email!, password, false)
      await reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function erase() {
    await signOutSync() // the cloud copy needs the account password to come back
    await clearAllData(false)
    forgetSyncAccount()
    await repo.saveSettings({ pinHash: null, pinSalt: null, lockOnOpen: false, faceIdCredId: null })
    toast('This phone was reset')
    onClose()
    onReset()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Forgot PIN">
      <div className="space-y-5 pb-3 text-[15px]">
        {settings.faceIdCredId && (
          <div className="space-y-2">
            <div className="font-semibold">Use Face ID</div>
            <Button className="w-full" onClick={viaFace}>
              <ScanFace size={18} /> Verify with Face ID
            </Button>
          </div>
        )}
        {sync.email && (
          <div className="space-y-2">
            <div className="font-semibold">Use your sync account</div>
            <p className="text-sm text-slate-500">Enter the password for {sync.email}.</p>
            <input
              type="password"
              className="w-full rounded-xl bg-slate-100 px-3.5 py-3 dark:bg-slate-800"
              placeholder="Account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button className="w-full" disabled={busy || !password} onClick={viaAccount}>
              Verify & remove PIN
            </Button>
          </div>
        )}
        <div className="space-y-2 rounded-2xl bg-red-50 p-4 dark:bg-red-950/50">
          <div className="font-semibold text-red-800 dark:text-red-200">Reset this phone</div>
          <p className="text-sm text-red-800/80 dark:text-red-200/80">
            Erases the ledger on this phone and removes the PIN. {sync.email ? 'Your cloud copy is kept — sign in again to get everything back.' : 'Restore afterwards from a backup file in Files / iCloud Drive.'}
          </p>
          <input
            className="w-full rounded-xl bg-white px-3.5 py-3 text-center font-semibold uppercase dark:bg-slate-900"
            placeholder="Type ERASE"
            autoCapitalize="characters"
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
          <Button variant="danger" className="w-full" disabled={word.trim().toUpperCase() !== 'ERASE'} onClick={erase}>
            Erase this phone
          </Button>
        </div>
        {error && <div className="text-center text-sm text-red-600">{error}</div>}
      </div>
    </Sheet>
  )
}
