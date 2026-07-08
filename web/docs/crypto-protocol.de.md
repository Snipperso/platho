# Platho Nachrichten-Krypto-Protokoll

Dieses Dokument beschreibt die clientseitige Nachrichtenverschlüsselung, die vom statischen PWA-Prototyp implementiert wird.

## Suiten

| Suite | Vertragswert | Zweck |
| --- | ---: | --- |
| `hybrid-v1` | `2` | Private Nachrichten mit X25519 plus ML-KEM-768 plus AES-GCM. |

Das V1-Privatveröffentlichen akzeptiert nur `CRYPTO_SUITE_HYBRID = 2`.

## Schlüsselbündel

Jede 24-Wort-GRAM-Wiederherstellungsphrase, die von der PWA erstellt oder importiert wird, leitet deterministisch eine Nachrichtenidentität mit einem Verschlüsselungsschlüsselpaar und einem Ed25519-Signaturschlüssel ab. Das öffentliche Verschlüsselungsschlüsselmaterial wird als öffentliches Schlüsselbündel exportiert:

- `keyId`: SHA-256-basierter Bezeichner über das öffentliche Schlüsselmaterial.
- `x25519PublicKey`: 32-Byte klassischer ECDH-Öffentlichkeitsschlüssel.
- `mlKem768PublicKey`: 1184-Byte ML-KEM-768-Öffentlichkeitsschlüssel für `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 des ML-KEM-768-Öffentlichkeitsschlüssels.
- `mlKem768PublicKeyLen`: immer `1184` für `hybrid-v1`.

Die PWA berechnet `keyId`, `mlKem768PublicKeyHash` und `mlKem768PublicKeyLen` vor der Verschlüsselung neu. Ein Bündel, das eine nicht übereinstimmende ID, Suite, Vertrags-Suite, Hash oder Länge angibt, wird abgelehnt.

Die Empfängersuche wird durch den On-Chain-`enc_pubkey`, `sign_pubkey` und die vollständige On-Chain-`pq_kem_pubkey`-Zelle definiert, die im aktiven Vault-Schlüsseldatensatz gespeichert ist. Hash und Länge verbleiben im Datensatz als kompakte Bindungsfelder, aber der vollständige ML-KEM-768-Öffentlichkeitsschlüssel ist das, was einem anderen Client tatsächlich erlaubt, eine `hybrid-v1`-Kapsel zu verschlüsseln.

## Signierte Bündel

Die PWA kann ein signiertes öffentliches Schlüsselbündel exportieren. Die signierte Nutzlast umfasst:

- Protokolldomäne `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- Ausstellungs- und optionale Ablauf-Zeitstempel;
- optionale Platzhalter für Besitzer-Wallet und Vault-Adresse;
- das öffentliche Verschlüsselungsbündel;
- den 32-Byte Ed25519-Signatur-Öffentlichkeitsschlüssel.

Die Signatur deckt die stabile JSON-Nutzlast ab und wird verifiziert, bevor dem Bündel vertraut wird. Dies verhindert stillschweigende lokale Bündelmanipulation und gibt dem Client den exakten `sign_pubkey`, den Vault in `KeyRecord` speichert.

Die PWA-`keyId` ist ein Client-Bündelbezeichner. Sie ersetzt nicht die `current_key_id` des Vault-Vertrags, die On-Chain aus Besitzeradresse, Schlüsselgeneration, Signaturschlüssel, Verschlüsselungsschlüssel, PQ-Hash, PQ-Länge und Krypto-Suite berechnet wird. Ein Produktions-Client muss das Bündel gegen den Vault-Schlüsseldatensatz verifizieren, bevor er ihm für eine Wallet-Identität vertraut.

Das signierte Bündel ist eine Selbstsignatur des Nachrichtenschlüssels. Der Wallet-Besitz wird durch die Vault-Aktivierung verankert: die eingebettete Platho-Wallet sendet `RegisterMessagingKeys`, spätere `ReplaceMessagingKeys`-Rotationen sind Vault-auth-signierte externe Nachrichten, und Empfänger verifizieren das signierte Bündel gegen den aktiven On-Chain-Schlüsseldatensatz für diese Wallet.

## Wallet-Besitz

