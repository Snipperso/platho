# ATH-Whitepaper

## Der Token des Platho-Protokolls

ATH ist der Utility-Token von Platho. Er wird verwendet für Aktivitätsbelohnungen, Protokollgebühren-Rabatte nach dem Airdrop, `.ath`-Benutzernamen, Aktualisierungen des Profil-Avatars, Verkäufe zur Marktstabilisierung, Rückkauf und Burn.

ATH ist kein administrativer Token. Er verleiht nicht die Fähigkeit, Guthaben umzuschreiben, den Betrieb anzuhalten, neues Angebot zu prägen oder die Eigentumsregeln der Nutzer zu ändern. Seine Rolle besteht darin, die Anwendungsökonomie anzutreiben und die Nutzung von Platho mit der On-Chain-Buchführung zu verbinden.

Dieses Dokument beschreibt das ATH-Modell in Platho.

## Kernparameter

ATH hat ein festes Gesamtangebot:

```text
100,000,000 ATH
```

Der Referenzpreis zum Start ist:

```text
1 ATH = 0.001 GRAM
```

Die voll verwässerte Bewertung zum Start beträgt:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH startet mit einer Referenzkapitalisierung von `100,000 GRAM`.

## Festes Angebot

ATH wird von `ATHMaster` ausgegeben. Bei der Initialisierung legt `ATHMaster` das feste Gesamtangebot auf `100,000,000 ATH` fest.

Es gibt keine Mint-Funktion nach dem Genesis. `ATHMaster` implementiert kein administratives Prägen, Anhalten, Blacklisting, keine Transfersteuer, keinen erzwungenen Transfer und keine Rescue-Drain.

Der anfängliche Angebots-Deploy wird einmalig über `DeployTreasurySupply` durchgeführt. Er sendet das gesamte Angebot an das Treasury-ATH-Wallet. Der Genesis-Angebots-Deploy kann nicht wiederholt werden.

Das Gesamtangebot verringert sich nur durch Burn. `ATHMaster` akzeptiert einen Burn erst nach einer authentifizierten Burn-Benachrichtigung vom deterministischen ATH-Wallet der Eigentümeradresse. Nach der Verifizierung verringert `ATHMaster` das `total_supply` und sendet `ATHBurnFinalized`.

Der ATH-Burn ist eine echte Verringerung des Gesamtangebots, kein Transfer an eine ungenutzte Adresse.

## Angebotsverteilung

Das ATH-Angebot wird auf vier Kategorien verteilt:

| Kategorie | Anteil | Betrag |
| --- | ---: | ---: |
| Aktivitäts-Airdrop | 15% | 15,000,000 ATH |
| Anfängliche Liquidität | 15% | 15,000,000 ATH |
| Langfristiges Protokoll-Vesting | 10% | 10,000,000 ATH |
| Reserve zur Marktstabilisierung | 60% | 60,000,000 ATH |

Diese Verteilung definiert die ökonomische Struktur von Platho:

- 15% des Angebots werden vor dem Pool-Start über die Anwendungsaktivität an die Nutzer verteilt.
- 15% des Angebots werden für die anfängliche Liquidität verwendet.
- 10% des Angebots sind in einem unveränderlichen langfristigen Vesting gesperrt.
- 60% des Angebots werden in den MarketStabilitySeller eingezahlt und beim Genesis gesperrt, dann nach dem Preis-Freeze nach dem Pool in Tranchen oberhalb des Startpreises verkauft.

Der Aktivitäts-Airdrop und die langfristige Vesting-Reserve werden beim finalen Genesis durch die offiziellen ATH-Wallets von Vault und ATHVesting gedeckt, und der Release-Verifier prüft diese Guthaben vor dem Produktions-Release. Die Reserve zur Marktstabilisierung von `60,000,000 ATH` wird in den MarketStabilitySeller eingezahlt und beim finalen Genesis gesperrt, gedeckt durch dessen offizielles Verkäufer-ATH-Wallet, und der Release-Verifier prüft diese Deckung vor dem Produktions-Release. Die Reserve ist von Anfang an kapitalisiert, wird jedoch erst nach dem Pool-Start verkauft, wenn der einmalige, an Nachweise gebundene Preis-Freeze den Grundpreis der Tranche festlegt.

## Langfristiges Protokoll-Vesting

Die langfristige Vesting-Reserve beträgt:

```text
10,000,000 ATH
```

Sie wird von `ATHVesting` gehalten, nicht von einem veränderlichen Treasury-Topf. Der Vesting-Zeitplan ist im Vertrag festgelegt:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Jeder kann eine Auszahlung auslösen, sobald ATH gevestet ist, aber der Begünstigte ist unveränderlich. Der Vertrag hat keine Beschleunigung, keine Änderung des Begünstigten, kein Anhalten, keinen Admin-Sweep, keine Rescue-Drain und keine Funktion zur diskretionären Freigabe.

