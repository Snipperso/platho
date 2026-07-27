# Platho Nachrichten-Krypto-Protokoll

Dieses Dokument beschreibt die clientseitige Nachrichtenverschlüsselung, die von der Platho-PWA implementiert wird.

## Verschlüsselung

Private Nachrichten verwenden X25519 + ML-KEM-768 + AES-GCM — die einzige Suite für private Nachrichten (`hybrid-v1`, Vertragswert `2`).

## Schlüsselbündel

Jede 24-Wort-GRAM-Wiederherstellungsphrase, die von der PWA erstellt oder importiert wird, leitet deterministisch eine Messaging-Identität mit einem Verschlüsselungs-Schlüsselpaar und einem Ed25519-Signaturschlüssel ab. Das öffentliche Verschlüsselungs-Schlüsselmaterial wird als öffentliches Schlüsselbündel exportiert:

- `keyId`: SHA-256-basierte Kennung über das öffentliche Schlüsselmaterial.
- `x25519PublicKey`: 32-Byte klassischer ECDH-Öffentlicher-Schlüssel.
- `mlKem768PublicKey`: 1184-Byte ML-KEM-768-Öffentlicher-Schlüssel für `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 des ML-KEM-768-Öffentlichen-Schlüssels.
- `mlKem768PublicKeyLen`: immer `1184` für `hybrid-v1`.

Die PWA berechnet `keyId`, `mlKem768PublicKeyHash` und `mlKem768PublicKeyLen` vor der Verschlüsselung neu. Ein Bündel, das eine nicht übereinstimmende Id, Suite, Vertrags-Suite, einen nicht übereinstimmenden Hash oder eine nicht übereinstimmende Länge angibt, wird abgelehnt.

Die Empfängersuche wird durch den On-Chain-Wert `enc_pubkey`, `sign_pubkey` und die vollständige On-Chain-`pq_kem_pubkey`-Zelle definiert, die im aktiven Vault-Schlüsseldatensatz gespeichert ist. Der Hash und die Länge verbleiben im Datensatz als kompakte Bindungsfelder, aber der vollständige ML-KEM-768-Öffentlicher-Schlüssel ist das, was es einem anderen Client tatsächlich ermöglicht, eine `hybrid-v1`-Kapsel zu verschlüsseln.

## Signierte Bündel

Die PWA kann ein signiertes öffentliches Schlüsselbündel exportieren. Die signierte Nutzlast umfasst:

- die Protokolldomäne `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- Ausgabe- und optionale Ablaufzeitstempel;
- optionale Platzhalter für die Eigentümer-Wallet und die Vault-Adresse;
- das öffentliche Verschlüsselungsbündel;
- den 32-Byte Ed25519-Signatur-Öffentlichen-Schlüssel.

Die Signatur deckt die stabile JSON-Nutzlast ab und wird überprüft, bevor dem Bündel vertraut wird. Dies verhindert eine stille lokale Manipulation des Bündels und gibt dem Client den exakten `sign_pubkey`, den Vault in `KeyRecord` speichert.

Die `keyId` der PWA ist eine Client-Bündelkennung. Sie ersetzt nicht die `current_key_id` des Vault-Vertrags, die On-Chain aus Eigentümeradresse, Schlüsselgeneration, Signaturschlüssel, Verschlüsselungsschlüssel, PQ-Hash, PQ-Länge und Krypto-Suite berechnet wird. Ein Produktions-Client muss das Bündel gegen den Vault-Schlüsseldatensatz überprüfen, bevor er ihm für eine Wallet-Identität vertraut.

Das signierte Bündel ist eine Selbstsignatur des Messaging-Schlüssels. Das Wallet-Eigentum wird durch die Vault-Aktivierung verankert: Die eingebettete Platho-Wallet sendet `RegisterMessagingKeys`, spätere `ReplaceMessagingKeys`-Rotationen sind Vault-auth-signierte externe Nachrichten, und Empfänger überprüfen das signierte Bündel gegen den aktiven On-Chain-Schlüsseldatensatz für diese Wallet.

## Wallet-Eigentum

