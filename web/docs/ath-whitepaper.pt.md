# Whitepaper do ATH

## O Token do Protocolo Platho

ATH é o token utilitário do Platho. Ele é usado para recompensas de atividade, descontos na taxa do protocolo após o airdrop, nomes de usuário `.ath`, atualizações de avatar de perfil, vendas de estabilidade de mercado, buyback e queima (burn).

ATH não é um token administrativo. Ele não concede a capacidade de reescrever saldos, pausar operações, cunhar nova oferta ou alterar as regras de propriedade dos usuários. Seu papel é impulsionar a economia da aplicação e conectar o uso do Platho com a contabilidade on-chain.

Este documento descreve o modelo do ATH no Platho v1.

## Parâmetros Fundamentais

ATH tem uma oferta total fixa:

```text
100,000,000 ATH
```

ATH usa 9 casas decimais:

```text
1 ATH = 1,000,000,000 atomic units
```

Oferta total em unidades atômicas:

```text
100,000,000,000,000,000
```

O preço de referência de lançamento é:

```text
1 ATH = 0.001 GRAM
```

A avaliação totalmente diluída de lançamento é:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH parte de uma capitalização de referência de `100,000 GRAM`.

## Oferta Fixa

ATH é emitido pelo `ATHMaster`. Na inicialização, o `ATHMaster` define a oferta total fixa em `100,000,000 ATH`.

Não há função de cunhagem após o genesis. O `ATHMaster` não implementa cunhagem administrativa, pausa, blacklist, imposto de transferência, transferência forçada ou dreno de resgate.

A implantação da oferta inicial é realizada uma única vez através de `DeployTreasurySupply`. Ela envia a oferta completa para a carteira ATH do tesouro. A implantação da oferta de genesis não pode ser repetida.

A oferta total diminui apenas através de queima. O `ATHMaster` aceita uma queima somente após uma notificação de queima autenticada vinda da carteira ATH determinística do endereço proprietário. Após a verificação, o `ATHMaster` reduz o `total_supply` e envia `ATHBurnFinalized`.

A queima de ATH é uma redução real da oferta total, não uma transferência para um endereço não utilizado.

## Alocação da Oferta

A oferta de ATH é alocada em quatro categorias:

| Categoria | Participação | Quantidade |
| --- | ---: | ---: |
| Airdrop de atividade | 15% | 15,000,000 ATH |
| Liquidez inicial | 15% | 15,000,000 ATH |
| Vesting de protocolo de longo prazo | 10% | 10,000,000 ATH |
| Reserva de estabilidade de mercado | 60% | 60,000,000 ATH |

Esta alocação define a estrutura econômica do Platho:

- 15% da oferta é distribuída aos usuários através da atividade da aplicação antes do lançamento do pool.
- 15% da oferta é usada para liquidez inicial.
- 10% da oferta é bloqueada em vesting imutável de longo prazo.
- 60% da oferta é reservada para o MarketStabilitySeller e vendida em tranches acima do preço de lançamento, após o congelamento de precificação pós-pool e o gate de prontidão de financiamento da reserva.

O airdrop de atividade e a reserva de vesting de longo prazo são lastreados no genesis final pelas carteiras ATH oficiais do Vault e do ATHVesting, e o verificador de release confere esses saldos antes do release de produção. A alocação de estabilidade de mercado de `60,000,000 ATH` é reservada para o MarketStabilitySeller, mas não é financiada no seller no genesis final. O financiamento do seller acontece apenas após o lançamento do pool, o congelamento de precificação único vinculado a evidências e o notify-flow vinculado do financiador da reserva; a prontidão do seller é válida apenas depois que `reserve_due_ath`, `reserve_funded_total_ath` e o lastro da carteira ATH oficial do seller forem verificados.

## Vesting de Protocolo de Longo Prazo

A reserva de vesting de longo prazo é:

```text
10,000,000 ATH
```

Ela é mantida pelo `ATHVesting`, não por um bucket de tesouro mutável. O cronograma de vesting é fixado no contrato:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Qualquer pessoa pode acionar um claim uma vez que o ATH esteja vestido, mas o beneficiário é imutável. O contrato não possui aceleração, mudança de beneficiário, pausa, sweep administrativo, dreno de resgate ou função de liberação discricionária.

No genesis final, a `ATHWallet(owner = ATHVesting, master = ATHMaster)` oficial deve conter exatamente `10,000,000 ATH`. O verificador também exige zero ATH resgatado, fase ociosa e nenhuma transferência pendente antes do lançamento.

