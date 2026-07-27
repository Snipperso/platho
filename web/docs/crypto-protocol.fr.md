# Protocole cryptographique des messages Platho

Ce document décrit le chiffrement des messages côté client mis en œuvre par la PWA Platho.

## Chiffrement

Les messages privés utilisent X25519 + ML-KEM-768 + AES-GCM — l'unique suite pour messages privés (`hybrid-v1`, valeur de contrat `2`).

## Trousseaux de clés

Chaque phrase de récupération GRAM de 24 mots créée ou importée par la PWA dérive de manière déterministe une identité de messagerie dotée d'une paire de clés de chiffrement et d'une clé de signature Ed25519. Le matériel de clé publique de chiffrement est exporté sous forme de trousseau de clés publiques :

- `keyId` : identifiant fondé sur SHA-256 calculé sur le matériel de clé publique.
- `x25519PublicKey` : clé publique ECDH classique de 32 octets.
- `mlKem768PublicKey` : clé publique ML-KEM-768 de 1184 octets pour `hybrid-v1`.
- `mlKem768PublicKeyHash` : SHA-256 de la clé publique ML-KEM-768.
- `mlKem768PublicKeyLen` : toujours `1184` pour `hybrid-v1`.

La PWA recalcule `keyId`, `mlKem768PublicKeyHash` et `mlKem768PublicKeyLen` avant le chiffrement. Un trousseau qui déclare un identifiant, une suite, une suite de contrat, un hachage ou une longueur incohérents est rejeté.

La recherche de destinataire est définie par les champs on-chain `enc_pubkey`, `sign_pubkey` et par la cellule on-chain complète `pq_kem_pubkey` stockée dans l'enregistrement de clé actif du Vault. Le hachage et la longueur demeurent dans l'enregistrement en tant que champs de liaison compacts, mais c'est la clé publique ML-KEM-768 complète qui permet à un autre client de chiffrer effectivement une capsule `hybrid-v1`.

## Trousseaux signés

La PWA peut exporter un trousseau de clés publiques signé. La charge utile signée comprend :

- le domaine de protocole `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1` ;
- des horodatages d'émission et, en option, d'expiration ;
- des emplacements réservés facultatifs pour le portefeuille propriétaire et l'adresse du Vault ;
- le trousseau public de chiffrement ;
- la clé publique de signature Ed25519 de 32 octets.

La signature couvre la charge utile JSON stable et est vérifiée avant que le trousseau ne soit reconnu comme fiable. Cela empêche toute altération locale silencieuse du trousseau et fournit au client la clé `sign_pubkey` exacte que le Vault stocke dans `KeyRecord`.

Le `keyId` de la PWA est un identifiant de trousseau côté client. Il ne remplace pas le champ `current_key_id` du contrat Vault, qui est calculé on-chain à partir de l'adresse du propriétaire, de la génération de clé, de la clé de signature, de la clé de chiffrement, du hachage PQ, de la longueur PQ et de la suite cryptographique. Un client de production doit vérifier le trousseau par rapport à l'enregistrement de clé du Vault avant de lui faire confiance pour une identité de portefeuille.

Le trousseau signé est une auto-signature de clé de messagerie. La propriété du portefeuille est ancrée par l'activation du Vault : le portefeuille Platho intégré envoie `RegisterMessagingKeys`, les rotations ultérieures `ReplaceMessagingKeys` sont des messages externes signés avec l'autorisation du Vault, et les destinataires vérifient le trousseau signé par rapport à l'enregistrement de clé on-chain actif de ce portefeuille.

## Propriété du portefeuille

La PWA de production n'utilise pas de connecteur de portefeuille externe. Un utilisateur crée ou importe une phrase de récupération GRAM normale de 24 mots, et la PWA
dérive de manière déterministe la clé du portefeuille GRAM, une clé d'authentification Vault distincte et les clés de chiffrement/signature de messagerie à partir de cette phrase. L'activation
du Vault est l'ancre de propriété : le portefeuille intégré signe et envoie `RegisterMessagingKeys` depuis le même portefeuille qui possède l'enregistrement de clé on-chain.
`ReplaceMessagingKeys` fait uniquement tourner l'enregistrement de clé publique de réception/messagerie ; il ne fait pas tourner la clé d'authentification du Vault.

Les destinataires n'accordent leur confiance à un trousseau de messagerie qu'après l'avoir vérifié par rapport à l'enregistrement de clé actif du Vault pour ce portefeuille :

