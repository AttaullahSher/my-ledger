import { useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { downloadFile, shareFiles } from '../lib/share'
import { useApp } from './AppContext'
import { Button, Sheet } from './ui'

/**
 * Creates files then opens the share sheet. iPhone only allows the share sheet right after a tap,
 * so if creating the file took too long we show a "Tap to share" step instead of failing.
 */
export function useFileShare() {
  const { toast } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<{ files: File[]; title: string; onShared?: () => void } | null>(null)

  async function share(key: string, make: () => Promise<File[]> | File[], title: string, onShared?: () => void) {
    if (busy) return
    setBusy(key)
    try {
      const files = await make()
      const r = await shareFiles(files, title)
      if (r === 'blocked') setPending({ files, title, onShared })
      else if (r === 'shared' || r === 'downloaded') {
        onShared?.()
        if (r === 'downloaded') toast(files.length > 1 ? 'Files downloaded' : 'File downloaded')
      }
    } catch (e) {
      console.error(e)
      toast('Could not create the file. Please try again.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const sheet = (
    <Sheet open={!!pending} onClose={() => setPending(null)} title="Your file is ready">
      {pending && (
        <div className="space-y-3 pb-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
            {pending.files.map((f) => (
              <div key={f.name} className="truncate">{f.name}</div>
            ))}
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              const p = pending
              const r = await shareFiles(p.files, p.title, undefined, false)
              if (r !== 'cancelled') {
                p.onShared?.()
                setPending(null)
              }
            }}
          >
            <Share2 size={18} /> Share / Save to Files
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              pending.files.forEach((f) => downloadFile(f, f.name))
              pending.onShared?.()
              setPending(null)
            }}
          >
            <Download size={18} /> Download instead
          </Button>
        </div>
      )}
    </Sheet>
  )

  return { share, busy, sheet }
}
