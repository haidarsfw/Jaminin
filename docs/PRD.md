# PRD Jaminin Versi Pertama

Dokumen kebutuhan produk untuk prototipe Jaminin yang didemonstrasikan pada Senin, 12 Oktober 2026.

Disusun 7 Oktober 2026 dari dua sumber: file "Jaminin: Penjelasan Lengkap dalam Bahasa Umum" (7 Oktober 2026) dan 30 ronde jawaban Haidar pada hari yang sama. Kalau isi file penjelasan berbeda dengan PRD ini, PRD ini yang berlaku.

Status dokumen: draf untuk direview Haidar dan tim. Pembangunan prototipe dimulai setelah PRD ini disetujui.

## Panduan review

Bagian yang paling perlu dibaca saat review:

1. Bagian 5 (aturan inti) dan bagian 9 (aturan saat ada masalah). Semua aturan ini akan dijalankan otomatis oleh sistem, jadi kesalahan kecil di sini terbawa ke seluruh aplikasi.
2. Bagian 13 (daftar fitur dan prioritas). P0 wajib sempurna untuk demo. P1 dikerjakan berurutan setelah P0 lulus uji.
3. Bagian 18 (naskah demo 10 menit).
4. Bagian 23 (usulan saya yang perlu persetujuan). Setiap usulan diberi kode U1, U2, dan seterusnya, dan kode itu muncul di bagian lain tempat usulan dipakai.
5. Bagian 20 (keputusan yang masih terbuka atau sengaja ditunda).

Cara memberi masukan: sebut nomor bagian atau kode usulan, lalu tulis setuju, tidak setuju, atau perubahan yang diinginkan.

## Daftar isi

1. Cara membaca
2. Ringkasan
3. Peran
4. Lingkup
5. Aturan inti
6. Alur pembeli
7. Alur penjual
8. Alur tim Jaminin
9. Aturan saat ada masalah
10. Status pesanan
11. Kabar dan notifikasi
12. Uang
13. Daftar fitur, prioritas, dan kriteria terima
14. Peta layar
15. Persyaratan non-fungsional
16. Arsitektur dan techstack
17. Data contoh dan mode demo
18. Naskah demo 10 menit
19. Cost dan sell price
20. Keputusan terbuka dan yang ditunda
21. Risiko
22. Rencana kerja dan jadwal
23. Usulan yang perlu persetujuan dan usulan slogan
24. Daftar istilah

## 1. Cara membaca

Tanda status:

| Tanda | Arti |
|---|---|
| (tanpa tanda) | Diputuskan. Berasal dari jawaban Haidar, file penjelasan yang tidak diubah, atau akibat langsung dari keduanya. |
| Usulan Ux | Keputusan kecil dari Claude yang perlu disetujui. Daftarnya di bagian 23. |
| Ditunda | Sengaja diputuskan nanti, biasanya sebelum Jaminin menerima uang sungguhan. |
| Terbuka | Belum ada jawabannya dan perlu dicek ke pihak lain. |

Prioritas:

| Prioritas | Arti |
|---|---|
| P0 | Inti. Wajib berjalan sempurna untuk demo Senin. Dibangun dan diuji lebih dulu. |
| P1 | Dikerjakan berurutan setelah semua P0 lulus uji. Yang belum selesai sebelum Senin dilanjutkan setelah demo. |
| Nanti | Dicatat, tidak dibangun di versi pertama. |

Semua jam di dokumen ini memakai Waktu Indonesia Barat (WIB) dan format 24 jam, contoh 11.05.

## 2. Ringkasan

Jaminin adalah aplikasi untuk memesan makanan dan minuman dari tenant kantin BINUS @Bekasi. Pembeli memilih menu, memilih jam ambil yang tersedia tiap 5 menit, membayar di muka, menerima kabar saat pesanan mulai disiapkan dan siap, lalu mengambil sendiri dengan menunjukkan kode, tanpa mengantre. Jaminin tidak mengantar pesanan dan tidak memakai kurir.

Penjual mengetahui pesanan lebih awal sehingga bisa menyiapkannya sebelum pembeli datang, membatasi jumlah pesanan per jam ambil lewat kuota, dan menerima setoran pada hari yang sama. Tim Jaminin menyetujui penjual baru, menangani laporan pembeli, dan memantau uang.

### 2.1 Masalah yang diselesaikan

Dari wawancara 10 mahasiswa BINUS @Bekasi (30 September dan 5 Oktober 2026):

- Jeda antarkelas 20 menit, dan antrean memotong jeda itu. Sembilan responden menyebut antrean secara langsung.
- Delapan dari 10 responden pernah tidak makan, menunda makan, atau melewatkan makanan berat karena waktu mepet.
- Empat responden tidak bisa memperkirakan kapan makanannya selesai.
- Hanya 1 dari 10 responden bercerita sampai terlambat masuk kelas. Yang lebih sering dikorbankan adalah makanannya.

Dari sisi penjual, dokumen lama menduga tiga kerugian: pembeli batal karena antrean panjang, porsi yang disiapkan tidak sesuai kebutuhan, dan dapur kosong di jam sepi. Ketiganya belum diuji karena belum ada tenant yang diwawancarai.

### 2.2 Tujuan versi pertama

Prototipe yang berjalan untuk demo sekitar 10 menit pada Senin, 12 Oktober 2026, di HP dan laptop bersamaan. Pembayaran disimulasikan. Biaya menjalankan Rp0.

Demo dianggap berhasil kalau:

1. Alur pesan, pilih jam ambil, bayar (simulasi), terima kabar, dan ambil berjalan ujung ke ujung di HP dan laptop tanpa error.
2. Pesanan yang dibayar di HP pembeli muncul di layar penjual dalam beberapa detik tanpa memuat ulang halaman, dan setiap perubahan status oleh penjual langsung terlihat di HP pembeli.
3. Semua aturan di bagian 5 dan bagian 9 dijalankan oleh sistem, tanpa campur tangan orang.

### 2.3 Prinsip pemakaian

Dari file penjelasan bagian 6 dan jawaban Haidar:

- Tidak ribet, tidak banyak klik, cepat, akurat, clean, clear, smooth, fluid.
- Tidak ada langkah yang menunggu balasan manusia. Pesanan langsung diterima begitu lunas.
- HP lebih dulu, lalu iPad, lalu laptop, dengan kenyamanan yang sama di ketiganya.
- Fungsi dibuat lengkap dan benar lebih dulu dengan tampilan rapi dan sederhana. Haidar sendiri yang memoles tampilan setelahnya.
- Tampilan sementara berstatus draf tanpa arah desain, tetapi tidak boleh terlihat seperti buatan AI. Aturan antislop, Impeccable, taste-skill, dan frontend-design dipakai bersamaan dengan urutan prioritas itu. Logo sementara berupa tulisan "Jaminin".
- Referensi untuk tahap poles tampilan: Mobbin, 21st.dev, Awwwards, dan Seesaw (https://www.seesaw.website/). Seesaw berisi situs web utuh yang cocok untuk arah merek dan halaman depan, sedangkan pola layar aplikasi lebih banyak ditemukan di Mobbin.

## 3. Peran

Satu akun bisa memegang lebih dari satu peran. Contoh: anggota tim Jaminin juga bisa memesan sebagai pembeli.

| Peran | Siapa | Yang bisa dilakukan |
|---|---|---|
| Pembeli | Siapa saja yang punya akun: mahasiswa, dosen, staf, tamu. | Memesan, membayar, membatalkan dan menggeser sesuai aturan, mengambil, melapor, menghubungi penjual. |
| Pemilik tenant | Orang yang mendaftarkan tenant. | Semua pengaturan tenant: menu, harga, jam buka, kuota, batas waktu pesan, rekening, jam setoran, karyawan, ditambah semua yang bisa dilakukan karyawan. |
| Karyawan tenant | Orang yang diundang pemilik. | Hanya menangani pesanan: melihat, menandai tahap, menyerahkan, menandai menu habis, menutup pesanan sementara. Tidak bisa mengubah harga, menu, kuota, atau rekening. |
| Pengelola | Pemilik lebih dari satu tenant dengan satu akun, misalnya pihak yang mengelola beberapa kios kantin. | Berpindah antar-tenant yang ia pegang dan melihat rekap gabungan. Tiap tenant tetap punya menu, kuota, dan setoran sendiri. |
| Admin tim Jaminin | Saat ini keempat anggota kelompok: Haidar Shofwan Bani, Abdul Azis, Dafi Ardian Pasha, Muhammad Evan Maulana Rifqi. | Semua urusan tim, termasuk anggota tim, pengaturan biaya, setoran, uang kembali manual, dan menangguhkan akun. |
| Staf tim Jaminin | Belum ada saat ini. Bisa ditambahkan admin kapan saja. | Urusan operasional: menyetujui penjual, menangani laporan, melihat pesanan. Tidak bisa mengubah uang, biaya, atau anggota tim. |

## 4. Lingkup

### 4.1 Masuk versi pertama

- Makanan dan minuman dari tenant kantin BINUS @Bekasi.
- Pesan, pilih jam ambil, bayar di muka (simulasi), ambil sendiri.
- Penjual mendaftar sendiri dan mengatur tokonya sendiri setelah disetujui tim.
- Kabar status pesanan di dalam aplikasi dan lewat notifikasi push.
- Batal, geser jam ambil, menu habis, dan uang kembali sesuai aturan bagian 9.
- Setoran harian ke penjual (disimulasikan).
- Laporan masalah ke tim Jaminin.
- Bahasa Indonesia dan Inggris. Tema terang dan gelap.
- Semua fitur di bagian 13 dengan prioritas P0 dan P1.

### 4.2 Tidak masuk versi pertama

- Pengantaran dan kurir. Tidak akan ada sama sekali.
- Pembayaran dengan uang sungguhan dan penyedia pembayaran. Ditunda.
- Kabar lewat WhatsApp.
- Kategori selain makanan dan minuman, booking tempat, fitur cari teman main, lokasi di luar kantin BINUS @Bekasi.
- Aplikasi di App Store dan Play Store. Jaminin berbentuk aplikasi web yang bisa dipasang ke layar utama.

### 4.3 Dicatat untuk nanti

Pesanan rombongan, voucher dari Jaminin, kategori dan lokasi lain (fotokopi, laundry, barbershop, cuci motor, lapangan, kampus lain), denah kantin, Beehive (minimarket milik BINUS) sebagai penjual, iklan dan tampil di urutan atas, langganan bulanan penjual, kabar WhatsApp, penyedia pembayaran sungguhan, domain sendiri.

## 5. Aturan inti

### 5.1 Jam ambil

- Jam ambil tersedia tiap 5 menit: 11.00, 11.05, 11.10, dan seterusnya.
- Hanya di dalam jam buka penjual, mengikuti jadwal mingguan (boleh beberapa rentang per hari) dan jam khusus atau libur di tanggal tertentu (P1).
- Untuk hari ini atau besok saja.
- Pesanan boleh dibuat kapan saja, termasuk saat penjual sedang tutup, selama jam ambilnya berada di jam buka hari ini atau besok. Contoh: malam ini memesan untuk jeda besok pagi.

### 5.2 Jam ambil paling cepat

Jam ambil paling cepat = waktu sekarang + 5 menit batas bayar + batas waktu pesan penjual + lama menyiapkan menu terlama di keranjang, lalu dibulatkan ke kelipatan 5 menit berikutnya.

Contoh: sekarang 10.47, batas waktu pesan penjual 5 menit, menu terlama (katsu) butuh 12 menit. 10.47 + 5 + 5 + 12 = 11.09, dibulatkan menjadi 11.10.

Batas bayar ikut dihitung supaya pembeli selalu punya 5 menit penuh untuk membayar dan dapur tetap mendapat waktu yang diminta penjual.

Sebuah jam ambil hanya ditawarkan kalau semua syarat ini terpenuhi:

1. Tidak lebih awal dari jam ambil paling cepat.
2. Berada di jam buka penjual pada hari itu.
3. Penjual tidak sedang menutup pesanan sementara.
4. Kuota jam itu masih tersisa.
5. Batas pesanan per hari penjual belum tercapai (P1).
6. Tenant berstatus disetujui dan tidak ditangguhkan.

Kalau jam ambil paling cepat jatuh setelah penjual tutup hari ini, yang ditawarkan adalah jam buka besok.

### 5.3 Batas waktu pesan dan lama menyiapkan

- Batas waktu pesan: paling lambat berapa menit sebelum jam ambil sebuah pesanan boleh masuk. Diatur tiap penjual. Nilai awalnya 5 menit, dan penjual bebas mengubahnya, termasuk menjadi 0 menit.
- Lama menyiapkan: diisi penjual untuk tiap menu, dalam menit.

### 5.4 Kuota

- Kuota adalah jumlah pesanan paling banyak untuk satu jam ambil (5 menit) di satu tenant.
- Dihitung per pesanan, berapa pun isinya.
- Tidak punya nilai awal. Penjual wajib mengisi kuota dasar saat mendaftar.
- Penjual boleh menambah aturan kuota per rentang jam, contoh 11.00 sampai 13.00 kuota 2, sedangkan jam lain memakai kuota dasar (Usulan U8).
- Pesanan yang menunggu pembayaran ikut menahan kuota selama batas bayar. Kalau tidak dibayar, kuotanya dilepas.
- Pembeli melihat sisa kuota di tiap jam ambil, contoh "sisa 1".
- Kalau jam yang diinginkan penuh, aplikasi menawarkan jam berikutnya yang tersedia.

### 5.5 Pesanan dan keranjang

- Satu pesanan hanya untuk satu penjual. Pesanan ke penjual lain dibuat terpisah dan boleh berjalan bersamaan.
- Hanya ada satu keranjang aktif. Kalau pembeli menambah menu dari tenant lain, muncul konfirmasi: "Ganti keranjang? Isi keranjang dari [tenant] akan dihapus."
- Satu pembeli hanya boleh punya satu pesanan yang menunggu pembayaran sekaligus.
- Pesanan otomatis diterima begitu lunas, tanpa persetujuan penjual.

### 5.6 Batas bayar

Pembeli punya 5 menit untuk membayar setelah pesanan dibuat. Lewat dari itu, pesanan gugur otomatis dan kuota serta stoknya dilepas.

### 5.7 Biaya per pesanan

- Pembeli membayar Biaya layanan Rp1.000 di atas harga makanan.
- Penjual dipotong Rp1.000 dari bagian penjualannya.
- Jaminin menerima Rp2.000 per pesanan, berapa pun isinya.
- Kalau pesanan batal, potongan Rp1.000 penjual tidak ditagih dan Biaya layanan pembeli ikut dikembalikan.
- Nama "Biaya layanan" dipilih supaya tidak terkesan sebagai biaya QRIS. Biaya QRIS (MDR) tidak boleh dibebankan ke pembeli. Pemeriksaan hukumnya masih Terbuka (bagian 20).
- Admin bisa mengubah kedua angka itu dari dasbor (P1).

## 6. Alur pembeli

### 6.1 Masuk dan profil

1. Pembeli membuka Jaminin dari HP, iPad, atau laptop. Bahasa yang tampil pertama selalu Indonesia.
2. Pembeli masuk dengan akun Google, atau mendaftar dan masuk dengan email + kata sandi. Daftar dengan email tidak memerlukan konfirmasi email. Kata sandi minimal 8 karakter (Usulan U20).
3. Kalau lupa kata sandi, pembeli meminta tautan atur ulang yang dikirim ke emailnya.
4. Setelah masuk pertama kali, pembeli mengisi formulir profil satu kali:
   - Nama asli. Terisi otomatis dari Google dan bisa diubah. Nama ini yang dilihat penjual saat pengambilan, karena nama akun Google sering acak atau bukan nama asli.
   - Nomor WhatsApp. Wajib, untuk keperluan kabar dan dihubungi penjual atau tim. Diperiksa formatnya saja, tanpa kode OTP.
   - Status: mahasiswa, dosen, staf, atau tamu.
5. Pembeli belum bisa memesan sebelum profil lengkap.
6. Penjelasan singkat cara kerja muncul saat pertama dibuka dan bisa dilewati (P1).

### 6.2 Memilih tenant dan menu

1. Beranda menampilkan daftar tenant yang disetujui, masing-masing dengan lokasi kios, status buka atau tutup, dan jam ambil paling cepat ("Paling cepat 11.10"). Jam di daftar ini dihitung dengan menu tercepat di tenant itu, karena keranjang belum diisi (Usulan U5).
2. Daftar diurutkan dari yang paling cepat siap. Pembeli bisa mengganti urutan ke abjad (Usulan U6).
3. Tombol cepat jam istirahat di atas daftar: 09.05, 11.05, 13.05, 15.05, 17.05, 19.05. Jeda kuliah BINUS @Bekasi jatuh pada jam 9, 11, 13, 15, 17, dan 19, dan kelas berikutnya dimulai 20 menit kemudian, termasuk jeda sore (masuk 17.20). Memilih salah satu menandai tenant mana yang masih bisa melayani jam itu, dan jam itu langsung terpilih di checkout kalau masih tersedia (Usulan U7). Dengan jam buka contoh (Senin sampai Jumat, 07.00 sampai 17.00), tombol 17.05 dan 19.05 tampil tutup untuk tenant contoh.
4. Pencarian menu lintas tenant beserta jam ambil tercepatnya (P1), filter penanda menu (P1), dan favorit (P1).
5. Halaman tenant menampilkan lokasi kios, jam buka hari ini, pengumuman tenant (P1), dan menu per kategori. Tiap menu menampilkan nama, harga (bertanda "harga contoh" untuk data contoh), lama menyiapkan, penanda (pedas, vegetarian, dingin, panas, dan halal hanya kalau dinyatakan penjual), tanda "bisa diatur" kalau punya pilihan tambahan, dan tanda "Habis" yang membuat menu itu tidak bisa dipesan.
6. Memilih menu membuka rincian menu: pilihan tambahan (wajib atau opsional, minimal dan maksimal pilihan, tambahan harga kalau ada, contoh extra keju +Rp3.000) dan jumlah.

### 6.3 Keranjang dan checkout

1. Keranjang menampilkan isi, jumlah yang bisa diubah, dan subtotal.
2. Checkout:
   - Pilih hari: hari ini atau besok.
   - Pilih jam ambil dari daftar jam 5 menit. Tiap jam menampilkan status: tersedia dengan sisa kuota, penuh, tutup, atau berpromo (P1). Jam penuh bisa dipakai untuk masuk daftar tunggu (P1).
   - Nama pengambil. Terisi nama profil, bisa diganti dengan nama lain untuk memesankan teman.
   - Makan di sini atau bungkus.
   - Permintaan alat makan.
   - Catatan untuk penjual, maksimal 200 karakter, dengan penghitung sisa karakter.
   - Ringkasan: isi pesanan, subtotal, potongan promo (P1), Biaya layanan Rp1.000, total.
3. Tombol "Bayar Rp[total]" membuat pesanan berstatus menunggu pembayaran dan menahan kuota jam itu.
4. Kalau jam yang dipilih ternyata baru saja penuh saat tombol ditekan, aplikasi menampilkan jam berikutnya yang tersedia untuk dipilih.

### 6.4 Pembayaran (simulasi)

1. Halaman bayar menampilkan QR simulasi, kode bayar 6 karakter, nominal, dan hitung mundur 5 menit. Di QR tertulis "QR simulasi, bukan QRIS" (Usulan U15).
2. Di demo, pembayaran dilakukan dari halaman Simulator Bayar di laptop (bagian 8.3): pindai QR atau ketik kode bayar, lalu tekan Bayar.
3. Begitu lunas, halaman bayar di HP pembeli berubah sendiri menjadi "Lunas, pesanan diterima" tanpa disentuh, lalu menuju halaman status pesanan.
4. Kalau waktu bayar habis: "Waktu bayar habis. Jam ambilnya sudah dilepas untuk pembeli lain." dengan tombol untuk memilih jam lagi. Isi keranjang tetap ada.
5. Pembeli bisa membatalkan sebelum membayar. Pesanan langsung gugur dan kuotanya dilepas.
6. Setelah pembayaran pertama kali, pembeli iPhone atau iPad yang belum memasang Jaminin ke layar utama melihat panduan pemasangan (bagian 11.3).

### 6.5 Selama menunggu

1. Halaman status pesanan menampilkan nama tenant, nomor urut (contoh #023), jam ambil, hitung mundur menuju jam ambil, dan lini waktu: Pesanan diterima, Mulai disiapkan, Siap diambil, Selesai.
2. Kode ambil 4 karakter (contoh K7Q2) dan QR-nya tampil di halaman yang sama dan tetap bisa dibuka tanpa sinyal.
3. Tombol yang muncul sesuai keadaan:
   - Batalkan: selama penjual belum mulai menyiapkan.
   - Geser jam ambil: selama penjual belum mulai menyiapkan dan belum pernah digeser.
   - Batalkan dengan uang kembali penuh: mulai tepat jam ambil, kalau pesanan belum siap.
   - Pilih pengganti: kalau ada menu yang habis (bagian 9).
   - Hubungi penjual: tombol WhatsApp ke nomor penjual dengan pesan berisi nomor pesanan, dan chat di aplikasi (P1).
   - Laporkan masalah.
   - Bagikan kode ambil, untuk pesanan yang diambilkan teman.
   - Tambah ke kalender (P1).
4. Pembeli menerima kabar di aplikasi dan lewat notifikasi push (bagian 11).
5. Halaman "Pesanan" menampilkan semua pesanan aktif sekaligus, karena beberapa pesanan boleh berjalan bersamaan.

### 6.6 Pengambilan

1. Pembeli atau temannya datang ke tenant, menyebut nomor urut, lalu menunjukkan kode ambil atau QR.
2. Penjual mencocokkan kode atau memindai QR, lalu menekan Serahkan. Pembeli juga boleh menekan "Sudah saya terima". Mana pun yang lebih dulu menyelesaikan pesanan.
3. Kalau pembeli terlambat, pesanan yang sudah siap tetap bisa diambil sampai penjual tutup.
4. Setelah selesai, pembeli bisa memberi penilaian jempol atas atau bawah dan komentar singkat yang hanya terlihat oleh penjual dan tim (P1), dan melihat struk digital (P1).

### 6.7 Profil dan riwayat

- Profil: nama asli, nomor WhatsApp, status, bahasa, tema (ikuti HP, terang, gelap), menit pengingat jam ambil (5, 10, atau 15, nilai awal 5), tombol Nyalakan kabar, panduan pasang ke layar utama, kebijakan privasi dan syarat (P1), hapus akun (P1), keluar.
- Riwayat pesanan, ringkasan pengeluaran per bulan, dan pesan ulang (P1).

## 7. Alur penjual

### 7.1 Mendaftar

Setelah masuk dan melengkapi profil, calon penjual memilih "Daftarkan tenant" dan mengisi:

1. Data dasar: nama tenant, nama penanggung jawab, nomor WhatsApp, lokasi kios di kantin, jenis (makanan, minuman, atau keduanya).
2. Pengelola: mandiri, atau dikelola pihak kantin (dengan nama pengelolanya).
3. Foto atau logo kios. Boleh dilewati dan diisi nanti (Usulan U12).
4. Jadwal buka mingguan, boleh beberapa rentang per hari.
5. Batas waktu pesan (nilai awal 5 menit).
6. Kuota dasar per jam ambil (wajib) dan aturan kuota per rentang jam (opsional).
7. Menu awal: kategori, nama menu, harga, lama menyiapkan, penanda, pilihan tambahan. Minimal satu menu.
8. Rekening setoran: bank atau e-wallet, nomor, nama pemilik rekening.
9. Jam setoran. Nilai awalnya sama dengan jam tutup, bisa diubah.
10. Persetujuan syarat: potongan Rp1.000 per pesanan (tidak ditagih untuk pesanan batal), setoran harian, aturan batal dan uang kembali, dan aturan pesanan tidak diambil.

Setelah dikirim, tenant berstatus "Menunggu persetujuan" dan belum tampil ke pembeli. Kalau ditolak, penjual melihat alasannya, memperbaiki data, lalu mengirim ulang (Usulan U9).

### 7.2 Menangani pesanan sehari-hari

1. Papan pesanan menampilkan pesanan hari ini, dikelompokkan per jam ambil, ditambah tab pesanan besok. Tiap kartu berisi nomor urut, jam ambil, nama pengambil, isi pesanan beserta pilihan tambahan, catatan, makan di sini atau bungkus, permintaan alat makan, dan statusnya.
2. Pesanan baru muncul seketika. Bunyi pesanan baru berulang sampai penjual menekan "Lihat". Di HP Android, HP juga bergetar. Penjual yang menutup halaman tetap menerima notifikasi push.
3. Penjual menandai tahap per pesanan (Mulai siapkan, Siap diambil) atau sekaligus untuk semua pesanan di satu jam ambil.
4. Saat pembeli datang, penjual mencari nomor urut, mencocokkan kode ambil atau memindai QR dengan kamera, lalu menekan Serahkan.
5. Daftar siap-masak menampilkan ringkasan per jam ambil, contoh "Untuk 11.05: 3 katsu, 2 teriyaki" (P1).
6. Mode layar dapur untuk tablet atau laptop: kartu besar, dikelompokkan per jam ambil, layar tetap menyala dan diperbarui otomatis (P1).
7. Pengingat penjual untuk pesanan yang seharusnya sudah mulai disiapkan, yaitu jam ambil dikurangi lama menyiapkan menu terlama di pesanan itu (P1).

### 7.3 Saat ada kendala

- Bahan habis: penjual menandai menu habis, sehingga menu itu tidak bisa dipesan lagi. Untuk pesanan yang sudah dibayar, penjual menandai menu yang habis di kartu pesanan, lalu pembeli memilih penyelesaiannya (bagian 9).
- Kewalahan: penjual menutup pesanan baru untuk sementara, dengan pilihan durasi atau sampai dibuka lagi (Usulan U13). Pesanan yang sudah masuk tetap dikerjakan.

### 7.4 Mengatur toko

Masuk P0: menu, kategori, harga, lama menyiapkan, penanda, pilihan tambahan, tandai habis, jadwal buka mingguan, batas waktu pesan, kuota, tutup sementara, rekening, jam setoran.

Masuk P1: foto menu, profil toko lengkap, jam khusus dan libur, stok harian per menu (menu otomatis habis saat stok nol, stok terisi ulang pukul 00.00 sesuai angka stok harian, Usulan U19), batas pesanan Jaminin per hari, promo jam sepi, pengumuman tenant, undang karyawan, pengelola banyak tenant.

Promo jam sepi (P1): penjual memasang potongan persen atau rupiah untuk hari dan rentang jam tertentu. Potongan ditanggung penjual. Jam ambil yang berpromo diberi tanda di checkout supaya pembeli terdorong memilih jam sepi.

### 7.5 Uang penjual

- Setoran harian (P0): pada jam setoran, sistem menjumlahkan pesanan yang tanggal ambilnya hari itu dan statusnya sudah final, lalu "mentransfer" otomatis ke rekening penjual (disimulasikan) dan memberi kabar. Penjual melihat daftar setoran dan rinciannya.
- Laporan penjualan harian, riwayat pesanan, dan unduh rekap Excel atau CSV (P1).

## 8. Alur tim Jaminin

### 8.1 Persetujuan penjual (P0)

Tim melihat daftar pendaftaran yang menunggu, membuka rinciannya, lalu menyetujui atau menolak dengan alasan. Penjual diberi kabar. Tenant yang disetujui langsung tampil ke pembeli.

### 8.2 Laporan dan uang kembali manual (P0)

- Pembeli melapor dari halaman pesanan: kategori (pesanan salah, uang belum kembali, lainnya), cerita, dan foto opsional.
- Tim melihat laporan beserta rincian pesanannya, membalas, dan mengubah status (baru, diproses, selesai). Balasan terlihat oleh pembeli.
- Tim bisa memberi uang kembali penuh atau sebagian dengan alasan tertulis. Uang kembali manual dibebankan ke setoran tenant itu, hari itu atau berikutnya (Usulan U10).
- Kabar untuk tim saat ada laporan baru atau pendaftaran penjual baru (P1).

### 8.3 Simulator Bayar (P0)

Halaman terpisah yang meniru aplikasi bank, dibuka di laptop saat demo:

- Siapa pun bisa memindai QR bayar dari HP pembeli dengan kamera laptop, atau mengetik kode bayar, lalu menekan Bayar.
- Daftar tagihan yang sedang menunggu hanya terlihat oleh akun tim (Usulan U14).
- Pembayaran dikonfirmasi oleh server lewat jalur yang sama dengan yang nanti dipakai notifikasi penyedia pembayaran sungguhan. Pembeli dan penjual tidak punya cara untuk menandai lunas sendiri.

### 8.4 Dasbor dan setoran

- Dasbor dasar (P0): jumlah pesanan, pendapatan Jaminin (Rp2.000 per pesanan yang tidak batal), jumlah pembatalan, dan tenant aktif, untuk hari ini dan beberapa hari terakhir. Data contoh diberi label "data contoh" di layar.
- Dasbor lengkap per tenant dan status setoran lengkap (P1).
- Daftar setoran per tenant per tanggal dengan statusnya (P0).

### 8.5 Anggota tim dan pengaturan

- Kelola anggota tim (P0): admin menambahkan anggota lewat email akun yang sudah terdaftar dan memilih perannya (admin atau staf). Admin pertama adalah email Haidar, dipasang lewat perintah sekali jalan di database (Usulan U4). Abdul Azis, Dafi, dan Evan ditambahkan setelah membuat akun.
- Tangguhkan akun pembeli atau penjual (P1).
- Atur Biaya layanan dan potongan penjual (P1).
- Catatan aktivitas (P1): setiap tindakan tim dan setiap perubahan uang tercatat, berisi siapa, kapan, dan apa.

## 9. Aturan saat ada masalah

| Kejadian | Aturan | Uang |
|---|---|---|
| Pembeli tidak membayar dalam 5 menit | Pesanan gugur. Kuota dan stok dilepas. Pembeli yang masuk daftar tunggu jam itu diberi kabar (P1). | Tidak ada uang yang berpindah. |
| Pembeli membatalkan sebelum penjual mulai menyiapkan | Boleh. | Uang kembali penuh, termasuk Biaya layanan. Potongan penjual tidak ditagih. |
| Pembeli ingin menggeser jam ambil | Boleh satu kali per pesanan, selama penjual belum mulai menyiapkan, ke jam hari ini atau besok yang masih ada kuota dan memenuhi rumus jam tercepat. | Harga dan potongan promo tetap seperti saat dibayar (Usulan U2). |
| Pesanan belum siap tepat pada jam ambil | Pembeli boleh membatalkan, dan diberi kabar bahwa ia boleh membatalkan. | Uang kembali penuh, termasuk Biaya layanan. Potongan penjual tidak ditagih. |
| Penjual menandai menu habis setelah pesanan dibayar | Pembeli memilih: ganti menu itu (hanya yang harganya sama atau lebih murah), hapus menu itu saja, atau batalkan seluruh pesanan. | Ganti lebih murah: selisih kembali. Hapus: harga menu itu kembali. Batal: uang kembali penuh. |
| Pembeli tidak merespons menu habis | Setelah 10 menit atau saat jam ambil, mana yang lebih dulu, menu itu dihapus otomatis. Kalau semua menu di pesanan habis, pesanan batal. | Harga menu yang dihapus kembali. Kalau batal, uang kembali penuh. |
| Pembeli terlambat | Pesanan yang sudah siap tetap bisa diambil sampai penjual tutup. | Tidak ada perubahan. |
| Pesanan siap tidak diambil sampai penjual tutup | Status menjadi tidak diambil. | Uang tidak kembali. Penjual tetap menerima setoran karena pesanan sudah dibayar. |
| Pesanan belum pernah ditandai siap sampai penjual tutup | Pesanan batal otomatis karena penyebabnya penjual (Usulan U1). | Uang kembali penuh. Potongan penjual tidak ditagih. |
| Penjual kewalahan | Penjual menutup pesanan baru sementara. Pesanan yang sudah masuk tetap dikerjakan. | Tidak ada perubahan. |
| Pesanan salah, uang belum kembali, atau masalah lain | Pembeli melapor lewat formulir di halaman pesanan. Pembeli juga bisa menghubungi penjual langsung lewat WhatsApp atau chat (P1). | Tim bisa memberi uang kembali manual (Usulan U10). |
| Pembeli sering membatalkan atau tidak mengambil | Dicatat dan terlihat oleh tim dan penjual. Tanpa sanksi otomatis. | Tidak ada perubahan. |

## 10. Status pesanan

### 10.1 Daftar status

| Kode | Label untuk pengguna | Arti |
|---|---|---|
| `menunggu_bayar` | Menunggu pembayaran | Pesanan dibuat, kuota ditahan, batas bayar 5 menit berjalan. |
| `kedaluwarsa` | Waktu bayar habis | Tidak dibayar dalam 5 menit. Akhir. |
| `diterima` | Pesanan diterima | Lunas dan otomatis diterima. |
| `disiapkan` | Sedang disiapkan | Penjual mulai menyiapkan. |
| `siap` | Siap diambil | Pesanan siap di tenant. |
| `selesai` | Selesai | Sudah diserahkan atau diterima. Akhir. |
| `tidak_diambil` | Tidak diambil | Siap tetapi tidak diambil sampai penjual tutup. Akhir. |
| `dibatalkan` | Dibatalkan | Akhir. Alasannya dicatat: oleh pembeli, belum siap saat jam ambil, semua menu habis, belum siap saat tutup (U1), oleh tim. |

Tanda tambahan yang tidak mengubah status utama: "perlu tindakan pembeli" (ada menu habis yang menunggu pilihan) dan "sudah digeser" (jam ambil pernah digeser).

### 10.2 Perpindahan status

| Dari | Ke | Oleh | Syarat |
|---|---|---|---|
| menunggu_bayar | diterima | Sistem (konfirmasi bayar) | Dibayar sebelum batas bayar. |
| menunggu_bayar | kedaluwarsa | Sistem | Batas bayar lewat, atau pembeli membatalkan sebelum membayar. |
| diterima | disiapkan | Penjual | Kapan saja. |
| diterima | dibatalkan | Pembeli | Sebelum disiapkan. |
| diterima atau disiapkan | dibatalkan | Pembeli | Sudah lewat jam ambil dan belum siap. |
| diterima atau disiapkan | dibatalkan | Sistem | Semua menu habis, atau penjual tutup sebelum pesanan siap (U1). |
| disiapkan | siap | Penjual | Kapan saja. |
| siap | selesai | Penjual (Serahkan) atau pembeli (Sudah saya terima) | Mana yang lebih dulu. |
| siap | tidak_diambil | Sistem | Saat penjual tutup. |
| Mana saja yang aktif | dibatalkan | Admin tim | Lewat penanganan laporan, dengan alasan. |

## 11. Kabar dan notifikasi

### 11.1 Saluran

- Di dalam aplikasi: perubahan langsung terlihat tanpa memuat ulang halaman, ditambah pusat notifikasi (P1).
- Notifikasi push: muncul di HP atau laptop walau Jaminin tertutup. Di Android dan laptop cukup memberi izin. Di iPhone dan iPad, Jaminin harus dipasang ke layar utama dulu (iOS atau iPadOS 16.4 ke atas).
- WhatsApp tidak dipakai di versi pertama.

### 11.2 Daftar kabar

| Kejadian | Penerima | Contoh isi |
|---|---|---|
| Pesanan diterima | Pembeli | "Pesanan #023 diterima. Jam ambil 11.10 di Rustic Grill BBQ." |
| Mulai disiapkan | Pembeli | "Pesanan #023 mulai disiapkan." |
| Siap diambil | Pembeli | "Pesanan #023 siap diambil. Tunjukkan kode K7Q2." |
| Pengingat jam ambil | Pembeli | Dikirim 5, 10, atau 15 menit sebelum jam ambil sesuai pilihan pembeli (nilai awal 5 menit). |
| Kabar pagi (P1) | Pembeli | Saat tenant buka, untuk pesanan hari itu yang dibuat pada hari sebelumnya. |
| Menu habis | Pembeli | Meminta pembeli memilih ganti, hapus, atau batal, dengan batas waktu 10 menit. |
| Menu habis diselesaikan otomatis | Pembeli | Menyebut menu yang dihapus dan uang yang kembali. |
| Pesanan belum siap pada jam ambil | Pembeli | Memberi tahu pembeli bahwa ia boleh membatalkan dengan uang kembali penuh. |
| Uang kembali | Pembeli | Menyebut nominal yang kembali. |
| Waktu bayar habis | Pembeli | Pesanan gugur, jam ambil dilepas. |
| Jam ambil digeser | Pembeli | Konfirmasi jam yang baru. |
| Jam di daftar tunggu tersedia (P1) | Pembeli | Semua pembeli di daftar tunggu jam itu diberi kabar bersamaan. Yang lebih dulu membayar yang mendapat tempat (Usulan U18). |
| Chat baru (P1) | Pembeli atau penjual | Isi pesan singkat. |
| Balasan laporan | Pembeli | Status dan balasan tim. |
| Pesanan baru | Penjual | Bunyi berulang sampai ditekan "Lihat", getar di Android, push. |
| Pesanan dibatalkan | Penjual | Nomor pesanan dan alasannya. |
| Pilihan pembeli atas menu habis | Penjual | Menu pengganti, menu yang dihapus, atau pesanan batal. |
| Pengingat menyiapkan (P1) | Penjual | Pesanan yang seharusnya sudah mulai disiapkan. |
| Setoran terkirim | Penjual | Nominal setoran hari itu (simulasi). |
| Pendaftaran disetujui atau ditolak | Penjual | Disertai alasan kalau ditolak. |
| Pendaftaran penjual baru, laporan baru (P1) | Tim | Ringkasan dan tautan ke halaman terkait. |

### 11.3 Ajakan memasang ke layar utama di iPhone dan iPad

Safari tidak punya tombol pasang otomatis, dan izin notifikasi di iPhone hanya bisa diminta dari ketukan pengguna di dalam aplikasi yang sudah terpasang. Karena itu:

1. Setelah pembayaran pertama, muncul panduan bergambar: Bagikan, lalu Tambah ke Layar Utama, dengan alasan yang jelas: supaya kabar "siap diambil" muncul di HP.
2. Banner kecil yang bisa ditutup. Setelah ditutup, tidak muncul lagi.
3. Tautan permanen ke panduan di halaman profil.
4. Semua ajakan disembunyikan kalau Jaminin sudah terpasang.
5. Setelah terpasang, tombol "Nyalakan kabar" meminta izin notifikasi, didahului penjelasan singkat.
6. Di Android dan laptop, Jaminin memakai tombol pasang bawaan browser.

## 12. Uang

### 12.1 Rincian per pesanan

Semua nominal dalam rupiah bulat.

- Yang dibayar pembeli = subtotal (harga menu + pilihan tambahan berbayar) dikurangi potongan promo, ditambah Biaya layanan Rp1.000.
- Bagian penjual = subtotal dikurangi potongan promo, dikurangi potongan Rp1.000.
- Pendapatan Jaminin = Rp2.000 per pesanan yang tidak batal.
- Biaya penyedia pembayaran = Rp0 di simulasi. Sebagai perkiraan, tarif QRIS Midtrans 0,7% berarti sekitar Rp147 untuk pesanan Rp21.000.

Contoh dengan harga contoh:

| | Tanpa promo | Dengan promo 10% |
|---|---|---|
| Harga makanan | Rp20.000 | Rp20.000 |
| Potongan promo (ditanggung penjual) | Rp0 | Rp2.000 |
| Biaya layanan | Rp1.000 | Rp1.000 |
| Dibayar pembeli | Rp21.000 | Rp19.000 |
| Bagian penjual | Rp19.000 | Rp17.000 |
| Pendapatan Jaminin | Rp2.000 | Rp2.000 |

### 12.2 Uang kembali

- Penuh: seluruh yang dibayar pembeli, termasuk Biaya layanan.
- Sebagian: harga menu yang dihapus, atau selisih harga menu pengganti yang lebih murah. Biaya tidak berubah.
- Di prototipe, uang kembali disimulasikan dan langsung berstatus selesai.
- Di versi sungguhan, waktu pengembalian bergantung pada penyedia pembayaran. Contoh dari dokumentasi Midtrans: bisa 1x24 jam, tetapi sebagian transaksi bisa 15 sampai 20 hari kerja, dan sebagian QRIS yang diproses lewat ShopeePay dari bank BCA, BNI, dan BRI tidak bisa dikembalikan (Terbuka, bagian 20).

### 12.3 Setoran harian

- Waktu: pada jam setoran tiap tenant. Nilai awalnya jam tutup, bisa diubah penjual.
- Isi: pesanan yang tanggal ambilnya hari itu dan statusnya sudah final (selesai atau tidak diambil). Pesanan yang belum final saat jam setoran ikut setoran berikutnya. Pesanan yang dibayar hari ini untuk diambil besok masuk setoran besok.
- Jumlah disetor = jumlah bagian penjual dari pesanan-pesanan itu, dikurangi uang kembali manual yang dibebankan ke tenant (Usulan U10).
- Rincian yang tercatat: jumlah pesanan, penjualan, potongan promo, potongan Jaminin, uang kembali yang dibebankan, jumlah disetor, rekening tujuan, waktu, dan status "Terkirim (simulasi)".
- Di prototipe, uang dicatat masuk ke Jaminin lalu disetor ke penjual (model A di file penjelasan bagian 14.7). Jalan uang final untuk versi sungguhan ditunda (bagian 20).

### 12.4 Pendapatan Jaminin

Rp2.000 per pesanan yang tidak batal (selesai atau tidak diambil). Hanya sebagai contoh cara hitung, bukan perkiraan: 1.000 pesanan dalam sebulan berarti Rp2.000.000 sebelum dipotong biaya penyedia pembayaran.

### 12.5 Simulasi pembayaran

- Tiap pesanan punya kode bayar dan QR sendiri dengan nominal tetap, meniru QRIS dinamis.
- Status lunas hanya diubah oleh server, lewat halaman Simulator Bayar di prototipe dan lewat notifikasi penyedia pembayaran di versi sungguhan. Pembeli maupun penjual tidak bisa menandai lunas sendiri. Ini menutup celah bukti bayar palsu, nominal yang diubah, dan bayar ke QR yang salah.
- Karena jalur konfirmasinya sama, mengganti simulasi dengan penyedia sungguhan nanti cukup dengan menambah penghubung ke penyedia itu, tanpa mengubah alur pesanan.

## 13. Daftar fitur, prioritas, dan kriteria terima

Kriteria terima adalah hal yang diuji sebelum fitur dianggap selesai.

### 13.1 Umum

| Kode | Fitur | Prioritas | Kriteria terima |
|---|---|---|---|
| S01 | Bahasa Indonesia dan Inggris | P0 | Pertama kali dibuka tampil Indonesia. Bahasa bisa diganti kapan saja dan diingat. Tidak ada teks yang tertinggal dalam bahasa lain. |
| S02 | Tema terang dan gelap | P0 | Mengikuti pengaturan HP, bisa dipaksa terang atau gelap. Kontras teks memenuhi WCAG AA di kedua tema. |
| S03 | Tata letak HP, iPad, laptop | P0 | Tidak ada geser ke samping di lebar 360 sampai 1440 piksel. Target sentuh minimal 44 piksel. Navigasi bawah di HP, rel samping di iPad dan laptop untuk halaman penjual dan tim. |
| S04 | Label "Draf tampilan" | P0 | Tulisan kecil di bagian bawah setiap halaman. |
| S05 | Aplikasi web yang bisa dipasang | P0 | Bisa dipasang di Android, laptop, iPhone, dan iPad. Terbuka tanpa bilah alamat. Ikon sementara berupa huruf J. |
| S06 | Pencatatan error | P0 | Error di browser tercatat di Sentry, tanpa data pribadi seperti nomor WhatsApp. |
| S07 | Mode demo | P0 | Lihat bagian 17. |
| S08 | Penjelasan cara kerja | P1 | Muncul saat pertama dibuka, bisa dilewati, tidak muncul lagi setelah dilewati. |
| S09 | Kebijakan privasi dan syarat | P1 | Draf untuk ditinjau tim, tanpa klaim kepatuhan yang belum diperiksa. Bisa dibuka dari profil dan halaman masuk. |
| S10 | Analitik pengunjung | P1 | Cloudflare Web Analytics aktif setelah deploy, tanpa cookie pelacak. |
| S11 | Ping harian Supabase | P1 | Proyek Supabase gratis tidak dijeda karena 7 hari tanpa aktivitas. |

### 13.2 Akun

| Kode | Fitur | Prioritas | Kriteria terima |
|---|---|---|---|
| A01 | Masuk dengan Google | P0 | Kembali ke Jaminin dalam keadaan masuk. Pengguna baru diarahkan ke formulir profil. |
| A02 | Daftar dan masuk dengan email + kata sandi | P0 | Tanpa konfirmasi email. Pesan error jelas untuk sandi salah atau email sudah terdaftar. |
| A03 | Lupa kata sandi | P0 | Email atur ulang terkirim dari Gmail khusus Jaminin. Tautan membawa ke halaman sandi baru. |
| A04 | Formulir profil setelah masuk pertama | P0 | Nama asli, nomor WhatsApp (format Indonesia), dan status wajib diisi sebelum bisa memesan. |
| A05 | Peran dan hak akses | P0 | Setiap peran hanya bisa melihat dan mengubah yang menjadi haknya (bagian 3), diuji di database. |
| A06 | Hapus akun | P1 | Data pribadi terhapus. Catatan transaksi disimpan tanpa identitas untuk rekap. |
| A07 | Tangguhkan akun | P1 | Akun yang ditangguhkan tidak bisa memesan atau menerima pesanan. Tenant yang ditangguhkan tidak tampil. |

### 13.3 Pembeli

| Kode | Fitur | Prioritas | Kriteria terima |
|---|---|---|---|
| B01 | Beranda tenant dengan jam tercepat | P0 | Tiap tenant menampilkan status buka dan jam tercepat. Urutan awal dari yang tercepat. |
| B02 | Tombol cepat jam istirahat | P0 | Enam tombol. Tenant yang tidak bisa melayani jam itu ditandai. Jam terpilih terbawa ke checkout. |
| B03 | Halaman tenant dan menu | P0 | Menu per kategori, tanda Habis, penanda menu, tanda bisa diatur, harga contoh bertanda. |
| B04 | Pilihan tambahan termasuk berbayar | P0 | Aturan wajib dan jumlah pilihan dipatuhi. Tambahan harga masuk ke subtotal. |
| B05 | Satu keranjang aktif | P0 | Menambah menu dari tenant lain memunculkan konfirmasi ganti keranjang. |
| B06 | Checkout lengkap | P0 | Hari, jam dengan sisa kuota, nama pengambil, makan di sini atau bungkus, alat makan, catatan maksimal 200 karakter, ringkasan biaya. |
| B07 | Tawaran jam berikutnya | P0 | Jam penuh tidak bisa dipilih dan aplikasi menunjuk jam berikutnya yang tersedia. |
| B08 | Bayar simulasi | P0 | QR dan kode bayar, hitung mundur 5 menit, berubah otomatis menjadi lunas, gugur otomatis kalau waktu habis. |
| B09 | Status pesanan realtime | P0 | Lini waktu berubah tanpa memuat ulang. Hitung mundur menuju jam ambil. |
| B10 | Nomor urut, kode ambil, QR | P0 | Tampil setelah lunas. Tetap terbuka tanpa sinyal setelah pernah dibuka. |
| B11 | Bagikan kode ambil | P0 | Lewat menu bagikan bawaan HP, berisi nomor urut, kode, tenant, dan jam ambil. |
| B12 | Batal sebelum disiapkan | P0 | Tombol hilang begitu penjual mulai menyiapkan. Uang kembali penuh tercatat. |
| B13 | Batal saat belum siap di jam ambil | P0 | Tombol muncul tepat pada jam ambil kalau status belum siap. |
| B14 | Geser jam ambil | P0 | Hanya sekali dan hanya sebelum disiapkan. Kuota jam lama dilepas, kuota jam baru dipakai. |
| B15 | Menu habis | P0 | Pilihan ganti (sama atau lebih murah), hapus, batal. Otomatis setelah 10 menit atau saat jam ambil. |
| B16 | Sudah saya terima | P0 | Menyelesaikan pesanan kalau penjual belum menekan Serahkan. |
| B17 | Tombol WhatsApp ke penjual | P0 | Membuka WhatsApp ke nomor penjual dengan pesan berisi nomor pesanan. |
| B18 | Laporan masalah | P0 | Kategori, cerita, foto opsional. Status dan balasan tim terlihat. |
| B19 | Pesanan aktif | P0 | Semua pesanan yang berjalan terlihat sekaligus. |
| B20 | Panduan pasang dan Nyalakan kabar | P0 | Sesuai bagian 11.3. |
| B21 | Pengingat jam ambil | P0 | Terkirim sesuai pilihan 5, 10, atau 15 menit. Nilai awal 5 menit. |
| B22 | Pusat notifikasi | P1 | Semua kabar tercatat, bisa ditandai sudah dibaca. |
| B23 | Struk digital | P1 | Rincian pembayaran bisa dilihat dan diunduh. |
| B24 | Tambah ke kalender | P1 | Membuat acara kalender di jam ambil. |
| B25 | Penilaian setelah ambil | P1 | Jempol dan komentar singkat, hanya terlihat oleh penjual dan tim. |
| B26 | Chat per pesanan | P1 | Pembeli dan penjual tenant itu saling mengirim pesan. Ditutup 24 jam setelah pesanan selesai (Usulan U17). |
| B27 | Riwayat dan ringkasan pengeluaran | P1 | Pesanan lama dan total belanja per bulan. |
| B28 | Pesan ulang | P1 | Isi pesanan lama masuk keranjang, menu yang habis atau berubah harga diberi tanda. |
| B29 | Favorit | P1 | Tandai tenant dan menu, tampil di bagian atas beranda. |
| B30 | Pencarian lintas tenant | P1 | Hasil berisi menu, tenant, dan jam tercepatnya. |
| B31 | Filter penanda menu | P1 | Filter pedas, vegetarian, dingin, panas, halal yang dinyatakan penjual. |
| B32 | Daftar tunggu jam penuh | P1 | Sesuai Usulan U18. |
| B33 | Tanda promo di jam ambil | P1 | Jam berpromo diberi tanda dan potongannya terlihat di ringkasan. |

### 13.4 Penjual

| Kode | Fitur | Prioritas | Kriteria terima |
|---|---|---|---|
| J01 | Pendaftaran tenant lengkap | P0 | Semua isian bagian 7.1. Tidak bisa dikirim tanpa kuota dasar, minimal satu menu, dan persetujuan syarat. |
| J02 | Papan pesanan realtime | P0 | Pesanan baru muncul dalam beberapa detik setelah lunas, tanpa memuat ulang. |
| J03 | Bunyi berulang dan getar | P0 | Bunyi berhenti setelah "Lihat" ditekan. Getar di Android. |
| J04 | Tahap per pesanan dan sekaligus | P0 | Mulai siapkan dan Siap diambil per kartu atau per jam ambil. |
| J05 | Serahkan dengan kode atau QR | P0 | Kode yang salah ditolak dengan pesan jelas. Pindai QR memakai kamera, juga di Safari. |
| J06 | Tandai menu habis | P0 | Menu tidak bisa dipesan lagi. Menu di pesanan yang sudah dibayar bisa ditandai habis. |
| J07 | Tutup pesanan sementara | P0 | Pembeli langsung melihat tenant tutup sementara. |
| J08 | Kelola menu | P0 | Kategori, menu, harga, lama menyiapkan, penanda, pilihan tambahan. Karyawan tidak bisa mengubahnya. |
| J09 | Jadwal buka mingguan | P0 | Beberapa rentang per hari. Jam ambil yang ditawarkan mengikuti jadwal ini. |
| J10 | Batas waktu pesan | P0 | Nilai awal 5 menit, boleh 0. |
| J11 | Kuota dasar dan per rentang jam | P0 | Dua pesanan yang berebut kuota terakhir: hanya satu yang berhasil. |
| J12 | Rekening dan jam setoran | P0 | Hanya pemilik yang bisa mengubah. |
| J13 | Daftar setoran | P0 | Setoran muncul otomatis pada jam setoran dengan rinciannya. |
| J14 | Daftar siap-masak | P1 | Ringkasan porsi per jam ambil untuk hari ini dan besok. |
| J15 | Mode layar dapur | P1 | Kartu besar per jam ambil, layar tidak mati selama mode aktif. |
| J16 | Stok harian | P1 | Menu otomatis habis saat stok nol. Terisi ulang pukul 00.00. |
| J17 | Batas pesanan per hari | P1 | Setelah tercapai, tenant tidak menerima pesanan untuk hari itu. |
| J18 | Pengingat menyiapkan | P1 | Kabar untuk pesanan yang seharusnya sudah mulai disiapkan. |
| J19 | Promo jam sepi | P1 | Potongan persen atau rupiah per hari dan rentang jam. |
| J20 | Jam khusus dan libur | P1 | Mengalahkan jadwal mingguan pada tanggal itu. |
| J21 | Pengumuman tenant | P1 | Tampil di halaman tenant. |
| J22 | Profil toko lengkap dan foto menu | P1 | Foto tampil di menu. Tanpa foto, menu tetap rapi. |
| J23 | Laporan harian, riwayat, unduh rekap | P1 | File Excel atau CSV berisi pesanan dan setoran. |
| J24 | Undang karyawan | P1 | Pemilik mengundang lewat email. Karyawan hanya bisa menangani pesanan. |
| J25 | Pengelola banyak tenant | P1 | Pindah tenant tanpa keluar akun. Rekap gabungan. |

### 13.5 Tim Jaminin

| Kode | Fitur | Prioritas | Kriteria terima |
|---|---|---|---|
| T01 | Persetujuan penjual | P0 | Setujui atau tolak dengan alasan. Penjual diberi kabar. |
| T02 | Penanganan laporan | P0 | Balasan dan status terlihat oleh pembeli. |
| T03 | Uang kembali manual | P0 | Penuh atau sebagian dengan alasan. Tercatat. |
| T04 | Simulator Bayar | P0 | Pindai atau ketik kode, Bayar, HP pembeli berubah lunas tanpa disentuh. |
| T05 | Dasbor dasar | P0 | Angka sesuai data. Data contoh berlabel. |
| T06 | Daftar setoran | P0 | Semua tenant per tanggal, dengan status. |
| T07 | Anggota tim | P0 | Admin menambah anggota dan memilih peran. Staf tidak bisa membuka halaman uang dan anggota. |
| T08 | Tangguhkan akun | P1 | Sesuai A07. |
| T09 | Atur biaya | P1 | Perubahan berlaku untuk pesanan baru saja. |
| T10 | Catatan aktivitas | P1 | Setiap tindakan tim dan perubahan uang tercatat dengan siapa, kapan, apa. |
| T11 | Kabar untuk tim | P1 | Pendaftaran penjual baru dan laporan baru. |
| T12 | Dasbor lengkap per tenant | P1 | Pesanan, pendapatan, pembatalan, setoran per tenant. |

### 13.6 Proses otomatis

| Kode | Proses | Prioritas | Kriteria terima |
|---|---|---|---|
| O01 | Menggugurkan pesanan yang tidak dibayar | P0 | Dalam satu menit setelah batas bayar lewat. Kuota dan stok dilepas. |
| O02 | Pengingat jam ambil | P0 | Sesuai pilihan menit pembeli, sekali per pesanan. |
| O03 | Belum siap tepat jam ambil | P0 | Tombol batal dengan uang kembali penuh muncul dan pembeli diberi kabar. |
| O04 | Penyelesaian otomatis menu habis | P0 | Setelah 10 menit atau saat jam ambil. |
| O05 | Tutup hari | P0 | Siap menjadi tidak diambil. Belum pernah siap menjadi batal dengan uang kembali (U1). |
| O06 | Setoran otomatis | P0 | Pada jam setoran tiap tenant, sesuai bagian 12.3. |
| O07 | Kabar pagi | P1 | Saat tenant buka. |
| O08 | Pengingat menyiapkan | P1 | Sesuai J18. |
| O09 | Isi ulang stok harian | P1 | Pukul 00.00. |
| O10 | Kabar daftar tunggu | P1 | Saat kuota jam itu terlepas. |

## 14. Peta layar

### 14.1 Pola navigasi

- Pembeli di HP: navigasi bawah dengan Beranda, Pesanan, dan Profil. Pusat notifikasi menjadi menu keempat saat P1 selesai.
- Pembeli di iPad dan laptop: isi di tengah dengan lebar terbatas supaya tetap nyaman dibaca. Checkout dan status pesanan memakai dua kolom di layar lebar.
- Penjual dan tim di HP: navigasi bawah. Di iPad dan laptop: rel samping dengan daftar di kiri dan rincian di kanan.
- Pindah antara mode pembeli, penjual, dan tim lewat profil, hanya untuk akun yang punya peran itu.

### 14.2 Layar pembeli

| Layar | Isi utama | Keadaan kosong | Keadaan error |
|---|---|---|---|
| Masuk dan daftar | Google, email + sandi, lupa sandi | Tidak ada | Pesan per kolom yang salah |
| Lengkapi profil | Nama asli, WhatsApp, status | Tidak ada | Format nomor salah |
| Beranda | Tombol jam istirahat, daftar tenant, jam tercepat | "Belum ada tenant yang buka. Kamu tetap bisa memesan untuk besok." | Gagal memuat, tombol coba lagi |
| Tenant | Info tenant, menu per kategori | "Tenant ini belum punya menu." | Gagal memuat, coba lagi |
| Rincian menu | Pilihan tambahan, jumlah | Tidak ada | Pilihan wajib belum dipilih |
| Keranjang | Isi, jumlah, subtotal | "Keranjang kosong. Pilih menu dari tenant di beranda." | Menu habis sejak dimasukkan |
| Checkout | Hari, jam, pengambil, makan di sini atau bungkus, alat makan, catatan, ringkasan | "Tidak ada jam ambil tersisa hari ini. Coba pilih besok." | Jam baru saja penuh, tawaran jam berikutnya |
| Bayar | QR, kode bayar, hitung mundur | Tidak ada | Waktu habis, pilih jam lagi |
| Status pesanan | Lini waktu, kode, tombol sesuai keadaan | Tidak ada | Koneksi putus: status terakhir tetap tampil dengan tanda belum diperbarui |
| Pesanan | Pesanan aktif, riwayat (P1) | "Belum ada pesanan." | Gagal memuat, coba lagi |
| Lapor masalah | Kategori, cerita, foto | Tidak ada | Foto terlalu besar |
| Profil | Data diri, bahasa, tema, pengingat, kabar, panduan pasang | Tidak ada | Gagal menyimpan |

### 14.3 Layar penjual

| Layar | Isi utama | Keadaan kosong | Keadaan error |
|---|---|---|---|
| Daftar tenant | Langkah-langkah bagian 7.1 | Tidak ada | Pesan per kolom |
| Menunggu persetujuan | Status pendaftaran | Tidak ada | Alasan penolakan |
| Papan pesanan | Pesanan per jam ambil, tab besok | "Belum ada pesanan untuk hari ini. Pesanan baru akan berbunyi di sini." | Koneksi realtime putus, tanda menyambung ulang |
| Serahkan | Ketik kode atau pindai QR | Tidak ada | Kode tidak cocok, kamera ditolak |
| Menu | Kategori, menu, habis | "Tambahkan menu pertama supaya tenant bisa menerima pesanan." | Gagal menyimpan |
| Pengaturan | Jadwal, batas waktu pesan, kuota, tutup sementara, rekening, jam setoran | Tidak ada | Pesan per kolom |
| Setoran | Daftar setoran dan rincian | "Setoran pertama muncul pada jam setoran setelah ada pesanan selesai." | Gagal memuat |

### 14.4 Layar tim

| Layar | Isi utama | Keadaan kosong | Keadaan error |
|---|---|---|---|
| Dasbor | Pesanan, pendapatan, pembatalan, tenant aktif | "Belum ada pesanan." | Gagal memuat |
| Persetujuan penjual | Daftar pendaftaran dan rincian | "Tidak ada pendaftaran yang menunggu." | Gagal memuat |
| Laporan | Daftar laporan per status | "Belum ada laporan." | Gagal memuat |
| Simulator Bayar | Pindai atau ketik kode, daftar tagihan (khusus tim) | "Tidak ada tagihan yang menunggu." | Kode tidak ditemukan atau sudah lunas |
| Setoran | Semua setoran | "Belum ada setoran." | Gagal memuat |
| Anggota tim | Daftar anggota dan peran | Tidak ada | Email belum terdaftar |
| Mode demo | Akun demo, reset data | Tidak ada | Gagal reset |

Keadaan memuat di semua layar memakai kerangka abu-abu sesuai bentuk isi, bukan putaran di tengah layar.

## 15. Persyaratan non-fungsional

- Perangkat yang diuji: iPhone dengan iOS 18.4 ke atas, iPad, HP Android dengan Chrome, MacBook, laptop Windows.
- Kecepatan: beranda, halaman tenant, checkout, dan status pesanan ditargetkan memenuhi Largest Contentful Paint di bawah 2,5 detik pada uji Lighthouse mode HP.
- Realtime: perubahan status terlihat di layar lain tanpa memuat ulang halaman.
- Aksesibilitas: kontras WCAG AA di tema terang dan gelap, target sentuh minimal 44 piksel, bisa dipakai dengan keyboard dengan tanda fokus yang jelas, tetap rapi saat teks diperbesar 200%, menghormati pengaturan kurangi gerakan.
- Bahasa: semua teks berasal dari file terjemahan Indonesia dan Inggris. Rupiah ditulis "Rp21.000" di kedua bahasa. Jam 24 jam: "11.05" di Indonesia dan "11:05" di Inggris (Usulan U11).
- Zona waktu: semua aturan jam memakai WIB, walau perangkat pengguna diatur ke zona lain.
- Keamanan: setiap tabel dilindungi aturan akses di database (Row Level Security). Perubahan penting hanya lewat fungsi database yang memeriksa peran. Konfirmasi bayar hanya dari server. Tidak ada kunci rahasia di repo atau di aplikasi.
- Privasi: data yang disimpan adalah nama, email, nomor WhatsApp, status, dan pesanan, di Supabase region Singapura. Nomor WhatsApp pembeli hanya terlihat oleh penjual tenant pesanannya dan tim. Data tidak dijual atau dibagikan. Hapus akun tersedia di P1.
- Pemantauan: error tercatat di Sentry. Paket gratis Sentry hanya untuk 1 pengguna, yaitu akun Gmail khusus Jaminin.
- Biaya: Rp0 per bulan dengan paket gratis (bagian 19).

## 16. Arsitektur dan techstack

### 16.1 Dalam bahasa umum

- Aplikasinya berupa aplikasi web: dibuka dari browser di HP, iPad, atau laptop, dan bisa dipasang ke layar utama seperti aplikasi biasa. Tidak lewat App Store atau Play Store, jadi tidak ada biaya akun developer dan tidak ada proses review.
- Tampilan aplikasi disimpan di Cloudflare, yang gratis termasuk saat Jaminin sudah menerima uang sungguhan, dan punya titik server di Jakarta dan Yogyakarta.
- Data, login, aturan pesanan, jadwal otomatis, dan notifikasi berjalan di Supabase (paket gratis, server di Singapura).
- Pembayaran disimulasikan lewat halaman Simulator Bayar, dengan jalur konfirmasi yang nanti dipakai juga oleh penyedia pembayaran sungguhan.
- Selama pengembangan, Jaminin dijalankan di laptop Haidar dan tampilan HP dicek lewat Chrome DevTools. Deploy ke Cloudflare dan uji di HP dilakukan setelah aplikasi jadi.

Vercel tidak dipakai karena paket gratisnya khusus untuk penggunaan non-komersial, sehingga Jaminin harus membayar US$20 per bulan begitu menerima pembayaran sungguhan.

### 16.2 Techstack

Versi per 7 Oktober 2026, dicek dari registry npm dan dokumentasi lewat Context7. Versi persis dicek ulang saat pembangunan dimulai.

| Bagian | Pilihan |
|---|---|
| Aplikasi | Vite 8.3, React 19.3, TypeScript 6.0.3 (TypeScript 7 belum didukung typescript-eslint) |
| Navigasi | TanStack Router 1.170 |
| Data di klien | TanStack Query 5.104 |
| Tampilan | Tailwind CSS 4.3, token warna terang dan gelap |
| Aplikasi yang bisa dipasang | vite-plugin-pwa 2.0 dengan service worker sendiri |
| Bahasa | i18next 26 dan react-i18next 17 |
| Waktu | date-fns 4 dan @date-fns/tz, zona Asia/Jakarta |
| Validasi | zod 4.6 |
| QR | qrcode.react 4.2 untuk menampilkan, barcode-detector 3.2 untuk memindai |
| Backend | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron, pg_net |
| Kabar realtime | Supabase Realtime Broadcast dari trigger database ke channel privat |
| Notifikasi push | Web Push dengan kunci VAPID, dikirim lewat Edge Function memakai @negrel/webpush 0.5 |
| Email lupa sandi | SMTP Gmail khusus Jaminin |
| Pencatatan error | @sentry/react 11.5 |
| Analitik | Cloudflare Web Analytics |
| Hosting | Cloudflare Workers Static Assets, alamat gratis |
| Uji | Vitest 5, pgTAP, Playwright 1.63 |

### 16.3 Data yang disimpan

Profil, anggota tim, tenant, anggota tenant (pemilik dan karyawan), jadwal buka, jam khusus, aturan kuota, kategori menu, menu, pilihan tambahan, promo, pesanan, isi pesanan, penghitung kuota dan nomor urut, pembayaran (simulasi), uang kembali, setoran, notifikasi, langganan push, chat, laporan dan balasannya, penilaian, favorit, daftar tunggu, catatan aktivitas, dan pengaturan aplikasi (Biaya layanan, potongan penjual, batas bayar, panjang jam ambil). Data contoh diberi tanda supaya bisa dilabeli di layar dan dihapus dengan tombol reset.

### 16.4 Proses otomatis

Berjalan setiap menit di database (pg_cron, zona WIB): menggugurkan pesanan tidak dibayar, pengingat jam ambil, kabar pagi, pengingat menyiapkan, penyelesaian otomatis menu habis, tutup hari, setoran harian, isi ulang stok pukul 00.00, dan kabar daftar tunggu. Notifikasi push dikirim lewat Edge Function.

### 16.5 Keamanan

- Pembuatan pesanan mengunci baris penghitung kuota jam itu, sehingga dua pembeli yang menekan Bayar bersamaan untuk kuota terakhir tidak bisa sama-sama berhasil.
- Konfirmasi bayar hanya bisa dipanggil Edge Function dengan kunci server.
- Karyawan tidak bisa mengubah harga, menu, kuota, atau rekening. Staf tim tidak bisa mengubah uang, biaya, atau anggota tim.
- Pemeriksa keamanan bawaan Supabase harus bersih sebelum demo.

## 17. Data contoh dan mode demo

### 17.1 Tenant contoh

Delapan tenant dari file penjelasan bagian 5.2 dengan nama asli. Menu diambil dari yang terbaca di foto. Harga, lama menyiapkan, dan kuota diberi tanda "contoh" dan bisa diganti lewat halaman penjual. Jam buka contoh: Senin sampai Jumat, 07.00 sampai 17.00. Sabtu dan Minggu tutup.

| Tenant | Menu contoh |
|---|---|
| Good Moments Coffee | Kopi, matcha, minuman lain, roti |
| Pizzario 1$ Pizza | Pizza per potong: Truffle Mushroom, Triple Cheese, Pepperoni |
| Mamadora Sweet & Savoury | Waffle Choco Milky, Chocolate, Choco Oreo, Choco Cheese, Choco Banana, air mineral |
| Rustic Grill BBQ | Nasi ayam katsu, ayam grill, kentang, burger, spaghetti |
| Bakso Malang Mahkota | Bakso malang (menu asli belum diketahui) |
| Mama Bento | Rice bowl, chicken katsu, teriyaki, chicken wings (perlu dicocokkan dengan papan asli) |
| Mie Ayam Bangka Asen | Mi ayam |
| Warung Nusantara | Nasi Goreng Tek Tek, Mie Goreng Tek Tek, kwetiau |

### 17.2 Mode demo (P0)

- Akun demo untuk tiap peran: pembeli, pemilik tenant, dan admin tim. Alamat emailnya memakai alamat plus dari Gmail khusus Jaminin, contoh `gmailjaminin+pembeli@gmail.com` (Usulan U3).
- Panel pindah peran yang hanya muncul saat mode demo aktif, untuk berganti akun demo sekali ketuk.
- Pesanan contoh beberapa hari terakhir untuk dasbor dan laporan, diberi label "data contoh" di layar. Angka contoh tidak boleh dipakai di PPT sebagai data asli.
- Tombol reset (khusus admin): menghapus pesanan contoh dan pesanan dari latihan demo, lalu mengembalikan tenant dan menu contoh ke keadaan awal.

## 18. Naskah demo 10 menit

Perangkat: HP untuk pembeli, layarnya dicerminkan ke proyektor. Laptop untuk penjual, dengan tab kedua berisi Simulator Bayar dan halaman tim. Data di-reset sebelum demo.

| Menit | Yang ditunjukkan | Poin yang disampaikan |
|---|---|---|
| 0:00 | Masalah | Jeda 20 menit. 8 dari 10 responden pernah tidak makan, menunda makan, atau melewatkan makanan berat. |
| 1:00 | Pembeli masuk, beranda dengan jam tercepat, tekan tombol jeda terdekat (contoh 11.05, tergantung jam demo) | Pembeli langsung tahu tenant mana yang bisa siap tepat waktu. |
| 2:00 | Halaman tenant: menu habis, menu bisa diatur, pilih level pedas dan extra keju | Pesanan dilengkapi pilihan tambahan, catatan, makan di sini atau bungkus. |
| 3:00 | Checkout: jam penuh dan tawaran jam berikutnya, sisa kuota, Biaya layanan Rp1.000 | Kuota menjaga penjual tidak kewalahan dan jam yang dijanjikan bisa ditepati. |
| 4:00 | Bayar: QR di HP, bayar dari Simulator Bayar di laptop, HP berubah lunas sendiri | Lunas otomatis, tanpa bukti bayar dan tanpa admin. |
| 5:00 | Laptop penjual: pesanan baru berbunyi, Mulai siapkan, notifikasi muncul di HP | Penjual tahu pesanan lebih awal dan bisa menyiapkan sebelum pembeli datang. |
| 6:00 | Siap diambil, pembeli menunjukkan kode, penjual memindai QR, Serahkan | Ambil tanpa antre. |
| 7:00 | Kejadian khusus: batal sebelum disiapkan dengan uang kembali penuh, atau menu habis lalu pembeli memilih pengganti | Aturan berjalan otomatis. |
| 8:00 | Halaman tim: persetujuan penjual baru, laporan dan uang kembali manual | Tim hanya turun tangan untuk hal di luar alur utama. |
| 9:00 | Uang: rincian Rp21.000, Rp19.000, Rp2.000, dasbor, setoran harian | Sell price Rp1.000 + Rp1.000, cost Rp0 dengan layanan gratis. |
| 9:30 | Ganti bahasa ke Inggris, tema gelap, Jaminin terpasang di layar utama HP | Satu aplikasi untuk HP, iPad, dan laptop. |

Cadangan kalau ada gangguan: kalau notifikasi push tidak muncul, kabar tetap terlihat di dalam aplikasi. Kalau jaringan kampus bermasalah, HP memakai data seluler. Naskah dilatih dua kali dengan data yang di-reset di antaranya.

## 19. Cost dan sell price

Tafsiran yang sudah dipastikan kelompok: cost adalah biaya menjalankan Jaminin, sell price adalah harga yang dibayar pembeli dan penjual kepada Jaminin.

### 19.1 Sell price

Rp1.000 dari pembeli (Biaya layanan) dan Rp1.000 dari penjual (dipotong dari setoran) untuk setiap pesanan, berapa pun isinya. Pendapatan Jaminin Rp2.000 per pesanan yang tidak batal. Contoh hitungan ada di bagian 12.1.

### 19.2 Cost (biaya menjalankan per bulan)

| Layanan | Kegunaan | Biaya | Batas paket gratis |
|---|---|---|---|
| Cloudflare | Hosting aplikasi | Rp0 | Permintaan file statis tanpa batas, boleh komersial |
| Supabase | Database, login, realtime, jadwal, notifikasi | Rp0 | 500 MB database, 1 GB storage, 50.000 pengguna aktif per bulan, 500.000 pemanggilan Edge Function per bulan, 200 koneksi realtime, dijeda setelah 7 hari tanpa aktivitas |
| Google login | Masuk dengan Google | Rp0 | |
| Gmail | Email lupa sandi | Rp0 | Sekitar 500 email per hari |
| Sentry | Pencatatan error | Rp0 | 5.000 error per bulan, 1 pengguna |
| Cloudflare Web Analytics | Analitik pengunjung | Rp0 | |
| GitHub | Penyimpanan kode | Rp0 | |
| Domain (opsional) | Alamat sendiri | Sekitar Rp25 ribu per tahun (.my.id) atau sekitar Rp185 ribu per tahun (.com) | Belum dibeli, memakai alamat gratis Cloudflare |
| Penyedia pembayaran (nanti) | QRIS sungguhan | Contoh Midtrans 0,7% per transaksi (sekitar Rp147 untuk Rp21.000). Xendit tarif standar 0,70% + Rp4.000 (sekitar Rp4.147, lebih besar dari pendapatan per pesanan) | Ditunda |

Kapan biaya muncul: kalau batas paket gratis Supabase terlampaui, paket Pro US$25 per bulan. Kalau memakai kabar WhatsApp resmi, setiap pesan ditagih sejak 1 Oktober 2026. Bank Indonesia menetapkan MDR QRIS 0% untuk transaksi sampai Rp100.000 mulai 1 Oktober 2026, tetapi halaman harga Midtrans dan Xendit pada 7 Oktober 2026 masih menulis 0,7%.

Sumber: halaman harga [Supabase](https://supabase.com/pricing), [Midtrans](https://midtrans.com/id/pricing), [Xendit](https://www.xendit.co/id/biaya/), ringkasan paket gratis hosting per September 2026 ([flaviocopes](https://flaviocopes.com/hosting-free-tiers/)), [aturan Vercel](https://vercel.com/docs/limits/fair-use-guidelines), [paket gratis Sentry](https://costbench.com/software/developer-tools/sentry/free-plan/), [batas kirim Gmail](https://overloop.com/blog/gmail-sending-limits), harga domain [ID CloudHost](https://www.whtop.com/id/plans/idcloudhost.com/105648), dan [siaran pers Bank Indonesia 17 Agustus 2026](https://www.bi.go.id/id/publikasi/ruang-media/news-release/Pages/sp_2815926.aspx).

## 20. Keputusan terbuka dan yang ditunda

Harus selesai sebelum Jaminin menerima uang sungguhan:

| Hal | Status |
|---|---|
| Penyedia pembayaran | Ditunda |
| Jalan uang final (A, B, C, atau D di file penjelasan bagian 14.7) | Ditunda. Prototipe memakai model A. |
| Izin penampungan dana untuk model A, dan kelayakan opsi C | Terbuka |
| Siapa yang menanggung biaya penyedia pembayaran | Ditunda |
| Syarat mendaftar ke penyedia pembayaran | Terbuka |
| Apakah penyedia mengikuti MDR QRIS 0% dari Bank Indonesia | Terbuka |
| Cara pembeli membayar QRIS dari HP yang sama dengan yang menampilkan kodenya | Ditunda bersama penyedia |
| Kesesuaian nama dan penagihan Biaya layanan dengan aturan bahwa biaya QRIS tidak boleh dibebankan ke pembeli | Terbuka |
| Waktu dan kepastian uang kembali di penyedia yang dipilih | Terbuka |
| Cara setoran sungguhan (transfer otomatis lewat layanan penyedia, biasanya berbayar per transfer) | Ditunda |

Perlu dicek ke kantin dan tenant:

| Hal | Status |
|---|---|
| Menu, harga, lama menyiapkan, dan jam buka asli tiap tenant | Terbuka |
| Apakah 8 tenant sudah semua tenant di kantin | Terbuka |
| Siapa pengelola kantin, izin dari pengelola dan kampus, dan apakah tiap tenant boleh memutuskan sendiri | Terbuka |
| Apakah tenant sudah terdaftar di GoFood, GrabFood, atau ShopeeFood | Terbuka |
| Pendapat tenant. Belum ada tenant yang diwawancarai | Terbuka |
| Kesediaan pembeli membayar Biaya layanan Rp1.000 | Terbuka |

Untuk tampilan dan merek: logo, warna, gaya tampilan, dan slogan (usulan slogan di bagian 23) diputuskan saat Haidar memoles tampilan.

## 21. Risiko

| Risiko | Penanganan |
|---|---|
| Waktu membangun sekitar 4 hari | Prioritas P0 dan P1. P0 wajib sempurna, P1 dilanjutkan setelah demo kalau belum selesai. |
| Akun dan konektor belum siap saat pembangunan dimulai | Panduan akun dikirim bersama PRD supaya bisa dibuat selagi membaca. |
| Notifikasi push di iPhone bergantung pada pembeli memasang Jaminin ke layar utama | Panduan pemasangan setelah pembayaran pertama. Kabar tetap terlihat di dalam aplikasi tanpa push. |
| Proyek Supabase gratis dijeda setelah 7 hari tanpa aktivitas | Ping harian (P1). |
| Hanya satu proyek Supabase untuk demo dan uji | Uji database berjalan dalam transaksi yang dibatalkan. Uji ujung ke ujung memakai akun uji dan menghapus datanya setelah selesai. |
| Gmail sebagai pengirim email dibatasi sekitar 500 email per hari | Cukup untuk lupa sandi di tahap ini. Pindah ke Resend setelah punya domain. |
| Jalan uang sungguhan yang murah, otomatis, dan aman dari sisi izin belum dipastikan | Ditunda dan dicatat di bagian 20. Prototipe tidak memakai uang sungguhan. |
| ShopeeFood sudah punya pesanan terjadwal untuk Pickup | Pembeda Jaminin: jam ambil tiap 5 menit dengan batas waktu yang diatur penjual (ShopeeFood paling cepat 30 menit ke depan), kuota per jam ambil, dan khusus tenant kantin kampus. |
| Sebagian besar tenant tampaknya dikelola satu pihak | Peran pengelola banyak tenant (P1). Izin pengelola menjadi syarat pertama sebelum tenant diajak. |
| Jaringan kampus saat demo | HP memakai data seluler sebagai cadangan. |
| Jaminin tidak menyelesaikan antrean lift dan sulitnya tempat duduk | Di luar lingkup. Pengingat jam ambil bisa diatur sampai 15 menit untuk memberi waktu turun. |

## 22. Rencana kerja dan jadwal

| Hari | Pekerjaan |
|---|---|
| Rabu, 7 Oktober | PRD dan panduan akun dikirim. Haidar me-review PRD dan membuat akun layanan. |
| Kamis, 8 Oktober | Fondasi aplikasi, database inti, login dan profil, mulai alur pembeli. |
| Jumat, 9 Oktober | Alur pembeli lengkap, Simulator Bayar, alur penjual, kabar realtime. |
| Sabtu, 10 Oktober | Alur tim, uang dan setoran, proses otomatis, notifikasi push, mode demo. Uji P0 lengkap dan laporan PASS/FAIL antislop. |
| Minggu, 11 Oktober | Fitur P1 sesuai urutan, deploy ke Cloudflare, uji di iPhone, iPad, Android, MacBook, dan laptop Windows, latihan naskah demo dua kali, perbaikan. |
| Senin, 12 Oktober | Demo. |

Urutan P1: (1) pusat notifikasi, struk, kalender, penilaian; (2) chat; (3) daftar siap-masak dan layar dapur; (4) stok harian, batas pesanan per hari, pengingat menyiapkan, kabar pagi; (5) promo jam sepi; (6) jam khusus dan libur, pengumuman, profil toko, foto menu; (7) riwayat, pengeluaran, pesan ulang, favorit, pencarian, filter; (8) laporan harian dan unduh rekap; (9) daftar tunggu; (10) undang karyawan dan pengelola banyak tenant; (11) tangguhkan akun, atur biaya, catatan aktivitas, kabar untuk tim, dasbor per tenant; (12) kebijakan privasi dan syarat, penjelasan cara kerja, hapus akun; (13) analitik dan ping harian.

Jadwal ini bergantung pada akun dan konektor yang siap pada Kamis pagi. Kalau terlambat, P1 yang dikurangi, bukan kualitas P0. Setiap bagian yang selesai langsung di-commit supaya tidak hilang.

Yang dibutuhkan dari Haidar: membuat akun sesuai `docs/PANDUAN-AKUN.md`, menyambungkan konektor Supabase dan Sentry, dan menyimpan rahasia lingkungan yang diminta di panduan itu.

## 23. Usulan yang perlu persetujuan dan usulan slogan

### 23.1 Usulan

| Kode | Usulan | Alasan |
|---|---|---|
| U1 | Pesanan yang sampai penjual tutup belum pernah ditandai siap dibatalkan otomatis dengan uang kembali penuh. Hanya pesanan yang sudah siap yang menjadi tidak diambil. | Penyebabnya penjual, jadi pembeli tidak pantas kehilangan uangnya. |
| U2 | Harga dan potongan promo dikunci saat bayar. Menggeser jam ambil tidak mengubah harga. | Pembeli tidak perlu membayar lagi atau menerima uang kembali hanya karena menggeser jam. |
| U3 | Akun demo memakai alamat plus dari Gmail khusus Jaminin. | Akun demo tetap bisa menerima email, tanpa membuat banyak akun Gmail. |
| U4 | Email admin pertama dipasang lewat perintah sekali jalan di database. | Email pribadi tidak tertulis di repo. |
| U5 | Jam tercepat di beranda dihitung dengan menu tercepat di tenant itu. | Keranjang belum diisi saat melihat beranda. |
| U6 | Urutan awal beranda dari yang tercepat, bisa diganti ke abjad. | Pembeli mencari yang paling cepat siap. |
| U7 | Tombol jam istirahat menandai tenant yang bisa melayani jam itu, dan jam itu langsung terpilih di checkout kalau masih tersedia. | Mengurangi klik untuk kebutuhan paling umum. |
| U8 | Kuota memakai kuota dasar ditambah aturan per rentang jam yang berlaku di semua hari buka. | Paling sederhana untuk penjual. |
| U9 | Penjual yang ditolak bisa memperbaiki data dan mengirim ulang. | Tidak perlu mendaftar dari awal. |
| U10 | Uang kembali manual dari tim dibebankan ke setoran tenant itu, hari itu atau berikutnya. | Kasus seperti pesanan salah berasal dari tenant. |
| U11 | Jam ditulis 11.05 di bahasa Indonesia dan 11:05 di bahasa Inggris, keduanya 24 jam. | Mengikuti kebiasaan tulis tiap bahasa. |
| U12 | Foto atau logo kios boleh dilewati saat mendaftar. | Supaya pendaftaran tidak tertahan karena foto. |
| U13 | Tutup sementara dengan pilihan 15 menit, 30 menit, 1 jam, atau sampai dibuka lagi. | Penjual tidak lupa membuka kembali. |
| U14 | Daftar tagihan di Simulator Bayar hanya terlihat oleh akun tim. Memindai QR atau mengetik kode bisa dilakukan siapa pun. | Sama seperti QRIS sungguhan yang bisa dibayar siapa pun, tanpa membuka data tagihan orang lain. |
| U15 | Kode bayar 6 karakter dan kode ambil 4 karakter, tanpa huruf dan angka yang mirip (0, O, 1, I, L). | Mudah dibaca dan diketik. |
| U16 | Kode ambil dan QR hanya tampil setelah lunas. | Kode tidak bisa dipakai sebelum dibayar. |
| U17 | Chat per pesanan hanya antara pembeli dan tenant pesanan itu, ditutup 24 jam setelah pesanan selesai. | Chat tetap fokus pada urusan pesanan. |
| U18 | Daftar tunggu: semua pembeli di daftar tunggu jam itu diberi kabar bersamaan, yang lebih dulu membayar yang mendapat tempat. | Adil dan sederhana. |
| U19 | Stok harian terisi ulang pukul 00.00 ke angka stok harian yang diatur penjual. | Penjual tidak perlu mengisi ulang setiap pagi. |
| U20 | Kata sandi minimal 8 karakter. | Keamanan dasar. |

### 23.2 Usulan slogan

Untuk dipilih saat memoles tampilan. Semuanya bisa diganti.

1. Pilih jam, bayar, ambil tanpa antre.
2. Jam ambil yang terjamin.
3. Pesan di kelas, ambil saat istirahat.
4. Tepat jamnya, tanpa antrenya.

## 24. Daftar istilah

| Istilah | Arti |
|---|---|
| Pembeli | Orang yang memesan lewat Jaminin. |
| Penjual atau tenant | Kios makanan atau minuman di kantin. |
| Pemilik, karyawan, pengelola | Lihat bagian 3. |
| Tim Jaminin | Empat anggota kelompok yang mengelola Jaminin, sebagai admin atau staf. |
| Jam ambil | Jam yang dipilih pembeli untuk mengambil pesanannya, tiap 5 menit. |
| Jam tercepat | Jam ambil paling awal yang bisa dipilih (bagian 5.2). |
| Kuota | Jumlah pesanan paling banyak untuk satu jam ambil di satu tenant. |
| Batas waktu pesan | Paling lambat berapa menit sebelum jam ambil pesanan boleh masuk. |
| Lama menyiapkan | Menit yang dibutuhkan untuk membuat satu menu. |
| Batas bayar | 5 menit untuk membayar setelah pesanan dibuat. |
| Nomor urut | Nomor pesanan harian per tenant untuk dipanggil, contoh #023. |
| Kode ambil | Kode rahasia 4 karakter untuk mencocokkan pesanan saat diambil. |
| Biaya layanan | Rp1.000 dari pembeli untuk setiap pesanan. |
| Potongan penjual | Rp1.000 dari bagian penjual untuk setiap pesanan yang tidak batal. |
| Setoran | Uang bagian penjual yang dikirim ke rekeningnya setiap hari. |
| Jam setoran | Jam setoran dikirim, nilai awalnya jam tutup tenant. |
| Uang kembali | Pengembalian uang ke pembeli, penuh atau sebagian. |
| Simulator Bayar | Halaman yang meniru aplikasi bank untuk membayar QR simulasi di prototipe. |
| QRIS | Kode QR pembayaran standar Indonesia. Di prototipe diganti QR simulasi. |
| Aplikasi web yang bisa dipasang (PWA) | Aplikasi yang dibuka dari browser dan bisa ditaruh di layar utama HP seperti aplikasi biasa. |
| Notifikasi push | Pemberitahuan yang muncul di HP atau laptop walau Jaminin tidak sedang dibuka. |
| Realtime | Perubahan langsung terlihat di layar lain tanpa memuat ulang halaman. |
| Row Level Security | Aturan di database yang menentukan baris data mana yang boleh dibaca atau diubah tiap pengguna. |
| Edge Function | Potongan kode kecil yang berjalan di server Supabase, misalnya untuk mengirim notifikasi. |
| Mode demo | Akun contoh, data contoh berlabel, dan tombol reset untuk demo. |
| Draf tampilan | Label bahwa tampilan aplikasi belum final dan akan dipoles Haidar. |
