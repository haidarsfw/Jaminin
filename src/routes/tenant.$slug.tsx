import { PlusIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Choice, Dialog, EmptyState, ErrorState, LoadingState, Notice, PageHeader, Stepper } from '@/components/ui'
import { FavoriteButton } from '@/components/FavoriteButton'
import { addToCart, getCart } from '@/lib/cart'
import { clock, rupiah, todayWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { publicImage, rpc } from '@/lib/supabase'
import { soldOutBothDays, soldOutToday, useMenuStock, useTenant, type Group, type Item, type MenuStock, type TenantData } from '@/features/tenant'

export const Route = createFileRoute('/tenant/$slug')({
  component: TenantPage,
})

function TenantPage() {
  const { slug } = Route.useParams()
  const { t } = useTranslation()
  const lang = currentLang()
  const query = useTenant(slug)
  // Jam buka yang berlaku hari ini, termasuk jam khusus dan jam demo.
  const ranges = useQuery({
    queryKey: ['jam-buka', query.data?.id, todayWib()],
    enabled: !!query.data?.id,
    queryFn: () => rpc<{ open_time: string; close_time: string }[]>('tenant_day_ranges', { p_tenant: query.data!.id, p_date: todayWib() }),
  })
  const [selected, setSelected] = useState<Item | null>(null)
  const stock = useMenuStock(query.data?.id)

  const sections = useMemo(() => {
    const data = query.data
    if (!data) return []
    const items = data.menu_items.filter((i) => i.is_active).sort((a, b) => a.sort_order - b.sort_order)
    const cats = [...data.menu_categories].filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order)
    const result = cats.map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.category_id === c.id) }))
    const loose = items.filter((i) => !i.category_id || !cats.some((c) => c.id === i.category_id))
    if (loose.length) result.push({ id: 'lainnya', name: t('tenant.lainnya'), items: loose })
    return result.filter((s) => s.items.length > 0)
  }, [query.data, t])

  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />
  const tenant = query.data
  if (!tenant) return <EmptyState title={t('tenant.tidak_ada')} />

  const todayHours = ranges.data ?? []
  const paused = tenant.paused_indefinitely || (!!tenant.paused_until && new Date(tenant.paused_until) > new Date())

  return (
    <div>
      <PageHeader
        title={tenant.name}
        back={{ to: '/', label: t('umum.kembali') }}
        description={
          <>
            <span className="block">{tenant.kiosk_location}</span>
            <span className="block">
              {todayHours.length
                ? t('tenant.jam_hari_ini', { ranges: todayHours.map((h) => t('tenant.rentang', { open: clock(h.open_time, lang), close: clock(h.close_time, lang) })).join(', ') })
                : t('tenant.tutup_hari_ini')}
            </span>
          </>
        }
      />
      <div className="mb-4">
        <FavoriteButton target={{ tenant_id: tenant.id }} name={tenant.name} />
      </div>
      {tenant.is_sample && (
        <Notice className="mb-4" title={t('tenant.contoh_judul')}>
          {t('tenant.contoh_isi')}
        </Notice>
      )}
      {paused && (
        <Notice tone="warn" className="mb-4">
          {t('tenant.jeda')}
        </Notice>
      )}
      {tenant.announcement && (
        <Notice className="mb-4" title={t('tenant.pengumuman')}>
          {tenant.announcement}
        </Notice>
      )}

      {sections.length === 0 && <EmptyState title={t('tenant.menu_kosong')} />}

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`kat-${section.id}`}>
            <h2 id={`kat-${section.id}`} className="mb-2 text-lg font-bold">
              {section.name}
            </h2>
            <ul className="grid gap-2 md:grid-cols-2">
              {section.items.map((item) => {
                const soldOut = soldOutToday(item, stock.data)
                const gone = soldOutBothDays(item, stock.data)
                const photo = publicImage(item.photo_path)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      disabled={gone}
                      className="flex min-h-16 w-full items-start justify-between gap-3 rounded-xl border border-line-soft bg-surface p-3 text-left hover:border-line disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {photo && <img src={photo} alt="" className="size-16 shrink-0 rounded-lg object-cover" loading="lazy" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{item.name}</span>
                        {item.description && <span className="block text-sm text-muted">{item.description}</span>}
                        <span className="mt-1 block text-sm text-muted">
                          {[
                            t('tenant.menit', { count: item.prep_minutes }),
                            ...item.tags.map((tag) => t(`penanda.${tag}`)),
                            item.option_groups.length ? t('tenant.bisa_diatur') : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {soldOut && (
                          <span className="mt-1 block text-sm font-semibold text-danger">
                            {gone ? t('tenant.habis') : t('tenant.habis_hari_ini')}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block font-bold">{rupiah(item.price)}</span>
                        {tenant.is_sample && <span className="block text-xs text-muted">{t('tenant.harga_contoh')}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {selected && <ItemDialog item={selected} tenant={tenant} stock={stock.data} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ItemDialog({ item, tenant, stock, onClose }: { item: Item; tenant: TenantData; stock?: MenuStock; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const groups = [...item.option_groups].sort((a, b) => a.sort_order - b.sort_order)
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(groups.map((g) => [g.id, []])))
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const optionIds = Object.values(picked).flat()
  const allOptions = groups.flatMap((g) => g.options)
  const extra = optionIds.reduce((sum, id) => sum + (allOptions.find((o) => o.id === id)?.price_delta ?? 0), 0)
  const unitPrice = item.price + extra

  function toggle(group: Group, optionId: string, checked: boolean) {
    setPicked((prev) => {
      const current = prev[group.id] ?? []
      if (group.max_select === 1) return { ...prev, [group.id]: checked ? [optionId] : [] }
      if (checked && current.length >= group.max_select) return prev
      return { ...prev, [group.id]: checked ? [...current, optionId] : current.filter((id) => id !== optionId) }
    })
  }

  function add(): boolean {
    const missing = groups.find((g) => (picked[g.id]?.length ?? 0) < g.min_select)
    if (missing) {
      setError(t('tenant.pilih_dulu', { name: missing.name }))
      return false
    }
    const current = getCart()
    if (current && current.tenantId !== tenant.id && !window.confirm(t('keranjang.ganti_konfirmasi', { name: current.tenantName }))) return false
    addToCart(
      { id: tenant.id, slug: tenant.slug, name: tenant.name },
      {
        menuItemId: item.id,
        name: item.name,
        unitPrice,
        prepMinutes: item.prep_minutes,
        optionIds,
        optionLabels: optionIds.map((id) => allOptions.find((o) => o.id === id)?.name ?? ''),
        quantity,
      },
    )
    onClose()
    return true
  }

  return (
    <Dialog open onClose={onClose} title={item.name}>
      <div className="space-y-4">
        <p className="text-muted">
          {rupiah(item.price)} · {t('tenant.menit', { count: item.prep_minutes })}
        </p>
        <FavoriteButton target={{ menu_item_id: item.id }} name={item.name} />
        {soldOutToday(item, stock) && <Notice tone="warn">{t('tenant.habis_hari_ini_bisa_besok')}</Notice>}
        {groups.map((group) => (
          <fieldset key={group.id} className="space-y-2">
            <legend className="font-semibold">
              {group.name}{' '}
              <span className="text-sm font-normal text-muted">
                {group.min_select > 0 ? t('tenant.wajib') : t('umum.opsional')}
                {group.max_select > 1 ? `, ${t('tenant.maksimal', { count: group.max_select })}` : ''}
              </span>
            </legend>
            {[...group.options]
              .filter((o) => o.is_active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((option) => (
                <Choice
                  key={option.id}
                  type={group.max_select === 1 && group.min_select >= 1 ? 'radio' : 'checkbox'}
                  name={group.id}
                  value={option.id}
                  checked={(picked[group.id] ?? []).includes(option.id)}
                  onChange={(checked) => toggle(group, option.id, checked)}
                >
                  <span className="flex justify-between gap-2">
                    <span>{option.name}</span>
                    {option.price_delta > 0 && <span className="tabular text-muted">+{rupiah(option.price_delta)}</span>}
                  </span>
                </Choice>
              ))}
          </fieldset>
        ))}
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t('tenant.jumlah')}</span>
          <Stepper value={quantity} onChange={setQuantity} min={1} label={t('tenant.jumlah')} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button icon={<PlusIcon />} variant="primary" full onClick={add}>
          {t('tenant.tambah', { price: rupiah(unitPrice * quantity) })}
        </Button>
        <Button
          variant="quiet"
          full
          onClick={() => {
            if (add()) void navigate({ to: '/keranjang' })
          }}
        >
          {t('tenant.tambah_lalu_keranjang')}
        </Button>
      </div>
    </Dialog>
  )
}
