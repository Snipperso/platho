# Whitepaper do ATH

## O Token do Protocolo Platho

O ATH é o token utilitário do Platho. Ele é usado para recompensas de atividade, descontos na taxa do protocolo após o airdrop, nomes de usuário `.ath`, atualizações do avatar de perfil, vendas de estabilização de mercado, buyback e burn.

O ATH não é um token administrativo. Ele não concede a capacidade de reescrever saldos, pausar operações, cunhar novo fornecimento ou alterar as regras de propriedade dos usuários. Seu papel é impulsionar a economia da aplicação e conectar o uso do Platho à contabilidade on-chain.

Este documento descreve o modelo do ATH no Platho.

## Parâmetros Fundamentais

O ATH tem um fornecimento total fixo:

```text
100,000,000 ATH
```

O preço de referência de lançamento é:

```text
1 ATH = 0.001 GRAM
```

A avaliação totalmente diluída no lançamento é:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

O ATH parte de uma capitalização de referência de `100,000 GRAM`.

## Fornecimento Fixo

O ATH é emitido pelo `ATHMaster`. Na inicialização, o `ATHMaster` define o fornecimento total fixo em `100,000,000 ATH`.

Não existe função de cunhagem após o genesis. O `ATHMaster` não implementa cunhagem administrativa, pausa, blacklist, imposto sobre transferência, transferência forçada ou dreno de resgate.

A implantação do fornecimento inicial é realizada uma única vez através de `DeployTreasurySupply`. Ela envia o fornecimento total à carteira ATH da tesouraria. A implantação do fornecimento genesis não pode ser repetida.

O fornecimento total diminui apenas através de burn. O `ATHMaster` aceita um burn somente após uma notificação de burn autenticada, vinda da carteira ATH determinística do endereço proprietário. Após a verificação, o `ATHMaster` reduz o `total_supply` e envia `ATHBurnFinalized`.

O burn de ATH é uma redução real do fornecimento total, não uma transferência para um endereço não utilizado.

## Alocação do Fornecimento

O fornecimento de ATH é alocado em quatro categorias:

| Categoria | Parcela | Quantidade |
| --- | ---: | ---: |
| Airdrop de atividade | 15% | 15,000,000 ATH |
| Liquidez inicial | 15% | 15,000,000 ATH |
| Vesting de protocolo de longo prazo | 10% | 10,000,000 ATH |
| Reserva de estabilidade de mercado | 60% | 60,000,000 ATH |

Esta alocação define a estrutura econômica do Platho:

- 15% do fornecimento é distribuído aos usuários através da atividade na aplicação antes do lançamento do pool.
- 15% do fornecimento é usado para a liquidez inicial.
- 10% do fornecimento é bloqueado em vesting imutável de longo prazo.
- 60% do fornecimento é financiado para o MarketStabilitySeller e bloqueado no genesis, depois vendido em tranches acima do preço de lançamento após o congelamento de preços posterior ao pool.

O airdrop de atividade e a reserva de vesting de longo prazo são lastreados, no genesis final, pelas carteiras ATH oficiais do Vault e do ATHVesting, e o verificador de release confere esses saldos antes do release de produção. A reserva de estabilidade de mercado de `60,000,000 ATH` é financiada para o MarketStabilitySeller e bloqueada no genesis final, lastreada por sua carteira ATH de vendedor oficial, e o verificador de release confere esse lastro antes do release de produção. A reserva é capitalizada desde o início, mas não é vendida até depois do lançamento do pool, quando o congelamento de preços único e vinculado a evidências define o preço-base da tranche.

## Vesting de Protocolo de Longo Prazo

A reserva de vesting de longo prazo é:

```text
10,000,000 ATH
```

Ela é mantida pelo `ATHVesting`, não por um balde de tesouraria mutável. O cronograma de vesting é fixo no contrato:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Qualquer pessoa pode acionar um resgate assim que o ATH estiver vestido, mas o beneficiário é imutável. O contrato não tem função de aceleração, mudança de beneficiário, pausa, varredura administrativa, dreno de resgate ou liberação discricionária.

No genesis final, a carteira oficial `ATHWallet(owner = ATHVesting, master = ATHMaster)` deve conter exatamente `10,000,000 ATH`. O verificador também exige zero ATH resgatado, fase inativa e nenhuma transferência pendente antes do lançamento.

