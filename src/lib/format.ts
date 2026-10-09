import { TZDate } from '@date-fns/tz'
import { addDays, format } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'

export const WIB = 'Asia/Jakarta'

export type Lang = 'id' | 'en'

// Rupiah ditulis sama di kedua bahasa: Rp21.000.
export function rupiah(amount: number | null | undefined): string {
  return 'Rp' + Math.round(amount ?? 0).toLocaleString('id-ID')
}

// Jam 24 jam: 11.05 di bahasa Indonesia, 11:05 di bahasa Inggris (usulan U11).
export function clock(time: string | null | undefined, lang: Lang): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  return lang === 'en' ? `${h}:${m}` : `${h}.${m}`
}

export function clockFromDate(value: string | Date, lang: Lang): string {
  const d = new TZDate(new Date(value).getTime(), WIB)
  return clock(format(d, 'HH:mm'), lang)
}

// Tanggal WIB (yyyy-MM-dd) dari sebuah waktu, misalnya created_at dari database.
export function wibDate(value: string | Date): string {
  return format(new TZDate(new Date(value).getTime(), WIB), 'yyyy-MM-dd')
}

export function nowWib(): TZDate {
  return new TZDate(Date.now(), WIB)
}

export function todayWib(): string {
  return format(nowWib(), 'yyyy-MM-dd')
}

export function tomorrowWib(): string {
  return format(addDays(nowWib(), 1), 'yyyy-MM-dd')
}

export function dateLabel(date: string, lang: Lang, t: (k: string) => string): string {
  if (date === todayWib()) return t('waktu.hari_ini')
  if (date === tomorrowWib()) return t('waktu.besok')
  const d = new TZDate(`${date}T00:00:00+07:00`, WIB)
  return format(d, 'EEEE, d MMM', { locale: lang === 'en' ? enUS : idLocale })
}

export function longDate(date: string, lang: Lang): string {
  const d = new TZDate(`${date}T00:00:00+07:00`, WIB)
  return format(d, 'EEEE, d MMMM yyyy', { locale: lang === 'en' ? enUS : idLocale })
}

// Nama bulan untuk 'yyyy-MM', contoh "Oktober 2026".
export function monthLabel(month: string, lang: Lang): string {
  const d = new TZDate(`${month}-01T00:00:00+07:00`, WIB)
  return format(d, 'MMMM yyyy', { locale: lang === 'en' ? enUS : idLocale })
}

export function orderNo(n: number | null | undefined): string {
  return n ? '#' + String(n).padStart(3, '0') : '#...'
}

// Nomor WhatsApp disimpan dalam format internasional: 08xx menjadi +628xx.
export function normalizeWhatsapp(input: string): string {
  const digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '')
  if (digits.startsWith('62')) return '+' + digits
  if (digits.startsWith('0')) return '+62' + digits.slice(1)
  return '+' + digits
}

export function isValidWhatsapp(normalized: string): boolean {
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) return false
  if (normalized.startsWith('+62')) return /^\+628\d{7,12}$/.test(normalized)
  return true
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
}

export function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000))
}

export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Hari ISO untuk tanggal WIB 'yyyy-MM-dd': 1 Senin sampai 7 Minggu, sama dengan jadwal di database.
export function isoWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7
}
