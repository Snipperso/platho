# Whitepaper ATH

## Token Protokol Platho

ATH adalah token utilitas Platho. Token ini digunakan untuk hadiah aktivitas, diskon biaya protokol pasca-airdrop, nama pengguna `.ath`, pembaruan avatar profil, penjualan stabilitas pasar, buyback, dan burn.

ATH bukan token administratif. Token ini tidak memberikan kemampuan untuk menulis ulang saldo, menjeda operasi, mencetak pasokan baru, atau mengubah aturan kepemilikan pengguna. Perannya adalah menggerakkan ekonomi aplikasi dan menghubungkan penggunaan Platho dengan pembukuan on-chain.

Dokumen ini menjelaskan model ATH di Platho.

## Parameter Inti

ATH memiliki total pasokan tetap:

```text
100,000,000 ATH
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

Tidak ada fungsi mint pasca-genesis. `ATHMaster` tidak mengimplementasikan pencetakan admin, penjedaan, blacklist, pajak transfer, transfer paksa, atau penarikan penyelamatan.

Penyebaran pasokan awal dilakukan satu kali melalui `DeployTreasurySupply`. Fungsi ini mengirim seluruh pasokan ke dompet ATH treasury. Penyebaran pasokan genesis tidak dapat diulang.

Total pasokan hanya berkurang melalui burn. `ATHMaster` menerima burn hanya setelah pemberitahuan burn terautentikasi dari dompet ATH deterministik milik alamat pemilik. Setelah verifikasi, `ATHMaster` mengurangi `total_supply` dan mengirim `ATHBurnFinalized`.

Burn ATH adalah pengurangan nyata terhadap total pasokan, bukan transfer ke alamat yang tidak terpakai.

## Alokasi Pasokan

Pasokan ATH dialokasikan ke dalam empat kategori:

| Kategori | Porsi | Jumlah |
| --- | ---: | ---: |
| Airdrop aktivitas | 15% | 15,000,000 ATH |
| Likuiditas awal | 15% | 15,000,000 ATH |
| Vesting protokol jangka panjang | 10% | 10,000,000 ATH |
| Cadangan stabilitas pasar | 60% | 60,000,000 ATH |

Alokasi ini mendefinisikan struktur ekonomi Platho:

- 15% pasokan didistribusikan kepada pengguna melalui aktivitas aplikasi sebelum peluncuran pool.
- 15% pasokan digunakan untuk likuiditas awal.
- 10% pasokan dikunci dalam vesting jangka panjang yang tidak dapat diubah.
- 60% pasokan didanakan ke MarketStabilitySeller dan dikunci pada genesis, lalu dijual dalam tahapan di atas harga peluncuran setelah pembekuan harga pasca-pool.

Airdrop aktivitas dan cadangan vesting jangka panjang didukung pada genesis final oleh dompet ATH resmi milik Vault dan ATHVesting, dan verifier rilis memeriksa saldo tersebut sebelum rilis produksi. Cadangan stabilitas pasar sebesar `60,000,000 ATH` didanakan ke MarketStabilitySeller dan dikunci pada genesis final, didukung oleh dompet ATH seller resminya, dan verifier rilis memeriksa dukungan tersebut sebelum rilis produksi. Cadangan ini dikapitalisasi sejak awal, tetapi tidak dijual sampai setelah peluncuran pool, ketika pembekuan harga satu kali yang terikat bukti menetapkan harga tahapan dasar.

## Vesting Protokol Jangka Panjang

Cadangan vesting jangka panjang adalah:

```text
10,000,000 ATH
```

Cadangan ini dipegang oleh `ATHVesting`, bukan oleh ember treasury yang dapat diubah. Jadwal vesting ditetapkan dalam kontrak:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Siapa pun boleh memicu klaim setelah ATH ter-vesting, tetapi penerima manfaat tidak dapat diubah. Kontrak ini tidak memiliki fungsi akselerasi, perubahan penerima manfaat, penjedaan, penyapuan admin, penarikan penyelamatan, atau pelepasan diskresioner.

Pada genesis final, `ATHWallet(owner = ATHVesting, master = ATHMaster)` resmi harus berisi tepat `10,000,000 ATH`. Verifier juga mensyaratkan nol ATH yang telah diklaim, fase diam, dan tidak ada transfer tertunda sebelum peluncuran.

Cadangan ini sengaja dibuat lambat. Ini menciptakan horizon panjang untuk pengembangan protokol tanpa menempatkan ember likuid 10M ATH di atas pasar saat peluncuran.

## Airdrop Aktivitas

Airdrop aktivitas adalah:

```text
15,000,000 ATH
```

Hadiah per publikasi yang berhasil:

```text
10 ATH
```

Hadiah dikreditkan ke saldo ATH internal pengguna di Vault setelah publikasi yang berhasil. Publikasi yang berhasil berarti Vault mengirim payload ke CapsuleHub, CapsuleHub menerima entri, dan Vault menerima pengakuan.

Upaya publikasi yang gagal tidak menciptakan hadiah aktivitas.

Pembukuan hadiah:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Jika ember airdrop yang tersisa di bawah 10 ATH, jumlah yang tersisa dikreditkan. Setelah ember habis, hadiah aktivitas baru berhenti.

Airdrop aktivitas dibukukan di Vault dan didukung oleh dompet ATH Vault resmi yang telah didanai sebelumnya.

Setoran ATH Vault hanya didukung melalui alur transfer-with-notify dari ATHWallet pengguna
(`ATHTransferRequestWithNotify`) ke Vault. Transfer ATH biasa secara manual ke ATHWallet Vault resmi tidak
didukung: transfer tersebut dapat meningkatkan saldo mentah dompet resmi, tetapi tidak menciptakan `Vault.user.ath_balance` dan
tidak boleh ditampilkan oleh PWA sebagai jalur setoran.

Penarikan ATH Vault adalah perintah Vault eksternal yang ditandatangani. Cadangan eksekusi untuk penyebaran ATHWallet, transfer, penyimpanan, dan
ACK di hilir dibayar dari saldo GRAM internal Vault milik pengguna. Vault hanya mengkreditkan kembali nilai
ACK/gagal/bounce terautentikasi yang diterimanya, dikurangi cadangan pengembalian lokal dan dibatasi oleh nilai internal yang dicadangkan.

## Harga Aktivitas

Pesan dimulai dari harga dasar publik saat ini:

```text
from 0.0337 GRAM
```

Contoh kanonik eksak saat ini sebelum diskon ATH adalah:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Untuk publikasi yang berhasil, pengguna menerima:

```text
10 ATH
```

Pada harga referensi peluncuran:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Ini mengikat distribusi awal ATH dengan penggunaan aplikasi yang nyata. Hadiah tersebut adalah bonus aktivitas, bukan pengembalian dana, cashback,
rabat, atau janji bahwa ATH akan mengganti biaya GRAM sebuah publikasi. Nilai referensi peluncuran `10 ATH` bisa
lebih rendah daripada biaya GRAM kapsul, dan itu memang disengaja: pengguna menerima kepemilikan jaringan awal atas penggunaan nyata,
bukan penggantian yang dijamin.

Penetapan harga kapsul: postingan publik 1 KiB dimulai dari `0.0337 GRAM` dan kapsul privat hibrida 1 KiB dari `0.0347 GRAM`. Blok kapsul publik atau privat yang lebih besar berbiaya lebih tinggi karena badan
1, 2, 4, 8, 16, atau 32 KiB yang dipilih mengubah cadangan eksekusi dan penyimpanan Vault/CapsuleHub. Hadiah tetap `10 ATH` per
kapsul yang berhasil difinalisasi, terlepas dari ukuran kapsul.

Publikasi privat menggunakan profil keamanan hibrida secara default: X25519 + ML-KEM-768 + AES-GCM. Tidak ada mode pesan-privat klasik yang lebih murah.

ATH dapat diperdagangkan di atas atau di bawah harga referensi peluncuran setelah pool resmi ada. Hadiah aktivitas bukan imbal hasil investasi, ekspektasi keuntungan, atau jaminan harga.

## Biaya Protokol dan Harga Pengguna

Di dalam Vault, biaya protokol terpisah dari total biaya yang dihadapi pengguna.

Biaya protokol:

| Tipe publikasi | Biaya protokol |
| --- | ---: |
| Postingan publik | 0.010 GRAM |
| Pesan privat hibrida | 0.010 GRAM |

Harga yang dihadapi pengguna mencakup biaya protokol, endowmen penyimpanan indeks/header ringkas, cadangan eksekusi lokal Vault, dan pengembalian ACK yang diharapkan:

| Tipe publikasi | Harga yang dihadapi pengguna |
| --- | ---: |
| Publik (mulai dari) | from 0.0337 GRAM |
| Contoh eksak postingan publik saat ini | 0.0337 GRAM |
| Contoh eksak privat hibrida 1 KiB saat ini | 0.0347 GRAM |

Jika PWA menerima estimasi jaringan konservatif yang lebih tinggi, ia menambahkan kelebihan yang diperkirakan ke biaya maksimum kanonik, dibulatkan ke atas ke langkah `0.001 GRAM` yang rapi. Diskon ATH berlaku untuk biaya protokol, bukan untuk biaya jaringan atau cadangan penyimpanan. Surcharge ini adalah margin keamanan yang ditandatangani: jika CapsuleHub menerima publikasi, ACK sukses hanya mengembalikan cadangan ACK publikasi tetap sebesar `30,000,000` nanotons (`0.030 GRAM`). Setelah Vault memproses ACK tersebut, pengguna dikreditkan sekitar `25,800,000` nanotons dalam saldo GRAM internal Vault. Bagian di atas nilai kanonik yang diperlukan tetap berada di CapsuleHub sebagai kelebihan cadangan jaringan/penyimpanan. Bagian ini tidak dikembalikan ke Vault dan tidak dihitung sebagai `accrued_plato_fee_ton` pada saat publikasi. Hanya surplus mentah di atas cadangan terlindungi CapsuleHub yang nantinya dapat disapu tanpa izin ke FeeAccumulator, di mana ia mengikuti pembukuan treasury/buyback normal. CapsuleHub menyimpan metadata entri terautentikasi yang ringkas dan hash badan; badan yang berat dipulihkan dari riwayat transaksi publikasi yang diterima dan diverifikasi secara lokal.

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

Jika saldo ATH internal pengguna di Vault setidaknya `10,000 ATH`, pengguna mencapai tingkat diskon biaya-protokol penuh untuk komponen biaya Platho. Biaya jaringan dan cadangan penyimpanan tetap dibayar.

Jika saldo di bawah `10,000 ATH`, biaya berkurang secara linear:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Perhitungan dibulatkan ke atas. Dengan konstanta saat ini, biaya protokol penuh adalah `0.010 GRAM` (`10,000,000 nanotons`) untuk kapsul publik maupun privat, dan pengurangan maksimum adalah `0.010 GRAM` per kapsul.

## Peluncuran Pool

Pool ATH/GRAM diluncurkan setelah seluruh airdrop aktivitas `15,000,000 ATH` terdistribusi.

Urutan peluncuran adalah:

1. Pengguna menerima ATH melalui penggunaan Platho yang nyata.
2. Seluruh airdrop aktivitas terdistribusi.
3. Diskon ATH terbuka.
4. Pool ATH/GRAM diluncurkan.
5. Bukti rute pasca-pool dan bukti harga dibekukan.
6. Pembagian buyback diaktifkan.

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

Biaya protokol yang dikumpulkan sebelum peluncuran pool mendanai seluruh sisi GRAM dari likuiditas awal. Ini adalah bagian dari
bootstrap peluncuran dan tidak mengubah hadiah aktivitas menjadi klaim berdenominasi GRAM.

Pool diluncurkan di sekitar token yang telah didistribusikan melalui penggunaan aplikasi. Ini memisahkan ATH dari listing kosong tanpa basis pengguna.

## FeeAccumulator

Biaya protokol GRAM dikumpulkan di `FeeAccumulator`.

Sebelum pembagian buyback diaktifkan, semua GRAM yang terakumulasi berpindah ke ember treasury:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` tidak bertambah sebelum pembagian diaktifkan.

