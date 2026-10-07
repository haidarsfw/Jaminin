# Panduan Membuat Akun Layanan Jaminin

Untuk Haidar. Dikerjakan sambil membaca PRD, supaya pembangunan bisa langsung dimulai begitu PRD disetujui.

Semua layanan di bawah ini gratis. Kerjakan berurutan, karena beberapa langkah memakai hasil langkah sebelumnya.

## Aturan rahasia

Ada dua jenis data di panduan ini:

- **Rahasia**: kata sandi database, Sandi Aplikasi Gmail, Client Secret Google, secret key atau service_role key Supabase, token, dan API key. Jangan pernah ditempel di chat atau dikirim lewat pesan. Simpan di pengelola kata sandi atau catatan pribadi. Kalau saya membutuhkannya, simpan sebagai rahasia lingkungan (langkah 7).
- **Boleh dibagikan**: alamat Gmail khusus Jaminin, Project URL Supabase, publishable key Supabase, dan DSN Sentry. Data ini memang ikut tampil di aplikasi, jadi aman dikirim di chat kalau konektor belum tersambung.

## Langkah 1: Gmail khusus Jaminin

Gmail ini menjadi pemilik semua akun layanan dan juga pengirim email lupa kata sandi.

1. Buat akun Google baru di https://accounts.google.com/signup. Namanya bebas, misalnya yang mengandung kata jaminin.
2. Nyalakan Verifikasi 2 Langkah: buka https://myaccount.google.com, pilih Keamanan, lalu Verifikasi 2 Langkah, dan ikuti langkahnya.
3. Buat Sandi Aplikasi di https://myaccount.google.com/apppasswords. Beri nama "Supabase Jaminin". Google menampilkan sandi 16 huruf. Simpan sandi itu (rahasia). Menu ini baru muncul setelah Verifikasi 2 Langkah aktif.

## Langkah 2: Supabase (database dan login)

1. Daftar di https://supabase.com memakai Gmail khusus Jaminin.
2. Buat organisasi dengan paket Free.
3. Buat proyek baru:
   - Name: `jaminin`
   - Database Password: buat yang kuat dan simpan (rahasia).
   - Region: Southeast Asia (Singapore).
4. Tunggu sampai proyek selesai disiapkan.
5. Matikan konfirmasi email: menu Authentication, lalu Sign In / Providers. Pastikan Email aktif, lalu matikan pilihan "Confirm email". Simpan.
6. Atur pengirim email lupa kata sandi: menu Authentication, lalu Emails, bagian SMTP Settings. Nyalakan custom SMTP, lalu isi:
   - Sender email: Gmail khusus Jaminin
   - Sender name: Jaminin
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: Gmail khusus Jaminin
   - Password: Sandi Aplikasi dari langkah 1 (bukan kata sandi Gmail biasa)
7. Atur alamat aplikasi: menu Authentication, lalu URL Configuration.
   - Site URL: `http://localhost:5173`
   - Redirect URLs: tambahkan `http://localhost:5173/**`
   - Alamat Cloudflare ditambahkan nanti saat deploy.
8. Salin Callback URL untuk login Google: menu Authentication, lalu Sign In / Providers, buka Google. Salin Callback URL yang bentuknya `https://xxxx.supabase.co/auth/v1/callback`. Dipakai di langkah 3. Biarkan halaman ini terbuka.

Catatan: proyek Supabase gratis dijeda kalau 7 hari tanpa aktivitas. Ping harian akan dipasang di aplikasi (P1). Kalau sempat terjeda, proyek bisa dihidupkan lagi dari dashboard Supabase.

## Langkah 3: Google Cloud (login dengan Google)

Pakai Gmail khusus Jaminin.

1. Buka https://console.cloud.google.com, buat proyek baru bernama `Jaminin`.
2. Buka Google Auth Platform (cari "Google Auth Platform" di kolom pencarian konsol).
3. Branding: isi nama aplikasi `Jaminin`, email dukungan (Gmail khusus Jaminin), dan email kontak developer. Jangan unggah logo dulu, karena logo memicu proses verifikasi merek oleh Google. Tautan kebijakan privasi diisi nanti, setelah halaman itu ada.
4. Audience: pilih External, lalu tekan Publish app supaya statusnya In production. Tanpa ini, hanya 100 pengguna uji yang bisa masuk. Jaminin hanya meminta email dan profil dasar, jadi tidak perlu verifikasi khusus.
5. Clients: tekan Create client.
   - Application type: Web application
   - Name: `Jaminin Web`
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: Callback URL dari langkah 2 nomor 8
   - Tekan Create, lalu simpan Client ID dan Client Secret (Client Secret adalah rahasia).
6. Kembali ke Supabase, halaman Google di Sign In / Providers. Nyalakan Google, tempel Client ID dan Client Secret, lalu simpan.

Alamat Cloudflare ditambahkan ke Authorized JavaScript origins nanti saat deploy.

## Langkah 4: Sentry (pencatat error)

