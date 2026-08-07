# Kryptografie von Platho

## Schlüssel und Identität

Alles wird aus einer einzigen Seed-Phrase abgeleitet: der Wallet-Schlüssel, der Signaturschlüssel, der Verschlüsselungsschlüssel und der Scan-Schlüssel. Die geheimen Hälften verlassen Ihr Gerät nie — kein Server kennt sie, denn es gibt keinen Server, und das Netzwerk kennt sie ebenso wenig.

Auf die Chain gehen nur die öffentlichen Hälften. Sie liegen in Ihrem KeyShard, dessen Adresse an Ihre Wallet-Adresse gebunden ist; der Shard kann also nur enthalten, was diese Wallet dort registriert hat — diese Adressbindung ist die gesamte Autorisierung. Gespeichert werden vier Felder: Verschlüsselungsschlüssel, Signaturschlüssel, Scan-Schlüssel und die Nummer der Schlüsselgeneration.

Die Schlüsselkennung wird nicht vergeben, sondern **berechnet**: `keyId = H(Verschlüsselungsschlüssel, Hash des ML-KEM-Schlüssels)`. Wer die keyId eines anderen vorlegen will, bräuchte dessen Verschlüsselungsschlüssel.

Die Aktivierung ist die erste Veröffentlichung Ihrer eigenen öffentlichen Schlüssel. Sie kostet 0,06 GRAM, bezahlt aus Ihrer Wallet.

## Erstkontakt

Ein erster Brief an eine fremde Person kann sich auf kein gemeinsames Geheimnis stützen — es existiert noch nicht. Er nimmt deshalb eine eigene Spur.

**Wie die Empfängerseite ihn findet.** Der öffentliche Teil der Kapsel umfasst 42 Byte: einen zufälligen Punkt `R` und eine zwei Byte lange Marke `view_tag`. Diese Marke wird aus `R` und dem **Scan**-Schlüssel der Empfängerseite berechnet. Sie geht die jüngsten Einträge durch und prüft die Marke mit dem eigenen Schlüssel; von außen sind nur zufällige Bytes zu sehen, und niemand kann sagen, an wen der Brief gerichtet ist. Die Adresse der Empfängerseite steht überhaupt nicht im öffentlichen Teil.

**Wie die Empfängerseite erfährt, wer schreibt.** Im verschlüsselten Körper steckt ein Handshake: die Signatur der Absenderseite über ein Transkript, das beide keyIds, den statischen Verschlüsselungsschlüssel der Absenderseite, den Hash ihres ML-KEM-Schlüssels, beide KEM-Chiffrate, `R`, den `view_tag` und eine Einmalzahl bindet. Die Signatur wird geprüft, **bevor** irgendein Feld für bare Münze genommen wird — sonst könnte ein Angreifer eine fremde Signatur auf sein eigenes Schlüsselmaterial aufpfropfen.

Zwei Prüfungen genügen, und keine davon braucht einen Lesezugriff auf die Chain:

1. die `keyId` wird aus den vorgelegten Schlüsseln neu berechnet und muss mit der behaupteten übereinstimmen;
2. eine Bestätigungsmarke beweist, dass die Absenderseite **denselben Wurzelschlüssel abgeleitet hat**, wozu das Geheimnis hinter dem Verschlüsselungsschlüssel nötig ist.

Die erste zwingt eine fälschende Partei, den Schlüssel des Opfers zu verwenden; die zweite stellt sie genau dort: Den Wurzelschlüssel kann sie nicht ableiten, die Marke passt nicht, der Brief wird abgewiesen.

Eine Byte-für-Byte-Wiederholung fängt die Einmalzahl des Handshakes ab.

Erstkontakt-Einträge leben eine Woche auf der Chain — lange genug, um gelesen zu werden, zu kurz, um zum Archiv zu werden.

## Eine bestehende Unterhaltung

Nach dem Erstkontakt teilen beide Seiten einen Wurzelschlüssel, und der gesamte weitere Austausch wechselt auf eine zweite Spur, die über die Beteiligten schlicht nichts aussagt.

```
K_root  = HKDF( X25519(a,B) ‖ gemeinsames ML-KEM-768-Geheimnis,  info = ROOT ‖ kleinere keyId ‖ größere keyId )
K_epoch = HKDF( K_root,  info = RATCHET ‖ Epochennummer )
bucket  = HKDF( K_epoch, info = BUCKET ‖ Richtung ‖ Epochennummer )
```

