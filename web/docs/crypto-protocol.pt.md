# Protocolo de criptografia de mensagens do Platho

Este documento descreve a criptografia de mensagens do lado do cliente implementada pelo protótipo PWA estático.

## Suites

| Suite | Valor no contrato | Finalidade |
| --- | ---: | --- |
| `hybrid-v1` | `2` | Mensagens privadas usando X25519 mais ML-KEM-768 mais AES-GCM. |

A publicação privada V1 aceita apenas `CRYPTO_SUITE_HYBRID = 2`.

## Pacotes de chaves

Toda frase de recuperação GRAM de 24 palavras criada ou importada pelo PWA deriva de forma determinística uma identidade de mensagens com um par de chaves de criptografia e uma chave de assinatura Ed25519. O material da chave pública de criptografia é exportado como um pacote de chave pública:

- `keyId`: identificador baseado em SHA-256 sobre o material da chave pública.
- `x25519PublicKey`: chave pública ECDH clássica de 32 bytes.
- `mlKem768PublicKey`: chave pública ML-KEM-768 de 1184 bytes para `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 da chave pública ML-KEM-768.
- `mlKem768PublicKeyLen`: sempre `1184` para `hybrid-v1`.

O PWA recalcula `keyId`, `mlKem768PublicKeyHash` e `mlKem768PublicKeyLen` antes da criptografia. Um pacote que declare um id, suite, suite de contrato, hash ou comprimento incompatível é rejeitado.

A busca do destinatário é definida pelas chaves on-chain `enc_pubkey`, `sign_pubkey` e a célula on-chain completa `pq_kem_pubkey` armazenada no registro de chave ativo do Vault. O hash e o comprimento permanecem no registro como campos de vinculação compactos, mas é a chave pública ML-KEM-768 completa que permite a outro cliente de fato criptografar uma cápsula `hybrid-v1`.

## Pacotes assinados

O PWA pode exportar um pacote de chave pública assinado. O conteúdo assinado inclui:

- domínio de protocolo `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- carimbos de tempo de emissão e de expiração opcional;
- marcadores opcionais da carteira do proprietário e do endereço do Vault;
- o pacote público de criptografia;
- a chave pública de assinatura Ed25519 de 32 bytes.

A assinatura cobre o conteúdo JSON estável e é verificada antes de o pacote ser considerado confiável. Isso impede a adulteração local silenciosa do pacote e fornece ao cliente exatamente a `sign_pubkey` que o Vault armazena em `KeyRecord`.

O `keyId` do PWA é um identificador de pacote do cliente. Ele não substitui o `current_key_id` do contrato Vault, que é calculado on-chain a partir do endereço do proprietário, da geração de chaves, da chave de assinatura, da chave de criptografia, do hash PQ, do comprimento PQ e da suite de criptografia. Um cliente de produção deve verificar o pacote contra o registro de chave do Vault antes de confiar nele para uma identidade de carteira.

O pacote assinado é uma autoassinatura da chave de mensagens. A propriedade da carteira é ancorada pela ativação do Vault: a carteira Platho embutida envia `RegisterMessagingKeys`, rotações posteriores de `ReplaceMessagingKeys` são mensagens externas assinadas com a autenticação do Vault, e os destinatários verificam o pacote assinado contra o registro de chave on-chain ativo daquela carteira.

## Propriedade da carteira

O PWA de produção não usa um conector de carteira externa. O usuário cria ou importa uma frase de recuperação GRAM normal de 24 palavras, e o PWA
deriva de forma determinística a chave da carteira GRAM, uma chave de autenticação do Vault separada e as chaves de criptografia/assinatura de mensagens a partir dessa frase. A ativação
do Vault é a âncora de propriedade: a carteira embutida assina e envia `RegisterMessagingKeys` a partir da mesma carteira que é proprietária do registro de chave on-chain.
`ReplaceMessagingKeys` rotaciona apenas o registro de chave pública de recebimento/mensagens; não rotaciona a chave de autenticação do Vault.

Os destinatários confiam em um pacote de mensagens somente após verificá-lo contra o registro de chave ativo do Vault daquela carteira:

