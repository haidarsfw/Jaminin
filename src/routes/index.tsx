import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, LoadingState, Tabs } from '@/components/ui'
import { rememberSlot } from '@/lib/cart'
import { clock, nowWib, todayWib, tomorrowWib, type Lang } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc } from '@/lib/supabase'

export const Route = createFileRoute('/')({
  component: Home,
})

type HomeTenant = {
  id: string
  slug: string
  name: string
  description: string | null
  kiosk_location: string
  is_sample: boolean
  announcement: string | null
  open_now: boolean
  paused: boolean
  today_ranges: { open: string; close: string }[]
  earliest_date: string | null
  earliest_time: string | null
  fastest_prep: number | null
}

type SlotStatus = { tenant_id: string; status: string; remaining: number }

// Jeda kuliah jatuh pada jam 9, 11, 13, 15, 17, dan 19, kelas berikutnya mulai 20 menit kemudian.
const BREAKS = ['09:05', '11:05', '13:05', '15:05', '17:05', '19:05']

function breakTarget(time: string): { date: string; time: string; tomorrow: boolean } {
  const now = nowWib()
  const [h, m] = time.split(':').map(Number)
  const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m
  return { date: passed ? tomorrowWib() : todayWib(), time: `${time}:00`, tomorrow: passed }
}

function Home() {
  const { t } = useTranslation()
  const lang = currentLang()
  const [sort, setSort] = useState<'cepat' | 'abjad'>('cepat')
  const [chosen, setChosen] = useState<{ date: string; time: string; tomorrow: boolean } | null>(null)

  const tenants = useQuery({
    queryKey: ['beranda'],
    queryFn: () => rpc<HomeTenant[]>('home_tenants'),
    refetchInterval: 60_000,
  })

  const slotStatus = useQuery({
    queryKey: ['jam-istirahat', chosen?.date, chosen?.time],
    enabled: !!chosen,
    queryFn: () => rpc<SlotStatus[]>('slot_status_all', { p_date: chosen!.date, p_time: chosen!.time }),
  })

  const statusByTenant = useMemo(() => new Map((slotStatus.data ?? []).map((s) => [s.tenant_id, s])), [slotStatus.data])

  // Jam istirahat yang masih bisa hari ini tampil lebih dulu, sisanya untuk besok.
  const breakTargets = BREAKS.map(breakTarget).sort((a, b) => Number(a.tomorrow) - Number(b.tomorrow) || a.time.localeCompare(b.time))

  const sorted = useMemo(() => {
    const list = [...(tenants.data ?? [])]
    if (sort === 'abjad') return list.sort((a, b) => a.name.localeCompare(b.name))
    const key = (x: HomeTenant) => (x.earliest_date && x.earliest_time ? `${x.earliest_date} ${x.earliest_time}` : '9999')
    return list.sort((a, b) => key(a).localeCompare(key(b)) || a.name.localeCompare(b.name))
  }, [tenants.data, sort])

  return (
    <div className="space-y-5">
      <section aria-labelledby="judul-beranda">
        <h1 id="judul-beranda" className="text-2xl font-bold">
          {t('beranda.judul')}
        </h1>
        <p className="mt-1 text-muted">{t('beranda.sub')}</p>
      </section>

      <section aria-labelledby="judul-istirahat" className="space-y-2">
        <h2 id="judul-istirahat" className="text-sm font-semibold">
          {t('beranda.jam_istirahat')}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {breakTargets.map((target) => {
            const active = chosen?.time === target.time && chosen?.date === target.date
            return (
              <button
                key={target.time}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (active) {
                    setChosen(null)
                    return
                  }
                  setChosen(target)
                  rememberSlot(target.date, target.time)
                }}
                className={`tabular min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold ${
                  active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'
                }`}
              >
                {clock(target.time, lang)}
                {target.tomorrow ? ` ${t('waktu.besok_kecil')}` : ''}
              </button>
            )
          })}
        </div>
        {chosen && (
          <p className="text-sm text-muted" role="status">
            {t('beranda.jam_dipilih', { time: clock(chosen.time, lang), day: chosen.tomorrow ? t('waktu.besok_kecil') : t('waktu.hari_ini_kecil') })}
          </p>
        )}
      </section>

      <section aria-labelledby="judul-tenant" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="judul-tenant" className="text-lg font-bold">
            {t('beranda.daftar_tenant')}
          </h2>
          <Tabs
            label={t('beranda.urutan')}
            value={sort}
            onChange={setSort}
            items={[
              { value: 'cepat', label: t('beranda.urut_cepat') },
              { value: 'abjad', label: t('beranda.urut_abjad') },
            ]}
          />
        </div>

        {tenants.isPending && <LoadingState />}
        {tenants.isError && <ErrorState onRetry={() => void tenants.refetch()} />}
        {tenants.isSuccess && sorted.length === 0 && <EmptyState title={t('beranda.kosong')} body={t('beranda.kosong_isi')} />}

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((tenant) => (
            <li key={tenant.id}>
              <TenantCard tenant={tenant} lang={lang} breakStatus={chosen ? statusByTenant.get(tenant.id) : undefined} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function TenantCard({ tenant, lang, breakStatus }: { tenant: HomeTenant; lang: Lang; breakStatus?: SlotStatus }) {
  const { t } = useTranslation()
  const closeToday = tenant.today_ranges.length ? tenant.today_ranges[tenant.today_ranges.length - 1].close : null
  const earliest =
    tenant.earliest_time && tenant.earliest_date
      ? tenant.earliest_date === todayWib()
        ? t('beranda.paling_cepat', { time: clock(tenant.earliest_time, lang) })
        : t('beranda.paling_cepat_besok', { time: clock(tenant.earliest_time, lang) })
      : t('beranda.tidak_ada_jam')

  return (
    <Link
      to="/tenant/$slug"
      params={{ slug: tenant.slug }}
      className="block h-full rounded-xl border border-line-soft bg-surface p-4 hover:border-line"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold">{tenant.name}</h3>
        {tenant.is_sample && <span className="shrink-0 text-xs text-muted">{t('umum.data_contoh')}</span>}
      </div>
      <p className="text-sm text-muted">{tenant.kiosk_location}</p>
      <p className="mt-3 text-lg font-bold text-accent tabular">{earliest}</p>
      <p className="text-sm text-muted">
        {tenant.paused
          ? t('beranda.jeda')
          : tenant.open_now && closeToday
            ? t('beranda.buka_sampai', { time: clock(closeToday, lang) })
            : t('beranda.tutup_sekarang')}
      </p>
      {breakStatus && (
        <p className="mt-2 text-sm font-semibold">
          {breakStatus.status === 'tersedia'
            ? t('beranda.bisa_jam_ini', { count: breakStatus.remaining })
            : t(`jam.status.${breakStatus.status}`)}
        </p>
      )}
    </Link>
  )
}