Die Produktions-PWA verwendet keinen externen Wallet-Connector. Ein Benutzer erstellt oder importiert eine normale 24-Wort-GRAM-Wiederherstellungsphrase, und die PWA
leitet deterministisch den GRAM-Wallet-Schlüssel, einen separaten Vault-Auth-Schlüssel und die Nachrichten-Verschlüsselungs-/Signaturschlüssel aus dieser Phrase ab. Die Vault-
Aktivierung ist der Besitzanker: die eingebettete Wallet signiert und sendet `RegisterMessagingKeys` von derselben Wallet, die den On-Chain-Schlüsseldatensatz besitzt.
`ReplaceMessagingKeys` rotiert nur den öffentlichen Empfangs-/Nachrichtenschlüsseldatensatz; es rotiert nicht den Vault-Auth-Schlüssel.

Empfänger vertrauen einem Nachrichtenbündel erst, nachdem sie es gegen den aktiven Vault-Schlüsseldatensatz für diese Wallet geprüft haben:

- der Datensatzbesitzer ist die erwartete Wallet;
- `enc_pubkey` und `sign_pubkey` stimmen mit dem signierten Bündel überein;
- Hybrid-Datensätze legen die vollständige `pq_kem_pubkey`-Zelle offen, nicht nur ihren Hash;
- die dekodierten ML-KEM-768-Schlüsselbytes hashen zu `pq_kem_pubkey_hash`;
- die aktive `current_key_id` zeigt auf den verifizierten Schlüsseldatensatz.

Der Profil-Export-/Import-Ablauf verarbeitet die 24-Wort-GRAM-Wiederherstellungsphrase. Es gibt kein separates Nachrichtenschlüssel-Backup und keinen
externen Wallet-Verbindungsmodus im finalen v1.

## Kompaktes Byte-Layout

Private Kapsel-On-Chain-Zellen verwenden das finale binäre Layout `platho.byte-layout.v1`. Die PWA kann Kapseln für Export-/Teilen-UI in JSON einpacken, aber die Protokoll-Nutzlast ist binäre Bytes, nicht JSON und kein Off-Chain-Zeiger. `CapsuleHub` speichert kompakte authentifizierte Header/Indizes plus den Body-Hash; die verschlüsselte Body-Zelle bleibt im akzeptierten Veröffentlichungs-Transaktionsbody und wird aus der TON-Nachrichtenhistorie rekonstruiert und dann gegen die gespeicherten Hashes verifiziert.

Jede Veröffentlichung läuft über Vault als Vault-Guthaben-finanzierte signierte externe Nachricht. Der Benutzer finanziert zuerst sein internes
Vault-GRAM-Guthaben, dann signiert die PWA eine Veröffentlichungsanfrage mit dem aktiven `auth_pubkey`; ein Relayer kann die
externe Nachricht einreichen, ohne den Wallet-Schlüssel oder den Nachrichten-Signaturschlüssel zu halten. Die signierte Nutzlast ist domänengetrennt mit `VPB1`,
`deployment_manifest_hash`, der Ziel-Vault-Adresse und der Veröffentlichungsart vor Besitzer, Nonce, Maximalbelastung und Nutzlast.
Der GRAM-Wert, den CapsuleHub tatsächlich in einem ACK oder Bounce zurücksendet, wird dem internen Vault-GRAM-
Guthaben des Benutzers gutgeschrieben, begrenzt durch den nachverfolgten ausstehenden Veröffentlichungs-Erstattungsbetrag. Wenn das Vault-Guthaben oder der Chain-Zugriff nicht verfügbar ist, schlägt die
PWA geschlossen fehl und darf keine Veröffentlichungsaktionen anbieten.

Da `auth_pubkey` das Ausgeben von Vault-Guthaben autorisiert, autorisiert die Kompromittierung des lokalen Nachrichten-Signaturschlüssels allein keine
Vault-Veröffentlichungs-, Zahlungsprüfungs-, Benutzernamen- oder Avatar-Aktionen. Eine Kompromittierung des Nachrichten-Signaturschlüssels kann sich weiterhin auf nachrichtenbezogene
Identitätssignaturen auswirken, daher widerruft der Schlüsselaustausch den alten öffentlichen Empfangsschlüsseldatensatz für zukünftige eingehende Verschlüsselungsprüfungen.

