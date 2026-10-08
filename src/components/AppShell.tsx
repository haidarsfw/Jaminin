import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { cartCount, cartSubtotal, useCart } from '@/lib/cart'
import { hasOriginSession, returnToOrigin, switchToDemo } from '@/lib/demo'
import { rupiah } from '@/lib/format'
import { rpc, supabase, toAppError } from '@/lib/supabase'
import { Button, Dialog, Notice } from './ui'

type Mode = 'pembeli' | 'penjual' | 'tim'

type NavItem = { to: string; label: string; exact?: boolean }

function useMode(): Mode {
  const { pathname } = useLocation()
  if (pathname.startsWith('/penjual')) return 'penjual'
  if (pathname.startsWith('/tim')) return 'tim'
  return 'pembeli'
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useSettings() {
  return useQuery({
    queryKey: ['pengaturan'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const mode = useMode()
  const online = useOnline()
  const { session, teamRole, tenants, profile } = useAuth()
  const { pathname } = useLocation()
  const cart = useCart()
  const settings = useSettings()
  const [demoOpen, setDemoOpen] = useState(false)

  const nav: Record<Mode, NavItem[]> = {
    pembeli: [
      { to: '/', label: t('nav.beranda'), exact: true },
      { to: '/pesanan', label: t('nav.pesanan') },
      { to: '/profil', label: t('nav.profil') },
    ],
    penjual: [
      { to: '/penjual', label: t('nav.papan'), exact: true },
      { to: '/penjual/menu', label: t('nav.menu') },
      { to: '/penjual/toko', label: t('nav.toko') },
      { to: '/penjual/setoran', label: t('nav.setoran') },
    ],
    tim: [
      { to: '/tim', label: t('nav.ringkasan'), exact: true },
      { to: '/tim/penjual', label: t('nav.penjual') },
      { to: '/tim/laporan', label: t('nav.laporan') },
      { to: '/tim/setoran', label: t('nav.setoran') },
      { to: '/tim/anggota', label: t('nav.anggota') },
    ],
  }

  const modes: { mode: Mode; to: string; label: string }[] = [{ mode: 'pembeli', to: '/', label: t('mode.pembeli') }]
  if (tenants.length > 0) modes.push({ mode: 'penjual', to: '/penjual', label: t('mode.penjual') })
  if (teamRole) modes.push({ mode: 'tim', to: '/tim', label: t('mode.tim') })

  const canDemo = !!settings.data?.demo_mode && !!session && (!!teamRole || !!profile?.is_demo || hasOriginSession())
  const showCartBar = mode === 'pembeli' && cart && !['/keranjang', '/checkout'].includes(pathname) && !pathname.startsWith('/bayar')

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#isi" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
        {t('umum.lewati_ke_isi')}
      </a>
      <header className="safe-top sticky top-0 z-30 border-b border-line-soft bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link to="/" className="flex min-h-11 items-center gap-2" aria-label={t('umum.ke_beranda')}>
            <span className="text-xl font-extrabold tracking-tight">Jaminin</span>
          </Link>
          <span className="rounded-md border border-line px-1.5 py-0.5 text-xs font-medium text-muted">{t('umum.draf_tampilan')}</span>
          <div className="ml-auto flex items-center gap-1">
            {canDemo && (
              <button type="button" onClick={() => setDemoOpen(true)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                {t('demo.panel')}
              </button>
            )}
            {modes.length > 1 && (
              <nav aria-label={t('mode.label')} className="flex rounded-lg border border-line p-0.5">
                {modes.map((m) => (
                  <Link
                    key={m.mode}
                    to={m.to}
                    className={`flex min-h-10 items-center rounded-md px-2 text-sm font-semibold ${mode === m.mode ? 'bg-accent text-on-accent' : 'text-ink'}`}
                    aria-current={mode === m.mode ? 'page' : undefined}
                  >
                    {m.label}
                  </Link>
                ))}
              </nav>
            )}
            {!session && (
              <Link to="/masuk" className="min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold text-accent">
                {t('akun.masuk')}
              </Link>
            )}
          </div>
        </div>
        <nav aria-label={t('nav.label')} className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 md:flex">
          {nav[mode].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink"
              activeProps={{ className: 'bg-surface text-ink border border-line-soft', 'aria-current': 'page' }}
            >
              {item.label}
            </Link>
          ))}
          {mode === 'tim' && (
            <Link to="/simulator-bayar" className="ml-auto min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold text-accent">
              {t('nav.simulator')}
            </Link>
          )}
        </nav>
      </header>

      {!online && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3">
          <Notice tone="warn">{t('umum.offline')}</Notice>
        </div>
      )}

      <main id="isi" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-40 pt-4 md:pb-24">
        {children}
      </main>

      {showCartBar && cart && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 md:bottom-4">
          <Link
            to="/keranjang"
            className="mx-auto flex min-h-12 max-w-md items-center justify-between rounded-xl bg-accent px-4 text-on-accent"
          >
            <span className="font-semibold">{t('keranjang.lihat', { count: cartCount(cart) })}</span>
            <span className="tabular font-bold">{rupiah(cartSubtotal(cart))}</span>
          </Link>
        </div>
      )}

      <nav aria-label={t('nav.label')} className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface md:hidden">
        <ul className="mx-auto flex max-w-md">
          {nav[mode].map((item) => (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="flex min-h-14 items-center justify-center px-1 text-center text-sm font-semibold text-muted"
                activeProps={{ className: 'text-accent underline underline-offset-4', 'aria-current': 'page' }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {canDemo && <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} />}
    </div>
  )
}

type DemoAccount = { user_id: string; email: string; full_name: string; demo_role: string }

function DemoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const accounts = useQuery({
    queryKey: ['demo-akun'],
    enabled: open,
    queryFn: () => rpc<DemoAccount[]>('demo_panel'),
  })

  const landing: Record<string, string> = { pembeli: '/', pemilik: '/penjual', karyawan: '/penjual', admin: '/tim', staf: '/tim' }

  async function run(key: string, action: () => Promise<unknown>, after?: string) {
    setBusy(key)
    setError(null)
    setDone(null)
    try {
      await action()
      await queryClient.invalidateQueries()
      if (after) {
        onClose()
        void navigate({ to: after })
      } else {
        setDone(key)
      }
    } catch (e) {
      setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('demo.judul')}>
      <p className="mb-3 text-sm text-muted">{t('demo.penjelasan')}</p>
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}
      {done === 'reset' && (
        <Notice tone="success" className="mb-3">
          {t('demo.reset_selesai')}
        </Notice>
      )}
      <ul className="space-y-2">
        {(accounts.data ?? []).map((a) => (
          <li key={a.user_id}>
            <Button
              full
              variant={a.user_id === user?.id ? 'primary' : 'secondary'}
              busy={busy === a.user_id}
              busyText={t('umum.memproses')}
              disabled={a.user_id === user?.id || !!busy}
              onClick={() => run(a.user_id, () => switchToDemo(a.user_id, !!profile?.is_demo), landing[a.demo_role] ?? '/')}
            >
              {t(`demo.peran.${a.demo_role}`, { defaultValue: a.full_name })}
              {a.user_id === user?.id ? ` (${t('demo.sedang_dipakai')})` : ''}
            </Button>
          </li>
        ))}
      </ul>
      {accounts.isPending && <p className="text-sm text-muted">{t('umum.memuat')}</p>}
      <div className="mt-4 grid gap-2 border-t border-line-soft pt-4">
        {hasOriginSession() && (
          <Button full busy={busy === 'kembali'} busyText={t('umum.memproses')} onClick={() => run('kembali', returnToOrigin, '/')}>
            {t('demo.kembali')}
          </Button>
        )}
        <Button
          full
          variant="danger"
          busy={busy === 'reset'}
          busyText={t('umum.memproses')}
          onClick={() => {
            if (window.confirm(t('demo.reset_konfirmasi'))) void run('reset', () => rpc('demo_reset'))
          }}
        >
          {t('demo.reset')}
        </Button>
        <Button full variant="quiet" onClick={() => run('mati', () => rpc('demo_set_mode', { p_on: false }), '/')}>
          {t('demo.matikan')}
        </Button>
      </div>
    </Dialog>
  )
}
