# Politique de confidentialité

Dernière mise à jour : 18 août 2026

Platho est une messagerie sans serveur dorsal. Ce document est court parce qu'il
y a très peu de choses à divulguer — et précis là où quelque chose quitte
réellement votre appareil.

## Ce que nous collectons

Rien.

Il n'existe aucun serveur Platho. L'application est une page statique qui
s'exécute entièrement dans votre navigateur. Nous n'exploitons aucun système de
comptes, aucune base de données d'utilisateurs, aucune mesure d'audience, aucun
rapport d'incident et aucune publicité. Nous ne pouvons voir ni vos messages, ni
vos contacts, ni votre solde, ni votre activité, car rien de tout cela ne nous
est transmis.

Nous ne demandons ni adresse e-mail, ni numéro de téléphone, ni nom.

## Ce qui reste sur votre appareil

- Votre phrase de récupération de 24 mots, ainsi que les clés de portefeuille et de messagerie qui en sont dérivées.
- Votre historique de messages et vos brouillons.
- Vos réglages, y compris une clé d'API facultative pour un fournisseur public de nœuds TON.

Ces données sont conservées dans le stockage local de votre navigateur et
chiffrées à l'aide d'un mot de passe que vous choisissez (AES-GCM-256 avec
dérivation de clé PBKDF2-SHA-256). Nous ne les recevons jamais. Effacer les
données de votre navigateur les supprime et, sans votre phrase de récupération,
ni nous ni quiconque d'autre ne peut les restaurer.

## Ce qui est public par conception

**Les messages privés sont chiffrés sur votre appareil** avant d'être publiés, et
seul le destinataire prévu peut en lire le contenu.

**Les publications publiques ne sont pas chiffrées.** Elles sont inscrites en
clair sur la blockchain TON et elles sont permanentes : ni nous, ni un
administrateur, ni un gouvernement, ni vous qui en êtes l'auteur ne pouvez les
supprimer. Ne publiez publiquement rien que vous pourriez avoir besoin de
retirer par la suite.

La blockchain est un registre public. Même pour les messages chiffrés, le fait
qu'une transaction a eu lieu, son heure et son coût sont visibles par n'importe
qui. Les adresses de portefeuille sont publiques. Si vous reliez ailleurs une
adresse à votre identité, l'activité de cette adresse peut vous être associée.

## Les tiers que votre appareil contacte

L'application n'a aucun serveur nous appartenant à qui parler : elle s'adresse
donc directement à l'infrastructure publique de TON. Lorsque vous utilisez
Platho, votre navigateur envoie des requêtes à :

- `toncenter.com`
- `tonapi.io`
- `mainnet-v4.tonhubapi.com`

Ces fournisseurs voient nécessairement votre adresse IP et les requêtes émises
par votre appareil ; ils appliquent leurs propres politiques de confidentialité,
que nous ne contrôlons pas. C'est le seul endroit où des informations vous
concernant quittent votre appareil vers un tiers autre que la blockchain
elle-même. Si vous utilisez un VPN ou le réseau Tor, ces fournisseurs voient
cela à la place.

Si vous fournissez votre propre clé d'API pour l'un de ces fournisseurs, elle
est stockée localement sur votre appareil et transmise uniquement à ce
fournisseur.

## Mini App Telegram

Platho peut également fonctionner à l'intérieur de Telegram sous forme de
Mini App. Dans ce mode, c'est Telegram lui-même qui détermine ce qu'il fournit à
l'application et ce qu'il enregistre sur votre utilisation de Telegram ; cela
relève de la politique de confidentialité propre à Telegram, et non de la
présente.

## Enfants

Platho ne s'adresse pas aux enfants de moins de 13 ans.

## Modifications

Si la présente politique change, la date figurant en haut change avec elle. La
version en vigueur est toujours celle publiée dans l'application et sur
platho.app.

## Langue

Ce document est publié en plusieurs langues. Les traductions sont fournies à titre de commodité ;
en cas de divergence, c'est la version anglaise qui fait foi.

## Contact

Questions concernant la présente politique : https://t.me/plathoapp
