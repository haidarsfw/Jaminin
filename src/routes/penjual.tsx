import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { ButtonLink, EmptyState, Select } from '@/components/ui'
import { SellerProvider, useSeller } from '@/features/seller'

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
                {x.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <Outlet />
    </div>
  )
}