Die Produktions-PWA verwendet keinen externen Wallet-Connector. Ein Benutzer erstellt oder importiert eine normale 24-Wort-GRAM-Wiederherstellungsphrase, und die PWA
leitet deterministisch den GRAM-Wallet-Schlüssel, einen separaten Vault-Auth-Schlüssel und die Messaging-Verschlüsselungs-/Signaturschlüssel aus dieser Phrase ab. Die Vault-
Aktivierung ist der Eigentumsanker: Die eingebettete Wallet signiert und sendet `RegisterMessagingKeys` von derselben Wallet, die den On-Chain-Schlüsseldatensatz besitzt.
`ReplaceMessagingKeys` rotiert nur den öffentlichen Empfangs-/Messaging-Schlüsseldatensatz; es rotiert nicht den Vault-Auth-Schlüssel.

Empfänger vertrauen einem Messaging-Bündel erst, nachdem sie es gegen den aktiven Vault-Schlüsseldatensatz für diese Wallet geprüft haben:

- der Eigentümer des Datensatzes ist die erwartete Wallet;
- `enc_pubkey` und `sign_pubkey` stimmen mit dem signierten Bündel überein;
- Hybrid-Datensätze legen die vollständige `pq_kem_pubkey`-Zelle offen, nicht nur ihren Hash;
- die dekodierten ML-KEM-768-Schlüsselbytes ergeben als Hash `pq_kem_pubkey_hash`;
- die aktive `current_key_id` verweist auf den überprüften Schlüsseldatensatz.

Der Profil-Export-/Import-Ablauf verarbeitet die 24-Wort-GRAM-Wiederherstellungsphrase. Es gibt keine separate Messaging-Schlüssel-Sicherung und keinen
externen Wallet-Verbindungsmodus.

## Kompaktes Byte-Layout

On-Chain-Zellen privater Kapseln verwenden das endgültige binäre Layout `platho.byte-layout.v1`. Die PWA kann Kapseln für die Export-/Freigabe-UI in JSON verpacken, aber die Protokoll-Nutzlast besteht aus binären Bytes, nicht aus JSON und nicht aus einem Off-Chain-Zeiger. `CapsuleHub` speichert kompakte authentifizierte Header/Indizes plus den Body-Hash; die verschlüsselte Body-Zelle verbleibt im Body der akzeptierten Veröffentlichungstransaktion und wird aus dem TON-Nachrichtenverlauf rekonstruiert und dann gegen die gespeicherten Hashes verifiziert.

Jede Veröffentlichung läuft über Vault als eine aus dem Vault-Guthaben finanzierte signierte externe Nachricht. Der Benutzer finanziert zunächst sein internes
Vault-GRAM-Guthaben, dann signiert die PWA eine Veröffentlichungsanfrage mit dem aktiven `auth_pubkey`; ein Relayer kann die
externe Nachricht übermitteln, ohne den Wallet-Schlüssel oder den Messaging-Signaturschlüssel zu besitzen. Die signierte Nutzlast ist domänensepariert mit `VPB1`,
`deployment_manifest_hash`, der Ziel-Vault-Adresse und der Veröffentlichungsart vor Eigentümer, Nonce, maximaler Belastung und Nutzlast.
Der GRAM-Wert, den CapsuleHub tatsächlich in einem ACK oder Bounce zurücksendet, wird dem internen Vault-GRAM-
Guthaben des Benutzers gutgeschrieben, begrenzt durch den nachverfolgten ausstehenden Veröffentlichungs-Erstattungsbetrag. Wenn das Vault-Guthaben oder der Chain-Zugriff nicht verfügbar ist, schlägt die
PWA fehlgeschlossen fehl und darf keine Veröffentlichungsaktionen anbieten.

Da `auth_pubkey` Ausgaben aus dem Vault-Guthaben autorisiert, autorisiert die Kompromittierung allein des lokalen Messaging-Signaturschlüssels keine
Vault-Veröffentlichungs-, Zahlungsprüfungs-, Benutzernamen- oder Avatar-Aktionen. Eine Kompromittierung des Messaging-Signaturschlüssels kann sich weiterhin auf Signaturen der Nachrichtenebene
zur Identität auswirken, daher widerruft der Schlüsselaustausch den alten öffentlichen Empfangsschlüsseldatensatz für zukünftige eingehende Verschlüsselungsprüfungen.

