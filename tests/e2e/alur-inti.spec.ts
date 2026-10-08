import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openContext, setPassword, signIn } from './bantuan'

// Naskah inti demo: pembeli di HP, Simulator Bayar di laptop, penjual di iPad.
test('pesan, bayar, siapkan, serahkan', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const stamp = Date.now().toString(36)
  const buyerEmail = `e2e+${stamp}@jaminin.test`
  const password = 'rahasia123'
  const buyerName = `Pembeli ${stamp}`

  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')

  // Pembeli mendaftar dengan email dan kata sandi.
  const b = buyer.page
  await b.goto('/masuk')
  await b.getByRole('tab', { name: 'Daftar' }).click()
  await b.getByLabel('Email').fill(buyerEmail)
  await b.getByLabel('Kata sandi').fill(password)
  await b.getByRole('button', { name: 'Buat akun' }).click()
  await expect(b.getByRole('heading', { name: 'Pesan dulu, ambil tanpa antre' })).toBeVisible()
  await noHorizontalScroll(b)

  // Memilih Kopi Susu dengan pilihan wajib dan tambahan berbayar.
  await b.goto('/tenant/good-moments-coffee')
  await b.getByRole('button', { name: /Kopi Susu/ }).click()
  const dialog = b.getByRole('dialog', { name: 'Kopi Susu' })
  await dialog.getByRole('button', { name: /Tambah ke keranjang/ }).click()
  await expect(dialog.getByText('Pilih Suhu dulu.')).toBeVisible()
  await dialog.getByText('Dingin', { exact: true }).click()
  await dialog.getByText('Kurang manis', { exact: true }).click()
  await dialog.getByText('Extra shot', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Tambah ke keranjang, Rp23.000' }).click()
  await b.getByRole('link', { name: /Keranjang \(1\)/ }).click()
  await expect(b.getByText('Rp23.000').first()).toBeVisible()
  await b.getByRole('link', { name: 'Pilih jam ambil' }).click()

  // Profil diisi sekali sebelum pesanan pertama.
  await expect(b.getByRole('heading', { name: 'Lengkapi profil' })).toBeVisible()
  await b.getByLabel('Nama asli').fill(buyerName)
  await b.getByLabel('Nomor WhatsApp').fill('081234567890')
  await b.getByText('Mahasiswa', { exact: true }).click()
  await b.getByRole('button', { name: 'Simpan dan lanjut' }).click()

  // Checkout: jam pertama yang tersedia, lalu bayar.
  await expect(b.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  const slot = b.getByRole('radiogroup', { name: 'Jam ambil' }).getByRole('radio').and(b.locator(':enabled')).first()
  await slot.click()
  const slotLabel = (await slot.locator('span').first().textContent())?.trim() ?? ''
  await noHorizontalScroll(b)
  await b.getByRole('button', { name: 'Bayar Rp24.000' }).click()
  await expect(b.getByRole('heading', { name: 'Bayar pesanan' })).toBeVisible()
  const code = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)

  // Simulator Bayar di laptop menerima kode bayar tanpa masuk.
  const c = cashier.page
  await c.goto('/simulator-bayar')
  await c.getByLabel('Kode bayar').fill(code)
  await c.getByRole('button', { name: 'Bayar', exact: true }).click()
  await expect(c.getByText('Pembayaran Rp24.000 diterima.')).toBeVisible()

  // Halaman pembeli pindah sendiri ke status pesanan dengan kode ambil.
  await expect(b.getByText('Kode ambil', { exact: true })).toBeVisible({ timeout: 20_000 })
  const pickupCode = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  expect(pickupCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)
  await expect(b.getByText('Diterima').first()).toBeVisible()
  await noHorizontalScroll(b)

  // Penjual (pemilik demo) melihat pesanan di papan, menyiapkan, lalu menyerahkan.
  await setPassword('demo+pemilik@jaminin.test', password)
  const s = seller.page
  await signIn(s, 'demo+pemilik@jaminin.test', password)
  await s.goto('/penjual')
  await s.getByLabel('Tenant').selectOption({ label: 'Good Moments Coffee' })
  await expect(s.getByRole('heading', { name: 'Good Moments Coffee' })).toBeVisible()
  await expect(s.getByText(/^\d+ pesanan baru$/)).toBeVisible()
  await s.getByRole('button', { name: 'Lihat' }).click()
  const card = s.locator('li', { hasText: buyerName }).first()
  await expect(card).toContainText('Kopi Susu')
  await expect(s.getByRole('heading', { level: 2, name: new RegExp(`^${slotLabel.replace('.', '\\.')}`) })).toBeVisible()
  await card.getByRole('button', { name: 'Mulai siapkan' }).click()
  await expect(b.getByText('Sedang disiapkan').first()).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(b.getByText('Siap diambil').first()).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Serahkan' }).click()
  const handover = s.getByRole('dialog')
  await handover.getByLabel('Kode ambil').fill(pickupCode)
  await handover.getByRole('button', { name: 'Serahkan' }).click()
  await expect(handover.getByText(`Pesanan ${buyerName} selesai.`)).toBeVisible()
  await noHorizontalScroll(s)

  // Pembeli melihat pesanan selesai tanpa memuat ulang.
  await expect(b.getByText('Selesai').first()).toBeVisible({ timeout: 20_000 })

  // Kabar pesanan juga tersimpan di aplikasi, dengan jumlah yang belum dibaca di header.
  const kabarLink = b.getByRole('banner').getByRole('link', { name: /^Kabar, \d+ belum dibaca$/ })
  await expect(kabarLink).toBeVisible({ timeout: 20_000 })
  await kabarLink.click()
  await expect(b.getByRole('heading', { level: 1, name: 'Kabar' })).toBeVisible()
  await expect(b.getByText(/^Pesanan #\d{3} siap diambil$/).first()).toBeVisible()
  await expect(b.getByText(/^Pesanan #\d{3} mulai disiapkan$/).first()).toBeVisible()
  await noHorizontalScroll(b)
  await b.getByRole('button', { name: 'Tandai semua dibaca' }).click()
  await expect(b.getByRole('banner').getByRole('link', { name: 'Kabar', exact: true })).toBeVisible()

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})
