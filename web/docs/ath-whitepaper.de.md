# ATH Whitepaper

## Der Token des Platho-Protokolls

ATH ist der Utility-Token von Platho. Er wird verwendet für Aktivitätsbelohnungen, Protokollgebühren-Rabatte nach dem Airdrop, `.ath`-Benutzernamen, Aktualisierungen des Profil-Avatars, Marktstabilitätsverkäufe, Buyback und Burn.

ATH ist kein administrativer Token. Er verleiht nicht die Fähigkeit, Guthaben umzuschreiben, Vorgänge anzuhalten, neue Menge zu prägen oder die Eigentumsregeln der Nutzer zu ändern. Seine Rolle besteht darin, die Anwendungsökonomie anzutreiben und die Platho-Nutzung mit der On-Chain-Buchführung zu verbinden.

Dieses Dokument beschreibt das ATH-Modell in Platho v1.

## Kernparameter

ATH hat eine feste Gesamtmenge:

```text
100,000,000 ATH
```

ATH verwendet 9 Dezimalstellen:

```text
1 ATH = 1,000,000,000 atomic units
```

Gesamtmenge in atomaren Einheiten:

```text
100,000,000,000,000,000
```

Der Referenzpreis beim Start beträgt:

```text
1 ATH = 0.001 GRAM
```

Die vollständig verwässerte Bewertung beim Start beträgt:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH beginnt bei einer Referenzkapitalisierung von `100,000 GRAM`.

## Feste Menge

ATH wird von `ATHMaster` ausgegeben. Bei der Initialisierung legt `ATHMaster` die feste Gesamtmenge auf `100,000,000 ATH` fest.

Es gibt keine Mint-Funktion nach dem Genesis. `ATHMaster` implementiert kein administratives Prägen, Anhalten, Blacklisting, keine Transfersteuer, keinen erzwungenen Transfer und keine Rescue-Drain-Funktion.

Die anfängliche Mengenverteilung wird einmalig über `DeployTreasurySupply` durchgeführt. Sie sendet die gesamte Menge an das Treasury-ATH-Wallet. Die Genesis-Mengenverteilung kann nicht wiederholt werden.

Die Gesamtmenge verringert sich ausschließlich durch Burn. `ATHMaster` akzeptiert einen Burn erst nach einer authentifizierten Burn-Benachrichtigung vom deterministischen ATH-Wallet der Owner-Adresse. Nach der Verifizierung verringert `ATHMaster` die `total_supply` und sendet `ATHBurnFinalized`.

Ein ATH-Burn ist eine echte Verringerung der Gesamtmenge, kein Transfer an eine ungenutzte Adresse.

## Mengenzuteilung

Die ATH-Menge wird auf vier Kategorien verteilt:

| Kategorie | Anteil | Betrag |
| --- | ---: | ---: |
| Aktivitäts-Airdrop | 15% | 15,000,000 ATH |
| Anfangsliquidität | 15% | 15,000,000 ATH |
| Langfristiges Protokoll-Vesting | 10% | 10,000,000 ATH |
| Marktstabilitätsreserve | 60% | 60,000,000 ATH |

Diese Zuteilung definiert die wirtschaftliche Struktur von Platho:

- 15% der Menge werden vor dem Pool-Start durch Anwendungsaktivität an die Nutzer verteilt.
- 15% der Menge werden für die Anfangsliquidität verwendet.
- 10% der Menge sind in einem unveränderlichen langfristigen Vesting gesperrt.
- 60% der Menge sind für den MarketStabilitySeller reserviert und werden in Tranchen oberhalb des Startpreises verkauft, nachdem der Preis nach dem Pool-Start eingefroren wurde und die Bereitschaft zur Reserve-Finanzierung freigegeben ist.

Der Aktivitäts-Airdrop und die langfristige Vesting-Reserve sind beim finalen Genesis durch die offiziellen ATH-Wallets von Vault und ATHVesting gedeckt, und der Release-Verifier prüft diese Guthaben vor dem Produktions-Release. Die `60,000,000 ATH` große Marktstabilitätszuteilung ist für den MarketStabilitySeller reserviert, wird aber beim finalen Genesis nicht in den Seller eingezahlt. Die Finanzierung des Sellers erfolgt erst nach dem Pool-Start, dem einmaligen, an Nachweise gebundenen Einfrieren des Preises und dem gebundenen Reserve-Funder-Notify-Flow; die Bereitschaft des Sellers ist nur gültig, nachdem `reserve_due_ath`, `reserve_funded_total_ath` und die Deckung des offiziellen Seller-ATH-Wallets verifiziert wurden.

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

