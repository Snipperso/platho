# PLATHO clean-16 — МАСТЕР-РОАДМАП (единый источник, чтобы ничего не забыть)

> **clean-17 (ШАРДИНГ) в работе** — монолит запечатать нельзя (потолок ~182 юзера). Сводный дизайн шардовой архитектуры + seal-гейты: `artifacts/PLATHO_CLEAN17_SHARDED_SPEC.md`. Ончейн-прототип реализован и под тестами (8 коммитов, 34 теста), НЕ запечатан.


Собрано 2026-07-16 (exhaustive-сверка памяти + артефактов + git). Легенда статусов:
**✅ DONE** (реализовано; часть ещё НЕ ЗАКОММИЧЕНА) · **○ PENDING** · **💀 KILLED** (снято поздним решением — НЕ делать) · **👤 OWNER** (нужно твоё решение) · **🔒 SEAL-BLOCKER** (обязательно до immutable-seal).

Закоммичено на ветке clean-12:
`deaa0448` L6 (#18/#15/#10) → `69614515` UsernameRegistry-freeze → `1644a883` ProfileRegistry-freeze → `636d0399` анон-публиш крипто-гейт.
⚠️ **ВСЯ recipient-privacy крипта (Фазы 0/1/3) + контракты ИНК1-6 — ЕЩЁ НЕ ЗАКОММИЧЕНЫ** (зелёные, но в рабочем дереве/прошлых сессиях).

---

## КРИТИЧЕСКИЙ ПУТЬ (спина от «сейчас» до sealable clean-16)

- **A. Разморозка живого clean-15** — ⚠️ **ПЕРЕОЦЕНЕНА ЭМПИРИЧЕСКИ 2026-07-16, ДЕ-РИСКНУТА** (см. блок «ФАЗА A — эмпирика» ниже). Посылка роадмапа «без фикса #1 балансы не вернуть» ОПРОВЕРГНУТА: живой Vault = **5 юзеров** (trie ~2-3 уровня), #1-кроссовер = сотни тысяч → вывод РАБОТАЕТ штатно, «последний форк»/фикс-#1-редеплой **НЕ нужен**. Фаза A = просто дренаж (each юзер жмёт withdraw, UI живой) у cutover, потом clean-16. Больше НЕ несущий блокер-«первым».
- **B. Контракты Vault-elimination + anon-relay:** rebuild CapsuleHub publish (снять `sender()==vault`, permissionless ingest БЕЗ author_wallet, 2×checkSignature issuer+spend, epoch-nullifier, ACK→sender) + новый frozen **KeyRegistry** + новый **CreditIssuer** (8-16 issuer-слотов) + RECOVERY wallet-bind→seed-auth_pubkey+version.
- **C. Реконсиляция + коммит** незакоммиченной recipient-крипты (Фазы 1/3) + ИНК1-6, сверив с anon-publish: author_wallet выброшен → перепинить `HUB_BATCH_MSG_ROOT_BITS=924` + G2 из ABI (спек §2 больше не держит 924 стабильным).
- **D. Клиент (Фаза 2):** (крит) ретрив prefs на self-bucket-scan; capsulehub-rpc-provider на 14-полёвый view + bucketKey-walk; CONV/INTRO send/receive + окно W=2сут + decoy + ротация RPC; re-INTRO K_root adoption; contacts UNION-merge + пагинация; avatar/username direct-pay; credit purchase/blind/Tor-relay/spend.
- **E. Чистка мёртвого кода:** dead vault-поля в обоих реестрах; удалить inert Vault-externals.
- **F. Заморозить OWNER-решения (все ДО чисел):** RECOVERY retention 3г vs 10л; RECOVERY max-size + on-chain vs hash; #15 treasury+grace+floor; семейство миграции A/B; airdrop; spam-политика; состав multisig #9.
- **G. ИНК7/G2-генератор:** ре-пин 3 header0-шейпов (PUBLIC576/CONV320/INTRO336) + 4 HUB_PART_GAS_* + STORAGE_RESERVE_* из ABI зеркально Hub↔Vault; красный тест на остаточный 592.
- **H. Экономика @64962:** ОТКАТИТЬ излишний L3-подъём эндаументов (кроме username=ровно 1 TON); пересчитать ВСЕ из измеренного `computeDataSize`; nullifier-solvency число; 3 refinements recovery #12.
- **I. ИНК8/L9 G8-калибровка:** combo worst-case ОТДЕЛЬНО по 4 kind (8×32K + intro-sweep), детерминизм 13530-bounce, финализация ВСЕХ provisional-пинов.
- **J. SEAL-гейты (обязательные, НЕ авто-деплой):** внешний ANO-CCA/key-privacy аудит ML-KEM гибрида; аудит storage-экономики 20-100лет×миллионы; G8 pre-accept газ на ЖИВОМ code.boc; on-chain 2×checkSignature интеграционный тест; funds-safety тест.
- **K. Финализация seal:** code-hash re-lock + economics-regen + release-evidence (только генуинно зелёный npm test) + web-deploy-prep.
- **L. Церемония:** BindBuybackTreasury (owner называет казну) → immutable genesis seal (deployment_id bump форкает весь набор на тех же vanity-кошельках).

---

## ФАЗА A — ЭМПИРИКА ЖИВОГО clean-15 (снято с mainnet 2026-07-16)

Живой Vault `UQAFsNc952nbwLMDfHqXExkgn1lipVzNndbNQKBfHEIEe5Zy` (генезис 2026-07-07). Снято через toncenter-ключ (`artifacts/local/center.txt`, 10rps), скан 826 транзакций + `get_global`/`get_user`.

**Состояние:** `user_count = 5`, on-chain баланс 27.05 TON, own-reserve (не кастодиал) ~2.65 TON. **Кастодия: 24.40 GRAM + 1650 ATH.** По-юзерно:

| # | Кошелёк | GRAM | ATH | активность |
|---|---------|------|-----|-----|
| 1 | UQAQiosr7g0JJ2YYjAH7-_WOUXd7C5viseyVzX-1n-ap0WLp | 5.03 | 60 | nonce 28 |
| 2 | UQB0ESLo9QUOaibPSK3HzNas8dZhRHMeXLtJVpiE3UsRVwjU | 4.77 | 530 | nonce 87 |
| 3 | UQARcd16b38GS-UT0mEYIoRZNp_Bp7EZv1lpC2-IC3KrCGIN | 7.17 | 90 | nonce 42 |
| 4 | UQB-HJoyY2p0UfGgWS4H0gWtmK34S620mZT_pMESvd2xVUtj | 2.98 | 230 | nonce 36 |
| 5 | **UQDU48m_nYC12oqHJnKG9nBE4ljGpUYHHLPS-owij9BEOATH (Edge-кошелёк владельца)** | 4.45 | 740 | nonce 223 |

Claude's кошелёк (UQAnHZE9…) НЕ юзер clean-15 (активировался на до-clean-15 контрактах).

**ВЫВОД РАБОТАЕТ:** `WithdrawTonFromVaultBalance` (0x7E1F5038) + `WithdrawAthFromVaultBalance` (0x7E1F5039) — внешние, подписаны ключом юзера; UI живой в app.js (`vault-withdraw-ton`/`-ath` → `submitVaultWithdrawTon/Ath`). При N=5 pre-accept газ #1 на порядки ниже кроссовера. **Дренаж = each юзер жмёт «вывести».** Я исполнять не могу (фин-перевод прибит + нет ключей тестеров).

**ATH переживёт clean-16 нативно** (ATHMaster заморожен): `WithdrawAth` кладёт ATH в СОБСТВЕННЫЙ ATHWallet юзера. Реально дренировать до форка нужно только 24.40 GRAM (кастодиальны в самом Vault).

**Залипший pending username-mint (count=1) — РАЗРУЛЕН = безвреден.** Трассировка 9 минтов: 8 → ACK (успех), 9-й `project_eva` (юзер #1, 100 ATH) → ack потерялся. НО в реестре `get_name_record("project_eva").exists=true` (NFT `UQD2QKYu…`, minted 2026-07-13, registry-pending=false). Юзер владеет NFT, 100 ATH потрачены корректно; завис лишь счётчик Vault (1 ≪ cap 65535). Immutable → вычистить нельзя и не нужно; исчезнет при форке. **Это ровно класс отказа, что чинит clean-16 #18 `PruneStuckAthPending` → валидация #18 на живых данных.**

**OWNER-решение по дренажу (открыто):** (a) дренировать всех 5 у cutover [реком.], (b) только владелец + тестеров принять как тест, (c) отложить весь дренаж на пред-cutover (безопасно — вывод работает). Runbook: клиент-гейт новых депозитов + «migration modal» → each withdraw → мониторить get_global→0 → clean-16.

---

## ВОРКСТРИМ 1 — Recipient-privacy: две-лейна CONV/INTRO/RECOVERY (крипта + ИНК1-8)

**✅ DONE (не закоммичено, кроме отмеченного):** Фаза 0 заморозка инвариантов (header0 PUBLIC576/CONV320/INTRO336, пины BUCKET_MAX=32/INTRO_SWEEP=4/W=2, деривация bucketKey/K_root/K_epoch) · Ф1.1 scan-key-from-seed (HKDF info заморожена; 11/11) · Ф1.2-1.4 CONV key schedule (ML-KEM инкапс, ct_root, направленный computeBucketKey, self-lane; 10/10) · Ф1.5 INTRO-хендшейк (транскрипт, sign-after-decrypt, PIH1, anti-replay; 11/11) · Ф3 header0-split + сборка/открытие CONV+INTRO (48/48) · adversarial-review (4 must_fix, 62 теста) · Vault-биндинг-гейт первого контакта · ИНК1 opaque-bucket рефактор Hub · ИНК2 header0-форк 320/336 Hub+Vault зеркало · ИНК3 meta-assert 13519 · ИНК4 INTRO лейн kind=3 · ИНК5 funds-safety intro-терм · ИНК6 RECOVERY-пул kind=4 (Recovery-B, механика done, числа открыты).

**○ REMAINING:**
- 🔒 **ИНК7/G2-генератор** — ре-пин 3 header0-шейпа + 4 HUB_PART_GAS_* + STORAGE_RESERVE_* из ABI, красный тест на остаточный 592 и рассинхрон Hub↔Vault (необратим → 13530-bounce → permanent liveness-break).
- 🔒 **ИНК8/L9 G8-калибровка** — combo worst-case по 4 kind, детерминизм 13530, финализация provisional-пинов @64962; перемерить CONV/INTRO/RECOVERY эндаументы.
- ○ Реконсиляция ИНК1/ИНК4 с anon-publish: author_wallet выброшен → перепинить HUB_BATCH_MSG_ROOT_BITS=924 + G2.
- ○ **Закоммитить** всю незакоммиченную работу Фаз 0/1/3 + ИНК1-6.

## ВОРКСТРИМ 2 — Клиент app-wiring (Фаза 2)

**○ REMAINING (ничего не сделано):**
- 🔒 Ретрив prefs (app.js:9737) → self-bucket-scan (висит на УДАЛЁННОМ recipient-index → сломан; без него D2-recovery не стартует → потеря переписки на immutable).
- 🔒 re-INTRO K_root adoption — при подключении CONV/INTRO клиент ОБЯЗАН адоптировать новый попарный K_root last-writer-wins (иначе CONV молча десинк); тест обязателен.
- 🔒 capsulehub-ton-rpc-provider — жёстко ждёт 15-полёвый view (стало 14) → каждое чтение hard-throw; bucketKey-walk вместо sender/recipient-index.
- ○ CONV send/receive wiring (computeBucketKey; окно W=2сут через batch-геттер + decoy + ротация toncenter + keyless fallback; сейчас grep kRoot|bucketKey|CONV|INTRO=0).
- ○ resolveVaultKeyRecord биндинг-гейт через getKeyRecord-провайдер.
- ○ contacts UNION-merge по peerKeyId + tombstone-only удаление (иначе whole-snapshot клоббер K_root между устройствами).
- ○ Аддитивное безусловное восстановление K_root (отдельно от subscription-auto-apply гейта).
- ○ Пагинация contacts (single-snapshot капается ~200-300; таргет сотни; тест 500).
- ○ INTRO send author_wallet=SENTINEL, publishKind=3 (чисто клиентское).
- ○ nice: bucketKey ВНУТРИ createEncryptedConvCapsule (epoch↔createdAt скью by construction).
- ○ avatar-set → direct-pay (сейчас зовёт retired Vault-external → аватар не ставится; withdraw ATH→свой кошелёк + own-wallet op 0x4154481A).
- ○ username → direct-pay (контракт backward-compat; можно позже).
- ○ anon-relay: buy credits + blind/unblind + Tor-relay publish + spend (2-sig); глубина ликвидности кредитов против anon-set collapse.

## ВОРКСТРИМ 3 — Durable-Core / Миграция

**✅ DONE:** UsernameRegistry FREEZE (69614515, 72 теста) · ProfileRegistry FREEZE (1644a883, PROFILE-12/12B) · PIVOT eliminate-Vault-custody (вердикт SHRINK_VAULT_TO_KEYREGISTRY — KILLS #1-6) · full-anonymity направление (blind-token anon-relay) · accept ROSTER + build · successor REPLACEABLE (one-shot 15052 убран).

**○ REMAINING:**
- 👤 ATH FREEZE — решение принято; остаток = verify ATHMaster code-hash перед seal + дисциплина non-bump deployment_id токена на будущих редеплоях.
- 👤 Успессор announce-only (клиенты верифицируют out-of-band).
- 👤 Семейство миграции A (freeze/invisible) vs B (burn-and-remint) — per-redeploy; clean-16 = минимальный фундамент, burn→claim в clean-17.
- ○ Migration primitive gaps — НЕТ: username burn/release, registry-accepts-new-Vault, successor-awareness на токене/реестрах, ATHMaster ongoing-mint.
- ○ Dead vault-field cleanup в ОБОИХ реестрах (vault_address/vault_bound/BindVault + seal-checks; seal ещё требует vault_bound).
- ○ Vault cleanup — удалить retired identity-mint externals.
- ○ End-state topology = custody-removal + reg-freeze + KeyRegistry; цель clean-16→17 = МИГРАЦИИ.

## ВОРКСТРИМ 4 — Vault-elimination + анонимный релей (anon-publish BUILD)

**✅ DONE:** Крипто-гейт — clause-blind-Schnorr над ed25519 проходит РЕАЛЬНЫЙ TVM checkSignature (636d0399; 40 токенов, forgery/replay отвергнуты; ROS-resistant 2-session; conventions заморожены). ЗАКРЫЛ pre-seal крипто-прототип блокер.

**○ REMAINING:**
- ◐ **KeyRegistry** — новый frozen 4-й Durable-Core. **ПЕРВЫЙ СРЕЗ ГОТОВ+ЗЕЛЁНЫЙ** (`contracts/KeyRegistry.tact` + `tests/keyregistry.test.ts`, 12/12): lifecycle (seal/requireSealed/controller-only/one-shot) + register (sender-auth+validate, double/underfunded reject) + rotate (DELETE-ON-ROTATE как Vault: net-zero, старый удалён, новый generation, wrong-key/replay/domain reject) + privacy-инвариант (auth_pubkey никогда в геттере). Дизайн: `artifacts/PLATHO_CLEAN16_KEYREGISTRY_DESIGN.md` (SHRINK_VAULT_TO_KEYREGISTRY; scan_pubkey добавлен, НЕ в keyId; spilled actionPayload/keyFields под 1023-бит лимит). Ошибки/пины (эндаумент 30M/10M/2M/100M, base-rent #19, reserve-флор, dormant-эвикция, revoked_lt-чек) = G8/audit-провизорны. TODO: тесты KEYREG-ECON + #4 dormant + client revoked_lt на аудит.
- ◐ **CreditIssuer** — **ПЕРВЫЙ СРЕЗ ГОТОВ+ЗЕЛЁНЫЙ** (`contracts/CreditIssuer.tact` + `tests/creditissuer.test.ts`, 16/16): freeze-lifecycle (upload issuer-ключей + set price → SealGenesis требует slots∈[8,16]+active≥8+price>0, one-shot) + issuer-слоты `{pubkey,active,version}` + **controller-gated Replace/Revoke** (owner-решение: recourse при компрометации, согласуется с #9) + BuyCredits (permissionless, value≥k×price, покупки НЕ в состоянии — в теле tx, redeem_pubkey анти-front-run) + пул-счётчики. Дизайн: `artifacts/PLATHO_CLEAN16_CREDITISSUER_DESIGN.md`. Провизорно (G8/B3): credit_price, MAX_PER_BUY, base-rent, пул→Hub DrainPoolToHub. Спенд-верификация (issuer+spend sig + nullifier) — в Hub (B3).
- ◐ **Rebuilt CapsuleHub publish (B3)** — **ЗАКРЫТЫЙ ДИЗАЙН ГОТОВ** (workflow 15 агентов, red-team 6 поверхностей): `artifacts/PLATHO_CLEAN16_B3_HUB_ANONPUBLISH_DESIGN.md`. Несущее: publish=INTERNAL от relay (не external — реле платит газ из msg.value, reserve Hub нетронут на спаме); финансирование=предоплаченный пул (buyer→CreditIssuer→Hub, реле только газ); 2×checkSignature (issuer над serial + spend над spendDigest=serial‖kind‖frameCommit — закрывает token-splicing BLOCKER); epoch-nullifier (retention по insert_time → FIFO-эвикция корректна by construction, solvency доказана); author_wallet СНЯТ → PUBLIC-discovery через channel_id=H(spend_pubkey), RECOVERY→свой self-funded лейн с owner_sig; ACK→relay; issuer-ключи=genesis-снапшот-зеркало в Hub (version-монотон). **СО-ОБЯЗАТЕЛЬНЫЕ правки CreditIssuer** (B2): FundAnonPool-форвард + bounce-handler + prepaidUnit-equality seal-gate. **OWNER-D1..D8** (immutable, §15). **D1 РЕШЁН (owner: B3 замещает), D3 РЕШЁН (пул B).**
  **РЕАЛИЗАЦИЯ В РАБОТЕ (Stage 3a ЗАВЕРШЁН + ПРОВАЛИДИРОВАН; регресс-свип 140 passed, 3 failed = ровно известные не-B3):**
  - ✅ Стадия 1 (каркас): B3-константы + сообщения (PublishAnonBatch/PublishRecovery/FundAnonPool/HubMirrorIssuerKey/BindCreditIssuer/EvictExpiredNullifiers/ReclaimExpiredFunding) + структуры (IssuerSlot/NullRec) + поля контракта (issuer_mirror/nullifier-леджер/пул Variant B) + init.
  - ✅ Стадия 2 (примитивы+ресиверы): computeSerial/nullifierKey/spendDigestPrivate+Public/publicChannelKeyId/insertNullifier/evictNullifiersFIFO/verifyIssuerToken/spendPoolCredit + provod poolTerm+nullifier в protectedReserve + 5 ресиверов (BindCreditIssuer/HubMirrorIssuerKey/FundAnonPool[keep-backing+ack]/EvictExpiredNullifiers/ReclaimExpiredFunding) + seal требует credit_issuer_bound.
  - ✅ **Стадия 3a (главный receiver CONV+INTRO + валидация)**: `receive(PublishAnonBatch)` для PRIVATE(CONV)+INTRO — token-parse (616-бит узел, refs-count = tokens-len гвард 13609) → verifyIssuerToken → сохранённый lane-parse (13510-13548, requireExactPayloadCell вербатим) → spend_sig (13605) → spendPoolCredit (per-epoch 13613) → insertNullifier → evictNullifiersFIFO(part_count+margin) → ACK→relay (nativeReserve(0,AddOriginal) держит весь prepaid). +4 геттера наблюдаемости (get_anon_pool_state/get_issuer_slot/get_epoch_funding/get_nullifier_insert_time). **10/10 spend-тестов на РЕАЛЬНЫХ ed25519** (`tests/capsulehub-anon-spend.test.ts`): SPEND-01 CONV happy + INTRO happy + PERM-01 (произвольный relay) + **SPEND-02 token-splicing→13605 (BLOCKER крипто-принудителен эмпирически)** + NULLIFIER-01 intra-batch→13604 + SOLV-01 unfunded→13613 + SPEND-03 wrong-issuer→13603 + SPEND-04 serial-tamper→13601 + SPEND-05 frame-retarget→13605 + SPEND-06 bad-slot→13602. Фикстура: `deployBoundSealedPair` теперь BindCreditIssuer до seal (иначе 12923); AUTH-NEG-01 обновлён. **⚠️ КОМПИЛЯ-ЗАМЕТКА: с дублированием (старый+новый receiver) CapsuleHub переполняет дефолтный node-стек в func-js → сборка через `node --stack-size=8000`; после удаления старого receiver в 3b размер упадёт → ожидается возврат к дефолтному стеку (проверить).**
  - ✅ **Стадия 3b (коуплед author_wallet-каскад + PUBLIC + RECOVERY + удаление старого пути) ЗАВЕРШЕНА+ПРОВАЛИДИРОВАНА**: `author_wallet`→`channel_id=H(spend_pubkey)` снят каскадом (PublicCapsuleEntry/View, get_public_entry, computeVaultPublicEntryUid storeAddress→storeUint, publicAuthorKeyId УДАЛЁН→ключ индекса=channel_id напрямую, evictExpiredPublic); RecoveryCapsuleRecord/View `author_wallet`→`owner_pubkey`, get_recovery_capsule. PUBLIC-ветка в `PublishAnonBatch` (спенд-токен + `spendDigestPublic` + channel_id-индекс + marketing-гейт). Новый `receive(PublishRecovery)` (self-funded: endowment в msg.value, `owner_sig` над recoveryDigest, first-publisher `owner_pubkey`-бинд 13563, keep-endowment reserve). **Старый `receive(PublishBatchToHub)` УДАЛЁН** (D2) → `PublishAnonBatch` = ЕДИНСТВЕННЫЙ publish-путь. **15/15 spend-тестов** (добавлены PUBLIC channel_id+author-index+marketing, RECOVERY self-funded+owner-бинд+overwrite-гард+wrong-sig). **🐛 ПОЙМАН БАГ ТЕСТОМ:** `recoveryDigest` DOMAIN(32)+slotKey(256)+3×256 = **1056 бит > 1023** = cell-overflow на РАНТАЙМЕ каждого recovery-publish (баг И в дизайне §7); фикс = h0/h1/bh в ref (как computeVaultRecoveryEntryUid). **BUILD-ГОЧА РЕШЕНА ПОСТОЯННО:** func-js переполняет дефолтный node-стек НЕ из-за дублирования (сохраняется и после снятия старого receiver — B3-код суммарно больше) → `tact_build.js` спавнит с `--stack-size=8000` (детерминированно, байткод идентичен); `npm run build` чист (exit 0). Клиентская crypto 12/12 нетронута. **Старый Vault→Hub путь ОЖИДАЕМО красный** (§11: переписывается в Стадии 5, НЕ регресс).
  - ✅ **Стадия 4 (CreditIssuer-пара) ЗАВЕРШЕНА+ПРОВАЛИДИРОВАНА** (`contracts/CreditIssuer.tact`, 19/19 тестов): `CreditBindHub` (controller, unsealed) + поля `capsule_hub_address`/`hub_bound`; seal требует hub_bound (21046) + price≥prepaidUnit+fund_gas (21047); `CreditBuyCredits` +epoch (Variant B); **BuyCredits форвардит `FundAnonPool{credits_k, epoch}` в Hub** (value=credits_k×CREDIT_PREPAID_UNIT+fund_gas, bounce:true); `bounced(FundAnonPool)` реверсит учёт; `CREDIT_PREPAID_UNIT=23200000` (==Hub, G-PREPAID); get_global экспонирует hub-bind+prepaid_unit. **CREDIT-RECON-01**: реальный Hub+CI cross-bound, buy→форвард→**пул Хаба фондирует epoch-бакет end-to-end** (get_epoch_funding==4, outstanding==4). **✅ РЕФАНД (Вариант B, owner: «делай как надо, AAA+») РЕАЛИЗОВАН+ПРОВАЛИДИРОВАН:** истинный per-buyer авто-рефанд на bounce. Механика: FundAnonPool/Ack получили `purchase_id: uint64` (эхуется Хабом; в первых 224 битах → переживает bounce); CreditIssuer держит bounded `pending_purchases` map {payer, credits_k, refund_amount} + `purchase_seq`. BuyCredits кладёт pending + форвардит с purchase_id; `receive(FundAnonPoolAck)` (гейт sender==hub) чистит pending на успехе; `bounced(FundAnonPool)` по purchase_id → рефанд ПОЛНОЙ цены точному покупателю (`CreditPurchaseRefund`) + реверс учёта + delete. Инвариант ограниченности: TON гарантирует ровно один ответ (ack ИЛИ bounce) на форвард → map дренится за пару блоков. Тесты RECON-01 (успех→ack чистит pending) + **RECON-02 (unsealed Hub → bounce → refund-сообщение точному buyer + credits_sold/pool_collected→0 + pending очищен + пул НЕ фондирован)**. Двойной рефанд невозможен (ровно один ответ); stray-bounce = no-op (missing-entry guard). **⚠️ Vault 924/G2 ПЕРЕКЛАССИФИЦИРОВАН:** `HUB_BATCH_MSG_ROOT_BITS=924` НЕ отдельно удаляемый — несущий для расчёта форвард-фи Vault→Hub (Vault.tact:2116, внутри canonicalTotal живого publish-пути). Снять его = ретайрить весь Vault publish-forward → это **workstream SHRINK_VAULT_TO_KEYREGISTRY**, не быстрая замена константы (дизайн §11 подразумевал end-state с уже-ужатым Vault). Перенесено в Vault-shrink.
  - ◐ **Стадия 5 В РАБОТЕ.** ✅ **G-GAS SEAL-GATE ЗАМЕРЕН+ЗАКРЫТ (2026-07-16):** worst-case 32K PUBLIC-батч против basechain gas_limit=1,000,000: 1p=180299 2p=326478 3p=473282 4p=621086 5p=769806(77%) 6p=926860(92.7%) 7p=OUT-OF-GAS(-14). 8 неисполнимо; 6=92.7%=почти без запаса→небезопасно на immutable. **OWNER-РЕШЕНИЕ (2026-07-16): `MAX_BATCH_PARTS_ANON` урезан 8→4** — константа ВЕРНА, но её ОБОСНОВАНИЕ **ОТОЗВАНО 2026-07-17**: «621086=62% лимита, запас ~38%» замерено на ПУСТОМ Hub (гейт пересоздаёт контракт на каждый замер → 0 живых записей → вытеснение НЕ срабатывает) И не на том лейне (CONV дороже PUBLIC на фиксированные ~84_737 газа). В установившемся режиме (вставка n + вытеснение n) 4-частный батч = **96-98% лимита**, запаса 38% НЕ СУЩЕСТВУЕТ. Вытеснение включается только через ГОД после запуска (записи должны пережить retention) → дефект невидим на тестах и на старте. Газ определяется словарём НУЛЛИФИКАТОРОВ (ретенция 9 дней) ⇒ зависит от ТЕМПА сообщений/сутки, а не от накопленного объёма. **4 остаётся верной по другим, проверенным основаниям** (`tests/capsulehub-gas-degradation.test.ts`): (а) сверхлимитный батч ОТКАТЫВАЕТСЯ ПОЛНОСТЬЮ и жетоны НЕ тратятся → релей пересылает те же капсулы меньшими батчами (HUB-GAS-DEGRADE-01; контроль -02 доказывает, что ПРИЗЕМЛИВШИЙСЯ жетон реально сгорает 13604) — OOG это деградация, не потеря; (б) cap = ПОТОЛОК, а не мандат: part_count>=1 всегда легален, n=1 = ~32% лимита вечно (HUB-GAS-DEGRADE-03). Снижение до 2 не даёт ничего, чего релей не может выбрать сам. Чинить надо КЛИЕНТ: релей выбирает part_count адаптивно. Тест HUB-PERM-04: 1–4 exit0<1M, 5→13503 (кап отбивает ДО out-of-gas — юзер не может отправить -14 батч). ✅ **HUB-RECON version-sync + G-PREPAID ГОТОВЫ (2026-07-16, creditissuer 22/22):** RECON-04 зеркало issuer-ключей Hub↔CI конвергирует через genesis(v0)+Replace(v1)+Revoke + monotone-reject 13615; RECON-03 G-PREPAID `CREDIT_PREPAID_UNIT==CAPSULEHUB_PREPAID_UNIT` (оба скомпилированных, экспонированы геттерами). **🐛 БАГ ПОЙМАН ТЕСТОМ+ПОЧИНЕН:** `CreditRevokeIssuerKey` НЕ бампил version → Hub-mirror (строго `version>existing`, 13615) НЕ мог принять revoke → отозванный скомпрометированный слот оставался `active` в Хабе (токены утёкшего ключа принимались) = compromise-recovery сломан. Фикс: revoke бампит version (каждое изменение слота монотонно). ✅ **ADVERSARIAL-REVIEW WORKFLOW ПРОЙДЕН+ФИКСЫ ПРИМЕНЕНЫ (2026-07-16, 12 агентов, 6 линз→verify, 1.34M токенов):** 6 находок → **3 подтверждено, 3 опровергнуто** (опровержения обоснованы: SealGenesis mirror-parity=ceremony не дефект; multi-recipient-batch + publish_id-determinism = уже принятые residual'ы §12). Подтверждённые = **2 реальных бага, ОБА ПОЧИНЕНЫ+ПРОТЕСТИРОВАНЫ**: **🔴 A (HIGH, crypto-auth): RECOVERY-реплей/откат K_root** — `recoveryDigest` детерминирован по кадру, единственная overwrite-сверка = owner_pubkey → старое валидно-подписанное PublishRecovery реплеится и откатывает recovery-блоб к устаревшему (после ротации K_root → владелец восстанавливает СТАРЫЙ ключ). Фикс: owner-подписанный монотонный `seq` в digest + `seq>existing.seq` (13564); тест HUB-SOLV-06d. **🟡 B (LOW, state-bounding+cross-contract ×2): FundAnonPool без epoch-окна** — far-future epoch → вечно-нереклеймируемый бакет + вечный poolTerm (self-funded, INV-SOLV держится, но нарушает boundedness). Фикс: epoch-window гвард 13617 (bad→bounce→AAA+ рефанд); тест HUB-FUND-01. Durable-Core: anon-spend 18 + creditissuer 22 + keyregistry 12 = **52/52**. ✅ **ФУНДАМЕНТ МИГРАЦИИ ТЕСТОВ ГОТОВ:** новый `tests/helpers/anon.ts` (общий anon-path кит: convPartToken/publicPartToken/recoveryMessage/anonBatch/publicChannelId/spendKey/deployAnonReady/fundPool) + **эталонная миграция `capsulehub-public-index.test.ts`** (author-индекс перекейен на channel_id=H(spend_pubkey), «один автор»=переиспользование spend-ключа=стабильный канал §12; PUBINDEX-01/02/03 мигрированы 3/3 зелёные; PUBINDEX-04 удалён — тестил снятый address-key клиентский helper). Паттерн доказан. ✅ **МИГРАЦИЯ CapsuleHub-ТЕСТОВ ПОЧТИ ЗАВЕРШЕНА (workflow 11 агентов + верификация):** 11 файлов мигрированы на anon.ts (batch-ingest/auth-negative/boundary-negative/meta-assert/eviction/standalone-eviction/profile-pointer/recovery-lane/intro-lane/intro-funds/state-invariants) — **независимо проверено: 12 файлов (+public-index) 51 тест ЗЕЛЁНЫЕ на свежем build**; спот-чек: негативы пинят конкретные коды 13507-13563, ассерты НЕ ослаблены. Удалены removed-semantics тесты (13500 vault-gate). `final-capsule-layout` УДАЛЁН (легаси createEncryptedPrivateCapsule = контракт отвергает + снятый batch-путь; суперседнут header0-hybrid/conv-capsule/intro-capsule). `capsulehub.test.ts` (fee/sweep, 11→10: 8 as-is + 1 адаптирован PRIVATE-INDEX + 1 переоформлен BACKING + 1 удалён DUST-01[sub-floor accrued структурно недостижим при фикс-fee, 13205 покрыт FEE-06]; seedAccruedFee→N PUBLIC-публикаций, setupHubFee→ceremony+FundAnonPool) — ГОТОВ, верифицирован (fee-safety ассерты 16×accrued+11×sweep+13202/13205/13206 сохранены). **✅ ВСЯ CapsuleHub-СТОРОНА МИГРИРОВАНА: 13 файлов, 61 тест зелёные вместе; Durable-Core 52 → 113 B3-тестов зелёные+верифицированы.** ✅ **G8-ЭНДАУМЕНТЫ ЗАМЕРЕНЫ+СВЕДЕНЫ К ОДНОМУ ИСТОЧНИКУ (2026-07-17)**: блок-первоисточник в CapsuleHub.tact (одна ставка 64962, одна таблица замера, один вывод `яч × 64962 × лет × 1.5`) + пин-тест `tests/capsulehub-g8-canonical.test.ts` (HUB-G8-CANON 6/6). PRIVATE 8.02 яч→784000 · PUBLIC 6.02→589000 · INTRO 5.02→492000 · RECOVERY-8К 79.1→23 200 000 (**было 200M — считалось по МЁРТВОЙ ставке 500/1, ×13 переплата; старт беседы 0.25→~0.023 GRAM**; Vault.tact зеркало синхронизировано) · нуллификатор 4.99→12000 (ретенция 9 ДНЕЙ, не год) · **PREPAID_UNIT 11 037 500→10 995 000**. Ретенция сведена: сообщения 1 год, RECOVERY 3 года (`315360000`/10 лет вычищено из репо). Цена «привета» = **0.0283 GRAM** (газ 54% + комиссия 35% + хранение 3.4%). **3 ЛОВУШКИ ЗАМЕРА** (каждая дала ложную константу): storageStats дедуплицирует одинаковые ячейки по хешу; нуллификатор — отдельная 9-дневная строка; переиспользование spend-ключа пишет в существующий индекс канала (PUBLIC читался 4.491 вместо 6.020, −34%) — хелпер `spendKey` зацикливается на 128-м ключе. Правило: число достоверно, только если предельная стоимость СТАБИЛЬНА на двух непересекающихся отрезках. ○ ОСТАЛОСЬ: удалить/переписать старо-путёвые Vault→Hub тесты (ожидаемо красные); ребейз release-evidence код-хеш (ПОСЛЕ фиксов). + **Vault-shrink** (924/G2 + ретайр publish-path). **SEAL-BLOCKER:** внешний крипто-гейт UNLINKABILITY/ROS выдачи (HUB-ANON-04).
- 🔒 **RECOVERY wallet-bind → seed-auth_pubkey+version** (закрывает durability-blocker И sender-leak; auth_pubkey НЕ рекламировать в KeyRegistry; поверх Recovery-B; взаимодействует с Q5).
- ○ Финальный on-chain 2×checkSignature интеграционный тест rebuilt Hub.
- ○ Спек-дельта author_wallet→токен-поля перепинивает HUB_BATCH_MSG_ROOT_BITS=924 + G2.

## ВОРКСТРИМ 5 — Таймбомбы #1-19 + storage-rate (longevity)

**✅ DONE:** storage-rate 64962/cell/год FROZEN — ЕДИНСТВЕННАЯ ставка (bit=0, verified 2 способами + подтверждена прямым списанием TVM: 113943626/1754 яч = 64962.2). [G8-CANONICAL 2026-07-17] ВСЕ эндаументы перевыведены из ОДНОГО замера (PRIVATE 8.017 яч / PUBLIC 4.491 / INTRO 5.017 / RECOVERY-8К 79.0 / нуллификатор 4.987), формула `яч × 64962 × лет × 1.5`; RECOVERY 200M→23.1M (считался по мёртвой 500/1, ×13 переплата) · #10 reject fee-pins (runtime max; DRAIN-01) · #13 avatar_records.del (PROFILE-03) · #15 SWEEP-ONLY · #16/#17 учтены · #18 PruneStuckAthPending (PRUNE-ATH-01..04).

**○ REMAINING:**
- 🔒 **#7** — все эко-эндаументы пересчитать @64962 из измеренного computeDataSize; L3-подъём (36M→100M/500M→800M/Vault 568M→940M) ИЗЛИШЕН → **ОТКАТИТЬ** (кроме username=ровно 1 TON).
- 🔒 **#9** multisig — решение принято (3-of-5 self-rotating replaceable ~14д ed25519); собрать контракт + Vault successor-слот replaceable.
- 🔒 **#12** recovery_slots — 4 ядерных фикса HOLD; 3 экономических refinement в Phase-5 @measured: refresh-top-up / expired-lockout guard / headroom ~2×.
- ○ **#11** CapsuleHub FIFO-eviction — тихая лейна не реклеймится → permissionless standalone evictor (РАСХОЖДЕНИЕ: держим PENDING).
- ○ **#14** part2 — NFT-item как masterchain library code-cell → Phase-5 (part1 done: mint=1 TON).
- ○ **#8** ATHWallet code-rent — DROPPED (0.005 TON/yr, per-user; slim откатан; NO helper-extraction).
- ○ **#16/#17** Y2106 — унифицировать wrap-safe now()-last_active арифметику; MINOR.
- ○ **#19** base code-rent singleton-реестров — фондировать base-code-rent эндаумент в genesis + assert; размер по G8.

## ВОРКСТРИМ 6 — Церемониальные параметры + миграция живого clean-15

**✅ DONE:** #15 SWEEP-ONLY механика (BindBuybackTreasury + SweepStuckReserveToTreasury permissionless dead-man + seal требует treasury_bound; SWEEP-01..05).

**○ REMAINING:**
- **Миграция живого clean-15** — ⚠️ ДЕ-РИСКНУТА 2026-07-16 (см. «ФАЗА A — эмпирика»): 5 юзеров, 24.40 GRAM + 1650 ATH кастодии, вывод РАБОТАЕТ (N=5 ≪ #1-кроссовер), UI живой, фикс-#1-редеплой НЕ нужен. Осталось: OWNER-решение по scope дренажа + клиент-гейт новых депозитов + «migration modal» у cutover. Залипший pending-mint (project_eva) = безвреден, разрулен.
- 🔒👤 **#15** заморозить: treasury-адрес (owner называет на церемонии) + grace 365д + floor 0.1 TON.
- ✅ **ЗАКРЫТ [2026-07-17] RECOVERY_POOL_RETENTION = 94608000 (3 года).** Конфликт был не в решении, а в документах: код нёс 3г (решение владельца 2026-07-15), спеки — 10л. Владелец подтвердил прямо («хранение сообщения 1 год, эндаумент 3 года — не 10 лет!»). Спеки приведены к коду, `315360000` вычищен из репо целиком. Дрейф больше невозможен: `CONST-SOURCE-03` валит сборку, если спека разойдётся с контрактом, `CONST-SOURCE-04` — если мёртвое число вернётся в живой `const`.
- 🔒👤 **RECOVERY_MAX_SIZE_CLASS** + тело on-chain vs hash-only + стоимость старта беседы (~0.4-2.6 GRAM @10л / ~0.12-0.78 @3г).
- 👤 **Airdrop** — рекоменд. DROP (Sybil-farm при анонимном permissionless publish без per-sender cap).
- 👤 **Spam-политика** — accept anon-set degradation vs per-sender rate-cap (cap возвращает privacy-hostile per-sender state; credit-price = единственный рычаг, но сжимает anon-set).
- 👤 **Остатки recipient-приватности** (immutable): тайминг; RPC IP→bucketKey; квантовый ретро-граф знакомств; out-degree по дорогому дампу — все Вариант-1, финальный sign-off до церемонии.
- 👤 **Остатки anon-relay**: enumerable roster (принят); anon-set collapse by window; credit↔anon coupling; censorship↔anonymity coupled; крипто info-theoretic claim → внешний аудит.

## ВОРКСТРИМ 7 — Pre-seal гейты / аудиты / release-evidence (Фаза 5-7)

**✅ DONE:** крипто-прототип gate (clause-blind-Schnorr TVM checkSignature) закрыт (636d0399).

**🔒 REMAINING SEAL-BLOCKERS:**
- 🔒🆕🆕 **ПОТОЛОК СОСТОЯНИЯ АККАУНТА — ЁМКОСТЬ Hub НА ПОРЯДКИ НИЖЕ ЦЕЛИ (вскрыт 2026-07-17, НЕСУЩИЙ)** — TON ограничивает состояние ОДНОГО аккаунта (`max_acc_state_cells`, config-43 ≈ 65 536 ячеек). CapsuleHub держит ВСЕ записи в одном контракте = одном аккаунте. При ЗАМЕРЕННЫХ 8.02 яч/запись потолок = **~8 048 сообщений/год на всю сеть** (~22/сутки). Цель владельца — **миллиарды/год**, разрыв ~10⁵. Отказ приходит в ACTION-фазе (код 50), `compute.exit=0` → **невидим для любой проверки exit-кода**; ни контракты, ни тесты, ни спек про лимит не знают. **Ретенцией не лечится**: даже 1-суточная ретенция даёт 452k/год (в 2 200× меньше миллиарда); даже если не хранить записи вообще, только обязательные нуллификаторы (9 дней) — 533k/год. Под 1e9/год нужно **~124 000 шардов** (или ~1 900 при отсутствии записей). ЭКОНОМИКА при этом ВЕРНА: рента 528 988 nanoTON/сообщение, жетон собирает 995 000 (запас ×1.88) — мала только «тара». Это ровно причина, по которой в TON jetton-кошельки = отдельный контракт на держателя. **Тот же потолок стоит в ЖИВОМ clean-15** (архитектура та же). Лечится только шардингом (TON-натив: контракт на пару «беседа × эпоха», адрес из уже-ротирующегося `bucketKey=HKDF(K_epoch‖dir‖epoch)`) = **clean-17**, а не правка констант. 👤 OWNER-решение: не печатать clean-16 в монолитно-словарной архитектуре.
- 🔒🆕 **UNLINKABILITY/ROS крипто-гейт слепой выдачи (HUB-ANON-04, вскрыт B3 red-team)** — существующий `blind-schnorr-checksig` (636d0399) доказал только VERIFY (accept/reject), НЕ unlinkability выданных токенов и НЕ ROS/Wagner-стойкость CONCURRENT-выдачи. Анонимити-ФУНДАМЕНТ анон-релея стоит на НЕ-проверенном крипто-свойстве → отдельный крипто-гейт (unlinkability + concurrent-issuance ROS) ОБЯЗАТЕЛЕН до seal. (Пометка §97/§137 «ROS-resistant 2-session» относилась к verify, не к полному протоколу выдачи.)
- Внешний **ANO-CCA / key-privacy аудит ML-KEM гибрида** (X25519+ML-KEM-768) — НЕСУЩИЙ: body_KEM_ct в клиртексте, opacity bucketKey необходима но НЕ достаточна; noble-ML-KEM не заявляет key-privacy → при отрицательном заложить key-blinding обёртку KEM-ct ДО immutable; НЕ авто-деплой.
- **G8 pre-accept газ vs глубина users-trie** на ЖИВОМ code.boc с mainnet-конфигом (~30 уровней, НЕ N=256 sandbox; ~1225 газа/уровень); определяет sharding vs cheap anti-spam; теперь для KeyRegistry roster-lookup.
- Внешний **аудит storage-экономики 20-100лет × миллионы** (рента=f(map-size×годы)); + флаг client revoked_lt check (#3, НИКОГДА не реализован → в KeyRegistry).
- ✅ **ЗАКРЫТ [2026-07-17] Nullifier-solvency** — окно==retention бит-в-бит ЗАПИНЕНО тестом `HUB-FUNDS-01`: `NULLIFIER_RETENTION_SECONDS 777600 == (PAST 4 + FUTURE 4 + 1) × 86400`. Короче окна → нуллификатор эвиктится, пока serial ещё тратим → двойная трата; длиннее → мёртвый груз против потолка 65536. Верно только равенство.
- ✅ **ЗАКРЫТ [2026-07-17] funds-safety** — recovery-терм ПРОВЕРЕН и ЗАПИНЕН (`tests/capsulehub-funds-safety.test.ts`). `HUB-FUNDS-02` требует, чтобы КАЖДЫЙ лейн двигал резерв независимо (private/public/intro/recovery), и чтобы recovery двигал СИЛЬНЕЕ дешёвых (79 яч против 5-8 — терм на неверной константе «рос бы», но не так). `HUB-FUNDS-03` гоняет реальный SweepExcessReserve и требует отказа. Класс бага здесь — УДАЛЕНИЕ терма, его не ловит ни один позитивный тест.
  ⚠️ **Ловушка замера, стоила первого черновика:** `protectedReserve() = accrued_fee + max(флор 100 TON, динамика)` — на реальных объёмах ФЛОР ДОМИНИРУЕТ и маскирует все лейн-термы. Первый черновик читал `protected_reserve_ton` и «проходил» по ложной причине: он смотрел на рост КОМИССИИ, а не резерва. Вскрыл подлог INTRO — он комиссии не платит. Читать только сырой `index_storage_reserve_ton`.
- **G2** (== ИНК7) — ре-пин из ABI зеркально Hub↔Vault; красный тест на остаточный 592.
- **Q5** — ротация ключей × versioned-per-keyId contact-store: триггер ре-intro при ротации + хранение СТАРЫХ K_root/scan-секретов versioned; закрыть В ДИЗАЙНЕ до genesis.
- **Code-hash re-lock / release-evidence / conformance** — регенерить когда контракты финальны.
  ⚠️ **НЕ ПРАВИТЬ `artifacts/CURRENT_CODE_HASHES.txt` ПОШТУЧНО** (проверено 2026-07-17: обновил в нём 2 пина → `release-truth-single-source` ушёл с **1 падения на 6**; откатил). Файл ЗЕРКАЛИТСЯ в архивные манифесты и в доказательства ЖИВОГО генезиса clean-15; точечная правка рассинхронизирует зеркала и заставляет evidence утверждать, что живой генезис проверен для другого набора кода. Ребейз только ВЕСЬ и только когда контракты финальны.
  📌 **Причина расхождения найдена:** коммиты заморозки `1644a883` (ProfileRegistry) и `69614515` (UsernameRegistry) изменили `.code.boc`, но `CURRENT_CODE_HASHES.txt` **не обновили** — его нет в списке файлов ни одного из них. Это ровно то, что запрещает правило [[release-evidence-rebaseline]]; пины протухли молча и два дня выдавали ложный диагноз (см. ниже). (M16-CONF/M18/CAPHUB-ECON + PROFILE/USERNAME-STORAGE + CURRENT_FULL_TEST_SUMMARY только генуинно зелёный + web-deploy-prep; 17 текущих fail = clean-16 WIP baseline).

---

## 💀 KILLED сносом custody (НЕ делать — устарело)

- **#1** pre-accept OOG на withdraw/replaceKeys/setAvatar/mintUsername — весь путь в Vault-custody. ОСТАТОК: users.get O(log N) стоимость мигрирует в KeyRegistry roster-lookup → G8 перемерить; + разовый фикс на ЖИВОМ clean-15 для drain.
- **#2** processed_ath_deposits unbounded ledger — внутри Vault ATH-deposit-леджера.
- **#3** key_records revoked accumulation — весь store вытеснен KeyRegistry. ОСТАТОК: rotation-cap + НИКОГДА-нереализованный client revoked_lt check → в KeyRegistry + аудит.
- **#4** users never-pruned / dormant eviction — Vault-resident. ОСТАТОК: dormant-концепт может пере-хоститься в KeyRegistry.
- **#5** no reserve-floor / custody-siphon — нет балансов чтобы сифонить.
- **#6** quantum-break custody (ed25519) — нет withdraw-гейта. ОСТАТОК: квант-позицию anon-relay publish отдельно оценить.
- **PQ-подпись custody (L5)** — снята.
- **Custody-migration целиком** — выживает ТОЛЬКО разовый drain-first на живом clean-15.
- **#18 sub-map 3 (ath-withdrawal)** tombstone — moot (maps 1/2 остаются для frozen-реестров).
- **ReceiveIntent/PAYMENT/чеки** — снято (owner 2026-07-14).
- **first_publisher_key / 13531 / +256бит** — D7-override (bucketKey opaque, направленность = клиентский инвариант).

---

## 👤 ОТКРЫТЫЕ ТВОИ РЕШЕНИЯ (сводка)

1. **RECOVERY retention 3г vs 10л** (конфликт источников; truth скорее 3г) — вшивается навсегда.
2. **#15**: treasury-адрес казны + grace 365д + floor 0.1 TON.
3. **RECOVERY max-size** + тело on-chain vs hash-only + стоимость старта беседы.
4. **Семейство миграции** A (freeze) vs B (burn-remint) — per-redeploy.
5. **ATH FREEZE** — принято; дисциплина verify code-hash + non-bump.
6. **Airdrop** — DROP (реком.) vs re-home с anti-Sybil.
7. **Spam-политика** — accept anon-set degradation vs per-sender cap.
8. **Финальный sign-off** всех immutable-остатков (recipient Вариант-1 + anon-relay TON-потолок) до церемонии.
9. **#9 controller** — состав подписантов (owner + 4 backup + наследование).

---

## Порядок зависимостей (несущее)

1. **ЖИВОЙ clean-15:** ⚠️ ПЕРЕОЦЕНЕНО (2026-07-16) — «#1-withdraw fix первым» ОТМЕНЁН: при N=5 вывод работает, фикс-#1-редеплой НЕ нужен. Дренаж (24.40 GRAM) = пред-cutover чеклист, НЕ блокер-первым. См. «ФАЗА A — эмпирика».
2. **Vault-elimination = parent:** KILLS #1-6, удаляет custody-миграцию → НЕ тратить усилия на «фикс» #1-6 в clean-16.
3. **anon-publish rebuild Hub** снимает author_wallet → ПЕРЕПИНИВАЕТ 924/G2 → ИНК7/G2 идёт ПОСЛЕ финализации anon-publish контрактов.
4. ИНК7/G2 (пины из ABI) → ПОТОМ ИНК8/G8 (combo из тех пинов). Рассинхрон Hub↔Vault необратим.
5. Экономика: ОТКАТИТЬ L3 → пересчитать @64962 → G8-финализация → code-hash re-lock + economics-regen (каждый web/+test-add ломает release-truth).
6. Клиент: ретрив-prefs + rpc-provider = блокеры; re-INTRO adoption ДО включения CONV/INTRO в app.js.
7. OWNER-решения (retention/max-size/treasury/семейство) вшиваются навсегда → заморозить ДО чисел G8 и seal.
8. Внешние аудиты + G8 на живом code.boc = терминальные seal-гейты, НЕ авто-деплой.
9. Вся крипта Фаз 0/1/3 + ИНК1-6 ещё НЕ ЗАКОММИЧЕНА → закоммитить после реконсиляции с anon-publish.
