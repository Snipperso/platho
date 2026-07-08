# Platho 消息加密协议

本文档描述 Platho PWA 实现的客户端消息加密。

## 加密

私密消息使用 X25519 + ML-KEM-768 + AES-GCM —— 唯一的私密消息套件（`hybrid-v1`，合约取值 `2`）。

## 密钥捆绑包

由 PWA 创建或导入的每一份 24 词 GRAM 恢复短语都会确定性地派生出一个消息身份，其中包含一对加密密钥和一个 Ed25519 签名密钥。公开的加密密钥材料会以公钥捆绑包的形式导出：

- `keyId`：基于 SHA-256、对公钥材料计算得出的标识符。
- `x25519PublicKey`：32 字节的经典 ECDH 公钥。
- `mlKem768PublicKey`：用于 `hybrid-v1` 的 1184 字节 ML-KEM-768 公钥。
- `mlKem768PublicKeyHash`：ML-KEM-768 公钥的 SHA-256。
- `mlKem768PublicKeyLen`：对于 `hybrid-v1` 始终为 `1184`。

PWA 在加密之前会重新计算 `keyId`、`mlKem768PublicKeyHash` 和 `mlKem768PublicKeyLen`。凡是声称的 id、套件、合约套件、哈希或长度不匹配的捆绑包都会被拒绝。

收件人查找由链上的 `enc_pubkey`、`sign_pubkey` 以及存储在活跃 Vault 密钥记录中的完整链上 `pq_kem_pubkey` 单元定义。哈希和长度作为紧凑的绑定字段保留在记录中，但真正让另一个客户端能够加密 `hybrid-v1` 胶囊的，是完整的 ML-KEM-768 公钥。

## 已签名的捆绑包

PWA 可以导出一份已签名的公钥捆绑包。已签名的载荷包含：

- 协议域 `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`；
- 签发时间戳以及可选的过期时间戳；
- 可选的所有者钱包和 Vault 地址占位符；
- 公开加密捆绑包；
- 32 字节的 Ed25519 签名公钥。

签名覆盖稳定的 JSON 载荷，并在信任该捆绑包之前进行验证。这可防止本地捆绑包被悄然篡改，并为客户端提供 Vault 存储在 `KeyRecord` 中的确切 `sign_pubkey`。

PWA 的 `keyId` 是一个客户端捆绑包标识符。它并不取代 Vault 合约的 `current_key_id`，后者由链上根据所有者地址、密钥世代、签名密钥、加密密钥、PQ 哈希、PQ 长度和加密套件计算得出。生产环境的客户端在将捆绑包用于某个钱包身份并加以信任之前，必须先针对 Vault 密钥记录对其进行验证。

已签名的捆绑包是一份消息密钥自签名。钱包所有权由 Vault 激活来锚定：内嵌的 Platho 钱包发送 `RegisterMessagingKeys`，后续的 `ReplaceMessagingKeys` 轮换是经 Vault 授权签名的外部消息，收件人则针对该钱包活跃的链上密钥记录来验证已签名的捆绑包。

## 钱包所有权

生产环境的 PWA 不使用外部钱包连接器。用户创建或导入一份普通的 24 词 GRAM 恢复短语，随后 PWA
会从该短语确定性地派生出 GRAM 钱包密钥、一把独立的 Vault 授权密钥，以及消息加密/签名密钥。Vault
激活是所有权锚点：内嵌钱包从拥有该链上密钥记录的同一个钱包签名并发送 `RegisterMessagingKeys`。
`ReplaceMessagingKeys` 只轮换公开的接收/消息密钥记录；它不轮换 Vault 授权密钥。

收件人只有在针对该钱包活跃的 Vault 密钥记录核对之后，才会信任某份消息捆绑包：

- 记录所有者是预期的钱包；
- `enc_pubkey` 和 `sign_pubkey` 与已签名的捆绑包相符；
- 混合记录暴露完整的 `pq_kem_pubkey` 单元，而不仅是其哈希；
- 解码后的 ML-KEM-768 密钥字节哈希得出 `pq_kem_pubkey_hash`；
- 活跃的 `current_key_id` 指向已验证的密钥记录。

