import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/components/Guard'
import { Button, EmptyState, ErrorState, LoadingState, Notice, PageHeader, StatusText } from '@/components/ui'
import { kabarQueryKey, kabarText, markKabarRead, useKabar, type Kabar } from '@/features/kabar'
import { useAuth } from '@/lib/auth'
import { clockFromDate, dateLabel, wibDate, type Lang } from '@/lib/format'
import { currentLang } from '@/lib/i18n'
import { toAppError } from '@/lib/supabase'

export const Route = createFileRoute('/kabar')({
  component: () => (
    <RequireAuth needProfile={false}>
      <KabarPage />
    </RequireAuth>
  ),
})

function KabarPage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const { user } = useAuth()
  const kabar = useKabar()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (kabar.isPending) return <LoadingState />
  if (kabar.isError) return <ErrorState onRetry={() => void kabar.refetch()} />

  const unread = kabar.data.filter((k) => !k.read_at)
  const refresh = () => queryClient.invalidateQueries({ queryKey: kabarQueryKey(user?.id ?? null) })

  async function markAll() {
    setBusy(true)
    setError(null)
    try {
      await markKabarRead(unread.map((k) => k.id))
      await refresh()
    } catch (err) {
      setError(t(`galat.${toAppError(err).code}`, { defaultValue: t('galat.unknown') }))
    } finally {
      setBusy(false)
    }
  }

  function open(item: Kabar) {
    if (!item.read_at) void markKabarRead([item.id]).then(refresh)
    if (item.url?.startsWith('/')) void navigate({ href: item.url })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('kabar.judul')} description={t('kabar.sub')} />
      {unread.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">{t('kabar.belum_dibaca', { count: unread.length })}</p>
          <Button small busy={busy} busyText={t('umum.memproses')} onClick={() => void markAll()}>
            {t('kabar.tandai_semua')}
          </Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {kabar.data.length === 0 ? (
        <EmptyState title={t('kabar.kosong')} body={t('kabar.kosong_isi')} />
      ) : (
        <ul className="space-y-2">
          {kabar.data.map((item) => (
            <KabarItem key={item.id} item={item} lang={lang} onOpen={() => open(item)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function KabarItem({ item, lang, onOpen }: { item: Kabar; lang: Lang; onOpen: () => void }) {
  const { t } = useTranslation()
  const text = kabarText(item, t, lang)
  const unread = !item.read_at
  const when = `${dateLabel(wibDate(item.created_at), lang, t)}, ${clockFromDate(item.created_at, lang)}`
  const box = `block rounded-xl border bg-surface p-3 ${unread ? 'border-line' : 'border-line-soft'}`

  const content = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={`min-w-0 ${unread ? 'font-bold' : 'font-semibold'}`}>{text.title}</span>
        {unread && <StatusText>{t('kabar.baru')}</StatusText>}
      </span>
      {text.body && <span className="mt-1 block text-sm">{text.body}</span>}
      {text.detail && <span className="mt-1 block text-sm text-muted">{text.detail}</span>}
      <span className="mt-1 block text-sm text-muted">{when}</span>
    </>
  )

  // Tautan biasa supaya bisa dibuka di tab baru; klik biasa menandai dibaca lalu pindah halaman di aplikasi.
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onOpen()
  }

  return (
    <li>
      {item.url?.startsWith('/') ? (
        <a href={item.url} onClick={onClick} className={`${box} hover:border-ink`}>
          {content}
        </a>
      ) : (
        <div className={box}>{content}</div>
      )}
    </li>
  )
}