- o proprietário do registro é a carteira esperada;
- `enc_pubkey` e `sign_pubkey` correspondem ao pacote assinado;
- registros híbridos expõem a célula `pq_kem_pubkey` completa, não apenas seu hash;
- os bytes decodificados da chave ML-KEM-768 têm hash igual a `pq_kem_pubkey_hash`;
- o `current_key_id` ativo aponta para o registro de chave verificado.

O fluxo de exportação/importação de perfil lida com a frase de recuperação GRAM de 24 palavras. Não há backup separado da chave de mensagens nem
modo de conexão de carteira externa na v1 final.

## Layout compacto de bytes

As células on-chain das cápsulas privadas usam o layout binário final `platho.byte-layout.v1`. O PWA pode envolver as cápsulas em JSON para a interface de exportação/compartilhamento, mas o conteúdo do protocolo são bytes binários, não JSON e não um ponteiro off-chain. O `CapsuleHub` armazena cabeçalhos/índices autenticados compactos mais o hash do corpo; a célula do corpo criptografado permanece no corpo da transação de publicação aceita e é reconstruída a partir do histórico de mensagens da TON, e depois verificada contra os hashes armazenados.

Toda publicação passa pelo Vault como uma mensagem externa assinada e custeada pelo saldo do Vault. O usuário primeiro deposita fundos em seu saldo
GRAM interno do Vault e, em seguida, o PWA assina uma solicitação de publicação com a `auth_pubkey` ativa; um relayer pode enviar a
mensagem externa sem deter a chave da carteira nem a chave de assinatura de mensagens. O conteúdo assinado é separado por domínio com `VPB1`,
`deployment_manifest_hash`, o endereço do Vault de destino e o tipo de publicação antes do proprietário, nonce, cobrança máxima e payload.
O valor GRAM que o CapsuleHub de fato devolve em um ACK ou bounce é creditado ao saldo GRAM interno do Vault do usuário,
limitado pelo valor de reembolso de publicação pendente rastreado. Se o saldo do Vault ou o acesso à cadeia não estiverem disponíveis, o
PWA falha de forma fechada e não deve expor ações de publicação.

Como a `auth_pubkey` autoriza o gasto do saldo do Vault, comprometer somente a chave local de assinatura de mensagens não autoriza
publicação no Vault, verificação de pagamento, nome de usuário ou ações de avatar. Um comprometimento da chave de assinatura de mensagens ainda pode afetar
assinaturas de identidade em nível de mensagem, então a substituição da chave revoga o antigo registro de chave pública de recebimento para verificações futuras de criptografia de entrada.

O cálculo de preços de mensagens do PWA é por cápsula. Com as reservas atuais e sem desconto de ATH, exemplos canônicos exatos são entradas públicas de 1 KiB a partir de `0.0337 GRAM` e cápsulas privadas `hybrid-v1` de 1 KiB
a partir de `0.0347 GRAM`; classes de tamanho público ou privado maiores custam mais por classe canônica. Isso inclui a taxa completa
de protocolo do Platho de `0.01 GRAM`, o aporte de armazenamento do índice compacto do CapsuleHub, a reserva de execução local do Vault e o
reembolso de ACK esperado. Separadamente, se a estimativa conservadora de taxa do PWA for maior que a franquia de taxa de rede
incluída de `0.005 GRAM`, ele adiciona
o excedente arredondado como sobretaxa. As chamadas de contrato ainda partem de seus valores canônicos
exigidos: as publicações do Vault enviam `maxCharge = canonical_max_charge + surcharge`. O CapsuleHub não tem ABI direta de publicação pelo usuário
na v1 final; toda publicação é Vault -> CapsuleHub. Os descontos de ATH se aplicam somente após o airdrop de atividade do Vault
ter distribuído 15.000.000 ATH; antes dessa etapa, as taxas de protocolo de mensagens usam a taxa completa de `0.01 GRAM`. O PWA deve mostrar a retenção
final e o custo líquido para o tamanho de conteúdo selecionado antes de assinar.