- le propriétaire de l'enregistrement est le portefeuille attendu ;
- `enc_pubkey` et `sign_pubkey` correspondent au trousseau signé ;
- les enregistrements hybrides exposent la cellule `pq_kem_pubkey` complète, et pas seulement son hachage ;
- les octets décodés de la clé ML-KEM-768 ont pour hachage `pq_kem_pubkey_hash` ;
- le champ actif `current_key_id` pointe vers l'enregistrement de clé vérifié.

Le flux d'exportation/importation du profil gère la phrase de récupération GRAM de 24 mots. Il n'existe pas de sauvegarde distincte de la clé de messagerie ni de
mode de connexion à un portefeuille externe.

## Disposition compacte des octets

Les cellules on-chain des capsules privées utilisent la disposition binaire finale `platho.byte-layout.v1`. La PWA peut envelopper les capsules dans du JSON pour l'interface d'exportation/partage, mais la charge utile du protocole est constituée d'octets binaires, non de JSON ni d'un pointeur off-chain. `CapsuleHub` stocke des en-têtes/index authentifiés compacts ainsi que le hachage du corps ; la cellule de corps chiffrée reste dans le corps de la transaction de publication acceptée et est reconstruite à partir de l'historique des messages TON, puis vérifiée par rapport aux hachages stockés.

Chaque publication passe par le Vault sous forme de message externe signé financé par le solde du Vault. L'utilisateur alimente d'abord son solde GRAM
interne du Vault, puis la PWA signe une demande de publication avec le champ `auth_pubkey` actif ; un relayeur peut soumettre le
message externe sans détenir la clé du portefeuille ni la clé de signature de messagerie. La charge utile signée est séparée par domaine avec `VPB1`,
`deployment_manifest_hash`, l'adresse cible du Vault et le type de publication, avant le propriétaire, le nonce, la charge maximale et la charge utile.
La valeur GRAM que CapsuleHub renvoie effectivement dans un ACK ou un rebond est créditée sur le solde GRAM interne du Vault de l'utilisateur,
plafonnée par le montant de remboursement de publication en attente suivi. Si le solde du Vault ou l'accès à la chaîne n'est pas disponible, la
PWA échoue en mode fermé et ne doit pas exposer d'actions de publication.

Parce que `auth_pubkey` autorise les dépenses sur le solde du Vault, la compromission de la seule clé locale de signature de messagerie n'autorise pas
les actions de publication, de vérification de paiement, de nom d'utilisateur ou d'avatar du Vault. La compromission d'une clé de signature de messagerie peut tout de même affecter les
signatures d'identité au niveau des messages ; le remplacement de clé révoque donc l'ancien enregistrement de clé publique de réception pour les futures vérifications de chiffrement entrant.

La tarification des messages de la PWA est par capsule. Avec les réserves actuelles et sans remise ATH, les exemples canoniques exacts sont : entrées publiques de 1 KiB à partir de `0.0337 GRAM` et capsules privées `hybrid-v1` de 1 KiB
à partir de `0.0347 GRAM` ; les classes de taille publiques ou privées plus grandes coûtent davantage selon la classe canonique. Cela inclut l'intégralité des
frais de protocole Platho de `0.01 GRAM`, la dotation de stockage de l'index compact de CapsuleHub, la réserve d'exécution locale du Vault et le
remboursement ACK attendu. Séparément, si l'estimation de frais prudente de la PWA est supérieure à l'allocation de frais réseau incluse
de `0.005 GRAM`, elle ajoute
le dépassement arrondi sous forme de surcharge. Les appels de contrat partent toujours de leurs
valeurs canoniques requises : les publications du Vault envoient `maxCharge = canonical_max_charge + surcharge`. CapsuleHub n'a pas d'ABI de publication
directe pour l'utilisateur ; chaque publication va du Vault vers CapsuleHub. Les remises ATH ne s'appliquent qu'après que l'airdrop d'activité du Vault
a distribué 15 000 000 ATH ; avant ce seuil, les frais de protocole des messages utilisent l'intégralité des frais de `0.01 GRAM`. La PWA doit afficher la retenue
finale et le coût net pour la taille de contenu sélectionnée avant la signature.

