// Tanpa alias @/ karena modul ini juga dipakai uji unit yang dikompilasi dengan tsconfig.node.json.
import { clock, dateLabel, orderNo, rupiah, type Lang } from '../lib/format'

export type KabarParams = Record<string, unknown>

type T = (key: string, options?: Record<string, unknown>) => string

// Semua jenis kabar yang dibuat database lewat private.notify. Teks push di Edge Function kirim-kabar memakai kalimat yang sama.
export const KABAR_KINDS = [
  'pesanan_diterima', 'mulai_disiapkan', 'siap_diambil', 'pengingat_jam_ambil', 'menu_habis', 'uang_kembali',
  'belum_siap_boleh_batal', 'jam_ambil_digeser', 'pesanan_dibatalkan', 'waktu_bayar_habis', 'tidak_diambil',
  'balasan_laporan', 'pesanan_baru', 'pilihan_menu_habis', 'setoran_terkirim', 'pendaftaran_disetujui',
  'pendaftaran_ditolak', 'ringkasan_pesanan_masuk', 'pendaftaran_baru', 'laporan_baru', 'tenant_ditangguhkan', 'tenant_diaktifkan', 'chat_baru',
]

const FREE_TEXT_REASON = ['pendaftaran_ditolak', 'tenant_ditangguhkan']

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export function kabarText(n: { kind: string; params: KabarParams }, t: T, lang: Lang): { title: string; body: string; detail: string | null } {
  if (!KABAR_KINDS.includes(n.kind)) return { title: t('kabar.umum_judul'), body: '', detail: null }
  const p = n.params ?? {}
  const date = p.pickup_date ? dateLabel(str(p.pickup_date), lang, t) : ''
  // "Hari ini" dan "besok" berada di tengah kalimat, jadi memakai bentuk huruf kecil.
  const midSentence = date === t('waktu.hari_ini') ? t('waktu.hari_ini_kecil') : date === t('waktu.besok') ? t('waktu.besok_kecil') : date
  const values = {
    nomor: orderNo(Number(p.number) || null),
    tenant: str(p.tenant_name),
    jam: clock(str(p.pickup_time), lang),
    tanggal: midSentence,
    kode: str(p.pickup_code),
    nama: str(p.pickup_name),
    jumlah: rupiah(Number(p.amount ?? 0)),
    menu: str(p.item),
    menit: str(p.minutes),
    banyak: str(p.count ?? p.orders),
    aksi: p.action ? t(`kabar.aksi_${str(p.action)}`) : '',
    kategori: p.category ? t(`laporan.kategori.${str(p.category)}`) : '',
    alasan: str(p.reason),
    dari: p.from === 'tenant' ? str(p.tenant_name) : str(p.pickup_name),
    cuplikan: str(p.snippet),
  }
  const bodyKey = n.kind === 'pesanan_dibatalkan' && Number(p.amount) > 0 ? 'kabar.pesanan_dibatalkan_isi_uang' : `kabar.${n.kind}_isi`
  // Alasan penolakan dan penangguhan adalah teks bebas dari tim; selain itu alasan berupa kode yang diterjemahkan.
  const detail = !FREE_TEXT_REASON.includes(n.kind) && p.reason ? t(`alasan.${str(p.reason)}`, { defaultValue: '' }) : ''
  return { title: t(`kabar.${n.kind}_judul`, values), body: t(bodyKey, values), detail: detail || null }
}
