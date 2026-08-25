# Whitepaper do ATH

## O token do protocolo Platho

ATH é o token utilitário do Platho. Serve para recompensas por atividade, nomes `.ath`, atualizações de avatar, vendas de estabilidade de mercado, recompra e queima.

ATH não é um token administrativo. Não dá poder para reescrever saldos, pausar operações, emitir nova oferta ou alterar aquilo que pertence a quem usa a aplicação. O seu papel é alimentar a economia da aplicação e ligar o uso do Platho à contabilidade on-chain.

Este documento descreve o modelo do ATH no Platho.

## Parâmetros principais

O ATH tem uma oferta total fixa:

```text
100,000,000 ATH
```

Preço de referência no lançamento:

```text
1 ATH = 0.001 GRAM
```

Avaliação totalmente diluída no lançamento:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

O ATH parte de uma capitalização de referência de `100,000 GRAM`.

## Oferta fixa

O ATH é emitido pelo contrato `ATHMaster`. Na inicialização, o `ATHMaster` fixa a oferta total em `100,000,000 ATH`.

Não existe função de emissão após o génesis. O `ATHMaster` não implementa cunhagem administrativa, pausa, lista negra, imposto de transferência, transferência forçada nem levantamento de emergência.

A emissão primária acontece uma única vez, através de `DeployTreasurySupply`, que envia toda a oferta para a carteira ATH do tesouro. A emissão de génesis não pode ser repetida.

A oferta total só diminui por queima. O `ATHMaster` aceita uma queima apenas após uma notificação de queima autenticada, vinda da carteira ATH determinística do endereço proprietário. Verificada essa notificação, o `ATHMaster` reduz o `total_supply` e envia `ATHBurnFinalized`.

Queimar ATH é uma redução real da oferta total, não uma transferência para um endereço fora de uso.

## Distribuição da oferta

A oferta de ATH divide-se em quatro categorias:

| Categoria | Percentagem | Quantidade |
| --- | ---: | ---: |
| Airdrop por atividade | 15% | 15,000,000 ATH |
| Liquidez inicial | 15% | 15,000,000 ATH |
| Vesting de protocolo de longo prazo | 10% | 10,000,000 ATH |
| Reserva de estabilidade de mercado | 60% | 60,000,000 ATH |

Esta divisão define a estrutura económica do Platho:

- 15% da oferta é distribuída às pessoas utilizadoras através da atividade na aplicação, antes do lançamento da pool.
- 15% da oferta serve de liquidez inicial.
- 10% da oferta fica bloqueada num vesting imutável de longo prazo.
- 60% da oferta é colocada no MarketStabilitySeller e bloqueada no génesis, sendo depois vendida em tranches acima do preço de lançamento, após o congelamento de preços posterior à pool.

No génesis final, o airdrop por atividade e a reserva de vesting de longo prazo são cobertos pelas carteiras ATH oficiais do AirdropPool e do ATHVesting, e o verificador de release confere esses saldos antes de uma publicação em produção. A reserva de estabilidade de `60,000,000 ATH` é colocada no MarketStabilitySeller e bloqueada no génesis final, coberta pela sua carteira ATH oficial de venda, e o verificador confere essa cobertura antes de uma publicação em produção. A reserva está capitalizada desde o início, mas não é vendida antes do lançamento da pool, momento em que um congelamento de preços único e ligado a evidências fixa o preço-base da tranche.

## Vesting de protocolo de longo prazo

A reserva de vesting de longo prazo é:

```text
10,000,000 ATH
```

Fica no `ATHVesting`, e não num compartimento de tesouro modificável. O calendário está fixado no contrato:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Qualquer pessoa pode desencadear um pedido de pagamento depois de o ATH ter vencido, mas a pessoa beneficiária é imutável. O contrato não tem aceleração, troca de beneficiário, pausa, levantamento administrativo, saída de emergência nem libertação discricionária.

No génesis final, a carteira oficial `ATHWallet(owner = ATHVesting, master = ATHMaster)` tem de conter exatamente `10,000,000 ATH`. O verificador exige ainda zero ATH reclamado, fase inativa e nenhuma transferência pendente antes do lançamento.

Esta reserva é deliberadamente lenta. Cria um horizonte longo para o desenvolvimento do protocolo sem colocar sobre o mercado, no lançamento, um bloco líquido de 10M ATH.

## Airdrop por atividade

O airdrop por atividade é:

```text
15,000,000 ATH
```

Recompensa por publicação bem-sucedida:

```text
10 ATH
```

Cada cápsula aceite dá `10 ATH` a quem a envia, igual em todas as faixas. Uma tentativa de publicação falhada não dá nada.

O pagamento é feito em lotes, e não cápsula a cápsula. Cada entrega traz um custo fixo não recuperável de cerca de `0.0166 GRAM`, e esse custo não depende de quanto ATH a entrega transporta. Pagar depois de cada cápsula custaria mais do que essas cápsulas arrecadam em taxas de protocolo, por isso a recompensa acumula-se e chega num único pagamento.

O airdrop é coberto pela carteira ATH oficial do `AirdropPool`, onde estão esses `15,000,000 ATH`. Esgotados, cessam as recompensas por atividade.

## Preço da atividade

As mensagens partem do preço-base atual:

```text
0.0191 GRAM
```

Valores exatos atuais:

```text
mensagem privada:  0.0191 GRAM
primeiro contacto: 0.0178 GRAM
publicação:        0.0203 GRAM
```

Por cada publicação bem-sucedida recebe-se:

```text
10 ATH
```

Ao preço de referência do lançamento:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Isto liga a distribuição inicial de ATH ao uso real da aplicação. A recompensa é um bónus por atividade, e não um reembolso, um cashback, um desconto ou a promessa de que o ATH compensa o custo em GRAM de publicar. O valor de referência de `10 ATH` pode ficar abaixo do custo em GRAM de uma cápsula, e isso é intencional: recebe-se propriedade inicial da rede por uso real, não uma compensação garantida.

Preço das cápsulas: uma publicação pública a partir de `0.0203 GRAM`, uma cápsula privada a partir de `0.0191 GRAM`. Blocos de cápsula públicos ou privados maiores custam mais, porque o corpo escolhido de 1, 2, 4, 8, 16 ou 32 KiB altera a reserva de execução e armazenamento no fragmento. A recompensa mantém-se em `10 ATH` por cápsula finalizada com sucesso, qualquer que seja o tamanho.

Uma publicação privada usa por omissão o perfil de segurança híbrido: X25519 + ML-KEM-768 + AES-GCM. Não existe um modo clássico mais barato para mensagens privadas.

O ATH pode ser negociado acima ou abaixo do preço de referência assim que exista a pool oficial. A recompensa por atividade não é um retorno de investimento, uma expectativa de lucro nem uma garantia de preço.

## Taxa de protocolo e preço para quem usa

A taxa de protocolo é distinta do custo total para quem usa a aplicação.

Taxa de protocolo:

| Tipo de publicação | Taxa de protocolo |
| --- | ---: |
| Publicação pública | 0.010 GRAM |
| Mensagem privada híbrida | 0.010 GRAM |

O preço final cobre a taxa de protocolo, o gás e a dotação para guardar a entrada no seu fragmento:

| Publicação | Anexado |
| --- | ---: |
| Mensagem privada | 0.0191 GRAM |
| Primeiro contacto | 0.0178 GRAM |
| Publicação ou comentário público | 0.0203 GRAM |
| Atualização de avatar | 0.0395 GRAM |
| Ativação da conta | 0.0600 GRAM |

O cliente anexa sempre o maior dos dois valores — aquele que é preciso para criar o fragmento. O excedente não se perde: o fragmento guarda exatamente o que precisa e devolve o resto a quem enviou. Se a estimativa da rede vier acima do previsto, o cliente acrescenta uma margem por cima; é margem e não pagamento, e também é devolvida.

## Lançamento da pool

A pool ATH/GRAM é lançada depois de o airdrop por atividade completo de `15,000,000 ATH` estar distribuído.

Sequência de lançamento:

1. As pessoas recebem ATH pelo uso real do Platho.
2. O airdrop por atividade completo é distribuído.
3. A pool ATH/GRAM é lançada.
4. As evidências de rota e de preço posteriores à pool são congeladas.
5. A divisão de recompra é ativada.

A pool arranca no preço de referência:

```text
1 ATH = 0.001 GRAM
```

Alocação de liquidez inicial:

```text
15,000,000 ATH
```

O lado GRAM ao preço de lançamento:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

As taxas de protocolo recolhidas antes do lançamento financiam integralmente o lado GRAM da liquidez inicial. Faz parte do arranque e não transforma as recompensas por atividade num direito denominado em GRAM.

