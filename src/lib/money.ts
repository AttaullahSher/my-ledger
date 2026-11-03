// Money helpers. Everything is integer fils (1 AED = 100 fils) to avoid floating-point errors.

/** Parse user input like "12", "12.5", "1,200.75" into fils. Returns null if invalid or not > 0. */
export function parseAmountToFils(input: string): number | null {
  const s = String(input ?? '').trim().replace(/[,\s]/g, '')
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  const fils = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isSafeInteger(fils) || fils <= 0) return null
  return fils
}

/** Fils -> "1234.50" style plain string (for editing inputs and CSV). */
export function filsToPlain(fils: number): string {
  const sign = fils < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(fils))
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Fils -> number of major units, e.g. 12345 -> 123.45 (only for Excel numeric cells). */
export function filsToNumber(fils: number): number {
  return Math.trunc(fils) / 100
}

/** Fils -> "AED 1,234.50" (decimals hidden when zero unless forceDecimals). */
export function formatMoney(fils: number, currency = 'AED', forceDecimals = false): string {
  const abs = Math.abs(Math.trunc(fils))
  const whole = Math.floor(abs / 100).toLocaleString('en-US')
  const cents = abs % 100
  const dec = cents === 0 && !forceDecimals ? '' : `.${String(cents).padStart(2, '0')}`
  return `${fils < 0 ? '-' : ''}${currency} ${whole}${dec}`
}
