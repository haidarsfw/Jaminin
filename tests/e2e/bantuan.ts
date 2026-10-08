import { execSync } from 'node:child_process'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export const BASE_URL = 'http://127.0.0.1:5173'

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
