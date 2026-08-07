# Kriptografi Platho

## Kunci dan identitas

Semuanya diturunkan dari satu frasa seed: kunci dompet, kunci tanda tangan, kunci enkripsi, dan kunci pemindaian. Bagian rahasianya tidak pernah meninggalkan perangkat Anda — tidak ada server yang mengetahuinya, karena server memang tidak ada, dan jaringan pun tidak.

Yang naik ke chain hanyalah bagian publiknya. Semuanya tersimpan di KeyShard Anda, yang alamatnya terikat pada alamat dompet Anda, sehingga shard itu hanya bisa memuat apa yang didaftarkan oleh dompet tersebut — keterikatan lewat alamat itulah seluruh otorisasinya. Ada empat bidang yang disimpan: kunci enkripsi, kunci tanda tangan, kunci pemindaian, dan nomor generasi kunci.

Pengenal kunci tidak diberikan, melainkan **dihitung**: `keyId = H(kunci enkripsi, hash kunci ML-KEM)`. Untuk menyodorkan keyId milik orang lain, dibutuhkan kunci enkripsi orang itu.

Aktivasi adalah publikasi pertama kunci publik Anda sendiri. Biayanya 0,06 GRAM, dibayar dari dompet.

## Kontak pertama

Surat pertama kepada orang asing tidak bisa bersandar pada rahasia bersama — rahasia itu belum ada. Karena itu ia melaju di jalur tersendiri.

**Bagaimana penerima menemukannya.** Bagian terbuka kapsul berukuran 42 bita: sebuah titik acak `R` dan penanda `view_tag` sepanjang dua bita. Penanda itu dihitung dari `R` dan kunci **pemindaian** milik penerima. Penerima menelusuri entri-entri terbaru dan mencocokkan penanda dengan kuncinya sendiri; orang luar hanya melihat bita acak dan tidak bisa menyimpulkan surat itu ditujukan kepada siapa. Alamat penerima sama sekali tidak ada di bagian terbuka.

**Bagaimana penerima tahu siapa yang menulis.** Di dalam badan terenkripsi terdapat jabat tangan kriptografis: tanda tangan pengirim atas sebuah transkrip yang mengikat kedua keyId, kunci enkripsi statis pengirim, hash kunci ML-KEM miliknya, kedua ciphertext KEM, `R`, `view_tag`, dan sebuah angka sekali pakai. Tanda tangan diperiksa **sebelum** satu pun bidang dipercaya — kalau tidak, penyerang bisa menempelkan tanda tangan orang lain pada bahan kuncinya sendiri.

Dua pemeriksaan sudah cukup, dan tak satu pun memerlukan pembacaan chain:

1. `keyId` dihitung ulang dari kunci-kunci yang disodorkan dan harus sama dengan yang diklaim;
2. sebuah penanda konfirmasi membuktikan bahwa pengirim **menurunkan kunci akar yang sama**, dan itu menuntut rahasia di balik kunci enkripsi.

Yang pertama memaksa pemalsu memakai kunci korban; yang kedua menangkapnya persis di situ: kunci akar tak bisa ia turunkan, penandanya tidak cocok, dan surat itu ditolak.

Pengulangan bita demi bita tertangkap oleh angka sekali pakai pada jabat tangan.

Entri kontak pertama hidup seminggu di chain — cukup untuk dibaca, tidak cukup untuk menjadi arsip.

## Percakapan yang sudah terjalin

Setelah kontak pertama, keduanya memiliki kunci akar bersama, dan seluruh surat-menyurat berikutnya berpindah ke jalur kedua, yang sama sekali tidak berkata apa pun tentang para pesertanya.

```
K_root  = HKDF( X25519(a,B) ‖ rahasia bersama ML-KEM-768,  info = ROOT ‖ keyId lebih kecil ‖ keyId lebih besar )
K_epoch = HKDF( K_root,  info = RATCHET ‖ nomor epos )
bucket  = HKDF( K_epoch, info = BUCKET ‖ arah ‖ nomor epos )
```

