import { expect, test, type TestInfo } from '@playwright/test'
import { noHorizontalScroll, openBoard, openContext, orderAndPay, setPassword, signIn } from './bantuan'

// Bagian naskah demo PRD bagian 18 yang tidak dicakup alur-inti.spec.ts: menu habis, batal, laporan,
// uang kembali manual, persetujuan penjual baru, panel demo, bahasa Inggris, dan tema gelap.
const SANDI = 'rahasia123'

test.describe.configure({ mode: 'serial' })

// Naskah lintas perangkat dijalankan sekali saja, di proyek HP.
async function setup(info: TestInfo) {
  test.skip(info.project.name !== 'hp', 'Naskah lintas perangkat dijalankan sekali saja.')
  for (const email of ['demo+pembeli@jaminin.test', 'demo+pemilik@jaminin.test', 'demo+admin@jaminin.test']) await setPassword(email, SANDI)
}

test('menu habis: penjual menandai, pembeli memilih pengganti, selisihnya kembali', async ({ browser }, info) => {
  await setup(info)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')
  const b = buyer.page
  const s = seller.page
  await signIn(b, 'demo+pembeli@jaminin.test', SANDI)
  await signIn(s, 'demo+pemilik@jaminin.test', SANDI)

  const pickupName = await orderAndPay(b, cashier.page, { name: 'Kopi Susu', choices: ['Dingin', 'Normal'], price: 'Rp18.000', total: 'Rp19.000' })
  await openBoard(s)
  const card = s.locator('li', { hasText: pickupName }).first()
  s.once('dialog', (d) => void d.accept())
  await card.getByRole('button', { name: 'Tandai habis' }).click()
  await expect(card.getByText('Menunggu pilihan pembeli', { exact: true })).toBeVisible({ timeout: 20_000 })

  await expect(b.getByText('Ada menu yang habis').first()).toBeVisible({ timeout: 20_000 })
  await b.getByRole('button', { name: 'Ganti menu' }).click()
  const replace = b.getByRole('dialog', { name: 'Pilih menu pengganti' })
  await expect(replace.getByText('Pengganti harus sama atau lebih murah dari Rp18.000. Selisihnya dikembalikan.')).toBeVisible()
  await expect(replace.getByRole('button', { name: /Matcha Latte/ })).toHaveCount(0)
  await replace.getByRole('button', { name: /Americano/ }).click()
  await expect(replace).toBeHidden()
  await expect(b.getByText('Rp3.000: Selisih harga menu pengganti')).toBeVisible({ timeout: 20_000 })
  await expect(b.getByText('Americano').first()).toBeVisible()
  await noHorizontalScroll(b)

  await expect(card).toContainText('Americano', { timeout: 20_000 })
  await expect(card.getByRole('button', { name: 'Mulai siapkan' })).toBeVisible()

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})

test('batal sebelum disiapkan: uang kembali penuh termasuk biaya layanan', async ({ browser }, info) => {
  await setup(info)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const b = buyer.page
  await signIn(b, 'demo+pembeli@jaminin.test', SANDI)

  await orderAndPay(b, cashier.page, { name: 'Roti Mentega', choices: [], price: 'Rp12.000', total: 'Rp13.000' })
  b.once('dialog', (d) => {
    expect(d.message()).toBe('Batalkan pesanan? Uangmu kembali penuh.')
    void d.accept()
  })
  await b.getByRole('button', { name: 'Batalkan pesanan' }).click()
  await expect(b.getByText('Dibatalkan pembeli').first()).toBeVisible({ timeout: 20_000 })
  await expect(b.getByText('Rp13.000: Dibatalkan pembeli')).toBeVisible()
  const refundRow = b.locator('dl div', { hasText: 'Uang kembali' })
  await expect(refundRow).toContainText('Rp13.000')

  for (const { errors } of [buyer, cashier]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close()])
})

