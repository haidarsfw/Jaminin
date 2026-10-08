import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Alur inti terhadap Supabase cloud. Tanpa JAMININ_URL, build produksi disajikan wrangler dev seperti di Cloudflare.
const served = !process.env.JAMININ_URL
process.env.JAMININ_URL ??= 'http://127.0.0.1:8787'
const url = process.env.JAMININ_URL

export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: /cloud\.spec\.ts/,
  use: { ...base.use, baseURL: url },
  projects: base.projects?.filter((p) => p.name === 'hp'),
  webServer: served
    ? { command: 'npm run build && npx wrangler dev --ip 127.0.0.1 --port 8787', url, reuseExistingServer: true, timeout: 180_000 }
    : undefined,
})
