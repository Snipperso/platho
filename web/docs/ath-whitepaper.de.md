# ATH-Whitepaper

## Der Token des Platho-Protokolls

ATH ist der Utility-Token von Platho. Er dient Aktivitätsbelohnungen, Rabatten auf die Protokollgebühr nach dem Airdrop, `.ath`-Namen, Avatar-Aktualisierungen, Verkäufen zur Marktstabilisierung, Rückkauf und Verbrennung.

ATH ist kein Verwaltungstoken. Er verleiht keine Macht, Guthaben umzuschreiben, Vorgänge anzuhalten, neue Menge auszugeben oder zu verändern, was den Nutzenden gehört. Seine Aufgabe ist es, die Wirtschaft der App anzutreiben und die Nutzung von Platho an die On-Chain-Buchführung zu binden.

Dieses Dokument beschreibt das ATH-Modell in Platho.

## Kernparameter

ATH hat eine feste Gesamtmenge:

```text
100,000,000 ATH
```

Referenzpreis zum Start:

```text
1 ATH = 0.001 GRAM
```

Vollständig verwässerte Bewertung zum Start:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH startet mit einer Referenzkapitalisierung von `100,000 GRAM`.

## Feste Menge

ATH wird vom Vertrag `ATHMaster` ausgegeben. Bei der Initialisierung setzt `ATHMaster` die Gesamtmenge fest auf `100,000,000 ATH`.

Nach dem Genesis gibt es keine Prägefunktion. `ATHMaster` implementiert weder administratives Prägen noch Pause, Sperrliste, Transfersteuer, erzwungenen Transfer oder Notfallabhebung.

Die Erstausgabe erfolgt genau einmal, über `DeployTreasurySupply`: Sie sendet die gesamte Menge an die Treasury-ATH-Wallet. Die Genesis-Ausgabe lässt sich nicht wiederholen.

Die Gesamtmenge sinkt ausschließlich durch Verbrennung. `ATHMaster` akzeptiert eine Verbrennung erst nach einer authentifizierten Verbrennungsmitteilung aus der deterministischen ATH-Wallet der Eigentümeradresse. Nach der Prüfung verringert `ATHMaster` `total_supply` und sendet `ATHBurnFinalized`.

ATH zu verbrennen ist eine echte Verringerung der Gesamtmenge, kein Transfer an eine unbenutzte Adresse.

## Verteilung der Menge

Die ATH-Menge verteilt sich auf vier Kategorien:

| Kategorie | Anteil | Menge |
| --- | ---: | ---: |
| Aktivitäts-Airdrop | 15% | 15,000,000 ATH |
| Anfangsliquidität | 15% | 15,000,000 ATH |
| Langfristiges Protokoll-Vesting | 10% | 10,000,000 ATH |
| Marktstabilitätsreserve | 60% | 60,000,000 ATH |

Diese Verteilung legt die wirtschaftliche Struktur von Platho fest:

- 15% der Menge werden vor dem Pool-Start über Aktivität in der App an die Nutzenden verteilt.
- 15% der Menge dienen der Anfangsliquidität.
- 10% der Menge sind in einem unveränderlichen Langfrist-Vesting gesperrt.
- 60% der Menge fließen in MarketStabilitySeller und werden beim Genesis gesperrt; verkauft wird danach in Tranchen oberhalb des Startpreises, nach dem Preis-Freeze im Anschluss an den Pool.

Beim finalen Genesis sind der Aktivitäts-Airdrop und die Langfrist-Vesting-Reserve durch die offiziellen ATH-Wallets von AirdropPool und ATHVesting gedeckt, und der Release-Verifier prüft diese Guthaben vor einer Produktionsveröffentlichung. Die Marktstabilitätsreserve über `60,000,000 ATH` fließt in MarketStabilitySeller und wird beim finalen Genesis gesperrt, gedeckt durch dessen offizielle Verkäufer-ATH-Wallet; der Verifier prüft diese Deckung ebenfalls vor einer Produktionsveröffentlichung. Die Reserve ist von Anfang an kapitalisiert, wird aber erst nach dem Pool-Start verkauft, wenn ein einmaliger, an Nachweise gebundener Preis-Freeze den Basispreis der Tranche festlegt.

## Langfristiges Protokoll-Vesting

Die Langfrist-Vesting-Reserve beträgt:

```text
10,000,000 ATH
```

