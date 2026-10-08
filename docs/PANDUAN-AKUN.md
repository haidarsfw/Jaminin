# Panduan Akun dan Dashboard Jaminin

Untuk Haidar. Keadaan per Kamis, 8 Oktober 2026 malam. Kerjakan berurutan, karena beberapa langkah memakai hasil langkah sebelumnya. Semua layanan di sini gratis.

## Yang sudah selesai

Bagian ini tidak perlu dikerjakan lagi.

- Proyek Supabase `jaminin` di organisasi pribadimu (haidarsfw, region Singapura), dibuat lewat konektor. Isinya database, aturan akses, jadwal otomatis, empat Edge Functions, 8 tenant contoh, akun demo semua peran, dan kunci notifikasi push.
- Proyek Sentry `jaminin` di organisasi pribadimu.
- Konektor Supabase dan Sentry di claude.ai sudah tersambung.
- Konfigurasi hosting Cloudflare sudah ada di repo (`wrangler.jsonc`).

## Aturan rahasia

- **Rahasia**: kata sandi apa pun, Sandi Aplikasi Gmail, Client Secret Google, secret key Supabase, token, dan API key. Jangan ditempel di chat. Simpan di pengelola kata sandi atau catatan pribadi.
- **Boleh dibagikan**: alamat Gmail khusus Jaminin, alamat aplikasi di Cloudflare, Project URL dan publishable key Supabase, DSN Sentry, dan Client ID Google.

## Langkah 1: Gmail khusus Jaminin

Gmail ini dipakai untuk tiga hal: pengirim email lupa kata sandi, pemilik proyek Google Cloud untuk login Google, dan pemilik akun Cloudflare.

1. Buat akun Google baru di https://accounts.google.com/signup. Namanya bebas, misalnya yang mengandung kata jaminin.
2. Nyalakan Verifikasi 2 Langkah: buka https://myaccount.google.com, pilih Keamanan, lalu Verifikasi 2 Langkah.
3. Buat Sandi Aplikasi di https://myaccount.google.com/apppasswords dengan nama "Supabase Jaminin". Google menampilkan sandi 16 huruf. Simpan sandi itu (rahasia). Menu ini baru muncul setelah Verifikasi 2 Langkah aktif.

## Langkah 2: Cloudflare, menayangkan aplikasi

1. Daftar di https://dash.cloudflare.com/sign-up memakai Gmail khusus Jaminin.
2. Buka Workers & Pages, pilih Create application, lalu Get started di bagian Import a repository.
3. Pilih akun Git: sambungkan GitHub milikmu (pemilik repo `haidarsfw/Jaminin`), lalu izinkan Cloudflare membaca repo Jaminin.
4. Pilih repo `Jaminin`, lalu isi pengaturan:
   - Nama Worker atau project: `jaminin`. Harus persis sama dengan nama di `wrangler.jsonc`; kalau berbeda, build gagal.
   - Branch produksi: `claude/adoring-brown-y5df83`.
   - Build command: `npm run build`.
   - Deploy command: `npx wrangler deploy` (biasanya sudah terisi).
   - Variabel lingkungan tidak perlu diisi. Konfigurasi publik sudah ada di repo.
5. Tekan Save and Deploy, lalu tunggu beberapa menit sampai selesai.
6. Salin alamat aplikasinya, bentuknya `https://jaminin.<nama-akunmu>.workers.dev`, lalu kirim ke saya di chat.

Setelah ini, setiap commit baru di branch `claude/adoring-brown-y5df83` otomatis dibangun dan ditayangkan ulang oleh Cloudflare.

## Langkah 3: Supabase, alamat aplikasi dan email lupa sandi

Masuk ke Supabase dengan akun pribadimu, lalu buka proyek `jaminin`.

1. Alamat aplikasi: buka https://supabase.com/dashboard/project/sbxowjvnkoxmsyuzmcpv/auth/url-configuration.
   - Site URL: alamat Cloudflare dari langkah 2.
   - Redirect URLs: tambahkan `http://localhost:5173/**` dan alamat Cloudflare dengan akhiran `/**`, misalnya `https://jaminin.<nama-akunmu>.workers.dev/**`.
   - Tekan Save.
2. Email lupa sandi: buka https://supabase.com/dashboard/project/sbxowjvnkoxmsyuzmcpv/auth/smtp, nyalakan custom SMTP, lalu isi:
   - Sender email dan Username: Gmail khusus Jaminin.
   - Sender name: `Jaminin`.
   - Host: `smtp.gmail.com`, Port: `465`.
   - Password: Sandi Aplikasi dari langkah 1, bukan kata sandi Gmail biasa.
   - Tekan Save. Setelah SMTP sendiri aktif, Supabase membatasi 30 email per jam, cukup untuk prototipe.

Pendaftaran di Jaminin sudah otomatis terkonfirmasi lewat Edge Function, jadi pengaturan "Confirm email" tidak perlu diubah.

## Langkah 4: Google Cloud, masuk dengan Google