Esta reserva é intencionalmente lenta. Ela cria um horizonte longo para o desenvolvimento do protocolo sem colocar um balde líquido de 10M ATH acima do mercado no lançamento.

## Airdrop de Atividade

O airdrop de atividade é:

```text
15,000,000 ATH
```

Recompensa por publicação bem-sucedida:

```text
10 ATH
```

A recompensa é creditada no saldo interno de ATH do usuário no Vault após uma publicação bem-sucedida. Uma publicação bem-sucedida significa que o Vault enviou a carga útil ao CapsuleHub, o CapsuleHub aceitou a entrada e o Vault recebeu a confirmação.

Tentativas de publicação com falha não criam recompensas de atividade.

Contabilidade da recompensa:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Se o balde restante do airdrop estiver abaixo de 10 ATH, a quantia restante é creditada. Uma vez esgotado o balde, novas recompensas de atividade cessam.

O airdrop de atividade é contabilizado no Vault e lastreado pela carteira ATH oficial do Vault, pré-financiada.

Os depósitos de ATH no Vault são suportados apenas através do fluxo de transferência-com-notificação da ATHWallet do usuário
(`ATHTransferRequestWithNotify`) para o Vault. Uma transferência ordinária manual de ATH para a ATHWallet oficial do Vault é
não suportada: ela pode aumentar o saldo bruto da carteira oficial, mas não cria `Vault.user.ath_balance` e não deve
ser exibida pelo PWA como um caminho de depósito.

Os saques de ATH do Vault são comandos externos assinados do Vault. A reserva de execução da implantação, transferência, armazenamento e
ACK da ATHWallet a jusante é paga a partir do saldo interno de GRAM do usuário no Vault. O Vault credita de volta apenas o valor autenticado de
ACK/falha/bounce que recebe, menos a reserva local de reembolso e limitado pelo valor interno reservado.

## Preço da Atividade

As mensagens partem do preço-base público atual:

```text
from 0.0337 GRAM
```

Os exemplos canônicos exatos atuais, antes do desconto de ATH, são:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Por uma publicação bem-sucedida, o usuário recebe:

```text
10 ATH
```

Ao preço de referência de lançamento:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Isso vincula a distribuição inicial de ATH ao uso real da aplicação. A recompensa é um bônus de atividade, não um reembolso, cashback,
desconto ou promessa de que o ATH compensará o custo em GRAM de uma publicação. O valor de referência de lançamento de `10 ATH` pode ser
menor que o custo em GRAM da cápsula, e isso é intencional: os usuários recebem propriedade inicial da rede por uso real,
não um reembolso garantido.

Precificação de cápsulas: postagens públicas de 1 KiB partem de `0.0337 GRAM` e cápsulas privadas híbridas de 1 KiB de `0.0347 GRAM`. Blocos de cápsula públicos ou privados maiores custam mais porque o corpo selecionado de 1, 2, 4, 8, 16 ou 32 KiB
altera a reserva de execução e armazenamento do Vault/CapsuleHub. A recompensa permanece `10 ATH` por cápsula finalizada com sucesso,
independentemente do tamanho da cápsula.

A publicação privada usa o perfil de segurança híbrido por padrão: X25519 + ML-KEM-768 + AES-GCM. Não há um modo de mensagem privada clássica mais barato.

O ATH pode ser negociado acima ou abaixo do preço de referência de lançamento após a existência do pool oficial. A recompensa de atividade não é um retorno de investimento, uma expectativa de lucro ou uma garantia de preço.

## Taxa do Protocolo e Preço para o Usuário

Dentro do Vault, a taxa do protocolo é separada do custo total voltado ao usuário.

Taxa do protocolo:

| Tipo de publicação | Taxa do protocolo |
| --- | ---: |
| Postagem pública | 0.010 GRAM |
| Mensagem privada híbrida | 0.010 GRAM |

O preço voltado ao usuário inclui a taxa do protocolo, o endowment compacto de armazenamento de índice/cabeçalho, a reserva de execução local do Vault e o reembolso de ACK esperado:

| Tipo de publicação | Preço voltado ao usuário |
| --- | ---: |
| Público (a partir de) | from 0.0337 GRAM |
| Exemplo exato atual de postagem pública | 0.0337 GRAM |
| Exemplo exato atual de cápsula privada híbrida de 1 KiB | 0.0347 GRAM |

