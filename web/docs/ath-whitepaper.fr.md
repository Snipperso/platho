# Livre blanc ATH

## Le jeton du protocole Platho

ATH est le jeton utilitaire de Platho. Il sert aux récompenses d'activité, aux réductions sur les frais de protocole après l'airdrop, aux noms d'utilisateur `.ath`, aux mises à jour de l'avatar de profil, aux ventes de stabilisation du marché, au rachat et à la destruction.

ATH n'est pas un jeton administratif. Il ne confère pas la capacité de réécrire les soldes, de suspendre les opérations, d'émettre de nouvelles unités ou de modifier les règles de propriété des utilisateurs. Son rôle est d'alimenter l'économie de l'application et de relier l'usage de Platho à la comptabilité on-chain.

Ce document décrit le modèle ATH dans Platho.

## Paramètres fondamentaux

ATH a une offre totale fixe :

```text
100,000,000 ATH
```

Le prix de référence au lancement est :

```text
1 ATH = 0.001 GRAM
```

La valorisation entièrement diluée au lancement est :

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH part d'une capitalisation de référence de `100,000 GRAM`.

## Offre fixe

ATH est émis par `ATHMaster`. À l'initialisation, `ATHMaster` fixe l'offre totale à `100,000,000 ATH`.

Il n'existe aucune fonction d'émission après la genèse. `ATHMaster` n'implémente ni émission administrative, ni suspension, ni liste noire, ni taxe de transfert, ni transfert forcé, ni vidange de sauvetage.

Le déploiement initial de l'offre est effectué une seule fois via `DeployTreasurySupply`. Il envoie la totalité de l'offre au portefeuille ATH de la trésorerie. Le déploiement de l'offre de genèse ne peut pas être répété.

L'offre totale ne diminue que par la destruction. `ATHMaster` n'accepte une destruction qu'après une notification de destruction authentifiée provenant du portefeuille ATH déterministe de l'adresse propriétaire. Après vérification, `ATHMaster` diminue `total_supply` et envoie `ATHBurnFinalized`.

La destruction d'ATH est une réduction réelle de l'offre totale, et non un transfert vers une adresse inutilisée.

## Répartition de l'offre

L'offre d'ATH est répartie entre quatre catégories :

| Catégorie | Part | Montant |
| --- | ---: | ---: |
| Airdrop d'activité | 15% | 15,000,000 ATH |
| Liquidité initiale | 15% | 15,000,000 ATH |
| Vesting à long terme du protocole | 10% | 10,000,000 ATH |
| Réserve de stabilité du marché | 60% | 60,000,000 ATH |

Cette répartition définit la structure économique de Platho :

- 15 % de l'offre sont distribués aux utilisateurs via l'activité applicative avant le lancement du pool.
- 15 % de l'offre servent à la liquidité initiale.
- 10 % de l'offre sont verrouillés dans un vesting immuable à long terme.
- 60 % de l'offre sont approvisionnés dans MarketStabilitySeller et verrouillés à la genèse, puis vendus par tranches au-dessus du prix de lancement après le gel de la tarification post-pool.

L'airdrop d'activité et la réserve de vesting à long terme sont garantis, à la genèse finale, par les portefeuilles ATH officiels de Vault et d'ATHVesting, et le vérificateur de version contrôle ces soldes avant la mise en production. La réserve de stabilité du marché de `60,000,000 ATH` est approvisionnée dans MarketStabilitySeller et verrouillée à la genèse finale, garantie par son portefeuille ATH de vendeur officiel, et le vérificateur de version contrôle cette garantie avant la mise en production. La réserve est capitalisée dès le départ, mais elle n'est pas vendue avant le lancement du pool, moment où le gel de tarification unique, lié aux preuves, fixe le prix de la tranche de base.

## Vesting à long terme du protocole

La réserve de vesting à long terme est :

```text
10,000,000 ATH
```