Jeder kann eine Auszahlung auslösen, sobald ATH gevestet ist, aber der Begünstigte ist unveränderlich. Der Vertrag hat keine Beschleunigungs-, Begünstigtenwechsel-, Pause-, Admin-Sweep-, Rescue-Drain- oder diskretionäre Freigabefunktion.

Beim finalen Genesis muss das offizielle `ATHWallet(owner = ATHVesting, master = ATHMaster)` exakt `10,000,000 ATH` enthalten. Der Verifier verlangt außerdem null beanspruchte ATH, eine Ruhephase und keinen ausstehenden Transfer vor dem Start.

Diese Reserve ist bewusst langsam. Sie schafft einen langen Horizont für die Protokollentwicklung, ohne beim Start einen liquiden 10M-ATH-Topf über dem Markt zu platzieren.

## Aktivitäts-Airdrop

Der Aktivitäts-Airdrop beträgt:

```text
15,000,000 ATH
```

Belohnung pro erfolgreicher Veröffentlichung:

```text
10 ATH
```

Die Belohnung wird dem internen ATH-Guthaben des Nutzers im Vault nach einer erfolgreichen Veröffentlichung gutgeschrieben. Eine erfolgreiche Veröffentlichung bedeutet, dass Vault die Nutzlast an CapsuleHub gesendet hat, CapsuleHub den Eintrag akzeptiert hat und Vault die Bestätigung erhalten hat.

Fehlgeschlagene Veröffentlichungsversuche erzeugen keine Aktivitätsbelohnungen.

Belohnungsbuchführung:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Wenn der verbleibende Airdrop-Topf unter 10 ATH liegt, wird der verbleibende Betrag gutgeschrieben. Sobald der Topf erschöpft ist, stoppen neue Aktivitätsbelohnungen.

Der Aktivitäts-Airdrop wird im Vault verbucht und durch das vorfinanzierte offizielle Vault-ATH-Wallet gedeckt.

ATH-Einzahlungen in den Vault werden ausschließlich über den Transfer-with-Notify-Flow des ATHWallets des Nutzers
(`ATHTransferRequestWithNotify`) in den Vault unterstützt. Ein manueller gewöhnlicher ATH-Transfer an das offizielle Vault-ATHWallet wird
nicht unterstützt: Er kann das Rohguthaben des offiziellen Wallets erhöhen, erzeugt aber kein `Vault.user.ath_balance` und darf
von der PWA nicht als Einzahlungspfad angezeigt werden.

ATH-Abhebungen aus dem Vault sind signierte externe Vault-Befehle. Die nachgelagerte Reserve für ATHWallet-Deployment, Transfer, Speicherung und
ACK-Ausführung wird aus dem internen GRAM-Guthaben des Nutzers im Vault bezahlt. Vault schreibt nur authentifizierten
ACK-/Fail-/Bounce-Wert zurück, den es empfängt, abzüglich der lokalen Rückerstattungsreserve und begrenzt durch den reservierten internen Wert. Produkttexte
dürfen keine vollständige Rückerstattung des GRAM-Überschusses versprechen.

## Aktivitätspreis

Öffentliche Produkttexte dürfen sagen, dass Nachrichten ab dem aktuellen exakten öffentlichen Basispreis beginnen:

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

Dies verknüpft die frühe ATH-Verteilung mit der tatsächlichen Anwendungsnutzung. Die Belohnung ist ein Aktivitätsbonus, keine Rückerstattung, kein Cashback,
kein Rabatt und kein Versprechen, dass ATH die GRAM-Kosten einer Veröffentlichung ausgleicht. Der Referenzwert von `10 ATH` beim Start kann
niedriger sein als die GRAM-Kosten der Capsule, und das ist beabsichtigt: Nutzer erhalten für die tatsächliche Nutzung frühe Netzwerk-Beteiligung,
keine garantierte Erstattung.

Produkttexte dürfen die Capsule-Preisgestaltung als Nachrichten ab `0.0337 GRAM` zusammenfassen; aktuelle exakte kanonische Beispiele sind 1-KiB-Öffentliche-Posts ab `0.0337 GRAM` und hybride private 1-KiB-Capsules ab `0.0347 GRAM`. Größere öffentliche oder private Capsule-Blöcke kosten mehr, weil der ausgewählte
Body von 1, 2, 4, 8, 16 oder 32 KiB die Ausführungs- und Speicherreserve von Vault/CapsuleHub verändert. Die Belohnung bleibt bei `10 ATH` pro erfolgreich abgeschlossener
Capsule, unabhängig von der Capsule-Größe.

Private Veröffentlichungen verwenden standardmäßig das hybride Sicherheitsprofil: X25519 + ML-KEM-768 + AES-GCM. In V1 gibt es keinen günstigeren klassischen Modus für private Nachrichten.

