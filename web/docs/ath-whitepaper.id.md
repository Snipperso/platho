# Whitepaper ATH

## Token protokol Platho

ATH adalah token utilitas Platho. Ia dipakai untuk imbalan aktivitas, potongan biaya protokol setelah airdrop, nama `.ath`, pembaruan avatar, penjualan stabilitas pasar, pembelian kembali, dan pembakaran.

ATH bukan token administratif. Ia tidak memberi kuasa untuk menulis ulang saldo, menghentikan operasi, menerbitkan pasokan baru, atau mengubah apa yang dimiliki penggunanya. Perannya adalah menggerakkan ekonomi aplikasi dan mengikat penggunaan Platho pada pembukuan on-chain.

Dokumen ini menjelaskan model ATH di Platho.

## Parameter inti

ATH memiliki pasokan total yang tetap:

```text
100,000,000 ATH
```

Harga acuan saat peluncuran:

```text
1 ATH = 0.001 GRAM
```

Valuasi terdilusi penuh saat peluncuran:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH berangkat dari kapitalisasi acuan `100,000 GRAM`.

## Pasokan tetap

ATH diterbitkan oleh kontrak `ATHMaster`. Saat inisialisasi, `ATHMaster` menetapkan pasokan total pada `100,000,000 ATH`.

Tidak ada fungsi pencetakan setelah genesis. `ATHMaster` tidak menyediakan pencetakan administratif, jeda, daftar hitam, pajak transfer, transfer paksa, maupun penarikan darurat.

Penerbitan perdana terjadi sekali saja, lewat `DeployTreasurySupply`, yang mengirim seluruh pasokan ke dompet ATH perbendaharaan. Penerbitan genesis tidak dapat diulang.

Pasokan total hanya berkurang melalui pembakaran. `ATHMaster` menerima pembakaran hanya setelah ada pemberitahuan pembakaran terautentikasi dari dompet ATH deterministik milik alamat pemilik. Setelah diverifikasi, `ATHMaster` mengurangi `total_supply` dan mengirim `ATHBurnFinalized`.

Membakar ATH adalah pengurangan nyata pasokan total, bukan pemindahan ke alamat yang tidak terpakai.

## Alokasi pasokan

Pasokan ATH dibagi ke dalam empat kategori:

| Kategori | Porsi | Jumlah |
| --- | ---: | ---: |
| Airdrop aktivitas | 15% | 15,000,000 ATH |
| Likuiditas awal | 15% | 15,000,000 ATH |
| Vesting protokol jangka panjang | 10% | 10,000,000 ATH |
| Cadangan stabilitas pasar | 60% | 60,000,000 ATH |

Pembagian ini menetapkan struktur ekonomi Platho:

- 15% pasokan dibagikan kepada pengguna melalui aktivitas di aplikasi, sebelum pool diluncurkan.
- 15% pasokan dipakai sebagai likuiditas awal.
- 10% pasokan terkunci dalam vesting jangka panjang yang tidak dapat diubah.
- 60% pasokan disetor ke MarketStabilitySeller dan dikunci pada genesis, lalu dijual bertahap di atas harga peluncuran setelah pembekuan harga pascapool.

Pada genesis final, airdrop aktivitas dan cadangan vesting jangka panjang dijamin oleh dompet ATH resmi milik AirdropPool dan ATHVesting, dan pemeriksa rilis memeriksa saldo tersebut sebelum rilis produksi. Cadangan stabilitas `60,000,000 ATH` disetor ke MarketStabilitySeller dan dikunci pada genesis final, dijamin oleh dompet ATH resmi penjualnya, dan pemeriksa rilis juga memeriksa jaminan itu sebelum rilis produksi. Cadangan sudah terkapitalisasi sejak awal, tetapi tidak dijual sebelum pool diluncurkan — saat itulah pembekuan harga sekali jalan yang terikat bukti menetapkan harga dasar tahap.

## Vesting protokol jangka panjang

Cadangan vesting jangka panjang adalah:

```text
10,000,000 ATH
```

Ia disimpan di `ATHVesting`, bukan di kantong perbendaharaan yang bisa diubah. Jadwalnya tertanam dalam kontrak:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Siapa pun boleh memicu klaim pembayaran setelah ATH jatuh tempo, tetapi pihak penerima manfaat tidak dapat diubah. Kontrak tidak punya percepatan, penggantian penerima, jeda, penarikan administratif, jalan keluar darurat, maupun pelepasan sesuka hati.

Pada genesis final, dompet resmi `ATHWallet(owner = ATHVesting, master = ATHMaster)` harus berisi tepat `10,000,000 ATH`. Pemeriksa juga menuntut nol ATH terklaim, fase diam, dan tidak ada transfer tertunda sebelum peluncuran.

Cadangan ini sengaja dibuat lambat. Ia membuka cakrawala panjang bagi pengembangan protokol tanpa menaruh blok likuid 10 juta ATH di atas pasar saat peluncuran.

## Airdrop aktivitas

Airdrop aktivitas berjumlah:

```text
15,000,000 ATH
```

Imbalan per penerbitan yang berhasil:

```text
10 ATH
```

Setiap kapsul yang diterima memberi pengirimnya `10 ATH`, sama di semua jalur. Upaya penerbitan yang gagal tidak memberi apa pun.

Pembayaran dilakukan berkelompok, bukan per kapsul. Setiap pengiriman menanggung biaya tetap yang tidak dapat ditarik kembali sekitar `0.0166 GRAM`, dan biaya itu tidak bergantung pada berapa banyak ATH yang dibawanya. Membayar setelah setiap kapsul akan menelan lebih banyak daripada yang dikumpulkan kapsul-kapsul itu sebagai biaya protokol, karena itu imbalan menumpuk dan datang dalam satu pembayaran.

Airdrop dijamin oleh dompet ATH resmi `AirdropPool`, dan di sanalah `15,000,000 ATH` itu berada. Begitu habis, imbalan aktivitas berhenti.

## Harga aktivitas

Pesan dimulai dari harga dasar saat ini:

```text
0.0191 GRAM
```

Angka pasti saat ini, sebelum potongan ATH:

```text
pesan privat:     0.0191 GRAM
kontak pertama:   0.0178 GRAM
kiriman publik:   0.0203 GRAM
```

Untuk setiap penerbitan yang berhasil, pengguna menerima:

```text
10 ATH
```

Pada harga acuan peluncuran:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Ini mengikat distribusi awal ATH pada penggunaan nyata aplikasi. Imbalan itu bonus aktivitas — bukan pengembalian dana, bukan cashback, bukan diskon, dan bukan janji bahwa ATH menutup biaya GRAM sebuah penerbitan. Nilai acuan `10 ATH` bisa lebih rendah daripada biaya GRAM satu kapsul, dan itu disengaja: pengguna memperoleh kepemilikan awal atas jaringan karena pemakaian nyata, bukan ganti rugi yang dijamin.

Harga kapsul: kiriman publik mulai `0.0203 GRAM`, kapsul privat mulai `0.0191 GRAM`. Blok kapsul publik atau privat yang lebih besar lebih mahal, karena badan yang dipilih — 1, 2, 4, 8, 16, atau 32 KiB — mengubah cadangan eksekusi dan penyimpanan di shard. Imbalannya tetap `10 ATH` per kapsul yang berhasil difinalisasi, berapa pun ukurannya.

Penerbitan privat memakai profil keamanan hibrida secara bawaan: X25519 + ML-KEM-768 + AES-GCM. Tidak ada mode klasik yang lebih murah untuk pesan privat.

ATH bisa diperdagangkan di atas atau di bawah harga acuan begitu pool resmi ada. Imbalan aktivitas bukan imbal hasil investasi, bukan harapan keuntungan, dan bukan jaminan harga.

## Biaya protokol dan harga bagi pengguna

Biaya protokol berbeda dari total biaya yang ditanggung pengguna.

