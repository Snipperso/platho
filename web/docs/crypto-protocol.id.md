# Protokol kripto pesan Platho

Dokumen ini menjelaskan enkripsi pesan sisi klien yang diimplementasikan oleh PWA Platho.

## Enkripsi

Pesan pribadi menggunakan X25519 + ML-KEM-768 + AES-GCM — satu-satunya suite pesan pribadi (`hybrid-v1`, nilai kontrak `2`).

## Bundel kunci

Setiap frasa pemulihan GRAM 24 kata yang dibuat atau diimpor oleh PWA secara deterministik menurunkan sebuah identitas perpesanan dengan pasangan kunci enkripsi dan sebuah kunci penanda tangan Ed25519. Materi kunci enkripsi publik diekspor sebagai bundel kunci publik:

- `keyId`: pengidentifikasi berbasis SHA-256 atas materi kunci publik.
- `x25519PublicKey`: kunci publik ECDH klasik 32-byte.
- `mlKem768PublicKey`: kunci publik ML-KEM-768 sepanjang 1184-byte untuk `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 dari kunci publik ML-KEM-768.
- `mlKem768PublicKeyLen`: selalu `1184` untuk `hybrid-v1`.

PWA menghitung ulang `keyId`, `mlKem768PublicKeyHash`, dan `mlKem768PublicKeyLen` sebelum enkripsi. Sebuah bundel yang mengeklaim id, suite, suite kontrak, hash, atau panjang yang tidak cocok akan ditolak.

Pencarian penerima ditentukan oleh `enc_pubkey`, `sign_pubkey` on-chain, dan sel `pq_kem_pubkey` on-chain lengkap yang tersimpan dalam catatan kunci Vault yang aktif. Hash dan panjang tetap berada dalam catatan sebagai bidang pengikat yang ringkas, tetapi kunci publik ML-KEM-768 yang lengkaplah yang memungkinkan klien lain benar-benar mengenkripsi sebuah kapsul `hybrid-v1`.

## Bundel yang ditandatangani

PWA dapat mengekspor sebuah bundel kunci publik yang ditandatangani. Muatan yang ditandatangani mencakup:

- domain protokol `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- stempel waktu penerbitan dan stempel waktu kedaluwarsa opsional;
- placeholder wallet pemilik dan alamat Vault opsional;
- bundel enkripsi publik;
- kunci publik penanda tangan Ed25519 sepanjang 32-byte.

Tanda tangan mencakup muatan JSON yang stabil dan diverifikasi sebelum bundel dipercaya. Ini mencegah pengubahan bundel lokal secara diam-diam dan memberikan klien `sign_pubkey` yang persis yang disimpan Vault di dalam `KeyRecord`.

`keyId` pada PWA adalah pengidentifikasi bundel klien. Ia tidak menggantikan `current_key_id` milik kontrak Vault, yang dihitung on-chain dari alamat pemilik, generasi kunci, kunci penanda tangan, kunci enkripsi, hash PQ, panjang PQ, dan suite kripto. Klien produksi harus memverifikasi bundel terhadap catatan kunci Vault sebelum memercayainya untuk sebuah identitas wallet.

Bundel yang ditandatangani adalah tanda tangan mandiri kunci perpesanan. Kepemilikan wallet ditambatkan oleh aktivasi Vault: wallet Platho tertanam mengirim `RegisterMessagingKeys`, rotasi `ReplaceMessagingKeys` berikutnya adalah pesan eksternal yang ditandatangani dengan otorisasi Vault, dan penerima memverifikasi bundel yang ditandatangani terhadap catatan kunci on-chain yang aktif untuk wallet tersebut.

## Kepemilikan wallet

