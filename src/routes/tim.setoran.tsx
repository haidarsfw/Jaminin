import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, LoadingState, PageHeader, Tabs } from '@/components/ui'
import { PayoutCard } from '@/features/payouts'
import { rupiah, todayWib } from '@/lib/format'
import { useTopic } from '@/lib/realtime'
import { supabase, type Tables } from '@/lib/supabase'

export const Route = createFileRoute('/tim/setoran')({
  component: TeamPayouts,
})

type Row = Tables<'payouts'> & { tenants: { name: string } | null }

function daysAgo(n: number): string {
  const d = new Date(`${todayWib()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function TeamPayouts() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<'0' | '7' | '30'>('7')
  const payouts = useQuery({
    queryKey: ['tim-setoran', range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*, tenants(name)')
        .gte('payout_date', daysAgo(Number(range)))
        .order('payout_date', { ascending: false })
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data as unknown as Row[]
    },
  })
  useTopic('team', ['payout'], () => void queryClient.invalidateQueries({ queryKey: ['tim-setoran'] }))
  const total = (payouts.data ?? []).filter((p) => !p.is_sample).reduce((acc, p) => acc + p.amount, 0)

  return (
    <div className="space-y-4">
      <PageHeader title={t('timsetoran.judul')} description={t('timsetoran.sub')} />
      <Tabs
        label={t('tim.rentang')}
        value={range}
        onChange={setRange}
        items={[
          { value: '0', label: t('waktu.hari_ini') },
          { value: '7', label: t('tim.tujuh_hari') },
          { value: '30', label: t('tim.tiga_puluh_hari') },
        ]}
      />
      {payouts.data && <p className="tabular font-semibold">{t('timsetoran.total', { amount: rupiah(total) })}</p>}
      {payouts.isPending && <LoadingState />}
      {payouts.isError && <ErrorState onRetry={() => void payouts.refetch()} />}
      {payouts.data && payouts.data.length === 0 && <EmptyState title={t('timsetoran.kosong')} />}
      <ul className="grid gap-2 lg:grid-cols-2">
        {(payouts.data ?? []).map((p) => (
          <li key={p.id}>
            <PayoutCard payout={p} tenantName={p.tenants?.name} />
          </li>
        ))}
      </ul>
    </div>
  )
}
