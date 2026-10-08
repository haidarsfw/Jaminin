import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openContext, signIn } from './bantuan'

// Uji terhadap Supabase cloud lewat playwright.cloud.config.ts. Sandi sementara akun demo hanya dibaca dari
// JAMININ_CLOUD_SANDI dan diacak lagi setelah uji, jadi tidak pernah ditulis di repo.
const sandi = process.env.JAMININ_CLOUD_SANDI ?? ''

// Proxy container cloud Claude tidak meneruskan WebSocket, jadi Realtime gagal di sana dan layar memakai polling cadangan.
// Di laptop atau HP biasa variabel ini tidak diisi, sehingga galat WebSocket tetap dihitung gagal.
const tanpaWebSocket = !!process.env.JAMININ_TANPA_WEBSOCKET
const galatNyata = (errors: string[]) => (tanpaWebSocket ? errors.filter((e) => !/^WebSocket connection to 'wss:/.test(e)) : errors)

test('daftar akun baru di cloud', async ({ browser }) => {
  test.skip(!process.env.JAMININ_CLOUD_DAFTAR, 'Membuat akun sungguhan di cloud, jadi hanya jalan bila JAMININ_CLOUD_DAFTAR diisi.')
  const stamp = Date.now().toString(36)
  const { context, page, errors } = await openContext(browser, 'hp')
  await page.goto('/masuk')
  await page.getByRole('tab', { name: 'Daftar' }).click()
  await page.getByLabel('Email').fill(`uji-cloud+${stamp}@jaminin.test`)
  await page.getByLabel('Kata sandi').fill(`uji-${stamp}-sandi`)
  await page.getByRole('button', { name: 'Buat akun' }).click()
  await expect(page.getByRole('heading', { name: 'Pesan dulu, ambil tanpa antre' })).toBeVisible()
  await page.goto('/lengkapi-profil')
  await expect(page.getByRole('heading', { name: 'Lengkapi profil' })).toBeVisible()
  await page.getByLabel('Nama asli').fill(`Uji Cloud ${stamp}`)
  await page.getByLabel('Nomor WhatsApp').fill('081234567890')
  await page.getByText('Tamu', { exact: true }).click()
  await page.getByRole('button', { name: 'Simpan dan lanjut' }).click()
  await expect(page.getByRole('heading', { name: 'Pesan dulu, ambil tanpa antre' })).toBeVisible()
  expect(galatNyata(errors), errors.join('\n')).toEqual([])
  await context.close()
})

test('pesan, bayar, siapkan, serahkan dengan akun demo', async ({ browser }) => {
  test.skip(!sandi, 'Isi JAMININ_CLOUD_SANDI dengan sandi sementara akun demo pembeli dan pemilik.')
  const stamp = Date.now().toString(36)
  const pickupName = `Uji cloud ${stamp}`

  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')

  const b = buyer.page
  await signIn(b, 'demo+pembeli@jaminin.test', sandi)
  await b.goto('/tenant/good-moments-coffee')
  await b.getByRole('button', { name: /Kopi Susu/ }).click()
  const dialog = b.getByRole('dialog', { name: 'Kopi Susu' })
  await dialog.getByText('Dingin', { exact: true }).click()
  await dialog.getByText('Kurang manis', { exact: true }).click()
  await dialog.getByText('Extra shot', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Tambah ke keranjang, Rp23.000' }).click()
  await b.getByRole('link', { name: /Keranjang \(1\)/ }).click()
  await b.getByRole('link', { name: 'Pilih jam ambil' }).click()

  await expect(b.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  const slot = b.getByRole('radiogroup', { name: 'Jam ambil' }).getByRole('radio').and(b.locator(':enabled')).first()
  await slot.click()
  await b.getByLabel('Nama pengambil').fill(pickupName)
  await noHorizontalScroll(b)
  await b.getByRole('button', { name: 'Bayar Rp24.000' }).click()
  await expect(b.getByRole('heading', { name: 'Bayar pesanan' })).toBeVisible()
  const code = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)

  const c = cashier.page
  await c.goto('/simulator-bayar')
  await c.getByLabel('Kode bayar').fill(code)
  await c.getByRole('button', { name: 'Bayar', exact: true }).click()
  await expect(c.getByText('Pembayaran Rp24.000 diterima.')).toBeVisible()

  await expect(b.getByText('Kode ambil', { exact: true })).toBeVisible({ timeout: 20_000 })
  const pickupCode = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  expect(pickupCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)

  const s = seller.page
  await signIn(s, 'demo+pemilik@jaminin.test', sandi)
  await s.goto('/penjual')
  await s.getByLabel('Tenant').selectOption({ label: 'Good Moments Coffee' })
  await expect(s.getByRole('heading', { name: 'Good Moments Coffee' })).toBeVisible()
  const lihat = s.getByRole('button', { name: 'Lihat' })
  if (await lihat.isVisible()) await lihat.click()
  const card = s.locator('li', { hasText: pickupName }).first()
  await expect(card).toContainText('Kopi Susu')
  await card.getByRole('button', { name: 'Mulai siapkan' }).click()
  await expect(b.getByText('Sedang disiapkan').first()).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(b.getByText('Siap diambil').first()).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Serahkan' }).click()
  const handover = s.getByRole('dialog')
  await handover.getByLabel('Kode ambil').fill(pickupCode)
  await handover.getByRole('button', { name: 'Serahkan' }).click()
  await expect(handover.getByText(`Pesanan ${pickupName} selesai.`)).toBeVisible()
  await expect(b.getByText('Selesai').first()).toBeVisible({ timeout: 20_000 })

  for (const { errors } of [buyer, cashier, seller]) expect(galatNyata(errors), errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})