PWA produksi tidak menggunakan konektor wallet eksternal. Seorang pengguna membuat atau mengimpor frasa pemulihan GRAM 24 kata biasa, dan PWA
secara deterministik menurunkan kunci wallet GRAM, sebuah kunci otorisasi Vault yang terpisah, serta kunci enkripsi/penanda tangan perpesanan dari frasa tersebut. Aktivasi Vault
adalah penambat kepemilikan: wallet tertanam menandatangani dan mengirim `RegisterMessagingKeys` dari wallet yang sama yang memiliki catatan kunci on-chain.
`ReplaceMessagingKeys` hanya merotasi catatan kunci penerimaan/perpesanan publik; ia tidak merotasi kunci otorisasi Vault.

Penerima hanya memercayai sebuah bundel perpesanan setelah memeriksanya terhadap catatan kunci Vault yang aktif untuk wallet tersebut:

- pemilik catatan adalah wallet yang diharapkan;
- `enc_pubkey` dan `sign_pubkey` cocok dengan bundel yang ditandatangani;
- catatan hybrid memaparkan sel `pq_kem_pubkey` lengkap, bukan hanya hash-nya;
- byte kunci ML-KEM-768 yang telah didekode di-hash menjadi `pq_kem_pubkey_hash`;
- `current_key_id` yang aktif menunjuk ke catatan kunci yang terverifikasi.

Alur ekspor/impor profil menangani frasa pemulihan GRAM 24 kata. Tidak ada cadangan kunci perpesanan terpisah dan tidak ada
mode koneksi wallet eksternal.

## Tata letak byte yang ringkas

Sel on-chain kapsul pribadi menggunakan tata letak biner final `platho.byte-layout.v1`. PWA boleh membungkus kapsul dalam JSON untuk UI ekspor/berbagi, tetapi muatan protokol adalah byte biner, bukan JSON dan bukan penunjuk off-chain. `CapsuleHub` menyimpan header/indeks terautentikasi yang ringkas ditambah hash body; sel body yang terenkripsi tetap berada dalam body transaksi publikasi yang diterima dan direkonstruksi dari riwayat pesan TON, lalu diverifikasi terhadap hash yang tersimpan.

Setiap publikasi melewati Vault sebagai pesan eksternal yang ditandatangani dan didanai dari saldo Vault. Pengguna terlebih dahulu mengisi
saldo GRAM Vault internal mereka, kemudian PWA menandatangani sebuah permintaan publikasi dengan `auth_pubkey` yang aktif; sebuah relayer dapat mengirimkan
pesan eksternal tanpa memegang kunci wallet atau kunci penanda tangan perpesanan. Muatan yang ditandatangani dipisahkan berdasarkan domain dengan `VPB1`,
`deployment_manifest_hash`, alamat Vault target, dan jenis publikasi sebelum pemilik, nonce, biaya maksimum, dan muatan.
Nilai GRAM yang sebenarnya dikirim kembali oleh CapsuleHub dalam sebuah ACK atau bounce dikreditkan ke saldo GRAM Vault internal
pengguna, dibatasi oleh jumlah pengembalian dana publikasi tertunda yang dilacak. Jika saldo Vault atau akses chain tidak tersedia, maka
PWA gagal-tertutup dan tidak boleh memaparkan aksi publikasi.

Karena `auth_pubkey` mengotorisasi pembelanjaan saldo Vault, mengompromikan kunci penanda tangan perpesanan lokal saja tidak mengotorisasi
aksi publikasi, pemeriksaan pembayaran, username, atau avatar Vault. Kompromi kunci penanda tangan perpesanan tetap dapat memengaruhi tanda tangan
identitas tingkat-pesan, sehingga penggantian kunci mencabut catatan kunci penerimaan publik yang lama untuk pemeriksaan enkripsi masuk di masa depan.