Die PWA-Nachrichtenpreisgestaltung erfolgt pro Kapsel. Mit den aktuellen Reserven und ohne ATH-Rabatt sind exakte kanonische Beispiele 1-KiB-öffentliche Einträge ab `0.0337 GRAM` und `hybrid-v1`-1-KiB-private
Kapseln ab `0.0347 GRAM`; größere öffentliche oder private Größenklassen kosten mehr nach kanonischer Klasse. Dies umfasst die volle
Platho-Protokollgebühr von `0.01 GRAM`, die CapsuleHub-Kompaktindex-Speicherausstattung, die Vault-Lokalausführungsreserve und die
erwartete ACK-Erstattung. Getrennt davon fügt die PWA, wenn ihre konservative Gebührenschätzung höher ist als der enthaltene Netzwerkgebühren-
Freibetrag von `0.005 GRAM`,
den gerundeten Überschuss als Zuschlag hinzu. Vertragsaufrufe starten weiterhin von ihren kanonischen
erforderlichen Werten: Vault-Veröffentlichungen senden `maxCharge = canonical_max_charge + surcharge`. CapsuleHub hat keine direkte Benutzer-
Veröffentlichungs-ABI im finalen v1; jede Veröffentlichung ist Vault -> CapsuleHub. ATH-Rabatte gelten erst, nachdem der Vault-Aktivitäts-Airdrop
15.000.000 ATH verteilt hat; vor dieser Schwelle verwenden Nachrichtenprotokollgebühren die volle `0.01 GRAM`-Gebühr. Die PWA muss den finalen
Halte- und Nettokostenwert für die ausgewählte Inhaltsgröße anzeigen, bevor signiert wird.

Der Zuschlag ist eine signierte Netzwerk-/Speicher-Sicherheitsmarge, kein erstattbarer Gebührentopf. CapsuleHub akzeptiert Vault-Veröffentlichungen,
wenn der beigefügte Wert mindestens dem kanonischen erforderlichen Wert entspricht, aber ein erfolgreiches Veröffentlichungs-ACK liefert nur die feste
Veröffentlichungs-ACK-Reserve von `30,000,000` Nanotons (`0.030 GRAM`) zurück. Nachdem Vault dieses ACK verarbeitet hat, werden dem Benutzer ungefähr
`25,800,000` Nanotons im internen Vault-GRAM-Guthaben gutgeschrieben. Jeder signierte Zuschlag über den kanonischen erforderlichen Wert verbleibt in
CapsuleHub als Netzwerk-/Speicherreserve-Überschuss; er wird nicht an Vault zurückgegeben und nicht als
`accrued_plato_fee_ton` gezählt.