Die Nachrichtenpreisgestaltung der PWA erfolgt pro Kapsel. Mit den aktuellen Reserven und ohne ATH-Rabatt sind exakte kanonische Beispiele öffentliche 1-KiB-Einträge ab `0.0337 GRAM` und `hybrid-v1`-1-KiB-private
Kapseln ab `0.0347 GRAM`; größere öffentliche oder private Größenklassen kosten mehr nach kanonischer Klasse. Dies umfasst die vollständige
Platho-Protokollgebühr von `0.01 GRAM`, die CapsuleHub-Speicherausstattung für den kompakten Index, die Vault-Reserve für lokale Ausführung und die
erwartete ACK-Erstattung. Separat davon fügt die PWA, wenn ihre konservative Gebührenschätzung höher ist als die enthaltene Netzwerkgebühren-
Zulage von `0.005 GRAM`,
den aufgerundeten Überschuss als Zuschlag hinzu. Vertragsaufrufe beginnen weiterhin bei ihren kanonischen
erforderlichen Werten: Vault-Veröffentlichungen senden `maxCharge = canonical_max_charge + surcharge`. CapsuleHub hat keine direkte Benutzer-
Veröffentlichungs-ABI; jede Veröffentlichung ist Vault -> CapsuleHub. ATH-Rabatte gelten erst, nachdem der Vault-Aktivitäts-Airdrop
15.000.000 ATH verteilt hat; vor diesem Tor verwenden Nachrichtenprotokollgebühren die volle Gebühr von `0.01 GRAM`. Die PWA muss den endgültigen
Halt und die Nettokosten für die ausgewählte Inhaltsgröße vor dem Signieren anzeigen.

Der Zuschlag ist eine signierte Netzwerk-/Speicher-Sicherheitsmarge, kein erstattungsfähiger Gebührentopf. CapsuleHub akzeptiert Vault-Veröffentlichungen,
wenn der angehängte Wert mindestens dem kanonischen erforderlichen Wert entspricht, aber ein erfolgreiches Veröffentlichungs-ACK gibt nur die feste
Veröffentlichungs-ACK-Reserve von `30,000,000` Nanotons (`0.030 GRAM`) zurück. Nachdem Vault dieses ACK verarbeitet hat, werden dem Benutzer ungefähr
`25,800,000` Nanotons im internen Vault-GRAM-Guthaben gutgeschrieben. Jeder signierte Zuschlag über dem kanonischen erforderlichen Wert verbleibt in
CapsuleHub als Netzwerk-/Speicher-Reserveüberschuss; er wird nicht an Vault zurückgegeben und nicht als
`accrued_plato_fee_ton` gezählt.

