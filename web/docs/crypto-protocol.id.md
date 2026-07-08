# Protokol kripto pesan Platho

Dokumen ini menjelaskan enkripsi pesan sisi klien yang diimplementasikan oleh prototipe PWA statis.

## Suite

| Suite | Nilai kontrak | Tujuan |
| --- | ---: | --- |
| `hybrid-v1` | `2` | Pesan privat menggunakan X25519 ditambah ML-KEM-768 ditambah AES-GCM. |

Penerbitan privat V1 hanya menerima `CRYPTO_SUITE_HYBRID = 2`.

## Bundel kunci

Setiap frasa pemulihan GRAM 24 kata yang dibuat atau diimpor oleh PWA secara deterministik menurunkan identitas pesan dengan sepasang kunci enkripsi dan kunci penandatanganan Ed25519. Materi kunci enkripsi publik diekspor sebagai bundel kunci publik:

- `keyId`: pengenal berbasis SHA-256 atas materi kunci publik.
- `x25519PublicKey`: kunci publik ECDH klasik 32-byte.
- `mlKem768PublicKey`: kunci publik ML-KEM-768 1184-byte untuk `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 dari kunci publik ML-KEM-768.
- `mlKem768PublicKeyLen`: selalu `1184` untuk `hybrid-v1`.

PWA menghitung ulang `keyId`, `mlKem768PublicKeyHash`, dan `mlKem768PublicKeyLen` sebelum enkripsi. Bundel yang mengklaim id, suite, suite kontrak, hash, atau panjang yang tidak cocok akan ditolak.

Pencarian penerima ditentukan oleh `enc_pubkey`, `sign_pubkey` on-chain, dan sel `pq_kem_pubkey` on-chain lengkap yang disimpan dalam catatan kunci Vault aktif. Hash dan panjang tetap berada dalam catatan sebagai field pengikat yang ringkas, tetapi kunci publik ML-KEM-768 lengkaplah yang memungkinkan klien lain benar-benar mengenkripsi kapsul `hybrid-v1`.

## Bundel bertanda tangan

PWA dapat mengekspor bundel kunci publik yang ditandatangani. Payload bertanda tangan mencakup:

- domain protokol `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- stempel waktu penerbitan dan kedaluwarsa opsional;
- placeholder dompet pemilik dan alamat Vault opsional;
- bundel enkripsi publik;
- kunci publik penandatanganan Ed25519 32-byte.

Tanda tangan mencakup payload JSON yang stabil dan diverifikasi sebelum bundel dipercaya. Ini mencegah perusakan bundel lokal secara diam-diam dan memberi klien `sign_pubkey` yang tepat yang disimpan Vault dalam `KeyRecord`.

`keyId` PWA adalah pengenal bundel klien. Ia tidak menggantikan `current_key_id` kontrak Vault, yang dihitung on-chain dari alamat pemilik, generasi kunci, kunci penandatanganan, kunci enkripsi, hash PQ, panjang PQ, dan suite kripto. Klien produksi harus memverifikasi bundel terhadap catatan kunci Vault sebelum mempercayainya untuk identitas dompet.

Bundel bertanda tangan adalah tanda tangan mandiri kunci pesan. Kepemilikan dompet dijangkarkan oleh aktivasi Vault: dompet Platho tertanam mengirim `RegisterMessagingKeys`, rotasi `ReplaceMessagingKeys` berikutnya adalah pesan eksternal yang ditandatangani-auth-Vault, dan penerima memverifikasi bundel bertanda tangan terhadap catatan kunci on-chain aktif untuk dompet tersebut.

## Kepemilikan dompet

PWA produksi tidak menggunakan konektor dompet eksternal. Pengguna membuat atau mengimpor frasa pemulihan GRAM 24 kata biasa, dan PWA
secara deterministik menurunkan kunci dompet GRAM, kunci auth Vault terpisah, serta kunci enkripsi/penandatanganan pesan dari frasa tersebut. Aktivasi
Vault adalah jangkar kepemilikan: dompet tertanam menandatangani dan mengirim `RegisterMessagingKeys` dari dompet yang sama yang memiliki catatan kunci on-chain.
`ReplaceMessagingKeys` hanya merotasi catatan kunci terima/pesan publik; ia tidak merotasi kunci auth Vault.

Penerima hanya mempercayai bundel pesan setelah memeriksanya terhadap catatan kunci Vault aktif untuk dompet tersebut:

- pemilik catatan adalah dompet yang diharapkan;
- `enc_pubkey` dan `sign_pubkey` cocok dengan bundel bertanda tangan;
- catatan hybrid mengekspos sel `pq_kem_pubkey` lengkap, bukan hanya hash-nya;
- byte kunci ML-KEM-768 yang telah didekode di-hash menjadi `pq_kem_pubkey_hash`;
- `current_key_id` aktif menunjuk ke catatan kunci yang terverifikasi.

Alur ekspor/impor profil menangani frasa pemulihan GRAM 24 kata. Tidak ada cadangan kunci pesan terpisah dan tidak ada
mode koneksi dompet eksternal dalam v1 final.

## Tata letak byte ringkas

Sel on-chain kapsul privat menggunakan tata letak biner `platho.byte-layout.v1` final. PWA dapat membungkus kapsul dalam JSON untuk UI ekspor/berbagi, tetapi payload protokol adalah byte biner, bukan JSON dan bukan penunjuk off-chain. `CapsuleHub` menyimpan header/indeks terautentikasi yang ringkas ditambah hash body; sel body terenkripsi tetap berada dalam body transaksi penerbitan yang diterima dan direkonstruksi dari riwayat pesan TON, lalu diverifikasi terhadap hash yang tersimpan.

Setiap penerbitan melewati Vault sebagai pesan eksternal bertanda tangan yang didanai saldo Vault. Pengguna terlebih dahulu mendanai saldo GRAM
Vault internal mereka, lalu PWA menandatangani permintaan penerbitan dengan `auth_pubkey` aktif; sebuah relayer dapat mengirimkan
pesan eksternal tanpa memegang kunci dompet atau kunci penandatanganan pesan. Payload bertanda tangan dipisahkan-domain dengan `VPB1`,
`deployment_manifest_hash`, alamat Vault target, dan jenis penerbitan sebelum pemilik, nonce, biaya maksimum, dan payload.
Nilai GRAM yang benar-benar dikirim kembali oleh CapsuleHub dalam ACK atau bounce dikreditkan ke saldo GRAM Vault internal
pengguna, dibatasi oleh jumlah refund penerbitan tertunda yang dilacak. Jika saldo Vault atau akses chain tidak tersedia, PWA
gagal-tertutup dan tidak boleh menampilkan aksi penerbitan.

Karena `auth_pubkey` mengotorisasi pembelanjaan saldo Vault, mengompromikan kunci penandatanganan pesan lokal saja tidak mengotorisasi
aksi penerbitan Vault, pemeriksaan pembayaran, username, atau avatar. Kompromi kunci penandatanganan pesan masih dapat memengaruhi tanda tangan
identitas tingkat-pesan, sehingga penggantian kunci mencabut catatan kunci terima publik lama untuk pemeriksaan enkripsi masuk di masa depan.

Penetapan harga pesan PWA adalah per kapsul. Dengan cadangan saat ini dan tanpa diskon ATH, contoh kanonis yang tepat adalah entri publik 1 KiB mulai dari `0.0337 GRAM` dan kapsul privat
`hybrid-v1` 1 KiB mulai dari `0.0347 GRAM`; kelas ukuran publik atau privat yang lebih besar berbiaya lebih tinggi sesuai kelas kanonis. Ini mencakup biaya
protokol Platho penuh sebesar `0.01 GRAM`, endowment penyimpanan indeks-ringkas CapsuleHub, cadangan eksekusi lokal Vault, dan
refund ACK yang diharapkan. Secara terpisah, jika perkiraan biaya konservatif PWA lebih tinggi dari kelonggaran biaya-jaringan yang disertakan
sebesar `0.005 GRAM`, ia menambahkan
kelebihan yang dibulatkan sebagai surcharge. Panggilan kontrak tetap dimulai dari nilai
kanonis yang diperlukan: penerbitan Vault mengirim `maxCharge = canonical_max_charge + surcharge`. CapsuleHub tidak memiliki ABI penerbitan pengguna
langsung dalam v1 final; setiap penerbitan adalah Vault -> CapsuleHub. Diskon ATH hanya berlaku setelah airdrop aktivitas Vault
telah mendistribusikan 15.000.000 ATH; sebelum gerbang itu, biaya protokol pesan menggunakan biaya `0.01 GRAM` penuh. PWA harus menampilkan hold
final dan biaya bersih untuk ukuran konten yang dipilih sebelum menandatangani.

