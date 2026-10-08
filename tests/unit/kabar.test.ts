import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import en from '../../src/locales/en.json'
import id from '../../src/locales/id.json'
import { kabarText } from '../../src/features/kabarText'
import { todayWib } from '../../src/lib/format'

const tId = i18next.createInstance()
const tEn = i18next.createInstance()

beforeAll(async () => {
  await tId.init({ lng: 'id', resources: { id: { translation: id } }, interpolation: { escapeValue: false } })
  await tEn.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
})

const order = { number: 7, tenant_name: 'Mama Bento', pickup_time: '12:05', pickup_date: '2026-01-05', pickup_code: 'K7MP', pickup_name: 'Sari' }

describe('teks kabar', () => {
  it('siap diambil memakai nomor urut, kode, dan tenant', () => {
    expect(kabarText({ kind: 'siap_diambil', params: order }, tId.t, 'id')).toEqual({
      title: 'Pesanan #007 siap diambil',
      body: 'Tunjukkan kode K7MP di Mama Bento.',
      detail: null,
    })
    expect(kabarText({ kind: 'siap_diambil', params: order }, tEn.t, 'en').title).toBe('Order #007 is ready')
  })

  it('jam ditulis dengan titik di bahasa Indonesia dan titik dua di bahasa Inggris', () => {
    expect(kabarText({ kind: 'pesanan_diterima', params: order }, tId.t, 'id').body).toBe('Jam ambil 12.05 di Mama Bento.')
    expect(kabarText({ kind: 'pesanan_diterima', params: order }, tEn.t, 'en').body).toBe('Pickup at 12:05 at Mama Bento.')
  })

  it('pesanan dibatalkan dengan uang kembali menyebut jumlah dan alasan', () => {
    const text = kabarText({ kind: 'pesanan_dibatalkan', params: { ...order, amount: 24000, reason: 'pembeli' } }, tId.t, 'id')
    expect(text.body).toBe('Uang kembali Rp24.000.')
    expect(text.detail).toBe('Dibatalkan pembeli')
  })

  it('alasan penolakan pendaftaran adalah teks bebas dari tim', () => {
    const text = kabarText({ kind: 'pendaftaran_ditolak', params: { tenant_name: 'Kopi', reason: 'Foto menu belum ada' } }, tId.t, 'id')
    expect(text.body).toBe('Alasan: Foto menu belum ada')
    expect(text.detail).toBeNull()
  })

  it('hari ini dan besok ditulis huruf kecil di tengah kalimat', () => {
    const params = { ...order, pickup_date: todayWib(), pickup_time: '18:30', pickup_name: 'Dimas' }
    expect(kabarText({ kind: 'pesanan_baru', params }, tId.t, 'id').body).toBe('Jam ambil 18.30, hari ini, atas nama Dimas.')
    expect(kabarText({ kind: 'pesanan_baru', params }, tEn.t, 'en').body).toBe('Pickup 18:30, today, for Dimas.')
  })

  it('jenis yang belum dikenal tetap punya judul', () => {
    expect(kabarText({ kind: 'jenis_baru', params: {} }, tId.t, 'id')).toEqual({ title: 'Kabar dari Jaminin', body: '', detail: null })
  })
})