CapsuleHub schützt eine rohe GRAM-Reserve in Höhe von `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
Die Live-Reserve verwendet ungekürzte private/öffentliche Eintragszähler statt historischer `latest_id`-Zähler. Ein separater
berechtigungsfreier `SweepExcessReserve`-Aufruf kann nur den Überschuss über diesem geschützten Betrag als
`DepositProtocolFee` zum FeeAccumulator verschieben, wo er der normalen Treasury-/Buyback-Aufteilung folgt. Normales Nachrichtensenden führt diesen
Sweep nicht durch. Wenn diese Sweep-Einzahlung zurückprallt, wird der zurückgegebene Betrag absichtlich als gedeckter
`accrued_plato_fee_ton` neu klassifiziert, damit er über den normalen Gebühren-Flush-Pfad erneut versucht werden kann.
Normale partielle `FlushFees`-Aufrufe müssen mindestens der aktuellen öffentlichen Protokollgebühr (`0.010 GRAM`) entsprechen; ein kleinerer Betrag ist
nur gültig, wenn er dem gesamten verbleibenden aufgelaufenen Topf entspricht, sodass rabattierter Staub dennoch finalisiert werden kann.

CapsuleHub erfasst `created_at = now()` für jeden privaten und öffentlichen Eintrag. Die PWA verwendet diesen Vertragszeitstempel für die Reihenfolge und für die begrenzte Transaktionsverlaufsabfrage; Client-Header-Zeitstempel bleiben authentifizierte Nutzlast-Metadaten, keine Entdeckungsautorität. Kompakte Eintragsmetadaten können nach dem konfigurierten einjährigen Aufbewahrungsfenster berechtigungsfrei gekürzt werden, während die Body-Verfügbarkeit von der Nachrichtenverlaufsabdeckung des gewählten TON-Anbieters und dem lokalen verschlüsselten Cache des Benutzers abhängt.

Das Vault-ATH-Guthaben wird durch explizite Notify-Flow-Buchhaltung gutgeschrieben, nicht durch Scannen des rohen offiziellen Wallet-Guthabens.
Der unterstützte Einzahlungspfad ist die `ATHTransferRequestWithNotify` der ATHWallet des Benutzers in Vault. Ein manueller gewöhnlicher ATH-
Transfer an die offizielle Vault-ATHWallet wird nicht unterstützt und darf nicht als Einzahlungsadresse angezeigt oder als
Vault-Ledger-Gutschrift behandelt werden. Eine ATH-Abhebung aus Vault ist ein signierter externer Vault-Befehl. Ihre nachgelagerte ATHWallet-
Deploy-/Transfer-/ACK-Reserve wird aus dem internen Vault-GRAM-Guthaben des Benutzers bezahlt, und Vault schreibt nur
authentifizierten ACK-/Fehler-/Bounce-Wert zurück, den es empfängt, abzüglich der lokalen Erstattungsreserve und begrenzt durch den reservierten internen Wert.

Öffentliche Beiträge und Kommentare sind ein separates offenes Profil, keine privaten Kapseln ohne Verschlüsselung. Sie speichern eine kompakte
`PPH1`-öffentliche-Header-Zelle plus eine rohe öffentliche Body-Zelle. Öffentlicher Body-Text und öffentliche Bild-/Avatar-Bytes verwenden dieselben
öffentlichen Kapsel-Größenklassen von 1, 2, 4, 8, 16 oder 32 KiB wie das für den Benutzer sichtbare Body-Budget. Header-Metadaten reduzieren niemals
dieses Body-Budget. Öffentliche Beiträge haben keine Postquantum-Option; öffentliche Nachrichten beginnen ab `0.0337 GRAM`,
während das aktuelle exakte öffentliche Basisbeispiel `0.0337 GRAM` plus dieselbe
Netzwerkgebühren-Zuschlagsregel ist. `kind = 1` ist ein öffentlicher Beitrag; das `flags`-Bit 0 eines Beitrags schließt Kommentare für diesen Beitrag. `kind = 2` ist
ein einstufiger öffentlicher Kommentar mit `parent_entry_id:uint64` und `parent_body_hash:uint256` im Header. `kind = 3` ist ein
öffentlicher Bildbeitrag, `kind = 4` ist ein öffentlicher Bildkommentar, und `kind = 5` ist öffentliche Wallet-Avatar-Medien. Öffentliche Header tragen außerdem `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16` und `media_format:u8`; öffentliche Header verwenden `media_format = 0` für Text und
`media_format = 1` für WebP-Bild-/Avatar-Teile. Öffentliche Beitrags-, Bildbeitrags- und Avatar-Header tragen außerdem
`profile_version:uint32` und `avatar_hash:uint256`; null bedeutet keinen Avatar-Zeiger. Langer öffentlicher Text oder Bilddaten werden aus mehreren Einträgen
erst rekonstruiert, nachdem jeder Eintrag die kleinste passende öffentliche Größenklasse bis zu 32 KiB verwendet hat. Die offizielle PWA komprimiert ausgewählte Bilder auf WebP-Zielgrößen von 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, Standard) oder 64 KiB (`maximum`) vor dem Aufteilen. Es gibt keine Bearbeitungs-/Lösch-/Reaktions-/Moderations- oder Zählerebene.

Wallet-Avatare sind bezahlte Profilaktualisierungen, keine Off-Chain-Assets. Die Avatar-Bytes werden als `kind = 5`-öffentliche
CapsuleHub-Einträge veröffentlicht, dann erfasst `ProfileRegistry` den authentifizierten Wallet-Zeiger:
`version`, `avatar_hash`, erste `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count` und `media_format`. Leser
lösen den Profil-Zeiger aus dem signierten privaten Header oder dem öffentlichen Beitrags-Header auf, verifizieren den passenden ProfileRegistry-
Datensatz, rufen die Avatar-öffentlichen-Einträge aus CapsuleHub ab, verketten die Teile in Index-Reihenfolge und verlangen, dass die rekonstruierten
WebP-Bytes als Hash `avatar_hash` ergeben. Der lokale Avatar-Cache ist nur eine Beschleunigung; die Quelle der Wahrheit ist CapsuleHub plus
ProfileRegistry.

`header0_cell` speichert genau 140 Bytes:

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

`header1_cell` speichert genau 30 Bytes:

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` implizieren die Suite. `profile_version` und `avatar_hash` verweisen auf den Avatar der Sender-Wallet zum
Sendezeitpunkt und werden durch den Header-Hash plus die Sendersignatur abgedeckt. `recipient_sign_pubkey` und Thread-Hashes werden
absichtlich nicht in öffentlichen Header-Zellen gespeichert. Thread-/Gruppierungsdaten gehören in verschlüsselte Kapsel-Metadaten.

