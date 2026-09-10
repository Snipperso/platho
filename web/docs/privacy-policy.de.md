# Datenschutzerklärung

Zuletzt aktualisiert: 29. August 2026

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
- Ihr Nachrichtenverlauf und Ihre Entwürfe.
- Ihre Einstellungen, einschließlich eines optionalen API-Schlüssels für einen öffentlichen TON-Node-Anbieter.

Nichts davon erreicht uns, und geschützt ist es auf unterschiedliche Weise —
deshalb wird hier jeder Punkt einzeln benannt statt mit einer Aussage für alle:

- **Die Wiederherstellungsphrase und die daraus abgeleiteten Schlüssel** sind mit
  einem von Ihnen gewählten Passwort verschlüsselt (AES-GCM-256, Schlüssel­ableitung
  über PBKDF2-SHA-256). Ohne dieses Passwort sind sie weder für uns noch für
  jemanden mit dem Gerät in der Hand lesbar.
- **Nachrichtenverlauf und Entwürfe** sind mit einem Schlüssel verschlüsselt, den
  Ihr Browser auf diesem Gerät erzeugt und in nicht exportierbarer Form aufbewahrt
  — nicht mit Ihrem Passwort. Auf einen anderen Rechner kopierte Daten sind daher
  unlesbar; gegen jemanden, der Ihren entsperrten Browser bereits benutzt, schützt
  das nicht.
- **Einstellungen** — Design, Sprache, Abonnements — werden als gewöhnlicher Text
  gespeichert; nichts davon ist geheim, und zu uns gelangt nichts davon. Das eine,
  was es ist — der optionale API-Schlüssel eines Node-Anbieters —, wird mit
  derselben Art Geräteschlüssel versiegelt wie der Nachrichtenverlauf, statt offen
  zu liegen.

Wenn Sie Ihre Browserdaten löschen, wird all das gelöscht, und ohne Ihre
Wiederherstellungsphrase kann es weder von uns noch von sonst jemandem
wiederhergestellt werden.

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

## Dritte, die Ihr Gerät kontaktiert

Die Anwendung hat keinen Server von uns, mit dem sie sprechen könnte, und wendet
sich deshalb direkt an die öffentliche TON-Infrastruktur. Wenn Sie Platho
nutzen, sendet Ihr Browser Anfragen an:

- `toncenter.com`
- `tonapi.io`
- `mainnet-v4.tonhubapi.com`
- `nft.fragment.com`

Diese Anbieter sehen zwangsläufig Ihre IP-Adresse und die Anfragen, die Ihr
Gerät stellt, und sie handeln nach ihren eigenen Datenschutzerklärungen, auf die
wir keinen Einfluss haben. Dies ist die einzige Stelle, an der Informationen
über Sie Ihr Gerät in Richtung einer anderen Partei als der Blockchain selbst
verlassen. Wenn Sie ein VPN oder das Tor-Netzwerk nutzen, sehen diese Anbieter
stattdessen dieses.

Wenn Sie einen eigenen API-Schlüssel für einen dieser Anbieter hinterlegen, wird
er lokal auf Ihrem Gerät gespeichert und ausschließlich an diesen Anbieter
gesendet.

## Telegram Mini App

Platho kann auch innerhalb von Telegram als Mini App laufen. In diesem Modus
bestimmt Telegram selbst, was es der Anwendung bereitstellt und was es über Ihre
Nutzung von Telegram aufzeichnet; dafür gilt die Datenschutzerklärung von
Telegram, nicht diese hier.

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
