import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Notice, PageHeader } from '@/components/ui'
import { isIos, isStandalone } from '@/lib/device'

export const Route = createFileRoute('/panduan-pasang')({
  component: InstallGuide,
})

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function InstallGuide() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const ios = isIos()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={t('pasang.judul')} description={t('pasang.sub')} back={{ to: '/profil', label: t('nav.profil') }} />
      {isStandalone() && <Notice tone="success">{t('pasang.sudah')}</Notice>}
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{t('pasang.iphone_judul')}</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t('pasang.iphone_1')}</li>
          <li>{t('pasang.iphone_2')}</li>
          <li>{t('pasang.iphone_3')}</li>
          <li>{t('pasang.iphone_4')}</li>
        </ol>
        <p className="text-sm text-muted">{t('pasang.iphone_catatan')}</p>
      </Card>
      {!ios && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">{t('pasang.android_judul')}</h2>
          {prompt ? (
            <Button
              variant="primary"
              onClick={async () => {
                await prompt.prompt()
                setPrompt(null)
              }}
            >
              {t('pasang.tombol')}
            </Button>
          ) : (
            <p>{t('pasang.android_isi')}</p>
          )}
        </Card>
      )}
    </div>
  )
}