Se o PWA receber uma estimativa de rede conservadora mais alta, ele adiciona o excedente estimado ao teto de cobrança canônico, arredondado para cima em incrementos limpos de `0.001 GRAM`. Os descontos de ATH se aplicam à taxa do protocolo, não aos custos de rede ou às reservas de armazenamento. Esta sobretaxa é uma margem de segurança assinada: se o CapsuleHub aceitar a publicação, o ACK de sucesso retorna apenas a reserva fixa de ACK de publicação de `30,000,000` nanotons (`0.030 GRAM`). Depois que o Vault processa esse ACK, o usuário recebe um crédito de aproximadamente `25,800,000` nanotons no saldo interno de GRAM do Vault. A parte acima do valor canônico exigido permanece no CapsuleHub como excedente de reserva de rede/armazenamento. Ela não é devolvida ao Vault e não é contabilizada como `accrued_plato_fee_ton` no momento da publicação. Somente o excedente bruto acima da reserva protegida do CapsuleHub pode, mais tarde, ser varrido sem permissão para o FeeAccumulator, onde segue a contabilidade normal de tesouraria/buyback. O CapsuleHub armazena metadados de entrada compactos e autenticados e o hash do corpo; o corpo pesado é recuperado a partir do histórico de transações de publicação aceitas e verificado localmente.

## Descontos de ATH

O ATH reduz as taxas de protocolo das mensagens depois que o airdrop de atividade tiver sido totalmente distribuído.

Os descontos são desbloqueados apenas quando o airdrop de atividade restante for:

```text
airdrop_remaining_ath == 0 ATH
```

Antes desse ponto, a taxa do protocolo é paga integralmente.

Limite de desconto total:

```text
10,000 ATH
```

Se o saldo interno de ATH do usuário no Vault for de pelo menos `10,000 ATH`, o usuário atinge o nível de desconto total da taxa do protocolo para o componente de taxa do Platho. Os custos de rede e as reservas de armazenamento ainda são pagos.

Se o saldo estiver abaixo de `10,000 ATH`, a taxa diminui linearmente:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

O cálculo arredonda para cima. Com as constantes atuais, a taxa total do protocolo é de `0.010 GRAM` (`10,000,000 nanotons`) tanto para cápsulas públicas quanto privadas, e a redução máxima é de `0.010 GRAM` por cápsula.

## Lançamento do Pool

O pool ATH/GRAM é lançado depois que todo o airdrop de atividade de `15,000,000 ATH` tiver sido distribuído.

A sequência de lançamento é:

1. Os usuários recebem ATH através do uso real do Platho.
2. Todo o airdrop de atividade é distribuído.
3. Os descontos de ATH são desbloqueados.
4. O pool ATH/GRAM é lançado.
5. As evidências de rota e de precificação posteriores ao pool são congeladas.
6. A divisão de buyback é habilitada.

O pool parte do preço de referência:

```text
1 ATH = 0.001 GRAM
```

Alocação de liquidez inicial:

```text
15,000,000 ATH
```

Lado GRAM ao preço de lançamento:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

As taxas do protocolo coletadas antes do lançamento do pool financiam todo o lado GRAM da liquidez inicial. Isso faz parte do
bootstrap de lançamento e não transforma as recompensas de atividade em um direito denominado em GRAM.

O pool é lançado em torno de um token que já foi distribuído através do uso da aplicação. Isso separa o ATH de uma listagem vazia sem base de usuários.

## FeeAccumulator

As taxas de protocolo em GRAM são coletadas no `FeeAccumulator`.

Antes de a divisão de buyback ser habilitada, todo o GRAM acumulado vai para o balde da tesouraria:

```text
accumulated_ton -> treasury_due_ton
```

O `buyback_due_ton` não cresce antes de a divisão ser habilitada.

Após `EnableBuybackSplit`, o GRAM acumulado é dividido:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Se a quantia for ímpar em nanotons, o resto permanece do lado do buyback:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

O `EnableBuybackSplit` é uma ação unidirecional executada pelo receptor imutável da tesouraria após o lançamento do pool e o
congelamento da rota de buyback. Esta é uma autoridade real e única: ela não pode roubar fundos, pausar, resgatar ou alterar endereços, mas
altera permanentemente a economia do FeeAccumulator, da acumulação de bootstrap somente-tesouraria para a divisão 50/50 tesouraria/buyback. Ela é
habilitada somente após a aprovação do preflight de release.

