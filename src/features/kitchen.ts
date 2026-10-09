// Tanpa alias @/ karena modul ini juga dipakai uji unit yang dikompilasi dengan tsconfig.node.json.
import { useEffect, useRef, useState } from 'react'

// Pesanan yang masih perlu dimasak: sudah dibayar dan belum siap diambil.
const PREP_STATUSES = new Set(['diterima', 'disiapkan'])

type PrepItem = { name: string; quantity: number; status: string; options: unknown }
type PrepOrder = { status: string; pickup_time: string; order_items: readonly PrepItem[] }

export type PrepLine = { label: string; quantity: number }
export type PrepSlot<O extends PrepOrder> = { time: string; orders: O[]; lines: PrepLine[]; portions: number }

// Pilihan tambahan disimpan sebagai salinan saat pesanan dibuat: [{ group, name, price_delta, option_id }].
export function optionNames(options: unknown): string[] {
  if (!Array.isArray(options)) return []
  return options.flatMap((o) => (typeof o === 'object' && o !== null && typeof (o as { name?: unknown }).name === 'string' ? [(o as { name: string }).name] : []))
}

export function itemLabel(item: { name: string; options: unknown }): string {
  const names = optionNames(item.options)
  return names.length > 0 ? `${item.name} (${names.join(', ')})` : item.name
}

// Ringkasan porsi per jam ambil. Hanya isi berstatus normal yang dihitung: menu habis yang menunggu pilihan
// pembeli belum pasti dimasak, sedangkan yang diganti atau dihapus sudah tidak perlu.
export function prepSummary<O extends PrepOrder>(orders: readonly O[]): PrepSlot<O>[] {
  const slots = new Map<string, { orders: O[]; counts: Map<string, number> }>()
  for (const order of orders) {
    if (!PREP_STATUSES.has(order.status)) continue
    let slot = slots.get(order.pickup_time)
    if (!slot) {
      slot = { orders: [], counts: new Map() }
      slots.set(order.pickup_time, slot)
    }
    slot.orders.push(order)
    for (const item of order.order_items) {
      if (item.status !== 'normal') continue
      const label = itemLabel(item)
      slot.counts.set(label, (slot.counts.get(label) ?? 0) + item.quantity)
    }
  }
  return [...slots.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([time, slot]) => {
      const lines = [...slot.counts.entries()]
        .map(([label, quantity]) => ({ label, quantity }))
        .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, 'id'))
      return { time, orders: slot.orders, lines, portions: lines.reduce((sum, line) => sum + line.quantity, 0) }
    })
}

export type WakeLockState = 'unsupported' | 'active' | 'inactive'

// Menjaga layar tetap menyala selama halaman terbuka. Sistem melepas kunci saat halaman tersembunyi, jadi kunci
// diminta ulang saat terlihat lagi. Safari hanya memberi kunci dari ketukan, jadi setiap ketukan juga mencoba lagi.
export function useWakeLock(): { state: WakeLockState; request: () => void } {
  const supported = 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  const acquireRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!supported) return
    let lock: WakeLockSentinel | null = null
    let pending = false
    let stopped = false

    function acquire() {
      if (stopped || pending || (lock && !lock.released) || document.visibilityState !== 'visible') return
      pending = true
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          pending = false
          if (stopped) {
            void sentinel.release().catch(() => undefined)
            return
          }
          lock = sentinel
          sentinel.addEventListener('release', () => setActive(false), { once: true })
          setActive(true)
        },
        () => {
          // Ditolak tanpa ketukan, saat hemat baterai, atau karena kebijakan browser. Tidak dicatat sebagai galat.
          pending = false
          setActive(false)
        },
      )
    }

    acquireRef.current = acquire
    acquire()
    document.addEventListener('visibilitychange', acquire)
    document.addEventListener('click', acquire)
    document.addEventListener('keydown', acquire)
    return () => {
      stopped = true
      acquireRef.current = () => {}
      document.removeEventListener('visibilitychange', acquire)
      document.removeEventListener('click', acquire)
      document.removeEventListener('keydown', acquire)
      if (lock && !lock.released) void lock.release().catch(() => undefined)
    }
  }, [supported])

  return { state: supported ? (active ? 'active' : 'inactive') : 'unsupported', request: () => acquireRef.current() }
}
