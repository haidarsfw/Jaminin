import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openContext, setPassword, signIn } from './bantuan'

// Pemilik membuat promo jam sepi, pembeli melihat tanda promo di pilihan jam dan membayar setelah potongan.
test('promo jam sepi dari pengaturan toko sampai checkout', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const password = 'rahasia123'
  for (const email of ['demo+pembeli@jaminin.test', 'demo+pemilik@jaminin.test']) await setPassword(email, password)
  const seller = await openContext(browser, 'ipad')
  const buyer = await openContext(browser, 'hp')

  const s = seller.page
  await signIn(s, 'demo+pemilik@jaminin.test', password)
  await s.goto('/penjual')
  await s.getByRole('combobox', { name: /^Tenant/ }).selectOption({ label: 'Good Moments Coffee' })
  await s.goto('/penjual/toko')
  const card = s.locator('section', { has: s.getByRole('heading', { name: 'Promo jam sepi' }) })
  await card.getByLabel('Potongan (%)', { exact: true }).fill('20')
  for (const day of ['Sabtu', 'Minggu']) await card.getByText(day, { exact: true }).click()
  await card.getByLabel('Jam ambil mulai', { exact: true }).fill('06:00')
  await card.getByLabel('Sampai sebelum', { exact: true }).fill('22:00')
  await card.getByRole('button', { name: 'Tambah promo' }).click()
  await expect(card.getByText('Potongan 20%')).toBeVisible()
  await noHorizontalScroll(s)

  // Promo kedua yang tumpang tindih ditolak dengan pesan yang jelas.
  await card.getByText('Rupiah', { exact: true }).click()
  await card.getByLabel('Potongan (Rp)', { exact: true }).fill('3000')
  const before = seller.errors.length
  await card.getByRole('button', { name: 'Tambah promo' }).click()
  await expect(card.getByText('Promo ini tumpang tindih dengan promo aktif lain di hari dan jam yang sama.')).toBeVisible()
  // Browser mencatat jawaban 400 dari penolakan ini sebagai galat console; hanya galat itu yang boleh muncul.
  expect(seller.errors.slice(before)).toEqual(['Failed to load resource: the server responded with a status of 400 (Bad Request)'])
  seller.errors.splice(before)

  // Pembeli: Roti Mentega Rp12.000, potongan 20% = Rp2.400, bayar Rp10.600.
  const b = buyer.page
  await signIn(b, 'demo+pembeli@jaminin.test', password)
  await b.goto('/tenant/good-moments-coffee')
  await b.getByRole('button', { name: /Roti Mentega/ }).click()
  await b.getByRole('dialog', { name: 'Roti Mentega' }).getByRole('button', { name: 'Tambah ke keranjang, Rp12.000' }).click()
  await b.getByRole('link', { name: /Keranjang \(1\)/ }).click()
  await b.getByRole('link', { name: 'Pilih jam ambil' }).click()
  const slot = b.getByRole('radiogroup', { name: 'Jam ambil' }).getByRole('radio').and(b.locator(':enabled')).first()
  await expect(slot).toContainText('-20%')
  await slot.click()
  await expect(b.getByText('-Rp2.400')).toBeVisible()
  await expect(b.getByRole('button', { name: 'Bayar Rp10.600' })).toBeVisible()

  // Promo dihapus lagi supaya data lokal kembali seperti semula.
  await card.getByRole('button', { name: /^Hapus promo Potongan 20%/ }).click()
  await expect(card.getByText('Belum ada promo.')).toBeVisible()

  for (const { errors } of [seller, buyer]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([seller.context.close(), buyer.context.close()])
})
