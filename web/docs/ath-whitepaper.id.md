# Whitepaper ATH

## Token Protokol Platho

ATH adalah token utilitas Platho. Token ini digunakan untuk imbalan aktivitas, diskon biaya-protokol pasca-airdrop, nama pengguna `.ath`, pembaruan avatar profil, penjualan stabilitas pasar, buyback, dan burn.

ATH bukan token administratif. Token ini tidak memberikan kemampuan untuk menulis ulang saldo, menghentikan operasi, mencetak pasokan baru, atau mengubah aturan kepemilikan pengguna. Perannya adalah menggerakkan ekonomi aplikasi dan menghubungkan penggunaan Platho dengan pembukuan on-chain.

Dokumen ini menjelaskan model ATH di Platho v1.

## Parameter Inti

ATH memiliki total pasokan tetap:

```text
100,000,000 ATH
```

ATH menggunakan 9 desimal:

```text
1 ATH = 1,000,000,000 atomic units
```

Total pasokan dalam atomic units:

```text
100,000,000,000,000,000
```

Harga referensi peluncuran adalah:

```text
1 ATH = 0.001 GRAM
```

Valuasi terdilusi penuh saat peluncuran adalah:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH dimulai dari kapitalisasi referensi sebesar `100,000 GRAM`.

## Pasokan Tetap

ATH diterbitkan oleh `ATHMaster`. Pada inisialisasi, `ATHMaster` menetapkan total pasokan tetap sebesar `100,000,000 ATH`.

Tidak ada fungsi mint pasca-genesis. `ATHMaster` tidak mengimplementasikan admin minting, pause, blacklist, transfer tax, force transfer, atau rescue drain.

Deployment pasokan awal dilakukan satu kali melalui `DeployTreasurySupply`. Ini mengirim seluruh pasokan ke wallet ATH treasury. Deployment pasokan genesis tidak dapat diulang.

Total pasokan hanya berkurang melalui burn. `ATHMaster` menerima burn hanya setelah notifikasi burn yang terautentikasi dari wallet ATH deterministik dari alamat pemilik. Setelah verifikasi, `ATHMaster` mengurangi `total_supply` dan mengirim `ATHBurnFinalized`.

ATH burn adalah pengurangan nyata dari total pasokan, bukan transfer ke alamat yang tidak digunakan.

## Alokasi Pasokan

Pasokan ATH dialokasikan ke dalam empat kategori:

| Kategori | Bagian | Jumlah |
| --- | ---: | ---: |
| Airdrop aktivitas | 15% | 15,000,000 ATH |
| Likuiditas awal | 15% | 15,000,000 ATH |
| Vesting protokol jangka panjang | 10% | 10,000,000 ATH |
| Cadangan stabilitas pasar | 60% | 60,000,000 ATH |

Alokasi ini mendefinisikan struktur ekonomi Platho:

- 15% dari pasokan didistribusikan kepada pengguna melalui aktivitas aplikasi sebelum peluncuran pool.
- 15% dari pasokan digunakan untuk likuiditas awal.
- 10% dari pasokan dikunci dalam vesting jangka panjang yang immutable.
- 60% dari pasokan dicadangkan untuk MarketStabilitySeller dan dijual dalam tranche di atas harga peluncuran setelah pembekuan harga pasca-pool dan gate kesiapan pendanaan cadangan.

Airdrop aktivitas dan cadangan vesting jangka panjang didukung pada genesis final oleh wallet ATH resmi dari Vault dan ATHVesting, dan verifier rilis memeriksa saldo tersebut sebelum rilis produksi. Alokasi stabilitas pasar sebesar `60,000,000 ATH` dicadangkan untuk MarketStabilitySeller, tetapi tidak didanai ke dalam seller pada genesis final. Pendanaan seller hanya terjadi setelah peluncuran pool, pembekuan harga terikat-bukti satu kali, dan alur notify reserve-funder terikat; kesiapan seller hanya valid setelah `reserve_due_ath`, `reserve_funded_total_ath`, dan backing wallet ATH resmi seller diverifikasi.

## Vesting Protokol Jangka Panjang

Cadangan vesting jangka panjang adalah:

```text
10,000,000 ATH
```