Jeder verschlüsselte Body wird zusammengesetzt als:

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

Der AES-GCM-Klartext ist ein fester Kapsel-Slot, ausgewählt durch `size_class`:

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

Der nutzbare Inhaltsbereich wird auf die ausgewählte private Kapselklasse von 1, 2, 4, 8, 16 oder 32 KiB aufgefüllt. Eine Nachricht mit 1 Byte, 500 Bytes oder 1024 Bytes nutzbarem Text hat dieselbe verschlüsselte Klartextgröße in der 1-KiB-Klasse. Nachrichten über der ausgewählten Klasse werden in unabhängige Kapseln mit verschlüsselten `stream_id`-, `part_index`- und `part_count`-Metadaten aufgeteilt. Eine Kapsel vermischt niemals unabhängige Text-/Bildeinheiten; der Empfänger setzt unabhängige Kapseln wieder zur ursprünglichen Nachricht zusammen.

Inhaltsarten:

- `1` Text: UTF-8-Bytes, bis zur ausgewählten nutzbaren privaten Kapselgröße.
- `2` Bild: komprimierte WebP-Bild-Bytes, bis zur ausgewählten nutzbaren privaten Kapselgröße (`media_format = 1`).
- `3` Zahlungsscheck: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Zahlungsscheck-Bodies enthalten absichtlich keine `tx`, keine Aktivierungszeit und kein Ablaufdatum. Der Empfänger löst per `intent_id + secret32` ein; wenn der Sender den Scheck bereits storniert hat oder er bereits eingelöst wurde, teilt die UI mit, dass der Scheck bereits eingelöst oder vom Sender storniert wurde.

Der verschlüsselte Body kann für Export/Freigabe verpackt werden als:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Für den endgültigen Kapsel-Body ist `chunk_total` immer `1`. `PLC1` ist nur Paket-/Export-Rahmung. Die akzeptierte Vault -> CapsuleHub-Veröffentlichungstransaktion trägt die zusammengesetzten `PLB1`-Body-Bytes in einer Snake-Zelle; CapsuleHub persistiert nur kompakte authentifizierte Metadaten und Hashes.

Endgültige private Grenzen:

| Suite | Nutzbares Limit pro Kapsel | Body-Bytes | Export-Chunk-Bytes |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

Die kanonische Quelle für dieses Layout ist `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM verwendet eine 12-Byte-Nonce und einen 16-Byte-Tag. Die Chiffretextlänge entspricht der Klartextlänge plus dem Tag.

Das kompakte Body-Präfix, `header0Hash` und `header1Hash` werden als zusätzliche authentifizierte Daten (AAD) an AES-GCM übergeben. Das Ändern binärer Routing-Header, der Suite, der Nonce, des KEM-Chiffretexts, der Chunk-Bytes oder der Sendersignatur lässt die Verifizierung oder Entschlüsselung fehlschlagen.

Vor der Entschlüsselung prüft der Client außerdem:

- die kompakte Body-Suite stimmt mit `header0` überein;
- die Empfänger-Schlüssel-Id stimmt mit `header0.recipientKeyId` überein;
- `hybrid-v1`-Bodies tragen einen 1088-Byte ML-KEM-Chiffretext;
- jeder Chunk hat dieselbe Suite, Nachrichten-Id und dasselbe Chunk-Total.

## Schlüsselableitung

Für `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

Der Klartext wird mit AES-256-GCM verschlüsselt.

Die Implementierung lehnt vollständig aus Nullen bestehende gemeinsame X25519-Geheimnisse ab, um zu vermeiden, dass Öffentliche-Schlüssel niedriger Ordnung akzeptiert werden.

## Private verschlüsselte Kapseln

Der Client verpackt kompakte verschlüsselte Bodies in eine private Kapsel vor der Veröffentlichung. Eine private Kapsel hat:

- `header0`: den oben beschriebenen 140-Byte binären `PH0B`-Routing-Header.
- `header1`: den oben beschriebenen 30-Byte binären `PH1B`-Replay-Header.
- `body`: `platho.byte-layout.v1`-Chunk-Metadaten plus base64url-kodierte binäre Chunks.
- `hashes`: TON-`Cell.hash()`-Werte für die exakten On-Chain-Zellen, die `header0`, `header1` und die verschlüsselten Body-Bytes enthalten.
- `chainCells`: base64-BOC-Nutzlasten unter Verwendung von `ton-snake-byte-cell.v1`; dies sind die Zellen, die in der Vault -> CapsuleHub-Veröffentlichungstransaktion akzeptiert und von `CapsuleHub` authentifiziert werden, kein Off-Chain-Zeiger.
- `senderSignature`: Ed25519-Signatur über die Kapsel-Id und alle drei Hashes.

Für `hybrid-v1` verwendet die Kapsel das Hybrid-Profil von CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

Der private Kapselentwurf wird auf den Vault -> CapsuleHub-`PublishPrivateFromVault`-Body abgebildet, nachdem die signierte
`PublishPrivateFromVaultBalance`-externe Anfrage von Vault akzeptiert wurde:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Vault-Veröffentlichungsnachrichten tragen `protocol_fee_paid`, weil Vault die Rabattautorität für ATH-gedeckte Preisgestaltung ist.

Die nutzbare Nutzlastkapazität ist die Kapazität der verschlüsselten Body-Bytes, die tatsächlich in `body_cell` serialisiert und von `CapsuleHub` akzeptiert werden. Ein Hash ohne den passenden akzeptierten Veröffentlichungstransaktions-Body ist keine lesbare Nachricht. Der lokale Verlauf ist nur Cache; er definiert die Zustellung nicht.

Für das externe Vault-Veröffentlichungssignieren bleibt die Reihenfolge der Hashes-Referenzen vertragskompatibel:

```text
body_hash || header_0_hash || header_1_hash
```

Der kompakte Body ist über AES-GCM-AAD an `header0Hash` und `header1Hash` gebunden. Das Ersetzen von Headern, Body-Chunks, Suite-Metadaten, Sendersignatur, Kapselkontext oder den BOC-Nutzlastzellen lässt die Verifizierung fehlschlagen, bevor die Nachricht akzeptiert wird.

## Quelle der Wahrheit für die Zustellung

Akzeptierte private Nachrichten sind kompakte CapsuleHub-Einträge plus die verschlüsselten Nutzlastzellen, die vom Body der akzeptierten Veröffentlichungstransaktion getragen werden. Die PWA ruft diese Zellen aus dem TON-Nachrichtenverlauf ab und verifiziert sie gegen die CapsuleHub-Hashes, bevor sie entschlüsselt. Die Produktions-PWA legt keinen manuellen Austausch von öffentlichen Bündeln oder verschlüsselten Kapsel-JSON-Paketen offen.

Öffentliche Messaging-Schlüssel werden in `Vault`-Schlüsseldatensätzen registriert. Ein Sender muss den Empfänger-Schlüsseldatensatz auflösen und verifizieren, bevor er eine private Kapsel verschlüsselt. Der lokale verschlüsselte Verlauf ist nur ein Geräte-Cache; er definiert die Zustellung nicht.

Die Autorität des `.ath`-Benutzernamens hat zwei Teile. `UsernameRegistry.get_name_record` beweist, dass ein Name existiert und auf das
exakte `UsernameNFTItem` für diesen Namen verweist. Der aktuelle Eigentümer wird dann aus diesem Item-Zustand gelesen. Transfers ändern den Item-
Eigentümer; der Registry-Datensatz bleibt der Name-zu-Item-Anker. Das Item legt Standard-NFT-Daten und TEP-64-On-Chain-
Metadaten offen, einschließlich `name = <username>.ath`, ohne eine server-gehostete Metadaten-URI. Benutzernamen-Bytes sind absichtlich
literal: führende, nachfolgende, aufeinanderfolgende und ausschließlich aus Trennzeichen bestehende Namen sind gültig, wenn jedes Byte im erlaubten Satz `a-z`,
`0-9`, `_`, `-` liegt und die Länge 4..16 beträgt. Wenn ein ausstehender Mint nach
einem fehlenden Item-ACK veraltet wird, ist `PrunePendingUsernameMint` nicht destruktiv: Es beweist die veraltete Bedingung, löscht aber nicht den
ausstehenden Zustand und erzeugt keine fällige Erstattung. Ein bereitgestelltes Item wird erst dann zu einem autoritativen Benutzernamen, nachdem die Registry den
passenden Namensdatensatz durch ein gültiges spätes ACK oder `ResendDeployedAck` finalisiert hat. Clients und Indexer müssen reine Item-
Eigentumsansprüche ignorieren und dürfen den Registry-Datensatz-Eigentümer nach Transfers nicht als aktuellen Eigentümer verwenden.

