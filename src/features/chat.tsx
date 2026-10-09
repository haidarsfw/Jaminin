import { PaperPlaneRightIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Notice, TextArea } from '@/components/ui'
import { clockFromDate, dateLabel, wibDate } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { rpc, supabase, toAppError, type Tables } from '@/lib/supabase'

type Message = Tables<'order_messages'>
export type ChatSide = 'pembeli' | 'penjual' | 'tim'

export function chatQueryKey(orderId: string) {
  return ['chat', orderId] as const
}

// Percakapan satu pesanan. Pesan dari sisi sendiri rata kanan; tim hanya membaca.
export function ChatThread({ orderId, side, open }: { orderId: string; side: ChatSide; open: boolean }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  const messages = useQuery({
    queryKey: chatQueryKey(orderId),
    refetchInterval: open ? 15_000 : false,
    queryFn: async () => {
      const { data, error: e } = await supabase.from('order_messages').select('*').eq('order_id', orderId).order('created_at')
      if (e) throw e
      return data as Message[]
    },
  })
  useTopic(`order:${orderId}`, ['message'], () => void queryClient.invalidateQueries({ queryKey: chatQueryKey(orderId) }))

  const count = messages.data?.length ?? 0
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' })
  }, [count])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await rpc('send_order_message', { p_order: orderId, p_body: body })
      setBody('')
      await queryClient.invalidateQueries({ queryKey: chatQueryKey(orderId) })
    } catch (err) {
      setError(t(`galat.${toAppError(err).code}`, { defaultValue: t('galat.unknown') }))
    } finally {
      setBusy(false)
    }
  }

  const mine = (m: Message) => (side === 'pembeli' ? !m.from_tenant : side === 'penjual' ? m.from_tenant : false)
  const author = (m: Message) => (mine(m) ? t('chat.kamu') : m.from_tenant ? t('chat.dari_tenant') : t('chat.dari_pembeli'))

  return (
    <div className="space-y-3">
      {messages.isPending && <p className="text-sm text-muted">{t('umum.memuat')}</p>}
      {messages.isError && <Notice tone="error">{t('galat.unknown')}</Notice>}
      {messages.data?.length === 0 && <p className="text-sm text-muted">{t('chat.kosong')}</p>}
      {count > 0 && (
        <ol ref={listRef} className="max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
          {messages.data!.map((m) => (
            <li key={m.id} className={`flex ${mine(m) ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${mine(m) ? 'bg-accent-soft' : 'border border-line-soft bg-surface'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {author(m)} · {dateLabel(wibDate(m.created_at), lang, t)} {clockFromDate(m.created_at, lang)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {side !== 'tim' &&
        (open ? (
          <form onSubmit={send} className="space-y-2">
            <label className="block text-sm font-semibold" htmlFor={`chat-${orderId}`}>
              {t('chat.tulis')}
            </label>
            <TextArea id={`chat-${orderId}`} value={body} maxLength={500} rows={2} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">{t('chat.sisa', { count: 500 - body.length })}</p>
              <Button icon={<PaperPlaneRightIcon />} type="submit" small variant="primary" busy={busy} busyText={t('umum.memproses')} disabled={!body.trim()}>
                {t('chat.kirim')}
              </Button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </form>
        ) : (
          <p className="text-sm text-muted">{t('chat.tutup')}</p>
        ))}
    </div>
  )
}

// Sama dengan aturan private.chat_open di database: terbuka sampai 24 jam setelah status akhir.
export function chatIsOpen(order: Pick<Tables<'orders'>, 'paid_at' | 'status' | 'completed_at' | 'cancelled_at' | 'updated_at'>, now = Date.now()): boolean {
  if (!order.paid_at) return false
  if (['diterima', 'disiapkan', 'siap'].includes(order.status)) return true
  if (!['selesai', 'dibatalkan', 'tidak_diambil'].includes(order.status)) return false
  const end = order.status === 'selesai' ? order.completed_at : order.status === 'dibatalkan' ? order.cancelled_at : null
  return new Date(end ?? order.updated_at).getTime() > now - 24 * 60 * 60 * 1000
}
