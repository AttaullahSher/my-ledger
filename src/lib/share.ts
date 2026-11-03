// Sharing helpers built on the native share sheet (iPhone: WhatsApp, Save to Files, AirDrop...).

/** blocked = the browser needs a fresh tap before it opens the share sheet (iPhone after slow work). */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'blocked'

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files })
  } catch {
    return false
  }
}

export function downloadFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Opens the share sheet with the file(s). Falls back to downloading.
 * We never claim something was "sent" — the user confirms in the share sheet.
 */
export async function shareFiles(files: File[], title: string, text?: string, allowBlocked = true): Promise<ShareOutcome> {
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, title, text })
      return 'shared'
    } catch (e) {
      const name = (e as Error)?.name
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError' && allowBlocked) return 'blocked'
      // otherwise fall through to download
    }
  }
  for (const f of files) downloadFile(f, f.name)
  return 'downloaded'
}

export async function shareText(text: string, title = 'MY LEDGER'): Promise<ShareOutcome> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
    }
  }
  await copyText(text)
  return 'downloaded'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Opens WhatsApp with the text pre-filled. Uses the person's number when we have one. */
export function whatsappLink(text: string, phone?: string): string {
  let digits = (phone ?? '').replace(/[^\d]/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  // UAE local mobile like 05xxxxxxxx → 9715xxxxxxxx
  if (/^05\d{8}$/.test(digits)) digits = '971' + digits.slice(1)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