Esta reserva é intencionalmente lenta. Ela cria um horizonte longo para o desenvolvimento do protocolo sem colocar um bucket líquido de 10M ATH acima do mercado no lançamento.

## Airdrop de Atividade

O airdrop de atividade é:

```text
15,000,000 ATH
```

Recompensa por publicação bem-sucedida:

```text
10 ATH
```

A recompensa é creditada no saldo ATH interno do usuário no Vault após uma publicação bem-sucedida. Uma publicação bem-sucedida significa que o Vault enviou o payload para o CapsuleHub, o CapsuleHub aceitou a entrada e o Vault recebeu a confirmação.

Tentativas de publicação com falha não geram recompensas de atividade.

Contabilidade da recompensa:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Se o bucket de airdrop restante estiver abaixo de 10 ATH, a quantidade restante é creditada. Uma vez que o bucket seja esgotado, novas recompensas de atividade cessam.

O airdrop de atividade é contabilizado no Vault e lastreado pela carteira ATH oficial do Vault pré-financiada.

Depósitos de ATH no Vault são suportados apenas através do fluxo transfer-with-notify da ATHWallet do usuário
(`ATHTransferRequestWithNotify`) para o Vault. Uma transferência ATH ordinária manual para a ATHWallet oficial do Vault é
não suportada: ela pode aumentar o saldo bruto da carteira oficial, mas não cria `Vault.user.ath_balance` e não deve
ser exibida pelo PWA como um caminho de depósito.

Saques de ATH do Vault são comandos externos assinados do Vault. A reserva de execução de implantação, transferência, armazenamento e
ACK da ATHWallet a jusante é paga a partir do saldo GRAM interno do usuário no Vault. O Vault credita de volta apenas o valor de
ACK/falha/bounce autenticado que recebe, menos a reserva local de reembolso e limitado pelo valor interno reservado. As mensagens do produto
não devem prometer um reembolso completo de GRAM excedente.

## Preço da Atividade

As mensagens públicas do produto podem dizer que as mensagens começam a partir do preço-base público exato atual:

```text
from 0.0337 GRAM
```

Os exemplos canônicos exatos atuais antes do desconto de ATH são:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Para uma publicação bem-sucedida, o usuário recebe:

```text
10 ATH
```

Ao preço de referência de lançamento:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Isso vincula a distribuição inicial de ATH ao uso real da aplicação. A recompensa é um bônus de atividade, não um reembolso, cashback,
desconto retroativo ou promessa de que o ATH compensará o custo em GRAM de uma publicação. O valor de referência de lançamento de `10 ATH` pode ser
menor que o custo em GRAM da cápsula, e isso é intencional: os usuários recebem participação inicial na rede por uso real,
não um reembolso garantido.

As mensagens do produto podem resumir a precificação de cápsulas como mensagens a partir de `0.0337 GRAM`; os exemplos canônicos exatos atuais são posts públicos de 1 KiB a partir de `0.0337 GRAM` e cápsulas privadas híbridas de 1 KiB a partir de `0.0347 GRAM`. Blocos de cápsula públicos ou privados maiores custam mais porque o corpo selecionado de 1, 2, 4, 8, 16 ou 32 KiB
altera a reserva de execução e armazenamento do Vault/CapsuleHub. A recompensa permanece `10 ATH` por cápsula finalizada
com sucesso, independentemente do tamanho da cápsula.

A publicação privada usa o perfil de segurança híbrido por padrão: X25519 + ML-KEM-768 + AES-GCM. Não há um modo de mensagem privada clássico mais barato na V1.

ATH pode ser negociado acima ou abaixo do preço de referência de lançamento depois que o pool oficial existir. Os documentos do protocolo não devem apresentar
a recompensa de atividade como retorno de investimento, expectativa de lucro ou garantia de preço.

## Taxa do Protocolo e Preço ao Usuário

Dentro do Vault, a taxa do protocolo é separada do custo total voltado ao usuário.

Taxa do protocolo:

| Tipo de publicação | Taxa do protocolo |
| --- | ---: |
| Post público | 0.010 GRAM |
| Mensagem privada híbrida | 0.010 GRAM |

O preço voltado ao usuário inclui a taxa do protocolo, o endowment de armazenamento de índice/cabeçalho compacto, a reserva de execução local do Vault e o reembolso de ACK esperado:

| Tipo de publicação | Preço voltado ao usuário |
| --- | ---: |
| Rótulo público/produto | from 0.0337 GRAM |
| Exemplo exato atual de post público | 0.0337 GRAM |
| Exemplo exato atual de privado híbrido de 1 KiB | 0.0347 GRAM |

Se o PWA receber uma estimativa de rede conservadora mais alta, ele adiciona o excedente estimado ao valor máximo canônico cobrado, arredondado para cima em passos limpos de `0.001 GRAM`. Os descontos de ATH se aplicam à taxa do protocolo, não aos custos de rede ou reservas de armazenamento. Essa sobretaxa é uma margem de segurança assinada: se o CapsuleHub aceitar a publicação, o ACK de sucesso retorna apenas a reserva fixa de ACK de publicação de `30,000,000` nanotons (`0.030 GRAM`). Depois que o Vault processa esse ACK, o usuário é creditado com aproximadamente `25,800,000` nanotons no saldo GRAM interno do Vault. A parte acima do valor canônico exigido permanece no CapsuleHub como excedente de reserva de rede/armazenamento. Ela não é retornada ao Vault e não é contabilizada como `accrued_plato_fee_ton` no momento da publicação. Apenas o excedente bruto acima da reserva protegida do CapsuleHub pode posteriormente ser varrido de forma permissionless para o FeeAccumulator, onde segue a contabilidade normal de tesouro/buyback. O CapsuleHub armazena metadados de entrada compactos e autenticados e o hash do corpo; o corpo pesado é recuperado do histórico de transações de publicação aceitas e verificado localmente.

## Descontos de ATH

ATH reduz as taxas do protocolo das mensagens depois que o airdrop de atividade tiver sido totalmente distribuído.

Os descontos são desbloqueados somente quando o airdrop de atividade restante é:

```text
airdrop_remaining_ath == 0 ATH
```

Antes desse ponto, a taxa do protocolo é paga integralmente.

Limiar de desconto total:

```text
10,000 ATH
```

Se o saldo ATH interno do usuário no Vault for de pelo menos `10,000 ATH`, o usuário atinge o nível de desconto total da taxa do protocolo para o componente de taxa do Platho. Os custos de rede e as reservas de armazenamento ainda são pagos.

Se o saldo estiver abaixo de `10,000 ATH`, a taxa diminui linearmente:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

O cálculo arredonda para cima. Com as constantes atuais, a taxa completa do protocolo é `0.010 GRAM` (`10,000,000 nanotons`) tanto para cápsulas públicas quanto privadas, e a redução máxima é `0.010 GRAM` por cápsula.

## Lançamento do Pool

O pool ATH/GRAM é lançado depois que o airdrop de atividade completo de `15,000,000 ATH` tiver sido distribuído.

A sequência de lançamento é:

1. Os usuários recebem ATH através do uso real do Platho.
2. O airdrop de atividade completo é distribuído.
3. Os descontos de ATH são desbloqueados.
4. O pool ATH/GRAM é lançado.
5. As evidências de rota pós-pool e as evidências de precificação são congeladas.
6. O split de buyback é habilitado.

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

Não se espera que as taxas do protocolo coletadas antes do lançamento do pool financiem totalmente o lado GRAM da liquidez inicial. O
plano de liquidez inicial pode exigir financiamento do projeto/tesouro além da receita do protocolo. Isso faz parte do bootstrap
de lançamento e não transforma as recompensas de atividade em um direito denominado em GRAM.

O pool é lançado em torno de um token que já foi distribuído através do uso da aplicação. Isso separa o ATH de uma listagem vazia sem base de usuários.

## FeeAccumulator

As taxas do protocolo em GRAM são coletadas no `FeeAccumulator`.

Antes que o split de buyback seja habilitado, todo o GRAM acumulado vai para o bucket do tesouro:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` não cresce antes que o split seja habilitado.

Após `EnableBuybackSplit`, o GRAM acumulado é dividido:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Se a quantidade for ímpar em nanotons, o resto permanece no lado do buyback:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` é uma ação unidirecional executada pelo receptor de tesouro imutável após o lançamento do pool e o
congelamento da rota de buyback. Esta é uma autoridade real e única: ela não pode roubar fundos, pausar, resgatar ou alterar endereços, mas altera permanentemente
a economia do FeeAccumulator, passando da acumulação bootstrap somente-tesouro para o split 50/50 tesouro/buyback. Ela é
habilitada somente após a passagem do preflight de release.