ATH kann nach dem Bestehen des offiziellen Pools über oder unter dem Referenzpreis beim Start gehandelt werden. Die Protokolldokumentation darf
die Aktivitätsbelohnung nicht als Anlagerendite, Gewinnerwartung oder Preisgarantie darstellen.

## Protokollgebühr und Nutzerpreis

Innerhalb des Vault ist die Protokollgebühr getrennt von den vollen für den Nutzer sichtbaren Kosten.

Protokollgebühr:

| Veröffentlichungstyp | Protokollgebühr |
| --- | ---: |
| Öffentlicher Post | 0.010 GRAM |
| Hybride private Nachricht | 0.010 GRAM |

Der für den Nutzer sichtbare Preis umfasst die Protokollgebühr, die Speichergebühr für kompakte Index/Header-Daten, die lokale Ausführungsreserve des Vault und die erwartete ACK-Rückerstattung:

| Veröffentlichungstyp | Für den Nutzer sichtbarer Preis |
| --- | ---: |
| Öffentlich/Produktetikett | from 0.0337 GRAM |
| Aktuelles exaktes Beispiel öffentlicher Post | 0.0337 GRAM |
| Aktuelles exaktes Beispiel hybrid privat 1 KiB | 0.0347 GRAM |

Wenn die PWA eine höhere konservative Netzwerkschätzung erhält, addiert sie die geschätzte Überschreitung zur kanonischen Maximalbelastung, aufgerundet auf saubere `0.001 GRAM`-Schritte. ATH-Rabatte gelten für die Protokollgebühr, nicht für Netzwerkkosten oder Speicherreserven. Dieser Aufschlag ist eine signierte Sicherheitsmarge: Wenn CapsuleHub die Veröffentlichung akzeptiert, gibt der Erfolgs-ACK nur die feste Publish-ACK-Reserve von `30,000,000` Nanotons (`0.030 GRAM`) zurück. Nachdem Vault diesen ACK verarbeitet hat, werden dem Nutzer etwa `25,800,000` Nanotons im internen Vault-GRAM-Guthaben gutgeschrieben. Der Teil oberhalb des kanonisch erforderlichen Wertes verbleibt in CapsuleHub als Netzwerk-/Speicherreserve-Überschuss. Er wird nicht an Vault zurückgegeben und wird zum Zeitpunkt der Veröffentlichung nicht als `accrued_plato_fee_ton` gezählt. Nur der Rohüberschuss oberhalb der geschützten Reserve von CapsuleHub kann später erlaubnisfrei an den FeeAccumulator abgeführt werden, wo er der normalen Treasury-/Buyback-Buchführung folgt. CapsuleHub speichert kompakte authentifizierte Eintrags-Metadaten und den Body-Hash; der schwere Body wird aus der akzeptierten Publish-Transaktionshistorie wiederhergestellt und lokal verifiziert.

## ATH-Rabatte

ATH reduziert die Protokollgebühren für Nachrichten, nachdem der Aktivitäts-Airdrop vollständig verteilt wurde.

Rabatte werden erst freigeschaltet, wenn der verbleibende Aktivitäts-Airdrop beträgt:

```text
airdrop_remaining_ath == 0 ATH
```

Vor diesem Zeitpunkt wird die Protokollgebühr in voller Höhe bezahlt.

Schwelle für den vollen Rabatt:

```text
10,000 ATH
```

Wenn das interne ATH-Guthaben des Nutzers im Vault mindestens `10,000 ATH` beträgt, erreicht der Nutzer die volle Protokollgebühren-Rabattstufe für die Platho-Gebührenkomponente. Netzwerkkosten und Speicherreserven werden weiterhin bezahlt.

Wenn das Guthaben unter `10,000 ATH` liegt, verringert sich die Gebühr linear:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Die Berechnung rundet auf. Mit den aktuellen Konstanten beträgt die volle Protokollgebühr `0.010 GRAM` (`10,000,000 nanotons`) sowohl für öffentliche als auch für private Capsules, und die maximale Reduktion beträgt `0.010 GRAM` pro Capsule.

## Pool-Start

Der ATH/GRAM-Pool startet, nachdem der vollständige `15,000,000 ATH` große Aktivitäts-Airdrop verteilt wurde.

Die Startsequenz lautet:

1. Nutzer erhalten ATH durch tatsächliche Platho-Nutzung.
2. Der vollständige Aktivitäts-Airdrop wird verteilt.
3. ATH-Rabatte werden freigeschaltet.
4. Der ATH/GRAM-Pool startet.
5. Route-Nachweise und Preis-Nachweise nach dem Pool-Start werden eingefroren.
6. Der Buyback-Split wird aktiviert.

Der Pool beginnt beim Referenzpreis:

```text
1 ATH = 0.001 GRAM
```

Zuteilung der Anfangsliquidität:

```text
15,000,000 ATH
```

GRAM-Seite zum Startpreis:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Es wird nicht erwartet, dass die vor dem Pool-Start eingesammelten Protokollgebühren die GRAM-Seite der Anfangsliquidität vollständig finanzieren. Der
Plan für die Anfangsliquidität kann zusätzlich zu den Protokolleinnahmen eine Finanzierung durch Projekt/Treasury erfordern. Dies ist Teil des Start-
Bootstraps und macht Aktivitätsbelohnungen nicht zu einem in GRAM denominierten Anspruch.

Der Pool startet um einen Token herum, der bereits durch die Anwendungsnutzung verteilt wurde. Dies trennt ATH von einem leeren Listing ohne Nutzerbasis.

## FeeAccumulator

GRAM-Protokollgebühren werden im `FeeAccumulator` gesammelt.

Bevor der Buyback-Split aktiviert ist, fließt das gesamte gesammelte GRAM in den Treasury-Topf:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` wächst nicht, bevor der Split aktiviert ist.

Nach `EnableBuybackSplit` wird das gesammelte GRAM aufgeteilt:

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
ausgeführt wird. Dies ist eine echte einmalige Befugnis: Sie kann keine Gelder stehlen, nichts anhalten, nichts retten und keine Adressen ändern, aber sie ändert dauerhaft
die FeeAccumulator-Ökonomie von der reinen Bootstrap-Treasury-Akkumulation zum 50/50-Treasury-/Buyback-Split. Sie wird
erst aktiviert, nachdem der Release-Preflight bestanden ist.

Die Release-Befugnisse von Platho sind bewusst eng gefasst und größtenteils einmalig. Sie existieren dennoch und müssen ehrlich benannt werden:
Der Treasury-Owner setzt die anfängliche ATH-Menge einmalig ein; der Genesis-Controller führt das Pre-Seal-Binding und das Sealing durch;
der BuybackBurn-Launch-Controller friert die Route nach dem Pool-Start einmalig ein; das Einfrieren des MarketStabilitySeller-Preises wird
einmalig von seinem Launch-Controller durchgeführt; und der FeeAccumulator-Treasury-Empfänger aktiviert den einseitigen Buyback-Split nach dem Preflight. Keine dieser
Rollen ist ein Rescue-, Pause-, Upgrade-, Admin-Drain- oder beliebiger Guthaben-Kontrollmechanismus.

## Buyback und Burn

Buyback wird über `FeeAccumulator` und `BuybackBurn` ausgeführt.

BuybackBurn akzeptiert nur eine vollständige Ausführungshülle:

```text
51.05 GRAM
```

Struktur der Hülle:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

Rohe `50 GRAM` sind kein gültiger Buyback-Chunk. Buyback wird nur als vollständige Route-Hülle akzeptiert.

Nach dem Einfrieren der Route führt BuybackBurn einen Buyback wie folgt aus:

1. Akzeptiert `51.05 GRAM` nur vom gebundenen FeeAccumulator.
2. Erfasst den Betrag in `reserve_due_ton`.
3. Bei `ExecuteBuybackChunk` verbraucht es eine Hülle.
4. Verwendet die eingefrorene Quote und das eingefrorene minOut.
5. Legt die STON.fi-Deadline intern fest.
6. Sendet die Route über das eingefrorene pTON-Wallet.
7. Akzeptiert ATH nur über das offizielle BuybackBurn-ATH-Wallet.
8. Verifiziert, dass das Quell-Wallet mit dem eingefrorenen STON.fi-Pool übereinstimmt.
9. Sendet das erhaltene ATH über das offizielle ATH-Wallet zum Burn.
10. Schließt den Zyklus erst nach `ATHBurnFinalized` von `ATHMaster` ab.

Buyback-Erfolg wird nicht durch eine Router-Nachricht, eine ausgehende Burn-Anfrage oder eine ATHWallet-Burn-Benachrichtigung definiert. Er wird
nur dann definiert, wenn BuybackBurn ein authentifiziertes `ATHBurnFinalized` von ATHMaster empfängt. Bis diese Finalisierung eintrifft, muss
BuybackBurn weiterhin als ausstehender Burn- oder Retry-Zustand behandelt werden; Dashboards und Indexer dürfen das ATH nicht als
gebrannt zählen, nur weil ein Burn-Versuch gesendet wurde.

Wenn der Burn nicht finalisiert wird, wandert das erhaltene ATH in die Retry-Fälligkeit. `RetryAthBurnDue` brennt den vollen Retry-Fälligkeitsbetrag.

## Benutzernamen-Gebühren

Die Registrierung eines `.ath`-Benutzernamens wird in ATH über das offizielle UsernameRegistry-ATH-Wallet bezahlt.

Preise:

| Namenslänge | Preis |
| ---: | ---: |
| 4 Zeichen | 10,000 ATH |
| 5 Zeichen | 1,000 ATH |
| 6+ Zeichen | 100 ATH |

UsernameRegistry akzeptiert nur den exakten Preis. Unterzahlung und Überzahlung erzeugen keinen Namen.

Ein akzeptierter Mint durchläuft den Pending-Zustand und deployt `UsernameNFTItem`. Vor der Item-Bestätigung wird die Zahlung nicht als Einnahme anerkannt. Nach der Item-Bestätigung wird der Betrag aufgeteilt:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Der aktuelle V1-Benutzernamen-Mint wird über Vault finanziert. Ablehnungen wegen ungültiger Benutzernamen, falschem Preis oder Duplikatnamen prallen über den
offiziellen ATH-Wallet-Benachrichtigungspfad zurück, sodass Vault das interne ATH des Nutzers wiederherstellen kann. UsernameRegistry unterhält im aktuellen Vault-finanzierten Flow keinen
direkten externen Benutzernamen-Rückerstattungstopf.

ATH aus dem Benutzernamen-Mint wird erst dann zu Protokolleinnahme, nachdem das Deployment des entsprechenden Items bestätigt ist.

Die Benutzernamen-Autorität ist bewusst aufgeteilt: `UsernameRegistry` verankert den Namen an genau ein `UsernameNFTItem`, und der
Item-Zustand trägt den aktuellen Owner. Transfers des Items übertragen den Benutzernamen. Das Item stellt Standard-NFT-Daten
und TEP-64 On-Chain-Metadaten bereit, einschließlich `name = <username>.ath`; es ist für die Metadaten nicht auf einen Platho-Server angewiesen.
V1-Benutzernamen-Bytes sind wörtlich und werden nicht für die Anzeige normalisiert: führende, nachfolgende, aufeinanderfolgende und reine Trennzeichen-Namen sind
gültig, wenn jedes Byte im erlaubten Satz `a-z`, `0-9`, `_`, `-` liegt und die Länge 4..16 beträgt.
Wenn das Item-Deployment versucht wurde, der Item-ACK die Registry aber nie erreicht hat, ist `PrunePendingUsernameMint` in V1 absichtlich
nicht destruktiv: Es errät kein Scheitern, löscht keinen Pending-Zustand und erzeugt keine Rückerstattungsfälligkeit. Der Wiederherstellungspfad ist ein später
`UsernameItemDeployedAck` oder `UsernameNFTItem.ResendDeployedAck`, sodass ein initialisiertes Item dennoch autoritativ werden kann.
Wenn das Item-Deployment tatsächlich zurückprallt, bittet die Registry das offizielle ATH-Wallet, die ausstehende Benachrichtigung zu erstatten.
Ein deployedtes `UsernameNFTItem` ohne einen `UsernameRegistry.name_records[name_hash]`, der auf genau dieses Item zeigt, ist
nicht-autoritativ: Clients, Indexer und UI dürfen das Item allein nicht als Eigentum am `.ath`-Namen behandeln und dürfen
den Owner des Registry-Records nach Transfers nicht als aktuellen Owner verwenden.

## Profil-Avatar-Gebühren

Kosten für die Aktualisierung des Profil-Avatars:

```text
100 ATH
```

Aktuelle V1-Profil-Avatar-Aktualisierungen werden über Vault finanziert. Die PWA sendet `SetProfileAvatarFromVaultBalance` an Vault; Vault zahlt über seinen offiziellen ATH-Wallet-Benachrichtigungspfad in das offizielle ProfileRegistry-ATH-Wallet. Die direkte Avatar-Zahlung aus dem Nutzer-Wallet ist kein unterstützter V1-Produkt-Flow.

ProfileRegistry akzeptiert die Aktualisierung nur, wenn alle Bedingungen erfüllt sind:

- der Betrag ist exakt `100 ATH`;
- der Absender ist das offizielle ProfileRegistry-ATH-Wallet;
- das Payer-Wallet ist der gebundene Vault;
- das Owner-Wallet ist in der Basechain;
- der Avatar-Hash ist nicht null;
- die Stream-ID ist nicht null;
- die Anzahl der Teile liegt zwischen 1 und 16;
- das Medienformat ist WebP.

Eine akzeptierte Aktualisierung erzeugt eine neue Avatar-Version und teilt die Gebühr auf:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Eine abgelehnte Avatar-Benachrichtigung wird über den ATHWallet-Benachrichtigungs-Bounce-Pfad erstattet. ProfileRegistry erzeugt keinen separaten Rückerstattungstopf für fehlerhafte Avatar-Aktualisierungen.

ProfileRegistry speichert den authentifizierten Avatar-Pointer, nicht permanente Bild-Bytes. Die PWA muss die Avatar-WebP-Daten aus öffentlichen CapsuleHub-Einträgen oder dem lokalen Cache rekonstruieren und die Bytes gegen den gespeicherten `avatar_hash` verifizieren; fehlende oder geprunte Historie wird als nicht verfügbar angezeigt.

## Market Stability Seller

MarketStabilitySeller ist eine öffentliche Vertragsreserve, die ATH nach dem offiziellen Pool-Start verteilt:

```text
60,000,000 ATH
```

Ihr Zweck besteht darin, die durch dünne Liquidität verursachte Verzerrung des frühen Marktes zu reduzieren. Beim Start kann ein kleiner Pool durch eine kleine Gruppe früher Käufer stark bewegt werden. Wenn das geschieht, können Nutzer, die ATH für tatsächliche Platho-Aktionen benötigen, gezwungen sein, sich in eine künstliche Preisspitze einzukaufen.

MarketStabilitySeller schafft eine transparente Angebotstreppe oberhalb des Startpreises. Er verkauft ATH in Tranchen fester Größe. Jede folgende Tranche ist teurer als die vorherige, und jede Tranche hat eine harte Größenbegrenzung. Nach dem einmaligen, an Nachweise gebundenen Einfrieren des Preises ist der Tranchenplan deterministisch und kann vom Team nicht manuell geändert werden.

Wenn frühe Spekulanten versuchen, eine große Menge ATH aufzunehmen, kaufen sie aus der öffentlichen Reserve zu steigenden Tranchenpreisen, anstatt die gesamte günstige Liquidität aus einem dünnen Pool zu extrahieren und sie an die Nutzer weiterzuverkaufen. Wenn gewöhnliche Nutzer ATH für Platho benötigen, können sie es zu einem bekannten öffentlichen Tranchenpreis kaufen, ohne einen kleinen Pool mit einer einzigen Nachfragewelle vertikal nach oben zu treiben.

Die Reserve wirft keine Token in den Markt. Sie verkauft nicht von selbst und erzeugt ohne Nachfrage keinen Verkaufsdruck. Ein Verkauf geschieht nur, wenn ein Käufer freiwillig aus der aktuellen Tranche kauft. Wenn es keine Nachfrage gibt, bleibt die Reserve im Ruhezustand.

Der On-Chain-Nutzen von ATH ist spezifisch:

- die Registrierung eines `.ath`-Benutzernamens wird in ATH über UsernameRegistry bezahlt;
- Aktualisierungen des Profil-Avatar-Pointers werden in ATH über ProfileRegistry bezahlt;
- ATH, das im internen Vault-Guthaben des Nutzers gehalten wird, reduziert die Protokollgebühr für Vault-Veröffentlichungen nach dem Aktivitäts-Verteilungsgate;
- akzeptierte Benutzernamen- und Avatar-Gebühren erzeugen Treasury-Fälligkeit und Burn-Fälligkeit;
- BuybackBurn kauft ATH mit GRAM-Protokollgebühren und brennt das erhaltene ATH über ATHMaster.

Vault-Veröffentlichungen werden in GRAM bezahlt. ATH bezahlt nicht die gesamte Veröffentlichungstransaktion. Es reduziert die Protokollgebühren-Komponente, nachdem das Rabatt-Gate geöffnet ist.

Dies macht die ATH-Nachfrage an konkrete Protokollaktionen gebunden: `.ath`-Namen, Avatar-Aktualisierungen, Vault-Protokollgebühren-Rabatte nach dem Airdrop und Buyback-/Burn-Druck. MarketStabilitySeller erweitert das verfügbare Angebot nur, wenn Käufer die nächste Tranche nehmen, sodass der frühe Zugang öffentlich und deterministisch ist, anstatt von einem dünnen Pool dominiert zu werden.

Die Reserve wird erst nach dem Einfrieren des Preises nach dem Pool-Start verkauft.

Das Einfrieren des Preises ist eine echte einmalige Start-Befugnis. Es legt den Basis-Tranchenpreis einmalig aus den Pool-Start-Nachweisen fest, danach wird der Launch-Controller-Hash gelöscht. Danach kann MarketStabilitySeller keine Gelder stehlen, Verkäufe nicht anhalten, Guthaben nicht retten, Käufer nicht übergehen und den Preisplan nicht verändern.

Die Bereitschaft von MarketStabilitySeller ist ein Post-Pool-Gate, kein Ersatz für die finale Genesis-Verifizierung. Die Produktions-
sequenz lautet: `mainnet:genesis:verify` besteht auf dem sauberen finalen Snapshot, der Preis wird nach dem Pool-Start eingefroren, der gebundene
Reserve-Funder finanziert den Seller über den Notify-Flow, dann prüft `market-stability:readiness` den Seller-Zustand, die Finanzierung, die Preis-
Nachweise und die Wallet-Deckung. Die Seller-Bereitschaft ist erst nach diesem Bereitschafts-Durchlauf produktionsgültig.

Finanzierung wird nur akzeptiert:

- nach dem Seal;
- nach dem Einfrieren des Preises;
- über das offizielle Seller-ATH-Wallet;
- vom gebundenen Reserve-Funder;
- bis zur Gesamtobergrenze von `60,000,000 ATH`.

Nur authentifizierte Reserve-Finanzierung erhöht die Buchführung der verkäuflichen Reserve. Die Laufzeit erlaubt partielle Reserve-Finanzierung und partiellen Verkauf, aber die Startbereitschaft erfordert die volle Reserve: `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH` und eine offizielle Wallet-Deckung von mindestens `60,000,000 ATH`. Ein unaufgeforderter gewöhnlicher ATH-Transfer in das offizielle Seller-ATH-Wallet erhöht weder `reserve_due_ath` noch `reserve_funded_total_ath`, erweitert das verkäufliche Angebot nicht und kann steckenbleiben. Die Bereitschaftsprüfung behandelt ein offizielles Wallet-Guthaben über `60,000,000 ATH` als Warnung, nicht als zusätzliche Reserve.

Die Reserve wird in 20 Tranchen aufgeteilt:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Jede Tranche hat einen Multiplikator:

```text
x2, x3, x4, ..., x21
```

Dies erzeugt eine glatte Preistreppe. Mit wachsender Projektbeliebtheit erhält der Markt zusätzliches ATH-Angebot, aber jede folgende Tranche ist teurer als die vorherige. Frühe Nachfrage trifft nicht sofort auf einen dünnen Pool, und das Preiswachstum wird nicht zu einer vertikalen Wand, die den Utility-Token unbequem in der Nutzung macht.

Kauf-Formel:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` wird nach dem Pool-Start eingefroren und stimmt exakt mit dem x1-Preis-Nachweis überein.

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

