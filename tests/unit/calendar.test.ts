import { describe, expect, it } from 'vitest'
import { googleCalendarUrl, icsContent, pickupStart } from '../../src/lib/calendar'

const event = {
  uid: 'pesanan-1',
  title: 'Ambil pesanan #007 di Mama Bento',
  description: 'Kode ambil K7MP, atas nama Sari; bawa HP.\nhttps://jaminin.test/pesanan/1',
  location: 'Kantin lantai 1, kios 4',
  date: '2026-10-09',
  time: '12:05:00',
}

describe('kalender jam ambil', () => {
  it('jam ambil dibaca sebagai WIB', () => {
    expect(pickupStart('2026-10-09', '12:05').toISOString()).toBe('2026-10-09T05:05:00.000Z')
  })

  it('berkas ics memakai UTC, durasi 10 menit, dan pengingat 5 menit', () => {
    const ics = icsContent(event, new Date('2026-10-08T10:00:00Z'))
    expect(ics).toContain('DTSTART:20261009T050500Z\r\n')
    expect(ics).toContain('DTEND:20261009T051500Z\r\n')
    expect(ics).toContain('DTSTAMP:20261008T100000Z\r\n')
    expect(ics).toContain('TRIGGER:-PT5M\r\n')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('koma, titik koma, dan baris baru di-escape', () => {
    const ics = icsContent(event)
    expect(ics).toContain('DESCRIPTION:Kode ambil K7MP\\, atas nama Sari\\; bawa HP.\\nhttps://jaminin.test/pesanan/1\r\n')
    expect(ics).toContain('LOCATION:Kantin lantai 1\\, kios 4\r\n')
  })

  it('tautan Google Calendar memakai rentang waktu yang sama', () => {
    const url = new URL(googleCalendarUrl(event))
    expect(url.hostname).toBe('calendar.google.com')
    expect(url.searchParams.get('dates')).toBe('20261009T050500Z/20261009T051500Z')
    expect(url.searchParams.get('text')).toBe(event.title)
  })
})
