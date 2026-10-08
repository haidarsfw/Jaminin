import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTopic } from '@/lib/realtime'
import { supabase, type Tables } from '@/lib/supabase'

export type OrderItem = Tables<'order_items'>
export type OrderFull = Tables<'orders'> & {
  tenants: { name: string; slug: string; whatsapp: string; is_sample: boolean; kiosk_location: string } | null
  order_items: OrderItem[]
  refunds: Tables<'refunds'>[]
  reports: (Tables<'reports'> & { report_replies: Tables<'report_replies'>[] })[]
  ratings: { thumbs_up: boolean; comment: string | null } | null
}

export const ACTIVE = ['menunggu_bayar', 'diterima', 'disiapkan', 'siap'] as const

export function useOrder(orderId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['pesanan', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, tenants(name, slug, whatsapp, is_sample, kiosk_location), order_items(*), refunds(*), reports(*, report_replies(*)), ratings(thumbs_up, comment)')
        .eq('id', orderId)
        .maybeSingle()
      if (error) throw error
      if (data) cachePickup(data as OrderFull)
      return data as OrderFull | null
    },
    refetchInterval: (q) => {
      const status = q.state.data?.status
      if (status === 'menunggu_bayar') return 3_000
      return status && ACTIVE.includes(status as (typeof ACTIVE)[number]) ? 15_000 : false
    },
  })
  useTopic(`order:${orderId}`, ['order', 'items'], () => {
    void queryClient.invalidateQueries({ queryKey: ['pesanan', orderId] })
    void queryClient.invalidateQueries({ queryKey: ['pesanan-saya'] })
  })
  return query
}

// Kode ambil disimpan di perangkat supaya tetap bisa dibuka tanpa sinyal.
export type CachedPickup = {
  id: string
  number: number | null
  code: string | null
  tenant: string
  pickupDate: string
  pickupTime: string
  status: string
}

const CACHE_KEY = 'jaminin:kode-ambil'

function readCache(): Record<string, CachedPickup> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CachedPickup>
  } catch {
    return {}
  }
}

export function cachePickup(order: OrderFull): void {
  if (!order.pickup_code) return
  const all = readCache()
  all[order.id] = {
    id: order.id,
    number: order.order_number,
    code: order.pickup_code,
    tenant: order.tenants?.name ?? '',
    pickupDate: order.pickup_date,
    pickupTime: order.pickup_time,
    status: order.status,
  }
  const entries = Object.values(all).sort((a, b) => `${b.pickupDate}${b.pickupTime}`.localeCompare(`${a.pickupDate}${a.pickupTime}`))
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, 10).map((e) => [e.id, e]))))
  } catch {
    // Penyimpanan penuh atau diblokir: kode tetap tampil selama halaman terbuka.
  }
}

export function cachedPickup(orderId: string): CachedPickup | null {
  return readCache()[orderId] ?? null
}

export function statusKey(order: Pick<Tables<'orders'>, 'status' | 'end_reason'>): string {
  if (order.status === 'kedaluwarsa' && order.end_reason === 'dibatalkan_pembeli') return 'dibatalkan_sebelum_bayar'
  return order.status
}

export function pickupQr(order: Pick<Tables<'orders'>, 'id' | 'pickup_code'>): string {
  return `JMN1:${order.id}:${order.pickup_code ?? ''}`
}

export function parsePickupQr(text: string): { orderId: string; code: string } | null {
  const m = /^JMN1:([0-9a-f-]{36}):([A-Z0-9]{4})$/i.exec(text.trim())
  return m ? { orderId: m[1], code: m[2].toUpperCase() } : null
}

export function parsePaymentQr(text: string): string | null {
  const m = /^JMNPAY:([A-Z0-9]{6})$/i.exec(text.trim())
  return m ? m[1].toUpperCase() : null
}
