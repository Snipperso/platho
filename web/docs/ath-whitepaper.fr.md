# Livre blanc ATH

## Le jeton du protocole Platho

ATH est le jeton utilitaire de Platho. Il sert aux récompenses d'activité, aux noms `.ath`, aux mises à jour d'avatar, aux ventes de stabilité de marché, au rachat et à la destruction.

ATH n'est pas un jeton administratif. Il ne confère aucun pouvoir de réécrire des soldes, de suspendre des opérations, d'émettre de nouveaux jetons ou de modifier ce que possèdent les personnes qui l'utilisent. Son rôle est d'alimenter l'économie de l'application et de relier l'usage de Platho à la comptabilité on-chain.

Ce document décrit le modèle ATH dans Platho.

## Paramètres principaux

ATH a une offre totale fixe :

```text
100,000,000 ATH
```

Prix de référence au lancement :

```text
1 ATH = 0.001 GRAM
```

Valorisation entièrement diluée au lancement :

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH démarre sur une capitalisation de référence de `100,000 GRAM`.

## Offre fixe

ATH est émis par le contrat `ATHMaster`. À l'initialisation, `ATHMaster` fixe l'offre totale à `100,000,000 ATH`.

Il n'existe aucune fonction d'émission après le genèse. `ATHMaster` n'implémente ni frappe administrative, ni pause, ni liste noire, ni taxe de transfert, ni transfert forcé, ni retrait d'urgence.

L'émission primaire n'a lieu qu'une fois, via `DeployTreasurySupply`, qui envoie l'intégralité de l'offre au portefeuille ATH de trésorerie. L'émission de genèse ne peut pas être répétée.

L'offre totale ne diminue que par destruction. `ATHMaster` n'accepte une destruction qu'après une notification authentifiée provenant du portefeuille ATH déterministe de l'adresse propriétaire. Une fois vérifiée, `ATHMaster` réduit `total_supply` et envoie `ATHBurnFinalized`.

Détruire de l'ATH est une réduction réelle de l'offre totale, et non un transfert vers une adresse inutilisée.

## Répartition de l'offre

L'offre d'ATH se répartit en quatre catégories :

| Catégorie | Part | Quantité |
| --- | ---: | ---: |
| Airdrop d'activité | 15% | 15,000,000 ATH |
| Liquidité initiale | 15% | 15,000,000 ATH |
| Vesting de protocole à long terme | 10% | 10,000,000 ATH |
| Réserve de stabilité de marché | 60% | 60,000,000 ATH |

Cette répartition définit la structure économique de Platho :

- 15% de l'offre est distribuée aux personnes qui utilisent l'application, par l'activité, avant le lancement du pool.
- 15% de l'offre sert de liquidité initiale.
- 10% de l'offre est verrouillée dans un vesting immuable à long terme.
- 60% de l'offre est versée à MarketStabilitySeller et verrouillée au genèse, puis vendue par tranches au-dessus du prix de lancement, une fois le gel des prix effectué après le pool.

Au genèse final, l'airdrop d'activité et la réserve de vesting à long terme sont couverts par les portefeuilles ATH officiels d'AirdropPool et d'ATHVesting, et le vérificateur de publication contrôle ces soldes avant une mise en production. La réserve de stabilité de `60,000,000 ATH` est versée à MarketStabilitySeller et verrouillée au genèse final, couverte par son portefeuille ATH officiel de vente, et le vérificateur contrôle cette couverture avant une mise en production. La réserve est capitalisée dès le départ, mais elle n'est pas vendue avant le lancement du pool, moment où un gel des prix unique et lié aux preuves fixe le prix de base de la tranche.

## Vesting de protocole à long terme

La réserve de vesting à long terme est de :

```text
10,000,000 ATH
```

Elle est conservée dans `ATHVesting`, et non dans un compartiment de trésorerie modifiable. Le calendrier est inscrit dans le contrat :

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

