# PLATHO CLEAN-16 — DURABLE AIRDROP POOL + FRESH-ATH — ЗАКРЫТЫЙ ДИЗАЙН

Источник: design-workflow `wf_87ec4fb8-635` (2026-07-16, 4 подхода → red-team каждого → синтез, 9 агентов, 1.04M токенов).
OWNER-решение, задавшее задачу: **Вариант A (airdrop-пул → Durable Core) + свежий передеплой ATH.**

Статус: **CLOSED-implementable**, но с открытыми ПРОДУКТОВЫМИ owner-решениями (§5) — контракт не сеалить до их фиксации + до SEAL-BLOCKER'ов (§6). Контракт IMMUTABLE.

---

## 0. Рекомендация (одна строка)
**Approach #1 (claim-per-identity / username-attestation), закалённый red-team'ом.** Новый frozen контракт `AirdropPool.tact` (6-й Durable-Core) держит 15M ATH в собственном ATHWallet и платит фиксированный квант **R** ОДИН раз на кошелёк-минтер username'а (nullifier-dedup). Авторитет дистрибуции привязан к **frozen UsernameRegistry**, НЕ к redeployable shell → ядро **non-strandable by construction** (rebindable-distributor НЕ нужен — red-team доказал, что «rebind через #9» неисполним: PlathoController умеет только ANNOUNCE_SUCCESSOR/ROTATE_SIGNER/CANCEL).

## 1. Почему #1 бьёт остальные (все 4 = viable-with-fixes, но у 2/3/4 fatal-флоу)
- **#2 registration-grant:** money-pump (BASE 200 ATH > cheapest username 100 ATH → чистая прибыль первым 25k identity) + **молчаливый дренаж frozen UsernameRegistry** ~52M/минт из name-record-эндаумента (класс [[vault-solvency-storage-underfunding]]).
- **#3 credit-buyer rebate:** **zero-cost drain** — оптимистичный accrue в `CreditBuyCredits` ДО расчёта; атакующий шлёт `epoch=0` (out-of-window) → пул платит ATH, затем FundAnonPool баунсит (13617) → CreditIssuer рефандит полный TON-cost → ATH получен за газ, луп до слива 15M. Ломает единственную посылку Sybil-стойкости.
- **#4 fixed-Merkle:** требует ПУБЛИКАЦИИ полного списка листьев для Sybil-аудита = публичный «список юзеров Platho» = САМА деанонимизация (ради устранения которой затеян B3); Sybil перенесён в off-chain trusted root-builder.
- **#1 hardened:** нет fatal после фиксов; ядро привязано к durable-реестру (non-strandable); Sybil on-chain (платный уникальный NFT-username), claimant-funded, без trusted-party; **0 новых рёбер анонимности** (link username↔wallet уже публичен из самого mint'а).

## 2. Контракт `contracts/AirdropPool.tact` (Durable-Core, deploy-once, seal-once)
Зеркалит freeze-каркас CreditIssuer/KeyRegistry. Владеет СВОИМ ATH-кошельком (`owner==pool`, master==frozen clean-16 ATHMaster), платит командуя ему `ATHTransferRequest`. НЕ custody (нет балансов юзеров).

**СОСТОЯНИЕ:** sealed · genesis_controller_address (one-shot deployer; НОЛЬ post-seal власти) · deployment_manifest_hash/genesis_config_hash · ath_master_address · pool_ath_wallet_address (=derive(pool)) · **username_registry_address (ЕДИНСТВЕННЫЙ аутентификатор claim; frozen на seal)** · treasury_address (FROZEN residual-sink) · claim_amount (R) · remaining_budget (=15M на seal) · distributed_total · claim_count · claimed:map<Int,Bool> (nullifier=accountKey(minter_wallet), НИКОГДА не чистится) · pending_payouts:map (transient) · funded_amount · sealed_at · last_claim_at.

