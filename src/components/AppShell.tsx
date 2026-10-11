import {
  BellIcon,
  CaretDownIcon,
  ChartBarIcon,
  CheckIcon,
  ClipboardTextIcon,
  CookingPotIcon,
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
import { AnimatePresence, LazyMotion, MotionConfig } from 'motion/react'
import * as m from 'motion/react-m'
import { useTranslation } from 'react-i18next'
import { kabarMode, kabarText, markKabarRead, unreadByMode, useKabar } from '@/features/kabar'
import { useAuth } from '@/lib/auth'
import { cartCount, cartSubtotal, useCart } from '@/lib/cart'
import { hasOriginSession, returnToOrigin, switchToDemo } from '@/lib/demo'
import { rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useMode, type Mode } from '@/lib/mode'
import { useTopic } from '@/lib/realtime'
import { rpc, supabase, toAppError } from '@/lib/supabase'
import { Button, Dialog, Notice, confirmDialog, ConfirmHost } from './ui'

const loadMotionFeatures = () => import('@/lib/motionFeatures').then((r) => r.default)

type NavItem = { to: string; label: string; icon: Icon; exact?: boolean }

// Ikon hanya penanda visual; nama tombol dan tautan tetap dari teksnya.
const iconDefaults = { size: 20, 'aria-hidden': true, className: 'shrink-0' } as const

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
  const [demoOpen, setDemoOpen] = useState(false)
  const kabar = useKabar()
  const unread = unreadByMode(kabar.data)

  const nav: Record<Mode, NavItem[]> = {
    pembeli: [
      { to: '/', label: t('nav.beranda'), icon: HouseIcon, exact: true },
      { to: '/pesanan', label: t('nav.pesanan'), icon: ReceiptIcon },
      { to: '/profil', label: t('nav.profil'), icon: UserIcon },
    ],
    penjual: [
      { to: '/penjual', label: t('nav.papan'), icon: ClipboardTextIcon, exact: true },
      { to: '/penjual/dapur', label: t('nav.dapur'), icon: CookingPotIcon },
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

  const canDemo = !!session && (!!teamRole || !!profile?.is_demo || hasOriginSession())
  const showCartBar = mode === 'pembeli' && cart && !['/keranjang', '/checkout'].includes(pathname) && !pathname.startsWith('/bayar')

  return (
    <IconContext.Provider value={iconDefaults}>
      <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
      <div className="flex min-h-dvh flex-col">
        <a href="#isi" className="print:hidden sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
          {t('umum.lewati_ke_isi')}
        </a>
        <header className="safe-top sticky top-0 z-30 [view-transition-name:app-header] border-b border-line-soft bg-canvas print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
            <Link to="/" className="flex min-h-11 items-center gap-2" aria-label={t('umum.ke_beranda')}>
              <span className="text-xl font-extrabold tracking-tight">Jaminin</span>
            </Link>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
              {canDemo && (
                <button type="button" onClick={() => setDemoOpen(true)} className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                  <UserSwitchIcon />
                  <span className="max-sm:sr-only">{t('demo.panel')}</span>
                </button>
              )}
              {modes.length > 1 && <ModeSwitch modes={modes} current={mode} unread={unread} />}
              {session && <KabarLink unread={unread[mode]} />}
              {!session && (
                <Link to="/masuk" className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent">
                  <SignInIcon />
                  {t('akun.masuk')}
                </Link>
              )}
            </div>
          </div>
          <nav aria-label={t('nav.label')} className="mx-auto hidden max-w-6xl flex-wrap gap-1 px-4 pb-2 md:flex">
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
        {session && <KabarToast mode={mode} />}

        <main id="isi" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-40 pt-4 md:pb-24 print:p-0">
          {children}
        </main>

        <AnimatePresence>
          {showCartBar && cart && (
          <m.div
            key="bilah-keranjang"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 md:bottom-4 print:hidden"
          >
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
          </m.div>
          )}
        </AnimatePresence>

        <nav aria-label={t('nav.label')} className="safe-bottom fixed inset-x-0 bottom-0 z-30 [view-transition-name:app-tabbar] border-t border-line-soft bg-surface md:hidden print:hidden">
          <ul className="mx-auto flex max-w-md">
            {nav[mode].map((item) => (
              <li key={item.to} className="min-w-0 flex-1">
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-center text-xs font-semibold text-muted wrap-anywhere"
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

        <ConfirmHost />
        {canDemo && <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} />}
      </div>
      </LazyMotion>
      </MotionConfig>
    </IconContext.Provider>
  )
}

// Satu tombol "Mode" yang jelas untuk berpindah antara pembeli, penjual, dan tim, seperti "Beralih ke mode tuan rumah" di Airbnb.
// Pilihannya muncul di jendela berisi nama dan penjelasan singkat tiap mode, supaya tidak perlu menebak artinya.
const MODE_ICON: Record<Mode, Icon> = { pembeli: ShoppingBagIcon, penjual: StorefrontIcon, tim: UsersThreeIcon }

function ModeSwitch({ modes, current, unread }: { modes: { mode: Mode; to: string; label: string }[]; current: Mode; unread: Record<Mode, number> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const CurrentIcon = MODE_ICON[current]
  // Notifikasi mode lain tidak muncul di mode ini, jadi cukup ditandai titik di tombol Mode.
  const elsewhere = modes.reduce((sum, x) => (x.mode === current ? sum : sum + unread[x.mode]), 0)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="relative flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:bg-canvas"
      >
        <CurrentIcon size={18} aria-hidden="true" />
        <span>
          <span className="text-muted max-sm:sr-only">{t('mode.tombol')} </span>
          {modes.find((x) => x.mode === current)?.label}
          {elsewhere > 0 && <span className="sr-only">, {t('mode.ada_baru', { count: elsewhere })}</span>}
        </span>
        <CaretDownIcon size={16} aria-hidden="true" className="text-muted" />
        {elsewhere > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-canvas bg-accent" />}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('mode.ganti')}>
        <ul className="space-y-2">
          {modes.map((x) => {
            const ModeIcon = MODE_ICON[x.mode]
            const active = x.mode === current
            const count = active ? 0 : unread[x.mode]
            return (
              <li key={x.mode}>
                <Link
                  to={x.to}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-canvas'}`}
                >
                  <ModeIcon size={26} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{x.label}</span>
                    <span className="block text-sm text-muted">{t(`mode.isi_${x.mode}`)}</span>
                  </span>
                  {count > 0 && (
                    <span className="tabular shrink-0 rounded-full bg-accent px-2 text-xs font-bold leading-6 text-on-accent">{t('mode.baru', { count })}</span>
                  )}
                  {active && <CheckIcon size={20} weight="bold" aria-hidden="true" className="shrink-0" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </Dialog>
    </>
  )
}

function KabarLink({ unread }: { unread: number }) {
  const { t } = useTranslation()
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
            <m.span
              key={unread}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.4 }}
              aria-hidden="true"
              className="tabular min-w-6 rounded-full bg-accent px-1.5 text-center text-xs font-bold leading-6 text-on-accent"
            >
              {unread > 9 ? '9+' : unread}
            </m.span>
          )}
        </>
      )}
    </Link>
  )
}

// Notifikasi baru yang masuk saat aplikasi terbuka, tampil sebentar di kanan atas (di HP: di atas, selebar layar).
// Hanya notifikasi untuk mode yang sedang dipakai; notifikasi mode lain ditandai di tombol Mode.
function KabarToast({ mode }: { mode: Mode }) {
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
    const timer = setTimeout(() => setToastId(null), 8_000)
    return () => clearTimeout(timer)
  }, [toastId])

  const item = toastId ? kabar.data?.find((k) => k.id === toastId) : undefined
  const url = item?.url?.startsWith('/') ? item.url : null
  // Halaman tujuan sudah menampilkan perubahannya sendiri, jadi toast tidak perlu menutupinya.
  const show = !!item && url !== pathname && kabarMode(item) === mode
  const text = item ? kabarText(item, t, currentLang()) : null

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-40 flex justify-center px-3 sm:justify-end sm:px-4 print:hidden">
      <AnimatePresence mode="wait">
        {show && item && text && (
          <m.div
            key={item.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg"
          >
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
            <button type="button" onClick={() => setToastId(null)} className="-mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas" aria-label={t('umum.tutup')}>
              <XIcon size={20} />
            </button>
          </m.div>
        )}
      </AnimatePresence>
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
          onClick={async () => {
            if (await confirmDialog(t('demo.reset_konfirmasi'))) void run('reset', () => rpc('demo_reset'))
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