A pool é lançada em torno de um token já distribuído através do uso da aplicação. É isso que separa o ATH de uma listagem vazia sem base de utilizadores.

## FeeAccumulator

As taxas de protocolo em GRAM são recolhidas no `FeeAccumulator`.

Antes de a divisão de recompra ser ativada, todo o GRAM acumulado passa para o compartimento do tesouro:

```text
accumulated_ton -> treasury_due_ton
```

O `buyback_due_ton` não cresce enquanto a divisão não for ativada.

Depois de `EnableBuybackSplit`, o GRAM acumulado é dividido:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Se o montante em nanotons for ímpar, o resto fica do lado da recompra:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` é uma ação sem retorno, executada pela pessoa recetora imutável do tesouro depois do lançamento da pool e do congelamento da rota de recompra. É um poder real de uso único: não pode roubar fundos, pausar, sair de emergência nem mudar endereços, mas altera permanentemente a economia do FeeAccumulator, de uma acumulação de arranque só para o tesouro para uma divisão 50/50 entre tesouro e recompra. Só é ativada depois de passar a verificação prévia à publicação.

Os poderes de publicação do Platho são deliberadamente estreitos e quase sempre de uso único. Existem, e devem ser nomeados com honestidade: a titularidade do tesouro implanta a oferta primária de ATH uma vez; o controlador de génesis faz a ligação pré-selagem e a selagem; o controlador de lançamento do BuybackBurn congela a rota pós-pool uma vez; o congelamento de preços do MarketStabilitySeller é feito uma vez pelo seu controlador de lançamento; e a pessoa recetora do tesouro no FeeAccumulator ativa a divisão de recompra sem retorno após a verificação prévia. Nenhum destes papéis é uma saída de emergência, uma pausa, uma atualização, um levantamento administrativo ou controlo arbitrário sobre saldos.

## Recompra e queima

A recompra corre através do `FeeAccumulator` e do `BuybackBurn`.

O BuybackBurn aceita apenas um envelope executável completo:

```text
51.05 GRAM
```

Estrutura do envelope:

```text
50.00 GRAM  - montante da oferta na STON.fi
1.00 GRAM   - gás de encaminhamento da rota
0.05 GRAM   - gás de transferência pTON
```

`50 GRAM` isolados não são um bloco de recompra válido. A recompra só é aceite como envelope de rota completo.

Congelada a rota, o BuybackBurn executa a recompra assim:

1. Aceita `51.05 GRAM` apenas do FeeAccumulator vinculado.
2. Regista o montante em `reserve_due_ton`.
3. Com `ExecuteBuybackChunk` consome um envelope.
4. Usa a cotação congelada e o minOut congelado.
5. Define internamente o prazo da STON.fi.
6. Envia a rota através da carteira pTON congelada.
7. Aceita ATH apenas pela carteira ATH oficial do BuybackBurn.
8. Verifica se a carteira de origem corresponde à pool STON.fi congelada.
9. Envia o ATH recebido para queima pela carteira ATH oficial.
10. Fecha o ciclo apenas após `ATHBurnFinalized` do `ATHMaster`.

O sucesso da recompra não é definido por uma mensagem do router, por um pedido de queima enviado nem por uma notificação de queima da ATHWallet. É definido apenas quando o BuybackBurn recebe um `ATHBurnFinalized` autenticado do ATHMaster. Até essa finalização chegar, o BuybackBurn continua em estado de queima pendente ou de nova tentativa; painéis e indexadores não devem contar o ATH como queimado só porque foi enviada uma tentativa de queima.

Se a queima não finalizar, o ATH recebido passa para a dívida de nova tentativa. `RetryAthBurnDue` queima a totalidade desse montante.

## Taxas de nome

Registar um nome `.ath` é pago em ATH através da carteira ATH oficial do UsernameRegistry.

Preços:

| Comprimento do nome | Preço |
| ---: | ---: |
| 4 caracteres | 10,000 ATH |
| 5 caracteres | 1,000 ATH |
| 6 ou mais | 100 ATH |

O UsernameRegistry aceita apenas o preço exato. Pagar a menos ou a mais não cria um nome.

Uma cunhagem aceite passa por um estado pendente e implanta um `UsernameNFTItem`. O pagamento só é reconhecido como receita depois de o item ser confirmado. Confirmado o item, o montante é dividido:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

A cunhagem de um nome é paga em ATH a partir da carteira da própria pessoa. Recusas por nome inválido, preço errado ou nome duplicado são devolvidas à pessoa proprietária pela via de reembolso de notificações da ATHWallet. O UsernameRegistry não mantém um compartimento externo de reembolso para nomes.

O ATH de uma cunhagem de nome torna-se receita do protocolo apenas depois de confirmada a implantação do item correspondente.

A autoridade sobre nomes está dividida de propósito: o `UsernameRegistry` ancora o nome a um `UsernameNFTItem` exato, e o estado do item carrega a titularidade atual. Transferir o item transfere o nome. O item fornece dados NFT padrão e metadados TEP-64 on-chain, incluindo `name = <username>.ath`; não depende de nenhum servidor do Platho para metadados. Os bytes do nome são literais e não são normalizados para exibição: nomes com separadores iniciais, finais, consecutivos ou compostos só por separadores são válidos desde que cada byte pertença ao conjunto permitido `a-z`, `0-9`, `_`, `-` e o comprimento esteja entre 4 e 16. Se a implantação do item foi tentada mas o seu ACK nunca chegou ao registo, `PrunePendingUsernameMint` é deliberadamente não destrutivo: não adivinha a falha, não apaga o estado pendente e não cria dívida de reembolso. A via de recuperação é um `UsernameItemDeployedAck` tardio ou `UsernameNFTItem.ResendDeployedAck`, de modo que um item já inicializado ainda pode tornar-se autoritativo. Se a implantação do item realmente ressaltar, o registo pede à carteira ATH oficial que devolva a notificação pendente. A âncora entre nome e item é a própria derivação do endereço: `UsernameRegistry.get_username_item_address(name_hash)` dá o único endereço onde um nome pode residir. Um `UsernameNFTItem` implantado em qualquer outro endereço não é autoritativo: clientes, indexadores e interfaces não devem tratar o item por si só como propriedade do nome `.ath`, nem usar a pessoa proprietária do registo como titular atual depois de transferências.

## Taxas de avatar

Custo de atualizar o avatar:

```text
100 ATH
```

A atualização do avatar é paga em ATH a partir da carteira da própria pessoa: uma transferência com notificação da sua ATHWallet para a carteira ATH oficial do ProfileRegistry.

O ProfileRegistry aceita a atualização apenas se todas as condições se verificarem:

- o montante é exatamente `100 ATH`;
- quem envia é a carteira ATH oficial do ProfileRegistry;
- a carteira pagadora é a ATHWallet da pessoa proprietária;
- a carteira proprietária está na basechain;
- o hash do avatar é diferente de zero;
- o identificador de fluxo é diferente de zero;
- o número de partes está entre 1 e 16;
- o formato de média é WebP.

Uma atualização aceite cria uma nova versão de avatar e divide a taxa:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Uma notificação de avatar recusada é devolvida pela via de reembolso de notificações da ATHWallet. O ProfileRegistry não cria um compartimento de reembolso separado para atualizações malformadas.

O ProfileRegistry define o preço e liquida o pagamento, mas não guarda estado de perfil: o ponteiro autenticado para o avatar vive no KeyShard da própria pessoa proprietária. Os bytes da imagem vivem no PublicShard, no domínio AVATAR; o cliente reconstrói o WebP a partir deles ou de uma cache local e confere os bytes contra o `avatar_hash` guardado. Um histórico ausente ou truncado é mostrado como indisponível.

## Market Stability Seller

O MarketStabilitySeller é uma reserva pública em contrato que distribui ATH depois do lançamento da pool oficial:

```text
60,000,000 ATH
```

O seu objetivo é reduzir a distorção do mercado inicial causada por liquidez fina. No lançamento, uma pool pequena pode ser fortemente movida por um grupo reduzido de compradores iniciais. Se isso acontecer, quem precisa de ATH para ações reais no Platho pode ser forçado a comprar num pico de preço artificial.

O MarketStabilitySeller cria uma escada de oferta transparente acima do preço de lançamento. Vende ATH em tranches de tamanho fixo. Cada tranche seguinte é mais cara do que a anterior, e cada uma tem um limite rígido de tamanho. Depois do congelamento de preços único e ligado a evidências, o calendário de tranches é determinístico e a equipa não o pode alterar à mão.

Se especuladores iniciais tentarem absorver uma grande quantidade de ATH, compram da reserva pública a preços de tranche crescentes, em vez de drenarem toda a liquidez barata de uma pool fina e a revenderem. Quem precisa de ATH para o Platho pode comprá-lo a um preço de tranche público e conhecido, sem empurrar uma pool pequena na vertical com uma única vaga de procura.

A reserva não despeja tokens no mercado. Não vende por si própria e não cria pressão vendedora sem procura. A venda só acontece quando alguém compra voluntariamente da tranche atual. Sem procura, a reserva fica inativa.

A utilidade on-chain do ATH é concreta:

- registar um nome `.ath` é pago em ATH através do UsernameRegistry;
- as atualizações do ponteiro de avatar são pagas em ATH através do ProfileRegistry;
- o ATH na carteira da própria pessoa reduz a taxa de protocolo das publicações depois do portão de distribuição por atividade;
- as taxas aceites de nomes e avatares criam dívida de tesouro e dívida de queima;
- o BuybackBurn compra ATH com taxas de protocolo em GRAM e queima o ATH recebido através do ATHMaster.

As publicações são pagas em GRAM diretamente da carteira.

Isto liga a procura de ATH a ações concretas do protocolo: nomes `.ath`, atualizações de avatar e a pressão de recompra e queima. O MarketStabilitySeller alarga a oferta disponível apenas à medida que alguém toma a tranche seguinte, pelo que o acesso inicial é público e determinístico, em vez de dominado por uma pool fina.

A reserva só é vendida depois do congelamento de preços posterior à pool.

O congelamento de preços é um poder real de lançamento e de uso único. Fixa o preço-base da tranche uma vez, a partir das evidências do lançamento da pool, e depois o hash do controlador de lançamento é apagado. A partir daí, o MarketStabilitySeller não pode roubar fundos, pausar vendas, esvaziar saldos de emergência, passar por cima de quem compra nem alterar a tabela de preços.

O MarketStabilitySeller é capitalizado no génesis final com a reserva completa de `60,000,000 ATH`, financiada pelo fluxo autenticado de dotação para a carteira ATH oficial de venda, até um limite rígido de `60,000,000 ATH`. `mainnet:genesis:verify` confere que a parte vendedora suporta a reserva completa e que a cobertura da sua carteira ATH oficial é de pelo menos `60,000,000 ATH` antes de uma publicação em produção. Uma transferência ordinária e não solicitada de ATH para essa carteira oficial não aumenta a reserva contabilizada, não alarga a oferta vendável e pode ficar presa; um saldo acima de `60,000,000 ATH` é tratado como aviso, não como reserva adicional.

Vender é um passo à parte, posterior à pool. A reserva não é vendida antes do lançamento; nesse momento o congelamento de preços único e ligado a evidências fixa o preço-base da tranche, e daí em diante o calendário é determinístico e a equipa não o pode alterar à mão.

A reserva é dividida em 20 tranches:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Cada tranche tem um multiplicador:

```text
x2, x3, x4, ..., x21
```

Isto cria uma escada de preços suave. À medida que o projeto ganha popularidade, o mercado recebe oferta adicional de ATH, mas cada tranche seguinte é mais cara do que a anterior. A procura inicial não atinge de uma vez uma pool fina, e a subida de preço não se transforma num muro vertical que torne um token utilitário desconfortável de usar.

Fórmula de compra:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

O `base_tranche_price` é congelado depois do lançamento da pool e corresponde exatamente à evidência de preço x1.

Ao preço de lançamento `1 ATH = 0.001 GRAM`, o preço x1 de uma tranche é:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Logo:

| Tranche | Multiplicador | Preço por 3M ATH | Preço por 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Uma única compra não pode atravessar o limite de uma tranche. Isto impede comprar ATH da tranche seguinte ao preço da anterior.

A receita em GRAM só é reconhecida depois de o ATH ter sido entregue a quem compra. Se a transferência de ATH falhar ou ressaltar, a reserva é reposta, quem compra recupera o capital em GRAM que pagou, e a dívida de tesouro não aumenta.

Vendida a tranche final x21, o MarketStabilitySeller deixa de regular o preço do ATH. A partir daí o preço é definido inteiramente pelo mercado: liquidez, oferta disponível, procura por nomes `.ath`, atualizações de avatar e a pressão de recompra e queima.

Mesmo no degrau x21, a avaliação de referência mantém-se moderada face ao modelo de utilidade:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

No degrau x21, o MarketStabilitySeller completou a sua libertação programada de reserva. Depois disso, o preço do ATH é definido inteiramente pelo mercado, através da liquidez, da procura de uso, da oferta disponível e da pressão de recompra e queima. A única distribuição de protocolo que resta é o calendário lento de vesting de longo prazo, limitado a `100,000 ATH` por ano.

## Compartimentos de tesouro e de queima

O UsernameRegistry e o ProfileRegistry usam o mesmo modelo de divisão de taxas em ATH:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Esvaziar a dívida de tesouro envia ATH para a pessoa recetora do tesouro através da carteira ATH oficial.

Esvaziar a dívida de queima envia um pedido de queima de ATH pela carteira ATH oficial. A oferta só diminui depois de a queima ser finalizada no ATHMaster.

As vias de falha e de ressalto repõem os compartimentos de dívida. A contabilidade é preservada até a transferência ou a queima a jusante estar concluída.

## Contabilidade na ATHWallet

Os saldos de ATH vivem em contratos ATHWallet determinísticos.

A ATHWallet trata de:

- creditar a emissão de génesis;
- a transferência ordinária;
- a transferência com notificação;
- a notificação de cunhagem de nome;
- a notificação de avatar;
- o pedido de queima;
- a confirmação de notificação;
- a limpeza de uma notificação obsoleta;
- a recuperação após ressalto ou falha.

Os contratos que aceitam ATH como pagamento não aceitam mensagens diretas de endereços arbitrários. Aceitam notificações apenas da sua própria ATHWallet oficial. A autenticação da carteira de origem acontece dentro da ATHWallet, através de derivação determinística.

O ATH expõe pontos de entrada de transferência ao estilo TEP-74 para ferramentas jetton genéricas, mas as ações de protocolo do Platho usam mensagens de notificação ATH autenticadas. Integrações externas não devem presumir que os fluxos de notificação do Platho emitem um `JettonTransferNotification` genérico.

As transferências internas de saída na ATHWallet são protegidas por contabilidade de pendentes do lado da origem e por uma confirmação do lado da origem. Um saldo não é reposto a partir do corpo de um ressalto sem prova de uma operação pendente.

## Ciclo de vida do ATH

1. O `ATHMaster` cria a oferta fixa de `100,000,000 ATH`.
2. Uma implantação de tesouro única recebe a oferta na carteira ATH do tesouro.
3. A oferta é distribuída por atividade, liquidez, vesting de longo prazo e estabilidade de mercado.
4. As pessoas publicam mensagens pagando diretamente da sua própria carteira.
5. Uma publicação bem-sucedida credita `10 ATH` de recompensa por atividade.
6. A pool ATH/GRAM é lançada ao preço de referência `1 ATH = 0.001 GRAM`.
7. As evidências de rota e de preço posteriores à pool são congeladas.
8. O MarketStabilitySeller vende a reserva pelas tranches x2..x21.
9. Ativada a divisão, o FeeAccumulator reparte as taxas em GRAM entre tesouro e recompra.
10. O BuybackBurn compra ATH com taxas em GRAM e queima-o através do ATHMaster.
11. As taxas de nome e de perfil criam dívida de tesouro em ATH e dívida de queima em ATH.
12. A oferta total diminui gradualmente através de queimas autenticadas.

## Modelo final

O ATH une três camadas do Platho:

1. **Uso da aplicação** — as mensagens geram recompensas por atividade.
2. **Funcionalidades pagas** — nomes e avatares exigem ATH.
3. **Redução da oferta** — parte das taxas em ATH e do resultado da recompra é queimada através do ATHMaster.

O modelo parte de uma oferta fixa e de uma avaliação de referência de `100,000 GRAM`. A distribuição primária está ligada ao uso real e pago: as mensagens partem de `0.0191 GRAM` — hoje `0.0191 GRAM` uma mensagem privada e `0.0203 GRAM` uma publicação pública — mais um bónus de atividade de `10 ATH` por cápsula finalizada. Classes de tamanho públicas ou privadas maiores custam mais. Esse bónus não é um reembolso, uma compensação nem uma promessa de lucro. Distribuídos os primeiros 15% da oferta, a pool é lançada e a via de recompra abre.

O ATH existe como token de trabalho dentro do Platho: é distribuído por atividade, usado em ações pagas, reduz a taxa de protocolo, é vendido a partir da reserva por uma escada definida e é queimado on-chain. Passada a escada de estabilidade de mercado, o preço futuro do ATH é determinado pelo mercado e pelo uso do protocolo.