Setelah `EnableBuybackSplit`, GRAM yang terakumulasi dibagi:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Jika jumlahnya ganjil dalam nanotons, sisanya tetap di sisi buyback:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` adalah tindakan satu arah yang dieksekusi oleh penerima treasury yang tidak dapat diubah setelah peluncuran pool dan
pembekuan rute buyback. Ini adalah otoritas satu kali yang nyata: ia tidak dapat mencuri dana, menjeda, menyelamatkan, atau mengubah alamat, tetapi secara permanen
mengubah ekonomi FeeAccumulator dari akumulasi treasury-saja saat bootstrap menjadi pembagian treasury/buyback 50/50. Otoritas ini
diaktifkan hanya setelah preflight rilis lolos.

Otoritas rilis Platho sengaja dibuat sempit dan sebagian besar sekali pakai. Mereka tetap ada dan harus disebutkan secara jujur:
pemilik treasury menyebarkan pasokan ATH awal satu kali; pengendali genesis melakukan pengikatan pra-seal dan penyegelan;
pengendali peluncuran BuybackBurn membekukan rute pasca-pool satu kali; pembekuan harga MarketStabilitySeller dilakukan
satu kali oleh pengendali peluncurannya; dan penerima treasury FeeAccumulator mengaktifkan pembagian buyback satu arah setelah preflight. Tidak ada satu pun dari
peran ini yang merupakan mekanisme penyelamatan, penjedaan, peningkatan, penarikan admin, atau kontrol saldo yang sewenang-wenang.

## Buyback dan Burn

Buyback dieksekusi melalui `FeeAccumulator` dan `BuybackBurn`.

BuybackBurn hanya menerima amplop eksekusi penuh:

```text
51.05 GRAM
```

Struktur amplop:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

`50 GRAM` mentah bukanlah bongkahan buyback yang valid. Buyback hanya diterima sebagai amplop rute penuh.

Setelah pembekuan rute, BuybackBurn mengeksekusi buyback sebagai berikut:

1. Menerima `51.05 GRAM` hanya dari FeeAccumulator yang terikat.
2. Mencatat jumlah tersebut di `reserve_due_ton`.
3. Pada `ExecuteBuybackChunk`, mengonsumsi satu amplop.
4. Menggunakan kuotasi beku dan minOut beku.
5. Menetapkan deadline STON.fi secara internal.
6. Mengirim rute melalui dompet pTON beku.
7. Menerima ATH hanya melalui dompet ATH BuybackBurn resmi.
8. Memverifikasi bahwa dompet sumber cocok dengan pool STON.fi beku.
9. Mengirim ATH yang diterima untuk di-burn melalui dompet ATH resmi.
10. Menyelesaikan siklus hanya setelah `ATHBurnFinalized` dari `ATHMaster`.

Keberhasilan buyback tidak didefinisikan oleh pesan router, permintaan burn keluar, atau pemberitahuan burn ATHWallet. Keberhasilan didefinisikan
hanya ketika BuybackBurn menerima `ATHBurnFinalized` terautentikasi dari ATHMaster. Sampai finalisasi tersebut tiba,
BuybackBurn tetap harus diperlakukan sebagai status burn tertunda atau coba-ulang; dashboard dan indexer tidak boleh menghitung ATH sebagai
ter-burn hanya karena upaya burn telah dikirim.

Jika burn tidak difinalisasi, ATH yang diterima berpindah ke retry due. `RetryAthBurnDue` mem-burn seluruh jumlah retry due.

## Biaya Nama Pengguna

Registrasi nama pengguna `.ath` dibayar dalam ATH melalui dompet ATH UsernameRegistry resmi.

Harga:

| Panjang nama | Harga |
| ---: | ---: |
| 4 karakter | 10,000 ATH |
| 5 karakter | 1,000 ATH |
| 6+ karakter | 100 ATH |

UsernameRegistry hanya menerima harga eksak. Kurang bayar dan lebih bayar tidak menciptakan nama.

Mint yang diterima melewati status tertunda dan menyebarkan `UsernameNFTItem`. Sebelum pengakuan item, pembayaran tidak diakui sebagai pendapatan. Setelah pengakuan item, jumlahnya dibagi:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Mint nama pengguna didanai oleh Vault. Penolakan karena nama pengguna tidak valid, harga salah, atau nama duplikat memantul melalui
jalur pemberitahuan dompet ATH resmi sehingga Vault dapat memulihkan ATH internal pengguna. UsernameRegistry tidak memelihara
ember pengembalian nama pengguna eksternal langsung dalam alur yang didanai Vault saat ini.

ATH dari mint nama pengguna menjadi pendapatan protokol hanya setelah penyebaran item yang bersangkutan dikonfirmasi.

Otoritas nama pengguna sengaja dipisahkan: `UsernameRegistry` menautkan nama ke satu `UsernameNFTItem` yang eksak, dan
status item membawa pemilik saat ini. Transfer item mentransfer nama pengguna. Item mengekspos data NFT standar
dan metadata on-chain TEP-64, termasuk `name = <username>.ath`; item tidak bergantung pada server Platho untuk metadata.
Byte nama pengguna bersifat literal dan tidak dinormalisasi untuk tampilan: nama dengan pemisah di awal, akhir, berturut-turut, dan seluruhnya pemisah
adalah valid ketika setiap byte berada dalam himpunan `a-z`, `0-9`, `_`, `-` yang diizinkan dan panjangnya 4..16.
Jika penyebaran item telah diupayakan tetapi ACK item tidak pernah mencapai registry, `PrunePendingUsernameMint` sengaja
tidak bersifat destruktif: ia tidak menebak kegagalan, menghapus status tertunda, atau menciptakan refund due. Jalur pemulihannya adalah
`UsernameItemDeployedAck` yang terlambat atau `UsernameNFTItem.ResendDeployedAck`, sehingga item yang terinisialisasi tetap dapat menjadi otoritatif.
Jika penyebaran item benar-benar memantul, registry meminta dompet ATH resmi untuk mengembalikan pemberitahuan yang tertunda.
`UsernameNFTItem` yang telah disebarkan tanpa `UsernameRegistry.name_records[name_hash]` yang menunjuk ke item eksak tersebut bersifat
non-otoritatif: klien, indexer, dan UI tidak boleh memperlakukan item itu sendiri sebagai kepemilikan atas nama `.ath`, dan tidak boleh
menggunakan pemilik rekaman registry sebagai pemilik saat ini setelah transfer.

## Biaya Avatar Profil

Biaya pembaruan avatar profil:

```text
100 ATH
```

Pembaruan avatar profil didanai oleh Vault. PWA mengirim `SetProfileAvatarFromVaultBalance` ke Vault; Vault membayar melalui jalur pemberitahuan dompet ATH resminya ke dompet ATH ProfileRegistry resmi. Pembayaran avatar langsung dari dompet pengguna tidak didukung.

ProfileRegistry menerima pembaruan hanya ketika semua kondisi terpenuhi:

- jumlahnya tepat `100 ATH`;
- pengirim adalah dompet ATH ProfileRegistry resmi;
- dompet pembayar adalah Vault yang terikat;
- dompet pemilik berada di basechain;
- hash avatar bukan nol;
- stream id bukan nol;
- jumlah bagian dari 1 hingga 16;
- format media adalah WebP.

Pembaruan yang diterima menciptakan versi avatar baru dan membagi biaya:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Pemberitahuan avatar yang ditolak dikembalikan melalui jalur bounce pemberitahuan ATHWallet. ProfileRegistry tidak menciptakan ember pengembalian terpisah untuk pembaruan avatar yang cacat.

ProfileRegistry menyimpan penunjuk avatar terautentikasi, bukan byte gambar permanen. PWA harus merekonstruksi data WebP avatar dari entri CapsuleHub publik atau cache lokal dan memverifikasi byte terhadap `avatar_hash` yang tersimpan; riwayat yang hilang atau terpangkas ditampilkan sebagai tidak tersedia.

## Market Stability Seller

MarketStabilitySeller adalah cadangan kontrak publik yang mendistribusikan ATH setelah peluncuran pool resmi:

```text
60,000,000 ATH
```

Tujuannya adalah mengurangi distorsi pasar awal yang disebabkan oleh likuiditas tipis. Saat peluncuran, pool kecil dapat digerakkan secara tajam oleh sekelompok kecil pembeli awal. Jika itu terjadi, pengguna yang membutuhkan ATH untuk aksi Platho yang sebenarnya dapat terpaksa membeli ke dalam lonjakan harga buatan.

MarketStabilitySeller menciptakan tangga pasokan yang transparan di atas harga peluncuran. Ia menjual ATH dalam tahapan berukuran tetap. Setiap tahapan berikutnya lebih mahal daripada yang sebelumnya, dan setiap tahapan memiliki batas ukuran yang ketat. Setelah pembekuan harga satu kali yang terikat bukti, jadwal tahapan bersifat deterministik dan tidak dapat diubah secara manual oleh tim.

Jika spekulan awal mencoba menyerap ATH dalam jumlah besar, mereka membeli dari cadangan publik pada harga tahapan yang meningkat alih-alih mengekstraksi seluruh likuiditas murah dari pool yang tipis dan menjualnya kembali kepada pengguna. Jika pengguna biasa membutuhkan ATH untuk Platho, mereka dapat membelinya pada harga tahapan publik yang diketahui tanpa mendorong pool kecil secara vertikal dengan satu gelombang permintaan.

Cadangan ini tidak membuang token ke pasar. Ia tidak menjual dengan sendirinya dan tidak menciptakan tekanan jual tanpa permintaan. Penjualan hanya terjadi ketika pembeli secara sukarela membeli dari tahapan saat ini. Jika tidak ada permintaan, cadangan tetap diam.

Utilitas on-chain ATH bersifat spesifik:

- registrasi nama pengguna `.ath` dibayar dalam ATH melalui UsernameRegistry;
- pembaruan penunjuk avatar profil dibayar dalam ATH melalui ProfileRegistry;
- ATH yang dipegang dalam saldo Vault internal pengguna mengurangi biaya protokol untuk publikasi Vault setelah gerbang distribusi aktivitas;
- biaya nama pengguna dan avatar yang diterima menciptakan treasury due dan burn due;
- BuybackBurn membeli ATH dengan biaya protokol GRAM dan mem-burn ATH yang diterima melalui ATHMaster.

Publikasi Vault dibayar dalam GRAM. ATH tidak membayar seluruh transaksi publikasi. Ia mengurangi komponen biaya protokol setelah gerbang diskon terbuka.

Ini membuat permintaan ATH terikat pada aksi protokol yang konkret: nama `.ath`, pembaruan avatar, diskon biaya protokol Vault pasca-airdrop, dan tekanan buyback/burn. MarketStabilitySeller memperluas pasokan yang tersedia hanya ketika pembeli mengambil tahapan berikutnya, sehingga akses awal bersifat publik dan deterministik alih-alih didominasi oleh pool yang tipis.

Cadangan hanya dijual setelah pembekuan harga pasca-pool.

Pembekuan harga adalah otoritas peluncuran satu kali yang nyata. Ia menetapkan harga tahapan dasar satu kali dari bukti peluncuran pool, lalu hash pengendali peluncuran dihapus. Setelah itu, MarketStabilitySeller tidak dapat mencuri dana, menjeda penjualan, menyelamatkan saldo, mengesampingkan pembeli, atau mengubah jadwal harga.

MarketStabilitySeller dikapitalisasi pada genesis final dengan seluruh cadangan `60,000,000 ATH`, didanai melalui
alur reserve-funder terautentikasi ke dompet ATH seller resmi, hingga batas keras `60,000,000 ATH`.
`mainnet:genesis:verify` memeriksa bahwa seller membawa seluruh cadangan dan bahwa dukungan dompet ATH seller resminya
setidaknya `60,000,000 ATH` sebelum rilis produksi. Transfer ATH biasa yang tidak diminta ke dompet ATH seller
resmi tidak meningkatkan cadangan yang dibukukan, tidak memperluas pasokan yang dapat dijual, dan dapat tersangkut; saldo dompet
di atas `60,000,000 ATH` diperlakukan sebagai peringatan, bukan sebagai cadangan tambahan.

Penjualan adalah langkah pasca-pool yang terpisah. Cadangan tidak dijual sampai setelah peluncuran pool, ketika pembekuan harga
satu kali yang terikat bukti menetapkan harga tahapan dasar; sejak saat itu jadwal tahapan bersifat deterministik dan tidak dapat diubah secara manual
oleh tim.

Cadangan dibagi menjadi 20 tahapan:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Setiap tahapan memiliki pengali:

```text
x2, x3, x4, ..., x21
```

Ini menciptakan tangga harga yang mulus. Seiring popularitas proyek tumbuh, pasar menerima pasokan ATH tambahan, tetapi setiap tahapan berikutnya lebih mahal daripada yang sebelumnya. Permintaan awal tidak langsung menghantam pool yang tipis, dan pertumbuhan harga tidak menjadi tembok vertikal yang membuat token utilitas tidak nyaman digunakan.

Rumus pembelian:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` dibekukan setelah peluncuran pool dan cocok persis dengan bukti harga x1.