CapsuleHub schützt eine rohe GRAM-Reserve in Höhe von `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
Die Live-Reserve verwendet ungekürzte private/öffentliche Eintragszähler anstelle historischer `latest_id`-Zähler. Ein separater
berechtigungsfreier `SweepExcessReserve`-Aufruf kann nur den Überschuss über diesen geschützten Betrag hinaus zum FeeAccumulator als
`DepositProtocolFee` verschieben, wo er der normalen Treasury-/Buyback-Aufteilung folgt. Gewöhnliches Nachrichtensenden führt diesen
Sweep nicht durch. Wenn diese Sweep-Einzahlung zurückspringt, wird der zurückgegebene Betrag absichtlich als gedeckter
`accrued_plato_fee_ton` neu klassifiziert, sodass er über den normalen Gebühren-Flush-Pfad erneut versucht werden kann.
Normale partielle `FlushFees`-Aufrufe müssen mindestens der aktuellen öffentlichen Protokollgebühr (`0.010 GRAM`) entsprechen; ein kleinerer Betrag ist
nur gültig, wenn er der gesamte verbleibende angesammelte Topf ist, sodass rabattierter Staub trotzdem finalisiert werden kann.

CapsuleHub erfasst `created_at = now()` für jeden privaten und öffentlichen Eintrag. Die PWA verwendet diesen Vertrags-Zeitstempel für die Sortierung und für die begrenzte Transaktionshistorie-Suche; Client-Header-Zeitstempel bleiben authentifizierte Nutzlast-Metadaten, keine Entdeckungsautorität. Kompakte Eintragsmetadaten können nach dem konfigurierten Ein-Jahres-Aufbewahrungsfenster berechtigungsfrei gekürzt werden, während die Body-Verfügbarkeit von der Nachrichtenhistorie-Abdeckung des gewählten TON-Anbieters und dem lokalen verschlüsselten Cache des Benutzers abhängt.

Das Vault-ATH-Guthaben wird über explizite Benachrichtigungs-Ablauf-Buchhaltung gutgeschrieben, nicht durch Scannen des rohen offiziellen Wallet-Guthabens.
Der unterstützte Einzahlungspfad ist die `ATHTransferRequestWithNotify` der Benutzer-ATHWallet in Vault. Manueller gewöhnlicher ATH-
Transfer an die offizielle Vault-ATHWallet wird nicht unterstützt und darf nicht als Einzahlungsadresse angezeigt oder als
Vault-Ledger-Gutschrift behandelt werden. Die ATH-Abhebung aus Vault ist ein signierter externer Vault-Befehl. Ihre nachgelagerte ATHWallet-
Deploy-/Transfer-/ACK-Reserve wird aus dem internen Vault-GRAM-Guthaben des Benutzers bezahlt, und Vault schreibt nur
authentifizierten ACK-/Fehl-/Bounce-Wert zurück, den es erhält, abzüglich lokaler Erstattungsreserve und begrenzt durch den reservierten internen Wert.

Öffentliche Beiträge und Kommentare sind ein separates offenes Profil, keine privaten Kapseln ohne Verschlüsselung. Sie speichern eine kompakte
`PPH1`-öffentliche Header-Zelle plus eine rohe öffentliche Body-Zelle. Öffentlicher Body-Text und öffentliche Bild-/Avatar-Bytes verwenden dieselben
1-, 2-, 4-, 8-, 16- oder 32-KiB-öffentlichen Kapsel-Größenklassen wie das benutzersichtbare Body-Budget. Header-Metadaten reduzieren dieses
Body-Budget nie. Öffentliche Beiträge haben keine Postquanten-Option; öffentliche Texte verwenden das Produktlabel `from 0.0337 GRAM`,
während das aktuelle exakte öffentliche Basisbeispiel `0.0337 GRAM` plus dieselbe
Netzwerkgebühren-Zuschlagsregel ist. `kind = 1` ist ein öffentlicher Beitrag; das Bit 0 der Beitrags-`flags` schließt Kommentare für diesen Beitrag. `kind = 2` ist ein
einstufiger öffentlicher Kommentar mit `parent_entry_id:uint64` und `parent_body_hash:uint256` im Header. `kind = 3` ist ein
öffentlicher Bildbeitrag, `kind = 4` ist ein öffentlicher Bildkommentar, und `kind = 5` ist öffentliche Wallet-Avatar-Medien. Öffentliche Header tragen außerdem `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16` und `media_format:u8`; öffentliches v1 verwendet `media_format = 0` für Text und
`media_format = 1` für WebP-Bild-/Avatar-Teile. Öffentliche Beitrags-, Bildbeitrags- und Avatar-Header tragen außerdem
`profile_version:uint32` und `avatar_hash:uint256`; Null bedeutet kein Avatar-Zeiger. Langer öffentlicher Text oder Bilddaten werden aus mehreren Einträgen
erst rekonstruiert, nachdem jeder Eintrag die kleinste passende öffentliche Größenklasse bis zu 32 KiB verwendet hat. Die offizielle PWA komprimiert ausgewählte Bilder auf WebP-Ziele von 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, Standard) oder 64 KiB (`maximum`) vor dem Aufteilen. Es gibt keine Bearbeitungs-/Lösch-/Reaktions-/Moderations- oder Zählerebene in v1.

Wallet-Avatare sind kostenpflichtige Profilaktualisierungen, keine Off-Chain-Assets. Die Avatar-Bytes werden als `kind = 5`-öffentliche
CapsuleHub-Einträge veröffentlicht, dann erfasst `ProfileRegistry` den authentifizierten Wallet-Zeiger:
`version`, `avatar_hash`, erste `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count` und `media_format`. Leser
lösen den Profil-Zeiger aus dem signierten privaten Header oder öffentlichen Beitrags-Header auf, verifizieren den passenden ProfileRegistry-
Datensatz, holen die öffentlichen Avatar-Einträge aus CapsuleHub, verketten die Teile in Indexreihenfolge und verlangen, dass die rekonstruierten
WebP-Bytes zu `avatar_hash` hashen. Der lokale Avatar-Cache ist nur eine Beschleunigung; die Quelle der Wahrheit ist CapsuleHub plus
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

`size_class + crypto_suite` implizieren die Suite. `profile_version` und `avatar_hash` zeigen auf den Sender-Wallet-Avatar zum
Sendezeitpunkt und werden durch den Header-Hash plus die Sender-Signatur abgedeckt. `recipient_sign_pubkey` und Thread-Hashes werden
absichtlich nicht in öffentlichen Header-Zellen gespeichert. Thread-/Gruppierungsdaten gehören in die verschlüsselten Kapsel-Metadaten.

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

Der nutzbare Inhaltsbereich wird auf die ausgewählte 1-, 2-, 4-, 8-, 16- oder 32-KiB-private Kapselklasse aufgefüllt. Eine Nachricht mit 1 Byte, 500 Bytes oder 1024 Bytes nutzbaren Texts hat dieselbe verschlüsselte Klartextgröße in der 1-KiB-Klasse. Nachrichten über der ausgewählten Klasse werden in unabhängige Kapseln mit verschlüsselten `stream_id`-, `part_index`- und `part_count`-Metadaten aufgeteilt. Eine Kapsel mischt niemals unabhängige Text-/Bildeinheiten; der Empfänger setzt unabhängige Kapseln wieder zur ursprünglichen Nachricht zusammen.

Inhaltsarten:

- `1` Text: UTF-8-Bytes, bis zur ausgewählten nutzbaren privaten Kapselgröße.
- `2` Bild: komprimierte Bildbytes, bis zur ausgewählten nutzbaren privaten Kapselgröße; `media_format` ist `1` WebP, `2` AVIF, `3` JPEG oder `4` PNG.
- `3` Zahlungsscheck: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Zahlungsscheck-Bodies enthalten absichtlich kein `tx`, keine Aktivierungszeit und kein Ablaufdatum. Der Empfänger beansprucht per `intent_id + secret32`; wenn der Sender den Scheck bereits storniert hat oder er bereits beansprucht wurde, sagt die UI, dass der Scheck bereits beansprucht oder vom Sender storniert wurde.

Der verschlüsselte Body kann für Export/Teilen eingepackt werden als:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Für den finalen Kapsel-Body ist `chunk_total` immer `1`. `PLC1` ist nur Paket-/Export-Rahmung. Die akzeptierte Vault -> CapsuleHub-Veröffentlichungstransaktion trägt die zusammengesetzten `PLB1`-Body-Bytes in einer Snake-Zelle; CapsuleHub persistiert nur kompakte authentifizierte Metadaten und Hashes.

Finale v1-Privatgrenzen:

| Suite | Nutzbare Obergrenze pro Kapsel | Body-Bytes | Export-Chunk-Bytes |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

Die kanonische Quelle für dieses Layout ist `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM verwendet eine 12-Byte-Nonce und einen 16-Byte-Tag. Die Chiffretextlänge entspricht der Klartextlänge plus dem Tag.