Cadangan ini dipegang oleh `ATHVesting`, bukan oleh bucket treasury yang mutable. Jadwal vesting ditetapkan dalam kontrak:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Siapa pun dapat memicu klaim setelah ATH ter-vesting, tetapi penerima manfaat bersifat immutable. Kontrak tidak memiliki akselerasi, perubahan penerima manfaat, pause, admin sweep, rescue drain, atau fungsi rilis diskresioner.

Pada genesis final, `ATHWallet(owner = ATHVesting, master = ATHMaster)` resmi harus berisi tepat `10,000,000 ATH`. Verifier juga mensyaratkan nol ATH yang telah diklaim, fase idle, dan tidak ada transfer tertunda sebelum peluncuran.

Cadangan ini sengaja dibuat lambat. Ini menciptakan horizon panjang untuk pengembangan protokol tanpa menempatkan bucket likuid 10M ATH di atas pasar saat peluncuran.

## Airdrop Aktivitas

Airdrop aktivitas adalah:

```text
15,000,000 ATH
```

Imbalan per publish yang berhasil:

```text
10 ATH
```

Imbalan dikreditkan ke saldo ATH internal pengguna di Vault setelah publish yang berhasil. Publish yang berhasil berarti Vault mengirim payload ke CapsuleHub, CapsuleHub menerima entri, dan Vault menerima acknowledgement.

Upaya publish yang gagal tidak menciptakan imbalan aktivitas.

Pembukuan imbalan:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Jika sisa bucket airdrop di bawah 10 ATH, jumlah sisanya yang dikreditkan. Setelah bucket habis, imbalan aktivitas baru berhenti.

Airdrop aktivitas dibukukan di Vault dan didukung oleh wallet ATH Vault resmi yang telah didanai sebelumnya.

Deposit ATH Vault hanya didukung melalui alur transfer-with-notify ATHWallet pengguna
(`ATHTransferRequestWithNotify`) ke dalam Vault. Transfer ATH biasa manual ke ATHWallet Vault resmi
tidak didukung: transfer tersebut dapat meningkatkan saldo mentah wallet resmi, tetapi tidak menciptakan `Vault.user.ath_balance` dan tidak
boleh ditampilkan oleh PWA sebagai jalur deposit.

Penarikan ATH Vault adalah perintah Vault eksternal yang ditandatangani. Cadangan eksekusi deployment ATHWallet hilir, transfer, penyimpanan, dan
ACK dibayar dari saldo GRAM internal Vault pengguna. Vault hanya mengkreditkan kembali nilai ACK/fail/bounce terautentikasi
yang diterimanya, dikurangi cadangan refund lokal dan dibatasi oleh nilai internal yang dicadangkan. Salinan produk
tidak boleh menjanjikan refund GRAM ekses yang lengkap.

## Harga Aktivitas

Salinan produk publik dapat menyatakan pesan dimulai dari harga dasar publik eksak saat ini:

```text
from 0.0337 GRAM
```

Contoh kanonik eksak saat ini sebelum diskon ATH adalah:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Untuk publish yang berhasil, pengguna menerima:

```text
10 ATH
```

Pada harga referensi peluncuran:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Ini mengaitkan distribusi ATH awal dengan penggunaan aplikasi nyata. Imbalan adalah bonus aktivitas, bukan refund, cashback,
rabat, atau janji bahwa ATH akan mengganti biaya GRAM dari sebuah publish. Nilai referensi peluncuran dari `10 ATH` dapat
lebih rendah dari biaya GRAM kapsul, dan itu disengaja: pengguna menerima kepemilikan jaringan awal untuk penggunaan nyata,
bukan penggantian yang dijamin.

Salinan produk dapat merangkum penetapan harga kapsul sebagai pesan mulai dari `0.0337 GRAM`; contoh kanonik eksak saat ini adalah post publik 1 KiB mulai dari `0.0337 GRAM` dan kapsul privat hybrid 1 KiB mulai dari `0.0347 GRAM`. Blok kapsul publik atau privat yang lebih besar berbiaya lebih karena
body 1, 2, 4, 8, 16, atau 32 KiB yang dipilih mengubah cadangan eksekusi dan penyimpanan Vault/CapsuleHub. Imbalan tetap `10 ATH` per kapsul yang berhasil difinalisasi,
terlepas dari ukuran kapsul.