A sobretaxa é uma margem de segurança de rede/armazenamento assinada, não um fundo de taxa reembolsável. O CapsuleHub aceita publicações do Vault
quando o valor anexado é pelo menos o valor canônico exigido, mas um ACK de publicação bem-sucedido devolve apenas a reserva fixa
de ACK de publicação de `30,000,000` nanotons (`0.030 GRAM`). Depois que o Vault processa esse ACK, o usuário é creditado com aproximadamente
`25,800,000` nanotons no saldo GRAM interno do Vault. Qualquer sobretaxa assinada acima do valor canônico exigido permanece no
CapsuleHub como excedente de reserva de rede/armazenamento; ela não é devolvida ao Vault e não é contabilizada como
`accrued_plato_fee_ton`.

O CapsuleHub protege uma reserva bruta de GRAM igual a `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
A reserva ao vivo usa contadores não podados de entradas privadas/públicas em vez dos contadores históricos de `latest_id`. Uma chamada
`SweepExcessReserve` separada e sem permissão pode mover apenas o excedente acima desse valor protegido para o FeeAccumulator como
`DepositProtocolFee`, onde segue a divisão normal de tesouraria/buyback. O envio comum de mensagens não realiza esse
sweep. Se esse depósito de sweep sofrer bounce, o valor devolvido é intencionalmente reclassificado como `accrued_plato_fee_ton`
respaldado para que possa ser repetido pelo caminho normal de flush de taxas.
Chamadas parciais normais de `FlushFees` devem ser de pelo menos a taxa pública atual de protocolo (`0.010 GRAM`); um valor menor é
válido somente quando corresponde a todo o fundo acumulado restante, para que poeira com desconto ainda possa ser finalizada.

O CapsuleHub registra `created_at = now()` para cada entrada privada e pública. O PWA usa esse carimbo de tempo do contrato para ordenação e para busca limitada no histórico de transações; os carimbos de tempo dos cabeçalhos do cliente permanecem como metadados autenticados do payload, não autoridade de descoberta. Os metadados compactos de entrada podem ser podados sem permissão após a janela de retenção configurada de um ano, enquanto a disponibilidade do corpo depende da cobertura do histórico de mensagens do provedor TON escolhido e do cache criptografado local do usuário.

O saldo de ATH do Vault é creditado por meio de contabilização explícita por fluxo de notificação, não pela varredura do saldo bruto da carteira oficial.
O caminho de depósito suportado é o `ATHTransferRequestWithNotify` da ATHWallet do usuário para o Vault. A transferência manual comum de ATH
para a ATHWallet oficial do Vault não é suportada e não deve ser exibida como endereço de depósito nem tratada como
crédito no livro-razão do Vault. A retirada de ATH do Vault é um comando externo assinado do Vault. Sua reserva de
deploy/transferência/ACK da ATHWallet subsequente é paga a partir do saldo GRAM interno do Vault do usuário, e o Vault credita de volta apenas
o valor autenticado de ACK/falha/bounce que recebe, menos a reserva local de reembolso e limitado pelo valor interno reservado.

Posts e comentários públicos são um perfil aberto separado, não cápsulas privadas sem criptografia. Eles armazenam uma célula de cabeçalho
público `PPH1` compacta mais uma célula de corpo público bruto. O texto do corpo público e os bytes de imagem/avatar públicos usam as mesmas
classes de tamanho de cápsula pública de 1, 2, 4, 8, 16 ou 32 KiB do orçamento de corpo visível ao usuário. Os metadados do cabeçalho nunca reduzem
esse orçamento de corpo. Posts públicos não têm opção pós-quântica; o texto público usa o rótulo de produto `from 0.0337 GRAM`,
enquanto o exemplo público base exato atual é `0.0337 GRAM` mais a mesma
regra de sobretaxa de taxa de rede. `kind = 1` é um post público; o bit 0 dos `flags` do post fecha os comentários daquele post. `kind = 2` é
um comentário público de um nível com `parent_entry_id:uint64` e `parent_body_hash:uint256` no cabeçalho. `kind = 3` é um
post público de imagem, `kind = 4` é um comentário público de imagem, e `kind = 5` é mídia de avatar público da carteira. Os cabeçalhos públicos também carregam `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16` e `media_format:u8`; a v1 pública usa `media_format = 0` para texto e
`media_format = 1` para partes de imagem/avatar WebP. Os cabeçalhos de post público, post de imagem e avatar também carregam
`profile_version:uint32` e `avatar_hash:uint256`; zero significa nenhum ponteiro de avatar. Texto público longo ou dados de imagem são reconstruídos a partir de múltiplas entradas
somente depois que cada entrada tiver usado a menor classe de tamanho público que couber, até 32 KiB. O PWA oficial comprime as imagens selecionadas para alvos WebP de 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, padrão) ou 64 KiB (`maximum`) antes de dividi-las. Não há camada de edição/exclusão/reação/moderação nem de contadores na v1.

Avatares de carteira são atualizações de perfil pagas, não ativos off-chain. Os bytes do avatar são publicados como entradas públicas
`kind = 5` do CapsuleHub e, em seguida, o `ProfileRegistry` registra o ponteiro autenticado da carteira:
`version`, `avatar_hash`, primeiro `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count` e `media_format`. Os leitores
resolvem o ponteiro do perfil a partir do cabeçalho privado assinado ou do cabeçalho do post público, verificam o registro correspondente do ProfileRegistry,
buscam as entradas públicas do avatar no CapsuleHub, concatenam as partes na ordem de índice e exigem que os bytes WebP reconstruídos
tenham hash igual a `avatar_hash`. O cache local de avatar é apenas uma aceleração; a fonte de verdade é o CapsuleHub mais
o ProfileRegistry.

`header0_cell` armazena exatamente 140 bytes:

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

`header1_cell` armazena exatamente 30 bytes:

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` implicam a suite. `profile_version` e `avatar_hash` apontam para o avatar da carteira remetente no
momento do envio e são cobertos pelo hash do cabeçalho mais a assinatura do remetente. `recipient_sign_pubkey` e os hashes de thread são
intencionalmente não armazenados nas células de cabeçalho público. Os dados de thread/agrupamento pertencem aos metadados da cápsula criptografada.

