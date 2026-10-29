# Kebijakan Privasi

Terakhir diperbarui: 22 Oktober 2026

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
- Riwayat pesan Anda. (Draf yang belum dikirim hanya disimpan di memori dan hilang saat halaman ditutup.)
- Nama yang Anda berikan kepada kontak Anda, dan kontak mana yang Anda sematkan atau berhenti Anda tandai belum dibaca.
- Nama yang Anda berikan pada dompet Anda — disimpan sebagai teks biasa, agar layar kunci bisa menampilkannya sebelum kata sandi apa pun.
- Pengaturan Anda, termasuk API key opsional untuk penyedia node TON publik.

Tidak ada satu pun yang sampai kepada kami, dan pelindungnya tidak sama — jadi
masing-masing disebut satu per satu, bukan satu pernyataan untuk semuanya:

- **Frasa pemulihan dan kunci yang diturunkan darinya** dienkripsi dengan kata
  sandi yang Anda pilih (AES-GCM-256, penurunan kunci PBKDF2-SHA-256). Tanpa kata
  sandi itu keduanya tidak dapat dibaca, baik oleh kami maupun oleh siapa pun yang
  memegang perangkat.
  Jika pengelola kata sandi menyimpan kata sandi itu untuk Anda, dompet di perangkat ini
  hanya seaman pengelola itu — biasanya akun Anda di perangkat, dan cloud-nya jika ia
  menyinkronkan.
- **Riwayat pesan, kunci percakapan dan grup Anda, nama yang Anda berikan kepada kontak, serta catatan siapa yang pertama kali menulis kepada Anda**
  dienkripsi dengan kunci yang diturunkan dari frasa pemulihan Anda. Kunci-kunci
  itu hanya ada selama dompet Anda tidak terkunci dan tidak pernah ditulis ke
  perangkat, sehingga salinan berkas peramban — cadangan, citra disk, akun lain
  di komputer yang sama — tidak bisa membaca apa pun darinya tanpa kata sandi
  Anda: tidak pesannya, tidak kuncinya, tidak pula namanya. Di perangkat yang menyimpan dompet Anda, hal yang sama berlaku untuk apa yang disimpan aplikasi agar dapat menampilkan gambar, profil, dan postingan dengan cepat, serta untuk kanal publik yang Anda ikuti dan sejauh mana Anda membacanya.
- **Pengaturan** — tema, bahasa — disimpan sebagai teks biasa, dan tidak ada yang sampai kepada kami. Begitu pula kanal
  publik yang Anda ikuti dan sejauh mana Anda membacanya di perangkat yang tidak menyimpan dompet, sampai dompet dibuat
  atau dipulihkan di sana. Satu-satunya rahasia di antaranya, kunci API opsional penyedia node, disegel
  dengan kunci yang disimpan peramban Anda di perangkat ini, bukan disimpan sebagai
  teks biasa.

Menghapus data peramban Anda akan menghapus semuanya dari perangkat. Apa yang
dapat dikembalikan oleh frasa pemulihan Anda berasal dari blockchain: pesan Anda
diterbitkan di sana, dan kunci yang membuka percakapan dan grup Anda, catatan
Anda, serta langganan Anda juga disimpan di sana, dienkripsi dengan kunci yang
diturunkan dari frasa itu — tanpa frasa itu, tidak seorang pun, termasuk kami,
dapat membaca atau memulihkannya. Di dalam Telegram Anda dapat menyimpan satu
salinan lagi, yang dijelaskan di bawah pada Telegram Mini App: salinan terenkripsi
dompet Anda yang tidak terjangkau oleh penghapusan data peramban.

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

**Laporan dan reaksi adalah transaksi publik dari dompet Anda.** Saat Anda
melaporkan atau memberi reaksi pada sebuah kiriman, transaksi dikirim oleh dompet
Anda ke alamat yang bisa dihitung siapa pun dari kiriman itu, sehingga siapa pun
— termasuk penulis kiriman tersebut — bisa melihat dompet mana yang melaporkan
atau memberi reaksi. Laporan yang ditolak dan sanksi yang dicabut membatalkan
efeknya, bukan catatannya: transaksi tetap di rantai selamanya.

## Pihak ketiga yang dihubungi perangkat Anda

Aplikasi ini tidak memiliki server milik kami untuk diajak berkomunikasi,
sehingga ia berkomunikasi langsung dengan infrastruktur TON publik. Ketika Anda
menggunakan Platho, peramban Anda mengirim permintaan ke:

- `toncenter.com`
- `tonapi.io`
- `nft.fragment.com`

Para penyedia ini mau tidak mau melihat alamat IP Anda dan permintaan yang
dibuat perangkat Anda, dan mereka beroperasi di bawah kebijakan privasi mereka
sendiri, yang tidak kami kendalikan. Selain apa yang Anda pilih untuk disimpan di
Telegram (lihat Telegram Mini App di bawah), inilah satu-satunya tempat di mana
informasi tentang Anda meninggalkan perangkat Anda menuju pihak selain
blockchain itu sendiri. Jika Anda menggunakan VPN atau jaringan Tor, para
penyedia ini akan melihat itu sebagai gantinya.

