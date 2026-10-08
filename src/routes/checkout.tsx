import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/components/AppShell'
import { RequireAuth } from '@/components/Guard'
import { SlotPicker, useSlots, type Slot } from '@/components/SlotPicker'
import { Button, ButtonLink, Card, Choice, EmptyState, Field, Input, Notice, PageHeader, TextArea } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { cartMaxPrep, cartSubtotal, forgetSlot, recalledSlot, useCart } from '@/lib/cart'
import { rupiah, todayWib, tomorrowWib } from '@/lib/format'
import { rpc, supabase, toAppError } from '@/lib/supabase'
import { soldOutToday, useTenant } from '@/features/tenant'

export const Route = createFileRoute('/checkout')({
  component: () => (
    <RequireAuth>
      <Checkout />
    </RequireAuth>
  ),
})

type Created = { order_id: string; payment_code: string; pay_deadline: string; total_paid: number }

function Checkout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cart = useCart()
  const { profile, user } = useAuth()
  const settings = useSettings()
  const tenant = useTenant(cart?.tenantSlug ?? '')

  const soldOutTodayInCart = !!cart && !!tenant.data && cart.lines.some((l) => {
    const item = tenant.data?.menu_items.find((i) => i.id === l.menuItemId)
    return item ? soldOutToday(item) && !item.sold_out_indefinite : false
  })

  const [pickedDate, setDate] = useState(() => recalledSlot()?.date ?? todayWib())
  const [pickedTime, setTime] = useState<string | null>(null)
  const [pickedSlot, setSlot] = useState<Slot | null>(null)
  const [pickupNameInput, setPickupName] = useState<string | null>(null)
  // Nama pengambil mengikuti nama di profil sampai pembeli mengubahnya sendiri.
  const pickupName = pickupNameInput ?? profile?.full_name ?? ''
  const [dining, setDining] = useState<'makan_di_sini' | 'bungkus'>('bungkus')
  const [cutlery, setCutlery] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; orderId?: string } | null>(null)

  // Menu yang habis hari ini membuat pesanan hanya bisa untuk besok.
  const date = soldOutTodayInCart && pickedDate === todayWib() ? tomorrowWib() : pickedDate
  const maxPrep = cartMaxPrep(cart)
  const slots = useSlots(cart?.tenantId, date, maxPrep)

  // Jam dari tombol jam istirahat langsung terpilih kalau masih tersedia (usulan U7).
  const recalled = recalledSlot()
  const autoSlot =
    !pickedTime && recalled && recalled.date === date ? (slots.data?.find((s) => s.slot_time === recalled.time && s.status === 'tersedia') ?? null) : null
  const time = pickedTime ?? autoSlot?.slot_time ?? null
  const slot = pickedSlot ?? autoSlot

  if (!cart) {
    return (
      <EmptyState
        title={t('keranjang.kosong')}
        action={
          <ButtonLink to="/" variant="primary">
            {t('keranjang.pilih_tenant')}
          </ButtonLink>
        }
      />
    )
  }

  const subtotal = cartSubtotal(cart)
  const serviceFee = settings.data?.service_fee ?? 1000
  const promo =
    slot?.promo_value && slot.promo_kind
      ? slot.promo_kind === 'persen'
        ? Math.floor((subtotal * slot.promo_value) / 100)
        : Math.min(slot.promo_value, subtotal)
      : 0
  const total = subtotal - promo + serviceFee

  async function submit() {
    if (!cart || !time) {
      setError({ code: 'slot_required' })
      return
    }
    if (!pickupName.trim()) {
      setError({ code: 'pickup_name_required' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const rows = await rpc<Created[]>('create_order', {
        p_tenant: cart.tenantId,
        p_pickup_date: date,
        p_pickup_time: time,
        p_items: cart.lines.map((l) => ({ menu_item_id: l.menuItemId, quantity: l.quantity, option_ids: l.optionIds })),
        p_pickup_name: pickupName.trim(),
        p_dining: dining,
        p_cutlery: cutlery,
        p_note: note.trim() || null,
      })
      forgetSlot()
      void navigate({ to: '/bayar/$orderId', params: { orderId: rows[0].order_id } })
    } catch (e) {
      const code = toAppError(e).code
      if (code === 'unpaid_order_exists' && user) {
        const { data } = await supabase.from('orders').select('id').eq('buyer_id', user.id).eq('status', 'menunggu_bayar').maybeSingle()
        setError({ code, orderId: data?.id })
      } else {
        setError({ code })
      }
      if (['slot_full', 'slot_too_soon', 'slot_closed', 'daily_limit', 'tenant_paused'].includes(code)) {
        forgetSlot()
        setTime(null)
        setSlot(null)
        void queryClient.invalidateQueries({ queryKey: ['jam'] })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('checkout.judul')} description={cart.tenantName} back={{ to: '/keranjang', label: t('checkout.ke_keranjang') }} />
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 text-lg font-bold">{t('checkout.jam_ambil')}</h2>
            <p className="mb-3 text-sm text-muted">{t('checkout.jam_ambil_isi')}</p>
            {soldOutTodayInCart && (
              <Notice tone="warn" className="mb-3">
                {t('checkout.habis_hari_ini')}
              </Notice>
            )}
            <SlotPicker
              tenantId={cart.tenantId}
              maxPrep={maxPrep}
              date={date}
              disableToday={soldOutTodayInCart}
              onDateChange={(d) => {
                setDate(d)
                setTime(null)
                setSlot(null)
              }}
              value={time}
              onChange={(v, s) => {
                setTime(v)
                setSlot(s)
              }}
            />
          </Card>

          <Card className="space-y-4">
            <Field label={t('checkout.nama_pengambil')} hint={t('checkout.nama_pengambil_isi')}>
              {(p) => <Input id={p.id} aria-describedby={p.describedBy} value={pickupName} onChange={(e) => setPickupName(e.target.value)} maxLength={60} autoComplete="name" />}
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{t('checkout.cara_makan')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice name="dining" value="bungkus" checked={dining === 'bungkus'} onChange={() => setDining('bungkus')}>
                  {t('checkout.bungkus')}
                </Choice>
                <Choice name="dining" value="makan_di_sini" checked={dining === 'makan_di_sini'} onChange={() => setDining('makan_di_sini')}>
                  {t('checkout.makan_di_sini')}
                </Choice>
              </div>
            </fieldset>
            <Choice type="checkbox" name="cutlery" value="ya" checked={cutlery} onChange={setCutlery}>
              {t('checkout.alat_makan')}
            </Choice>
            <Field label={t('checkout.catatan')} optional hint={t('checkout.sisa_karakter', { count: 200 - note.length })}>
              {(p) => (
                <TextArea id={p.id} aria-describedby={p.describedBy} value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} maxLength={200} rows={3} />
              )}
            </Field>
          </Card>
        </div>

        <aside className="md:sticky md:top-28 md:self-start">
          <Card className="space-y-3">
            <h2 className="text-lg font-bold">{t('checkout.ringkasan')}</h2>
            <ul className="space-y-1 text-sm">
              {cart.lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-2">
                  <span>
                    {l.quantity}x {l.name}
                    {l.optionLabels.length > 0 && <span className="block text-muted">{l.optionLabels.join(', ')}</span>}
                  </span>
                  <span className="tabular shrink-0">{rupiah(l.unitPrice * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line-soft pt-3 text-sm">
              <div className="flex justify-between">
                <dt>{t('uang.subtotal')}</dt>
                <dd className="tabular">{rupiah(subtotal)}</dd>
              </div>
              {promo > 0 && (
                <div className="flex justify-between">
                  <dt>{t('uang.potongan_promo')}</dt>
                  <dd className="tabular">-{rupiah(promo)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>{t('uang.biaya_layanan')}</dt>
                <dd className="tabular">{rupiah(serviceFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-line-soft pt-2 text-base font-bold">
                <dt>{t('uang.total')}</dt>
                <dd className="tabular">{rupiah(total)}</dd>
              </div>
            </dl>
            {error && (
              <Notice tone="error">
                {t(`galat.${error.code}`, { defaultValue: t('galat.unknown') })}
                {error.orderId && (
                  <Link to="/bayar/$orderId" params={{ orderId: error.orderId }} className="mt-1 block font-semibold underline">
                    {t('checkout.buka_pesanan_belum_bayar')}
                  </Link>
                )}
              </Notice>
            )}
            <Button variant="primary" full busy={busy} busyText={t('umum.memproses')} onClick={submit} disabled={!time}>
              {time ? t('checkout.bayar', { amount: rupiah(total) }) : t('checkout.pilih_jam_dulu')}
            </Button>
            <p className="text-xs text-muted">{t('checkout.batas_bayar')}</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