Cada corpo criptografado é montado como:

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

O texto claro do AES-GCM é um slot fixo de cápsula selecionado por `size_class`:

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

A área de conteúdo útil é preenchida até a classe de cápsula privada selecionada de 1, 2, 4, 8, 16 ou 32 KiB. Uma mensagem com 1 byte, 500 bytes ou 1024 bytes de texto útil tem o mesmo tamanho de texto claro criptografado na classe de 1 KiB. Mensagens acima da classe selecionada são divididas em cápsulas independentes com metadados criptografados `stream_id`, `part_index` e `part_count`. Uma cápsula nunca mistura unidades de texto/imagem não relacionadas; o receptor remonta as cápsulas independentes de volta na mensagem original.

Tipos de conteúdo:

- `1` texto: bytes UTF-8, até o tamanho útil selecionado da cápsula privada.
- `2` imagem: bytes de imagem comprimida, até o tamanho útil selecionado da cápsula privada; `media_format` é `1` WebP, `2` AVIF, `3` JPEG ou `4` PNG.
- `3` verificação de pagamento: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Os corpos de verificação de pagamento intencionalmente não incluem `tx`, tempo de ativação nem expiração. O receptor resgata por `intent_id + secret32`; se o remetente já tiver cancelado a verificação ou ela já tiver sido resgatada, a interface informa que a verificação já foi resgatada ou cancelada pelo remetente.

O corpo criptografado pode ser envolvido para exportação/compartilhamento como:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Para o corpo final da cápsula, `chunk_total` é sempre `1`. `PLC1` é apenas um envelope de empacotamento/exportação. A transação de publicação aceita Vault -> CapsuleHub carrega os bytes montados do corpo `PLB1` em uma célula snake; o CapsuleHub persiste apenas metadados autenticados compactos e hashes.

Limites privados finais da v1:

| Suite | Limite útil por cápsula | Bytes do corpo | Bytes do chunk de exportação |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

