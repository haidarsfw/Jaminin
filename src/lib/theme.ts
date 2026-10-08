// Tema mengikuti HP secara bawaan, bisa dipaksa terang atau gelap dari profil.
export type ThemePref = 'sistem' | 'terang' | 'gelap'

const KEY = 'jaminin:tema'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'terang' || v === 'gelap' ? v : 'sistem'
  } catch {
    return 'sistem'
  }
}

function apply(pref: ThemePref): void {
  const dark = pref === 'gelap' || (pref === 'sistem' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#151613' : '#f7f6f2'))
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // Mode privat: tema tetap berlaku untuk sesi ini.
  }
  apply(pref)
}

export function initTheme(): void {
  apply(getThemePref())
  media.addEventListener('change', () => apply(getThemePref()))
}