Die 24-Wort-GRAM-Wiederherstellungsphrase ist das einzige Benutzergeheimnis. Die PWA leitet den GRAM-Wallet-Schlüssel und die Messaging-Verschlüsselungs-/Signaturschlüssel deterministisch aus dieser Phrase ab. Der Profil-Export-/Import-Ablauf verarbeitet daher nur die Wiederherstellungsphrase; es gibt keine separate Messaging-Schlüssel-Sicherung.

## Replay- und Ablaufrichtlinie

Private Kapseln haben standardmäßig eine TTL von 24 Stunden und sind auf 30 Tage begrenzt. Die Live-/Off-Chain-Verifizierung von Kapselpaketen lehnt ab:

- Kapseln, die zu weit in der Zukunft erstellt wurden;
- abgelaufene Kapseln;
- TTLs über der Richtlinien-Obergrenze;
- doppelte Kapsel-Ids im vom Aufrufer bereitgestellten Replay-Cache.

Der Chain-Verlauf-Import ist anders: Wenn ein privater Eintrag bereits von CapsuleHub akzeptiert wurde und der Body aus dem
akzeptierten TON-Transaktionsverlauf oder dem lokalen verschlüsselten Cache wiederhergestellt wird, verifiziert die PWA die Eintrags-Hashes, Body-/Header-Zellen und die
Entschlüsselung, lehnt aber nicht allein deshalb ab, weil der Header-Ablauf in der Vergangenheit liegt. Andernfalls würde der aufbewahrte Chain-Verlauf
per Definition unlesbar werden.

Der Replay-Cache ist lokaler Zustand; Produktions-Clients können ihn mit IndexedDB oder einem anderen gerätelokalen Speicher untermauern. Kein Backend ist erforderlich.

## Kein-Backend-Regel

Die Verschlüsselungsebene erfordert kein Platho-Backend. Ein Server kann statische Dateien hosten, aber die private Zustellung wird durch den `CapsuleHub`-Chain-Zustand plus akzeptierte Veröffentlichungstransaktions-Bodies verankert: Der kompakte Eintrag beweist die Hashes, und der Body muss weiterhin aus dem TON-Nachrichtenverlauf oder dem lokalen verschlüsselten Cache des Benutzers verfügbar sein. Der Server empfängt niemals Klartext, private Schlüssel oder ein serverseitiges Sitzungsgeheimnis.

## Vault-Registrierungsentwurf

Der Client kann aus einem verifizierten signierten Bündel einen `RegisterMessagingKeys`-Entwurf ableiten:

- `enc_pubkey`: 32-Byte X25519-Öffentlicher-Schlüssel als uint256.
- `sign_pubkey`: 32-Byte Ed25519-Signatur-Öffentlicher-Schlüssel als uint256.
- `auth_pubkey`: separater 32-Byte Ed25519-Vault-Auth-Öffentlicher-Schlüssel als uint256.
- `pq_kem_pubkey_hash`: SHA-256 des ML-KEM-768-Öffentlichen-Schlüssels.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: kanonische Snake-Zelle, die genau 1184 ML-KEM-768-Öffentlicher-Schlüssel-Bytes enthält.
- `crypto_suite_mask`: `2` für `hybrid-v1`.

Dieser Entwurf wird durch den Aktivierungsablauf der eingebetteten Platho-Wallet eingereicht. Sobald die Wallet in Vault aktiviert ist, können andere aktivierte Benutzer ihren öffentlichen Messaging-Schlüsseldatensatz auflösen und private Kapseln an sie verschlüsseln.

## Vault-Schlüsseldatensatz-Bindung

Nachdem die Wallet Schlüssel On-Chain registriert hat, muss der Client Folgendes abrufen:

- die `UserState.current_key_id` der Wallet;
- für die eigene entsperrte Wallet des Benutzers, die `UserState.auth_pubkey`, die mit dem lokal abgeleiteten Vault-Auth-Öffentlichen-Schlüssel übereinstimmt;
- die `VaultKeyRecordView` für diese Schlüssel-Id.

