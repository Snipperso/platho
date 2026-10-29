# Datenschutzerklärung

Zuletzt aktualisiert: 22. Oktober 2026

Platho ist ein Messenger ohne Backend. Dieses Dokument ist kurz, weil es sehr
wenig offenzulegen gibt — und genau dort konkret, wo tatsächlich etwas Ihr Gerät
verlässt.

## Was wir erheben

Nichts.

Es gibt keinen Platho-Server. Die Anwendung ist eine statische Seite, die
vollständig in Ihrem Browser läuft. Wir betreiben kein Kontosystem, keine
Nutzerdatenbank, keine Analysefunktionen, keine Absturzberichte und keine
Werbung. Wir können Ihre Nachrichten, Ihre Kontakte, Ihr Guthaben und Ihre
Aktivität nicht sehen, weil nichts davon an uns übermittelt wird.

Wir fragen weder nach einer E-Mail-Adresse noch nach einer Telefonnummer oder
einem Namen.

## Was auf Ihrem Gerät bleibt

- Ihre 24-Wort-Wiederherstellungsphrase sowie die daraus abgeleiteten Wallet- und Nachrichtenschlüssel.
- Ihr Nachrichtenverlauf. (Ein nicht gesendeter Entwurf wird nur im Arbeitsspeicher gehalten und verschwindet mit der Seite.)
- Die Namen, die Sie Ihren Kontakten geben, und welche davon Sie angeheftet haben oder nicht mehr als ungelesen markieren.
- Die Namen, die Sie Ihren Wallets geben – als gewöhnlicher Text gespeichert, damit der Sperrbildschirm sie vor jedem Passwort zeigen kann.
- Ihre Einstellungen, einschließlich eines optionalen API-Schlüssels für einen öffentlichen TON-Node-Anbieter.

Nichts davon erreicht uns, und geschützt ist es auf unterschiedliche Weise —
deshalb wird hier jeder Punkt einzeln benannt statt mit einer Aussage für alle:

- **Die Wiederherstellungsphrase und die daraus abgeleiteten Schlüssel** sind mit
  einem von Ihnen gewählten Passwort verschlüsselt (AES-GCM-256, Schlüssel­ableitung
  über PBKDF2-SHA-256). Ohne dieses Passwort sind sie weder für uns noch für
  jemanden mit dem Gerät in der Hand lesbar.
  Bewahrt ein Passwort-Manager dieses Passwort für Sie auf, ist die Wallet auf diesem Gerät
  nur so gut geschützt wie dieser Manager — meist durch Ihr Konto auf dem Gerät und, wenn
  er synchronisiert, durch seine Cloud.
- **Nachrichtenverlauf, die Schlüssel Ihrer Unterhaltungen und Gruppen, die Namen, die Sie Ihren Kontakten geben, und der Vermerk, wer Ihnen zuerst geschrieben hat,**
  sind mit Schlüsseln verschlüsselt, die aus Ihrer Wiederherstellungsphrase
  abgeleitet werden. Diese Schlüssel existieren nur, solange Ihre Wallet
  entsperrt ist, und werden nie auf das Gerät geschrieben; eine Kopie der
  Browserdateien — ein Backup, ein Festplattenabbild, ein anderes Konto auf
  demselben Rechner — liest ohne Ihr Passwort nichts davon: weder die Nachrichten
  noch die Schlüssel noch die Namen. Auf einem Gerät, das Ihre Wallet enthält, gilt dasselbe für das, was die App aufbewahrt, um Bilder, Profile und Beiträge schnell anzuzeigen, sowie für die öffentlichen Kanäle, denen Sie folgen, und dafür, wie weit Sie sie gelesen haben.
- **Einstellungen** — Design, Sprache — werden als gewöhnlicher Text gespeichert, und nichts davon gelangt zu uns.
  Ebenso die öffentlichen Kanäle, denen Sie folgen, und wie weit Sie sie gelesen haben, auf einem Gerät ohne Wallet —
  bis dort eine erstellt oder wiederhergestellt wird. Das einzige Geheimnis darunter, der optionale
  API-Schlüssel eines Node-Anbieters, wird mit einem Schlüssel versiegelt, den
  Ihr Browser auf diesem Gerät aufbewahrt, statt im Klartext gespeichert zu werden.

