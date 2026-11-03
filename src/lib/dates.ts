// One date style everywhere: 03-Nov-26

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's local date as YYYY-MM-DD (storage format). */
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** "2026-11-03" → "03-Nov-26" */
export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${MONTHS[Number(m) - 1]}-${y.slice(2)}`
}

/** ISO timestamp → "03-Nov-26 14:05" */
export function formatDateTime(isoTs: string): string {
  const d = new Date(isoTs)
  return `${formatDate(todayISO(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