Sie liegt in `ATHVesting`, nicht in einem veränderbaren Treasury-Topf. Der Zeitplan ist im Vertrag festgeschrieben:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Sobald ATH fällig geworden ist, darf jede Person eine Auszahlung auslösen, doch die begünstigte Adresse ist unveränderlich. Der Vertrag kennt weder Beschleunigung noch Wechsel der Begünstigten, Pause, administrative Abhebung, Notausstieg oder Freigabe nach Ermessen.

Beim finalen Genesis muss die offizielle `ATHWallet(owner = ATHVesting, master = ATHMaster)` exakt `10,000,000 ATH` halten. Der Verifier verlangt außerdem null beanspruchtes ATH, eine ruhende Phase und keine offenen Transfers vor dem Start.

Diese Reserve ist bewusst langsam. Sie schafft einen langen Horizont für die Protokollentwicklung, ohne beim Start einen liquiden Block von 10M ATH über den Markt zu legen.

## Aktivitäts-Airdrop

Der Aktivitäts-Airdrop beträgt:

```text
15,000,000 ATH
```

Belohnung je erfolgreicher Veröffentlichung:

```text
10 ATH
```

Die Belohnung fällt der veröffentlichenden Person als Guthabenposten zu: eine angenommene Kapsel ist ein Posten und ein Posten sind `10 ATH` — auf jeder Spur gleich. Die Posten sammeln sich im eigenen Konto der veröffentlichenden Person (`AirdropTicket`, eines je Wallet) und werden gebündelt aus `AirdropPool` eingelöst; das ATH landet in ihrer eigenen ATH-Wallet.

Fehlgeschlagene Veröffentlichungsversuche erzeugen keine Aktivitätsbelohnung.

Verbuchung der Belohnung:

```text
credits += 1                 // ein Posten = 10 ATH
airdrop_remaining -= 10 ATH
```

Das Budget ist ein exaktes Vielfaches der Belohnung: `15,000,000 ATH` sind `1,500,000` Posten. Sind sie aufgebraucht, enden neue Aktivitätsbelohnungen.

Der Aktivitäts-Airdrop ist durch die offizielle ATH-Wallet von `AirdropPool` gedeckt — dort liegen diese `15,000,000 ATH`.

Ausgezahlt wird in Bündeln, nicht je Kapsel. Jede Zustellung trägt feste, nicht rückholbare Kosten von rund `0.0166 GRAM`, und diese Kosten hängen nicht davon ab, wie viele Posten die Zustellung transportiert. Eine Auszahlung je Kapsel über 1,500,000 Kapseln würde mehr verbrennen, als diese Kapseln an Protokollgebühren einbringen; deshalb sammeln sich die Posten und werden gebündelt eingelöst.

## Preis der Aktivität

Nachrichten beginnen beim aktuellen Grundpreis:

```text
0.0191 GRAM
```

Aktuelle genaue Werte vor dem ATH-Rabatt:

```text
private Nachricht:  0.0191 GRAM
Erstkontakt:        0.0178 GRAM
öffentlicher Beitrag: 0.0203 GRAM
```

Für jede erfolgreiche Veröffentlichung erhält man:

```text
10 ATH
```

Zum Referenzpreis des Starts:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Das bindet die frühe ATH-Verteilung an die tatsächliche Nutzung der App. Die Belohnung ist ein Aktivitätsbonus — keine Rückerstattung, kein Cashback, kein Rabatt und kein Versprechen, dass ATH die GRAM-Kosten einer Veröffentlichung ausgleicht. Der Referenzwert von `10 ATH` kann unter den GRAM-Kosten einer Kapsel liegen, und das ist Absicht: Man erhält frühen Anteil am Netzwerk für echte Nutzung, keine garantierte Erstattung.

Kapselpreise: ein öffentlicher Beitrag ab `0.0203 GRAM`, eine private Kapsel ab `0.0191 GRAM`. Größere öffentliche oder private Kapselblöcke kosten mehr, weil der gewählte Körper von 1, 2, 4, 8, 16 oder 32 KiB die Ausführungs- und Speicherrücklage im Shard verändert. Die Belohnung bleibt bei `10 ATH` je erfolgreich abgeschlossener Kapsel, unabhängig von deren Größe.

Eine private Veröffentlichung nutzt standardmäßig das hybride Sicherheitsprofil: X25519 + ML-KEM-768 + AES-GCM. Einen billigeren klassischen Modus für private Nachrichten gibt es nicht.

