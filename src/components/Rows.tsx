import { ArrowDownLeft, ArrowUpRight, CheckCheck, CloudOff } from 'lucide-react'
import { formatDate } from '../lib/dates'
import { curOf } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import type { Transaction } from '../lib/types'
import { cx } from './ui'

/**
 * One ledger entry. Light green = money given (they have to pay me).
 * Light red = money received (I have to give it back / they owe me less).
 */
export function TxRow({
  tx,
  personName,
  onClick,
  runningBalance,
  muted,
  pending,
}: {
  tx: Transaction
  personName?: string
  onClick?: () => void
  runningBalance?: number
  muted?: boolean
  /** Saved on this phone but not uploaded to the account yet (offline). */
  pending?: boolean
}) {
  const currency = curOf(tx)
  const given = tx.direction === 'given'
  const settle = tx.type === 'settlement'
  const Icon = settle ? CheckCheck : given ? ArrowUpRight : ArrowDownLeft
  const title = personName ?? (settle ? 'Balance cleared' : given ? 'Money given' : 'Money received')
  const sub = [personName ? (settle ? 'Balance cleared' : given ? 'Given' : 'Received') : null, !settle ? tx.reason : null, formatDate(tx.date)]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left active:scale-[0.99]',
        settle
          ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
          : given
            ? 'border-pos-line bg-pos-soft dark:border-green-900 dark:bg-green-950/40'
            : 'border-neg-line bg-neg-soft dark:border-red-900 dark:bg-red-950/40',
        muted && 'opacity-70',
      )}
    >
      <div
        className={cx(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full',
          settle ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200' : given ? 'bg-white text-pos dark:bg-green-900/60' : 'bg-white text-neg dark:bg-red-900/60',
        )}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        <div className="truncate text-[13px] text-slate-500 dark:text-slate-400">{sub}</div>
        {pending && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600">
            <CloudOff size={12} /> Not synced yet
          </div>
        )}
      </div>
      <div className="text-right">
        <div className={cx('tabular font-semibold', settle ? 'text-slate-600 dark:text-slate-300' : given ? 'text-pos' : 'text-neg')}>{formatMoney(tx.amountInFils, currency)}</div>
        {runningBalance !== undefined && (
          <div className={cx('tabular text-[11px]', runningBalance > 0 ? 'text-pos/70' : runningBalance < 0 ? 'text-neg/70' : 'text-slate-400')}>
            {runningBalance === 0 ? 'Settled' : `Bal ${formatMoney(Math.abs(runningBalance), currency)}`}
          </div>
        )}
      </div>
    </button>
  )
}