Beim finalen Genesis muss das offizielle `ATHWallet(owner = ATHVesting, master = ATHMaster)` genau `10,000,000 ATH` enthalten. Der Verifier verlangt außerdem null beanspruchtes ATH, die Leerlaufphase und keinen ausstehenden Transfer vor dem Start.

Diese Reserve ist bewusst langsam. Sie schafft einen langen Horizont für die Protokollentwicklung, ohne beim Start einen liquiden Topf von 10M ATH über dem Markt zu platzieren.

## Aktivitäts-Airdrop

Der Aktivitäts-Airdrop beträgt:

```text
15,000,000 ATH
```

Belohnung pro erfolgreicher Veröffentlichung:

```text
10 ATH
```

Die Belohnung wird dem internen ATH-Guthaben des Nutzers in Vault nach einer erfolgreichen Veröffentlichung gutgeschrieben. Eine erfolgreiche Veröffentlichung bedeutet, dass Vault die Payload an CapsuleHub gesendet hat, CapsuleHub den Eintrag akzeptiert hat und Vault die Bestätigung erhalten hat.

Fehlgeschlagene Veröffentlichungsversuche erzeugen keine Aktivitätsbelohnungen.

Belohnungsbuchhaltung:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Wenn der verbleibende Airdrop-Topf unter 10 ATH liegt, wird der verbleibende Betrag gutgeschrieben. Sobald der Topf erschöpft ist, stoppen neue Aktivitätsbelohnungen.

Der Aktivitäts-Airdrop wird in Vault verbucht und durch das vorfinanzierte offizielle Vault-ATH-Wallet gedeckt.

Vault-ATH-Einzahlungen werden nur über den Transfer-mit-Benachrichtigung-Ablauf des ATHWallet des Nutzers
(`ATHTransferRequestWithNotify`) in Vault unterstützt. Ein manueller gewöhnlicher ATH-Transfer an das offizielle Vault-ATHWallet wird
nicht unterstützt: Er kann das rohe Guthaben des offiziellen Wallets erhöhen, erzeugt jedoch kein `Vault.user.ath_balance` und darf
von der PWA nicht als Einzahlungsweg angezeigt werden.

Vault-ATH-Abhebungen sind signierte externe Vault-Befehle. Die nachgelagerte Reserve für ATHWallet-Deploy, -Transfer, -Speicherung und
-ACK-Ausführung wird aus dem internen Vault-GRAM-Guthaben des Nutzers bezahlt. Vault schreibt nur authentifizierten
ACK-/Fehl-/Bounce-Wert zurück, den es empfängt, abzüglich der lokalen Rückerstattungsreserve und begrenzt durch den reservierten internen Wert.

## Aktivitätspreis

Nachrichten beginnen beim aktuellen öffentlichen Grundpreis:

```text
from 0.0337 GRAM
```

Aktuelle exakte kanonische Beispiele vor dem ATH-Rabatt sind:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Für eine erfolgreiche Veröffentlichung erhält der Nutzer:

```text
10 ATH
```

Zum Referenzpreis beim Start:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Dies koppelt die frühe ATH-Verteilung an die tatsächliche Anwendungsnutzung. Die Belohnung ist ein Aktivitätsbonus, keine Rückerstattung, kein Cashback,
kein Rabatt und kein Versprechen, dass ATH die GRAM-Kosten einer Veröffentlichung ausgleicht. Der Referenzwert von `10 ATH` zum Start kann
niedriger sein als die GRAM-Kosten der Kapsel, und das ist beabsichtigt: Nutzer erhalten frühen Netzwerkbesitz für die tatsächliche Nutzung,
keine garantierte Erstattung.

Kapsel-Preisgestaltung: Öffentliche 1-KiB-Beiträge beginnen bei `0.0337 GRAM` und hybride private 1-KiB-Kapseln bei `0.0347 GRAM`. Größere öffentliche oder private Kapselblöcke kosten mehr, weil der gewählte 1-, 2-, 4-, 8-, 16- oder 32-KiB-
Body die Ausführungs- und Speicherreserve von Vault/CapsuleHub ändert. Die Belohnung bleibt `10 ATH` pro erfolgreich finalisierter
Kapsel, unabhängig von der Kapselgröße.

Private Veröffentlichung verwendet standardmäßig das hybride Sicherheitsprofil: X25519 + ML-KEM-768 + AES-GCM. Es gibt keinen günstigeren klassischen Modus für private Nachrichten.

