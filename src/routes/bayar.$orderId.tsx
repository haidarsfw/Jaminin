import { QrCodeIcon, ReceiptIcon } from '@phosphor-icons/react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { Button, ButtonLink, Card, EmptyState, ErrorState, LoadingState, Notice, PageHeader, useNow } from '@/components/ui'
import { useOrder } from '@/features/orders'
import { clearCart } from '@/lib/cart'
import { clock, dateLabel, mmss, rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc, toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/bayar/$orderId')({
  component: () => (
    <RequireAuth needProfile={false}>
      <PayPage />
    </RequireAuth>
  ),
})

function PayPage() {
  const { orderId } = Route.useParams()
  const { t } = useTranslation()
  const lang = currentLang()
  const navigate = useNavigate()
  const order = useOrder(orderId)
  const now = useNow(1000)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = order.data?.status
  useEffect(() => {
    if (status && status !== 'menunggu_bayar' && status !== 'kedaluwarsa') {
      clearCart()
      const id = window.setTimeout(() => void navigate({ to: '/pesanan/$orderId', params: { orderId }, replace: true }), 1500)
      return () => window.clearTimeout(id)
    }
  }, [status, navigate, orderId])

  if (order.isPending) return <LoadingState />
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />
  const o = order.data
  if (!o) return <EmptyState title={t('pesanan.tidak_ada')} />

  const secondsLeft = Math.max(0, Math.floor((new Date(o.pay_deadline).getTime() - now) / 1000))
  const expired = o.status === 'kedaluwarsa' || (o.status === 'menunggu_bayar' && secondsLeft === 0)

  if (o.status !== 'menunggu_bayar' && o.status !== 'kedaluwarsa') {
    return (
      <div className="mx-auto max-w-md">
        <Notice tone="success" title={t('bayar.lunas')}>
          {t('bayar.lunas_isi')}
        </Notice>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader title={o.end_reason === 'dibatalkan_pembeli' ? t('bayar.dibatalkan') : t('bayar.habis')} />
        <p>{o.end_reason === 'dibatalkan_pembeli' ? t('bayar.dibatalkan_isi') : t('bayar.habis_isi')}</p>
        <ButtonLink to="/checkout" variant="primary" full>
          {t('bayar.pilih_jam_lagi')}
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t('bayar.judul')} description={t('bayar.sub', { tenant: o.tenants?.name ?? '' })} />
      <Card className="space-y-4 text-center">
        <p className="text-sm text-muted">{t('bayar.total')}</p>
        <p className="tabular text-3xl font-bold">{rupiah(o.total_paid)}</p>
        <div className="mx-auto w-fit rounded-lg bg-white p-3">
          <QRCodeSVG value={`JMNPAY:${o.payment_code}`} size={208} level="M" aria-label={t('bayar.qr_label')} />
        </div>
        <p className="text-sm font-semibold">{t('bayar.qr_simulasi')}</p>
        <div>
          <p className="text-sm text-muted">{t('bayar.kode')}</p>
          <p className="font-mono text-3xl font-bold tracking-[0.2em]">{o.payment_code}</p>
        </div>
        <p className="tabular text-lg font-semibold" role="timer" aria-live="off">
          {t('bayar.sisa_waktu', { time: mmss(secondsLeft) })}
        </p>
        <p className="text-sm text-muted">
          {t('bayar.jam_ambil', { day: dateLabel(o.pickup_date, lang, t), time: clock(o.pickup_time, lang) })}
        </p>
      </Card>
      <Notice>{t('bayar.cara_demo')}</Notice>
      <a href={`/simulator-bayar?kode=${o.payment_code}`} target="_blank" rel="noreferrer" className="block text-center font-semibold text-accent underline underline-offset-4">
        <QrCodeIcon />
        {t('bayar.buka_simulator')}
      </a>
      {error && <Notice tone="error">{error}</Notice>}
      <Button
        variant="danger"
        full
        busy={cancelling}
        busyText={t('umum.memproses')}
        onClick={async () => {
          if (!window.confirm(t('bayar.batal_konfirmasi'))) return
          setCancelling(true)
          setError(null)
          try {
            await rpc('buyer_cancel_order', { p_order: o.id })
            await order.refetch()
          } catch (e) {
            setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
          } finally {
            setCancelling(false)
          }
        }}
      >
        {t('bayar.batal')}
      </Button>
      <Link to="/pesanan" className="block text-center text-sm text-muted underline underline-offset-4">
        <ReceiptIcon />
        {t('bayar.ke_pesanan')}
      </Link>
    </div>
  )
}