Ein einzelner Kauf kann keine Tranchengrenze überschreiten. Dies verhindert den Kauf von ATH aus der nächsten Tranche zum Preis der vorherigen Tranche.

GRAM-Einnahmen werden erst anerkannt, nachdem ATH an den Käufer geliefert wurde. Wenn der ATH-Transfer fehlschlägt oder zurückprallt, wird die Reserve wiederhergestellt, der Käufer erhält das gezahlte GRAM-Kapital zurück, und die Treasury-Fälligkeit erhöht sich nicht.

Nachdem die letzte x21-Tranche verkauft ist, reguliert MarketStabilitySeller den ATH-Preis nicht mehr. Ab diesem Punkt wird der Preis vollständig vom Markt bestimmt: Liquidität, verfügbares Angebot, Nachfrage nach `.ath`-Namen, Avatar-Aktualisierungen, Vault-Protokollgebühren-Rabatte nach dem Airdrop und Buyback-/Burn-Druck.

Selbst bei der x21-Stufe bleibt die Referenzbewertung im Verhältnis zum Utility-Modell moderat:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Bei der x21-Stufe hat MarketStabilitySeller seine programmierte Reserve-Freigabe abgeschlossen. Danach wird der ATH-Preis vollständig vom Markt bestimmt durch Liquidität, Nutzungsnachfrage, verfügbares Angebot und Buyback-/Burn-Druck. Die einzige verbleibende Protokollzuteilung ist der langsame langfristige Vesting-Zeitplan, begrenzt auf `100,000 ATH` pro Jahr.

