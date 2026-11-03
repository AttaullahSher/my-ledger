import { useEffect, useState } from 'react'
import { Plus, Share } from 'lucide-react'
import { Button, Sheet } from './ui'

const DISMISSED = 'myledger.installDismissed'

type InstallEvent = Event & { prompt: () => Promise<void> }

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Asks to add the app to the Home Screen when it is opened in the browser on a phone. */
export function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [android, setAndroid] = useState<InstallEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(DISMISSED)) return
    if (isIOS()) setOpen(true)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setAndroid(e as InstallEvent)
      setOpen(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const close = () => {
    sessionStorage.setItem(DISMISSED, '1')
    setOpen(false)
  }

  return (
    <Sheet open={open} onClose={close} title="Add to Home Screen">
      <div className="space-y-4 pb-3 text-[15px]">
        <p className="text-slate-600 dark:text-slate-300">
          Install My Ledger as an app: it opens full-screen, works offline and keeps your records safely. <b>Do this before signing in</b> — the Home Screen app has its own storage.
        </p>
        {android ? (
          <Button
            className="w-full"
            onClick={async () => {
              await android.prompt()
              close()
            }}
          >
            <Plus size={18} /> Install app
          </Button>
        ) : (
          <ol className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-bold dark:bg-slate-700">1</span>
              <span>
                Tap the <b>Share</b> button <Share size={17} className="inline -translate-y-0.5 text-blue-600" /> in Safari
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-bold dark:bg-slate-700">2</span>
              <span>
                Choose <b>Add to Home Screen</b> <Plus size={17} className="inline -translate-y-0.5 rounded border border-current" />
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-bold dark:bg-slate-700">3</span>
              <span>
                Tap <b>Add</b>, then open <b>My Ledger</b> from your Home Screen
              </span>
            </li>
          </ol>
        )}
        <button type="button" onClick={close} className="w-full py-2 text-center text-sm font-semibold text-slate-500">
          Not now
        </button>
      </div>
    </Sheet>
  )
}
