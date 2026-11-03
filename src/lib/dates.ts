import type { DateFormat } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's local date as YYYY-MM-DD. */
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthPrefix(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(prefix: string): string {
  const [y, m] = prefix.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function formatDate(iso: string, fmt: DateFormat = 'D MMM YYYY'): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  switch (fmt) {
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`
    case 'YYYY-MM-DD':
      return `${y}-${m}-${d}`
    default:
      return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
  }
}

export function formatDateTime(isoTs: string, fmt: DateFormat): string {
  const d = new Date(isoTs)
  return `${formatDate(todayISO(d), fmt)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relativeDay(iso: string, fmt: DateFormat): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso === todayISO(y)) return 'Yesterday'
  return formatDate(iso, fmt)
}

export function daysSince(isoTs?: string | null): number {
  if (!isoTs) return Infinity
  return Math.floor((Date.now() - new Date(isoTs).getTime()) / 86_400_000)
}