Surcharge adalah margin keamanan jaringan/penyimpanan bertanda tangan, bukan wadah biaya yang dapat direfund. CapsuleHub menerima penerbitan Vault
ketika nilai yang dilampirkan setidaknya sama dengan nilai kanonis yang diperlukan, tetapi ACK penerbitan yang berhasil hanya mengembalikan
cadangan ACK penerbitan tetap sebesar `30,000,000` nanoton (`0.030 GRAM`). Setelah Vault memproses ACK itu, pengguna dikreditkan sekitar
`25,800,000` nanoton dalam saldo GRAM Vault internal. Setiap surcharge bertanda tangan di atas nilai kanonis yang diperlukan tetap berada di
CapsuleHub sebagai kelebihan cadangan jaringan/penyimpanan; ia tidak dikembalikan ke Vault dan tidak dihitung sebagai
`accrued_plato_fee_ton`.

CapsuleHub melindungi cadangan GRAM mentah yang setara dengan `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
Cadangan live menggunakan penghitung entri privat/publik yang belum dipangkas alih-alih penghitung `latest_id` historis. Sebuah panggilan
`SweepExcessReserve` tanpa-izin yang terpisah hanya dapat memindahkan surplus di atas jumlah terlindungi itu ke FeeAccumulator sebagai
`DepositProtocolFee`, di mana ia mengikuti pembagian treasury/buyback normal. Pengiriman pesan biasa tidak melakukan
sweep ini. Jika deposit sweep itu bounce, jumlah yang dikembalikan sengaja direklasifikasi sebagai `accrued_plato_fee_ton`
yang didukung sehingga dapat dicoba ulang melalui jalur flush biaya normal.
Panggilan `FlushFees` parsial normal harus setidaknya sama dengan biaya protokol publik saat ini (`0.010 GRAM`); jumlah yang lebih kecil
valid hanya ketika itu adalah seluruh sisa wadah terakrual, sehingga debu yang didiskon tetap dapat difinalisasi.

CapsuleHub mencatat `created_at = now()` untuk setiap entri privat dan publik. PWA menggunakan stempel waktu kontrak itu untuk pengurutan dan untuk pencarian riwayat-transaksi terbatas; stempel waktu header klien tetap merupakan metadata payload terautentikasi, bukan otoritas penemuan. Metadata entri ringkas dapat dipangkas tanpa-izin setelah jendela retensi satu tahun yang dikonfigurasi, sementara ketersediaan body bergantung pada cakupan riwayat-pesan penyedia TON yang dipilih dan cache terenkripsi lokal pengguna.

Saldo ATH Vault dikreditkan melalui akuntansi alur-notifikasi eksplisit, bukan dengan memindai saldo dompet resmi mentah.
Jalur deposit yang didukung adalah `ATHTransferRequestWithNotify` ATHWallet pengguna ke dalam Vault. Transfer ATH biasa manual
ke ATHWallet Vault resmi tidak didukung dan tidak boleh ditampilkan sebagai alamat deposit atau diperlakukan sebagai
kredit ledger Vault. Penarikan ATH dari Vault adalah perintah Vault eksternal bertanda tangan. Cadangan deploy/transfer/ACK ATHWallet
hilir-nya dibayar dari saldo GRAM Vault internal pengguna, dan Vault hanya mengkreditkan kembali
nilai ACK/gagal/bounce terautentikasi yang diterimanya, dikurangi cadangan refund lokal dan dibatasi oleh nilai internal yang dicadangkan.

Postingan publik dan komentar adalah profil terbuka terpisah, bukan kapsul privat tanpa enkripsi. Mereka menyimpan sel header
publik `PPH1` yang ringkas ditambah sel body publik mentah. Teks body publik dan byte gambar/avatar publik menggunakan kelas ukuran
kapsul publik 1, 2, 4, 8, 16, atau 32 KiB yang sama sebagai anggaran body yang terlihat pengguna. Metadata header tidak pernah mengurangi
anggaran body itu. Postingan publik tidak memiliki opsi pascakuantum; salinan publik menggunakan label produk `from 0.0337 GRAM`,
sementara contoh basis publik yang tepat saat ini adalah `0.0337 GRAM` ditambah aturan surcharge
biaya-jaringan yang sama. `kind = 1` adalah postingan publik; bit 0 `flags` postingan menutup komentar untuk postingan itu. `kind = 2` adalah
komentar publik satu tingkat dengan `parent_entry_id:uint64` dan `parent_body_hash:uint256` di header. `kind = 3` adalah
postingan gambar publik, `kind = 4` adalah komentar gambar publik, dan `kind = 5` adalah media avatar dompet publik. Header publik juga membawa `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16`, dan `media_format:u8`; v1 publik menggunakan `media_format = 0` untuk teks dan
`media_format = 1` untuk bagian gambar/avatar WebP. Header postingan, postingan gambar, dan avatar juga membawa
`profile_version:uint32` dan `avatar_hash:uint256`; nol berarti tidak ada penunjuk avatar. Teks publik panjang atau data gambar direkonstruksi dari beberapa entri
hanya setelah setiap entri menggunakan kelas ukuran publik terkecil yang muat hingga 32 KiB. PWA resmi mengompresi gambar terpilih ke target WebP sebesar 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, default), atau 64 KiB (`maximum`) sebelum pemisahan. Tidak ada lapisan edit/hapus/reaksi/moderasi atau penghitung dalam v1.

Avatar dompet adalah pembaruan profil berbayar, bukan aset off-chain. Byte avatar diterbitkan sebagai entri CapsuleHub publik
`kind = 5`, lalu `ProfileRegistry` mencatat penunjuk dompet terautentikasi:
`version`, `avatar_hash`, `avatar_entry_id` pertama, `avatar_stream_id`, `avatar_part_count`, dan `media_format`. Pembaca
menyelesaikan penunjuk profil dari header privat bertanda tangan atau header postingan publik, memverifikasi catatan ProfileRegistry
yang cocok, mengambil entri publik avatar dari CapsuleHub, menggabungkan bagian dalam urutan indeks, dan mensyaratkan byte WebP yang
direkonstruksi di-hash menjadi `avatar_hash`. Cache avatar lokal hanyalah pemercepat; sumber kebenaran adalah CapsuleHub ditambah
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

`size_class + crypto_suite` menyiratkan suite. `profile_version` dan `avatar_hash` menunjuk ke avatar dompet pengirim pada
saat kirim dan dicakup oleh hash header ditambah tanda tangan pengirim. `recipient_sign_pubkey` dan hash thread
sengaja tidak disimpan dalam sel header publik. Data thread/pengelompokan berada di dalam metadata kapsul terenkripsi.

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

Area konten yang berguna dipadatkan ke kelas kapsul privat 1, 2, 4, 8, 16, atau 32 KiB yang dipilih. Pesan dengan 1 byte, 500 byte, atau 1024 byte teks berguna memiliki ukuran plaintext terenkripsi yang sama dalam kelas 1 KiB. Pesan di atas kelas yang dipilih dipecah menjadi kapsul-kapsul independen dengan metadata `stream_id`, `part_index`, dan `part_count` terenkripsi. Satu kapsul tidak pernah mencampur unit teks/gambar yang tidak terkait; penerima merakit kembali kapsul-kapsul independen menjadi pesan asli.

Jenis konten:

- `1` teks: byte UTF-8, hingga ukuran kapsul privat berguna yang dipilih.
- `2` gambar: byte gambar terkompresi, hingga ukuran kapsul privat berguna yang dipilih; `media_format` adalah `1` WebP, `2` AVIF, `3` JPEG, atau `4` PNG.
- `3` pemeriksaan pembayaran: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Body pemeriksaan pembayaran sengaja tidak menyertakan `tx`, waktu aktivasi, atau kedaluwarsa. Penerima mengklaim dengan `intent_id + secret32`; jika pengirim sudah membatalkan pemeriksaan atau sudah diklaim, UI mengatakan bahwa pemeriksaan sudah diklaim atau dibatalkan oleh pengirim.

Body terenkripsi dapat dibungkus untuk ekspor/berbagi sebagai:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Untuk body kapsul final, `chunk_total` selalu `1`. `PLC1` hanya merupakan framing paket/ekspor. Transaksi penerbitan Vault -> CapsuleHub yang diterima membawa byte body `PLB1` yang telah dirakit dalam sel snake; CapsuleHub hanya menyimpan metadata terautentikasi dan hash yang ringkas.

Batas privat v1 final:

| Suite | Batas berguna per kapsul | Byte body | Byte chunk ekspor |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

Sumber kanonis untuk tata letak ini adalah `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM menggunakan nonce 12-byte dan tag 16-byte. Panjang ciphertext sama dengan panjang plaintext ditambah tag.