Publishing privat menggunakan profil keamanan hybrid secara default: X25519 + ML-KEM-768 + AES-GCM. Tidak ada mode pesan-privat klasik yang lebih murah di V1.

ATH dapat diperdagangkan di atas atau di bawah harga referensi peluncuran setelah pool resmi ada. Dokumen protokol tidak boleh menyajikan
imbalan aktivitas sebagai imbal hasil investasi, ekspektasi keuntungan, atau jaminan harga.

## Biaya Protokol dan Harga Pengguna

Di dalam Vault, biaya protokol terpisah dari biaya penuh yang dihadapi pengguna.

Biaya protokol:

| Jenis publish | Biaya protokol |
| --- | ---: |
| Post publik | 0.010 GRAM |
| Pesan privat hybrid | 0.010 GRAM |

Harga yang dihadapi pengguna mencakup biaya protokol, endowment penyimpanan indeks/header ringkas, cadangan eksekusi lokal Vault, dan refund ACK yang diharapkan:

| Jenis publish | Harga yang dihadapi pengguna |
| --- | ---: |
| Label publik/produk | from 0.0337 GRAM |
| Contoh eksak post publik saat ini | 0.0337 GRAM |
| Contoh eksak privat hybrid 1 KiB saat ini | 0.0347 GRAM |

Jika PWA menerima estimasi jaringan konservatif yang lebih tinggi, ia menambahkan kelebihan estimasi ke max charge kanonik, dibulatkan ke atas ke langkah `0.001 GRAM` yang bersih. Diskon ATH berlaku untuk biaya protokol, bukan untuk biaya jaringan atau cadangan penyimpanan. Surcharge ini adalah margin keamanan yang ditandatangani: jika CapsuleHub menerima publish, ACK sukses hanya mengembalikan cadangan ACK publish tetap sebesar `30,000,000` nanotons (`0.030 GRAM`). Setelah Vault memproses ACK tersebut, pengguna dikreditkan sekitar `25,800,000` nanotons dalam saldo GRAM internal Vault. Bagian di atas nilai kanonik yang diperlukan tetap berada di CapsuleHub sebagai kelebihan cadangan jaringan/penyimpanan. Bagian tersebut tidak dikembalikan ke Vault dan tidak dihitung sebagai `accrued_plato_fee_ton` pada saat publish. Hanya surplus mentah di atas cadangan terlindungi CapsuleHub yang nantinya dapat disapu tanpa izin ke FeeAccumulator, di mana ia mengikuti pembukuan treasury/buyback normal. CapsuleHub menyimpan metadata entri terautentikasi yang ringkas dan hash body; body berat dipulihkan dari riwayat transaksi publish yang diterima dan diverifikasi secara lokal.

## Diskon ATH

ATH mengurangi biaya protokol pesan setelah airdrop aktivitas terdistribusi sepenuhnya.

Diskon terbuka hanya ketika sisa airdrop aktivitas adalah:

```text
airdrop_remaining_ath == 0 ATH
```

Sebelum titik ini, biaya protokol dibayar penuh.

Ambang diskon penuh:

```text
10,000 ATH
```

Jika saldo ATH internal pengguna di Vault minimal `10,000 ATH`, pengguna mencapai tier diskon biaya-protokol penuh untuk komponen biaya Platho. Biaya jaringan dan cadangan penyimpanan tetap dibayar.

Jika saldo di bawah `10,000 ATH`, biaya berkurang secara linear:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Perhitungan dibulatkan ke atas. Dengan konstanta saat ini, biaya protokol penuh adalah `0.010 GRAM` (`10,000,000 nanotons`) untuk kapsul publik maupun privat, dan pengurangan maksimum adalah `0.010 GRAM` per kapsul.

## Peluncuran Pool

Pool ATH/GRAM diluncurkan setelah seluruh airdrop aktivitas `15,000,000 ATH` terdistribusi.

Urutan peluncuran adalah:

1. Pengguna menerima ATH melalui penggunaan Platho nyata.
2. Seluruh airdrop aktivitas terdistribusi.
3. Diskon ATH terbuka.
4. Pool ATH/GRAM diluncurkan.
5. Bukti rute pasca-pool dan bukti harga dibekukan.
6. Split buyback diaktifkan.

Pool dimulai dari harga referensi:

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

Biaya protokol yang dikumpulkan sebelum peluncuran pool tidak diharapkan mendanai sepenuhnya sisi GRAM dari likuiditas awal. Rencana
likuiditas awal mungkin memerlukan pendanaan proyek/treasury sebagai tambahan dari pendapatan protokol. Ini merupakan bagian dari bootstrap
peluncuran dan tidak mengubah imbalan aktivitas menjadi klaim berdenominasi GRAM.

Pool diluncurkan di sekitar token yang telah didistribusikan melalui penggunaan aplikasi. Ini memisahkan ATH dari listing kosong tanpa basis pengguna.

## FeeAccumulator

Biaya protokol GRAM dikumpulkan di `FeeAccumulator`.

Sebelum split buyback diaktifkan, seluruh GRAM yang terakumulasi berpindah ke bucket treasury:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` tidak bertambah sebelum split diaktifkan.

Setelah `EnableBuybackSplit`, GRAM yang terakumulasi di-split:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Jika jumlahnya ganjil dalam nanotons, sisanya tetap berada di sisi buyback:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` adalah aksi satu arah yang dieksekusi oleh receiver treasury yang immutable setelah peluncuran pool dan pembekuan
rute buyback. Ini adalah otoritas satu kali yang nyata: ia tidak dapat mencuri dana, pause, rescue, atau mengubah alamat, tetapi ia secara permanen
mengubah ekonomi FeeAccumulator dari akumulasi treasury-only bootstrap menjadi split 50/50 treasury/buyback. Ini
diaktifkan hanya setelah preflight rilis lolos.

Otoritas rilis Platho sengaja dibuat sempit dan sebagian besar satu tembakan. Mereka tetap ada dan harus disebut secara jujur:
pemilik treasury men-deploy pasokan ATH awal satu kali; pengontrol genesis melakukan binding pra-seal dan sealing;
pengontrol peluncuran BuybackBurn membekukan rute pasca-pool satu kali; pembekuan harga MarketStabilitySeller dilakukan
satu kali oleh pengontrol peluncurannya; dan receiver treasury FeeAccumulator mengaktifkan split buyback satu arah setelah preflight. Tidak satu pun dari
peran ini merupakan mekanisme rescue, pause, upgrade, admin drain, atau kontrol saldo sewenang-wenang.

## Buyback dan Burn

Buyback dieksekusi melalui `FeeAccumulator` dan `BuybackBurn`.

BuybackBurn hanya menerima envelope eksekusi penuh:

```text
51.05 GRAM
```

Struktur envelope:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

`50 GRAM` mentah bukan chunk buyback yang valid. Buyback hanya diterima sebagai envelope rute penuh.

Setelah pembekuan rute, BuybackBurn mengeksekusi buyback sebagai berikut:

1. Menerima `51.05 GRAM` hanya dari FeeAccumulator yang terikat.
2. Mencatat jumlahnya di `reserve_due_ton`.
3. Pada `ExecuteBuybackChunk`, mengonsumsi satu envelope.
4. Menggunakan quote yang dibekukan dan minOut yang dibekukan.
5. Menetapkan deadline STON.fi secara internal.
6. Mengirim rute melalui pTON wallet yang dibekukan.
7. Menerima ATH hanya melalui wallet ATH BuybackBurn resmi.
8. Memverifikasi bahwa source wallet cocok dengan pool STON.fi yang dibekukan.
9. Mengirim ATH yang diterima ke burn melalui wallet ATH resmi.
10. Menyelesaikan siklus hanya setelah `ATHBurnFinalized` dari `ATHMaster`.

Keberhasilan buyback tidak didefinisikan oleh pesan router, permintaan burn keluar, atau notifikasi burn ATHWallet. Ia hanya didefinisikan
ketika BuybackBurn menerima `ATHBurnFinalized` terautentikasi dari ATHMaster. Sampai finalisasi tersebut tiba,
BuybackBurn tetap harus diperlakukan sebagai status burn tertunda atau status retry; dashboard dan indexer tidak boleh menghitung ATH sebagai
ter-burn hanya karena upaya burn telah dikirim.

