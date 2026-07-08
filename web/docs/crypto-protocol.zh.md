# Platho 消息加密协议

本文档描述静态 PWA 原型所实现的客户端消息加密。

## 加密套件

| 套件 | 合约取值 | 用途 |
| --- | ---: | --- |
| `hybrid-v1` | `2` | 使用 X25519 加 ML-KEM-768 加 AES-GCM 的私密消息。 |

V1 私密发布仅接受 `CRYPTO_SUITE_HYBRID = 2`。

## 密钥包

由 PWA 创建或导入的每一条 24 词 GRAM 恢复助记词，都会确定性地派生出一个消息身份，其中包含一对加密密钥和一个 Ed25519 签名密钥。公开的加密密钥材料以公钥包的形式导出：

- `keyId`：基于公钥材料的 SHA-256 标识符。
- `x25519PublicKey`：32 字节的经典 ECDH 公钥。
- `mlKem768PublicKey`：用于 `hybrid-v1` 的 1184 字节 ML-KEM-768 公钥。
- `mlKem768PublicKeyHash`：ML-KEM-768 公钥的 SHA-256。
- `mlKem768PublicKeyLen`：对于 `hybrid-v1` 始终为 `1184`。

PWA 在加密前会重新计算 `keyId`、`mlKem768PublicKeyHash` 和 `mlKem768PublicKeyLen`。若某个密钥包声称的 id、套件、合约套件、哈希或长度不匹配，则该密钥包会被拒绝。

接收方查找由链上的 `enc_pubkey`、`sign_pubkey` 以及存储在当前生效 Vault 密钥记录中的完整链上 `pq_kem_pubkey` 单元定义。哈希和长度作为紧凑的绑定字段保留在记录中，但真正能让另一个客户端加密 `hybrid-v1` 胶囊的，是完整的 ML-KEM-768 公钥。

## 签名密钥包

PWA 可以导出经过签名的公钥包。被签名的载荷包括：

- 协议域 `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`；
- 签发时间戳和可选的过期时间戳；
- 可选的所有者钱包和 Vault 地址占位符；
- 公开加密密钥包；
- 32 字节的 Ed25519 签名公钥。

签名覆盖稳定的 JSON 载荷，并在信任密钥包之前进行验证。这可防止本地密钥包被静默篡改，并为客户端提供 Vault 存储在 `KeyRecord` 中的确切 `sign_pubkey`。

PWA 的 `keyId` 是一个客户端密钥包标识符。它并不替代 Vault 合约的 `current_key_id`——后者是在链上根据所有者地址、密钥代次、签名密钥、加密密钥、PQ 哈希、PQ 长度和加密套件计算得出的。生产客户端在将某个密钥包作为钱包身份信任之前，必须将其与 Vault 密钥记录核验。

签名密钥包是一份消息密钥自签名。钱包所有权由 Vault 激活来锚定：内嵌的 Platho 钱包发送 `RegisterMessagingKeys`，之后的 `ReplaceMessagingKeys` 轮换是经 Vault 授权签名的外部消息，接收方则将签名密钥包与该钱包当前生效的链上密钥记录进行核验。

## 钱包所有权

生产版 PWA 不使用外部钱包连接器。用户创建或导入一条普通的 24 词 GRAM 恢复助记词，PWA 便从该助记词
确定性地派生出 GRAM 钱包密钥、一个独立的 Vault 授权密钥，以及消息加密/签名密钥。Vault
激活是所有权锚点：内嵌钱包从拥有该链上密钥记录的同一钱包签名并发送 `RegisterMessagingKeys`。
`ReplaceMessagingKeys` 仅轮换公开的接收/消息密钥记录；它不会轮换 Vault 授权密钥。

接收方只有在将消息密钥包与该钱包当前生效的 Vault 密钥记录核对之后，才会信任它：

- 记录所有者是预期的钱包；
- `enc_pubkey` 和 `sign_pubkey` 与签名密钥包匹配；
- hybrid 记录暴露完整的 `pq_kem_pubkey` 单元，而不仅是其哈希；
- 解码后的 ML-KEM-768 密钥字节哈希等于 `pq_kem_pubkey_hash`；
- 生效的 `current_key_id` 指向已核验的密钥记录。

