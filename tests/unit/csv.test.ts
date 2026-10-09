import { describe, expect, it } from 'vitest'
import { toCsv } from '../../src/lib/csv'

describe('rekap CSV', () => {
  it('memisahkan kolom dengan koma dan baris dengan CRLF', () => {
    expect(toCsv([['Tanggal', 'Jumlah'], ['2026-10-09', 21000]])).toBe('Tanggal,Jumlah\r\n2026-10-09,21000')
  })

  it('mengutip isian yang berisi koma, tanda kutip, atau baris baru', () => {
    expect(toCsv([['Kopi Susu (Dingin, Normal)', 'Kata "manis"', 'dua\nbaris']])).toBe('"Kopi Susu (Dingin, Normal)","Kata ""manis""","dua\nbaris"')
  })

  it('isian yang bisa dijalankan Excel sebagai rumus diberi tanda kutip satu', () => {
    expect(toCsv([['=HYPERLINK("x")', '+62812', '-1', '@SUM', 'Sari']])).toBe(`"'=HYPERLINK(""x"")",'+62812,'-1,'@SUM,Sari`)
  })

  it('angka dan isian kosong ditulis apa adanya', () => {
    expect(toCsv([[-500, null, undefined, 0]])).toBe('-500,,,0')
  })
})
