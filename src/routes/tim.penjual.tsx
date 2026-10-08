import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Dialog, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, StatusText, Tabs, TextArea } from '@/components/ui'
import { WEEKDAYS } from '@/features/tenantForm'
import { clock, clockFromDate, dateLabel } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { publicImage, rpc, supabase, toAppError, type Enums, type Tables } from '@/lib/supabase'

export const Route = createFileRoute('/tim/penjual')({
  component: TenantsReview,
})

type TenantRow = Tables<'tenants'> & {
  tenant_hours: Tables<'tenant_hours'>[]
  tenant_quota_rules: Tables<'tenant_quota_rules'>[]
  tenant_bank: Tables<'tenant_bank'> | null
  menu_items: { id: string }[]
}

function TenantsReview() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Enums<'status_tenant'>>('menunggu')
  const queryClient = useQueryClient()
  const tenants = useQuery({
    queryKey: ['tim-tenant'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*, tenant_hours(*), tenant_quota_rules(*), tenant_bank(*), menu_items(id)')
        .order('submitted_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data as unknown as TenantRow[]
    },
  })
  useTopic('team', ['tenant'], () => void queryClient.invalidateQueries({ queryKey: ['tim-tenant'] }))

  const list = (tenants.data ?? []).filter((x) => x.status === tab)
  const count = (s: Enums<'status_tenant'>) => (tenants.data ?? []).filter((x) => x.status === s).length

  return (
    <div className="space-y-4">
      <PageHeader title={t('timpenjual.judul')} description={t('timpenjual.sub')} />
      <Tabs
        label={t('timpenjual.status')}
        value={tab}
        onChange={setTab}
        items={(['menunggu', 'disetujui', 'ditolak', 'ditangguhkan'] as const).map((s) => ({ value: s, label: `${t(`penjual.status.${s}`)} (${count(s)})` }))}
      />
      {tenants.isPending && <LoadingState />}
      {tenants.isError && <ErrorState onRetry={() => void tenants.refetch()} />}
      {tenants.data && list.length === 0 && <EmptyState title={t('timpenjual.kosong')} />}
      <ul className="space-y-3">
        {list.map((x) => (
          <li key={x.id}>
            <TenantCard tenant={x} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function TenantCard({ tenant }: { tenant: TenantRow }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suspendCount, setSuspendCount] = useState<number | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const logo = publicImage(tenant.logo_path)

  const errorText = (e: unknown) => t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') })

  // Pratinjau dulu supaya tim tahu berapa pesanan lunas yang ikut dibatalkan (ronde 39).
  async function askSuspend() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      setSuspendCount(await rpc<number>('team_suspension_preview', { p_tenant: tenant.id }))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function setSuspended(suspend: boolean) {
    setBusy(true)
    setError(null)
    try {
      const cancelled = await rpc<number>('team_set_tenant_suspended', { p_tenant: tenant.id, p_suspend: suspend, p_reason: suspend ? suspendReason.trim() : null })
      setSuspendCount(null)
      setSuspendReason('')
      setDone(
        !suspend
          ? t('timpenjual.diaktifkan_ok', { name: tenant.name })
          : cancelled > 0
            ? t('timpenjual.ditangguhkan_ok', { name: tenant.name, count: cancelled })
            : t('timpenjual.ditangguhkan_ok_kosong', { name: tenant.name }),
      )
      await queryClient.invalidateQueries({ queryKey: ['tim-tenant'] })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function review(approve: boolean) {
    setBusy(true)
    setError(null)
    try {
      await rpc('team_review_tenant', { p_tenant: tenant.id, p_approve: approve, p_reason: approve ? null : reason.trim() })
      setRejecting(false)
      await queryClient.invalidateQueries({ queryKey: ['tim-tenant'] })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="article" className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        {logo && <img src={logo} alt="" className="size-14 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">
            {tenant.name} {tenant.is_sample && <StatusText>{t('umum.contoh')}</StatusText>}
          </h2>
          <p className="text-sm text-muted">
            {t(`daftar.jenis_${tenant.type}`)} · {tenant.kiosk_location}
          </p>
          {tenant.submitted_at && (
            <p className="text-sm text-muted">{t('timpenjual.dikirim', { date: dateLabel(tenant.submitted_at.slice(0, 10), lang, t), time: clockFromDate(tenant.submitted_at, lang) })}</p>
          )}
        </div>
        {tenant.status === 'disetujui' && (
          <Link to="/tenant/$slug" params={{ slug: tenant.slug }} className="min-h-11 py-2.5 text-sm font-semibold text-accent underline underline-offset-4">
            {t('timpenjual.lihat_halaman')}
          </Link>
        )}
      </div>
      {tenant.description && <p className="text-sm">{tenant.description}</p>}
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[11rem_1fr]">
        <dt className="font-semibold">{t('daftar.kontak')}</dt>
        <dd>
          {tenant.contact_person} · {tenant.whatsapp}
        </dd>
        <dt className="font-semibold">{t('daftar.pengelola')}</dt>
        <dd>
          {t(`daftar.pengelola_${tenant.managed_by}`)}
          {tenant.manager_name && ` (${tenant.manager_name})`}
        </dd>
        <dt className="font-semibold">{t('timpenjual.menu')}</dt>
        <dd>{t('timpenjual.jumlah_menu', { count: tenant.menu_items.length })}</dd>
        <dt className="font-semibold">{t('daftar.kuota_dasar')}</dt>
        <dd>
          {tenant.base_quota}
          {tenant.tenant_quota_rules.length > 0 && ` · ${t('timpenjual.aturan_kuota', { count: tenant.tenant_quota_rules.length })}`}
        </dd>
        <dt className="font-semibold">{t('daftar.batas_pesan')}</dt>
        <dd>{t('menu.menit', { count: tenant.order_cutoff_minutes })}</dd>
        <dt className="font-semibold">{t('timpenjual.rekening')}</dt>
        <dd>{tenant.tenant_bank ? `${tenant.tenant_bank.bank_name} ${tenant.tenant_bank.account_number} a.n. ${tenant.tenant_bank.account_holder}` : '-'}</dd>
        <dt className="font-semibold">{t('toko.jadwal')}</dt>
        <dd>
          <ul>
            {WEEKDAYS.map((d) => {
              const list = tenant.tenant_hours.filter((h) => h.weekday === d).sort((a, b) => a.open_time.localeCompare(b.open_time))
              if (list.length === 0) return null
              return (
                <li key={d}>
                  {t(`hari.${d}`)}: {list.map((h) => t('tenant.rentang', { open: clock(h.open_time, lang), close: clock(h.close_time, lang) })).join(', ')}
                </li>
              )
            })}
          </ul>
        </dd>
      </dl>
      {tenant.status === 'ditolak' && tenant.reject_reason && <Notice tone="warn">{t('penjual.alasan', { reason: tenant.reject_reason })}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">{done}</Notice>}
      {tenant.status === 'disetujui' && (
        <Button variant="danger" busy={busy} busyText={t('umum.memproses')} onClick={() => void askSuspend()}>
          {t('timpenjual.tangguhkan')}
        </Button>
      )}
      {tenant.status === 'ditangguhkan' && (
        <Button variant="primary" busy={busy} busyText={t('umum.memproses')} onClick={() => void setSuspended(false)}>
          {t('timpenjual.aktifkan')}
        </Button>
      )}
      {tenant.status === 'menunggu' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="primary" busy={busy && !rejecting} busyText={t('umum.memproses')} onClick={() => void review(true)}>
            {t('timpenjual.setujui')}
          </Button>
          <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>
            {t('timpenjual.tolak')}
          </Button>
        </div>
      )}
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title={t('timpenjual.tolak_judul', { name: tenant.name })}>
        <div className="space-y-3">
          <Field label={t('timpenjual.alasan')} hint={t('timpenjual.alasan_isi')}>
            {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="danger" full disabled={!reason.trim()} busy={busy} busyText={t('umum.memproses')} onClick={() => void review(false)}>
            {t('timpenjual.kirim_tolak')}
          </Button>
        </div>
      </Dialog>
      <Dialog open={suspendCount !== null} onClose={() => setSuspendCount(null)} title={t('timpenjual.tangguhkan_judul', { name: tenant.name })}>
        <div className="space-y-3">
          <p>{suspendCount ? t('timpenjual.tangguhkan_isi', { count: suspendCount }) : t('timpenjual.tangguhkan_isi_kosong')}</p>
          <Field label={t('timpenjual.alasan_tangguh')} hint={t('timpenjual.alasan_tangguh_isi')}>
            {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} maxLength={500} />}
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="danger" full disabled={!suspendReason.trim()} busy={busy} busyText={t('umum.memproses')} onClick={() => void setSuspended(true)}>
            {t('timpenjual.kirim_tangguh')}
          </Button>
        </div>
      </Dialog>
    </Card>
  )
}
