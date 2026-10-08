import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Choice, Dialog, EmptyState, ErrorState, Field, Input, LoadingState, Notice, PageHeader, Select, StatusText, TextArea } from '@/components/ui'
import { useSeller } from '@/features/seller'
import { imageProblem, newKey, TagPicker, unusualNumbers, uploadTenantImage } from '@/features/tenantForm'
import { clock, dateLabel, orderNo, rupiah, todayWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { publicImage, rpc, supabase, toAppError, type Tables } from '@/lib/supabase'

export const Route = createFileRoute('/penjual/menu')({
  component: MenuPage,
})

type Option = Tables<'options'>
type Group = Tables<'option_groups'> & { options: Option[] }
type Item = Tables<'menu_items'> & { option_groups: Group[] }
type Affected = { order_id: string; order_number: number | null; pickup_date: string; pickup_time: string; order_item_id: string; quantity: number }

function useMenu(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['menu-saya', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [cats, items] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('tenant_id', tenantId!).order('sort_order'),
        supabase.from('menu_items').select('*, option_groups(*, options(*))').eq('tenant_id', tenantId!).order('sort_order'),
      ])
      if (cats.error) throw cats.error
      if (items.error) throw items.error
      return { categories: cats.data, items: items.data as Item[] }
    },
  })
}

function availability(item: Tables<'menu_items'>): 'tersedia' | 'hari_ini' | 'sampai_dibuka' {
  if (item.sold_out_indefinite) return 'sampai_dibuka'
  if (item.sold_out_date === todayWib()) return 'hari_ini'
  return 'tersedia'
}

function errorText(t: (k: string, o?: Record<string, unknown>) => string, e: unknown): string {
  return t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') })
}