ATH kann über oder unter dem Referenzpreis gehandelt werden, sobald der offizielle Pool existiert. Die Aktivitätsbelohnung ist keine Anlagerendite, keine Gewinnerwartung und keine Preisgarantie.

## Protokollgebühr und Preis für die Nutzenden

Die Protokollgebühr ist etwas anderes als die Gesamtkosten für die Nutzenden.

Protokollgebühr:

| Art der Veröffentlichung | Protokollgebühr |
| --- | ---: |
| Öffentlicher Beitrag | 0.010 GRAM |
| Hybride private Nachricht | 0.010 GRAM |

Der Endpreis deckt die Protokollgebühr, das Gas und die Ausstattung für die Speicherung des Eintrags in seinem Shard:

| Veröffentlichung | Beigefügt |
| --- | ---: |
| Private Nachricht | 0.0191 GRAM |
| Erstkontakt | 0.0178 GRAM |
| Öffentlicher Beitrag oder Kommentar | 0.0203 GRAM |
| Avatar-Aktualisierung | 0.0395 GRAM |
| Kontoaktivierung | 0.0600 GRAM |

Die Client-Anwendung fügt stets den größeren der beiden Beträge bei — jenen, der zur Erstellung des Shards nötig ist. Der Überschuss geht nicht verloren: Der Shard behält genau das Nötige und gibt den Rest an die absendende Seite zurück. Fällt die Netzschätzung höher aus als erwartet, legt die Client-Anwendung eine Reserve obendrauf; das ist eine Reserve und keine Zahlung, und auch sie kommt zurück. ATH-Rabatte gelten für die Protokollgebühr, nicht für Netzkosten oder Speicherrücklagen.

## ATH-Rabatte

ATH senkt die Protokollgebühren für Nachrichten, sobald der Aktivitäts-Airdrop vollständig verteilt ist.

Rabatte werden erst freigeschaltet, wenn der verbleibende Airdrop beträgt:

```text
airdrop_remaining_ath == 0 ATH
```

Bis dahin wird die Protokollgebühr voll bezahlt.

Schwelle für den vollen Rabatt:

```text
10,000 ATH
```

Liegt das ATH-Guthaben in der eigenen ATH-Wallet bei mindestens `10,000 ATH`, erreicht man die volle Rabattstufe auf den Platho-Gebührenanteil. Netzkosten und Speicherrücklagen bleiben zu zahlen.

Unterhalb von `10,000 ATH` sinkt die Gebühr linear:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Die Berechnung rundet auf. Mit den aktuellen Konstanten beträgt die volle Protokollgebühr `0.010 GRAM` (`10,000,000 nanotons`) für öffentliche wie private Kapseln, und die maximale Ermäßigung liegt bei `0.010 GRAM` je Kapsel.

## Pool-Start

Der ATH/GRAM-Pool startet, nachdem der vollständige Aktivitäts-Airdrop von `15,000,000 ATH` verteilt ist.

Startreihenfolge:

1. Die Nutzenden erhalten ATH durch echte Nutzung von Platho.
2. Der vollständige Aktivitäts-Airdrop wird verteilt.
3. Die ATH-Rabatte werden freigeschaltet.
4. Der ATH/GRAM-Pool startet.
5. Routen- und Preisnachweise nach dem Pool werden eingefroren.
6. Die Rückkauf-Aufteilung wird aktiviert.

Der Pool beginnt beim Referenzpreis:

```text
1 ATH = 0.001 GRAM
```

Zuteilung der Anfangsliquidität:

```text
15,000,000 ATH
```

Die GRAM-Seite zum Startpreis:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Die vor dem Pool-Start eingenommenen Protokollgebühren finanzieren die GRAM-Seite der Anfangsliquidität vollständig. Das gehört zum Bootstrap und macht aus Aktivitätsbelohnungen keinen in GRAM lautenden Anspruch.

Der Pool startet um einen Token herum, der bereits durch Nutzung der App verteilt wurde. Genau das unterscheidet ATH von einer leeren Notierung ohne Nutzerbasis.

## FeeAccumulator

GRAM-Protokollgebühren werden im `FeeAccumulator` gesammelt.