Penetapan harga pesan PWA bersifat per kapsul. Dengan cadangan saat ini dan tanpa diskon ATH, contoh kanonis yang persis adalah entri publik 1 KiB mulai dari `0.0337 GRAM` dan kapsul
pribadi `hybrid-v1` 1 KiB mulai dari `0.0347 GRAM`; kelas ukuran publik atau pribadi yang lebih besar berbiaya lebih tinggi menurut kelas kanonis. Ini mencakup penuh
biaya protokol Platho sebesar `0.01 GRAM`, endowmen penyimpanan indeks-ringkas CapsuleHub, cadangan eksekusi lokal Vault, dan
pengembalian ACK yang diharapkan. Secara terpisah, jika estimasi biaya konservatif PWA lebih tinggi daripada tunjangan biaya-jaringan
yang disertakan sebesar `0.005 GRAM`, ia menambahkan
kelebihan yang dibulatkan sebagai biaya tambahan. Panggilan kontrak tetap dimulai dari nilai
kanonis yang diperlukan: publikasi Vault mengirim `maxCharge = canonical_max_charge + surcharge`. CapsuleHub tidak memiliki ABI publikasi
langsung oleh pengguna; setiap publikasi adalah Vault -> CapsuleHub. Diskon ATH hanya berlaku setelah airdrop aktivitas Vault
telah mendistribusikan 15,000,000 ATH; sebelum gerbang tersebut, biaya protokol pesan menggunakan biaya penuh `0.01 GRAM`. PWA harus menampilkan penahanan
akhir dan biaya bersih untuk ukuran konten yang dipilih sebelum menandatangani.

Biaya tambahan adalah margin keamanan jaringan/penyimpanan yang ditandatangani, bukan wadah biaya yang dapat dikembalikan. CapsuleHub menerima publikasi Vault
ketika nilai yang dilampirkan setidaknya sama dengan nilai kanonis yang diperlukan, tetapi ACK publikasi yang berhasil hanya mengembalikan
cadangan ACK publikasi tetap sebesar `30,000,000` nanoton (`0.030 GRAM`). Setelah Vault memproses ACK tersebut, pengguna dikreditkan sekitar
`25,800,000` nanoton dalam saldo GRAM Vault internal. Setiap biaya tambahan yang ditandatangani di atas nilai kanonis yang diperlukan tetap berada di
CapsuleHub sebagai kelebihan cadangan jaringan/penyimpanan; ia tidak dikembalikan ke Vault dan tidak dihitung sebagai
`accrued_plato_fee_ton`.

