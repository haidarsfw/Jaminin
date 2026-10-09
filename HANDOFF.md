# Serah terima Jaminin

Dokumen ini untuk agen AI atau pengembang yang melanjutkan Jaminin. Ditulis Kamis, 8 Oktober 2026 malam WIB, saat kuota mingguan Claude milik Haidar hampir habis (reset Selasa, 13 Oktober 2026 pukul 23.00, yaitu setelah presentasi). Baca sampai habis sebelum menyentuh kode. Bagian 9 ("Posisi kerja terakhir") diperbarui setiap ada kemajuan.

## 0. Urutan membaca

1. Berkas ini.
2. `CLAUDE.md`: aturan kerja, perintah menjalankan, catatan lingkungan.
3. `docs/PRD.md`: acuan produk. Bagian yang paling sering dibutuhkan: 5 (aturan inti), 9 (tabel masalah), 10 (status pesanan), 13 (fitur dan prioritas), 18 (naskah demo 10 menit), 22 (rencana dan urutan P1).
4. `docs/PANDUAN-AKUN.md`: langkah dashboard yang hanya bisa dikerjakan Haidar.
5. `git log --oneline`: posisi terakhir yang sudah di-push.

## 1. Proyek dalam satu halaman

- Jaminin adalah aplikasi web yang bisa dipasang (PWA) untuk memesan makanan dan minuman dari tenant kantin BINUS @Bekasi. Pembeli memilih jam ambil tiap 5 menit (hari ini atau besok), membayar di muka, lalu mengambil sendiri dengan kode 4 karakter atau QR tanpa antre.
- Masalah yang dijawab: jeda antarkelas 20 menit habis untuk antre. 8 dari 10 responden wawancara pernah tidak makan, menunda makan, atau melewatkan makanan berat karenanya.
- Tim: Kelompok 2. Haidar Shofwan Bani (CEO, pemberi keputusan), Abdul Azis, Dafi Ardian Pasha, Muhammad Evan Maulana Rifqi. Haidar bukan orang teknis: jelaskan dengan bahasa awam dan beri pilihan dengan rekomendasi di urutan pertama.
- Tenggat: prototipe harus berjalan benar **Senin, 12 Oktober 2026**. Presentasi dan demo sekitar 10 menit pada **Selasa, 13 Oktober 2026**, memakai HP dan laptop bersamaan.
- Pembayaran disimulasikan lewat halaman Simulator Bayar. Tidak ada penyedia pembayaran sungguhan dan tidak ada uang sungguhan.

## 2. Aturan kerja yang wajib dipatuhi

Dari Haidar dan `CLAUDE.md`:

1. Bahasa percakapan, dokumen, dan pesan commit: Indonesia. Dokumen ditulis dengan kalimat utuh.
2. Keputusan: Haidar sudah menyetujui seluruh rencana pembangunan dan meminta eksekusi langsung tanpa meminta izin lagi ("saya izinkan kamu mengakses semuanya", serta ronde 42 yang menyerahkan urutan prioritas). Keputusan produk yang sudah diambil tercatat di `docs/PRD.md`. Untuk hal kecil yang belum diputuskan, pilih opsi yang paling aman, tandai "Usulan, perlu persetujuan" di PRD, lalu lanjutkan. Tetap tanyakan dulu untuk hal yang bisa menimbulkan biaya, menghapus data sungguhan, atau mengubah aturan uang.
3. Semua layanan harus gratis, kecuali domain.
4. Fungsi dulu dengan tampilan rapi dan sederhana. Haidar sendiri yang memoles tampilan nanti. Label "Draf tampilan" tetap tampil di aplikasi.
5. P0 harus sempurna sebelum P1. Urutan P1 ada di PRD bagian 22 dan di bagian 9 berkas ini.
6. HP dulu (390x844), lalu iPad (820x1180), lalu laptop (1440x900), dengan kenyamanan yang sama.
7. Commit dan push sesering mungkin. Container cloud sering dimulai ulang, dan pekerjaan yang belum di-push bisa hilang.
8. Skill antislop dipakai otomatis sesuai jenis pekerjaan (daftar di `CLAUDE.md` bagian Skill). Laporan PASS/FAIL Delivery Gate hanya ditampilkan untuk hasil UI. Hindari tanda pisah panjang, kata promosi kosong, dan basa-basi.
9. Dokumentasi pustaka dicek lewat Context7 (`npx ctx7@latest library <nama> "<topik>"` lalu `npx ctx7@latest docs <id> "<topik>"`), bukan dari ingatan.

Keamanan:

1. Tidak ada kunci rahasia di repo atau di kode aplikasi: service role atau secret key Supabase, kunci VAPID privat, Sandi Aplikasi Gmail, Client Secret Google, token, API key.
2. Konfigurasi publik (URL Supabase, publishable key, kunci VAPID publik, DSN Sentry) boleh di-commit di `.env` dan `.env.production`.
3. Jangan pernah meminta Haidar menempel kunci atau sandi di chat. Rahasia disimpan sebagai rahasia lingkungan sesi cloud atau langsung di dashboard layanan.
4. Email pribadi tidak ditulis di repo. Admin pertama dipasang lewat perintah sekali jalan di database (bagian 10).
5. Konektor Supabase meminta persetujuan pengguna untuk perintah yang mengandung DROP atau DELETE. Jangan menyamarkan perintah supaya lolos dari persetujuan itu. Jalankan saat Haidar sedang membuka chat supaya ia bisa menyetujui.
6. Jangan mematikan verifikasi TLS dan jangan menghapus `HTTPS_PROXY` di container.