Pada harga peluncuran `1 ATH = 0.001 GRAM`, harga x1 dari satu tahapan adalah:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Oleh karena itu:

| Tahapan | Pengali | Harga untuk 3M ATH | Harga per 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Satu pembelian tidak dapat melintasi batas tahapan. Ini mencegah pembelian ATH dari tahapan berikutnya pada harga tahapan sebelumnya.

Pendapatan GRAM diakui hanya setelah ATH dikirimkan kepada pembeli. Jika transfer ATH gagal atau memantul, cadangan dipulihkan, pembeli menerima kembali pokok GRAM yang dibayarkan, dan treasury due tidak bertambah.

Setelah tahapan x21 terakhir terjual, MarketStabilitySeller tidak lagi mengatur harga ATH. Sejak titik itu, harga sepenuhnya ditentukan oleh pasar: likuiditas, pasokan yang tersedia, permintaan atas nama `.ath`, pembaruan avatar, diskon biaya protokol Vault pasca-airdrop, dan tekanan buyback/burn.

Bahkan pada langkah x21, valuasi referensi tetap moderat relatif terhadap model utilitas:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Pada langkah x21, MarketStabilitySeller telah menyelesaikan pelepasan cadangan terprogramnya. Setelah itu, harga ATH sepenuhnya ditentukan pasar oleh likuiditas, permintaan penggunaan, pasokan yang tersedia, dan tekanan buyback/burn. Satu-satunya alokasi protokol yang tersisa adalah jadwal vesting jangka panjang yang lambat, dibatasi pada `100,000 ATH` per tahun.