Elle est détenue par `ATHVesting`, et non par un compartiment de trésorerie mutable. Le calendrier de vesting est fixé dans le contrat :

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Quiconque peut déclencher une réclamation une fois qu'ATH est acquis, mais le bénéficiaire est immuable. Le contrat n'a aucune fonction d'accélération, de changement de bénéficiaire, de suspension, de balayage administratif, de vidange de sauvetage ou de libération discrétionnaire.

À la genèse finale, le portefeuille officiel `ATHWallet(owner = ATHVesting, master = ATHMaster)` doit contenir exactement `10,000,000 ATH`. Le vérificateur exige également zéro ATH réclamé, une phase inactive et aucun transfert en attente avant le lancement.

Cette réserve est intentionnellement lente. Elle crée un horizon long pour le développement du protocole sans placer un compartiment liquide de 10M ATH au-dessus du marché au lancement.

## Airdrop d'activité

L'airdrop d'activité est :

```text
15,000,000 ATH
```

Récompense par publication réussie :

```text
10 ATH
```

La récompense est créditée sur le solde ATH interne de l'utilisateur dans Vault après une publication réussie. Une publication réussie signifie que Vault a envoyé la charge utile à CapsuleHub, que CapsuleHub a accepté l'entrée et que Vault a reçu l'accusé de réception.

Les tentatives de publication échouées ne créent pas de récompenses d'activité.

Comptabilité des récompenses :

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Si le compartiment d'airdrop restant est inférieur à 10 ATH, le montant restant est crédité. Une fois le compartiment épuisé, les nouvelles récompenses d'activité s'arrêtent.

L'airdrop d'activité est comptabilisé dans Vault et garanti par le portefeuille ATH officiel de Vault préfinancé.

Les dépôts d'ATH dans Vault ne sont pris en charge que via le flux de transfert-avec-notification depuis le portefeuille ATHWallet de l'utilisateur
(`ATHTransferRequestWithNotify`) vers Vault. Un transfert ATH ordinaire manuel vers le portefeuille ATHWallet officiel de Vault n'est
pas pris en charge : il peut augmenter le solde brut du portefeuille officiel, mais il ne crée pas `Vault.user.ath_balance` et ne doit
pas être présenté par la PWA comme une voie de dépôt.

Les retraits d'ATH de Vault sont des commandes Vault externes signées. La réserve d'exécution en aval — déploiement, transfert, stockage et
ACK de l'ATHWallet — est payée depuis le solde GRAM interne de l'utilisateur dans Vault. Vault ne recrédite que la valeur d'ACK/échec/rebond
authentifiée qu'il reçoit, moins la réserve de remboursement locale et plafonnée par la valeur interne réservée.

## Prix de l'activité

Les messages partent du prix de base public actuel :

```text
from 0.0337 GRAM
```

Les exemples canoniques exacts actuels avant la réduction ATH sont :

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Pour une publication réussie, l'utilisateur reçoit :

```text
10 ATH
```

Au prix de référence au lancement :

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Cela lie la distribution précoce d'ATH à l'usage réel de l'application. La récompense est un bonus d'activité, et non un remboursement, un cashback,
une remise ou une promesse qu'ATH compensera le coût en GRAM d'une publication. La valeur de référence au lancement de `10 ATH` peut être
inférieure au coût en GRAM de la capsule, et c'est intentionnel : les utilisateurs reçoivent une propriété précoce du réseau pour un usage réel,
et non un remboursement garanti.

Tarification des capsules : les publications publiques de 1 KiB partent de `0.0337 GRAM` et les capsules privées hybrides de 1 KiB de `0.0347 GRAM`. Les blocs de capsules publiques ou privées plus grands coûtent davantage, car le corps sélectionné de 1, 2, 4, 8, 16 ou 32 KiB
modifie la réserve d'exécution et de stockage de Vault/CapsuleHub. La récompense reste de `10 ATH` par capsule finalisée
avec succès, quelle que soit la taille de la capsule.

La publication privée utilise par défaut le profil de sécurité hybride : X25519 + ML-KEM-768 + AES-GCM. Il n'existe pas de mode de message privé classique moins cher.

