import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { EmptyState, LoadingState } from '@/components/ui'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/tim')({
  component: () => (
    <RequireAuth>
      <TeamLayout />
    </RequireAuth>
  ),
})

function TeamLayout() {
  const { t } = useTranslation()
  const { teamRole, rolesLoading } = useAuth()
  if (rolesLoading) return <LoadingState />
  if (!teamRole) return <EmptyState title={t('tim.bukan_tim')} body={t('tim.bukan_tim_isi')} />
  return <Outlet />
}