As autoridades de release do Platho são deliberadamente estreitas e em sua maioria de uso único. Elas ainda existem e devem ser nomeadas honestamente:
o proprietário do tesouro implanta a oferta inicial de ATH uma vez; o controlador de genesis realiza a vinculação pré-selagem e a selagem;
o controlador de lançamento do BuybackBurn congela a rota pós-pool uma vez; o congelamento de precificação do MarketStabilitySeller é realizado
uma vez pelo seu controlador de lançamento; e o receptor de tesouro do FeeAccumulator habilita o split unidirecional de buyback após o preflight. Nenhum desses
papéis é um mecanismo de resgate, pausa, upgrade, dreno administrativo ou controle arbitrário de saldo.

## Buyback e Queima

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

`50 GRAM` bruto não é um chunk de buyback válido. O buyback é aceito apenas como um envelope de rota completo.

Após o congelamento da rota, o BuybackBurn executa um buyback da seguinte forma:

1. Aceita `51.05 GRAM` somente do FeeAccumulator vinculado.
2. Registra a quantidade em `reserve_due_ton`.
3. Em `ExecuteBuybackChunk`, consome um envelope.
4. Usa a cotação congelada e o minOut congelado.
5. Define o deadline da STON.fi internamente.
6. Envia a rota através da carteira pTON congelada.
7. Aceita ATH somente através da carteira ATH oficial do BuybackBurn.
8. Verifica que a carteira de origem corresponde ao pool STON.fi congelado.
9. Envia o ATH recebido para queima através da carteira ATH oficial.
10. Completa o ciclo somente após `ATHBurnFinalized` do `ATHMaster`.

O sucesso do buyback não é definido por uma mensagem do router, uma solicitação de queima de saída ou uma notificação de queima da ATHWallet. Ele é definido
somente quando o BuybackBurn recebe `ATHBurnFinalized` autenticado do ATHMaster. Até que essa finalização chegue,
o BuybackBurn deve ainda ser tratado como estado de queima pendente ou de retry; dashboards e indexadores não devem contar o ATH como
queimado apenas porque uma tentativa de queima foi enviada.

Se a queima não for finalizada, o ATH recebido passa para o retry due. `RetryAthBurnDue` queima a quantidade completa de retry due.

## Taxas de Nome de Usuário

O registro de nome de usuário `.ath` é pago em ATH através da carteira ATH oficial do UsernameRegistry.

Preços:

| Comprimento do nome | Preço |
| ---: | ---: |
| 4 caracteres | 10,000 ATH |
| 5 caracteres | 1,000 ATH |
| 6+ caracteres | 100 ATH |

O UsernameRegistry aceita apenas o preço exato. Pagar a menos ou a mais não cria um nome.

Uma cunhagem aceita passa por estado pendente e implanta um `UsernameNFTItem`. Antes da confirmação do item, o pagamento não é reconhecido como receita. Após a confirmação do item, a quantia é dividida:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

A cunhagem de nome de usuário atual na V1 é financiada pelo Vault. Rejeições por nome de usuário inválido, preço errado ou nome duplicado retornam através do
caminho de notificação da carteira ATH oficial para que o Vault possa restaurar o ATH interno do usuário. O UsernameRegistry não mantém um
bucket direto de reembolso externo de nome de usuário no fluxo atual financiado pelo Vault.

O ATH da cunhagem de nome de usuário torna-se receita do protocolo somente após a implantação do item correspondente ser confirmada.

A autoridade de nome de usuário é dividida deliberadamente: o `UsernameRegistry` ancora o nome a um `UsernameNFTItem` exato, e o
estado do item carrega o proprietário atual. Transferências do item transferem o nome de usuário. O item expõe dados NFT padrão
e metadados on-chain TEP-64, incluindo `name = <username>.ath`; ele não depende de um servidor Platho para metadados.
Os bytes de nome de usuário da V1 são literais e não normalizados para exibição: nomes iniciados, terminados, consecutivos ou compostos apenas por separadores são
válidos quando cada byte está no conjunto permitido `a-z`, `0-9`, `_`, `-` e o comprimento é de 4..16.
Se a implantação do item foi tentada mas o ACK do item nunca chegou ao registry, `PrunePendingUsernameMint` é intencionalmente
não destrutivo na V1: ele não adivinha falha, não deleta estado pendente e não cria refund due. O caminho de recuperação é um
`UsernameItemDeployedAck` tardio ou `UsernameNFTItem.ResendDeployedAck`, de modo que um item inicializado ainda pode se tornar autoritativo.
Se a implantação do item realmente sofrer bounce, o registry solicita à carteira ATH oficial o reembolso da notificação pendente.
Um `UsernameNFTItem` implantado sem `UsernameRegistry.name_records[name_hash]` apontando para esse item exato é
não autoritativo: clientes, indexadores e UI não devem tratar o item isoladamente como propriedade do nome `.ath`, e não devem
usar o proprietário do registro do registry como o proprietário atual após transferências.

