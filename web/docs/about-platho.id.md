# Tentang Platho

Platho adalah aplikasi komunikasi untuk orang-orang yang sudah lelah bergantung pada infrastruktur milik orang lain untuk kebutuhan dasar kehidupan digital: pesan, identitas, profil, riwayat, dan akses ke dana mereka sendiri.

Internet biasa dibangun terlalu nyaman bagi orang-orang yang mengendalikannya. Sebuah akun bisa ditutup. Akses bisa dibatasi. Riwayat bisa dihapus. Aturan bisa diubah setelah pengguna sudah memindahkan sebagian hidup mereka ke dalam sebuah platform. Di sana, pengguna bukanlah pemilik. Pengguna adalah penyewa yang hanya ada selama platform mengizinkannya.

Platho dibangun untuk melawan model itu.

Aksi-aksi inti di Platho ditambatkan oleh dompet pengguna dan dijalankan melalui smart contract terbuka. Dompet tetap menjadi akar kendali, sementara aktivitas rutin aplikasi bisa berjalan melalui Vault dan perintah bertanda tangan alih-alih mengekspos dompet secara langsung setiap saat. Itu tidak membuat sistem menjadi sempurna. Itu menghilangkan cacat sentral dari platform biasa: kemampuan tersembunyi untuk menulis ulang aturan, memutus akses, atau mengambil alih kendali atas sesuatu yang seharusnya menjadi milik pengguna.

Pesan pribadi ditambatkan on-chain sebagai entri capsule terenkripsi. Isi terenkripsi yang berat dibawa dalam body transaksi TON yang diterima, dipulihkan dari riwayat transaksi TON yang diterima, dan diverifikasi terhadap hash CapsuleHub, sehingga ketersediaannya bergantung pada cakupan riwayat penyedia dan cache terenkripsi lokal milik pengguna. Pesan publik, profil, dan nama menggunakan state kontrak yang dapat diverifikasi alih-alih basis data tertutup. Itu mengurangi ketergantungan pada sebuah server, sebuah operator, dan kebijakan apa pun yang kebetulan praktis minggu ini.

Platho tidak menyembunyikan biaya dari arsitektur ini. Blockchain bersifat publik. Operasi memerlukan biaya. Kesalahan pengguna bisa tidak dapat dibatalkan. Frasa seed yang hilang tidak dapat dipulihkan melalui dukungan, dan Platho bukanlah arsip permanen: entri capsule yang ringkas dapat dipangkas setelah jendela retensi berakhir, sementara pengambilan body lama bergantung pada riwayat penyedia atau cache lokal pengguna. Ini adalah model yang keras.

Dompet pribadi dan Vault dipisahkan. Dompet tetap menjadi akar kendali: ia menyetor dan menarik dana, serta mengendalikan kunci. Vault adalah lapisan kontrak pelindung antara dompet dan jaringan publik. Pengguna memindahkan sejumlah terbatas GRAM/ATH ke dalam Vault, dan penerbitan, pembayaran protokol, serta operasi aplikasi lainnya berjalan melalui saldo internal dan perintah bertanda tangan. Ini mengurangi eksposur dompet secara langsung on-chain dan membatasi seberapa banyak nilai yang terekspos pada aktivitas rutin aplikasi.

ATH adalah token utilitas protokol. Token ini digunakan untuk username, pembaruan avatar, dan diskon biaya protokol pasca-airdrop. Perannya terikat pada penggunaan nyata di dalam aplikasi.

ATH dirancang untuk para peserta sistem. Bagian yang berarti dari pasokan didistribusikan melalui aktivitas pengguna alih-alih melalui alokasi tertutup ke alamat-alamat awal. Itu membuat ekonomi kurang bergantung pada sekelompok kecil pemegang dan lebih terhubung dengan penggunaan jaringan yang nyata.

Platho tidak memiliki kendali administratif tersembunyi atas saldo pengguna. Kontrak-kontrak tidak memberi siapa pun sakelar admin sewenang-wenang untuk menyita dana orang lain, menulis ulang saldo, menjeda operasi pengguna, atau meningkatkan aturan protokol. V1 masih memiliki otoritas peluncuran yang sempit dan terdokumentasi: pengikatan dan penyegelan genesis, pembekuan rute BuybackBurn pasca-pool, pembekuan penetapan harga MarketStabilitySeller pasca-pool, dan pengaktifan pembagian buyback FeeAccumulator satu arah setelah preflight.

Intinya sederhana: kehidupan digital seharusnya tidak bergantung pada izin platform. Pesan, username, profil, dan dana seharusnya menjadi milik pengguna sejauh sistem nyata dapat mewujudkannya.

Platho tidak berusaha menjadi sangkar yang nyaman. Ia berusaha menjadi alat di mana kendali atas hal-hal digital dasar kembali kepada orang yang menggunakannya, bukan kepada siapa pun yang mengendalikan server, basis data, atau aturan akses.
