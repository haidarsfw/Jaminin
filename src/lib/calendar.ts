// Acara kalender untuk jam ambil (P1 B24): berkas .ics untuk iPhone dan laptop, tautan Google Calendar untuk Android.

export type PickupEvent = {
  uid: string
  title: string
  description: string
  location: string
  date: string
  time: string
  minutes?: number
}

// Jam ambil selalu WIB (UTC+7).
export function pickupStart(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00+07:00`)
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// RFC 5545: koma, titik koma, garis miring terbalik, dan baris baru harus di-escape.
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

export function icsContent(e: PickupEvent, now = new Date()): string {
  const start = pickupStart(e.date, e.time)
  const end = new Date(start.getTime() + (e.minutes ?? 10) * 60_000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jaminin//Pesanan//ID',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.uid}@jaminin`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    `LOCATION:${escapeText(e.location)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(e.title)}`,
    'TRIGGER:-PT5M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function googleCalendarUrl(e: PickupEvent): string {
  const start = pickupStart(e.date, e.time)
  const end = new Date(start.getTime() + (e.minutes ?? 10) * 60_000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: e.description,
    location: e.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function downloadIcs(e: PickupEvent, fileName: string): void {
  const url = URL.createObjectURL(new Blob([icsContent(e)], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
