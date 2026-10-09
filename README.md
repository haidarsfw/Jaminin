# Jaminin

Aplikasi web untuk memesan makanan dan minuman dari tenant kantin BINUS @Bekasi: pilih jam ambil tiap 5 menit, bayar di muka (simulasi), lalu ambil tanpa antre. Acuan produk ada di `docs/PRD.md`, catatan serah terima di `HANDOFF.md`.

## Yang perlu dipasang

- Node.js 22.12 atau lebih baru (versi LTS dari nodejs.org).
- Git.
- Docker untuk Supabase lokal. Di Mac: Colima lewat Homebrew (`brew install colima docker`). Di Windows: Docker Desktop.

## Menjalankan di laptop

```bash
git clone https://github.com/haidarsfw/Jaminin.git
cd Jaminin
git checkout claude/adoring-brown-y5df83
npm install
```

Nyalakan Docker. Di Mac jalankan `colima start`. Di Windows buka Docker Desktop sampai statusnya berjalan. Lalu:

```bash
npm run db:start
```

Pertama kali, perintah ini mengunduh beberapa GB. Setelah selesai, buat berkas `.env.local` di folder proyek. Isi kuncinya diambil dari keluaran `npx supabase status`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key dari npx supabase status>
```

Tanpa `.env.local`, aplikasi memakai Supabase online dari `.env`.

```bash
npm run demo:lokal
npm run dev
```

`npm run demo:lokal` mengosongkan database lokal, mengisi data contoh, dan memasang sandi akun demo. Setelah `npm run dev`, buka http://localhost:5173.

## Akun demo lokal

Lima akun demo memakai sandi `rahasia123`, hanya di database lokal: `demo+pembeli@jaminin.test`, `demo+pemilik@jaminin.test`, `demo+karyawan@jaminin.test`, `demo+admin@jaminin.test`, dan `demo+staf@jaminin.test`.

Masuk sebagai `demo+admin@jaminin.test`, lalu pakai tombol Mode demo di bagian atas untuk berpindah peran. Simulator Bayar ada di http://localhost:5173/simulator-bayar. Reset demo juga ada di panel Mode demo.

Untuk melihat tampilan HP di laptop, buka DevTools di Chrome (F12, atau Cmd+Option+I di Mac), tekan Toggle device toolbar (Ctrl+Shift+M, atau Cmd+Shift+M di Mac), lalu pilih ukuran 390 x 844.

## Batasan versi lokal

- Notifikasi push dan pasang ke layar utama HP butuh versi online dengan HTTPS. Di versi lokal, kabar tetap muncul di dalam aplikasi.
- HP lain di jaringan yang sama tidak bisa membuka versi lokal, karena Supabase lokal hanya terbuka untuk laptop itu sendiri.

## Perintah lain

- `npm run typecheck`, `npm run lint`, `npm test`: pemeriksaan kode dan uji unit.
- `npm run db:test`: uji database.
- `npm run test:e2e`: uji ujung ke ujung di ukuran HP, iPad, dan laptop.
- `npm run db:stop`, lalu `colima stop` di Mac: mematikan Supabase lokal dan Docker kalau tidak dipakai.