CapsuleHub melindungi cadangan GRAM mentah sama dengan `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
Cadangan langsung menggunakan penghitung entri pribadi/publik yang belum dipangkas alih-alih penghitung `latest_id` historis. Sebuah panggilan
`SweepExcessReserve` tanpa izin yang terpisah hanya dapat memindahkan surplus di atas jumlah terlindungi tersebut ke FeeAccumulator sebagai
`DepositProtocolFee`, yang mengikuti pembagian treasury/buyback normal. Pengiriman pesan biasa tidak melakukan
sapuan ini. Jika setoran sapuan tersebut bounce, jumlah yang dikembalikan sengaja direklasifikasi sebagai `accrued_plato_fee_ton` yang
didukung sehingga dapat dicoba ulang melalui jalur pembilasan biaya normal.
Panggilan `FlushFees` parsial normal harus setidaknya sama dengan biaya protokol publik saat ini (`0.010 GRAM`); jumlah yang lebih kecil
valid hanya ketika itu adalah seluruh sisa wadah yang terakumulasi, sehingga dust yang didiskon tetap dapat difinalisasi.

CapsuleHub mencatat `created_at = now()` untuk setiap entri pribadi dan publik. PWA menggunakan stempel waktu kontrak tersebut untuk pengurutan dan untuk pencarian riwayat-transaksi yang terbatas; stempel waktu header klien tetap merupakan metadata muatan terautentikasi, bukan otoritas penemuan. Metadata entri yang ringkas dapat dipangkas tanpa izin setelah jendela retensi satu tahun yang dikonfigurasi, sementara ketersediaan body bergantung pada cakupan riwayat-pesan penyedia TON yang dipilih dan cache terenkripsi lokal pengguna.

Saldo ATH Vault dikreditkan melalui akuntansi alur-notifikasi eksplisit, bukan dengan memindai saldo wallet resmi yang mentah.
Jalur setoran yang didukung adalah `ATHTransferRequestWithNotify` dari ATHWallet pengguna ke Vault. Transfer ATH biasa secara
manual ke ATHWallet Vault resmi tidak didukung dan tidak boleh ditampilkan sebagai alamat setoran atau diperlakukan sebagai
kredit ledger Vault. Penarikan ATH dari Vault adalah perintah Vault eksternal yang ditandatangani. Cadangan deploy/transfer/ACK ATHWallet
hilirnya dibayar dari saldo GRAM Vault internal pengguna, dan Vault hanya mengkredit balik nilai ACK/gagal/bounce
terautentikasi yang diterimanya, dikurangi cadangan pengembalian dana lokal dan dibatasi oleh nilai internal yang dicadangkan.

Postingan dan komentar publik adalah profil terbuka yang terpisah, bukan kapsul pribadi tanpa enkripsi. Mereka menyimpan sel header
publik `PPH1` yang ringkas ditambah sel body publik mentah. Teks body publik dan byte gambar/avatar publik menggunakan kelas ukuran
kapsul publik yang sama yaitu 1, 2, 4, 8, 16, atau 32 KiB sebagai anggaran body yang terlihat pengguna. Metadata header tidak pernah mengurangi
anggaran body tersebut. Postingan publik tidak memiliki opsi postkuantum; pesan publik mulai dari `0.0337 GRAM`,
sedangkan contoh basis publik yang persis saat ini adalah `0.0337 GRAM` ditambah aturan biaya tambahan
jaringan yang sama. `kind = 1` adalah postingan publik; bit 0 dari `flags` postingan menutup komentar untuk postingan tersebut. `kind = 2` adalah
komentar publik satu tingkat dengan `parent_entry_id:uint64` dan `parent_body_hash:uint256` di dalam header. `kind = 3` adalah
postingan gambar publik, `kind = 4` adalah komentar gambar publik, dan `kind = 5` adalah media avatar wallet publik. Header publik juga membawa `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16`, dan `media_format:u8`; header publik menggunakan `media_format = 0` untuk teks dan
`media_format = 1` untuk bagian gambar/avatar WebP. Header postingan, postingan gambar, dan avatar juga membawa
`profile_version:uint32` dan `avatar_hash:uint256`; nol berarti tidak ada penunjuk avatar. Teks publik panjang atau data gambar direkonstruksi dari beberapa entri
hanya setelah setiap entri menggunakan kelas ukuran publik terkecil yang muat hingga 32 KiB. PWA resmi mengompresi gambar terpilih ke target WebP sebesar 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, default), atau 64 KiB (`maximum`) sebelum pemisahan. Tidak ada lapisan edit/hapus/reaksi/moderasi atau penghitung.

Avatar wallet adalah pembaruan profil berbayar, bukan aset off-chain. Byte avatar dipublikasikan sebagai entri CapsuleHub publik
`kind = 5`, kemudian `ProfileRegistry` mencatat penunjuk wallet terautentikasi:
`version`, `avatar_hash`, `avatar_entry_id` pertama, `avatar_stream_id`, `avatar_part_count`, dan `media_format`. Pembaca
menyelesaikan penunjuk profil dari header pribadi yang ditandatangani atau header postingan publik, memverifikasi catatan ProfileRegistry
yang cocok, mengambil entri avatar publik dari CapsuleHub, menggabungkan bagian-bagian dalam urutan indeks, dan mengharuskan byte WebP yang
direkonstruksi di-hash menjadi `avatar_hash`. Cache avatar lokal hanyalah percepatan; sumber kebenaran adalah CapsuleHub ditambah
ProfileRegistry.

`header0_cell` menyimpan persis 140 byte:

```text
PH0B
|| version:u8
|| publish_kind:u8
|| size_class:u8
|| crypto_suite:u8
|| sender_key_id:32 bytes
|| recipient_key_id:32 bytes
|| sender_sign_pubkey:32 bytes
|| profile_version:uint32
|| avatar_hash:uint256
```

`header1_cell` menyimpan persis 30 byte:

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` menyiratkan suite. `profile_version` dan `avatar_hash` menunjuk ke avatar wallet pengirim pada
waktu pengiriman dan dicakup oleh hash header ditambah tanda tangan pengirim. `recipient_sign_pubkey` dan hash utas
sengaja tidak disimpan di dalam sel header publik. Data utas/pengelompokan menjadi bagian metadata kapsul terenkripsi.