## Treasury- und Burn-Töpfe

UsernameRegistry und ProfileRegistry verwenden dasselbe ATH-Gebühren-Splitmodell:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Das Flushen der Treasury-Fälligkeit sendet ATH über das offizielle ATH-Wallet an den Treasury-Empfänger.

Das Flushen der Burn-Fälligkeit sendet eine ATH-Burn-Anfrage über das offizielle ATH-Wallet. Die Menge verringert sich erst nach der Burn-Finalisierung im ATHMaster.

Fail- und Bounce-Pfade stellen die Fälligkeitstöpfe wieder her. Die Buchführung bleibt erhalten, bis der nachgelagerte Transfer oder Burn abgeschlossen ist.

## ATHWallet-Buchführung

ATH-Guthaben liegen in deterministischen ATHWallet-Verträgen.

ATHWallet verarbeitet:

- Genesis-Mengen-Gutschrift;
- gewöhnlichen Transfer;
- Transfer mit Notify;
- Benutzernamen-Mint-Notify;
- Profil-Avatar-Notify;
- Burn-Anfrage;
- Benachrichtigungsbestätigung;
- Prune veralteter Benachrichtigungen;
- Bounce-/Fail-Wiederherstellung.

Verträge, die ATH als Zahlung akzeptieren, akzeptieren keine direkten Nachrichten von beliebigen Adressen. Sie akzeptieren Benachrichtigungen nur von ihrem offiziellen ATHWallet. Die Authentifizierung des Quell-Wallets erfolgt innerhalb des ATHWallet durch deterministische Wallet-Ableitung.

