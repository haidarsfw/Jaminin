import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addToCart, getCart } from '@/lib/cart'
import { useAuth } from '@/lib/auth'
import { rpc, supabase, type Tables } from '@/lib/supabase'
import { soldOutBothDays, soldOutToday, type Item, type MenuStock } from './tenant'

// Favorit ------------------------------------------------------------------------------------------

export type Favorite = { id: string; tenant_id: string | null; menu_item_id: string | null }

export function useFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['favorit', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('favorites').select('id, tenant_id, menu_item_id').order('created_at')
      if (error) throw error
      return data as Favorite[]
    },
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  return async (target: { tenant_id: string } | { menu_item_id: string }, current: Favorite | undefined) => {
    const { error } = current
      ? await supabase.from('favorites').delete().eq('id', current.id)
      : await supabase.from('favorites').insert('tenant_id' in target ? { tenant_id: target.tenant_id } : { menu_item_id: target.menu_item_id })
    await queryClient.invalidateQueries({ queryKey: ['favorit'] })
    if (error) throw error
  }
}

export type FavoriteMenu = Pick<Tables<'menu_items'>, 'id' | 'name' | 'price' | 'tenant_id'> & { tenants: { slug: string; name: string } }

// Menu favorit beserta tenantnya, hanya yang masih dijual tenant yang disetujui.
export function useFavoriteMenus(ids: string[]) {
  return useQuery({
    queryKey: ['favorit-menu', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, tenant_id, tenants!inner(slug, name)')
        .in('id', ids)
        .eq('is_active', true)
        .eq('tenants.status', 'disetujui')
      if (error) throw error
      return data as unknown as FavoriteMenu[]
    },
  })
}

// Pencarian menu lintas tenant -------------------------------------------------------------------

export type SearchHit = Pick<Tables<'menu_items'>, 'id' | 'name' | 'price' | 'tags' | 'tenant_id' | 'sold_out_indefinite' | 'sold_out_date'> & {
  tenants: { slug: string; name: string }
}

// Karakter pola LIKE dibuang supaya isian pembeli dicari apa adanya.
export function cleanQuery(query: string): string {
  return query.replace(/[%_*\\,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function useMenuSearch(query: string, tags: string[]) {
  const q = cleanQuery(query)
  const active = q.length >= 2 || tags.length > 0
  return useQuery({
    queryKey: ['cari-menu', q, tags.join(',')],
    enabled: active,
    queryFn: async () => {
      let request = supabase
        .from('menu_items')
        .select('id, name, price, tags, tenant_id, sold_out_indefinite, sold_out_date, tenants!inner(slug, name)')
        .eq('is_active', true)
        .eq('tenants.status', 'disetujui')
        .order('name')
        .limit(30)
      if (q.length >= 2) request = request.ilike('name', `%${q}%`)
      if (tags.length > 0) request = request.contains('tags', tags)
      const { data, error } = await request
      if (error) throw error
      return data as unknown as SearchHit[]
    },
  })
}

// Pesan ulang ------------------------------------------------------------------------------------

export type ReorderNote = { name: string; kind: 'tidak_tersedia' | 'pilihan_berubah' | 'habis' | 'habis_hari_ini' | 'harga_berubah'; from?: number; to?: number }
export type ReorderResult = { tenantId: string; number: number | null; notes: ReorderNote[]; added: number }

const REORDER_KEY = 'jaminin:pesan-ulang'

type OrderLine = Pick<Tables<'order_items'>, 'menu_item_id' | 'name' | 'quantity' | 'unit_price' | 'status' | 'options'>
type ReorderTenant = Pick<Tables<'tenants'>, 'id' | 'slug' | 'name' | 'status'> & { menu_items: Item[] }

// Isi pesanan lama dimasukkan lagi ke keranjang dengan harga dan pilihan yang berlaku sekarang.
export async function reorder(order: { tenant_id: string; order_number: number | null; order_items: OrderLine[] }, confirmReplace: (name: string) => boolean): Promise<ReorderResult | null> {
  const [{ data: tenant, error }, stock] = await Promise.all([
    supabase.from('tenants').select('id, slug, name, status, menu_items(*, option_groups(*, options(*)))').eq('id', order.tenant_id).maybeSingle(),
    rpc<MenuStock>('menu_stock', { p_tenant: order.tenant_id }).catch(() => [] as MenuStock),
  ])
  if (error) throw error
  const current = getCart()
  if (current && current.tenantId !== order.tenant_id && !confirmReplace(current.tenantName)) return null
  const result: ReorderResult = { tenantId: order.tenant_id, number: order.order_number, notes: [], added: 0 }
  const data = tenant as ReorderTenant | null
  for (const line of order.order_items) {
    if (line.status !== 'normal' || !line.menu_item_id) continue
    const menu = data?.status === 'disetujui' ? data.menu_items.find((m) => m.id === line.menu_item_id) : undefined
    if (!menu || !menu.is_active) {
      result.notes.push({ name: line.name, kind: 'tidak_tersedia' })
      continue
    }
    if (soldOutBothDays(menu, stock)) {
      result.notes.push({ name: menu.name, kind: 'habis' })
      continue
    }
    const optionIds = (Array.isArray(line.options) ? (line.options as { option_id?: string }[]) : []).flatMap((o) => (o.option_id ? [o.option_id] : []))
    const options = menu.option_groups.flatMap((g) => g.options.filter((o) => o.is_active).map((o) => ({ ...o, group: g })))
    const picked = optionIds.map((id) => options.find((o) => o.id === id))
    const groupsOk = menu.option_groups.every((g) => {
      const n = picked.filter((o) => o?.group.id === g.id).length
      return n >= g.min_select && n <= g.max_select
    })
    if (picked.some((o) => !o) || !groupsOk) {
      result.notes.push({ name: menu.name, kind: 'pilihan_berubah' })
      continue
    }
    const unitPrice = menu.price + picked.reduce((sum, o) => sum + (o?.price_delta ?? 0), 0)
    if (unitPrice !== line.unit_price) result.notes.push({ name: menu.name, kind: 'harga_berubah', from: line.unit_price, to: unitPrice })
    if (soldOutToday(menu, stock)) result.notes.push({ name: menu.name, kind: 'habis_hari_ini' })
    addToCart(
      { id: data!.id, slug: data!.slug, name: data!.name },
      {
        menuItemId: menu.id,
        name: menu.name,
        unitPrice,
        prepMinutes: menu.prep_minutes,
        optionIds,
        optionLabels: picked.map((o) => o?.name ?? ''),
        quantity: line.quantity,
      },
    )
    result.added += 1
  }
  if (result.added > 0) {
    try {
      sessionStorage.setItem(REORDER_KEY, JSON.stringify(result))
    } catch {
      // Tanpa penyimpanan, tanda pesan ulang tidak ditampilkan di keranjang.
    }
  }
  return result
}

export function reorderNotes(tenantId: string | undefined): ReorderResult | null {
  try {
    const raw = sessionStorage.getItem(REORDER_KEY)
    const data = raw ? (JSON.parse(raw) as ReorderResult) : null
    return data && data.tenantId === tenantId ? data : null
  } catch {
    return null
  }
}

export function forgetReorderNotes(): void {
  try {
    sessionStorage.removeItem(REORDER_KEY)
  } catch {
    // Tidak ada yang perlu dihapus.
  }
}
