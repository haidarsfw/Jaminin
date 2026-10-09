import { CheckCircleIcon, CookingPotIcon, SpeakerHighIcon, SunIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState, ErrorState, LoadingState, Notice, StatusText, useNow } from '@/components/ui'
import { itemLabel, prepSummary, useWakeLock, type PrepSlot } from '@/features/kitchen'
import { OrderAlarm, useAudioUnlock, useBoardAction, useBoardOrders, useSeller, type BoardOrder } from '@/features/seller'
import { clock, orderNo, todayWib } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { rpc } from '@/lib/supabase'

export const Route = createFileRoute('/penjual/dapur')({
  component: Kitchen,
})

type Step = 'disiapkan' | 'siap'
type Action = ReturnType<typeof useBoardAction>

// Layar dapur untuk tablet atau laptop: pesanan hari ini yang belum siap, satu kartu besar per jam ambil.
function Kitchen() {
  const { t } = useTranslation()
  const { active } = useSeller()
  const queryClient = useQueryClient()
  // Halaman ini bisa terbuka seharian, jadi dirender ulang tiap menit supaya tanggal ikut berganti setelah tengah malam.
  useNow(60_000)
  const orders = useBoardOrders(active?.id, todayWib())
  const action = useBoardAction()
  const [readyNotice, setReadyNotice] = useState<string | null>(null)
  const slots = useMemo(() => prepSummary(orders.data ?? []), [orders.data])

  useTopic(active ? `tenant:${active.id}` : null, ['order', 'tenant'], () => {
    void queryClient.invalidateQueries({ queryKey: ['papan'] })
  })

  if (!active) return null

  async function update(order: BoardOrder, step: Step) {
    setReadyNotice(null)
    const ok = await action.run(`${step}-${order.id}`, () => rpc('seller_update_status', { p_order: order.id, p_status: step }))
    if (ok && step === 'siap') setReadyNotice(t('dapur.siap_info', { number: orderNo(order.order_number) }))
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t('dapur.judul', { name: active.name })}</h1>
        <p className="text-muted">{t('dapur.sub')}</p>
      </header>

      <KitchenPrompt />
      <OrderAlarm tenantId={active.id} soundPrompt={false} />

      {action.error && <Notice tone="error">{action.error}</Notice>}
      {readyNotice && <Notice tone="success">{readyNotice}</Notice>}
      {orders.isPending && <LoadingState />}
      {orders.isError && <ErrorState onRetry={() => void orders.refetch()} />}
      {orders.isSuccess && slots.length === 0 && <EmptyState title={t('dapur.kosong')} body={t('dapur.kosong_isi')} />}

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => (
          <SlotCard key={slot.time} slot={slot} action={action} onUpdate={update} />
        ))}
      </div>
    </div>
  )
}

// Bunyi pesanan baru dan penjaga layar sama-sama butuh satu ketukan di Safari, jadi keduanya diminta lewat satu tombol.
function KitchenPrompt() {
  const { t } = useTranslation()
  const wake = useWakeLock()
  const sound = useAudioUnlock()
  const needWake = wake.state === 'inactive'
  const needSound = !sound.ready
  const both = needWake && needSound
  return (
    <>
      {wake.state === 'active' && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <SunIcon size={18} />
          {t('dapur.layar_menyala')}
        </p>
      )}
      {wake.state === 'unsupported' && <Notice>{t('dapur.layar_tidak_didukung')}</Notice>}
      {(needWake || needSound) && (
        <Notice tone="warn" title={both ? t('dapur.siapkan_judul') : needSound ? t('papan.bunyi_judul') : t('dapur.layar_bisa_mati')}>
          <p>{both ? t('dapur.siapkan_isi') : needSound ? t('papan.bunyi_isi') : t('dapur.layar_bisa_mati_isi')}</p>
          <Button
            icon={needSound ? <SpeakerHighIcon /> : <SunIcon />}
            className="mt-2"
            small
            variant="primary"
            onClick={() => {
              if (needSound) sound.unlock()
              wake.request()
            }}
          >
            {both ? t('dapur.siapkan_tombol') : needSound ? t('papan.nyalakan_bunyi') : t('dapur.jaga_layar')}
          </Button>
        </Notice>
      )}
    </>
  )
}