La surcharge est une marge de sécurité réseau/stockage signée, et non un compartiment de frais remboursables. CapsuleHub accepte les publications du Vault
lorsque la valeur attachée est au moins égale à la valeur canonique requise, mais un ACK de publication réussie ne renvoie que la réserve fixe
d'ACK de publication de `30,000,000` nanotons (`0.030 GRAM`). Après que le Vault a traité cet ACK, l'utilisateur est crédité d'environ
`25,800,000` nanotons sur son solde GRAM interne du Vault. Toute surcharge signée au-dessus de la valeur canonique requise reste dans
CapsuleHub en tant que dépassement de réserve réseau/stockage ; elle n'est pas renvoyée au Vault et n'est pas comptabilisée comme
`accrued_plato_fee_ton`.

CapsuleHub protège une réserve GRAM brute égale à `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
La réserve en direct utilise des compteurs d'entrées privées/publiques non élagués plutôt que des compteurs historiques `latest_id`. Un appel
`SweepExcessReserve` distinct et sans permission ne peut déplacer que l'excédent au-dessus de ce montant protégé vers FeeAccumulator sous forme de
`DepositProtocolFee`, où il suit la répartition normale trésorerie/rachat. L'envoi ordinaire de messages n'effectue pas ce
balayage. Si ce dépôt de balayage rebondit, le montant renvoyé est intentionnellement reclassé comme `accrued_plato_fee_ton` garanti
afin qu'il puisse être réessayé via le chemin normal de vidange des frais.
Les appels partiels `FlushFees` normaux doivent être au moins égaux aux frais de protocole publics actuels (`0.010 GRAM`) ; un montant inférieur n'est
valide que lorsqu'il correspond à l'intégralité du compartiment accumulé restant, de sorte que les poussières remisées puissent tout de même être finalisées.

CapsuleHub enregistre `created_at = now()` pour chaque entrée privée et publique. La PWA utilise cet horodatage de contrat pour l'ordonnancement et pour la recherche bornée dans l'historique des transactions ; les horodatages d'en-tête du client demeurent des métadonnées de charge utile authentifiées, et non l'autorité de découverte. Les métadonnées d'entrée compactes peuvent être élaguées sans permission après la fenêtre de rétention configurée d'un an, tandis que la disponibilité du corps dépend de la couverture de l'historique des messages du fournisseur TON choisi et du cache chiffré local de l'utilisateur.

Le solde ATH du Vault est crédité via une comptabilité explicite de flux de notification, et non en scannant le solde brut du portefeuille officiel.
Le chemin de dépôt pris en charge est le `ATHTransferRequestWithNotify` de l'ATHWallet de l'utilisateur vers le Vault. Un transfert ATH ordinaire manuel
vers l'ATHWallet officiel du Vault n'est pas pris en charge et ne doit pas être affiché comme adresse de dépôt ni traité comme un
crédit au grand livre du Vault. Le retrait ATH depuis le Vault est une commande Vault externe signée. Sa réserve en aval de
déploiement/transfert/ACK de l'ATHWallet est payée à partir du solde GRAM interne du Vault de l'utilisateur, et le Vault ne recrédite que
la valeur ACK/échec/rebond authentifiée qu'il reçoit, moins la réserve de remboursement locale et plafonnée par la valeur interne réservée.

Les publications et commentaires publics constituent un profil ouvert distinct, et non des capsules privées sans chiffrement. Ils stockent une cellule
d'en-tête public compacte `PPH1` ainsi qu'une cellule de corps public brute. Le texte du corps public et les octets d'image/avatar publics utilisent les mêmes
classes de taille de capsule publique de 1, 2, 4, 8, 16 ou 32 KiB que le budget de corps visible par l'utilisateur. Les métadonnées d'en-tête ne réduisent jamais
ce budget de corps. Les publications publiques n'ont pas d'option post-quantique ; les messages publics partent de `0.0337 GRAM`,
tandis que l'exemple de base public exact actuel est de `0.0337 GRAM` plus la même
règle de surcharge de frais réseau. `kind = 1` est une publication publique ; le bit 0 des `flags` de la publication ferme les commentaires pour cette publication. `kind = 2` est
un commentaire public à un niveau avec `parent_entry_id:uint64` et `parent_body_hash:uint256` dans l'en-tête. `kind = 3` est une
publication d'image publique, `kind = 4` est un commentaire d'image publique, et `kind = 5` est un média d'avatar de portefeuille public. Les en-têtes publics portent également `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16` et `media_format:u8` ; les en-têtes publics utilisent `media_format = 0` pour le texte et
`media_format = 1` pour les parties d'image/avatar WebP. Les en-têtes de publication, de publication d'image et d'avatar portent aussi
`profile_version:uint32` et `avatar_hash:uint256` ; zéro signifie l'absence de pointeur d'avatar. Un texte public long ou des données d'image sont reconstruits à partir de plusieurs entrées
uniquement après que chaque entrée a utilisé la plus petite classe de taille publique adaptée jusqu'à 32 KiB. La PWA officielle compresse les images sélectionnées vers des cibles WebP de 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, par défaut) ou 64 KiB (`maximum`) avant le découpage. Il n'y a aucune couche d'édition/suppression/réaction/modération ni de compteur.

Les avatars de portefeuille sont des mises à jour de profil payantes, et non des ressources off-chain. Les octets de l'avatar sont publiés comme entrées CapsuleHub
publiques `kind = 5`, puis `ProfileRegistry` enregistre le pointeur de portefeuille authentifié :
`version`, `avatar_hash`, le premier `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count` et `media_format`. Les lecteurs
résolvent le pointeur de profil à partir de l'en-tête privé signé ou de l'en-tête de publication publique, vérifient l'enregistrement ProfileRegistry
correspondant, récupèrent les entrées publiques de l'avatar depuis CapsuleHub, concatènent les parties dans l'ordre des index, et exigent que les octets WebP
reconstruits aient pour hachage `avatar_hash`. Le cache d'avatar local n'est qu'une accélération ; la source de vérité est CapsuleHub plus
ProfileRegistry.

`header0_cell` stocke exactement 140 octets :

```text
PH0B
|| version:u8
|| publish_kind:u8
|| size_class:u8
|| crypto_suite:u8
|| sender_key_id:32 bytes
|| recipient_key_id:32 bytes
|| sender_sign_pubkey:32 bytes
|| profile_version:uint32
|| avatar_hash:uint256
```

`header1_cell` stocke exactement 30 octets :

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` impliquent la suite. `profile_version` et `avatar_hash` pointent vers l'avatar du portefeuille de l'expéditeur au
moment de l'envoi et sont couverts par le hachage de l'en-tête plus la signature de l'expéditeur. `recipient_sign_pubkey` et les hachages de fil de discussion ne sont
intentionnellement pas stockés dans les cellules d'en-tête public. Les données de fil/regroupement appartiennent aux métadonnées chiffrées de la capsule.

