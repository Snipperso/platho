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

O airdrop por atividade foi:

```text
15,000,000 ATH
```

Está concluído: os `15,000,000 ATH` da carteira ATH oficial do `AirdropPool` foram pagos na totalidade, e publicar já não dá ATH.

Enquanto decorreu, a recompensa por publicação bem-sucedida foi:

```text
10 ATH
```

Cada cápsula aceite dava `10 ATH` a quem a enviava, igual em todas as faixas; uma tentativa de publicação falhada não dava nada. O pagamento era feito em lotes, e não cápsula a cápsula: cada entrega traz um custo fixo não recuperável de cerca de `0.0166 GRAM`, seja o que for que transporte, pelo que pagar depois de cada cápsula teria custado mais do que essas cápsulas arrecadavam em taxas de protocolo.

## Preço da atividade

O custo de uma mensagem — o que sai da carteira de quem a envia depois de a rede a ter liquidado — a partir de 4 de outubro de 2026, aos preços da rede de 30 de setembro de 2026:

```text
mensagem privada:                             0.0174 GRAM
a primeira mensagem privada de um dia
numa conversa:                                0.0234 GRAM
publicação ou comentário público:             0.0135 GRAM
```

Durante o airdrop por atividade, uma publicação bem-sucedida dava também `10 ATH` — ao preço de referência do lançamento, `10 ATH * 0.001 GRAM = 0.01 GRAM`. Isso ligou a distribuição inicial de ATH ao uso real da aplicação. Era um bónus por atividade, e não um reembolso, um cashback, um desconto ou a promessa de que o ATH compensa o custo em GRAM de publicar: quem publicava recebia propriedade inicial da rede por uso real, não uma compensação garantida.

Preço das cápsulas: uma mensagem privada é selada num bloco de 1, 2, 4, 8, 16 ou 32 KiB, e um bloco maior custa mais porque é transportado e guardado por inteiro — de `0.0174 GRAM` para 1 KiB a `0.0732 GRAM` para 32 KiB. Uma publicação pública custa mais quanto mais longa for, a partir de `0.0135 GRAM` para uma publicação curta.

Uma publicação privada usa por omissão o perfil de segurança híbrido: X25519 + ML-KEM-768 + AES-GCM. Não existe um modo clássico mais barato para mensagens privadas.

O ATH pode ser negociado acima ou abaixo do preço de referência. A recompensa por atividade não foi um retorno de investimento, uma expectativa de lucro nem uma garantia de preço.

## Taxa de protocolo e preço para quem usa

A taxa de protocolo é distinta do custo total para quem usa a aplicação.

Taxa de protocolo:

| Tipo de publicação | Taxa de protocolo |
| --- | ---: |
| Publicação pública | 0.010 GRAM |
| Mensagem privada híbrida | 0.010 GRAM |

A partir de 4 de outubro de 2026, o ATH bloqueado no cofre de taxas da própria pessoa (`FeeVault`) dá um desconto de 1% a 100% na taxa de protocolo, para um bloqueio de 100 a 10,000 ATH: em cada mensagem privada e, sempre que o desconto valha mais do que a etapa extra pelo cofre, também em publicações, comentários e avatares. O ATH bloqueado continua a pertencer a quem o bloqueou e pode ser levantado.

O preço para quem usa é o que sai da sua carteira depois de a rede ter liquidado a publicação: a taxa de protocolo, o gás, o encaminhamento da mensagem e a dotação que mantém a entrada guardada no seu fragmento durante o período de retenção. A partir de 4 de outubro de 2026, aos preços da rede de 30 de setembro de 2026:

| Publicação | Custo |
| --- | ---: |
| Mensagem privada | 0.0174 GRAM |
| A primeira mensagem privada de um dia numa conversa | 0.0234 GRAM |
| Primeiro contacto | 0.0448–0.0778 GRAM |
| Publicação ou comentário público | 0.0135 GRAM |
| A primeira publicação da era de 30 dias de um canal, o primeiro comentário a uma publicação | 0.0271 GRAM |
| Ativação da conta, uma só vez | 0.0531 GRAM |

Com ATH bloqueado no cofre de taxas, uma mensagem privada custa `0.0164 GRAM` com 1,000 ATH, `0.0124 GRAM` com 5,000 ATH e `0.0074 GRAM` com 10,000 ATH, e uma publicação curta encaminhada pelo cofre com 10,000 ATH custa `0.0042 GRAM`.

A primeira mensagem de um dia custa mais porque cria o fragmento desse dia para a conversa: transporta o código do fragmento e paga a dotação que o mantém guardado. A primeira publicação de uma era, e o primeiro comentário a uma publicação, fazem o mesmo com os respetivos fragmentos. Um primeiro contacto consiste em três escritas: a própria apresentação (`0.0180 GRAM`, ou `0.0204 GRAM` quando abre o seu compartimento do dia), a primeira mensagem da conversa e a cópia de segurança cifrada da chave da nova conversa na ranhura de recuperação de quem envia — `0.0036 GRAM` quando a ranhura já existe, `0.0341 GRAM` quando é esta escrita que a cria. A primeira mensagem privada que uma pessoa envia a partir de 4 de outubro de 2026 cria também o seu cofre de taxas: passa para ele uma reserva de `0.0500 GRAM` para a renda, que continua a pertencer-lhe. Um avatar custa `100 ATH`, mais o custo de rede das suas partes de imagem, uma ou duas, e do pedido ao ProfileRegistry, que transporta `0.26 GRAM` juntamente com a taxa e devolve o que o registo não retém.

