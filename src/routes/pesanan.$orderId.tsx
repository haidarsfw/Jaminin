import { ArrowClockwiseIcon, ArrowSquareOutIcon, CalendarPlusIcon, CheckCircleIcon, ClockClockwiseIcon, FlagIcon, PaperPlaneRightIcon, QrCodeIcon, ReceiptIcon, ShareNetworkIcon, WhatsappLogoIcon, XCircleIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { SlotPicker } from '@/components/SlotPicker'
import { Button, ButtonLink, buttonClass, Card, Dialog, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, Select, StatusText, TextArea, useNow } from '@/components/ui'
import { ChatThread, chatIsOpen } from '@/features/chat'
import { reorder } from '@/features/buyer'
import { cachedPickup, pickupQr, statusKey, useOrder, type OrderFull, type OrderItem } from '@/features/orders'
import { downloadIcs, googleCalendarUrl, type PickupEvent } from '@/lib/calendar'
import { installBannerDismissed, dismissInstallBanner, isIos, isStandalone } from '@/lib/device'
import { clock, clockFromDate, dateLabel, mmss, orderNo, rupiah, todayWib, waLink } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc, supabase, toAppError, type Tables } from '@/lib/supabase'

export const Route = createFileRoute('/pesanan/$orderId')({
  component: () => (
    <RequireAuth needProfile={false}>
      <OrderPage />
    </RequireAuth>
  ),
})

function useAction() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run(key: string, fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['pesanan'] })
      await queryClient.invalidateQueries({ queryKey: ['pesanan-saya'] })
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

