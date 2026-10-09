import { ChatCircleIcon, CheckCircleIcon, CookingPotIcon, HandArrowUpIcon, ScanIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { QrScanner } from '@/components/QrScanner'
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, LoadingState, Notice, StatusText, Tabs } from '@/components/ui'
import { ChatThread, chatIsOpen } from '@/features/chat'
import { prepSummary, type PrepSlot } from '@/features/kitchen'
import { parsePickupQr } from '@/features/orders'
import { OrderAlarm, useBoardAction, useBoardOrders, useSeller, useTenantSettings, type BoardOrder } from '@/features/seller'
import { clock, clockFromDate, orderNo, todayWib, tomorrowWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { rpc, supabase, toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/penjual/')({
  component: Board,
})

function Board() {
  const { t } = useTranslation()
  const lang = currentLang()
  const { active } = useSeller()
  const settings = useTenantSettings(active?.id)
  const queryClient = useQueryClient()
  const [day, setDay] = useState(todayWib())
  const [handover, setHandover] = useState<BoardOrder | null>(null)
  const [codeSearch, setCodeSearch] = useState('')
  const action = useBoardAction()
  const orders = useBoardOrders(active?.id, day)

  const history = useQuery({
    queryKey: ['papan-riwayat', active?.id, orders.data?.map((o) => o.buyer_id).join(',')],
    enabled: !!active && !!orders.data?.length,
    queryFn: async () => {
      const buyers = [...new Set(orders.data!.map((o) => o.buyer_id))]
      const { data, error } = await supabase.from('orders').select('buyer_id, status, end_reason').eq('tenant_id', active!.id).in('buyer_id', buyers)
      if (error) throw error
      const counts = new Map<string, { cancelled: number; notPicked: number }>()
      for (const row of data) {
        const c = counts.get(row.buyer_id) ?? { cancelled: 0, notPicked: 0 }
        if (row.status === 'dibatalkan' && ['pembeli', 'belum_siap_jam_ambil', 'pembeli_menu_habis'].includes(row.end_reason ?? '')) c.cancelled += 1
        if (row.status === 'tidak_diambil') c.notPicked += 1
        counts.set(row.buyer_id, c)
      }
      return counts
    },
  })

  useTopic(active ? `tenant:${active.id}` : null, ['order', 'tenant', 'payout', 'message'], () => {
    void queryClient.invalidateQueries({ queryKey: ['papan'] })
    void queryClient.invalidateQueries({ queryKey: ['tenant-saya'] })
  })

  const groups = useMemo(() => {
    const map = new Map<string, BoardOrder[]>()
    for (const o of orders.data ?? []) {
      if (['selesai', 'dibatalkan', 'tidak_diambil'].includes(o.status)) continue
      map.set(o.pickup_time, [...(map.get(o.pickup_time) ?? []), o])
    }
    return [...map.entries()]
  }, [orders.data])
  const finished = (orders.data ?? []).filter((o) => ['selesai', 'dibatalkan', 'tidak_diambil'].includes(o.status))
  const prep = useMemo(() => prepSummary(orders.data ?? []), [orders.data])

  if (!active) return null
  const tenant = settings.data
  const paused = tenant && (tenant.paused_indefinitely || (!!tenant.paused_until && new Date(tenant.paused_until) > new Date()))

  async function findByCode(e: FormEvent) {
    e.preventDefault()
    const id = await rpc<string | null>('seller_find_by_code', { p_tenant: active!.id, p_code: codeSearch }).catch(() => null)
    const found = orders.data?.find((o) => o.id === id) ?? null
    if (found) setHandover(found)
    else action.setError(t('papan.kode_tidak_ada'))
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{active.name}</h1>
        <p className="text-muted">{t('papan.sub')}</p>
      </header>

      {active.status !== 'disetujui' && (
        <Notice tone={active.status === 'ditolak' ? 'error' : 'warn'} title={t(`penjual.status.${active.status}`)}>
          {active.status === 'ditolak' && active.reject_reason && <p>{t('penjual.alasan', { reason: active.reject_reason })}</p>}
          {active.status === 'ditolak' && (
            <Link to="/penjual/toko" className="mt-1 block font-semibold underline">
              {t('penjual.perbaiki')}
            </Link>
          )}
          {active.status === 'menunggu' && <p>{t('penjual.menunggu_isi')}</p>}
        </Notice>
      )}

      <OrderAlarm tenantId={active.id} />

      <PauseControl tenantId={active.id} paused={!!paused} pausedUntil={tenant?.paused_until ?? null} indefinite={!!tenant?.paused_indefinitely} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          label={t('papan.hari')}
          value={day}
          onChange={setDay}
          items={[
            { value: todayWib(), label: t('waktu.hari_ini') },
            { value: tomorrowWib(), label: t('waktu.besok') },
          ]}
        />
        <form onSubmit={findByCode} className="flex items-end gap-2">
          <Field label={t('papan.cari_kode')}>
            {(p) => (
              <Input
                id={p.id}
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                className="w-28 font-mono tracking-widest"
                autoComplete="off"
              />
            )}
          </Field>
          <Button type="submit" disabled={codeSearch.length !== 4}>
            {t('papan.cari')}
          </Button>
        </form>
      </div>

      {action.error && <Notice tone="error">{action.error}</Notice>}
      {orders.isPending && <LoadingState />}
      {orders.isError && <ErrorState onRetry={() => void orders.refetch()} />}
      {orders.isSuccess && groups.length === 0 && (
        <EmptyState title={day === todayWib() ? t('papan.kosong') : t('papan.kosong_besok')} body={t('papan.kosong_isi')} />
      )}

      {prep.length > 0 && <PrepList slots={prep} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(([time, list]) => (
          <section key={time} aria-labelledby={`jam-${time}`} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`jam-${time}`} className="tabular text-xl font-bold">
                {clock(time, lang)} <span className="text-base font-normal text-muted">({list.length})</span>
              </h2>
              {day === todayWib() && (
                <div className="flex flex-wrap gap-2">
                  {list.some((o) => o.status === 'diterima') && (
                    <Button icon={<CookingPotIcon />} small busy={action.busy === `slot-disiapkan-${time}`} busyText={t('umum.memproses')} onClick={() => void action.run(`slot-disiapkan-${time}`, () => rpc('seller_update_slot', { p_tenant: active.id, p_date: day, p_time: time, p_status: 'disiapkan' }))}>
                      {t('papan.mulai_semua')}
                    </Button>
                  )}
                  {list.some((o) => o.status === 'diterima' || o.status === 'disiapkan') && (
                    <Button icon={<CheckCircleIcon />} small busy={action.busy === `slot-siap-${time}`} busyText={t('umum.memproses')} onClick={() => void action.run(`slot-siap-${time}`, () => rpc('seller_update_slot', { p_tenant: active.id, p_date: day, p_time: time, p_status: 'siap' }))}>
                      {t('papan.siap_semua')}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <ul className="space-y-2">
              {list.map((o) => (
                <li key={o.id}>
                  <OrderCard order={o} today={day === todayWib()} action={action} onHandover={() => setHandover(o)} history={history.data?.get(o.buyer_id)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {finished.length > 0 && (
        <details className="rounded-xl border border-line-soft bg-surface p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t('papan.selesai_hari_ini', { count: finished.length })}</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {finished.map((o) => (
              <li key={o.id} className="space-y-0.5">
                <span className="flex justify-between gap-2">
                  <span>
                    {orderNo(o.order_number)} {o.pickup_name} · {clock(o.pickup_time, lang)}
                  </span>
                  <span className="text-muted">{t(`status.${o.status}`)}</span>
                </span>
                {o.ratings && (
                  <span className="block text-muted">
                    {t('nilai.milikmu_penjual', { value: o.ratings.thumbs_up ? t('nilai.label_puas') : t('nilai.label_kurang') })}
                    {o.ratings.comment ? `: ${o.ratings.comment}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {handover && <HandoverDialog order={handover} onClose={() => setHandover(null)} orders={orders.data ?? []} />}
    </div>
  )
}

// Porsi yang perlu dimasak per jam ambil, untuk hari yang dipilih di tab.
function PrepList({ slots }: { slots: PrepSlot<BoardOrder>[] }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const portions = slots.reduce((sum, slot) => sum + slot.portions, 0)
  return (
    <details className="rounded-xl border border-line-soft bg-surface p-4">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t('siap_masak.judul', { count: portions })}</summary>
      <p className="text-sm text-muted">{t('siap_masak.isi')}</p>
      <ul className="mt-3 space-y-2">
        {slots.map((slot) => (
          <li key={slot.time} className="wrap-break-word">
            <span className="tabular font-semibold">{t('siap_masak.untuk', { time: clock(slot.time, lang) })}</span>{' '}
            {slot.lines.length > 0 ? slot.lines.map((line) => `${line.quantity}x ${line.label}`).join(', ') : <span className="text-muted">{t('papan.menunggu_pembeli')}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}

function OrderCard({
  order,
  today,
  action,
  onHandover,
  history,
}: {
  order: BoardOrder
  today: boolean
  action: ReturnType<typeof useBoardAction>
  onHandover: () => void
  history?: { cancelled: number; notPicked: number }
}) {
  const { t } = useTranslation()
  const lang = currentLang()
  const [chatOpen, setChatOpen] = useState(false)
  const messageCount = order.order_messages[0]?.count ?? 0
  const items = order.order_items.filter((i) => i.status !== 'dihapus' && i.status !== 'diganti')
  return (
    <Card as="div" className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xl font-bold wrap-anywhere">
            {orderNo(order.order_number)} <span className="font-semibold">{order.pickup_name}</span>
          </p>
          <p className="text-sm text-muted">
            {t(`checkout.${order.dining}`)}
            {order.cutlery ? `, ${t('pesanan.minta_alat_makan')}` : ''}
            {order.rescheduled_count > 0 ? ` · ${t('papan.digeser')}` : ''}
            {order.paid_at ? ` · ${t('papan.masuk_jam', { time: clockFromDate(order.paid_at, lang) })}` : ''}
          </p>
        </div>
        <StatusText tone={order.status === 'siap' ? 'success' : order.needs_buyer_action ? 'warn' : 'info'}>
          {order.needs_buyer_action ? t('papan.menunggu_pembeli') : t(`status.${order.status}`)}
        </StatusText>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-2">
            <span>
              <span className="font-semibold">{item.quantity}x</span> {item.name}
              {Array.isArray(item.options) && item.options.length > 0 && (
                <span className="block text-sm text-muted">{(item.options as { name: string }[]).map((x) => x.name).join(', ')}</span>
              )}
              {item.status === 'habis_menunggu' && <span className="block text-sm font-semibold text-warn-ink">{t('item_status.habis_menunggu')}</span>}
            </span>
            {item.status === 'normal' && ['diterima', 'disiapkan'].includes(order.status) && (
              <Button
                small
                variant="quiet"
                busy={action.busy === `habis-${item.id}`}
                busyText={t('umum.memproses')}
                onClick={() => {
                  if (window.confirm(t('papan.habis_konfirmasi', { item: item.name }))) void action.run(`habis-${item.id}`, () => rpc('seller_flag_item_sold_out', { p_order_item: item.id }))
                }}
              >
                {t('papan.tandai_habis')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="rounded-lg bg-warn-bg p-2 text-sm text-warn-ink">
          {t('pesanan.catatan')}: {order.note}
        </p>
      )}
      {history && (history.cancelled > 0 || history.notPicked > 0) && (
        <p className="text-sm text-muted">{t('papan.riwayat_pembeli', { cancelled: history.cancelled, notPicked: history.notPicked })}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {today && order.status === 'diterima' && (
          <Button icon={<CookingPotIcon />} small busy={action.busy === `mulai-${order.id}`} busyText={t('umum.memproses')} onClick={() => void action.run(`mulai-${order.id}`, () => rpc('seller_update_status', { p_order: order.id, p_status: 'disiapkan' }))}>
            {t('papan.mulai')}
          </Button>
        )}
        {today && ['diterima', 'disiapkan'].includes(order.status) && (
          <Button icon={<CheckCircleIcon />}
            small
            variant="primary"
            disabled={order.needs_buyer_action}
            busy={action.busy === `siap-${order.id}`}
            busyText={t('umum.memproses')}
            onClick={() => void action.run(`siap-${order.id}`, () => rpc('seller_update_status', { p_order: order.id, p_status: 'siap' }))}
          >
            {t('papan.siap')}
          </Button>
        )}
        {today && ['diterima', 'disiapkan', 'siap'].includes(order.status) && (
          <Button icon={<HandArrowUpIcon />} small variant={order.status === 'siap' ? 'primary' : 'secondary'} disabled={order.needs_buyer_action} onClick={onHandover}>
            {t('papan.serahkan')}
          </Button>
        )}
        <Button icon={<ChatCircleIcon />} small variant="quiet" onClick={() => setChatOpen(true)}>
          {messageCount > 0 ? t('chat.buka_jumlah', { count: messageCount }) : t('chat.buka')}
        </Button>
      </div>
      <Dialog open={chatOpen} onClose={() => setChatOpen(false)} title={t('chat.judul_penjual', { name: order.pickup_name })}>
        <ChatThread orderId={order.id} side="penjual" open={chatIsOpen(order)} />
      </Dialog>
    </Card>
  )
}

function HandoverDialog({ order, onClose, orders }: { order: BoardOrder; onClose: () => void; orders: BoardOrder[] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState(order)
  const [code, setCode] = useState('')
  const [scan, setScan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function hand(orderId: string, value: string) {
    setBusy(true)
    setError(null)
    try {
      await rpc('seller_handover', { p_order: orderId, p_code: value })
      setDone(true)
      await queryClient.invalidateQueries({ queryKey: ['papan'] })
    } catch (e) {
      setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={t('serahkan.judul', { number: orderNo(target.order_number) })}>
      {done ? (
        <div className="space-y-3">
          <Notice tone="success">{t('serahkan.berhasil', { name: target.pickup_name })}</Notice>
          <Button full variant="primary" onClick={onClose}>
            {t('umum.selesai')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p>{t('serahkan.isi', { name: target.pickup_name })}</p>
          {scan ? (
            <QrScanner
              onResult={(text) => {
                setScan(false)
                const parsed = parsePickupQr(text)
                if (!parsed) {
                  setError(t('serahkan.qr_bukan'))
                  return
                }
                const other = orders.find((o) => o.id === parsed.orderId)
                if (other) setTarget(other)
                void hand(parsed.orderId, parsed.code)
              }}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void hand(target.id, code)
              }}
              className="space-y-3"
            >
              <Field label={t('serahkan.kode')}>
                {(p) => (
                  <Input
                    id={p.id}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                    className="font-mono text-2xl tracking-[0.3em]"
                    autoComplete="off"
                    autoFocus
                  />
                )}
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button icon={<HandArrowUpIcon />} type="submit" variant="primary" full disabled={code.length !== 4} busy={busy} busyText={t('umum.memproses')}>
                  {t('papan.serahkan')}
                </Button>
                <Button icon={<ScanIcon />} full onClick={() => setScan(true)}>
                  {t('serahkan.pindai')}
                </Button>
              </div>
            </form>
          )}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </Dialog>
  )
}

function PauseControl({ tenantId, paused, pausedUntil, indefinite }: { tenantId: string; paused: boolean; pausedUntil: string | null; indefinite: boolean }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function set(minutes: number | null) {
    setBusy(true)
    try {
      await rpc('seller_pause', { p_tenant: tenantId, p_minutes: minutes })
      await queryClient.invalidateQueries({ queryKey: ['tenant-saya'] })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (paused) {
    return (
      <Notice tone="warn" title={indefinite ? t('jeda.sampai_dibuka') : t('jeda.sampai', { time: pausedUntil ? clockFromDate(pausedUntil, lang) : '' })}>
        <p>{t('jeda.isi')}</p>
        <Button className="mt-2" small variant="primary" busy={busy} busyText={t('umum.memproses')} onClick={() => void set(null)}>
          {t('jeda.buka_lagi')}
        </Button>
      </Notice>
    )
  }
  return (
    <div>
      <Button small onClick={() => setOpen(true)}>
        {t('jeda.tutup_sementara')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('jeda.judul')}>
        <p className="mb-3 text-sm text-muted">{t('jeda.penjelasan')}</p>
        <div className="grid gap-2">
          {[15, 30, 60].map((m) => (
            <Button key={m} full busy={busy} onClick={() => void set(m)}>
              {t('jeda.menit', { count: m })}
            </Button>
          ))}
          <Button full busy={busy} onClick={() => void set(0)}>
            {t('jeda.sampai_dibuka')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
