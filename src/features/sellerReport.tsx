import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState, ErrorState, LoadingState, Tabs } from '@/components/ui'
import { downloadCsv } from '@/lib/csv'
import { clock, dateLabel, nowWib, orderNo, rupiah, todayWib, wibDate } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { supabase, type Tables } from '@/lib/supabase'
import { itemLabel } from './kitchen'

type ReportOrder = Pick<
  Tables<'orders'>,
  'id' | 'order_number' | 'pickup_date' | 'pickup_time' | 'pickup_name' | 'status' | 'subtotal' | 'promo_discount' | 'service_fee' | 'seller_fee' | 'total_paid' | 'refunded_total'
> & { order_items: Pick<Tables<'order_items'>, 'name' | 'quantity' | 'status' | 'options'>[] }

type Day = { date: string; orders: ReportOrder[]; count: number; cancelled: number; sales: number; promo: number; fee: number; refunds: number }

const CANCELLED = new Set(['dibatalkan'])

function summarize(orders: ReportOrder[]): Day[] {
  const days = new Map<string, Day>()
  for (const o of orders) {
    const d = days.get(o.pickup_date) ?? { date: o.pickup_date, orders: [], count: 0, cancelled: 0, sales: 0, promo: 0, fee: 0, refunds: 0 }
    d.orders.push(o)
    if (CANCELLED.has(o.status)) d.cancelled += 1
    else {
      d.count += 1
      d.sales += o.subtotal
      d.promo += o.promo_discount
      d.fee += o.seller_fee
      d.refunds += o.refunded_total
    }
    days.set(o.pickup_date, d)
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

// Laporan penjualan harian, riwayat pesanan, dan rekap CSV untuk satu tenant.
export function SalesReport({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const [range, setRange] = useState<'7' | '30'>('7')
  const from = wibDate(subDays(nowWib(), Number(range) - 1))
  const to = todayWib()

  const orders = useQuery({
    queryKey: ['laporan', tenantId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, pickup_date, pickup_time, pickup_name, status, subtotal, promo_discount, service_fee, seller_fee, total_paid, refunded_total, order_items(name, quantity, status, options)')
        .eq('tenant_id', tenantId)
        .gte('pickup_date', from)
        .lte('pickup_date', to)
        .not('paid_at', 'is', null)
        .order('pickup_date', { ascending: false })
        .order('pickup_time')
        .limit(1000)
      if (error) throw error
      return data as ReportOrder[]
    },
  })
  const days = useMemo(() => summarize(orders.data ?? []), [orders.data])

  async function downloadOrders() {
    const rows = (orders.data ?? []).map((o) => [
      o.pickup_date,
      clock(o.pickup_time, 'id'),
      orderNo(o.order_number),
      o.pickup_name,
      t(`status.${o.status}`),
      o.order_items.filter((i) => i.status === 'normal').map((i) => `${i.quantity}x ${itemLabel(i)}`).join('; '),
      o.subtotal,
      o.promo_discount,
      o.service_fee,
      o.seller_fee,
      o.total_paid,
      o.refunded_total,
    ])
    downloadCsv(`rekap-pesanan-${tenantSlug}-${from}-${to}.csv`, [
      [t('laporan_penjual.k_tanggal'), t('laporan_penjual.k_jam'), t('laporan_penjual.k_nomor'), t('laporan_penjual.k_nama'), t('laporan_penjual.k_status'),
        t('laporan_penjual.k_isi'), t('laporan_penjual.k_subtotal'), t('laporan_penjual.k_promo'), t('laporan_penjual.k_biaya_layanan'),
        t('laporan_penjual.k_potongan'), t('laporan_penjual.k_dibayar'), t('laporan_penjual.k_uang_kembali')],
      ...rows,
    ])
  }

  async function downloadPayouts() {
    const { data, error } = await supabase
      .from('payouts')
      .select('payout_date, orders_count, gross_sales, promo_total, seller_fee_total, refunds_charged, amount, bank_name, account_number, sent_at')
      .eq('tenant_id', tenantId)
      .gte('payout_date', from)
      .lte('payout_date', to)
      .order('payout_date')
    if (error) throw error
    downloadCsv(`rekap-setoran-${tenantSlug}-${from}-${to}.csv`, [
      [t('laporan_penjual.k_tanggal'), t('laporan_penjual.k_jumlah_pesanan'), t('laporan_penjual.k_penjualan'), t('laporan_penjual.k_promo'),
        t('laporan_penjual.k_potongan'), t('laporan_penjual.k_uang_kembali_tim'), t('laporan_penjual.k_disetor'), t('laporan_penjual.k_rekening'), t('laporan_penjual.k_waktu')],
      ...data.map((p) => [p.payout_date, p.orders_count, p.gross_sales, p.promo_total, p.seller_fee_total, p.refunds_charged, p.amount,
        `${p.bank_name ?? ''} ${p.account_number ?? ''}`.trim(), p.sent_at]),
    ])
  }

  return (
    <section aria-labelledby="laporan-penjualan" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="laporan-penjualan" className="text-lg font-bold">
          {t('laporan_penjual.judul')}
        </h2>
        <Tabs
          label={t('laporan_penjual.rentang')}
          value={range}
          onChange={setRange}
          items={[
            { value: '7', label: t('laporan_penjual.hari', { count: 7 }) },
            { value: '30', label: t('laporan_penjual.hari', { count: 30 }) },
          ]}
        />
      </div>
      <p className="text-sm text-muted">{t('laporan_penjual.isi')}</p>
      <div className="flex flex-wrap gap-2">
        <Button small icon={<DownloadSimpleIcon />} disabled={!orders.data?.length} onClick={() => void downloadOrders()}>
          {t('laporan_penjual.unduh_pesanan')}
        </Button>
        <Button small icon={<DownloadSimpleIcon />} onClick={() => void downloadPayouts()}>
          {t('laporan_penjual.unduh_setoran')}
        </Button>
      </div>
      {orders.isPending && <LoadingState />}
      {orders.isError && <ErrorState onRetry={() => void orders.refetch()} />}
      {orders.isSuccess && days.length === 0 && <EmptyState title={t('laporan_penjual.kosong')} />}
      <ul className="space-y-2">
        {days.map((d) => (
          <li key={d.date}>
            <details className="rounded-xl border border-line-soft bg-surface p-4">
              <summary className="min-h-11 cursor-pointer py-2">
                <span className="font-semibold">{dateLabel(d.date, lang, t)}</span>
                <span className="text-muted">
                  {' · '}
                  {t('laporan_penjual.ringkas', { count: d.count, sales: rupiah(d.sales - d.promo) })}
                </span>
              </summary>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt>{t('laporan_penjual.penjualan')}</dt>
                <dd className="tabular text-right">{rupiah(d.sales)}</dd>
                <dt>{t('setoran.promo')}</dt>
                <dd className="tabular text-right">{rupiah(d.promo)}</dd>
                <dt>{t('setoran.potongan')}</dt>
                <dd className="tabular text-right">{rupiah(d.fee)}</dd>
                <dt>{t('laporan_penjual.uang_kembali_sebagian')}</dt>
                <dd className="tabular text-right">{rupiah(d.refunds)}</dd>
                <dt>{t('laporan_penjual.batal')}</dt>
                <dd className="tabular text-right">{d.cancelled}</dd>
              </dl>
              <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft text-sm">
                {d.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-1.5">
                    <span className="min-w-0 wrap-anywhere">
                      {orderNo(o.order_number)} {o.pickup_name} · {clock(o.pickup_time, lang)}
                    </span>
                    <span className="text-muted">
                      {t(`status.${o.status}`)} · <span className="tabular">{rupiah(o.subtotal - o.promo_discount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