ATH stellt TEP-74-ähnliche Transfer-Entrypoints für generische Jetton-Tools bereit, aber Platho-Protokollaktionen verwenden authentifizierte ATH-Benachrichtigungsnachrichten. Externe Integrationen dürfen nicht annehmen, dass Platho-Notify-Flows eine generische `JettonTransferNotification` aussenden.

Ausgehende interne Transfers im ATHWallet werden durch quellseitige Pending-Buchführung und quellseitige Bestätigung geschützt. Das Guthaben wird nicht ohne Pending-Nachweis aus einem Bounce-Body wiederhergestellt.

## ATH-Lebenszyklus

1. `ATHMaster` erzeugt eine feste Menge von `100,000,000 ATH`.
2. Das einmalige Treasury-Deploy erhält die Menge im Treasury-ATH-Wallet.
3. Die Menge wird auf Aktivität, Liquidität, langfristiges Vesting und Marktstabilität verteilt.
4. Nutzer veröffentlichen Nachrichten über Vault.
5. Eine erfolgreiche Veröffentlichung schreibt eine `10 ATH` Aktivitätsbelohnung gut.
6. Nachdem der vollständige `15,000,000 ATH` große Aktivitäts-Airdrop verteilt ist und `airdrop_remaining_ath == 0` gilt, werden ATH-Protokollgebühren-Rabatte freigeschaltet.
7. Der ATH/GRAM-Pool startet zum Referenzpreis `1 ATH = 0.001 GRAM`.
8. Route-Nachweise und Preis-Nachweise nach dem Pool-Start werden eingefroren.
9. MarketStabilitySeller verkauft die Reserve über die Tranchen x2..x21.
10. Nachdem der Split aktiviert ist, teilt FeeAccumulator die GRAM-Protokollgebühren zwischen Treasury und Buyback auf.
11. BuybackBurn kauft ATH mit GRAM-Protokollgebühren und brennt ATH über ATHMaster.
12. Benutzernamen- und Profilgebühren erzeugen ATH-Treasury-Fälligkeit und ATH-Burn-Fälligkeit.
13. Die Gesamtmenge verringert sich schrittweise durch authentifizierte Burns.

