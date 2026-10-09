import { useQuery } from '@tanstack/react-query'
import { todayWib, tomorrowWib } from '@/lib/format'
import { rpc, supabase, type Tables } from '@/lib/supabase'

export type Option = Tables<'options'>
export type Group = Tables<'option_groups'> & { options: Option[] }
export type Item = Tables<'menu_items'> & { option_groups: Group[] }
export type TenantData = Tables<'tenants'> & {
  menu_categories: Tables<'menu_categories'>[]
  menu_items: Item[]
  tenant_hours: Tables<'tenant_hours'>[]
}

export function useTenant(slug: string) {
  return useQuery({
    queryKey: ['tenant', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*, menu_categories(*), menu_items(*, option_groups(*, options(*))), tenant_hours(*)')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw error
      return data as TenantData | null
    },
  })
}

export type MenuStock = { menu_item_id: string; pickup_date: string; remaining: number }[]

// Sisa stok harian untuk hari ini dan besok, hanya menu yang punya stok harian.
export function useMenuStock(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['stok', tenantId],
    enabled: !!tenantId,
    queryFn: () => rpc<MenuStock>('menu_stock', { p_tenant: tenantId }),
    refetchInterval: 30_000,
  })
}

function noStock(stock: MenuStock | undefined, itemId: string, date: string): boolean {
  return !!stock?.some((s) => s.menu_item_id === itemId && s.pickup_date === date && s.remaining <= 0)
}

export function soldOutToday(item: Tables<'menu_items'>, stock?: MenuStock): boolean {
  return item.sold_out_indefinite || item.sold_out_date === todayWib() || noStock(stock, item.id, todayWib())
}

// Habis untuk hari ini dan besok, jadi menu itu tidak bisa dipesan sama sekali.
export function soldOutBothDays(item: Tables<'menu_items'>, stock?: MenuStock): boolean {
  const tomorrow = tomorrowWib()
  return item.sold_out_indefinite || (soldOutToday(item, stock) && (item.sold_out_date === tomorrow || noStock(stock, item.id, tomorrow)))
}

