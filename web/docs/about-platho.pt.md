# Sobre o Platho

O Platho é um aplicativo de comunicação para pessoas que se cansaram de depender da infraestrutura de outra pessoa para a vida digital básica: mensagens, identidade, perfil, histórico e acesso aos próprios fundos.

A internet comum é construída de forma confortável demais para as pessoas que a controlam. Uma conta pode ser encerrada. O acesso pode ser limitado. O histórico pode ser apagado. As regras podem ser mudadas depois que os usuários já transferiram parte de suas vidas para uma plataforma. Ali o usuário não é dono. O usuário é um inquilino que existe enquanto a plataforma permitir.

O Platho é construído contra esse modelo.

As ações centrais no Platho são ancoradas pela carteira do usuário e executadas por meio de contratos inteligentes abertos. A carteira permanece como a raiz do controle, enquanto a atividade rotineira do aplicativo pode ocorrer por meio do Vault e de comandos assinados, em vez de expor a carteira diretamente a cada vez. Isso não torna o sistema perfeito. Isso remove o defeito central das plataformas comuns: a capacidade oculta de reescrever as regras, cortar o acesso ou assumir o controle do que deveria pertencer ao usuário.

As mensagens privadas são ancoradas on-chain como entradas de cápsula criptografadas. O corpo criptografado pesado é transportado no corpo da transação TON aceita, recuperado do histórico de transações TON aceitas e verificado contra os hashes do CapsuleHub, de modo que a disponibilidade depende da cobertura de histórico do provedor e do cache criptografado local do usuário. As mensagens públicas, os perfis e os nomes usam estado de contrato verificável em vez de um banco de dados fechado. Isso reduz a dependência de um servidor, de um operador e de qualquer política que por acaso seja conveniente nesta semana.

O Platho não esconde o custo dessa arquitetura. A blockchain é pública. As operações custam dinheiro. Os erros do usuário podem ser irreversíveis. Uma frase-semente perdida não pode ser recuperada por meio do suporte, e o Platho não é um arquivo permanente: entradas de cápsula compactas podem ser podadas após a janela de retenção, enquanto a recuperação de corpos antigos depende do histórico do provedor ou do cache local do usuário. Este é um modelo difícil.

A carteira pessoal e o Vault são separados. A carteira permanece como a raiz do controle: ela deposita e saca fundos, e controla as chaves. O Vault é uma camada de contrato protetora entre a carteira e a rede pública. O usuário move uma quantidade limitada de GRAM/ATH para o Vault, e a publicação, os pagamentos de protocolo e outras operações do aplicativo ocorrem por meio de saldos internos e comandos assinados. Isso reduz a exposição direta da carteira on-chain e limita quanto valor fica exposto à atividade rotineira do aplicativo.

O ATH é o token utilitário do protocolo. Ele é usado para nomes de usuário, atualizações de avatar e descontos em taxas de protocolo após o airdrop. Seu papel está atrelado ao uso real dentro do aplicativo.

O ATH é projetado para os participantes do sistema. Uma parcela significativa da oferta é distribuída por meio da atividade dos usuários, e não por meio de uma alocação fechada para endereços iniciais. Isso torna a economia menos dependente de um conjunto restrito de detentores e mais conectada ao uso real da rede.

O Platho não tem controle administrativo oculto sobre os saldos dos usuários. Os contratos não dão a ninguém uma chave administrativa arbitrária para confiscar os fundos de outras pessoas, reescrever saldos, pausar operações de usuários ou atualizar as regras do protocolo. A V1 ainda possui autoridades de lançamento restritas e documentadas: a vinculação e o selamento de gênese, o congelamento da rota BuybackBurn após o pool, o congelamento de precificação do MarketStabilitySeller após o pool e a ativação unidirecional da divisão de recompra do FeeAccumulator após o preflight.

O ponto é simples: a vida digital não deveria depender da permissão de uma plataforma. As mensagens, o nome de usuário, o perfil e os fundos deveriam pertencer ao usuário na maior medida em que um sistema real pode tornar isso verdade.

O Platho não está tentando ser uma jaula confortável. Está tentando ser uma ferramenta em que o controle sobre as coisas digitais básicas retorna à pessoa que a usa, e não a quem controla o servidor, o banco de dados ou as regras de acesso.