## Endmodell

ATH verbindet vier Ebenen von Platho:

1. **Anwendungsnutzung** - Nachrichten erzeugen Aktivitätsbelohnungen.
2. **Bezahlte Funktionen** - Benutzernamen und Avatare erfordern ATH.
3. **Rabatte** - das ATH-Guthaben reduziert die Protokollgebühr nach dem Verteilungsgate.
4. **Mengenreduktion** - ein Teil der ATH-Gebühren und der Buyback-Ausgabe wird über ATHMaster gebrannt.

Das Modell beginnt mit einer festen Menge und einer Referenzbewertung von `100,000 GRAM`. Die primäre Nutzerverteilung ist an die tatsächliche bezahlte Nutzung gebunden: Produkttexte dürfen sagen, dass Nachrichten ab `0.0337 GRAM` beginnen, während aktuelle exakte Beispiele `0.0337 GRAM` für einen 1-KiB-öffentlichen-Post und `0.0347 GRAM` für eine hybride private 1-KiB-Capsule sind, plus ein `10 ATH` Aktivitätsbonus pro abgeschlossener Capsule. Größere öffentliche oder private Größenklassen kosten mehr. Dieser Bonus ist keine Rückerstattung, keine Erstattung und kein Gewinnversprechen. Nachdem die ersten 15% der Menge verteilt sind, startet der Pool, Protokollgebühren-Rabatte werden freigeschaltet und der Buyback-Pfad öffnet sich.

ATH existiert als arbeitender Token innerhalb von Platho: Es wird durch Aktivität verteilt, in bezahlten Aktionen verwendet, reduziert die Protokollgebühr, wird über eine definierte Treppe aus der Reserve verkauft und über einen On-Chain-Burn gebrannt. Nach der Marktstabilitätstreppe wird der zukünftige ATH-Preis durch den Markt und die Protokollnutzung bestimmt.