Setiap body terenkripsi dirakit sebagai:

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

Plaintext AES-GCM adalah satu slot kapsul tetap yang dipilih oleh `size_class`:

```text
PCP1
|| version:u8
|| kind:u8
|| flags:u8
|| media_format:u8
|| stream_id:u128
|| part_index:u16
|| part_count:u16
|| content_len:u16
|| reserved:u16
|| payload[useful_size]
```

Area konten yang berguna diisi (padded) hingga kelas kapsul pribadi 1, 2, 4, 8, 16, atau 32 KiB yang dipilih. Sebuah pesan dengan 1 byte, 500 byte, atau 1024 byte teks yang berguna memiliki ukuran plaintext terenkripsi yang sama dalam kelas 1 KiB. Pesan di atas kelas yang dipilih dipecah menjadi kapsul-kapsul independen dengan metadata `stream_id`, `part_index`, dan `part_count` yang terenkripsi. Satu kapsul tidak pernah mencampur unit teks/gambar yang tidak berkaitan; penerima merakit kembali kapsul-kapsul independen menjadi pesan asli.

Jenis konten:

- `1` teks: byte UTF-8, hingga ukuran kapsul pribadi berguna yang dipilih.
- `2` gambar: byte gambar WebP terkompresi, hingga ukuran kapsul pribadi berguna yang dipilih (`media_format = 1`).
- `3` pemeriksaan pembayaran: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Body pemeriksaan pembayaran sengaja tidak menyertakan `tx`, waktu aktivasi, atau kedaluwarsa. Penerima mengeklaim berdasarkan `intent_id + secret32`; jika pengirim telah membatalkan pemeriksaan atau pemeriksaan telah diklaim, UI menyatakan bahwa pemeriksaan telah diklaim atau dibatalkan oleh pengirim.

Body terenkripsi dapat dibungkus untuk ekspor/berbagi sebagai:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Untuk body kapsul final, `chunk_total` selalu `1`. `PLC1` hanyalah pembingkaian paket/ekspor. Transaksi publikasi Vault -> CapsuleHub yang diterima membawa byte body `PLB1` yang telah dirakit dalam sebuah sel snake; CapsuleHub hanya menyimpan metadata dan hash terautentikasi yang ringkas.

Batas privat final:

| Suite | Batas berguna per kapsul | Byte body | Byte potongan ekspor |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

Sumber kanonis untuk tata letak ini adalah `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM menggunakan nonce 12-byte dan tag 16-byte. Panjang ciphertext sama dengan panjang plaintext ditambah tag.

Prefiks body yang ringkas, `header0Hash`, dan `header1Hash` diteruskan sebagai additional authenticated data AES-GCM. Mengubah header perutean biner, suite, nonce, ciphertext KEM, byte potongan, atau tanda tangan pengirim membuat verifikasi atau dekripsi gagal.

Sebelum dekripsi, klien juga memeriksa:

- suite body yang ringkas cocok dengan `header0`;
- id kunci penerima cocok dengan `header0.recipientKeyId`;
- body `hybrid-v1` memang membawa ciphertext ML-KEM 1088-byte;
- setiap potongan memiliki suite, id pesan, dan total potongan yang sama.

## Penurunan kunci

Untuk `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

Plaintext dienkripsi dengan AES-256-GCM.

Implementasi menolak semua rahasia bersama X25519 yang bernilai nol untuk menghindari penerimaan kunci publik berorde rendah.

## Kapsul terenkripsi pribadi