As autoridades de release do Platho são deliberadamente estreitas e, em sua maioria, de disparo único. Elas ainda existem e devem ser nomeadas honestamente:
o proprietário da tesouraria implanta o fornecimento inicial de ATH uma vez; o controlador de genesis realiza a vinculação e o selamento pré-selo;
o controlador de lançamento do BuybackBurn congela a rota posterior ao pool uma vez; o congelamento de preços do MarketStabilitySeller é realizado
uma vez por seu controlador de lançamento; e o receptor da tesouraria do FeeAccumulator habilita a divisão de buyback unidirecional após o preflight. Nenhum desses
papéis é um mecanismo de resgate, pausa, upgrade, dreno administrativo ou controle arbitrário de saldos.

## Buyback e Burn

O buyback é executado através do `FeeAccumulator` e do `BuybackBurn`.

O BuybackBurn aceita apenas um envelope de execução completo:

```text
51.05 GRAM
```

Estrutura do envelope:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

Os `50 GRAM` brutos não são um bloco de buyback válido. O buyback é aceito apenas como um envelope de rota completo.

Após o congelamento da rota, o BuybackBurn executa um buyback da seguinte forma:

1. Aceita `51.05 GRAM` somente do FeeAccumulator vinculado.
2. Registra a quantia em `reserve_due_ton`.
3. Em `ExecuteBuybackChunk`, consome um envelope.
4. Usa a cotação congelada e o minOut congelado.
5. Define o deadline da STON.fi internamente.
6. Envia a rota através da carteira pTON congelada.
7. Aceita ATH somente através da carteira ATH oficial do BuybackBurn.
8. Verifica se a carteira de origem corresponde ao pool STON.fi congelado.
9. Envia o ATH recebido para burn através da carteira ATH oficial.
10. Completa o ciclo somente após `ATHBurnFinalized` do `ATHMaster`.

O sucesso do buyback não é definido por uma mensagem do roteador, uma solicitação de burn de saída ou uma notificação de burn da ATHWallet. Ele é definido
somente quando o BuybackBurn recebe `ATHBurnFinalized` autenticado do ATHMaster. Até que essa finalização chegue,
o BuybackBurn ainda deve ser tratado como estado de burn pendente ou de retentativa; dashboards e indexadores não devem contar o ATH como
queimado meramente porque uma tentativa de burn foi enviada.

Se o burn não for finalizado, o ATH recebido é movido para o devido de retentativa. `RetryAthBurnDue` queima a quantia total do devido de retentativa.

## Taxas de Nome de Usuário

O registro de nome de usuário `.ath` é pago em ATH através da carteira ATH oficial do UsernameRegistry.

Preços:

| Comprimento do nome | Preço |
| ---: | ---: |
| 4 caracteres | 10,000 ATH |
| 5 caracteres | 1,000 ATH |
| 6+ caracteres | 100 ATH |

O UsernameRegistry aceita apenas o preço exato. Pagamento a menor e a maior não criam um nome.

Uma cunhagem aceita passa pelo estado pendente e implanta `UsernameNFTItem`. Antes da confirmação do item, o pagamento não é reconhecido como receita. Após a confirmação do item, a quantia é dividida:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

A cunhagem de nome de usuário é financiada pelo Vault. Rejeições de nome de usuário inválido, preço incorreto ou nome duplicado retornam através do
caminho de notificação da carteira ATH oficial, para que o Vault possa restaurar o ATH interno do usuário. O UsernameRegistry não mantém um
balde direto de reembolso externo de nome de usuário no fluxo atual financiado pelo Vault.

O ATH da cunhagem de nome de usuário se torna receita do protocolo somente após a confirmação da implantação do item correspondente.