Biaya protokol:

| Jenis penerbitan | Biaya protokol |
| --- | ---: |
| Kiriman publik | 0.010 GRAM |
| Pesan privat hibrida | 0.010 GRAM |

Harga akhir mencakup biaya protokol, gas, dan dana penyimpanan catatan di shard-nya:

| Penerbitan | Dilampirkan |
| --- | ---: |
| Pesan privat | 0.0191 GRAM |
| Kontak pertama | 0.0178 GRAM |
| Kiriman atau komentar publik | 0.0203 GRAM |
| Pembaruan avatar | 0.0395 GRAM |
| Aktivasi akun | 0.0600 GRAM |

Klien selalu melampirkan yang lebih besar di antara dua angka — angka yang dibutuhkan untuk membuat shard. Kelebihannya tidak hilang: shard menyimpan tepat yang diperlukan dan mengembalikan sisanya kepada pengirim. Bila perkiraan jaringan datang lebih tinggi dari dugaan, klien menambahkan margin di atasnya; itu margin, bukan pembayaran, dan ikut dikembalikan. Potongan ATH berlaku untuk biaya protokol, bukan untuk biaya jaringan atau cadangan penyimpanan.

## Potongan ATH

ATH menurunkan biaya protokol pesan setelah airdrop aktivitas terdistribusi sepenuhnya.

Potongan hanya terbuka ketika sisa airdrop aktivitas bernilai:

```text
airdrop_remaining_ath == 0 ATH
```

Sebelum titik itu, biaya protokol dibayar penuh.

Ambang potongan penuh:

```text
10,000 ATH
```

Jika saldo ATH di dompet ATH milik sendiri paling sedikit `10,000 ATH`, pengguna mencapai tingkat potongan penuh untuk komponen biaya Platho. Biaya jaringan dan cadangan penyimpanan tetap dibayar.

Di bawah `10,000 ATH`, biaya turun secara linier:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Perhitungan dibulatkan ke atas. Dengan konstanta saat ini, biaya protokol penuh adalah `0.010 GRAM` (`10,000,000 nanotons`) baik untuk kapsul publik maupun privat, dan pengurangan maksimum `0.010 GRAM` per kapsul.

## Peluncuran pool

Pool ATH/GRAM diluncurkan setelah seluruh airdrop aktivitas `15,000,000 ATH` terdistribusi.

Urutan peluncuran:

1. Pengguna menerima ATH lewat penggunaan nyata Platho.
2. Seluruh airdrop aktivitas terdistribusi.
3. Potongan ATH terbuka.
4. Pool ATH/GRAM diluncurkan.
5. Bukti rute dan bukti harga pascapool dibekukan.
6. Pembagian pembelian kembali diaktifkan.

Pool bermula dari harga acuan:

```text
1 ATH = 0.001 GRAM
```

Alokasi likuiditas awal:

```text
15,000,000 ATH
```

Sisi GRAM pada harga peluncuran:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Biaya protokol yang terkumpul sebelum pool diluncurkan mendanai penuh sisi GRAM dari likuiditas awal. Ini bagian dari penyiapan peluncuran dan tidak mengubah imbalan aktivitas menjadi hak tagih dalam GRAM.

Pool diluncurkan mengelilingi token yang sudah terdistribusi lewat pemakaian aplikasi. Itulah yang membedakan ATH dari pencatatan kosong tanpa basis pengguna.

## FeeAccumulator

Biaya protokol dalam GRAM dikumpulkan di `FeeAccumulator`.