1. Daftar di https://sentry.io memakai Gmail khusus Jaminin. Pilih paket gratis (Developer).
2. Buat proyek dengan platform React, beri nama `jaminin`.
3. Salin DSN yang ditampilkan (boleh dibagikan).

Paket gratis Sentry hanya untuk 1 pengguna, jadi akun ini dipakai bersama lewat Gmail khusus Jaminin.

## Langkah 5: Cloudflare (hosting, dipakai belakangan)

1. Daftar di https://dash.cloudflare.com/sign-up memakai Gmail khusus Jaminin.
2. Cukup sampai akun aktif. Pengaturan deploy dilakukan belakangan, setelah aplikasi jadi.

## Langkah 6: Konektor di claude.ai

Konektor membuat saya bisa mengatur database Supabase dan membaca error di Sentry langsung, tanpa kamu menyalin kunci apa pun.

1. Buka claude.ai, lalu Settings, lalu Connectors.
2. Cari Supabase, tekan Connect, lalu masuk dengan akun Supabase dari langkah 2.
3. Cari Sentry, tekan Connect, lalu masuk dengan akun Sentry dari langkah 4.
4. Pastikan keduanya aktif untuk percakapan ini. Kalau alatnya belum muncul, biasanya perlu sesi baru.
5. Beri tahu saya di chat kalau sudah tersambung.

Kalau konektor Supabase tidak bisa dipakai: buat token akses di https://supabase.com/dashboard/account/tokens, dengan izin terbatas hanya untuk proyek `jaminin` kalau pilihan itu tersedia. Simpan token itu sebagai rahasia lingkungan `SUPABASE_ACCESS_TOKEN`, dan kata sandi database sebagai `SUPABASE_DB_PASSWORD` (langkah 7).

## Langkah 7: Rahasia lingkungan sesi Claude

Rahasia lingkungan adalah tempat aman untuk kunci yang saya butuhkan, tanpa ditempel di chat.

1. Di sesi Claude ini, buka menu environment di bagian judul sesi, lalu Edit.
2. Tambahkan rahasia di bagian Network secrets (atau API credentials, atau environment variables, tergantung versi aplikasimu) dengan nama persis seperti di daftar di bawah.
3. Rahasia baru terbaca di sesi berikutnya.

Daftar rahasia:

| Nama | Isi | Kapan |
|---|---|---|
| `CONTEXT7_API_KEY` | API key Context7 yang baru (langkah 8) | Sekarang |
| `SUPABASE_ACCESS_TOKEN` | Token akses Supabase | Hanya kalau konektor Supabase tidak bisa dipakai |
| `SUPABASE_DB_PASSWORD` | Kata sandi database Supabase | Hanya kalau konektor Supabase tidak bisa dipakai |
| `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` | Token deploy Cloudflare | Nanti, saat deploy. Panduannya menyusul. |

## Langkah 8: API key Context7 yang baru

API key Context7 yang lama sempat ditempel di chat, jadi sebaiknya diganti.

1. Masuk ke https://context7.com dan buka bagian API keys di dashboard.
2. Hapus key lama, lalu buat key baru.
3. Simpan key baru sebagai rahasia lingkungan `CONTEXT7_API_KEY` (langkah 7). Jangan tempel di chat.

## Langkah 9: Menjalankan Jaminin di laptop

Kode aplikasi baru dibuat setelah PRD disetujui. Langkah ini bisa disiapkan sekarang, lalu dijalankan setelah saya memberi tahu aplikasinya sudah bisa dicoba.

1. Pasang Node.js versi LTS dari https://nodejs.org (minimal versi 22.12). Mac: file .pkg. Windows: file .msi.
2. Pasang GitHub Desktop dari https://desktop.github.com, lalu masuk dengan akun GitHub kamu.
3. Di GitHub Desktop, pilih File, lalu Clone repository, pilih `haidarsfw/Jaminin`, lalu pindah ke branch `claude/adoring-brown-y5df83`.
4. Buka folder proyek di Terminal (Mac) atau Command Prompt (Windows). Di GitHub Desktop ada menu Repository, lalu Open in Terminal atau Open in Command Prompt.
5. Jalankan `npm install`, lalu `npm run dev`.
6. Buka http://localhost:5173 di Chrome.
7. Untuk melihat tampilan HP: buka DevTools (Mac: Cmd + Option + I, Windows: Ctrl + Shift + I), tekan tombol Toggle device toolbar (Mac: Cmd + Shift + M, Windows: Ctrl + Shift + M), lalu pilih ukuran iPhone atau iPad.

Petunjuk lengkap juga akan ada di README repo.

## Yang dikirim ke saya setelah selesai

| Kirim di chat | Jangan dikirim |
|---|---|
| Alamat Gmail khusus Jaminin | Kata sandi apa pun |
| Kabar bahwa konektor Supabase dan Sentry sudah tersambung | Sandi Aplikasi Gmail |
| Kalau konektor belum bisa: Project URL dan publishable key Supabase, dan DSN Sentry | Client Secret Google |
| Kabar bahwa login Google di Supabase sudah aktif | Secret key atau service_role key Supabase |
| | Token dan API key (simpan sebagai rahasia lingkungan) |
