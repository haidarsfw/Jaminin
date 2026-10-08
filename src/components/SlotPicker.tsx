import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { clock, todayWib, tomorrowWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc } from '@/lib/supabase'
import { ErrorState, LoadingState, Notice, Tabs } from './ui'

export type Slot = {
  slot_time: string
  status: string
  remaining: number
  quota: number
  promo_id: string | null
  promo_kind: 'persen' | 'rupiah' | null
  promo_value: number | null
}

export function useSlots(tenantId: string | undefined, date: string, maxPrep: number) {
  return useQuery({
    queryKey: ['jam', tenantId, date, maxPrep],
    enabled: !!tenantId,
    queryFn: () => rpc<Slot[]>('get_slots', { p_tenant: tenantId, p_date: date, p_max_prep: maxPrep }),
    refetchInterval: 30_000,
  })
}

// Daftar jam ambil 5 menit: hari ini atau besok, dengan sisa kuota dan tanda promo.
export function SlotPicker({
  tenantId,
  maxPrep,
  date,
  onDateChange,
  value,
  onChange,
  disableToday,
}: {
  tenantId: string
  maxPrep: number
  date: string
  onDateChange: (d: string) => void
  value: string | null
  onChange: (time: string, slot: Slot) => void
  disableToday?: boolean
}) {
  const { t } = useTranslation()
  const lang = currentLang()
  const slots = useSlots(tenantId, date, maxPrep)
  const visible = (slots.data ?? []).filter((s) => s.status !== 'lewat')
  const blocked = visible.length > 0 && visible.every((s) => s.status === 'jeda' || s.status === 'batas_harian') ? visible[0].status : null

  return (
    <div className="space-y-3">
      <Tabs
        label={t('jam.hari')}
        value={date}
        onChange={onDateChange}
        items={[
          ...(disableToday ? [] : [{ value: todayWib(), label: t('waktu.hari_ini') }]),
          { value: tomorrowWib(), label: t('waktu.besok') },
        ]}
      />
      {slots.isPending && <LoadingState text={t('jam.memuat')} />}
      {slots.isError && <ErrorState onRetry={() => void slots.refetch()} />}
      {slots.isSuccess && visible.length === 0 && <Notice>{t('jam.tidak_ada')}</Notice>}
      {blocked && <Notice tone="warn">{t(`jam.status.${blocked}`)}</Notice>}
      {visible.length > 0 && !blocked && (
        <div role="radiogroup" aria-label={t('jam.pilih')} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((s) => {
            const available = s.status === 'tersedia'
            const selected = value === s.slot_time
            return (
              <button
                key={s.slot_time}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!available}
                onClick={() => onChange(s.slot_time, s)}
                className={`tabular flex min-h-14 flex-col items-center justify-center rounded-lg border px-1 text-center ${
                  selected
                    ? 'border-accent bg-accent text-on-accent'
                    : available
                      ? 'border-line bg-surface'
                      : 'border-line-soft bg-canvas text-muted line-through'
                }`}
              >
                <span className="font-bold">{clock(s.slot_time, lang)}</span>
                <span className="text-xs">
                  {available ? t('jam.sisa', { count: s.remaining }) : t(`jam.status_singkat.${s.status}`)}
                  {available && s.promo_value ? ` · ${s.promo_kind === 'persen' ? `-${s.promo_value}%` : t('jam.promo')}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