Sebelum pembagian pembelian kembali diaktifkan, seluruh GRAM yang terkumpul masuk ke kantong perbendaharaan:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` tidak bertambah sampai pembagian diaktifkan.

Setelah `EnableBuybackSplit`, GRAM yang terkumpul dibagi:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Jika jumlah dalam nanoton ganjil, sisanya tetap di sisi pembelian kembali:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` adalah tindakan searah yang dilakukan pihak penerima perbendaharaan yang tidak dapat diubah, setelah pool diluncurkan dan rute pembelian kembali dibekukan. Ini kuasa sekali pakai yang nyata: ia tidak bisa mencuri dana, menjeda, keluar darurat, atau mengubah alamat, tetapi ia mengubah ekonomi FeeAccumulator secara permanen — dari penumpukan awal khusus perbendaharaan menjadi pembagian 50/50 antara perbendaharaan dan pembelian kembali. Ia baru diaktifkan setelah pemeriksaan prarilis lolos.

Kuasa rilis di Platho sengaja dibuat sempit dan hampir seluruhnya sekali pakai. Kuasa itu memang ada, dan pantas disebut apa adanya: kepemilikan perbendaharaan menerbitkan pasokan ATH perdana sekali; pengendali genesis melakukan pengikatan prasegel dan penyegelan; pengendali peluncuran BuybackBurn membekukan rute pascapool sekali; pembekuan harga MarketStabilitySeller dilakukan sekali oleh pengendali peluncurannya; dan pihak penerima perbendaharaan di FeeAccumulator mengaktifkan pembagian pembelian kembali yang searah setelah pemeriksaan prarilis. Tak satu pun peran ini merupakan jalan keluar darurat, jeda, pemutakhiran, penarikan administratif, atau kendali sewenang-wenang atas saldo.

## Pembelian kembali dan pembakaran

Pembelian kembali berjalan lewat `FeeAccumulator` dan `BuybackBurn`.

BuybackBurn hanya menerima amplop eksekusi yang lengkap:

```text
51.05 GRAM
```

Struktur amplop:

```text
50.00 GRAM  - jumlah penawaran STON.fi
1.00 GRAM   - gas penerusan rute
0.05 GRAM   - gas transfer pTON
```

`50 GRAM` telanjang bukan potongan pembelian kembali yang sah. Pembelian kembali hanya diterima sebagai amplop rute yang lengkap.

Setelah rute dibekukan, BuybackBurn menjalankan pembelian kembali seperti ini:

1. Menerima `51.05 GRAM` hanya dari FeeAccumulator yang terikat.
2. Mencatat jumlahnya di `reserve_due_ton`.
3. Pada `ExecuteBuybackChunk` memakai satu amplop.
4. Memakai kuotasi beku dan minOut beku.
5. Menetapkan tenggat STON.fi secara internal.
6. Mengirim rute lewat dompet pTON yang dibekukan.
7. Menerima ATH hanya lewat dompet ATH resmi BuybackBurn.
8. Memverifikasi bahwa dompet sumber cocok dengan pool STON.fi yang dibekukan.
9. Mengirim ATH yang diterima untuk dibakar lewat dompet ATH resmi.
10. Menutup siklus hanya setelah `ATHBurnFinalized` dari `ATHMaster`.

Keberhasilan pembelian kembali tidak ditentukan oleh pesan router, permintaan pembakaran yang keluar, atau pemberitahuan pembakaran dari ATHWallet. Ia baru ditentukan ketika BuybackBurn menerima `ATHBurnFinalized` terautentikasi dari ATHMaster. Sampai finalisasi itu tiba, BuybackBurn tetap dianggap dalam keadaan pembakaran tertunda atau coba ulang; dasbor dan pengindeks tidak boleh menghitung ATH sebagai terbakar hanya karena percobaan pembakaran sudah dikirim.

Jika pembakaran tidak terfinalisasi, ATH yang diterima berpindah ke utang coba ulang. `RetryAthBurnDue` membakar seluruh jumlah utang itu.

## Biaya nama

Pendaftaran nama `.ath` dibayar dalam ATH lewat dompet ATH resmi UsernameRegistry.

Harga:

| Panjang nama | Harga |
| ---: | ---: |
| 4 karakter | 10,000 ATH |
| 5 karakter | 1,000 ATH |
| 6 ke atas | 100 ATH |

UsernameRegistry hanya menerima harga yang persis. Kurang bayar maupun lebih bayar tidak menciptakan nama.

