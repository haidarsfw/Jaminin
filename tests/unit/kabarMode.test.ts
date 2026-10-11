import { describe, expect, it } from 'vitest'
import { kabarMode, unreadByMode } from '../../src/features/kabarText'

describe('mode notifikasi', () => {
  it('mengikuti halaman tujuan, jadi chat_baru bisa untuk pembeli atau penjual', () => {
    expect(kabarMode({ kind: 'chat_baru', url: '/pesanan/abc' })).toBe('pembeli')
    expect(kabarMode({ kind: 'chat_baru', url: '/penjual' })).toBe('penjual')
    expect(kabarMode({ kind: 'laporan_baru', url: '/tim/laporan' })).toBe('tim')
    expect(kabarMode({ kind: 'jam_tersedia', url: '/tenant/mama-bento' })).toBe('pembeli')
  })

  it('memakai jenisnya kalau tujuan kosong', () => {
    expect(kabarMode({ kind: 'pesanan_baru', url: null })).toBe('penjual')
    expect(kabarMode({ kind: 'pendaftaran_baru', url: null })).toBe('tim')
    expect(kabarMode({ kind: 'jenis_baru', url: null })).toBe('pembeli')
  })

  it('menghitung yang belum dibaca per mode', () => {
    const list = [
      { kind: 'pesanan_baru', url: '/penjual', read_at: null },
      { kind: 'pesanan_baru', url: '/penjual', read_at: '2026-10-11T10:00:00Z' },
      { kind: 'siap_diambil', url: '/pesanan/x', read_at: null },
    ]
    expect(unreadByMode(list)).toEqual({ pembeli: 1, penjual: 1, tim: 0 })
  })
})
