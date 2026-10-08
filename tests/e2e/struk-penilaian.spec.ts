import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openBoard, openContext, orderAndPay, setPassword, signIn } from './bantuan'

// P1 nomor 1: tambah ke kalender, struk digital, dan penilaian sekali yang hanya terlihat oleh penjual dan tim.
test('kalender, struk, dan penilaian setelah pesanan selesai', async ({ browser }, info) => {
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

  const pickupName = await orderAndPay(b, t, { name: 'Roti Mentega', choices: [], price: 'Rp12.000', total: 'Rp13.000' })
  const orderUrl = b.url()

  // Tambah ke kalender: berkas .ics berisi acara jam ambil, dan tautan Google Calendar.
  const downloadPromise = b.waitForEvent('download')
  await b.getByRole('button', { name: 'Tambah ke kalender' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^jaminin-pesanan-\d{3}\.ics$/)
  const ics = readFileSync((await download.path())!, 'utf8')
  expect(ics).toContain('BEGIN:VEVENT')
  expect(ics).toMatch(/SUMMARY:Ambil pesanan #\d{3} di Good Moments Coffee/)
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/)
  await expect(b.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\/calendar\/render\?/)

  // Struk: rincian bisa dibuka, dan saat dicetak hanya struk yang tampil.
  await b.getByRole('link', { name: 'Lihat struk' }).click()
  await expect(b.getByRole('heading', { level: 1, name: /^Struk pesanan #\d{3}$/ })).toBeVisible()
  await expect(b.getByText('Roti Mentega')).toBeVisible()
  await expect(b.getByText('Rp13.000').first()).toBeVisible()
  await expect(b.getByText(pickupName)).toBeVisible()
  await noHorizontalScroll(b)
  await b.emulateMedia({ media: 'print' })
  await expect(b.getByRole('banner')).toBeHidden()
  await expect(b.getByRole('button', { name: 'Unduh atau cetak struk' })).toBeHidden()
  await expect(b.getByRole('heading', { level: 1, name: /^Struk pesanan #\d{3}$/ })).toBeVisible()
  await b.emulateMedia({ media: 'screen' })
  await b.goto(orderUrl)

  // Penjual menyerahkan pesanan; pembeli menilai sekali.
  await openBoard(s)
  const card = s.locator('li', { hasText: pickupName }).first()
  await card.getByRole('button', { name: 'Mulai siapkan' }).click()
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  const code = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  await card.getByRole('button', { name: 'Serahkan' }).click()
  const handover = s.getByRole('dialog')
  await handover.getByLabel('Kode ambil', { exact: true }).fill(code)
  await handover.getByRole('button', { name: 'Serahkan' }).click()
  await expect(handover.getByText(`Pesanan ${pickupName} selesai.`)).toBeVisible()
  await handover.getByRole('button', { name: 'Tutup' }).click()

  const rating = b.locator('section', { has: b.getByRole('heading', { name: 'Beri penilaian' }) })
  await expect(rating).toBeVisible({ timeout: 20_000 })
  await rating.getByRole('button', { name: 'Kirim penilaian' }).click()
  await expect(rating.getByText('Pilih Puas atau Kurang puas dulu.')).toBeVisible()
  await rating.getByRole('button', { name: 'Puas', exact: true }).click()
  await expect(rating.getByRole('button', { name: 'Puas', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await rating.getByLabel('Komentar singkat', { exact: false }).fill('Rotinya hangat dan cepat.')
  await rating.getByRole('button', { name: 'Kirim penilaian' }).click()
  await expect(rating.getByText('Terima kasih. Penilaianmu terkirim ke penjual.')).toBeVisible()
  await expect(rating.getByText('Penilaianmu: Puas')).toBeVisible()
  await expect(rating.getByRole('button', { name: 'Kirim penilaian' })).toHaveCount(0)
  await noHorizontalScroll(b)

  // Penjual melihat penilaian di daftar selesai; tim melihat ringkasan di kartu tenant.
  await s.reload()
  await s.getByText(/^Selesai dan batal/).click()
  await expect(s.getByText('Penilaian pembeli: Puas: Rotinya hangat dan cepat.').first()).toBeVisible()
  await signIn(t, 'demo+admin@jaminin.test', password)
  await t.goto('/tim/penjual')
  await t.getByRole('tab', { name: /^Disetujui/ }).click()
  const tenantCard = t.locator('article', { has: t.getByRole('heading', { name: /Good Moments Coffee/ }) })
  await expect(tenantCard.getByText(/^\d+ puas, \d+ kurang puas$/)).toBeVisible()
  await expect(tenantCard.getByText('Puas: Rotinya hangat dan cepat.').first()).toBeVisible()

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})