ATH peut s'échanger au-dessus ou en dessous du prix de référence au lancement une fois que le pool officiel existe. La récompense d'activité n'est ni un rendement d'investissement, ni une attente de profit, ni une garantie de prix.

## Frais de protocole et prix utilisateur

À l'intérieur de Vault, les frais de protocole sont distincts du coût total facturé à l'utilisateur.

Frais de protocole :

| Type de publication | Frais de protocole |
| --- | ---: |
| Publication publique | 0.010 GRAM |
| Message privé hybride | 0.010 GRAM |

Le prix facturé à l'utilisateur inclut les frais de protocole, la dotation de stockage compacte pour l'index/en-tête, la réserve d'exécution locale de Vault et le remboursement ACK attendu :

| Type de publication | Prix facturé à l'utilisateur |
| --- | ---: |
| Public (à partir de) | from 0.0337 GRAM |
| Exemple exact actuel de publication publique | 0.0337 GRAM |
| Exemple exact actuel de capsule privée hybride 1 KiB | 0.0347 GRAM |

Si la PWA reçoit une estimation réseau conservatrice plus élevée, elle ajoute le dépassement estimé à la charge maximale canonique, arrondie au palier propre de `0.001 GRAM`. Les réductions ATH s'appliquent aux frais de protocole, et non aux coûts réseau ou aux réserves de stockage. Cette surcharge est une marge de sécurité signée : si CapsuleHub accepte la publication, l'ACK de succès ne renvoie que la réserve d'ACK de publication fixe de `30,000,000` nanotons (`0.030 GRAM`). Après que Vault a traité cet ACK, l'utilisateur est crédité d'environ `25,800,000` nanotons sur son solde GRAM interne dans Vault. La partie au-dessus de la valeur requise canonique reste dans CapsuleHub en tant que dépassement de réserve réseau/stockage. Elle n'est pas renvoyée à Vault et n'est pas comptabilisée comme `accrued_plato_fee_ton` au moment de la publication. Seul le surplus brut au-dessus de la réserve protégée de CapsuleHub peut ensuite être balayé sans permission vers FeeAccumulator, où il suit la comptabilité normale de trésorerie/rachat. CapsuleHub stocke des métadonnées d'entrée compactes et authentifiées ainsi que le hachage du corps ; le corps lourd est récupéré depuis l'historique des transactions de publication acceptées et vérifié localement.

## Réductions ATH

ATH réduit les frais de protocole des messages une fois que l'airdrop d'activité a été entièrement distribué.

Les réductions ne se débloquent que lorsque l'airdrop d'activité restant est :

```text
airdrop_remaining_ath == 0 ATH
```

Avant ce point, les frais de protocole sont payés en totalité.

Seuil de réduction maximale :

```text
10,000 ATH
```

Si le solde ATH interne de l'utilisateur dans Vault est d'au moins `10,000 ATH`, l'utilisateur atteint le palier de réduction maximale des frais de protocole pour la composante de frais Platho. Les coûts réseau et les réserves de stockage restent payés.

Si le solde est inférieur à `10,000 ATH`, les frais diminuent linéairement :

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

Le calcul arrondit à l'entier supérieur. Avec les constantes actuelles, les frais de protocole complets sont de `0.010 GRAM` (`10,000,000 nanotons`) pour les capsules publiques et privées, et la réduction maximale est de `0.010 GRAM` par capsule.

## Lancement du pool

Le pool ATH/GRAM est lancé une fois que la totalité de l'airdrop d'activité de `15,000,000 ATH` a été distribuée.

La séquence de lancement est :

1. Les utilisateurs reçoivent de l'ATH via un usage réel de Platho.
2. La totalité de l'airdrop d'activité est distribuée.
3. Les réductions ATH se débloquent.
4. Le pool ATH/GRAM est lancé.
5. Les preuves de route post-pool et les preuves de tarification sont gelées.
6. Le partage de rachat est activé.

Le pool part du prix de référence :

```text
1 ATH = 0.001 GRAM
```

Allocation de liquidité initiale :

```text
15,000,000 ATH
```

