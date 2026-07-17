# PLATHO CLEAN-16 — CapsuleHub **B3 Anon-Publish** — CLOSED DESIGN SPEC

Файл под правку: `C:\platho\contracts\CapsuleHub.tact` (+ со-обязательная парная правка `C:\platho\contracts\CreditIssuer.tact`).
Статус: **CLOSED, implementable.** Все константы, помеченные **[G8]**, финализируются замером `computeDataSize` @ 64962 нанотон/cell/год до seal. Контракт **ИММУТАБЕЛЕН** — каждое решение, помеченное **[IRREVERSIBLE]**, после genesis не меняется без полного форк-редеплоя (bump `deployment_id`).

Этот спек = DRAFT B3 + инкорпорация всех валидных находок шести red-team линз. Диспозиция каждой находки — в §14 (reconciliation ledger). Несколько находок изменили свою форму после сверки с реальным кодом (ключевое: интегрити header/body уже есть в существующем lane-parse через `requireExactPayloadCell` — это меняет §3 и §7-RECOVERY).

---

## 0. Несущие решения (консенсус линз, зафиксировано)

**0.1 Publish = INTERNAL-сообщение от кошелька-реле, НЕ signed external. [IRREVERSIBLE]**
Обоснование держится (RT4 подтвердил): у internal нет `acceptMessage`; compute-газ списывается из `msg.value` реле даже при реверте → баланс Hub и `protectedReserve` нетронуты при любом спам-батче. External жёг бы `protectedReserve()` (эндаументы живых капсул) из своего баланса после accept. Дилемма pre/post-accept **снята**: у internal её нет, порядок проверок диктуется только fail-fast-экономией.

**0.2 Финансирование эндаумента = ПРЕДОПЛАЧЕННЫЙ ПУЛ (buyer→CreditIssuer→Hub), реле приносит только газ. [IRREVERSIBLE — выбор модели]**
Реле почти бесплатно → максимальная реле-диверсити → censorship-resistance. Цена, вскрытая red-team и закрытая в этом спеке: (а) Hub-локальный `spent ≤ funded` гвард (§4/§5), (б) seal-gate равенства `prepaidUnit` между двумя контрактами (§5.6), (в) судьба протухших-непотраченных кредитов (OWNER-D3, §11).

**0.3 Источник issuer-pubkey = genesis-снапшот-зеркало в Hub (Variant B). [IRREVERSIBLE]**
Синхронный cross-read getter в TON невозможен. Hub держит локальное зеркало, version-монотонно обновляемое controller-сообщениями. Детали §9.

**0.4 spend-token авторизует РОВНО (serial ‖ kind ‖ весь frame). [IRREVERSIBLE — прообраз подписи]**
Ключевая правка против RT1-BLOCKER-1: `serial` входит в spend-дайджест. Плюс frameCommit покрывает все скаляры кадра (§3.3).

---

## 1. Роль + что меняется против текущего `PublishBatchToHub`

CapsuleHub хранит компактные индексы/заголовки капсул on-chain; тела (кроме RECOVERY) живут в теле accepted-транзакции и аутентифицируются хранимым хешем. Сегодня единственный вход — `receive(PublishBatchToHub)` (1024–1313) с жёстким gate `sender()==vault_address` (1027); Hub **полностью доверяет** полю `msg.author_wallet` и `msg.protocol_fee_total`, которые подставил Vault после проверки подписи владельца.

B3 снимает это доверие:

| Аспект | Сейчас (clean-16 live-путь) | B3 anon-publish |
|---|---|---|
| Вход | `receive(PublishBatchToHub)` op `0xA4F862D1`, gate `sender()==vault` | **НОВЫЙ** `receive(PublishAnonBatch)` op `0x50415542`, permissionless; старый receiver **удаляется** (OWNER-D7: опция сохранить legacy Vault-lane параллельно) |
| Авторизация | доверие Vault | per-part **spend-token** (2×`checkSignature`) + epoch-nullifier |
| `author_wallet` | доверенное поле корня, пишется в PUBLIC-индекс/запись, RECOVERY-bind | **удалено** из корня; PUBLIC discovery → `channel_id = H(DOMAIN‖spend_pubkey)`; RECOVERY-bind → `owner_pubkey` + `owner_sig` |
| `protocol_fee_total` | доверенное поле | **удалено**; Hub считает `protocolFee(kind)` из своей per-kind константы |
| Финансирование storage | Vault форвардит value | предоплаченный пул (`FundAnonPool`), реле приносит газ |
| Anti-replay | в Vault (signed nonce) | **новый** epoch-nullifier леджер в Hub (§4) |
| ACK/refund | → `vault_address` | → `relay = sender()` (§8) |
| RECOVERY | в общем batch-receiver | **отдельный** `receive(PublishRecovery)`, self-funded, `owner_sig` (§7) |

CONV/PRIVATE, INTRO storage-пути и recipient-privacy **неизменны** (§10). Меняется только authorization-обёртка.

---

## 2. Изменения сообщений и структур (точные битовые ширины)

### 2.1 Новый корень публикации

```tact
// [IRREVERSIBLE opcode] НОВЫЙ op (bump против 0xA4F862D1 — иначе старые декодеры/тесты/vpb2.ts спутают формы; RT6-MAJOR-5).
message(0x50415542) PublishAnonBatch {          // "PAUB"
    bounce_id:    Int as uint64;                // recovery-биты ПЕРВЫМИ (переживают bounce-truncation)
    bounce_tag:   Int as uint160;
    publish_id:   Int as uint256;               // клиентская корреляция + UID-домен; НЕ security, НЕ дедуп; CSPRNG (RT5-MINOR)
    publish_kind: Int as uint8;                 // {PRIVATE=1, PUBLIC=2, INTRO=3}. RECOVERY здесь НЕТ (§7)
    part_count:   Int as uint8;                 // 1..MAX_BATCH_PARTS_ANON
    parts:        Cell;                          // ref[0] — кадры частей БАЙТ-В-БАЙТ как сейчас
    tokens:       Cell;                          // ref[1] — параллельный односвязный список spend-токенов, len == part_count
    marketing:    Cell?;                         // ref[2] — только PUBLIC
}
```

**Удалено из корня:** `author_wallet` (267 бит, неверифицируем при permissionless), `protocol_fee_total` (128 бит, спуфабельно). Корневых ref: 3 (`parts`, `tokens`, опц. `marketing`) — в пределах 4.

**Почему `tokens` — отдельный root-ref, а не 5-й ref кадра:** не-последняя CONV/INTRO/RECOVERY-часть уже держит 4 ref (header0, header1, body, next) = потолок ячейки. Параллельный список `tokens` шагает в лок-степе с `parts`.

### 2.2 Узел токена (одна ячейка списка, один на часть)

```
Скаляры корня узла (616 бит):
  serial       : uint256   // = H(ISSUER_SIG_DOMAIN ‖ spend_pubkey ‖ epoch ‖ nonce)  — cell-hash (§3.2)
  slot         : uint8     // индекс issuer-слота 0..15
  spend_pubkey : uint256   // ed25519, раскрывается на spend
  epoch        : uint32    // = now() / EPOCH_SECONDS
  nonce        : uint64    // CSPRNG-соль; разделяет токены под одним spend_pubkey (public-канал) — §12
Рефы:
  ref[0] issuer_sig : ^(Slice as bytes64)   // ed25519 R(32)‖s(32 LE)
  ref[1] spend_sig  : ^(Slice as bytes64)
  ref[2] next_token : ^узел                 // отсутствует у последнего
```
616 бит < 1023; ≤3 ref. Sig в ref, чтобы влезть и сохранить форму `Slice as bytes64`, которую принимает `checkSignature` (образец `KeyRegistry.tact:53,380`).

### 2.3 Storage-структуры

