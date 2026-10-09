import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openBoard, openContext, orderAndPay, setPassword, signIn } from './bantuan'

// P1 nomor 7: pencarian lintas tenant, filter penanda, favorit, pesan ulang, dan pengeluaran per bulan.
test('pembeli mencari, menyimpan favorit, dan memesan lagi pesanan lama', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const password = 'rahasia123'
  for (const email of ['demo+pembeli@jaminin.test', 'demo+pemilik@jaminin.test']) await setPassword(email, password)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')
  const b = buyer.page
  await signIn(b, 'demo+pembeli@jaminin.test', password)
  await signIn(seller.page, 'demo+pemilik@jaminin.test', password)

  // Pencarian menu lintas tenant beserta jam tercepat tenantnya.
  await b.goto('/')
  const results = b.getByRole('region', { name: 'Hasil pencarian' })
  await b.getByLabel('Cari menu atau tenant', { exact: true }).fill('matcha')
  const hit = results.getByRole('link', { name: /Matcha Latte/ })
  await expect(hit).toContainText('Good Moments Coffee')
  await expect(hit).toContainText(/Paling cepat/)
  await noHorizontalScroll(b)

  // Filter penanda tanpa kata kunci menampilkan semua menu dengan penanda itu.
  await b.getByLabel('Cari menu atau tenant', { exact: true }).fill('')
  await b.getByRole('group', { name: 'Penanda menu' }).getByRole('button', { name: 'Dingin' }).click()
  await expect(results.getByRole('link').first()).toContainText('Dingin')
  await b.getByRole('group', { name: 'Penanda menu' }).getByRole('button', { name: 'Dingin' }).click()
  await expect(results).toBeHidden()

  // Favorit tenant dan menu tampil di bagian atas beranda.
  await b.goto('/tenant/good-moments-coffee')
  const favTenant = b.getByRole('button', { name: 'Favorit: Good Moments Coffee' })
  if ((await favTenant.getAttribute('aria-pressed')) === 'true') await favTenant.click()
  await expect(favTenant).toHaveAttribute('aria-pressed', 'false')
  await favTenant.click()
  await expect(favTenant).toHaveAttribute('aria-pressed', 'true')
  await b.getByRole('button', { name: /Americano/ }).click()
  const favMenu = b.getByRole('dialog', { name: 'Americano' }).getByRole('button', { name: 'Favorit: Americano' })
  if ((await favMenu.getAttribute('aria-pressed')) === 'true') await favMenu.click()
  await favMenu.click()
  await expect(favMenu).toHaveAttribute('aria-pressed', 'true')
  await b.keyboard.press('Escape')
  await b.goto('/')
  const favorites = b.getByRole('region', { name: 'Favoritmu' })
  await expect(favorites.getByRole('link', { name: /Good Moments Coffee/ }).first()).toBeVisible()
  await expect(favorites.getByRole('link', { name: /Americano/ })).toBeVisible()

  // Pesanan yang sudah selesai bisa dipesan lagi; isinya masuk keranjang dengan pilihan yang sama.
  const pickupName = await orderAndPay(b, cashier.page, { name: 'Kopi Susu', choices: ['Dingin', 'Kurang manis'], price: 'Rp18.000', total: 'Rp19.000' })
  await openBoard(seller.page)
  const card = seller.page.locator('li', { hasText: pickupName }).first()
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(b.getByText('Siap diambil').first()).toBeVisible({ timeout: 20_000 })
  b.once('dialog', (d) => void d.accept())
  await b.getByRole('button', { name: 'Sudah saya terima' }).click()
  await expect(b.getByText('Selesai').first()).toBeVisible({ timeout: 20_000 })
  await b.getByRole('button', { name: 'Pesan lagi' }).click()
  await expect(b).toHaveURL(/\/keranjang$/)
  await expect(b.getByText(/^Isi pesanan #\d{3} sudah masuk keranjang$/)).toBeVisible()
  await expect(b.getByText('Kopi Susu', { exact: true })).toBeVisible()
  await expect(b.getByText('Dingin, Kurang manis')).toBeVisible()

  // Pengeluaran per bulan di halaman Pesanan.
  await b.goto('/pesanan')
  const spending = b.getByRole('region', { name: 'Pengeluaran per bulan' })
  await expect(spending.getByRole('listitem').first()).toContainText(/Rp\d/)
  await noHorizontalScroll(b)

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})
