import {
  BellIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  FlagIcon,
  ForkKnifeIcon,
  HouseIcon,
  IconContext,
  QrCodeIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  SignInIcon,
  StorefrontIcon,
  UserIcon,
  UserSwitchIcon,
  UsersThreeIcon,
  WalletIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { kabarText, markKabarRead, useKabar } from '@/features/kabar'
import { useAuth } from '@/lib/auth'
import { cartCount, cartSubtotal, useCart } from '@/lib/cart'
import { hasOriginSession, returnToOrigin, switchToDemo } from '@/lib/demo'
import { rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { rpc, supabase, toAppError } from '@/lib/supabase'
import { Button, Dialog, Notice } from './ui'

type Mode = 'pembeli' | 'penjual' | 'tim'

type NavItem = { to: string; label: string; icon: Icon; exact?: boolean }

// Ikon hanya penanda visual; nama tombol dan tautan tetap dari teksnya.
const iconDefaults = { size: 20, 'aria-hidden': true, className: 'shrink-0' } as const

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
      { to: '/', label: t('nav.beranda'), icon: HouseIcon, exact: true },
      { to: '/pesanan', label: t('nav.pesanan'), icon: ReceiptIcon },
      { to: '/profil', label: t('nav.profil'), icon: UserIcon },
    ],
    penjual: [
      { to: '/penjual', label: t('nav.papan'), icon: ClipboardTextIcon, exact: true },
      { to: '/penjual/menu', label: t('nav.menu'), icon: ForkKnifeIcon },
      { to: '/penjual/toko', label: t('nav.toko'), icon: StorefrontIcon },
      { to: '/penjual/setoran', label: t('nav.setoran'), icon: WalletIcon },
    ],
    tim: [
      { to: '/tim', label: t('nav.ringkasan'), icon: ChartBarIcon, exact: true },
      { to: '/tim/penjual', label: t('nav.penjual'), icon: StorefrontIcon },
      { to: '/tim/laporan', label: t('nav.laporan'), icon: FlagIcon },
      { to: '/tim/setoran', label: t('nav.setoran'), icon: WalletIcon },
      { to: '/tim/anggota', label: t('nav.anggota'), icon: UsersThreeIcon },
    ],
  }

  const modes: { mode: Mode; to: string; label: string }[] = [{ mode: 'pembeli', to: '/', label: t('mode.pembeli') }]
  if (tenants.length > 0) modes.push({ mode: 'penjual', to: '/penjual', label: t('mode.penjual') })
  if (teamRole) modes.push({ mode: 'tim', to: '/tim', label: t('mode.tim') })

  const canDemo = !!settings.data?.demo_mode && !!session && (!!teamRole || !!profile?.is_demo || hasOriginSession())
  const showCartBar = mode === 'pembeli' && cart && !['/keranjang', '/checkout'].includes(pathname) && !pathname.startsWith('/bayar')

  return (
    <IconContext.Provider value={iconDefaults}>
      <div className="flex min-h-dvh flex-col">
        <a href="#isi" className="print:hidden sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
          {t('umum.lewati_ke_isi')}
        </a>
        <header className="safe-top sticky top-0 z-30 border-b border-line-soft bg-canvas print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
            <Link to="/" className="flex min-h-11 items-center gap-2" aria-label={t('umum.ke_beranda')}>
              <span className="text-xl font-extrabold tracking-tight">Jaminin</span>
            </Link>
            <span className="whitespace-nowrap rounded-md border border-line px-1.5 py-0.5 text-xs font-medium text-muted">{t('umum.draf_tampilan')}</span>
            <div className="ml-auto flex items-center gap-1">
              {canDemo && (
                <button type="button" onClick={() => setDemoOpen(true)} className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                  <UserSwitchIcon />
                  {t('demo.panel')}
                </button>
              )}
              {modes.length > 1 && (
                <nav aria-label={t('mode.label')} className="flex rounded-lg border border-line p-0.5">
                  {modes.map((m) => (
                    <Link
                      key={m.mode}
                      to={m.to}
                      className={`flex min-h-10 items-center whitespace-nowrap rounded-md px-2 text-sm font-semibold ${mode === m.mode ? 'bg-accent text-on-accent' : 'text-ink'}`}
                      aria-current={mode === m.mode ? 'page' : undefined}
                    >
                      {m.label}
                    </Link>
                  ))}
                </nav>
              )}
              {session && <KabarLink />}
              {!session && (
                <Link to="/masuk" className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent">
                  <SignInIcon />
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
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
                activeProps={{ className: 'bg-surface text-ink border border-line-soft', 'aria-current': 'page' }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon weight={isActive ? 'fill' : 'regular'} />
                    {item.label}
                  </>
                )}
              </Link>
            ))}
            {mode === 'tim' && (
              <Link to="/simulator-bayar" className="ml-auto flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-accent">
                <QrCodeIcon />
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
        {session && <KabarToast />}

        <main id="isi" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-40 pt-4 md:pb-24 print:p-0">
          {children}
        </main>

        {showCartBar && cart && (
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 md:bottom-4 print:hidden">
            <Link
              to="/keranjang"
              className="mx-auto flex min-h-12 max-w-md items-center justify-between rounded-xl bg-accent px-4 text-on-accent"
            >
              <span className="flex items-center gap-2 font-semibold">
                <ShoppingBagIcon size={22} />
                {t('keranjang.lihat', { count: cartCount(cart) })}
              </span>
              <span className="tabular font-bold">{rupiah(cartSubtotal(cart))}</span>
            </Link>
          </div>
        )}

        <nav aria-label={t('nav.label')} className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface md:hidden print:hidden">
          <ul className="mx-auto flex max-w-md">
            {nav[mode].map((item) => (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-center text-xs font-semibold text-muted"
                  activeProps={{ className: 'text-accent', 'aria-current': 'page' }}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={24} weight={isActive ? 'fill' : 'regular'} />
                      {item.label}
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {canDemo && <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} />}
      </div>
    </IconContext.Provider>
  )
}

function KabarLink() {
  const { t } = useTranslation()
  const kabar = useKabar()
  const unread = (kabar.data ?? []).filter((k) => !k.read_at).length
  return (
    <Link
      to="/kabar"
      aria-label={unread > 0 ? t('kabar.tautan_belum_dibaca', { count: unread }) : undefined}
      className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-ink"
      activeProps={{ className: 'text-accent', 'aria-current': 'page' }}
    >
      {({ isActive }) => (
        <>
          <BellIcon size={22} weight={isActive ? 'fill' : 'regular'} />
          {/* Di HP cukup lonceng dan jumlahnya; nama tautan tetap terbaca pembaca layar. */}
          <span className="max-sm:sr-only">{t('kabar.tautan')}</span>
          {unread > 0 && (
            <span aria-hidden="true" className="tabular min-w-6 rounded-full bg-accent px-1.5 text-center text-xs font-bold leading-6 text-on-accent">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

// Kabar baru yang masuk lewat Realtime saat aplikasi terbuka, tampil sebentar di atas halaman.
function KabarToast() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const kabar = useKabar()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [toastId, setToastId] = useState<string | null>(null)

  useTopic(user ? `user:${user.id}` : null, ['notification'], (_event, payload) => {
    if (typeof payload.id === 'string') setToastId(payload.id)
  })

  useEffect(() => {
    if (!toastId) return
    const timer = setTimeout(() => setToastId(null), 10_000)
    return () => clearTimeout(timer)
  }, [toastId])

  const item = toastId ? kabar.data?.find((k) => k.id === toastId) : undefined
  const url = item?.url?.startsWith('/') ? item.url : null
  // Halaman tujuan kabar sudah menampilkan perubahannya sendiri, jadi toast tidak perlu menutupinya.
  if (!item || url === pathname) return null
  const text = kabarText(item, t, currentLang())

  return (
    <div className="fixed inset-x-0 bottom-[calc(7.75rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-20 print:hidden">
      <div role="status" className="mx-auto flex max-w-md items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-md">
        <BellIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{text.title}</p>
          {text.body && <p className="text-sm">{text.body}</p>}
          {url && (
            <button
              type="button"
              className="mt-1 min-h-11 text-sm font-semibold text-accent underline underline-offset-4"
              onClick={() => {
                setToastId(null)
                void markKabarRead([item.id])
                void navigate({ href: url })
              }}
            >
              {t('kabar.lihat')}
            </button>
          )}
        </div>
        <button type="button" onClick={() => setToastId(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted" aria-label={t('umum.tutup')}>
          <XIcon size={20} />
        </button>
      </div>
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
      if (after) {
        // Pindah halaman dulu, supaya data halaman lama tidak diminta ulang dengan akun yang baru.
        onClose()
        await navigate({ to: after })
        await queryClient.resetQueries()
      } else {
        await queryClient.invalidateQueries()
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