个人资料导出/导入流程负责处理这份 24 词 GRAM 恢复短语。不存在单独的消息密钥备份，也没有
外部钱包连接模式。

## 紧凑字节布局

私密胶囊的链上单元使用最终的 `platho.byte-layout.v1` 二进制布局。PWA 可以将胶囊包装在 JSON 中以用于导出/分享界面，但协议载荷是二进制字节，既不是 JSON，也不是链下指针。`CapsuleHub` 存储紧凑的经认证头部/索引以及正文哈希；加密后的正文单元保留在被接受的发布交易正文中，并从 TON 消息历史重建，随后针对存储的哈希进行验证。

每次发布都要经过 Vault，作为一条由 Vault 余额资助的已签名外部消息。用户首先为其内部
Vault GRAM 余额充值，随后 PWA 用活跃的 `auth_pubkey` 对发布请求进行签名；中继方可以在不持有钱包密钥或消息签名密钥的情况下提交该
外部消息。已签名的载荷通过 `VPB1`、
`deployment_manifest_hash`、目标 Vault 地址和发布种类进行域分离，然后才是所有者、nonce、最大扣费和载荷。
CapsuleHub 在 ACK 或退回中实际返还的 GRAM 数额会被记入用户的内部 Vault GRAM
余额，并以所跟踪的待处理发布退款额为上限。如果 Vault 余额或链访问不可用，
PWA 会失败关闭（fail closed），且不得暴露发布操作。

由于 `auth_pubkey` 授权 Vault 余额的花费，单独攻破本地消息签名密钥并不足以授权
Vault 发布、付款核对、用户名或头像操作。消息签名密钥被攻破仍可能影响消息级别的
身份签名，因此密钥替换会撤销旧的公开接收密钥记录，以用于未来的入站加密核对。

PWA 的消息定价按胶囊计。在当前储备且无 ATH 折扣的情况下，确切的规范示例为：1 KiB 公开条目自 `0.0337 GRAM` 起，`hybrid-v1` 1 KiB 私密
胶囊自 `0.0347 GRAM` 起；更大的公开或私密尺寸类别按规范类别计费更高。这包含完整的
Platho 协议费 `0.01 GRAM`、CapsuleHub 紧凑索引存储捐赠额、Vault 本地执行储备，以及
预期的 ACK 退款。此外，如果 PWA 的保守费用估算高于所含的网络费
额度 `0.005 GRAM`，它会将
四舍五入后的超出部分作为附加费加上。合约调用仍从其规范
所需值起算：Vault 发布发送 `maxCharge = canonical_max_charge + surcharge`。CapsuleHub 没有直接的用户
发布 ABI；每次发布都是 Vault -> CapsuleHub。ATH 折扣仅在 Vault 活动空投
分发了 15,000,000 ATH 之后才适用；在该门槛之前，消息协议费使用完整的 `0.01 GRAM` 费用。PWA 必须在签名之前，为所选内容尺寸显示最终的
冻结额和净成本。

附加费是一份已签名的网络/存储安全边际，不是可退款的费用桶。CapsuleHub 在附带值
至少达到规范所需值时接受 Vault 发布，但一次成功的发布 ACK 只返还固定的
发布 ACK 储备 `30,000,000` nanotons（`0.030 GRAM`）。在 Vault 处理该 ACK 之后，用户在内部 Vault GRAM 余额中被记入大约
`25,800,000` nanotons。任何高于规范所需值的已签名附加费都保留在
CapsuleHub 中作为网络/存储储备的超出部分；它不会返还给 Vault，也不计入
`accrued_plato_fee_ton`。

CapsuleHub 保护的原始 GRAM 储备等于 `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`。
实时储备使用未剪枝的私密/公开条目计数器，而不是历史 `latest_id` 计数器。一个独立的
免许可 `SweepExcessReserve` 调用只能将超出该受保护数额的盈余转入 FeeAccumulator，作为
`DepositProtocolFee`，随后遵循正常的国库/回购拆分。普通的消息发送不会执行此
清扫。如果该清扫存款退回，返还的数额会被有意重新归类为有支撑的
`accrued_plato_fee_ton`，以便通过正常的费用冲销路径重试。
普通的部分 `FlushFees` 调用必须至少等于当前的公开协议费（`0.010 GRAM`）；更小的数额
仅当它是全部剩余的应计桶时才有效，如此打折后的零头仍能被最终结清。