Die Wurzel ist hybrid: In sie gehen sowohl das klassische X25519 als auch eine echte, randomisierte ML-KEM-768-Kapselung ein. Genau darin besteht die post-quantensichere Stärke — die Wurzel fällt nicht vor einem Quantenrechner, der allein auf X25519 zielt.

Eine Epoche ist ein UTC-Tag. Jede Richtung einer Unterhaltung schreibt in ihren **eigenen** undurchsichtigen `bucket`, den nur berechnen kann, wer die Wurzel kennt. Der öffentliche Teil der Kapsel misst 40 Byte und enthält allein diesen `bucket`: keine Absenderseite, keine Empfängerseite, keinen Verweis auf eine vorherige Nachricht. Wer daraus einen Index bauen will, sieht gleichverteilt zufällige 32 Byte, die sich niemandem zuordnen lassen.

## Die Kapsel

Der Körper wird hybrid aus X25519 und ML-KEM-768 verschlüsselt, darüber liegt authentifizierte Verschlüsselung. Die Identität der Absenderseite (Signaturschlüssel, Profilversion, Avatar-Fingerabdruck) liegt **innerhalb** des Chiffrats, nicht im öffentlichen Teil.

Eine Kapsel hat eine feste Größenklasse, von 1 bis 32 KB. Die Größe wird aufgerundet, weshalb die Länge eines Eintrags nichts über die Länge der Nachricht verrät. Was darüber hinausgeht, wird auf mehrere Kapseln verteilt.

## Der öffentliche Feed

Öffentliche Beiträge und Kommentare werden **nicht verschlüsselt** — dafür sind sie da. Sie liegen im Klartext in einem PublicShard, und der Vertrag betrachtet die absendende Partei der Transaktion als Urheberin, deren Wallet damit sichtbar ist.

Kommentare leben in einem eigenen Shard, dessen Adresse sich aus den Koordinaten des Beitrags ableitet.

## Bezahlung

Es gibt keine Zwischeninstanz: Die Client-Anwendung signiert die externe Nachricht selbst und zahlt aus der eigenen Wallet. Kein Relay, keine internen Guthaben, keine vertrauenswürdige Stelle, die eine Veröffentlichung verweigern könnte.

Die Protokollgebühr beträgt 0,01 GRAM je Kapsel, für einen Erstkontakt wie für eine Unterhaltung gleich. Der Rest des Veröffentlichungspreises ist das, was das Netzwerk für Gas und Speicher berechnet.

## Wiederherstellung

Die Schlüssel der Unterhaltungen liegen auf dem Gerät unter einem Schlüssel, der es nie verlässt. Das übersteht ein Neuladen und nützt nach einer Neuinstallation nichts, daher gibt es eine zweite Kopie: Die Tabelle der Wurzelschlüssel wird **unter einem aus der Seed-Phrase abgeleiteten Schlüssel** versiegelt und in Ihren Platz im RecoveryShard gelegt. Ein frisches Gerät, das nur die Seed-Phrase hat, findet den Platz, liest ihn und entschlüsselt ihn — und die Unterhaltungen sind zurück.

In den Platz kommt nur, was sich nicht erneut ableiten lässt.

## Was geschützt ist und was sichtbar bleibt

Eine ehrliche Liste — ohne sie ist jedes Versprechen wenig wert.

**Geschützt:**

- der Inhalt privater Korrespondenz: lesen können ihn nur Sie und die Person, der Sie schreiben;
- an wen eine private Nachricht gerichtet ist: die Empfängerseite verbirgt sich hinter der Stealth-Adressierung und dem undurchsichtigen `bucket`;
- der Graph, wer mit wem korrespondiert: ohne Wurzelschlüssel lassen sich die beiden Richtungen nicht miteinander verknüpfen.

**Für alle sichtbar:**

- dass eine Wallet eine private Kapsel veröffentlicht hat, wann, und in welcher Größenklasse;
- alles Öffentliche — Text, Bilder, Kommentare und die Wallet der urhebenden Person.

## Aufbewahrung auf der Chain

| Was | Wie lange |
|---|---|
| Erstkontakt | 1 Woche |
| Private Korrespondenz | 1 Jahr |
| Öffentliche Beiträge und Kommentare | 1 Jahr |

Nach Ablauf der Frist wird der Eintrag aus seinem Shard entfernt. Die Transaktion, die ihn veröffentlicht hat, bleibt unbefristet in der Historie der Chain: Daten in einer Blockchain zu löschen ist nicht möglich.
