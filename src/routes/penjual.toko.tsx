import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Choice, Dialog, ErrorState, Field, Input, LoadingState, Notice, PageHeader, TextArea } from '@/components/ui'
import { useSeller, useTenantSettings, type TenantFull } from '@/features/seller'
import {
  hhmm,
  hoursError,
  HoursEditor,
  imageProblem,
  newKey,
  quotaError,
  QuotaRulesEditor,
  unusualNumbers,
  uploadTenantImage,
  WEEKDAYS,
  type HourRange,
  type QuotaRule,
} from '@/features/tenantForm'
import { useAuth } from '@/lib/auth'
import { clock, isValidWhatsapp, longDate, normalizeWhatsapp, todayWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { publicImage, rpc, supabase, toAppError, type Enums } from '@/lib/supabase'

export const Route = createFileRoute('/penjual/toko')({
  component: StorePage,
})

type Save = { busy: boolean; ok: boolean; error: string | null }
const idle: Save = { busy: false, ok: false, error: null }

function useSave() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { refresh } = useAuth()
  const [state, setState] = useState<Save>(idle)
  async function run(fn: () => Promise<unknown>) {
    setState({ busy: true, ok: false, error: null })
    try {
      await fn()
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['tenant-saya'] }), queryClient.invalidateQueries({ queryKey: ['tenant'] }), refresh()])
      setState({ busy: false, ok: true, error: null })
    } catch (e) {
      setState({ busy: false, ok: false, error: t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }) })
    }
  }
  return { state, run }
}

function SaveRow({ state, label }: { state: Save; label?: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{t('umum.tersimpan')}</Notice>}
      <Button type="submit" variant="primary" busy={state.busy} busyText={t('umum.menyimpan')}>
        {label ?? t('umum.simpan')}
      </Button>
    </div>
  )
}

function StorePage() {
  const { t } = useTranslation()
  const { active, isOwner } = useSeller()
  const settings = useTenantSettings(active?.id)
  if (!active) return null
  if (settings.isPending) return <LoadingState />
  if (settings.isError || !settings.data) return <ErrorState onRetry={() => void settings.refetch()} />
  const tenant = settings.data
  return (
    <div className="space-y-4">
      <PageHeader title={t('toko.judul')} description={isOwner ? t('toko.sub_pemilik') : t('toko.sub_karyawan')} />
      <StatusCard tenant={tenant} isOwner={isOwner} />
      {isOwner ? (
        <>
          <ProfileCard tenant={tenant} />
          <RulesCard tenant={tenant} />
          <HoursCard tenant={tenant} />
          <SpecialDaysCard tenant={tenant} />
          <QuotaCard tenant={tenant} />
          <PayoutCard tenant={tenant} />
        </>
      ) : (
        <ReadOnly tenant={tenant} />
      )}
    </div>
  )
}