Prefiks body ringkas, `header0Hash`, dan `header1Hash` diteruskan sebagai additional authenticated data AES-GCM. Mengubah header routing biner, suite, nonce, ciphertext KEM, byte chunk, atau tanda tangan pengirim membuat verifikasi atau dekripsi gagal.

Sebelum dekripsi, klien juga memeriksa:

- suite body ringkas cocok dengan `header0`;
- id kunci penerima cocok dengan `header0.recipientKeyId`;
- body `hybrid-v1` memang membawa ciphertext ML-KEM 1088-byte;
- setiap chunk memiliki suite, id pesan, dan total chunk yang sama.

## Penurunan kunci

Untuk `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

Plaintext dienkripsi dengan AES-256-GCM.

Implementasi menolak shared secret X25519 yang semuanya nol untuk menghindari penerimaan kunci publik berordo rendah.

## Kapsul terenkripsi privat

Klien membungkus body terenkripsi ringkas dalam kapsul privat sebelum publikasi. Kapsul privat memiliki:

- `header0`: header routing biner `PH0B` 140-byte yang dijelaskan di atas.
- `header1`: header replay biner `PH1B` 30-byte yang dijelaskan di atas.
- `body`: metadata chunk `platho.byte-layout.v1` ditambah chunk biner yang dikodekan base64url.
- `hashes`: nilai `Cell.hash()` TON untuk sel on-chain persis yang berisi `header0`, `header1`, dan byte body terenkripsi.
- `chainCells`: payload BOC base64 menggunakan `ton-snake-byte-cell.v1`; sel-sel ini adalah sel yang diterima dalam transaksi penerbitan Vault -> CapsuleHub dan diautentikasi oleh `CapsuleHub`, bukan penunjuk off-chain.
- `senderSignature`: tanda tangan Ed25519 atas id kapsul dan ketiga hash.

Untuk `hybrid-v1`, kapsul menggunakan profil hybrid CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

Draf kapsul privat dipetakan ke body `PublishPrivateFromVault` Vault -> CapsuleHub setelah permintaan eksternal
`PublishPrivateFromVaultBalance` bertanda tangan diterima oleh Vault:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Pesan penerbitan Vault membawa `protocol_fee_paid`, karena Vault adalah otoritas diskon untuk penetapan harga yang didukung ATH.

Kapasitas payload yang berguna adalah kapasitas byte body terenkripsi yang benar-benar diserialisasi ke dalam `body_cell` dan diterima oleh `CapsuleHub`. Hash tanpa body transaksi penerbitan yang diterima yang cocok bukanlah pesan v1 yang dapat dibaca. Riwayat lokal hanyalah cache; ia tidak mendefinisikan pengiriman dalam v1.

Untuk penandatanganan penerbitan eksternal Vault, urutan hashes-ref tetap kompatibel-kontrak:

```text
body_hash || header_0_hash || header_1_hash
```

Body ringkas terikat ke `header0Hash` dan `header1Hash` melalui AAD AES-GCM. Mengganti header, chunk body, metadata suite, tanda tangan pengirim, konteks kapsul, atau sel payload BOC membuat verifikasi gagal sebelum pesan diterima.

## Sumber kebenaran pengiriman

Pesan privat v1 yang diterima adalah entri CapsuleHub ringkas ditambah sel payload terenkripsi yang dibawa oleh body transaksi penerbitan yang diterima. PWA mengambil sel-sel itu dari riwayat pesan TON dan memverifikasinya terhadap hash CapsuleHub sebelum mendekripsi. PWA produksi tidak menampilkan pertukaran paket JSON bundel-publik atau kapsul-terenkripsi secara manual.

Kunci pesan publik didaftarkan dalam catatan kunci `Vault`. Pengirim harus menyelesaikan dan memverifikasi catatan kunci penerima sebelum mengenkripsi kapsul privat. Riwayat terenkripsi lokal hanyalah cache perangkat; ia tidak mendefinisikan pengiriman.

Otoritas username `.ath` memiliki dua bagian. `UsernameRegistry.get_name_record` membuktikan bahwa sebuah nama ada dan menunjuk ke
`UsernameNFTItem` persis untuk nama itu. Pemilik saat ini kemudian dibaca dari state item tersebut. Transfer mengubah pemilik
item; catatan registry tetap menjadi jangkar nama-ke-item. Item mengekspos data NFT standar dan metadata on-chain TEP-64,
termasuk `name = <username>.ath`, tanpa URI metadata yang dihosting server. Byte username V1 sengaja
literal: nama dengan pemisah di depan, di belakang, berturut-turut, dan seluruhnya pemisah adalah valid ketika setiap byte berada dalam set `a-z`,
`0-9`, `_`, `-` yang diizinkan dan panjangnya 4..16. Jika mint tertunda menjadi usang setelah
ACK item yang hilang, `PrunePendingUsernameMint` bersifat non-destruktif dalam v1: ia membuktikan kondisi usang tetapi tidak menghapus
state tertunda atau menciptakan refund yang jatuh tempo. Item yang di-deploy menjadi username otoritatif hanya setelah registry memfinalisasi
catatan nama yang cocok melalui ACK terlambat yang valid atau `ResendDeployedAck`. Klien dan pengindeks harus mengabaikan klaim kepemilikan
item-saja dan tidak boleh menggunakan pemilik catatan registry sebagai pemilik saat ini setelah transfer.

Frasa pemulihan GRAM 24 kata adalah satu-satunya rahasia pengguna. PWA secara deterministik menurunkan kunci dompet GRAM dan kunci enkripsi/penandatanganan pesan dari frasa tersebut. Oleh karena itu alur ekspor/impor profil hanya menangani frasa pemulihan; tidak ada cadangan kunci-pesan terpisah.

## Kebijakan replay dan kedaluwarsa

Kapsul privat secara default memiliki TTL 24 jam dan dibatasi pada 30 hari. Verifikasi paket kapsul live/off-chain menolak:

- kapsul yang dibuat terlalu jauh di masa depan;
- kapsul yang kedaluwarsa;
- TTL di atas batas kebijakan;
- id kapsul terduplikasi dalam cache replay yang disediakan pemanggil.

Impor riwayat-chain berbeda: ketika entri privat sudah diterima oleh CapsuleHub dan body dipulihkan dari
riwayat transaksi TON yang diterima atau cache terenkripsi lokal, PWA memverifikasi hash entri, sel body/header, dan
dekripsi, tetapi ia tidak menolak semata-mata karena kedaluwarsa header berada di masa lalu. Jika tidak, riwayat chain yang dipertahankan akan
menjadi tidak dapat dibaca secara desain.

Cache replay adalah state lokal; klien produksi dapat mendukungnya dengan IndexedDB atau penyimpanan lokal-perangkat lainnya. Tidak ada backend yang diperlukan.

## Aturan tanpa-backend

Lapisan enkripsi tidak memerlukan backend Platho. Server dapat menghosting file statis, tetapi pengiriman privat dijangkarkan oleh state chain `CapsuleHub` ditambah body transaksi penerbitan yang diterima: entri ringkas membuktikan hash, dan body masih harus tersedia dari riwayat pesan TON atau cache terenkripsi lokal pengguna. Server tidak pernah menerima plaintext, kunci privat, atau rahasia sesi sisi-server.

## Draf registrasi Vault

Klien dapat menurunkan draf `RegisterMessagingKeys` dari bundel bertanda tangan yang terverifikasi:

- `enc_pubkey`: kunci publik X25519 32-byte sebagai uint256.
- `sign_pubkey`: kunci publik penandatanganan Ed25519 32-byte sebagai uint256.
- `auth_pubkey`: kunci publik auth Vault Ed25519 32-byte terpisah sebagai uint256.
- `pq_kem_pubkey_hash`: SHA-256 dari kunci publik ML-KEM-768.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: snake-cell kanonis yang berisi persis 1184 byte kunci publik ML-KEM-768.
- `crypto_suite_mask`: `2` untuk `hybrid-v1`.

Draf ini dikirimkan oleh alur aktivasi dompet Platho tertanam. Setelah dompet diaktifkan di Vault, pengguna teraktivasi lainnya dapat menyelesaikan catatan kunci pesan publiknya dan mengenkripsi kapsul privat kepadanya.

## Pengikatan catatan kunci Vault

Setelah dompet mendaftarkan kunci on-chain, klien harus mengambil:

- `UserState.current_key_id` dompet;
- untuk dompet pengguna sendiri yang terbuka, `UserState.auth_pubkey` yang cocok dengan kunci publik auth Vault yang diturunkan secara lokal;
- `VaultKeyRecordView` untuk id kunci tersebut.

PWA menampilkan ini sebagai jembatan penyedia gagal-tertutup di `web/vault-chain-provider.mjs`. Jembatan mengharapkan penyedia dengan:

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Jika tidak ada penyedia yang dikonfigurasi, pengikatan Vault tetap tidak tersedia alih-alih menerima draf lokal atau placeholder UI. Deployment produksi/statis dapat memasang penyedia pada `globalThis.plathoVaultChainProvider` yang membaca Vault yang di-deploy melalui mirror TON API atau transport yang kompatibel dengan light-client.

Runtime statis menyertakan `web/vault-ton-rpc-provider.mjs` sebagai kerangka penyedia-produksi. Ia dapat membungkus endpoint yang kompatibel dengan TON Center v3 atau `globalThis.plathoTonRpcTransport` kustom yang dipasang oleh bundel host. PWA saat ini tidak menampilkan layar pengaturan RPC pengguna bawaan; jika dokumentasi mengklaim RPC yang dipilih pengguna, UI itu harus ada. Penyedia:

- mengkodekan alamat pemilik `get_user(owner)` sebagai item stack BoC `slice`;
- memanggil `get_key_record(current_key_id)` dengan item stack numerik;
- mendekode stack getter menjadi `VaultUserView` dan `VaultKeyRecordView`;
- gagal-tertutup jika transport RPC, alamat Vault, respons getter, atau pengikatan catatan-kunci tidak tersedia.

Verifier sisi-klien memeriksa bahwa catatan Vault aktif cocok dengan bundel bertanda tangan yang terverifikasi:

- `owner_wallet` cocok dengan alamat dompet Platho tertanam;
- `enc_pubkey` cocok dengan kunci publik X25519;
- `sign_pubkey` cocok dengan kunci publik penandatanganan bundel;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash`, dan `pq_kem_pubkey_len` cocok dengan materi ML-KEM-768;
- `crypto_suite_mask` cocok dengan suite;
- `revoked_lt` adalah nol;
- `current_key_id` opsional menunjuk ke id catatan yang diambil.

