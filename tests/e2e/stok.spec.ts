import { expect, test } from '@playwright/test'
import { openContext, orderAndPay, rest, setPassword, signIn } from './bantuan'

// P1 nomor 4: stok harian. Menu yang stoknya habis untuk hari ini ditandai sebelum masuk keranjang.
test('stok harian habis menandai menu di halaman tenant', async ({ browser }, info) => {
  test.skip(info.project.name !== 'hp', 'Alur lintas perangkat dijalankan sekali saja.')
  const password = 'rahasia123'
  await setPassword('demo+pembeli@jaminin.test', password)
  const filter = '/menu_items?name=eq.Roti%20Mentega'
  const buyer = await openContext(browser, 'hp')
  const cashier = await openContext(browser, 'laptop')
  const b = buyer.page
  try {
    // Catatan stok menu ini hanya diisi uji ini, jadi dikosongkan dulu supaya hasil tidak bergantung pada jalannya uji sebelumnya.
    const [{ id }] = await rest<{ id: string }[]>(`${filter}&select=id`)
    await rest(`/stock_usage?menu_item_id=eq.${id}`, { method: 'PATCH', body: { used: 0 } })
    await rest(filter, { method: 'PATCH', body: { daily_stock: 1 } })
    await signIn(b, 'demo+pembeli@jaminin.test', password)
    await orderAndPay(b, cashier.page, { name: 'Roti Mentega', choices: [], price: 'Rp12.000', total: 'Rp13.000' })

    // Stok hari ini terpakai semua; besok masih ada, jadi menu tetap bisa dibuka untuk dipesan besok.
    await b.goto('/tenant/good-moments-coffee')
    const item = b.getByRole('button', { name: /Roti Mentega/ })
    await expect(item).toContainText('Habis hari ini')
    await expect(item).toBeEnabled()
    await item.click()
    await expect(b.getByRole('dialog', { name: 'Roti Mentega' }).getByRole('status')).toBeVisible()

    // Stok nol berarti habis untuk hari ini dan besok.
    await rest(filter, { method: 'PATCH', body: { daily_stock: 0 } })
    await b.goto('/tenant/good-moments-coffee')
    await expect(b.getByRole('button', { name: /Roti Mentega/ })).toBeDisabled()
    await expect(b.getByRole('button', { name: /Roti Mentega/ })).toContainText('Habis')

    for (const { errors } of [buyer, cashier]) expect(errors, errors.join('\n')).toEqual([])
  } finally {
    await rest(filter, { method: 'PATCH', body: { daily_stock: null } })
    await Promise.all([buyer.context.close(), cashier.context.close()])
  }
})