function MenuPage() {
  const { t } = useTranslation()
  const { active, isOwner } = useSeller()
  const queryClient = useQueryClient()
  const menu = useMenu(active?.id)
  const [editing, setEditing] = useState<Item | 'baru' | null>(null)
  const [affected, setAffected] = useState<{ item: string; rows: Affected[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')

  if (!active) return null
  const tenantId = active.id
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['menu-saya', tenantId] })

  async function setAvailability(item: Item, mode: 'tersedia' | 'hari_ini' | 'sampai_dibuka') {
    setBusy(`${item.id}-${mode}`)
    setError(null)
    try {
      const rows = await rpc<Affected[] | null>('seller_set_menu_availability', { p_item: item.id, p_mode: mode })
      await refresh()
      if (rows && rows.length > 0) setAffected({ item: item.name, rows })
    } catch (e) {
      setError(errorText(t, e))
    } finally {
      setBusy(null)
    }
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    setBusy('kategori')
    setError(null)
    const max = Math.max(0, ...(menu.data?.categories ?? []).map((c) => c.sort_order))
    const { error: err } = await supabase.from('menu_categories').insert({ tenant_id: tenantId, name, sort_order: max + 1 })
    setBusy(null)
    if (err) setError(errorText(t, err))
    else {
      setNewCategory('')
      await refresh()
    }
  }

  async function renameCategory(cat: Tables<'menu_categories'>) {
    const name = window.prompt(t('menu.ubah_kategori'), cat.name)?.trim()
    if (!name || name === cat.name) return
    const { error: err } = await supabase.from('menu_categories').update({ name: name.slice(0, 40) }).eq('id', cat.id)
    if (err) setError(errorText(t, err))
    else await refresh()
  }

  async function deleteCategory(cat: Tables<'menu_categories'>) {
    if (!window.confirm(t('menu.hapus_kategori_tanya', { name: cat.name }))) return
    const { error: err } = await supabase.from('menu_categories').delete().eq('id', cat.id)
    if (err) setError(errorText(t, err))
    else await refresh()
  }

  const data = menu.data
  const sections = data
    ? [
        ...data.categories.map((c) => ({ cat: c as Tables<'menu_categories'> | null, items: data.items.filter((i) => i.category_id === c.id) })),
        { cat: null, items: data.items.filter((i) => !i.category_id || !data.categories.some((c) => c.id === i.category_id)) },
      ].filter((s) => s.cat || s.items.length > 0)
    : []

  return (
    <div className="space-y-4">
      <PageHeader title={t('menu.judul')} description={isOwner ? t('menu.sub_pemilik') : t('menu.sub_karyawan')} />
      {error && <Notice tone="error">{error}</Notice>}
      {isOwner && (
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="primary" onClick={() => setEditing('baru')}>
            {t('menu.tambah')}
          </Button>
          <form onSubmit={addCategory} className="flex w-full items-end gap-2 sm:w-auto">
            <div className="min-w-0 flex-1">
              <Field label={t('menu.kategori_baru')}>
                {(p) => <Input id={p.id} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={40} className="sm:w-48" />}
              </Field>
            </div>
            <Button type="submit" className="whitespace-nowrap" disabled={!newCategory.trim()} busy={busy === 'kategori'} busyText={t('umum.menyimpan')}>
              {t('menu.tambah_kategori')}
            </Button>
          </form>
        </div>
      )}

      {menu.isPending && <LoadingState />}
      {menu.isError && <ErrorState onRetry={() => void menu.refetch()} />}
      {data && data.items.length === 0 && <EmptyState title={t('menu.kosong')} body={isOwner ? t('menu.kosong_isi') : undefined} />}

      {sections.map(({ cat, items }) => (
        <section key={cat?.id ?? 'lainnya'} aria-labelledby={`kat-${cat?.id ?? 'lainnya'}`} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`kat-${cat?.id ?? 'lainnya'}`} className="text-lg font-bold">
              {cat?.name ?? t('tenant.lainnya')}
            </h2>
            {isOwner && cat && (
              <div className="flex gap-1">
                <Button small variant="quiet" onClick={() => void renameCategory(cat)}>
                  {t('menu.ubah_nama')}
                </Button>
                <Button small variant="quiet" onClick={() => void deleteCategory(cat)}>
                  {t('umum.hapus')}
                </Button>
              </div>
            )}
          </div>
          {items.length === 0 && <p className="text-sm text-muted">{t('menu.kategori_kosong')}</p>}
          <ul className="grid gap-2 lg:grid-cols-2">
            {items.map((item) => {
              const state = availability(item)
              const photo = publicImage(item.photo_path)
              return (
                <li key={item.id}>
                  <Card as="div" className="space-y-3">
                    <div className="flex gap-3">
                      {photo && <img src={photo} alt="" className="size-16 shrink-0 rounded-lg object-cover" loading="lazy" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="tabular text-sm text-muted">
                          {rupiah(item.price)} · {t('menu.menit', { count: item.prep_minutes })}
                          {item.daily_stock != null && ` · ${t('menu.stok_harian', { count: item.daily_stock })}`}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {!item.is_active && <StatusText>{t('menu.disembunyikan')}</StatusText>}
                          {state !== 'tersedia' && <StatusText tone="warn">{t(`menu.status_${state}`)}</StatusText>}
                          {item.option_groups.length > 0 && <StatusText>{t('menu.ada_pilihan', { count: item.option_groups.length })}</StatusText>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {state === 'tersedia' ? (
                        <>
                          <Button small busy={busy === `${item.id}-hari_ini`} busyText={t('umum.memproses')} onClick={() => void setAvailability(item, 'hari_ini')}>
                            {t('menu.habis_hari_ini')}
                          </Button>
                          <Button small busy={busy === `${item.id}-sampai_dibuka`} busyText={t('umum.memproses')} onClick={() => void setAvailability(item, 'sampai_dibuka')}>
                            {t('menu.habis_sampai_dibuka')}
                          </Button>
                        </>
                      ) : (
                        <Button small variant="primary" busy={busy === `${item.id}-tersedia`} busyText={t('umum.memproses')} onClick={() => void setAvailability(item, 'tersedia')}>
                          {t('menu.tersedia_lagi')}
                        </Button>
                      )}
                      {isOwner && (
                        <Button small variant="quiet" onClick={() => setEditing(item)}>
                          {t('menu.ubah')}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {editing && data && (
        <ItemDialog
          key={editing === 'baru' ? 'baru' : editing.id}
          tenantId={tenantId}
          item={editing === 'baru' ? null : editing}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={async (next) => {
            await refresh()
            if (next) {
              const fresh = (await queryClient.fetchQuery({ queryKey: ['menu-saya', tenantId] })) as { items: Item[] } | undefined
              const found = fresh?.items.find((i) => i.id === next)
              setEditing(found ?? null)
            } else setEditing(null)
          }}
        />
      )}

      {affected && <AffectedDialog itemName={affected.item} rows={affected.rows} onClose={() => setAffected(null)} />}
    </div>
  )
}

// Penjual melihat pesanan lunas yang berisi menu yang baru ditandai habis, lalu memberi tahu pembelinya.
function AffectedDialog({ itemName, rows, onClose }: { itemName: string; rows: Affected[]; onClose: () => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const queryClient = useQueryClient()
  const [done, setDone] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function flag(row: Affected) {
    setBusy(row.order_item_id)
    setError(null)
    try {
      await rpc('seller_flag_item_sold_out', { p_order_item: row.order_item_id })
      setDone((s) => new Set(s).add(row.order_item_id))
      void queryClient.invalidateQueries({ queryKey: ['papan'] })
    } catch (e) {
      setError(errorText(t, e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onClose={onClose} title={t('habis.judul', { name: itemName })}>
      <p className="text-sm">{t('habis.isi', { count: rows.length })}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.order_item_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft p-3">
            <span>
              <span className="font-semibold">{orderNo(row.order_number)}</span> · {dateLabel(row.pickup_date, lang, t)} {clock(row.pickup_time, lang)} · {row.quantity}×
            </span>
            {done.has(row.order_item_id) ? (
              <StatusText tone="success">{t('habis.sudah')}</StatusText>
            ) : (
              <Button small variant="primary" busy={busy === row.order_item_id} busyText={t('umum.memproses')} onClick={() => void flag(row)}>
                {t('habis.tandai')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <Button full className="mt-4" onClick={onClose}>
        {t('umum.selesai')}
      </Button>
    </Dialog>
  )
}

function ItemDialog({
  tenantId,
  item,
  categories,
  onClose,
  onSaved,
}: {
  tenantId: string
  item: Item | null
  categories: Tables<'menu_categories'>[]
  onClose: () => void
  onSaved: (keepOpenId: string | null) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [prep, setPrep] = useState(item ? String(item.prep_minutes) : '')
  const [category, setCategory] = useState(item?.category_id ?? categories[0]?.id ?? '')
  const [tags, setTags] = useState<string[]>(item?.tags ?? [])
  const [stock, setStock] = useState(item?.daily_stock != null ? String(item.daily_stock) : '')
  const [visible, setVisible] = useState(item?.is_active ?? true)
  const [photo, setPhoto] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmPrep, setConfirmPrep] = useState(false)

  async function save(e?: FormEvent, confirmed = false) {
    e?.preventDefault()
    const next: Record<string, string> = {}
    if (name.trim().length < 1) next.name = t('menu.galat_nama')
    if (price === '' || !(Number(price) >= 0)) next.price = t('daftar.galat_angka')
    if (prep === '' || !(Number(prep) >= 0)) next.prep = t('daftar.galat_angka')
    if (stock !== '' && !(Number(stock) >= 0)) next.stock = t('daftar.galat_angka')
    const pp = imageProblem(photo)
    if (pp) next.photo = t(`foto.galat_${pp}`)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    if (!confirmed && unusualNumbers({ preps: [Number(prep)] }).length > 0) {
      setConfirmPrep(true)
      return
    }
    setConfirmPrep(false)
    setBusy(true)
    setFailure(null)
    try {
      const fields = {
        name: name.trim(),
        description: description.trim() || null,
        price: Math.round(Number(price)),
        prep_minutes: Math.round(Number(prep)),
        category_id: category || null,
        tags,
        daily_stock: stock === '' ? null : Math.round(Number(stock)),
        is_active: visible,
      }
      let id = item?.id ?? null
      if (id) {
        const { error } = await supabase.from('menu_items').update(fields).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('menu_items').insert({ ...fields, tenant_id: tenantId, sort_order: 999 }).select('id').single()
        if (error) throw error
        id = data.id
      }
      if (photo && id) {
        const path = await uploadTenantImage(tenantId, photo, 'menu')
        const { error } = await supabase.from('menu_items').update({ photo_path: path }).eq('id', id)
        if (error) throw error
      }
      await onSaved(item ? null : id)
    } catch (err) {
      setFailure(errorText(t, err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item || !window.confirm(t('menu.hapus_tanya', { name: item.name }))) return
    setBusy(true)
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id)
    setBusy(false)
    if (error) setFailure(errorText(t, error))
    else await onSaved(null)
  }

  return (
    <Dialog open onClose={onClose} title={item ? t('menu.ubah_judul', { name: item.name }) : t('menu.tambah')}>
      <form onSubmit={(e) => void save(e)} noValidate className="space-y-3">
        <Field label={t('menu.nama')} error={errors.name}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
        </Field>
        <Field label={t('menu.deskripsi')} optional>
          {(p) => <TextArea id={p.id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="min-h-16" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('menu.harga')} error={errors.price}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />}
          </Field>
          <Field label={t('menu.lama')} error={errors.prep}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={0} inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />}
          </Field>
        </div>
        <Field label={t('daftar.kategori')}>
          {(p) => (
            <Select id={p.id} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('tenant.lainnya')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <TagPicker value={tags} onChange={setTags} />
        <Field label={t('menu.stok')} optional hint={t('menu.stok_isi')} error={errors.stock}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={0} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className="w-32" />}
        </Field>
        <Field label={t('menu.foto')} optional hint={t('foto.isi')} error={errors.photo}>
          {(p) => (
            <input
              id={p.id}
              aria-describedby={p.describedBy}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block min-h-12 w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:font-semibold"
            />
          )}
        </Field>
        <Choice type="checkbox" name="tampil" value="tampil" checked={visible} onChange={setVisible}>
          {t('menu.tampilkan')}
        </Choice>
        {confirmPrep && (
          <Notice tone="warn" title={t('angka.judul')}>
            <p>{t('angka.prep')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button small onClick={() => setConfirmPrep(false)}>
                {t('angka.periksa_lagi')}
              </Button>
              <Button small variant="primary" onClick={() => void save(undefined, true)}>
                {t('angka.sudah_benar')}
              </Button>
            </div>
          </Notice>
        )}
        {failure && <Notice tone="error">{failure}</Notice>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="submit" variant="primary" full busy={busy} busyText={t('umum.menyimpan')}>
            {t('umum.simpan')}
          </Button>
          {item && (
            <Button variant="danger" full onClick={() => void remove()} disabled={busy}>
              {t('menu.hapus')}
            </Button>
          )}
        </div>
      </form>
      {item ? (
        <OptionGroups item={item} onChanged={() => onSaved(item.id)} />
      ) : (
        <p className="mt-4 text-sm text-muted">{t('menu.pilihan_setelah_simpan')}</p>
      )}
    </Dialog>
  )
}

type DraftOption = { key: string; id?: string; name: string; price: string }
type DraftGroup = { key: string; id?: string; name: string; min: string; max: string; options: DraftOption[] }

function toDraft(g: Group): DraftGroup {
  return {
    key: g.id,
    id: g.id,
    name: g.name,
    min: String(g.min_select),
    max: String(g.max_select),
    options: [...g.options].sort((a, b) => a.sort_order - b.sort_order).map((o) => ({ key: o.id, id: o.id, name: o.name, price: String(o.price_delta) })),
  }
}

// Kelompok pilihan disimpan per kelompok supaya perubahan kecil tidak menunggu formulir besar.
function OptionGroups({ item, onChanged }: { item: Item; onChanged: () => Promise<void> }) {
  const { t } = useTranslation()
  const [drafts, setDrafts] = useState<DraftGroup[]>(() => [...item.option_groups].sort((a, b) => a.sort_order - b.sort_order).map(toDraft))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const patch = (key: string, next: Partial<DraftGroup>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...next } : d)))

  async function saveGroup(d: DraftGroup, index: number) {
    const min = Number(d.min)
    const max = Number(d.max)
    if (!d.name.trim() || !(min >= 0) || !(max >= 1) || max < min || d.options.length === 0 || d.options.some((o) => !o.name.trim() || !(Number(o.price) >= 0) || o.price === '')) {
      setError(t('pilihan.galat'))
      return
    }
    setBusy(d.key)
    setError(null)
    try {
      let groupId = d.id
      const fields = { name: d.name.trim(), min_select: min, max_select: max, sort_order: index + 1 }
      if (groupId) {
        const { error: e } = await supabase.from('option_groups').update(fields).eq('id', groupId)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('option_groups').insert({ ...fields, item_id: item.id }).select('id').single()
        if (e) throw e
        groupId = data.id
      }
      const original = item.option_groups.find((g) => g.id === groupId)?.options ?? []
      const keep = new Set(d.options.filter((o) => o.id).map((o) => o.id))
      const removed = original.filter((o) => !keep.has(o.id)).map((o) => o.id)
      if (removed.length) {
        const { error: e } = await supabase.from('options').delete().in('id', removed)
        if (e) throw e
      }
      for (const [i, o] of d.options.entries()) {
        const row = { name: o.name.trim(), price_delta: Math.round(Number(o.price)), sort_order: i + 1 }
        const { error: e } = o.id ? await supabase.from('options').update(row).eq('id', o.id) : await supabase.from('options').insert({ ...row, group_id: groupId! })
        if (e) throw e
      }
      const { data: fresh, error: e } = await supabase.from('options').select('*').eq('group_id', groupId!).order('sort_order')
      if (e) throw e
      patch(d.key, { id: groupId, options: fresh.map((o) => ({ key: o.id, id: o.id, name: o.name, price: String(o.price_delta) })) })
      await onChanged()
    } catch (e) {
      setError(errorText(t, e))
    } finally {
      setBusy(null)
    }
  }

  async function removeGroup(d: DraftGroup) {
    if (d.id) {
      if (!window.confirm(t('pilihan.hapus_tanya', { name: d.name }))) return
      setBusy(d.key)
      const { error: e } = await supabase.from('option_groups').delete().eq('id', d.id)
      setBusy(null)
      if (e) {
        setError(errorText(t, e))
        return
      }
      await onChanged()
    }
    setDrafts((ds) => ds.filter((x) => x.key !== d.key))
  }

  return (
    <section aria-labelledby="pilihan-judul" className="mt-6 space-y-3 border-t border-line-soft pt-4">
      <h3 id="pilihan-judul" className="font-bold">
        {t('pilihan.judul')}
      </h3>
      <p className="text-sm text-muted">{t('pilihan.isi')}</p>
      {drafts.map((d, index) => (
        <fieldset key={d.key} className="space-y-2 rounded-lg border border-line-soft p-3">
          <legend className="sr-only">{d.name || t('pilihan.baru')}</legend>
          <label className="block text-sm">
            <span className="block font-medium">{t('pilihan.nama')}</span>
            <Input value={d.name} onChange={(e) => patch(d.key, { name: e.target.value })} maxLength={40} placeholder={t('pilihan.contoh')} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="block font-medium">{t('pilihan.min')}</span>
              <Input type="number" min={0} value={d.min} onChange={(e) => patch(d.key, { min: e.target.value })} className="w-24" />
            </label>
            <label className="text-sm">
              <span className="block font-medium">{t('pilihan.maks')}</span>
              <Input type="number" min={1} value={d.max} onChange={(e) => patch(d.key, { max: e.target.value })} className="w-24" />
            </label>
          </div>
          <p className="text-sm text-muted">{Number(d.min) >= 1 ? t('pilihan.wajib') : t('pilihan.tidak_wajib')}</p>
          <ul className="space-y-2">
            {d.options.map((o, oi) => (
              <li key={o.key} className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{t('pilihan.opsi', { n: oi + 1 })}</span>
                  <Input value={o.name} onChange={(e) => patch(d.key, { options: d.options.map((x) => (x.key === o.key ? { ...x, name: e.target.value } : x)) })} maxLength={40} />
                </label>
                <label className="text-sm">
                  <span className="block font-medium">{t('pilihan.tambahan_harga')}</span>
                  <Input type="number" min={0} inputMode="numeric" value={o.price} onChange={(e) => patch(d.key, { options: d.options.map((x) => (x.key === o.key ? { ...x, price: e.target.value } : x)) })} className="w-28" />
                </label>
                <Button small variant="quiet" onClick={() => patch(d.key, { options: d.options.filter((x) => x.key !== o.key) })}>
                  {t('umum.hapus')}
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button small onClick={() => patch(d.key, { options: [...d.options, { key: newKey(), name: '', price: '0' }] })}>
              {t('pilihan.tambah_opsi')}
            </Button>
            <Button small variant="primary" busy={busy === d.key} busyText={t('umum.menyimpan')} onClick={() => void saveGroup(d, index)}>
              {t('pilihan.simpan')}
            </Button>
            <Button small variant="quiet" onClick={() => void removeGroup(d)}>
              {t('pilihan.hapus')}
            </Button>
          </div>
        </fieldset>
      ))}
      {error && <Notice tone="error">{error}</Notice>}
      <Button small onClick={() => setDrafts((ds) => [...ds, { key: newKey(), name: '', min: '0', max: '1', options: [{ key: newKey(), name: '', price: '0' }] }])}>
        {t('pilihan.tambah')}
      </Button>
    </section>
  )
}
