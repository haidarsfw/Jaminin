import { expect, test } from '@playwright/test'
import { longDate, tomorrowWib } from '../../src/lib/format'
import { noHorizontalScroll, openContext, setPassword, signIn } from './bantuan'

// Libur mendadak membatalkan pesanan lunas dengan uang kembali penuh, lalu tim menangguhkan dan mengaktifkan lagi tenant.
test('libur membatalkan pesanan lunas, tim menangguhkan tenant', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const password = 'rahasia123'
  const pickupName = `Libur ${Date.now().toString(36)}`
  const tomorrow = tomorrowWib()
  for (const email of ['demo+pembeli@jaminin.test', 'demo+pemilik@jaminin.test', 'demo+admin@jaminin.test']) await setPassword(email, password)

  const buyer = await openContext(browser, 'hp')
  const team = await openContext(browser, 'laptop')
  const seller = await openContext(browser, 'ipad')

  // Pembeli memesan Roti Mentega untuk besok dan membayar lewat Simulator Bayar.
  const b = buyer.page
  await signIn(b, 'demo+pembeli@jaminin.test', password)
  await b.goto('/tenant/good-moments-coffee')
  await b.getByRole('button', { name: /Roti Mentega/ }).click()
  await b.getByRole('dialog', { name: 'Roti Mentega' }).getByRole('button', { name: 'Tambah ke keranjang, Rp12.000' }).click()
  await b.getByRole('link', { name: /Keranjang \(1\)/ }).click()
  await b.getByRole('link', { name: 'Pilih jam ambil' }).click()
  await expect(b.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await b.getByRole('tab', { name: 'Besok' }).click()
  await b.getByRole('radiogroup', { name: 'Jam ambil' }).getByRole('radio').and(b.locator(':enabled')).first().click()
  await b.getByLabel('Nama pengambil').fill(pickupName)
  await b.getByRole('button', { name: 'Bayar Rp13.000' }).click()
  const code = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  const t = team.page
  await t.goto('/simulator-bayar')
  await t.getByLabel('Kode bayar').fill(code)
  await t.getByRole('button', { name: 'Bayar', exact: true }).click()
  await expect(t.getByText('Pembayaran Rp13.000 diterima.')).toBeVisible()
  await expect(b.getByText('Kode ambil', { exact: true })).toBeVisible({ timeout: 20_000 })

  // Pemilik menyimpan libur besok; aplikasi menyebut satu pesanan lunas yang akan dibatalkan.
  const s = seller.page
  await signIn(s, 'demo+pemilik@jaminin.test', password)
  await s.goto('/penjual')
  await s.getByLabel('Tenant').selectOption({ label: 'Good Moments Coffee' })
  await s.goto('/penjual/toko')
  const card = s.locator('section', { has: s.getByRole('heading', { name: 'Libur dan jam khusus' }) })
  await card.getByLabel('Tanggal').fill(tomorrow)
  await card.getByText('Libur seharian', { exact: true }).click()
  await card.getByRole('button', { name: 'Simpan', exact: true }).click()
  const confirm = s.getByRole('dialog', { name: 'Pesanan akan dibatalkan' })
  // Uji lain bisa sudah membuat pesanan untuk besok, jadi jumlahnya cukup minimal satu.
  await expect(confirm).toContainText(/\d+ pesanan lunas/)
  await confirm.getByRole('button', { name: 'Simpan dan batalkan pesanan' }).click()
  await expect(card.getByText(/^Tersimpan\. \d+ pesanan dibatalkan dengan uang kembali penuh\.$/)).toBeVisible()
  await expect(card.getByText(longDate(tomorrow, 'id'))).toBeVisible()
  await noHorizontalScroll(s)

  // Pesanan pembeli batal dengan alasan libur, uang kembali penuh tercatat, dan kabarnya masuk.
  await expect(b.getByText('Tenant libur').first()).toBeVisible({ timeout: 20_000 })
  await expect(b.getByText('Rp13.000: Tenant libur')).toBeVisible()
  await b.goto('/kabar')
  await expect(b.getByText(/^Pesanan #\d{3} dibatalkan$/).first()).toBeVisible()

  // Libur dihapus lagi supaya data lokal kembali seperti semula.
  await card.getByRole('button', { name: `Hapus pengaturan ${longDate(tomorrow, 'id')}` }).click()
  await expect(card.getByText('Belum ada libur atau jam khusus.')).toBeVisible()

  // Tim menangguhkan Rustic Grill BBQ: tenant hilang dari beranda, lalu diaktifkan lagi.
  await signIn(t, 'demo+admin@jaminin.test', password)
  await t.goto('/tim/penjual')
  await t.getByRole('tab', { name: /^Disetujui/ }).click()
  const rustic = t.locator('article', { has: t.getByRole('heading', { name: /Rustic Grill BBQ/ }) })
  await rustic.getByRole('button', { name: 'Tangguhkan' }).click()
  const dialog = t.getByRole('dialog', { name: 'Tangguhkan Rustic Grill BBQ' })
  await dialog.getByLabel('Alasan penangguhan').fill('Uji penangguhan')
  await dialog.getByRole('button', { name: 'Tangguhkan tenant' }).click()
  await expect(dialog).toBeHidden()
  await b.goto('/')
  // Tenant favorit juga tampil di bagian atas beranda, jadi pemeriksaan dibatasi ke daftar tenant.
  const list = b.getByRole('region', { name: 'Tenant' })
  await expect(list.getByRole('heading', { name: 'Good Moments Coffee' })).toBeVisible()
  await expect(list.getByRole('heading', { name: 'Rustic Grill BBQ' })).toHaveCount(0)
  await t.getByRole('tab', { name: /^Ditangguhkan/ }).click()
  await rustic.getByRole('button', { name: 'Aktifkan lagi' }).click()
  await t.getByRole('tab', { name: /^Disetujui/ }).click()
  await expect(rustic).toBeVisible()
  await b.reload()
  await expect(b.getByRole('heading', { name: 'Rustic Grill BBQ' })).toBeVisible()

  for (const { errors } of [buyer, team, seller]) expect(errors, errors.join('\n')).toEqual([])
  await Promise.all([buyer.context.close(), team.context.close(), seller.context.close()])
})
