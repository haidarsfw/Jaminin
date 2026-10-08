import { execSync } from 'node:child_process'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export const BASE_URL = process.env.JAMININ_URL ?? 'http://127.0.0.1:5173'

export const LAYAR = {
  hp: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 } },
} as const

// Kunci admin hanya dibaca dari Supabase lokal yang sedang berjalan, tidak pernah ditulis di repo.
let cached: { url: string; secret: string } | null = null
function local(): { url: string; secret: string } {
  if (cached) return cached
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
  const get = (key: string) => out.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))?.[1] ?? ''
  cached = { url: get('API_URL'), secret: get('SECRET_KEY') }
  if (!cached.url || !cached.secret) throw new Error('Supabase lokal belum berjalan. Jalankan npm run db:start.')
  return cached
}

async function admin<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { url, secret } = local()
  const res = await fetch(`${url}/auth/v1/admin${path}`, {
    method: init.method ?? 'GET',
    headers: { apikey: secret, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) throw new Error(`admin ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

export async function setPassword(email: string, password: string): Promise<void> {
  const list = await admin<{ users: { id: string; email: string }[] }>('/users?page=1&per_page=200')
  const user = list.users.find((u) => u.email === email)
  if (!user) throw new Error(`akun ${email} tidak ada`)
  await admin(`/users/${user.id}`, { method: 'PUT', body: { password } })
}

export async function rest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { url, secret } = local()
  const res = await fetch(`${url}/rest/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { apikey: secret, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) throw new Error(`rest ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function openContext(browser: Browser, layar: keyof typeof LAYAR): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const context = await browser.newContext({ ...LAYAR[layar], baseURL: BASE_URL, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return { context, page, errors }
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/masuk')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata sandi').fill(password)
  await page.locator('form').getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).not.toHaveURL(/\/masuk/)
}

export async function noHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'halaman tidak boleh bergeser ke samping').toBeLessThanOrEqual(0)
}

// Pembeli memesan satu menu di Good Moments Coffee dan membayar lewat Simulator Bayar; mengembalikan nama pengambil.
export async function orderAndPay(b: Page, cashier: Page, item: { name: string; choices: string[]; price: string; total: string }) {
  const pickupName = `Naskah ${Date.now().toString(36)}`
  await b.goto('/tenant/good-moments-coffee')
  await b.getByRole('button', { name: new RegExp(item.name) }).click()
  const dialog = b.getByRole('dialog', { name: item.name })
  for (const choice of item.choices) await dialog.getByText(choice, { exact: true }).click()
  await dialog.getByRole('button', { name: `Tambah ke keranjang, ${item.price}` }).click()
  await b.getByRole('link', { name: /Keranjang \(1\)/ }).click()
  await b.getByRole('link', { name: 'Pilih jam ambil' }).click()
  await expect(b.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await expect(b.getByText('Biaya layanan')).toBeVisible()
  await expect(b.getByText(/sisa \d+/).first()).toBeVisible()
  await b.getByRole('radiogroup', { name: 'Jam ambil' }).getByRole('radio').and(b.locator(':enabled')).first().click()
  await b.getByLabel('Nama pengambil', { exact: true }).fill(pickupName)
  await b.getByRole('button', { name: `Bayar ${item.total}` }).click()
  await expect(b.getByText('QR simulasi, bukan QRIS').first()).toBeVisible()
  const code = (await b.locator('p.font-mono').first().textContent())?.trim() ?? ''
  await cashier.goto('/simulator-bayar')
  await cashier.getByLabel('Kode bayar', { exact: true }).fill(code)
  await cashier.getByRole('button', { name: 'Bayar', exact: true }).click()
  await expect(cashier.getByText(`Pembayaran ${item.total} diterima.`)).toBeVisible()
  await expect(b.getByText('Kode ambil', { exact: true })).toBeVisible({ timeout: 20_000 })
  return pickupName
}

export async function openBoard(s: Page) {
  await s.goto('/penjual')
  await s.getByRole('combobox', { name: /^Tenant/ }).selectOption({ label: 'Good Moments Coffee' })
  await expect(s.getByRole('heading', { name: 'Good Moments Coffee' })).toBeVisible()
  const lihat = s.getByRole('button', { name: 'Lihat' })
  if (await lihat.isVisible()) await lihat.click()
}