个人资料导出/导入流程处理这条 24 词 GRAM 恢复助记词。在最终版 v1 中没有单独的消息密钥备份，也没有
外部钱包连接模式。

## 紧凑字节布局

私密胶囊的链上单元采用最终版 `platho.byte-layout.v1` 二进制布局。PWA 可以将胶囊包裹在 JSON 中用于导出/分享界面，但协议载荷是二进制字节，而非 JSON，也不是链下指针。`CapsuleHub` 存储紧凑的经认证的头部/索引以及消息体哈希；加密后的消息体单元保留在已被接受的发布交易体中，之后从 TON 消息历史中重建，再对照存储的哈希进行验证。

每一次发布都通过 Vault、以 Vault 余额出资的签名外部消息形式进行。用户先为自己的内部
Vault GRAM 余额充值，然后 PWA 用生效的 `auth_pubkey` 对发布请求进行签名；中继方无需持有钱包密钥或消息签名密钥即可提交该
外部消息。签名载荷通过 `VPB1`、
`deployment_manifest_hash`、目标 Vault 地址以及发布类型进行域分隔，随后是所有者、nonce、最大扣费额和载荷。
CapsuleHub 在 ACK 或退回（bounce）中实际返还的 GRAM 值，会记入用户内部 Vault GRAM
余额，上限为所跟踪的待处理发布退款额。若 Vault 余额或链访问不可用，
PWA 会失败关闭（fail closed），且不得暴露发布操作。

由于 `auth_pubkey` 授权 Vault 余额的支出，单独攻破本地消息签名密钥并不能授权
Vault 的发布、付款核验、用户名或头像操作。消息签名密钥被攻破仍可能影响消息级别的
身份签名，因此密钥替换会撤销旧的公开接收密钥记录，使其在未来的入站加密核验中失效。

PWA 的消息定价按胶囊计。在当前储备且无 ATH 折扣的情况下，确切的规范示例为：1 KiB 公开条目起价 `0.0337 GRAM`，`hybrid-v1` 1 KiB 私密
胶囊起价 `0.0347 GRAM`；更大的公开或私密尺寸类别按其规范类别收取更高费用。这已包含完整的
Platho 协议费 `0.01 GRAM`、CapsuleHub 紧凑索引存储捐赠、Vault 本地执行储备，以及
预期的 ACK 退款。此外，若 PWA 保守的费用估算高于已包含的网络费
额度 `0.005 GRAM`，则会将
向上取整的超出部分作为附加费加上。合约调用仍从其规范
所需值起算：Vault 发布发送 `maxCharge = canonical_max_charge + surcharge`。在最终版 v1 中，CapsuleHub 没有面向用户的直接
发布 ABI；每一次发布都是 Vault -> CapsuleHub。ATH 折扣仅在 Vault 活动空投
已分发 15,000,000 ATH 之后才生效；在该门槛之前，消息协议费使用完整的 `0.01 GRAM` 费用。PWA 必须在签名前显示所选内容尺寸的最终
持有额和净成本。

附加费是一份签名的网络/存储安全边际，而非可退款的费用桶。当附带的价值至少达到规范所需值时，CapsuleHub 会接受
Vault 发布，但一次成功的发布 ACK 只返还固定的
发布 ACK 储备 `30,000,000` nanotons（`0.030 GRAM`）。Vault 处理该 ACK 之后，用户在内部 Vault GRAM 余额中获记约
`25,800,000` nanotons。任何超出规范所需值的签名附加费都会作为网络/存储储备盈余留在
CapsuleHub 中；它不会返还给 Vault，也不计入
`accrued_plato_fee_ton`。

CapsuleHub 保护的原始 GRAM 储备等于 `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`。
该实时储备使用未修剪的私密/公开条目计数器，而非历史 `latest_id` 计数器。一个独立的
无需许可的 `SweepExcessReserve` 调用只能将超出该受保护额度的盈余转入 FeeAccumulator，作为
`DepositProtocolFee`，随后遵循正常的国库/回购拆分。普通的消息发送不会执行这次
清扫。若该清扫存款退回，返还的金额会被有意重新归类为有支撑的
`accrued_plato_fee_ton`，以便通过正常的费用冲刷路径重试。
普通的部分 `FlushFees` 调用必须至少达到当前的公开协议费（`0.010 GRAM`）；更小的金额
仅当它是全部剩余累积桶时才有效，这样打折后的零头也能被最终确定。