A fonte canônica para este layout é `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

O AES-GCM usa um nonce de 12 bytes e uma tag de 16 bytes. O comprimento do texto cifrado é igual ao comprimento do texto claro mais a tag.

O prefixo compacto do corpo, `header0Hash` e `header1Hash` são passados como dados autenticados adicionais do AES-GCM. Alterar os cabeçalhos binários de roteamento, a suite, o nonce, o texto cifrado do KEM, os bytes do chunk ou a assinatura do remetente faz a verificação ou a descriptografia falhar.

Antes da descriptografia, o cliente também verifica:

- se a suite do corpo compacto corresponde ao `header0`;
- se o id da chave do destinatário corresponde a `header0.recipientKeyId`;
- se os corpos `hybrid-v1` de fato carregam um texto cifrado ML-KEM de 1088 bytes;
- se todo chunk tem a mesma suite, id de mensagem e total de chunks.

## Derivação de chaves

Para `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

O texto claro é criptografado com AES-256-GCM.

A implementação rejeita segredos compartilhados X25519 totalmente nulos para evitar aceitar chaves públicas de ordem baixa.

## Cápsulas privadas criptografadas

O cliente envolve corpos criptografados compactos em uma cápsula privada antes da publicação. Uma cápsula privada tem:

- `header0`: o cabeçalho binário de roteamento `PH0B` de 140 bytes descrito acima.
- `header1`: o cabeçalho binário de replay `PH1B` de 30 bytes descrito acima.
- `body`: metadados de chunk `platho.byte-layout.v1` mais chunks binários codificados em base64url.
- `hashes`: valores `Cell.hash()` da TON para as células on-chain exatas que contêm `header0`, `header1` e os bytes do corpo criptografado.
- `chainCells`: payloads BOC em base64 usando `ton-snake-byte-cell.v1`; estas são as células aceitas na transação de publicação Vault -> CapsuleHub e autenticadas pelo `CapsuleHub`, não um ponteiro off-chain.
- `senderSignature`: assinatura Ed25519 sobre o id da cápsula e os três hashes.

Para `hybrid-v1`, a cápsula usa o perfil híbrido do CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

O rascunho da cápsula privada é mapeado para o corpo `PublishPrivateFromVault` Vault -> CapsuleHub depois que a solicitação externa
assinada `PublishPrivateFromVaultBalance` é aceita pelo Vault:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

As mensagens de publicação do Vault carregam `protocol_fee_paid`, porque o Vault é a autoridade de desconto para o cálculo de preços respaldado por ATH.

A capacidade útil de payload é a capacidade dos bytes do corpo criptografado que são de fato serializados em `body_cell` e aceitos pelo `CapsuleHub`. Um hash sem o corpo correspondente da transação de publicação aceita não é uma mensagem v1 legível. O histórico local é apenas cache; ele não define a entrega na v1.

Para a assinatura de publicação externa do Vault, a ordem das referências de hash permanece compatível com o contrato:

```text
body_hash || header_0_hash || header_1_hash
```

O corpo compacto é vinculado a `header0Hash` e `header1Hash` por meio do AAD do AES-GCM. Substituir cabeçalhos, chunks do corpo, metadados da suite, assinatura do remetente, contexto da cápsula ou as células do payload BOC faz a verificação falhar antes de a mensagem ser aceita.

## Fonte de verdade da entrega

As mensagens privadas v1 aceitas são entradas compactas do CapsuleHub mais as células de payload criptografado carregadas pelo corpo da transação de publicação aceita. O PWA recupera essas células do histórico de mensagens da TON e as verifica contra os hashes do CapsuleHub antes de descriptografar. O PWA de produção não expõe a troca manual de pacotes JSON de pacote público ou de cápsula criptografada.

As chaves públicas de mensagens são registradas nos registros de chave do `Vault`. Um remetente deve resolver e verificar o registro de chave do destinatário antes de criptografar uma cápsula privada. O histórico criptografado local é apenas um cache do dispositivo; ele não define a entrega.

