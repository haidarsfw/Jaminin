import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { BASE_URL, noHorizontalScroll, openBoard, openContext, orderAndPay, setPassword, signIn } from './bantuan'

// P1 nomor 3: daftar siap-masak di papan penjual dan layar dapur.
const SANDI = 'rahasia123'
// Kombinasi pilihan ini hanya dipakai uji ini, supaya jumlah porsinya tidak tercampur pesanan dari uji lain.
const MENU = { name: 'Kopi Susu', choices: ['Panas', 'Tanpa gula'], price: 'Rp18.000', total: 'Rp19.000' }
const LABEL = 'Kopi Susu (Panas, Tanpa gula)'

test.describe.configure({ mode: 'serial' })

async function setup(info: TestInfo) {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  for (const email of ['demo+pembeli@jaminin.test', 'demo+pemilik@jaminin.test']) await setPassword(email, SANDI)
}

async function openKitchen(page: Page) {
  await page.goto('/penjual/dapur')
  await page.getByRole('combobox', { name: /^Tenant/ }).selectOption({ label: 'Good Moments Coffee' })
  await expect(page.getByRole('heading', { name: 'Dapur Good Moments Coffee' })).toBeVisible()
}

// Chromium tanpa layar menolak kunci layar kecuali izinnya diberikan ke konteks ini.
async function grantWakeLock(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page)
  const { targetInfo } = await cdp.send('Target.getTargetInfo')
  await cdp.send('Browser.grantPermissions', { permissions: ['wakeLockScreen'], origin: BASE_URL, browserContextId: targetInfo.browserContextId })
}

test('daftar siap-masak di papan menjumlahkan porsi per jam ambil', async ({ browser }, info) => {
  await setup(info)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')
  const b = buyer.page
  const s = seller.page
  await signIn(b, 'demo+pembeli@jaminin.test', SANDI)
  await signIn(s, 'demo+pemilik@jaminin.test', SANDI)

  const pickupName = await orderAndPay(b, cashier.page, MENU)
  await openBoard(s)
  const card = s.locator('li', { hasText: pickupName }).first()
  await expect(card).toBeVisible()
  const heading = await s.locator('section', { has: card }).getByRole('heading', { level: 2 }).textContent()
  const time = heading?.match(/^\d{2}\.\d{2}/)?.[0] ?? ''
  expect(time).not.toBe('')

  const prep = s.locator('details', { has: s.getByText(/^Daftar siap-masak \(\d+ porsi\)$/) })
  await prep.getByText(/^Daftar siap-masak/).click()
  await expect(prep.getByText('Menu habis yang menunggu pilihan pembeli belum dihitung.', { exact: false })).toBeVisible()
  await expect(prep.locator('li', { hasText: `Untuk ${time}:` })).toContainText(`1x ${LABEL}`)
  await noHorizontalScroll(s)

  // Pesanan yang sudah siap diambil tidak perlu dimasak lagi, jadi keluar dari daftar.
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(card.getByText('Siap diambil', { exact: true })).toBeVisible()
  await expect(s.getByText(LABEL)).toHaveCount(0)

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})

test('layar dapur: kartu per jam ambil diperbarui sendiri, lalu Mulai siapkan dan Siap diambil', async ({ browser }, info) => {
  await setup(info)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')
  const phone = await openContext(browser, 'hp')
  const b = buyer.page
  const s = seller.page
  await signIn(b, 'demo+pembeli@jaminin.test', SANDI)
  await signIn(s, 'demo+pemilik@jaminin.test', SANDI)
  await grantWakeLock(seller.context, s)
  await openKitchen(s)
  await expect(s.getByText('Layar tetap menyala selama halaman ini terbuka.')).toBeVisible()

  // Layar dapur sudah terbuka sebelum pembeli membayar; pesanannya harus muncul tanpa memuat ulang halaman.
  const pickupName = await orderAndPay(b, cashier.page, MENU)
  const row = s.locator('li', { hasText: pickupName }).first()
  await expect(row).toBeVisible({ timeout: 25_000 })
  const alarm = s.getByRole('alert').filter({ hasText: /pesanan baru/ })
  await expect(alarm).toBeVisible()
  await alarm.getByRole('button', { name: 'Lihat' }).click()
  await expect(alarm).toBeHidden()

  const card = s.locator('section', { has: row })
  const time = (await card.getByRole('heading', { level: 2 }).textContent())?.trim() ?? ''
  expect(time).toMatch(/^\d{2}\.\d{2}$/)
  await expect(card.getByRole('list', { name: `Porsi untuk ${time}` })).toContainText(`1x ${LABEL}`)
  await expect(row).toContainText('Bungkus')
  await expect(row.getByText('Diterima', { exact: true })).toBeVisible()
  await noHorizontalScroll(s)

  // Di HP, layar yang sama tetap muat tanpa bergeser ke samping.
  await signIn(phone.page, 'demo+pemilik@jaminin.test', SANDI)
  await openKitchen(phone.page)
  await expect(phone.page.locator('li', { hasText: pickupName }).first()).toBeVisible()
  await noHorizontalScroll(phone.page)

  await row.getByRole('button', { name: 'Mulai siapkan' }).click()
  await expect(row.getByText('Sedang disiapkan', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Mulai siapkan' })).toHaveCount(0)
  await expect(b.getByText('Sedang disiapkan').first()).toBeVisible({ timeout: 20_000 })

  // Pesanan yang sudah siap keluar dari layar dapur; penyerahannya lewat Papan.
  await row.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(s.getByText(/^Pesanan #\d{3} siap diambil dan pindah ke Papan untuk diserahkan\.$/)).toBeVisible()
  await expect(s.locator('li', { hasText: pickupName })).toHaveCount(0)
  await expect(phone.page.locator('li', { hasText: pickupName })).toHaveCount(0, { timeout: 25_000 })
  await expect(b.getByText('Siap diambil').first()).toBeVisible({ timeout: 20_000 })

  for (const { errors } of [buyer, cashier, seller, phone]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close(), phone.context.close()])
})
