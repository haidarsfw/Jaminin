import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { ButtonLink, EmptyState, LoadingState, Select } from '@/components/ui'
import { SellerProvider, useSeller } from '@/features/seller'
import { useAuth } from '@/lib/auth'
import { todayWib, tomorrowWib } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/penjual')({
  component: () => (
    <RequireAuth>
      <SellerProvider>
        <SellerLayout />
      </SellerProvider>
    </RequireAuth>
  ),
})

function SellerLayout() {
  const { t } = useTranslation()
  const { tenants, active, setActive } = useSeller()
  const { pathname } = useLocation()
  const { rolesLoading } = useAuth()
  const counts = useActiveCounts(tenants.map((x) => x.id))

  if (rolesLoading) return <LoadingState />
  if (tenants.length === 0 && pathname !== '/penjual/daftar') {
    return (
      <EmptyState
        title={t('penjual.belum_punya')}
        body={t('penjual.belum_punya_isi')}
        action={
          <ButtonLink to="/penjual/daftar" variant="primary">
            {t('profil.daftar_tenant')}
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {tenants.length > 1 && pathname !== '/penjual/daftar' && (
        <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {t('penjual.tenant_aktif')}
          <Select className="max-w-xs" value={active?.id} onChange={(e) => setActive(e.target.value)}>
            {tenants.map((x) => (
              <option key={x.id} value={x.id}>
                {counts.data?.[x.id] ? `${x.name} (${t('penjual.pesanan_aktif', { count: counts.data[x.id] })})` : x.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <Outlet />
    </div>
  )
}

// Pesanan lunas yang masih perlu diproses (hari ini dan besok) per tenant, untuk pemilik dengan banyak tenant.
function useActiveCounts(ids: string[]) {
  return useQuery({
    queryKey: ['papan-jumlah', ids.join(','), todayWib()],
    enabled: ids.length > 1,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('tenant_id')
        .in('tenant_id', ids)
        .in('pickup_date', [todayWib(), tomorrowWib()])
        .in('status', ['diterima', 'disiapkan', 'siap'])
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data) counts[row.tenant_id] = (counts[row.tenant_id] ?? 0) + 1
      return counts
    },
  })
}