ATH kann nach dem Bestehen des offiziellen Pools über oder unter dem Referenzpreis zum Start gehandelt werden. Die Aktivitätsbelohnung ist keine Kapitalrendite, keine Gewinnerwartung und keine Preisgarantie.

## Protokollgebühr und Nutzerpreis

Innerhalb von Vault ist die Protokollgebühr getrennt von den vollen, dem Nutzer gegenüber ausgewiesenen Kosten.

Protokollgebühr:

| Veröffentlichungstyp | Protokollgebühr |
| --- | ---: |
| Öffentlicher Beitrag | 0.010 GRAM |
| Hybride private Nachricht | 0.010 GRAM |

Der dem Nutzer gegenüber ausgewiesene Preis umfasst die Protokollgebühr, die Speicher-Endowment für kompakten Index/Header, die lokale Vault-Ausführungsreserve und die erwartete ACK-Rückerstattung:

| Veröffentlichungstyp | Nutzerpreis |
| --- | ---: |
| Öffentlich (ab) | from 0.0337 GRAM |
| Aktuelles exaktes Beispiel für öffentlichen Beitrag | 0.0337 GRAM |
| Aktuelles exaktes Beispiel für hybride private 1 KiB | 0.0347 GRAM |

Wenn die PWA eine höhere konservative Netzwerkschätzung erhält, addiert sie den geschätzten Überschuss zur kanonischen Maximalgebühr, aufgerundet auf saubere `0.001 GRAM`-Schritte. ATH-Rabatte gelten für die Protokollgebühr, nicht für Netzwerkkosten oder Speicherreserven. Dieser Aufschlag ist ein signierter Sicherheitsspielraum: Wenn CapsuleHub die Veröffentlichung akzeptiert, gibt der Erfolgs-ACK nur die feste Veröffentlichungs-ACK-Reserve von `30,000,000` Nanotons (`0.030 GRAM`) zurück. Nachdem Vault diesen ACK verarbeitet hat, werden dem Nutzer rund `25,800,000` Nanotons im internen Vault-GRAM-Guthaben gutgeschrieben. Der Teil oberhalb des kanonischen erforderlichen Werts verbleibt in CapsuleHub als Netzwerk-/Speicherreserve-Überschuss. Er wird nicht an Vault zurückgegeben und zum Veröffentlichungszeitpunkt nicht als `accrued_plato_fee_ton` gezählt. Nur der rohe Überschuss oberhalb der geschützten Reserve von CapsuleHub kann später erlaubnisfrei zum FeeAccumulator gefegt werden, wo er der normalen Treasury-/Buyback-Buchhaltung folgt. CapsuleHub speichert kompakte authentifizierte Eintragsmetadaten und den Body-Hash; der schwere Body wird aus der akzeptierten Veröffentlichungs-Transaktionshistorie wiederhergestellt und lokal verifiziert.

## ATH-Rabatte

ATH reduziert die Nachrichten-Protokollgebühren, nachdem der Aktivitäts-Airdrop vollständig verteilt wurde.

Rabatte werden nur freigeschaltet, wenn der verbleibende Aktivitäts-Airdrop beträgt:

```text
airdrop_remaining_ath == 0 ATH
```

Vor diesem Punkt wird die Protokollgebühr vollständig bezahlt.

Schwelle für den vollen Rabatt:

```text
10,000 ATH
```

Wenn das interne ATH-Guthaben des Nutzers in Vault mindestens `10,000 ATH` beträgt, erreicht der Nutzer die volle Protokollgebühren-Rabattstufe für die Platho-Gebührenkomponente. Netzwerkkosten und Speicherreserven werden weiterhin bezahlt.

Wenn das Guthaben unter `10,000 ATH` liegt, verringert sich die Gebühr linear:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Die Berechnung rundet auf. Mit den aktuellen Konstanten beträgt die volle Protokollgebühr `0.010 GRAM` (`10,000,000 nanotons`) sowohl für öffentliche als auch für private Kapseln, und die maximale Reduktion beträgt `0.010 GRAM` pro Kapsel.

## Pool-Start

Der ATH/GRAM-Pool startet, nachdem der vollständige Aktivitäts-Airdrop von `15,000,000 ATH` verteilt wurde.

Die Startsequenz lautet:

1. Nutzer erhalten ATH durch die tatsächliche Nutzung von Platho.
2. Der vollständige Aktivitäts-Airdrop wird verteilt.
3. ATH-Rabatte werden freigeschaltet.
4. Der ATH/GRAM-Pool startet.
5. Nachweise für die Route nach dem Pool und die Preisnachweise werden eingefroren.
6. Der Buyback-Split wird aktiviert.

Der Pool startet zum Referenzpreis:

```text
1 ATH = 0.001 GRAM
```