Jika burn tidak difinalisasi, ATH yang diterima berpindah ke retry due. `RetryAthBurnDue` mem-burn seluruh jumlah retry due.

## Biaya Nama Pengguna

Registrasi nama pengguna `.ath` dibayar dalam ATH melalui wallet ATH UsernameRegistry resmi.

Harga:

| Panjang nama | Harga |
| ---: | ---: |
| 4 karakter | 10,000 ATH |
| 5 karakter | 1,000 ATH |
| 6+ karakter | 100 ATH |

UsernameRegistry hanya menerima harga yang tepat. Bayar kurang dan bayar lebih tidak menciptakan nama.

Mint yang diterima melewati status pending dan men-deploy `UsernameNFTItem`. Sebelum acknowledgement item, pembayaran tidak diakui sebagai pendapatan. Setelah acknowledgement item, jumlahnya di-split:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Mint nama pengguna V1 saat ini didanai Vault. Penolakan nama pengguna tidak valid, harga salah, atau nama duplikat memantul melalui
jalur notifikasi wallet ATH resmi sehingga Vault dapat memulihkan ATH internal pengguna. UsernameRegistry tidak memelihara
bucket refund nama pengguna eksternal langsung dalam alur yang didanai Vault saat ini.

ATH dari mint nama pengguna menjadi pendapatan protokol hanya setelah deployment item yang sesuai dikonfirmasi.

Otoritas nama pengguna dibagi secara sengaja: `UsernameRegistry` menjangkarkan nama ke satu `UsernameNFTItem` yang tepat, dan
status item membawa pemilik saat ini. Transfer item mentransfer nama pengguna. Item mengekspos data NFT standar
dan metadata on-chain TEP-64, termasuk `name = <username>.ath`; ia tidak bergantung pada server Platho untuk metadata.
Byte nama pengguna V1 bersifat literal dan tidak dinormalisasi tampilan: nama dengan separator di awal, akhir, berturut-turut, dan seluruhnya separator
valid ketika setiap byte berada dalam set `a-z`, `0-9`, `_`, `-` yang diizinkan dan panjangnya 4..16.
Jika deployment item dicoba tetapi ACK item tidak pernah mencapai registry, `PrunePendingUsernameMint` sengaja dibuat
non-destruktif di V1: ia tidak menebak kegagalan, menghapus status pending, atau menciptakan refund due. Jalur pemulihan adalah
`UsernameItemDeployedAck` yang terlambat atau `UsernameNFTItem.ResendDeployedAck`, sehingga item yang telah diinisialisasi masih dapat menjadi otoritatif.
Jika deployment item benar-benar memantul, registry meminta wallet ATH resmi untuk me-refund notifikasi yang tertunda.
`UsernameNFTItem` yang telah di-deploy tanpa `UsernameRegistry.name_records[name_hash]` yang menunjuk ke item yang tepat itu bersifat
non-otoritatif: klien, indexer, dan UI tidak boleh memperlakukan item tersebut sendirian sebagai kepemilikan nama `.ath`, dan tidak boleh
menggunakan pemilik record registry sebagai pemilik saat ini setelah transfer.

## Biaya Avatar Profil

Biaya pembaruan avatar profil:

```text
100 ATH
```

Pembaruan avatar profil V1 saat ini didanai Vault. PWA mengirim `SetProfileAvatarFromVaultBalance` ke Vault; Vault membayar melalui jalur notifikasi wallet ATH resminya ke wallet ATH ProfileRegistry resmi. Pembayaran avatar langsung dari wallet pengguna bukan alur produk V1 yang didukung.

ProfileRegistry menerima pembaruan hanya ketika semua kondisi terpenuhi:

- jumlahnya tepat `100 ATH`;
- pengirim adalah wallet ATH ProfileRegistry resmi;
- wallet pembayar adalah Vault yang terikat;
- wallet pemilik berada di basechain;
- hash avatar tidak nol;
- stream id tidak nol;
- jumlah part dari 1 hingga 16;
- format media adalah WebP.