CapsuleHub 为每一个私密和公开条目记录 `created_at = now()`。PWA 使用该合约时间戳进行排序，并用于有界的交易历史查找；客户端头部时间戳仍是经认证的载荷元数据，而非发现权威。紧凑条目元数据可在配置的一年保留窗口之后被免许可剪枝，而正文的可用性则取决于所选 TON 提供方的消息历史覆盖范围，以及用户的本地加密缓存。

Vault 的 ATH 余额通过明确的通知流会计来记入，而不是通过扫描官方钱包的原始余额。
受支持的存款路径是用户 ATHWallet 的 `ATHTransferRequestWithNotify` 进入 Vault。手动向官方 Vault ATHWallet 进行的普通 ATH
转账不受支持，且不得作为存款地址显示，也不得被视为
Vault 账本的入账。从 Vault 提取 ATH 是一条已签名的外部 Vault 命令。其下游的 ATHWallet
部署/转账/ACK 储备由用户的内部 Vault GRAM 余额支付，Vault 只会将其收到的经认证的
ACK/失败/退回值记回，减去本地退款储备，并以已保留的内部值为上限。

公开帖子和评论是一个独立的开放个人资料，而不是未加密的私密胶囊。它们存储一个紧凑的
`PPH1` 公开头部单元加上一个原始的公开正文单元。公开正文文本和公开图像/头像字节使用与面向用户的正文预算相同的
1、2、4、8、16 或 32 KiB 公开胶囊尺寸类别。头部元数据绝不会占用
该正文预算。公开帖子没有后量子选项；公开消息自 `0.0337 GRAM` 起，
而当前确切的公开基准示例是 `0.0337 GRAM` 加上同样的
网络费附加费规则。`kind = 1` 是公开帖子；帖子的 `flags` 第 0 位会关闭该帖子的评论。`kind = 2` 是
一条单层级的公开评论，头部中带有 `parent_entry_id:uint64` 和 `parent_body_hash:uint256`。`kind = 3` 是
公开图像帖子，`kind = 4` 是公开图像评论，`kind = 5` 是公开钱包头像媒体。公开头部还携带 `stream_id:uint128`、
`part_index:uint16`、`part_count:uint16` 和 `media_format:u8`；公开头部对文本使用 `media_format = 0`，
对 WebP 图像/头像分片使用 `media_format = 1`。公开帖子、图像帖子和头像头部还携带
`profile_version:uint32` 和 `avatar_hash:uint256`；为零表示没有头像指针。较长的公开文本或图像数据只有在每个条目都已使用最小的可容纳公开尺寸类别（最高至 32 KiB）之后，才会从多个条目重建。官方 PWA 会在拆分之前将所选图像压缩到 WebP 目标：8 KiB
（`low`）、16 KiB（`medium`）、32 KiB（`good`，默认）或 64 KiB（`maximum`）。不存在编辑/删除/表态/审核层或计数层。

钱包头像是付费的个人资料更新，而不是链下资产。头像字节作为 `kind = 5` 公开
CapsuleHub 条目发布，随后 `ProfileRegistry` 记录经认证的钱包指针：
`version`、`avatar_hash`、首个 `avatar_entry_id`、`avatar_stream_id`、`avatar_part_count` 和 `media_format`。读取方
从已签名的私密头部或公开帖子头部解析出个人资料指针，验证相匹配的 ProfileRegistry
记录，从 CapsuleHub 取回头像公开条目，按索引顺序拼接分片，并要求重建后的
WebP 字节哈希得出 `avatar_hash`。本地头像缓存只是加速手段；真实来源是 CapsuleHub 加上
ProfileRegistry。

`header0_cell` 存储恰好 140 字节：

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

