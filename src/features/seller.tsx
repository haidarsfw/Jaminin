import { BellRingingIcon, SpeakerHighIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Notice } from '@/components/ui'
import { useAuth, type MyTenant } from '@/lib/auth'
import { todayWib } from '@/lib/format'
import { supabase, toAppError, type Tables } from '@/lib/supabase'

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

export type BoardOrder = Tables<'orders'> & {
  order_items: Tables<'order_items'>[]
  ratings: { thumbs_up: boolean; comment: string | null } | null
  order_messages: { count: number }[]
}

// Pesanan lunas satu tenant pada satu tanggal ambil. Papan dan layar dapur memakai cache yang sama.
export function useBoardOrders(tenantId: string | undefined, day: string) {
  return useQuery({
    queryKey: ['papan', tenantId, day],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), ratings(thumbs_up, comment), order_messages(count)')
        .eq('tenant_id', tenantId!)
        .eq('pickup_date', day)
        .not('paid_at', 'is', null)
        .order('pickup_time')
        .order('order_number')
      if (error) throw error
      return data as BoardOrder[]
    },
    refetchInterval: 20_000,
  })
}

export function useBoardAction() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run(key: string, fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['papan'] })
      return true
    } catch (e) {
      setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
      return false
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, run, setError }
}

const SEEN_KEY = 'jaminin:pesanan-dilihat'

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function useAudioUnlock() {
  const [ready, setReady] = useState(audioReady)
  return { ready, unlock: () => setReady(unlockAudio()) }
}

// Pesanan lunas hari ini yang belum pernah dilihat membunyikan alarm berulang sampai penjual menekan Lihat,
// juga saat papan sedang menampilkan tab besok. Layar dapur menampilkan ajakan bunyinya sendiri (soundPrompt).
export function OrderAlarm({ tenantId, soundPrompt = true }: { tenantId: string; soundPrompt?: boolean }) {
  const { t } = useTranslation()
  const orders = useBoardOrders(tenantId, todayWib())
  const [seen, setSeen] = useState(readSeen)
  const sound = useAudioUnlock()
  const fresh = useMemo(() => (orders.data ?? []).filter((o) => o.status === 'diterima' && !seen.has(o.id)).map((o) => o.id), [orders.data, seen])
  const freshKey = fresh.join(',')

  useEffect(() => {
    if (!freshKey) return
    beep()
    const id = window.setInterval(beep, 2500)
    return () => window.clearInterval(id)
  }, [freshKey])

  function markSeen() {
    const next = new Set(seen)
    for (const id of fresh) next.add(id)
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...next]))
    } catch {
      // Tanpa penyimpanan, daftar dilihat hanya bertahan selama halaman terbuka.
    }
    setSeen(next)
  }

  return (
    <>
      {soundPrompt && !sound.ready && (
        <Notice tone="warn" title={t('papan.bunyi_judul')}>
          <p>{t('papan.bunyi_isi')}</p>
          <Button icon={<SpeakerHighIcon />} className="mt-2" small variant="primary" onClick={sound.unlock}>
            {t('papan.nyalakan_bunyi')}
          </Button>
        </Notice>
      )}
      {fresh.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent-soft p-4">
          <p className="text-lg font-bold">{t('papan.pesanan_baru', { count: fresh.length })}</p>
          <Button icon={<BellRingingIcon />} variant="primary" onClick={markSeen}>
            {t('papan.lihat')}
          </Button>
        </div>
      )}
    </>
  )
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
