# Politique de confidentialité

Dernière mise à jour : 22 octobre 2026

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
- Votre historique de messages. (Un brouillon non envoyé n'est gardé qu'en mémoire et disparaît à la fermeture de la page.)
- Les noms que vous donnez à vos contacts, et ceux que vous avez épinglés ou que vous ne marquez plus comme non lus.
- Les noms que vous donnez à vos portefeuilles — conservés en texte ordinaire, pour que l’écran de verrouillage puisse les afficher avant tout mot de passe.
- Vos réglages, y compris une clé d'API facultative pour un fournisseur public de nœuds TON.

Rien de tout cela ne nous parvient, et la protection n'est pas la même pour
chacun — chaque élément est donc nommé séparément plutôt qu'en une seule phrase :

- **La phrase de récupération et les clés qui en dérivent** sont chiffrées avec un
  mot de passe que vous choisissez (AES-GCM-256, dérivation de clé
  PBKDF2-SHA-256). Sans ce mot de passe, elles sont illisibles, pour nous comme
  pour quiconque tient l'appareil.
  Si un gestionnaire de mots de passe conserve ce mot de passe pour vous, le
  portefeuille de cet appareil n'est protégé qu'autant que ce gestionnaire — en général
  votre compte sur l'appareil et, s'il se synchronise, son nuage.
- **L'historique des messages, les clés de vos conversations et de vos groupes, les noms que vous donnez à vos contacts et la trace de qui vous a écrit en premier**
  sont chiffrés avec des clés dérivées de votre phrase de récupération. Ces clés
  n'existent que tant que votre portefeuille est déverrouillé et ne sont jamais
  écrites sur l'appareil : une copie des fichiers du navigateur — une sauvegarde,
  une image disque, un autre compte sur le même ordinateur — n'en lit rien sans
  votre mot de passe : ni les messages, ni les clés, ni les noms. Sur un appareil qui contient votre portefeuille, il en va de même de ce que l'application conserve pour afficher rapidement les images, les profils et les publications, ainsi que des chaînes publiques que vous suivez et de l'endroit où vous en êtes de leur lecture.
- **Les réglages** — thème, langue — sont stockés en texte ordinaire, et rien de tout cela ne nous parvient. Il en va
  de même des chaînes publiques que vous suivez et de l'endroit où vous en êtes de leur lecture sur un appareil sans
  portefeuille, jusqu'à ce qu'un portefeuille y soit créé ou restauré. Le seul secret parmi eux, la clé d'API facultative d'un
  fournisseur de nœuds, est scellé avec une clé que votre navigateur conserve sur
  cet appareil, au lieu d'être stocké en clair.

Effacer les données de votre navigateur supprime tout cela de l'appareil. Ce que
votre phrase de récupération peut faire revenir vient de la blockchain : vos
messages y sont publiés, et les clés qui ouvrent vos conversations et vos groupes,
vos notes et vos abonnements y sont aussi conservés, chiffrés avec une clé dérivée
de la phrase — sans elle, personne, pas même nous, ne peut les lire ni les
restaurer. Dans Telegram, vous pouvez conserver une copie de plus, décrite plus
bas dans Mini App Telegram : une copie chiffrée de votre portefeuille que
l'effacement des données du navigateur n'atteint pas.

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

**Les signalements et les réactions sont des transactions publiques depuis votre
portefeuille.** Lorsque vous signalez une publication ou y réagissez, la
transaction est envoyée par votre portefeuille à une adresse que n'importe qui
peut calculer à partir de la publication ; n'importe qui — y compris l'auteur de
cette publication — peut donc voir quel portefeuille a signalé ou réagi. Un
signalement rejeté et une sanction levée annulent leur effet, pas la trace : la
transaction reste sur la chaîne pour toujours.

## Les tiers que votre appareil contacte

L'application n'a aucun serveur nous appartenant à qui parler : elle s'adresse
donc directement à l'infrastructure publique de TON. Lorsque vous utilisez
Platho, votre navigateur envoie des requêtes à :

- `toncenter.com`
- `tonapi.io`
- `nft.fragment.com`

Ces fournisseurs voient nécessairement votre adresse IP et les requêtes émises
par votre appareil ; ils appliquent leurs propres politiques de confidentialité,
que nous ne contrôlons pas. Hormis ce que vous choisissez de conserver dans
Telegram (voir Mini App Telegram plus bas), c'est le seul endroit où des informations vous
concernant quittent votre appareil vers un tiers autre que la blockchain
elle-même. Si vous utilisez un VPN ou le réseau Tor, ces fournisseurs voient
cela à la place.