Côté GRAM au prix de lancement :

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Les frais de protocole collectés avant le lancement du pool financent l'intégralité du côté GRAM de la liquidité initiale. Cela fait partie de
l'amorçage du lancement et ne transforme pas les récompenses d'activité en une créance libellée en GRAM.

Le pool est lancé autour d'un jeton déjà distribué via l'usage de l'application. Cela distingue ATH d'un listing vide sans base d'utilisateurs.

## FeeAccumulator

Les frais de protocole en GRAM sont collectés dans `FeeAccumulator`.

Avant l'activation du partage de rachat, tout le GRAM accumulé va vers le compartiment de trésorerie :

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` ne croît pas avant l'activation du partage.

Après `EnableBuybackSplit`, le GRAM accumulé est partagé :

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Si le montant est impair en nanotons, le reste demeure du côté rachat :

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` est une action à sens unique exécutée par le récepteur de trésorerie immuable après le lancement du pool et le gel de la route
de rachat. Il s'agit d'une véritable autorité ponctuelle : elle ne peut pas voler de fonds, suspendre, sauver ou changer d'adresses, mais elle modifie
définitivement l'économie de FeeAccumulator, passant de l'accumulation d'amorçage exclusivement en trésorerie au partage 50/50 trésorerie/rachat. Elle n'est
activée qu'après la réussite du contrôle préalable à la version.

Les autorités de version de Platho sont délibérément étroites et pour la plupart à usage unique. Elles existent néanmoins et doivent être nommées honnêtement :
le propriétaire de la trésorerie déploie l'offre initiale d'ATH une seule fois ; le contrôleur de genèse effectue la liaison et le scellement préalables au scellement ;
le contrôleur de lancement de BuybackBurn gèle la route post-pool une seule fois ; le gel de tarification de MarketStabilitySeller est effectué
une seule fois par son contrôleur de lancement ; et le récepteur de trésorerie de FeeAccumulator active le partage de rachat à sens unique après le contrôle préalable. Aucun de ces
rôles n'est un mécanisme de sauvetage, de suspension, de mise à niveau, de vidange administrative ou de contrôle arbitraire des soldes.

## Rachat et destruction

Le rachat est exécuté via `FeeAccumulator` et `BuybackBurn`.

BuybackBurn n'accepte qu'une enveloppe d'exécution complète :

```text
51.05 GRAM
```

Structure de l'enveloppe :

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

Un montant brut de `50 GRAM` n'est pas un fragment de rachat valide. Le rachat n'est accepté qu'en tant qu'enveloppe de route complète.

Après le gel de la route, BuybackBurn exécute un rachat comme suit :

1. N'accepte `51.05 GRAM` que du FeeAccumulator lié.
2. Enregistre le montant dans `reserve_due_ton`.
3. Sur `ExecuteBuybackChunk`, consomme une enveloppe.
4. Utilise la cotation gelée et le minOut gelé.
5. Fixe le délai STON.fi en interne.
6. Envoie la route via le portefeuille pTON gelé.
7. N'accepte de l'ATH que via le portefeuille ATH officiel de BuybackBurn.
8. Vérifie que le portefeuille source correspond au pool STON.fi gelé.
9. Envoie l'ATH reçu à la destruction via le portefeuille ATH officiel.
10. Ne termine le cycle qu'après `ATHBurnFinalized` de la part d'`ATHMaster`.

Le succès du rachat n'est pas défini par un message du routeur, une requête de destruction sortante ou une notification de destruction de l'ATHWallet. Il est défini
uniquement lorsque BuybackBurn reçoit un `ATHBurnFinalized` authentifié de la part d'ATHMaster. Jusqu'à l'arrivée de cette finalisation,
BuybackBurn doit toujours être traité comme étant en état de destruction en attente ou de nouvelle tentative ; les tableaux de bord et les indexeurs ne doivent pas compter l'ATH comme
détruit simplement parce qu'une tentative de destruction a été envoyée.

Si la destruction n'est pas finalisée, l'ATH reçu passe en dû de nouvelle tentative. `RetryAthBurnDue` détruit la totalité du montant dû de nouvelle tentative.