Zuteilung der anfänglichen Liquidität:

```text
15,000,000 ATH
```

GRAM-Seite zum Startpreis:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Vor dem Pool-Start eingenommene Protokollgebühren finanzieren die gesamte GRAM-Seite der anfänglichen Liquidität. Dies ist Teil des
Start-Bootstraps und verwandelt Aktivitätsbelohnungen nicht in einen GRAM-denominierten Anspruch.

Der Pool startet um einen Token herum, der bereits durch die Anwendungsnutzung verteilt wurde. Dies trennt ATH von einem leeren Listing ohne Nutzerbasis.

## FeeAccumulator

GRAM-Protokollgebühren werden im `FeeAccumulator` gesammelt.

Bevor der Buyback-Split aktiviert ist, fließen alle angesammelten GRAM in den Treasury-Topf:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` wächst nicht, bevor der Split aktiviert ist.

Nach `EnableBuybackSplit` wird das angesammelte GRAM aufgeteilt:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Wenn der Betrag in Nanotons ungerade ist, verbleibt der Rest auf der Buyback-Seite:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` ist eine einseitige Aktion, die vom unveränderlichen Treasury-Empfänger nach dem Pool-Start und dem Einfrieren der Buyback-Route
ausgeführt wird. Dies ist eine echte einmalige Befugnis: Sie kann keine Gelder stehlen, nicht anhalten, nicht retten und keine Adressen ändern, verändert jedoch dauerhaft
die FeeAccumulator-Ökonomie von der Bootstrap-Ansammlung ausschließlich im Treasury zum 50/50-Treasury-/Buyback-Split. Sie wird
erst aktiviert, nachdem der Release-Preflight bestanden wurde.

Plathos Release-Befugnisse sind bewusst eng gefasst und größtenteils einmalig. Sie existieren dennoch und müssen ehrlich benannt werden:
Der Treasury-Eigentümer deployt das anfängliche ATH-Angebot einmalig; der Genesis-Controller führt die Vor-Seal-Bindung und Versiegelung durch;
der BuybackBurn-Start-Controller friert die Route nach dem Pool einmalig ein; der MarketStabilitySeller-Preis-Freeze wird
einmalig von dessen Start-Controller durchgeführt; und der FeeAccumulator-Treasury-Empfänger aktiviert den einseitigen Buyback-Split nach dem Preflight. Keine dieser
Rollen ist ein Rescue-, Anhalte-, Upgrade-, Admin-Drain- oder willkürlicher Guthaben-Kontroll-Mechanismus.

## Rückkauf und Burn

Der Rückkauf wird über `FeeAccumulator` und `BuybackBurn` ausgeführt.

BuybackBurn akzeptiert nur ein vollständiges Ausführungs-Envelope:

```text
51.05 GRAM
```

Envelope-Struktur:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

Rohe `50 GRAM` sind kein gültiger Rückkauf-Chunk. Der Rückkauf wird nur als vollständiges Routen-Envelope akzeptiert.

Nach dem Einfrieren der Route führt BuybackBurn einen Rückkauf wie folgt aus:

1. Akzeptiert `51.05 GRAM` nur vom gebundenen FeeAccumulator.
2. Erfasst den Betrag in `reserve_due_ton`.
3. Bei `ExecuteBuybackChunk` verbraucht es ein Envelope.
4. Verwendet das eingefrorene Angebot und das eingefrorene minOut.
5. Setzt die STON.fi-Deadline intern.
6. Sendet die Route über das eingefrorene pTON-Wallet.
7. Akzeptiert ATH nur über das offizielle BuybackBurn-ATH-Wallet.
8. Verifiziert, dass das Quell-Wallet mit dem eingefrorenen STON.fi-Pool übereinstimmt.
9. Sendet das empfangene ATH über das offizielle ATH-Wallet zum Burn.
10. Schließt den Zyklus erst nach `ATHBurnFinalized` von `ATHMaster` ab.

Der Erfolg des Rückkaufs wird nicht durch eine Router-Nachricht, eine ausgehende Burn-Anforderung oder eine ATHWallet-Burn-Benachrichtigung definiert. Er wird
nur dann definiert, wenn BuybackBurn ein authentifiziertes `ATHBurnFinalized` von ATHMaster empfängt. Bis diese Finalisierung eintrifft, muss
BuybackBurn weiterhin als ausstehender Burn- oder Retry-Zustand behandelt werden; Dashboards und Indexer dürfen das ATH nicht als
verbrannt zählen, nur weil ein Burn-Versuch gesendet wurde.

Wenn der Burn nicht finalisiert wird, geht das empfangene ATH in die Retry-Fälligkeit über. `RetryAthBurnDue` verbrennt den vollen Retry-Fälligkeitsbetrag.