Si vous fournissez votre propre clé d'API pour l'un de ces fournisseurs, elle
est stockée sur votre appareil et transmise uniquement à ce fournisseur — et, si
vous conservez votre portefeuille dans Telegram, elle est aussi conservée,
chiffrée, à côté de la copie du portefeuille qui s'y trouve (voir plus bas).

## Mini App Telegram

Platho peut également fonctionner à l'intérieur de Telegram sous forme de
Mini App. Dans ce mode, c'est Telegram lui-même qui détermine ce qu'il fournit à
l'application et ce qu'il enregistre sur votre utilisation de Telegram ; cela
relève de la politique de confidentialité propre à Telegram, et non de la
présente.

Dans ce mode, votre portefeuille vit à l'un de deux endroits, et c'est vous qui
choisissez lequel dans Paramètres → « Où le portefeuille est conservé ». **Par
défaut, il vit sur cet appareil uniquement** : aucune copie n'en est envoyée à
Telegram (seules les petites marques décrites plus bas le sont), et si les
données de l'appareil sont perdues — Telegram peut effacer le stockage d'une
application, en particulier sur iPhone —, seuls ses 24 mots ou son fichier de
clé permettent de le récupérer.

**Si vous choisissez de le conserver dans Telegram, une copie chiffrée de votre
portefeuille est conservée dans le stockage cloud de Telegram** (CloudStorage),
afin que tout appareil connecté à votre compte Telegram puisse l'ouvrir avec
votre mot de passe. La copie est le même enregistrement chiffré par votre mot de
passe que celui de votre appareil : la phrase de récupération et l'adresse du
portefeuille sont à l'intérieur du chiffrement. À côté figurent les paramètres
nécessaires pour la déchiffrer et un identifiant dérivé de la phrase de
récupération, grâce auquel l'application reconnaît sa propre copie ; sans la
phrase, cet identifiant ne peut pas être relié à votre adresse (votre fichier de
clé le contient à côté de l'adresse). Telegram conserve cette copie sur ses
serveurs et l'associe à votre compte Telegram ; sans votre mot de passe, elle ne
peut pas être déchiffrée : choisissez donc un mot de passe robuste que vous
n'utilisez nulle part ailleurs. Si vous avez fourni une clé d'API pour un
fournisseur de nœuds, elle est conservée à côté de la copie, chiffrée avec une
clé dérivée de votre phrase de récupération. Chaque copie porte aussi un numéro de version, grâce auquel l'application sait quelle copie est la plus récente, et une signature faite avec une clé dérivée de votre phrase de récupération, grâce à laquelle l'application vérifie que la copie et sa version proviennent de votre portefeuille.

Chaque portefeuille que vous conservez dans Telegram y a sa propre copie, chiffrée avec le mot de passe de ce portefeuille ; créer ou choisir un autre portefeuille sur un appareil n'en supprime aucune. Tout appareil connecté à votre compte Telegram affiche les portefeuilles qui y sont conservés — sur son écran de verrouillage et dans Paramètres → « Autres portefeuilles » —, et chacun s'ouvre avec son propre mot de passe. Quand le mot de passe d'un portefeuille change, sa copie dans Telegram prend le nouveau. Les portefeuilles utilisés auparavant sur un appareil y sont conservés de la même manière.

Quelques petites valeurs sont aussi conservées dans le cloud de Telegram : une
note indiquant que vous avez fermé le démarrage rapide, une marque indiquant que
vous avez confirmé les 24 mots d'un portefeuille et, tant que le fichier de clé
d'un portefeuille n'a pas été enregistré, un repère ; la marque et le repère ne
peuvent être reconnus que par ce portefeuille. Aucune d'elles ne contient
d'adresse. L'application n'écrit dans le cloud de Telegram que si Telegram
confirme qu'elle a été ouverte depuis le bot officiel @PlathoBot. Quand Telegram
conserve une copie d’un portefeuille, le nom que vous lui donnez est conservé à
côté, chiffré avec une clé dérivée de la phrase de récupération de ce
portefeuille — Telegram ne peut pas le lire — et disparaît avec la dernière
copie qui s’y trouve.

« Supprimer la copie dans Telegram » supprime la copie de votre portefeuille qui s'y trouve et la clé d'API conservée à côté ; « Oublier ce portefeuille » supprime un portefeuille de « Autres portefeuilles » sur cet appareil ainsi que sa copie dans Telegram. L'option « Effacer les données locales » de l'application n'efface que cet appareil — elle ne supprime rien dans Telegram —, et vider le cache de Telegram ou les données du navigateur laisse les copies dans Telegram en place. Hors de Telegram, le portefeuille n'est copié nulle part.

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
