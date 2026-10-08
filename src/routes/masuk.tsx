import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Redirect, safeNext, validateNext } from '@/components/Guard'
import { Button, Card, Field, Input, Notice, PageHeader, Tabs } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { callFunction, supabase, toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/masuk')({
  validateSearch: validateNext,
  component: LoginPage,
})

type Mode = 'masuk' | 'daftar' | 'lupa'

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { next } = Route.useSearch()
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('masuk')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (session) return <Redirect href={safeNext(next)} />

  function message(e: unknown): string {
    const code = toAppError(e).code
    return t(`galat.${code}`, { defaultValue: t('galat.unknown') })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'lupa') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/atur-sandi` })
        if (error) throw new Error('reset_failed')
        setSent(true)
        return
      }
      if (mode === 'daftar') {
        if (password.length < 6) throw new Error('weak_password')
        await callFunction('daftar', { email: email.trim(), password })
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message.includes('Invalid login') ? 'invalid_credentials' : 'login_failed')
      void navigate({ href: safeNext(next), replace: true })
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${safeNext(next)}` },
    })
    if (error) setError(t('galat.google_failed'))
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t('akun.judul')} description={t('akun.sub')} />
      <Card className="space-y-4">
        <Tabs
          label={t('akun.pilihan')}
          value={mode}
          onChange={(m) => {
            setMode(m)
            setError(null)
            setSent(false)
          }}
          items={[
            { value: 'masuk', label: t('akun.masuk') },
            { value: 'daftar', label: t('akun.daftar') },
            { value: 'lupa', label: t('akun.lupa') },
          ]}
        />
        {mode !== 'lupa' && (
          <>
            <Button full onClick={google}>
              {t('akun.google')}
            </Button>
            <p className="text-center text-sm text-muted">{t('akun.atau_email')}</p>
          </>
        )}
        {sent ? (
          <Notice tone="success">{t('akun.reset_terkirim')}</Notice>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field label={t('akun.email')}>
              {(p) => <Input id={p.id} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
            </Field>
            {mode !== 'lupa' && (
              <Field label={t('akun.sandi')} hint={mode === 'daftar' ? t('akun.sandi_aturan') : undefined}>
                {(p) => (
                  <Input
                    id={p.id}
                    aria-describedby={p.describedBy}
                    type="password"
                    autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                )}
              </Field>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" variant="primary" full busy={busy} busyText={t('umum.memproses')}>
              {mode === 'masuk' ? t('akun.masuk') : mode === 'daftar' ? t('akun.buat_akun') : t('akun.kirim_tautan')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