## Taxas de Avatar de Perfil

Custos de atualização de avatar de perfil:

```text
100 ATH
```

As atualizações de avatar de perfil atuais na V1 são financiadas pelo Vault. O PWA envia `SetProfileAvatarFromVaultBalance` para o Vault; o Vault paga através do caminho de notificação da sua carteira ATH oficial para a carteira ATH oficial do ProfileRegistry. O pagamento direto de avatar pela carteira do usuário não é um fluxo de produto suportado na V1.

O ProfileRegistry aceita a atualização somente quando todas as condições são atendidas:

- a quantia é exatamente `100 ATH`;
- o remetente é a carteira ATH oficial do ProfileRegistry;
- a carteira pagadora é o Vault vinculado;
- a carteira proprietária está na basechain;
- o hash do avatar não é zero;
- o stream id não é zero;
- a contagem de partes é de 1 a 16;
- o formato de mídia é WebP.

Uma atualização aceita cria uma nova versão de avatar e divide a taxa:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Uma notificação de avatar rejeitada é reembolsada através do caminho de bounce da notificação da ATHWallet. O ProfileRegistry não cria um bucket de reembolso separado para atualizações de avatar malformadas.

O ProfileRegistry armazena o ponteiro de avatar autenticado, não os bytes permanentes da imagem. O PWA deve reconstruir os dados WebP do avatar a partir de entradas públicas do CapsuleHub ou do cache local e verificar os bytes contra o `avatar_hash` armazenado; histórico ausente ou podado é exibido como indisponível.

## Market Stability Seller

O MarketStabilitySeller é uma reserva de contrato público que distribui ATH após o lançamento do pool oficial:

```text
60,000,000 ATH
```

Seu propósito é reduzir a distorção de mercado inicial causada pela liquidez rasa. No lançamento, um pool pequeno pode ser movido bruscamente por um pequeno grupo de compradores iniciais. Se isso acontecer, usuários que precisam de ATH para ações reais do Platho podem ser forçados a comprar em um pico de preço artificial.

O MarketStabilitySeller cria uma escada de oferta transparente acima do preço de lançamento. Ele vende ATH em tranches de tamanho fixo. Cada tranche seguinte é mais cara que a anterior, e cada tranche tem um limite de tamanho rígido. Após o congelamento de precificação único vinculado a evidências, o cronograma de tranches é determinístico e não pode ser alterado manualmente pela equipe.

Se especuladores iniciais tentarem absorver uma grande quantidade de ATH, eles compram da reserva pública a preços de tranche crescentes em vez de extrair toda a liquidez barata de um pool raso e revendê-la aos usuários. Se usuários comuns precisarem de ATH para o Platho, eles podem comprá-lo a um preço de tranche público conhecido sem empurrar um pool pequeno verticalmente com uma única onda de demanda.

A reserva não despeja tokens no mercado. Ela não vende por conta própria e não cria pressão vendedora sem demanda. Uma venda acontece somente quando um comprador voluntariamente compra da tranche atual. Se não houver demanda, a reserva permanece ociosa.

A utilidade on-chain do ATH é específica:

- o registro de nome de usuário `.ath` é pago em ATH através do UsernameRegistry;
- as atualizações de ponteiro de avatar de perfil são pagas em ATH através do ProfileRegistry;
- o ATH mantido no saldo interno do Vault do usuário reduz a taxa do protocolo para publicações do Vault após o gate de distribuição de atividade;
- as taxas de nome de usuário e avatar aceitas criam treasury due e burn due;
- o BuybackBurn compra ATH com as taxas do protocolo em GRAM e queima o ATH recebido através do ATHMaster.