Chaque corps chiffré est assemblé comme suit :

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

Le texte en clair AES-GCM est un unique emplacement de capsule fixe sélectionné par `size_class` :

```text
PCP1
|| version:u8
|| kind:u8
|| flags:u8
|| media_format:u8
|| stream_id:u128
|| part_index:u16
|| part_count:u16
|| content_len:u16
|| reserved:u16
|| payload[useful_size]
```

La zone de contenu utile est complétée jusqu'à la classe de capsule privée sélectionnée de 1, 2, 4, 8, 16 ou 32 KiB. Un message de 1 octet, 500 octets ou 1024 octets de texte utile a la même taille de texte en clair chiffré dans la classe 1 KiB. Les messages dépassant la classe sélectionnée sont découpés en capsules indépendantes avec des métadonnées chiffrées `stream_id`, `part_index` et `part_count`. Une capsule ne mélange jamais des unités de texte/image sans rapport ; le destinataire réassemble les capsules indépendantes pour reconstituer le message original.

Types de contenu :

- `1` texte : octets UTF-8, jusqu'à la taille utile de capsule privée sélectionnée.
- `2` image : octets d'image WebP compressés, jusqu'à la taille utile de capsule privée sélectionnée (`media_format = 1`).
- `3` chèque de paiement : `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Les corps de chèque de paiement n'incluent intentionnellement pas de `tx`, d'heure d'activation ni d'expiration. Le destinataire encaisse au moyen de `intent_id + secret32` ; si l'expéditeur a déjà annulé le chèque ou s'il a déjà été encaissé, l'interface indique que le chèque a déjà été encaissé ou annulé par l'expéditeur.

Le corps chiffré peut être enveloppé pour l'exportation/le partage sous la forme :

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Pour le corps de la capsule finale, `chunk_total` vaut toujours `1`. `PLC1` n'est qu'un cadre de paquetage/exportation. La transaction de publication acceptée Vault -> CapsuleHub transporte les octets du corps `PLB1` assemblés dans une cellule serpent ; CapsuleHub ne conserve que des métadonnées et des hachages authentifiés compacts.

Limites privées finales :

| Suite | Plafond utile par capsule | Octets du corps | Octets du fragment d'exportation |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

La source canonique de cette disposition est `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM utilise un nonce de 12 octets et une étiquette de 16 octets. La longueur du texte chiffré est égale à la longueur du texte en clair plus l'étiquette.

