import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openBoard, openContext, orderAndPay, setPassword, signIn } from './bantuan'

// P1 nomor 2: chat per pesanan antara pembeli dan tenant. Tim hanya membaca chat pesanan yang dilaporkan.
test('chat pembeli dan penjual, lalu dibaca tim setelah pesanan dilaporkan', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const password = 'rahasia123'
  for (const email of ['demo+pembeli@jaminin.test', 'demo+pemilik@jaminin.test', 'demo+admin@jaminin.test']) await setPassword(email, password)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')
  const b = buyer.page
  const s = seller.page
  const t = cashier.page
  await signIn(b, 'demo+pembeli@jaminin.test', password)
  await signIn(s, 'demo+pemilik@jaminin.test', password)

  const pickupName = await orderAndPay(b, t, { name: 'Matcha Latte', choices: [], price: 'Rp22.000', total: 'Rp23.000' })

  // Pembeli mengirim pesan dari halaman pesanan.
  const chat = b.locator('section', { has: b.getByRole('heading', { name: 'Chat dengan penjual' }) })
  await expect(chat.getByText('Belum ada pesan.')).toBeVisible()
  await chat.getByLabel('Tulis pesan', { exact: true }).fill('Tolong gulanya sedikit saja ya')
  await expect(chat.getByText('Sisa 470 karakter')).toBeVisible()
  await chat.getByRole('button', { name: 'Kirim', exact: true }).click()
  await expect(chat.getByText('Tolong gulanya sedikit saja ya')).toBeVisible()
  await expect(chat.getByLabel('Tulis pesan', { exact: true })).toHaveValue('')
  await noHorizontalScroll(b)

  // Penjual melihat jumlah pesan di kartu pesanan, lalu membalas.
  await openBoard(s)
  const card = s.locator('li', { hasText: pickupName }).first()
  await card.getByRole('button', { name: 'Chat (1)' }).click()
  const dialog = s.getByRole('dialog', { name: `Chat dengan ${pickupName}` })
  await expect(dialog.getByText('Tolong gulanya sedikit saja ya')).toBeVisible()
  await dialog.getByLabel('Tulis pesan', { exact: true }).fill('Siap, gula sedikit.')
  await dialog.getByRole('button', { name: 'Kirim', exact: true }).click()
  await expect(dialog.getByText('Siap, gula sedikit.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Tutup' }).click()

  // Balasan muncul di HP pembeli tanpa memuat ulang halaman.
  await expect(chat.getByText('Siap, gula sedikit.')).toBeVisible({ timeout: 20_000 })
  await expect(chat.getByText(/^Penjual · /)).toBeVisible()

  // Setelah selesai, chat masih terbuka. Pembeli melapor, lalu tim membaca chat sebagai bukti tanpa bisa menulis.
  await card.getByRole('button', { name: 'Mulai siapkan' }).click()
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(b.getByText('Siap diambil').first()).toBeVisible({ timeout: 20_000 })
  b.once('dialog', (d) => void d.accept())
  await b.getByRole('button', { name: 'Sudah saya terima' }).click()
  await expect(b.getByText('Selesai').first()).toBeVisible({ timeout: 20_000 })
  await expect(chat.getByLabel('Tulis pesan', { exact: true })).toBeVisible()

  await b.getByRole('button', { name: 'Laporkan masalah' }).click()
  const report = b.getByRole('dialog', { name: 'Laporkan masalah' })
  await report.getByLabel('Masalahnya', { exact: true }).selectOption({ label: 'Pesanan salah atau kurang' })
  await report.getByLabel('Ceritakan masalahnya', { exact: true }).fill('Gulanya tetap banyak.')
  await report.getByRole('button', { name: 'Kirim laporan' }).click()
  await expect(report.getByText('Laporan terkirim. Tim Jaminin akan membalas di halaman ini.')).toBeVisible()
  await report.getByRole('button', { name: 'Tutup' }).click()

  await signIn(t, 'demo+admin@jaminin.test', password)
  await t.goto('/tim/laporan')
  await t.locator('li', { hasText: 'Gulanya tetap banyak.' }).first().getByRole('button', { name: 'Buka' }).click()
  const evidence = t.getByRole('region', { name: 'Chat pesanan' })
  await expect(evidence.getByText('Tolong gulanya sedikit saja ya')).toBeVisible()
  await expect(evidence.getByText('Siap, gula sedikit.')).toBeVisible()
  await expect(evidence.getByRole('textbox')).toHaveCount(0)
  await noHorizontalScroll(t)

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})
