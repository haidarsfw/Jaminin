import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { Button, ButtonLink, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { statusKey, useOrder } from '@/features/orders'
import { clock, clockFromDate, longDate, orderNo, rupiah, wibDate } from '@/lib/format'
import { currentLang } from '@/lib/i18n'

export const Route = createFileRoute('/struk/$orderId')({
  component: () => (
    <RequireAuth needProfile={false}>
      <ReceiptPage />
    </RequireAuth>
  ),
})

// Struk digital (P1 B23): rincian pembayaran yang bisa dilihat dan disimpan sebagai PDF lewat jendela cetak.
function ReceiptPage() {
  const { orderId } = Route.useParams()
  const { t } = useTranslation()
  const lang = currentLang()
  const order = useOrder(orderId)

  if (order.isPending) return <LoadingState />
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />
  const o = order.data
  if (!o || !o.paid_at) return <EmptyState title={t('struk.tidak_ada')} />

  const number = orderNo(o.order_number)
  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 ${strong ? 'font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular text-right">{value}</dd>
    </div>
  )

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <ButtonLink to="/pesanan/$orderId" params={{ orderId: o.id }} small variant="quiet">
          {t('struk.kembali')}
        </ButtonLink>
        <Button small variant="primary" onClick={() => window.print()}>
          {t('struk.unduh')}
        </Button>
      </div>
      <p className="text-sm text-muted print:hidden">{t('struk.unduh_isi')}</p>

      <Card as="article" className="space-y-4 print:border-0 print:p-0">
        <header className="space-y-1 border-b border-line-soft pb-3">
          <p className="text-xl font-extrabold">Jaminin</p>
          <h1 className="text-lg font-bold">{t('struk.judul', { number })}</h1>
        </header>

        <dl className="space-y-1 text-sm">
          {line(t('struk.tenant'), o.tenants?.name ?? '')}
          {line(t('struk.jam_ambil'), `${longDate(o.pickup_date, lang)}, ${clock(o.pickup_time, lang)}`)}
          {line(t('struk.pengambil'), o.pickup_name)}
          {line(t('struk.dibayar_pada'), `${longDate(wibDate(o.paid_at), lang)}, ${clockFromDate(o.paid_at, lang)}`)}
          {line(t('struk.kode_bayar'), o.payment_code ?? '')}
          {line(t('struk.status'), t(`status.${statusKey(o)}`))}
        </dl>

        <ul className="space-y-2 border-t border-line-soft pt-3 text-sm">
          {o.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span className={item.status === 'dihapus' || item.status === 'diganti' ? 'text-muted line-through' : ''}>
                {item.quantity}x {item.name}
                {Array.isArray(item.options) && item.options.length > 0 && (
                  <span className="block text-muted">{(item.options as { name: string }[]).map((x) => x.name).join(', ')}</span>
                )}
              </span>
              <span className="tabular shrink-0">{rupiah(item.line_total)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-line-soft pt-3 text-sm">
          {line(t('uang.subtotal'), rupiah(o.subtotal))}
          {o.promo_discount > 0 && line(t('uang.potongan_promo'), `-${rupiah(o.promo_discount)}`)}
          {line(t('uang.biaya_layanan'), rupiah(o.service_fee))}
          {line(t('uang.dibayar'), rupiah(o.total_paid), true)}
          {o.refunded_total > 0 && line(t('uang.uang_kembali'), rupiah(o.refunded_total), true)}
        </dl>
        {o.refunds.length > 0 && (
          <ul className="space-y-1 text-sm text-muted">
            {o.refunds.map((r) => (
              <li key={r.id}>
                {rupiah(r.amount)}: {t(`alasan.${r.reason_code}`, { defaultValue: r.reason_code })}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line-soft pt-3 text-xs text-muted">{t('struk.catatan_simulasi')}</p>
      </Card>
    </div>
  )
}