Git:

1. Branch kerja sekaligus branch utama: `claude/adoring-brown-y5df83`. Jangan membuat Pull Request.
2. Push: `git push -u origin claude/adoring-brown-y5df83`. Kalau gagal karena jaringan, ulangi dengan jeda 2, 4, 8, lalu 16 detik.
3. Pesan commit bahasa Indonesia, diakhiri baris atribusi yang diminta lingkungan agen Anda.
4. Di container cloud Claude, `GH_TOKEN` dan `GITHUB_TOKEN` ditolak API publik GitHub. Untuk unduhan dari GitHub publik pakai `env -u GH_TOKEN -u GITHUB_TOKEN <perintah>`.

## 3. Techstack

Versi persis terkunci di `package-lock.json`.

| Bagian | Pilihan |
|---|---|
| Aplikasi | Vite 8.3, React 19.3, TypeScript 6.0.3 (bukan 7, karena typescript-eslint 8.71 belum mendukung) |
| Navigasi | TanStack Router 1.170 berbasis berkas, `autoCodeSplitting` aktif |
| Data klien | TanStack Query 5.104 |
| Tampilan | Tailwind CSS 4.3 lewat plugin Vite, token warna terang dan gelap di `src/index.css` |
| PWA | vite-plugin-pwa 2.0 mode `injectManifest`, service worker sendiri di `src/sw.ts` (Workbox 7.4) |
| Bahasa | i18next 26 dan react-i18next 17, berkas `src/locales/id.json` dan `en.json` |
| Waktu | date-fns 4 dan @date-fns/tz, zona Asia/Jakarta (WIB) |
| Validasi | zod 4.6 |
| QR | qrcode.react 4.2 (menampilkan), barcode-detector 3.2 (memindai, juga di Safari) |
| Backend | Supabase: Postgres, Auth, Realtime Broadcast, Storage, Edge Functions (Deno), pg_cron, pg_net |
| Push | Web Push dengan VAPID lewat Edge Function `kirim-kabar` |
| Pemantauan | @sentry/react 11.5 |
| Hosting | Cloudflare Workers Static Assets mode SPA (`wrangler.jsonc`), lewat Workers Builds |
| Uji | Vitest 5, pgTAP (`supabase test db`), Playwright 1.56 dengan Chromium di `/opt/pw-browsers` |
| Alat | Supabase CLI 2.120 dan Wrangler 4.147 sebagai devDependency, Node 22 |

## 4. Peta repo

Akar:

- `CLAUDE.md`, `HANDOFF.md`, `docs/PRD.md`, `docs/PANDUAN-AKUN.md`.
- `.env` (konfigurasi publik cloud, di-commit), `.env.production` (salinan untuk build produksi supaya tidak memakai `.env.local`), `.env.local` (diabaikan git, menunjuk ke Supabase lokal).
- `wrangler.jsonc` (Worker `jaminin`, aset `./dist/`, `not_found_handling: single-page-application`), `public/_headers` (cache satu tahun untuk `/assets/*`).
- `playwright.config.ts` (proyek `hp`, `ipad`, `laptop`; menyalakan `npm run dev` sendiri; mengabaikan `cloud.spec.ts`), `playwright.cloud.config.ts` (uji terhadap cloud).
- `vite.config.ts`, `eslint.config.js`, `tsconfig*.json`, `skills-lock.json`, `.claude/skills/` (skill proyek), `.claude/rules/context7.md`.
- Belum ada `README.md` (tugas Senin, bagian 11).

`src/routes/` (nama berkas = alamat; berkas rute hanya boleh mengekspor `Route`):

- Pembeli: `index.tsx` (beranda: jam tercepat tiap tenant, urutan tercepat atau abjad, tombol jam istirahat), `tenant.$slug.tsx` (menu, pilihan, tanda habis), `keranjang.tsx`, `checkout.tsx` (hari dan jam lewat `SlotPicker`, nama pengambil, makan di sini atau bungkus, alat makan, catatan), `bayar.$orderId.tsx` (QR simulasi, kode bayar, hitung mundur 5 menit), `pesanan.index.tsx`, `pesanan.$orderId.tsx` (lini waktu, kode ambil dan QR, batal, geser, menu habis, laporan, chat, penilaian, kalender, struk), `struk.$orderId.tsx`, `kabar.tsx` (pusat notifikasi).
- Akun: `masuk.tsx` (masuk dan daftar), `atur-sandi.tsx` (lupa sandi), `lengkapi-profil.tsx`, `profil.tsx`, `panduan-pasang.tsx` (pasang ke layar utama iPhone dan iPad).
- `simulator-bayar.tsx`: dibuka di laptop saat demo, siapa pun bisa memasukkan kode atau memindai QR bayar; daftar tagihan hanya untuk tim.
- Penjual: `penjual.tsx` (bingkai), `penjual.index.tsx` (papan pesanan realtime dengan bunyi), `penjual.menu.tsx`, `penjual.toko.tsx` (jam buka, kuota, batas waktu pesan, jeda, libur dan jam khusus, promo, rekening, jam setoran), `penjual.setoran.tsx`, `penjual.daftar.tsx` (pendaftaran tenant).
- Tim: `tim.tsx` (bingkai), `tim.index.tsx` (dasbor), `tim.penjual.tsx` (setujui, tolak, tangguhkan, aktifkan, ringkasan penilaian), `tim.laporan.tsx` (uang kembali manual, batal pesanan, chat pesanan yang dilaporkan), `tim.setoran.tsx`, `tim.anggota.tsx`.