N'importe qui peut déclencher une demande de versement une fois l'ATH acquis, mais la personne bénéficiaire est immuable. Le contrat n'a ni accélération, ni changement de bénéficiaire, ni pause, ni retrait administratif, ni sortie d'urgence, ni libération discrétionnaire.

Au genèse final, le portefeuille officiel `ATHWallet(owner = ATHVesting, master = ATHMaster)` doit contenir exactement `10,000,000 ATH`. Le vérificateur exige en outre zéro ATH réclamé, une phase inactive et aucun transfert en attente avant le lancement.

Cette réserve est délibérément lente. Elle ouvre un long horizon pour le développement du protocole sans placer, au lancement, un bloc liquide de 10M ATH au-dessus du marché.

## Airdrop d'activité

L'airdrop d'activité est de :

```text
15,000,000 ATH
```

Récompense par publication réussie :

```text
10 ATH
```

Chaque capsule acceptée rapporte `10 ATH` à la personne qui l'envoie, à l'identique sur toutes les voies. Une tentative de publication échouée ne rapporte rien.

Le versement se fait par lots, et non capsule par capsule. Chaque livraison porte un coût fixe non récupérable d'environ `0.0166 GRAM`, et ce coût ne dépend pas de la quantité d'ATH qu'elle transporte. Payer après chaque capsule coûterait davantage que ce que ces capsules collectent en frais de protocole ; la récompense s'accumule donc et arrive en un seul versement.

L'airdrop est couvert par le portefeuille ATH officiel d'`AirdropPool`, où se trouvent ces `15,000,000 ATH`. Une fois épuisés, les récompenses d'activité cessent.

## Prix de l'activité

Les messages partent du prix de base actuel :

```text
0.0191 GRAM
```

Chiffres exacts actuels :

```text
message privé :    0.0191 GRAM
premier contact :  0.0178 GRAM
publication :      0.0203 GRAM
```

Pour chaque publication réussie, on reçoit :

```text
10 ATH
```

Au prix de référence du lancement :

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Cela relie la distribution initiale d'ATH à l'usage réel de l'application. La récompense est une prime d'activité, non un remboursement, un cashback, une remise, ni la promesse qu'ATH compense le coût en GRAM d'une publication. La valeur de référence de `10 ATH` peut être inférieure au coût en GRAM d'une capsule, et c'est délibéré : on reçoit une propriété précoce du réseau pour un usage réel, pas une compensation garantie.

Tarification des capsules : une publication publique à partir de `0.0203 GRAM`, une capsule privée à partir de `0.0191 GRAM`. Les blocs de capsule publics ou privés plus grands coûtent davantage, car le corps choisi de 1, 2, 4, 8, 16 ou 32 Kio modifie la réserve d'exécution et de stockage dans le fragment. La récompense reste de `10 ATH` par capsule finalisée avec succès, quelle que soit sa taille.

Une publication privée utilise par défaut le profil de sécurité hybride : X25519 + ML-KEM-768 + AES-GCM. Il n'existe pas de mode classique moins cher pour les messages privés.

ATH peut s'échanger au-dessus ou en dessous du prix de référence une fois le pool officiel en place. La récompense d'activité n'est ni un rendement d'investissement, ni une attente de profit, ni une garantie de prix.

## Frais de protocole et prix pour l'utilisateur

Les frais de protocole sont distincts du coût total supporté par la personne qui publie.

Frais de protocole :

| Type de publication | Frais de protocole |
| --- | ---: |
| Publication publique | 0.010 GRAM |
| Message privé hybride | 0.010 GRAM |

Le prix final couvre les frais de protocole, le gaz et la dotation de stockage de l'entrée dans son fragment :

| Publication | Montant joint |
| --- | ---: |
| Message privé | 0.0191 GRAM |
| Premier contact | 0.0178 GRAM |
| Publication ou commentaire public | 0.0203 GRAM |
| Mise à jour d'avatar | 0.0395 GRAM |
| Activation du compte | 0.0600 GRAM |