## Ember Treasury dan Burn

UsernameRegistry dan ProfileRegistry menggunakan model pembagian biaya ATH yang sama:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Flush treasury due mengirim ATH ke penerima treasury melalui dompet ATH resmi.

Flush burn due mengirim permintaan burn ATH melalui dompet ATH resmi. Pasokan berkurang hanya setelah finalisasi burn di ATHMaster.

Jalur gagal dan bounce memulihkan ember due. Pembukuan dipertahankan sampai transfer atau burn di hilir selesai.

## Pembukuan ATHWallet

Saldo ATH berada dalam kontrak ATHWallet deterministik.

ATHWallet menangani:

- kredit pasokan genesis;
- transfer biasa;
- transfer with notify;
- pemberitahuan mint nama pengguna;
- pemberitahuan avatar profil;
- permintaan burn;
- pengakuan pemberitahuan;
- pemangkasan pemberitahuan usang;
- pemulihan bounce/gagal.

Kontrak yang menerima ATH sebagai pembayaran tidak menerima pesan langsung dari alamat sewenang-wenang. Mereka menerima pemberitahuan hanya dari ATHWallet resmi mereka. Autentikasi dompet sumber dilakukan di dalam ATHWallet melalui derivasi dompet deterministik.

ATH mengekspos entrypoint transfer mirip-TEP-74 untuk perkakas jetton generik, tetapi aksi protokol Platho menggunakan pesan pemberitahuan ATH terautentikasi. Integrasi eksternal tidak boleh mengasumsikan bahwa alur notify Platho memancarkan `JettonTransferNotification` generik.

