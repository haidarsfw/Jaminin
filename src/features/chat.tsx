import { PaperPlaneRightIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Notice } from '@/components/ui'
import { clockFromDate, dateLabel, wibDate } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { useTopic } from '@/lib/realtime'
import { rpc, supabase, toAppError, type Tables } from '@/lib/supabase'

type Message = Tables<'order_messages'>
export type ChatSide = 'pembeli' | 'penjual' | 'tim'

const MAX_LENGTH = 500

export function chatQueryKey(orderId: string) {
  return ['chat', orderId] as const
}

// Percakapan satu pesanan. Pesan dari sisi sendiri rata kanan; tim hanya membaca.
// fill: mengisi jendela chat (Dialog full) dengan kolom tulis tetap di bawah.
export function ChatThread({ orderId, side, open, fill }: { orderId: string; side: ChatSide; open: boolean; fill?: boolean }) {
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

  async function send(e?: FormEvent) {
    e?.preventDefault()
    if (!body.trim() || busy) return
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

  // Di laptop Enter langsung mengirim dan Shift+Enter membuat baris baru. Di HP Enter tetap membuat baris baru.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault()
      void send()
    }
  }

  const mine = (m: Message) => (side === 'pembeli' ? !m.from_tenant : side === 'penjual' ? m.from_tenant : false)
  const author = (m: Message) => (mine(m) ? t('chat.kamu') : m.from_tenant ? t('chat.dari_tenant') : t('chat.dari_pembeli'))
  const left = MAX_LENGTH - body.length

  return (
    <div className={fill ? 'flex min-h-0 flex-1 flex-col' : 'space-y-3'}>
      <div className={fill ? 'min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3' : 'space-y-3'}>
        {fill && side !== 'tim' && <p className="text-center text-xs text-muted">{t('chat.isi')}</p>}
        {messages.isPending && <p className="text-sm text-muted">{t('umum.memuat')}</p>}
        {messages.isError && <Notice tone="error">{t('galat.unknown')}</Notice>}
        {messages.data?.length === 0 && <p className={`text-sm text-muted ${fill ? 'py-8 text-center' : ''}`}>{t('chat.kosong')}</p>}
        {count > 0 && (
          <ol ref={listRef} className={`space-y-3 ${fill ? '' : 'max-h-80 overflow-y-auto'}`} aria-live="polite">
            {messages.data!.map((m) => {
              const own = mine(m)
              return (
                <li key={m.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                  <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${own ? 'bg-accent-soft' : 'border border-line-soft bg-canvas'}`}>{m.body}</p>
                  <p className="mt-1 px-1 text-xs text-muted">
                    {side === 'tim' || !own ? `${author(m)} · ` : ''}
                    {dateLabel(wibDate(m.created_at), lang, t)} {clockFromDate(m.created_at, lang)}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
      </div>
      {side !== 'tim' &&
        (open ? (
          <form onSubmit={(e) => void send(e)} className={fill ? 'border-t border-line-soft px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : ''}>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor={`chat-${orderId}`}>
                {t('chat.tulis')}
              </label>
              <textarea
                id={`chat-${orderId}`}
                rows={1}
                value={body}
                maxLength={MAX_LENGTH}
                placeholder={t('chat.tulis')}
                enterKeyHint="send"
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onKeyDown}
                className="block max-h-32 min-h-12 w-full flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink field-sizing-content placeholder:text-muted"
              />
              <button
                type="submit"
                aria-label={t('chat.kirim')}
                disabled={busy || !body.trim()}
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PaperPlaneRightIcon size={22} weight="fill" aria-hidden="true" />
              </button>
            </div>
            {left <= 100 && <p className="mt-1 px-1 text-xs text-muted">{t('chat.sisa', { count: left })}</p>}
            {error && (
              <Notice tone="error" className="mt-2">
                {error}
              </Notice>
            )}
          </form>
        ) : (
          <p className={`text-sm text-muted ${fill ? 'border-t border-line-soft px-4 py-3' : ''}`}>{t('chat.tutup')}</p>
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