Le client joint toujours le plus élevé des deux montants — celui qu'exige la création du fragment. L'excédent n'est pas perdu : le fragment ne garde que ce dont il a besoin et renvoie le reste à l'expéditeur. Si l'estimation réseau revient plus élevée que prévu, le client ajoute une marge par-dessus ; c'est une marge et non un paiement, et elle est également restituée.

## Lancement du pool

Le pool ATH/GRAM est lancé après la distribution intégrale de l'airdrop d'activité de `15,000,000 ATH`.

Séquence de lancement :

1. Les personnes reçoivent de l'ATH par un usage réel de Platho.
2. L'airdrop d'activité complet est distribué.
3. Le pool ATH/GRAM est lancé.
4. Les preuves de route et de prix postérieures au pool sont gelées.
5. Le partage de rachat est activé.

Le pool démarre au prix de référence :

```text
1 ATH = 0.001 GRAM
```

Allocation de liquidité initiale :

```text
15,000,000 ATH
```

Le côté GRAM au prix de lancement :

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Les frais de protocole collectés avant le lancement financent intégralement le côté GRAM de la liquidité initiale. Cela relève de l'amorçage et ne transforme pas les récompenses d'activité en créance libellée en GRAM.

Le pool est lancé autour d'un jeton déjà distribué par l'usage de l'application. C'est ce qui distingue ATH d'une cotation vide sans base d'utilisateurs.

## FeeAccumulator

Les frais de protocole en GRAM sont collectés dans `FeeAccumulator`.

Avant l'activation du partage de rachat, tout le GRAM accumulé va au compartiment de trésorerie :

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` ne croît pas tant que le partage n'est pas activé.

Après `EnableBuybackSplit`, le GRAM accumulé est divisé :

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Si le montant en nanotons est impair, le reste demeure du côté rachat :

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` est une action sans retour, exécutée par la personne destinataire immuable de la trésorerie après le lancement du pool et le gel de la route de rachat. C'est un pouvoir réel à usage unique : il ne peut ni voler des fonds, ni suspendre, ni vider en urgence, ni changer d'adresses, mais il modifie définitivement l'économie de FeeAccumulator, d'une accumulation d'amorçage réservée à la trésorerie vers un partage 50/50 trésorerie/rachat. Il n'est activé qu'après le contrôle préalable à la publication.

Les pouvoirs de publication de Platho sont volontairement étroits et presque tous à usage unique. Ils existent, et il faut les nommer honnêtement : la propriété de la trésorerie déploie une fois l'offre primaire d'ATH ; le contrôleur de genèse effectue la liaison pré-scellement puis le scellement ; le contrôleur de lancement de BuybackBurn gèle une fois la route postérieure au pool ; le gel des prix de MarketStabilitySeller est effectué une fois par son contrôleur de lancement ; et la personne destinataire de la trésorerie chez FeeAccumulator active le partage de rachat sans retour après le contrôle préalable. Aucun de ces rôles n'est une sortie d'urgence, une pause, une mise à jour, un retrait administratif ou un contrôle arbitraire sur les soldes.

## Rachat et destruction

Le rachat passe par `FeeAccumulator` et `BuybackBurn`.

BuybackBurn n'accepte qu'une enveloppe exécutable complète :

```text
51.05 GRAM
```

Structure de l'enveloppe :

```text
50.00 GRAM  - montant de l'offre STON.fi
1.00 GRAM   - gaz de transfert de route
0.05 GRAM   - gaz de transfert pTON
```

`50 GRAM` seuls ne constituent pas un bloc de rachat valide. Le rachat n'est accepté que sous forme d'enveloppe de route complète.

Une fois la route gelée, BuybackBurn effectue le rachat ainsi :