## Frais de nom d'utilisateur

L'enregistrement d'un nom d'utilisateur `.ath` est payé en ATH via le portefeuille ATH officiel d'UsernameRegistry.

Prix :

| Longueur du nom | Prix |
| ---: | ---: |
| 4 caractères | 10,000 ATH |
| 5 caractères | 1,000 ATH |
| 6+ caractères | 100 ATH |

UsernameRegistry n'accepte que le prix exact. Un sous-paiement ou un sur-paiement ne crée pas de nom.

Un mint accepté passe par un état en attente et déploie `UsernameNFTItem`. Avant l'accusé de réception de l'item, le paiement n'est pas reconnu comme un revenu. Après l'accusé de réception de l'item, le montant est partagé :

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Le mint de nom d'utilisateur est financé par Vault. Les rejets pour nom d'utilisateur invalide, prix erroné ou nom en doublon rebondissent via la
voie de notification du portefeuille ATH officiel afin que Vault puisse restaurer l'ATH interne de l'utilisateur. UsernameRegistry ne maintient pas de
compartiment de remboursement de nom d'utilisateur externe direct dans le flux actuel financé par Vault.

L'ATH issu du mint de nom d'utilisateur ne devient un revenu de protocole qu'après confirmation du déploiement de l'item correspondant.

L'autorité sur les noms d'utilisateur est répartie délibérément : `UsernameRegistry` ancre le nom à un `UsernameNFTItem` unique et exact, et
l'état de l'item porte le propriétaire actuel. Les transferts de l'item transfèrent le nom d'utilisateur. L'item expose les données NFT standard
et les métadonnées on-chain TEP-64, y compris `name = <username>.ath` ; il ne dépend pas d'un serveur Platho pour ses métadonnées.
Les octets du nom d'utilisateur sont littéraux et ne sont pas normalisés pour l'affichage : les noms comportant des séparateurs en tête, en fin, consécutifs ou uniquement composés de séparateurs sont
valides tant que chaque octet appartient à l'ensemble autorisé `a-z`, `0-9`, `_`, `-` et que la longueur est comprise entre 4 et 16.
Si le déploiement de l'item a été tenté mais que l'ACK de l'item n'a jamais atteint le registre, `PrunePendingUsernameMint` est intentionnellement
non destructif : il ne devine pas l'échec, ne supprime pas l'état en attente et ne crée pas de dû de remboursement. La voie de récupération est un `UsernameItemDeployedAck`
tardif ou `UsernameNFTItem.ResendDeployedAck`, de sorte qu'un item initialisé peut toujours devenir faisant autorité.
Si le déploiement de l'item rebondit réellement, le registre demande au portefeuille ATH officiel de rembourser la notification en attente.
Un `UsernameNFTItem` déployé sans que `UsernameRegistry.name_records[name_hash]` pointe vers cet item exact est
non faisant autorité : les clients, les indexeurs et l'interface utilisateur ne doivent pas traiter l'item seul comme la propriété du nom `.ath`, et ne doivent pas
utiliser le propriétaire de l'enregistrement du registre comme propriétaire actuel après des transferts.

## Frais d'avatar de profil

Coûts de mise à jour de l'avatar de profil :

```text
100 ATH
```

Les mises à jour de l'avatar de profil sont financées par Vault. La PWA envoie `SetProfileAvatarFromVaultBalance` à Vault ; Vault paie via la voie de notification de son portefeuille ATH officiel vers le portefeuille ATH officiel de ProfileRegistry. Le paiement d'avatar directement depuis le portefeuille de l'utilisateur n'est pas pris en charge.

ProfileRegistry n'accepte la mise à jour que lorsque toutes les conditions sont réunies :

- le montant est exactement `100 ATH` ;
- l'expéditeur est le portefeuille ATH officiel de ProfileRegistry ;
- le portefeuille payeur est le Vault lié ;
- le portefeuille propriétaire est dans la basechain ;
- le hachage de l'avatar n'est pas nul ;
- l'identifiant de flux n'est pas nul ;
- le nombre de parties est compris entre 1 et 16 ;
- le format média est WebP.

