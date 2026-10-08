import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AppShell } from '@/components/AppShell'
import { ButtonLink, EmptyState } from '@/components/ui'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFound,
})

function NotFound() {
  const { t } = useTranslation()
  return (
    <EmptyState
      title={t('umum.tidak_ditemukan')}
      body={t('umum.tidak_ditemukan_isi')}
      action={
        <ButtonLink to="/" variant="primary">
          {t('umum.ke_beranda')}
        </ButtonLink>
      }
    />
  )
}