`src/components/`: `AppShell.tsx` (bingkai aplikasi, navigasi, `KabarLink` dengan jumlah belum dibaca, `KabarToast`, `DemoPanel`), `Guard.tsx` (penjaga peran), `ui.tsx` (Button, Card, Notice, TextArea, Dialog, dan komponen dasar lain), `SlotPicker.tsx`, `QrScanner.tsx`, `ProfileForm.tsx`.

`src/features/`: `orders.ts` (query dan aksi pesanan), `seller.tsx`, `tenant.ts`, `tenantForm.tsx`, `payouts.tsx`, `kabar.ts` (query kabar), `kabarText.ts` (teks kabar murni, dipakai uji unit, impor relatif), `chat.tsx` (`ChatThread`, `chatIsOpen`).

`src/lib/`: `supabase.ts` (klien, `rpc`, `toAppError`, `callFunction`), `database.types.ts` (hasil generate), `auth.tsx`, `cart.ts`, `calendar.ts` (berkas .ics dan tautan Google Calendar), `demo.ts`, `device.ts`, `format.ts` (rupiah, jam, tanggal WIB: `todayWib`, `tomorrowWib`, `wibDate`, `dateLabel`, `orderNo`), `i18n.ts`, `push.ts`, `realtime.ts` (`useTopic`), `theme.ts`.

`supabase/`:

- `migrations/` (17 berkas, urut):
  - `..0100_skema_dasar`: tabel dan enum.
  - `..0200_akses`: RLS dan fungsi peran (`private.is_team`, `private.is_tenant_member`, `private.is_tenant_owner`).
  - `..0300_jam_ambil`: rumus jam tercepat, slot 5 menit, kuota.
  - `..0400_pesanan`: `create_order` dengan kunci kuota dan stok, `internal_confirm_payment`, perpindahan status, uang kembali.
  - `..0500_otomatis`: pg_cron tiap menit (kedaluwarsa, pengingat, menu habis otomatis, tutup hari, setoran) dan pemanggilan `kirim-kabar` lewat pg_net.
  - `..0600_realtime`: siaran ke channel privat dan RLS di `realtime.messages`.
  - `..0700_penjual_tim`, `..0750_tim_dan_demo`, `..0800_hak_fungsi_dan_demo`: fungsi penjual dan tim, reset demo, hak eksekusi fungsi.
  - `..0900_data_contoh`: `private.seed_demo(pola_email)`, 8 tenant contoh, akun demo lima peran.
  - `..1000_langganan_push`, `..1100_pengaturan_toko`.
  - `..1200_rapikan_advisor`: pg_net dipindah ke skema `extensions`, kebijakan `_write` dipecah menjadi insert, update, delete.
  - `..1300_libur_dan_penangguhan`: libur dan jam khusus per tanggal, penangguhan tenant, pembatalan pesanan lunas dengan uang kembali penuh.
  - `..1400_promo_tidak_tumpang`: trigger penolak promo yang tumpang tindih.
  - `..1500_penilaian`: tabel `ratings` dan `buyer_rate_order`.
  - `..1600_chat_pesanan`: tabel `order_messages`, `send_order_message`, `private.chat_open`.
- `functions/`: `simulasi-bayar` (konfirmasi bayar simulasi), `daftar` (pendaftaran akun), `demo-masuk` (pindah ke akun demo dari panel demo), `kirim-kabar` (push), `_shared/supabase.ts`.
- `tests/`: `00_bantuan` (`tests.create_user`, `tests.as_user`, `tests.as_anon`, `tests.as_postgres`), `01_jam_ambil`, `02_pesanan`, `03_demo`, `04_akses_menu`, `05_libur`, `06_promo`, `07_penilaian`, `08_chat`. Total 146 uji, semuanya lulus.
- `seed.sql` (dijalankan saat `db reset`), `config.toml`.

`tests/`:

- `unit/`: `format`, `i18n` (memeriksa kunci terjemahan, termasuk kode galat yang muncul di migrasi dan jenis kabar), `kabar`, `calendar`. Total 23 uji.
- `e2e/`: `bantuan.ts` (`setPassword`, `rest`, `openContext`, `signIn`, `noHorizontalScroll`, `orderAndPay`, `openBoard`), `alur-inti`, `tata-letak`, `libur`, `naskah-demo` (6 skenario), `promo`, `struk-penilaian`, `cloud.spec.ts`. Total 19 uji lokal, semuanya lulus.

## 5. Akun dan layanan

| Layanan | Keadaan |
|---|---|
| Supabase | Proyek `jaminin`, ref `sbxowjvnkoxmsyuzmcpv`, URL `https://sbxowjvnkoxmsyuzmcpv.supabase.co`, organisasi pribadi haidarsfw, paket Free, region Singapura. Konektor Supabase di sesi Claude Haidar tersambung ke akun ini. Proyek gratis dijeda setelah 7 hari tanpa aktivitas. |
| Edge Functions cloud | `simulasi-bayar`, `daftar`, `demo-masuk`, `kirim-kabar` (versi 3, sudah memuat teks `chat_baru`; diuji: aksi `public_key` menjawab, pemanggil tanpa rahasia ditolak). Semua dengan `verify_jwt` mati karena fungsi memeriksa pemanggil sendiri. Susunan saat deploy lewat konektor: `<nama>/index.ts` ditambah `_shared/supabase.ts`, entrypoint `<nama>/index.ts`. |
| Push | Kunci VAPID dibuat dan disimpan di server, tidak di repo. Jalur trigger, pg_net, lalu `kirim-kabar` sudah teruji di cloud. |
| Sentry | Proyek `jaminin` (React) di organisasi haidarsfw. DSN di `.env`. |
| Cloudflare | Belum tersambung. Haidar perlu membuat Worker `jaminin` lewat Workers Builds (langkah di `docs/PANDUAN-AKUN.md`). |
| Gmail khusus Jaminin | Untuk SMTP lupa sandi, Google Cloud, dan Cloudflare. SMTP di Supabase belum dipastikan terisi. |
| Google OAuth | Belum dipasang. Tombol Google di halaman masuk baru berfungsi setelah provider diisi. |
| Context7 | Kunci di rahasia lingkungan `CONTEXT7_API_KEY`. Kunci lama sempat tertempel di chat, jadi Haidar perlu membuat ulang. |