Jika Anda menyediakan API key Anda sendiri untuk salah satu penyedia ini, kunci
tersebut disimpan di perangkat Anda dan dikirim hanya kepada penyedia tersebut —
dan, jika Anda menyimpan dompet di Telegram, juga disimpan di sana di samping
salinan dompet, dalam keadaan terenkripsi (lihat di bawah).

## Telegram Mini App

Platho juga dapat berjalan di dalam Telegram sebagai Mini App. Dalam mode
tersebut, Telegram sendirilah yang mengatur apa yang disediakannya kepada
aplikasi dan apa yang dicatatnya tentang penggunaan Telegram oleh Anda; hal itu
tercakup dalam kebijakan privasi Telegram sendiri, bukan kebijakan ini.

Dalam mode tersebut, dompet Anda berada di salah satu dari dua tempat, dan Anda
yang memilih tempatnya di Pengaturan → "Tempat dompet disimpan". **Secara
bawaan, dompet hanya berada di perangkat ini**: tidak ada salinannya yang
dikirim ke Telegram (hanya tanda-tanda kecil yang dijelaskan di bawah), dan jika
data perangkat hilang — Telegram dapat menghapus penyimpanan aplikasi, terutama
di iPhone — hanya 24 katanya atau berkas kuncinya yang dapat mengembalikannya.

**Jika Anda memilih menyimpannya di Telegram, salinan terenkripsi dompet Anda
disimpan di penyimpanan cloud Telegram** (CloudStorage), sehingga perangkat mana
pun yang masuk ke akun Telegram Anda dapat membukanya dengan kata sandi Anda.
Salinan itu adalah catatan terenkripsi kata sandi yang sama dengan yang ada di
perangkat Anda: frasa pemulihan dan alamat dompet berada di dalam enkripsi. Di
sampingnya ada parameter yang diperlukan untuk mendekripsinya dan sebuah
pengenal yang diturunkan dari frasa pemulihan, yang dipakai aplikasi untuk
mengenali salinannya sendiri; tanpa frasa itu, pengenal tersebut tidak dapat
dikaitkan dengan alamat Anda (berkas kunci Anda memuatnya di samping alamat).
Telegram menyimpan salinan itu di servernya dan mengaitkannya dengan akun
Telegram Anda; tanpa kata sandi Anda, salinan itu tidak dapat didekripsi, jadi
pilihlah kata sandi yang kuat dan tidak Anda pakai di tempat lain. Jika Anda
menyediakan API key untuk penyedia node, kunci itu disimpan di samping salinan,
dienkripsi dengan kunci yang diturunkan dari frasa pemulihan Anda. Setiap salinan juga membawa nomor versi, yang dipakai aplikasi untuk mengetahui salinan mana yang lebih baru, dan tanda tangan yang dibuat dengan kunci turunan dari frasa pemulihan, yang dipakai aplikasi untuk memeriksa bahwa salinan dan versinya berasal dari dompet Anda.

Setiap dompet yang Anda simpan di Telegram punya salinannya sendiri di sana, dienkripsi dengan kata sandi dompet itu; membuat atau memilih dompet lain di sebuah perangkat tidak menghapus satu pun. Setiap perangkat yang masuk ke akun Telegram Anda menampilkan dompet yang disimpan di sana — di layar kuncinya dan di Pengaturan → "Dompet lain" — dan masing-masing dibuka dengan kata sandinya sendiri. Saat kata sandi sebuah dompet berubah, salinannya di Telegram ikut memakai yang baru. Dompet yang pernah dipakai di sebuah perangkat disimpan di perangkat itu dengan cara yang sama.

Beberapa nilai kecil juga disimpan di cloud Telegram: catatan bahwa Anda telah
menutup mulai cepat, tanda bahwa Anda telah mengonfirmasi 24 kata sebuah dompet,
dan, selama berkas kunci sebuah dompet belum disimpan, sebuah penanda; tanda dan
penanda itu hanya dapat dikenali oleh dompet itu sendiri. Tidak satu pun berisi
alamat. Aplikasi menulis ke cloud Telegram hanya jika Telegram memastikan
aplikasi dibuka dari bot resmi @PlathoBot. Saat Telegram menyimpan salinan
sebuah dompet, nama yang Anda berikan pada dompet itu disimpan di sampingnya,
dienkripsi dengan kunci yang diturunkan dari frasa pemulihan dompet itu —
Telegram tidak dapat membacanya — dan ikut terhapus bersama salinan terakhir di
sana.

"Hapus salinan di Telegram" menghapus salinan dompet Anda di sana dan API key yang disimpan di sampingnya; "Lupakan dompet ini" menghapus dompet dari "Dompet lain" di perangkat ini beserta salinannya di Telegram. Opsi "Hapus data lokal" milik aplikasi itu sendiri hanya membersihkan perangkat ini — tidak menghapus apa pun dari Telegram — dan menghapus cache Telegram atau data peramban membiarkan salinan di Telegram tetap ada. Di luar Telegram, dompet tidak disalin ke mana pun.

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
