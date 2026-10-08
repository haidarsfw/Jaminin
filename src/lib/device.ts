// Deteksi perangkat untuk ajakan memasang Jaminin ke layar utama (iPhone dan iPad butuh pasang dulu agar push jalan).
export function isIos(): boolean {
  const ua = navigator.userAgent
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/.test(ua) || iPadOs
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

const BANNER_KEY = 'jaminin:banner-pasang-ditutup'

export function installBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstallBanner(): void {
  try {
    localStorage.setItem(BANNER_KEY, '1')
  } catch {
    // Tanpa penyimpanan, banner muncul lagi di kunjungan berikutnya.
  }
}