Kalau agen berikutnya tidak punya konektor Supabase: minta Haidar menyimpan `SUPABASE_ACCESS_TOKEN` dan `SUPABASE_DB_PASSWORD` sebagai rahasia lingkungan (bukan di chat), lalu pakai Supabase CLI (`npx supabase link --project-ref sbxowjvnkoxmsyuzmcpv`, `npx supabase db push`). Jalan lain yang tidak butuh kunci: Haidar membuka SQL Editor di dashboard Supabase dan menjalankan isi berkas migrasi satu per satu (bagian 7).

## 6. Menjalankan dan menguji

Dasar:

```bash
npm install
npm run dev            # http://localhost:5173. Tanpa .env.local, aplikasi memakai Supabase cloud dari .env.
npm run typecheck      # 0 galat
npm run lint           # 0 galat
npm test               # Vitest, 23 uji
```

Supabase lokal (butuh Docker). Di container cloud Claude, Docker tidak menyala sendiri setelah restart:

```bash
rm -f /var/run/docker.pid /run/containerd/containerd.pid
nohup dockerd > /tmp/dockerd.log 2>&1 &
# tunggu sampai `docker ps` menjawab, lalu:
npm run db:start                                  # atau docker start untuk kontainer supabase_* yang sudah ada
docker start supabase_edge_runtime_jaminin        # bila Edge Functions lokal mati
npm run db:reset                                  # terapkan semua migrasi dan seed
npm run db:test                                   # pgTAP, 146 uji
```

`.env.local` untuk lokal berisi `VITE_SUPABASE_URL=http://127.0.0.1:54321` dan `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key lokal dari npx supabase status>`. Setelah mengubah skema, buat ulang tipe: `npx supabase gen types typescript --local > src/lib/database.types.ts`.

Uji ujung ke ujung lokal (butuh Supabase lokal; Playwright menyalakan dev server sendiri):

```bash
npm run test:e2e                         # semua proyek
npx playwright test --project=hp         # lebih cepat
npx playwright test tests/e2e/naskah-demo.spec.ts --project=hp
```

Uji memasang sandi akun demo lewat Admin API lokal (`setPassword` membaca kunci dari `npx supabase status -o env`, hanya lokal). Uji gagal kalau ada galat di console browser, kecuali galat yang memang diharapkan dan dikecualikan secara tertulis di uji itu.

Uji terhadap cloud:

1. Pasang sandi sementara untuk `demo+pembeli@jaminin.test` dan `demo+pemilik@jaminin.test` di cloud (lewat konektor: `update auth.users set encrypted_password = extensions.crypt('<sandi>', extensions.gen_salt('bf')) where email in (...)`).
2. `JAMININ_CLOUD_SANDI=<sandi> JAMININ_TANPA_WEBSOCKET=1 npx playwright test -c playwright.cloud.config.ts`. `JAMININ_TANPA_WEBSOCKET=1` hanya untuk container cloud Claude, karena proxy di sana tidak meneruskan WebSocket. `JAMININ_URL` mengganti alamat yang diuji (misalnya alamat workers.dev). `JAMININ_CLOUD_DAFTAR=1` ikut menguji daftar akun baru (membuat akun sungguhan di cloud).
3. Setelah uji, acak lagi sandi kedua akun itu dengan cara yang sama memakai string acak yang tidak dicatat.

Deploy:

- Otomatis lewat Workers Builds setiap ada commit di branch kerja, setelah Haidar menyambungkannya.
- Cek lokal tanpa mengirim: `npm run deploy:cek` (build lalu `wrangler deploy --dry-run`).

## 7. Keadaan database cloud

