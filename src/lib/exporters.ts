// PDF statement, WhatsApp summary and the "download all data" Excel file.
import type { AllData } from './backup'
import { formatDate, todayISO } from './dates'
import { balanceSentence, curOf, personSummary, sortChronological, summariesByPerson, totalsOf, typeLabel, withRunningBalance } from './ledger'
import { filsToNumber, formatMoney } from './money'
import { formatPhone } from './phone'
import type { Person, Transaction } from './types'

export interface ExportOpts {
  title?: string
  owner?: string
  accent?: string
}

export interface DateRange {
  from?: string
  to?: string
}

const inRange = (d: string, r: DateRange) => (!r.from || d >= r.from) && (!r.to || d <= r.to)

export function rangeLabel(r: DateRange) {
  if (!r.from && !r.to) return 'All dates'
  if (r.from && r.to) return `${formatDate(r.from)} – ${formatDate(r.to)}`
  return r.from ? `From ${formatDate(r.from)}` : `Up to ${formatDate(r.to!)}`
}

export const safeName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'person'

/** Per currency: opening balance, rows in range (with running balance), totals and closing balance. */
export function statementByCurrency(txs: Transaction[], range: DateRange) {
  const currencies = [...new Set(txs.map(curOf))].sort()
  return currencies
    .map((currency) => {
      const list = txs.filter((t) => curOf(t) === currency)
      const opening = totalsOf(list.filter((t) => range.from && t.date < range.from)).balance
      const inside = list.filter((t) => inRange(t.date, range))
      const rows = withRunningBalance(inside, new Map([[currency, opening]]))
      const totals = totalsOf(inside)
      const closing = rows.length ? rows[rows.length - 1].balance : opening
      return { currency, opening, rows, totals, closing }
    })
    .filter((s) => s.rows.length || s.opening !== 0)
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

const money = (f: number, c: string) => formatMoney(f, c, true)

export async function personStatementPDF(person: Person, txs: Transaction[], range: DateRange, o: ExportOpts): Promise<File> {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const brand = hexToRgb(o.accent)

  doc.setFillColor(...brand)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text((o.title || 'MY LEDGER').toUpperCase(), 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('ACCOUNT STATEMENT', 14, 20)
  if (o.owner) doc.text(`From: ${o.owner}`, W - 14, 20, { align: 'right' })

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(person.name, 14, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Statement date: ${formatDate(todayISO())}    Period: ${rangeLabel(range)}`, 14, 44)
  doc.setTextColor(15, 23, 42)

  let y = 50
  const sections = statementByCurrency(txs, range)
  if (!sections.length) doc.text('No entries in this period.', 14, y + 6)

  for (const s of sections) {
    if (y > H - 60) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(s.currency, 14, y + 4)
    const body: string[][] = []
    if (range.from) body.push([formatDate(range.from), 'Opening balance', '', '', money(s.opening, s.currency)])
    for (const { tx, balance } of s.rows)
      body.push([
        formatDate(tx.date),
        (tx.type === 'settlement' ? 'Settlement' : tx.reason) || '-',
        tx.direction === 'given' ? money(tx.amountInFils, s.currency) : '',
        tx.direction === 'received' ? money(tx.amountInFils, s.currency) : '',
        money(balance, s.currency),
      ])
    body.push(['', 'Total', money(s.totals.given, s.currency), money(s.totals.received, s.currency), money(s.closing, s.currency)])
    autoTable(doc, {
      startY: y + 7,
      head: [['Date', 'Reason', 'Given', 'Received', 'Balance']],
      body,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2.2 },
      headStyles: { fillColor: brand },
      columnStyles: {
        0: { cellWidth: 24 },
        2: { halign: 'right', textColor: [21, 128, 61] },
        3: { halign: 'right', textColor: [185, 28, 28] },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (d: { section: string; row: { index: number }; column: { index: number }; cell: { styles: { halign?: string; fontStyle?: string } } }) => {
        if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = 'right'
        if (d.section === 'body' && d.row.index === body.length - 1) d.cell.styles.fontStyle = 'bold'
      },
      margin: { left: 14, right: 14, bottom: 18 },
    })
    y = lastY(doc) + 4
    const sentence = balanceSentence(person.name, s.closing, s.currency)
    if (s.closing > 0) doc.setFillColor(220, 252, 231)
    else if (s.closing < 0) doc.setFillColor(254, 226, 226)
    else doc.setFillColor(241, 245, 249)
    doc.roundedRect(14, y, W - 28, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text(sentence, 18, y + 6.5)
    y += 18
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('This statement is for personal record-keeping. Please contact me if any entry needs correction.', 14, H - 8)
    doc.text(`Page ${i} of ${pages}`, W - 14, H - 8, { align: 'right' })
  }
  return new File([doc.output('blob')], `${safeName(person.name)}-statement-${todayISO()}.pdf`, { type: 'application/pdf' })
}

/** WhatsApp-friendly text summary. */
export function statementText(person: Person, txs: Transaction[], range: DateRange, o: ExportOpts): string {
  const first = person.name.split(' ')[0]
  const sections = statementByCurrency(txs, range)
  const lines = [`Hello ${first},`, '', `Here is our account summary${range.from || range.to ? ` (${rangeLabel(range)})` : ''}:`, '']
  for (const s of sections) {
    if (sections.length > 1) lines.push(`*${s.currency}*`)
    lines.push(`Total given: ${formatMoney(s.totals.given, s.currency)}`, `Total received: ${formatMoney(s.totals.received, s.currency)}`)
    lines.push(
      s.closing > 0
        ? `You owe me ${formatMoney(s.closing, s.currency)}.`
        : s.closing < 0
          ? `I owe you ${formatMoney(-s.closing, s.currency)}.`
          : 'We are settled.',
      '',
    )
  }
  lines.push('Please review and let me know if any correction is needed.', '', o.owner || o.title || 'MY LEDGER')
  return lines.join('\n')
}

// ---------------- Excel (download all data) ----------------

export async function allDataXLSX(data: AllData, o: ExportOpts): Promise<File> {
  const mod = (await import('exceljs')) as unknown as typeof import('exceljs') & { default?: typeof import('exceljs') }
  const Excel = mod.default ?? mod
  const wb = new Excel.Workbook()
  wb.creator = o.owner || 'My Ledger'
  const names = new Map(data.people.map((p) => [p.id, p]))
  const style = (ws: import('exceljs').Worksheet, widths: number[], money: number[]) => {
    ws.columns.forEach((c, i) => (c.width = widths[i] ?? 14))
    const h = ws.getRow(1)
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    for (const c of money) ws.getColumn(c).numFmt = '#,##0.00;[Red]-#,##0.00'
  }

  const bal = wb.addWorksheet('Balances')
  bal.addRow(['Person', 'Mobile', 'Currency', 'Given', 'Received', 'Balance', 'Status'])
  const sums = summariesByPerson(data.transactions)
  for (const p of [...data.people].sort((a, b) => a.name.localeCompare(b.name))) {
    const s = sums.get(p.id) ?? personSummary([])
    if (!s.byCurrency.size) bal.addRow([p.name, formatPhone(p.phone), '', 0, 0, 0, 'No entries'])
    for (const [c, t] of s.byCurrency)
      bal.addRow([p.name, formatPhone(p.phone), c, filsToNumber(t.given), filsToNumber(t.received), filsToNumber(t.balance), t.balance > 0 ? 'They owe me' : t.balance < 0 ? 'I owe them' : 'Settled'])
  }
  style(bal, [24, 18, 10, 14, 14, 14, 14], [4, 5, 6])

  const tx = wb.addWorksheet('Entries')
  tx.addRow(['Date', 'Person', 'Type', 'Reason', 'Currency', 'Given', 'Received'])
  for (const t of sortChronological(data.transactions))
    tx.addRow([
      formatDate(t.date),
      names.get(t.personId)?.name ?? '',
      typeLabel(t),
      t.reason ?? '',
      curOf(t),
      t.direction === 'given' ? filsToNumber(t.amountInFils) : null,
      t.direction === 'received' ? filsToNumber(t.amountInFils) : null,
    ])
  style(tx, [12, 24, 18, 22, 10, 14, 14], [6, 7])

  const buf = await wb.xlsx.writeBuffer()
  return new File([buf], `my-ledger-${todayISO()}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