Klien membungkus body terenkripsi yang ringkas dalam sebuah kapsul pribadi sebelum publikasi. Sebuah kapsul pribadi memiliki:

- `header0`: header perutean biner `PH0B` sepanjang 140-byte yang dijelaskan di atas.
- `header1`: header replay biner `PH1B` sepanjang 30-byte yang dijelaskan di atas.
- `body`: metadata potongan `platho.byte-layout.v1` ditambah potongan biner yang dikodekan base64url.
- `hashes`: nilai `Cell.hash()` TON untuk sel on-chain persis yang berisi `header0`, `header1`, dan byte body terenkripsi.
- `chainCells`: muatan BOC base64 menggunakan `ton-snake-byte-cell.v1`; ini adalah sel yang diterima dalam transaksi publikasi Vault -> CapsuleHub dan diautentikasi oleh `CapsuleHub`, bukan penunjuk off-chain.
- `senderSignature`: tanda tangan Ed25519 atas id kapsul dan ketiga hash.

Untuk `hybrid-v1`, kapsul menggunakan profil hybrid CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

Draf kapsul pribadi dipetakan ke body `PublishPrivateFromVault` Vault -> CapsuleHub setelah permintaan eksternal
`PublishPrivateFromVaultBalance` yang ditandatangani diterima oleh Vault:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Pesan publikasi Vault membawa `protocol_fee_paid`, karena Vault adalah otoritas diskon untuk penetapan harga yang didukung ATH.

Kapasitas muatan yang berguna adalah kapasitas byte body terenkripsi yang benar-benar diserialisasi ke dalam `body_cell` dan diterima oleh `CapsuleHub`. Sebuah hash tanpa body transaksi publikasi yang diterima yang cocok bukanlah pesan yang dapat dibaca. Riwayat lokal hanyalah cache; ia tidak mendefinisikan pengiriman.

Untuk penandatanganan publikasi eksternal Vault, urutan referensi-hash tetap kompatibel dengan kontrak:

```text
body_hash || header_0_hash || header_1_hash
```

Body yang ringkas terikat pada `header0Hash` dan `header1Hash` melalui AAD AES-GCM. Mengganti header, potongan body, metadata suite, tanda tangan pengirim, konteks kapsul, atau sel muatan BOC membuat verifikasi gagal sebelum pesan diterima.

## Sumber kebenaran pengiriman

Pesan pribadi yang diterima adalah entri CapsuleHub yang ringkas ditambah sel muatan terenkripsi yang dibawa oleh body transaksi publikasi yang diterima. PWA mengambil sel-sel tersebut dari riwayat pesan TON dan memverifikasinya terhadap hash CapsuleHub sebelum mendekripsi. PWA produksi tidak memaparkan pertukaran paket JSON bundel-publik manual atau kapsul-terenkripsi.

Kunci perpesanan publik didaftarkan dalam catatan kunci `Vault`. Pengirim harus menyelesaikan dan memverifikasi catatan kunci penerima sebelum mengenkripsi sebuah kapsul pribadi. Riwayat terenkripsi lokal hanyalah cache perangkat; ia tidak mendefinisikan pengiriman.

Otoritas username `.ath` memiliki dua bagian. `UsernameRegistry.get_name_record` membuktikan bahwa sebuah nama ada dan menunjuk ke
`UsernameNFTItem` persis untuk nama tersebut. Pemilik saat ini kemudian dibaca dari state item tersebut. Transfer mengubah pemilik
item; catatan registry tetap menjadi penambat nama-ke-item. Item memaparkan data NFT standar dan metadata on-chain TEP-64,
termasuk `name = <username>.ath`, tanpa URI metadata yang di-host server. Byte username sengaja
literal: nama dengan awalan, akhiran, karakter berurutan, dan yang seluruhnya berupa pemisah adalah valid ketika setiap byte berada dalam himpunan `a-z`,
`0-9`, `_`, `-` yang diizinkan dan panjangnya 4..16. Jika sebuah mint tertunda menjadi basi setelah
ACK item yang hilang, `PrunePendingUsernameMint` bersifat non-destruktif: ia membuktikan kondisi basi tetapi tidak menghapus
state tertunda atau menciptakan pengembalian dana yang jatuh tempo. Sebuah item yang telah di-deploy menjadi username yang otoritatif hanya setelah registry memfinalisasi
catatan nama yang cocok melalui ACK terlambat yang valid atau `ResendDeployedAck`. Klien dan indexer harus mengabaikan klaim kepemilikan
berbasis-item saja dan tidak boleh menggunakan pemilik catatan registry sebagai pemilik saat ini setelah transfer.