**КОНСТАНТЫ (frozen; G8-provisional):** AIRDROP_TOTAL_POOL=15M ATH · AIRDROP_CLAIM_AMOUNT R (owner-set; **несущий инвариант R ≤ USERNAME_PRICE/10 = 10 ATH**) · AIRDROP_CLAIM_NULLIFIER_ENDOWMENT (@64962, claimant-funded, вечная рента nullifier) · AIRDROP_BASE_STORAGE_ENDOWMENT (#19) · AIRDROP_PAYOUT_PATH_GAS (pool-exec + полный ATHWallet-лег ~48M + 2 fwd-хопа) · AIRDROP_SWEEP_GRACE (dead-man, 5-10 лет).
`protectedReserve() = AIRDROP_BASE_STORAGE_ENDOWMENT + claim_count × AIRDROP_CLAIM_NULLIFIER_ENDOWMENT`.

**GENESIS (controller, unsealed):** AirdropBindAthMaster (26010/11) · AirdropBindUsernameRegistry (26012/13/14) · AirdropSetClaimAmount (26015/16 R≤price/10) · AirdropBindTreasury (26017/18) · AthTransferNotification фандинг 15M (**26019 sender()==pool_ath_wallet_address**, payer-auth) · AirdropSealGenesis (26040-46; **26044 funded_amount==15M**).

**SEALED:**
- `AirdropClaim{minter_wallet, name_hash}` — 26100 sealed · **26110 sender()==username_registry_address** · 26111 basechain(minter) · nk=accountKey(minter) · **26112 !claimed[nk]** · 26113 remaining≥R · **26114 value≥PAYOUT_PATH_GAS+NULLIFIER_ENDOWMENT (fail-closed ДО мутации)** → set claimed/count/remaining-=R/pending → `rawReserve(protectedReserve())` → `ATHTransferRequest{qid,R,recipient:minter,response_dest:self}` в pool-ATHWallet. **nullifier НИКОГДА не сбрасывается.**
- `ATHTransferAck` — **26120 sender()==derive(pending.minter_wallet)** (ack от кошелька ПОЛУЧАТЕЛЯ, не свой — анти-forge) + 26121 pending exists → чистит pending.
- `bounced<ATHTransferRequest>` (нативный, аутентичен) — pending/budget/nullifier НЕ трогаем → доступен retry.
- `AirdropRetryPayout{nk}` (**permissionless**) — 26130 pending exists → пере-шлёт на ФИКСИРОВАННЫЙ pending.minter_wallet. Ноль мутаций → ровно один payout, дренаж невозможен.
- `AirdropTopUpStorageReserve{}` (permissionless).
- `AirdropSweepResidualToTreasury{}` (permissionless dead-man) — **26140 now≥sealed_at+GRACE** && remaining>0 → шлёт ТОЛЬКО remaining_budget в frozen treasury (pending-backing ATH не трогает).

**ГЕТТЕРЫ:** get_global (sealed/funded_amount/remaining_budget/distributed_total/claim_count/claim_amount/registry/treasury/master/pool_wallet/sealed_at — **обязан отдавать funded И remaining для церемонии**) · get_claim_status(minter_wallet)→{claimed,pending}.
**ERROR-FAMILY:** 26xxx пул / 194xx реестр (build-time collision-check обязателен).

**Новая поверхность UsernameRegistry (fresh clean-16):**
- `AirdropBindPool{pool_address}` (controller, unsealed, one-shot) — **вшитый адрес, НЕ caller-supplied**.
- `RequestAirdropAttestation{name_hash}` (permissionless) — грузит NameRecord; **19401 sender()==record.minter_wallet**; форвардит `AirdropClaim{minter_wallet,name_hash}` на frozen pool с SendRemainingValue. **0 нового сториджа в реестре** (нет дренажа).

## 3. Fresh-ATH genesis
ATHMaster переиспользует код БЕЗ изменений (total_supply=100M, mintable:false). Deploy СВЕЖЕГО ATHMaster (bump content→новый токен, отвязан от clean-15) → DeployTreasurySupply 100M → deploy AirdropPool (unsealed) → controller-bind'ы + AirdropBindPool на реестре → treasury-ATHWallet шлёт 15M в pool-ATHWallet → **read-only verify `get_wallet_data(pool_wallet).balance==15M && get_global.funded_amount==15M`** → ТОЛЬКО ПОТОМ AirdropSealGenesis. Остальные аллокации без изменений (15% liquidity / 10% vesting / 60% MSS). Инвариант: Σ==100M.

## 4. Старый clean-15 ATH
**SUPERSEDE/ABANDON, моста НЕТ** (мост тянул бы исходный баг стрендинга; «нет компромиссам»). Свежий clean-16 ATH = другой jetton → полностью суперседит. Старые ~15M остаются осиротевшими в мёртвом clean-15 Vault (нулевая ценность, тест-токен). Custody 5 тест-юзеров уже выведена (Phase A); юзеры пере-онбордятся fresh (ре-минт username → claim наравне со всеми).
**⚠️ РАЗВОРОТ:** это ОБРАЩАЕТ прежний «ATH FREEZE / reuse clean-15». Новый durable token = свежий clean-16 ATH, замораживается С clean-16 (ATHMaster НЕ редеплоится после clean-16, иначе pool_ath_wallet осиротеет в clean-17). AirdropPool = **6-й Durable-Core контракт**.

## 5. OWNER-РЕШЕНИЯ (продуктовые — только владелец)
1. **KEEP vs DROP airdrop.** DROP валиден+чист (не деплоить пул, редирект 15% в treasury/liquidity/MSS; DROP = no-op в дизайне). Философский остаток: fixed-supply + анонимный publish → airdrop структурно не «награда за участие», а распределение резерва по scarce-identity.
2. **R (claim amount):** в пределах R ≤ 10 ATH (=price/10, захват пула ≥9× стоимости). Меньше R → больше claim'ов/дольше живёт. R=10 → потолок 1.5M claim'ов.
3. **Trigger/eligibility:** «владелец любого username» (реком.) vs только-первый-минт vs тиры по длине. Спец-обработка 5 тест-юзеров — реком. НЕТ.
4. **Residual-sink:** FROZEN treasury (реком., 0 governance) vs rebindable через новый AirdropGovernor (гибкость clean-17 ценой нового trust-root+timelock).
5. **AIRDROP_SWEEP_GRACE:** 5-10 лет?
6. **Будущие эпохи/волны:** реком. НЕ нужны (open username-claim обслуживает будущих permissionless).
7. **Flat R vs decreasing:** реком. flat (нет money-pump).

## 6. SEAL-BLOCKERS + остаточные риски
**SEAL-BLOCKERS (до seal):** SB1 церемония (fund→verify→seal порядок; контракт не читает свой jetton-баланс синхронно) · SB2 G8 nullifier-solvency (вечная рента при НУЛЕ пост-airdrop топ-апов) · SB3 G8 gas (полный ATHWallet-лег ~48M) · SB4 tests-first + **внешний аудит** новых immutable-поверхностей · SB5 error-collision-check · SB6 фиксация ATH-freeze разворота в durable-core инвентаре.
**RESIDUAL (приняты/owner-gated):** circularity (нужен ATH чтобы стать eligible → рибейт вовлечённым, не on-ramp нулевого юзера) · first-come exhaustion (flat-R, ранние выкачивают; смягчён R≤price/10) · whale/Sybil capture (net-negative при ≥9×) · minter≠текущий владелец NFT (claim immutable-минтеру) · **anonymity-seam:** R садится в кошелёк-минтер (публично привязан к имени) → КЛИЕНТСКОЕ ПРАВИЛО ГИГИЕНЫ: claim-wallet ≠ publish-funding-wallet (сам claim рёбер не добавляет).
