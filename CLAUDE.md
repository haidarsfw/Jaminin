# Jaminin

Aplikasi web untuk memesan makanan dan minuman dari tenant kantin BINUS @Bekasi: pilih jam ambil tiap 5 menit, bayar di muka, ambil sendiri tanpa antre. Proyek Kelompok 2 (Haidar Shofwan Bani, Abdul Azis, Dafi Ardian Pasha, Muhammad Evan Maulana Rifqi). Demo prototipe: Senin, 12 Oktober 2026.

Acuan utama: `docs/PRD.md`. Kalau ada yang tidak tercakup PRD, tanyakan ke Haidar.

## Status

- Tahap A (PRD, panduan akun, file ini): selesai, menunggu review Haidar.
- Tahap B (membangun prototipe): baru dimulai setelah Haidar menyatakan PRD disetujui.

## Aturan kerja

1. Selalu bertanya, jangan berasumsi, sekecil apa pun. Pakai pertanyaan pilihan dengan rekomendasi di urutan pertama. Keputusan kecil yang terpaksa diambil ditandai "Usulan, perlu persetujuan" di dokumen.
2. Bahasa percakapan dan dokumen: Indonesia. Pesan commit: Indonesia.
3. Plan file dan dokumen ditulis dengan kalimat utuh, tidak dalam gaya "caveman".
4. Semua layanan harus gratis, kecuali domain. Tanyakan dulu sebelum menambah layanan apa pun yang berbayar atau bisa menimbulkan tagihan.
5. Fungsi lebih dulu dengan tampilan rapi dan sederhana. Haidar sendiri yang memoles tampilan setelah semua fungsi benar. Tampilan ditandai "Draf tampilan".
6. Prioritas: P0 wajib sempurna sebelum P1 dikerjakan. Urutan P1 ada di `docs/PRD.md` bagian 22.
7. HP lebih dulu, lalu iPad, lalu laptop, dengan kenyamanan yang sama di ketiganya.
8. Commit sesering mungkin setelah setiap bagian selesai, karena container sesi bisa dimulai ulang.

## Skill

- Skill antislop (`antislop`, `antislop-copywriting`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `antislop-code`) dipakai otomatis sesuai jenis pekerjaan, tanpa bertanya mode. Laporan PASS/FAIL Delivery Gate hanya ditampilkan untuk hasil website, aplikasi, atau UI.
- Skill desain dipakai bersamaan. Kalau bertentangan, urutan yang menang: antislop, lalu `impeccable`, lalu `design-taste-frontend` (taste-skill), lalu `frontend-design`. `redesign-existing-projects` dipakai saat tampilan dirombak.
- Database dan Supabase: `supabase` dan `supabase-postgres-best-practices`.
- React: `vercel-react-best-practices` dan `vercel-composition-patterns`. Tinjauan UI: `web-design-guidelines`.
- Hosting Cloudflare: `cloudflare`, `wrangler`, `workers-best-practices`.
- Uji di browser: `webapp-testing` (butuh paket Python `playwright`; Chromium tersedia di `/opt/pw-browsers`).
- Dokumentasi pustaka: Context7 lewat `npx ctx7@latest library` dan `npx ctx7@latest docs` (aturan di `.claude/rules/context7.md`). Jangan mengandalkan ingatan untuk API pustaka.
- Daftar sumber dan hash skill ada di `skills-lock.json`.

## Rahasia dan akun

- Tidak ada kunci rahasia di repo atau di kode aplikasi: service role atau secret key Supabase, kunci VAPID privat, Sandi Aplikasi Gmail, Client Secret Google, token, dan API key.
- Konfigurasi publik (URL Supabase, publishable key, kunci VAPID publik, DSN Sentry) boleh di-commit di file env.
- Jangan pernah meminta pengguna menempel kunci di chat. Rahasia disimpan sebagai rahasia lingkungan sesi cloud: `CONTEXT7_API_KEY`, dan kalau konektor Supabase tidak tersedia, `SUPABASE_ACCESS_TOKEN` serta `SUPABASE_DB_PASSWORD`.
- Semua akun layanan dimiliki Gmail khusus Jaminin. Panduannya di `docs/PANDUAN-AKUN.md`.
- Email pribadi tidak ditulis di repo. Admin pertama dipasang lewat perintah sekali jalan di database.

## GitHub

- Branch kerja dan branch utama: `claude/adoring-brown-y5df83`. Tidak membuat Pull Request kecuali diminta.
- Push: `git push -u origin claude/adoring-brown-y5df83`, ulangi dengan jeda 2, 4, 8, 16 detik kalau gagal karena jaringan.
- Di container cloud, `GH_TOKEN` dan `GITHUB_TOKEN` ditolak API publik GitHub. Untuk mengunduh dari GitHub publik, jalankan perintah tanpa variabel itu, contoh `env -u GH_TOKEN -u GITHUB_TOKEN <perintah>`.

## Techstack

Ringkasan, rinciannya di `docs/PRD.md` bagian 16: Vite 8, React 19, TypeScript 6.0.3 (bukan 7, karena typescript-eslint belum mendukung), TanStack Router dan Query, Tailwind CSS 4, vite-plugin-pwa, i18next, date-fns dengan zona Asia/Jakarta, zod, Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron, pg_net), Web Push dengan VAPID, Sentry, hosting Cloudflare Workers Static Assets. Uji: Vitest, pgTAP, Playwright.

## Aturan domain yang paling mudah salah

- Semua aturan jam memakai WIB. Jam ambil tiap 5 menit, hanya hari ini atau besok.
- Jam tercepat = sekarang + 5 menit batas bayar + batas waktu pesan penjual + lama menyiapkan menu terlama, dibulatkan ke kelipatan 5 menit berikutnya.
- Kuota per pesanan per jam ambil, dikunci di database saat pesanan dibuat.
- Status lunas hanya diubah oleh server lewat Edge Function, tidak pernah oleh pembeli atau penjual.
- Uang dalam rupiah bulat. Biaya layanan Rp1.000 dari pembeli, potongan Rp1.000 dari penjual, keduanya tidak berlaku untuk pesanan batal.

## Menjalankan proyek

Kode aplikasi belum ada. Perintah ini berlaku setelah Tahap B dimulai:

- `npm install`, lalu `npm run dev`, buka http://localhost:5173.
- Uji unit: `npm test`. Uji ujung ke ujung: `npm run test:e2e`. Uji database: `supabase test db`.