function StatusCard({ tenant, isOwner }: { tenant: TenantFull; isOwner: boolean }) {
  const { t } = useTranslation()
  const save = useSave()
  if (tenant.status === 'disetujui') return null
  return (
    <Notice tone={tenant.status === 'ditolak' ? 'error' : 'warn'} title={t(`penjual.status.${tenant.status}`)}>
      {tenant.status === 'menunggu' && <p>{t('penjual.menunggu_isi')}</p>}
      {tenant.status === 'ditolak' && (
        <>
          {tenant.reject_reason && <p>{t('penjual.alasan', { reason: tenant.reject_reason })}</p>}
          {isOwner && (
            <>
              <p className="mt-1">{t('toko.kirim_ulang_isi')}</p>
              <Button className="mt-2" small variant="primary" busy={save.state.busy} busyText={t('umum.mengirim')} onClick={() => void save.run(() => rpc('resubmit_tenant', { p_tenant: tenant.id }))}>
                {t('toko.kirim_ulang')}
              </Button>
              {save.state.error && <p className="mt-1 font-semibold">{save.state.error}</p>}
            </>
          )}
        </>
      )}
      {tenant.status === 'ditangguhkan' && <p>{t('toko.ditangguhkan_isi')}</p>}
    </Notice>
  )
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

function ProfileCard({ tenant }: { tenant: TenantFull }) {
  const { t } = useTranslation()
  const save = useSave()
  const [name, setName] = useState(tenant.name)
  const [description, setDescription] = useState(tenant.description ?? '')
  const [kiosk, setKiosk] = useState(tenant.kiosk_location)
  const [whatsapp, setWhatsapp] = useState(tenant.whatsapp)
  const [contact, setContact] = useState(tenant.contact_person)
  const [type, setType] = useState<Enums<'jenis_tenant'>>(tenant.type)
  const [managedBy, setManagedBy] = useState<Enums<'pengelola_tenant'>>(tenant.managed_by)
  const [managerName, setManagerName] = useState(tenant.manager_name ?? '')
  const [announcement, setAnnouncement] = useState(tenant.announcement ?? '')
  const [logo, setLogo] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const logoUrl = publicImage(tenant.logo_path)

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = t('daftar.galat_nama')
    if (!kiosk.trim()) next.kiosk = t('daftar.galat_lokasi')
    if (!isValidWhatsapp(normalizeWhatsapp(whatsapp))) next.whatsapp = t('profil.galat_wa')
    if (contact.trim().length < 2) next.contact = t('daftar.galat_kontak')
    if (managedBy === 'pihak_kantin' && managerName.trim().length < 2) next.manager = t('daftar.galat_pengelola')
    const lp = imageProblem(logo)
    if (lp) next.logo = t(`foto.galat_${lp}`)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    void save.run(async () => {
      let logoPath = tenant.logo_path
      if (logo) logoPath = await uploadTenantImage(tenant.id, logo, 'logo')
      const { error } = await supabase
        .from('tenants')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          kiosk_location: kiosk.trim(),
          whatsapp: normalizeWhatsapp(whatsapp),
          contact_person: contact.trim(),
          type,
          managed_by: managedBy,
          manager_name: managedBy === 'pihak_kantin' ? managerName.trim() : null,
          announcement: announcement.trim() || null,
          logo_path: logoPath,
        })
        .eq('id', tenant.id)
      if (error) throw error
    })
  }

  return (
    <Section title={t('toko.profil')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={t('daftar.nama')} error={errors.name}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
        </Field>
        <Field label={t('daftar.deskripsi')} optional>
          {(p) => <TextArea id={p.id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />}
        </Field>
        <Field label={t('daftar.lokasi')} error={errors.kiosk}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={kiosk} onChange={(e) => setKiosk(e.target.value)} maxLength={80} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('daftar.kontak')} error={errors.contact}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} />}
          </Field>
          <Field label={t('daftar.wa')} error={errors.whatsapp}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" />}
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('daftar.jenis')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['makanan', 'minuman', 'keduanya'] as const).map((v) => (
              <Choice key={v} name="jenis" value={v} checked={type === v} onChange={() => setType(v)}>
                {t(`daftar.jenis_${v}`)}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('daftar.pengelola')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['mandiri', 'pihak_kantin'] as const).map((v) => (
              <Choice key={v} name="pengelola" value={v} checked={managedBy === v} onChange={() => setManagedBy(v)}>
                {t(`daftar.pengelola_${v}`)}
              </Choice>
            ))}
          </div>
        </fieldset>
        {managedBy === 'pihak_kantin' && (
          <Field label={t('daftar.nama_pengelola')} error={errors.manager}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={managerName} onChange={(e) => setManagerName(e.target.value)} maxLength={80} />}
          </Field>
        )}
        <Field label={t('toko.pengumuman')} optional hint={t('toko.pengumuman_isi')}>
          {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} maxLength={200} className="min-h-16" />}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          {logoUrl && <img src={logoUrl} alt={t('toko.logo_sekarang')} className="size-16 rounded-lg object-cover" />}
          <Field label={t('daftar.logo')} optional hint={t('foto.isi')} error={errors.logo}>
            {(p) => (
              <input
                id={p.id}
                aria-describedby={p.describedBy}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                className="block min-h-12 w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:font-semibold"
              />
            )}
          </Field>
        </div>
        <SaveRow state={save.state} />
      </form>
    </Section>
  )
}