- Migrasi 100 sampai 1100 terpasang. Sidik cloud dan lokal identik di 11 kategori (fungsi, hak fungsi, kebijakan RLS, kolom, trigger, hak tabel, hak kolom, cron, bucket, enum, indeks), juga ekstensi dan status RLS.
- Jumat, 9 Oktober dini hari: 1400 (promo tidak tumpang tindih), 1500 (penilaian), dan 1600 (chat) terpasang lewat `apply_migration` tanpa perlu persetujuan, dan versinya di riwayat sudah disamakan dengan berkas. Riwayat cloud sekarang 15 catatan. Ketiganya tidak memakai fungsi dari 1300, jadi urutan pemasangan ini aman (dicek dengan grep).
- **Belum terpasang di cloud: 1200 dan 1300.** Akibatnya kartu Libur dan Jam khusus di Toko dan tombol Tangguhkan di Tim gagal di cloud sampai dipasang. Ini **wajib** dipasang sebelum Senin.
- 1200 berisi DROP dan 1300 berisi DELETE, jadi konektor meminta persetujuan Haidar. Permintaan itu habis waktu tiga kali (Kamis malam sampai Jumat dini hari), termasuk sesaat setelah Haidar menjawab pertanyaan di chat, jadi kotak persetujuannya kemungkinan tidak muncul di layar Haidar. Cloud tidak berubah setiap kali (sudah dicek).
- **Jalan utama sekarang: berkas siap tempel `supabase/cloud/pasang-1200-1300.sql`.** Isinya 1200 dan 1300 apa adanya plus catatan riwayat, dalam satu transaksi. Sudah diuji di database lokal yang disetel sama dengan cloud (`npx supabase db reset --version 20261008001100`, lalu 1400 sampai 1600 lewat psql, lalu berkas ini): lulus. Haidar membuka `https://supabase.com/dashboard/project/sbxowjvnkoxmsyuzmcpv/sql/new`, menempel seluruh isi berkas, menekan Run, dan menyetujui peringatan "destructive operation" kalau muncul. Sesudahnya agen memeriksa `list_migrations` (harus 17 catatan), pg_net di skema `extensions`, dan menjalankan advisor.
- Cara memasang lewat konektor (kalau kotak persetujuan bisa dijawab), berurutan:
  1. `apply_migration` dengan `name` = bagian nama berkas setelah versi (contoh `rapikan_advisor`) dan `query` = isi berkas apa adanya.
  2. Konektor mencatat versi dengan waktu saat itu. Samakan dengan versi berkas: `update supabase_migrations.schema_migrations set version = '20261008001200' where name = 'rapikan_advisor';` (ulangi untuk 1300 `libur_dan_penangguhan`, 1400 `promo_tidak_tumpang`, 1500 `penilaian`, 1600 `chat_pesanan`).
  3. `list_migrations` harus menampilkan 17 catatan sesuai berkas.
  4. Jalankan `get_advisors` (security dan performance). Temuan yang sudah diterima dengan alasan: 3 tabel penghitung tanpa kebijakan (sengaja tertutup, hanya diakses fungsi server), 4 fungsi baca untuk tamu (beranda dan halaman tenant bisa dibuka tanpa masuk), puluhan RPC untuk pengguna yang masuk (semuanya memeriksa peran di dalam fungsi dan diuji pgTAP), perlindungan sandi bocor (hanya paket Pro), dan indeks yang belum terpakai (database masih baru).
  5. Deploy ulang `kirim-kabar` setelah teks `chat_baru` ditambahkan (bagian 9).
- Cara memasang tanpa konektor (Haidar di SQL Editor dashboard): jalankan isi berkas 1200 sampai 1600 berurutan, lalu catat riwayatnya: `insert into supabase_migrations.schema_migrations (version, name) values ('20261008001200','rapikan_advisor'), ('20261008001300','libur_dan_penangguhan'), ('20261008001400','promo_tidak_tumpang'), ('20261008001500','penilaian'), ('20261008001600','chat_pesanan');`
- Data cloud: 8 tenant contoh (di antaranya Good Moments Coffee, Mamadora Sweet & Savoury, Rustic Grill BBQ, Bakso Malang Mahkota, Mama Bento, Mie Ayam Bangka Asen, Warung Nusantara), 27 menu, 100 pesanan contoh berlabel, 5 akun demo (`demo+pembeli`, `demo+pemilik`, `demo+karyawan`, `demo+admin`, `demo+staf`, semuanya `@jaminin.test`), mode demo menyala (tenant contoh buka 06.00 sampai 22.00 setiap hari), `functions_url` terisi. pg_cron berjalan tiap menit.
- Sandi akun demo di cloud diacak dan tidak diketahui siapa pun. Saat demo, anggota tim masuk dengan akunnya sendiri lalu berpindah peran lewat panel demo (fungsi `demo-masuk`).
- Sisa data uji yang perlu dihapus: akun `uji-cloud+muzenixj@jaminin.test` (tanpa pesanan; hapus di Dashboard, Authentication, Users, atau lewat konektor dengan persetujuan Haidar) dan satu pesanan demo "Uji cloud ..." berstatus selesai (ikut terhapus saat Reset demo).

## 8. Yang sudah selesai

Lapis 1 (inti pesan, bayar, ambil), selesai dan lulus uji:

- Akun email dan sandi (minimal 6 karakter), lupa sandi, lengkapi profil (nama asli, WhatsApp Indonesia atau luar negeri, status termasuk pekerja kantin), peran pembeli, penjual (pemilik, karyawan), dan tim (admin, staf).
- Beranda dengan jam tercepat per tenant, urutan, tombol jam istirahat. Halaman tenant dengan pilihan tambahan berbayar dan tanda habis. Satu keranjang aktif. Checkout lengkap dengan sisa kuota, tanda promo, dan Biaya layanan Rp1.000.
- Bayar simulasi (QR "QR simulasi, bukan QRIS", kode bayar, hitung mundur 5 menit, rumus dicek ulang saat Bayar). Simulator Bayar memanggil Edge Function `simulasi-bayar`, yang memanggil `internal_confirm_payment`. Status lunas hanya diubah server.
- Status pesanan: lini waktu, hitung mundur, nomor urut harian, kode ambil 4 karakter dan QR yang terbuka tanpa sinyal, bagikan kode, Sudah saya terima, WhatsApp ke penjual.
- Papan penjual realtime: hari ini per jam ambil dan tab besok, bunyi berulang sampai Lihat, getar di Android, Mulai siapkan (hanya di hari ambil), Siap diambil, sekaligus per jam ambil, Serahkan dengan kode atau pindai QR.
- Kabar realtime lewat Broadcast ke channel privat, dengan polling cadangan.

Lapis 2 (aturan, uang, penjual, tim, push, demo), selesai dan lulus uji:

- Batal sebelum disiapkan, batal tepat jam ambil kalau belum siap, geser jam sekali (pesanan berpromo tidak bisa digeser), menu habis (ganti yang sama atau lebih murah, hapus, batal; otomatis setelah 10 menit atau saat jam ambil), Habis hari ini atau sampai dibuka lagi, tutup hari, kedaluwarsa 5 menit, "Dibatalkan sebelum bayar".
- Uang: rincian per pesanan, uang kembali, setoran otomatis harian (simulasi) dengan baris "Uang kembali dari tim".
- Penjual: pendaftaran lengkap, ditolak lalu kirim ulang, pengaturan toko inti, peringatan angka tidak biasa, hak karyawan.
- Tim: setujui atau tolak penjual, laporan dengan uang kembali manual (penanggung tenant atau Jaminin) dan batal pesanan, dasbor, setoran, anggota tim dengan admin terakhir dilindungi.
- Push: `kirim-kabar`, tombol Nyalakan kabar, panduan pasang di iPhone dan iPad, pengingat jam ambil 5, 10, atau 15 menit.
- Mode demo: akun demo lima peran, panel pindah peran khusus tim, jam demo, Reset demo yang hanya menghapus data akun demo.

Lapis 3 (P1), sejauh ini:

| P1 | Isi | Status | Commit |
|---|---|---|---|
| 1 | Pusat notifikasi, struk digital, tambah ke kalender, penilaian sekali tanpa ubah | Selesai | `cb87a56`, `f6a7f74` |
| 2 | Chat per pesanan, tutup 24 jam, tim membaca chat pesanan yang dilaporkan | Database, tampilan, uji pgTAP, teks push, dan pemasangan di cloud selesai. Belum: uji Playwright | `c9f7224`, `bf699af` |
| 5 | Promo jam sepi | Selesai | `1aaa051` |
| 6 | Jam khusus dan libur | Selesai. Belum: pengumuman tenant, profil toko lengkap, foto menu | `3c17530`, `a50b4d1` |
| 11 | Tangguhkan tenant | Selesai. Belum: tangguhkan akun, atur biaya, catatan aktivitas, kabar tim, dasbor per tenant | `3c17530`, `a50b4d1` |

Lainnya: hosting dan uji cloud (`1fdb745`), panduan dashboard (`4e9d6b3`), uji naskah demo enam skenario beserta dua perbaikan (`74dd391`), temuan advisor (`d34df2a`).

## 9. Posisi kerja terakhir dan rencana lanjutan

Posisi per Jumat, 9 Oktober 2026 dini hari: semua pekerjaan sudah di-push, termasuk chat per pesanan dan teks push `chat_baru`. Pemeriksaan terakhir lulus: typecheck 0, lint 0, Vitest 23, pgTAP 146. Playwright 19 lulus sebelum chat ditambahkan. Di cloud: migrasi 1400 sampai 1600 dan `kirim-kabar` versi 3 terpasang; 1200 dan 1300 menunggu Haidar menjalankan `supabase/cloud/pasang-1200-1300.sql` di SQL Editor (bagian 7).

Rincian chat (P1 nomor 2):

- Database `20261008001600_chat_pesanan.sql`: tabel `order_messages` (isi 1 sampai 500 karakter), RLS baca untuk pembeli, anggota tenant setelah dibayar, dan tim hanya untuk pesanan yang punya laporan. Tidak ada yang boleh menulis langsung; semua lewat `send_order_message(p_order, p_body)` dengan galat `order_not_found`, `message_invalid`, `chat_closed`. Chat terbuka setelah dibayar sampai 24 jam setelah selesai, batal, atau tidak diambil. Kabar `chat_baru` dibatasi satu per percakapan per 5 menit selama belum dibaca. Siaran ke `order:<id>` dan `tenant:<id>` dengan event `message`.
- Tampilan: `src/features/chat.tsx` (`ChatThread` dengan sisi pembeli, penjual, atau tim; tim hanya membaca). Dipasang di `pesanan.$orderId.tsx` (kartu "Chat dengan penjual"), `penjual.index.tsx` (tombol "Chat" atau "Chat (N)" di kartu pesanan membuka dialog), dan `tim.laporan.tsx` (bagian "Chat pesanan" hanya baca).

Rencana lanjutan, berurutan. Setiap langkah di-commit dan di-push begitu selesai, lalu bagian ini diperbarui.