Une mise à jour acceptée crée une nouvelle version d'avatar et partage les frais :

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Une notification d'avatar rejetée est remboursée via la voie de rebond de notification de l'ATHWallet. ProfileRegistry ne crée pas de compartiment de remboursement distinct pour les mises à jour d'avatar mal formées.

ProfileRegistry stocke le pointeur d'avatar authentifié, et non les octets d'image permanents. La PWA doit reconstruire les données WebP de l'avatar à partir des entrées CapsuleHub publiques ou du cache local et vérifier les octets par rapport à l'`avatar_hash` stocké ; un historique manquant ou élagué est présenté comme indisponible.

## Vendeur de stabilité du marché

MarketStabilitySeller est une réserve de contrat publique qui distribue de l'ATH après le lancement du pool officiel :

```text
60,000,000 ATH
```

Son objectif est de réduire la distorsion du marché précoce causée par une liquidité faible. Au lancement, un petit pool peut être fortement déplacé par un petit groupe d'acheteurs précoces. Si cela se produit, les utilisateurs qui ont besoin d'ATH pour des actions réelles dans Platho peuvent être contraints d'acheter au sein d'un pic de prix artificiel.

MarketStabilitySeller crée un escalier d'offre transparent au-dessus du prix de lancement. Il vend de l'ATH par tranches de taille fixe. Chaque tranche suivante est plus chère que la précédente, et chaque tranche a une limite de taille stricte. Après le gel de tarification unique, lié aux preuves, le calendrier des tranches est déterministe et ne peut pas être modifié manuellement par l'équipe.

Si des spéculateurs précoces tentent d'absorber une grande quantité d'ATH, ils achètent depuis la réserve publique à des prix de tranche croissants au lieu d'extraire toute la liquidité bon marché d'un pool faible et de la revendre aux utilisateurs. Si des utilisateurs ordinaires ont besoin d'ATH pour Platho, ils peuvent l'acheter à un prix de tranche public connu sans pousser un petit pool à la verticale avec une seule vague de demande.

La réserve ne déverse pas de jetons sur le marché. Elle ne vend pas d'elle-même et ne crée pas de pression vendeuse en l'absence de demande. Une vente ne se produit que lorsqu'un acheteur achète volontairement depuis la tranche actuelle. S'il n'y a pas de demande, la réserve reste inactive.

L'utilité on-chain d'ATH est spécifique :

- l'enregistrement d'un nom d'utilisateur `.ath` est payé en ATH via UsernameRegistry ;
- les mises à jour du pointeur d'avatar de profil sont payées en ATH via ProfileRegistry ;
- l'ATH détenu sur le solde interne de l'utilisateur dans Vault réduit les frais de protocole pour les publications Vault après le seuil de distribution d'activité ;
- les frais acceptés de nom d'utilisateur et d'avatar créent un dû de trésorerie et un dû de destruction ;
- BuybackBurn achète de l'ATH avec les frais de protocole en GRAM et détruit l'ATH reçu via ATHMaster.

Les publications Vault sont payées en GRAM. ATH ne paie pas la totalité de la transaction de publication. Il réduit la composante de frais de protocole une fois le seuil de réduction ouvert.

Cela lie la demande d'ATH à des actions de protocole concrètes : noms `.ath`, mises à jour d'avatar, réductions de frais de protocole Vault après l'airdrop, et pression de rachat/destruction. MarketStabilitySeller n'élargit l'offre disponible qu'à mesure que les acheteurs prennent la tranche suivante, de sorte que l'accès précoce est public et déterministe plutôt que dominé par un pool faible.

La réserve n'est vendue qu'après le gel de tarification post-pool.

Le gel de tarification est une véritable autorité de lancement ponctuelle. Il fixe le prix de la tranche de base une seule fois à partir des preuves du lancement du pool, puis le hachage du contrôleur de lancement est effacé. Après cela, MarketStabilitySeller ne peut pas voler de fonds, suspendre les ventes, sauver des soldes, passer outre les acheteurs ou muter le calendrier des prix.