function RulesCard({ tenant }: { tenant: TenantFull }) {
  const { t } = useTranslation()
  const save = useSave()
  const [cutoff, setCutoff] = useState(String(tenant.order_cutoff_minutes))
  const [baseQuota, setBaseQuota] = useState(String(tenant.base_quota))
  const [dailyLimit, setDailyLimit] = useState(tenant.daily_order_limit != null ? String(tenant.daily_order_limit) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [warnings, setWarnings] = useState<string[] | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (cutoff === '' || !(Number(cutoff) >= 0)) next.cutoff = t('daftar.galat_angka')
    if (!(Number(baseQuota) >= 1)) next.baseQuota = t('daftar.galat_kuota')
    if (dailyLimit !== '' && !(Number(dailyLimit) >= 1)) next.dailyLimit = t('daftar.galat_kuota')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const unusual = unusualNumbers({ cutoff: Number(cutoff), quotas: [Number(baseQuota)] })
    if (unusual.length > 0) setWarnings(unusual)
    else persist()
  }

  function persist() {
    setWarnings(null)
    void save.run(async () => {
      const { error } = await supabase
        .from('tenants')
        .update({
          order_cutoff_minutes: Math.round(Number(cutoff)),
          base_quota: Math.round(Number(baseQuota)),
          daily_order_limit: dailyLimit === '' ? null : Math.round(Number(dailyLimit)),
        })
        .eq('id', tenant.id)
      if (error) throw error
    })
  }

  return (
    <Section title={t('toko.aturan')} description={t('toko.aturan_isi')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('daftar.batas_pesan')} hint={t('daftar.batas_pesan_isi')} error={errors.cutoff}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={0} inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />}
          </Field>
          <Field label={t('daftar.kuota_dasar')} hint={t('daftar.kuota_dasar_isi')} error={errors.baseQuota}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={1} inputMode="numeric" value={baseQuota} onChange={(e) => setBaseQuota(e.target.value)} />}
          </Field>
          <Field label={t('toko.batas_harian')} optional hint={t('toko.batas_harian_isi')} error={errors.dailyLimit}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={1} inputMode="numeric" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />}
          </Field>
        </div>
        <SaveRow state={save.state} />
      </form>
      <WarningDialog warnings={warnings} onCancel={() => setWarnings(null)} onConfirm={persist} />
    </Section>
  )
}