A autoridade de nome de usuário `.ath` tem duas partes. `UsernameRegistry.get_name_record` prova que um nome existe e aponta para o
`UsernameNFTItem` exato daquele nome. O proprietário atual é então lido a partir do estado desse item. As transferências mudam o proprietário
do item; o registro do registrador permanece como a âncora nome-para-item. O item expõe os dados NFT padrão e os metadados on-chain TEP-64,
incluindo `name = <username>.ath`, sem uma URI de metadados hospedada em servidor. Os bytes de nome de usuário da V1 são deliberadamente
literais: nomes que começam, terminam, têm separadores consecutivos ou são formados apenas por separadores são válidos quando cada byte está no conjunto permitido `a-z`,
`0-9`, `_`, `-` e o comprimento está em 4..16. Se um mint pendente ficar obsoleto após
um ACK de item ausente, `PrunePendingUsernameMint` é não destrutivo na v1: ele prova a condição obsoleta, mas não exclui
o estado pendente nem cria reembolso devido. Um item implantado só se torna um nome de usuário autoritativo depois que o registrador finaliza
o registro de nome correspondente por meio de um ACK tardio válido ou de `ResendDeployedAck`. Clientes e indexadores devem ignorar reivindicações
de propriedade somente do item e não devem usar o proprietário do registro do registrador como o proprietário atual após as transferências.

A frase de recuperação GRAM de 24 palavras é o único segredo do usuário. O PWA deriva de forma determinística a chave da carteira GRAM e as chaves de criptografia/assinatura de mensagens a partir dessa frase. O fluxo de exportação/importação de perfil, portanto, lida apenas com a frase de recuperação; não há backup separado da chave de mensagens.

## Política de replay e expiração

As cápsulas privadas têm por padrão um TTL de 24 horas e são limitadas a 30 dias. A verificação de pacotes de cápsulas ao vivo/off-chain rejeita:

- cápsulas criadas em um futuro distante demais;
- cápsulas expiradas;
- TTLs acima do limite da política;
- ids de cápsula duplicados no cache de replay fornecido pelo chamador.

A importação do histórico da cadeia é diferente: quando uma entrada privada já foi aceita pelo CapsuleHub e o corpo é recuperado do
histórico de transações aceito da TON ou do cache criptografado local, o PWA verifica os hashes da entrada, as células de corpo/cabeçalho e a
descriptografia, mas não a rejeita apenas porque a expiração do cabeçalho está no passado. Caso contrário, o histórico retido da cadeia
se tornaria ilegível por design.

O cache de replay é estado local; clientes de produção podem respaldá-lo com IndexedDB ou outro armazenamento local do dispositivo. Nenhum backend é necessário.

## Regra de ausência de backend

A camada de criptografia não requer um backend do Platho. Um servidor pode hospedar arquivos estáticos, mas a entrega privada é ancorada pelo estado de cadeia do `CapsuleHub` mais os corpos das transações de publicação aceitas: a entrada compacta prova os hashes, e o corpo ainda deve estar disponível a partir do histórico de mensagens da TON ou do cache criptografado local do usuário. O servidor nunca recebe texto claro, chaves privadas nem um segredo de sessão do lado do servidor.

## Rascunho de registro no Vault

O cliente pode derivar um rascunho de `RegisterMessagingKeys` a partir de um pacote assinado verificado:

- `enc_pubkey`: chave pública X25519 de 32 bytes como uint256.
- `sign_pubkey`: chave pública de assinatura Ed25519 de 32 bytes como uint256.
- `auth_pubkey`: chave pública de autenticação do Vault Ed25519 separada de 32 bytes como uint256.
- `pq_kem_pubkey_hash`: SHA-256 da chave pública ML-KEM-768.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: célula snake canônica contendo exatamente 1184 bytes da chave pública ML-KEM-768.
- `crypto_suite_mask`: `2` para `hybrid-v1`.

Este rascunho é submetido pelo fluxo de ativação da carteira Platho embutida. Uma vez que a carteira é ativada no Vault, outros usuários ativados podem resolver seu registro de chave pública de mensagens e criptografar cápsulas privadas para ela.

## Vinculação do registro de chave do Vault

Depois que a carteira registrou chaves on-chain, o cliente deve buscar:

- o `UserState.current_key_id` da carteira;
- para a própria carteira desbloqueada do usuário, o `UserState.auth_pubkey` correspondente à chave pública de autenticação do Vault derivada localmente;
- o `VaultKeyRecordView` para esse id de chave.

O PWA expõe isso como uma ponte de provedor que falha de forma fechada em `web/vault-chain-provider.mjs`. A ponte espera um provedor com:

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Se nenhum provedor estiver configurado, a vinculação do Vault permanece indisponível em vez de aceitar um rascunho local ou um marcador de interface. Uma implantação de produção/estática pode instalar um provedor em `globalThis.plathoVaultChainProvider` que leia o Vault implantado por meio de um espelho de API da TON ou de um transporte compatível com light-client.

O runtime estático inclui `web/vault-ton-rpc-provider.mjs` como o esqueleto do provedor de produção. Ele pode envolver endpoints compatíveis com TON Center v3 ou um `globalThis.plathoTonRpcTransport` personalizado instalado pelo bundle do host. O PWA atual não expõe uma tela interna de configurações de RPC do usuário; se a documentação afirmar RPC escolhido pelo usuário, essa interface deve existir. O provedor:

- codifica os endereços de proprietário de `get_user(owner)` como itens de pilha `slice` em BoC;
- chama `get_key_record(current_key_id)` com um item de pilha numérico;
- decodifica as pilhas dos getters em `VaultUserView` e `VaultKeyRecordView`;
- falha de forma fechada se o transporte RPC, o endereço do Vault, a resposta do getter ou a vinculação do registro de chave estiverem indisponíveis.

O verificador do lado do cliente confere se o registro ativo do Vault corresponde ao pacote assinado verificado:

- `owner_wallet` corresponde ao endereço da carteira Platho embutida;
- `enc_pubkey` corresponde à chave pública X25519;
- `sign_pubkey` corresponde à chave pública de assinatura do pacote;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash` e `pq_kem_pubkey_len` correspondem ao material ML-KEM-768;
- `crypto_suite_mask` corresponde à suite;
- `revoked_lt` é zero;
- opcionalmente, `current_key_id` aponta para o id do registro buscado.

O cliente não inventa o id de chave on-chain. O Vault o calcula a partir do endereço do proprietário, da geração de chaves, dos campos de chave, do comprimento PQ e da suite. O cliente verifica o registro buscado em vez disso.

## Armazenamento durável de replay

O PWA usa IndexedDB para proteção contra replay de cápsulas privadas quando disponível, com um fallback em memória. O armazenamento mantém os ids das cápsulas até a expiração da cápsula e poda as entradas expiradas localmente. Este é estado local do dispositivo e não requer um servidor.

## Histórico criptografado local de mensagens

O PWA também possui um armazenamento criptografado local de histórico de mensagens no dispositivo. Ele usa uma chave AES-GCM-256 do WebCrypto não extraível salva no IndexedDB e armazena todo corpo de mensagem como texto cifrado autenticado. O cabeçalho do registro mantém apenas metadados locais de consulta: id, id de thread, carimbo de tempo, direção e id opcional de cápsula.

O cabeçalho é vinculado como dados autenticados adicionais do AES-GCM. Alterar o id de thread, o carimbo de tempo, a direção, o id de cápsula, o nonce ou o texto cifrado impede que o registro seja aberto. Se o IndexedDB estiver indisponível, o aplicativo recorre a um histórico criptografado em memória para aquela sessão e evita gravar texto claro no armazenamento persistente do navegador.

## Status de produção

O caminho de lançamento em mainnet usa derivação de carteira GRAM embutida, chaves de mensagens ancoradas no Vault, validação de pacote assinado, vinculação de cadeia do Vault que falha de forma fechada, hashing de células de cápsula privada, assinaturas do remetente, armazenamento durável de replay, histórico criptografado local de mensagens e exportação/importação da frase de recuperação. A implantação de produção deve manter a configuração do PWA fixada ao manifesto verificado de mainnet e aos provedores RPC da TON aprovados; a revisão criptográfica independente continua recomendada para garantia de longo prazo.