MarketStabilitySeller est capitalisé à la genèse finale avec la réserve complète de `60,000,000 ATH`, approvisionnée via le
flux authentifié de financeur de réserve vers le portefeuille ATH de vendeur officiel, jusqu'au plafond strict de `60,000,000 ATH`.
`mainnet:genesis:verify` vérifie que le vendeur porte la réserve complète et que la garantie de son portefeuille ATH de vendeur officiel
est d'au moins `60,000,000 ATH` avant la mise en production. Un transfert ATH ordinaire non sollicité vers le portefeuille ATH de vendeur
officiel n'augmente pas la réserve comptabilisée, n'élargit pas l'offre vendable et peut rester bloqué ; un solde de portefeuille
supérieur à `60,000,000 ATH` est traité comme un avertissement, et non comme une réserve supplémentaire.

La vente est une étape post-pool distincte. La réserve n'est pas vendue avant le lancement du pool, moment où le gel de tarification unique
lié aux preuves fixe le prix de la tranche de base ; à partir de là, le calendrier des tranches est déterministe et ne peut pas être modifié manuellement
par l'équipe.

La réserve est divisée en 20 tranches :

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Chaque tranche a un multiplicateur :

```text
x2, x3, x4, ..., x21
```

Cela crée un escalier de prix régulier. À mesure que la popularité du projet croît, le marché reçoit une offre d'ATH supplémentaire, mais chaque tranche suivante est plus chère que la précédente. La demande précoce ne heurte pas immédiatement un pool faible, et la croissance des prix ne devient pas un mur vertical qui rend le jeton utilitaire peu pratique à utiliser.

