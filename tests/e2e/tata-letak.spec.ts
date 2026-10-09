import { expect, test, type Page } from '@playwright/test'
import { noHorizontalScroll, setPassword, signIn } from './bantuan'

// Setiap halaman utama dibuka di HP, iPad, dan laptop: tidak boleh ada error console atau halaman yang bergeser ke samping.
const SANDI = 'rahasia123'

async function tour(page: Page, paths: string[], shotPrefix: string, project: string) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
  for (const path of paths) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).not.toContainText('Memuat...')
    await noHorizontalScroll(page)
    await page.screenshot({ path: `test-results/tur/${project}/${shotPrefix}${path.replaceAll('/', '_') || '_beranda'}.png`, fullPage: true })
  }
  expect(errors, errors.join('\n')).toEqual([])
}

test('halaman pembeli tanpa masuk', async ({ page }, info) => {
  await tour(page, ['/', '/tenant/good-moments-coffee', '/tenant/rustic-grill-bbq', '/keranjang', '/masuk', '/simulator-bayar', '/panduan-pasang'], 'tamu', info.project.name)
})

test('halaman penjual', async ({ page }, info) => {
  await setPassword('demo+pemilik@jaminin.test', SANDI)
  await signIn(page, 'demo+pemilik@jaminin.test', SANDI)
  await tour(page, ['/penjual', '/penjual/dapur', '/penjual/menu', '/penjual/toko', '/penjual/setoran', '/penjual/daftar', '/pesanan', '/kabar', '/profil'], 'penjual', info.project.name)
})

test('halaman tim', async ({ page }, info) => {
  await setPassword('demo+admin@jaminin.test', SANDI)
  await signIn(page, 'demo+admin@jaminin.test', SANDI)
  await tour(page, ['/tim', '/tim/penjual', '/tim/laporan', '/tim/setoran', '/tim/anggota', '/kabar', '/simulator-bayar'], 'tim', info.project.name)
})
