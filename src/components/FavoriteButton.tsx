import { HeartIcon } from '@phosphor-icons/react'
import * as m from 'motion/react-m'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFavorites, useToggleFavorite } from '@/features/buyer'
import { useAuth } from '@/lib/auth'
import { Button } from './ui'

// Tombol simpan ke favorit untuk tenant atau menu. Hanya tampil untuk pembeli yang sudah masuk.
// compact: ikon hati saja (nama tombol tetap terbaca pembaca layar), untuk tempat sempit seperti rincian menu.
export function FavoriteButton({ target, name, compact }: { target: { tenant_id: string } | { menu_item_id: string }; name: string; compact?: boolean }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!user) return null
  const current = favorites.data?.find((f) => ('tenant_id' in target ? f.tenant_id === target.tenant_id : f.menu_item_id === target.menu_item_id))
  const on = !!current

  async function run() {
    setBusy(true)
    setFailed(false)
    try {
      await toggle(target, current)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const heart = (
    <m.span initial={false} animate={on ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.3 }} className="inline-flex">
      <HeartIcon size={compact ? 22 : undefined} weight={on ? 'fill' : 'regular'} className={on ? 'text-danger' : ''} aria-hidden="true" />
    </m.span>
  )
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {compact ? (
        <button
          type="button"
          aria-pressed={on}
          aria-label={t('favorit.label', { name })}
          title={t('favorit.tombol')}
          disabled={busy || favorites.isPending}
          onClick={() => void run()}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface hover:bg-canvas disabled:opacity-60"
        >
          {heart}
        </button>
      ) : (
        <Button small aria-pressed={on} aria-label={t('favorit.label', { name })} busy={busy} disabled={favorites.isPending} icon={heart} onClick={() => void run()}>
          {t('favorit.tombol')}
        </Button>
      )}
      {failed && (
        <span role="alert" className="text-sm font-medium text-danger">
          {t('galat.unknown')}
        </span>
      )}
    </span>
  )
}
