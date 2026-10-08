import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth, safeNext, validateNext } from '@/components/Guard'
import { ProfileForm } from '@/components/ProfileForm'
import { Card, PageHeader } from '@/components/ui'

export const Route = createFileRoute('/lengkapi-profil')({
  validateSearch: validateNext,
  component: () => (
    <RequireAuth needProfile={false}>
      <CompleteProfile />
    </RequireAuth>
  ),
})

function CompleteProfile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { next } = Route.useSearch()
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t('profil.lengkapi_judul')} description={t('profil.lengkapi_sub')} />
      <Card>
        <ProfileForm submitLabel={t('profil.simpan_lanjut')} onSaved={() => void navigate({ href: safeNext(next), replace: true })} />
      </Card>
    </div>
  )
}