A autoridade sobre o nome de usuário é dividida deliberadamente: o `UsernameRegistry` ancora o nome a um `UsernameNFTItem` exato, e o
estado do item carrega o proprietário atual. Transferências do item transferem o nome de usuário. O item expõe dados NFT padrão
e metadados on-chain TEP-64, incluindo `name = <username>.ath`; ele não depende de um servidor Platho para metadados.
Os bytes do nome de usuário são literais e não normalizados para exibição: nomes iniciais, finais, consecutivos e compostos inteiramente por separadores são
válidos quando cada byte está no conjunto permitido `a-z`, `0-9`, `_`, `-` e o comprimento é 4..16.
Se a implantação do item foi tentada, mas o ACK do item nunca chegou ao registro, `PrunePendingUsernameMint` é intencionalmente
não destrutivo: ele não adivinha falhas, não apaga o estado pendente nem cria devido de reembolso. O caminho de recuperação é um `UsernameItemDeployedAck`
tardio ou `UsernameNFTItem.ResendDeployedAck`, de modo que um item inicializado ainda pode se tornar autoritativo.
Se a implantação do item realmente sofrer bounce, o registro solicita à carteira ATH oficial o reembolso da notificação pendente.
Um `UsernameNFTItem` implantado sem `UsernameRegistry.name_records[name_hash]` apontando para aquele item exato é
não autoritativo: clientes, indexadores e UI não devem tratar o item isolado como propriedade do nome `.ath`, e não devem
usar o proprietário do registro como o proprietário atual após transferências.

## Taxas de Avatar de Perfil

Custo de atualização do avatar de perfil:

```text
100 ATH
```

As atualizações do avatar de perfil são financiadas pelo Vault. O PWA envia `SetProfileAvatarFromVaultBalance` ao Vault; o Vault paga através de seu caminho de notificação da carteira ATH oficial para a carteira ATH oficial do ProfileRegistry. O pagamento direto de avatar a partir da carteira do usuário não é suportado.

O ProfileRegistry aceita a atualização somente quando todas as condições são atendidas:

- a quantia é exatamente `100 ATH`;
- o remetente é a carteira ATH oficial do ProfileRegistry;
- a carteira pagadora é o Vault vinculado;
- a carteira do proprietário está na basechain;
- o hash do avatar não é zero;
- o id do stream não é zero;
- a contagem de partes é de 1 a 16;
- o formato de mídia é WebP.

Uma atualização aceita cria uma nova versão de avatar e divide a taxa:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Uma notificação de avatar rejeitada é reembolsada através do caminho de bounce de notificação da ATHWallet. O ProfileRegistry não cria um balde de reembolso separado para atualizações de avatar malformadas.

O ProfileRegistry armazena o ponteiro de avatar autenticado, não os bytes permanentes da imagem. O PWA deve reconstruir os dados WebP do avatar a partir de entradas públicas do CapsuleHub ou do cache local e verificar os bytes contra o `avatar_hash` armazenado; histórico ausente ou podado é exibido como indisponível.

## Market Stability Seller

O MarketStabilitySeller é uma reserva de contrato pública que distribui ATH após o lançamento do pool oficial:

```text
60,000,000 ATH
```

Seu propósito é reduzir a distorção de mercado inicial causada por liquidez rasa. No lançamento, um pool pequeno pode ser movido bruscamente por um pequeno grupo de compradores iniciais. Se isso acontecer, usuários que precisam de ATH para ações reais do Platho podem ser forçados a comprar em meio a um pico de preço artificial.

O MarketStabilitySeller cria uma escada de fornecimento transparente acima do preço de lançamento. Ele vende ATH em tranches de tamanho fixo. Cada tranche seguinte é mais cara que a anterior, e cada tranche tem um limite rígido de tamanho. Após o congelamento de preços único e vinculado a evidências, o cronograma de tranches é determinístico e não pode ser alterado manualmente pela equipe.

Se especuladores iniciais tentarem absorver uma grande quantidade de ATH, eles compram da reserva pública a preços de tranche crescentes, em vez de extrair toda a liquidez barata de um pool raso e revendê-la aos usuários. Se usuários comuns precisarem de ATH para o Platho, eles podem comprá-lo a um preço de tranche público conhecido sem empurrar um pool pequeno verticalmente com uma única onda de demanda.

A reserva não despeja tokens no mercado. Ela não vende por conta própria e não cria pressão de venda sem demanda. Uma venda acontece somente quando um comprador adquire voluntariamente da tranche atual. Se não houver demanda, a reserva permanece inativa.

A utilidade on-chain do ATH é específica:

- o registro de nome de usuário `.ath` é pago em ATH através do UsernameRegistry;
- as atualizações do ponteiro de avatar de perfil são pagas em ATH através do ProfileRegistry;
- o ATH mantido no saldo interno do Vault do usuário reduz a taxa do protocolo para publicações do Vault após o gate de distribuição de atividade;
- as taxas aceitas de nome de usuário e avatar criam devido de tesouraria e devido de burn;
- o BuybackBurn compra ATH com as taxas de protocolo em GRAM e queima o ATH recebido através do ATHMaster.