Vor Aktivierung der Rückkauf-Aufteilung wandert das gesamte angesammelte GRAM in den Treasury-Topf:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` wächst nicht, solange die Aufteilung nicht aktiviert ist.

Nach `EnableBuybackSplit` wird das angesammelte GRAM geteilt:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Ist der Betrag in Nanoton ungerade, verbleibt der Rest auf der Rückkaufseite:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` ist eine unumkehrbare Handlung der unveränderlichen Treasury-Empfängerseite, ausgeführt nach dem Pool-Start und dem Einfrieren der Rückkaufroute. Es ist eine echte einmalige Befugnis: Sie kann keine Mittel entwenden, nicht pausieren, nicht im Notfall abziehen und keine Adressen ändern — sie ändert aber dauerhaft die Ökonomie des FeeAccumulator, von reiner Treasury-Ansammlung im Bootstrap hin zu einer 50/50-Aufteilung zwischen Treasury und Rückkauf. Aktiviert wird sie erst, wenn die Prüfung vor der Veröffentlichung bestanden ist.

Die Release-Befugnisse von Platho sind bewusst eng und meist einmalig. Es gibt sie, und sie gehören ehrlich benannt: Die Treasury-Eigentümerschaft bringt die primäre ATH-Menge einmal aus; der Genesis-Controller führt die Bindung vor der Versiegelung und die Versiegelung durch; der Start-Controller von BuybackBurn friert die Route nach dem Pool einmal ein; der Preis-Freeze von MarketStabilitySeller wird einmal von dessen Start-Controller ausgeführt; und die Treasury-Empfängerseite des FeeAccumulator aktiviert nach der Vorabprüfung die unumkehrbare Rückkauf-Aufteilung. Keine dieser Rollen ist ein Notausstieg, eine Pause, ein Upgrade, eine administrative Abhebung oder willkürliche Kontrolle über Guthaben.

## Rückkauf und Verbrennung

Der Rückkauf läuft über `FeeAccumulator` und `BuybackBurn`.

BuybackBurn akzeptiert ausschließlich einen vollständigen ausführbaren Umschlag:

```text
51.05 GRAM
```

Aufbau des Umschlags:

```text
50.00 GRAM  - STON.fi-Angebotsbetrag
1.00 GRAM   - Gas für die Routenweiterleitung
0.05 GRAM   - Gas für den pTON-Transfer
```

Bloße `50 GRAM` sind kein gültiger Rückkaufblock. Ein Rückkauf wird nur als vollständiger Routenumschlag angenommen.

Ist die Route eingefroren, führt BuybackBurn den Rückkauf so aus:

1. Nimmt `51.05 GRAM` nur vom gebundenen FeeAccumulator an.
2. Verbucht den Betrag in `reserve_due_ton`.
3. Verbraucht bei `ExecuteBuybackChunk` einen Umschlag.
4. Verwendet die eingefrorene Kursangabe und das eingefrorene minOut.
5. Setzt die STON.fi-Frist intern.
6. Sendet die Route über die eingefrorene pTON-Wallet.
7. Nimmt ATH nur über die offizielle ATH-Wallet von BuybackBurn an.
8. Prüft, ob die Quell-Wallet zum eingefrorenen STON.fi-Pool passt.
9. Schickt das erhaltene ATH über die offizielle ATH-Wallet zur Verbrennung.
10. Schließt den Zyklus erst nach `ATHBurnFinalized` von `ATHMaster` ab.

Der Erfolg eines Rückkaufs wird weder durch eine Router-Nachricht noch durch eine ausgehende Verbrennungsanfrage oder eine Verbrennungsmitteilung der ATHWallet definiert. Er ist erst definiert, wenn BuybackBurn ein authentifiziertes `ATHBurnFinalized` von ATHMaster empfängt. Bis diese Finalisierung eintrifft, gilt BuybackBurn weiterhin als im Zustand ausstehender Verbrennung oder Wiederholung; Dashboards und Indexer dürfen ATH nicht schon deshalb als verbrannt zählen, weil ein Verbrennungsversuch abgesendet wurde.

Finalisiert die Verbrennung nicht, wandert das erhaltene ATH in die Wiederholungsschuld. `RetryAthBurnDue` verbrennt diesen Betrag vollständig.

## Namensgebühren

Die Registrierung eines `.ath`-Namens wird in ATH über die offizielle ATH-Wallet von UsernameRegistry bezahlt.

Preise:

| Namenslänge | Preis |
| ---: | ---: |
| 4 Zeichen | 10,000 ATH |
| 5 Zeichen | 1,000 ATH |
| 6 und mehr | 100 ATH |

