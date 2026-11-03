// PDF statement and WhatsApp text. Heavy libraries are loaded only when needed (still works offline).
import { formatDate, todayISO } from './dates'
import { balanceSentence, personTotals, withRunningBalance } from './ledger'
import { formatMoney } from './money'
import type { DateFormat, Person, Transaction } from './types'

export interface ExportOpts {
  currency: string
  dateFormat: DateFormat
  /** Personal branding (optional) */
  title?: string
  owner?: string
  accent?: string
}

export interface DateRange {
  from?: string
  to?: string
}

const inRange = (d: string, r: DateRange) => (!r.from || d >= r.from) && (!r.to || d <= r.to)

export function rangeLabel(r: DateRange, fmt: DateFormat) {
  if (!r.from && !r.to) return 'All dates'
  if (r.from && r.to) return `${formatDate(r.from, fmt)} – ${formatDate(r.to, fmt)}`
  return r.from ? `From ${formatDate(r.from, fmt)}` : `Up to ${formatDate(r.to!, fmt)}`
}

export const safeName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'person'

/** Statement rows for one person within a range, with opening balance carried in. */
export function statementRows(txs: Transaction[], range: DateRange) {
  const before = txs.filter((t) => range.from && t.date < range.from)
  const inside = txs.filter((t) => inRange(t.date, range))
  const opening = personTotals(before).balance
  const rows = withRunningBalance(inside, opening)
  const totals = personTotals(inside)
  const closing = rows.length ? rows[rows.length - 1].balance : opening
  return { opening, rows, totals, closing }
}

// ---------------- PDF ----------------

async function loadPdf() {
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = (at as unknown as { default: (doc: unknown, opts: unknown) => void }).default
  return { jsPDF, autoTable }
}

type Doc = InstanceType<Awaited<ReturnType<typeof loadPdf>>['jsPDF']>
const lastY = (doc: Doc) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60

function hexToRgb(hex = '#0f172a'): [number, number, number] {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [15, 23, 42]
}

function pdfHeader(doc: Doc, subtitle: string, o: ExportOpts) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...hexToRgb(o.accent))
  doc.rect(0, 0, w, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text((o.title || 'MY LEDGER').toUpperCase(), 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(subtitle, 14, 20)
  if (o.owner) doc.text(`From: ${o.owner}`, w - 14, 20, { align: 'right' })
  doc.setTextColor(15, 23, 42)
}

function pdfFooter(doc: Doc, note: string) {
  const pages = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(note, 14, h - 8, { maxWidth: w - 50 })
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 8, { align: 'right' })
  }
}

const money = (f: number, c: string) => formatMoney(f, c, true)

/** Right-align money column headers from column index `from` onwards. */
const alignHead = (from: number) => (d: { section: string; column: { index: number }; cell: { styles: { halign?: string } } }) => {
  if (d.section === 'head' && d.column.index >= from) d.cell.styles.halign = 'right'
}

export async function personStatementPDF(person: Person, txs: Transaction[], range: DateRange, o: ExportOpts): Promise<File> {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { rows, totals, closing, opening } = statementRows(txs, range)

  pdfHeader(doc, 'PERSONAL ACCOUNT STATEMENT', o)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(person.name, 14, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Statement date: ${formatDate(todayISO(), o.dateFormat)}`, 14, 44)
  doc.text(`Period: ${rangeLabel(range, o.dateFormat)}`, 14, 49)
  doc.setTextColor(15, 23, 42)

  const body: string[][] = []
  if (range.from) body.push([formatDate(range.from, o.dateFormat), 'Opening balance', '', '', money(opening, o.currency)])
  for (const { tx, balance } of rows)
    body.push([
      formatDate(tx.date, o.dateFormat),
      [tx.type === 'settlement' ? 'Settlement' : '', tx.reason ?? '', tx.notes ? `(${tx.notes})` : ''].filter(Boolean).join(' ') || '-',
      tx.direction === 'given' ? money(tx.amountInFils, o.currency) : '',
      tx.direction === 'received' ? money(tx.amountInFils, o.currency) : '',
      money(balance, o.currency),
    ])
  if (!body.length) body.push(['', 'No transactions in this period', '', '', ''])

  autoTable(doc, {
    startY: 55,
    head: [['Date', 'Reason', 'Given', 'Received', 'Balance']],
    body,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: hexToRgb(o.accent) },
    columnStyles: {
      0: { cellWidth: 26 },
      2: { halign: 'right', textColor: [21, 128, 61] },
      3: { halign: 'right', textColor: [185, 28, 28] },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didParseCell: alignHead(2),
  })

  autoTable(doc, {
    startY: lastY(doc) + 6,
    body: [
      ['Total money given', money(totals.given, o.currency)],
      ['Total money received', money(totals.received, o.currency)],
      ['Current balance', money(Math.abs(closing), o.currency)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    tableWidth: 100,
    margin: { left: doc.internal.pageSize.getWidth() - 114 },
  })

  let y = lastY(doc) + 8
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage()
    y = 20
  }
  const sentence = balanceSentence(person.name, closing, o.currency)
  if (closing > 0) doc.setFillColor(220, 252, 231)
  else if (closing < 0) doc.setFillColor(254, 226, 226)
  else doc.setFillColor(241, 245, 249)
  doc.roundedRect(14, y - 6, doc.internal.pageSize.getWidth() - 28, 11, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(sentence, 18, y + 1)

  pdfFooter(doc, 'This statement is for personal record-keeping. Please contact me if any entry needs correction.')
  return new File([doc.output('blob')], `${safeName(person.name)}-statement-${todayISO()}.pdf`, { type: 'application/pdf' })
}

/** WhatsApp-friendly text summary. */
export function statementText(person: Person, txs: Transaction[], range: DateRange, o: ExportOpts): string {
  const { totals, closing } = statementRows(txs, range)
  const first = person.name.split(' ')[0]
  const status =
    closing > 0
      ? `You owe me ${formatMoney(closing, o.currency)}.`
      : closing < 0
        ? `I owe you ${formatMoney(-closing, o.currency)}.`
        : 'We are all settled.'
  const period = range.from || range.to ? `\nPeriod: ${rangeLabel(range, o.dateFormat)}\n` : ''
  return [
    `Hello ${first},`,
    '',
    `Here is our account summary:${period}`,
    `Total given: ${formatMoney(totals.given, o.currency)}`,
    `Total received: ${formatMoney(totals.received, o.currency)}`,
    '',
    `Current balance: ${formatMoney(Math.abs(closing), o.currency)}`,
    '',
    status,
    '',
    'Please review the statement and let me know if any correction is needed.',
    '',
    o.owner || o.title || 'MY LEDGER',
  ].join('\n')
}
