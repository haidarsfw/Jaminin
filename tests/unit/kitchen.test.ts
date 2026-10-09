import { describe, expect, it } from 'vitest'
import { itemLabel, optionNames, prepSummary } from '../../src/features/kitchen'

type Item = { name: string; quantity: number; status: string; options: unknown }

const item = (name: string, quantity: number, options: string[] = [], status = 'normal'): Item => ({
  name,
  quantity,
  status,
  options: options.map((o, i) => ({ group: 'Pilihan', name: o, price_delta: 0, option_id: `opsi-${i}` })),
})

const order = (id: string, pickup_time: string, status: string, order_items: Item[]) => ({ id, pickup_time, status, order_items })

describe('daftar siap-masak', () => {
  it('menjumlahkan porsi yang sama per jam ambil, terbanyak lebih dulu', () => {
    const slots = prepSummary([
      order('a', '11:05:00', 'diterima', [item('Kopi Susu', 2, ['Dingin', 'Normal']), item('Matcha Latte', 1)]),
      order('b', '11:05:00', 'disiapkan', [item('Kopi Susu', 1, ['Dingin', 'Normal']), item('Matcha Latte', 1)]),
      order('c', '11:05:00', 'diterima', [item('Kopi Susu', 1, ['Panas', 'Normal'])]),
    ])
    expect(slots).toHaveLength(1)
    expect(slots[0].time).toBe('11:05:00')
    expect(slots[0].lines).toEqual([
      { label: 'Kopi Susu (Dingin, Normal)', quantity: 3 },
      { label: 'Matcha Latte', quantity: 2 },
      { label: 'Kopi Susu (Panas, Normal)', quantity: 1 },
    ])
    expect(slots[0].portions).toBe(6)
    expect(slots[0].orders.map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })

  it('hanya pesanan yang belum siap, diurutkan per jam ambil', () => {
    const slots = prepSummary([
      order('siap', '09:05:00', 'siap', [item('Roti', 1)]),
      order('akhir', '13:05:00', 'diterima', [item('Bakso', 1)]),
      order('awal', '11:05:00', 'disiapkan', [item('Mie Ayam', 2)]),
      order('bayar', '11:05:00', 'menunggu_bayar', [item('Mie Ayam', 5)]),
      ...['selesai', 'dibatalkan', 'tidak_diambil', 'kedaluwarsa'].map((s) => order(s, '11:05:00', s, [item('Mie Ayam', 9)])),
    ])
    expect(slots.map((s) => s.time)).toEqual(['11:05:00', '13:05:00'])
    expect(slots[0].lines).toEqual([{ label: 'Mie Ayam', quantity: 2 }])
    expect(slots[0].orders.map((o) => o.id)).toEqual(['awal'])
  })

  it('menu habis yang menunggu pembeli, diganti, atau dihapus tidak dihitung', () => {
    const slots = prepSummary([
      order('a', '12:05:00', 'diterima', [
        item('Kopi Susu', 1, ['Dingin', 'Normal'], 'diganti'),
        item('Americano', 1, ['Dingin']),
        item('Roti Mentega', 2, [], 'dihapus'),
        item('Matcha Latte', 1, [], 'habis_menunggu'),
      ]),
      order('b', '12:05:00', 'diterima', [item('Matcha Latte', 1, [], 'habis_menunggu')]),
    ])
    expect(slots[0].lines).toEqual([{ label: 'Americano (Dingin)', quantity: 1 }])
    expect(slots[0].portions).toBe(1)
    expect(slots[0].orders.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('jam ambil tanpa porsi pasti tetap muncul dengan nol porsi', () => {
    const slots = prepSummary([order('a', '15:05:00', 'diterima', [item('Waffle', 1, [], 'habis_menunggu')])])
    expect(slots).toEqual([{ time: '15:05:00', orders: [expect.objectContaining({ id: 'a' })], lines: [], portions: 0 }])
  })

  it('tanpa pesanan menghasilkan daftar kosong', () => {
    expect(prepSummary([])).toEqual([])
  })
})

describe('nama menu dan pilihan', () => {
  it('pilihan ditulis dalam kurung sesuai urutan', () => {
    expect(itemLabel(item('Nasi Ayam Katsu', 1, ['Pedas', 'Extra keju']))).toBe('Nasi Ayam Katsu (Pedas, Extra keju)')
    expect(itemLabel(item('Air Mineral', 1))).toBe('Air Mineral')
  })

  it('isi pilihan yang tidak terduga diabaikan', () => {
    expect(optionNames(null)).toEqual([])
    expect(optionNames({ name: 'Dingin' })).toEqual([])
    expect(optionNames([{ name: 'Dingin' }, { group: 'Gula' }, 'Panas', null, { name: 7 }])).toEqual(['Dingin'])
  })
})
