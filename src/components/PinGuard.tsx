import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import * as repo from '../lib/repo'
import { useApp } from './AppContext'
import { Button, Sheet, cx } from './ui'
import { ForgotPin } from './AppLock'

interface GuardOpts {
  title: string
  message: ReactNode
  confirmText: string
  /** Word the user must type as the final confirmation. */
  typeWord?: string
  /** Skip the warning step and go straight to the PIN. */
  pinOnly?: boolean
}

type Step = 'warn' | 'pin' | 'setpin'

const Ctx = createContext<((o: GuardOpts) => Promise<boolean>) | null>(null)

/** Danger-zone protection: 1) warning + confirm, 2) PIN (+ typed word). A PIN is created on first use. */
export function useDangerGuard() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDangerGuard outside PinGuardProvider')
  return c
}

export function PinGuardProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp()
  const [opts, setOpts] = useState<GuardOpts | null>(null)
  const [step, setStep] = useState<Step>('warn')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [word, setWord] = useState('')
  const [error, setError] = useState('')
  const [tries, setTries] = useState(0)
  const [forgot, setForgot] = useState(false)
  const resolver = useRef<(v: boolean) => void>(undefined)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const guard = useCallback((o: GuardOpts) => {
    setOpts(o)
    setStep(o.pinOnly ? (settingsRef.current.pinHash ? 'pin' : 'setpin') : 'warn')
    setPin('')
    setPin2('')
    setWord('')
    setError('')
    return new Promise<boolean>((res) => (resolver.current = res))
  }, [])

  const done = (v: boolean) => {
    resolver.current?.(v)
    setOpts(null)
  }

  async function next() {
    setError('')
    if (step === 'warn') return setStep(settings.pinHash ? 'pin' : 'setpin')
    if (step === 'setpin') {
      if (!/^\d{4,6}$/.test(pin)) return setError('PIN must be 4 to 6 digits.')
      if (pin !== pin2) return setError('The two PINs do not match.')
      await repo.setPin(pin)
      setPin('')
      return setStep('pin')
    }
    if (tries >= 5) return setError('Too many wrong PINs. Close and try again later.')
    if (!(await repo.checkPin(pin))) {
      setTries((t) => t + 1)
      setPin('')
      return setError('Wrong PIN.')
    }
    if (opts?.typeWord && word.trim().toUpperCase() !== opts.typeWord) return setError(`Type ${opts.typeWord} to confirm.`)
    setTries(0)
    done(true)
  }

  const pinInput = (value: string, onChange: (v: string) => void, label: string, autoFocus = false) => (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      pattern="[0-9]*"
      maxLength={6}
      aria-label={label}
      placeholder={label}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && next()}
      className="w-full rounded-xl bg-slate-100 px-4 py-3.5 text-center text-2xl tracking-[0.5em] outline-none placeholder:text-base placeholder:tracking-normal focus:ring-2 focus:ring-slate-900/20 dark:bg-slate-800"
    />
  )

  return (
    <Ctx.Provider value={guard}>
      {children}
      <Sheet open={!!opts} onClose={() => done(false)} title={opts?.title ?? ''}>
        {opts && (
          <div className="space-y-4 pb-2">
            {step === 'warn' && (
              <div className="flex gap-3 rounded-2xl bg-red-50 p-4 text-[15px] text-red-900 dark:bg-red-950/60 dark:text-red-200">
                <ShieldAlert className="mt-0.5 shrink-0" size={22} />
                <div>{opts.message}</div>
              </div>
            )}
            {step === 'setpin' && (
              <>
                <p className="flex items-center gap-2 text-[15px] text-slate-600 dark:text-slate-300">
                  <KeyRound size={18} /> Create a security PIN. It will be asked before any dangerous action.
                </p>
                {pinInput(pin, setPin, 'New PIN (4–6 digits)', true)}
                {pinInput(pin2, setPin2, 'Repeat PIN')}
              </>
            )}
            {step === 'pin' && (
              <>
                <p className="text-[15px] text-slate-600 dark:text-slate-300">{opts.pinOnly ? opts.message : <>Step 2 of 2 — enter your PIN{opts.typeWord ? ` and type ${opts.typeWord}` : ''}.</>}</p>
                {pinInput(pin, setPin, 'Security PIN', true)}
                {opts.typeWord && (
                  <input
                    className="w-full rounded-xl bg-slate-100 px-4 py-3 text-center font-semibold uppercase dark:bg-slate-800"
                    placeholder={`Type ${opts.typeWord}`}
                    autoCapitalize="characters"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && next()}
                  />
                )}
              </>
            )}
            {error && <div className="text-center text-sm font-medium text-red-600">{error}</div>}
            {step === 'pin' && (
              <button type="button" className="block w-full text-center text-sm font-semibold text-blue-600 dark:text-blue-400" onClick={() => setForgot(true)}>
                Forgot PIN?
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => done(false)}>
                Cancel
              </Button>
              <Button variant={step === 'pin' ? 'danger' : 'primary'} onClick={next} className={cx(step === 'warn' && 'bg-red-600 text-white dark:bg-red-600 dark:text-white')}>
                {step === 'warn' ? 'Continue' : step === 'setpin' ? 'Save PIN' : opts.confirmText}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <ForgotPin open={forgot} onClose={() => setForgot(false)} onReset={() => done(false)} />
    </Ctx.Provider>
  )
}