test('laporan pembeli dibalas tim dengan uang kembali sebagian dari tenant', async ({ browser }, info) => {
  await setup(info)
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')
  const b = buyer.page
  const s = seller.page
  const t = cashier.page
  await signIn(b, 'demo+pembeli@jaminin.test', SANDI)
  await signIn(s, 'demo+pemilik@jaminin.test', SANDI)

  const pickupName = await orderAndPay(b, t, { name: 'Matcha Latte', choices: [], price: 'Rp22.000', total: 'Rp23.000' })
  await openBoard(s)
  const card = s.locator('li', { hasText: pickupName }).first()
  await card.getByRole('button', { name: 'Mulai siapkan' }).click()
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(b.getByText('Siap diambil').first()).toBeVisible({ timeout: 20_000 })
  b.once('dialog', (d) => void d.accept())
  await b.getByRole('button', { name: 'Sudah saya terima' }).click()
  await expect(b.getByText('Selesai').first()).toBeVisible({ timeout: 20_000 })

  await b.getByRole('button', { name: 'Laporkan masalah' }).click()
  const report = b.getByRole('dialog', { name: 'Laporkan masalah' })
  await report.getByLabel('Masalahnya', { exact: true }).selectOption({ label: 'Pesanan salah atau kurang' })
  await report.getByLabel('Ceritakan masalahnya', { exact: true }).fill('Matcha latte datang tanpa es.')
  await report.getByRole('button', { name: 'Kirim laporan' }).click()
  await expect(report.getByText('Laporan terkirim. Tim Jaminin akan membalas di halaman ini.')).toBeVisible()
  await report.getByRole('button', { name: 'Tutup' }).click()

  await signIn(t, 'demo+admin@jaminin.test', SANDI)
  await t.goto('/tim/laporan')
  const row = t.locator('li', { hasText: 'Matcha latte datang tanpa es.' }).first()
  await row.getByRole('button', { name: 'Buka' }).click()
  await t.getByRole('textbox', { name: 'Balasan untuk pembeli' }).fill('Maaf, kami kembalikan Rp5.000.')
  await t.getByRole('button', { name: 'Kirim balasan' }).click()
  await expect(t.getByText('Balasan tersimpan dan pembeli diberi kabar.')).toBeVisible()
  await t.getByRole('button', { name: 'Uang kembali' }).click()
  const refund = t.getByRole('dialog', { name: /^Uang kembali pesanan #\d{3}$/ })
  await refund.getByText('Sebagian', { exact: true }).click()
  await refund.getByLabel('Jumlah uang kembali (Rp)', { exact: true }).fill('5000')
  await refund.getByText('Tenant, dipotong dari setoran', { exact: true }).click()
  await refund.getByLabel('Alasan', { exact: true }).fill('Minuman tidak sesuai pesanan')
  await refund.getByRole('button', { name: 'Kirim uang kembali' }).click()
  await expect(t.getByText('Uang kembali tercatat dan pembeli diberi kabar.')).toBeVisible()
  await noHorizontalScroll(t)

  await b.reload()
  await expect(b.getByText('Maaf, kami kembalikan Rp5.000.')).toBeVisible()
  await expect(b.getByText('Rp5.000: Uang kembali dari tim Jaminin')).toBeVisible()
  await b.goto('/kabar')
  await expect(b.getByText('Uang kembali Rp5.000').first()).toBeVisible()
  await expect(b.getByText('Laporanmu dibalas').first()).toBeVisible()

  for (const { errors } of [buyer, cashier, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), cashier.context.close(), seller.context.close()])
})

test('penjual baru mendaftar lalu disetujui tim', async ({ browser }, info) => {
  await setup(info)
  const stamp = Date.now().toString(36)
  const tenantName = `Warung Uji ${stamp}`
  const owner = await openContext(browser, 'hp')
  const team = await openContext(browser, 'laptop')
  const o = owner.page

  await o.goto('/masuk')
  await o.getByRole('tab', { name: 'Daftar' }).click()
  await o.getByLabel('Email', { exact: true }).fill(`penjual+${stamp}@jaminin.test`)
  await o.getByLabel('Kata sandi', { exact: true }).fill(SANDI)
  await o.getByRole('button', { name: 'Buat akun' }).click()
  await expect(o.getByRole('heading', { name: 'Pesan dulu, ambil tanpa antre' })).toBeVisible()
  await o.goto('/penjual/daftar')
  await expect(o.getByRole('heading', { name: 'Lengkapi profil' })).toBeVisible()
  await o.getByLabel('Nama asli', { exact: true }).fill(`Pemilik ${stamp}`)
  await o.getByLabel('Nomor WhatsApp', { exact: true }).fill('081298765432')
  await o.getByText('Pekerja kantin', { exact: true }).click()
  await o.getByRole('button', { name: 'Simpan dan lanjut' }).click()

  await expect(o.getByRole('heading', { name: 'Daftarkan tenant' })).toBeVisible()
  await o.getByLabel('Nama tenant', { exact: true }).fill(tenantName)
  await o.getByLabel('Lokasi kios', { exact: true }).fill('Kantin lantai 1, kios 9')
  await o.getByLabel('Nama penanggung jawab', { exact: true }).fill(`Pemilik ${stamp}`)
  await o.getByLabel('WhatsApp tenant', { exact: true }).fill('081298765432')
  await o.getByText('Makanan', { exact: true }).click()
  await o.getByRole('button', { name: 'Kirim pendaftaran' }).click()
  await expect(o.getByLabel('Kuota per jam ambil', { exact: true })).toBeFocused()
  await o.getByLabel('Kuota per jam ambil', { exact: true }).fill('3')
  await o.getByLabel('Nama menu 1', { exact: true }).fill('Nasi Uduk')
  await o.getByLabel('Harga menu 1', { exact: true }).fill('15000')
  await o.getByLabel('Lama menyiapkan menu 1', { exact: true }).fill('7')
  await o.getByLabel('Nama bank', { exact: true }).fill('BCA')
  await o.getByLabel('Nomor rekening', { exact: true }).fill('1234567890')
  await o.getByLabel('Nama pemilik rekening', { exact: true }).fill(`Pemilik ${stamp}`)
  await o.getByText('Saya sudah membaca dan menyetujui syarat penjual', { exact: true }).click()
  await noHorizontalScroll(o)
  await o.getByRole('button', { name: 'Kirim pendaftaran' }).click()
  await expect(o.getByText(tenantName).first()).toBeVisible({ timeout: 20_000 })

  const t = team.page
  await signIn(t, 'demo+admin@jaminin.test', SANDI)
  await t.goto('/tim/penjual')
  const card = t.locator('article', { has: t.getByRole('heading', { name: tenantName }) })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Setujui' }).click()
  await t.getByRole('tab', { name: /^Disetujui/ }).click()
  await expect(t.locator('article', { has: t.getByRole('heading', { name: tenantName }) })).toBeVisible()

  await o.goto('/kabar')
  await expect(o.getByText('Pendaftaran disetujui').first()).toBeVisible({ timeout: 20_000 })
  await o.goto('/')
  await expect(o.getByRole('heading', { name: tenantName })).toBeVisible()

  for (const { errors } of [owner, team]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([owner.context.close(), team.context.close()])
})

test('panel demo: admin pindah ke pemilik lalu kembali', async ({ browser }, info) => {
  await setup(info)
  const laptop = await openContext(browser, 'laptop')
  const p = laptop.page
  await signIn(p, 'demo+admin@jaminin.test', SANDI)
  await p.goto('/tim')
  await p.getByRole('button', { name: 'Mode demo' }).click()
  await p.getByRole('dialog', { name: 'Mode demo' }).getByRole('button', { name: 'Pemilik tenant (demo)' }).click()
  await expect(p).toHaveURL(/\/penjual$/, { timeout: 20_000 })
  await p.goto('/profil')
  await expect(p.getByText('Ini akun demo. Datanya bisa di-reset kapan saja.')).toBeVisible()
  await p.getByRole('button', { name: 'Mode demo' }).click()
  await p.getByRole('dialog', { name: 'Mode demo' }).getByRole('button', { name: 'Admin Jaminin (demo)' }).click()
  await expect(p).toHaveURL(/\/tim$/, { timeout: 20_000 })
  expect(laptop.errors, laptop.errors.join('\n')).toEqual([])
  await laptop.context.close()
})

test('bahasa Inggris dan tema gelap', async ({ browser }, info) => {
  await setup(info)
  const phone = await openContext(browser, 'hp')
  const p = phone.page
  await signIn(p, 'demo+pembeli@jaminin.test', SANDI)
  await p.goto('/profil')
  await p.getByText('English', { exact: true }).click()
  await expect(p.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()
  await p.getByText('Dark', { exact: true }).click()
  await expect(p.locator('html')).toHaveAttribute('data-theme', 'dark')
  await p.goto('/')
  await expect(p.getByRole('heading', { level: 1 })).not.toHaveText('Pesan dulu, ambil tanpa antre')
  await noHorizontalScroll(p)
  await p.goto('/profil')
  await p.getByText('Bahasa Indonesia', { exact: true }).click()
  await p.getByText('Ikuti perangkat', { exact: true }).click()
  await expect(p.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()
  expect(phone.errors, phone.errors.join('\n')).toEqual([])
  await phone.context.close()
})