As publicações do Vault são pagas em GRAM. O ATH não paga a transação de publicação inteira. Ele reduz o componente da taxa do protocolo depois que o gate de desconto é aberto.

Isso vincula a demanda por ATH a ações concretas do protocolo: nomes `.ath`, atualizações de avatar, descontos na taxa do protocolo do Vault após o airdrop e pressão de buyback/burn. O MarketStabilitySeller expande o fornecimento disponível somente à medida que os compradores adquirem a próxima tranche, de modo que o acesso inicial é público e determinístico, em vez de ser dominado por um pool raso.

A reserva é vendida somente após o congelamento de preços posterior ao pool.

O congelamento de preços é uma autoridade de lançamento real e única. Ele define o preço-base da tranche uma vez, a partir das evidências do lançamento do pool, e então o hash do controlador de lançamento é limpo. Depois disso, o MarketStabilitySeller não pode roubar fundos, pausar vendas, resgatar saldos, sobrepor compradores ou mutar o cronograma de preços.

O MarketStabilitySeller é capitalizado no genesis final com a reserva total de `60,000,000 ATH`, financiada através do
fluxo autenticado de financiador de reserva para a carteira ATH de vendedor oficial, até o teto rígido de `60,000,000 ATH`.
O `mainnet:genesis:verify` confere se o vendedor carrega a reserva total e se o lastro de sua carteira ATH de vendedor oficial
é de pelo menos `60,000,000 ATH` antes do release de produção. Uma transferência ordinária não solicitada de ATH para a carteira ATH de vendedor
oficial não aumenta a reserva contabilizada, não expande o fornecimento vendável e pode ficar presa; um saldo de carteira
acima de `60,000,000 ATH` é tratado como um aviso, não como reserva adicional.

A venda é uma etapa separada posterior ao pool. A reserva não é vendida até depois do lançamento do pool, quando o congelamento de preços
único e vinculado a evidências define o preço-base da tranche; a partir daí o cronograma de tranches é determinístico e não pode ser alterado
manualmente pela equipe.

A reserva é dividida em 20 tranches:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Cada tranche tem um multiplicador:

```text
x2, x3, x4, ..., x21
```

Isso cria uma escada de preços suave. À medida que a popularidade do projeto cresce, o mercado recebe fornecimento adicional de ATH, mas cada tranche seguinte é mais cara que a anterior. A demanda inicial não atinge um pool raso imediatamente, e o crescimento de preço não se torna uma parede vertical que torna o token utilitário inconveniente de usar.

Fórmula de compra:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

O `base_tranche_price` é congelado após o lançamento do pool e corresponde exatamente à evidência de precificação x1.

Ao preço de lançamento `1 ATH = 0.001 GRAM`, o preço x1 de uma tranche é:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Portanto:

| Tranche | Multiplicador | Preço por 3M ATH | Preço por 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Uma única compra não pode cruzar o limite de uma tranche. Isso impede a compra de ATH da próxima tranche ao preço da tranche anterior.

A receita em GRAM é reconhecida somente após o ATH ser entregue ao comprador. Se a transferência de ATH falhar ou sofrer bounce, a reserva é restaurada, o comprador recebe de volta o principal em GRAM pago, e o devido de tesouraria não aumenta.

Depois que a tranche final x21 é vendida, o MarketStabilitySeller não regula mais o preço do ATH. A partir desse ponto, o preço é totalmente determinado pelo mercado: liquidez, fornecimento disponível, demanda por nomes `.ath`, atualizações de avatar, descontos na taxa do protocolo do Vault após o airdrop e pressão de buyback/burn.

Mesmo na etapa x21, a avaliação de referência permanece moderada em relação ao modelo de utilidade:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

Na etapa x21, o MarketStabilitySeller concluiu sua liberação programada de reserva. Depois disso, o preço do ATH é totalmente determinado pelo mercado, por liquidez, demanda de uso, fornecimento disponível e pressão de buyback/burn. A única alocação de protocolo restante é o cronograma lento de vesting de longo prazo, limitado a `100,000 ATH` por ano.

## Baldes de Tesouraria e Burn

O UsernameRegistry e o ProfileRegistry usam o mesmo modelo de divisão de taxa em ATH:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

O flush do devido de tesouraria envia ATH ao receptor da tesouraria através da carteira ATH oficial.

