import { describe, expect, it } from 'vitest'
import { clock, isoWeekday, isValidWhatsapp, mmss, normalizeWhatsapp, orderNo, rupiah, waLink } from '../../src/lib/format'

describe('format', () => {
  it('rupiah bulat dengan titik ribuan', () => {
    expect(rupiah(21000)).toBe('Rp21.000')
    expect(rupiah(1000)).toBe('Rp1.000')
    expect(rupiah(0)).toBe('Rp0')
    expect(rupiah(null)).toBe('Rp0')
  })

  it('jam 24 jam per bahasa', () => {
    expect(clock('11:05:00', 'id')).toBe('11.05')
    expect(clock('11:05:00', 'en')).toBe('11:05')
    expect(clock(null, 'id')).toBe('')
  })

  it('hari ISO untuk tanggal WIB', () => {
    expect(isoWeekday('2026-10-08')).toBe(4)
    expect(isoWeekday('2026-10-11')).toBe(7)
    expect(isoWeekday('2026-10-12')).toBe(1)
  })

  it('nomor urut tiga digit', () => {
    expect(orderNo(23)).toBe('#023')
    expect(orderNo(null)).toBe('#...')
  })

  it('nomor WhatsApp Indonesia dan luar negeri', () => {
    expect(normalizeWhatsapp('0812-3456-7890')).toBe('+6281234567890')
    expect(normalizeWhatsapp('+62 812 3456 7890')).toBe('+6281234567890')
    expect(normalizeWhatsapp('6281234567890')).toBe('+6281234567890')
    expect(isValidWhatsapp('+6281234567890')).toBe(true)
    expect(isValidWhatsapp('+6221234567')).toBe(false)
    expect(isValidWhatsapp(normalizeWhatsapp('+65 9123 4567'))).toBe(true)
    expect(isValidWhatsapp(normalizeWhatsapp('12'))).toBe(false)
  })

  it('tautan WhatsApp tanpa tanda plus', () => {
    expect(waLink('+6281234567890', 'Halo #023')).toBe('https://wa.me/6281234567890?text=Halo%20%23023')
  })

  it('hitung mundur menit dan detik', () => {
    expect(mmss(300)).toBe('5:00')
    expect(mmss(65)).toBe('1:05')
  })
})