Para enviar, a carteira anexa mais do que o preço — o suficiente para o caso mais caro que a publicação possa encontrar — e o fragmento devolve o resto na mesma cadeia de mensagens, em poucos segundos. A aplicação mostra o preço de cada mensagem antes de ela ser enviada e avisa quando a carteira não consegue cobrir o que tem de ser anexado. Os preços da rede podem mudar; os custos acompanham-nos, e a aplicação calcula o preço com base nos preços atuais.

Até 4 de outubro de 2026 (contratos clean-17), uma mensagem privada custa `0.0189 GRAM`, a primeira de um dia `0.0223 GRAM`, uma publicação pública `0.0153 GRAM` e a apresentação de um primeiro contacto `0.0198 GRAM`.

## Lançamento da pool

A pool ATH/GRAM é lançada depois de o airdrop por atividade completo de `15,000,000 ATH` estar distribuído.

Sequência de lançamento:

1. As pessoas recebem ATH pelo uso real do Platho.
2. O airdrop por atividade completo é distribuído.
3. A pool ATH/GRAM é lançada.
4. As evidências de rota e de preço posteriores à pool são congeladas.
5. A recompra é feita à mão a partir do tesouro (ver Recompra e queima); a divisão de recompra do FeeAccumulator não é usada.

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

A partir de 4 de outubro de 2026, a taxa de protocolo chega ao tesouro sem divisão. Uma taxa paga através do cofre de taxas da própria pessoa — cada mensagem privada e, quando o bloqueio torna essa porta a mais barata, uma publicação, um comentário ou uma parte de avatar — é contabilizada nesse cofre e paga ao tesouro de forma agregada; uma taxa paga diretamente passa pelo seu fragmento até um dos 64 coletores de taxas, os contratos `FeeSink`, que a pagam por inteiro ao tesouro. Até lá, os contratos clean-17 pagam-na ao `FeeAccumulator`, descrito abaixo. A sua divisão de recompra não está em uso: a recompra é feita à mão (ver Recompra e queima).

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

A recompra é feita à mão: o tesouro compra ATH com GRAM no mercado e queima-o através da sua própria carteira ATH (`ATHBurn`), pelo que cada queima é visível on-chain. O contrato `BuybackBurn` descrito abaixo continua implantado, mas não é usado para a recompra.

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
- o número de partes é 1 ou 2;
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
- o ATH bloqueado no cofre de taxas da própria pessoa reduz a taxa de protocolo das publicações (a partir de 4 de outubro de 2026);
- as taxas aceites de nomes e avatares criam dívida de tesouro e dívida de queima;
- o tesouro, a que chegam as taxas de protocolo em GRAM, compra ATH no mercado e queima-o através do ATHMaster — à mão e de forma visível on-chain.

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
5. Durante o airdrop por atividade, uma publicação bem-sucedida creditava `10 ATH` de recompensa por atividade (o airdrop está concluído).
6. A pool ATH/GRAM é lançada ao preço de referência `1 ATH = 0.001 GRAM`.
7. As evidências de rota e de preço posteriores à pool são congeladas.
8. O MarketStabilitySeller vende a reserva pelas tranches x2..x21.
9. As taxas de protocolo em GRAM chegam ao tesouro — através do FeeAccumulator até 4 de outubro de 2026 e, a partir daí, através dos cofres de taxas e dos coletores de taxas.
10. O tesouro compra ATH com GRAM no mercado e queima-o através do ATHMaster, à mão.
11. As taxas de nome e de perfil criam dívida de tesouro em ATH e dívida de queima em ATH.
12. A oferta total diminui gradualmente através de queimas autenticadas.

## Modelo final

O ATH une três camadas do Platho:

1. **Uso da aplicação** — as mensagens distribuíram os primeiros 15% da oferta através do airdrop por atividade.
2. **Funcionalidades pagas** — nomes e avatares exigem ATH.
3. **Redução da oferta** — parte das taxas em ATH e do resultado da recompra é queimada através do ATHMaster.

O modelo parte de uma oferta fixa e de uma avaliação de referência de `100,000 GRAM`. A distribuição primária esteve ligada ao uso real e pago: a partir de 4 de outubro de 2026, uma mensagem privada custa `0.0174 GRAM` e uma publicação pública curta `0.0135 GRAM` — e, durante o airdrop por atividade, cada cápsula finalizada dava também um bónus de `10 ATH`. Classes de tamanho públicas ou privadas maiores custam mais. Esse bónus não era um reembolso, uma compensação nem uma promessa de lucro. Os primeiros 15% da oferta já foram distribuídos.

O ATH existe como token de trabalho dentro do Platho: foi distribuído por atividade, é usado em ações pagas, reduz a taxa de protocolo quando bloqueado, é vendido a partir da reserva por uma escada definida e é queimado on-chain. Passada a escada de estabilidade de mercado, o preço futuro do ATH é determinado pelo mercado e pelo uso do protocolo.