UsernameRegistry akzeptiert nur den exakten Preis. Weder Unter- noch Überzahlung erzeugt einen Namen.

Eine angenommene Prägung durchläuft einen Wartezustand und bringt ein `UsernameNFTItem` aus. Die Zahlung gilt erst als Ertrag, wenn das Item bestätigt ist. Danach wird der Betrag geteilt:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Die Prägung eines Namens wird in ATH aus der eigenen Wallet bezahlt. Ablehnungen wegen ungültigen Namens, falschen Preises oder doppelten Namens gehen über den Benachrichtigungs-Rückerstattungspfad der ATHWallet an die Eigentümerseite zurück. UsernameRegistry führt keinen separaten externen Rückerstattungstopf für Namen.

ATH aus einer Namensprägung wird erst dann zum Protokollertrag, wenn die Ausbringung des zugehörigen Items bestätigt ist.

Die Autorität über Namen ist bewusst geteilt: `UsernameRegistry` verankert den Namen an genau ein `UsernameNFTItem`, und der Zustand des Items trägt die aktuelle Eigentümerschaft. Wer das Item überträgt, überträgt den Namen. Das Item liefert Standard-NFT-Daten und On-Chain-Metadaten nach TEP-64, darunter `name = <username>.ath`; für Metadaten ist es auf keinen Platho-Server angewiesen. Die Bytes des Namens sind wörtlich zu nehmen und werden für die Anzeige nicht normalisiert: Namen mit führenden, abschließenden, aufeinanderfolgenden oder ausschließlich trennenden Zeichen sind gültig, solange jedes Byte zur erlaubten Menge `a-z`, `0-9`, `_`, `-` gehört und die Länge zwischen 4 und 16 liegt. Wurde eine Item-Ausbringung versucht, deren ACK die Registry nie erreichte, ist `PrunePendingUsernameMint` bewusst nicht zerstörend: Es unterstellt kein Scheitern, löscht den Wartezustand nicht und erzeugt keine Rückerstattungsschuld. Der Wiederherstellungsweg ist ein spätes `UsernameItemDeployedAck` oder `UsernameNFTItem.ResendDeployedAck`, sodass ein bereits initialisiertes Item noch maßgeblich werden kann. Prallt die Ausbringung tatsächlich ab, bittet die Registry die offizielle ATH-Wallet, die ausstehende Benachrichtigung zurückzugeben. Der Anker zwischen Name und Item ist die Adressableitung selbst: `UsernameRegistry.get_username_item_address(name_hash)` liefert die einzige Adresse, unter der ein Name überhaupt liegen kann. Ein ausgebrachtes `UsernameNFTItem` unter jeder anderen Adresse ist nicht maßgeblich: Clients, Indexer und Oberflächen dürfen das Item allein nicht als Eigentum am `.ath`-Namen behandeln und nach Übertragungen nicht die im Registry-Eintrag genannte Person als aktuelle Eigentümerschaft führen.

## Avatar-Gebühren

Kosten einer Avatar-Aktualisierung:

```text
100 ATH
```

Die Avatar-Aktualisierung wird in ATH aus der eigenen Wallet bezahlt: ein Transfer mit Benachrichtigung von der eigenen ATH-Wallet an die offizielle ATH-Wallet von ProfileRegistry.

ProfileRegistry akzeptiert die Aktualisierung nur, wenn alle Bedingungen erfüllt sind:

- der Betrag ist exakt `100 ATH`;
- absendend ist die offizielle ATH-Wallet von ProfileRegistry;
- die zahlende Wallet ist die ATH-Wallet der Eigentümerseite;
- die Eigentümer-Wallet liegt in der Basechain;
- der Avatar-Hash ist ungleich null;
- die Stream-Kennung ist ungleich null;
- die Anzahl der Teile liegt zwischen 1 und 16;
- das Medienformat ist WebP.

Eine angenommene Aktualisierung erzeugt eine neue Avatar-Version und teilt die Gebühr:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Eine abgelehnte Avatar-Benachrichtigung geht über den Benachrichtigungs-Rückerstattungspfad der ATHWallet zurück. ProfileRegistry legt für fehlerhafte Aktualisierungen keinen eigenen Rückerstattungstopf an.

