// Mobile numbers: accept any common way of writing them, store them in one clean international style.
//
// Accepted examples (all valid):
//   UAE:      050 123 4567 · 0501234567 · 971501234567 · +971 50 123 4567 · 00971-50-1234567 · 501234567
//   Pakistan: 0300 1234567 · 0300-1234567 · 3001234567 · 92 300 1234567 · +92 300 1234567 · 0092 300 1234567
//   USA:      (212) 555-1234 · 212.555.1234 · 1 212 555 1234 · +1 212 555 1234
//   Any other country with + or 00 in front, e.g. +44 7700 900123, 0044 7700 900123
// Arabic-Indic / Urdu digits (٠١٢٣ / ۰۱۲۳) are understood too.

const EASTERN = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

function westernDigits(s: string) {
  return s.replace(/[٠-٩۰-۹]/g, (c) => String(EASTERN.includes(c) ? EASTERN.indexOf(c) : PERSIAN.indexOf(c)))
}

/**
 * Returns the number in international form (+971501234567), or digits only when the country
 * can't be known — or undefined when it is not a usable mobile number.
 */
export function normalizePhone(input?: string | null): string | undefined {
  if (!input) return undefined
  let s = westernDigits(String(input)).trim()
  s = s.replace(/^tel:/i, '').replace(/\s*(ext|x|#)\.?\s*\d+$/i, '') // drop "tel:" and extensions
  const plus = s.startsWith('+')
  let d = s.replace(/\D/g, '')
  if (!d) return undefined

  if (plus) return valid(d) ? `+${d}` : undefined
  if (d.startsWith('00')) return valid(d.slice(2)) ? `+${d.slice(2)}` : undefined

  // UAE
  if (/^9715\d{8}$/.test(d)) return `+${d}`
  if (/^05\d{8}$/.test(d)) return `+971${d.slice(1)}`
  if (/^5\d{8}$/.test(d)) return `+971${d}`
  if (/^0[2-9]\d{7}$/.test(d)) return `+971${d.slice(1)}` // UAE landline 02 123 4567
  // Pakistan
  if (/^923\d{9}$/.test(d)) return `+${d}`
  if (/^03\d{9}$/.test(d)) return `+92${d.slice(1)}`
  // USA / Canada
  if (/^1[2-9]\d{9}$/.test(d)) return `+${d}`
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(d) && !/^3\d{9}$/.test(d)) return `+1${d}`
  // Pakistan mobile written without the leading 0 (3001234567)
  if (/^3\d{9}$/.test(d)) return `+92${d}`

  // Unknown country: keep the digits as typed (guessing a country would be wrong)
  return valid(d) ? d : undefined
}

const valid = (digits: string) => digits.length >= 7 && digits.length <= 15

/** "+971501234567" → "+971 50 123 4567", "+923001234567" → "+92 300 1234567", "+12125551234" → "+1 212 555 1234" */
export function formatPhone(p?: string | null): string {
  if (!p) return ''
  let m: RegExpMatchArray | null
  if ((m = p.match(/^\+971(5\d)(\d{3})(\d{4})$/))) return `+971 ${m[1]} ${m[2]} ${m[3]}`
  if ((m = p.match(/^\+971(\d)(\d{3})(\d{4})$/))) return `+971 ${m[1]} ${m[2]} ${m[3]}`
  if ((m = p.match(/^\+92(3\d{2})(\d{7})$/))) return `+92 ${m[1]} ${m[2]}`
  if ((m = p.match(/^\+1(\d{3})(\d{3})(\d{4})$/))) return `+1 ${m[1]} ${m[2]} ${m[3]}`
  if ((m = p.match(/^\+(\d{1,3})(\d+)$/))) return `+${m[1]} ${m[2].replace(/(\d{3,4})(?=\d{3,4}$)/, '$1 ')}`
  return p
}

/** True when the typed search matches the number, however either was written (0501…, 501…, +971 50…). */
export function phoneMatches(stored: string | undefined, query: string): boolean {
  const q = westernDigits(query).replace(/\D/g, '').replace(/^0+/, '')
  return q.length >= 3 && !!stored && stored.replace(/\D/g, '').includes(q)
}
