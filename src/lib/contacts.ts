// Getting people from the phone's contacts.
// 1) Contact Picker API (Android Chrome; iPhone only if enabled in Safari's experimental features)
// 2) Fallback: a contact card (.vcf) — iPhone Contacts → contact → Share Contact → Save to Files.

export interface PickedContact {
  name: string
  phone?: string
}

type ContactsManager = { select(props: string[], opts?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[] }[]> }

export function canPickContacts(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window
}

export async function pickContacts(multiple = false): Promise<PickedContact[]> {
  const mgr = (navigator as unknown as { contacts: ContactsManager }).contacts
  const res = await mgr.select(['name', 'tel'], { multiple })
  return res
    .map((c) => ({ name: (c.name?.[0] ?? '').trim(), phone: c.tel?.[0]?.trim() }))
    .filter((c) => c.name || c.phone)
    .map((c) => ({ name: c.name || c.phone!, phone: c.phone }))
}

/** Parses one or many vCards. */
export function parseVCards(text: string): PickedContact[] {
  // Unfold folded lines (RFC 6350: a line starting with space/tab continues the previous one).
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const out: PickedContact[] = []
  let cur: { fn?: string; n?: string; tel?: string } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (/^BEGIN:VCARD/i.test(line)) cur = {}
    else if (/^END:VCARD/i.test(line)) {
      if (cur) {
        const name = (cur.fn || cur.n || cur.tel || '').trim()
        if (name) out.push({ name, phone: cur.tel })
      }
      cur = null
    } else if (cur) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const key = line.slice(0, idx).split(';')[0].replace(/^item\d+\./i, '').toUpperCase()
      const val = unescape(line.slice(idx + 1))
      if (key === 'FN' && !cur.fn) cur.fn = val
      else if (key === 'N' && !cur.n) {
        const [last, first, middle] = val.split(';')
        cur.n = [first, middle, last].filter(Boolean).join(' ')
      } else if (key === 'TEL' && !cur.tel) cur.tel = val.trim()
    }
  }
  return out
}

function unescape(v: string) {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()
}
