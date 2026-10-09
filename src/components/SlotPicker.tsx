import { BellIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { clock, todayWib, tomorrowWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc, supabase, toAppError } from '@/lib/supabase'
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
      {!blocked && <Waitlist tenantId={tenantId} date={date} maxPrep={maxPrep} full={visible.filter((s) => s.status === 'penuh')} />}
    </div>
  )
}

// Jam penuh bisa ditunggu: kalau kuotanya terlepas, semua yang menunggu dikabari bersamaan (usulan U18).
function Waitlist({ tenantId, date, maxPrep, full }: { tenantId: string; date: string; maxPrep: number; full: Slot[] }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mine = useQuery({
    queryKey: ['daftar-tunggu', user?.id, tenantId, date],
    enabled: !!user && full.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('waitlist').select('id, pickup_time').eq('tenant_id', tenantId).eq('pickup_date', date)
      if (error) throw error
      return data
    },
  })
  if (!user || !profile?.profile_completed_at || full.length === 0) return null

  async function toggle(time: string) {
    setBusy(time)
    setError(null)
    try {
      const row = mine.data?.find((w) => w.pickup_time === time)
      if (row) {
        const { error } = await supabase.from('waitlist').delete().eq('id', row.id)
        if (error) throw error
      } else {
        await rpc('join_waitlist', { p_tenant: tenantId, p_date: date, p_time: time, p_max_prep: maxPrep })
      }
      await queryClient.invalidateQueries({ queryKey: ['daftar-tunggu'] })
    } catch (e) {
      setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
      await queryClient.invalidateQueries({ queryKey: ['jam'] })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2 border-t border-line-soft pt-3">
      <p className="text-sm font-semibold">{t('tunggu.judul')}</p>
      <p className="text-sm text-muted">{t('tunggu.isi')}</p>
      <div role="group" aria-label={t('tunggu.judul')} className="flex flex-wrap gap-2">
        {full.map((s) => {
          const on = !!mine.data?.some((w) => w.pickup_time === s.slot_time)
          return (
            <button
              key={s.slot_time}
              type="button"
              aria-pressed={on}
              aria-label={t('tunggu.label', { time: clock(s.slot_time, lang) })}
              disabled={busy === s.slot_time || mine.isPending}
              onClick={() => void toggle(s.slot_time)}
              className={`tabular inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
            >
              <BellIcon size={18} weight={on ? 'fill' : 'regular'} />
              {clock(s.slot_time, lang)}
            </button>
          )
        })}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
