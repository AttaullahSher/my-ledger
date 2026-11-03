import { useEffect, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { biometricsAvailable, registerBiometrics } from '../lib/security'
import { useSync } from './useSync'
import { saveSettings, setPin as setPinValue } from '../lib/repo'
import { ACCENTS } from '../lib/types'
import { useApp } from './AppContext'
import { Button, Field, Sheet, cx, inputCls } from './ui'

/**
 * First-run setup after signing in:
 * 1) your name, app title and colour (skipped when they come back from your account)
 * 2) a PIN (+ Face ID) that locks the app.
 */
export function Welcome() {
  const { settings, ready } = useApp()
  const sync = useSync()
  // Wait for the first sync so branding saved on another phone can arrive first.
  const settled = sync.status === 'off' || sync.status === 'synced' || sync.status === 'offline'
  if (!ready || !settled) return null
  if (!settings.onboarded) return <BrandingSheet open onClose={() => saveSettings({ onboarded: true })} welcome />
  if (!settings.pinHash) return <PinSetup />
  return null
}

function PinSetup() {
  const { settings, toast } = useApp()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [face, setFace] = useState(false)
  const [bio, setBio] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    biometricsAvailable().then((ok) => {
      setBio(ok)
      setFace(ok)
    })
  }, [])

  async function save() {
    setError('')
    if (!/^\d{4,6}$/.test(pin)) return setError('PIN must be 4 to 6 digits.')
    if (pin !== pin2) return setError('The two PINs do not match.')
    setBusy(true)
    try {
      let faceIdCredId: string | null = null
      if (face) faceIdCredId = await registerBiometrics(settings.ownerName || 'My Ledger').catch(() => null)
      await setPinValue(pin)
      await saveSettings({ lockOnOpen: true, faceIdCredId })
      toast(faceIdCredId ? 'PIN and Face ID set' : 'PIN set')
    } finally {
      setBusy(false)
    }
  }

  const field = (v: string, set: (s: string) => void, ph: string, autoFocus = false) => (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      autoFocus={autoFocus}
      placeholder={ph}
      aria-label={ph}
      value={v}
      onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && save()}
      className="w-full rounded-xl bg-slate-100 px-4 py-3.5 text-center text-2xl tracking-[0.5em] placeholder:text-base placeholder:tracking-normal dark:bg-slate-800"
    />
  )

  return (
    <Sheet open onClose={() => setError('Please set a PIN to protect your ledger.')} title="Lock your ledger" footer={<Button className="w-full" disabled={busy} onClick={save}><ShieldCheck size={18} /> Save & lock</Button>}>
      <div className="space-y-3">
        <p className="text-[15px] text-slate-600 dark:text-slate-300">Choose a 4–6 digit PIN. It opens the app and protects deleting. If you forget it, you can reset it with your account password.</p>
        {field(pin, setPin, 'New PIN', true)}
        {field(pin2, setPin2, 'Repeat PIN')}
        {bio && (
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
            <span className="font-medium">Also unlock with Face ID</span>
            <input type="checkbox" className="h-5 w-5 accent-current" checked={face} onChange={(e) => setFace(e.target.checked)} />
          </label>
        )}
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>
    </Sheet>
  )
}

export function BrandingSheet({ open, onClose, welcome }: { open: boolean; onClose: () => void; welcome?: boolean }) {
  const { settings, toast } = useApp()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [accent, setAccent] = useState('#0f172a')

  useEffect(() => {
    if (open) {
      setName(settings.ownerName ?? '')
      setTitle(settings.appTitle && settings.appTitle !== 'MY LEDGER' ? settings.appTitle : '')
      setAccent(settings.accent || '#0f172a')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    await saveSettings({ ownerName: name.trim(), appTitle: preview, accent, onboarded: true })
    if (!welcome) toast('Saved')
    onClose()
  }

  const preview = title.trim() || (name.trim() ? `${name.trim().split(' ')[0]}'s Ledger` : 'MY LEDGER')

  return (
    <Sheet open={open} onClose={onClose} title={welcome ? 'Welcome 👋' : 'Your name & branding'} footer={<Button className="w-full" onClick={save}>{welcome ? 'Start' : 'Save'}</Button>}>
      <div className="space-y-4">
        {welcome && <p className="text-[15px] text-slate-600 dark:text-slate-300">Make it yours. Your records stay private on this phone — nobody else can see them.</p>}
        <Field label="Your name" hint="Shown on statements you share.">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Attaullah Sher" autoCapitalize="words" />
        </Field>
        <Field label="App title (optional)">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={name.trim() ? `${name.trim().split(' ')[0]}'s Ledger` : 'MY LEDGER'} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-500">Colour</span>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                aria-label={a.name}
                onClick={() => setAccent(a.value)}
                className={cx('grid h-11 w-11 place-items-center rounded-full ring-offset-2 dark:ring-offset-slate-900', accent === a.value && 'ring-2 ring-slate-400')}
                style={{ background: a.value }}
              >
                {accent === a.value && <Check size={18} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4 text-white" style={{ background: accent }}>
          <div className="text-xs opacity-80">Preview</div>
          <div className="text-xl font-bold">{preview}</div>
        </div>
      </div>
    </Sheet>
  )
}