1. Accepte `51.05 GRAM` uniquement du FeeAccumulator lié.
2. Inscrit le montant dans `reserve_due_ton`.
3. Sur `ExecuteBuybackChunk`, consomme une enveloppe.
4. Utilise la cotation gelée et le minOut gelé.
5. Fixe en interne l'échéance STON.fi.
6. Envoie la route via le portefeuille pTON gelé.
7. N'accepte l'ATH que par le portefeuille ATH officiel de BuybackBurn.
8. Vérifie que le portefeuille source correspond au pool STON.fi gelé.
9. Envoie l'ATH reçu à la destruction via le portefeuille ATH officiel.
10. Ne clôt le cycle qu'après `ATHBurnFinalized` d'`ATHMaster`.

Le succès d'un rachat n'est défini ni par un message du routeur, ni par une demande de destruction sortante, ni par une notification de destruction d'ATHWallet. Il n'est défini que lorsque BuybackBurn reçoit un `ATHBurnFinalized` authentifié d'ATHMaster. Tant que cette finalisation n'est pas arrivée, BuybackBurn reste en état de destruction en attente ou de nouvelle tentative ; tableaux de bord et indexeurs ne doivent pas compter l'ATH comme détruit au seul motif qu'une tentative a été envoyée.

Si la destruction n'aboutit pas, l'ATH reçu passe en dette de nouvelle tentative. `RetryAthBurnDue` détruit l'intégralité de ce montant.

## Frais de nom

Enregistrer un nom `.ath` se paie en ATH via le portefeuille ATH officiel d'UsernameRegistry.

Prix :

| Longueur du nom | Prix |
| ---: | ---: |
| 4 caractères | 10,000 ATH |
| 5 caractères | 1,000 ATH |
| 6 et plus | 100 ATH |

UsernameRegistry n'accepte que le prix exact. Un paiement insuffisant comme un paiement excédentaire ne crée pas de nom.

Une frappe acceptée passe par un état en attente et déploie un `UsernameNFTItem`. Le paiement n'est comptabilisé en produit qu'une fois l'item confirmé. L'item confirmé, le montant est partagé :

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

La frappe d'un nom se paie en ATH depuis le portefeuille personnel. Les refus pour nom invalide, prix erroné ou nom déjà pris sont restitués à la personne propriétaire par la voie de remboursement des notifications ATHWallet. UsernameRegistry ne tient aucun compartiment de remboursement externe pour les noms.

L'ATH issu d'une frappe de nom ne devient un produit du protocole qu'après confirmation du déploiement de l'item correspondant.

L'autorité sur les noms est volontairement scindée : `UsernameRegistry` ancre le nom à un `UsernameNFTItem` précis, et l'état de l'item porte la propriété actuelle. Transférer l'item transfère le nom. L'item fournit des données NFT standard et des métadonnées TEP-64 on-chain, dont `name = <username>.ath` ; il ne dépend d'aucun serveur Platho pour ses métadonnées. Les octets du nom sont littéraux et ne sont pas normalisés à l'affichage : les noms comportant des séparateurs en tête, en fin, consécutifs ou exclusivement composés de séparateurs sont valides dès lors que chaque octet appartient à l'ensemble autorisé `a-z`, `0-9`, `_`, `-` et que la longueur est comprise entre 4 et 16. Si un déploiement d'item a été tenté mais que son ACK n'est jamais parvenu au registre, `PrunePendingUsernameMint` est délibérément non destructif : il ne présume pas l'échec, ne supprime pas l'état en attente et ne crée pas de dette de remboursement. La voie de rattrapage est un `UsernameItemDeployedAck` tardif ou `UsernameNFTItem.ResendDeployedAck`, de sorte qu'un item déjà initialisé peut encore devenir faisant autorité. Si le déploiement rebondit réellement, le registre demande au portefeuille ATH officiel de restituer la notification en attente. L'ancrage entre le nom et l'item est la dérivation d'adresse elle-même : `UsernameRegistry.get_username_item_address(name_hash)` donne l'unique adresse où un nom peut résider. Un `UsernameNFTItem` déployé à toute autre adresse ne fait pas autorité : clients, indexeurs et interfaces ne doivent pas traiter l'item seul comme la propriété du nom `.ath`, ni retenir la personne propriétaire inscrite au registre comme propriétaire actuel après des transferts.

