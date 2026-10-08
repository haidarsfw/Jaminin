import { useQuery } from '@tanstack/react-query'
import { todayWib } from '@/lib/format'
import { supabase, type Tables } from '@/lib/supabase'

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

export function soldOutToday(item: Tables<'menu_items'>): boolean {
  return item.sold_out_indefinite || item.sold_out_date === todayWib()
}

