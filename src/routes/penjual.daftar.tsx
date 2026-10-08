import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Choice, Dialog, Field, Input, Notice, PageHeader, TextArea } from '@/components/ui'
import { useSettings } from '@/components/AppShell'
import {
  defaultHours,
  hoursError,
  HoursEditor,
  imageProblem,
  newKey,
  quotaError,
  QuotaRulesEditor,
  TagPicker,
  unusualNumbers,
  uploadTenantImage,
  type HourRange,
  type QuotaRule,
} from '@/features/tenantForm'
import { useAuth } from '@/lib/auth'
import { isValidWhatsapp, normalizeWhatsapp, rupiah } from '@/lib/format'
import { rpc, supabase, toAppError, type Enums } from '@/lib/supabase'

export const Route = createFileRoute('/penjual/daftar')({
  component: Register,
})

type DraftItem = { key: string; name: string; price: string; prep: string; description: string; tags: string[] }
type DraftCategory = { key: string; name: string; items: DraftItem[] }

const emptyItem = (): DraftItem => ({ key: newKey(), name: '', price: '', prep: '', description: '', tags: [] })

// Pendaftaran lengkap dalam satu halaman: data dasar, jadwal, kuota, menu awal, rekening, dan persetujuan syarat.
function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh, profile } = useAuth()
  const settings = useSettings()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kiosk, setKiosk] = useState('')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '')
  const [contact, setContact] = useState(profile?.full_name ?? '')
  const [type, setType] = useState<Enums<'jenis_tenant'>>('makanan')
  const [managedBy, setManagedBy] = useState<Enums<'pengelola_tenant'>>('mandiri')
  const [managerName, setManagerName] = useState('')
  const [cutoff, setCutoff] = useState('5')
  const [baseQuota, setBaseQuota] = useState('')
  const [payoutTime, setPayoutTime] = useState('')
  const [hours, setHours] = useState<HourRange[]>(defaultHours)
  const [rules, setRules] = useState<QuotaRule[]>([])
  const [categories, setCategories] = useState<DraftCategory[]>(() => [{ key: newKey(), name: t('daftar.kategori_awal'), items: [emptyItem()] }])
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [warnings, setWarnings] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const serviceFee = settings.data?.service_fee ?? 1000
  const sellerFee = settings.data?.seller_fee ?? 1000

  function setItem(catKey: string, itemKey: string, patch: Partial<DraftItem>) {
    setCategories((cs) => cs.map((c) => (c.key === catKey ? { ...c, items: c.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)) } : c)))
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (name.trim().length < 2 || name.trim().length > 60) e.name = t('daftar.galat_nama')
    if (kiosk.trim().length < 1 || kiosk.trim().length > 80) e.kiosk = t('daftar.galat_lokasi')
    if (!isValidWhatsapp(normalizeWhatsapp(whatsapp))) e.whatsapp = t('profil.galat_wa')
    if (contact.trim().length < 2 || contact.trim().length > 60) e.contact = t('daftar.galat_kontak')
    if (managedBy === 'pihak_kantin' && managerName.trim().length < 2) e.manager = t('daftar.galat_pengelola')
    if (!(Number(cutoff) >= 0) || cutoff === '') e.cutoff = t('daftar.galat_angka')
    if (!(Number(baseQuota) >= 1)) e.baseQuota = t('daftar.galat_kuota')
    const he = hoursError(hours)
    if (he) e.hours = t(`jadwal.galat_${he}`)
    const qe = quotaError(rules)
    if (qe) e.rules = t(`kuota.galat_${qe}`)
    const items = categories.flatMap((c) => c.items)
    if (categories.some((c) => c.name.trim().length < 1)) e.menu = t('daftar.galat_kategori')
    else if (items.length === 0) e.menu = t('daftar.galat_menu_kosong')
    else if (items.some((i) => i.name.trim().length < 1 || !(Number(i.price) >= 0) || i.price === '' || !(Number(i.prep) >= 0) || i.prep === ''))
      e.menu = t('daftar.galat_menu')
    if (bankName.trim().length < 2) e.bankName = t('daftar.galat_bank')
    if (!/^[0-9+ -]{4,30}$/.test(accountNumber.trim())) e.accountNumber = t('daftar.galat_rekening')
    if (accountHolder.trim().length < 2) e.accountHolder = t('daftar.galat_pemilik_rekening')
    const lp = imageProblem(logo)
    if (lp) e.logo = t(`foto.galat_${lp}`)
    if (!terms) e.terms = t('daftar.galat_syarat')
    return e
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    setFailure(null)
    if (Object.keys(next).length > 0) return
    const unusual = unusualNumbers({
      cutoff: Number(cutoff),
      quotas: [Number(baseQuota), ...rules.map((r) => Number(r.quota))],
      preps: categories.flatMap((c) => c.items.map((i) => Number(i.prep))),
    })
    if (unusual.length > 0) setWarnings(unusual)
    else void send()
  }

  async function send() {
    setWarnings(null)
    setBusy(true)
    try {
      const id = await rpc<string>('register_tenant', {
        p: {
          name: name.trim(),
          description: description.trim(),
          kiosk_location: kiosk.trim(),
          whatsapp: normalizeWhatsapp(whatsapp),
          contact_person: contact.trim(),
          type,
          managed_by: managedBy,
          manager_name: managedBy === 'pihak_kantin' ? managerName.trim() : '',
          order_cutoff_minutes: Number(cutoff),
          base_quota: Number(baseQuota),
          payout_time: payoutTime,
          terms_accepted: terms,
          hours: hours.map((h) => ({ weekday: h.weekday, open: h.open, close: h.close })),
          quota_rules: rules.map((r) => ({ start: r.start, end: r.end, quota: Number(r.quota) })),
          categories: categories.map((c) => ({
            name: c.name.trim(),
            items: c.items.map((i) => ({ name: i.name.trim(), price: Number(i.price), prep_minutes: Number(i.prep), description: i.description.trim(), tags: i.tags })),
          })),
          bank: { bank_name: bankName.trim(), account_number: accountNumber.trim(), account_holder: accountHolder.trim() },
        },
      })
      if (logo) {
        try {
          const path = await uploadTenantImage(id, logo, 'logo')
          await supabase.from('tenants').update({ logo_path: path }).eq('id', id)
        } catch {
          // Logo bisa diunggah ulang dari halaman toko; pendaftaran tetap terkirim.
        }
      }
      try {
        localStorage.setItem('jaminin:tenant-aktif', id)
      } catch {
        // Tenant aktif dipilih ulang otomatis.
      }
      await refresh()
      await navigate({ to: '/penjual', replace: true })
    } catch (err) {
      setFailure(t(`galat.${toAppError(err).code}`, { defaultValue: t('galat.unknown') }))
    } finally {
      setBusy(false)
    }
  }

  const errorCount = Object.keys(errors).length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('daftar.judul')} description={t('daftar.sub')} back={{ to: '/profil', label: t('umum.kembali') }} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('daftar.bagian_dasar')}</h2>
          <Field label={t('daftar.nama')} error={errors.name}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
          </Field>
          <Field label={t('daftar.deskripsi')} optional hint={t('daftar.deskripsi_isi')}>
            {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />}
          </Field>
          <Field label={t('daftar.lokasi')} hint={t('daftar.lokasi_isi')} error={errors.kiosk}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={kiosk} onChange={(e) => setKiosk(e.target.value)} maxLength={80} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('daftar.kontak')} error={errors.contact}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} />}
            </Field>
            <Field label={t('daftar.wa')} hint={t('daftar.wa_isi')} error={errors.whatsapp}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="08xxxxxxxxxx" />}
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
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('daftar.bagian_jadwal')}</h2>
          <p className="text-sm text-muted">{t('daftar.jadwal_isi')}</p>
          <HoursEditor value={hours} onChange={setHours} idPrefix="daftar" />
          {errors.hours && <p className="text-sm font-medium text-danger">{errors.hours}</p>}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('daftar.bagian_kuota')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('daftar.kuota_dasar')} hint={t('daftar.kuota_dasar_isi')} error={errors.baseQuota}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={1} inputMode="numeric" value={baseQuota} onChange={(e) => setBaseQuota(e.target.value)} />}
            </Field>
            <Field label={t('daftar.batas_pesan')} hint={t('daftar.batas_pesan_isi')} error={errors.cutoff}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="number" min={0} inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />}
            </Field>
          </div>
          <div>
            <p className="text-sm font-semibold">{t('daftar.kuota_rentang')}</p>
            <p className="mb-2 text-sm text-muted">{t('daftar.kuota_rentang_isi')}</p>
            <QuotaRulesEditor value={rules} onChange={setRules} />
            {errors.rules && <p className="mt-1 text-sm font-medium text-danger">{errors.rules}</p>}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('daftar.bagian_menu')}</h2>
          <p className="text-sm text-muted">{t('daftar.menu_isi')}</p>
          {categories.map((c) => (
            <fieldset key={c.key} className="space-y-3 rounded-lg border border-line-soft p-3">
              <legend className="sr-only">{c.name || t('daftar.kategori')}</legend>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  <span className="block font-semibold">{t('daftar.kategori')}</span>
                  <Input value={c.name} onChange={(e) => setCategories((cs) => cs.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))} maxLength={40} />
                </label>
                {categories.length > 1 && (
                  <Button small variant="quiet" onClick={() => setCategories((cs) => cs.filter((x) => x.key !== c.key))}>
                    {t('daftar.hapus_kategori')}
                  </Button>
                )}
              </div>
              <ul className="space-y-3">
                {c.items.map((i, index) => (
                  <li key={i.key} className="space-y-2 rounded-lg bg-canvas p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_8rem_7rem]">
                      <label className="text-sm">
                        <span className="block font-medium">{t('menu.nama')}</span>
                        <Input value={i.name} onChange={(e) => setItem(c.key, i.key, { name: e.target.value })} maxLength={60} aria-label={t('menu.nama_ke', { n: index + 1 })} />
                      </label>
                      <label className="text-sm">
                        <span className="block font-medium">{t('menu.harga')}</span>
                        <Input type="number" min={0} inputMode="numeric" value={i.price} onChange={(e) => setItem(c.key, i.key, { price: e.target.value })} aria-label={t('menu.harga_ke', { n: index + 1 })} />
                      </label>
                      <label className="text-sm">
                        <span className="block font-medium">{t('menu.lama')}</span>
                        <Input type="number" min={0} inputMode="numeric" value={i.prep} onChange={(e) => setItem(c.key, i.key, { prep: e.target.value })} aria-label={t('menu.lama_ke', { n: index + 1 })} />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="block font-medium">
                        {t('menu.deskripsi')} <span className="font-normal text-muted">({t('umum.opsional')})</span>
                      </span>
                      <Input value={i.description} onChange={(e) => setItem(c.key, i.key, { description: e.target.value })} maxLength={200} />
                    </label>
                    <TagPicker value={i.tags} onChange={(tags) => setItem(c.key, i.key, { tags })} />
                    {c.items.length > 1 && (
                      <Button small variant="quiet" onClick={() => setCategories((cs) => cs.map((x) => (x.key === c.key ? { ...x, items: x.items.filter((y) => y.key !== i.key) } : x)))}>
                        {t('daftar.hapus_menu')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Button small onClick={() => setCategories((cs) => cs.map((x) => (x.key === c.key ? { ...x, items: [...x.items, emptyItem()] } : x)))}>
                {t('daftar.tambah_menu')}
              </Button>
            </fieldset>
          ))}
          <Button small onClick={() => setCategories((cs) => [...cs, { key: newKey(), name: '', items: [emptyItem()] }])}>
            {t('daftar.tambah_kategori')}
          </Button>
          {errors.menu && <p className="text-sm font-medium text-danger">{errors.menu}</p>}
          <p className="text-sm text-muted">{t('daftar.pilihan_nanti')}</p>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('daftar.bagian_setoran')}</h2>
          <p className="text-sm text-muted">{t('daftar.setoran_isi', { fee: rupiah(sellerFee) })}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('daftar.bank')} error={errors.bankName}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={40} />}
            </Field>
            <Field label={t('daftar.rekening')} error={errors.accountNumber}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" maxLength={30} />}
            </Field>
          </div>
          <Field label={t('daftar.pemilik_rekening')} error={errors.accountHolder}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} maxLength={80} />}
          </Field>
          <Field label={t('daftar.jam_setoran')} optional hint={t('daftar.jam_setoran_isi')}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} type="time" step={300} value={payoutTime} onChange={(e) => setPayoutTime(e.target.value)} className="w-36" />}
          </Field>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">{t('daftar.bagian_syarat')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{t('daftar.syarat_1', { fee: rupiah(sellerFee), service: rupiah(serviceFee) })}</li>
            <li>{t('daftar.syarat_2')}</li>
            <li>{t('daftar.syarat_3')}</li>
            <li>{t('daftar.syarat_4')}</li>
            <li>{t('daftar.syarat_5')}</li>
          </ul>
          <p className="text-sm text-muted">{t('daftar.syarat_draf')}</p>
          <Choice type="checkbox" name="syarat" value="setuju" checked={terms} onChange={setTerms}>
            {t('daftar.setuju')}
          </Choice>
          {errors.terms && <p className="text-sm font-medium text-danger">{errors.terms}</p>}
        </Card>

        {errorCount > 0 && <Notice tone="error">{t('daftar.periksa', { count: errorCount })}</Notice>}
        {failure && <Notice tone="error">{failure}</Notice>}
        <Button type="submit" variant="primary" full busy={busy} busyText={t('umum.mengirim')}>
          {t('daftar.kirim')}
        </Button>
      </form>

      <Dialog open={!!warnings} onClose={() => setWarnings(null)} title={t('angka.judul')}>
        <ul className="list-disc space-y-1 pl-5">
          {(warnings ?? []).map((w) => (
            <li key={w}>{t(`angka.${w}`)}</li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => setWarnings(null)}>{t('angka.periksa_lagi')}</Button>
          <Button variant="primary" onClick={() => void send()}>
            {t('angka.sudah_benar')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