Pencetakan yang diterima melewati keadaan tertunda dan menyebarkan sebuah `UsernameNFTItem`. Pembayaran belum diakui sebagai pendapatan sampai item itu terkonfirmasi. Setelah terkonfirmasi, jumlahnya dibagi:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Pencetakan nama dibayar dalam ATH dari dompet milik sendiri. Penolakan karena nama tidak sah, harga keliru, atau nama ganda dikembalikan kepada pemilik lewat jalur pengembalian pemberitahuan ATHWallet. UsernameRegistry tidak menyediakan kantong pengembalian eksternal untuk nama.

ATH dari pencetakan nama baru menjadi pendapatan protokol setelah penyebaran item terkait terkonfirmasi.

Kewenangan atas nama sengaja dipecah: `UsernameRegistry` menambatkan nama pada satu `UsernameNFTItem` yang persis, sedangkan keadaan item membawa kepemilikan saat ini. Memindahkan item berarti memindahkan nama. Item menyediakan data NFT standar dan metadata TEP-64 on-chain, termasuk `name = <username>.ath`; untuk metadata ia tidak bergantung pada server Platho mana pun. Bita nama bersifat harfiah dan tidak dinormalkan untuk tampilan: nama dengan pemisah di depan, di belakang, berurutan, atau seluruhnya berupa pemisah tetap sah selama setiap bita berada dalam himpunan yang diizinkan `a-z`, `0-9`, `_`, `-` dan panjangnya 4..16. Jika penyebaran item sudah diupayakan tetapi ACK-nya tak pernah sampai ke registry, `PrunePendingUsernameMint` sengaja tidak merusak: ia tidak menebak kegagalan, tidak menghapus keadaan tertunda, dan tidak membuat utang pengembalian. Jalur pemulihannya adalah `UsernameItemDeployedAck` yang terlambat atau `UsernameNFTItem.ResendDeployedAck`, sehingga item yang sudah terinisialisasi masih bisa menjadi otoritatif. Kalau penyebaran item benar-benar memantul, registry meminta dompet ATH resmi mengembalikan pemberitahuan yang tertunda. Tambatan antara nama dan item adalah penurunan alamat itu sendiri: `UsernameRegistry.get_username_item_address(name_hash)` memberi satu-satunya alamat tempat sebuah nama boleh berada. Sebuah `UsernameNFTItem` yang tersebar di alamat mana pun selain itu tidaklah otoritatif: klien, pengindeks, dan antarmuka tidak boleh memperlakukan item itu sendiri sebagai kepemilikan nama `.ath`, dan tidak boleh memakai pemilik pada catatan registry sebagai pemilik terkini setelah terjadi perpindahan.

## Biaya avatar

Biaya pembaruan avatar:

```text
100 ATH
```

Pembaruan avatar dibayar dalam ATH dari dompet milik sendiri: transfer dengan pemberitahuan dari dompet ATH-nya ke dompet ATH resmi ProfileRegistry.

ProfileRegistry menerima pembaruan hanya bila semua syarat terpenuhi:

- jumlahnya persis `100 ATH`;
- pengirimnya adalah dompet ATH resmi ProfileRegistry;
- dompet pembayar adalah dompet ATH milik pemilik;
- dompet pemilik berada di basechain;
- hash avatar bukan nol;
- pengenal aliran bukan nol;
- jumlah bagian antara 1 sampai 16;
- format media adalah WebP.

Pembaruan yang diterima membuat versi avatar baru dan membagi biayanya:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Pemberitahuan avatar yang ditolak dikembalikan lewat jalur pengembalian pemberitahuan ATHWallet. ProfileRegistry tidak membuat kantong pengembalian tersendiri untuk pembaruan yang cacat bentuk.

ProfileRegistry menetapkan harga dan menyelesaikan pembayaran, tetapi tidak menyimpan keadaan profil apa pun: penunjuk terautentikasi ke avatar berada di KeyShard milik pemiliknya sendiri. Bita gambar berada di PublicShard pada ranah AVATAR; klien menyusun WebP dari sana atau dari singgahan lokal dan mencocokkan bita dengan `avatar_hash` yang tersimpan. Riwayat yang hilang atau terpotong ditampilkan sebagai tidak tersedia.