## Benutzernamen-Gebühren

Die Registrierung eines `.ath`-Benutzernamens wird in ATH über das offizielle UsernameRegistry-ATH-Wallet bezahlt.

Preise:

| Namenslänge | Preis |
| ---: | ---: |
| 4 Zeichen | 10,000 ATH |
| 5 Zeichen | 1,000 ATH |
| 6+ Zeichen | 100 ATH |

UsernameRegistry akzeptiert nur den exakten Preis. Unter- und Überzahlung erzeugen keinen Namen.

Ein akzeptierter Mint durchläuft den ausstehenden Zustand und deployt `UsernameNFTItem`. Vor der Item-Bestätigung wird die Zahlung nicht als Umsatz anerkannt. Nach der Item-Bestätigung wird der Betrag aufgeteilt:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Der Benutzernamen-Mint wird von Vault finanziert. Ablehnungen wegen ungültigen Benutzernamens, falschen Preises oder doppelten Namens bouncen über den
offiziellen ATH-Wallet-Benachrichtigungsweg, sodass Vault das interne ATH des Nutzers wiederherstellen kann. UsernameRegistry unterhält im aktuellen Vault-finanzierten Ablauf keinen
direkten externen Benutzernamen-Rückerstattungstopf.

ATH aus einem Benutzernamen-Mint wird erst zu Protokoll-Umsatz, nachdem der Deploy des entsprechenden Items bestätigt wurde.

Die Benutzernamen-Autorität ist bewusst aufgeteilt: `UsernameRegistry` verankert den Namen an genau einem `UsernameNFTItem`, und der
Item-Zustand trägt den aktuellen Eigentümer. Transfers des Items übertragen den Benutzernamen. Das Item stellt Standard-NFT-Daten
und TEP-64-On-Chain-Metadaten bereit, einschließlich `name = <username>.ath`; es ist für Metadaten nicht auf einen Platho-Server angewiesen.
Benutzernamen-Bytes sind literal und nicht anzeige-normalisiert: Namen mit führenden, nachfolgenden, aufeinanderfolgenden und ausschließlich aus Trennzeichen bestehenden Zeichen sind
gültig, wenn jedes Byte im erlaubten Satz `a-z`, `0-9`, `_`, `-` liegt und die Länge 4..16 beträgt.
Wenn der Item-Deploy versucht wurde, aber der Item-ACK die Registry nie erreichte, ist `PrunePendingUsernameMint` bewusst
nicht-destruktiv: Es errät keinen Fehlschlag, löscht keinen ausstehenden Zustand und erzeugt keine Rückerstattungsfälligkeit. Der Wiederherstellungsweg ist ein später
`UsernameItemDeployedAck` oder `UsernameNFTItem.ResendDeployedAck`, sodass ein initialisiertes Item dennoch autoritativ werden kann.
Wenn der Item-Deploy tatsächlich bounct, fordert die Registry das offizielle ATH-Wallet auf, die ausstehende Benachrichtigung zu erstatten.
Ein deploytes `UsernameNFTItem` ohne `UsernameRegistry.name_records[name_hash]`, das auf genau dieses Item zeigt, ist
nicht-autoritativ: Clients, Indexer und UI dürfen das Item allein nicht als Eigentum am `.ath`-Namen behandeln und dürfen
den Registry-Eintrags-Eigentümer nach Transfers nicht als aktuellen Eigentümer verwenden.

## Profil-Avatar-Gebühren

Kosten für die Aktualisierung des Profil-Avatars:

```text
100 ATH
```

Profil-Avatar-Aktualisierungen werden von Vault finanziert. Die PWA sendet `SetProfileAvatarFromVaultBalance` an Vault; Vault bezahlt über seinen offiziellen ATH-Wallet-Benachrichtigungsweg in das offizielle ProfileRegistry-ATH-Wallet. Eine direkte Avatar-Zahlung vom Nutzer-Wallet wird nicht unterstützt.

ProfileRegistry akzeptiert die Aktualisierung nur, wenn alle Bedingungen erfüllt sind:

- Der Betrag beträgt genau `100 ATH`;
- der Absender ist das offizielle ProfileRegistry-ATH-Wallet;
- das Zahler-Wallet ist das gebundene Vault;
- das Eigentümer-Wallet befindet sich in der Basechain;
- der Avatar-Hash ist nicht null;
- die Stream-ID ist nicht null;
- die Teileanzahl liegt zwischen 1 und 16;
- das Medienformat ist WebP.