Transfer internal keluar di ATHWallet dilindungi oleh pembukuan pending sisi-sumber dan pengakuan sumber. Saldo tidak dipulihkan dari badan bounce tanpa bukti pending.

## Siklus Hidup ATH

1. `ATHMaster` menciptakan pasokan tetap sebesar `100,000,000 ATH`.
2. Deploy treasury sekali pakai menerima pasokan di dompet ATH treasury.
3. Pasokan dialokasikan ke aktivitas, likuiditas, vesting jangka panjang, dan stabilitas pasar.
4. Pengguna mempublikasikan pesan melalui Vault.
5. Publikasi yang berhasil mengkreditkan hadiah aktivitas `10 ATH`.
6. Setelah seluruh airdrop aktivitas `15,000,000 ATH` terdistribusi dan `airdrop_remaining_ath == 0`, diskon biaya protokol ATH terbuka.
7. Pool ATH/GRAM diluncurkan pada harga referensi `1 ATH = 0.001 GRAM`.
8. Bukti rute pasca-pool dan bukti harga dibekukan.
9. MarketStabilitySeller menjual cadangan melalui tahapan x2..x21.
10. Setelah pembagian diaktifkan, FeeAccumulator membagi biaya protokol GRAM antara treasury dan buyback.
11. BuybackBurn membeli ATH dengan biaya protokol GRAM dan mem-burn ATH melalui ATHMaster.
12. Biaya nama pengguna dan profil menciptakan ATH treasury due dan ATH burn due.
13. Total pasokan berkurang secara bertahap melalui burn terautentikasi.