function OrderPage() {
  const { orderId } = Route.useParams()
  const { t } = useTranslation()
  const lang = currentLang()
  const order = useOrder(orderId)
  const now = useNow(1000)
  const action = useAction()
  const [reschedule, setReschedule] = useState(false)
  const [report, setReport] = useState(false)
  const [bannerHidden, setBannerHidden] = useState(installBannerDismissed())

  if (order.isPending) return <LoadingState />
  if (order.isError) {
    const cached = cachedPickup(orderId)
    if (cached?.code) {
      return (
        <div className="mx-auto max-w-md space-y-4">
          <Notice tone="warn">{t('pesanan.tanpa_sinyal')}</Notice>
          <Card className="text-center">
            <p className="text-sm text-muted">{cached.tenant}</p>
            <p className="text-3xl font-bold">{orderNo(cached.number)}</p>
            <div className="mx-auto my-3 w-fit rounded-lg bg-white p-3">
              <QRCodeSVG value={`JMN1:${cached.id}:${cached.code}`} size={176} />
            </div>
            <p className="font-mono text-4xl font-bold tracking-[0.25em]">{cached.code}</p>
            <p className="mt-2 text-sm">{t('pesanan.jam_ambil_x', { day: dateLabel(cached.pickupDate, lang, t), time: clock(cached.pickupTime, lang) })}</p>
          </Card>
        </div>
      )
    }
    return <ErrorState onRetry={() => void order.refetch()} />
  }
  const o = order.data
  if (!o) return <EmptyState title={t('pesanan.tidak_ada')} />

  const pickupMs = new Date(o.pickup_at).getTime()
  const beforePickup = now < pickupMs
  const active = ['diterima', 'disiapkan', 'siap'].includes(o.status)
  const notReadyAtPickup = ['diterima', 'disiapkan'].includes(o.status) && !beforePickup
  const canCancelEarly = o.status === 'diterima' && beforePickup
  const canReschedule = o.status === 'diterima' && o.rescheduled_count === 0 && o.promo_discount === 0
  const canReceive = ['disiapkan', 'siap'].includes(o.status) && !o.needs_buyer_action
  const pending = o.order_items.filter((i) => i.status === 'habis_menunggu')
  const showInstall = !!o.paid_at && isIos() && !isStandalone() && !bannerHidden

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={`${o.tenants?.name ?? ''} ${orderNo(o.order_number)}`}
        back={{ to: '/pesanan', label: t('pesanan.semua') }}
        description={<StatusText tone={o.status === 'dibatalkan' || o.status === 'kedaluwarsa' ? 'error' : o.status === 'siap' ? 'success' : 'info'}>{t(`status.${statusKey(o)}`)}</StatusText>}
      />

      {showInstall && (
        <Notice title={t('pasang.banner_judul')}>
          <p>{t('pasang.banner_isi')}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link to="/panduan-pasang" className="font-semibold text-accent underline underline-offset-4">
              {t('pasang.lihat_panduan')}
            </Link>
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => {
                dismissInstallBanner()
                setBannerHidden(true)
              }}
            >
              {t('umum.tutup')}
            </button>
          </div>
        </Notice>
      )}

      {o.status === 'menunggu_bayar' && (
        <Notice tone="warn">
          {t('pesanan.belum_bayar')}{' '}
          <Link to="/bayar/$orderId" params={{ orderId: o.id }} className="font-semibold underline">
            <QrCodeIcon />
            {t('pesanan.ke_bayar')}
          </Link>
        </Notice>
      )}

      {pending.length > 0 && <SoldOutResolver order={o} items={pending} now={now} onDone={() => void order.refetch()} />}

      {notReadyAtPickup && (
        <Notice tone="warn" title={t('pesanan.belum_siap_judul')}>
          <p>{t('pesanan.belum_siap_isi')}</p>
          <Button icon={<XCircleIcon />}
            className="mt-2"
            variant="danger"
            small
            busy={action.busy === 'batal-belum-siap'}
            busyText={t('umum.memproses')}
            onClick={() => {
              if (window.confirm(t('pesanan.batal_konfirmasi_penuh'))) void action.run('batal-belum-siap', () => rpc('buyer_cancel_order', { p_order: o.id }))
            }}
          >
            {t('pesanan.batal_uang_penuh')}
          </Button>
        </Notice>
      )}

      {active && o.pickup_code && (
        <Card className="text-center">
          <p className="text-sm text-muted">{t('pesanan.tunjukkan')}</p>
          <div className="mx-auto my-3 w-fit rounded-lg bg-white p-3">
            <QRCodeSVG value={pickupQr(o)} size={176} level="M" aria-label={t('pesanan.qr_ambil')} />
          </div>
          <p className="font-mono text-4xl font-bold tracking-[0.25em]">{o.pickup_code}</p>
          <p className="mt-1 text-sm text-muted">{t('pesanan.kode_ambil')}</p>
          <p className="mt-3 text-lg font-semibold">
            {t('pesanan.jam_ambil_x', { day: dateLabel(o.pickup_date, lang, t), time: clock(o.pickup_time, lang) })}
          </p>
          {beforePickup && o.pickup_date === todayWib() && (
            <p className="tabular text-sm text-muted" role="timer">
              {t('pesanan.hitung_mundur', { time: mmss(Math.floor((pickupMs - now) / 1000)) })}
            </p>
          )}
          <Button icon={<ShareNetworkIcon />}
            className="mt-3"
            small
            onClick={async () => {
              const text = t('pesanan.bagikan_teks', {
                tenant: o.tenants?.name ?? '',
                number: orderNo(o.order_number),
                code: o.pickup_code,
                time: clock(o.pickup_time, lang),
              })
              if (navigator.share) {
                try {
                  await navigator.share({ text })
                } catch {
                  // Pembeli menutup lembar bagikan.
                }
              } else {
                await navigator.clipboard.writeText(text)
                window.alert(t('pesanan.tersalin'))
              }
            }}
          >
            {t('pesanan.bagikan_kode')}
          </Button>
        </Card>
      )}

      <Timeline order={o} />

      {(['diterima', 'disiapkan', 'siap'].includes(o.status) && beforePickup) || o.paid_at ? (
        <div className="flex flex-wrap gap-2">
          {['diterima', 'disiapkan', 'siap'].includes(o.status) && beforePickup && <CalendarButtons order={o} />}
          {o.paid_at && (
            <ButtonLink icon={<ReceiptIcon />} to="/struk/$orderId" params={{ orderId: o.id }} small>
              {t('struk.lihat')}
            </ButtonLink>
          )}
          {['selesai', 'tidak_diambil', 'dibatalkan'].includes(o.status) && <ReorderButton order={o} />}
        </div>
      ) : null}

      <Card>
        <h2 className="mb-2 text-lg font-bold">{t('pesanan.isi')}</h2>
        <ul className="space-y-2">
          {o.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className={item.status === 'dihapus' || item.status === 'diganti' ? 'text-muted line-through' : ''}>
                {item.quantity}x {item.name}
                {Array.isArray(item.options) && item.options.length > 0 && (
                  <span className="block text-muted">{(item.options as { name: string }[]).map((x) => x.name).join(', ')}</span>
                )}
                {item.status !== 'normal' && <span className="block font-semibold text-warn-ink">{t(`item_status.${item.status}`)}</span>}
              </span>
              <span className="tabular shrink-0">{rupiah(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-sm">
          <Row label={t('uang.subtotal')} value={rupiah(o.subtotal)} />
          {o.promo_discount > 0 && <Row label={t('uang.potongan_promo')} value={`-${rupiah(o.promo_discount)}`} />}
          <Row label={t('uang.biaya_layanan')} value={rupiah(o.service_fee)} />
          <Row label={t('uang.dibayar')} value={rupiah(o.total_paid)} strong />
          {o.refunded_total > 0 && <Row label={t('uang.uang_kembali')} value={rupiah(o.refunded_total)} strong />}
        </dl>
        {o.refunds.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {o.refunds.map((r) => (
              <li key={r.id}>
                {rupiah(r.amount)}: {t(`alasan.${r.reason_code}`, { defaultValue: r.reason_code })}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted">
          {t(`checkout.${o.dining}`)}
          {o.cutlery ? `, ${t('pesanan.minta_alat_makan')}` : ''}
          {o.note ? `. ${t('pesanan.catatan')}: ${o.note}` : ''}
        </p>
        <p className="text-sm text-muted">{t('pesanan.atas_nama', { name: o.pickup_name })}</p>
      </Card>

      {action.error && <Notice tone="error">{action.error}</Notice>}

      <div className="grid gap-2 sm:grid-cols-2">
        {canReceive && (
          <Button icon={<CheckCircleIcon />}
            variant="primary"
            full
            busy={action.busy === 'terima'}
            busyText={t('umum.memproses')}
            onClick={() => {
              if (window.confirm(t('pesanan.terima_konfirmasi'))) void action.run('terima', () => rpc('buyer_confirm_received', { p_order: o.id }))
            }}
          >
            {t('pesanan.sudah_terima')}
          </Button>
        )}
        {canReschedule && (
          <Button icon={<ClockClockwiseIcon />} full onClick={() => setReschedule(true)}>
            {t('pesanan.geser')}
          </Button>
        )}
        {o.status === 'diterima' && o.promo_discount > 0 && <p className="text-sm text-muted sm:col-span-2">{t('pesanan.promo_tidak_bisa_geser')}</p>}
        {o.tenants && !o.tenants.is_sample && o.paid_at && (
          <a
            href={waLink(o.tenants.whatsapp, t('pesanan.wa_teks', { number: orderNo(o.order_number), name: o.pickup_name }))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-surface px-4 font-semibold"
          >
            <WhatsappLogoIcon />
            {t('pesanan.hubungi_penjual')}
          </a>
        )}
        {o.tenants?.is_sample && o.paid_at && <p className="text-sm text-muted">{t('pesanan.wa_contoh')}</p>}
        {o.paid_at && (
          <Button icon={<FlagIcon />} full onClick={() => setReport(true)}>
            {t('pesanan.laporkan')}
          </Button>
        )}
        {canCancelEarly && (
          <Button icon={<XCircleIcon />}
            variant="danger"
            full
            busy={action.busy === 'batal'}
            busyText={t('umum.memproses')}
            onClick={() => {
              if (window.confirm(t('pesanan.batal_konfirmasi'))) void action.run('batal', () => rpc('buyer_cancel_order', { p_order: o.id }))
            }}
          >
            {t('pesanan.batalkan')}
          </Button>
        )}
      </div>

      {o.paid_at && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">{t('chat.judul')}</h2>
            <p className="text-sm text-muted">{t('chat.isi')}</p>
          </div>
          <ChatThread orderId={o.id} side="pembeli" open={chatIsOpen(o)} />
        </Card>
      )}

      {o.status === 'selesai' && <RatingCard order={o} />}

      {o.reports.length > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-bold">{t('laporan.judul_saya')}</h2>
          <ul className="space-y-3">
            {o.reports.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="font-semibold">
                  {t(`laporan.kategori.${r.category}`)} · {t(`laporan.status.${r.status}`)}
                </p>
                <p>{r.story}</p>
                {r.report_replies.map((reply) => (
                  <p key={reply.id} className="mt-1 rounded-lg bg-canvas p-2">
                    <span className="font-semibold">{t('laporan.balasan_tim')}: </span>
                    {reply.body}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reschedule && <RescheduleDialog order={o} onClose={() => setReschedule(false)} />}
      {report && <ReportDialog order={o} onClose={() => setReport(false)} />}
    </div>
  )
}

// Isi pesanan lama masuk keranjang dengan harga dan pilihan yang berlaku sekarang, lalu pembeli memilih jam lagi.
function ReorderButton({ order }: { order: OrderFull }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <Button
        small
        icon={<ArrowClockwiseIcon />}
        busy={busy}
        busyText={t('umum.memproses')}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            const result = await reorder(order, (name) => window.confirm(t('keranjang.ganti_konfirmasi', { name })))
            if (!result) return
            if (result.added === 0) setError(t('pesan_ulang.kosong'))
            else await navigate({ to: '/keranjang' })
          } catch (e) {
            setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
          } finally {
            setBusy(false)
          }
        }}
      >
        {t('pesan_ulang.tombol')}
      </Button>
      {error && (
        <Notice tone="error" className="w-full">
          {error}
        </Notice>
      )}
    </>
  )
}

function CalendarButtons({ order }: { order: OrderFull }) {
  const { t } = useTranslation()
  const number = orderNo(order.order_number)
  const event: PickupEvent = {
    uid: order.id,
    title: t('kalender.judul_acara', { number, tenant: order.tenants?.name ?? '' }),
    description: t('kalender.isi_acara', { code: order.pickup_code, name: order.pickup_name, url: `${window.location.origin}/pesanan/${order.id}` }),
    location: order.tenants?.kiosk_location ?? '',
    date: order.pickup_date,
    time: order.pickup_time,
  }
  return (
    <>
      <Button icon={<CalendarPlusIcon />} small onClick={() => downloadIcs(event, `jaminin-pesanan-${number.slice(1)}.ics`)}>
        {t('kalender.tambah')}
      </Button>
      <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={buttonClass('secondary', false, true)}>
        <ArrowSquareOutIcon />
        {t('kalender.google')}
      </a>
    </>
  )
}

// Penilaian sekali setelah selesai, hanya terlihat oleh penjual dan tim (ronde 42).
function RatingCard({ order }: { order: OrderFull }) {
  const { t } = useTranslation()
  const action = useAction()
  const [choice, setChoice] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [missing, setMissing] = useState(false)
  const [sent, setSent] = useState(false)
  const rated = order.ratings

  if (rated) {
    return (
      <Card>
        <h2 className="text-lg font-bold">{t('nilai.judul')}</h2>
        {sent && <Notice tone="success" className="mt-2">{t('nilai.terkirim')}</Notice>}
        <p className="mt-1">{t('nilai.milikmu', { value: rated.thumbs_up ? t('nilai.label_puas') : t('nilai.label_kurang') })}</p>
        {rated.comment && <p className="mt-1 text-sm text-muted">{rated.comment}</p>}
      </Card>
    )
  }

  function send() {
    if (choice === null) {
      setMissing(true)
      return
    }
    void action
      .run('nilai', () => rpc('buyer_rate_order', { p_order: order.id, p_thumbs_up: choice, p_comment: comment.trim() || null }))
      .then((ok) => ok && setSent(true))
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">{t('nilai.judul')}</h2>
        <p className="text-sm text-muted">{t('nilai.isi')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('nilai.judul')}>
        {[true, false].map((up) => (
          <Button
            key={String(up)}
            variant={choice === up ? 'primary' : 'secondary'}
            aria-pressed={choice === up}
            onClick={() => {
              setChoice(up)
              setMissing(false)
            }}
          >
            {up ? t('nilai.puas') : t('nilai.kurang')}
          </Button>
        ))}
      </div>
      <Field label={t('nilai.komentar')} hint={t('nilai.komentar_isi')} optional>
        {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={comment} maxLength={200} rows={2} onChange={(e) => setComment(e.target.value)} />}
      </Field>
      {missing && <p className="text-sm font-medium text-danger">{t('nilai.pilih_dulu')}</p>}
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <Button icon={<PaperPlaneRightIcon />} variant="primary" busy={action.busy === 'nilai'} busyText={t('umum.memproses')} onClick={send}>
        {t('nilai.kirim')}
      </Button>
    </Card>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  )
}

function Timeline({ order }: { order: OrderFull }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const steps = [
    { key: 'diterima', at: order.paid_at },
    { key: 'disiapkan', at: order.preparing_at },
    { key: 'siap', at: order.ready_at },
    { key: 'selesai', at: order.completed_at },
  ]
  if (!order.paid_at) return null
  return (
    <Card>
      <h2 className="sr-only">{t('pesanan.tahap')}</h2>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className={s.at ? 'font-semibold' : 'text-muted'}>
              <span aria-hidden="true">{s.at ? '● ' : '○ '}</span>
              {t(`tahap.${s.key}`)}
            </span>
            <span className="tabular text-sm text-muted">{s.at ? clockFromDate(s.at, lang) : ''}</span>
          </li>
        ))}
      </ol>
      {(order.status === 'dibatalkan' || order.status === 'tidak_diambil') && (
        <p className="mt-2 text-sm font-semibold text-danger">{t(`alasan.${order.end_reason}`, { defaultValue: t(`status.${order.status}`) })}</p>
      )}
    </Card>
  )
}

function SoldOutResolver({ order, items, now, onDone }: { order: OrderFull; items: OrderItem[]; now: number; onDone: () => void }) {
  const { t } = useTranslation()
  const action = useAction()
  const [replaceFor, setReplaceFor] = useState<OrderItem | null>(null)
  return (
    <Notice tone="warn" title={t('menu_habis.judul')}>
      <ul className="space-y-3">
        {items.map((item) => {
          const left = item.resolution_deadline ? Math.max(0, Math.floor((new Date(item.resolution_deadline).getTime() - now) / 1000)) : 0
          return (
            <li key={item.id}>
              <p>{t('menu_habis.isi', { item: item.name, time: mmss(left) })}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button small onClick={() => setReplaceFor(item)}>
                  {t('menu_habis.ganti')}
                </Button>
                <Button
                  small
                  busy={action.busy === `hapus-${item.id}`}
                  busyText={t('umum.memproses')}
                  onClick={() => void action.run(`hapus-${item.id}`, () => rpc('buyer_resolve_sold_out', { p_order_item: item.id, p_action: 'hapus' })).then(onDone)}
                >
                  {t('menu_habis.hapus')}
                </Button>
                <Button
                  small
                  variant="danger"
                  busy={action.busy === `batal-${item.id}`}
                  busyText={t('umum.memproses')}
                  onClick={() => {
                    if (window.confirm(t('menu_habis.batal_konfirmasi')))
                      void action.run(`batal-${item.id}`, () => rpc('buyer_resolve_sold_out', { p_order_item: item.id, p_action: 'batal' })).then(onDone)
                  }}
                >
                  {t('menu_habis.batal_semua')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {action.error && <p className="mt-2 font-semibold text-danger">{action.error}</p>}
      {replaceFor && <ReplaceDialog order={order} item={replaceFor} onClose={() => setReplaceFor(null)} onDone={onDone} />}
    </Notice>
  )
}

type MenuRow = Tables<'menu_items'> & { option_groups: (Tables<'option_groups'> & { options: Tables<'options'>[] })[] }

function ReplaceDialog({ order, item, onClose, onDone }: { order: OrderFull; item: OrderItem; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const action = useAction()
  const menu = useQuery({
    queryKey: ['menu-pengganti', order.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('menu_items').select('*, option_groups(*, options(*))').eq('tenant_id', order.tenant_id).eq('is_active', true)
      if (error) throw error
      return data as MenuRow[]
    },
  })
  // Pengganti hanya yang sama atau lebih murah. Menu dengan pilihan wajib memakai pilihan termurah pertama.
  const candidates = (menu.data ?? [])
    .filter((m) => m.id !== item.menu_item_id && !m.sold_out_indefinite && m.sold_out_date !== order.pickup_date)
    .map((m) => {
      const optionIds = m.option_groups
        .filter((g) => g.min_select > 0)
        .flatMap((g) => [...g.options].filter((o) => o.is_active).sort((a, b) => a.price_delta - b.price_delta).slice(0, g.min_select).map((o) => o.id))
      const extra = m.option_groups.flatMap((g) => g.options).filter((o) => optionIds.includes(o.id)).reduce((s, o) => s + o.price_delta, 0)
      return { menu: m, optionIds, unit: m.price + extra }
    })
    .filter((c) => c.unit <= item.unit_price)
    .sort((a, b) => b.unit - a.unit)

  return (
    <Dialog open onClose={onClose} title={t('menu_habis.pilih_pengganti')}>
      <p className="mb-3 text-sm text-muted">{t('menu_habis.aturan_pengganti', { price: rupiah(item.unit_price) })}</p>
      {menu.isPending && <LoadingState />}
      {menu.isSuccess && candidates.length === 0 && <Notice>{t('menu_habis.tidak_ada_pengganti')}</Notice>}
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.menu.id}>
            <Button
              full
              busy={action.busy === c.menu.id}
              busyText={t('umum.memproses')}
              onClick={() =>
                void action
                  .run(c.menu.id, () =>
                    rpc('buyer_resolve_sold_out', { p_order_item: item.id, p_action: 'ganti', p_replacement: c.menu.id, p_option_ids: c.optionIds }),
                  )
                  .then((ok) => {
                    if (ok) {
                      onDone()
                      onClose()
                    }
                  })
              }
            >
              <span className="flex w-full justify-between gap-2">
                <span>{c.menu.name}</span>
                <span className="tabular">{rupiah(c.unit)}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {action.error && <Notice tone="error" className="mt-3">{action.error}</Notice>}
    </Dialog>
  )
}

function RescheduleDialog({ order, onClose }: { order: OrderFull; onClose: () => void }) {
  const { t } = useTranslation()
  const action = useAction()
  const [date, setDate] = useState(order.pickup_date)
  const [time, setTime] = useState<string | null>(null)
  return (
    <Dialog open onClose={onClose} title={t('geser.judul')}>
      <p className="mb-3 text-sm text-muted">{t('geser.isi')}</p>
      <SlotPicker
        tenantId={order.tenant_id}
        maxPrep={order.max_prep_minutes}
        date={date}
        onDateChange={(d) => {
          setDate(d)
          setTime(null)
        }}
        value={time}
        onChange={(v) => setTime(v)}
      />
      {action.error && <Notice tone="error" className="mt-3">{action.error}</Notice>}
      <Button
        className="mt-4"
        variant="primary"
        full
        disabled={!time}
        busy={action.busy === 'geser'}
        busyText={t('umum.memproses')}
        onClick={() =>
          void action.run('geser', () => rpc('buyer_reschedule_order', { p_order: order.id, p_date: date, p_time: time })).then((ok) => {
            if (ok) onClose()
          })
        }
      >
        {t('geser.simpan')}
      </Button>
    </Dialog>
  )
}

function ReportDialog({ order, onClose }: { order: OrderFull; onClose: () => void }) {
  const { t } = useTranslation()
  const action = useAction()
  const [category, setCategory] = useState<'pesanan_salah' | 'uang_belum_kembali' | 'lainnya'>('pesanan_salah')
  const [story, setStory] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [sent, setSent] = useState(false)

  async function send() {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) throw new Error('not_authenticated')
    let photoPath: string | null = null
    if (photo) {
      const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      photoPath = `${uid}/${order.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('report-photos').upload(photoPath, photo, { contentType: photo.type })
      if (error) throw new Error('upload_failed')
    }
    const { error } = await supabase.from('reports').insert({ order_id: order.id, buyer_id: uid, category, story: story.trim(), photo_path: photoPath })
    if (error) throw error
  }

  return (
    <Dialog open onClose={onClose} title={t('laporan.judul')}>
      {sent ? (
        <Notice tone="success">{t('laporan.terkirim')}</Notice>
      ) : (
        <div className="space-y-3">
          <Field label={t('laporan.kategori_label')}>
            {(p) => (
              <Select id={p.id} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                <option value="pesanan_salah">{t('laporan.kategori.pesanan_salah')}</option>
                <option value="uang_belum_kembali">{t('laporan.kategori.uang_belum_kembali')}</option>
                <option value="lainnya">{t('laporan.kategori.lainnya')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('laporan.cerita')} hint={t('laporan.cerita_isi')}>
            {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={story} onChange={(e) => setStory(e.target.value.slice(0, 1000))} rows={4} />}
          </Field>
          <Field label={t('laporan.foto')} optional>
            {(p) => <input id={p.id} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block min-h-12 w-full text-sm" />}
          </Field>
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <Button
            variant="primary"
            full
            disabled={story.trim().length < 5}
            busy={action.busy === 'lapor'}
            busyText={t('umum.memproses')}
            onClick={() => void action.run('lapor', send).then((ok) => ok && setSent(true))}
          >
            {t('laporan.kirim')}
          </Button>
        </div>
      )}
    </Dialog>
  )
}
