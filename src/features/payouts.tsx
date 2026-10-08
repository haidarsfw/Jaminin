import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ErrorState, LoadingState } from '@/components/ui'
import { clockFromDate, dateLabel, longDate, orderNo, rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc, type Tables } from '@/lib/supabase'

type Details = {
  orders: { order_id: string; number: number | null; pickup_date: string; status: string; subtotal: number; promo: number; seller_fee: number; share: number }[]
  refunds: { order_id: string; number: number | null; pickup_date: string; amount: number; manual: boolean }[]
}

export function usePayoutDetails(id: string | null) {
  return useQuery({
    queryKey: ['rincian-setoran', id],
    enabled: !!id,
    queryFn: () => rpc<Details>('payout_details', { p_payout: id }),
  })
}

export function PayoutCard({ payout, tenantName }: { payout: Tables<'payouts'>; tenantName?: string }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const [open, setOpen] = useState(false)
  const details = usePayoutDetails(open ? payout.id : null)
  return (
    <Card as="div" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {tenantName && <p className="text-sm font-semibold text-muted">{tenantName}</p>}
          <p className="font-semibold">{dateLabel(payout.payout_date, lang, t)}</p>
          <p className="text-sm text-muted">
            {t('setoran.terkirim', { time: clockFromDate(payout.sent_at, lang) })}
            {payout.is_sample && ` · ${t('umum.contoh')}`}
          </p>
        </div>
        <p className="tabular text-xl font-bold">{rupiah(payout.amount)}</p>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>{t('setoran.penjualan', { count: payout.orders_count })}</dt>
        <dd className="tabular text-right">{rupiah(payout.gross_sales)}</dd>
        {payout.promo_total > 0 && (
          <>
            <dt>{t('setoran.promo')}</dt>
            <dd className="tabular text-right">−{rupiah(payout.promo_total)}</dd>
          </>
        )}
        <dt>{t('setoran.potongan')}</dt>
        <dd className="tabular text-right">−{rupiah(payout.seller_fee_total)}</dd>
        {payout.refunds_charged > 0 && (
          <>
            <dt>{t('setoran.uang_kembali')}</dt>
            <dd className="tabular text-right">−{rupiah(payout.refunds_charged)}</dd>
          </>
        )}
        <dt className="font-semibold">{t('setoran.ke_rekening', { bank: payout.bank_name ?? '-', number: payout.account_number ?? '-' })}</dt>
        <dd className="tabular text-right font-semibold">{rupiah(payout.amount)}</dd>
      </dl>
      <Button small variant="quiet" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? t('setoran.tutup_rincian') : t('setoran.lihat_rincian')}
      </Button>
      {open && details.isPending && <LoadingState />}
      {open && details.isError && <ErrorState onRetry={() => void details.refetch()} />}
      {open && details.data && (
        <div className="space-y-3 text-sm">
          <ul className="divide-y divide-line-soft">
            {details.data.orders.map((o) => (
              <li key={o.order_id} className="flex justify-between gap-3 py-1.5">
                <span>
                  {orderNo(o.number)} · {t(`status.${o.status}`)}
                  {o.promo > 0 && ` · ${t('setoran.promo_baris', { amount: rupiah(o.promo) })}`}
                </span>
                <span className="tabular">{rupiah(o.share)}</span>
              </li>
            ))}
          </ul>
          {details.data.refunds.length > 0 && (
            <ul className="divide-y divide-line-soft">
              {details.data.refunds.map((r, i) => (
                <li key={`${r.order_id}-${i}`} className="flex justify-between gap-3 py-1.5">
                  <span>{r.manual ? t('setoran.baris_tim', { number: orderNo(r.number) }) : t('setoran.baris_aturan', { number: orderNo(r.number), date: longDate(r.pickup_date, lang) })}</span>
                  <span className="tabular">−{rupiah(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