## Model Akhir

ATH menghubungkan empat lapisan Platho:

1. **Penggunaan aplikasi** - pesan menciptakan hadiah aktivitas.
2. **Fitur berbayar** - nama pengguna dan avatar membutuhkan ATH.
3. **Diskon** - saldo ATH mengurangi biaya protokol setelah gerbang distribusi.
4. **Pengurangan pasokan** - sebagian dari biaya ATH dan keluaran buyback di-burn melalui ATHMaster.

Model dimulai dengan pasokan tetap dan valuasi referensi sebesar `100,000 GRAM`. Distribusi pengguna utama terikat pada penggunaan berbayar yang nyata: pesan dimulai dari `0.0337 GRAM` — saat ini `0.0337 GRAM` untuk postingan publik 1 KiB dan `0.0347 GRAM` untuk kapsul privat hibrida 1 KiB, ditambah bonus aktivitas `10 ATH` per kapsul yang difinalisasi. Kelas ukuran publik atau privat yang lebih besar berbiaya lebih tinggi. Bonus itu bukan pengembalian dana, penggantian, atau janji keuntungan. Setelah 15% pertama pasokan terdistribusi, pool diluncurkan, diskon biaya protokol terbuka, dan jalur buyback terbuka.

ATH ada sebagai token yang bekerja di dalam Platho: ia didistribusikan melalui aktivitas, digunakan dalam aksi berbayar, mengurangi biaya protokol, dijual dari cadangan melalui tangga yang terdefinisi, dan di-burn melalui burn on-chain. Setelah tangga stabilitas pasar, harga ATH di masa depan ditentukan oleh pasar dan penggunaan protokol.
