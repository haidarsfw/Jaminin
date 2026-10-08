import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Notice } from './ui'

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

// Memakai BarcodeDetector bawaan kalau ada (Chrome Android), selain itu ZXing WebAssembly yang ikut dibundel (Safari, Firefox).
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
  if (native) {
    const formats = (await native.getSupportedFormats?.()) ?? []
    if (formats.includes('qr_code')) return new native({ formats: ['qr_code'] })
  }
  const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) } })
  return new BarcodeDetector({ formats: ['qr_code'] }) as unknown as Detector
}

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const detector = await createDetector()
        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) {
              stopped = true
              onResultRef.current(codes[0].rawValue)
              return
            }
          } catch {
            // Bingkai belum siap, coba lagi di putaran berikutnya.
          }
          timer = window.setTimeout(tick, 250)
        }
        void tick()
      } catch {
        setError(t('pindai.kamera_gagal'))
      }
    })()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [t])

  return (
    <div className="space-y-2">
      {error ? (
        <Notice tone="warn">{error}</Notice>
      ) : (
        <video ref={videoRef} className="aspect-square w-full rounded-lg bg-black object-cover" muted playsInline aria-label={t('pindai.kamera')} />
      )}
      <p className="text-sm text-muted">{t('pindai.arahkan')}</p>
    </div>
  )
}