ProfileRegistry setzt den Preis fest und rechnet die Zahlung ab, hält aber keinerlei Profilzustand: Der authentifizierte Zeiger auf den Avatar liegt im KeyShard der Eigentümerseite selbst. Die Bildbytes liegen im PublicShard in der AVATAR-Domäne; die Client-Anwendung setzt daraus oder aus einem lokalen Cache das WebP zusammen und prüft die Bytes gegen den gespeicherten `avatar_hash`. Fehlende oder abgeschnittene Historie wird als nicht verfügbar angezeigt.

## Market Stability Seller

MarketStabilitySeller ist eine öffentliche Vertragsreserve, die ATH nach dem Start des offiziellen Pools verteilt:

```text
60,000,000 ATH
```

Ihr Zweck ist es, die Verzerrung des frühen Marktes durch dünne Liquidität zu verringern. Zum Start lässt sich ein kleiner Pool von einer kleinen Gruppe früher Käuferinnen und Käufer stark bewegen. Geschieht das, müssen jene, die ATH für echte Handlungen in Platho brauchen, womöglich in eine künstliche Preisspitze hinein kaufen.

MarketStabilitySeller schafft eine transparente Angebotstreppe oberhalb des Startpreises. Er verkauft ATH in Tranchen fester Größe. Jede folgende Tranche ist teurer als die vorige, und jede hat eine harte Größenobergrenze. Nach dem einmaligen, an Nachweise gebundenen Preis-Freeze ist der Tranchenplan deterministisch und vom Team nicht von Hand änderbar.

Versuchen frühe Spekulierende, große Mengen ATH aufzusaugen, kaufen sie zu steigenden Tranchenpreisen aus der öffentlichen Reserve, statt einem dünnen Pool die gesamte billige Liquidität zu entziehen und weiterzuverkaufen. Wer ATH für Platho braucht, kann es zu einem bekannten, öffentlichen Tranchenpreis kaufen, ohne einen kleinen Pool mit einer einzigen Nachfragewelle senkrecht nach oben zu drücken.

Die Reserve wirft keine Token auf den Markt. Sie verkauft nicht von selbst und erzeugt ohne Nachfrage keinen Verkaufsdruck. Ein Verkauf findet nur statt, wenn jemand freiwillig aus der laufenden Tranche kauft. Ohne Nachfrage bleibt die Reserve untätig.

Der On-Chain-Nutzen von ATH ist konkret:

- die Registrierung eines `.ath`-Namens wird in ATH über UsernameRegistry bezahlt;
- Aktualisierungen des Avatar-Zeigers werden in ATH über ProfileRegistry bezahlt;
- ATH in der eigenen Wallet senkt nach dem Verteilungstor die Protokollgebühr für Veröffentlichungen;
- angenommene Namens- und Avatar-Gebühren erzeugen Treasury-Schuld und Verbrennungsschuld;
- BuybackBurn kauft ATH mit GRAM-Protokollgebühren und verbrennt das erhaltene ATH über ATHMaster.

Veröffentlichungen werden in GRAM direkt aus der Wallet bezahlt. ATH bezahlt nicht die gesamte Veröffentlichungstransaktion. Es senkt den Protokollgebührenanteil, sobald das Rabatt-Tor offen ist.

Damit hängt die Nachfrage nach ATH an konkreten Protokollhandlungen: `.ath`-Namen, Avatar-Aktualisierungen, Gebührenrabatte nach dem Airdrop sowie Rückkauf- und Verbrennungsdruck. MarketStabilitySeller weitet das verfügbare Angebot nur aus, wenn die nächste Tranche genommen wird; früher Zugang ist damit öffentlich und deterministisch statt von einem dünnen Pool bestimmt.

Verkauft wird die Reserve erst nach dem Preis-Freeze im Anschluss an den Pool.

Der Preis-Freeze ist eine echte, einmalige Startbefugnis. Er setzt den Basispreis der Tranche einmal aus den Nachweisen des Pool-Starts, danach wird der Hash des Start-Controllers gelöscht. Von da an kann MarketStabilitySeller keine Mittel entwenden, keine Verkäufe pausieren, keine Guthaben im Notfall abziehen, keine Kaufenden übergehen und den Preisplan nicht ändern.

