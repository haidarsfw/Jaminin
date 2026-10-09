import { ClockIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button, ButtonLink, Card, EmptyState, PageHeader, Stepper } from '@/components/ui'
import { cartSubtotal, clearCart, setQuantity, useCart } from '@/lib/cart'
import { rupiah } from '@/lib/format'

export const Route = createFileRoute('/keranjang')({
  component: CartPage,
})

function CartPage() {
  const { t } = useTranslation()
  const cart = useCart()

  if (!cart) {
    return (
      <>
        <PageHeader title={t('keranjang.judul')} />
        <EmptyState
          title={t('keranjang.kosong')}
          body={t('keranjang.kosong_isi')}
          action={
            <ButtonLink to="/" variant="primary">
              {t('keranjang.pilih_tenant')}
            </ButtonLink>
          }
        />
      </>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t('keranjang.judul')}
        description={t('keranjang.dari', { name: cart.tenantName })}
        back={{ to: '/tenant/$slug', params: { slug: cart.tenantSlug }, label: t('keranjang.tambah_menu') }}
      />
      <ul className="space-y-2">
        {cart.lines.map((line) => (
          <li key={line.key}>
            <Card as="div" className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{line.name}</p>
                {line.optionLabels.length > 0 && <p className="text-sm text-muted">{line.optionLabels.join(', ')}</p>}
                <p className="tabular text-sm">{rupiah(line.unitPrice)}</p>
              </div>
              <Stepper value={line.quantity} onChange={(q) => setQuantity(line.key, q)} label={t('keranjang.jumlah_untuk', { name: line.name })} />
            </Card>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between text-lg">
        <span className="font-semibold">{t('keranjang.subtotal')}</span>
        <span className="tabular font-bold">{rupiah(cartSubtotal(cart))}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{t('keranjang.catatan_biaya')}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ButtonLink icon={<ClockIcon />} to="/checkout" variant="primary" full>
          {t('keranjang.pilih_jam')}
        </ButtonLink>
        <Button
          variant="quiet"
          full
          onClick={() => {
            if (window.confirm(t('keranjang.kosongkan_konfirmasi'))) clearCart()
          }}
        >
          {t('keranjang.kosongkan')}
        </Button>
      </div>
    </div>
  )
}
