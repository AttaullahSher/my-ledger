import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10', className)}>{children}</div>
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'pos' | 'neg'
const variants: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white active:opacity-85',
  secondary: 'bg-slate-100 text-slate-900 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:active:bg-slate-700',
  danger: 'bg-red-600 text-white active:bg-red-700',
  ghost: 'text-slate-700 active:bg-slate-100 dark:text-slate-300 dark:active:bg-slate-800',
  pos: 'bg-pos text-white active:opacity-80',
  neg: 'bg-neg text-white active:opacity-80',
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function PageHeader({ title, subtitle, right, left }: { title: string; subtitle?: ReactNode; right?: ReactNode; left?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-slate-50/85 backdrop-blur-xl dark:bg-black/80">
      <div className="mx-auto flex max-w-2xl items-end justify-between gap-3 px-4 pb-3 pt-3">
        <div className="flex min-w-0 items-center gap-1">
          {left}
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
            {subtitle && <div className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">{right}</div>
      </div>
    </header>
  )
}

export function IconButton({ label, children, onClick, className }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx('grid h-11 w-11 place-items-center rounded-full text-slate-700 active:bg-slate-200 dark:text-slate-200 dark:active:bg-slate-800', className)}
    >
      {children}
    </button>
  )
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2 h-9 w-9 bg-slate-100 dark:bg-slate-800">
            <X size={18} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-slate-100 px-5 pt-3 dark:border-slate-800"><div className="pb-3">{footer}</div></div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border-0 bg-slate-100 px-3.5 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/20 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-white/20'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; activeClass?: string }[]
}) {
  return (
    <div className="grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            'min-h-10 rounded-lg px-2 text-[13px] font-semibold transition-colors',
            value === o.value
              ? o.activeClass ?? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
              : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium',
        active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      )}
    >
      {children}
    </button>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">{icon}</div>
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h2>
      {right}
    </div>
  )
}

export function Avatar({ name, archived }: { name: string; archived?: boolean }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <div
      className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white', archived && 'opacity-50')}
      style={{ background: `hsl(${h} 45% 48%)` }}
    >
      {initials || '?'}
    </div>
  )
}
