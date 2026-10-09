import { expect, test, type TestInfo } from '@playwright/test'
import { noHorizontalScroll, openBoard, openContext, orderAndPay, setPassword, signIn } from './bantuan'

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
