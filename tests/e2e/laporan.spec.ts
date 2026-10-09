import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { noHorizontalScroll, openContext, setPassword, signIn } from './bantuan'

// P1 nomor 8: laporan penjualan harian, riwayat pesanan, dan unduh rekap CSV pesanan dan setoran.
test('penjual melihat laporan harian dan mengunduh rekap', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Cukup sekali; tata letak tiga ukuran dicek tata-letak.spec.ts.')
  const password = 'rahasia123'
  await setPassword('demo+pemilik@jaminin.test', password)
  const { context, page, errors } = await openContext(browser, 'ipad')
  await signIn(page, 'demo+pemilik@jaminin.test', password)
  await page.goto('/penjual/setoran')
  await page.getByRole('combobox', { name: /^Tenant/ }).selectOption({ label: 'Good Moments Coffee' })
  const report = page.getByRole('region', { name: 'Laporan penjualan' })
  await expect(report.getByText(/pesanan, Rp/).first()).toBeVisible()
  await report.getByRole('tab', { name: '30 hari' }).click()
  await report.locator('summary').first().click()
  await expect(report.getByText('Potongan Jaminin').first()).toBeVisible()
  await noHorizontalScroll(page)

  const [orders] = await Promise.all([page.waitForEvent('download'), report.getByRole('button', { name: 'Unduh rekap pesanan (CSV)' }).click()])
  expect(orders.suggestedFilename()).toMatch(/^rekap-pesanan-good-moments-coffee-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/)
  const ordersCsv = readFileSync((await orders.path())!, 'utf8')
  expect(ordersCsv.startsWith('\uFEFFTanggal,Jam ambil,Nomor,Nama pengambil,Status,Isi pesanan')).toBe(true)
  expect(ordersCsv.split('\r\n').length).toBeGreaterThan(1)

  const [payouts] = await Promise.all([page.waitForEvent('download'), report.getByRole('button', { name: 'Unduh rekap setoran (CSV)' }).click()])
  const payoutsCsv = readFileSync((await payouts.path())!, 'utf8')
  expect(payoutsCsv.startsWith('\uFEFFTanggal,Jumlah pesanan,Penjualan')).toBe(true)

  expect(errors, errors.join('\n')).toEqual([])
  await context.close()
})
