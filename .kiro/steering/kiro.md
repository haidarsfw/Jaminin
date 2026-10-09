# Jaminin di Kiro CLI

Berkas ini melengkapi `CLAUDE.md` (dimuat otomatis lewat `.kiro/steering/claude.md`) dan aturan Context7 (`.kiro/steering/aturan-claude/`). Isinya hanya hal yang berbeda saat Jaminin dikerjakan dengan Kiro CLI di laptop Haidar, bukan di container cloud Claude.

## Awal setiap sesi

1. Baca `HANDOFF.md` sampai habis sebelum menyentuh kode. Bagian 9 berisi posisi kerja terakhir. Berkas ini sengaja tidak dimuat otomatis karena besar.
2. Cek `git status` dan `git log --oneline -10`.
3. Kalau perlu Supabase lokal: `colima start`, lalu `npm run db:start`.

## Cara bekerja

- Selalu bertanya kalau ragu, jangan berasumsi (`CLAUDE.md` aturan 1). Pertanyaan berupa pilihan dengan rekomendasi di urutan pertama.
- Haidar mengizinkan eksekusi langsung untuk keputusan yang sudah tercatat. Tetap tanyakan dulu untuk hal yang bisa menimbulkan biaya, menghapus data sungguhan, atau mengubah aturan uang.
- Balasan chat: bahasa Indonesia, kalimat utuh, bahasa awam. Mode caveman Claude tidak dipakai.
- Alat yang dipakai hanya yang dibutuhkan Jaminin: 14 skill proyek di `.kiro/skills`, antislop, Supabase CLI, Context7 lewat `npx ctx7`, git dan `gh`, serta MCP di `.kiro/settings/mcp.json`.

## Antislop

Dipakai otomatis sesuai jenis pekerjaan, tanpa menunggu diminta dan tanpa bertanya mode:

- Teks (dokumen, README, teks di `src/locales`): antislop dan antislop-copywriting.
- Tampilan (halaman, komponen, gaya): antislop, antislop-ui, antislop-human, dan antislop-layoutmobile, ditambah antislop-copywriting untuk teksnya.
- Kode: antislop dan antislop-code, ditambah skill tampilan di atas kalau kodenya membuat tampilan.
- Pertanyaan singkat: cukup jawab tanpa pola tulisan AI seperti tanda pisah panjang, kata promosi kosong, dan basa-basi.

Laporan PASS/FAIL Delivery Gate hanya ditampilkan untuk hasil tampilan. Pasangan warna dicek dengan alat MCP `check_contrast` (server `antislop-contrast`), atau `python3 .kiro/skills/antislop-human/contrast-check.py "#FFFFFF" "#777777"`.

Di laptop Haidar, keenam skill antislop berupa tautan dari `.kiro/skills/antislop*` ke `~/.agents/skills`. Tautan itu dan `.kiro/settings/` tidak di-commit (dikecualikan lewat `.git/info/exclude`) karena menunjuk ke berkas di luar repo.

## Bagian `CLAUDE.md` dan `HANDOFF.md` yang tidak berlaku di laptop ini

- `GH_TOKEN`, `GITHUB_TOKEN`, dan `env -u GH_TOKEN -u GITHUB_TOKEN`: git dan `gh` memakai login akun haidarsfw di Keychain.
- `JAMININ_TANPA_WEBSOCKET`: WebSocket berjalan normal di laptop.
- Menyalakan `dockerd` manual: Docker berjalan lewat Colima.
- Konektor Supabase MCP: pakai Supabase CLI (`npx supabase`) yang sudah login dan terhubung ke proyek `sbxowjvnkoxmsyuzmcpv`.

## Supabase cloud lewat CLI

- Proyek sudah terhubung (`supabase/.temp/project-ref`). Jangan meminta kunci atau sandi di chat.
- Membaca: `npx supabase db query --linked "<sql>"` dan `npx supabase migration list --linked`.
- Memasang migrasi baru: `npx supabase db push --linked --dry-run` dulu, lalu `npx supabase db push --linked`. Riwayat migrasi tercatat otomatis, jadi langkah menyamakan versi di `HANDOFF.md` bagian 7 tidak diperlukan.
- Deploy Edge Function: `npx supabase functions deploy <nama> --no-verify-jwt` (semua fungsi Jaminin memeriksa pemanggil sendiri).
- Perintah yang mengubah atau menghapus data cloud dijalankan setelah Haidar setuju di chat, dan diuji dulu di database lokal.

## Sentry

MCP `sentry` (`https://mcp.sentry.dev/mcp`) untuk membaca galat aplikasi di proyek Sentry `jaminin`. Login lewat OAuth di browser saat pertama kali tersambung. Tidak ada kunci yang ditulis di repo atau di chat.

## Lingkungan lokal

- Docker: Colima (`colima start`, `colima stop`). Port kontainer dibatasi ke 127.0.0.1 lewat `docker.ip` di `~/.colima/default/colima.yaml`.
- Supabase lokal: `npm run db:start` menyalakan semua layanan yang dibutuhkan uji. Kalau disk sempit, `npx supabase start -x studio,logflare,vector,imgproxy`.
- Ruang disk Mac terbatas (sekitar 5 GiB kosong setelah Supabase lokal terpasang). Hentikan dengan `npm run db:stop` lalu `colima stop` kalau tidak dipakai.
- `.env.local` menunjuk ke Supabase lokal dan diabaikan git.
- Chromium Playwright ada di `~/Library/Caches/ms-playwright` (bukan `/opt/pw-browsers`). Paket Python `playwright` 1.56.0 terpasang untuk skill `webapp-testing`.

## Commit

Pesan commit bahasa Indonesia, diakhiri baris:

```
Dibuat-dengan: Kiro CLI (Claude Opus 5.5)
```
