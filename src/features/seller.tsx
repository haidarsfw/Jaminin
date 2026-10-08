import { useQuery } from '@tanstack/react-query'
import { createContext, use, useState, type ReactNode } from 'react'
import { useAuth, type MyTenant } from '@/lib/auth'
import { supabase, type Tables } from '@/lib/supabase'

const KEY = 'jaminin:tenant-aktif'

type SellerState = {
  tenants: MyTenant[]
  active: MyTenant | null
  setActive: (id: string) => void
  isOwner: boolean
}

const SellerContext = createContext<SellerState | null>(null)

// Pengelola banyak tenant memilih tenant yang sedang diurus. Pilihan diingat di perangkat.
export function SellerProvider({ children }: { children: ReactNode }) {
  const { tenants } = useAuth()
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  })
  const active = tenants.find((t) => t.id === activeId) ?? tenants[0] ?? null
  const value: SellerState = {
    tenants,
    active,
    isOwner: active?.role === 'pemilik',
    setActive: (id) => {
      setActiveId(id)
      try {
        localStorage.setItem(KEY, id)
      } catch {
        // Pilihan tenant hanya berlaku untuk sesi ini.
      }
    },
  }
  return <SellerContext value={value}>{children}</SellerContext>
}

export function useSeller(): SellerState {
  const ctx = use(SellerContext)
  if (!ctx) throw new Error('useSeller harus dipakai di dalam SellerProvider')
  return ctx
}

export type TenantFull = Tables<'tenants'> & {
  tenant_hours: Tables<'tenant_hours'>[]
  tenant_quota_rules: Tables<'tenant_quota_rules'>[]
}

export function useTenantSettings(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-saya', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*, tenant_hours(*), tenant_quota_rules(*)').eq('id', tenantId!).single()
      if (error) throw error
      return data as TenantFull
    },
  })
}

// Bunyi pesanan baru dibuat dengan Web Audio, berulang sampai penjual menekan Lihat.
let audio: AudioContext | null = null

export function unlockAudio(): boolean {
  try {
    audio = audio ?? new AudioContext()
    void audio.resume()
    return true
  } catch {
    return false
  }
}

export function audioReady(): boolean {
  return !!audio && audio.state === 'running'
}

export function beep(): void {
  if (!audio || audio.state !== 'running') return
  const now = audio.currentTime
  for (const [offset, freq] of [
    [0, 880],
    [0.25, 1175],
  ] as const) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + offset)
    gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2)
    osc.connect(gain).connect(audio.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.22)
  }
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
}