function WarningDialog({ warnings, onCancel, onConfirm }: { warnings: string[] | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!warnings} onClose={onCancel} title={t('angka.judul')}>
      <ul className="list-disc space-y-1 pl-5">
        {(warnings ?? []).map((w) => (
          <li key={w}>{t(`angka.${w}`)}</li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button onClick={onCancel}>{t('angka.periksa_lagi')}</Button>
        <Button variant="primary" onClick={onConfirm}>
          {t('angka.sudah_benar')}
        </Button>
      </div>
    </Dialog>
  )
}

function HoursCard({ tenant }: { tenant: TenantFull }) {
  const { t } = useTranslation()
  const save = useSave()
  const [hours, setHours] = useState<HourRange[]>(() =>
    [...tenant.tenant_hours]
      .sort((a, b) => a.weekday - b.weekday || a.open_time.localeCompare(b.open_time))
      .map((h) => ({ key: h.id, weekday: h.weekday, open: hhmm(h.open_time), close: hhmm(h.close_time) })),
  )
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const he = hoursError(hours)
    setError(he ? t(`jadwal.galat_${he}`) : null)
    if (he) return
    void save.run(() => rpc('owner_set_hours', { p_tenant: tenant.id, p_hours: hours.map((h) => ({ weekday: h.weekday, open: h.open, close: h.close })) }))
  }

  return (
    <Section title={t('toko.jadwal')} description={t('toko.jadwal_isi')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <HoursEditor value={hours} onChange={setHours} idPrefix="toko" />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <SaveRow state={save.state} />
      </form>
    </Section>
  )
}

type DayRange = { key: string; open: string; close: string }

// Libur atau jam khusus per tanggal. Sebelum menyimpan, pemilik melihat berapa pesanan lunas yang akan dibatalkan (ronde 39).
function SpecialDaysCard({ tenant }: { tenant: TenantFull }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const queryClient = useQueryClient()
  const today = todayWib()
  const days = useQuery({
    queryKey: ['jam-khusus', tenant.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_special_hours')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('date', today)
        .order('date')
        .order('open_time')
      if (error) throw error
      return data
    },
  })
  const [date, setDate] = useState(today)
  const [closed, setClosed] = useState(true)
  const [ranges, setRanges] = useState<DayRange[]>(() => [{ key: newKey(), open: '08:00', close: '12:00' }])
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmCount, setConfirmCount] = useState<number | null>(null)
  const [state, setState] = useState<{ busy: boolean; cancelled: number | null; error: string | null }>({ busy: false, cancelled: null, error: null })

  const errorText = (e: unknown) => t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') })
  const target = () => ({
    p_tenant: tenant.id,
    p_date: date,
    p_closed: closed,
    p_ranges: closed ? null : ranges.map((r) => ({ open: r.open, close: r.close })),
  })
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['jam-khusus', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['jam-buka', tenant.id] }),
    ])

  async function submit(e: FormEvent) {
    e.preventDefault()
    let problem: string | null = null
    if (!date || date < today) problem = t('libur.galat_tanggal')
    else if (!closed) {
      const he = hoursError(ranges.map((r) => ({ ...r, weekday: 1 })))
      if (he) problem = t(`jadwal.galat_${he}`)
    }
    setFormError(problem)
    if (problem) return
    setState({ busy: true, cancelled: null, error: null })
    try {
      const count = await rpc<number>('owner_special_day_preview', target())
      if (count > 0) {
        setConfirmCount(count)
        setState({ busy: false, cancelled: null, error: null })
        return
      }
      await persist()
    } catch (err) {
      setState({ busy: false, cancelled: null, error: errorText(err) })
    }
  }

  async function persist() {
    setConfirmCount(null)
    setState({ busy: true, cancelled: null, error: null })
    try {
      const cancelled = await rpc<number>('owner_set_special_day', { ...target(), p_note: note.trim() || null })
      await refresh()
      setState({ busy: false, cancelled, error: null })
    } catch (err) {
      setState({ busy: false, cancelled: null, error: errorText(err) })
    }
  }

  async function clear(day: string) {
    setState({ busy: true, cancelled: null, error: null })
    try {
      await rpc('owner_clear_special_day', { p_tenant: tenant.id, p_date: day })
      await refresh()
      setState({ busy: false, cancelled: null, error: null })
    } catch (err) {
      setState({ busy: false, cancelled: null, error: errorText(err) })
    }
  }

  const grouped = new Map<string, NonNullable<typeof days.data>>()
  for (const row of days.data ?? []) grouped.set(row.date, [...(grouped.get(row.date) ?? []), row])
  const updateRange = (key: string, patch: Partial<DayRange>) => setRanges(ranges.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <Section title={t('libur.judul')} description={t('libur.isi')}>
      <div className="space-y-2">
        <h3 className="font-semibold">{t('libur.daftar')}</h3>
        {days.isPending && <p className="text-sm text-muted">{t('umum.memuat')}</p>}
        {days.isError && <ErrorState onRetry={() => void days.refetch()} />}
        {days.data && grouped.size === 0 && <p className="text-sm text-muted">{t('libur.kosong')}</p>}
        <ul className="space-y-2">
          {[...grouped.entries()].map(([day, rows]) => {
            const label = longDate(day, lang)
            return (
              <li key={day} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm">
                    {rows[0].is_closed
                      ? t('libur.tutup')
                      : rows.map((r) => t('tenant.rentang', { open: clock(r.open_time, lang), close: clock(r.close_time, lang) })).join(', ')}
                  </span>
                  {rows[0].note && <span className="block text-sm text-muted">{rows[0].note}</span>}
                </span>
                <Button small variant="quiet" disabled={state.busy} onClick={() => void clear(day)} aria-label={t('libur.hapus_label', { date: label })}>
                  {t('umum.hapus')}
                </Button>
              </li>
            )
          })}
        </ul>
      </div>

      <form onSubmit={submit} noValidate className="mt-4 space-y-4 border-t border-line-soft pt-4">
        <Field label={t('libur.tanggal')}>
          {(p) => <Input id={p.id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />}
        </Field>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('libur.jenis')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice name="jenis-libur" value="libur" checked={closed} onChange={() => setClosed(true)}>
              {t('libur.libur')}
            </Choice>
            <Choice name="jenis-libur" value="jam" checked={!closed} onChange={() => setClosed(false)}>
              {t('libur.jam_khusus')}
            </Choice>
          </div>
        </fieldset>
        {!closed && (
          <div className="space-y-2">
            <ul className="space-y-2">
              {ranges.map((r, index) => (
                <li key={r.key} className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="block font-medium">{t('jadwal.buka')}</span>
                    <Input
                      type="time"
                      step={300}
                      value={r.open}
                      onChange={(e) => updateRange(r.key, { open: e.target.value })}
                      className="w-32"
                      aria-label={t('jadwal.buka_label', { day: date ? longDate(date, lang) : '', n: index + 1 })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block font-medium">{t('jadwal.tutup_jam')}</span>
                    <Input
                      type="time"
                      step={300}
                      value={r.close}
                      onChange={(e) => updateRange(r.key, { close: e.target.value })}
                      className="w-32"
                      aria-label={t('jadwal.tutup_label', { day: date ? longDate(date, lang) : '', n: index + 1 })}
                    />
                  </label>
                  {ranges.length > 1 && (
                    <Button small variant="quiet" onClick={() => setRanges(ranges.filter((x) => x.key !== r.key))}>
                      {t('umum.hapus')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Button small onClick={() => setRanges([...ranges, { key: newKey(), open: ranges.at(-1)?.close ?? '13:00', close: '17:00' }])}>
              {t('jadwal.tambah_rentang')}
            </Button>
          </div>
        )}
        <Field label={t('libur.catatan')} hint={t('libur.catatan_isi')}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {formError && <p className="text-sm font-medium text-danger">{formError}</p>}
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.cancelled !== null && (
          <Notice tone="success">{state.cancelled > 0 ? t('libur.tersimpan_batal', { count: state.cancelled }) : t('umum.tersimpan')}</Notice>
        )}
        <Button type="submit" variant="primary" busy={state.busy} busyText={t('umum.menyimpan')}>
          {t('umum.simpan')}
        </Button>
      </form>

      <Dialog open={confirmCount !== null} onClose={() => setConfirmCount(null)} title={t('libur.konfirmasi_judul')}>
        <p>{t('libur.konfirmasi_isi', { count: confirmCount ?? 0 })}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => setConfirmCount(null)}>{t('libur.periksa_lagi')}</Button>
          <Button variant="danger" onClick={() => void persist()}>
            {t('libur.lanjut')}
          </Button>
        </div>
      </Dialog>
    </Section>
  )
}

function QuotaCard({ tenant }: { tenant: TenantFull }) {
  const { t } = useTranslation()
  const save = useSave()
  const [rules, setRules] = useState<QuotaRule[]>(() =>
    [...tenant.tenant_quota_rules].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((q) => ({ key: q.id, start: hhmm(q.start_time), end: hhmm(q.end_time), quota: String(q.quota) })),
  )
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[] | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const qe = quotaError(rules)
    setError(qe ? t(`kuota.galat_${qe}`) : null)
    if (qe) return
    const unusual = unusualNumbers({ quotas: rules.map((r) => Number(r.quota)) })
    if (unusual.length > 0) setWarnings(unusual)
    else persist()
  }

  function persist() {
    setWarnings(null)
    void save.run(() => rpc('owner_set_quota_rules', { p_tenant: tenant.id, p_rules: rules.map((r) => ({ start: r.start, end: r.end, quota: Number(r.quota) })) }))
  }

  return (
    <Section title={t('daftar.kuota_rentang')} description={t('daftar.kuota_rentang_isi')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <QuotaRulesEditor value={rules} onChange={setRules} />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <SaveRow state={save.state} />
      </form>
      <WarningDialog warnings={warnings} onCancel={() => setWarnings(null)} onConfirm={persist} />
    </Section>
  )
}

function PayoutCard({ tenant }: { tenant: TenantFull }) {
  const bank = useQuery({
    queryKey: ['rekening', tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant_bank').select('*').eq('tenant_id', tenant.id).maybeSingle()
      if (error) throw error
      return data
    },
  })
  if (bank.isPending) return <LoadingState />
  if (bank.isError) return <ErrorState onRetry={() => void bank.refetch()} />
  return <PayoutForm tenant={tenant} bank={bank.data} />
}

function PayoutForm({ tenant, bank }: { tenant: TenantFull; bank: { bank_name: string; account_number: string; account_holder: string } | null }) {
  const { t } = useTranslation()
  const save = useSave()
  const queryClient = useQueryClient()
  const [bankName, setBankName] = useState(bank?.bank_name ?? '')
  const [accountNumber, setAccountNumber] = useState(bank?.account_number ?? '')
  const [holder, setHolder] = useState(bank?.account_holder ?? '')
  const [payoutTime, setPayoutTime] = useState(hhmm(tenant.payout_time))
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (bankName.trim().length < 2) next.bankName = t('daftar.galat_bank')
    if (!/^[0-9+ -]{4,30}$/.test(accountNumber.trim())) next.accountNumber = t('daftar.galat_rekening')
    if (holder.trim().length < 2) next.holder = t('daftar.galat_pemilik_rekening')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    void save.run(async () => {
      const row = { tenant_id: tenant.id, bank_name: bankName.trim(), account_number: accountNumber.trim(), account_holder: holder.trim() }
      const { error } = await supabase.from('tenant_bank').upsert(row, { onConflict: 'tenant_id' })
      if (error) throw error
      const { error: e2 } = await supabase.from('tenants').update({ payout_time: payoutTime || null }).eq('id', tenant.id)
      if (e2) throw e2
      await queryClient.invalidateQueries({ queryKey: ['rekening', tenant.id] })
    })
  }

  return (
    <Section title={t('toko.setoran')} description={t('toko.setoran_isi')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('daftar.bank')} error={errors.bankName}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={40} />}
          </Field>
          <Field label={t('daftar.rekening')} error={errors.accountNumber}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" maxLength={30} />}
          </Field>
        </div>
        <Field label={t('daftar.pemilik_rekening')} error={errors.holder}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={80} />}
        </Field>
        <Field label={t('daftar.jam_setoran')} optional hint={t('daftar.jam_setoran_isi')}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} type="time" step={300} value={payoutTime} onChange={(e) => setPayoutTime(e.target.value)} className="w-36" />}
        </Field>
        <SaveRow state={save.state} />
      </form>
    </Section>
  )
}

function ReadOnly({ tenant }: { tenant: TenantFull }) {
  const { t } = useTranslation()
  const lang = currentLang()
  return (
    <Card className="space-y-3">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[12rem_1fr]">
        <dt className="font-semibold">{t('daftar.lokasi')}</dt>
        <dd>{tenant.kiosk_location}</dd>
        <dt className="font-semibold">{t('daftar.batas_pesan')}</dt>
        <dd>{t('menu.menit', { count: tenant.order_cutoff_minutes })}</dd>
        <dt className="font-semibold">{t('daftar.kuota_dasar')}</dt>
        <dd>{tenant.base_quota}</dd>
      </dl>
      <div>
        <p className="font-semibold">{t('toko.jadwal')}</p>
        <ul className="mt-1 text-sm">
          {WEEKDAYS.map((d) => {
            const list = tenant.tenant_hours.filter((h) => h.weekday === d).sort((a, b) => a.open_time.localeCompare(b.open_time))
            return (
              <li key={d}>
                {t(`hari.${d}`)}:{' '}
                {list.length ? list.map((h) => t('tenant.rentang', { open: clock(h.open_time, lang), close: clock(h.close_time, lang) })).join(', ') : t('jadwal.tutup')}
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
