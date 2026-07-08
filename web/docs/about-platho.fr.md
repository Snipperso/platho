# À propos de Platho

Platho est une application de communication destinée aux personnes qui en ont assez de dépendre de l'infrastructure de quelqu'un d'autre pour leur vie numérique de base : messages, identité, profil, historique et accès à leurs propres fonds.

L'internet ordinaire est conçu de façon trop confortable pour ceux qui le contrôlent. Un compte peut être fermé. L'accès peut être limité. L'historique peut être supprimé. Les règles peuvent être modifiées après que les utilisateurs ont déjà transféré une partie de leur vie dans une plateforme. L'utilisateur n'y est pas propriétaire. L'utilisateur est un locataire qui n'existe que tant que la plateforme le permet.

Platho est construit à l'encontre de ce modèle.

Les actions fondamentales dans Platho sont ancrées par le portefeuille de l'utilisateur et exécutées au moyen de contrats intelligents ouverts. Le portefeuille demeure la racine du contrôle, tandis que l'activité courante de l'application peut passer par le Vault et des commandes signées plutôt que d'exposer directement le portefeuille à chaque fois. Cela ne rend pas le système parfait. Cela supprime le défaut central des plateformes ordinaires : la capacité cachée de réécrire les règles, de couper l'accès ou de prendre le contrôle de ce qui devrait appartenir à l'utilisateur.

Les messages privés sont ancrés on-chain sous forme d'entrées de capsule chiffrées. Le corps chiffré volumineux est transporté dans le corps de la transaction TON acceptée, récupéré à partir de l'historique des transactions TON acceptées et vérifié par rapport aux hachages CapsuleHub, de sorte que la disponibilité dépend de la couverture de l'historique du fournisseur et du cache chiffré local de l'utilisateur. Les messages publics, les profils et les noms utilisent un état de contrat vérifiable plutôt qu'une base de données fermée. Cela réduit la dépendance à un serveur, à un opérateur et à la politique qui se trouve être commode cette semaine-là.

Platho ne cache pas le coût de cette architecture. La blockchain est publique. Les opérations coûtent de l'argent. Les erreurs des utilisateurs peuvent être irréversibles. Une phrase de récupération perdue ne peut pas être restaurée par le support, et Platho n'est pas une archive permanente : les entrées de capsule compactes peuvent être élaguées après la fenêtre de rétention, tandis que la récupération d'un ancien corps dépend de l'historique du fournisseur ou du cache local de l'utilisateur. C'est un modèle exigeant.

Le portefeuille personnel et le Vault sont séparés. Le portefeuille demeure la racine du contrôle : il dépose et retire des fonds, et il contrôle les clés. Le Vault est une couche de contrat protectrice entre le portefeuille et le réseau public. L'utilisateur transfère une quantité limitée de GRAM/ATH dans le Vault, et la publication, les paiements de protocole ainsi que les autres opérations de l'application passent par des soldes internes et des commandes signées. Cela réduit l'exposition directe du portefeuille on-chain et limite la valeur exposée à l'activité courante de l'application.

ATH est le jeton utilitaire du protocole. Il est utilisé pour les noms d'utilisateur, les mises à jour d'avatar et les remises sur les frais de protocole après l'airdrop. Son rôle est lié à un usage réel au sein de l'application.

ATH est conçu pour les participants au système. Une part significative de l'offre est distribuée par l'activité des utilisateurs plutôt que par une allocation fermée à des adresses précoces. Cela rend l'économie moins dépendante d'un ensemble restreint de détenteurs et davantage connectée à l'usage réel du réseau.

Platho n'a aucun contrôle administratif caché sur les soldes des utilisateurs. Les contrats ne donnent à personne un interrupteur administrateur arbitraire pour saisir les fonds d'autrui, réécrire les soldes, mettre en pause les opérations des utilisateurs ou mettre à niveau les règles du protocole. La V1 conserve encore des autorités de lancement documentées et restreintes : la liaison et le scellement de genesis, le gel de la route BuybackBurn après la mise en place du pool, le gel de la tarification MarketStabilitySeller après la mise en place du pool, et l'activation à sens unique de la répartition du rachat du FeeAccumulator après le contrôle préalable.

Le point est simple : la vie numérique ne devrait pas dépendre de l'autorisation d'une plateforme. Les messages, le nom d'utilisateur, le profil et les fonds devraient appartenir à l'utilisateur autant qu'un système réel peut le permettre.

Platho ne cherche pas à être une cage confortable. Il cherche à être un outil où le contrôle des choses numériques de base revient à la personne qui l'utilise, et non à quiconque contrôle le serveur, la base de données ou les règles d'accès.
