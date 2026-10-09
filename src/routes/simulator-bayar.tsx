import { ScanIcon, WalletIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { QrScanner } from '@/components/QrScanner'
import { Button, Card, Dialog, EmptyState, Field, Input, Notice, PageHeader } from '@/components/ui'
import { parsePaymentQr } from '@/features/orders'
import { useAuth } from '@/lib/auth'
import { clockFromDate, rupiah } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { callFunction, rpc, toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/simulator-bayar')({
  validateSearch: (s: Record<string, unknown>): { kode?: string } => (typeof s.kode === 'string' ? { kode: s.kode.toUpperCase().slice(0, 6) } : {}),
  component: Simulator,
})

type Pending = { order_id: string; payment_code: string; amount: number; tenant_name: string; pickup_name: string; pay_deadline: string; created_at: string }

// Halaman pengganti aplikasi bank untuk prototipe. Pembayaran sungguhan nanti masuk lewat jalur konfirmasi yang sama.
function Simulator() {
  const { t } = useTranslation()
  const lang = currentLang()
  const { kode } = Route.useSearch()
  const { teamRole } = useAuth()
  const queryClient = useQueryClient()
  const [code, setCode] = useState(kode ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [scan, setScan] = useState(false)

  const pending = useQuery({
    queryKey: ['tagihan'],
    enabled: !!teamRole,
    queryFn: () => rpc<Pending[]>('team_pending_payments'),
    refetchInterval: 10_000,
  })
  useTopic(teamRole ? 'team' : null, ['payment'], () => void queryClient.invalidateQueries({ queryKey: ['tagihan'] }))

  async function pay(value: string) {
    const clean = value.trim().toUpperCase()
    setBusy(clean)
    setResult(null)
    try {
      const res = await callFunction<{ amount: number; already_paid?: boolean }>('simulasi-bayar', { code: clean })
      setResult({ ok: true, text: res.already_paid ? t('simulator.sudah_lunas') : t('simulator.berhasil', { amount: rupiah(res.amount) }) })
      setCode('')
      void queryClient.invalidateQueries({ queryKey: ['tagihan'] })
    } catch (e) {
      setResult({ ok: false, text: t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }) })
    } finally {
      setBusy(null)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (code.trim().length === 6) void pay(code)
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={t('simulator.judul')} description={t('simulator.sub')} />
      <Notice>{t('simulator.peringatan')}</Notice>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t('simulator.kode')} hint={t('simulator.kode_isi')}>
            {(p) => (
              <Input
                id={p.id}
                aria-describedby={p.describedBy}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                className="font-mono text-2xl tracking-[0.3em]"
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
              />
            )}
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button icon={<WalletIcon />} type="submit" variant="primary" full disabled={code.length !== 6} busy={busy === code} busyText={t('umum.memproses')}>
              {t('simulator.bayar')}
            </Button>
            <Button icon={<ScanIcon />} full onClick={() => setScan(true)}>
              {t('simulator.pindai')}
            </Button>
          </div>
        </form>
        {result && (
          <Notice tone={result.ok ? 'success' : 'error'} className="mt-3">
            {result.text}
          </Notice>
        )}
      </Card>

      {teamRole && (
        <section aria-labelledby="tagihan" className="space-y-2">
          <h2 id="tagihan" className="text-lg font-bold">
            {t('simulator.tagihan')}
          </h2>
          {pending.data && pending.data.length === 0 && <EmptyState title={t('simulator.tagihan_kosong')} />}
          <ul className="space-y-2">
            {(pending.data ?? []).map((p) => (
              <li key={p.order_id}>
                <Card as="div" className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-widest">{p.payment_code}</p>
                    <p className="text-sm text-muted">
                      {p.tenant_name} · {p.pickup_name} · {t('simulator.batas', { time: clockFromDate(p.pay_deadline, lang) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular font-bold">{rupiah(p.amount)}</span>
                    <Button icon={<ScanIcon />} small variant="primary" busy={busy === p.payment_code} busyText={t('umum.memproses')} onClick={() => void pay(p.payment_code)}>
                      {t('simulator.bayar')}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={scan} onClose={() => setScan(false)} title={t('simulator.pindai')}>
        {scan && (
          <QrScanner
            onResult={(text) => {
              setScan(false)
              const parsed = parsePaymentQr(text)
              if (parsed) {
                setCode(parsed)
                void pay(parsed)
              } else {
                setResult({ ok: false, text: t('simulator.qr_bukan') })
              }
            }}
          />
        )}
      </Dialog>
    </div>
  )
}
