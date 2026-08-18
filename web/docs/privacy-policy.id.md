# Kebijakan Privasi

Terakhir diperbarui: 18 Agustus 2026

Platho adalah messenger tanpa backend. Dokumen ini singkat karena memang sangat
sedikit yang perlu diungkapkan — dan menjadi rinci di tempat sesuatu benar-benar
meninggalkan perangkat Anda.

## Apa yang kami kumpulkan

Tidak ada.

Tidak ada server Platho. Aplikasi ini adalah halaman statis yang berjalan
sepenuhnya di peramban Anda. Kami tidak mengoperasikan sistem akun, basis data
pengguna, analitik, pelaporan kerusakan, maupun periklanan. Kami tidak dapat
melihat pesan, kontak, saldo, atau aktivitas Anda, karena tidak satu pun dari
semua itu dikirim kepada kami.

Kami tidak meminta alamat email, nomor telepon, atau nama.

## Apa yang tetap berada di perangkat Anda

- Frasa pemulihan 24 kata Anda, serta kunci dompet dan kunci pesan yang diturunkan darinya.
- Riwayat pesan dan draf Anda.
- Pengaturan Anda, termasuk API key opsional untuk penyedia node TON publik.

Data ini disimpan di penyimpanan lokal peramban Anda dan dienkripsi dengan kata
sandi yang Anda pilih (AES-GCM-256 dengan penurunan kunci PBKDF2-SHA-256). Kami
tidak pernah menerimanya. Menghapus data peramban Anda akan menghapusnya, dan
tanpa frasa pemulihan Anda, data itu tidak dapat dipulihkan oleh kami maupun
oleh siapa pun.

## Apa yang bersifat publik secara desain

**Pesan pribadi dienkripsi di perangkat Anda** sebelum dipublikasikan, dan hanya
penerima yang dituju yang dapat membaca isinya.

**Kiriman publik tidak dienkripsi.** Kiriman tersebut ditulis ke blockchain TON
dalam bentuk teks biasa, dan bersifat permanen: baik kami, administrator,
pemerintah, maupun Anda sebagai penulisnya tidak dapat menghapusnya. Jangan
memublikasikan apa pun secara publik yang mungkin perlu Anda tarik kembali di
kemudian hari.

Blockchain adalah buku besar publik. Bahkan untuk pesan terenkripsi, fakta bahwa
sebuah transaksi terjadi, waktunya, dan biayanya terlihat oleh siapa saja.
Alamat dompet bersifat publik. Jika Anda mengaitkan sebuah alamat dengan
identitas Anda di tempat lain, aktivitas alamat tersebut dapat dikaitkan dengan
Anda.

## Pihak ketiga yang dihubungi perangkat Anda

Aplikasi ini tidak memiliki server milik kami untuk diajak berkomunikasi,
sehingga ia berkomunikasi langsung dengan infrastruktur TON publik. Ketika Anda
menggunakan Platho, peramban Anda mengirim permintaan ke:

- `toncenter.com`
- `tonapi.io`
- `mainnet-v4.tonhubapi.com`

Para penyedia ini mau tidak mau melihat alamat IP Anda dan permintaan yang
dibuat perangkat Anda, dan mereka beroperasi di bawah kebijakan privasi mereka
sendiri, yang tidak kami kendalikan. Inilah satu-satunya tempat di mana
informasi tentang Anda meninggalkan perangkat Anda menuju pihak selain
blockchain itu sendiri. Jika Anda menggunakan VPN atau jaringan Tor, para
penyedia ini akan melihat itu sebagai gantinya.

Jika Anda menyediakan API key Anda sendiri untuk salah satu penyedia ini, kunci
tersebut disimpan secara lokal di perangkat Anda dan dikirim hanya kepada
penyedia tersebut.

## Telegram Mini App

Platho juga dapat berjalan di dalam Telegram sebagai Mini App. Dalam mode
tersebut, Telegram sendirilah yang mengatur apa yang disediakannya kepada
aplikasi dan apa yang dicatatnya tentang penggunaan Telegram oleh Anda; hal itu
tercakup dalam kebijakan privasi Telegram sendiri, bukan kebijakan ini.

## Anak-anak

Platho tidak ditujukan bagi anak-anak di bawah usia 13 tahun.

## Perubahan

Jika kebijakan ini berubah, tanggal di bagian atas berubah bersamanya. Versi
terkini selalu merupakan versi yang dipublikasikan di dalam aplikasi dan di
platho.app.

## Bahasa

Dokumen ini dipublikasikan dalam beberapa bahasa. Terjemahan disediakan untuk kemudahan;
jika terdapat perbedaan, versi bahasa Inggris-lah yang berlaku.

## Kontak

Pertanyaan mengenai kebijakan ini: https://t.me/plathoapp