Formule d'achat :

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` est gelé après le lancement du pool et correspond exactement à la preuve de tarification x1.

Au prix de lancement `1 ATH = 0.001 GRAM`, le prix x1 d'une tranche est :

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Par conséquent :

| Tranche | Multiplicateur | Prix pour 3M ATH | Prix pour 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Un achat unique ne peut pas franchir une limite de tranche. Cela empêche d'acheter de l'ATH de la tranche suivante au prix de la tranche précédente.

Le revenu en GRAM n'est reconnu qu'après la livraison de l'ATH à l'acheteur. Si le transfert d'ATH échoue ou rebondit, la réserve est restaurée, l'acheteur récupère le principal en GRAM payé, et le dû de trésorerie n'augmente pas.

Une fois la dernière tranche x21 vendue, MarketStabilitySeller ne régule plus le prix de l'ATH. À partir de ce point, le prix est entièrement déterminé par le marché : liquidité, offre disponible, demande de noms `.ath`, mises à jour d'avatar, réductions de frais de protocole Vault après l'airdrop, et pression de rachat/destruction.

Même au palier x21, la valorisation de référence demeure modérée par rapport au modèle d'utilité :

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Au palier x21, MarketStabilitySeller a terminé sa libération de réserve programmée. Après cela, le prix de l'ATH est entièrement déterminé par le marché : liquidité, demande d'usage, offre disponible, et pression de rachat/destruction. La seule allocation de protocole restante est le calendrier de vesting lent à long terme, plafonné à `100,000 ATH` par an.

## Compartiments de trésorerie et de destruction

UsernameRegistry et ProfileRegistry utilisent le même modèle de partage des frais ATH :

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Le vidage du dû de trésorerie envoie l'ATH au récepteur de trésorerie via le portefeuille ATH officiel.

Le vidage du dû de destruction envoie une requête de destruction d'ATH via le portefeuille ATH officiel. L'offre ne diminue qu'après la finalisation de la destruction dans ATHMaster.

Les voies d'échec et de rebond restaurent les compartiments de dû. La comptabilité est préservée jusqu'à ce que le transfert ou la destruction en aval soit achevé.

## Comptabilité de l'ATHWallet

Les soldes ATH résident dans des contrats ATHWallet déterministes.

ATHWallet gère :

- le crédit de l'offre de genèse ;
- le transfert ordinaire ;
- le transfert avec notification ;
- la notification de mint de nom d'utilisateur ;
- la notification d'avatar de profil ;
- la requête de destruction ;
- l'accusé de réception de notification ;
- l'élagage des notifications périmées ;
- la récupération sur rebond/échec.

Les contrats qui acceptent l'ATH comme paiement n'acceptent pas de messages directs provenant d'adresses arbitraires. Ils n'acceptent des notifications que de leur ATHWallet officiel. L'authentification du portefeuille source est effectuée à l'intérieur de l'ATHWallet via une dérivation de portefeuille déterministe.

ATH expose des points d'entrée de transfert de type TEP-74 pour les outils jetton génériques, mais les actions du protocole Platho utilisent des messages de notification ATH authentifiés. Les intégrations externes ne doivent pas supposer que les flux de notification Platho émettent une `JettonTransferNotification` générique.

Les transferts internes sortants dans ATHWallet sont protégés par une comptabilité en attente côté source et un accusé de réception côté source. Le solde n'est pas restauré à partir d'un corps de rebond sans preuve d'attente.

## Cycle de vie de l'ATH

1. `ATHMaster` crée une offre fixe de `100,000,000 ATH`.
2. Le déploiement de trésorerie à usage unique reçoit l'offre dans le portefeuille ATH de la trésorerie.
3. L'offre est répartie entre activité, liquidité, vesting à long terme et stabilité du marché.
4. Les utilisateurs publient des messages via Vault.
5. Une publication réussie crédite une récompense d'activité de `10 ATH`.
6. Une fois la totalité de l'airdrop d'activité de `15,000,000 ATH` distribuée et `airdrop_remaining_ath == 0`, les réductions de frais de protocole ATH se débloquent.
7. Le pool ATH/GRAM est lancé au prix de référence `1 ATH = 0.001 GRAM`.
8. Les preuves de route post-pool et les preuves de tarification sont gelées.
9. MarketStabilitySeller vend la réserve via les tranches x2..x21.
10. Une fois le partage activé, FeeAccumulator divise les frais de protocole en GRAM entre trésorerie et rachat.
11. BuybackBurn achète de l'ATH avec les frais de protocole en GRAM et détruit l'ATH via ATHMaster.
12. Les frais de nom d'utilisateur et de profil créent un dû de trésorerie ATH et un dû de destruction ATH.
13. L'offre totale diminue progressivement via des destructions authentifiées.

## Modèle final

ATH relie quatre couches de Platho :

1. **Usage de l'application** - les messages créent des récompenses d'activité.
2. **Fonctionnalités payantes** - les noms d'utilisateur et les avatars requièrent de l'ATH.
3. **Réductions** - le solde ATH réduit les frais de protocole après le seuil de distribution.
4. **Réduction de l'offre** - une partie des frais ATH et de la sortie de rachat est détruite via ATHMaster.

Le modèle commence avec une offre fixe et une valorisation de référence de `100,000 GRAM`. La distribution principale aux utilisateurs est liée à un usage payant réel : les messages partent de `0.0337 GRAM` — actuellement `0.0337 GRAM` pour une publication publique de 1 KiB et `0.0347 GRAM` pour une capsule privée hybride de 1 KiB, plus un bonus d'activité de `10 ATH` par capsule finalisée. Les classes de taille publiques ou privées plus grandes coûtent davantage. Ce bonus n'est ni un remboursement, ni un dédommagement, ni une promesse de profit. Une fois les premiers 15 % de l'offre distribués, le pool est lancé, les réductions de frais de protocole se débloquent, et la voie de rachat s'ouvre.

ATH existe en tant que jeton opérationnel à l'intérieur de Platho : il est distribué via l'activité, utilisé dans des actions payantes, réduit les frais de protocole, est vendu depuis la réserve via un escalier défini, et est détruit via une destruction on-chain. Après l'escalier de stabilité du marché, le prix futur de l'ATH est déterminé par le marché et l'usage du protocole.
