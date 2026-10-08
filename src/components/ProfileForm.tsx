import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { isValidWhatsapp, normalizeWhatsapp } from '@/lib/format'
import { supabase, type Enums } from '@/lib/supabase'
import { Button, Choice, Field, Input, Notice } from './ui'

const STATUSES: Enums<'status_pengguna'>[] = ['mahasiswa', 'dosen', 'staf_binus', 'tamu', 'pekerja_kantin']

// Formulir profil: nama asli (dilihat penjual saat pengambilan), WhatsApp tanpa OTP, dan status.
export function ProfileForm({ onSaved, submitLabel }: { onSaved?: () => void; submitLabel: string }) {
  const { t } = useTranslation()
  const { profile, user, refresh } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '')
  const [status, setStatus] = useState<Enums<'status_pengguna'> | null>(profile?.status ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizeWhatsapp(whatsapp)
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = t('profil.galat_nama')
    if (!isValidWhatsapp(normalized)) next.whatsapp = t('profil.galat_wa')
    if (!status) next.status = t('profil.galat_status')
    setErrors(next)
    if (Object.keys(next).length > 0 || !user) return
    setBusy(true)
    setSaved(false)
    setFailed(false)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), whatsapp: normalized, status }).eq('id', user.id)
    setBusy(false)
    if (error) {
      setFailed(true)
      return
    }
    await refresh()
    setSaved(true)
    onSaved?.()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t('profil.nama')} hint={t('profil.nama_isi')} error={errors.name}>
        {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />}
      </Field>
      <Field label={t('profil.wa')} hint={t('profil.wa_isi')} error={errors.whatsapp}>
        {(p) => (
          <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" />
        )}
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('profil.status')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUSES.map((s) => (
            <Choice key={s} name="status" value={s} checked={status === s} onChange={() => setStatus(s)}>
              {t(`profil.status_${s}`)}
            </Choice>
          ))}
        </div>
        {errors.status && <p className="text-sm font-medium text-danger">{errors.status}</p>}
      </fieldset>
      {failed && <Notice tone="error">{t('galat.unknown')}</Notice>}
      {saved && <Notice tone="success">{t('profil.tersimpan')}</Notice>}
      <Button type="submit" variant="primary" full busy={busy} busyText={t('umum.memproses')}>
        {submitLabel}
      </Button>
    </form>
  )
}
