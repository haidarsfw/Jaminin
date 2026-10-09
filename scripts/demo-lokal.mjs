// Menyiapkan demo di laptop: memasang sandi akun demo di Supabase lokal. Menolak berjalan kalau alamatnya bukan lokal.
import { execSync } from 'node:child_process'

const SANDI = process.env.JAMININ_SANDI_DEMO ?? 'rahasia123'
const PERAN = ['pembeli', 'pemilik', 'karyawan', 'admin', 'staf']

const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
const get = (key) => out.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))?.[1] ?? ''
const url = get('API_URL')
const secret = get('SECRET_KEY')
if (!url || !secret) {
  console.error('Supabase lokal belum berjalan. Nyalakan Docker, lalu jalankan npm run db:start.')
  process.exit(1)
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Alamat ${url} bukan Supabase lokal. Skrip ini hanya untuk laptop.`)
  process.exit(1)
}

const headers = { apikey: secret, 'Content-Type': 'application/json' }
const list = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers })
if (!list.ok) throw new Error(`Gagal membaca akun lokal: ${list.status}`)
const { users } = await list.json()
for (const peran of PERAN) {
  const email = `demo+${peran}@jaminin.test`
  const user = users.find((u) => u.email === email)
  if (!user) {
    console.error(`Akun ${email} tidak ada. Jalankan npm run db:reset dulu.`)
    process.exit(1)
  }
  const res = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: 'PUT', headers, body: JSON.stringify({ password: SANDI }) })
  if (!res.ok) throw new Error(`Gagal memasang sandi ${email}: ${res.status}`)
}
console.log(`Akun demo siap. Buka http://localhost:5173/masuk, masuk dengan demo+admin@jaminin.test dan sandi ${SANDI}, lalu pindah peran lewat tombol Mode demo.`)