## Frais d'avatar

Coût d'une mise à jour d'avatar :

```text
100 ATH
```

La mise à jour d'avatar se paie en ATH depuis le portefeuille personnel : un transfert avec notification depuis son portefeuille ATH vers le portefeuille ATH officiel de ProfileRegistry.

ProfileRegistry n'accepte la mise à jour que si toutes les conditions sont réunies :

- le montant vaut exactement `100 ATH` ;
- l'expéditeur est le portefeuille ATH officiel de ProfileRegistry ;
- le portefeuille payeur est le portefeuille ATH de la personne propriétaire ;
- le portefeuille propriétaire est dans la basechain ;
- l'empreinte de l'avatar est non nulle ;
- l'identifiant de flux est non nul ;
- le nombre de parties est compris entre 1 et 16 ;
- le format média est WebP.

Une mise à jour acceptée crée une nouvelle version d'avatar et partage les frais :

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Une notification d'avatar refusée est restituée par la voie de remboursement des notifications ATHWallet. ProfileRegistry ne crée pas de compartiment de remboursement distinct pour les mises à jour malformées.

ProfileRegistry fixe le prix et règle le paiement, mais ne conserve aucun état de profil : le pointeur authentifié vers l'avatar réside dans le KeyShard de la personne propriétaire elle-même. Les octets de l'image résident dans PublicShard, domaine AVATAR ; le client reconstitue le WebP à partir de là ou d'un cache local et compare les octets à l'`avatar_hash` enregistré. Un historique absent ou tronqué est présenté comme indisponible.

## Market Stability Seller

MarketStabilitySeller est une réserve publique en contrat qui distribue l'ATH après le lancement du pool officiel :

```text
60,000,000 ATH
```

Son objet est de réduire la distorsion du marché précoce due à une liquidité mince. Au lancement, un petit pool peut être fortement déplacé par un groupe restreint d'acheteurs. Si cela survient, celles et ceux qui ont besoin d'ATH pour des actions réelles dans Platho peuvent être contraints d'acheter sur un pic de prix artificiel.

MarketStabilitySeller crée une échelle d'offre transparente au-dessus du prix de lancement. Il vend l'ATH par tranches de taille fixe. Chaque tranche suivante est plus chère que la précédente, et chacune comporte une limite stricte de taille. Après le gel des prix unique et lié aux preuves, le calendrier des tranches est déterministe et l'équipe ne peut pas le modifier à la main.

Si des spéculateurs précoces tentent d'absorber une grande quantité d'ATH, ils achètent à la réserve publique à des prix de tranche croissants, plutôt que de vider toute la liquidité bon marché d'un pool mince pour la revendre. Qui a besoin d'ATH pour Platho peut l'acheter à un prix de tranche public et connu, sans propulser un petit pool à la verticale d'une seule vague de demande.

La réserve ne déverse pas de jetons sur le marché. Elle ne vend pas d'elle-même et ne crée aucune pression vendeuse sans demande. Une vente n'a lieu que lorsque quelqu'un achète volontairement dans la tranche courante. Sans demande, la réserve reste inactive.

L'utilité on-chain d'ATH est concrète :

- enregistrer un nom `.ath` se paie en ATH via UsernameRegistry ;
- les mises à jour du pointeur d'avatar se paient en ATH via ProfileRegistry ;
- l'ATH détenu dans son propre portefeuille réduit les frais de protocole des publications une fois passée la porte de distribution d'activité ;
- les frais acceptés de noms et d'avatars créent une dette de trésorerie et une dette de destruction ;
- BuybackBurn achète de l'ATH avec les frais de protocole en GRAM et détruit l'ATH reçu via ATHMaster.

Les publications se paient en GRAM directement depuis le portefeuille.