Eine akzeptierte Aktualisierung erzeugt eine neue Avatar-Version und teilt die Gebühr auf:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Eine abgelehnte Avatar-Benachrichtigung wird über den ATHWallet-Benachrichtigungs-Bounce-Weg erstattet. ProfileRegistry erzeugt keinen separaten Rückerstattungstopf für fehlerhafte Avatar-Aktualisierungen.

ProfileRegistry speichert den authentifizierten Avatar-Zeiger, nicht die permanenten Bild-Bytes. Die PWA muss die Avatar-WebP-Daten aus öffentlichen CapsuleHub-Einträgen oder dem lokalen Cache rekonstruieren und die Bytes gegen den gespeicherten `avatar_hash` verifizieren; fehlende oder gelöschte Historie wird als nicht verfügbar angezeigt.

## Market Stability Seller

MarketStabilitySeller ist eine öffentliche Vertragsreserve, die ATH nach dem offiziellen Pool-Start verteilt:

```text
60,000,000 ATH
```

Ihr Zweck ist es, die frühe Marktverzerrung durch dünne Liquidität zu verringern. Beim Start kann ein kleiner Pool von einer kleinen Gruppe früher Käufer stark bewegt werden. Wenn das geschieht, können Nutzer, die ATH für tatsächliche Platho-Aktionen benötigen, gezwungen werden, in eine künstliche Preisspitze hineinzukaufen.

MarketStabilitySeller schafft eine transparente Angebots-Treppe oberhalb des Startpreises. Er verkauft ATH in Tranchen fester Größe. Jede nächste Tranche ist teurer als die vorherige, und jede Tranche hat ein hartes Größenlimit. Nach dem einmaligen, an Nachweise gebundenen Preis-Freeze ist der Tranchen-Zeitplan deterministisch und kann vom Team nicht manuell geändert werden.

Wenn frühe Spekulanten versuchen, eine große Menge ATH aufzunehmen, kaufen sie von der öffentlichen Reserve zu steigenden Tranchenpreisen, anstatt die gesamte günstige Liquidität aus einem dünnen Pool zu ziehen und sie an Nutzer weiterzuverkaufen. Wenn gewöhnliche Nutzer ATH für Platho benötigen, können sie es zu einem bekannten öffentlichen Tranchenpreis kaufen, ohne einen kleinen Pool mit einer einzigen Nachfragewelle vertikal zu treiben.

Die Reserve wirft keine Token auf den Markt. Sie verkauft nicht von selbst und erzeugt keinen Verkaufsdruck ohne Nachfrage. Ein Verkauf findet nur statt, wenn ein Käufer freiwillig aus der aktuellen Tranche kauft. Wenn es keine Nachfrage gibt, bleibt die Reserve untätig.

Der On-Chain-Nutzen von ATH ist spezifisch:

- Die Registrierung eines `.ath`-Benutzernamens wird in ATH über UsernameRegistry bezahlt;
- Aktualisierungen des Profil-Avatar-Zeigers werden in ATH über ProfileRegistry bezahlt;
- ATH im internen Vault-Guthaben des Nutzers reduziert die Protokollgebühr für Vault-Veröffentlichungen nach dem Gate der Aktivitätsverteilung;
- akzeptierte Benutzernamen- und Avatar-Gebühren erzeugen Treasury-Fälligkeit und Burn-Fälligkeit;
- BuybackBurn kauft ATH mit GRAM-Protokollgebühren und verbrennt das empfangene ATH über ATHMaster.

Vault-Veröffentlichungen werden in GRAM bezahlt. ATH bezahlt nicht die gesamte Veröffentlichungs-Transaktion. Es reduziert die Protokollgebühren-Komponente, nachdem das Rabatt-Gate geöffnet ist.

Dies koppelt die ATH-Nachfrage an konkrete Protokoll-Aktionen: `.ath`-Namen, Avatar-Aktualisierungen, Vault-Protokollgebühren-Rabatte nach dem Airdrop und Buyback-/Burn-Druck. MarketStabilitySeller erweitert das verfügbare Angebot nur, während Käufer die nächste Tranche nehmen, sodass der frühe Zugang öffentlich und deterministisch ist, anstatt von einem dünnen Pool dominiert zu werden.

Die Reserve wird erst nach dem Preis-Freeze nach dem Pool verkauft.

Der Preis-Freeze ist eine echte einmalige Start-Befugnis. Er setzt den Grundpreis der Tranche einmalig aus den Nachweisen des Pool-Starts, dann wird der Hash des Start-Controllers gelöscht. Danach kann MarketStabilitySeller keine Gelder stehlen, keine Verkäufe anhalten, keine Guthaben retten, keine Käufer übergehen und den Preis-Zeitplan nicht verändern.

