import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { ButtonLink, EmptyState, ErrorState, LoadingState, PageHeader, StatusText } from '@/components/ui'
import { ACTIVE, statusKey } from '@/features/orders'
import { useAuth } from '@/lib/auth'
import { clock, dateLabel, monthLabel, orderNo, rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { supabase, type Enums } from '@/lib/supabase'

export const Route = createFileRoute('/pesanan/')({
  component: () => (
    <RequireAuth needProfile={false}>
      <OrdersPage />
    </RequireAuth>
  ),
})

type Row = {
  id: string
  status: Enums<'status_pesanan'>
  end_reason: string | null
  order_number: number | null
  pickup_date: string
  pickup_time: string
  total_paid: number
  refunded_total: number
  needs_buyer_action: boolean
  tenants: { name: string } | null
}

function OrdersPage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const orders = useQuery({
    queryKey: ['pesanan-saya', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, end_reason, order_number, pickup_date, pickup_time, total_paid, refunded_total, needs_buyer_action, tenants(name)')
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Row[]
    },
  })

  useTopic(user ? `user:${user.id}` : null, ['order'], () => {
    void queryClient.invalidateQueries({ queryKey: ['pesanan-saya'] })
    void queryClient.invalidateQueries({ queryKey: ['pengeluaran'] })
  })

  // Pengeluaran per bulan ambil: yang dibayar dikurangi uang kembali. Pesanan yang batal tidak dihitung sebagai pesanan.
  const spending = useQuery({
    queryKey: ['pengeluaran', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('pickup_date, total_paid, refunded_total, status')
        .eq('buyer_id', user!.id)
        .not('paid_at', 'is', null)
      if (error) throw error
      const months = new Map<string, { amount: number; count: number }>()
      for (const o of data) {
        const key = o.pickup_date.slice(0, 7)
        const m = months.get(key) ?? { amount: 0, count: 0 }
        m.amount += o.total_paid - o.refunded_total
        if (o.status !== 'dibatalkan') m.count += 1
        months.set(key, m)
      }
      return [...months.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
    },
  })

  if (orders.isPending) return <LoadingState />
  if (orders.isError) return <ErrorState onRetry={() => void orders.refetch()} />

  const active = orders.data.filter((o) => ACTIVE.includes(o.status as (typeof ACTIVE)[number]))
  const history = orders.data.filter((o) => !ACTIVE.includes(o.status as (typeof ACTIVE)[number]))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('pesanan.judul')} />
      <section aria-labelledby="aktif" className="space-y-2">
        <h2 id="aktif" className="text-lg font-bold">
          {t('pesanan.aktif')}
        </h2>
        {active.length === 0 ? (
          <EmptyState
            title={t('pesanan.aktif_kosong')}
            body={t('pesanan.aktif_kosong_isi')}
            action={
              <ButtonLink to="/" variant="primary">
                {t('keranjang.pilih_tenant')}
              </ButtonLink>
            }
          />
        ) : (
          <OrderList rows={active} lang={lang} />
        )}
      </section>
      {history.length > 0 && (
        <section aria-labelledby="riwayat" className="space-y-2">
          <h2 id="riwayat" className="text-lg font-bold">
            {t('pesanan.riwayat')}
          </h2>
          <OrderList rows={history} lang={lang} />
        </section>
      )}
      {(spending.data?.length ?? 0) > 0 && (
        <section aria-labelledby="pengeluaran" className="space-y-2">
          <h2 id="pengeluaran" className="text-lg font-bold">
            {t('pesanan.pengeluaran')}
          </h2>
          <p className="text-sm text-muted">{t('pesanan.pengeluaran_isi')}</p>
          <ul className="divide-y divide-line-soft rounded-xl border border-line-soft bg-surface">
            {spending.data!.map(([month, m]) => (
              <li key={month} className="flex items-center justify-between gap-3 p-3">
                <span>
                  <span className="block font-semibold">{monthLabel(month, lang)}</span>
                  <span className="block text-sm text-muted">{t('pesanan.pengeluaran_jumlah', { count: m.count })}</span>
                </span>
                <span className="tabular font-bold">{rupiah(m.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function OrderList({ rows, lang }: { rows: Row[]; lang: 'id' | 'en' }) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-2">
      {rows.map((o) => (
        <li key={o.id}>
          <Link
            to={o.status === 'menunggu_bayar' ? '/bayar/$orderId' : '/pesanan/$orderId'}
            params={{ orderId: o.id }}
            className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface p-3 hover:border-line"
          >
            <span className="min-w-0">
              <span className="block font-semibold">
                {o.tenants?.name} {orderNo(o.order_number)}
              </span>
              <span className="block text-sm text-muted">
                {dateLabel(o.pickup_date, lang, t)}, {clock(o.pickup_time, lang)}
              </span>
              {o.needs_buyer_action && <span className="block text-sm font-semibold text-warn-ink">{t('pesanan.perlu_tindakan')}</span>}
            </span>
            <span className="shrink-0 text-right">
              <StatusText tone={o.status === 'dibatalkan' || o.status === 'kedaluwarsa' ? 'error' : o.status === 'siap' ? 'success' : 'info'}>
                {t(`status.${statusKey(o)}`)}
              </StatusText>
              <span className="tabular mt-1 block text-sm">{rupiah(o.total_paid)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
