import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Field, Input, Notice, PageHeader } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/atur-sandi')({
  component: ResetPassword,
})

function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, ready } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError(t('galat.weak_password'))
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(t('galat.unknown'))
      return
    }
    void navigate({ to: '/', replace: true })
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t('akun.atur_sandi')} />
      <Card>
        {ready && !session ? (
          <Notice tone="warn">{t('akun.tautan_kedaluwarsa')}</Notice>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field label={t('akun.sandi_baru')} hint={t('akun.sandi_aturan')}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />}
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" variant="primary" full busy={busy} busyText={t('umum.memproses')}>
              {t('akun.simpan_sandi')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
