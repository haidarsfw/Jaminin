import { expect, test } from '@playwright/test'
import { openContext, orderAndPay, rest, setPassword, signIn } from './bantuan'

// P1 nomor 9: jam yang penuh bisa ditunggu dari checkout.
test('pembeli masuk daftar tunggu jam yang penuh', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const password = 'rahasia123'
  await setPassword('demo+pembeli@jaminin.test', password)
  const [{ id: tenantId }] = await rest<{ id: string }[]>('/tenants?slug=eq.good-moments-coffee&select=id')
  // Kuota 1 seharian supaya jam yang baru dipesan langsung penuh.
  const [rule] = await rest<{ id: string }[]>('/tenant_quota_rules', { method: 'POST', body: { tenant_id: tenantId, start_time: '00:00', end_time: '23:55', quota: 1 } })
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const b = buyer.page
  try {
    await signIn(b, 'demo+pembeli@jaminin.test', password)
    await orderAndPay(b, cashier.page, { name: 'Matcha Latte', choices: [], price: 'Rp22.000', total: 'Rp23.000' })

    await b.goto('/tenant/good-moments-coffee')
    await b.getByRole('button', { name: /Americano/ }).click()
    const dialog = b.getByRole('dialog', { name: 'Americano' })
    await dialog.getByText('Dingin', { exact: true }).click()
    await dialog.getByRole('button', { name: /^Tambah ke keranjang/ }).click()
    await b.getByRole('link', { name: /Keranjang \(1\)/ }).click()
    await b.getByRole('link', { name: 'Pilih jam ambil' }).click()

    const waitlist = b.getByRole('group', { name: 'Jam yang kamu mau penuh?' })
    const first = waitlist.getByRole('button').first()
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'false')

    for (const { errors } of [buyer, cashier]) expect(errors, errors.join('\n')).toEqual([])
  } finally {
    await rest(`/tenant_quota_rules?id=eq.${rule.id}`, { method: 'DELETE' })
    await Promise.all([buyer.context.close(), cashier.context.close()])
  }
})