CapsuleHub 为每一条私密和公开条目记录 `created_at = now()`。PWA 使用该合约时间戳进行排序以及有界的交易历史查找；客户端头部时间戳仍是经认证的载荷元数据，而非发现权威。紧凑条目元数据可在配置的一年保留窗口后被无需许可地修剪，而消息体的可用性取决于所选 TON 提供方的消息历史覆盖范围以及用户的本地加密缓存。

Vault 的 ATH 余额通过显式的通知流（notify-flow）记账来入账，而非通过扫描官方钱包的原始余额。
受支持的存款路径是用户的 ATHWallet 向 Vault 发送 `ATHTransferRequestWithNotify`。手动向官方 Vault ATHWallet 进行普通 ATH
转账不受支持，且不得显示为存款地址，也不得视为
Vault 账本入账。从 Vault 提取 ATH 是一条签名的外部 Vault 命令。其下游 ATHWallet
的部署/转账/ACK 储备由用户的内部 Vault GRAM 余额支付，Vault 只会返还其收到的
经认证的 ACK/失败/退回价值，减去本地退款储备，并以预留的内部价值为上限。

公开帖子和评论是一个独立的开放个人资料，而非未加密的私密胶囊。它们存储一个紧凑的
`PPH1` 公开头部单元加一个原始公开消息体单元。公开消息体文本和公开图片/头像字节使用与用户可见消息体预算相同的
1、2、4、8、16 或 32 KiB 公开胶囊尺寸类别。头部元数据绝不会削减
该消息体预算。公开帖子没有后量子选项；公开文案使用 `from 0.0337 GRAM` 产品标签，
而当前确切的公开基础示例为 `0.0337 GRAM` 加上相同的
网络费附加费规则。`kind = 1` 是公开帖子；帖子 `flags` 的第 0 位为该帖子关闭评论。`kind = 2` 是
一条单层公开评论，头部中带有 `parent_entry_id:uint64` 和 `parent_body_hash:uint256`。`kind = 3` 是
公开图片帖子，`kind = 4` 是公开图片评论，`kind = 5` 是公开钱包头像媒体。公开头部还携带 `stream_id:uint128`、
`part_index:uint16`、`part_count:uint16` 和 `media_format:u8`；公开 v1 对文本使用 `media_format = 0`，对
WebP 图片/头像分片使用 `media_format = 1`。公开帖子、图片帖子和头像头部还携带
`profile_version:uint32` 和 `avatar_hash:uint256`；零表示没有头像指针。较长的公开文本或图片数据只有在每一条条目都使用了直至 32 KiB 的最小适配公开尺寸类别之后，
才会从多条条目中重建。官方 PWA 在拆分之前会将所选图片压缩为 8 KiB
（`low`）、16 KiB（`medium`）、32 KiB（`good`，默认）或 64 KiB（`maximum`）的 WebP 目标。在 v1 中没有编辑/删除/反应/审核层或计数器层。

钱包头像是付费的个人资料更新，而非链下资产。头像字节作为 `kind = 5` 公开
CapsuleHub 条目发布，随后 `ProfileRegistry` 记录经认证的钱包指针：
`version`、`avatar_hash`、首个 `avatar_entry_id`、`avatar_stream_id`、`avatar_part_count` 和 `media_format`。读取方
从签名的私密头部或公开帖子头部解析个人资料指针，验证匹配的 ProfileRegistry
记录，从 CapsuleHub 获取头像公开条目，按索引顺序拼接各分片，并要求重建的
WebP 字节哈希等于 `avatar_hash`。本地头像缓存只是一种加速手段；真实来源是 CapsuleHub 加
ProfileRegistry。

`header0_cell` 恰好存储 140 字节：

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