Wenn Sie Ihre Browserdaten löschen, wird all das vom Gerät gelöscht. Was Ihre
Wiederherstellungsphrase zurückholen kann, kommt von der Blockchain: Ihre
Nachrichten sind dort veröffentlicht, und die Schlüssel zu Ihren Unterhaltungen und
Gruppen, Ihre Notizen und Ihre Abonnements liegen ebenfalls dort, verschlüsselt mit
einem aus der Phrase abgeleiteten Schlüssel — ohne sie kann niemand, auch wir
nicht, sie lesen oder wiederherstellen. Innerhalb von Telegram können Sie eine
weitere Kopie aufbewahren, die unten unter Telegram Mini App beschrieben ist: eine
verschlüsselte Kopie Ihrer Wallet, die das Löschen der Browserdaten nicht erreicht.

## Was systembedingt öffentlich ist

**Private Nachrichten werden auf Ihrem Gerät verschlüsselt**, bevor sie
veröffentlicht werden, und nur der vorgesehene Empfänger kann ihren Inhalt
lesen.

**Öffentliche Beiträge sind nicht verschlüsselt.** Sie werden im Klartext in die
TON-Blockchain geschrieben und sind dauerhaft: Weder wir noch ein Administrator,
noch eine Regierung, noch Sie selbst als Autor können sie entfernen.
Veröffentlichen Sie nichts öffentlich, was Sie später zurücknehmen müssten.

Die Blockchain ist ein öffentliches Register. Selbst bei verschlüsselten
Nachrichten sind die Tatsache, dass eine Transaktion stattgefunden hat, ihr
Zeitpunkt und ihre Kosten für jeden sichtbar. Wallet-Adressen sind öffentlich.
Wenn Sie eine Adresse an anderer Stelle mit Ihrer Identität verknüpfen, kann die
Aktivität dieser Adresse Ihnen zugeordnet werden.

**Meldungen und Reaktionen sind öffentliche Transaktionen aus Ihrer Wallet.** Wenn
Sie einen Beitrag melden oder auf ihn reagieren, sendet Ihre Wallet die
Transaktion an eine Adresse, die jeder aus dem Beitrag berechnen kann – also kann
jeder, auch der Autor dieses Beitrags, sehen, welche Wallet gemeldet oder reagiert
hat. Eine abgewiesene Meldung und eine aufgehobene Sanktion machen ihre Wirkung
rückgängig, nicht den Eintrag: Die Transaktion bleibt für immer in der Kette.

## Dritte, die Ihr Gerät kontaktiert

Die Anwendung hat keinen Server von uns, mit dem sie sprechen könnte, und wendet
sich deshalb direkt an die öffentliche TON-Infrastruktur. Wenn Sie Platho
nutzen, sendet Ihr Browser Anfragen an:

- `toncenter.com`
- `tonapi.io`
- `nft.fragment.com`

Diese Anbieter sehen zwangsläufig Ihre IP-Adresse und die Anfragen, die Ihr
Gerät stellt, und sie handeln nach ihren eigenen Datenschutzerklärungen, auf die
wir keinen Einfluss haben. Abgesehen von dem, was Sie auf eigenen Wunsch in
Telegram aufbewahren (siehe unten unter Telegram Mini App), ist dies die einzige Stelle, an der
Informationen über Sie Ihr Gerät in Richtung einer anderen Partei als der
Blockchain selbst verlassen. Wenn Sie ein VPN oder das Tor-Netzwerk nutzen, sehen
diese Anbieter stattdessen dieses.

Wenn Sie einen eigenen API-Schlüssel für einen dieser Anbieter hinterlegen, wird
er auf Ihrem Gerät gespeichert und ausschließlich an diesen Anbieter gesendet —
und wenn Sie Ihre Wallet in Telegram aufbewahren, liegt er zusätzlich dort neben
der Kopie der Wallet, verschlüsselt (siehe unten).

## Telegram Mini App

Platho kann auch innerhalb von Telegram als Mini App laufen. In diesem Modus
bestimmt Telegram selbst, was es der Anwendung bereitstellt und was es über Ihre
Nutzung von Telegram aufzeichnet; dafür gilt die Datenschutzerklärung von
Telegram, nicht diese hier.

In diesem Modus liegt Ihre Wallet an einem von zwei Orten, und welcher es ist,
wählen Sie unter Einstellungen → „Wo die Wallet gespeichert ist“.
**Standardmäßig liegt sie nur auf diesem Gerät**: Keine Kopie davon wird an
Telegram gesendet (nur die kleinen, weiter unten beschriebenen Markierungen),
und wenn die Daten des Geräts verloren gehen — Telegram kann den Speicher einer
Anwendung leeren, vor allem auf dem iPhone —, bringen nur ihre 24 Wörter oder
ihre Schlüsseldatei die Wallet zurück.

