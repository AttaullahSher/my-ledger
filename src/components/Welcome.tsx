import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { db } from '../lib/db'
import { saveSettings } from '../lib/repo'
import { ACCENTS } from '../lib/types'
import { useApp } from './AppContext'
import { Button, Field, Sheet, cx, inputCls } from './ui'

/** First-run setup: your name, your app title and colour. Everyone gets their own branding. */
export function Welcome() {
  const { settings, ready } = useApp()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!ready || settings.onboarded) return
    // Existing users (who already have records) are not interrupted.
    db.people.count().then((n) => (n ? saveSettings({ onboarded: true }) : setOpen(true)))
  }, [ready, settings.onboarded])

  return <BrandingSheet open={open} onClose={() => { setOpen(false); saveSettings({ onboarded: true }) }} welcome />
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
