import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Choice, Dialog, EmptyState, ErrorState, Field, Input, LoadingState, Notice, PageHeader, Select, StatusText, Tabs, TextArea } from '@/components/ui'
import { ChatThread } from '@/features/chat'
import { clock, clockFromDate, dateLabel, orderNo, rupiah, waLink } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { rpc, supabase, toAppError, type Enums, type Tables } from '@/lib/supabase'

export const Route = createFileRoute('/tim/laporan')({
  component: Reports,
})

type ReportOrder = Tables<'orders'> & {
  tenants: { name: string } | null
  order_items: Tables<'order_items'>[]
  refunds: Tables<'refunds'>[]
}
type Report = Tables<'reports'> & { report_replies: Tables<'report_replies'>[]; orders: ReportOrder | null }

const ACTIVE: Enums<'status_pesanan'>[] = ['diterima', 'disiapkan', 'siap']

function Reports() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Enums<'status_laporan'>>('baru')
  const [openId, setOpenId] = useState<string | null>(null)
  const reports = useQuery({
    queryKey: ['tim-laporan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, report_replies(*), orders(*, tenants(name), order_items(*), refunds(*))')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as unknown as Report[]
    },
  })
  useTopic('team', ['report'], () => void queryClient.invalidateQueries({ queryKey: ['tim-laporan'] }))

  const list = (reports.data ?? []).filter((r) => r.status === tab)
  const count = (s: Enums<'status_laporan'>) => (reports.data ?? []).filter((r) => r.status === s).length
  const opened = reports.data?.find((r) => r.id === openId) ?? null

  return (
    <div className="space-y-4">
      <PageHeader title={t('timlaporan.judul')} description={t('timlaporan.sub')} />
      <Tabs
        label={t('timlaporan.status')}
        value={tab}
        onChange={setTab}
        items={(['baru', 'diproses', 'selesai'] as const).map((s) => ({ value: s, label: `${t(`laporan.status.${s}`)} (${count(s)})` }))}
      />
      {reports.isPending && <LoadingState />}
      {reports.isError && <ErrorState onRetry={() => void reports.refetch()} />}
      {reports.data && list.length === 0 && <EmptyState title={t('timlaporan.kosong')} />}
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id}>
            <ReportRow report={r} onOpen={() => setOpenId(r.id)} />
          </li>
        ))}
      </ul>
      {opened && <ReportDialog report={opened} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function ReportRow({ report, onOpen }: { report: Report; onOpen: () => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const o = report.orders
  return (
    <Card as="div" className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">
          {t(`laporan.kategori.${report.category}`)} · {o?.tenants?.name} {o && orderNo(o.order_number)}
        </p>
        <p className="line-clamp-2 text-sm text-muted">{report.story}</p>
        <p className="text-sm text-muted">
          {dateLabel(report.created_at.slice(0, 10), lang, t)} {clockFromDate(report.created_at, lang)} · {t('timlaporan.balasan', { count: report.report_replies.length })}
        </p>
      </div>
      <Button small onClick={onOpen}>
        {t('timlaporan.buka')}
      </Button>
    </Card>
  )
}

function ReportDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const queryClient = useQueryClient()
  const o = report.orders
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState<Enums<'status_laporan'>>(report.status === 'baru' ? 'diproses' : report.status)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    if (!report.photo_path) return
    let alive = true
    void supabase.storage
      .from('report-photos')
      .createSignedUrl(report.photo_path, 3600)
      .then(({ data }) => {
        if (alive) setPhotoUrl(data?.signedUrl ?? null)
      })
    return () => {
      alive = false
    }
  }, [report.photo_path])

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['tim-laporan'] })
      setNotice(done)
      return true
    } catch (e) {
      setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
      return false
    } finally {
      setBusy(null)
    }
  }

  const remaining = o ? o.total_paid - o.refunded_total : 0

  return (
    <Dialog open onClose={onClose} title={t('timlaporan.detail', { number: o ? orderNo(o.order_number) : '' })}>
      <div className="space-y-4">
        {o && (
          <section aria-label={t('timlaporan.pesanan')} className="space-y-1 text-sm">
            <p className="font-semibold">
              {o.tenants?.name} · {orderNo(o.order_number)} · <StatusText>{t(`status.${o.status}`)}</StatusText>
            </p>
            <p>
              {dateLabel(o.pickup_date, lang, t)} {clock(o.pickup_time, lang)} · {t('timlaporan.pengambil', { name: o.pickup_name })}
            </p>
            <p>
              {t('timlaporan.pembeli', { name: o.buyer_name })}
              {o.buyer_whatsapp && (
                <>
                  {' · '}
                  <a href={waLink(o.buyer_whatsapp, t('timlaporan.wa_teks', { number: orderNo(o.order_number) }))} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">
                    WhatsApp
                  </a>
                </>
              )}
            </p>
            <ul className="mt-2 divide-y divide-line-soft rounded-lg border border-line-soft">
              {o.order_items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 px-3 py-1.5">
                  <span>
                    {i.quantity}× {i.name}
                    {i.status !== 'normal' && ` (${t(`item_status.${i.status}`)})`}
                  </span>
                  <span className="tabular">{rupiah(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <p className="tabular">
              {t('timlaporan.dibayar', { amount: rupiah(o.total_paid) })} · {t('timlaporan.sudah_kembali', { amount: rupiah(o.refunded_total) })}
            </p>
            {o.refunds.length > 0 && (
              <ul className="text-muted">
                {o.refunds.map((r) => (
                  <li key={r.id}>
                    {rupiah(r.amount)} · {t(`alasan.${r.reason_code}`, { defaultValue: r.reason_code })} · {t(`penanggung.${r.bearer}`)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-label={t('timlaporan.isi_laporan')} className="space-y-2">
          <p className="font-semibold">{t(`laporan.kategori.${report.category}`)}</p>
          <p className="whitespace-pre-wrap">{report.story}</p>
          {photoUrl && (
            <a href={photoUrl} target="_blank" rel="noreferrer">
              <img src={photoUrl} alt={t('timlaporan.foto')} className="max-h-64 rounded-lg border border-line-soft object-contain" />
            </a>
          )}
          {report.report_replies.length > 0 && (
            <ul className="space-y-2">
              {[...report.report_replies]
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((r) => (
                  <li key={r.id} className="rounded-lg bg-canvas p-3 text-sm">
                    <p className="whitespace-pre-wrap">{r.body}</p>
                    <p className="mt-1 text-muted">{clockFromDate(r.created_at, lang)}</p>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section aria-label={t('chat.judul_tim')} className="space-y-2">
          <h3 className="font-semibold">{t('chat.judul_tim')}</h3>
          <ChatThread orderId={report.order_id} side="tim" open={false} />
        </section>

        <section aria-label={t('timlaporan.balas')} className="space-y-2">
          <Field label={t('timlaporan.balas')} hint={t('timlaporan.balas_isi')}>
            {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} />}
          </Field>
          <Field label={t('timlaporan.status')}>
            {(p) => (
              <Select id={p.id} value={status} onChange={(e) => setStatus(e.target.value as Enums<'status_laporan'>)}>
                {(['baru', 'diproses', 'selesai'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`laporan.status.${s}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button
            variant="primary"
            full
            busy={busy === 'balas'}
            busyText={t('umum.mengirim')}
            onClick={() =>
              void run('balas', () => rpc('team_reply_report', { p_report: report.id, p_body: reply.trim(), p_status: status }), t('timlaporan.terkirim')).then((ok) => {
                if (ok) setReply('')
              })
            }
          >
            {reply.trim() ? t('timlaporan.kirim_balasan') : t('timlaporan.simpan_status')}
          </Button>
        </section>

        {o && (
          <section aria-label={t('timlaporan.tindakan')} className="grid gap-2 border-t border-line-soft pt-4 sm:grid-cols-2">
            <Button onClick={() => setRefundOpen(true)} disabled={remaining <= 0}>
              {t('timlaporan.uang_kembali')}
            </Button>
            {ACTIVE.includes(o.status) && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                {t('timlaporan.batalkan')}
              </Button>
            )}
          </section>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
      </div>

      {o && refundOpen && (
        <RefundDialog
          order={o}
          remaining={remaining}
          onClose={() => setRefundOpen(false)}
          onSubmit={(full, amount, bearer, reason) =>
            run('uang', () => rpc('team_refund', { p_order: o.id, p_full: full, p_amount: full ? null : amount, p_bearer: bearer, p_reason: reason }), t('timlaporan.uang_terkirim')).then((ok) => {
              if (ok) setRefundOpen(false)
            })
          }
          busy={busy === 'uang'}
          error={error}
        />
      )}
      {o && cancelOpen && (
        <CancelDialog
          onClose={() => setCancelOpen(false)}
          onSubmit={(reason) =>
            run('batal', () => rpc('team_cancel_order', { p_order: o.id, p_reason: reason }), t('timlaporan.batal_terkirim')).then((ok) => {
              if (ok) setCancelOpen(false)
            })
          }
          busy={busy === 'batal'}
          error={error}
        />
      )}
    </Dialog>
  )
}

// Uang kembali manual: penanggung dipilih tim (awalnya tenant). Penuh hanya untuk pesanan yang sudah selesai atau tidak diambil.
function RefundDialog({
  order,
  remaining,
  onClose,
  onSubmit,
  busy,
  error,
}: {
  order: ReportOrder
  remaining: number
  onClose: () => void
  onSubmit: (full: boolean, amount: number, bearer: 'tenant' | 'jaminin', reason: string) => void
  busy: boolean
  error: string | null
}) {
  const { t } = useTranslation()
  const canFull = order.status === 'selesai' || order.status === 'tidak_diambil'
  const [full, setFull] = useState(false)
  const [amount, setAmount] = useState('')
  const [bearer, setBearer] = useState<'tenant' | 'jaminin'>('tenant')
  const [reason, setReason] = useState('')
  const value = Math.round(Number(amount))
  const valid = reason.trim().length > 0 && (full || (value > 0 && value <= remaining))

  return (
    <Dialog open onClose={onClose} title={t('uangtim.judul', { number: orderNo(order.order_number) })}>
      <div className="space-y-3">
        <p className="text-sm">{t('uangtim.sisa', { amount: rupiah(remaining) })}</p>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('uangtim.jenis')}</legend>
          <Choice name="jenis-uang" value="sebagian" checked={!full} onChange={() => setFull(false)}>
            {t('uangtim.sebagian')}
          </Choice>
          <Choice name="jenis-uang" value="penuh" checked={full} onChange={() => setFull(true)} disabled={!canFull}>
            {t('uangtim.penuh', { amount: rupiah(remaining) })}
          </Choice>
          {!canFull && <p className="text-sm text-muted">{t('uangtim.penuh_aktif')}</p>}
        </fieldset>
        {!full && (
          <Field label={t('uangtim.jumlah')}>
            {(p) => <Input id={p.id} type="number" min={1} max={remaining} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('uangtim.penanggung')}</legend>
          <Choice name="penanggung" value="tenant" checked={bearer === 'tenant'} onChange={() => setBearer('tenant')}>
            {t('uangtim.tenant')}
          </Choice>
          <Choice name="penanggung" value="jaminin" checked={bearer === 'jaminin'} onChange={() => setBearer('jaminin')}>
            {t('uangtim.jaminin')}
          </Choice>
        </fieldset>
        {full && <p className="text-sm text-muted">{t('uangtim.penuh_isi')}</p>}
        <Field label={t('uangtim.alasan')} hint={t('uangtim.alasan_isi')}>
          {(p) => <TextArea id={p.id} aria-describedby={p.describedBy} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="min-h-16" />}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button variant="primary" full disabled={!valid} busy={busy} busyText={t('umum.memproses')} onClick={() => onSubmit(full, value, bearer, reason.trim())}>
          {t('uangtim.kirim')}
        </Button>
      </div>
    </Dialog>
  )
}

function CancelDialog({ onClose, onSubmit, busy, error }: { onClose: () => void; onSubmit: (reason: string) => void; busy: boolean; error: string | null }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  return (
    <Dialog open onClose={onClose} title={t('timlaporan.batalkan')}>
      <div className="space-y-3">
        <p className="text-sm">{t('timlaporan.batalkan_isi')}</p>
        <Field label={t('uangtim.alasan')}>
          {(p) => <TextArea id={p.id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="min-h-16" />}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button variant="danger" full disabled={!reason.trim()} busy={busy} busyText={t('umum.memproses')} onClick={() => onSubmit(reason.trim())}>
          {t('timlaporan.batalkan_kirim')}
        </Button>
      </div>
    </Dialog>
  )
}
