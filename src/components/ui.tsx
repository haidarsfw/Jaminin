import { ArrowLeftIcon, CheckCircleIcon, InfoIcon, MinusIcon, PlusIcon, WarningCircleIcon, WarningIcon, XIcon, type Icon } from '@phosphor-icons/react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// Komponen dasar draf tampilan. Satu radius untuk kontrol (8px) dan satu untuk kartu (12px).
// Semua target sentuh minimal 44px.

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet'

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent border border-accent hover:brightness-110',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  danger: 'bg-surface text-danger border border-danger hover:bg-danger-soft',
  quiet: 'bg-transparent text-accent border border-transparent underline-offset-4 hover:underline',
}

export function buttonClass(variant: Variant = 'secondary', full = false, small = false, large = false): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
    small ? 'min-h-11 px-3 text-sm' : large ? 'min-h-14 px-5 text-lg' : 'min-h-12 px-4 text-base',
    full ? 'w-full' : '',
    variantClass[variant],
  ].join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  full?: boolean
  small?: boolean
  // Tombol besar untuk layar dapur yang dipakai dengan tangan sibuk.
  large?: boolean
  busy?: boolean
  busyText?: string
  icon?: ReactNode
}

export function Button({ variant = 'secondary', full, small, large, busy, busyText, icon, children, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${buttonClass(variant, full, small, large)} ${className}`} disabled={busy || rest.disabled} aria-busy={busy || undefined} {...rest}>
      {icon}
      {busy && busyText ? busyText : children}
    </button>
  )
}

export function ButtonLink({ variant = 'secondary', full, small, icon, className = '', children, ...props }: LinkProps & { variant?: Variant; full?: boolean; small?: boolean; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link {...props} className={`${buttonClass(variant, full, small)} ${className}`}>
      {icon}
      {children}
    </Link>
  )
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'li' }) {
  return <As className={`rounded-xl border border-line-soft bg-surface p-4 ${className}`}>{children}</As>
}

export function PageHeader({ title, description, back }: { title: string; description?: ReactNode; back?: { to: LinkProps['to']; params?: LinkProps['params']; label: string } }) {
  return (
    <header className="mb-4">
      {back && (
        <Link to={back.to} params={back.params} className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline">
          <ArrowLeftIcon size={18} />
          {back.label}
        </Link>
      )}
      <h1 className="text-2xl font-bold leading-tight">{title}</h1>
      {description && <div className="mt-1 text-muted">{description}</div>}
    </header>
  )
}

type Tone = 'info' | 'warn' | 'error' | 'success'

const toneClass: Record<Tone, string> = {
  info: 'bg-canvas border-line-soft text-ink',
  warn: 'bg-warn-bg border-warn-ink/40 text-warn-ink',
  error: 'bg-danger-soft border-danger/40 text-danger',
  success: 'bg-accent-soft border-accent/40 text-ink',
}

// Ikon ikut membedakan nada, supaya status tidak hanya dibedakan lewat warna.
const toneIcon: Record<Tone, Icon> = { info: InfoIcon, warn: WarningIcon, error: WarningCircleIcon, success: CheckCircleIcon }

export function Notice({ tone = 'info', title, children, className = '' }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const ToneIcon = toneIcon[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg border p-3 text-sm ${toneClass[tone]} ${className}`}>
      <ToneIcon size={20} weight={tone === 'info' ? 'regular' : 'fill'} className="shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  )
}

export function LoadingState({ text }: { text?: string }) {
  const { t } = useTranslation()
  return (
    <p role="status" className="py-8 text-center text-muted">
      {text ?? t('umum.memuat')}
    </p>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-4">
      <p className="font-semibold text-danger">{t('umum.gagal_memuat')}</p>
      <p className="mt-1 text-sm text-ink">{message ?? t('galat.network')}</p>
      {onRetry && (
        <Button className="mt-3" small onClick={onRetry}>
          {t('umum.coba_lagi')}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {body && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

const controlClass =
  'block w-full rounded-lg border border-line bg-surface px-3 text-base text-ink placeholder:text-muted disabled:opacity-60 aria-[invalid=true]:border-danger'

export function Field({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}) {
  const id = useId()
  const { t } = useTranslation()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> ({t('umum.opsional')})</span>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className = '', ...rest } = props
  return <input {...rest} aria-invalid={invalid || undefined} className={`${controlClass} min-h-12 ${className}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  const { invalid, className = '', ...rest } = props
  return <textarea {...rest} aria-invalid={invalid || undefined} className={`${controlClass} min-h-24 py-2 ${className}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  const { invalid, className = '', ...rest } = props
  return <select {...rest} aria-invalid={invalid || undefined} className={`${controlClass} min-h-12 ${className}`} />
}

export function Choice({
  name,
  value,
  checked,
  onChange,
  type = 'radio',
  children,
  disabled,
}: {
  name: string
  value: string
  checked: boolean
  onChange: (checked: boolean) => void
  type?: 'radio' | 'checkbox'
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
        checked ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-[var(--c-accent)]"
      />
      <span className="flex-1">{children}</span>
    </label>
  )
}

export function Stepper({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className={buttonClass('secondary', false, true) + ' w-11 px-0'} aria-label={t('umum.kurangi')} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <MinusIcon size={18} weight="bold" />
      </button>
      <span className="tabular w-8 text-center font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" className={buttonClass('secondary', false, true) + ' w-11 px-0'} aria-label={t('umum.tambah')} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <PlusIcon size={18} weight="bold" />
      </button>
    </div>
  )
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { t } = useTranslation()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-line-soft bg-surface p-0 text-ink"
    >
      {open && (
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className={buttonClass('quiet', false, true)}>
              <XIcon size={18} />
              {t('umum.tutup')}
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={`min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold ${
            value === item.value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function StatusText({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  const cls =
    tone === 'success'
      ? 'bg-accent-soft text-ink'
      : tone === 'warn'
        ? 'bg-warn-bg text-warn-ink'
        : tone === 'error'
          ? 'bg-danger-soft text-danger'
          : 'bg-canvas text-ink'
  return <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold ${cls}`}>{children}</span>
}