Das kompakte Body-Präfix, `header0Hash` und `header1Hash` werden als zusätzliche authentifizierte Daten (AAD) von AES-GCM übergeben. Das Ändern binärer Routing-Header, der Suite, Nonce, des KEM-Chiffretexts, der Chunk-Bytes oder der Sender-Signatur lässt die Verifizierung oder Entschlüsselung fehlschlagen.

Vor der Entschlüsselung prüft der Client außerdem:

- die kompakte Body-Suite stimmt mit `header0` überein;
- die Empfänger-Schlüssel-ID stimmt mit `header0.recipientKeyId` überein;
- `hybrid-v1`-Bodies tragen tatsächlich einen 1088-Byte ML-KEM-Chiffretext;
- jeder Chunk hat dieselbe Suite, Nachrichten-ID und Chunk-Gesamtzahl.

## Schlüsselableitung

Für `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

Der Klartext wird mit AES-256-GCM verschlüsselt.

Die Implementierung lehnt reine Null-X25519-Shared-Secrets ab, um das Akzeptieren von Public Keys niedriger Ordnung zu vermeiden.

## Private verschlüsselte Kapseln

Der Client packt kompakte verschlüsselte Bodies vor der Veröffentlichung in eine private Kapsel ein. Eine private Kapsel hat:

- `header0`: den oben beschriebenen 140-Byte `PH0B`-Binär-Routing-Header.
- `header1`: den oben beschriebenen 30-Byte `PH1B`-Binär-Replay-Header.
- `body`: `platho.byte-layout.v1`-Chunk-Metadaten plus base64url-kodierte Binär-Chunks.
- `hashes`: TON-`Cell.hash()`-Werte für die exakten On-Chain-Zellen, die `header0`, `header1` und die verschlüsselten Body-Bytes enthalten.
- `chainCells`: base64-BOC-Nutzlasten mit `ton-snake-byte-cell.v1`; dies sind die in der Vault -> CapsuleHub-Veröffentlichungstransaktion akzeptierten und von `CapsuleHub` authentifizierten Zellen, kein Off-Chain-Zeiger.
- `senderSignature`: Ed25519-Signatur über die Kapsel-ID und alle drei Hashes.

Für `hybrid-v1` verwendet die Kapsel das Hybrid-Profil von CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

Der private Kapsel-Entwurf wird auf den Vault -> CapsuleHub-`PublishPrivateFromVault`-Body abgebildet, nachdem die signierte
`PublishPrivateFromVaultBalance`-Externalanfrage von Vault akzeptiert wurde:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Vault-Veröffentlichungsnachrichten tragen `protocol_fee_paid`, weil Vault die Rabattautorität für ATH-gedeckte Preisgestaltung ist.

Die nutzbare Nutzlast-Kapazität ist die Kapazität der verschlüsselten Body-Bytes, die tatsächlich in `body_cell` serialisiert und von `CapsuleHub` akzeptiert werden. Ein Hash ohne den passenden akzeptierten Veröffentlichungs-Transaktionsbody ist keine lesbare v1-Nachricht. Die lokale Historie ist nur Cache; sie definiert nicht die Zustellung in v1.

Für die Vault-External-Veröffentlichungssignierung bleibt die Hashes-Ref-Reihenfolge vertragskompatibel:

```text
body_hash || header_0_hash || header_1_hash
```

Der kompakte Body ist über AES-GCM-AAD an `header0Hash` und `header1Hash` gebunden. Das Ersetzen von Headern, Body-Chunks, Suite-Metadaten, der Sender-Signatur, des Kapsel-Kontexts oder der BOC-Nutzlast-Zellen lässt die Verifizierung fehlschlagen, bevor die Nachricht akzeptiert wird.

## Zustellungs-Quelle der Wahrheit

Akzeptierte v1-Privatnachrichten sind kompakte CapsuleHub-Einträge plus die verschlüsselten Nutzlast-Zellen, die vom akzeptierten Veröffentlichungs-Transaktionsbody getragen werden. Die PWA ruft diese Zellen aus der TON-Nachrichtenhistorie ab und verifiziert sie gegen CapsuleHub-Hashes vor der Entschlüsselung. Die Produktions-PWA bietet keinen manuellen Austausch von öffentlichem-Bündel- oder verschlüsseltem-Kapsel-JSON-Paket an.

Öffentliche Nachrichtenschlüssel werden in `Vault`-Schlüsseldatensätzen registriert. Ein Sender muss den Empfänger-Schlüsseldatensatz auflösen und verifizieren, bevor er eine private Kapsel verschlüsselt. Die lokale verschlüsselte Historie ist nur ein Geräte-Cache; sie definiert nicht die Zustellung.

Die `.ath`-Benutzernamen-Autorität hat zwei Teile. `UsernameRegistry.get_name_record` beweist, dass ein Name existiert und auf das
exakte `UsernameNFTItem` für diesen Namen zeigt. Der aktuelle Besitzer wird dann aus dem Zustand dieses Items gelesen. Transfers ändern den Item-
Besitzer; der Registry-Datensatz bleibt der Name-zu-Item-Anker. Das Item legt Standard-NFT-Daten und TEP-64-On-Chain-
Metadaten offen, einschließlich `name = <username>.ath`, ohne eine servergehostete Metadaten-URI. V1-Benutzernamen-Bytes sind absichtlich
wörtlich: führende, nachfolgende, aufeinanderfolgende und reine Trennzeichen-Namen sind gültig, wenn jedes Byte im erlaubten Satz `a-z`,
`0-9`, `_`, `-` liegt und die Länge 4..16 beträgt. Wenn ein ausstehender Mint nach
einem fehlenden Item-ACK veraltet, ist `PrunePendingUsernameMint` in v1 nicht-destruktiv: es beweist die veraltete Bedingung, löscht aber keinen
ausstehenden Zustand und erzeugt keine fällige Erstattung. Ein bereitgestelltes Item wird erst dann zu einem autoritativen Benutzernamen, nachdem die Registry den
passenden Namensdatensatz durch ein gültiges spätes ACK oder `ResendDeployedAck` finalisiert hat. Clients und Indexer müssen reine Item-
Besitzansprüche ignorieren und dürfen den Registry-Datensatzbesitzer nach Transfers nicht als aktuellen Besitzer verwenden.

Die 24-Wort-GRAM-Wiederherstellungsphrase ist das einzige Benutzergeheimnis. Die PWA leitet deterministisch den GRAM-Wallet-Schlüssel und die Nachrichten-Verschlüsselungs-/Signaturschlüssel aus dieser Phrase ab. Der Profil-Export-/Import-Ablauf verarbeitet daher nur die Wiederherstellungsphrase; es gibt kein separates Nachrichtenschlüssel-Backup.

## Replay- und Ablaufrichtlinie

Private Kapseln haben standardmäßig eine 24-Stunden-TTL und sind auf 30 Tage begrenzt. Die Live-/Off-Chain-Kapselpaket-Verifizierung lehnt ab:

- Kapseln, die zu weit in der Zukunft erstellt wurden;
- abgelaufene Kapseln;
- TTLs über der Richtlinien-Obergrenze;
- duplizierte Kapsel-IDs im vom Aufrufer bereitgestellten Replay-Cache.

Der Chain-Historie-Import ist anders: wenn ein privater Eintrag bereits von CapsuleHub akzeptiert wurde und der Body aus
akzeptierter TON-Transaktionshistorie oder dem lokalen verschlüsselten Cache wiederhergestellt wird, verifiziert die PWA die Eintrags-Hashes, Body-/Header-Zellen und
die Entschlüsselung, aber sie lehnt nicht allein deshalb ab, weil der Header-Ablauf in der Vergangenheit liegt. Andernfalls würde aufbewahrte Chain-Historie
konstruktionsbedingt unlesbar werden.

Der Replay-Cache ist lokaler Zustand; Produktions-Clients können ihn mit IndexedDB oder einem anderen gerätelokalen Speicher hinterlegen. Kein Backend ist erforderlich.

## Kein-Backend-Regel

Die Verschlüsselungsebene erfordert kein Platho-Backend. Ein Server kann statische Dateien hosten, aber die private Zustellung wird durch den `CapsuleHub`-Chain-Zustand plus akzeptierte Veröffentlichungs-Transaktionsbodies verankert: der kompakte Eintrag beweist die Hashes, und der Body muss weiterhin aus der TON-Nachrichtenhistorie oder dem lokalen verschlüsselten Cache des Benutzers verfügbar sein. Der Server erhält niemals Klartext, private Schlüssel oder ein serverseitiges Sitzungsgeheimnis.

## Vault-Registrierungsentwurf

Der Client kann einen `RegisterMessagingKeys`-Entwurf aus einem verifizierten signierten Bündel ableiten:

- `enc_pubkey`: 32-Byte X25519-Öffentlichkeitsschlüssel als uint256.
- `sign_pubkey`: 32-Byte Ed25519-Signatur-Öffentlichkeitsschlüssel als uint256.
- `auth_pubkey`: separater 32-Byte Ed25519-Vault-Auth-Öffentlichkeitsschlüssel als uint256.
- `pq_kem_pubkey_hash`: SHA-256 des ML-KEM-768-Öffentlichkeitsschlüssels.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: kanonische Snake-Zelle mit genau 1184 ML-KEM-768-Öffentlichkeitsschlüssel-Bytes.
- `crypto_suite_mask`: `2` für `hybrid-v1`.

Dieser Entwurf wird vom Aktivierungsablauf der eingebetteten Platho-Wallet eingereicht. Sobald die Wallet in Vault aktiviert ist, können andere aktivierte Benutzer ihren öffentlichen Nachrichtenschlüsseldatensatz auflösen und private Kapseln an sie verschlüsseln.

## Vault-Schlüsseldatensatz-Bindung

Nachdem die Wallet Schlüssel On-Chain registriert hat, muss der Client abrufen:

- die Wallet-`UserState.current_key_id`;
- für die eigene entsperrte Wallet des Benutzers `UserState.auth_pubkey`, die mit dem lokal abgeleiteten Vault-Auth-Öffentlichkeitsschlüssel übereinstimmt;
- die `VaultKeyRecordView` für diese Schlüssel-ID.

Die PWA legt dies als fehlgeschlossene Provider-Brücke in `web/vault-chain-provider.mjs` offen. Die Brücke erwartet einen Provider mit:

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Wenn kein Provider konfiguriert ist, bleibt die Vault-Bindung unverfügbar, anstatt einen lokalen Entwurf oder UI-Platzhalter zu akzeptieren. Ein Produktions-/statisches Deployment kann einen Provider auf `globalThis.plathoVaultChainProvider` installieren, der den bereitgestellten Vault über einen TON-API-Spiegel oder einen Light-Client-kompatiblen Transport liest.

Die statische Laufzeit enthält `web/vault-ton-rpc-provider.mjs` als Produktions-Provider-Gerüst. Es kann TON-Center-v3-kompatible Endpunkte oder einen benutzerdefinierten `globalThis.plathoTonRpcTransport` umschließen, der vom Host-Bundle installiert wird. Die aktuelle PWA legt keinen integrierten Benutzer-RPC-Einstellungsbildschirm offen; wenn die Dokumentation benutzergewählte RPC behauptet, muss diese UI existieren. Der Provider:

- kodiert `get_user(owner)`-Besitzeradressen als `slice`-BoC-Stack-Elemente;
- ruft `get_key_record(current_key_id)` mit einem numerischen Stack-Element auf;
- dekodiert Getter-Stacks in `VaultUserView` und `VaultKeyRecordView`;
- schlägt geschlossen fehl, wenn der RPC-Transport, die Vault-Adresse, die Getter-Antwort oder die Schlüsseldatensatz-Bindung unverfügbar ist.

Der clientseitige Verifizierer prüft, dass der aktive Vault-Datensatz mit dem verifizierten signierten Bündel übereinstimmt:

- `owner_wallet` stimmt mit der eingebetteten Platho-Wallet-Adresse überein;
- `enc_pubkey` stimmt mit dem X25519-Öffentlichkeitsschlüssel überein;
- `sign_pubkey` stimmt mit dem Bündel-Signatur-Öffentlichkeitsschlüssel überein;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash` und `pq_kem_pubkey_len` stimmen mit dem ML-KEM-768-Material überein;
- `crypto_suite_mask` stimmt mit der Suite überein;
- `revoked_lt` ist null;
- optional zeigt `current_key_id` auf die abgerufene Datensatz-ID.

