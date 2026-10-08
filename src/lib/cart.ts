import { useSyncExternalStore } from 'react'

// Satu keranjang aktif untuk satu tenant. Disimpan di perangkat supaya tidak hilang saat halaman dimuat ulang.
export type CartLine = {
  key: string
  menuItemId: string
  name: string
  unitPrice: number
  prepMinutes: number
  optionIds: string[]
  optionLabels: string[]
  quantity: number
}

export type Cart = {
  tenantId: string
  tenantSlug: string
  tenantName: string
  lines: CartLine[]
}

const KEY = 'jaminin:keranjang'
const EVENT = 'jaminin:keranjang-berubah'

let cached: Cart | null | undefined

function read(): Cart | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(KEY)
    cached = raw ? (JSON.parse(raw) as Cart) : null
  } catch {
    cached = null
  }
  return cached
}

function write(cart: Cart | null): void {
  cached = cart && cart.lines.length > 0 ? cart : null
  try {
    if (cached) localStorage.setItem(KEY, JSON.stringify(cached))
    else localStorage.removeItem(KEY)
  } catch {
    // Mode privat: keranjang tetap ada selama halaman terbuka.
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cached = undefined
      callback()
    }
  }
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function useCart(): Cart | null {
  return useSyncExternalStore(subscribe, read, () => null)
}

export function getCart(): Cart | null {
  return read()
}

export function lineKey(menuItemId: string, optionIds: string[]): string {
  return [menuItemId, ...[...optionIds].sort()].join('|')
}

export function addToCart(tenant: { id: string; slug: string; name: string }, line: Omit<CartLine, 'key'>): void {
  const current = read()
  const base: Cart =
    current && current.tenantId === tenant.id
      ? current
      : { tenantId: tenant.id, tenantSlug: tenant.slug, tenantName: tenant.name, lines: [] }
  const key = lineKey(line.menuItemId, line.optionIds)
  const existing = base.lines.find((l) => l.key === key)
  const lines = existing
    ? base.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l))
    : [...base.lines, { ...line, key }]
  write({ ...base, lines })
}

export function setQuantity(key: string, quantity: number): void {
  const current = read()
  if (!current) return
  const lines = current.lines
    .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, Math.min(20, quantity)) } : l))
    .filter((l) => l.quantity > 0)
  write({ ...current, lines })
}

export function clearCart(): void {
  write(null)
}

export function cartSubtotal(cart: Cart | null): number {
  return cart ? cart.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) : 0
}

export function cartMaxPrep(cart: Cart | null): number {
  return cart ? cart.lines.reduce((max, l) => Math.max(max, l.prepMinutes), 0) : 0
}

export function cartCount(cart: Cart | null): number {
  return cart ? cart.lines.reduce((sum, l) => sum + l.quantity, 0) : 0
}

// Jam yang dipilih dari tombol jam istirahat, dipakai checkout kalau masih tersedia (usulan U7).
const SLOT_KEY = 'jaminin:jam-pilihan'

export function rememberSlot(date: string, time: string): void {
  try {
    sessionStorage.setItem(SLOT_KEY, JSON.stringify({ date, time }))
  } catch {
    // Tanpa penyimpanan, checkout memilih jam sendiri.
  }
}

export function recalledSlot(): { date: string; time: string } | null {
  try {
    const raw = sessionStorage.getItem(SLOT_KEY)
    return raw ? (JSON.parse(raw) as { date: string; time: string }) : null
  } catch {
    return null
  }
}

export function forgetSlot(): void {
  try {
    sessionStorage.removeItem(SLOT_KEY)
  } catch {
    // Tidak ada yang perlu dihapus.
  }
}