O flush do devido de burn envia uma solicitação de burn de ATH através da carteira ATH oficial. O fornecimento diminui somente após a finalização do burn no ATHMaster.

Os caminhos de falha e bounce restauram os baldes de devido. A contabilidade é preservada até que a transferência ou o burn a jusante seja concluído.

## Contabilidade da ATHWallet

Os saldos de ATH residem em contratos ATHWallet determinísticos.

A ATHWallet trata:

- crédito de fornecimento genesis;
- transferência ordinária;
- transferência com notificação;
- notificação de cunhagem de nome de usuário;
- notificação de avatar de perfil;
- solicitação de burn;
- confirmação de notificação;
- poda de notificação obsoleta;
- recuperação de bounce/falha.

Contratos que aceitam ATH como pagamento não aceitam mensagens diretas de endereços arbitrários. Eles aceitam notificações apenas de sua ATHWallet oficial. A autenticação da carteira de origem é realizada dentro da ATHWallet através de derivação determinística de carteira.

O ATH expõe entrypoints de transferência semelhantes ao TEP-74 para ferramentas de jetton genéricas, mas as ações de protocolo do Platho usam mensagens de notificação de ATH autenticadas. Integrações externas não devem presumir que os fluxos de notificação do Platho emitem uma `JettonTransferNotification` genérica.

As transferências internas de saída na ATHWallet são protegidas por contabilidade pendente do lado da origem e confirmação da origem. O saldo não é restaurado a partir de um corpo de bounce sem prova de pendência.

## Ciclo de Vida do ATH

1. O `ATHMaster` cria o fornecimento fixo de `100,000,000 ATH`.
2. O disparo único de implantação da tesouraria recebe o fornecimento na carteira ATH da tesouraria.
3. O fornecimento é alocado entre atividade, liquidez, vesting de longo prazo e estabilidade de mercado.
4. Os usuários publicam mensagens através do Vault.
5. Uma publicação bem-sucedida credita `10 ATH` de recompensa de atividade.
6. Depois que todo o airdrop de atividade de `15,000,000 ATH` é distribuído e `airdrop_remaining_ath == 0`, os descontos na taxa do protocolo em ATH são desbloqueados.
7. O pool ATH/GRAM é lançado ao preço de referência `1 ATH = 0.001 GRAM`.
8. As evidências de rota e de precificação posteriores ao pool são congeladas.
9. O MarketStabilitySeller vende a reserva através das tranches x2..x21.
10. Depois que a divisão é habilitada, o FeeAccumulator divide as taxas de protocolo em GRAM entre tesouraria e buyback.
11. O BuybackBurn compra ATH com as taxas de protocolo em GRAM e queima ATH através do ATHMaster.
12. As taxas de nome de usuário e perfil criam devido de tesouraria em ATH e devido de burn em ATH.
13. O fornecimento total diminui gradualmente através de burns autenticados.

## Modelo Final

O ATH conecta quatro camadas do Platho:

1. **Uso da aplicação** - as mensagens criam recompensas de atividade.
2. **Recursos pagos** - nomes de usuário e avatares exigem ATH.
3. **Descontos** - o saldo de ATH reduz a taxa do protocolo após o gate de distribuição.
4. **Redução de fornecimento** - parte das taxas em ATH e da saída do buyback é queimada através do ATHMaster.

O modelo começa com fornecimento fixo e avaliação de referência de `100,000 GRAM`. A distribuição primária aos usuários está vinculada ao uso pago real: as mensagens partem de `0.0337 GRAM` — atualmente `0.0337 GRAM` para uma postagem pública de 1 KiB e `0.0347 GRAM` para uma cápsula privada híbrida de 1 KiB, mais um bônus de atividade de `10 ATH` por cápsula finalizada. Classes de tamanho públicas ou privadas maiores custam mais. Esse bônus não é um reembolso, ressarcimento ou promessa de lucro. Depois que os primeiros 15% do fornecimento são distribuídos, o pool é lançado, os descontos na taxa do protocolo são desbloqueados e o caminho de buyback é aberto.

O ATH existe como um token funcional dentro do Platho: ele é distribuído através da atividade, usado em ações pagas, reduz a taxa do protocolo, é vendido da reserva através de uma escada definida e é queimado através de burn on-chain. Após a escada de estabilidade de mercado, o preço futuro do ATH é determinado pelo mercado e pelo uso do protocolo.