Cela relie la demande d'ATH à des actions précises du protocole : noms `.ath`, mises à jour d'avatar et pression de rachat et de destruction. MarketStabilitySeller n'élargit l'offre disponible qu'à mesure que la tranche suivante est prise, de sorte que l'accès précoce est public et déterministe plutôt que dominé par un pool mince.

La réserve n'est vendue qu'après le gel des prix postérieur au pool.

Le gel des prix est un véritable pouvoir de lancement, à usage unique. Il fixe une fois le prix de base de la tranche à partir des preuves du lancement du pool, après quoi l'empreinte du contrôleur de lancement est effacée. Dès lors, MarketStabilitySeller ne peut ni voler des fonds, ni suspendre les ventes, ni vider les soldes en urgence, ni passer outre les acheteurs, ni modifier la grille de prix.

MarketStabilitySeller est capitalisé au genèse final avec la réserve complète de `60,000,000 ATH`, financée par le flux authentifié de dotation vers le portefeuille ATH officiel de vente, dans la limite stricte de `60,000,000 ATH`. `mainnet:genesis:verify` contrôle que le vendeur porte la réserve complète et que la couverture de son portefeuille ATH officiel atteint au moins `60,000,000 ATH` avant une mise en production. Un transfert ordinaire et non sollicité d'ATH vers ce portefeuille officiel n'augmente pas la réserve comptabilisée, n'élargit pas l'offre vendable et peut rester bloqué ; un solde supérieur à `60,000,000 ATH` est traité comme un avertissement, non comme une réserve supplémentaire.

La vente est une étape distincte, postérieure au pool. La réserve n'est pas vendue avant le lancement ; à ce moment, le gel des prix unique et lié aux preuves fixe le prix de base de la tranche, et le calendrier devient déterministe, non modifiable à la main par l'équipe.

La réserve est découpée en 20 tranches :

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Chaque tranche porte un multiplicateur :

```text
x2, x3, x4, ..., x21
```

Cela crée une échelle de prix régulière. À mesure que le projet gagne en popularité, le marché reçoit une offre supplémentaire d'ATH, mais chaque tranche suivante est plus chère que la précédente. La demande précoce ne frappe pas d'un coup un pool mince, et la hausse ne se transforme pas en mur vertical qui rendrait un jeton utilitaire inconfortable à utiliser.