MarketStabilitySeller wird beim finalen Genesis mit der vollständigen Reserve von `60,000,000 ATH` kapitalisiert, finanziert über den
authentifizierten Reserve-Finanzierer-Ablauf in das offizielle Verkäufer-ATH-Wallet, bis zur harten Obergrenze von `60,000,000 ATH`.
`mainnet:genesis:verify` prüft, dass der Verkäufer die vollständige Reserve trägt und dass die Deckung seines offiziellen Verkäufer-ATH-Wallets
mindestens `60,000,000 ATH` vor dem Produktions-Release beträgt. Ein unaufgeforderter gewöhnlicher ATH-Transfer in das offizielle Verkäufer-ATH-
Wallet erhöht die verbuchte Reserve nicht, erweitert das verkäufliche Angebot nicht und kann stecken bleiben; ein Wallet-Guthaben
oberhalb von `60,000,000 ATH` wird als Warnung behandelt, nicht als zusätzliche Reserve.

Der Verkauf ist ein separater Schritt nach dem Pool. Die Reserve wird erst nach dem Pool-Start verkauft, wenn der einmalige, an Nachweise gebundene
Preis-Freeze den Grundpreis der Tranche festlegt; von da an ist der Tranchen-Zeitplan deterministisch und kann vom Team nicht manuell
geändert werden.

Die Reserve ist in 20 Tranchen aufgeteilt:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Jede Tranche hat einen Multiplikator:

```text
x2, x3, x4, ..., x21
```

Dies schafft eine glatte Preis-Treppe. Wenn die Popularität des Projekts wächst, erhält der Markt zusätzliches ATH-Angebot, aber jede nächste Tranche ist teurer als die vorherige. Frühe Nachfrage trifft nicht sofort auf einen dünnen Pool, und das Preiswachstum wird nicht zu einer vertikalen Wand, die den Utility-Token unbequem in der Nutzung macht.

