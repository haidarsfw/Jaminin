import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, Field, Input, LoadingState, Tabs } from '@/components/ui'
import { cleanQuery, useFavoriteMenus, useFavorites, useMenuSearch, type SearchHit } from '@/features/buyer'
import { rememberSlot } from '@/lib/cart'
import { clock, nowWib, rupiah, todayWib, tomorrowWib, type Lang } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc } from '@/lib/supabase'

export const Route = createFileRoute('/')({
  component: Home,
})

// Penanda menu yang dinyatakan penjual, sama dengan pilihan di halaman menu penjual.
const TAGS = ['pedas', 'vegetarian', 'dingin', 'panas', 'halal']

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

  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const search = useMenuSearch(query, tags)
  const q = cleanQuery(query).toLowerCase()
  const searching = q.length >= 2 || tags.length > 0
  const tenantById = useMemo(() => new Map((tenants.data ?? []).map((x) => [x.id, x])), [tenants.data])
  const matchedTenants = q.length >= 2 && tags.length === 0 ? sorted.filter((x) => x.name.toLowerCase().includes(q)) : []

  const favorites = useFavorites()
  const favTenantIds = new Set((favorites.data ?? []).flatMap((f) => (f.tenant_id ? [f.tenant_id] : [])))
  const favTenants = sorted.filter((x) => favTenantIds.has(x.id))
  const favMenus = useFavoriteMenus((favorites.data ?? []).flatMap((f) => (f.menu_item_id ? [f.menu_item_id] : [])))

  return (
    <div className="space-y-5">
      <section aria-labelledby="judul-beranda">
        <h1 id="judul-beranda" className="text-2xl font-bold">
          {t('beranda.judul')}
        </h1>
        <p className="mt-1 text-muted">{t('beranda.sub')}</p>
      </section>

      {(favTenants.length > 0 || (favMenus.data?.length ?? 0) > 0) && (
        <section aria-labelledby="judul-favorit" className="space-y-3">
          <h2 id="judul-favorit" className="text-lg font-bold">
            {t('favorit.judul')}
          </h2>
          {favTenants.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {favTenants.map((tenant) => (
                <li key={tenant.id}>
                  <TenantCard tenant={tenant} lang={lang} breakStatus={chosen ? statusByTenant.get(tenant.id) : undefined} />
                </li>
              ))}
            </ul>
          )}
          {(favMenus.data?.length ?? 0) > 0 && <MenuList items={favMenus.data ?? []} tenants={tenantById} lang={lang} />}
        </section>
      )}

      <section aria-labelledby="judul-cari" className="space-y-2">
        <h2 id="judul-cari" className="sr-only">
          {t('cari.judul')}
        </h2>
        <Field label={t('cari.label')}>
          {(p) => <Input id={p.id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} autoComplete="off" enterKeyHint="search" />}
        </Field>
        <div role="group" aria-label={t('cari.penanda')} className="flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const on = tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((prev) => (on ? prev.filter((x) => x !== tag) : [...prev, tag]))}
                className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
              >
                {t(`penanda.${tag}`)}
              </button>
            )
          })}
        </div>
      </section>

      {searching && (
        <section aria-labelledby="judul-hasil" className="space-y-3">
          <h2 id="judul-hasil" className="text-lg font-bold">
            {t('cari.hasil')}
          </h2>
          {matchedTenants.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matchedTenants.map((tenant) => (
                <li key={tenant.id}>
                  <TenantCard tenant={tenant} lang={lang} breakStatus={chosen ? statusByTenant.get(tenant.id) : undefined} />
                </li>
              ))}
            </ul>
          )}
          {search.isPending && <LoadingState />}
          {search.isError && <ErrorState onRetry={() => void search.refetch()} />}
          {search.isSuccess && search.data.length > 0 && <MenuList items={search.data} tenants={tenantById} lang={lang} />}
          {search.isSuccess && search.data.length === 0 && matchedTenants.length === 0 && <EmptyState title={t('cari.kosong')} body={t('cari.kosong_isi')} />}
        </section>
      )}

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

function earliestLabel(tenant: HomeTenant | undefined, t: (k: string, o?: Record<string, unknown>) => string, lang: Lang): string {
  if (!tenant?.earliest_time || !tenant.earliest_date) return t('beranda.tidak_ada_jam')
  return tenant.earliest_date === todayWib()
    ? t('beranda.paling_cepat', { time: clock(tenant.earliest_time, lang) })
    : t('beranda.paling_cepat_besok', { time: clock(tenant.earliest_time, lang) })
}

// Menu dari banyak tenant beserta jam ambil tercepat tenantnya. Dipakai hasil pencarian dan menu favorit.
function MenuList({ items, tenants, lang }: { items: (Pick<SearchHit, 'id' | 'name' | 'price' | 'tenant_id' | 'tenants'> & { tags?: string[] })[]; tenants: Map<string, HomeTenant>; lang: Lang }) {
  const { t } = useTranslation()
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to="/tenant/$slug"
            params={{ slug: item.tenants.slug }}
            className="flex h-full items-start justify-between gap-3 rounded-xl border border-line-soft bg-surface p-3 hover:border-line"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{item.name}</span>
              <span className="block text-sm text-muted">{item.tenants.name}</span>
              {item.tags && item.tags.length > 0 && <span className="block text-sm text-muted">{item.tags.map((tag) => t(`penanda.${tag}`)).join(' · ')}</span>}
              <span className="tabular mt-1 block text-sm font-semibold text-accent">{earliestLabel(tenants.get(item.tenant_id), t, lang)}</span>
            </span>
            <span className="tabular shrink-0 font-bold">{rupiah(item.price)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TenantCard({ tenant, lang, breakStatus }: { tenant: HomeTenant; lang: Lang; breakStatus?: SlotStatus }) {
  const { t } = useTranslation()
  const closeToday = tenant.today_ranges.length ? tenant.today_ranges[tenant.today_ranges.length - 1].close : null
  const earliest = earliestLabel(tenant, t, lang)

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