As publicações do Vault são pagas em GRAM. O ATH não paga a transação de publicação inteira. Ele reduz o componente de taxa do protocolo depois que o gate de desconto está aberto.

Isso faz com que a demanda por ATH esteja atrelada a ações concretas do protocolo: nomes `.ath`, atualizações de avatar, descontos na taxa do protocolo do Vault após o airdrop e pressão de buyback/queima. O MarketStabilitySeller expande a oferta disponível apenas conforme os compradores tomam a próxima tranche, de modo que o acesso inicial é público e determinístico em vez de ser dominado por um pool raso.

A reserva é vendida somente após o congelamento de precificação pós-pool.

O congelamento de precificação é uma autoridade de lançamento real e única. Ele define o preço-base da tranche uma vez a partir da evidência de lançamento do pool, e então o hash do controlador de lançamento é limpo. Depois disso, o MarketStabilitySeller não pode roubar fundos, pausar vendas, resgatar saldos, sobrepor compradores ou alterar o cronograma de preços.

A prontidão do MarketStabilitySeller é um gate pós-pool, não um substituto da verificação de genesis final. A sequência de
produção é: `mainnet:genesis:verify` passa no snapshot final limpo, a precificação é congelada após o lançamento do pool, o
financiador de reserva vinculado financia o seller através do notify-flow, e então `market-stability:readiness` verifica o estado do seller, o financiamento, a evidência de preço
e o lastro da carteira. A prontidão do seller é válida para produção somente após essa passagem de prontidão.

O financiamento é aceito somente:

- após a selagem;
- após o congelamento de precificação;
- através da carteira ATH oficial do seller;
- do financiador de reserva vinculado;
- até o teto total de `60,000,000 ATH`.

Apenas o financiamento de reserva autenticado aumenta a contabilidade de reserva vendável. O runtime permite financiamento parcial da reserva e venda parcial, mas a prontidão de lançamento exige a reserva completa: `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH` e lastro de carteira oficial de pelo menos `60,000,000 ATH`. Uma transferência ATH ordinária não solicitada para a carteira ATH oficial do seller não aumenta `reserve_due_ath` ou `reserve_funded_total_ath`, não expande a oferta vendável e pode ficar presa. A prontidão trata o saldo da carteira oficial acima de `60,000,000 ATH` como um aviso, não como reserva adicional.

A reserva é dividida em 20 tranches:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Cada tranche tem um multiplicador:

```text
x2, x3, x4, ..., x21
```

Isso cria uma escada de preços suave. Conforme a popularidade do projeto cresce, o mercado recebe oferta adicional de ATH, mas cada tranche seguinte é mais cara que a anterior. A demanda inicial não atinge um pool raso imediatamente, e o crescimento do preço não se torna uma parede vertical que torna o token utilitário inconveniente de usar.