Kaufformel:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` wird nach dem Pool-Start eingefroren und stimmt exakt mit dem x1-Preisnachweis überein.

Zum Startpreis `1 ATH = 0.001 GRAM` beträgt der x1-Preis einer Tranche:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Daher:

| Tranche | Multiplikator | Preis für 3M ATH | Preis pro 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Ein einzelner Kauf kann keine Tranchengrenze überschreiten. Dies verhindert, ATH aus der nächsten Tranche zum Preis der vorherigen Tranche zu kaufen.

GRAM-Umsatz wird erst anerkannt, nachdem ATH an den Käufer geliefert wurde. Wenn der ATH-Transfer fehlschlägt oder bounct, wird die Reserve wiederhergestellt, der Käufer erhält das gezahlte GRAM-Prinzipal zurück, und die Treasury-Fälligkeit erhöht sich nicht.

Nachdem die letzte x21-Tranche verkauft ist, reguliert MarketStabilitySeller den ATH-Preis nicht mehr. Ab diesem Punkt wird der Preis vollständig vom Markt bestimmt: Liquidität, verfügbares Angebot, Nachfrage nach `.ath`-Namen, Avatar-Aktualisierungen, Vault-Protokollgebühren-Rabatte nach dem Airdrop und Buyback-/Burn-Druck.

Selbst beim x21-Schritt bleibt die Referenzbewertung im Verhältnis zum Utility-Modell moderat:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Beim x21-Schritt hat MarketStabilitySeller seine programmierte Reserve-Freigabe abgeschlossen. Danach wird der ATH-Preis vollständig vom Markt bestimmt, durch Liquidität, Nutzungsnachfrage, verfügbares Angebot und Buyback-/Burn-Druck. Die einzige verbleibende Protokoll-Zuteilung ist der langsame langfristige Vesting-Zeitplan, begrenzt auf `100,000 ATH` pro Jahr.

## Treasury- und Burn-Töpfe

UsernameRegistry und ProfileRegistry verwenden dasselbe ATH-Gebühren-Split-Modell:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Der Treasury-Fälligkeits-Flush sendet ATH über das offizielle ATH-Wallet an den Treasury-Empfänger.

Der Burn-Fälligkeits-Flush sendet eine ATH-Burn-Anforderung über das offizielle ATH-Wallet. Das Angebot verringert sich erst nach der Burn-Finalisierung in ATHMaster.

Fehl- und Bounce-Wege stellen die Fälligkeitstöpfe wieder her. Die Buchhaltung wird beibehalten, bis der nachgelagerte Transfer oder Burn abgeschlossen ist.

## ATHWallet-Buchhaltung

ATH-Guthaben leben in deterministischen ATHWallet-Verträgen.

ATHWallet verarbeitet:

- Genesis-Angebots-Gutschrift;
- gewöhnlichen Transfer;
- Transfer mit Benachrichtigung;
- Benutzernamen-Mint-Benachrichtigung;
- Profil-Avatar-Benachrichtigung;
- Burn-Anforderung;
- Benachrichtigungsbestätigung;
- Bereinigung veralteter Benachrichtigungen;
- Bounce-/Fehl-Wiederherstellung.

Verträge, die ATH als Zahlung akzeptieren, akzeptieren keine direkten Nachrichten von beliebigen Adressen. Sie akzeptieren Benachrichtigungen nur von ihrem offiziellen ATHWallet. Die Authentifizierung des Quell-Wallets erfolgt innerhalb von ATHWallet durch deterministische Wallet-Ableitung.

ATH stellt TEP-74-ähnliche Transfer-Einstiegspunkte für generisches Jetton-Tooling bereit, aber Platho-Protokoll-Aktionen verwenden authentifizierte ATH-Benachrichtigungsnachrichten. Externe Integrationen dürfen nicht annehmen, dass Platho-Benachrichtigungsabläufe eine generische `JettonTransferNotification` aussenden.

Ausgehende interne Transfers in ATHWallet werden durch quellseitige ausstehende Buchhaltung und Quell-Bestätigung geschützt. Das Guthaben wird nicht aus einem Bounce-Body ohne Nachweis des ausstehenden Zustands wiederhergestellt.

## ATH-Lebenszyklus

1. `ATHMaster` erzeugt ein festes Angebot von `100,000,000 ATH`.
2. Der einmalige Treasury-Deploy erhält das Angebot im Treasury-ATH-Wallet.
3. Das Angebot wird auf Aktivität, Liquidität, langfristiges Vesting und Marktstabilität verteilt.
4. Nutzer veröffentlichen Nachrichten über Vault.
5. Eine erfolgreiche Veröffentlichung schreibt eine Aktivitätsbelohnung von `10 ATH` gut.
6. Nachdem der vollständige Aktivitäts-Airdrop von `15,000,000 ATH` verteilt wurde und `airdrop_remaining_ath == 0`, werden ATH-Protokollgebühren-Rabatte freigeschaltet.
7. Der ATH/GRAM-Pool startet zum Referenzpreis `1 ATH = 0.001 GRAM`.
8. Nachweise für die Route nach dem Pool und die Preisnachweise werden eingefroren.
9. MarketStabilitySeller verkauft die Reserve über x2..x21-Tranchen.
10. Nachdem der Split aktiviert ist, teilt FeeAccumulator GRAM-Protokollgebühren zwischen Treasury und Buyback auf.
11. BuybackBurn kauft ATH mit GRAM-Protokollgebühren und verbrennt ATH über ATHMaster.
12. Benutzernamen- und Profilgebühren erzeugen ATH-Treasury-Fälligkeit und ATH-Burn-Fälligkeit.
13. Das Gesamtangebot verringert sich allmählich durch authentifizierte Burns.

## Endgültiges Modell

ATH verbindet vier Ebenen von Platho:

1. **Anwendungsnutzung** - Nachrichten erzeugen Aktivitätsbelohnungen.
2. **Kostenpflichtige Funktionen** - Benutzernamen und Avatare erfordern ATH.
3. **Rabatte** - das ATH-Guthaben reduziert die Protokollgebühr nach dem Verteilungs-Gate.
4. **Angebotsreduktion** - ein Teil der ATH-Gebühren und der Buyback-Ausgabe wird über ATHMaster verbrannt.

Das Modell beginnt mit einem festen Angebot und einer Referenzbewertung von `100,000 GRAM`. Die primäre Nutzerverteilung ist an die tatsächliche kostenpflichtige Nutzung gekoppelt: Nachrichten beginnen bei `0.0337 GRAM` — derzeit `0.0337 GRAM` für einen öffentlichen 1-KiB-Beitrag und `0.0347 GRAM` für eine hybride private 1-KiB-Kapsel, plus einem Aktivitätsbonus von `10 ATH` pro finalisierter Kapsel. Größere öffentliche oder private Größenklassen kosten mehr. Dieser Bonus ist keine Rückerstattung, keine Erstattung und kein Gewinnversprechen. Nachdem die ersten 15% des Angebots verteilt sind, startet der Pool, Protokollgebühren-Rabatte werden freigeschaltet, und der Buyback-Weg öffnet sich.

ATH existiert als funktionierender Token innerhalb von Platho: Er wird durch Aktivität verteilt, in kostenpflichtigen Aktionen verwendet, reduziert die Protokollgebühr, wird über eine definierte Treppe aus der Reserve verkauft und über einen On-Chain-Burn verbrannt. Nach der Marktstabilisierungs-Treppe wird der zukünftige ATH-Preis vom Markt und der Protokollnutzung bestimmt.
