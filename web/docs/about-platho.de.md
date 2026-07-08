# Über Platho

Platho ist eine Kommunikations-App für Menschen, die es satt haben, für grundlegende Dinge ihres digitalen Lebens von der Infrastruktur anderer abhängig zu sein: Nachrichten, Identität, Profil, Verlauf und Zugriff auf ihre eigenen Gelder.

Das gewöhnliche Internet ist zu bequem für diejenigen gebaut, die es kontrollieren. Ein Konto kann geschlossen werden. Der Zugang kann eingeschränkt werden. Verlauf kann gelöscht werden. Regeln können geändert werden, nachdem Nutzer bereits einen Teil ihres Lebens auf eine Plattform verlagert haben. Der Nutzer ist dort kein Eigentümer. Der Nutzer ist ein Mieter, der nur so lange existiert, wie die Plattform es zulässt.

Platho ist gegen dieses Modell gebaut.

Kernaktionen in Platho werden durch das Wallet des Nutzers verankert und über offene Smart Contracts ausgeführt. Das Wallet bleibt die Wurzel der Kontrolle, während routinemäßige App-Aktivität über den Vault und signierte Befehle laufen kann, anstatt jedes Mal das Wallet direkt offenzulegen. Das macht das System nicht perfekt. Es beseitigt den zentralen Defekt gewöhnlicher Plattformen: die verborgene Fähigkeit, die Regeln umzuschreiben, den Zugang zu kappen oder die Kontrolle über das zu übernehmen, was dem Nutzer gehören sollte.

Private Nachrichten werden on-chain als verschlüsselte Kapsel-Einträge verankert. Der schwere verschlüsselte Inhalt wird im akzeptierten TON-Transaktionsbody transportiert, aus dem akzeptierten TON-Transaktionsverlauf wiederhergestellt und gegen CapsuleHub-Hashes verifiziert, sodass die Verfügbarkeit von der Verlaufsabdeckung des Anbieters und dem lokalen verschlüsselten Cache des Nutzers abhängt. Öffentliche Nachrichten, Profile und Namen verwenden verifizierbaren Contract-State anstelle einer geschlossenen Datenbank. Das verringert die Abhängigkeit von einem Server, einem Betreiber und der Richtlinie, die diese Woche gerade opportun ist.

Platho verschweigt die Kosten dieser Architektur nicht. Die Blockchain ist öffentlich. Operationen kosten Geld. Fehler von Nutzern können unumkehrbar sein. Eine verlorene Seed-Phrase kann nicht über den Support wiederhergestellt werden, und Platho ist kein permanentes Archiv: kompakte Kapsel-Einträge können nach dem Aufbewahrungsfenster beschnitten werden, während das Abrufen alter Inhalte vom Verlauf des Anbieters oder dem lokalen Cache des Nutzers abhängt. Dies ist ein hartes Modell.

Das persönliche Wallet und der Vault sind getrennt. Das Wallet bleibt die Wurzel der Kontrolle: es zahlt Gelder ein und aus und es kontrolliert die Schlüssel. Der Vault ist eine schützende Contract-Schicht zwischen dem Wallet und dem öffentlichen Netzwerk. Der Nutzer bewegt eine begrenzte Menge GRAM/ATH in den Vault, und Veröffentlichung, Protokollzahlungen und andere App-Operationen laufen über interne Guthaben und signierte Befehle. Das verringert die direkte Offenlegung des Wallets on-chain und begrenzt, wie viel Wert der routinemäßigen App-Aktivität ausgesetzt ist.

ATH ist der Utility-Token des Protokolls. Er wird für Usernames, Avatar-Updates und Protokollgebühren-Rabatte nach dem Airdrop verwendet. Seine Rolle ist an die tatsächliche Nutzung innerhalb der App gebunden.

ATH ist für die Teilnehmer des Systems konzipiert. Ein bedeutender Anteil des Angebots wird über Nutzeraktivität verteilt statt über eine geschlossene Zuteilung an frühe Adressen. Das macht die Wirtschaft weniger abhängig von einem engen Kreis von Haltern und stärker mit der realen Netzwerknutzung verbunden.

Platho hat keine verborgene administrative Kontrolle über Nutzerguthaben. Die Contracts geben niemandem einen willkürlichen Admin-Schalter, um die Gelder anderer Menschen zu beschlagnahmen, Guthaben umzuschreiben, Nutzeroperationen zu pausieren oder die Protokollregeln zu aktualisieren. V1 hat weiterhin eng dokumentierte Startbefugnisse: Genesis-Bindung und -Versiegelung, das Einfrieren der BuybackBurn-Route nach dem Pool, das Einfrieren der MarketStabilitySeller-Preisgestaltung nach dem Pool und die einmalige Aktivierung des FeeAccumulator-Buyback-Splits nach dem Preflight.

Der Punkt ist einfach: Das digitale Leben sollte nicht von der Erlaubnis einer Plattform abhängen. Nachrichten, Username, Profil und Gelder sollten dem Nutzer so weit gehören, wie ein reales System das wahr machen kann.

Platho versucht nicht, ein bequemer Käfig zu sein. Es versucht, ein Werkzeug zu sein, bei dem die Kontrolle über grundlegende digitale Dinge zu der Person zurückkehrt, die es nutzt, und nicht zu demjenigen, der den Server, die Datenbank oder die Zugriffsregeln kontrolliert.