Akarnya hibrida: di dalamnya masuk X25519 klasik sekaligus enkapsulasi ML-KEM-768 yang sungguh-sungguh teracak. Di situlah letak ketahanan pascakuantum — akar itu tidak jatuh di hadapan komputer kuantum yang hanya diarahkan pada X25519.

Satu epos adalah satu hari UTC. Tiap arah percakapan menulis ke `bucket` buram **miliknya sendiri**, yang hanya bisa dihitung oleh yang mengetahui akarnya. Bagian terbuka kapsul berukuran 40 bita dan hanya memuat `bucket` itu: tanpa pengirim, tanpa penerima, tanpa rujukan ke pesan sebelumnya. Siapa pun yang mencoba menyusun indeks hanya melihat 32 bita acak merata, yang tak dapat dikaitkan dengan siapa pun.

## Kapsul

Badannya dienkripsi secara hibrida dengan X25519 dan ML-KEM-768, dilapisi enkripsi terautentikasi. Identitas pengirim (kunci tanda tangan, versi profil, sidik avatar) berada **di dalam** ciphertext, bukan di bagian terbuka.

Setiap kapsul punya kelas ukuran tetap, dari 1 hingga 32 KB. Ukurannya dibulatkan ke atas, jadi panjang sebuah entri tidak mengatakan apa pun tentang panjang pesan. Yang melebihi itu dipecah menjadi beberapa kapsul.

## Lini masa publik

Kiriman dan komentar publik **tidak dienkripsi** — memang itu gunanya. Semuanya tersimpan di PublicShard dalam teks terbuka, dan kontrak menganggap pengirim transaksi sebagai penulisnya, sehingga dompet penulis terlihat.

Komentar tinggal di shard tersendiri, yang alamatnya diturunkan dari koordinat kirimannya.

## Pembayaran

Tidak ada perantara: klien menandatangani sendiri pesan eksternalnya dan membayar dari dompetnya sendiri. Tanpa relai, tanpa saldo internal, tanpa pihak tepercaya yang bisa menolak penerbitan.

Biaya protokol adalah 0,01 GRAM per kapsul, sama untuk kontak pertama maupun percakapan. Sisa harga sebuah publikasi adalah yang ditagih jaringan untuk gas dan penyimpanan.

## Pemulihan

Kunci percakapan disimpan di perangkat di bawah kunci yang tidak pernah keluar dari perangkat itu. Itu selamat melewati pemuatan ulang dan tidak berguna setelah pemasangan ulang, maka ada salinan kedua: peta kunci akar disegel **dengan kunci yang diturunkan dari frasa seed** dan diletakkan di slot RecoveryShard Anda. Perangkat baru yang hanya memiliki frasa seed menemukan slot itu, membacanya, dan membukanya — dan percakapan pun kembali.

Ke dalam slot hanya dimasukkan hal-hal yang tidak bisa diturunkan ulang.

## Apa yang terlindungi dan apa yang terlihat

Daftar yang jujur — tanpa itu, janji apa pun tak banyak artinya.

**Terlindungi:**

- isi surat-menyurat pribadi: hanya Anda dan lawan bicara yang dapat membacanya;
- kepada siapa sebuah pesan pribadi ditujukan: penerima tersembunyi di balik pengalamatan siluman dan `bucket` yang buram;
- graf «siapa berkorespondensi dengan siapa»: tanpa kunci akar, kedua arah tidak dapat dikaitkan satu sama lain.

**Terlihat oleh semua:**

- bahwa sebuah dompet menerbitkan kapsul pribadi, kapan, dan pada kelas ukuran apa;
- segala yang publik — teks, gambar, komentar, dan dompet penulisnya.

## Masa simpan di chain

| Apa | Berapa lama |
|---|---|
| Kontak pertama | 1 minggu |
| Surat-menyurat pribadi | 1 tahun |
| Kiriman dan komentar publik | 1 tahun |

Setelah tenggatnya lewat, entri itu disapu keluar dari shard-nya. Transaksi yang menerbitkannya tetap berada dalam riwayat chain tanpa batas waktu: menghapus data di blockchain tidaklah mungkin.
