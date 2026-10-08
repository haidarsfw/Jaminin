import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/components/AppShell'
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, Notice, PageHeader, StatusText, Tabs } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { dateLabel, rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { rpc, toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/tim/')({
  component: Dashboard,
})

type Row = { day: string; is_sample: boolean; orders: number; cancelled: number; not_picked_up: number; jaminin_revenue: number; gross: number; active_tenants: number }

function Dashboard() {
  const { t } = useTranslation()
  const lang = currentLang()
  const { teamRole } = useAuth()
  const [days, setDays] = useState<'7' | '30'>('7')
  const dashboard = useQuery({
    queryKey: ['dasbor', days],
    queryFn: () => rpc<Row[]>('team_dashboard', { p_days: Number(days) }),
    refetchInterval: 30_000,
  })

  const real = (dashboard.data ?? []).filter((r) => !r.is_sample)
  const sample = (dashboard.data ?? []).filter((r) => r.is_sample)
  const sum = (rows: Row[], key: keyof Row) => rows.reduce((acc, r) => acc + Number(r[key]), 0)

  return (
    <div className="space-y-4">
      <PageHeader title={t('tim.judul')} description={t('tim.sub')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label={t('tim.rentang')}
          value={days}
          onChange={setDays}
          items={[
            { value: '7', label: t('tim.tujuh_hari') },
            { value: '30', label: t('tim.tiga_puluh_hari') },
          ]}
        />
        <Link to="/simulator-bayar" className="min-h-11 py-2.5 font-semibold text-accent underline underline-offset-4 md:hidden">
          {t('nav.simulator')}
        </Link>
      </div>

      {dashboard.isPending && <LoadingState />}
      {dashboard.isError && <ErrorState onRetry={() => void dashboard.refetch()} />}
      {dashboard.data && (
        <>
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              { label: t('tim.pesanan_lunas'), value: String(sum(real, 'orders')) },
              { label: t('tim.pendapatan'), value: rupiah(sum(real, 'jaminin_revenue')) },
              { label: t('tim.penjualan_tenant'), value: rupiah(sum(real, 'gross')) },
              { label: t('tim.batal_tidak_diambil'), value: `${sum(real, 'cancelled')} / ${sum(real, 'not_picked_up')}` },
            ].map((m) => (
              <Card key={m.label} as="div">
                <dt className="text-sm text-muted">{m.label}</dt>
                <dd className="tabular mt-1 text-xl font-bold">{m.value}</dd>
              </Card>
            ))}
          </dl>
          <p className="text-sm text-muted">{t('tim.angka_asli')}</p>

          {dashboard.data.length === 0 ? (
            <EmptyState title={t('tim.kosong')} />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">{t('tim.per_hari')}</caption>
                <thead className="border-b border-line-soft">
                  <tr>
                    <th scope="col" className="p-3">{t('tim.tanggal_ambil')}</th>
                    <th scope="col" className="p-3 text-right">{t('tim.pesanan')}</th>
                    <th scope="col" className="p-3 text-right">{t('tim.batal')}</th>
                    <th scope="col" className="p-3 text-right">{t('tim.tidak_diambil')}</th>
                    <th scope="col" className="p-3 text-right">{t('tim.penjualan_tenant')}</th>
                    <th scope="col" className="p-3 text-right">{t('tim.pendapatan')}</th>
                    <th scope="col" className="p-3 text-right">{t('tim.tenant_aktif')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.data.map((r) => (
                    <tr key={`${r.day}-${r.is_sample}`} className="border-b border-line-soft last:border-0">
                      <th scope="row" className="p-3 font-semibold">
                        {dateLabel(r.day, lang, t)} {r.is_sample && <StatusText>{t('umum.contoh')}</StatusText>}
                      </th>
                      <td className="tabular p-3 text-right">{r.orders}</td>
                      <td className="tabular p-3 text-right">{r.cancelled}</td>
                      <td className="tabular p-3 text-right">{r.not_picked_up}</td>
                      <td className="tabular p-3 text-right">{rupiah(r.gross)}</td>
                      <td className="tabular p-3 text-right">{rupiah(r.jaminin_revenue)}</td>
                      <td className="tabular p-3 text-right">{r.active_tenants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {sample.length > 0 && <p className="text-sm text-muted">{t('tim.ada_contoh')}</p>}
        </>
      )}

      {teamRole === 'admin' && <FeesCard />}
      {teamRole === 'admin' && <SampleDataCard />}
    </div>
  )
}

function FeesCard() {
  const { t } = useTranslation()
  const settings = useSettings()
  const queryClient = useQueryClient()
  const [service, setService] = useState<string | null>(null)
  const [seller, setSeller] = useState<string | null>(null)
  const [state, setState] = useState<{ busy: boolean; ok: boolean; error: string | null }>({ busy: false, ok: false, error: null })
  const serviceValue = service ?? String(settings.data?.service_fee ?? '')
  const sellerValue = seller ?? String(settings.data?.seller_fee ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!(Number(serviceValue) >= 0) || !(Number(sellerValue) >= 0) || serviceValue === '' || sellerValue === '') {
      setState({ busy: false, ok: false, error: t('daftar.galat_angka') })
      return
    }
    setState({ busy: true, ok: false, error: null })
    try {
      await rpc('admin_update_fees', { p_service_fee: Math.round(Number(serviceValue)), p_seller_fee: Math.round(Number(sellerValue)) })
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
      setState({ busy: false, ok: true, error: null })
    } catch (err) {
      setState({ busy: false, ok: false, error: t(`galat.${toAppError(err).code}`, { defaultValue: t('galat.unknown') }) })
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">{t('biaya.judul')}</h2>
      <p className="text-sm text-muted">{t('biaya.isi')}</p>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('biaya.layanan')}>
            {(p) => <Input id={p.id} type="number" min={0} inputMode="numeric" value={serviceValue} onChange={(e) => setService(e.target.value)} />}
          </Field>
          <Field label={t('biaya.penjual')}>
            {(p) => <Input id={p.id} type="number" min={0} inputMode="numeric" value={sellerValue} onChange={(e) => setSeller(e.target.value)} />}
          </Field>
        </div>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.ok && <Notice tone="success">{t('umum.tersimpan')}</Notice>}
        <Button type="submit" variant="primary" busy={state.busy} busyText={t('umum.menyimpan')}>
          {t('umum.simpan')}
        </Button>
      </form>
    </Card>
  )
}

function SampleDataCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [state, setState] = useState<{ busy: boolean; ok: boolean; error: string | null }>({ busy: false, ok: false, error: null })

  async function remove() {
    if (!window.confirm(t('contoh.tanya'))) return
    setState({ busy: true, ok: false, error: null })
    try {
      await rpc('admin_delete_sample_data')
      await queryClient.invalidateQueries()
      setState({ busy: false, ok: true, error: null })
    } catch (err) {
      setState({ busy: false, ok: false, error: t(`galat.${toAppError(err).code}`, { defaultValue: t('galat.unknown') }) })
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">{t('contoh.judul')}</h2>
      <p className="text-sm text-muted">{t('contoh.isi')}</p>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{t('contoh.terhapus')}</Notice>}
      <Button variant="danger" busy={state.busy} busyText={t('umum.memproses')} onClick={() => void remove()}>
        {t('contoh.hapus')}
      </Button>
    </Card>
  )
}