Pakai Gmail khusus Jaminin.

1. Buka https://console.cloud.google.com, buat proyek bernama `Jaminin`.
2. Buka Google Auth Platform (cari namanya di kolom pencarian konsol).
3. Branding: nama aplikasi `Jaminin`, email dukungan dan email kontak developer diisi Gmail khusus Jaminin. Jangan unggah logo dulu, karena logo memicu verifikasi merek oleh Google.
4. Audience: pilih External, lalu tekan Publish app supaya statusnya In production. Tanpa ini hanya 100 pengguna uji yang bisa masuk.
5. Clients: tekan Create client.
   - Application type: Web application. Name: `Jaminin Web`.
   - Authorized JavaScript origins: `http://localhost:5173` dan alamat Cloudflare tanpa garis miring di akhir, misalnya `https://jaminin.<nama-akunmu>.workers.dev`.
   - Authorized redirect URIs: `https://sbxowjvnkoxmsyuzmcpv.supabase.co/auth/v1/callback`.
   - Tekan Create, lalu simpan Client ID dan Client Secret (Client Secret adalah rahasia).
6. Di Supabase, buka Authentication, lalu Sign In / Providers, lalu Google. Nyalakan Google, tempel Client ID dan Client Secret, lalu Save.

## Langkah 5: Menjadi admin pertama

1. Buka alamat Cloudflare dari langkah 2, daftar dengan email pribadimu, lalu isi profil.
2. Kabari saya di chat. Saya menjalankan satu perintah di database supaya akunmu menjadi admin. Email pribadimu tidak ditulis di repo.
3. Abdul Azis, Dafi, dan Evan mendaftar sendiri di aplikasi. Setelah itu kamu menambahkan mereka sebagai admin di menu Tim, lalu Anggota.

## Langkah 6: Satu persetujuan di konektor Supabase

Konektor Supabase meminta persetujuan pemilik akun untuk perintah database yang menghapus sesuatu. Satu perubahan masih menunggu: migrasi `rapikan_advisor`, yang memindahkan ekstensi pg_net ke skema yang disarankan Supabase dan merapikan aturan akses menu. Hak akses tidak berubah. Saat kamu sedang membuka chat ini, kabari saya; saya menjalankannya dan kamu tinggal menekan setuju saat permintaan dari Supabase muncul.

Ada juga satu akun uji yang saya buat saat menguji pendaftaran di cloud: `uji-cloud+muzenixj@jaminin.test`, tanpa pesanan. Hapus lewat https://supabase.com/dashboard/project/sbxowjvnkoxmsyuzmcpv/auth/users: cari alamat itu, lalu pilih Delete user. Pesanan uji milik akun demo ikut terhapus saat tombol Reset demo ditekan sebelum presentasi.

## Langkah 7: API key Context7 yang baru

API key Context7 yang lama sempat ditempel di chat, jadi sebaiknya diganti.

1. Masuk ke https://context7.com, buka bagian API keys.
2. Hapus key lama, lalu buat key baru.
3. Simpan sebagai rahasia lingkungan sesi Claude dengan nama `CONTEXT7_API_KEY`: buka menu environment di judul sesi, pilih Edit, lalu tambahkan rahasianya. Rahasia baru terbaca di sesi berikutnya. Jangan tempel key di chat.

## Langkah 8: Menjalankan Jaminin di laptop

1. Pasang Node.js versi LTS dari https://nodejs.org (minimal 22.12). Mac: berkas .pkg. Windows: berkas .msi.
2. Pasang GitHub Desktop dari https://desktop.github.com, lalu masuk dengan akun GitHub-mu.
3. Di GitHub Desktop, pilih File, lalu Clone repository, pilih `haidarsfw/Jaminin`, lalu pindah ke branch `claude/adoring-brown-y5df83`.
4. Buka folder proyek di Terminal (Mac) atau Command Prompt (Windows) lewat menu Repository, lalu Open in Terminal atau Open in Command Prompt.
5. Jalankan `npm install`, lalu `npm run dev`.
6. Buka http://localhost:5173 di Chrome. Aplikasi di laptop memakai database Supabase yang sama dengan alamat Cloudflare.
7. Untuk melihat tampilan HP: buka DevTools (Mac: Cmd + Option + I, Windows: Ctrl + Shift + I), tekan Toggle device toolbar (Mac: Cmd + Shift + M, Windows: Ctrl + Shift + M), lalu pilih ukuran iPhone atau iPad.

## Yang dikirim ke saya

| Kirim di chat | Jangan dikirim |
|---|---|
| Alamat aplikasi Cloudflare (langkah 2) | Kata sandi apa pun |
| Kabar bahwa URL Configuration dan SMTP sudah disimpan | Sandi Aplikasi Gmail |
| Kabar bahwa login Google sudah aktif | Client Secret Google |
| Kabar bahwa kamu sudah mendaftar di aplikasi | Secret key Supabase |
| Kabar saat kamu sedang membuka chat, untuk persetujuan konektor | Token dan API key |