Klien tidak mengarang id kunci on-chain. Vault menghitungnya dari alamat pemilik, generasi kunci, field kunci, panjang PQ, dan suite. Sebagai gantinya klien memverifikasi catatan yang diambil.

## Penyimpanan replay tahan lama

PWA menggunakan IndexedDB untuk perlindungan replay kapsul privat ketika tersedia, dengan fallback memori. Penyimpanan menyimpan id kapsul hingga kedaluwarsa kapsulnya dan memangkas entri yang kedaluwarsa secara lokal. Ini adalah state lokal-perangkat dan tidak memerlukan server.

## Riwayat pesan lokal terenkripsi

PWA juga memiliki penyimpanan riwayat pesan terenkripsi lokal-perangkat. Ia menggunakan kunci AES-GCM-256 WebCrypto non-ekstraktabel yang disimpan di IndexedDB dan menyimpan setiap body pesan sebagai ciphertext terautentikasi. Header catatan hanya menyimpan metadata kueri lokal: id, id thread, stempel waktu, arah, dan id kapsul opsional.

Header terikat sebagai additional authenticated data AES-GCM. Mengubah id thread, stempel waktu, arah, id kapsul, nonce, atau ciphertext mencegah catatan terbuka. Jika IndexedDB tidak tersedia, aplikasi jatuh kembali ke riwayat dalam-memori terenkripsi untuk sesi itu dan menghindari penulisan plaintext ke penyimpanan browser persisten.

## Status produksi

Jalur rilis mainnet menggunakan penurunan dompet GRAM tertanam, kunci pesan yang dijangkarkan-Vault, validasi bundel bertanda tangan, pengikatan chain Vault gagal-tertutup, hashing sel kapsul privat, tanda tangan pengirim, penyimpanan replay tahan lama, riwayat pesan lokal terenkripsi, dan ekspor/impor frasa pemulihan. Deployment produksi harus menjaga konfigurasi PWA tetap disematkan ke manifest mainnet yang terverifikasi dan penyedia TON RPC yang disetujui; tinjauan kripto independen tetap direkomendasikan untuk jaminan jangka panjang.