- **PrivateCapsuleEntry (190–200), IntroCapsuleEntry (253–259): БЕЗ ИЗМЕНЕНИЙ.**
- **PublicCapsuleEntry (202–218):** `author_wallet: Address` (267) → **`channel_id: Int as uint256`** (256).
- **RecoveryCapsuleRecord (299–312):** `author_wallet: Address` → **`owner_pubkey: Int as uint256`** (256).
- **Views — ОБЯЗАТЕЛЬНЫЕ правки (иначе не компилируется, RT6-BLOCKER-1/2):**
  - `PublicCapsuleEntryView.author_wallet: Address` (стр. 330) → **`channel_id: Int as uint256`**; заполнение в `get_public_entry` (1660) `channel_id: entry.channel_id`; UID через `channel_id` (1658).
  - `RecoveryCapsuleView.author_wallet: Address` (стр. 319) → **`owner_pubkey: Int as uint256`**; `get_recovery_capsule` (1408 заглушка, 1420 заполнение).
  - `PrivateCapsuleEntryView.author_wallet` (стр. 226): поле уже заполняется заглушкой (`self.vault_address`/`myAddress()`), компилируется. **Косметика:** переименовать в убранный/`Int = 0` при желании; НЕ несущее (private lane автора не хранит). Помечено OWNER-D8 (косметический cleanup, можно отложить).
- **Новые поля контракта:**
  ```tact
  // issuer-зеркало (§9)
  issuer_mirror: map<Int, IssuerSlot>;         // slot(uint8→Int) -> {pubkey uint256, active Bool, version uint32}
  credit_issuer_address: Address;              // genesis-bound
  // genesis_controller_address уже есть (стр. 361)
  // epoch-nullifier леджер (§4)
  spent_nullifiers:      map<Int, Int>;        // nk(uint256) -> insert_time(uint32)
  nullifier_seq:         map<Int, NullRec>;    // seq(uint64) -> {key, insert_time}
  nullifier_latest:      Int as uint64;
  nullifier_oldest_live: Int as uint64;
  nullifier_live_count:  Int as uint32;
  // prepaid-пул (§5) — модель по OWNER-D3:
  //   Вариант A: два счётчика (простой, forfeiture)
  anon_credits_funded:   Int as uint64;
  anon_credits_spent:    Int as uint64;
  //   Вариант B (рекоменд.): вместо двух счётчиков — per-epoch мапы + агрегат (§5.4)
  //     funded_by_epoch: map<Int, Int>; spent_by_epoch: map<Int, Int>; anon_pool_outstanding: Int;
  struct IssuerSlot { pubkey: Int as uint256; active: Bool; version: Int as uint32; }
  struct NullRec    { key: Int as uint256;    insert_time: Int as uint32; }
  ```

---

## 3. Permissionless spend-publish receiver

### 3.1 Internal vs external — решение и обоснование [IRREVERSIBLE]
**INTERNAL** (см. §0.1). Верификация — обычная value-оплаченная compute-фаза. `acceptMessage` отсутствует. Дилемма pre/post-accept снята. Порядок = дёшево→дорого (fail-fast, анти-DoS на газ РЕЛЕ; Hub и так не платит).

### 3.2 serial-коммитмент (с доменом, RT1-MINOR-4)
```tact
let serialCheck = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32)   // домен-сепарация: слот-ключ никогда не коллидирует с другим 256-бит подписантом
    .storeUint(spend_pubkey, 256)
    .storeUint(epoch, 32)
    .storeUint(nonce, 64)
    .endCell().hash();                  // preimage 384 бит < 1023
throwUnless(13601, serialCheck == serial);
```
Инвариант: перебор `spend_pubkey`/`epoch` под фикс. `serial` = поиск прообраза cell-hash → невозможно. Issuer слеп к serial (`CreditIssuer.tact:9-10`).

### 3.3 spend-дайджест (полный frame-bind, RT1-BLOCKER-1 + RT5-fix#3) [IRREVERSIBLE]
Два дешёвых хеша. `frameCommit` покрывает ВСЕ скаляры кадра (лейн-канонично); `spendDigest` добавляет `serial` + `kind`.

```tact
// private-family (CONV/INTRO): скаляры sizeClass, cryptoSuite, h0, h1, bh
frameCommit = beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN,32).storeUint(sizeClass,8).storeUint(cryptoSuite,8)
    .storeUint(h0,256).storeUint(h1,256).storeUint(bh,256).endCell().hash();      // 816 бит
// PUBLIC: скаляры sizeClass, reserved, parentLink, h0, bh
frameCommit = beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN,32).storeUint(sizeClass,8).storeUint(reserved,8)
    .storeUint(parentLink,64).storeUint(h0,256).storeUint(bh,256).endCell().hash();// 632 бит

spendDigest = beginCell()
    .storeUint(SPEND_DOMAIN,32).storeUint(serial,256).storeUint(publish_kind,8)
    .storeUint(frameCommit,256).endCell().hash();                                  // 552 бит
throwUnless(13605, checkSignature(spendDigest, spend_sig, spend_pubkey));
```