## Market Stability Seller

MarketStabilitySeller adalah cadangan publik berupa kontrak yang membagikan ATH setelah pool resmi diluncurkan:

```text
60,000,000 ATH
```

Tujuannya mengurangi distorsi pasar awal akibat likuiditas yang tipis. Saat peluncuran, pool kecil bisa digerakkan tajam oleh sekelompok kecil pembeli awal. Bila itu terjadi, mereka yang butuh ATH untuk tindakan nyata di Platho bisa terpaksa membeli di puncak harga buatan.

MarketStabilitySeller membangun tangga pasokan yang transparan di atas harga peluncuran. Ia menjual ATH dalam tahap-tahap berukuran tetap. Setiap tahap berikutnya lebih mahal daripada sebelumnya, dan tiap tahap punya batas ukuran yang keras. Setelah pembekuan harga sekali jalan yang terikat bukti, jadwal tahap bersifat deterministik dan tidak bisa diubah tim secara manual.

Kalau spekulan awal mencoba menyerap ATH dalam jumlah besar, mereka membeli dari cadangan publik pada harga tahap yang menaik, alih-alih menguras seluruh likuiditas murah dari pool tipis lalu menjualnya kembali. Kalau pengguna biasa butuh ATH untuk Platho, mereka bisa membelinya pada harga tahap publik yang diketahui, tanpa mendorong pool kecil menjadi vertikal dengan satu gelombang permintaan.

Cadangan ini tidak membuang token ke pasar. Ia tidak menjual dengan sendirinya dan tidak menciptakan tekanan jual tanpa permintaan. Penjualan hanya terjadi saat seseorang secara sukarela membeli dari tahap yang sedang berjalan. Tanpa permintaan, cadangan diam.

Kegunaan ATH di on-chain bersifat konkret:

- mendaftarkan nama `.ath` dibayar dalam ATH lewat UsernameRegistry;
- pembaruan penunjuk avatar dibayar dalam ATH lewat ProfileRegistry;
- ATH di dompet milik sendiri menurunkan biaya protokol penerbitan setelah gerbang distribusi aktivitas;
- biaya nama dan avatar yang diterima menciptakan utang perbendaharaan dan utang pembakaran;
- BuybackBurn membeli ATH dengan biaya protokol dalam GRAM dan membakar ATH yang diterima lewat ATHMaster.

Penerbitan dibayar dalam GRAM langsung dari dompet. ATH tidak membayar seluruh transaksi penerbitan. Ia menurunkan komponen biaya protokol setelah gerbang potongan terbuka.

Dengan begitu permintaan ATH terikat pada tindakan protokol yang spesifik: nama `.ath`, pembaruan avatar, potongan biaya setelah airdrop, serta tekanan pembelian kembali dan pembakaran. MarketStabilitySeller memperluas pasokan yang tersedia hanya seiring tahap berikutnya diambil, sehingga akses awal bersifat publik dan deterministik, bukan didominasi pool yang tipis.

Cadangan baru dijual setelah pembekuan harga pascapool.

Pembekuan harga adalah kuasa peluncuran yang nyata dan sekali pakai. Ia menetapkan harga dasar tahap satu kali dari bukti peluncuran pool, lalu hash pengendali peluncuran dihapus. Sejak itu MarketStabilitySeller tidak bisa mencuri dana, menjeda penjualan, mengosongkan saldo secara darurat, melangkahi pembeli, atau mengubah daftar harga.