1. Selesai: teks push `chat_baru` (`bf699af`) dan deploy `kirim-kabar` versi 3.
2. **Migrasi 1200 dan 1300 di cloud** lewat berkas siap tempel (bagian 7). 1400 sampai 1600 sudah terpasang. Setelah Haidar menjalankan berkasnya: cek `list_migrations` (17 catatan), cocokkan sidik cloud dan lokal, jalankan advisor, hapus akun uji cloud (perlu persetujuan, atau Haidar menghapusnya di Dashboard, Authentication, Users).
3. **Uji Playwright chat** (`tests/e2e/chat.spec.ts`): pembeli pesan dan bayar, kirim pesan, penjual melihat "Chat (1)" lalu membalas, pembeli melihat balasan, tim membaca chat setelah pesanan dilaporkan, tanpa galat console, tanpa gulir menyamping di HP.
4. **Ikon** (permintaan Haidar, Kamis malam: "walau desain simpel, saya mau tetap ada icons" supaya navigasi dan bagian lain tidak terasa asing). Keputusan: Phosphor Icons (`@phosphor-icons/react`, cek versi terbaru lewat Context7 dan npm sebelum memasang). Alasan: antislop R-04 menolak Lucide sebagai bawaan; Phosphor punya bobot `regular` dan `fill`, sehingga tab aktif bisa memakai `fill` dan bentuknya akrab bagi pengguna. Pasang di:
   - Navigasi bawah dan atas: Beranda (`House`), Pesanan (`Receipt`), Kabar (`Bell`, dengan jumlah belum dibaca), Profil (`User`), Penjual (`Storefront`), Tim (`UsersThree`). Tab aktif `weight="fill"`, lainnya `regular`. Label teks tetap tampil.
   - Keranjang (`ShoppingBag`), kembali (`ArrowLeft`), tutup dialog (`X`), pencarian (`MagnifyingGlass`) kalau nanti ada.
   - Nada `Notice`: info (`Info`), berhasil (`CheckCircle`), peringatan (`Warning`), galat (`WarningCircle`), supaya status tidak hanya dibedakan warna.
   - Tombol aksi utama: jam (`Clock`), pindai QR (`QrCode`), chat (`ChatCircle`), kalender (`CalendarPlus`), struk (`Printer`), WhatsApp (`WhatsappLogo`), penilaian (`ThumbsUp` dan `ThumbsDown`), stepper jumlah (`Minus`, `Plus`).
   - Aturan: ukuran 20 sampai 24 px, `aria-hidden` kalau ada label teks, tombol yang hanya berisi ikon wajib punya `aria-label`, target sentuh minimal 44x44 px. Jalankan ulang semua uji Playwright karena nama tombol bisa berubah kalau ikon ikut terbaca.
5. **Sisa P1, berurutan** (kriteria terima lengkap di PRD bagian 13). Sebelum membangun, cek dulu apa yang sudah ada di skema dan migrasi 0500 dan 1100, karena sebagian kolom (stok harian, batas pesanan per hari) dan jadwal otomatis mungkin sudah ada.
   1. (3) Daftar siap-masak dan mode layar dapur.
   2. (4) Stok harian per tanggal ambil, batas pesanan per hari, pengingat penjual, kabar pagi.
   3. (6, sisa) Pengumuman tenant, profil toko lengkap, foto menu (Supabase Storage).
   4. (7) Riwayat pesanan dan ringkasan pengeluaran, pesan ulang, favorit di atas beranda, pencarian lintas tenant, filter penanda menu.
   5. (8) Laporan penjualan harian, riwayat pesanan penjual, unduh rekap CSV.
   6. (9) Daftar tunggu jam penuh: semua pembeli di daftar tunggu dikabari bersamaan hanya kalau jam itu masih memenuhi rumus jam tercepat; yang lebih dulu menekan Bayar mendapat tempat.
   7. (10) Undang karyawan dan pengelola banyak tenant.
   8. (11, sisa) Tangguhkan akun, atur biaya untuk pesanan baru (khusus admin), catatan aktivitas yang dibaca semua anggota tim, kabar untuk tim, dasbor per tenant.
   9. (12) Kebijakan privasi dan syarat (draf untuk ditinjau, tanpa klaim kepatuhan), penjelasan cara kerja yang bisa dilewati, hapus akun dari profil (Edge Function `hapus-akun`).
   10. (13) Cloudflare Web Analytics dan ping harian supaya proyek Supabase gratis tidak dijeda.
6. **Dokumen**: `README.md` untuk Mac dan Windows (Node LTS, Git, clone, `npm install`, `npm run dev`, Device Toolbar Chrome), pembaruan PRD (status fitur), dan berkas ini.

Prinsip kalau waktu tidak cukup: inti (pesan, bayar, ambil, papan penjual, Simulator Bayar, naskah demo) harus berjalan benar di cloud lebih dulu. P1 yang belum selesai dicatat apa adanya di PRD dan di presentasi.

## 10. Tugas dashboard Haidar

Langkah lengkap ada di `docs/PANDUAN-AKUN.md`. Ringkasnya:

1. Cloudflare Workers Builds: Workers & Pages, Create application, Import a repository, pilih repo `haidarsfw/jaminin`, nama Worker `jaminin` (harus sama dengan `wrangler.jsonc`), cabang produksi `claude/adoring-brown-y5df83`, build command `npm run build`, deploy command `npx wrangler deploy`, lalu Save and Deploy.
2. Supabase, Authentication, URL Configuration: Site URL = alamat workers.dev; Redirect URLs = `http://localhost:5173/**` dan `https://<alamat workers.dev>/**`.
3. SMTP Gmail khusus Jaminin (Sandi Aplikasi) di `https://supabase.com/dashboard/project/sbxowjvnkoxmsyuzmcpv/auth/smtp`.
4. Google OAuth: OAuth client jenis Web di Google Cloud dengan redirect `https://sbxowjvnkoxmsyuzmcpv.supabase.co/auth/v1/callback`, lalu Client ID dan Client Secret diisi langsung di provider Google Supabase (tidak lewat chat).
5. Mendaftar di aplikasi, lalu dijadikan admin lewat perintah sekali jalan yang dijalankan agen lewat konektor (email diketik hanya di perintah itu, tidak pernah di-commit): `insert into public.team_members (user_id, role) select id, 'admin' from auth.users where email = '<email Haidar>' on conflict do nothing;`. Anggota lain mendaftar sendiri lalu ditambahkan Haidar di halaman Tim, Anggota.
6. Menyetujui permintaan konektor saat migrasi 1200 dan 1300 dipasang dan saat akun uji cloud dihapus.
7. Membuat ulang kunci Context7 dan menyimpannya sebagai rahasia lingkungan `CONTEXT7_API_KEY`.