Fórmula de compra:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` é congelado após o lançamento do pool e corresponde exatamente à evidência de precificação x1.

Ao preço de lançamento `1 ATH = 0.001 GRAM`, o preço x1 de uma tranche é:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Portanto:

| Tranche | Multiplicador | Preço para 3M ATH | Preço por 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Uma única compra não pode cruzar um limite de tranche. Isso impede comprar ATH da próxima tranche ao preço da tranche anterior.

A receita em GRAM é reconhecida somente após o ATH ser entregue ao comprador. Se a transferência de ATH falhar ou sofrer bounce, a reserva é restaurada, o comprador recebe de volta o principal em GRAM pago, e o treasury due não aumenta.

Depois que a tranche final x21 é vendida, o MarketStabilitySeller não regula mais o preço do ATH. A partir desse ponto, o preço é totalmente determinado pelo mercado: liquidez, oferta disponível, demanda por nomes `.ath`, atualizações de avatar, descontos na taxa do protocolo do Vault após o airdrop e pressão de buyback/queima.

Mesmo no passo x21, a avaliação de referência permanece moderada em relação ao modelo de utilidade:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

No passo x21, o MarketStabilitySeller concluiu sua liberação programada de reserva. Depois disso, o preço do ATH é totalmente determinado pelo mercado, pela liquidez, pela demanda de uso, pela oferta disponível e pela pressão de buyback/queima. A única alocação de protocolo restante é o cronograma lento de vesting de longo prazo, limitado a `100,000 ATH` por ano.

## Buckets de Tesouro e Queima

O UsernameRegistry e o ProfileRegistry usam o mesmo modelo de split de taxa em ATH:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

O flush do treasury due envia ATH para o receptor de tesouro através da carteira ATH oficial.

O flush do burn due envia uma solicitação de queima de ATH através da carteira ATH oficial. A oferta diminui somente após a finalização da queima no ATHMaster.

Os caminhos de falha e bounce restauram os buckets de due. A contabilidade é preservada até que a transferência ou queima a jusante seja concluída.

## Contabilidade da ATHWallet

Os saldos de ATH residem em contratos ATHWallet determinísticos.

A ATHWallet lida com:

- crédito de oferta de genesis;
- transferência ordinária;
- transferência com notify;
- notify de cunhagem de nome de usuário;
- notify de avatar de perfil;
- solicitação de queima;
- confirmação de notificação;
- poda de notificação obsoleta;
- recuperação de bounce/falha.

Contratos que aceitam ATH como pagamento não aceitam mensagens diretas de endereços arbitrários. Eles aceitam notificações somente de sua ATHWallet oficial. A autenticação da carteira de origem é realizada dentro da ATHWallet através de derivação determinística de carteira.

O ATH expõe entrypoints de transferência similares ao TEP-74 para ferramentas genéricas de jetton, mas as ações do protocolo Platho usam mensagens de notificação de ATH autenticadas. Integrações externas não devem assumir que os fluxos de notify do Platho emitem uma `JettonTransferNotification` genérica.

As transferências internas de saída na ATHWallet são protegidas por contabilidade pendente do lado da origem e confirmação da origem. O saldo não é restaurado a partir de um corpo de bounce sem prova pendente.

## Ciclo de Vida do ATH

1. O `ATHMaster` cria a oferta fixa de `100,000,000 ATH`.
2. O deploy único do tesouro recebe a oferta na carteira ATH do tesouro.
3. A oferta é alocada entre atividade, liquidez, vesting de longo prazo e estabilidade de mercado.
4. Os usuários publicam mensagens através do Vault.
5. Uma publicação bem-sucedida credita `10 ATH` de recompensa de atividade.
6. Depois que o airdrop de atividade completo de `15,000,000 ATH` é distribuído e `airdrop_remaining_ath == 0`, os descontos na taxa do protocolo de ATH são desbloqueados.
7. O pool ATH/GRAM é lançado ao preço de referência `1 ATH = 0.001 GRAM`.
8. As evidências de rota pós-pool e as evidências de precificação são congeladas.
9. O MarketStabilitySeller vende a reserva através das tranches x2..x21.
10. Depois que o split é habilitado, o FeeAccumulator divide as taxas do protocolo em GRAM entre tesouro e buyback.
11. O BuybackBurn compra ATH com as taxas do protocolo em GRAM e queima ATH através do ATHMaster.
12. As taxas de nome de usuário e perfil criam ATH treasury due e ATH burn due.
13. A oferta total diminui gradualmente através de queimas autenticadas.

## Modelo Final

O ATH conecta quatro camadas do Platho:

1. **Uso da aplicação** - mensagens criam recompensas de atividade.
2. **Recursos pagos** - nomes de usuário e avatares exigem ATH.
3. **Descontos** - o saldo de ATH reduz a taxa do protocolo após o gate de distribuição.
4. **Redução da oferta** - parte das taxas de ATH e da saída de buyback é queimada através do ATHMaster.

O modelo começa com oferta fixa e avaliação de referência de `100,000 GRAM`. A distribuição primária aos usuários está atrelada ao uso pago real: as mensagens do produto podem dizer que as mensagens começam a partir de `0.0337 GRAM`, enquanto os exemplos exatos atuais são `0.0337 GRAM` para um post público de 1 KiB e `0.0347 GRAM` para uma cápsula privada híbrida de 1 KiB, mais um bônus de atividade de `10 ATH` por cápsula finalizada. Classes de tamanho públicas ou privadas maiores custam mais. Esse bônus não é um reembolso, ressarcimento ou promessa de lucro. Depois que os primeiros 15% da oferta são distribuídos, o pool é lançado, os descontos na taxa do protocolo são desbloqueados e o caminho de buyback abre.

O ATH existe como um token funcional dentro do Platho: ele é distribuído através da atividade, usado em ações pagas, reduz a taxa do protocolo, é vendido a partir da reserva através de uma escada definida e é queimado através de queima on-chain. Após a escada de estabilidade de mercado, o preço futuro do ATH é determinado pelo mercado e pelo uso do protocolo.