Der Client erfindet nicht die On-Chain-Schlüssel-ID. Vault berechnet sie aus Besitzeradresse, Schlüsselgeneration, Schlüsselfeldern, PQ-Länge und Suite. Der Client verifiziert stattdessen den abgerufenen Datensatz.

## Dauerhafter Replay-Speicher

Die PWA verwendet IndexedDB für den privaten Kapsel-Replay-Schutz, sofern verfügbar, mit einem Speicher-Fallback. Der Speicher hält Kapsel-IDs bis zu ihrem Kapselablauf und kürzt abgelaufene Einträge lokal. Dies ist gerätelokaler Zustand und erfordert keinen Server.

## Verschlüsselte lokale Nachrichtenhistorie

Die PWA hat außerdem einen gerätelokalen verschlüsselten Nachrichtenhistorie-Speicher. Er verwendet einen nicht-extrahierbaren WebCrypto-AES-GCM-256-Schlüssel, der in IndexedDB gespeichert ist, und speichert jeden Nachrichten-Body als authentifizierten Chiffretext. Der Datensatz-Header behält nur lokale Abfrage-Metadaten: ID, Thread-ID, Zeitstempel, Richtung und optionale Kapsel-ID.

Der Header ist als zusätzliche authentifizierte Daten (AAD) von AES-GCM gebunden. Das Ändern von Thread-ID, Zeitstempel, Richtung, Kapsel-ID, Nonce oder Chiffretext verhindert das Öffnen des Datensatzes. Wenn IndexedDB nicht verfügbar ist, greift die App für diese Sitzung auf verschlüsselte In-Memory-Historie zurück und vermeidet das Schreiben von Klartext in den persistenten Browser-Speicher.

## Produktionsstatus

Der Mainnet-Release-Pfad verwendet eingebettete GRAM-Wallet-Ableitung, Vault-verankerte Nachrichtenschlüssel, signierte Bündelvalidierung, fehlgeschlossene Vault-Chain-Bindung, private Kapsel-Zellen-Hashing, Sender-Signaturen, dauerhaften Replay-Speicher, verschlüsselte lokale Nachrichtenhistorie und Wiederherstellungsphrasen-Export/-Import. Das Produktions-Deployment muss die PWA-Konfiguration an das verifizierte Mainnet-Manifest und die genehmigten TON-RPC-Provider gepinnt halten; eine unabhängige Krypto-Überprüfung bleibt für die langfristige Sicherheit empfohlen.