MarketStabilitySeller dikapitalisasi pada genesis final dengan cadangan penuh `60,000,000 ATH`, didanai lewat alur pendanaan cadangan terautentikasi ke dompet ATH resmi penjual, sampai batas keras `60,000,000 ATH`. `mainnet:genesis:verify` memeriksa bahwa pihak penjual memikul cadangan penuh dan bahwa jaminan dompet ATH resminya paling sedikit `60,000,000 ATH` sebelum rilis produksi. Transfer ATH biasa yang tidak diminta ke dompet resmi itu tidak menambah cadangan yang terbukukan, tidak memperluas pasokan yang dapat dijual, dan bisa saja tersangkut; saldo di atas `60,000,000 ATH` diperlakukan sebagai peringatan, bukan cadangan tambahan.

Menjual adalah langkah tersendiri setelah pool. Cadangan tidak dijual sebelum peluncuran; pada saat itu pembekuan harga sekali jalan yang terikat bukti menetapkan harga dasar tahap, dan sejak itu jadwal tahap bersifat deterministik serta tidak bisa diubah tim secara manual.

Cadangan dipecah menjadi 20 tahap:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Tiap tahap punya pengali:

```text
x2, x3, x4, ..., x21
```

Ini membentuk tangga harga yang landai. Seiring proyek makin populer, pasar menerima pasokan ATH tambahan, tetapi tiap tahap berikutnya lebih mahal daripada sebelumnya. Permintaan awal tidak menghantam pool tipis sekaligus, dan kenaikan harga tidak berubah menjadi dinding tegak yang membuat token utilitas tidak nyaman dipakai.