Pembaruan yang diterima menciptakan versi avatar baru dan men-split biaya:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Notifikasi avatar yang ditolak di-refund melalui jalur bounce notifikasi ATHWallet. ProfileRegistry tidak menciptakan bucket refund terpisah untuk pembaruan avatar yang cacat.

ProfileRegistry menyimpan pointer avatar terautentikasi, bukan byte gambar permanen. PWA harus merekonstruksi data WebP avatar dari entri CapsuleHub publik atau cache lokal dan memverifikasi byte terhadap `avatar_hash` yang tersimpan; riwayat yang hilang atau ter-prune ditampilkan sebagai tidak tersedia.

## Market Stability Seller

MarketStabilitySeller adalah cadangan kontrak publik yang mendistribusikan ATH setelah peluncuran pool resmi:

```text
60,000,000 ATH
```

Tujuannya adalah mengurangi distorsi pasar-awal yang disebabkan oleh likuiditas tipis. Saat peluncuran, pool kecil dapat digerakkan tajam oleh sekelompok kecil pembeli awal. Jika itu terjadi, pengguna yang membutuhkan ATH untuk aksi Platho aktual dapat dipaksa membeli ke dalam lonjakan harga artifisial.

MarketStabilitySeller menciptakan tangga pasokan transparan di atas harga peluncuran. Ia menjual ATH dalam tranche berukuran tetap. Setiap tranche berikutnya lebih mahal dari sebelumnya, dan setiap tranche memiliki batas ukuran keras. Setelah pembekuan harga terikat-bukti satu kali, jadwal tranche bersifat deterministik dan tidak dapat diubah secara manual oleh tim.

Jika spekulan awal mencoba menyerap ATH dalam jumlah besar, mereka membeli dari cadangan publik pada harga tranche yang meningkat alih-alih mengekstraksi seluruh likuiditas murah dari pool tipis dan menjualnya kembali kepada pengguna. Jika pengguna biasa membutuhkan ATH untuk Platho, mereka dapat membelinya pada harga tranche publik yang diketahui tanpa mendorong pool kecil secara vertikal dengan satu gelombang permintaan.

Cadangan tidak membanjiri pasar dengan token. Ia tidak menjual dengan sendirinya dan tidak menciptakan tekanan jual tanpa permintaan. Penjualan hanya terjadi ketika pembeli secara sukarela membeli dari tranche saat ini. Jika tidak ada permintaan, cadangan tetap idle.

Utilitas on-chain ATH bersifat spesifik:

- registrasi nama pengguna `.ath` dibayar dalam ATH melalui UsernameRegistry;
- pembaruan pointer avatar profil dibayar dalam ATH melalui ProfileRegistry;
- ATH yang dipegang dalam saldo Vault internal pengguna mengurangi biaya protokol untuk publish Vault setelah gate distribusi-aktivitas;
- biaya nama pengguna dan avatar yang diterima menciptakan treasury due dan burn due;
- BuybackBurn membeli ATH dengan biaya protokol GRAM dan mem-burn ATH yang diterima melalui ATHMaster.

Publish Vault dibayar dalam GRAM. ATH tidak membayar seluruh transaksi publish. Ia mengurangi komponen biaya-protokol setelah gate diskon terbuka.

Ini membuat permintaan ATH terkait dengan aksi protokol konkret: nama `.ath`, pembaruan avatar, diskon biaya-protokol Vault pasca-airdrop, dan tekanan buyback/burn. MarketStabilitySeller memperluas pasokan yang tersedia hanya seiring pembeli mengambil tranche berikutnya, sehingga akses awal bersifat publik dan deterministik alih-alih didominasi oleh pool tipis.

Cadangan hanya dijual setelah pembekuan harga pasca-pool.

Pembekuan harga adalah otoritas peluncuran satu kali yang nyata. Ia menetapkan harga tranche dasar satu kali dari bukti peluncuran-pool, kemudian hash pengontrol peluncuran dibersihkan. Setelah itu, MarketStabilitySeller tidak dapat mencuri dana, menghentikan penjualan, me-rescue saldo, meng-override pembeli, atau memutasi jadwal harga.