`header1_cell` 恰好存储 30 字节：

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` 隐含了套件。`profile_version` 和 `avatar_hash` 指向发送时刻的发送方钱包头像，
并由头部哈希加发送方签名覆盖。`recipient_sign_pubkey` 和线程哈希被
有意不存储在公开头部单元中。线程/分组数据属于加密胶囊元数据内部。

每一段加密消息体按如下方式组装：

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

AES-GCM 明文是由 `size_class` 选定的一个固定胶囊槽：

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

有效内容区被填充至所选的 1、2、4、8、16 或 32 KiB 私密胶囊类别。一条含 1 字节、500 字节或 1024 字节有效文本的消息，在 1 KiB 类别中具有相同的加密明文大小。超出所选类别的消息会被拆分为多个独立胶囊，并带有加密的 `stream_id`、`part_index` 和 `part_count` 元数据。一个胶囊绝不会混合互不相关的文本/图片单元；接收方将各独立胶囊重新组装回原始消息。

内容类型：

- `1` 文本：UTF-8 字节，直至所选的有效私密胶囊尺寸。
- `2` 图片：压缩后的图片字节，直至所选的有效私密胶囊尺寸；`media_format` 为 `1` WebP、`2` AVIF、`3` JPEG 或 `4` PNG。
- `3` 付款核验：`asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`。

付款核验消息体有意不包含 `tx`、激活时间或过期时间。接收方通过 `intent_id + secret32` 领取；若发送方已取消该核验或它已被领取，界面会提示该核验已被发送方领取或取消。

加密消息体可被包裹以用于导出/分享，格式为：

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

对于最终的胶囊消息体，`chunk_total` 始终为 `1`。`PLC1` 仅是打包/导出封装。被接受的 Vault -> CapsuleHub 发布交易在一个 snake 单元中携带组装好的 `PLB1` 消息体字节；CapsuleHub 只持久化紧凑的经认证元数据和哈希。

最终版 v1 私密限制：

| 套件 | 每胶囊有效上限 | 消息体字节 | 导出分块字节 |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

该布局的规范来源是 `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`。

AES-GCM 使用 12 字节 nonce 和 16 字节 tag。密文长度等于明文长度加上 tag。

紧凑消息体前缀、`header0Hash` 和 `header1Hash` 作为 AES-GCM 附加认证数据传入。更改二进制路由头部、套件、nonce、KEM 密文、分块字节或发送方签名会使验证或解密失败。

在解密之前，客户端还会检查：

- 紧凑消息体套件与 `header0` 匹配；
- 接收方密钥 id 与 `header0.recipientKeyId` 匹配；
- `hybrid-v1` 消息体确实携带 1088 字节的 ML-KEM 密文；
- 每个分块具有相同的套件、消息 id 和分块总数。

## 密钥派生

对于 `hybrid-v1`：

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

明文使用 AES-256-GCM 加密。

该实现拒绝全零的 X25519 共享密钥，以避免接受低阶公钥。

## 私密加密胶囊

客户端在发布前将紧凑的加密消息体包裹进一个私密胶囊。一个私密胶囊包含：

- `header0`：上文所述的 140 字节 `PH0B` 二进制路由头部。
- `header1`：上文所述的 30 字节 `PH1B` 二进制防重放头部。
- `body`：`platho.byte-layout.v1` 分块元数据加 base64url 编码的二进制分块。
- `hashes`：包含 `header0`、`header1` 和加密消息体字节的确切链上单元的 TON `Cell.hash()` 值。
- `chainCells`：使用 `ton-snake-byte-cell.v1` 的 base64 BOC 载荷；这些是在 Vault -> CapsuleHub 发布交易中被接受、并由 `CapsuleHub` 认证的单元，而非链下指针。
- `senderSignature`：对胶囊 id 和全部三个哈希的 Ed25519 签名。

对于 `hybrid-v1`，胶囊使用 CapsuleHub 的 hybrid 配置：

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

在签名的 `PublishPrivateFromVaultBalance` 外部请求被 Vault 接受之后，私密胶囊草稿映射到 Vault -> CapsuleHub 的 `PublishPrivateFromVault`
消息体：

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Vault 发布消息携带 `protocol_fee_paid`，因为 Vault 是 ATH 支撑定价的折扣权威。

有效载荷容量是实际被序列化进 `body_cell` 并被 `CapsuleHub` 接受的加密消息体字节的容量。没有匹配的被接受发布交易体的哈希，并不是一条可读的 v1 消息。本地历史仅为缓存；在 v1 中它并不定义投递。

对于 Vault 外部发布签名，哈希引用顺序仍与合约兼容：

```text
body_hash || header_0_hash || header_1_hash
```

紧凑消息体通过 AES-GCM AAD 绑定到 `header0Hash` 和 `header1Hash`。替换头部、消息体分块、套件元数据、发送方签名、胶囊上下文或 BOC 载荷单元，会在消息被接受之前使验证失败。

## 投递真实来源

被接受的 v1 私密消息是紧凑的 CapsuleHub 条目加上由被接受发布交易体携带的加密载荷单元。PWA 从 TON 消息历史中检索这些单元，并在解密前对照 CapsuleHub 哈希进行验证。生产版 PWA 不暴露手动的公钥包或加密胶囊 JSON 包交换。

公开消息密钥注册在 `Vault` 密钥记录中。发送方在加密私密胶囊之前必须解析并验证接收方密钥记录。本地加密历史只是设备缓存；它并不定义投递。

`.ath` 用户名权威分为两部分。`UsernameRegistry.get_name_record` 证明某个名称存在，并指向
该名称确切的 `UsernameNFTItem`。当前所有者随后从该 item 状态中读取。转让会更改 item
所有者；注册表记录仍是名称到 item 的锚点。该 item 暴露标准 NFT 数据和 TEP-64 链上
元数据，包括 `name = <username>.ath`，且无需服务器托管的元数据 URI。V1 用户名字节被有意设为
字面：当每个字节都在允许的 `a-z`、
`0-9`、`_`、`-` 集合内且长度为 4..16 时，前导、尾随、连续以及全分隔符的名称均有效。若某个待处理铸造在
缺失 item ACK 后变得陈旧，`PrunePendingUsernameMint` 在 v1 中是非破坏性的：它证明陈旧条件，但不会删除
待处理状态或产生应退款项。一个已部署的 item 只有在注册表通过有效的迟到 ACK 或 `ResendDeployedAck` 最终确定
匹配的名称记录之后，才会成为权威用户名。客户端和索引器必须忽略仅 item 层面的
所有权声明，并且在转让之后不得将注册表记录所有者用作当前所有者。

24 词 GRAM 恢复助记词是唯一的用户机密。PWA 从该助记词确定性地派生 GRAM 钱包密钥和消息加密/签名密钥。因此个人资料导出/导入流程只处理恢复助记词；没有单独的消息密钥备份。

## 防重放与过期策略

私密胶囊默认 24 小时 TTL，上限为 30 天。实时/链下胶囊包验证会拒绝：

- 创建时间在未来过远的胶囊；
- 已过期的胶囊；
- 高于策略上限的 TTL；
- 调用方提供的防重放缓存中的重复胶囊 id。

链历史导入则不同：当一条私密条目已被 CapsuleHub 接受，且消息体从
被接受的 TON 交易历史或本地加密缓存中恢复时，PWA 会验证条目哈希、消息体/头部单元和
解密，但不会仅因头部过期时间已过而拒绝。否则被保留的链历史将按设计
变得不可读。

防重放缓存是本地状态；生产客户端可以用 IndexedDB 或其他设备本地存储作为其后盾。无需任何后端。

## 无后端规则

加密层不需要 Platho 后端。服务器可以托管静态文件，但私密投递由 `CapsuleHub` 链状态加被接受的发布交易体锚定：紧凑条目证明哈希，而消息体仍必须可从 TON 消息历史或用户的本地加密缓存中获得。服务器绝不会收到明文、私钥或服务器端会话机密。

## Vault 注册草稿

客户端可以从一个已验证的签名密钥包派生出 `RegisterMessagingKeys` 草稿：

- `enc_pubkey`：32 字节 X25519 公钥，作为 uint256。
- `sign_pubkey`：32 字节 Ed25519 签名公钥，作为 uint256。
- `auth_pubkey`：独立的 32 字节 Ed25519 Vault 授权公钥，作为 uint256。
- `pq_kem_pubkey_hash`：ML-KEM-768 公钥的 SHA-256。
- `pq_kem_pubkey_len`：`1184`。
- `pq_kem_pubkey`：恰好包含 1184 字节 ML-KEM-768 公钥的规范 snake 单元。
- `crypto_suite_mask`：对于 `hybrid-v1` 为 `2`。

该草稿由内嵌的 Platho 钱包激活流程提交。一旦钱包在 Vault 中激活，其他已激活用户便可解析其公开消息密钥记录，并向其加密私密胶囊。

## Vault 密钥记录绑定

在钱包已在链上注册密钥之后，客户端必须获取：

- 钱包的 `UserState.current_key_id`；
- 对于用户自己已解锁的钱包，与本地派生的 Vault 授权公钥匹配的 `UserState.auth_pubkey`；
- 该密钥 id 对应的 `VaultKeyRecordView`。

PWA 在 `web/vault-chain-provider.mjs` 中将其暴露为一个失败关闭的提供方桥接。该桥接期望一个具备以下方法的提供方：

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

若未配置提供方，Vault 绑定保持不可用，而不是接受本地草稿或 UI 占位符。生产/静态部署可以在 `globalThis.plathoVaultChainProvider` 上安装一个提供方，通过 TON API 镜像或轻客户端兼容传输读取已部署的 Vault。

静态运行时包含 `web/vault-ton-rpc-provider.mjs` 作为生产提供方骨架。它可以封装 TON Center v3 兼容端点或由宿主 bundle 安装的自定义 `globalThis.plathoTonRpcTransport`。当前 PWA 不暴露内置的用户 RPC 设置界面；若文档声称由用户选择 RPC，则该 UI 必须存在。该提供方：

- 将 `get_user(owner)` 的所有者地址编码为 `slice` BoC 栈项；
- 以数值栈项调用 `get_key_record(current_key_id)`；
- 将 getter 栈解码为 `VaultUserView` 和 `VaultKeyRecordView`；
- 若 RPC 传输、Vault 地址、getter 响应或密钥记录绑定不可用，则失败关闭。

客户端验证器检查生效的 Vault 记录与已验证的签名密钥包是否匹配：

- `owner_wallet` 与内嵌的 Platho 钱包地址匹配；
- `enc_pubkey` 与 X25519 公钥匹配；
- `sign_pubkey` 与密钥包签名公钥匹配；
- `pq_kem_pubkey`、`pq_kem_pubkey_hash` 和 `pq_kem_pubkey_len` 与 ML-KEM-768 材料匹配；
- `crypto_suite_mask` 与套件匹配；
- `revoked_lt` 为零；
- 可选的 `current_key_id` 指向所获取的记录 id。

客户端不会凭空生成链上密钥 id。Vault 根据所有者地址、密钥代次、密钥字段、PQ 长度和套件计算它。客户端转而验证所获取的记录。

## 持久防重放存储

PWA 在可用时使用 IndexedDB 进行私密胶囊防重放保护，并带有内存回退。该存储保留胶囊 id 直至其胶囊过期，并在本地修剪已过期条目。这是设备本地状态，无需服务器。

## 加密的本地消息历史

PWA 还有一个设备本地的加密消息历史存储。它使用保存在 IndexedDB 中的不可导出 WebCrypto AES-GCM-256 密钥，并将每条消息体存储为经认证的密文。记录头部只保留本地查询元数据：id、线程 id、时间戳、方向和可选的胶囊 id。

头部被绑定为 AES-GCM 附加认证数据。更改线程 id、时间戳、方向、胶囊 id、nonce 或密文会使该记录无法打开。若 IndexedDB 不可用，应用会为该会话回退到加密的内存历史，并避免向持久化的浏览器存储写入明文。

## 生产状态

主网发布路径使用内嵌 GRAM 钱包派生、以 Vault 锚定的消息密钥、签名密钥包验证、失败关闭的 Vault 链绑定、私密胶囊单元哈希、发送方签名、持久防重放存储、加密的本地消息历史，以及恢复助记词导出/导入。生产部署必须将 PWA 配置固定到已验证的主网清单和已批准的 TON RPC 提供方；为长期保障，仍建议进行独立的加密审查。