## 11. Checklist Senin, 12 Oktober

1. Semua migrasi terpasang di cloud dan `kirim-kabar` versi terbaru ter-deploy.
2. Workers Builds tersambung, alamat workers.dev hidup, URL Configuration Supabase terisi.
3. Uji cloud terhadap alamat workers.dev: `JAMININ_URL=https://<alamat> JAMININ_CLOUD_SANDI=... npx playwright test -c playwright.cloud.config.ts`.
4. Haidar sudah menjadi admin, anggota lain ditambahkan.
5. Uji di perangkat asli: iPhone iOS 18.4 ke atas (pasang ke layar utama untuk push), Android Chrome, iPad, MacBook, laptop Windows.
6. Laporan PASS/FAIL Delivery Gate antislop untuk layar utama.
7. `README.md` untuk Mac dan Windows.
8. Latihan naskah demo (PRD bagian 18) dua kali, dengan Reset demo di antaranya. Pastikan mode demo menyala.

## 12. Hal teknis yang mudah salah

- Semua aturan jam memakai WIB. Pakai `todayWib`, `tomorrowWib`, `wibDate` di `src/lib/format.ts` dan `private.today_wib()` di database. Jangan memotong `toISOString()`.
- Jam tercepat = sekarang + 5 menit batas bayar + batas waktu pesan penjual + lama menyiapkan menu terlama, dibulatkan ke kelipatan 5 menit berikutnya (contoh: 10.47 menjadi 11.10). Jam ambil hanya hari ini atau besok.
- Uang dalam rupiah bulat. Biaya layanan Rp1.000 dari pembeli dan potongan Rp1.000 dari penjual, keduanya tidak berlaku untuk pesanan batal.
- Kuota per pesanan per jam ambil, dikunci di database saat pesanan dibuat. Status lunas hanya lewat `internal_confirm_payment`, dipanggil Edge Function.
- Kode galat dari database (`raise exception '<kode>'`) ditampilkan lewat kunci `galat.<kode>` di `id.json` dan `en.json`. Uji `tests/unit/i18n.test.ts` gagal kalau ada kode galat di migrasi yang belum diterjemahkan.
- Jenis kabar baru wajib ditambahkan di empat tempat: fungsi database yang memanggil `private.notify` atau `private.notify_tenant`, `KABAR_KINDS` dan teks di `src/features/kabarText.ts`, kunci `kabar.<jenis>` di kedua berkas bahasa, dan objek `TEXT` di `supabase/functions/kirim-kabar/index.ts`.
- i18n: berkas `id` memakai kunci dasar, berkas `en` memakai `_one` dan `_other` untuk jamak.
- Realtime: pakai `useTopic(topik, [event], callback)` dari `src/lib/realtime.ts`. Satu channel bersama per topik, dilepas tertunda 2 detik. Topik: `user:<id>`, `order:<id>`, `tenant:<id>`, `team`. Isi siaran hanya ID; data diambil ulang lewat select yang dijaga RLS. Selalu sediakan polling cadangan (`refetchInterval`).
- Panel demo: perpindahan akun memanggil `navigate` dulu lalu `queryClient.resetQueries()`. Urutan sebaliknya memicu galat `not_team`.
- Rute TanStack dibuat otomatis oleh plugin Vite (`routeTree.gen.ts`). Berkas rute hanya mengekspor `Route`; komponen bantu ditaruh di `src/features` atau `src/components`.
- Playwright memakai mode ketat: selector harus menunjuk tepat satu elemen (`exact: true`, role, atau dibatasi ke `section` atau `dialog`).
- `kirim-kabar` tidak bisa berjalan di Supabase lokal (impor `jsr:` gagal karena TLS proxy container). Uji push hanya di cloud.
- Konektor Supabase: `apply_migration` dan `execute_sql` habis waktu sekitar 60 detik kalau permintaan persetujuan tidak dijawab. Setelah habis waktu, selalu cek ulang keadaan cloud sebelum mencoba lagi.
- Varian Tailwind `print:` dipakai untuk struk: bingkai aplikasi diberi `print:hidden`.

## 13. Riwayat hambatan dan keputusan teknis

- Konektor meminta konfirmasi untuk migrasi yang berisi lebih dari satu DELETE. Migrasi 700 dipecah menjadi 700 dan 750, penghapusan dipindah ke fungsi bantu satu DELETE (`private.purge_*`, `private.clear_tenant_hours`, `private.clear_quota_rules`). Riwayat migrasi cloud dirapikan sekali lewat fungsi sementara di `pg_temp` (sudah dilaporkan ke Haidar). Sesudah itu diputuskan tidak menyamarkan perintah perusak lagi; migrasi berikutnya menunggu persetujuan Haidar.
- Proxy container cloud Claude tidak meneruskan WebSocket, sehingga Realtime cloud tidak bisa diuji dari container. Aplikasi tetap terbarui lewat polling cadangan. Uji cloud memakai `JAMININ_TANPA_WEBSOCKET=1`.
- `npm audit` menemukan kerentanan `sharp` di miniflare (bawaan Wrangler). Ditutup dengan `overrides` sharp 0.35.5 di `package.json`.
- Uji naskah demo menemukan dua cacat yang sudah diperbaiki: formulir pendaftaran penjual tidak memindahkan fokus ke isian bergalat, dan panel demo memicu galat `not_team` saat berpindah akun.
- Teks kabar dipindah ke `kabarText.ts` dengan impor relatif supaya bisa diuji Vitest tanpa memuat modul browser.