Le préfixe compact du corps, `header0Hash` et `header1Hash` sont passés comme données authentifiées additionnelles AES-GCM. Modifier les en-têtes de routage binaires, la suite, le nonce, le texte chiffré KEM, les octets des fragments ou la signature de l'expéditeur fait échouer la vérification ou le déchiffrement.

Avant le déchiffrement, le client vérifie également :

- que la suite du corps compact correspond à `header0` ;
- que l'identifiant de clé du destinataire correspond à `header0.recipientKeyId` ;
- que les corps `hybrid-v1` portent bien un texte chiffré ML-KEM de 1088 octets ;
- que chaque fragment a la même suite, le même identifiant de message et le même total de fragments.

## Dérivation de clé

Pour `hybrid-v1` :

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

Le texte en clair est chiffré avec AES-256-GCM.

L'implémentation rejette les secrets partagés X25519 entièrement nuls afin d'éviter d'accepter des clés publiques d'ordre faible.

## Capsules chiffrées privées

Le client enveloppe les corps chiffrés compacts dans une capsule privée avant la publication. Une capsule privée comporte :

- `header0` : l'en-tête de routage binaire `PH0B` de 140 octets décrit ci-dessus.
- `header1` : l'en-tête de rejeu binaire `PH1B` de 30 octets décrit ci-dessus.
- `body` : les métadonnées de fragment `platho.byte-layout.v1` plus les fragments binaires encodés en base64url.
- `hashes` : les valeurs `Cell.hash()` de TON pour les cellules on-chain exactes qui contiennent `header0`, `header1` et les octets du corps chiffré.
- `chainCells` : charges utiles BOC en base64 utilisant `ton-snake-byte-cell.v1` ; ce sont les cellules acceptées dans la transaction de publication Vault -> CapsuleHub et authentifiées par `CapsuleHub`, et non un pointeur off-chain.
- `senderSignature` : signature Ed25519 sur l'identifiant de la capsule et les trois hachages.

Pour `hybrid-v1`, la capsule utilise le profil hybride de CapsuleHub :

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

Le brouillon de capsule privée est mappé sur le corps `PublishPrivateFromVault` Vault -> CapsuleHub après que la demande externe signée
`PublishPrivateFromVaultBalance` a été acceptée par le Vault :

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Les messages de publication du Vault portent `protocol_fee_paid`, car le Vault est l'autorité de remise pour la tarification adossée à ATH.

La capacité de charge utile utile est la capacité des octets du corps chiffré qui sont effectivement sérialisés dans `body_cell` et acceptés par `CapsuleHub`. Un hachage sans le corps de transaction de publication accepté correspondant n'est pas un message lisible. L'historique local n'est qu'un cache ; il ne définit pas la livraison.

Pour la signature de publication externe du Vault, l'ordre des références de hachages demeure compatible avec le contrat :

```text
body_hash || header_0_hash || header_1_hash
```

Le corps compact est lié à `header0Hash` et `header1Hash` par l'AAD AES-GCM. Remplacer les en-têtes, les fragments du corps, les métadonnées de suite, la signature de l'expéditeur, le contexte de la capsule ou les cellules de charge utile BOC fait échouer la vérification avant que le message ne soit accepté.

## Source de vérité de la livraison

Les messages privés acceptés sont des entrées CapsuleHub compactes accompagnées des cellules de charge utile chiffrée transportées par le corps de la transaction de publication acceptée. La PWA récupère ces cellules depuis l'historique des messages TON et les vérifie par rapport aux hachages de CapsuleHub avant de déchiffrer. La PWA de production n'expose pas d'échange manuel de paquets JSON de trousseau public ou de capsule chiffrée.

Les clés publiques de messagerie sont enregistrées dans les enregistrements de clé du `Vault`. Un expéditeur doit résoudre et vérifier l'enregistrement de clé du destinataire avant de chiffrer une capsule privée. L'historique chiffré local n'est qu'un cache d'appareil ; il ne définit pas la livraison.

