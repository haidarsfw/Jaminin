import { HeartIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFavorites, useToggleFavorite } from '@/features/buyer'
import { useAuth } from '@/lib/auth'
import { Button } from './ui'

// Tombol simpan ke favorit untuk tenant atau menu. Hanya tampil untuk pembeli yang sudah masuk.
export function FavoriteButton({ target, name }: { target: { tenant_id: string } | { menu_item_id: string }; name: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!user) return null
  const current = favorites.data?.find((f) => ('tenant_id' in target ? f.tenant_id === target.tenant_id : f.menu_item_id === target.menu_item_id))
  const on = !!current
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        small
        aria-pressed={on}
        aria-label={t('favorit.label', { name })}
        busy={busy}
        disabled={favorites.isPending}
        icon={<HeartIcon weight={on ? 'fill' : 'regular'} />}
        onClick={async () => {
          setBusy(true)
          setFailed(false)
          try {
            await toggle(target, current)
          } catch {
            setFailed(true)
          } finally {
            setBusy(false)
          }
        }}
      >
        {t('favorit.tombol')}
      </Button>
      {failed && (
        <span role="alert" className="text-sm font-medium text-danger">
          {t('galat.unknown')}
        </span>
      )}
    </span>
  )
}