Frasa pemulihan GRAM 24 kata adalah satu-satunya rahasia pengguna. PWA secara deterministik menurunkan kunci wallet GRAM dan kunci enkripsi/penanda tangan perpesanan dari frasa tersebut. Alur ekspor/impor profil karenanya hanya menangani frasa pemulihan; tidak ada cadangan kunci-perpesanan terpisah.

## Kebijakan replay dan kedaluwarsa

Kapsul pribadi secara default memiliki TTL 24 jam dan dibatasi hingga 30 hari. Verifikasi paket kapsul live/off-chain menolak:

- kapsul yang dibuat terlalu jauh di masa depan;
- kapsul yang kedaluwarsa;
- TTL di atas batas kebijakan;
- id kapsul yang terduplikasi dalam cache replay yang disediakan pemanggil.

Impor riwayat-chain berbeda: ketika sebuah entri pribadi sudah diterima oleh CapsuleHub dan body dipulihkan dari
riwayat transaksi TON yang diterima atau dari cache terenkripsi lokal, PWA memverifikasi hash entri, sel body/header, dan
dekripsi, tetapi ia tidak menolak semata-mata karena kedaluwarsa header berada di masa lalu. Kalau tidak, riwayat chain yang tersimpan akan
menjadi tidak dapat dibaca secara desain.

Cache replay adalah state lokal; klien produksi dapat mendukungnya dengan IndexedDB atau penyimpanan lokal-perangkat lain. Tidak ada backend yang diperlukan.

## Aturan tanpa-backend

Lapisan enkripsi tidak memerlukan backend Platho. Sebuah server boleh meng-host file statis, tetapi pengiriman pribadi ditambatkan oleh state chain `CapsuleHub` ditambah body transaksi publikasi yang diterima: entri yang ringkas membuktikan hash, dan body harus tetap tersedia dari riwayat pesan TON atau cache terenkripsi lokal pengguna. Server tidak pernah menerima plaintext, kunci pribadi, atau rahasia sesi sisi-server.

## Draf pendaftaran Vault

Klien dapat menurunkan sebuah draf `RegisterMessagingKeys` dari bundel yang ditandatangani yang telah diverifikasi:

- `enc_pubkey`: kunci publik X25519 32-byte sebagai uint256.
- `sign_pubkey`: kunci publik penanda tangan Ed25519 32-byte sebagai uint256.
- `auth_pubkey`: kunci publik otorisasi Vault Ed25519 32-byte terpisah sebagai uint256.
- `pq_kem_pubkey_hash`: SHA-256 dari kunci publik ML-KEM-768.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: snake-cell kanonis yang berisi persis 1184 byte kunci publik ML-KEM-768.
- `crypto_suite_mask`: `2` untuk `hybrid-v1`.

Draf ini diajukan oleh alur aktivasi wallet Platho tertanam. Setelah wallet diaktifkan di Vault, pengguna teraktivasi lain dapat menyelesaikan catatan kunci perpesanan publiknya dan mengenkripsi kapsul pribadi kepadanya.

## Pengikatan catatan kunci Vault

Setelah wallet mendaftarkan kunci on-chain, klien harus mengambil:

- `UserState.current_key_id` wallet;
- untuk wallet pengguna sendiri yang tidak terkunci, `UserState.auth_pubkey` yang cocok dengan kunci publik otorisasi Vault yang diturunkan secara lokal;
- `VaultKeyRecordView` untuk id kunci tersebut.

> **clean-17.** Kontrak Vault yang dijelaskan di bab ini adalah clean-15. Pada clean-17 ikatan yang sama dibaca dari kontrak KeyShard MILIK dompet itu sendiri (`web/key-shard-ton-rpc-provider.mjs`), yang alamatnya diturunkan dari dompet — sehingga sebuah catatan hanya dapat memuat kunci yang didaftarkan dompet tersebut. Jembatan penyedia `web/vault-chain-provider.mjs` dihapus bersama Vault.

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Jika tidak ada penyedia yang dikonfigurasi, pengikatan Vault tetap tidak tersedia alih-alih menerima draf lokal atau placeholder UI. Deployment produksi/statis dapat memasang penyedia pada `globalThis.plathoVaultChainProvider` yang membaca Vault yang telah di-deploy melalui mirror TON API atau transport yang kompatibel dengan light-client.

Runtime statis menyertakan `web/vault-ton-rpc-provider.mjs` sebagai kerangka penyedia-produksi. Ia dapat membungkus endpoint yang kompatibel dengan TON Center v3 atau `globalThis.plathoTonRpcTransport` kustom yang dipasang oleh bundel host. PWA saat ini tidak memaparkan layar pengaturan RPC pengguna bawaan. Penyedia tersebut:

- mengodekan alamat pemilik `get_user(owner)` sebagai item stack BoC `slice`;
- memanggil `get_key_record(current_key_id)` dengan item stack numerik;
- mendekode stack getter menjadi `VaultUserView` dan `VaultKeyRecordView`;
- gagal-tertutup jika transport RPC, alamat Vault, respons getter, atau pengikatan catatan-kunci tidak tersedia.

Verifikator sisi-klien memeriksa bahwa catatan Vault yang aktif cocok dengan bundel yang ditandatangani yang telah diverifikasi:

- `owner_wallet` cocok dengan alamat wallet Platho tertanam;
- `enc_pubkey` cocok dengan kunci publik X25519;
- `sign_pubkey` cocok dengan kunci publik penanda tangan bundel;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash`, dan `pq_kem_pubkey_len` cocok dengan materi ML-KEM-768;
- `crypto_suite_mask` cocok dengan suite;
- `revoked_lt` bernilai nol;
- `current_key_id` opsional menunjuk ke id catatan yang diambil.

Klien tidak menciptakan id kunci on-chain. Vault menghitungnya dari alamat pemilik, generasi kunci, bidang kunci, panjang PQ, dan suite. Klien memverifikasi catatan yang diambil sebagai gantinya.

## Penyimpanan replay tahan lama

PWA menggunakan IndexedDB untuk perlindungan replay kapsul pribadi ketika tersedia, dengan cadangan memori. Penyimpanan menyimpan id kapsul hingga kedaluwarsa kapsulnya dan memangkas entri yang kedaluwarsa secara lokal. Ini adalah state lokal-perangkat dan tidak memerlukan server.

## Riwayat pesan lokal terenkripsi

PWA juga memiliki penyimpanan riwayat pesan terenkripsi lokal-perangkat. Ia menggunakan kunci AES-GCM-256 WebCrypto yang tidak dapat diekstrak yang disimpan di IndexedDB dan menyimpan setiap body pesan sebagai ciphertext terautentikasi. Header catatan hanya menyimpan metadata kueri lokal: id, id utas, stempel waktu, arah, dan id kapsul opsional.

Header terikat sebagai additional authenticated data AES-GCM. Mengubah id utas, stempel waktu, arah, id kapsul, nonce, atau ciphertext mencegah catatan tersebut dibuka. Jika IndexedDB tidak tersedia, aplikasi kembali ke riwayat dalam-memori terenkripsi untuk sesi tersebut dan menghindari penulisan plaintext ke penyimpanan browser persisten.
