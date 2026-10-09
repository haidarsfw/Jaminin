import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../../src/locales/en.json'
import id from '../../src/locales/id.json'
import { KABAR_KINDS } from '../../src/features/kabarText'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`)))
}

const base = (key: string) => key.replace(/_(one|other)$/, '')
const idKeys = new Set(flatten(id as Tree).map(base))
const enKeys = new Set(flatten(en as Tree).map(base))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.gen.ts') ? [path] : []
  })
}

const code = sourceFiles('src').map((f) => readFileSync(f, 'utf8')).join('\n')

// Kunci dinamis dipakai dengan nilai dari database; daftar nilainya mengikuti enum dan kode alasan di migrasi.
const dynamic: Record<string, string[]> = {
  'status.': ['menunggu_bayar', 'diterima', 'disiapkan', 'siap', 'selesai', 'dibatalkan', 'kedaluwarsa', 'tidak_diambil', 'dibatalkan_sebelum_bayar'],
  'tahap.': ['diterima', 'disiapkan', 'siap', 'selesai'],
  'item_status.': ['normal', 'habis_menunggu', 'diganti', 'dihapus'],
  'jam.status.': ['tersedia', 'penuh', 'lewat', 'jeda', 'batas_harian', 'tutup'],
  'jam.status_singkat.': ['tersedia', 'penuh', 'lewat', 'jeda', 'batas_harian', 'tutup'],
  'penjual.status.': ['menunggu', 'disetujui', 'ditolak', 'ditangguhkan'],
  'laporan.kategori.': ['pesanan_salah', 'uang_belum_kembali', 'lainnya'],
  'laporan.status.': ['baru', 'diproses', 'selesai'],
  'penanggung.': ['aturan', 'tenant', 'jaminin'],
  'penanda.': ['pedas', 'vegetarian', 'dingin', 'panas', 'halal'],
  'hari.': ['1', '2', '3', '4', '5', '6', '7'],
  'profil.status_': ['mahasiswa', 'dosen', 'staf_binus', 'tamu', 'pekerja_kantin'],
  'profil.tema_': ['sistem', 'terang', 'gelap'],
  'profil.kabar_hasil.': ['ok', 'needs_install', 'unsupported', 'denied', 'mati', 'gagal'],
  'daftar.jenis_': ['makanan', 'minuman', 'keduanya'],
  'daftar.pengelola_': ['mandiri', 'pihak_kantin'],
  'checkout.': ['bungkus', 'makan_di_sini'],
  'menu.status_': ['hari_ini', 'sampai_dibuka'],
  'anggota.': ['admin', 'staf'],
  'angka.': ['cutoff', 'prep', 'quota'],
  'foto.galat_': ['tipe', 'besar'],
  'jadwal.galat_': ['kosong', 'urutan', 'tumpang'],
  'kuota.galat_': ['urutan', 'angka', 'tumpang'],
  'demo.peran.': ['pembeli', 'pemilik', 'karyawan', 'admin', 'staf', 'lainnya'],
  'kabar.': [...KABAR_KINDS.map((k) => `${k}_judul`), ...KABAR_KINDS.map((k) => `${k}_isi`), 'pesanan_dibatalkan_isi_uang'],
  'kabar.aksi_': ['ganti', 'hapus', 'batal'],
  'pesan_ulang.': ['tidak_tersedia', 'pilihan_berubah', 'habis', 'habis_hari_ini', 'harga_berubah'],
  'alasan.': [
    'waktu_habis', 'dibatalkan_pembeli', 'pembeli', 'belum_siap_jam_ambil', 'semua_menu_habis', 'pembeli_menu_habis',
    'belum_siap_saat_tutup', 'tim', 'tidak_diambil_saat_tutup', 'menu_habis_dihapus', 'menu_habis_otomatis', 'menu_habis_diganti', 'manual_tim', 'libur', 'jam_khusus', 'ditangguhkan',
  ],
}

describe('terjemahan', () => {
  it('kunci Indonesia dan Inggris sama', () => {
    expect([...idKeys].filter((k) => !enKeys.has(k))).toEqual([])
    expect([...enKeys].filter((k) => !idKeys.has(k))).toEqual([])
  })

  it('setiap kunci tetap di kode punya terjemahan', () => {
    const used = new Set([...code.matchAll(/\bt\(\s*'([a-z0-9_.]+)'/g)].map((m) => m[1]))
    expect([...used].filter((k) => !idKeys.has(k))).toEqual([])
  })

  it('setiap kunci dinamis punya terjemahan', () => {
    const missing = Object.entries(dynamic).flatMap(([prefix, values]) => values.map((v) => prefix + v).filter((k) => !idKeys.has(k)))
    expect(missing).toEqual([])
  })

  it('setiap kode galat dari database punya terjemahan', () => {
    const sql = sourceFiles('supabase')
    const migrations = readdirSync('supabase/migrations').map((f) => readFileSync(join('supabase/migrations', f), 'utf8')).join('\n')
    const codes = new Set([...migrations.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]))
    const fnCodes = sql.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]))
    fnCodes.forEach((c) => codes.add(c))
    expect([...codes].filter((c) => !idKeys.has(`galat.${c}`))).toEqual([])
  })

  it('setiap jenis kabar dari database punya teks', () => {
    const migrations = readdirSync('supabase/migrations').map((f) => readFileSync(join('supabase/migrations', f), 'utf8')).join('\n')
    const kinds = new Set([
      ...[...migrations.matchAll(/private\.notify(?:_tenant)?\(\s*[^,()]+,\s*'([a-z_]+)'/g)].map((m) => m[1]),
      ...[...migrations.matchAll(/private\.notify_team\(\s*'([a-z_]+)'/g)].map((m) => m[1]),
      ...[...migrations.matchAll(/private\.notify(?:_tenant|_team)?\([^;]*?case when [^;]*?then '([a-z_]+)' else '([a-z_]+)' end/g)].flatMap((m) => [m[1], m[2]]),
    ])
    expect(kinds.size).toBeGreaterThan(15)
    expect([...kinds].filter((k) => !KABAR_KINDS.includes(k))).toEqual([])
  })

  it('teks tidak memakai tanda pisah panjang', () => {
    const all = JSON.stringify(id) + JSON.stringify(en)
    expect(all.includes('—')).toBe(false)
  })
})