**Почему это закрывает RT1-BLOCKER-1 (token-splicing):** `spend_sig` теперь связана с `serial` конкретного токена → одна spend_sig валидна только для СВОЕГО токена; реордер/сплайс токенов роняет `checkSignature`. Заявление DRAFT §2 «пейринг крипто-принудителен» стало ИСТИННЫМ.
**Почему покрывает header (RT5-fix#3):** `frameCommit` содержит `h0` (хеш header0 = bucketKey/ephemeral_R). Реле не может пере-нацелить капсулу в другой bucket.
**Ключевое уточнение против DRAFT (сверено с кодом):** интегрити `header0.hash()==h0`, `header1.hash()==h1`, `body.hash()==bh` **уже** обеспечена существующим lane-parse через `requireExactPayloadCell` (1090/1097/1098 CONV, аналогично INTRO/PUBLIC). Эти блоки **сохраняются дословно** в новом receiver (§10). Значит `spend_sig`-над-скалярами транзитивно покрывает реальные ref-ячейки. НЕ надо добавлять отдельные проверки — надо НЕ УДАЛИТЬ существующие. (Это переопределяет DRAFT §2-шаг6 и RT1-body-hash-находку: не «добавить», а «сохранить».)

### 3.4 Полная последовательность верификации

**Фаза A — корень, O(1), до цикла:**
```
A0  self.requireSealed()
A1  throwUnless(13501, publish_id != 0)
A2  throwUnless(13502, publish_kind ∈ {PRIVATE, PUBLIC, INTRO})       // RECOVERY здесь НЕТ
A3  throwUnless(13503, 1 <= part_count <= MAX_BATCH_PARTS_ANON)
    let relay: Address = sender();                                     // захват для ACK
    // строка 1027 (sender()==vault) УДАЛЕНА — цель B3
    let E = now() / EPOCH_SECONDS;
A4  Phase-A нижний порог value = ТОЛЬКО газ+ack (эндаумент предоплачен):
    throwUnless(13509, context().value >=
        part_count * HUB_MIN_PER_PART_VALUE + CAPSULEHUB_ACK_FORWARD_RESERVE)
    // marketing-guard для PUBLIC (существующие 13507/13508) — сохранить
```

**Per-part цикл (часть i ‖ токен i), дёшево→дорого:**
```
 1 (epoch-окно)   throwUnless(13600, epoch >= E - EPOCH_ACCEPT_PAST && epoch <= E + EPOCH_ACCEPT_FUTURE)
 2 (serial)       throwUnless(13601, serialCheck == serial)                            // 1 хеш
 3 (issuer-слот)  let ms = issuer_mirror.get(slot);
                  throwUnless(13602, ms != null && ms!!.active)
 4 (double-spend) let nk = H(NULL_DOMAIN ‖ serial);
                  throwUnless(13604, spent_nullifiers.get(nk) == null)                 // дёшево, ловит и intra-batch
 5 (issuer_sig)   throwUnless(13603, checkSignature(serial, issuer_sig, ms!!.pubkey))  // дорого #1
   ── СУЩЕСТВУЮЩИЙ lane-parse части (13510–13518 CONV / 13540+ INTRO / 13520+ PUBLIC) БЕЗ ИЗМЕНЕНИЙ:
      парсит скаляры, requireExactPayloadCell(header0,h0)/(header1,h1)/(body,bh), ИНК3-guard ──
 6 (frameCommit)  собрать frameCommit из распарсенных скаляров (§3.3)
 7 (spend_sig)    throwUnless(13605, checkSignature(spendDigest, spend_sig, spend_pubkey))  // дорого #2
 8 (nullifier-insert, ТОЛЬКО после всех проверок):
                  spent_nullifiers.set(nk, now());
                  nullifier_seq.set(nullifier_latest, NullRec{ key: nk, insert_time: now() });
                  nullifier_latest += 1; nullifier_live_count += 1;
 9 (store-ветка)  существующий store лейна; для PUBLIC индекс-ключ = publicChannelKeyId(spend_pubkey) (§6)
10 (шаг токена)   продвинуть курсор tokens параллельно parts
11 requiredValueGasOnly += HUB_PART_GAS_*[kind] + HUB_TOKEN_VERIFY_GAS
```

**Фаза V (после цикла):**
```
V0  throwUnless(13609, tokenCursor == null)          // список tokens исчерпан РОВНО на part_count (RT2-F2/RT6-8)
V1  ── pool-solvency гвард (RT3-#1 / RT4-F3), fail-closed ──
    Вариант A: throwUnless(13613, anon_credits_spent + part_count <= anon_credits_funded)
    Вариант B: (гвард сделан per-epoch в шаге 9 — см. §5.4)
V2  throwUnless(13530, context().value >= requiredValueGasOnly)   // ТОЛЬКО газ+ack, НЕ эндаумент
V3  commit счётчиков (private/public/intro _latest_id += part_count)
V4  prepaid→locked перекладка (§5.3); anon_credits_spent += part_count (или per-epoch)
V5  auto-evict своей полосы + capped INTRO-sweep (существующие 1272–1289) — БЕЗ ИЗМЕНЕНИЙ
V6  evictNullifiersFIFO(part_count + NULLIFIER_SWEEP_MARGIN)      // §4
V7  reserve + ACK → relay (§8)
```
Tact revert-all: любой throw (V1/V2/per-part) откатывает nullifier-insert → недофинансированный/битый батч НЕ жжёт токен (fail-closed; токен сохраняется). Порядок дёшево→дорого гарантирует, что реле не платит за 2×ed25519 на протухшем/реплей-батче.

### 3.5 Газ-бюджет [G8 — ОБЯЗАТЕЛЬНЫЙ ЭМПИРИЧЕСКИЙ SEAL-GATE, RT4-F4]
`HUB_TOKEN_VERIFY_GAS ≈ 18000`/часть **[G8]**: 2×checkSignature (~8k) + serial-build/hash + frameCommit-build/hash + spendDigest-build/hash + nullifier-domain-hash + dict get/set×2 + запас. Складывать ОТДЕЛЬНЫМ слагаемым, не трогая откалиброванные `HUB_PART_GAS_*`. Плюс до `part_count + NULLIFIER_SWEEP_MARGIN` nullifier-эвикций (dict-del ~0.6k каждая).

**SEAL-GATE G-GAS:** измерить `getComputeFee` реального worst-case 8-парт PUBLIC-батча на скомпилированном ABI ПРОТИВ config-param-21 (basechain gas_limit). DRAFT оценил ~1.7M; если реально `> gas_limit` — 8-парт анон-батчи неисполнимы (revert после частичной работы). **Если замер > лимита:** снизить `MAX_BATCH_PARTS_ANON` (напр. 4–5) для тяжёлых полос. Не объявлять невозможным заочно (правило empirical-verify), но seal без замера **запрещён**. `MAX_BATCH_PARTS_ANON` — **[IRREVERSIBLE]** после seal.

### 3.6 Коды ошибок (разведены, RT6-MINOR-10)
```
УДАЛЁН 13500 (vault gate).  Сохранены: 13501 publish_id, 13502 kind, 13503 part_count, 13507/13508 marketing,
13509 Phase-A value, 13510–13530 существующий lane-parse+final value, ИНК3 13519/13549/13559.
НОВЫЕ (spend-путь):
  13600 epoch-окно            13601 serial-коммитмент      13602 issuer-слот (null/inactive)
  13603 issuer_sig            13604 double-spend            13605 spend_sig
  13609 tokens-len/exhaustion 13613 pool-solvency (spent+part_count > funded)
FundAnonPool (§5):  13611 sender != credit_issuer_address   13612 value < credits_k*prepaidUnit + FUND_GAS
Mirror (§9):        13614 sender != genesis_controller      13615 version не монотонна
RECOVERY (§7, отдельный receiver): 13563 first-publisher bind (existing.owner_pubkey==owner_pubkey),
  13571 owner_sig, 13573 body.hash()!=bh, 13574 header0.hash()!=h0, 13575 header1.hash()!=h1, 13576 value-порог
```

---

## 4. Epoch-nullifier леджер [IRREVERSIBLE — структура и retention-модель]

### 4.1 Структура — две плоские мапы, retention по ВРЕМЕНИ ВСТАВКИ (RT4-F1, супер­седит epoch-based)
```tact
spent_nullifiers:      map<Int, Int>;      // nk(uint256) -> insert_time(uint32)  (тест членства)
nullifier_seq:         map<Int, NullRec>;  // seq(uint64) -> {key, insert_time}   (FIFO эвикция)
nullifier_latest:      Int as uint64;
nullifier_oldest_live: Int as uint64;
nullifier_live_count:  Int as uint32;
struct NullRec { key: Int as uint256; insert_time: Int as uint32; }
nk = beginCell().storeUint(NULL_DOMAIN,32).storeUint(serial,256).endCell().hash();
```

**КЛЮЧЕВАЯ РЕКОНСИЛЯЦИЯ (RT4-F1 vs RT2-F1):** retention привязан к `insert_time`, НЕ к `epoch` токена. Тогда порядок seq == порядок вставки == порядок истечения → `break`-on-first-live КОРРЕКТЕН, стойла нет. Это одновременно закрывает:
- **RT4-F1** (FIFO-by-seq ⟂ expiry-by-epoch → вечное стойло эвиктора) — устранено by construction.
- **RT2-F3** (future-head pinning раздувает live_count) — устранено (seq==expiry).
- **RT2-F1** («+1» как отдельная сущность → off-by-one на 86400 с) — устранено: единственный операнд `NULLIFIER_RETENTION_SECONDS` входит и в определение, и в предикат, отдельного «+1» нет.

### 4.2 Эвикция (FIFO по seq, funded газом spend'а)
```tact
fun evictNullifiersFIFO(maxEvict: Int) {
    let n = 0; let id = self.nullifier_oldest_live;
    while (n < maxEvict && id < self.nullifier_latest) {
        let r = self.nullifier_seq.get(id);
        if (r == null) { id += 1; continue; }
        if (now() < r!!.insert_time + NULLIFIER_RETENTION_SECONDS) { break; }  // insert==expiry order → корректно
        self.spent_nullifiers.set(r!!.key, null);
        self.nullifier_seq.set(id, null);
        self.nullifier_live_count -= 1;
        id += 1; n += 1;
    }
    self.nullifier_oldest_live = id;
}
```
Драйверы: fold в publish (V6, `part_count + NULLIFIER_SWEEP_MARGIN`) + permissionless standalone `EvictExpiredNullifiers{max_count}` op `0x4E554C4C`, кап `CAPSULEHUB_STANDALONE_EVICT_CAP=32`, авторизации нет (гейт = истечение).

**Пропускная способность (RT4-F2 / RT3-#5 / RT6-MAJOR-4):** fold эвиктит `part_count + NULLIFIER_SWEEP_MARGIN` ≥ вставленных `part_count` → чистый рост ≤ 0 в стационаре. `NULLIFIER_SWEEP_MARGIN=4` **[G8]**. Учтено в газ-бюджете §3.5. (DRAFT `NULLIFIER_SWEEP_CAP=4 < part_count=8` был структурным дефицитом — исправлено.)

### 4.3 НЕСУЩИЙ ИНВАРИАНТ: retention ≥ окно повторной траты (доказано) [IRREVERSIBLE]
```
NULLIFIER_RETENTION_SECONDS = (EPOCH_ACCEPT_PAST + EPOCH_ACCEPT_FUTURE + 1) * EPOCH_SECONDS   // 9 эпох
```
Токен с `epoch=X` приемлем во времени `[(X−FUTURE)·EPOCH, (X+PAST+1)·EPOCH)`. Первая трата в `t_insert` внутри окна; nullifier жив до `t_insert + RETENTION`. Т.к. `t_insert ≥ (X−FUTURE)·EPOCH`, то `t_insert + RETENTION ≥ (X+PAST+1)·EPOCH` > любой приемлемой повторной траты (строгое `<`). ⇒ nullifier никогда не эвиктится, пока serial ещё приемлем ⇒ double-spend не проскальзывает. Over-retention для поздно-потраченных токенов ограничен ≤ 9 эпох (безопасное направление); эндаумент сайзится на полные 9 эпох.

**Обязательный двусторонний граничный тест:** spend serial@epoch=X; прыжок `now = t_insert + RETENTION − 1` → повторный spend отбит 13604 (nullifier жив); прыжок `now = t_insert + RETENTION` → nullifier evictable И окно (13600) уже отвергает. Плюс future-вариант epoch=E+1 и earliest epoch=E−PAST.

### 4.4 Solvency/rent nullifier'а [G8 @64962]
Nullifier = 2 dict-записи, живёт ровно 9 эпох. Реальная рента ≈ 2 cell × 64962 × (9/365) ≈ **~3.2k нанотон**; с dict-overhead и буфером — `CAPSULEHUB_NULLIFIER_ENTRY_STORAGE_ENDOWMENT ≈ 50_000` **[G8]**, финализировать из измеренного `computeDataSize`.
**RT3-#6 инкорпорирован:** НЕ добавлять `CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE` (1M) per-nullifier — keepalive-флор уже даёт `CAPSULEHUB_MIN_PROTECTED_RESERVE_TON` (100 TON) + капсульные эндаументы. Per-nullifier терм = только измеренный endowment. Это срезает ~1.26M с `prepaidUnit`. **RT4-F5:** добавить lag-маржу к nullifier-эндаументу (эвикция может отставать на несколько батчей) — заложено в буфер 1.25×.

---

## 5. Финансирование storage БЕЗ custody + solvency-инвариант

### 5.1 Поток (prepaid-пул)
1. `credit_price` (CreditIssuer) = `prepaidUnit + FUNDING_FORWARD_GAS + RELAY_GAS_ALLOWANCE`, где **[G8, worst-case PUBLIC]**:
   ```
   prepaidUnit = protocolFee(PUBLIC=10M)
               + batchStorageReserveWithBuffer(PUBLIC)          = (1M + 9.4M)·1.25 = 13.0M
               + nullifierReserveWithBuffer(без keepalive)      = 50k·1.25         ≈ 0.063M
             ≈ 23.1M нанотон  (≈0.023 TON/кредит)               // пересчёт @64962 до seal
   ```
   Кредит kind-agnostic (слепая выдача не знает kind) → worst-case = PUBLIC (INTRO/PRIVATE дешевле).
2. `BuyCredits` (CreditIssuer) форвардит в Hub `FundAnonPool{credits_k [, epoch]}` (op `0x46414E50`).
3. Hub на `FundAnonPool`: `throwUnless(13611, sender()==credit_issuer_address)`; `throwUnless(13612, context().value >= credits_k * prepaidUnit + FUND_GAS)`; инкремент пула; шлёт `FundAnonPoolAck` (op `0x46414E41`).
4. На **spend** реле НЕ приносит эндаумент — деньги уже в балансе Hub. V4 перекладывает термы.

### 5.2 Расширенный protectedReserve (клампленый пул-терм, RT3-#1)
```tact
fun protectedReserve(): Int {
    let dyn = self.indexStorageReserve()                                  // существующий (private/public/intro/recovery)
            + self.nullifier_live_count * nullifierReserveWithBuffer      // ТЕРМ 1 (locked)
            + poolTerm();                                                 // ТЕРМ 2 (prepaid) — ниже
    let floor = CAPSULEHUB_MIN_PROTECTED_RESERVE_TON;
    if (dyn > floor) { floor = dyn; }
    return self.accrued_plato_fee_ton + floor;
}
// Вариант A: poolTerm = max(0, anon_credits_funded - anon_credits_spent) * prepaidUnit   // клампим (RT3-#1)
// Вариант B: poolTerm = anon_pool_outstanding * prepaidUnit                              // ≥0 by construction
```
`nullifierReserveWithBuffer = CAPSULEHUB_NULLIFIER_ENTRY_STORAGE_ENDOWMENT * 125/100` (без keepalive).

### 5.3 Spend-нейтральная перекладка (V4)
На spend PUBLIC-части: пул-терм −`prepaidUnit`(23.1M); locked += `perEntry(PUBLIC)·1.25`(13.0M) + `nullifier·1.25`(0.063M); accrued += `protocolFee(PUBLIC)`(10M). Сумма 23.1 = 13.0+0.063+10 (≈, финализ @64962) → `protectedReserve` не растёт, `myBalance` не меняется (реле принёс только газ). INTRO/PRIVATE: actual < prepaidUnit → разница → sweepable-излишек → `protectedReserve` только УМЕНЬШАЕТСЯ → solvency сохранён.
**protocolFee(kind) явно для ВСЕХ лейнов (RT6-MINOR-7):** PUBLIC=`PLATO_PUBLIC_POST_FEE_TON`, PRIVATE=`PLATO_PRIVATE_LONG_TERM_FEE_TON`, INTRO=`0` (или owner-заданный). accrued += protocolFee(kind) для СВОЕЙ полосы; дельта (prepaidUnit − actual) → sweepable, НЕ в accrued. Это фиксирует доходную модель (`FlushFees` выводит `accrued_plato_fee_ton`) вместо молчаливого дрейфа.

### 5.4 pool-solvency гвард + boundedness [IRREVERSIBLE — выбор A/B = OWNER-D3]
**RT3-#1/RT4-F3 (BLOCKER) закрыт в ОБОИХ вариантах:** Hub НЕ доверяет ack-гейту вслепую; локальный fail-closed гвард (13613) гарантирует, что компрометация issuer-ключа или дырявый ack-гейт деградируют из **solvency-drain** в **liveness/griefing** (пул НИКОГДА не уходит в минус, чужие эндаументы неприкосновенны).

- **Вариант A (простой, минимум immutable-surface):** счётчики `anon_credits_funded/spent`. Гвард V1: `spent + part_count <= funded`. Пул-терм клампится `max(0,·)`.
  - Остаток (RT3-#2): протухшие-непотраченные кредиты держат `(funded−spent)` завышенным → `poolTerm` МОНОТОННО растёт, форфейтнутые средства заперты в protectedReserve навсегда (не drain — деньги физически есть, но не sweepable/не reusable). INV-SOLV «Bounded» **амендится**: капсулы+nullifier'ы bounded; пул-терм bounded лишь кумулятивными продажами. Форфейтнутые средства = deadweight-lock.
- **Вариант B (рекоменд. для boundedness):** `funded_by_epoch`, `spent_by_epoch`, агрегат `anon_pool_outstanding`. Buyer ДЕКЛАРИРУЕТ epoch (unblinded, = коммитнутому в serial) на покупке → `FundAnonPool{credits_k, epoch}`. Гвард per-epoch в шаге 9: `spent_by_epoch[e] + 1 <= funded_by_epoch[e]` (тот же epoch, что в токене — иначе spend бьётся о свой же незафинансированный bucket → self-harm). Permissionless `ReclaimExpiredFunding{epoch}` (op `0x52454346`) декрементит `anon_pool_outstanding` на `(funded−spent)` эпох, вышедших из окна приёма (симметрично nullifier-эвикции, те же `EPOCH_ACCEPT_PAST/FUTURE`); форфейт → sweepable.
  - Плюсы: пул-терм **bounded** (только live-window эпохи), форфейт возвращается протоколу.
  - Минусы: +2 мапы +1 receiver +epoch-поле в `FundAnonPool` (больше immutable-surface); epoch-декларация раскрывает issuer'у КОАРС-epoch (≈ время покупки, уже известно из tx-timestamp → пренебрежимо).

**Рекомендация:** Вариант B — согласуется с clean-16-враждебностью к неограниченному росту (seal-blocker §143) и не запирает средства навечно; A проще и меньше surface. **OWNER-D3 обязателен до seal** (immutable).

### 5.5 FundAnonPool/Ack сбойные пути (RT3-#3) — со-обязательные CreditIssuer-правки
- **Ack потерян, а FundAnonPool принят** (`funded += k` закоммичен, подписи не выпущены): в Варианте B — reclaimed через `ReclaimExpiredFunding` после истечения; в Варианте A — форфейт-lock (тот же остаток, что 5.4-A). Выпуск подписей на CreditIssuer **строго идемпотентен** по publish-корреляции (не дважды на один fund).
- **FundAnonPool бонсит** (value < порога / Hub не sealed / газ): **обязательный bounce-handler на CreditIssuer** атомарно возвращает оплату покупателю. Без него средства застревают в CreditIssuer.
Это **seal-blocker ПАРЫ контрактов**, а не «отдельный айтем» (RT6-MAJOR-6).

### 5.6 prepaidUnit — единый источник + seal-gate равенства [IRREVERSIBLE, RT3-#4]
`prepaidUnit` (и слагаемые `protocolFee/perEntry/nullifierReserveWithBuffer`) — несущая константа ДВУХ иммутабельных контрактов. Разъезд фатален: `CI < Hub` → всё финансирование бонсит = тотальный liveness-break; `CI > Hub` → излишек утекает owner-sweep'у, не в backing.
**SEAL-GATE G-PREPAID** (по образцу G2 для 924): ассертить `prepaidUnit_CI == prepaidUnit_Hub` из СКОМПИЛИРОВАННЫХ обоих контрактов; вывести из одного источника (генератор Session-5, как уже пинит VPB2-константы). Ширина счётчиков — **`uint64`** (RT3-#7; при масштабе десятков тысяч юзеров/декады uint32 переполнился бы).

### 5.7 INV-SOLV
```
myBalance() - context().value  >=  protectedReserve()
```
- **FundAnonPool:** balance += k·prepaidUnit; пул-терм += k·prepaidUnit. Сохранён.
- **Spend:** balance неизменен; protectedReserve неизменен (PUBLIC) или уменьшен (дешёвые полосы). Держится по worst-case PUBLIC: `prepaidUnit >= perEntry(kind)·1.25 + nullifierReserveWithBuffer + protocolFee(kind)` ∀kind.
- **Eviction (капсула/nullifier):** live_count−− → эндаумент → sweepable.
- **Bounded:** капсулы (FIFO+retention) и nullifier'ы (insert+retention) bounded; пул-терм bounded **в Варианте B** (в A — амендмент 5.4-A).
- **ACK-reserve (§8):** держится строго при выполненном гварде 13613 (RT3 подтвердил).
**Обязательный тест (RT3-#4-catch):** `buy → SweepExcessReserve(попытка) → spend` — sweep НЕ выметает пул-терм.

---

## 6. Удаление author_wallet + замена PUBLIC-discovery [IRREVERSIBLE]

**Удаляется:** поле из корня (§2.1) и из `PublicCapsuleEntry`; `author_wallet` из `computeVaultPublicEntryUid` (1222/1658); адресный un-push в `evictExpiredPublic` (828–834); **обязательно** — из `PublicCapsuleEntryView` (330) и `get_public_entry` (1658–1660), иначе не компилируется (RT6-BLOCKER-1).

**Замена — канальный ключ = spend_pubkey токена (минимальный overhead):**
```
channel_id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pubkey)      // вместо hash(storeAddress(wallet))
```
- `publicAuthorKeyId(author)` → `publicChannelKeyId(spend_pubkey)` — тот же shape (734–736).
- `public_author_index` / push / `get_public_author_index` — структура не трогается, ключ = channel_id.
- `PublicCapsuleEntry.channel_id` хранится; UID использует channel_id.
- `public_profile_index` / `public_profile_head` / `profile_prev_link` — работают, кейятся по channel_id; эвикция (828–834) `publicChannelKeyId(entry.channel_id)`.
- `public_parent_index` (комментарии, по parentEntryId) — без изменений.

**Крипто-bind:** `spend_sig` (шаг 7) доказывает владение `spend_pubkey` → атрибуция канала крипто-связана, БЕЗ раскрытия кошелька плательщика/реле. `spend_pubkey` и так раскрыт на spend → использование как канального ключа НЕ добавляет нового раскрытия.

**Клиентский регресс атрибуции (RT6-BLOCKER-1):** `get_public_entry(...).channel_id` НЕ резолвится в `.ath`/аватар (в отличие от `author_wallet`). Клиентский слой атрибуции public-фида переходит с «кошелёк→.ath» на «channel_id → опциональный profile-пост». Профиль = добровольно-раскрытая идентичность (шаблон INTRO: identity в теле). Это **несущее клиентское изменение** — иначе автор постов исчезает из UI.

**Client `batch_uid` реконсиляция (RT6-MINOR-9):** `computeVaultPublicEntryUid` меняет домен (author→channel_id) → клиент, пересчитывающий UID для сверки эхо-`batch_uid`, ДОЛЖЕН обновить деривацию синхронно.

---

## 7. RECOVERY — отдельный лейн, self-funded [IRREVERSIBLE]

**Обоснование выноса:** RECOVERY = собственная K_root-durability, НЕ sender-anonymous (хранит свой кошелёк/ключ, уже в publish-tx). Прогон через токен-путь раздул бы `prepaidUnit` 200M-юнитом → убил экономику дешёвых полос.

```tact
message(0x50415243) PublishRecovery {          // "PARC", НОВЫЙ op
    bounce_id: uint64; bounce_tag: uint160; publish_id: uint256;
    part: Cell;                                 // тот же 784-бит CONV-кадр (header0 320, header1, body on-chain)
    owner_pubkey: uint256;
    owner_sig: ^(Slice as bytes64);             // ed25519 над recoveryDigest
}
```
- **Permissionless, self-funded:** приносит эндаумент (200M) в `msg.value` напрямую (custody нет). Solvency: `recovery_live_count * recoveryPerEntry·1.25` уже в `indexStorageReserve` (495). `throwUnless(13576, context().value >= batchStorageReserveWithBuffer(RECOVERY)+gas+ack)` только для НОВОГО слота (overwrite переиспользует, 1185–1192).
- **slotKey = `privateHeaderBucketKey(header0)`** = HKDF из K_root (секрет) — **НЕ меняем** (против P2-редеривации). Первичный захват невозможен by secrecy (256-бит выход).
- **Крипто-bind (заменяет доверенный author_wallet 1174):**
  ```
  recoveryDigest = H(RECOVERY_SLOT_DOMAIN ‖ slotKey ‖ h0 ‖ h1 ‖ bh)   // slotKey ДЕРИВИРУЕТСЯ из header0 → swap header0 меняет slotKey → owner_sig падает
  throwUnless(13571, checkSignature(recoveryDigest, owner_sig, owner_pubkey))
  ```
  первая публикация биндит `owner_pubkey`; overwrite: `throwUnless(13563, existing.owner_pubkey == owner_pubkey)` И валидный owner_sig.
- **ОБЯЗАТЕЛЬНО СОХРАНИТЬ существующие интегрити-проверки (RT6-MAJOR-3):** новый receiver ДОЛЖЕН удержать `requireExactPayloadCell(header0,h0)`, `(header1,h1)`, `(body,bh)` (сейчас 1164/1166/1167) + ИНК3 13559. Без `body.hash()==bh` реле переиздаёт с тем же `bh`, но мусорным `body` (тело хранится on-chain!) → K_root-блоб затирается навсегда. `recoveryDigest` включает h0/h1/bh → owner_sig покрывает header1 (griefing header1-swap закрыт).
- ACK → `sender()`.

**Спам:** self-funded 200M/слот + секретный slotKey → дорого и self-limited; эвикция через `EvictExpiredRecoverySlot` (3yr, существующая).

---

## 8. ACK → relay

Строки 1300–1312: `to: self.vault_address` → **`to: relay`** (захваченный `sender()` из A3).
```tact
nativeReserve(0, ReserveAtMost | ReserveAddOriginalBalance);   // держать ВЕСЬ pre-existing баланс, вернуть только incoming-остаток
message(MessageParameters{
    to: relay, value: 0, bounce: false, mode: SendRemainingBalance,
    body: CapsuleHubBatchAck{ publish_id, first_entry_id, part_count, batch_uid }.toCell()
});
```
**RED-TEAM-подтверждено (RT3 holds):** `nativeReserve(0, ReserveAddOriginalBalance)` держит весь баланс, существовавший ДО этого сообщения (⊇ prepaid-пул + все locked-термы, т.к. эндаумент предоплачен и уже был на балансе), и возвращает реле РОВНО его неизрасходованный газ-флоат. `reserve(protectedReserve())` был бы НЕВЕРЕН — вернул бы реле sweepable-излишек (утечка). Держится строго ПРИ выполненном гварде 13613 (§5.4). `bounce_id`/`bounce_tag` эхуются реле. `batch_uid` — клиентская сверка (домен PUBLIC-uid обновлён, §6).
**Приватность (RT5-MINOR):** ACK→relay публично связывает «релей R создал entry [N..N+part_count)». Отдельный линк-вектор при dedicated-реле; отражён в модели угроз (§11).

---

## 9. Как CapsuleHub получает issuer-slot pubkeys — Variant B (snapshot) [IRREVERSIBLE]

```tact
issuer_mirror: map<Int, IssuerSlot>;   // slot -> {pubkey, active, version}, форма CreditIssuer.tact:57-61
credit_issuer_address: Address;         // genesis-bound
message(0x48524B31) HubMirrorIssuerKey { slot: uint8; pubkey: uint256; active: Bool; version: uint32; }
```
- Зеркало заполняется на **genesis-bind** теми же ключами, что заморожены в `CreditIssuer.issuer_slots` (`CreditSealGenesis`).
- Пост-seal Replace/Revoke (`CreditIssuer.tact:157-177`) распространяются парным controller-authenticated `HubMirrorIssuerKey`. Правила:
  1. `throwUnless(13614, sender() == self.genesis_controller_address)`.
  2. **Монотонность:** `throwUnless(13615, incoming.version > issuer_mirror[slot].version)` (анти-reorder/replay).
  3. **Replace/Revoke применять к Hub ПЕРВЫМ** (Hub — точка траты) → минимизирует окно траты скомпрометированных токенов.
- Верификация (шаг 5) читает `issuer_mirror.get(slot)` синхронно/локально/атомарно/дёшево.

**SEAL-CEREMONY инвариант (RT6-MAJOR-6):** genesis-нумерация `version` зеркала Hub ДОЛЖНА БИТ-В-БИТ совпадать с `issuer_slots`-версиями CreditIssuer на seal (иначе первый Replace отвергается ИЛИ проскакивает). Зафиксировать общий genesis-снимок `(slot, pubkey, active, version)` для обоих контрактов; тест-инвариант сходимости версий **начиная с genesis**, не только «после Replace».

**Принятый остаток (RT1-MAJOR-3):** cross-tx не атомарен → ненулевое окно рассинхрона между Revoke в CreditIssuer и `HubMirrorIssuerKey`. Пока слот `active` в зеркале, токены утёкшего ключа тратятся. **Hub-first Revoke = ЖЁСТКОЕ правило governance-раннера** (не рекомендация) + обязательный инвариант-тест сходимости. Version-lease/heartbeat (авто-деактивация слота без свежего подтверждения) **отклонён** для immutable: застрявший heartbeat забрикал бы весь publish (liveness-риск > revoke-риск). Окно рассинхрона = residual для внешнего аудита (§11).

---

## 10. CONV / INTRO / RECOVERY-lane storage — подтверждение неизменности

CONV/PRIVATE (1075–1112) и INTRO (1113–1144) **не используют author_wallet** — анонимны by construction. НЕИЗМЕННЫ:
- 784-битный кадр, header0 320/336 бит, header1 240, bh; все `requireExactPayloadCell` интегрити-проверки; ИНК3-гварды (13519/13549/13559);
- opaque bucketKey-индекс CONV (`private_bucket_index`, D7-override), отсутствие индекса у INTRO;
- INTRO ephemeral_R + view_tag скан; FIFO low-water эвикция (851–899) + безусловный INTRO-sweep cap=4 (1285–1289);
- recipient-privacy (направленность = клиентский инвариант; identity INTRO в шифр-теле).

Меняется ТОЛЬКО authorization-обёртка: снят `sender()==vault`, добавлены per-part spend-token (§3) + nullifier. Заглушки геттеров `author_wallet: self.vault_address`(1456)/`myAddress()`(1436) компилируются, пока поле `vault_address` живо (косметика OWNER-D8). Эндаумент CONV/INTRO из того же prepaid-пула (дешевле PUBLIC → over-fund → sweepable margin, §5.3). RECOVERY-lane — §7.

---

## 11. HUB_BATCH_MSG_ROOT_BITS — re-pin

Пин `Vault.tact:323 = 924` жил ТОЛЬКО для тарификации форварда Vault→Hub (`Vault.tact:2116`). **Anon-путь permissionless (реле→Hub напрямую) → on-chain потребителя пина НЕТ → константа УДАЛЯЕТСЯ из `Vault.tact` целиком; G2-ассерт форвард-ширины снимается.**

Новый корень `PublishAnonBatch` (справочно, для клиент/реле fee-эстиматора):
```
op32 + bounce_id64 + bounce_tag160 + publish_id256 + kind8 + part_count8 + marketing-maybe1 = 529 бит
(было 924; −267 author_wallet, −128 protocol_fee_total; parts/tokens = refs, 0 корневых бит)
```
`529` подтверждён RT6. Ширина ФИКСИРОВАНА для всех kind (`parts`/`tokens` не-опциональны; `Cell?` marketing всегда эмитит 1 maybe-бит) → опасный сценарий CONTRACT_PLAN (`Address?`/переменная ширина → недооценка → bounce) СНЯТ (поле УДАЛЕНО, не сделано опциональным). Реле оценивает `getForwardFee`/`getComputeFee` над скомпилированным ABI перед отправкой. **Оба существующих теста, пинящих 924/G2 и `13500`/`sender()==vault`, УДАЛЯЮТСЯ** (RT6-MAJOR-5); `tests/helpers/vpb2.ts` переписывается под `PublishAnonBatch`+токены; release-evidence регенерится ([[release-evidence-rebaseline]]).

---

## 12. Клиентские несущие инварианты (лежат вне Hub, но обязательны для B3-цели)

Три из блокеров RT5 живут в КЛИЕНТЕ/CreditIssuer — иначе «выпадают» между контрактами:

**INV-C1 (RT5-BLOCKER-1) — эфемерность spend_pubkey per-lane [IRREVERSIBLE клиентский контракт]:**
- **PRIVATE, INTRO:** клиент ОБЯЗАН генерировать СВЕЖИЙ single-use `spend_pubkey` на КАЖДЫЙ credit. Переиспользование запрещено — иначе `spend_pubkey` становится стабильным on-chain якорем автора, линкующим все приватные капсулы (регресс несущей цели «сломать граф кто-кому», ради которой затевался редизайн). Hub НЕ может это форсить → чисто клиентская дисциплина + клиентский тест на не-переиспользование.
- **PUBLIC анонимный пост:** свежий `spend_pubkey` (синглтон-индекс, эффективно не-discoverable).
- **PUBLIC стабильный канал:** переиспользование `spend_pubkey` — ЯВНЫЙ opt-in, `nonce` разделяет токены; канал ЛИНКУЕМ by design (UI-предупреждение).

**INV-C2 (RT5-BLOCKER-2) — анонимный транспорт author→relay + анти-self-relay:** специфицировать обязательный Tor/mixnet транспорт author→relay (симметрично issuer-пути). Self-relay ⇒ relay-кошелёк == авторский ⇒ полная деанонимизация — допустим ТОЛЬКО когда автор сознательно жертвует анонимностью ради доставки; UI разделяет режимы. Реле = trusted-for-anonymity; модель угроз называет минимум независимых реле для приемлемого anon-set.

**INV-C3 (RT5-MAJOR-6) — funding-path:** покупать кредиты со СВЕЖЕГО несвязанного кошелька, профинансированного приватно (НЕ с identity-кошелька, держащего `.ath`/аватар/ATH). Blinding рвёт токен↔плательщик, но не покупку↔identity-плательщика.

**INV-C4 (RT5-MAJOR-5) — slot/epoch tagging:** клиент рандомизирует `slot` среди ВСЕХ активных слотов (не «назначенный»); issuer-протокол НЕ выдаёт под уникальным slot одному покупателю (иначе пассивный тэггинг). Требовать `active_slot_count ≥ N` постоянно.

**INV-C5 (RT5-MAJOR-4) — purchase→publish тайминг:** клиент вносит рандомизированную задержку spend внутри окна приёма; поощрять покупку впрок (ack-гейт форсит причинность buy→publish; узкое окно = свежая покупка = сильная корреляция).

**Прочее (RT5-MINOR):** `publish_id` CSPRNG-уникален; `credits_k` округлять до типовых значений (необычное k сужает ростер); `parentLink` public-тредов строит соц-граф псевдонимов (присуще threading — в модель угроз).

---

## 13. Tests-first план

Валидация — `npm test` (vitest.all.config.ts, single-worker; НЕ bare `npx vitest run` — [[canonical-test-command]]). Все — до имплементации.

**HUB-SPEND (spend-token верификация):**
- HUB-SPEND-01 валидный токен → publish OK; серия по лейнам.
- HUB-SPEND-02 **token-splicing (RT1-BLOCKER-1):** 2 части под одним spend_pubkey, реле переставляет (token_j, body_i) → `spend_sig` падает 13605. КРИТИЧЕСКИЙ.
- HUB-SPEND-03 issuer_sig под чужим слот-ключом / replay на другой serial → 13603 (гейт BLIND-CHECKSIG-02).
- HUB-SPEND-04 serial-коммитмент: подмена раскрытого spend_pubkey/epoch/nonce → 13601.
- HUB-SPEND-05 sig-malleability: флип байта подписи не создаёт двойную трату (nullifier keyed на serial, не на sig).
- HUB-SPEND-06 slot>15 / inactive slot → 13602.
- HUB-SPEND-07 body/header corruption реле: подмена body при том же bh → существующий requireExactPayloadCell 13517/13518 (сохранён).
- HUB-SPEND-08 ISSUER_SIG_DOMAIN в прообразе serial (RT1-MINOR-4).

**HUB-NULLIFIER (double-spend + эвикция):**
- HUB-NULLIFIER-01 intra-batch дубль (2 части, один serial) → 13604 на 2-й части.
- HUB-NULLIFIER-02 cross-tx дубль (два реле) → второй 13604.
- HUB-NULLIFIER-03 **retention граница (RT2-F1/RT4-F1):** insert@epoch=X; `now=t_insert+RETENTION−1` → replay 13604 + окно принимает; `now=t_insert+RETENTION` → nullifier evictable + окно 13600 отвергает. Плюс earliest(E−PAST)/future(E+1).
- HUB-NULLIFIER-04 **анти-стойло (RT4-F1):** смешанный трафик эпох [E−7..E+1], future-head флуд → эвиктор НЕ застревает, `nullifier_live_count` не растёт неограниченно (замер max live_count).
- HUB-NULLIFIER-05 **пропускная способность (RT4-F2):** устойчивый 8-парт поток → live_count стационарен (fold part_count+margin ≥ insert).
- HUB-NULLIFIER-06 standalone `EvictExpiredNullifiers` дренит backlog; cap=32.
- HUB-NULLIFIER-07 fail-closed: недофинанс V2/битый батч откатывает nullifier-insert (токен сохранён).

**HUB-PERMISSIONLESS (снятие gate + газ):**
- HUB-PERM-01 произвольный sender с валидными токенами → OK (gate снят).
- HUB-PERM-02 sender без токенов / битый токен-список → revert, баланс Hub нетронут.
- HUB-PERM-03 `len(tokens) != part_count` короткий/длинный → 13609 (RT2-F2/RT6-8).
- HUB-PERM-04 **G-GAS (RT4-F4):** замер `getComputeFee` worst-case 8-парт PUBLIC vs config-21 gas_limit; определяет `MAX_BATCH_PARTS_ANON`. SEAL-GATE.

**HUB-ANON (анонимность):**
- HUB-ANON-01 удаление author_wallet: PUBLIC-запись/индекс/UID без адреса; channel_id-путь.
- HUB-ANON-02 **эфемерность (INV-C1):** клиентский тест — private-lane spend_pubkey не переиспользуется; линковка отсутствует.
- HUB-ANON-03 nullifier→purchase не линкуется (issuer слеп к serial).
- HUB-ANON-04 (внешний крипто-гейт) **UNLINKABILITY выдачи (RT5-BLOCKER-3):** issuer при concurrent-выдаче не линкует serial↔сессию + ROS/Wagner-стойкость clause-blind. ОТДЕЛЬНЫЙ от verify-гейта. SEAL-BLOCKER.
- HUB-ANON-05 slot/epoch tagging (INV-C4): равномерное распределение по активным слотам.

**HUB-RECONCILE (компиляция + cross-contract):**
- HUB-RECON-01 контракт КОМПИЛИРУЕТСЯ: `PublicCapsuleEntryView`/`get_public_entry` (channel_id), `RecoveryCapsuleView`/`get_recovery_capsule` (owner_pubkey) — RT6-BLOCKER-1/2.
- HUB-RECON-02 новый op `0x50415542` не путается со старым; старые тесты 924/13500 удалены; vpb2.ts переписан.
- HUB-RECON-03 genesis version-сходимость зеркала Hub ↔ CreditIssuer.issuer_slots (RT6-MAJOR-6); после каждого Replace/Revoke `(pubkey,active,version)` сходятся.
- HUB-RECON-04 FundAnonPool sender-gate (13611)/value-gate (13612); FundAnonPoolAck.
- HUB-RECON-05 CreditIssuer bounce-handler на FundAnonPool возвращает оплату; идемпотентный выпуск (RT3-#3).
- HUB-RECON-06 G-PREPAID: `prepaidUnit_CI == prepaidUnit_Hub` из скомпилированных обоих (RT3-#4).

**HUB-SOLVENCY (funds-safety):**
- HUB-SOLV-01 **pool-solvency гвард (RT3-#1/RT4-F3):** unfunded spend (spent+part_count > funded) → 13613, чужие эндаументы нетронуты.
- HUB-SOLV-02 **prepaid vs sweep (RT3-#4):** `buy → SweepExcessReserve(попытка) → spend` — sweep не выметает пул-терм.
- HUB-SOLV-03 spend-нейтральность: PUBLIC-перекладка не двигает protectedReserve/myBalance; INTRO/PRIVATE → sweepable margin.
- HUB-SOLV-04 boundedness (Вариант B): `ReclaimExpiredFunding` декрементит пул за истёкшие эпохи; в Варианте A — тест фиксирует форфейт-lock как принятый.
- HUB-SOLV-05 ACK-reserve: реле получает только газ-флоат, не sweepable-излишек (§8).
- HUB-SOLV-06 RECOVERY self-funded: новый слот требует эндаумент; overwrite не требует повторно; `body.hash()==bh` защищает блоб (RT6-MAJOR-3).
- HUB-SOLV-07 nullifier-эндаумент @64962 без keepalive покрывает 9-эпоховую ренту + lag-маржу (RT3-#6/RT4-F5).

---

## 14. Reconciliation ledger (диспозиция всех находок)

**Инкорпорировано (изменение формы отмечено):**
- RT1-BLOCKER-1 → §3.3 (serial в spendDigest, via frameCommit).
- RT1-BLOCKER-2 → §11-residual + INV-C1-retry (клиент ретраит проваленный батч на НОВЫЙ serial/nonce; serial-bind низводит атаку до verbatim-replay, ограниченного nullifier'ом).
- RT1-MAJOR-3 → §9 (Hub-first Revoke жёсткое правило + тест; version-lease ОТКЛОНЁН — liveness-риск).
- RT1-MINOR-4 → §3.2 (ISSUER_SIG_DOMAIN).
- RT1-MINOR-5 → INV-C1 (клиентское требование корректных ed25519; on-chain low-order reject ОТКЛОНЁН как self-harm-only, лишний immutable-код).
- RT2-F1 → **супер­седирована RT4-F1** (insertion-time устраняет отдельный «+1»; единый операнд RETENTION). Граничный тест сохранён (HUB-NULLIFIER-03).
- RT2-F2 / RT6-8 → V0 (13609 + cursor-exhaustion).
- RT2-F3 → устранена RT4-F1 (seq==expiry order).
- RT3-#1 / RT4-F3 → §5.4 (гвард 13613 + кламп).
- RT3-#2 → §5.4 OWNER-D3 (A forfeiture / B bounded-reclamation; INV-SOLV амендмент).
- RT3-#3 → §5.5 (CreditIssuer bounce-handler + идемпотентность; seal-blocker пары).
- RT3-#4 → §5.6 (G-PREPAID seal-gate).
- RT3-#5 / RT4-F2 / RT6-MAJOR-4 → §4.2 (fold = part_count+margin).
- RT3-#6 → §4.4 (nullifier endowment без keepalive).
- RT3-#7 → §5.6 (uint64 счётчики).
- RT3-#8 → §5.1 [G8] (marketing-cell в perEntry(PUBLIC) через computeDataSize).
- RT4-F1 → §4 (insertion-time retention) — несущая реконсиляция.
- RT4-F4 → §3.5 (G-GAS seal-gate, может урезать MAX_BATCH_PARTS_ANON).
- RT4-F5 → §4.4 (lag-маржа + индекс-cell в perEntry [G8]).
- RT4-F6 → OWNER-D5 (profile-head chain bloat; экономический флор credit-cost ограничивает, но не bound'ит — owner: профили opt-in/funded-limit или client-side discovery).
- RT5-BLOCKER-1 → INV-C1 (эфемерность per-lane).
- RT5-BLOCKER-2 → INV-C2 (транспорт + анти-self-relay).
- RT5-BLOCKER-3 → HUB-ANON-04 (UNLINKABILITY крипто-гейт, SEAL-BLOCKER) + OWNER-D4 (anon-set порог).
- RT5-MAJOR-4/5/6 → INV-C5/C4/C3.
- RT5-MINOR → §12 (publish_id CSPRNG, credits_k rounding, parentLink граф, ACK→relay линк).
- RT6-BLOCKER-1/2 → §2.3 (views + getters, компиляция).
- RT6-MAJOR-3 → §7 (сохранить requireExactPayloadCell в новом RECOVERY-receiver).
- RT6-MAJOR-5 → §2.1/§11 (bump op, удалить старые тесты/vpb2, regen evidence).
- RT6-MAJOR-6 → §5.5/§9 (CreditIssuer co-mandatory, genesis version sync).
- RT6-MINOR-7 → §5.3 (protocolFee(kind) явно ∀лейн).
- RT6-MINOR-9 → §6 (client batch_uid reconcile).
- RT6-MINOR-10 → §3.6 (разведённые коды).

**Отклонено (с причиной):**
- RT1-MAJOR-3 version-lease/heartbeat — авто-деактивация слота на immutable создаёт liveness-брик при застрявшем heartbeat (риск > покрываемого).
- RT1-MINOR-5 on-chain low-order-point reject — вред только своему токену, не системный форж; лишний immutable-газ/код.
- RT1/DRAFT «добавить body.hash()==bh (шаг 6)» — переформулировано: НЕ добавить, а СОХРАНИТЬ (уже есть в lane-parse via requireExactPayloadCell 1098/1133/1167/1221).

**Подтверждено держащимся (не трогать):** slot-selection-by-sig, nullifier-по-serial (обезвреживает malleability), serial↔spend_pubkey bind, epoch-field spoofing, cross-epoch reuse, anti-pre-burn, intra-batch, §8 ACK-reserve mode, FundAnonPool sender-gate, HUB_BATCH_MSG_ROOT_BITS=529 арифметика, CONV/INTRO storage-путь по авторству.

---

## 15. OWNER-решения (immutable) + residual-риски для внешнего аудита

**OWNER-решения до seal [IRREVERSIBLE]:**
- **OWNER-D1 (governance-конфликт треков):** `PLATHO_CLEAN16_HYBRID_CLOSED_SPEC.md:61` (author_wallet fixed `Address`+sentinel ∀kind, «ЗАКРЫТ+ПОДПИСАН») ПРОТИВОРЕЧИТ B3 (drop). CLOSED_SPEC писался ДО permissionless-пивота; sentinel снимается тем, что Vault больше не форвардит корень. Требуется явное governance-согласование двух треков (не решаю односторонне).
- **OWNER-D2 (legacy Vault-lane):** сохранить ли старый `receive(PublishBatchToHub)` параллельно на время миграции (отдельный op, без конфликта) или удалить сразу. По умолчанию — удалить.
- **OWNER-D3 (пул-модель A/B):** forfeiture-counter (простой, меньше surface) vs epoch-bucketed reclamation (bounded, вернуть форфейт протоколу). Рекоменд. B.
- **OWNER-D4 (anon-set):** минимальный k-anonymity порог + баланс окна `EPOCH_ACCEPT_PAST/FUTURE` (узкое = security/replay-леджер, широкое = anon-set/UX «токен сгорит за N суток»). «Цена кредита ↑ ⇒ anon-set ↓» — явный tradeoff.
- **OWNER-D5 (profile discovery):** профили opt-in/funded-limit vs client-side.
- **OWNER-D6 (kind-agnostic overpricing):** единый worst-case-PUBLIC кредит (простота+анонимность типа) vs kind-scoped (точность, лёгкая деанонимизация типом). Рекоменд. единый.
- **OWNER-D7 (константы @64962):** финализировать все [G8] из измеренного `computeDataSize`; L3-эндаумент-подъём откатить ([[ton-storage-rate-frozen]]).
- **OWNER-D8:** косметика `PrivateCapsuleEntryView.author_wallet` (оставить заглушку/убрать).

**Residual-риски для внешнего аудита:**
1. **Компрометация issuer-ключа = массовый минт валидных токенов** — держится на off-chain custody + скорости revoke; зеркало cross-tx не атомарно (§9-окно). Гвард 13613 (§5.4) низводит из solvency-drain в liveness/griefing (пул не в минусе). Крупнейший системный риск.
2. **UNLINKABILITY выдачи (HUB-ANON-04)** — существующий гейт `blind-schnorr-checksig` доказал только VERIFY (accept/reject), НЕ unlinkability и НЕ ROS/Wagner-стойкость concurrent-выдачи. Анонимити-фундамент на непроверенном свойстве — **SEAL-BLOCKER**, отдельный крипто-гейт обязателен.
3. **Anon-set на launch** — структурная зависимость от ликвидности покупок в окне; на низком объёме ≈1. НЕ transient (design-for-launch-scale) — OWNER-D4 + client k-anon.
4. **Relay = оракул деанонимизации + может молча drop'нуть** — on-chain фикса нет; множественность реле/self-relay-awareness (INV-C2). Анонимность куплена ценой «хоть один реле довезёт».
5. **Мирор-desync окно (§9)** — принятая цена (design §9); Hub-first Revoke + тест минимизируют.
6. **Форфейт-lock (Вариант A, §5.4)** — при OWNER-D3=A средства протухших кредитов заперты навсегда (не drain).
7. **G-GAS (§3.5)** — если worst-case 8-парт PUBLIC > config-21 → урезать MAX_BATCH_PARTS_ANON; замер обязателен до seal.

**Крипто-фундамент (verify-часть) подтверждён:** оба `checkSignature` (issuer_sig над serial, spend_sig над spendDigest) — стандартный ed25519, нативный TVM-опкод (BLIND-CHECKSIG-01/02). Конвенции: M=32-байт BE int, pubkey=BE int, sig=R(32)‖s(32 LE) в `Slice as bytes64` (образец `KeyRegistry.tact:380,53`).