`header1_cell` 存储恰好 30 字节：

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` 隐含套件。`profile_version` 和 `avatar_hash` 指向发送时刻的发送方钱包头像，
并由头部哈希加上发送方签名所覆盖。`recipient_sign_pubkey` 和线程哈希被
有意不存储在公开头部单元中。线程/分组数据属于加密胶囊元数据的内部。

每个加密正文按如下方式组装：

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

AES-GCM 明文是由 `size_class` 选定的一个固定胶囊槽位：

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

有效内容区域被填充到所选的 1、2、4、8、16 或 32 KiB 私密胶囊类别。一条含有 1 字节、500 字节或 1024 字节有效文本的消息，在 1 KiB 类别中拥有相同的加密明文尺寸。超过所选类别的消息会被拆分为独立的胶囊，并带有加密的 `stream_id`、`part_index` 和 `part_count` 元数据。一个胶囊绝不会混合不相关的文本/图像单元；接收方把独立的胶囊重新组装回原始消息。

内容种类：

- `1` 文本：UTF-8 字节，最高至所选的有效私密胶囊尺寸。
- `2` 图像：压缩后的 WebP 图像字节，最高至所选的有效私密胶囊尺寸（`media_format = 1`）。
- `3` 付款核对：`asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`。

付款核对正文有意不包含 `tx`、激活时间或过期时间。接收方通过 `intent_id + secret32` 领取；如果发送方已经取消了该核对，或它已被领取，界面会提示该核对已被发送方领取或取消。

加密正文可为导出/分享而包装为：

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

对于最终的胶囊正文，`chunk_total` 始终为 `1`。`PLC1` 仅是打包/导出框架。被接受的 Vault -> CapsuleHub 发布交易在蛇形单元中携带已组装的 `PLB1` 正文字节；CapsuleHub 只持久化紧凑的经认证元数据和哈希。

最终私密上限：

| 套件 | 每胶囊有效上限 | 正文字节 | 导出分块字节 |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

该布局的规范来源是 `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`。

AES-GCM 使用 12 字节的 nonce 和 16 字节的 tag。密文长度等于明文长度加上 tag。

紧凑正文前缀、`header0Hash` 和 `header1Hash` 作为 AES-GCM 附加认证数据传入。更改二进制路由头部、套件、nonce、KEM 密文、分块字节或发送方签名，都会使验证或解密失败。

在解密之前，客户端还会核对：

- 紧凑正文套件与 `header0` 相符；
- 收件人密钥 id 与 `header0.recipientKeyId` 相符；
- `hybrid-v1` 正文确实携带一段 1088 字节的 ML-KEM 密文；
- 每个分块拥有相同的套件、消息 id 和分块总数。

## 密钥派生

对于 `hybrid-v1`：

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

明文用 AES-256-GCM 加密。

该实现会拒绝全零的 X25519 共享密钥，以避免接受低阶公钥。

## 私密加密胶囊

客户端在发布之前，把紧凑的加密正文包装进一个私密胶囊。一个私密胶囊包含：

- `header0`：上文描述的 140 字节 `PH0B` 二进制路由头部。
- `header1`：上文描述的 30 字节 `PH1B` 二进制重放头部。
- `body`：`platho.byte-layout.v1` 分块元数据加上 base64url 编码的二进制分块。
- `hashes`：对于恰好包含 `header0`、`header1` 和加密正文字节的链上单元，其 TON `Cell.hash()` 值。
- `chainCells`：使用 `ton-snake-byte-cell.v1` 的 base64 BOC 载荷；这些正是在 Vault -> CapsuleHub 发布交易中被接受、并由 `CapsuleHub` 认证的单元，而非链下指针。
- `senderSignature`：对胶囊 id 和全部三个哈希的 Ed25519 签名。

对于 `hybrid-v1`，胶囊使用 CapsuleHub 的混合配置：

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

在已签名的 `PublishPrivateFromVaultBalance` 外部请求被 Vault 接受之后，私密胶囊草案映射到 Vault -> CapsuleHub 的 `PublishPrivateFromVault`
正文：

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Vault 发布消息携带 `protocol_fee_paid`，因为 Vault 是 ATH 支撑定价的折扣权威。

有效载荷容量是真正被序列化进 `body_cell` 并被 `CapsuleHub` 接受的加密正文字节的容量。一个没有相匹配的、被接受的发布交易正文的哈希，并不是一条可读的消息。本地历史仅是缓存；它不定义投递。

对于 Vault 外部发布签名，哈希引用（hashes-ref）的顺序保持与合约兼容：

```text
body_hash || header_0_hash || header_1_hash
```

紧凑正文通过 AES-GCM AAD 绑定到 `header0Hash` 和 `header1Hash`。替换头部、正文分块、套件元数据、发送方签名、胶囊上下文或 BOC 载荷单元，都会使验证在消息被接受之前失败。

## 投递的真实来源

被接受的私密消息是紧凑的 CapsuleHub 条目，加上由被接受的发布交易正文所携带的加密载荷单元。PWA 从 TON 消息历史取回这些单元，并在解密之前针对 CapsuleHub 哈希对它们进行验证。生产环境的 PWA 不暴露手动的公开捆绑包或加密胶囊 JSON 打包交换。

公开消息密钥注册在 `Vault` 密钥记录中。发送方在加密私密胶囊之前，必须解析并验证收件人的密钥记录。本地加密历史仅是设备缓存；它不定义投递。

`.ath` 用户名权威由两部分构成。`UsernameRegistry.get_name_record` 证明某个名称存在，并指向
该名称确切对应的 `UsernameNFTItem`。随后从该 item 状态读取当前所有者。转账会更改 item 的
所有者；注册表记录仍是名称到 item 的锚点。该 item 暴露标准的 NFT 数据和 TEP-64 链上
元数据，包括 `name = <username>.ath`，而无需服务器托管的元数据 URI。用户名字节被有意保持
字面化：当每个字节都在允许的 `a-z`、`0-9`、`_`、`-` 集合内且长度为 4..16 时，前导、结尾、连续以及全为分隔符的名称都是有效的。如果某个待处理的铸造在
缺失 item ACK 之后变得陈旧，`PrunePendingUsernameMint` 是非破坏性的：它证明该陈旧状况，但不删除
待处理状态，也不产生应退款项。一个已部署的 item 只有在注册表通过有效的迟到 ACK 或 `ResendDeployedAck` 完成了
相匹配的名称记录之后，才会成为一个权威用户名。客户端和索引器必须忽略仅基于 item 的
所有权主张，且在转账之后不得将注册表记录所有者用作当前所有者。

24 词 GRAM 恢复短语是唯一的用户密钥。PWA 从该短语确定性地派生出 GRAM 钱包密钥和消息加密/签名密钥。因此，个人资料导出/导入流程只处理该恢复短语；不存在单独的消息密钥备份。

## 重放与过期策略

私密胶囊默认为 24 小时 TTL，上限为 30 天。实时/链下胶囊打包验证会拒绝：

- 创建时间在未来过远的胶囊；
- 已过期的胶囊；
- 高于策略上限的 TTL；
- 调用方提供的重放缓存中出现重复的胶囊 id。

链历史导入则不同：当一个私密条目已被 CapsuleHub 接受，且正文已从
被接受的 TON 交易历史或本地加密缓存中恢复时，PWA 会验证条目哈希、正文/头部单元和
解密，但不会仅仅因为头部过期时间在过去就予以拒绝。否则，被保留的链历史将
按设计变得不可读。

重放缓存是本地状态；生产环境的客户端可用 IndexedDB 或另一种设备本地存储来支撑它。不需要任何后端。

## 无后端规则

加密层不需要 Platho 后端。服务器可以托管静态文件，但私密投递由 `CapsuleHub` 链状态加上被接受的发布交易正文来锚定：紧凑条目证明哈希，而正文仍必须能从 TON 消息历史或用户的本地加密缓存获得。服务器绝不会收到明文、私钥或服务器端会话密钥。

## Vault 注册草案

客户端可以从一份已验证的已签名捆绑包派生出一份 `RegisterMessagingKeys` 草案：

- `enc_pubkey`：作为 uint256 的 32 字节 X25519 公钥。
- `sign_pubkey`：作为 uint256 的 32 字节 Ed25519 签名公钥。
- `auth_pubkey`：作为 uint256 的、独立的 32 字节 Ed25519 Vault 授权公钥。
- `pq_kem_pubkey_hash`：ML-KEM-768 公钥的 SHA-256。
- `pq_kem_pubkey_len`：`1184`。
- `pq_kem_pubkey`：恰好包含 1184 字节 ML-KEM-768 公钥字节的规范蛇形单元。
- `crypto_suite_mask`：对于 `hybrid-v1` 为 `2`。

该草案由内嵌的 Platho 钱包激活流程提交。一旦钱包在 Vault 中被激活，其他已激活的用户就能解析其公开消息密钥记录，并向其加密私密胶囊。

## Vault 密钥记录绑定

在钱包已于链上注册密钥之后，客户端必须获取：

- 钱包的 `UserState.current_key_id`；
- 对于用户自己已解锁的钱包，与本地派生的 Vault 授权公钥相匹配的 `UserState.auth_pubkey`；
- 该密钥 id 对应的 `VaultKeyRecordView`。

PWA 在 `web/vault-chain-provider.mjs` 中将其暴露为一个失败关闭的提供方桥接。该桥接期待一个具备如下方法的提供方：

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

如果没有配置提供方，Vault 绑定将保持不可用，而不是接受本地草案或 UI 占位符。生产/静态部署可以在 `globalThis.plathoVaultChainProvider` 上安装一个提供方，通过 TON API 镜像或轻客户端兼容的传输来读取已部署的 Vault。

静态运行时包含 `web/vault-ton-rpc-provider.mjs` 作为生产提供方的骨架。它可以封装 TON Center v3 兼容端点，或由宿主捆绑包安装的自定义 `globalThis.plathoTonRpcTransport`。当前 PWA 不暴露内置的用户 RPC 设置界面。该提供方：

- 将 `get_user(owner)` 的 owner 地址编码为 `slice` BoC 栈项；
- 用一个数值栈项调用 `get_key_record(current_key_id)`；
- 将 getter 栈解码为 `VaultUserView` 和 `VaultKeyRecordView`；
- 在 RPC 传输、Vault 地址、getter 响应或密钥记录绑定不可用时失败关闭。

客户端侧的验证器核对活跃的 Vault 记录与已验证的已签名捆绑包相符：

- `owner_wallet` 与内嵌的 Platho 钱包地址相符；
- `enc_pubkey` 与 X25519 公钥相符；
- `sign_pubkey` 与捆绑包签名公钥相符；
- `pq_kem_pubkey`、`pq_kem_pubkey_hash` 和 `pq_kem_pubkey_len` 与 ML-KEM-768 材料相符；
- `crypto_suite_mask` 与套件相符；
- `revoked_lt` 为零；
- 可选的 `current_key_id` 指向所获取的记录 id。

客户端不会凭空杜撰链上密钥 id。Vault 从所有者地址、密钥世代、密钥字段、PQ 长度和套件计算它。客户端转而验证所获取的记录。

## 持久重放存储

PWA 在可用时使用 IndexedDB 进行私密胶囊重放保护，并有一个内存回退。该存储将胶囊 id 保留到其胶囊过期为止，并在本地剪枝已过期的条目。这是设备本地状态，且不需要服务器。

## 加密的本地消息历史

PWA 还拥有一个设备本地的加密消息历史存储。它使用一把保存在 IndexedDB 中的不可导出的 WebCrypto AES-GCM-256 密钥，并将每条消息正文存储为经认证的密文。记录头部只保留本地查询元数据：id、线程 id、时间戳、方向以及可选的胶囊 id。

头部作为 AES-GCM 附加认证数据被绑定。更改线程 id、时间戳、方向、胶囊 id、nonce 或密文，都会使该记录无法打开。如果 IndexedDB 不可用，应用会为该会话回退到加密的内存内历史，并避免将明文写入持久的浏览器存储。
