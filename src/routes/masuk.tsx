import { GoogleLogoIcon } from '@phosphor-icons/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Redirect, safeNext, validateNext } from '@/components/Guard'
import { Button, Card, Field, Input, Notice } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { callFunction, supabase, toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/masuk')({
  validateSearch: validateNext,
  component: LoginPage,
})

type Mode = 'masuk' | 'daftar' | 'lupa'

// Nama tanpa "@" dianggap akun @jaminin.test, supaya akun demo cukup diketik "admin".
function loginEmail(value: string): string {
  const v = value.trim()
  return v.includes('@') ? v : `${v}@jaminin.test`
}

// Pola masuk yang umum: email, kata sandi, tautan Lupa sandi di bawah kolom sandi, tombol utama,
// lalu pilihan Google, dan tautan Daftar di bagian bawah.
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

  function switchTo(m: Mode) {
    setMode(m)
    setError(null)
    setSent(false)
  }

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
      const { error } = await supabase.auth.signInWithPassword({ email: mode === 'masuk' ? loginEmail(email) : email.trim(), password })
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

  const title = mode === 'daftar' ? t('akun.judul_daftar') : mode === 'lupa' ? t('akun.judul_lupa') : t('akun.judul')
  const sub = mode === 'lupa' ? t('akun.sub_lupa') : t('akun.sub')

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-muted">{sub}</p>
      </div>
      <Card className="space-y-4">
        {sent ? (
          <Notice tone="success">{t('akun.reset_terkirim')}</Notice>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field label={t('akun.email')}>
              {(p) => (
                <Input
                  id={p.id}
                  type={mode === 'masuk' ? 'text' : 'email'}
                  autoComplete={mode === 'daftar' ? 'email' : 'username'}
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
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
                  />
                )}
              </Field>
            )}
            {mode === 'masuk' && (
              <div className="-mt-1 text-right">
                <button type="button" onClick={() => switchTo('lupa')} className="min-h-11 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                  {t('akun.lupa_tanya')}
                </button>
              </div>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" variant="primary" full busy={busy} busyText={t('umum.memproses')}>
              {mode === 'masuk' ? t('akun.masuk') : mode === 'daftar' ? t('akun.buat_akun') : t('akun.kirim_tautan')}
            </Button>
          </form>
        )}
        {mode !== 'lupa' && (
          <>
            <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line-soft" />
              {t('akun.atau')}
              <span className="h-px flex-1 bg-line-soft" />
            </div>
            <Button full icon={<GoogleLogoIcon weight="bold" />} onClick={() => void google()}>
              {t('akun.google')}
            </Button>
          </>
        )}
      </Card>
      <p className="text-center text-sm">
        {mode === 'masuk' ? (
          <>
            {t('akun.belum_punya')}{' '}
            <button type="button" onClick={() => switchTo('daftar')} className="min-h-11 font-semibold text-accent underline-offset-4 hover:underline">
              {t('akun.daftar')}
            </button>
          </>
        ) : (
          <>
            {mode === 'daftar' && `${t('akun.sudah_punya')} `}
            <button type="button" onClick={() => switchTo('masuk')} className="min-h-11 font-semibold text-accent underline-offset-4 hover:underline">
              {mode === 'daftar' ? t('akun.masuk') : t('akun.kembali_masuk')}
            </button>
          </>
        )}
      </p>
    </div>
  )
}