function SlotCard({ slot, action, onUpdate }: { slot: PrepSlot<BoardOrder>; action: Action; onUpdate: (order: BoardOrder, step: Step) => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const time = clock(slot.time, lang)
  const headingId = `dapur-${slot.time}`
  return (
    <section aria-labelledby={headingId} className="@container space-y-4 rounded-xl border border-line-soft bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="tabular text-3xl font-bold">
          {time}
        </h2>
        <p className="text-muted">
          {t('dapur.pesanan', { count: slot.orders.length })}, {t('dapur.porsi', { count: slot.portions })}
        </p>
      </div>
      {slot.lines.length > 0 ? (
        <ul aria-label={t('dapur.porsi_untuk', { time })} className="space-y-1 text-xl sm:text-2xl">
          {slot.lines.map((line) => (
            <li key={line.label} className="flex gap-3">
              <span className="tabular w-12 shrink-0 text-right font-bold">{line.quantity}x</span>{' '}
              <span className="min-w-0 wrap-break-word">{line.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-lg text-muted">{t('papan.menunggu_pembeli')}</p>
      )}
      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {slot.orders.map((order) => (
          <KitchenOrder key={order.id} order={order} action={action} onUpdate={onUpdate} />
        ))}
      </ul>
    </section>
  )
}

function KitchenOrder({ order, action, onUpdate }: { order: BoardOrder; action: Action; onUpdate: (order: BoardOrder, step: Step) => void }) {
  const { t } = useTranslation()
  const titleId = `dapur-pesanan-${order.id}`
  const items = order.order_items.filter((i) => i.status === 'normal' || i.status === 'habis_menunggu')
  return (
    <li className="space-y-2 pt-3 [&:not(:last-child)]:pb-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p id={titleId} className="text-lg font-bold wrap-anywhere">
          {orderNo(order.order_number)} <span className="font-semibold">{order.pickup_name}</span>
        </p>
        <StatusText tone={order.needs_buyer_action ? 'warn' : 'info'}>{order.needs_buyer_action ? t('papan.menunggu_pembeli') : t(`status.${order.status}`)}</StatusText>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="wrap-anywhere">
            <span className="font-semibold">{item.quantity}x</span> {itemLabel(item)}
            {item.status === 'habis_menunggu' && <span className="block text-sm font-semibold text-warn-ink">{t('item_status.habis_menunggu')}</span>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        {t(`checkout.${order.dining}`)}
        {order.cutlery ? `, ${t('pesanan.minta_alat_makan')}` : ''}
      </p>
      {order.note && (
        <p className="rounded-lg bg-warn-bg p-2 text-warn-ink">
          {t('pesanan.catatan')}: {order.note}
        </p>
      )}
      {/* Tombol besar berdampingan hanya kalau kartunya cukup lebar, supaya labelnya tidak terlipat. */}
      <div className="grid gap-2 @md:grid-cols-2">
        {order.status === 'diterima' && (
          <Button
            large
            full
            icon={<CookingPotIcon />}
            aria-describedby={titleId}
            busy={action.busy === `disiapkan-${order.id}`}
            busyText={t('umum.memproses')}
            onClick={() => onUpdate(order, 'disiapkan')}
          >
            {t('papan.mulai')}
          </Button>
        )}
        <Button
          large
          full
          variant="primary"
          icon={<CheckCircleIcon />}
          className={order.status === 'diterima' ? '' : '@md:col-span-2'}
          aria-describedby={titleId}
          disabled={order.needs_buyer_action}
          busy={action.busy === `siap-${order.id}`}
          busyText={t('umum.memproses')}
          onClick={() => onUpdate(order, 'siap')}
        >
          {t('papan.siap')}
        </Button>
      </div>
    </li>
  )
}
