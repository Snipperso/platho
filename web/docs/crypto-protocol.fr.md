# Cryptographie de Platho

## Clés et identité

Tout dérive d'une seule phrase de récupération : la clé du portefeuille, celle de signature, celle de chiffrement et celle de balayage. Les moitiés secrètes ne quittent jamais votre appareil — aucun serveur ne les connaît, puisqu'il n'y a pas de serveur, et le réseau non plus.

Seules les moitiés publiques partent sur la chaîne : elles résident dans votre KeyShard, dont l'adresse est liée à celle de votre portefeuille. Le fragment ne peut contenir que ce que ce portefeuille y a enregistré — ce lien par l'adresse constitue toute l'autorisation. Quatre champs y sont conservés : la clé de chiffrement, celle de signature, celle de balayage et le numéro de génération des clés.

L'identifiant de clé n'est pas attribué, il est **calculé** : `keyId = H(clé de chiffrement, empreinte de la clé ML-KEM)`. Présenter le keyId d'autrui supposerait de disposer de sa clé de chiffrement.

L'activation, c'est la première publication de vos propres clés publiques. Elle envoie 0,06 GRAM de votre portefeuille à votre KeyShard, qui garde ce que l'enregistrement et son stockage demandent et rend le reste. Pour la lancer, le portefeuille doit contenir 0,07 GRAM : chaque envoi garde 0,01 GRAM de côté pour les frais de réseau.

## Premier contact

Une première lettre à un inconnu ne peut s'appuyer sur aucun secret partagé — il n'existe pas encore. Elle emprunte donc une voie qui lui est propre.

**Comment le destinataire la trouve.** La partie publique de la capsule tient en 42 octets : un point aléatoire `R` et une étiquette `view_tag` de deux octets. Cette étiquette se calcule à partir de `R` et de la clé de **balayage** du destinataire. Celui-ci parcourt les entrées récentes et vérifie l'étiquette avec sa propre clé ; un tiers ne voit que des octets aléatoires et ne peut dire à qui la lettre s'adresse. L'adresse du destinataire ne figure pas du tout dans la partie publique.

**Comment le destinataire sait qui écrit.** Le corps chiffré contient une poignée de main : la signature de l'expéditeur sur une transcription qui lie les deux keyId, la clé statique de chiffrement de l'expéditeur, l'empreinte de sa clé ML-KEM, les deux chiffrés KEM, `R`, le `view_tag` et un numéro à usage unique. La signature est vérifiée **avant** que le moindre champ ne soit tenu pour acquis — sans quoi un attaquant pourrait greffer la signature d'autrui sur son propre matériel cryptographique.

Deux vérifications suffisent, et aucune ne nécessite de lire la chaîne :

1. le `keyId` est recalculé à partir des clés présentées et doit correspondre à celui qui est revendiqué ;
2. une étiquette de confirmation prouve que l'expéditeur **a dérivé la même clé racine**, ce qui exige le secret derrière la clé de chiffrement.

La première contraint le faussaire à utiliser la clé de la victime ; la seconde le prend précisément là : il ne pourra pas dériver la racine, l'étiquette ne concordera pas, et la lettre sera rejetée.

Une répétition octet pour octet est détectée par le numéro à usage unique de la poignée de main.

Les entrées de premier contact vivent une semaine sur la chaîne — assez pour être lues, pas assez pour devenir des archives.

## Une conversation établie

Après le premier contact, les deux parties partagent une clé racine, et toute la correspondance qui suit passe sur une seconde voie, laquelle ne dit strictement rien de ceux qui l'empruntent.

```
K_root  = HKDF( X25519(a,B) ‖ secret partagé ML-KEM-768,  info = ROOT ‖ keyId inférieur ‖ keyId supérieur )
K_epoch = HKDF( K_root,  info = RATCHET ‖ numéro d'époque )
bucket  = HKDF( K_epoch, info = BUCKET ‖ sens ‖ numéro d'époque )
```

La racine est hybride : y entrent à la fois le X25519 classique et une véritable encapsulation ML-KEM-768 randomisée. C'est en cela que consiste la résistance post-quantique — la racine ne tombe pas devant un ordinateur quantique dirigé contre le seul X25519.

