import { useState } from 'react'
import { Eye, EyeOff, LogOut, RefreshCw } from 'lucide-react'
import { formatDateTime } from '../lib/dates'
import { flush, resetPassword, signIn, signOutSync, type SyncAuthError } from '../lib/sync'
import { useApp } from './AppContext'
import { useSync } from './useSync'
import { Button, cx, inputCls } from './ui'

// ---------- Auto-sync card ----------

export function SyncCard({ onDone }: { onDone?: () => void }) {
  const s = useSync()
  const { toast, settings } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [step, setStep] = useState<'signin' | 'unknown' | 'create'>('signin')
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
          <Button variant="secondary" onClick={() => signOutSync().then(() => toast('Signed out'))}>
            <LogOut size={17} /> Sign out
          </Button>
        </div>
      </div>
    )

  const notFound = (code: string) => ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(code)

  /** One button: signs in if the account exists, otherwise offers to create it. */
  async function go() {
    setBusy(true)
    setError('')
    try {
      if (step === 'create') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.')
        if (password !== password2) throw new Error('The two passwords do not match.')
        await signIn(email, password, true)
        toast('Account created — auto-sync is on')
        setStep('signin')
        onDone?.()
      } else {
        await signIn(email, password, false)
        toast('Signed in — syncing')
        onDone?.()
      }
      setPassword('')
      setPassword2('')
    } catch (e) {
      const code = (e as SyncAuthError).code ?? ''
      if (step === 'signin' && notFound(code)) setStep('unknown')
      else if (code === 'auth/email-already-in-use') {
        setStep('signin')
        setError('This email already has an account, but the password was not correct. Try again or reset the password.')
      } else setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    if (!email) return setError('Enter your email first.')
    try {
      await resetPassword(email)
      toast('If this email has an account, a reset link was sent')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const pwField = (value: string, set: (v: string) => void, ph: string, auto: string) => (
    <div className="relative">
      <input className={cx(inputCls, 'pr-12')} type={showPw ? 'text' : 'password'} autoComplete={auto} placeholder={ph} value={value} onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400">
        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )

  return (
    <div className={card}>
      <div className="font-semibold">Never lose your records</div>
      <p className="mt-1 text-slate-500">Everything is saved automatically to your own private account and comes back on any new phone. Only you can see your records.</p>
      {s.error && <p className="mt-2 text-red-600">{s.error}</p>}

      {step === 'unknown' ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
            We couldn’t sign in <b>{email}</b>. Is this your first time?
          </div>
          <Button className="w-full" onClick={() => { setStep('create'); setPassword(''); setError('') }}>
            Yes — create my account
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => { setStep('signin'); setPassword(''); setError('') }}>
            No — I’ll try my password again
          </Button>
          <button type="button" onClick={forgot} className="w-full text-center text-[13px] font-semibold text-blue-600 dark:text-blue-400">
            Forgot password? Email me a reset link
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input className={inputCls} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === 'create'} />
          {step === 'create' ? (
            <>
              <p className="text-[13px] text-slate-500">
                Choose a <b>new password for My Ledger</b> — it is <b>not</b> your Gmail/email password. At least 6 characters.
              </p>
              {pwField(password, setPassword, 'New password', 'new-password')}
              {pwField(password2, setPassword2, 'Repeat new password', 'new-password')}
            </>
          ) : (
            <>
              {pwField(password, setPassword, 'My Ledger password', 'current-password')}
              <p className="text-[13px] text-slate-500">New here? Just enter your email and choose a password — we’ll create your account.</p>
            </>
          )}
          {error && <p className="text-red-600">{error}</p>}
          <Button className="w-full" disabled={busy || !email.trim() || !password} onClick={go}>
            {busy ? 'Please wait…' : step === 'create' ? 'Create account & turn on sync' : 'Continue'}
          </Button>
          <div className="flex justify-between pt-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400">
            {step === 'create' ? (
              <button type="button" onClick={() => { setStep('signin'); setError('') }}>
                ← Back
              </button>
            ) : (
              <button type="button" onClick={() => { setStep('create'); setError('') }}>
                Create a new account
              </button>
            )}
            {step === 'signin' && (
              <button type="button" onClick={forgot}>
                Forgot password?
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