> **clean-17.** Der in diesem Kapitel beschriebene Vault-Vertrag gehört zu clean-15. Unter clean-17 wird dieselbe Bindung aus dem EIGENEN KeyShard-Vertrag der Wallet gelesen (`web/key-shard-ton-rpc-provider.mjs`), dessen Adresse aus der Wallet abgeleitet ist — ein Eintrag kann also nur Schlüssel enthalten, die diese Wallet registriert hat. Die Provider-Brücke `web/vault-chain-provider.mjs` wurde mit dem Vault entfernt.

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Wenn kein Provider konfiguriert ist, bleibt die Vault-Bindung nicht verfügbar, anstatt einen lokalen Entwurf oder einen UI-Platzhalter zu akzeptieren. Eine Produktions-/statische Bereitstellung kann einen Provider auf `globalThis.plathoVaultChainProvider` installieren, der den bereitgestellten Vault über einen TON-API-Mirror oder einen Light-Client-kompatiblen Transport liest.

Die statische Laufzeit enthält `web/ton-rpc-transport.mjs` als das Produktions-Provider-Grundgerüst. Es kann TON-Center-v3-kompatible Endpunkte oder einen benutzerdefinierten `globalThis.plathoTonRpcTransport` umschließen, der vom Host-Bundle installiert wird. Die aktuelle PWA legt keinen integrierten RPC-Einstellungsbildschirm für Benutzer offen. Der Provider:

- kodiert `get_user(owner)`-Eigentümeradressen als `slice`-BoC-Stack-Items;
- ruft `get_key_record(current_key_id)` mit einem numerischen Stack-Item auf;
- dekodiert Getter-Stacks in `VaultUserView` und `VaultKeyRecordView`;
- schlägt fehlgeschlossen fehl, wenn der RPC-Transport, die Vault-Adresse, die Getter-Antwort oder die Schlüsseldatensatz-Bindung nicht verfügbar ist.

Der clientseitige Verifizierer prüft, dass der aktive Vault-Datensatz mit dem verifizierten signierten Bündel übereinstimmt:

- `owner_wallet` stimmt mit der eingebetteten Platho-Wallet-Adresse überein;
- `enc_pubkey` stimmt mit dem X25519-Öffentlichen-Schlüssel überein;
- `sign_pubkey` stimmt mit dem Signatur-Öffentlichen-Schlüssel des Bündels überein;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash` und `pq_kem_pubkey_len` stimmen mit dem ML-KEM-768-Material überein;
- `crypto_suite_mask` stimmt mit der Suite überein;
- `revoked_lt` ist null;
- die optionale `current_key_id` verweist auf die abgerufene Datensatz-Id.

Der Client erfindet die On-Chain-Schlüssel-Id nicht. Vault berechnet sie aus Eigentümeradresse, Schlüsselgeneration, Schlüsselfeldern, PQ-Länge und Suite. Der Client verifiziert stattdessen den abgerufenen Datensatz.

## Dauerhafter Replay-Speicher

Die PWA verwendet IndexedDB für den Replay-Schutz privater Kapseln, sofern verfügbar, mit einem Speicher-Fallback. Der Speicher behält Kapsel-Ids bis zu ihrem Kapselablauf und kürzt abgelaufene Einträge lokal. Dies ist gerätelokaler Zustand und erfordert keinen Server.

## Verschlüsselter lokaler Nachrichtenverlauf

Die PWA hat außerdem einen gerätelokalen verschlüsselten Nachrichtenverlaufsspeicher. Er verwendet einen nicht extrahierbaren WebCrypto-AES-GCM-256-Schlüssel, der in IndexedDB gespeichert ist, und speichert jeden Nachrichten-Body als authentifizierten Chiffretext. Der Datensatz-Header behält nur lokale Abfrage-Metadaten: Id, Thread-Id, Zeitstempel, Richtung und optionale Kapsel-Id.

Der Header ist als zusätzliche authentifizierte Daten (AAD) von AES-GCM gebunden. Das Ändern von Thread-Id, Zeitstempel, Richtung, Kapsel-Id, Nonce oder Chiffretext verhindert das Öffnen des Datensatzes. Wenn IndexedDB nicht verfügbar ist, fällt die App für diese Sitzung auf einen verschlüsselten In-Memory-Verlauf zurück und vermeidet das Schreiben von Klartext in den persistenten Browser-Speicher.