MarketStabilitySeller wird beim finalen Genesis mit der vollen Reserve von `60,000,000 ATH` kapitalisiert, finanziert über den authentifizierten Reserve-Ausstattungsfluss in die offizielle Verkäufer-ATH-Wallet, bis zur harten Obergrenze von `60,000,000 ATH`. `mainnet:genesis:verify` prüft vor einer Produktionsveröffentlichung, dass die Verkäuferseite die volle Reserve trägt und die Deckung ihrer offiziellen ATH-Wallet mindestens `60,000,000 ATH` beträgt. Ein unaufgeforderter gewöhnlicher ATH-Transfer in diese offizielle Wallet erhöht die verbuchte Reserve nicht, weitet das verkäufliche Angebot nicht aus und kann feststecken; ein Guthaben über `60,000,000 ATH` gilt als Warnung, nicht als zusätzliche Reserve.

Der Verkauf ist ein eigener Schritt nach dem Pool. Vor dem Pool-Start wird die Reserve nicht verkauft; dann setzt der einmalige, an Nachweise gebundene Preis-Freeze den Basispreis der Tranche, und von da an ist der Tranchenplan deterministisch und vom Team nicht von Hand änderbar.

Die Reserve ist in 20 Tranchen geteilt:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Jede Tranche trägt einen Multiplikator:

```text
x2, x3, x4, ..., x21
```

Das ergibt eine gleichmäßige Preistreppe. Wird das Projekt beliebter, erhält der Markt zusätzliches ATH-Angebot, doch jede folgende Tranche ist teurer als die vorige. Frühe Nachfrage trifft einen dünnen Pool nicht auf einen Schlag, und der Preisanstieg wird nicht zur senkrechten Wand, die einen Utility-Token unhandlich macht.

