import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, Field, FoodPhoto, Input, LoadingState, Select } from '@/components/ui'
import { cleanQuery, useFavoriteMenus, useFavorites, useMenuSearch, type SearchHit } from '@/features/buyer'
import { allDay } from '@/features/tenant'
import { forgetSlot, recalledSlot, rememberSlot } from '@/lib/cart'
import { clock, nowWib, rupiah, todayWib, tomorrowWib, type Lang } from '@/lib/format'
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

type Chosen = { date: string; time: string; tomorrow: boolean }

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`

// Pilihan jam di beranda tiap 15 menit dalam rentang buka tenant hari ini (07.00 sampai 17.00 kalau semua tutup).
// Jam pastinya tiap 5 menit dipilih di checkout, mulai dari jam ini atau jam terdekat sesudahnya.
function pickupChoices(tenants: HomeTenant[]): { date: string; tomorrow: boolean; times: string[] }[] {
  const ranges = tenants.flatMap((x) => x.today_ranges)
  const open = ranges.length ? Math.min(...ranges.map((r) => toMinutes(r.open))) : 7 * 60
  const close = ranges.length ? Math.max(...ranges.map((r) => toMinutes(r.close))) : 17 * 60
  const now = nowWib()
  const steps = (from: number) => {
    const out: string[] = []
    for (let m = Math.ceil(from / 15) * 15; m <= close - 5; m += 15) out.push(toClock(m))
    return out
  }
  return [
    { date: todayWib(), tomorrow: false, times: steps(Math.max(open, now.getHours() * 60 + now.getMinutes() + 15)) },
    { date: tomorrowWib(), tomorrow: true, times: steps(open) },
  ].filter((g) => g.times.length > 0)
}

function Home() {
  const { t } = useTranslation()
  const lang = currentLang()
  const [sort, setSort] = useState<'cepat' | 'abjad'>('cepat')
  // Jam yang sudah dipilih tetap tampil saat kembali ke beranda, karena checkout juga memakainya.
  const [chosen, setChosen] = useState<Chosen | null>(() => {
    const r = recalledSlot()
    return r && (r.date === todayWib() || r.date === tomorrowWib()) ? { ...r, tomorrow: r.date !== todayWib() } : null
  })

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

  const choices = pickupChoices(tenants.data ?? [])

  function choose(value: string) {
    if (!value) {
      setChosen(null)
      forgetSlot()
      return
    }
    const [date, time] = value.split('|')
    setChosen({ date, time, tomorrow: date !== todayWib() })
    rememberSlot(date, time)
  }

  const sorted = useMemo(() => {
    const list = [...(tenants.data ?? [])]
    if (sort === 'abjad') return list.sort((a, b) => a.name.localeCompare(b.name))
    const key = (x: HomeTenant) => (x.earliest_date && x.earliest_time ? `${x.earliest_date} ${x.earliest_time}` : '9999')
    return list.sort((a, b) => key(a).localeCompare(key(b)) || a.name.localeCompare(b.name))
  }, [tenants.data, sort])

  const [query, setQuery] = useState('')
  const search = useMenuSearch(query, [])
  const q = cleanQuery(query).toLowerCase()
  const searching = q.length >= 2
  const tenantById = useMemo(() => new Map((tenants.data ?? []).map((x) => [x.id, x])), [tenants.data])
  const matchedTenants = q.length >= 2 ? sorted.filter((x) => x.name.toLowerCase().includes(q)) : []

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

      <section aria-labelledby="judul-cari" className="space-y-3">
        <h2 id="judul-cari" className="sr-only">
          {t('cari.judul')}
        </h2>
        <div className="relative">
          <MagnifyingGlassIcon size={20} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            aria-label={t('cari.label')}
            placeholder={t('cari.label')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={60}
            autoComplete="off"
            enterKeyHint="search"
            className="pl-10"
          />
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

      <section className="sm:max-w-sm">
        <Field
          label={t('beranda.jam_istirahat')}
          hint={chosen ? t('beranda.jam_dipilih', { time: clock(chosen.time, lang), day: chosen.tomorrow ? t('waktu.besok_kecil') : t('waktu.hari_ini_kecil') }) : undefined}
        >
          {(p) => (
            <Select id={p.id} aria-describedby={p.describedBy} value={chosen ? `${chosen.date}|${chosen.time}` : ''} onChange={(e) => choose(e.target.value)} className="tabular">
              <option value="">{t('beranda.secepatnya')}</option>
              {choices.map((g) => (
                <optgroup key={g.date} label={g.tomorrow ? t('waktu.besok') : t('waktu.hari_ini')}>
                  {g.times.map((time) => (
                    <option key={time} value={`${g.date}|${time}`}>
                      {clock(time, lang)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
      </section>

      <section aria-labelledby="judul-tenant" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="judul-tenant" className="text-lg font-bold">
            {t('beranda.daftar_tenant')}
          </h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            {t('beranda.urutan')}
            <span className="block w-40">
              <Select value={sort} onChange={(e) => setSort(e.target.value as 'cepat' | 'abjad')}>
                <option value="cepat">{t('beranda.urut_cepat')}</option>
                <option value="abjad">{t('beranda.urut_abjad')}</option>
              </Select>
            </span>
          </label>
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
            className="flex h-full items-start gap-3 rounded-xl border border-line-soft bg-surface p-3 transition hover:border-line active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{item.name}</span>
              <span className="block text-sm text-muted">{item.tenants.name}</span>
              {item.tags && item.tags.length > 0 && <span className="block text-sm text-muted">{item.tags.map((tag) => t(`penanda.${tag}`)).join(' · ')}</span>}
              <span className="tabular block text-sm text-muted">{earliestLabel(tenants.get(item.tenant_id), t, lang)}</span>
              <span className="tabular mt-1 block font-bold">{rupiah(item.price)}</span>
            </span>
            <FoodPhoto className="size-16" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Kartu tenant: nama dan isi jualannya lebih dulu, lalu status buka dan jam ambil tercepat sebagai keterangan,
// dengan foto di kanan seperti daftar restoran di GoFood dan GrabFood. Fotonya masih tempat kosong.
function TenantCard({ tenant, lang, breakStatus }: { tenant: HomeTenant; lang: Lang; breakStatus?: SlotStatus }) {
  const { t } = useTranslation()
  const ranges = tenant.today_ranges
  const last = ranges.length ? ranges[ranges.length - 1] : null
  const status = tenant.paused
    ? t('beranda.jeda')
    : tenant.open_now && last
      ? allDay(ranges[0].open, last.close)
        ? t('beranda.buka_24_jam')
        : t('beranda.buka_sampai', { time: clock(last.close, lang) })
      : t('beranda.tutup_sekarang')

  return (
    <Link to="/tenant/$slug" params={{ slug: tenant.slug }} className="flex h-full items-start gap-3 rounded-xl border border-line-soft bg-surface p-4 transition hover:border-line active:scale-[0.99]">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold">{tenant.name}</h3>
        <p className="line-clamp-2 text-sm text-muted">{tenant.description || tenant.kiosk_location}</p>
        <p className="tabular mt-2 text-sm">
          <span className={tenant.open_now && !tenant.paused ? 'font-semibold text-accent' : 'font-semibold'}>{status}</span>
          <span className="text-muted"> · {earliestLabel(tenant, t, lang)}</span>
        </p>
        {breakStatus && (
          <p className="mt-1 text-sm font-semibold">
            {breakStatus.status === 'tersedia' ? t('beranda.bisa_jam_ini', { count: breakStatus.remaining }) : t(`jam.status.${breakStatus.status}`)}
          </p>
        )}
      </div>
      <FoodPhoto className="size-20" />
    </Link>
  )
}