Formule d'achat :

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` est gelé après le lancement du pool et correspond exactement à la preuve de prix x1.

Au prix de lancement `1 ATH = 0.001 GRAM`, le prix x1 d'une tranche est :

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

D'où :

| Tranche | Multiplicateur | Prix pour 3M ATH | Prix pour 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Un achat unique ne peut pas franchir une limite de tranche. Cela empêche d'acquérir l'ATH de la tranche suivante au prix de la précédente.

Le produit en GRAM n'est comptabilisé qu'après livraison de l'ATH à l'acheteur. Si le transfert d'ATH échoue ou rebondit, la réserve est rétablie, l'acheteur récupère le principal en GRAM versé, et la dette de trésorerie n'augmente pas.

Une fois la tranche finale x21 vendue, MarketStabilitySeller ne régule plus le prix d'ATH. À partir de là, le prix est entièrement fixé par le marché : liquidité, offre disponible, demande de noms `.ath`, mises à jour d'avatar et pression de rachat et de destruction.

Même au palier x21, la valorisation de référence reste modérée au regard du modèle d'utilité :

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Au palier x21, MarketStabilitySeller a achevé la libération programmée de sa réserve. Ensuite, le prix d'ATH est entièrement fixé par le marché, via la liquidité, la demande d'usage, l'offre disponible et la pression de rachat et de destruction. La seule distribution de protocole restante est le calendrier lent du vesting à long terme, plafonné à `100,000 ATH` par an.

## Compartiments de trésorerie et de destruction

UsernameRegistry et ProfileRegistry utilisent le même modèle de partage des frais en ATH :

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Vider la dette de trésorerie envoie l'ATH à la personne destinataire de la trésorerie via le portefeuille ATH officiel.

Vider la dette de destruction envoie une demande de destruction d'ATH par le portefeuille ATH officiel. L'offre ne diminue qu'après finalisation de la destruction dans ATHMaster.

Les voies d'échec et de rebond rétablissent les compartiments de dette. La comptabilité est conservée jusqu'à l'achèvement du transfert ou de la destruction en aval.

## Comptabilité ATHWallet

Les soldes d'ATH résident dans des contrats ATHWallet déterministes.

ATHWallet prend en charge :

- le crédit de l'émission de genèse ;
- le transfert ordinaire ;
- le transfert avec notification ;
- la notification de frappe de nom ;
- la notification d'avatar ;
- la demande de destruction ;
- l'accusé de réception d'une notification ;
- l'élagage d'une notification périmée ;
- la reprise après rebond ou échec.

Les contrats qui acceptent l'ATH en paiement n'acceptent pas de messages directs d'adresses arbitraires. Ils n'acceptent des notifications que de leur propre ATHWallet officiel. L'authentification du portefeuille source a lieu à l'intérieur d'ATHWallet, par dérivation déterministe.

ATH expose des points d'entrée de transfert de type TEP-74 pour l'outillage jetton générique, mais les actions de protocole de Platho utilisent des messages de notification ATH authentifiés. Les intégrations externes ne doivent pas supposer que les flux de notification de Platho émettent un `JettonTransferNotification` générique.

Les transferts internes sortants dans ATHWallet sont protégés par une comptabilité des opérations en attente côté source et par un accusé côté source. Un solde n'est pas rétabli à partir du corps d'un rebond sans preuve d'une opération en attente.

## Cycle de vie d'ATH

1. `ATHMaster` crée l'offre fixe de `100,000,000 ATH`.
2. Un déploiement de trésorerie unique reçoit l'offre dans le portefeuille ATH de trésorerie.
3. L'offre est répartie entre activité, liquidité, vesting à long terme et stabilité de marché.
4. Les personnes publient des messages en payant directement depuis leur propre portefeuille.
5. Une publication réussie crédite `10 ATH` de récompense d'activité.
6. Le pool ATH/GRAM est lancé au prix de référence `1 ATH = 0.001 GRAM`.
7. Les preuves de route et de prix postérieures au pool sont gelées.
8. MarketStabilitySeller vend la réserve par les tranches x2..x21.
9. Le partage activé, FeeAccumulator répartit les frais en GRAM entre trésorerie et rachat.
10. BuybackBurn achète de l'ATH avec les frais en GRAM et le détruit via ATHMaster.
11. Les frais de nom et de profil créent une dette de trésorerie en ATH et une dette de destruction en ATH.
12. L'offre totale diminue progressivement par destructions authentifiées.

## Modèle final

ATH relie trois couches de Platho :

1. **Usage de l'application** — les messages créent des récompenses d'activité.
2. **Fonctions payantes** — noms et avatars exigent de l'ATH.
3. **Réduction de l'offre** — une partie des frais en ATH et du produit du rachat est détruite via ATHMaster.

Le modèle part d'une offre fixe et d'une valorisation de référence de `100,000 GRAM`. La distribution primaire est liée à un usage réel et payant : les messages partent de `0.0191 GRAM` — aujourd'hui `0.0191 GRAM` pour un message privé et `0.0203 GRAM` pour une publication publique — plus une prime d'activité de `10 ATH` par capsule finalisée. Les classes de taille publiques ou privées supérieures coûtent davantage. Cette prime n'est ni un remboursement, ni une indemnisation, ni une promesse de profit. Une fois les premiers 15% de l'offre distribués, le pool est lancé et la voie du rachat s'ouvre.

ATH existe comme jeton de travail au sein de Platho : il est distribué par l'activité, utilisé dans des actions payantes, réduit les frais de protocole, est vendu depuis la réserve selon une échelle définie, et est détruit on-chain. Passée l'échelle de stabilité de marché, le prix futur d'ATH est déterminé par le marché et par l'usage du protocole.