Une époque dure un jour UTC. Chaque sens de la conversation écrit dans **son propre** `bucket` opaque, que seul quelqu'un connaissant la racine peut calculer. La partie publique de la capsule fait 40 octets et ne contient que ce `bucket` : ni expéditeur, ni destinataire, ni renvoi au message précédent. Qui tente d'en construire un index voit 32 octets uniformément aléatoires, impossibles à rattacher à quiconque.

## La capsule

Le corps est chiffré par un hybride X25519 et ML-KEM-768, sous chiffrement authentifié. L'identité de l'expéditeur (clé de signature, version du profil, empreinte de l'avatar) se trouve **à l'intérieur** du chiffré, non dans la partie publique.

Une capsule possède une classe de taille fixe, de 1 à 32 Ko. La taille est arrondie au palier supérieur : la longueur d'une entrée ne dit donc rien de celle du message. Ce qui dépasse est réparti sur plusieurs capsules.

## Le fil public

Les publications et les commentaires publics **ne sont pas chiffrés** — c'est leur raison d'être. Ils résident dans un PublicShard en clair, et le contrat tient l'émetteur de la transaction pour l'auteur : le portefeuille de celui-ci est donc visible.

Les commentaires vivent dans un fragment distinct, dont l'adresse se déduit des coordonnées de la publication.

## Paiement

Il n'y a pas d'intermédiaire : le client signe lui-même le message externe et paie depuis son propre portefeuille. Ni relais, ni dépositaire, ni tiers de confiance entre les deux. Depuis le passage aux contrats actuels (2026-10-04), un message privé transite par le FeeVault propre à l'expéditeur — un contrat que seul son propriétaire contrôle, qui détient une petite réserve pour son loyer et les ATH que son propriétaire a mis en jeu — qui le transmet au shard. Personne d'autre ne peut y puiser, et son propriétaire peut en retirer des fonds.

Les frais de protocole sont de 0,01 GRAM par capsule. Les ATH mis en jeu dans le vault les réduisent de 1 % à 100 % : pour chaque message privé, dont le vault est la seule porte, et pour les publications, commentaires et avatars lorsque la remise dépasse l'étape supplémentaire par le vault (pour une publication courte, à partir d'environ 1 000 ATH) ; un premier contact et une annonce d'annuaire les paient toujours en entier. Le reste du prix d'une publication correspond à ce que le réseau facture pour le gaz et le stockage. La publication publique est soumise à une modération ouverte : les modérateurs désignés par le conseil peuvent masquer une publication ou restreindre un portefeuille, et les clients qui suivent le registre de modération s'y conforment ; les messages privés ne sont pas concernés.

## Récupération

Les clés de conversation sont conservées sur l'appareil sous une clé qui n'en sort jamais. Cela survit à un rechargement et ne sert à rien après une réinstallation ; d'où une seconde copie : la table des clés racines est scellée **sous une clé dérivée de la phrase de récupération** et déposée dans votre emplacement du RecoveryShard. Un appareil neuf qui ne dispose que de la phrase retrouve l'emplacement, le lit, le déchiffre — et les conversations reviennent.

L'emplacement ne reçoit que ce qui ne peut être dérivé à nouveau.

## Ce qui est protégé et ce qui se voit

Une liste honnête — sans elle, toute promesse ne vaut pas grand-chose.

**Protégé :**

- le contenu de la correspondance privée : vous seul et votre correspondant pouvez le lire ;
- le destinataire d'un message privé : il est masqué par l'adressage furtif et par le `bucket` opaque ;
- le graphe de qui correspond avec qui : sans la clé racine, les deux sens ne peuvent être reliés l'un à l'autre.

**Visible de tous :**

- qu'un portefeuille a publié une capsule privée, quand, et de quelle classe de taille ;
- tout ce qui est public — textes, images, commentaires et le portefeuille de l'auteur.

## Durée de conservation sur la chaîne

| Quoi | Combien de temps |
|---|---|
| Premier contact | 1 semaine |
| Correspondance privée | 1 an |
| Publications et commentaires publics | 1 an |

Le délai écoulé, l'entrée est balayée hors de son fragment. La transaction qui l'a publiée demeure indéfiniment dans l'historique de la chaîne : effacer des données dans une blockchain est impossible.