Rumus pembelian:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` dibekukan setelah pool diluncurkan dan persis sesuai bukti harga x1.

Pada harga peluncuran `1 ATH = 0.001 GRAM`, harga x1 satu tahap adalah:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Maka:

| Tahap | Pengali | Harga per 3M ATH | Harga per 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Satu pembelian tidak boleh melewati batas tahap. Ini mencegah membeli ATH tahap berikutnya dengan harga tahap sebelumnya.

Pendapatan dalam GRAM baru diakui setelah ATH sampai ke pembeli. Jika transfer ATH gagal atau memantul, cadangan dipulihkan, pembeli menerima kembali pokok GRAM yang dibayarkan, dan utang perbendaharaan tidak bertambah.

Setelah tahap terakhir x21 terjual, MarketStabilitySeller tidak lagi mengatur harga ATH. Sejak itu harga sepenuhnya ditentukan pasar: likuiditas, pasokan yang tersedia, permintaan nama `.ath`, pembaruan avatar, potongan biaya setelah airdrop, serta tekanan pembelian kembali dan pembakaran.

Bahkan pada anak tangga x21, valuasi acuan tetap moderat dibandingkan model kegunaannya:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Pada anak tangga x21, MarketStabilitySeller telah merampungkan pelepasan cadangan yang terprogram. Setelah itu harga ATH sepenuhnya ditentukan pasar melalui likuiditas, permintaan pemakaian, pasokan yang tersedia, serta tekanan pembelian kembali dan pembakaran. Satu-satunya distribusi protokol yang tersisa adalah jadwal vesting jangka panjang yang lambat, dibatasi `100,000 ATH` per tahun.

## Kantong perbendaharaan dan pembakaran

UsernameRegistry dan ProfileRegistry memakai model pembagian biaya ATH yang sama:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Mengosongkan utang perbendaharaan mengirim ATH kepada pihak penerima perbendaharaan lewat dompet ATH resmi.

Mengosongkan utang pembakaran mengirim permintaan pembakaran ATH lewat dompet ATH resmi. Pasokan baru berkurang setelah pembakaran difinalisasi di ATHMaster.

Jalur gagal dan jalur pantulan memulihkan kantong-kantong utang itu. Pembukuan dipertahankan sampai transfer atau pembakaran di hilir rampung.

## Pembukuan ATHWallet

Saldo ATH berada di kontrak ATHWallet yang deterministik.

ATHWallet menangani:

- pengkreditan pasokan genesis;
- transfer biasa;
- transfer dengan pemberitahuan;
- pemberitahuan pencetakan nama;
- pemberitahuan avatar;
- permintaan pembakaran;
- konfirmasi pemberitahuan;
- pemangkasan pemberitahuan yang basi;
- pemulihan setelah pantulan atau kegagalan.

Kontrak yang menerima ATH sebagai pembayaran tidak menerima pesan langsung dari alamat sembarangan. Mereka hanya menerima pemberitahuan dari ATHWallet resmi miliknya sendiri. Autentikasi dompet sumber terjadi di dalam ATHWallet lewat penurunan alamat yang deterministik.

ATH menyediakan titik masuk transfer bergaya TEP-74 untuk perkakas jetton umum, tetapi tindakan protokol Platho memakai pesan pemberitahuan ATH yang terautentikasi. Integrasi luar tidak boleh menganggap alur pemberitahuan Platho memancarkan `JettonTransferNotification` yang generik.

Transfer internal keluar di ATHWallet dilindungi pembukuan operasi tertunda di sisi sumber dan konfirmasi di sisi sumber. Saldo tidak dipulihkan dari badan pesan pantulan tanpa bukti adanya operasi tertunda.

## Daur hidup ATH

1. `ATHMaster` menciptakan pasokan tetap `100,000,000 ATH`.
2. Penyebaran perbendaharaan sekali jalan menerima pasokan ke dompet ATH perbendaharaan.
3. Pasokan dibagi ke aktivitas, likuiditas, vesting jangka panjang, dan stabilitas pasar.
4. Pengguna menerbitkan pesan dengan membayar langsung dari dompetnya sendiri.
5. Penerbitan yang berhasil mengkredit imbalan aktivitas `10 ATH`.
6. Begitu airdrop aktivitas `15,000,000 ATH` terdistribusi penuh dan `airdrop_remaining_ath == 0`, potongan biaya protokol terbuka.
7. Pool ATH/GRAM diluncurkan pada harga acuan `1 ATH = 0.001 GRAM`.
8. Bukti rute dan bukti harga pascapool dibekukan.
9. MarketStabilitySeller menjual cadangan lewat tahap x2..x21.
10. Setelah pembagian aktif, FeeAccumulator membagi biaya GRAM antara perbendaharaan dan pembelian kembali.
11. BuybackBurn membeli ATH dengan biaya GRAM dan membakarnya lewat ATHMaster.
12. Biaya nama dan profil menciptakan utang perbendaharaan ATH dan utang pembakaran ATH.
13. Pasokan total berkurang berangsur lewat pembakaran terautentikasi.

## Model akhir

ATH menyatukan empat lapis Platho:

1. **Pemakaian aplikasi** — pesan menghasilkan imbalan aktivitas.
2. **Fitur berbayar** — nama dan avatar menuntut ATH.
3. **Potongan** — saldo ATH menurunkan biaya protokol setelah gerbang distribusi.
4. **Penyusutan pasokan** — sebagian biaya ATH dan hasil pembelian kembali dibakar lewat ATHMaster.

Model ini berangkat dari pasokan tetap dan valuasi acuan `100,000 GRAM`. Distribusi perdana terikat pada pemakaian nyata yang berbayar: pesan mulai dari `0.0191 GRAM` — saat ini `0.0191 GRAM` untuk pesan privat dan `0.0203 GRAM` untuk kiriman publik — ditambah bonus aktivitas `10 ATH` per kapsul yang difinalisasi. Kelas ukuran publik atau privat yang lebih besar lebih mahal. Bonus itu bukan pengembalian dana, bukan ganti rugi, dan bukan janji keuntungan. Setelah 15% pasokan pertama terdistribusi, pool diluncurkan, potongan biaya terbuka, dan jalur pembelian kembali membuka.

ATH ada sebagai token kerja di dalam Platho: dibagikan lewat aktivitas, dipakai pada tindakan berbayar, menurunkan biaya protokol, dijual dari cadangan menuruti tangga yang telah ditetapkan, dan dibakar on-chain. Setelah tangga stabilitas pasar berakhir, harga ATH di masa depan ditentukan pasar dan oleh pemakaian protokol.