L'autorité du nom d'utilisateur `.ath` comporte deux parties. `UsernameRegistry.get_name_record` prouve qu'un nom existe et pointe vers le
`UsernameNFTItem` exact de ce nom. Le propriétaire actuel est ensuite lu depuis l'état de cet item. Les transferts changent le propriétaire de
l'item ; l'enregistrement du registre demeure l'ancre nom-vers-item. L'item expose les données NFT standard et les métadonnées on-chain TEP-64,
y compris `name = <username>.ath`, sans URI de métadonnées hébergé sur un serveur. Les octets du nom d'utilisateur sont délibérément
littéraux : les noms commençant, se terminant, contenant des séparateurs consécutifs ou composés uniquement de séparateurs sont valides dès lors que chaque octet appartient à l'ensemble autorisé `a-z`,
`0-9`, `_`, `-` et que la longueur est de 4..16. Si un mint en attente devient obsolète après
un ACK d'item manquant, `PrunePendingUsernameMint` est non destructif : il prouve la condition d'obsolescence mais ne supprime pas
l'état en attente ni ne crée de remboursement dû. Un item déployé ne devient un nom d'utilisateur faisant autorité qu'après que le registre a finalisé
l'enregistrement de nom correspondant via un ACK tardif valide ou `ResendDeployedAck`. Les clients et indexeurs doivent ignorer les revendications de propriété
au niveau de l'item seul et ne doivent pas utiliser le propriétaire de l'enregistrement du registre comme propriétaire actuel après des transferts.

La phrase de récupération GRAM de 24 mots est l'unique secret de l'utilisateur. La PWA dérive de manière déterministe la clé du portefeuille GRAM et les clés de chiffrement/signature de messagerie à partir de cette phrase. Le flux d'exportation/importation du profil ne gère donc que la phrase de récupération ; il n'existe pas de sauvegarde distincte de la clé de messagerie.

## Politique de rejeu et d'expiration

Les capsules privées ont par défaut une durée de vie (TTL) de 24 heures et sont plafonnées à 30 jours. La vérification en direct/off-chain des paquets de capsules rejette :

- les capsules créées trop loin dans le futur ;
- les capsules expirées ;
- les TTL au-dessus du plafond de la politique ;
- les identifiants de capsule dupliqués dans le cache de rejeu fourni par l'appelant.

L'importation depuis l'historique de la chaîne est différente : lorsqu'une entrée privée est déjà acceptée par CapsuleHub et que le corps est récupéré depuis
l'historique de transactions TON accepté ou le cache chiffré local, la PWA vérifie les hachages de l'entrée, les cellules de corps/en-tête et le
déchiffrement, mais elle ne rejette pas au seul motif que l'expiration de l'en-tête est dans le passé. Sinon, l'historique de chaîne conservé
deviendrait illisible par conception.

Le cache de rejeu est un état local ; les clients de production peuvent l'adosser à IndexedDB ou à un autre stockage local à l'appareil. Aucun backend n'est requis.

## Règle du sans-backend

La couche de chiffrement ne requiert pas de backend Platho. Un serveur peut héberger des fichiers statiques, mais la livraison privée est ancrée par l'état de chaîne de `CapsuleHub` plus les corps de transaction de publication acceptés : l'entrée compacte prouve les hachages, et le corps doit toujours être disponible depuis l'historique des messages TON ou le cache chiffré local de l'utilisateur. Le serveur ne reçoit jamais de texte en clair, de clés privées ni de secret de session côté serveur.

## Brouillon d'enregistrement Vault

Le client peut dériver un brouillon `RegisterMessagingKeys` à partir d'un trousseau signé vérifié :

- `enc_pubkey` : clé publique X25519 de 32 octets sous forme d'uint256.
- `sign_pubkey` : clé publique de signature Ed25519 de 32 octets sous forme d'uint256.
- `auth_pubkey` : clé publique d'authentification Vault Ed25519 distincte de 32 octets sous forme d'uint256.
- `pq_kem_pubkey_hash` : SHA-256 de la clé publique ML-KEM-768.
- `pq_kem_pubkey_len` : `1184`.
- `pq_kem_pubkey` : cellule serpent canonique contenant exactement 1184 octets de clé publique ML-KEM-768.
- `crypto_suite_mask` : `2` pour `hybrid-v1`.

