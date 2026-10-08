import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { ProfileForm } from '@/components/ProfileForm'
import { Button, ButtonLink, Card, Choice, Notice, PageHeader } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { isStandalone } from '@/lib/device'
import { setLanguage, currentLang } from '@/lib/i18n'
import { disablePush, enablePush, pushEnabled, type PushResult } from '@/lib/push'
import { supabase } from '@/lib/supabase'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'

export const Route = createFileRoute('/profil')({
  component: () => (
    <RequireAuth needProfile={false}>
      <ProfilePage />
    </RequireAuth>
  ),
})

function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, refresh, signOut, tenants } = useAuth()
  const [lang, setLang] = useState(currentLang())
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [reminder, setReminder] = useState(profile?.reminder_minutes ?? 5)
  const [push, setPush] = useState<boolean | null>(null)
  const [pushMsg, setPushMsg] = useState<PushResult | 'mati' | 'gagal' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void pushEnabled().then(setPush)
  }, [])

  async function savePref(values: { language?: 'id' | 'en'; reminder_minutes?: number }) {
    if (!user) return
    await supabase.from('profiles').update(values).eq('id', user.id)
    await refresh()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('profil.judul')} description={user?.email} />

      <Card>
        <h2 className="mb-3 text-lg font-bold">{t('profil.data_diri')}</h2>
        <ProfileForm submitLabel={t('profil.simpan')} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('profil.kabar')}</h2>
        <p className="text-sm text-muted">{t('profil.kabar_isi')}</p>
        {push ? (
          <>
            <Notice tone="success">{t('profil.kabar_menyala')}</Notice>
            <Button
              small
              busy={busy}
              busyText={t('umum.memproses')}
              onClick={async () => {
                setBusy(true)
                await disablePush()
                setPush(false)
                setPushMsg('mati')
                setBusy(false)
              }}
            >
              {t('profil.matikan_kabar')}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            busy={busy}
            busyText={t('umum.memproses')}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await enablePush()
                setPushMsg(result)
                setPush(result === 'ok')
              } catch {
                setPushMsg('gagal')
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('profil.nyalakan_kabar')}
          </Button>
        )}
        {pushMsg && pushMsg !== 'ok' && (
          <Notice tone={pushMsg === 'mati' ? 'info' : 'warn'}>
            {t(`profil.kabar_hasil.${pushMsg}`)}
            {pushMsg === 'needs_install' && (
              <Link to="/panduan-pasang" className="mt-1 block font-semibold underline">
                {t('pasang.lihat_panduan')}
              </Link>
            )}
          </Notice>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('profil.pengingat')}</legend>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15].map((m) => (
              <Choice
                key={m}
                name="pengingat"
                value={String(m)}
                checked={reminder === m}
                onChange={() => {
                  setReminder(m)
                  void savePref({ reminder_minutes: m })
                }}
              >
                {t('profil.menit', { count: m })}
              </Choice>
            ))}
          </div>
        </fieldset>
        {!isStandalone() && (
          <Link to="/panduan-pasang" className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-4">
            {t('pasang.lihat_panduan')}
          </Link>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('profil.tampilan')}</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('profil.bahasa')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['id', 'en'] as const).map((l) => (
              <Choice
                key={l}
                name="bahasa"
                value={l}
                checked={lang === l}
                onChange={() => {
                  setLang(l)
                  setLanguage(l)
                  void savePref({ language: l })
                }}
              >
                {l === 'id' ? 'Bahasa Indonesia' : 'English'}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('profil.tema')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['sistem', 'terang', 'gelap'] as const).map((th) => (
              <Choice
                key={th}
                name="tema"
                value={th}
                checked={theme === th}
                onChange={() => {
                  setTheme(th)
                  setThemePref(th)
                }}
              >
                {t(`profil.tema_${th}`)}
              </Choice>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{t('profil.penjual')}</h2>
        {tenants.length > 0 ? (
          <ButtonLink to="/penjual">{t('profil.ke_penjual')}</ButtonLink>
        ) : (
          <>
            <p className="text-sm text-muted">{t('profil.daftar_tenant_isi')}</p>
            <ButtonLink to="/penjual/daftar">{t('profil.daftar_tenant')}</ButtonLink>
          </>
        )}
      </Card>

      <Button
        variant="danger"
        full
        onClick={async () => {
          await signOut()
          void navigate({ to: '/' })
        }}
      >
        {t('akun.keluar')}
      </Button>
      {profile?.is_demo && <p className="text-center text-sm text-muted">{t('demo.akun_demo')}</p>}
    </div>
  )
}