Kesiapan MarketStabilitySeller adalah gate pasca-pool, bukan pengganti verifikasi genesis final. Urutan
produksi adalah: `mainnet:genesis:verify` lolos pada snapshot final yang bersih, harga dibekukan setelah peluncuran pool, reserve funder
yang terikat mendanai seller melalui alur notify, kemudian `market-stability:readiness` memeriksa status seller, pendanaan, bukti
harga, dan backing wallet. Kesiapan seller valid untuk produksi hanya setelah pass kesiapan tersebut.

Pendanaan hanya diterima:

- setelah seal;
- setelah pembekuan harga;
- melalui wallet ATH seller resmi;
- dari reserve funder yang terikat;
- hingga batas total `60,000,000 ATH`.

Hanya pendanaan cadangan yang terautentikasi yang meningkatkan pembukuan cadangan yang dapat dijual. Runtime mengizinkan pendanaan cadangan parsial dan penjualan parsial, tetapi kesiapan peluncuran memerlukan cadangan penuh: `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`, dan backing wallet resmi minimal `60,000,000 ATH`. Transfer ATH biasa yang tidak diminta ke dalam wallet ATH seller resmi tidak meningkatkan `reserve_due_ath` atau `reserve_funded_total_ath`, tidak memperluas pasokan yang dapat dijual, dan dapat tetap tersangkut. Kesiapan memperlakukan saldo wallet resmi di atas `60,000,000 ATH` sebagai peringatan, bukan sebagai cadangan tambahan.

Cadangan dibagi menjadi 20 tranche:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Setiap tranche memiliki pengali:

```text
x2, x3, x4, ..., x21
```

Ini menciptakan tangga harga yang mulus. Seiring popularitas proyek tumbuh, pasar menerima pasokan ATH tambahan, tetapi setiap tranche berikutnya lebih mahal dari sebelumnya. Permintaan awal tidak langsung menghantam pool tipis, dan pertumbuhan harga tidak menjadi tembok vertikal yang membuat token utilitas tidak nyaman digunakan.