**Wenn Sie sich dafür entscheiden, sie in Telegram aufzubewahren, wird eine
verschlüsselte Kopie Ihrer Wallet im Cloud-Speicher von Telegram aufbewahrt**
(CloudStorage), damit jedes Gerät, das bei Ihrem Telegram-Konto angemeldet ist,
sie mit Ihrem Passwort öffnen kann. Die Kopie ist derselbe mit Ihrem Passwort
verschlüsselte Datensatz, den Ihr Gerät enthält: Wiederherstellungsphrase und
Wallet-Adresse liegen innerhalb der Verschlüsselung. Daneben stehen die zum
Entschlüsseln nötigen Parameter und eine aus der Wiederherstellungsphrase
abgeleitete Kennung, an der die App ihre eigene Kopie erkennt; ohne die Phrase
lässt sich diese Kennung nicht mit Ihrer Adresse verknüpfen (Ihre Schlüsseldatei
enthält sie neben der Adresse). Telegram bewahrt die Kopie auf seinen Servern
auf und ordnet sie Ihrem Telegram-Konto zu; ohne Ihr Passwort lässt sie sich
nicht entschlüsseln, wählen Sie deshalb ein starkes Passwort, das Sie nirgendwo
sonst verwenden. Wenn Sie einen API-Schlüssel für einen Node-Anbieter hinterlegt
haben, liegt er neben der Kopie, verschlüsselt mit einem aus Ihrer
Wiederherstellungsphrase abgeleiteten Schlüssel. Jede Kopie trägt außerdem eine Versionsnummer, an der die App erkennt, welche Kopie neuer ist, und eine Signatur, erstellt mit einem aus der Wiederherstellungsphrase abgeleiteten Schlüssel, an der die App prüft, dass die Kopie und ihre Version von Ihrer Wallet stammen.

Jede Wallet, die Sie in Telegram aufbewahren, hat dort ihre eigene Kopie, verschlüsselt mit dem Passwort dieser Wallet; eine andere Wallet auf einem Gerät anzulegen oder auszuwählen löscht keine davon. Jedes Gerät, das bei Ihrem Telegram-Konto angemeldet ist, zeigt die dort aufbewahrten Wallets an — auf seinem Sperrbildschirm und unter Einstellungen → „Andere Wallets“ —, und jede öffnet sich mit ihrem eigenen Passwort. Ändert sich das Passwort einer Wallet, übernimmt ihre Kopie in Telegram das neue. Wallets, die früher auf einem Gerät genutzt wurden, werden dort auf dieselbe Weise aufbewahrt.

Im Cloud-Speicher von Telegram liegen außerdem einige kleine Werte: ein Vermerk,
dass Sie den Schnellstart geschlossen haben, ein Zeichen, dass Sie die 24 Wörter
einer Wallet bestätigt haben, und, solange die Schlüsseldatei einer Wallet noch
nicht gespeichert ist, eine Markierung; Zeichen und Markierung kann nur diese
Wallet wiedererkennen. Keiner davon enthält eine Adresse. Die App schreibt nur
dann in den Cloud-Speicher von Telegram, wenn Telegram bestätigt, dass sie aus
dem offiziellen Bot @PlathoBot geöffnet wurde. Wenn Telegram eine Kopie einer
Wallet aufbewahrt, wird der Name, den Sie dieser Wallet geben, daneben
aufbewahrt, verschlüsselt mit einem Schlüssel, der aus der
Wiederherstellungsphrase dieser Wallet abgeleitet ist – Telegram kann ihn nicht
lesen –, und er verschwindet mit der letzten Kopie dort.

„Kopie in Telegram löschen“ löscht die Kopie Ihrer Wallet dort und den daneben aufbewahrten API-Schlüssel; „Diese Wallet vergessen“ löscht eine Wallet unter „Andere Wallets“ auf diesem Gerät und ihre Kopie in Telegram. Die Funktion „Lokale Daten löschen“ der Anwendung leert nur dieses Gerät — sie löscht nichts aus Telegram —, und das Leeren des Telegram-Caches oder der Browserdaten lässt die Kopien in Telegram bestehen. Außerhalb von Telegram wird die Wallet nirgendwohin kopiert.

## Kinder

Platho richtet sich nicht an Kinder unter 13 Jahren.

## Änderungen

Wenn sich diese Erklärung ändert, ändert sich das Datum oben mit ihr. Die
aktuelle Fassung ist stets diejenige, die in der Anwendung und unter platho.app
veröffentlicht ist.

## Sprache

Dieses Dokument wird in mehreren Sprachen veröffentlicht. Die Übersetzungen dienen nur der Erleichterung;
falls sie voneinander abweichen, ist die englische Fassung maßgeblich.

## Kontakt

Fragen zu dieser Erklärung: https://t.me/plathoapp