Kaufformel:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` wird nach dem Pool-Start eingefroren und entspricht exakt dem x1-Preisnachweis.

Beim Startpreis `1 ATH = 0.001 GRAM` beträgt der x1-Preis einer Tranche:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Daraus folgt:

| Tranche | Multiplikator | Preis je 3M ATH | Preis je 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Ein einzelner Kauf darf keine Tranchengrenze überschreiten. Das verhindert, ATH der nächsten Tranche zum Preis der vorigen zu erwerben.

GRAM-Erträge werden erst anerkannt, nachdem das ATH an die kaufende Seite geliefert wurde. Schlägt der ATH-Transfer fehl oder prallt ab, wird die Reserve wiederhergestellt, die kaufende Seite erhält den gezahlten GRAM-Betrag zurück, und die Treasury-Schuld steigt nicht.

Ist die letzte Tranche x21 verkauft, reguliert MarketStabilitySeller den ATH-Preis nicht mehr. Ab da bestimmt ihn allein der Markt: Liquidität, verfügbares Angebot, Nachfrage nach `.ath`-Namen, Avatar-Aktualisierungen, Gebührenrabatte nach dem Airdrop sowie Rückkauf- und Verbrennungsdruck.

Selbst auf der Stufe x21 bleibt die Referenzbewertung gemessen am Nutzenmodell moderat:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Auf Stufe x21 hat MarketStabilitySeller seine programmierte Reservefreigabe abgeschlossen. Danach wird der ATH-Preis vollständig vom Markt bestimmt — über Liquidität, Nutzungsnachfrage, verfügbares Angebot sowie Rückkauf- und Verbrennungsdruck. Die einzige verbleibende Protokollverteilung ist der langsame Langfrist-Vesting-Plan, gedeckelt auf `100,000 ATH` pro Jahr.

## Treasury- und Verbrennungstöpfe

UsernameRegistry und ProfileRegistry nutzen dasselbe Modell zur Aufteilung der ATH-Gebühr:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Das Leeren der Treasury-Schuld sendet ATH über die offizielle ATH-Wallet an die Treasury-Empfängerseite.

Das Leeren der Verbrennungsschuld sendet über die offizielle ATH-Wallet eine ATH-Verbrennungsanfrage. Die Menge sinkt erst, wenn die Verbrennung in ATHMaster finalisiert ist.

Fehl- und Abprallpfade stellen die Schuldtöpfe wieder her. Die Buchführung bleibt erhalten, bis der nachgelagerte Transfer oder die Verbrennung abgeschlossen ist.

## Buchführung in ATHWallet

ATH-Guthaben liegen in deterministischen ATHWallet-Verträgen.

ATHWallet verarbeitet:

- die Gutschrift der Genesis-Menge;
- den gewöhnlichen Transfer;
- den Transfer mit Benachrichtigung;
- die Benachrichtigung über eine Namensprägung;
- die Avatar-Benachrichtigung;
- die Verbrennungsanfrage;
- die Bestätigung einer Benachrichtigung;
- das Beschneiden einer veralteten Benachrichtigung;
- die Wiederherstellung nach Abprall oder Fehlschlag.

Verträge, die ATH als Zahlung annehmen, akzeptieren keine direkten Nachrichten von beliebigen Adressen. Sie akzeptieren Benachrichtigungen nur von ihrer eigenen offiziellen ATHWallet. Die Authentifizierung der Quell-Wallet geschieht innerhalb der ATHWallet über deterministische Ableitung.

ATH bietet TEP-74-ähnliche Transfer-Einstiegspunkte für generisches Jetton-Werkzeug, doch die Protokollhandlungen von Platho nutzen authentifizierte ATH-Benachrichtigungen. Externe Integrationen dürfen nicht annehmen, dass Plathos Benachrichtigungsflüsse eine generische `JettonTransferNotification` aussenden.

Ausgehende interne Transfers in ATHWallet sind durch quellseitige Buchführung offener Vorgänge und eine quellseitige Bestätigung geschützt. Ein Guthaben wird ohne Nachweis eines offenen Vorgangs nicht aus dem Körper eines Abpralls wiederhergestellt.

## Lebenszyklus von ATH

1. `ATHMaster` erzeugt die feste Menge von `100,000,000 ATH`.
2. Eine einmalige Treasury-Ausbringung nimmt die Menge in der Treasury-ATH-Wallet entgegen.
3. Die Menge wird auf Aktivität, Liquidität, Langfrist-Vesting und Marktstabilität verteilt.
4. Die Nutzenden veröffentlichen Nachrichten und zahlen direkt aus der eigenen Wallet.
5. Eine erfolgreiche Veröffentlichung schreibt `10 ATH` Aktivitätsbelohnung gut.
6. Ist der Aktivitäts-Airdrop von `15,000,000 ATH` vollständig verteilt und `airdrop_remaining_ath == 0`, werden die Gebührenrabatte freigeschaltet.
7. Der ATH/GRAM-Pool startet zum Referenzpreis `1 ATH = 0.001 GRAM`.
8. Routen- und Preisnachweise nach dem Pool werden eingefroren.
9. MarketStabilitySeller verkauft die Reserve über die Tranchen x2..x21.
10. Nach Aktivierung der Aufteilung verteilt FeeAccumulator die GRAM-Gebühren zwischen Treasury und Rückkauf.
11. BuybackBurn kauft ATH mit GRAM-Gebühren und verbrennt es über ATHMaster.
12. Namens- und Profilgebühren erzeugen ATH-Treasury-Schuld und ATH-Verbrennungsschuld.
13. Die Gesamtmenge sinkt schrittweise durch authentifizierte Verbrennungen.

## Endmodell

ATH verbindet vier Schichten von Platho:

1. **Nutzung der App** — Nachrichten erzeugen Aktivitätsbelohnungen.
2. **Bezahlte Funktionen** — Namen und Avatare verlangen ATH.
3. **Rabatte** — ein ATH-Guthaben senkt die Protokollgebühr nach dem Verteilungstor.
4. **Mengenreduktion** — ein Teil der ATH-Gebühren und des Rückkaufergebnisses wird über ATHMaster verbrannt.

Das Modell beginnt mit einer festen Menge und einer Referenzbewertung von `100,000 GRAM`. Die Erstverteilung ist an echte, bezahlte Nutzung gebunden: Nachrichten beginnen bei `0.0191 GRAM` — derzeit `0.0191 GRAM` für eine private Nachricht und `0.0203 GRAM` für einen öffentlichen Beitrag — plus `10 ATH` Aktivitätsbonus je abgeschlossener Kapsel. Größere öffentliche oder private Größenklassen kosten mehr. Dieser Bonus ist keine Rückerstattung, keine Entschädigung und kein Gewinnversprechen. Sind die ersten 15% der Menge verteilt, startet der Pool, die Gebührenrabatte werden freigeschaltet und der Rückkaufweg öffnet sich.

ATH existiert als Arbeitstoken innerhalb von Platho: verteilt über Aktivität, eingesetzt in bezahlten Handlungen, senkend auf die Protokollgebühr, verkauft aus der Reserve entlang einer festgelegten Treppe und verbrannt on-chain. Nach der Marktstabilitätstreppe wird der künftige ATH-Preis vom Markt und von der Nutzung des Protokolls bestimmt.