Formula pembelian:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` dibekukan setelah peluncuran pool dan tepat cocok dengan bukti penetapan harga x1.

Pada harga peluncuran `1 ATH = 0.001 GRAM`, harga x1 dari satu tranche adalah:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Oleh karena itu:

| Tranche | Pengali | Harga untuk 3M ATH | Harga per 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Satu pembelian tidak dapat melintasi batas tranche. Ini mencegah pembelian ATH dari tranche berikutnya dengan harga tranche sebelumnya.

Pendapatan GRAM diakui hanya setelah ATH dikirim ke pembeli. Jika transfer ATH gagal atau memantul, cadangan dipulihkan, pembeli menerima kembali pokok GRAM yang dibayarkan, dan treasury due tidak bertambah.

Setelah tranche x21 terakhir terjual, MarketStabilitySeller tidak lagi mengatur harga ATH. Sejak titik itu, harga sepenuhnya ditentukan oleh pasar: likuiditas, pasokan yang tersedia, permintaan atas nama `.ath`, pembaruan avatar, diskon biaya-protokol Vault pasca-airdrop, dan tekanan buyback/burn.

Bahkan pada langkah x21, valuasi referensi tetap moderat relatif terhadap model utilitas:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Pada langkah x21, MarketStabilitySeller telah menyelesaikan pelepasan cadangan terprogramnya. Setelah itu, harga ATH sepenuhnya ditentukan pasar oleh likuiditas, permintaan penggunaan, pasokan yang tersedia, dan tekanan buyback/burn. Satu-satunya alokasi protokol yang tersisa adalah jadwal vesting jangka panjang yang lambat, dibatasi pada `100,000 ATH` per tahun.

## Bucket Treasury dan Burn

UsernameRegistry dan ProfileRegistry menggunakan model split biaya ATH yang sama:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Flush treasury due mengirim ATH ke receiver treasury melalui wallet ATH resmi.

Flush burn due mengirim permintaan ATH burn melalui wallet ATH resmi. Pasokan berkurang hanya setelah finalisasi burn di ATHMaster.

Jalur fail dan bounce memulihkan bucket due. Pembukuan dipertahankan sampai transfer atau burn hilir selesai.

## Pembukuan ATHWallet

Saldo ATH berada dalam kontrak ATHWallet deterministik.

ATHWallet menangani:

- kredit pasokan genesis;
- transfer biasa;
- transfer with notify;
- notify mint nama pengguna;
- notify avatar profil;
- permintaan burn;
- acknowledgement notifikasi;
- prune notifikasi basi;
- pemulihan bounce/fail.

Kontrak yang menerima ATH sebagai pembayaran tidak menerima pesan langsung dari alamat sewenang-wenang. Mereka hanya menerima notifikasi dari ATHWallet resmi mereka. Autentikasi source wallet dilakukan di dalam ATHWallet melalui derivasi wallet deterministik.

ATH mengekspos entrypoint transfer mirip-TEP-74 untuk tooling jetton generik, tetapi aksi protokol Platho menggunakan pesan notifikasi ATH terautentikasi. Integrasi eksternal tidak boleh mengasumsikan bahwa alur notify Platho memancarkan `JettonTransferNotification` generik.

Transfer internal keluar di ATHWallet dilindungi oleh pembukuan pending sisi-sumber dan acknowledgement sumber. Saldo tidak dipulihkan dari body bounce tanpa bukti pending.

## Siklus Hidup ATH

1. `ATHMaster` menciptakan pasokan tetap `100,000,000 ATH`.
2. Deploy treasury satu tembakan menerima pasokan di wallet ATH treasury.
3. Pasokan dialokasikan ke aktivitas, likuiditas, vesting jangka panjang, dan stabilitas pasar.
4. Pengguna mem-publish pesan melalui Vault.
5. Publish yang berhasil mengkreditkan imbalan aktivitas `10 ATH`.
6. Setelah seluruh airdrop aktivitas `15,000,000 ATH` terdistribusi dan `airdrop_remaining_ath == 0`, diskon biaya-protokol ATH terbuka.
7. Pool ATH/GRAM diluncurkan pada harga referensi `1 ATH = 0.001 GRAM`.
8. Bukti rute pasca-pool dan bukti harga dibekukan.
9. MarketStabilitySeller menjual cadangan melalui tranche x2..x21.
10. Setelah split diaktifkan, FeeAccumulator membagi biaya protokol GRAM antara treasury dan buyback.
11. BuybackBurn membeli ATH dengan biaya protokol GRAM dan mem-burn ATH melalui ATHMaster.
12. Biaya nama pengguna dan profil menciptakan ATH treasury due dan ATH burn due.
13. Total pasokan berkurang secara bertahap melalui burn terautentikasi.

## Model Final

ATH menghubungkan empat lapisan Platho:

1. **Penggunaan aplikasi** - pesan menciptakan imbalan aktivitas.
2. **Fitur berbayar** - nama pengguna dan avatar memerlukan ATH.
3. **Diskon** - saldo ATH mengurangi biaya protokol setelah gate distribusi.
4. **Pengurangan pasokan** - sebagian dari biaya ATH dan output buyback di-burn melalui ATHMaster.

Model dimulai dengan pasokan tetap dan valuasi referensi `100,000 GRAM`. Distribusi pengguna utama terkait dengan penggunaan berbayar nyata: salinan produk dapat menyatakan pesan dimulai dari `0.0337 GRAM`, sementara contoh eksak saat ini adalah `0.0337 GRAM` untuk post publik 1 KiB dan `0.0347 GRAM` untuk kapsul privat hybrid 1 KiB, ditambah bonus aktivitas `10 ATH` per kapsul yang difinalisasi. Kelas ukuran publik atau privat yang lebih besar berbiaya lebih. Bonus itu bukan refund, penggantian, atau janji keuntungan. Setelah 15% pertama dari pasokan terdistribusi, pool diluncurkan, diskon biaya-protokol terbuka, dan jalur buyback terbuka.

ATH ada sebagai token yang berfungsi di dalam Platho: ia didistribusikan melalui aktivitas, digunakan dalam aksi berbayar, mengurangi biaya protokol, dijual dari cadangan melalui tangga yang terdefinisi, dan di-burn melalui burn on-chain. Setelah tangga stabilitas-pasar, harga ATH masa depan ditentukan oleh pasar dan penggunaan protokol.