Ce brouillon est soumis par le flux d'activation du portefeuille Platho intégré. Une fois le portefeuille activé dans le Vault, les autres utilisateurs activés peuvent résoudre son enregistrement de clé publique de messagerie et lui chiffrer des capsules privées.

## Liaison de l'enregistrement de clé du Vault

Après que le portefeuille a enregistré des clés on-chain, le client doit récupérer :

- le `UserState.current_key_id` du portefeuille ;
- pour le propre portefeuille déverrouillé de l'utilisateur, `UserState.auth_pubkey` correspondant à la clé publique d'authentification Vault dérivée localement ;
- le `VaultKeyRecordView` pour cet identifiant de clé.

> **clean-17.** Le contrat Vault décrit dans ce chapitre relève de clean-15. Sous clean-17, le même lien est lu depuis le contrat KeyShard PROPRE au portefeuille (`web/key-shard-ton-rpc-provider.mjs`), dont l'adresse est dérivée du portefeuille — un enregistrement ne peut donc contenir que des clés enregistrées par ce portefeuille. Le pont fournisseur `web/vault-chain-provider.mjs` a été supprimé avec le Vault.

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Si aucun fournisseur n'est configuré, la liaison du Vault reste indisponible plutôt que d'accepter un brouillon local ou un emplacement réservé de l'interface. Un déploiement de production/statique peut installer un fournisseur sur `globalThis.plathoVaultChainProvider` qui lit le Vault déployé via un miroir d'API TON ou un transport compatible client léger.

Le runtime statique inclut `web/ton-rpc-transport.mjs` comme squelette de fournisseur de production. Il peut envelopper des points de terminaison compatibles TON Center v3 ou un `globalThis.plathoTonRpcTransport` personnalisé installé par le bundle hôte. La PWA actuelle n'expose pas d'écran de paramètres RPC utilisateur intégré. Le fournisseur :

- encode les adresses de propriétaire de `get_user(owner)` comme éléments de pile BoC `slice` ;
- appelle `get_key_record(current_key_id)` avec un élément de pile numérique ;
- décode les piles des getters en `VaultUserView` et `VaultKeyRecordView` ;
- échoue en mode fermé si le transport RPC, l'adresse du Vault, la réponse du getter ou la liaison de l'enregistrement de clé est indisponible.

Le vérificateur côté client contrôle que l'enregistrement Vault actif correspond au trousseau signé vérifié :

- `owner_wallet` correspond à l'adresse du portefeuille Platho intégré ;
- `enc_pubkey` correspond à la clé publique X25519 ;
- `sign_pubkey` correspond à la clé publique de signature du trousseau ;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash` et `pq_kem_pubkey_len` correspondent au matériel ML-KEM-768 ;
- `crypto_suite_mask` correspond à la suite ;
- `revoked_lt` est nul ;
- le `current_key_id` optionnel pointe vers l'identifiant de l'enregistrement récupéré.

Le client n'invente pas l'identifiant de clé on-chain. Le Vault le calcule à partir de l'adresse du propriétaire, de la génération de clé, des champs de clé, de la longueur PQ et de la suite. Le client vérifie plutôt l'enregistrement récupéré.

## Magasin de rejeu durable

La PWA utilise IndexedDB pour la protection contre le rejeu des capsules privées lorsqu'il est disponible, avec un repli en mémoire. Le magasin conserve les identifiants de capsule jusqu'à leur expiration et élague localement les entrées expirées. Il s'agit d'un état local à l'appareil qui ne requiert pas de serveur.

## Historique local chiffré des messages

La PWA dispose également d'un magasin d'historique de messages chiffré et local à l'appareil. Il utilise une clé AES-GCM-256 WebCrypto non extractible enregistrée dans IndexedDB et stocke chaque corps de message sous forme de texte chiffré authentifié. L'en-tête de l'enregistrement ne conserve que des métadonnées de requête locales : identifiant, identifiant de fil, horodatage, direction et identifiant de capsule optionnel.

L'en-tête est lié comme données authentifiées additionnelles AES-GCM. Modifier l'identifiant de fil, l'horodatage, la direction, l'identifiant de capsule, le nonce ou le texte chiffré empêche l'ouverture de l'enregistrement. Si IndexedDB est indisponible, l'application se replie sur un historique chiffré en mémoire pour cette session et évite d'écrire du texte en clair dans le stockage persistant du navigateur.
