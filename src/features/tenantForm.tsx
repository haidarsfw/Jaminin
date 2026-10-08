import { useTranslation } from 'react-i18next'
import { Button, Input } from '@/components/ui'
import { supabase, toAppError } from '@/lib/supabase'

// Bagian formulir yang dipakai bersama oleh pendaftaran penjual dan pengaturan toko.

export type HourRange = { key: string; weekday: number; open: string; close: string }
export type QuotaRule = { key: string; start: string; end: string; quota: string }

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

let seq = 0
export function newKey(): string {
  seq += 1
  return `k${Date.now().toString(36)}${seq}`
}

export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

export function defaultHours(): HourRange[] {
  return [1, 2, 3, 4, 5].map((weekday) => ({ key: newKey(), weekday, open: '07:00', close: '17:00' }))
}

// Rentang di hari yang sama tidak boleh tumpang tindih, dan jam tutup harus setelah jam buka.
export function hoursError(ranges: HourRange[]): 'kosong' | 'urutan' | 'tumpang' | null {
  if (ranges.length === 0) return 'kosong'
  if (ranges.some((r) => !r.open || !r.close || r.close <= r.open)) return 'urutan'
  for (const day of WEEKDAYS) {
    const list = ranges.filter((r) => r.weekday === day).sort((a, b) => a.open.localeCompare(b.open))
    for (let i = 1; i < list.length; i++) if (list[i].open < list[i - 1].close) return 'tumpang'
  }
  return null
}

export function quotaError(rules: QuotaRule[]): 'urutan' | 'angka' | 'tumpang' | null {
  if (rules.some((r) => !r.start || !r.end || r.end <= r.start)) return 'urutan'
  if (rules.some((r) => !(Number(r.quota) >= 1))) return 'angka'
  const sorted = [...rules].sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) return 'tumpang'
  return null
}

// Angka yang tidak biasa tetap boleh, tetapi penjual diminta memastikan dulu (ronde 41).
export function unusualNumbers(input: { cutoff?: number; quotas?: number[]; preps?: number[] }): string[] {
  const out: string[] = []
  if ((input.cutoff ?? 0) > 120) out.push('cutoff')
  if ((input.preps ?? []).some((p) => p > 60)) out.push('prep')
  if ((input.quotas ?? []).some((q) => q > 20)) out.push('quota')
  return out
}

export function HoursEditor({ value, onChange, idPrefix }: { value: HourRange[]; onChange: (next: HourRange[]) => void; idPrefix: string }) {
  const { t } = useTranslation()
  const update = (key: string, patch: Partial<HourRange>) => onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-3">
      {WEEKDAYS.map((day) => {
        const list = value.filter((r) => r.weekday === day)
        return (
          <div key={day} className="rounded-lg border border-line-soft p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{t(`hari.${day}`)}</p>
              {list.length === 0 && <p className="text-sm text-muted">{t('jadwal.tutup')}</p>}
            </div>
            <ul className="mt-2 space-y-2">
              {list.map((r, index) => (
                <li key={r.key} className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="block font-medium">{t('jadwal.buka')}</span>
                    <Input
                      id={`${idPrefix}-${r.key}-buka`}
                      type="time"
                      step={300}
                      value={r.open}
                      onChange={(e) => update(r.key, { open: e.target.value })}
                      className="w-32"
                      aria-label={t('jadwal.buka_label', { day: t(`hari.${day}`), n: index + 1 })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block font-medium">{t('jadwal.tutup_jam')}</span>
                    <Input
                      id={`${idPrefix}-${r.key}-tutup`}
                      type="time"
                      step={300}
                      value={r.close}
                      onChange={(e) => update(r.key, { close: e.target.value })}
                      className="w-32"
                      aria-label={t('jadwal.tutup_label', { day: t(`hari.${day}`), n: index + 1 })}
                    />
                  </label>
                  <Button small variant="quiet" onClick={() => onChange(value.filter((x) => x.key !== r.key))}>
                    {t('umum.hapus')}
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              small
              className="mt-2"
              onClick={() => onChange([...value, { key: newKey(), weekday: day, open: list.at(-1)?.close ?? '07:00', close: '17:00' }])}
            >
              {list.length === 0 ? t('jadwal.buka_hari_ini') : t('jadwal.tambah_rentang')}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export function QuotaRulesEditor({ value, onChange }: { value: QuotaRule[]; onChange: (next: QuotaRule[]) => void }) {
  const { t } = useTranslation()
  const update = (key: string, patch: Partial<QuotaRule>) => onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {value.map((r, index) => (
          <li key={r.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-line-soft p-3">
            <label className="text-sm">
              <span className="block font-medium">{t('kuota.mulai')}</span>
              <Input type="time" step={300} value={r.start} onChange={(e) => update(r.key, { start: e.target.value })} className="w-32" aria-label={t('kuota.mulai_label', { n: index + 1 })} />
            </label>
            <label className="text-sm">
              <span className="block font-medium">{t('kuota.sampai')}</span>
              <Input type="time" step={300} value={r.end} onChange={(e) => update(r.key, { end: e.target.value })} className="w-32" aria-label={t('kuota.sampai_label', { n: index + 1 })} />
            </label>
            <label className="text-sm">
              <span className="block font-medium">{t('kuota.per_jam')}</span>
              <Input type="number" min={1} inputMode="numeric" value={r.quota} onChange={(e) => update(r.key, { quota: e.target.value })} className="w-24" aria-label={t('kuota.angka_label', { n: index + 1 })} />
            </label>
            <Button small variant="quiet" onClick={() => onChange(value.filter((x) => x.key !== r.key))}>
              {t('umum.hapus')}
            </Button>
          </li>
        ))}
      </ul>
      <Button small onClick={() => onChange([...value, { key: newKey(), start: '11:00', end: '13:00', quota: '' }])}>
        {t('kuota.tambah')}
      </Button>
    </div>
  )
}

export const TAGS = ['pedas', 'vegetarian', 'dingin', 'panas', 'halal'] as const

export async function uploadTenantImage(tenantId: string, file: File, prefix: string): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${tenantId}/${prefix}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('tenant-media').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw toAppError(error)
  return path
}

export function imageProblem(file: File | null): 'tipe' | 'besar' | null {
  if (!file) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'tipe'
  if (file.size > 3 * 1024 * 1024) return 'besar'
  return null
}

export function TagPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation()
  return (
    <fieldset>
      <legend className="text-sm font-medium">{t('menu.penanda')}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {TAGS.map((tag) => {
          const on = value.includes(tag)
          return (
            <label key={tag} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? [...value, tag] : value.filter((x) => x !== tag))} className="size-4" />
              {t(`penanda.${tag}`)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
