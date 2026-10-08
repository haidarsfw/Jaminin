import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { PayoutCard } from '@/features/payouts'
import { useSeller, useTenantSettings } from '@/features/seller'
import { clock } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/penjual/setoran')({
  component: PayoutsPage,
})

function PayoutsPage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const { active } = useSeller()
  const settings = useTenantSettings(active?.id)
  const payouts = useQuery({
    queryKey: ['setoran', active?.id],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase.from('payouts').select('*').eq('tenant_id', active!.id).order('payout_date', { ascending: false }).limit(60)
      if (error) throw error
      return data
    },
  })
  useTopic(active ? `tenant:${active.id}` : null, ['payout'], () => void payouts.refetch())

  if (!active) return null
  const payoutTime = settings.data?.payout_time
  return (
    <div className="space-y-4">
      <PageHeader
        title={t('setoran.judul')}
        description={payoutTime ? t('setoran.sub_jam', { time: clock(payoutTime, lang) }) : t('setoran.sub_tutup')}
      />
      <p className="text-sm text-muted">{t('setoran.simulasi')}</p>
      {payouts.isPending && <LoadingState />}
      {payouts.isError && <ErrorState onRetry={() => void payouts.refetch()} />}
      {payouts.data && payouts.data.length === 0 && <EmptyState title={t('setoran.kosong')} body={t('setoran.kosong_isi')} />}
      <ul className="space-y-2">
        {(payouts.data ?? []).map((p) => (
          <li key={p.id}>
            <PayoutCard payout={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}
