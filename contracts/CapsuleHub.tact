// Platho v1 CapsuleHub.
// Stores compact capsule indexes and headers on-chain. Body cells live in the
// accepted publish transaction body and are authenticated by their stored hash.

const PLATO_PRIVATE_LONG_TERM_FEE_TON: Int = 10000000;
const PLATO_PUBLIC_POST_FEE_TON: Int = 10000000;

const SIZE_CLASS_1K: Int = 1;
const SIZE_CLASS_2K: Int = 2;
const SIZE_CLASS_4K: Int = 4;
const SIZE_CLASS_8K: Int = 8;
const SIZE_CLASS_16K: Int = 16;
const SIZE_CLASS_32K: Int = 32;
const CRYPTO_SUITE_HYBRID: Int = 2;

const CAPSULEHUB_INDEX_STORAGE_YEARS: Int = 1;
const CAPSULEHUB_INDEX_RETENTION_SECONDS: Int = 31536000;
const CAPSULEHUB_PAGE_SIZE: Int = 256;
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [G8 CANONICAL — measured 2026-07-17] THE SINGLE SOURCE OF TRUTH FOR EVERY STORAGE ENDOWMENT IN THIS CONTRACT.
//
// ONE RATE: 64962 nanoTON / CELL / YEAR. Frozen config-18 schedule (cell_price_ps=135, bit_price_ps=0 — bits are
// FREE) in force since ~Apr-2026. The pre-Apr-2026 schedule (500/1, billed bits) is HISTORY: it must never appear
// in a derivation again. Every wrong constant this contract ever carried came from silently mixing the two rates.
//
// ONE MEASUREMENT — the MARGINAL cost of the Nth live entry, reproduced by test HUB-G8-CANON:
//     PRIVATE (CONV)      8.02-8.03 cells   PUBLIC            6.02-6.03 cells
//     INTRO               5.02-5.03 cells   RECOVERY 8K cap  79.0 cells
//     nullifier           4.98-4.99 cells (its own 9-day retention, NOT a year — priced separately below)
// Ranges, not points: the marginal drifts ~0.01 cells with run length. Each constant is rounded UP from the
// TOP of its range, so it covers the entry at any N — a constant that sits exactly ON the measurement is one
// rounding away from under-funding an immutable contract.
// Getting this number right took three tries; each trap below produced a WRONG constant that looked authoritative:
//   1. storageStats DEDUPLICATES identical cells by hash. Helpers reusing one header across messages under-count.
//      Real traffic is encrypted -> every header is unique. (This is where the bogus "12.0 / 10.5 / 9.25" came from.)
//   2. The nullifier is a SEPARATE 9-day charge. Folding it into the per-entry year inflated the count.
//   3. PUBLIC's channel_id = H(domain||spend_pubkey), so REUSING a spend key appends to an EXISTING channel index
//      and makes the marginal look cheap. A test helper was folding its key index into one byte and wrapping at 256,
//      silently reusing keys: PUBLIC read 4.491 against the true 6.020. Worst case is a fresh channel per post.
// The measurement is only trustworthy when the marginal is STABLE across two disjoint segments of the run (an
// empty dict's first entries are not representative) — HUB-G8-CANON asserts exactly that.
//
// ONE DERIVATION:   endowment = measured_cells x 64962 x RETENTION_YEARS x 1.5
// The x1.5 is the RATE-RISK MARGIN: these constants are IMMUTABLE, but cell_price_ps is governance-set and has
// already moved once. It buys headroom up to cell_price_ps~253 (current 135). It does NOT cover a return to the
// historical 500 — that residual is documented, accepted, and NOT silently provisioned for.
// The x1.25 CAPSULEHUB_STORAGE_RESERVE_BUFFER on top guards the sweep from classifying backing as excess.
//
// RETENTION: messages 1 year (CAPSULEHUB_INDEX_RETENTION_SECONDS). RECOVERY 3 years (owner 2026-07-15; the
// 10-year figure in older spec drafts is SUPERSEDED — see CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS).
//
// The per-entry KEEPALIVE was dropped: account liveness is already covered by the 100 TON
// CAPSULEHUB_MIN_PROTECTED_RESERVE_TON floor (design RT3-#6), and 1M keepalive alone exceeded a year of rent.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

//   PRIVATE  8.04 cells x 64962 x 1yr = 522_296 x 1.5 = 783_438 -> 784_000  (WORST 1-yr lane: TWO headers)
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 784000;
//   PUBLIC   6.04 cells x 64962 x 1yr = 392_370 x 1.5 = 588_556 -> 589_000  (one header + a fresh channel index)
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 589000;
// clean-16 ИНК4 INTRO lane. INTRO entries store header0(42B)+header1(30B)+body_hash with NO index links.
// CAPSULEHUB_INTRO_SWEEP_CAP bounds the per-batch INTRO eviction, decoupled from part_count, so the hot
// PUBLIC/CONV path pays a fixed, small unconditional intro-sweep cost.
//   INTRO    5.04 cells x 64962 x 1yr = 327_408 x 1.5 = 491_111 -> 492_000
const CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT: Int = 492000;
const CAPSULEHUB_INTRO_SWEEP_CAP: Int = 4;
// clean-16 L6/#11: max entries a single permissionless EvictExpiredCapsules call may sweep (bounds gas per call;
// keepers repeat it to drain a backlog). Lets a QUIET private/public lane shed expired entries without waiting for
// its own next publish (own-kind FIFO eviction was otherwise coupled to publish traffic).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [SAFE-CAP — 2026-07-17] The state ceiling, made VISIBLE.
//
// TON caps one account's state at max_acc_state_cells = 65536 (mainnet config-43). Past it, the ACTION phase
// fails with code 50 — and an ACTION-phase failure is the worst possible failure this contract can have:
//   * compute.exit stays 0, so every exit-code check reads CLEAN;
//   * TON emits a bounce ONLY for a COMPUTE-phase failure — an ACTION-phase failure produces NO BOUNCE
//     (measured on 3 independent classes: codes 37/33/37; control: a compute throw DOES bounce);
//   * so the capsule silently does not exist, the payer is not refunded, and NOTHING upstream can learn of it.
// A caller cannot detect it, a keeper cannot compensate for it, and a saga's compensation hop is blind to it.
//
// These caps convert that into an ordinary COMPUTE-phase throw, which bounces normally and refunds the relay.
// The contract now states its true capacity out loud instead of eating messages once it is exceeded.
//
// THE GENERAL RULE THIS IS AN INSTANCE OF — it governs any sharded successor, where a burnt nullifier upstream
// desyncs forever if the last hop fails quietly:
//   A receiver that others depend on must (a) be INCAPABLE of failing in the ACTION phase, and (b) refuse EARLY
//   and CHEAPLY in COMPUTE, so a bounce is still affordable.
// (b) is not style. Measured on the recovery lane: at value=5M the frame validation burns the whole incoming value
// before any check can throw -> exit -14 and NO bounce (nothing left to pay for one); at value=20M the cheap gate
// throws 13576 first and it DOES bounce. That is why the publish path orders its gates "cheap -> expensive
// fail-fast" — the ordering is what keeps a refusal reportable.
// Audited 2026-07-17, both axes clean here: value -> 13509/13530 in COMPUTE + bounce; state -> the caps below.
//
// The numbers are a BUDGET of ONE account (measured cells, frozen rate; see the G8-CANONICAL block above):
//     65536 total  -  448 code  -  ~7300 pool epoch buckets over 100 years   =  57788 cells to divide
//     entries    60%  ->  34672 / 8.02 (PRIVATE, the worst lane)  ->  4300
//     recovery   25%  ->  14447 / 79.0 (the 8K cap, worst case)   ->   180
//     nullifiers 15%  ->   8668 / 4.98                            ->  1700
// So a MONOLITHIC Hub honestly supports ~4300 live entries (= ~4300 messages/year at 1-year retention) and
// ~180 users (RECOVERY holds one slot per user). That is the real capacity — the caps do not create it, they
// only stop it from being discovered as silent loss. Reaching them is the signal to shard, not to raise them.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
const CAPSULEHUB_SAFE_LIVE_CAP: Int = 4300;        // private + public + intro, summed
const CAPSULEHUB_SAFE_RECOVERY_CAP: Int = 180;     // recovery slots (79 cells each — one per user)
const CAPSULEHUB_SAFE_NULLIFIER_CAP: Int = 1700;   // live nullifiers (their own 9-day retention)

const CAPSULEHUB_STANDALONE_EVICT_CAP: Int = 32;
// clean-16 ИНК6 RECOVERY durability lane (Variant-B). The K_root self-recovery blob is stored ON-CHAIN for the
// full retention (owner: 3 years) so it survives even if archive nodes drop old history; the endowment is prepaid
// once at conversation start. RECOVERY_MAX_SIZE_CLASS caps the on-chain blob. All G8-provisional (finalized ИНК8).
// owner 2026-07-15: 3 years (= 3 x CAPSULEHUB_INDEX_RETENTION_SECONDS). SUPERSEDES the 10-year (315360000) figure
// in older spec drafts — 3 years is the binding number everywhere.
const CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS: Int = 94608000;
//   RECOVERY 79.1 cells (8K cap, worst case) x 64962 x 3yr = 15_415_483 x 1.5 = 23_123_224 -> 23_200_000.
// [G8 CANONICAL] The former 200000000 came off the DEAD pre-Apr-2026 schedule — its own comment claimed a
// "3yr rent ~166M", which reproduces exactly as (74x240600 + 75168x481)x3 = 161_880_624: old cell rate AND billed
// bits. Under the frozen 135/0 the true 3-year rent is 15.4M, so the old constant over-charged conversation start
// ~13x (0.25 GRAM instead of ~0.023). This was the last constant still carrying the historical rate.
const CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT: Int = 23200000;
const RECOVERY_MAX_SIZE_CLASS: Int = 8; // 8K cap on the recovery blob
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_FEE_FLUSH_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
const CAPSULEHUB_MIN_PROTECTED_RESERVE_TON: Int = 100000000000; // 100 TON
const CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR: Int = 125;
const CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR: Int = 100;
const CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_RESERVE_SWEEP_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
// Eviction is folded into the publish path (FIFO oldest-first) — there is no standalone prune op. Each batch
// evicts up to part_count entries of its own kind that are past CAPSULEHUB_INDEX_RETENTION_SECONDS, bounding
// live state by construction. CAPSULEHUB_EVICT_PER_PART_GAS is the per-evicted-entry compute folded into the
// publisher's HUB_PART_GAS_* hold (see HUB_PART_GAS_PUBLIC/PRIVATE below).
// clean-16 ИНК2: the private lane splits by header0 shape. CONV (publish_kind=PRIVATE, the ordinary-conversation
// lane) carries a 320-bit / 40-byte header0 = meta(64) + opaque bucketKey(256). INTRO (first contact, wired in
// ИНК4) carries 336 bits / 42 bytes = meta(64) + ephemeral_R(256) + view_tag(16). RECOVERY (ИНК6) reuses the
// CONV 320-bit shape. All private-lane header0s are a single cell with no refs (each fits one 1023-bit cell),
// replacing the pre-clean-16 1120-bit / 2-cell / 1-ref shape. The 784-bit part frame + header1 (240) are unchanged.
const CAPSULEHUB_CONV_HEADER0_BITS: Int = 320; // 40 bytes: meta64 + bucketKey256
const CAPSULEHUB_INTRO_HEADER0_BITS: Int = 336; // 42 bytes: meta64 + ephemeral_R256 + view_tag16
const CAPSULEHUB_PRIVATE_HEADER1_BITS: Int = 240; // 30 bytes
const CAPSULEHUB_PRIVATE_HEADER0_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER0_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_HEADER1_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES: Int = 1204;
// clean-16 ИНК4 (G8-provisional): the INTRO body carries the ML-KEM ct_root (1088B) + handshake identity fields
// on top of the CONV overhead, so its fixed overhead is larger. A wrong value here rejects every valid INTRO.
const CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES: Int = 2388;
const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS: Int = 576; // 72 bytes
const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS: Int = 1;
const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS: Int = 0;


const ENTRY_UID_DOMAIN_VAULT_PRIVATE: Int = 0xD1190201;
const ENTRY_UID_DOMAIN_VAULT_PUBLIC: Int = 0xD1190202;
const ENTRY_UID_DOMAIN_VAULT_INTRO: Int = 0xD1190203; // clean-16 ИНК4
const ENTRY_UID_DOMAIN_VAULT_RECOVERY: Int = 0xD1190204; // clean-16 ИНК6
const CAPSULEHUB_ENTRY_KIND_PRIVATE: Int = 1;
const CAPSULEHUB_ENTRY_KIND_PUBLIC: Int = 2;
const CAPSULEHUB_ENTRY_KIND_INTRO: Int = 3; // clean-16 ИНК4: first-contact stealth lane
const CAPSULEHUB_ENTRY_KIND_RECOVERY: Int = 4; // clean-16 ИНК6: K_root self-recovery durability lane

// --- VPB2 batch ingest (mirror the Vault's batch constants so the value model is consistent end-to-end;
// the Session-5 generator pins both sides from one source) ---
const MAX_BATCH_PARTS: Int = 8;
const HUB_BATCH_BASE_GAS: Int = 14000;
// STALE-COMMENT WARNING (fixed 2026-07-17): this used to claim PRIVATE does "2 index pushes / 2 un-pushes". It does
// ONE of each — clean-16 D7 removed the directional index (see evictExpiredPrivate + prunePrivateBucketIndex, which
// prune the SINGLE opaque bucket index). Measurement: the per-depth gas slope is IDENTICAL across CONV/PUBLIC/INTRO;
// CONV is dearer than PUBLIC by a flat ~84_737 (bigger body overhead + TWO headers), not by a steeper slope.
const HUB_PART_GAS_PRIVATE: Int = 170000; // add (1 index push + payload validation) + auto-evict one (1 index un-push + header parse + del); provisional, measured-tightened
const HUB_PART_GAS_PUBLIC: Int = 180000;  // add (1 index push + author-key hash; clean-11 is_profile: +1 profile-index set + head store) + auto-evict one (1 index un-push + del; clean-11: +1 profile-index get, occasional del); provisional, measured-tightened
const HUB_PART_GAS_INTRO: Int = 120000; // clean-16 ИНК4 (G8-provisional): store-only, no index push; cheaper than PRIVATE, plus its own capped intro-sweep
const HUB_PART_GAS_RECOVERY: Int = 150000; // clean-16 ИНК6 (G8-provisional): keyed slot set + on-chain body write, no index push
const HUB_MIN_PER_PART_VALUE: Int = 1000000; // loose O(1) Phase-A lower bound (gross-underfunding early bounce)
const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN: Int = 0x45504931; // "EPI1" per-entry publish_id derivation
const PLATHO_PUBLIC_MARKETING_NOTE_ASCII: Int = 0x73656e742076696120506c6174686f2e417070; // "sent via Platho.App"

// ================= clean-16 B3: anon-publish (permissionless spend-token ingest) =================
// Design: artifacts/PLATHO_CLEAN16_B3_HUB_ANONPUBLISH_DESIGN.md. Publish becomes an INTERNAL message from a
// permissionless relay wallet, authorized per-part by a spend token (2×checkSignature) + epoch-nullifier, funded
// from a prepaid pool (buyer→CreditIssuer→Hub). author_wallet is removed (sender anonymity). All [G8] constants are
// finalized from measured computeDataSize @ 64962 nanoton/cell/yr before seal.
const HUB_ANON_PUBLISH_KIND_PRIVATE: Int = 1;
const HUB_ANON_PUBLISH_KIND_PUBLIC: Int = 2;
const HUB_ANON_PUBLISH_KIND_INTRO: Int = 3;
// [IRREVERSIBLE] Max parts in one PublishAnonBatch. OWNER decision (2026-07-16): 4.
//
// The original justification is WITHDRAWN (2026-07-17). It read: "4p=621086 = 62% of the gas limit, ~38% headroom".
// Both of that gate's assumptions were false in production:
//   1. It measured an EMPTY Hub — the gate rebuilds the contract per measurement, so zero entries are live and
//      auto-eviction never runs. Eviction is the dominant per-part cost, and it only begins a YEAR after launch
//      (entries must outlive CAPSULEHUB_INDEX_RETENTION_SECONDS first). The worst kind of defect: invisible at
//      launch and on every test, then permanent.
//   2. It measured PUBLIC. CONV is the dearer lane by a flat ~84_737 gas (larger body overhead + TWO headers).
// Re-measured in steady state (insert n + evict n): a 4-part batch sits at 96-98% of the limit at scale, NOT 62%.
// The "38% headroom" never existed. Gas tracks the NULLIFIER dict (9-day retention) => it scales with message RATE,
// not with accumulated entries.
//
// 4 REMAINS CORRECT, for reasons that survive the correction — pinned by tests/capsulehub-gas-degradation.test.ts:
//   a. An over-limit batch REVERTS COMPLETELY and its spend tokens are NOT consumed, so the relay simply re-sends
//      the same capsules in smaller batches (HUB-GAS-DEGRADE-01, with -02 as the control proving a LANDED token
//      really is burnt). Out-of-gas is degradation, never loss.
//   b. This constant is a CEILING, not a mandate: part_count>=1 is always legal and n=1 uses ~32% of the limit
//      forever (HUB-GAS-DEGRADE-03). A relay under gas pressure always has a safe fallback.
// Lowering it to 2 would buy nothing a relay cannot already choose, while permanently removing cheap batching.
// What DOES need to happen lives off-chain: the relay should pick part_count adaptively from the nullifier count.
const MAX_BATCH_PARTS_ANON: Int = 4;
// Domain separators (32-bit) for the spend-token preimages.
const ISSUER_SIG_DOMAIN: Int = 0x42534931;           // "BSI1" serial preimage
const SPEND_DOMAIN: Int = 0x42535031;                // "BSP1" spend digest preimage
const FRAMECOMMIT_DOMAIN: Int = 0x42464331;          // "BFC1" per-part frame commit
const NULL_DOMAIN: Int = 0x424E4C31;                 // "BNL1" nullifier key
const PUBLIC_CHANNEL_DOMAIN: Int = 0x42504331;       // "BPC1" public channel id = H(DOMAIN‖spend_pubkey)
const RECOVERY_SLOT_DOMAIN: Int = 0x42525331;        // "BRS1" recovery slot owner_sig digest
// Epoch + nullifier retention. NULLIFIER_RETENTION_SECONDS = (PAST+FUTURE+1)*EPOCH_SECONDS (§4.3 invariant:
// retention >= the whole re-spend acceptance window, so a nullifier never evicts while its serial is still
// acceptable). [G8/OWNER-D4] window width.
const EPOCH_SECONDS: Int = 86400;                    // 1 day (provisional; OWNER-D4)
const EPOCH_ACCEPT_PAST: Int = 4;
const EPOCH_ACCEPT_FUTURE: Int = 4;
const NULLIFIER_RETENTION_SECONDS: Int = 777600;     // (4+4+1)*86400 = 9 epochs — MUST stay = (PAST+FUTURE+1)*EPOCH_SECONDS
const NULLIFIER_SWEEP_MARGIN: Int = 4;               // [G8] fold evicts part_count+MARGIN >= inserted -> net growth <=0
const CAPSULEHUB_STANDALONE_NULLIFIER_EVICT_CAP: Int = 32;
//   nullifier 4.99 cells x 64962 x (777600/31536000 = 9 days) = 7_992 x 1.5 = 11_988 -> 12_000. NOT a year: a nullifier
//   only lives its re-spend window. The former 50000 assumed "2 dict entries" — measurement says 5 cells. [G8 CANONICAL]
const CAPSULEHUB_NULLIFIER_ENTRY_STORAGE_ENDOWMENT: Int = 12000;
const HUB_TOKEN_VERIFY_GAS: Int = 18000;             // [G8] per-part: 2×checkSignature + 3 hashes + dict get/set
// Prepaid pool: one kind-agnostic credit funds the worst-case (PUBLIC) publish. prepaidUnit MUST equal the
// CreditIssuer side bit-for-bit (SEAL-GATE G-PREPAID, §5.6). [G8] finalize @64962.
// [G8] Priced at the PRIVATE (CONV) lane — the dominant traffic — NOT the PUBLIC worst case. Pricing the blind credit at
// PUBLIC made every private message overpay 7.625M (~+50% of its real cost) just because the credit cannot know the lane.
// [G8 CANONICAL] ONE credit = ONE capsule = 10 ATH on EVERY lane, so the credit is priced at the WORST lane and
// over-covers the others. PRIVATE is the worst (8.02 cells vs PUBLIC 6.02 / INTRO 5.02) — no lane tops up.
//   PRIVATE = protocolFee(10M) + endowment 784_000x1.25 (=980_000) + nullifier 12_000x1.25 (=15_000) = 10_995_000
//   PUBLIC  = 10M + 589_000x1.25 (=736_250) + 15_000 = 10_751_250  <= PRIVATE  ✓
//   INTRO   = 0   + 492_000x1.25 (=615_000) + 15_000 =    630_000  <= PRIVATE  ✓
const CAPSULEHUB_PREPAID_UNIT: Int = 10995000;
const CAPSULEHUB_FUND_LOCAL_EXEC_RESERVE: Int = 2000000;

message(0x50415542) PublishAnonBatch {               // "PAUB" — permissionless anon publish (PRIVATE/PUBLIC/INTRO)
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    publish_kind: Int as uint8;
    part_count: Int as uint8;
    parts: Cell;                                     // ref[0]: part frames, byte-identical to the current lane frames
    tokens: Cell;                                    // ref[1]: parallel singly-linked spend-token list, len == part_count
    marketing: Cell?;                                // ref[2]: PUBLIC only
}

message(0x50415243) PublishRecovery {                // "PARC" — self-funded RECOVERY durability lane
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    part: Cell;                                      // one CONV-shaped frame (header0 320 + header1 + on-chain body)
    owner_pubkey: Int as uint256;
    seq: Int as uint64;                              // owner-signed MONOTONIC freshness — anti-replay/rollback (13564)
    owner_sig: Cell;                                 // ^(Slice as bytes64): ed25519 over recoveryDigest (binds seq)
}

message(0x46414E50) FundAnonPool {                   // "FANP" — CreditIssuer forwards a credit purchase into the pool
    credits_k: Int as uint64;
    epoch: Int as uint32;                            // Variant B: buyer-declared epoch bucket (== token epoch)
    purchase_id: Int as uint64;                      // CreditIssuer correlation id — echoed back in the ack, and (being
                                                     // within the first 224 bits) survives a bounce, so the CreditIssuer
                                                     // can settle/refund the exact pending purchase (§5.5 true refund).
}

message(0x46414E41) FundAnonPoolAck {                // "FANA"
    credits_k: Int as uint64;
    epoch: Int as uint32;
    purchase_id: Int as uint64;
}

message(0x48524B31) HubMirrorIssuerKey {             // "HRK1" — controller mirrors a CreditIssuer slot into the Hub
    slot: Int as uint8;
    pubkey: Int as uint256;
    active: Bool;
    version: Int as uint32;
}

message(0x424C4E44) BindCreditIssuer {               // "BLND" — genesis bind of the CreditIssuer address (controller, unsealed)
    credit_issuer_address: Address;
}

message(0x4E554C4C) EvictExpiredNullifiers {         // "NULL" — permissionless FIFO nullifier eviction
    max_count: Int as uint16;
}

message(0x52454346) ReclaimExpiredFunding {          // "RECF" — permissionless: release an expired-epoch funding bucket
    epoch: Int as uint32;
}

struct IssuerSlot {
    pubkey: Int as uint256;
    active: Bool;
    version: Int as uint32;
}

struct NullRec {
    key: Int as uint256;
    insert_time: Int as uint32;
}

message(0x90E2E0CB) BindDeploymentManifest {
    deployment_manifest_hash: Int as uint256;
    counterpart_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x7A861031) FlushFees {
    amount: Int as uint128;
}

message(0x5331B880) TopUpStorageReserve {}

message(0x53575052) SweepExcessReserve {
    amount: Int as uint128;
}

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

// clean-16 ИНК6: permissionless reclaim of an expired RECOVERY slot. Anyone may call it once the slot's
// updated_at + CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS is in the past; the slot is deleted and its
// live-count term is released so the endowment it held stops being protected.
message(0x52454332) EvictExpiredRecoverySlot {
    slot_key: Int as uint256;
}

// clean-16 L6/#11: permissionless standalone eviction of expired PRIVATE/PUBLIC/INTRO index entries — decoupled from
// publish traffic so a quiet lane still gets reclaimed. Anyone may call it; the dormancy check IS the gate.
message(0x45564343) EvictExpiredCapsules {
    kind: Int as uint8;      // 1=private, 2=public, 3=intro
    max_count: Int as uint16;
}

// VPB2: the Vault forwards one signed batch (1..MAX_BATCH_PARTS parts) under this op. Wire format mirrors the
// Vault's PublishBatchToHub exactly; op + the 224 recovery bits (bounce_id, bounce_tag) come FIRST so they
// survive bounce truncation.
message(0xA4F862D1) PublishBatchToHub {
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    publish_kind: Int as uint8;
    part_count: Int as uint8;
    protocol_fee_total: Int as uint128;
    author_wallet: Address;
    parts: Cell;        // ref[0]: the exact signed part list (singly linked)
    marketing: Cell?;   // ref[1]: public batches only ({marketing_note}); null for private
}

message(0x874E5771) CapsuleHubBatchAck {
    publish_id: Int as uint256;
    first_entry_id: Int as uint64;
    part_count: Int as uint8;
    batch_uid: Int as uint256;
}

struct CapsuleHubStateView {
    sealed: Bool;
    vault_bound: Bool;
    deployment_manifest_hash: Int;
    private_latest_id: Int;
    public_latest_id: Int;
    private_page_count: Int;
    public_page_count: Int;
    page_size: Int;
    index_storage_years: Int;
    index_retention_seconds: Int;
    accrued_plato_fee_ton: Int;
    fee_accumulator_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
    private_live_count: Int;
    public_live_count: Int;
    intro_latest_id: Int;
    intro_oldest_live_id: Int;
    intro_live_count: Int;
    recovery_live_count: Int;
    index_storage_reserve_ton: Int;
    protected_reserve_ton: Int;
    reserve_floor_ton: Int;
    reserve_buffer_numerator: Int;
    reserve_buffer_denominator: Int;
}

struct CapsuleHubPageView {
    exists: Bool;
    page_id: Int;
    first_entry_id: Int;
    next_entry_id: Int;
    entry_count: Int;
    // V1 pages are virtual ranges; these fields are reserved and always zero.
    opened_at: Int;
    updated_at: Int;
}

struct PrivateCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint64;
    body_hash: Int as uint256;
    // clean-16 ИНК1: single backward link in the opaque bucket chain (reuses the old per-publisher link slot).
    // The second, recipient-directed backlink is gone with the recipient graph — a private entry now carries
    // only its position in the opaque bucket chain, no directional link.
    bucket_prev_link: Int as uint64;
    header_0: Cell;
    header_1: Cell;
}

struct PublicCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint64;
    // clean-16 B3: the trusted author wallet is gone (permissionless publish, §6). Discovery/attribution is now the
    // crypto-bound channel id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pubkey); the spend_sig proves control of the channel.
    channel_id: Int as uint256;
    body_hash: Int as uint256;
    // parent_link == 0 -> top-level post (indexed by author); else == parentEntryId+1 -> comment
    // (indexed by parent). Reuses the entryLink convention so entry 0 is unambiguous.
    parent_link: Int as uint64;
    // Backward link in whichever public index this entry lives in (author chain for posts,
    // parent chain for comments). Analogous to the private entry's backward bucket link.
    prev_link: Int as uint64;
    // clean-11: backward link in the GLOBAL profile chain (0 for non-profile posts and for the first profile
    // ever). Threaded ONLY when is_profile is set; lets a client walk EVERY described channel newest-first from
    // public_profile_head without a global scan. Mirrors prev_link's role but across the single global profile list.
    profile_prev_link: Int as uint64;
    header: Cell;
}

struct PrivateCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    bucket_prev_link: Int;
    entry_uid: Int;
    publish_id: Int;
    author_wallet: Address;
    page_id: Int;
    page_offset: Int;
    created_at: Int;
    header_0_hash: Int;
    header_1_hash: Int;
    body_hash: Int;
    header_0: Cell;
    header_1: Cell;
}

struct PrivateCapsuleKeyIndex {
    latest_entry_link: Int as uint64;
    entry_count: Int as uint64;
}

struct PrivateBucketIndexView {
    exists: Bool;
    bucket_key: Int;
    latest_entry_id: Int;
    latest_entry_link: Int;
    entry_count: Int;
}

// clean-16 ИНК4 INTRO lane. First-contact capsules land here with NO index (the recipient scans ephemeral_R +
// view_tag out of header_0 and trial-decrypts). No author_wallet is stored: identity lives inside the encrypted
// body and is bound by the handshake transcript, verified after decrypt (impersonation is not checkable on-chain).
struct IntroCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint64;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
}

struct IntroCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    entry_uid: Int;
    publish_id: Int;
    created_at: Int;
    header_0_hash: Int;
    header_1_hash: Int;
    body_hash: Int;
    header_0: Cell;
    header_1: Cell;
}

// One row of the INTRO scan stream: the client walks [oldest_live_id, latest_id) reading ONLY header_0 to get the
// stealth scan fields (ephemeral_R + view_tag) and trial-decrypts matches; it never needs the body on-chain.
struct IntroScanRecord {
    entry_id: Int;
    created_at: Int;
    view_tag: Int;
    ephemeral_r: Int;
}

struct IntroScanBoundsView {
    oldest_live_id: Int;
    latest_id: Int;
    live_count: Int;
}

struct IntroScanPageView {
    from_entry_id: Int;
    count: Int;
    records: map<Int as uint16, IntroScanRecord>;
}

// clean-16 ИНК6 RECOVERY (Variant-B, keyed latest-wins). One slot per self-bucketKey holds the user's CURRENT
// K_root recovery blob. The body is stored ON-CHAIN (durability) — unlike CONV/INTRO/PUBLIC which keep only a hash
// — so recovery survives even if archive nodes drop old history. updated_at drives the permissionless expiry: a
// fresh publish resets it, so an active user's slot never expires.
struct RecoveryCapsuleRecord {
    publish_id: Int as uint256;
    updated_at: Int as uint64;
    body_hash: Int as uint256;
    // clean-16 B3 (§7): the slot is bound to its FIRST publisher's ed25519 owner_pubkey (was author_wallet). slotKey
    // is a self-derived value that becomes public on-chain once published; without this bind ANY third party could
    // re-publish the same slotKey with garbage and destroy the owner's K_root recovery blob forever. Only an
    // owner_sig from THIS pubkey may overwrite (13563). Self-recovery has no dialogue partner, so the pubkey leaks
    // nothing about the who-to-whom graph, and — unlike a wallet — it is NOT the payer/relay address (sender-anon).
    owner_pubkey: Int as uint256;
    // clean-16 B3 (adversarial-review fix): owner-signed monotonic freshness. An overwrite requires seq STRICTLY greater
    // than the stored seq (13564), so an old validly-signed PublishRecovery cannot be replayed to roll the K_root blob
    // back to a stale version (the only prior overwrite guard, owner_pubkey==owner_pubkey, is identical across versions).
    seq: Int as uint64;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

struct RecoveryCapsuleView {
    exists: Bool;
    slot_key: Int;
    updated_at: Int;
    body_hash: Int;
    owner_pubkey: Int;
    seq: Int;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

struct PublicCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    entry_uid: Int;
    publish_id: Int;
    channel_id: Int;
    page_id: Int;
    page_offset: Int;
    created_at: Int;
    header_hash: Int;
    body_hash: Int;
    parent_link: Int;
    prev_link: Int;
    profile_prev_link: Int;   // clean-11
    header: Cell;
}

struct PublicCapsuleKeyIndex {
    latest_entry_link: Int as uint64;
    entry_count: Int as uint64;
}

struct PublicCapsuleKeyIndexView {
    exists: Bool;
    key_id: Int;
    latest_entry_id: Int;
    latest_entry_link: Int;
    entry_count: Int;
}

// clean-16 B3 observability: pool + nullifier-ledger snapshot and one mirrored issuer slot.
struct AnonPoolStateView {
    credit_issuer_bound: Bool;
    credit_issuer_address: Address;
    nullifier_live_count: Int;
    nullifier_latest: Int;
    nullifier_oldest_live: Int;
    anon_pool_outstanding: Int;
    prepaid_unit: Int;               // CAPSULEHUB_PREPAID_UNIT — MUST equal CreditIssuer CREDIT_PREPAID_UNIT (G-PREPAID)
    max_batch_parts_anon: Int;       // the G-GAS-pinned per-batch part cap
}

struct IssuerSlotView {
    exists: Bool;
    slot: Int;
    pubkey: Int;
    active: Bool;
    version: Int;
}

contract CapsuleHub {
    fee_accumulator_address: Address;
    vault_address: Address;
    vault_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_controller_address: Address;
    private_latest_id: Int as uint64;
    public_latest_id: Int as uint64;
    private_live_count: Int as uint64;
    public_live_count: Int as uint64;
    accrued_plato_fee_ton: Int as uint128;
    private_entries: map<Int as uint64, PrivateCapsuleEntry>;
    public_entries: map<Int as uint64, PublicCapsuleEntry>;
    // clean-16 ИНК1: the opaque CONV bucket index. Keyed by the client's HKDF bucketKey (header0 bits[64,320)),
    // stored/looked-up purely as an opaque 256-bit map key — the contract derives NO sender/recipient/direction
    // from it (D7-override). Replaces the old per-publisher private index; the open who-to-whom recipient
    // index is deleted, so the on-chain private lane exposes NO directed graph.
    private_bucket_index: map<Int as uint256, PrivateCapsuleKeyIndex>;
    // Public read-side indexes: posts indexed by
    // hashed author wallet, comments indexed by parent entry id. Each lets a client walk only the entries
    // it cares about (a subscribed author's posts, or one post's comments) without a global scan.
    public_author_index: map<Int as uint256, PublicCapsuleKeyIndex>;
    public_parent_index: map<Int as uint64, PublicCapsuleKeyIndex>;
    // FIFO eviction low-water marks: the lowest entry id NOT yet evicted (everything below is gone). Auto-eviction
    // in the publish path advances these, deleting oldest-first past the retention window. Strict FIFO = we only
    // ever delete a chain TAIL, so backward walks never hit a hole and entry_count stays exact.
    public_oldest_live_id: Int as uint64;
    private_oldest_live_id: Int as uint64;
    // clean-11 channel-description discovery:
    //  - public_profile_index: hash(author) -> entryLink of that author's LATEST profile post (O(1) "this channel's
    //    current profile"; may dangle to an evicted entry — readers tolerate via get_public_entry(...).exists).
    //  - public_profile_head: entryLink of the newest profile post globally (0 = none). Head of a singly-linked
    //    global chain threaded through PublicCapsuleEntry.profile_prev_link, walked newest-first for COMPLETE discovery.
    public_profile_index: map<Int as uint256, Int as uint64>;
    public_profile_head: Int as uint64;
    // clean-16 ИНК4 INTRO first-contact pool. A separate FIFO map with NO index (the recipient scans header_0's
    // ephemeral_R + view_tag). The triplet mirrors the private/public counters: latest id (next entry id), oldest
    // live id (FIFO low-water), live count. Swept a capped amount by EVERY batch (own-kind on an INTRO batch, or
    // the unconditional intro-sweep on CONV/PUBLIC batches) so this low-frequency lane still bounds its state.
    intro_entries: map<Int as uint64, IntroCapsuleEntry>;
    intro_latest_id: Int as uint64;
    intro_oldest_live_id: Int as uint64;
    intro_live_count: Int as uint64;
    // clean-16 ИНК6 RECOVERY pool: keyed latest-wins slot map (key = self-bucketKey). NO sequential id; a slot is
    // OVERWRITTEN in place by a fresh recovery publish (live_count grows only on the first insert). Reclaimed via
    // the permissionless EvictExpiredRecoverySlot once a slot's updated_at + retention is in the past.
    recovery_slots: map<Int as uint256, RecoveryCapsuleRecord>;
    recovery_live_count: Int as uint64;

    // ===== clean-16 B3 anon-publish state =====
    // issuer-key mirror (genesis snapshot of CreditIssuer.issuer_slots, version-monotone controller updates, §9).
    credit_issuer_address: Address;
    credit_issuer_bound: Bool;
    issuer_mirror: map<Int, IssuerSlot>;
    // epoch-nullifier ledger (§4): membership test + FIFO eviction keyed by insert order == expiry order.
    spent_nullifiers: map<Int, Int>;         // nk(uint256) -> insert_time(uint32)
    nullifier_seq: map<Int, NullRec>;        // seq(uint64) -> {key, insert_time}
    nullifier_latest: Int as uint64;
    nullifier_oldest_live: Int as uint64;
    nullifier_live_count: Int as uint32;
    // prepaid pool (Variant B, §5.4): per-epoch funded/spent credit counts + a running outstanding aggregate.
    funded_by_epoch: map<Int, Int>;          // epoch -> credits funded (uint64 count)
    spent_by_epoch: map<Int, Int>;           // epoch -> credits spent
    anon_pool_outstanding: Int as uint64;    // sum over live epochs of (funded - spent); drives poolTerm()

    init(fee_accumulator_address: Address, vault_address: Address, vault_bound: Bool, sealed: Bool, deployment_manifest_hash: Int, genesis_controller_address: Address) {
        self.fee_accumulator_address = fee_accumulator_address;
        self.vault_address = vault_address;
        self.vault_bound = vault_bound;
        self.sealed = sealed;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_controller_address = genesis_controller_address;
        self.private_latest_id = 0;
        self.public_latest_id = 0;
        self.private_live_count = 0;
        self.public_live_count = 0;
        self.accrued_plato_fee_ton = 0;
        self.private_entries = emptyMap();
        self.public_entries = emptyMap();
        self.private_bucket_index = emptyMap();
        self.public_author_index = emptyMap();
        self.public_parent_index = emptyMap();
        self.public_oldest_live_id = 0;
        self.private_oldest_live_id = 0;
        self.public_profile_index = emptyMap();   // clean-11
        self.public_profile_head = 0;             // clean-11
        self.intro_entries = emptyMap();          // clean-16 ИНК4
        self.intro_latest_id = 0;
        self.intro_oldest_live_id = 0;
        self.intro_live_count = 0;
        self.recovery_slots = emptyMap();         // clean-16 ИНК6
        self.recovery_live_count = 0;
        // clean-16 B3 anon-publish
        self.credit_issuer_address = fee_accumulator_address;  // placeholder until BindCreditIssuer
        self.credit_issuer_bound = false;
        self.issuer_mirror = emptyMap();
        self.spent_nullifiers = emptyMap();
        self.nullifier_seq = emptyMap();
        self.nullifier_latest = 0;
        self.nullifier_oldest_live = 0;
        self.nullifier_live_count = 0;
        self.funded_by_epoch = emptyMap();
        self.spent_by_epoch = emptyMap();
        self.anon_pool_outstanding = 0;
    }

    fun requireSealed() {
        throwUnless(12900, self.sealed);
    }

    fun requireUnsealed() {
        throwUnless(12901, !self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(12930, sender() == self.genesis_controller_address);
    }

    fun isBasechainAddress(address: Address): Bool {
        let address_std: StdAddress = parseStdAddress(address.asSlice());
        return address_std.workchain == 0;
    }

    fun isAllowedPrivateSizeClass(sizeClass: Int): Bool {
        return sizeClass == SIZE_CLASS_1K
            || sizeClass == SIZE_CLASS_2K
            || sizeClass == SIZE_CLASS_4K
            || sizeClass == SIZE_CLASS_8K
            || sizeClass == SIZE_CLASS_16K
            || sizeClass == SIZE_CLASS_32K;
    }

    fun isAllowedPublicSizeClass(sizeClass: Int): Bool {
        return self.isAllowedPrivateSizeClass(sizeClass);
    }

    fun privateFullFee(cryptoSuite: Int): Int {
        if (cryptoSuite == CRYPTO_SUITE_HYBRID) {
            return PLATO_PRIVATE_LONG_TERM_FEE_TON;
        }
        return 0;
    }

    fun privateIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT;
    }

    fun publicIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT;
    }

    // clean-16 ИНК5: INTRO entries are backed the same way — the measured INTRO endowment per live entry.
    fun introIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT;
    }

    // clean-16 ИНК6: RECOVERY slots are backed the same way — the (larger, on-chain-body) endowment per live slot.
    fun recoveryIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT;
    }

    fun indexStorageReserve(): Int {
        // clean-16 ИНК5/ИНК6: the intro + recovery terms join the private/public terms so EVERY live pool's
        // endowment sits inside protectedReserve() and cannot be classified as excess and swept out.
        let base: Int = (self.private_live_count * self.privateIndexStorageReservePerEntry())
            + (self.public_live_count * self.publicIndexStorageReservePerEntry())
            + (self.intro_live_count * self.introIndexStorageReservePerEntry())
            + (self.recovery_live_count * self.recoveryIndexStorageReservePerEntry());
        return (base * CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR) / CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR;
    }

    fun protectedReserve(): Int {
        // clean-16 B3: the live-nullifier rent term + the prepaid-pool term join the index reserve so neither can be
        // classified as sweepable excess (§5.2). Nullifier term carries the 1.25 buffer; keepalive is NOT added
        // per-nullifier (the 100 TON floor already covers it, RT3-#6).
        let dynamicReserve: Int = self.indexStorageReserve()
            + (self.nullifier_live_count * self.nullifierReserveWithBuffer())
            + self.poolTerm();
        let storageReserve: Int = CAPSULEHUB_MIN_PROTECTED_RESERVE_TON;
        if (dynamicReserve > storageReserve) {
            storageReserve = dynamicReserve;
        }
        return self.accrued_plato_fee_ton + storageReserve;
    }

    // ===== clean-16 B3 anon-publish primitives (§3-§5) =====

    fun nullifierReserveWithBuffer(): Int {
        return (CAPSULEHUB_NULLIFIER_ENTRY_STORAGE_ENDOWMENT * CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR) / CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR;
    }

    // poolTerm: outstanding prepaid credits × the per-credit worst-case backing. Variant B keeps it bounded to the
    // live-epoch window (ReclaimExpiredFunding releases expired buckets). anon_pool_outstanding >= 0 by construction.
    fun poolTerm(): Int {
        return self.anon_pool_outstanding * CAPSULEHUB_PREPAID_UNIT;
    }

    // serial = H(ISSUER_SIG_DOMAIN ‖ spend_pubkey ‖ epoch ‖ nonce). The issuer blind-signs THIS 256-bit value; the
    // domain separates it from any other 256-bit signed message (RT1-MINOR-4). Finding a preimage is infeasible, so
    // a relay cannot swap spend_pubkey/epoch/nonce under a fixed serial (§3.2).
    fun computeSerial(spendPubkey: Int, epoch: Int, nonce: Int): Int {
        return beginCell()
            .storeUint(ISSUER_SIG_DOMAIN, 32)
            .storeUint(spendPubkey, 256)
            .storeUint(epoch, 32)
            .storeUint(nonce, 64)
            .endCell().hash();
    }

    fun nullifierKey(serial: Int): Int {
        return beginCell().storeUint(NULL_DOMAIN, 32).storeUint(serial, 256).endCell().hash();
    }

    // Public-lane channel discovery key (replaces hash(author_wallet)); crypto-bound by the spend_sig (§6).
    fun publicChannelKeyId(spendPubkey: Int): Int {
        return beginCell().storeUint(PUBLIC_CHANNEL_DOMAIN, 32).storeUint(spendPubkey, 256).endCell().hash();
    }

    // spendDigest = H(SPEND_DOMAIN ‖ serial ‖ kind ‖ frameCommit). frameCommit binds ALL frame scalars (incl. h0),
    // and serial ties the spend_sig to THIS token → token-splicing/reorder fails checkSignature (RT1-BLOCKER-1, §3.3).
    fun spendDigestPrivate(serial: Int, kind: Int, sizeClass: Int, cryptoSuite: Int, h0: Int, h1: Int, bh: Int): Int {
        let frameCommit: Int = beginCell()
            .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(sizeClass, 8).storeUint(cryptoSuite, 8)
            .storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell().hash();
        return beginCell()
            .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(kind, 8)
            .storeUint(frameCommit, 256).endCell().hash();
    }

    fun spendDigestPublic(serial: Int, kind: Int, sizeClass: Int, reserved: Int, parentLink: Int, h0: Int, bh: Int): Int {
        let frameCommit: Int = beginCell()
            .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(sizeClass, 8).storeUint(reserved, 8)
            .storeUint(parentLink, 64).storeUint(h0, 256).storeUint(bh, 256).endCell().hash();
        return beginCell()
            .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(kind, 8)
            .storeUint(frameCommit, 256).endCell().hash();
    }

    fun insertNullifier(nk: Int) {
        self.spent_nullifiers.set(nk, now());
        self.nullifier_seq.set(self.nullifier_latest, NullRec { key: nk, insert_time: now() });
        self.nullifier_latest += 1;
        self.nullifier_live_count += 1;
    }

    // FIFO eviction by insert order. Because retention is keyed to insert_time and insert order == expiry order,
    // the first still-live entry means ALL subsequent are live → break is correct, no stall (§4.1/§4.2).
    fun evictNullifiersFIFO(maxEvict: Int) {
        let n: Int = 0;
        let id: Int = self.nullifier_oldest_live;
        while ((n < maxEvict) && (id < self.nullifier_latest)) {
            let r: NullRec? = self.nullifier_seq.get(id);
            if (r == null) {
                id += 1;
            } else {
                if (now() < (r!!.insert_time + NULLIFIER_RETENTION_SECONDS)) {
                    self.nullifier_oldest_live = id;
                    return;
                }
                self.spent_nullifiers.set(r!!.key, null);
                self.nullifier_seq.set(id, null);
                self.nullifier_live_count -= 1;
                id += 1;
                n += 1;
            }
        }
        self.nullifier_oldest_live = id;
    }

    // Verify a spend token's issuer signature against the mirrored (active) issuer slot. Returns the resolved serial
    // for the caller's nullifier/double-spend check. Reverts on any failure (dispatch cheap→expensive).
    fun verifyIssuerToken(serial: Int, slot: Int, spendPubkey: Int, epoch: Int, nonce: Int, issuerSig: Slice, nowEpoch: Int) {
        throwUnless(13600, (epoch >= nowEpoch - EPOCH_ACCEPT_PAST) && (epoch <= nowEpoch + EPOCH_ACCEPT_FUTURE));
        throwUnless(13601, self.computeSerial(spendPubkey, epoch, nonce) == serial);
        let ms: IssuerSlot? = self.issuer_mirror.get(slot);
        throwUnless(13602, (ms != null) && ms!!.active);
        throwUnless(13604, self.spent_nullifiers.get(self.nullifierKey(serial)) == null);
        throwUnless(13603, checkSignature(serial, issuerSig, ms!!.pubkey));
    }

    fun epochFunded(epoch: Int): Int {
        let v: Int? = self.funded_by_epoch.get(epoch);
        if (v == null) { return 0; }
        return v!!;
    }

    fun epochSpent(epoch: Int): Int {
        let v: Int? = self.spent_by_epoch.get(epoch);
        if (v == null) { return 0; }
        return v!!;
    }

    // Consume one prepaid credit from a token's own epoch bucket. Guard is per-epoch: a token can only spend against
    // funding declared for its OWN epoch (a mismatched/unfunded epoch self-harms into a revert, §5.4-B). fail-closed.
    fun spendPoolCredit(epoch: Int) {
        let funded: Int = self.epochFunded(epoch);
        let spent: Int = self.epochSpent(epoch);
        throwUnless(13613, spent + 1 <= funded);
        self.spent_by_epoch.set(epoch, spent + 1);
        self.anon_pool_outstanding -= 1;
    }

    fun isAllowedPrivatePair(sizeClass: Int, cryptoSuite: Int): Bool {
        return self.isAllowedPrivateSizeClass(sizeClass)
            && cryptoSuite == CRYPTO_SUITE_HYBRID;
    }

    fun requireExactPayloadCell(cell: Cell, expectedHash: Int, expectedCells: Int, expectedBits: Int, expectedRefs: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(expectedCells);
            throwUnless(sizeExit, size.cells == expectedCells);
            throwUnless(sizeExit, size.bits == expectedBits);
            throwUnless(sizeExit, size.refs == expectedRefs);
        } catch (exitCode) {
            throw(sizeExit);
        }
    }

    fun publicBodyBytes(sizeClass: Int): Int {
        throwUnless(12950, self.isAllowedPublicSizeClass(sizeClass));
        return sizeClass * 1024;
    }

    fun publicBodyBits(sizeClass: Int): Int {
        return self.publicBodyBytes(sizeClass) * 8;
    }

    fun publicBodyCells(sizeClass: Int): Int {
        return (self.publicBodyBytes(sizeClass) + 126) / 127;
    }

    fun publicBodyRefs(sizeClass: Int): Int {
        return self.publicBodyCells(sizeClass) - 1;
    }

    fun requirePublicPayloadCell(cell: Cell, expectedHash: Int, sizeClass: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(self.publicBodyCells(sizeClass));
            throwUnless(sizeExit, size.cells <= self.publicBodyCells(sizeClass));
            throwUnless(sizeExit, size.bits > 0);
            throwUnless(sizeExit, size.bits <= self.publicBodyBits(sizeClass));
            throwUnless(sizeExit, size.bits % 8 == 0);
            throwUnless(sizeExit, size.refs <= self.publicBodyRefs(sizeClass));
        } catch (exitCode) {
            throw(sizeExit);
        }
    }

    fun requirePublicHeaderCell(cell: Cell, expectedHash: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS);
            throwUnless(sizeExit, size.cells <= CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS);
            throwUnless(sizeExit, size.bits > 0);
            throwUnless(sizeExit, size.bits <= CAPSULEHUB_PUBLIC_HEADER_MAX_BITS);
            throwUnless(sizeExit, size.bits % 8 == 0);
            throwUnless(sizeExit, size.refs <= CAPSULEHUB_PUBLIC_HEADER_MAX_REFS);
        } catch (exitCode) {
            throw(sizeExit);
        }
    }

    fun privateUsefulBytes(sizeClass: Int): Int {
        throwUnless(12941, self.isAllowedPrivateSizeClass(sizeClass));
        return sizeClass * 1024;
    }

    fun privateBodyOverheadBytes(cryptoSuite: Int): Int {
        throwUnless(12942, cryptoSuite == CRYPTO_SUITE_HYBRID);
        return CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES;
    }

    fun privateBodyBytes(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyOverheadBytes(cryptoSuite) + self.privateUsefulBytes(sizeClass);
    }

    fun privateBodyBits(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyBytes(sizeClass, cryptoSuite) * 8;
    }

    fun privateBodyCells(sizeClass: Int, cryptoSuite: Int): Int {
        return (self.privateBodyBytes(sizeClass, cryptoSuite) + 126) / 127;
    }

    fun privateBodyRefs(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyCells(sizeClass, cryptoSuite) - 1;
    }

    // clean-16 ИНК4: INTRO body shape uses the larger INTRO overhead (ct_root + handshake fields). INTRO is
    // hybrid-only (first contact is what establishes the PQ K_root), so no cryptoSuite parameter is needed.
    fun introBodyBytes(sizeClass: Int): Int {
        return CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES + self.privateUsefulBytes(sizeClass);
    }

    fun introBodyBits(sizeClass: Int): Int {
        return self.introBodyBytes(sizeClass) * 8;
    }

    fun introBodyCells(sizeClass: Int): Int {
        return (self.introBodyBytes(sizeClass) + 126) / 127;
    }

    fun introBodyRefs(sizeClass: Int): Int {
        return self.introBodyCells(sizeClass) - 1;
    }

    fun pageId(entryId: Int): Int {
        return entryId / CAPSULEHUB_PAGE_SIZE;
    }

    fun pageOffset(entryId: Int): Int {
        return entryId % CAPSULEHUB_PAGE_SIZE;
    }

    fun pageCount(latestId: Int): Int {
        if (latestId == 0) {
            return 0;
        }
        return ((latestId - 1) / CAPSULEHUB_PAGE_SIZE) + 1;
    }

    fun pageExists(pageId: Int, latestId: Int): Bool {
        return pageId >= 0 && pageId < self.pageCount(latestId);
    }

    fun pageFirstEntryId(pageId: Int): Int {
        return pageId * CAPSULEHUB_PAGE_SIZE;
    }

    fun pageNextEntryId(pageId: Int, latestId: Int): Int {
        let next: Int = (pageId + 1) * CAPSULEHUB_PAGE_SIZE;
        if (next > latestId) {
            return latestId;
        }
        return next;
    }

    fun pageEntryCount(pageId: Int, latestId: Int): Int {
        if (!self.pageExists(pageId, latestId)) {
            return 0;
        }
        return self.pageNextEntryId(pageId, latestId) - self.pageFirstEntryId(pageId);
    }

    fun entryLink(entryId: Int): Int {
        return entryId + 1;
    }

    fun entryIdFromLink(entryLink: Int): Int {
        return entryLink - 1;
    }

    // clean-16 ИНК1: the private-lane index key is the client's OPAQUE HKDF bucketKey, read from the same
    // header0 window the pre-clean-16 sender keyId occupied (bits[64,320): a 64-bit meta skip, then the
    // 256-bit value). The contract treats it as an opaque map key — it derives NO sender/recipient/
    // directionality from it (D7-override). The recipient keyId extractor is deleted with the recipient
    // index: the open who-to-whom graph the redesign exists to close is gone on-chain.
    fun privateHeaderBucketKey(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        return header.loadUint(256);
    }

    // Forward-stub for ИНК3 (NOT yet wired into any assert — see the ИНК1/ИНК3 plan). Once CONV and RECOVERY
    // share an identical header0 length, the receive path will cross-check this against the batch publish_kind
    // to stop a CONV capsule landing in the RECOVERY pool (or vice versa). Until ИНК3 wires it, it is an unused
    // pure extractor with no on-chain effect. Layout: skip 40 bits (magic32 + version8), then the 8-bit publishKind.
    fun privateHeaderPublishKind(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(40);
        return header.loadUint(8);
    }

    // clean-16 ИНК4 INTRO header0 extractors. The 336-bit INTRO header0 layout is meta(64) | ephemeral_R(256) |
    // view_tag(16). ephemeral_R occupies the SAME bits[64,320) window CONV uses for its bucketKey; view_tag is the
    // trailing 16 bits[320,336). Both are read ONLY for the scan getters — they are never stored as an index.
    fun introHeaderEphemeralR(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        return header.loadUint(256);
    }

    fun introHeaderViewTag(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        header.loadUint(256);
        return header.loadUint(16);
    }

    fun pushPrivateBucketIndex(bucketKey: Int, entryLink: Int): Int {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_bucket_index.get(bucketKey);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.private_bucket_index.set(bucketKey, PrivateCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    fun prunePrivateBucketIndex(bucketKey: Int, entryLink: Int, prevLink: Int) {
        // Private bucket indexes are retained-history hints. Pruning an expired middle entry can truncate older expired tail traversal; archive recovery should use page/body-history scans.
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_bucket_index.get(bucketKey);
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.private_bucket_index.del(bucketKey);
            } else {
                self.private_bucket_index.set(bucketKey, index);
            }
        }
    }

    // Public author key id: hash of the standard-address serialization of the author wallet. The client
    // derives the identical key with beginCell().storeAddress(addr).endCell().hash(). Workchain-agnostic.
    // clean-16 B3: publicAuthorKeyId(author_wallet) is gone — the public index is now keyed by channel_id
    // (= publicChannelKeyId(spend_pubkey), computed at publish time), stored on the entry and reused directly.

    // Mirror of the private bucket-index push, for the public author index (posts).
    fun pushPublicAuthorIndex(keyId: Int, entryLink: Int): Int {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_author_index.get(keyId);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.public_author_index.set(keyId, PublicCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    // Mirror of the private bucket-index push, for the public parent index (comments), keyed by parent entry id.
    fun pushPublicParentIndex(parentEntryId: Int, entryLink: Int): Int {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_parent_index.get(parentEntryId);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.public_parent_index.set(parentEntryId, PublicCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    // Mirror of the private bucket-index prune; same retained-history contract (middle links are not rewired).
    fun prunePublicAuthorIndex(keyId: Int, entryLink: Int, prevLink: Int) {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_author_index.get(keyId);
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.public_author_index.del(keyId);
            } else {
                self.public_author_index.set(keyId, index);
            }
        }
    }

    fun prunePublicParentIndex(parentEntryId: Int, entryLink: Int, prevLink: Int) {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_parent_index.get(parentEntryId);
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.public_parent_index.del(parentEntryId);
            } else {
                self.public_parent_index.set(parentEntryId, index);
            }
        }
    }

    // Auto-eviction (public): delete up to maxEvict oldest entries that are past the retention window, advancing
    // the low-water mark. Strict FIFO by entry id (== creation order, since created_at is monotone with id), so
    // each deleted entry is the TAIL of its author/parent chain — no middle-prune, no truncation, entry_count exact.
    // Stops at the first non-expired entry (nothing older can be expired). O(maxEvict), funded by the publisher.
    fun evictExpiredPublic(maxEvict: Int) {
        let oid: Int = self.public_oldest_live_id;
        let evicted: Int = 0;
        let stop: Bool = false;
        while ((!stop) && (evicted < maxEvict) && (oid < self.public_latest_id)) {
            let entryOpt: PublicCapsuleEntry? = self.public_entries.get(oid);
            if (entryOpt == null) {
                oid += 1; // defensive: FIFO never leaves a live gap, but skip a missing id rather than spin
            } else {
                let entry: PublicCapsuleEntry = entryOpt!!;
                if (now() < entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS) {
                    stop = true;
                } else {
                    let entryLink: Int = self.entryLink(oid);
                    if (entry.parent_link == 0) {
                        let authorKey: Int = entry.channel_id;   // channel_id IS the index key (§6)
                        self.prunePublicAuthorIndex(authorKey, entryLink, entry.prev_link);
                        // clean-11: reclaim the per-author profile pointer if THIS evicted post was its target,
                        // so public_profile_index stays bounded by LIVE profiles (mirrors the author-index del-at-zero).
                        let profOpt: Int? = self.public_profile_index.get(authorKey);
                        if ((profOpt != null) && (profOpt!! == entryLink)) {
                            self.public_profile_index.del(authorKey);
                        }
                    } else {
                        self.prunePublicParentIndex(self.entryIdFromLink(entry.parent_link), entryLink, entry.prev_link);
                    }
                    self.public_entries.del(oid);
                    self.public_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.public_oldest_live_id = oid;
    }

    // Auto-eviction (private): mirror of the public path; un-pushes the single opaque bucket index of each
    // evicted entry (the opaque bucketKey parsed from header_0). There is no second directional index to prune.
    fun evictExpiredPrivate(maxEvict: Int) {
        let oid: Int = self.private_oldest_live_id;
        let evicted: Int = 0;
        let stop: Bool = false;
        while ((!stop) && (evicted < maxEvict) && (oid < self.private_latest_id)) {
            let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(oid);
            if (entryOpt == null) {
                oid += 1;
            } else {
                let entry: PrivateCapsuleEntry = entryOpt!!;
                if (now() < entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS) {
                    stop = true;
                } else {
                    let entryLink: Int = self.entryLink(oid);
                    self.prunePrivateBucketIndex(self.privateHeaderBucketKey(entry.header_0), entryLink, entry.bucket_prev_link);
                    self.private_entries.del(oid);
                    self.private_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.private_oldest_live_id = oid;
    }

    // clean-16 ИНК4: scan-only FIFO eviction of the INTRO pool. Same shape as evictExpiredPrivate but with NO
    // index un-push (INTRO carries no index). Stops at the first non-expired entry; defensively skips holes.
    fun evictExpiredIntro(maxEvict: Int) {
        let oid: Int = self.intro_oldest_live_id;
        let evicted: Int = 0;
        let stop: Bool = false;
        while ((!stop) && (evicted < maxEvict) && (oid < self.intro_latest_id)) {
            let entryOpt: IntroCapsuleEntry? = self.intro_entries.get(oid);
            if (entryOpt == null) {
                oid += 1;
            } else {
                let entry: IntroCapsuleEntry = entryOpt!!;
                if (now() < entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS) {
                    stop = true;
                } else {
                    self.intro_entries.del(oid);
                    self.intro_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.intro_oldest_live_id = oid;
    }

    fun computeVaultPrivateEntryUid(entryId: Int, publishId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_PRIVATE, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(entryId, 64)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    // clean-16 ИНК4: INTRO entry uid — same hash-fields shape as the private uid, distinct domain tag so INTRO
    // and CONV/RECOVERY entry ids live in disjoint uid spaces.
    fun computeVaultIntroEntryUid(entryId: Int, publishId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_INTRO, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(entryId, 64)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    // clean-16 ИНК6: RECOVERY entry uid keyed by the slotKey (there is no sequential entry id), distinct domain tag.
    fun computeVaultRecoveryEntryUid(slotKey: Int, publishId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_RECOVERY, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(slotKey, 256)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    fun computeVaultPublicEntryUid(entryId: Int, publishId: Int, channelId: Int, headerHash: Int, bodyHash: Int): Int {
        let payloadFields: Cell = beginCell()
            .storeUint(channelId, 256)
            .storeUint(headerHash, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_PUBLIC, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(entryId, 64)
            .storeRef(payloadFields)
            .endCell()
            .hash();
    }

    receive(msg: BindDeploymentManifest) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(12910, !self.vault_bound);
        throwUnless(12911, msg.deployment_manifest_hash != 0);
        throwUnless(12912, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(12913, self.isBasechainAddress(msg.counterpart_address));
        throwUnless(12914, msg.counterpart_address != myAddress());
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.vault_address = msg.counterpart_address;
        self.vault_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(12920, msg.deployment_manifest_hash != 0);
        throwUnless(12921, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(12922, self.vault_bound);
        throwUnless(12923, self.credit_issuer_bound);   // clean-16 B3: anon-publish needs the CreditIssuer bound
        self.sealed = true;
    }

    // ===== clean-16 B3 anon-publish lifecycle + pool/mirror receivers =====

    receive(msg: BindCreditIssuer) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(13580, self.isBasechainAddress(msg.credit_issuer_address));
        throwUnless(13581, msg.credit_issuer_address != myAddress());
        self.credit_issuer_address = msg.credit_issuer_address;
        self.credit_issuer_bound = true;
    }

    // Mirror a CreditIssuer issuer slot: genesis-fill (unsealed) + post-seal controller-authenticated Replace/Revoke
    // propagation. version STRICTLY monotone (anti-reorder/replay). Hub-first Revoke is a governance-runner rule (§9).
    receive(msg: HubMirrorIssuerKey) {
        self.requireGenesisController();
        throwUnless(13582, msg.slot < 16);
        let existingOpt: IssuerSlot? = self.issuer_mirror.get(msg.slot);
        if (existingOpt != null) {
            throwUnless(13615, msg.version > existingOpt!!.version);
        }
        self.issuer_mirror.set(msg.slot, IssuerSlot { pubkey: msg.pubkey, active: msg.active, version: msg.version });
    }

    // The bound CreditIssuer forwards a credit purchase into the prepaid pool (Variant B, epoch-bucketed). The value
    // it carries (credits_k × prepaidUnit) is KEPT as pool backing (poolTerm rises inside protectedReserve); only the
    // gas float is returned with the ack, which lets CreditIssuer release the k blind signatures.
    receive(msg: FundAnonPool) {
        self.requireSealed();
        throwUnless(13611, sender() == self.credit_issuer_address);
        throwUnless(13610, msg.credits_k >= 1);
        // clean-16 B3 (adversarial-review fix): bound the buyer-declared epoch to the SAME acceptance window the spend
        // (13600) and reclaim (13616) sides use. Without this, a far-future/garbage epoch (client bug or griefer) makes
        // a funded_by_epoch bucket that can NEVER be spent AND never reclaimed → poolTerm permanently inflated (violates
        // the Variant-B boundedness invariant on an immutable contract). A rejected forward bounces (bounce:true) back to
        // the CreditIssuer, whose bounced-handler refunds the exact buyer — so a bad epoch fails safe, not silently stuck.
        let nowEpoch: Int = now() / EPOCH_SECONDS;
        throwUnless(13617, (msg.epoch >= nowEpoch - EPOCH_ACCEPT_PAST) && (msg.epoch <= nowEpoch + EPOCH_ACCEPT_FUTURE));
        let backing: Int = msg.credits_k * CAPSULEHUB_PREPAID_UNIT;
        throwUnless(13612, context().value >= backing + CAPSULEHUB_FUND_LOCAL_EXEC_RESERVE);
        self.funded_by_epoch.set(msg.epoch, self.epochFunded(msg.epoch) + msg.credits_k);
        self.anon_pool_outstanding += msg.credits_k;
        // Keep the backing (+ pre-existing balance); return the float with the ack.
        nativeReserve(backing, ReserveAtMost | ReserveAddOriginalBalance);
        message(MessageParameters {
            to: sender(),
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: FundAnonPoolAck { credits_k: msg.credits_k, epoch: msg.epoch, purchase_id: msg.purchase_id }.toCell()
        });
    }

    // Permissionless FIFO nullifier eviction (standalone; publish also folds it in). Gate = expiry.
    receive(msg: EvictExpiredNullifiers) {
        self.requireSealed();
        let cap: Int = msg.max_count;
        if (cap > CAPSULEHUB_STANDALONE_NULLIFIER_EVICT_CAP) { cap = CAPSULEHUB_STANDALONE_NULLIFIER_EVICT_CAP; }
        self.evictNullifiersFIFO(cap);
    }

    // Permissionless reclamation of an epoch funding bucket that has fallen out of the acceptance window: its
    // unspent (funded − spent) backing is forfeited (removed from poolTerm → sweepable) so the pool term stays
    // bounded to the live-epoch window (Variant B, §5.4).
    receive(msg: ReclaimExpiredFunding) {
        self.requireSealed();
        let nowEpoch: Int = now() / EPOCH_SECONDS;
        throwUnless(13616, msg.epoch < (nowEpoch - EPOCH_ACCEPT_PAST));
        let outstanding: Int = self.epochFunded(msg.epoch) - self.epochSpent(msg.epoch);
        if (outstanding > 0) {
            self.anon_pool_outstanding -= outstanding;
        }
        self.funded_by_epoch.set(msg.epoch, null);
        self.spent_by_epoch.set(msg.epoch, null);
    }

    // entry.publish_id = hash(EPI1 ‖ batch_publish_id ‖ part_index:u16) — a distinct, verifiable id per stored entry.
    fun computeEntryPublishId(batchPublishId: Int, partIndex: Int): Int {
        return beginCell()
            .storeUint(CAPSULE_ENTRY_PUBLISH_ID_DOMAIN, 32)
            .storeUint(batchPublishId, 256)
            .storeUint(partIndex, 16)
            .endCell()
            .hash();
    }

    // Running hash over the part-ordered per-entry uids (client cross-check; no on-chain consumer).
    fun accumulateBatchUid(acc: Int, uid: Int): Int {
        return beginCell().storeUint(acc, 256).storeUint(uid, 256).endCell().hash();
    }

    // Per-entry storage reserve carried IN the batch value, with the 1.25 protectedReserve buffer (S1 finding).
    fun batchStorageReserveWithBuffer(kind: Int): Int {
        // clean-16 ИНК5: exhaustive per-kind endowment; an unrecognized kind THROWS rather than falling through
        // to a wrong default (SAFETY #3 — a forgotten branch must never silently under/over-reserve a new lane).
        let endowment: Int = 0;
        if (kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) { endowment = CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT; }
        else if (kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) { endowment = CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT; }
        else if (kind == CAPSULEHUB_ENTRY_KIND_INTRO) { endowment = CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT; }
        else if (kind == CAPSULEHUB_ENTRY_KIND_RECOVERY) { endowment = CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT; }
        else { throw(13591); }
        // endowment = measured 1-year rent; ×1.25 buffer = the +3-month margin. No per-entry keepalive (the 100 TON
        // protected floor covers account liveness — design RT3-#6).
        return endowment * CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR / CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR;
    }

    // ===== clean-16 B3: permissionless anonymous spend-publish (§3) — the SOLE publish path (Vault path removed) =====
    // Handles CONV(=PRIVATE) + PUBLIC + INTRO; RECOVERY has its own self-funded receiver (§7). Authorization is
    // per-part crypto (issuer_sig over serial + spend_sig over the frame) + an epoch-nullifier double-spend ledger —
    // the old sender()==vault trust is gone. The relay pays gas from msg.value; the storage endowment is already on
    // the Hub balance (prepaid pool), so a spam batch cannot touch protectedReserve (internal msg = no acceptMessage;
    // compute gas is burned from the relay's value on revert).
    receive(msg: PublishAnonBatch) {
        // Phase A — root scalars (O(1), cheap→expensive fail-fast)
        self.requireSealed();
        throwUnless(13501, msg.publish_id != 0);
        // PRIVATE (CONV) + PUBLIC + INTRO. RECOVERY has its OWN self-funded receiver (§7), not here.
        throwUnless(13502, (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) || (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) || (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_INTRO));
        throwUnless(13503, (msg.part_count >= 1) && (msg.part_count <= MAX_BATCH_PARTS_ANON));
        // [SAFE-CAP] Refuse in COMPUTE (bounces, relay refunded) rather than let the ACTION phase hit code 50
        // (silent, no bounce, capsule gone, payer not refunded). Checked BEFORE any crypto so the refusal is cheap.
        throwUnless(13618, (self.private_live_count + self.public_live_count + self.intro_live_count + msg.part_count) <= CAPSULEHUB_SAFE_LIVE_CAP);
        throwUnless(13619, (self.nullifier_live_count + msg.part_count) <= CAPSULEHUB_SAFE_NULLIFIER_CAP);
        let relay: Address = sender();                       // captured for the ACK (§8) — old sender()==vault gate removed
        let nowEpoch: Int = now() / EPOCH_SECONDS;

        let isConv: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PRIVATE);
        let isIntro: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_INTRO);
        let isPublic: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PUBLIC);

        let firstEntryId: Int = self.private_latest_id;
        if (isIntro) { firstEntryId = self.intro_latest_id; }
        else if (isPublic) { firstEntryId = self.public_latest_id; }
        throwUnless(13504, firstEntryId + msg.part_count <= 18446744073709551615);

        // PUBLIC marketing-note guard (13507/13508), unchanged from the Vault path.
        if (isPublic) {
            let mk: Cell? = msg.marketing;
            throwUnless(13507, mk != null);
            throwUnless(13508, mk!!.beginParse().loadUint(152) == PLATHO_PUBLIC_MARKETING_NOTE_ASCII);
        }

        // Phase A cheap lower bound: gas + ack only. The endowment is prepaid on-balance, NOT brought by the relay.
        throwUnless(13509, context().value >= msg.part_count * HUB_MIN_PER_PART_VALUE + CAPSULEHUB_ACK_FORWARD_RESERVE);

        let cursor: Cell = msg.parts;
        let tokenCursor: Cell = msg.tokens;
        let i: Int = 0;
        let requiredValue: Int = getComputeFee(HUB_BATCH_BASE_GAS, false) + CAPSULEHUB_ACK_FORWARD_RESERVE;
        let batchUid: Int = 0;
        while (i < msg.part_count) {
            let isLast: Bool = (i == (msg.part_count - 1));
            let entryId: Int = firstEntryId + i;
            let entryPublishId: Int = self.computeEntryPublishId(msg.publish_id, i);

            // --- spend-token parse (parallel list, one node per part; §2.2) ---
            let tok: Slice = tokenCursor.beginParse();
            let wantTokRefs: Int = 2;                         // issuer_sig + spend_sig
            if (!isLast) { wantTokRefs = 3; }                // + next_token
            // token shape doubles as the tokens-len == part_count guard (13609, RT2-F2/RT6-8): a short list makes a
            // non-last node carry 2 refs (want 3); a long list makes the last node carry 3 (want 2). Either fails here.
            throwUnless(13609, (tok.bits() == 616) && (tok.refs() == wantTokRefs));
            let serial: Int = tok.loadUint(256);
            let slot: Int = tok.loadUint(8);
            let spendPubkey: Int = tok.loadUint(256);
            let epoch: Int = tok.loadUint(32);
            let nonce: Int = tok.loadUint(64);
            let issuerSig: Slice = tok.loadRef().beginParse();
            let spendSig: Slice = tok.loadRef().beginParse();
            let nextTok: Cell = msg.tokens;                  // overwritten when not last; unused on the last iteration
            if (!isLast) { nextTok = tok.loadRef(); }

            // --- issuer-side verification: epoch window → serial commitment → slot active → double-spend → issuer_sig ---
            self.verifyIssuerToken(serial, slot, spendPubkey, epoch, nonce, issuerSig, nowEpoch);

            let nextCell: Cell = msg.parts;                  // overwritten when not last; unused on the last iteration
            let part: Slice = cursor.beginParse();
            if (isConv) {
                let wantRefs: Int = 3;
                if (!isLast) { wantRefs = 4; }
                throwUnless(13510, (part.bits() == 784) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let cryptoSuite: Int = part.loadUint(8);
                let h0: Int = part.loadUint(256);
                let h1: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header0: Cell = part.loadRef();
                let header1: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                // Existing lane-parse integrity — PRESERVED VERBATIM (§3.3/§10): requireExactPayloadCell binds each ref
                // cell to its scalar hash, so spend_sig-over-scalars transitively covers the real header/body cells.
                throwUnless(13511, self.isAllowedPrivatePair(sizeClass, cryptoSuite));
                throwUnless(13512, (h0 != 0) && (h1 != 0) && (bh != 0));
                self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_CONV_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13513, 13514);
                throwUnless(13519, self.privateHeaderPublishKind(header0) == msg.publish_kind);
                self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13515, 13516);
                self.requireExactPayloadCell(body, bh, self.privateBodyCells(sizeClass, cryptoSuite), self.privateBodyBits(sizeClass, cryptoSuite), self.privateBodyRefs(sizeClass, cryptoSuite), 13517, 13518);
                // spend_sig binds serial + ALL frame scalars → token-splicing/reorder fails checkSignature (RT1-BLOCKER-1)
                throwUnless(13605, checkSignature(self.spendDigestPrivate(serial, msg.publish_kind, sizeClass, cryptoSuite, h0, h1, bh), spendSig, spendPubkey));
                // consume one prepaid credit from the token's OWN epoch bucket (per-epoch fail-closed guard 13613, §5.4-B)
                self.spendPoolCredit(epoch);
                let entryLink: Int = self.entryLink(entryId);
                let bucketPrevLink: Int = self.pushPrivateBucketIndex(self.privateHeaderBucketKey(header0), entryLink);
                let uid: Int = self.computeVaultPrivateEntryUid(entryId, entryPublishId, h0, h1, bh);
                self.private_entries.set(entryId, PrivateCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    body_hash: bh,
                    bucket_prev_link: bucketPrevLink,
                    header_0: header0,
                    header_1: header1
                });
                self.private_live_count += 1;
                // Revenue model (§5.3): accrue protocolFee(PRIVATE) from the Hub's OWN constant (relay can't spoof it).
                self.accrued_plato_fee_ton += self.privateFullFee(CRYPTO_SUITE_HYBRID);
                requiredValue += getComputeFee(HUB_PART_GAS_PRIVATE, false) + getComputeFee(HUB_TOKEN_VERIFY_GAS, false);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            } else if (isIntro) {
                // INTRO: same 784-bit private frame, 336-bit header0 (ephemeral_R + view_tag), larger body, NO index.
                // protocolFee(INTRO) = 0 (§5.3): the credit's PUBLIC-worst-case fee component stays as sweepable margin.
                let wantRefs: Int = 3;
                if (!isLast) { wantRefs = 4; }
                throwUnless(13540, (part.bits() == 784) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let cryptoSuite: Int = part.loadUint(8);
                let h0: Int = part.loadUint(256);
                let h1: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header0: Cell = part.loadRef();
                let header1: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                throwUnless(13541, self.isAllowedPrivatePair(sizeClass, cryptoSuite));
                throwUnless(13542, (h0 != 0) && (h1 != 0) && (bh != 0));
                self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_INTRO_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13543, 13544);
                throwUnless(13549, self.privateHeaderPublishKind(header0) == msg.publish_kind);
                self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13545, 13546);
                self.requireExactPayloadCell(body, bh, self.introBodyCells(sizeClass), self.introBodyBits(sizeClass), self.introBodyRefs(sizeClass), 13547, 13548);
                throwUnless(13605, checkSignature(self.spendDigestPrivate(serial, msg.publish_kind, sizeClass, cryptoSuite, h0, h1, bh), spendSig, spendPubkey));
                self.spendPoolCredit(epoch);
                let uid: Int = self.computeVaultIntroEntryUid(entryId, entryPublishId, h0, h1, bh);
                self.intro_entries.set(entryId, IntroCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    body_hash: bh,
                    header_0: header0,
                    header_1: header1
                });
                self.intro_live_count += 1;
                requiredValue += getComputeFee(HUB_PART_GAS_INTRO, false) + getComputeFee(HUB_TOKEN_VERIFY_GAS, false);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            } else {
                // PUBLIC: 592-bit frame; author_wallet removed — the discovery/attribution key is the crypto-bound
                // channel_id = publicChannelKeyId(spend_pubkey) (§6). Lane-parse otherwise unchanged from the Vault path.
                let wantRefs: Int = 2;
                if (!isLast) { wantRefs = 3; }
                throwUnless(13520, (part.bits() == 592) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let reserved: Int = part.loadUint(8);
                let parentLink: Int = part.loadUint(64);
                let h0: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                throwUnless(13521, (reserved & 254) == 0);       // bit0 = is_profile; bits 1..7 reserved 0
                let isProfile: Bool = (reserved & 1) == 1;
                throwUnless(13522, self.isAllowedPublicSizeClass(sizeClass));
                throwUnless(13523, (h0 != 0) && (bh != 0));
                throwUnless(13529, (!isProfile) || (parentLink == 0));   // is_profile only on a top-level post
                throwUnless(13528, (parentLink == 0) || (parentLink <= entryId));
                self.requirePublicHeaderCell(header, h0, 13524, 13525);
                self.requirePublicPayloadCell(body, bh, sizeClass, 13526, 13527);
                // spend_sig binds serial + the PUBLIC frame scalars (§3.3 public variant) → token-splicing fails here.
                throwUnless(13605, checkSignature(self.spendDigestPublic(serial, msg.publish_kind, sizeClass, reserved, parentLink, h0, bh), spendSig, spendPubkey));
                self.spendPoolCredit(epoch);
                let channelId: Int = self.publicChannelKeyId(spendPubkey);
                let uid: Int = self.computeVaultPublicEntryUid(entryId, entryPublishId, channelId, h0, bh);
                let entryLink: Int = self.entryLink(entryId);
                let publicPrevLink: Int = 0;
                let profilePrevLink: Int = 0;
                if (parentLink == 0) {
                    publicPrevLink = self.pushPublicAuthorIndex(channelId, entryLink);
                    if (isProfile) {
                        self.public_profile_index.set(channelId, entryLink);
                        profilePrevLink = self.public_profile_head;
                        self.public_profile_head = entryLink;
                    }
                } else {
                    publicPrevLink = self.pushPublicParentIndex(self.entryIdFromLink(parentLink), entryLink);
                }
                self.public_entries.set(entryId, PublicCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    channel_id: channelId,
                    body_hash: bh,
                    parent_link: parentLink,
                    prev_link: publicPrevLink,
                    profile_prev_link: profilePrevLink,
                    header: header
                });
                self.public_live_count += 1;
                self.accrued_plato_fee_ton += PLATO_PUBLIC_POST_FEE_TON;   // protocolFee(PUBLIC), §5.3
                // No top-up: G8 measured PUBLIC (10.5 cells) CHEAPER than PRIVATE (12), and the credit is priced at
                // PRIVATE — so one credit already over-covers a public post's backing.
                requiredValue += getComputeFee(HUB_PART_GAS_PUBLIC, false) + getComputeFee(HUB_TOKEN_VERIFY_GAS, false);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            }
            // Nullifier insert AFTER all per-part checks. Tact reverts-all on any later throw (V2 value gate below), so
            // an underfunded/short batch never burns a token (fail-closed, §3.4). Intra-batch dup: the next part's
            // verifyIssuerToken sees this insert and reverts 13604.
            self.insertNullifier(self.nullifierKey(serial));
            cursor = nextCell;
            tokenCursor = nextTok;
            i += 1;
        }
        // Full gas gate (atomic): ONLY gas + ack, NOT endowment (prepaid). Reverts every store + nullifier insert above
        // if the relay underfunded gas.
        throwUnless(13530, context().value >= requiredValue);
        // Commit lane counters + own-lane FIFO eviction.
        if (isConv) {
            self.private_latest_id += msg.part_count;
            self.evictExpiredPrivate(msg.part_count);
        } else if (isPublic) {
            self.public_latest_id += msg.part_count;
            self.evictExpiredPublic(msg.part_count);
        } else {
            self.intro_latest_id += msg.part_count;
            self.evictExpiredIntro(msg.part_count);
        }
        // Unconditional capped INTRO sweep on non-INTRO batches (low-frequency lane still sheds expired entries).
        if (!isIntro) {
            let introSweep: Int = msg.part_count;
            if (introSweep > CAPSULEHUB_INTRO_SWEEP_CAP) { introSweep = CAPSULEHUB_INTRO_SWEEP_CAP; }
            self.evictExpiredIntro(introSweep);
        }
        // Nullifier FIFO eviction: fold evicts part_count + margin >= inserted → net live growth <= 0 (§4.2).
        self.evictNullifiersFIFO(msg.part_count + NULLIFIER_SWEEP_MARGIN);
        // ACK → relay (§8): reserve keeps the ENTIRE pre-existing balance (prepaid pool + every locked endowment, all
        // already on-balance), returning only the unspent incoming gas float. reserve(protectedReserve) would be WRONG —
        // it would leak the sweepable surplus to the relay.
        nativeReserve(0, ReserveAtMost | ReserveAddOriginalBalance);
        message(MessageParameters {
            to: relay,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: CapsuleHubBatchAck {
                publish_id: msg.publish_id,
                first_entry_id: firstEntryId,
                part_count: msg.part_count,
                batch_uid: batchUid
            }.toCell()
        });
    }

    // ===== clean-16 B3: RECOVERY durability lane (§7) — separate, SELF-FUNDED, owner_sig-authorized =====
    // RECOVERY is its OWN K_root durability (not sender-anonymous: it stores the owner's own key, already in the tx),
    // so it does NOT ride the prepaid token pool — that would bloat prepaidUnit with a 200M unit and kill the cheap
    // lanes. It brings its endowment directly in msg.value and is authorized by an ed25519 owner_sig over the frame,
    // binding the slot to its first publisher's pubkey (anti destructive-overwrite of the K_root blob).
    receive(msg: PublishRecovery) {
        self.requireSealed();
        throwUnless(13501, msg.publish_id != 0);
        // [SAFE-CAP] RECOVERY is the line where a silent code 50 costs the most: the slot holds K_root, so losing
        // it loses the whole conversation history irreversibly. An overwrite of an EXISTING slot adds no state, so
        // only a NEW slot is capped — the check below is the cheap upper bound; the exact existed/!existed test
        // happens later, and an overwrite at the cap is admitted by that path without growing state.
        throwUnless(13565, self.recovery_live_count < CAPSULEHUB_SAFE_RECOVERY_CAP);
        let relay: Address = sender();

        // Single CONV-shaped 784-bit frame (3 refs: header0, header1, body — no next).
        let part: Slice = msg.part.beginParse();
        throwUnless(13550, (part.bits() == 784) && (part.refs() == 3));
        let sizeClass: Int = part.loadUint(8);
        let cryptoSuite: Int = part.loadUint(8);
        let h0: Int = part.loadUint(256);
        let h1: Int = part.loadUint(256);
        let bh: Int = part.loadUint(256);
        let header0: Cell = part.loadRef();
        let header1: Cell = part.loadRef();
        let body: Cell = part.loadRef();
        throwUnless(13551, self.isAllowedPrivatePair(sizeClass, cryptoSuite));
        throwUnless(13552, (h0 != 0) && (h1 != 0) && (bh != 0));
        throwUnless(13560, sizeClass <= RECOVERY_MAX_SIZE_CLASS);
        // Existing integrity — PRESERVED (§7/RT6-MAJOR-3): without body.hash()==bh a relay could overwrite the slot
        // with the same bh but garbage body (the body is stored ON-CHAIN), destroying the K_root blob forever.
        self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_CONV_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13553, 13554);
        throwUnless(13559, self.privateHeaderPublishKind(header0) == CAPSULEHUB_ENTRY_KIND_RECOVERY);
        self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13555, 13556);
        self.requireExactPayloadCell(body, bh, self.privateBodyCells(sizeClass, cryptoSuite), self.privateBodyBits(sizeClass, cryptoSuite), self.privateBodyRefs(sizeClass, cryptoSuite), 13557, 13558);

        let slotKey: Int = self.privateHeaderBucketKey(header0);
        // recoveryDigest binds slotKey (derived from header0) + the monotonic seq + all three frame hashes; swapping
        // header0 changes slotKey, header1/body changes h1/bh, and seq is signed → any tamper fails owner_sig (§7).
        // DOMAIN(32)+slotKey(256)+seq(64)+ref = 352 inline bits < 1023 (the three frame hashes spill into the ref).
        let recoveryDigest: Int = beginCell()
            .storeUint(RECOVERY_SLOT_DOMAIN, 32).storeUint(slotKey, 256).storeUint(msg.seq, 64)
            .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
            .endCell().hash();
        throwUnless(13571, checkSignature(recoveryDigest, msg.owner_sig.beginParse(), msg.owner_pubkey));

        let existingOpt: RecoveryCapsuleRecord? = self.recovery_slots.get(slotKey);
        let existed: Bool = (existingOpt != null);
        // First publisher binds owner_pubkey; only that pubkey (with a valid owner_sig) may overwrite. AND the seq must
        // STRICTLY increase (13564) — this is the anti-replay/rollback guard: a stale but validly-signed message carries
        // an older seq and is rejected, so the slot cannot be rolled back to a superseded K_root blob (review fix).
        if (existed) {
            throwUnless(13563, existingOpt!!.owner_pubkey == msg.owner_pubkey);
            throwUnless(13564, msg.seq > existingOpt!!.seq);
        }

        // Self-funded value gate: a NEW slot must carry its full endowment + gas + ack; an OVERWRITE reuses the
        // already-protected slot reserve (retention clock resets, per-entry reserve = full worst-case, still covered).
        let requiredValue: Int = getComputeFee(HUB_BATCH_BASE_GAS, false) + getComputeFee(HUB_PART_GAS_RECOVERY, false) + CAPSULEHUB_ACK_FORWARD_RESERVE;
        let keptEndowment: Int = 0;
        if (!existed) {
            keptEndowment = self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_RECOVERY);
            requiredValue += keptEndowment;
        }
        throwUnless(13576, context().value >= requiredValue);

        self.recovery_slots.set(slotKey, RecoveryCapsuleRecord {
            publish_id: msg.publish_id,
            updated_at: now(),
            body_hash: bh,
            owner_pubkey: msg.owner_pubkey,
            seq: msg.seq,
            header_0: header0,
            header_1: header1,
            body: body
        });
        if (!existed) { self.recovery_live_count += 1; }
        let uid: Int = self.computeVaultRecoveryEntryUid(slotKey, msg.publish_id, h0, h1, bh);

        // ACK → relay: keep the pre-existing balance PLUS the new slot's endowment (self-funded, brought in value),
        // returning only the leftover gas float. Overwrite keeps 0 extra (slot already backed).
        nativeReserve(keptEndowment, ReserveAtMost | ReserveAddOriginalBalance);
        message(MessageParameters {
            to: relay,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: CapsuleHubBatchAck { publish_id: msg.publish_id, first_entry_id: 0, part_count: 1, batch_uid: uid }.toCell()
        });
    }

    receive(msg: FlushFees) {
        self.requireSealed();
        throwUnless(13200, msg.amount > 0);
        throwUnless(13201, msg.amount <= self.accrued_plato_fee_ton);
        throwUnless(13205, msg.amount >= CAPSULEHUB_MIN_FEE_FLUSH_TON || msg.amount == self.accrued_plato_fee_ton);
        throwUnless(13202, context().value >= CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE);
        let effectiveBalance: Int = myBalance() - context().value;
        throwUnless(13206, effectiveBalance >= self.protectedReserve());

        self.accrued_plato_fee_ton -= msg.amount;

        message(MessageParameters {
            to: self.fee_accumulator_address,
            value: msg.amount + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositProtocolFee { amount: msg.amount }.toCell()
        });
    }

    bounced(msg: bounced<DepositProtocolFee>) {
        self.requireSealed();
        throwUnless(13203, sender() == self.fee_accumulator_address);
        throwUnless(13204, msg.amount > 0);
        // Flush bounces restore debited accrued fees; reserve-sweep bounces reclassify returned excess as backed accrued due for the normal flush path.
        self.accrued_plato_fee_ton += msg.amount;
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for CapsuleHub storage reserve only. Counters, fees, and bindings are unchanged.
    }

    receive(msg: SweepExcessReserve) {
        self.requireSealed();
        throwUnless(13220, msg.amount > 0);
        throwUnless(13221, msg.amount >= CAPSULEHUB_MIN_RESERVE_SWEEP_TON);
        throwUnless(13222, context().value >= CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

        let effectiveBalance: Int = myBalance() - context().value;
        let protected: Int = self.protectedReserve();
        throwUnless(13223, effectiveBalance > protected);
        let excess: Int = effectiveBalance - protected;
        throwUnless(13224, msg.amount <= excess);

        message(MessageParameters {
            to: self.fee_accumulator_address,
            value: msg.amount + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositProtocolFee { amount: msg.amount }.toCell()
        });
    }

    // clean-16 ИНК6: permissionless reclaim of an EXPIRED RECOVERY slot. The keyed slot map has no FIFO eviction
    // (a page can only hold one current recovery blob), so a slot is only reclaimed once its 3-year retention has
    // lapsed. Deleting it drops the live-count term so the endowment it protected is released to the sweepable
    // surplus. No auth: the expiry check IS the gate.
    receive(msg: EvictExpiredRecoverySlot) {
        self.requireSealed();
        let recOpt: RecoveryCapsuleRecord? = self.recovery_slots.get(msg.slot_key);
        throwUnless(13562, recOpt != null);
        let rec: RecoveryCapsuleRecord = recOpt!!;
        throwUnless(13561, (rec.updated_at + CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS) < now());
        self.recovery_slots.set(msg.slot_key, null);
        self.recovery_live_count -= 1;
    }

    // clean-16 L6/#11: permissionless standalone eviction. Reclaims up to CAPSULEHUB_STANDALONE_EVICT_CAP expired
    // entries of the requested lane WITHOUT a publish — so a quiet private/public lane still sheds its backlog. Same
    // FIFO/retention logic as the publish-path eviction; the caller funds the gas. No auth (expiry IS the gate).
    receive(msg: EvictExpiredCapsules) {
        self.requireSealed();
        let n: Int = msg.max_count;
        if (n > CAPSULEHUB_STANDALONE_EVICT_CAP) { n = CAPSULEHUB_STANDALONE_EVICT_CAP; }
        if (msg.kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) {
            self.evictExpiredPrivate(n);
        } else if (msg.kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) {
            self.evictExpiredPublic(n);
        } else if (msg.kind == CAPSULEHUB_ENTRY_KIND_INTRO) {
            self.evictExpiredIntro(n);
        } else {
            throw(13570); // unknown lane
        }
    }

    get fun get_recovery_capsule(slotKey: Int): RecoveryCapsuleView {
        let recOpt: RecoveryCapsuleRecord? = self.recovery_slots.get(slotKey);
        if (recOpt == null) {
            return RecoveryCapsuleView {
                exists: false,
                slot_key: slotKey,
                updated_at: 0,
                body_hash: 0,
                owner_pubkey: 0,
                seq: 0,
                header_0: emptyCell(),
                header_1: emptyCell(),
                body: emptyCell()
            };
        }
        let rec: RecoveryCapsuleRecord = recOpt!!;
        return RecoveryCapsuleView {
            exists: true,
            slot_key: slotKey,
            updated_at: rec.updated_at,
            body_hash: rec.body_hash,
            owner_pubkey: rec.owner_pubkey,
            seq: rec.seq,
            header_0: rec.header_0,
            header_1: rec.header_1,
            body: rec.body
        };
    }

    get fun get_private_entry(entryId: Int): PrivateCapsuleEntryView {
        let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(entryId);
        if (entryOpt == null) {
            return PrivateCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                bucket_prev_link: 0,
                entry_uid: 0,
                publish_id: 0,
                author_wallet: myAddress(),
                page_id: self.pageId(entryId),
                page_offset: self.pageOffset(entryId),
                created_at: 0,
                header_0_hash: 0,
                header_1_hash: 0,
                body_hash: 0,
                header_0: emptyCell(),
                header_1: emptyCell()
            };
        }
        let entry: PrivateCapsuleEntry = entryOpt!!;
        let header0Hash: Int = entry.header_0.hash();
        let header1Hash: Int = entry.header_1.hash();
        return PrivateCapsuleEntryView {
            exists: true,
            entry_id: entryId,
            bucket_prev_link: entry.bucket_prev_link,
            entry_uid: self.computeVaultPrivateEntryUid(entryId, entry.publish_id, header0Hash, header1Hash, entry.body_hash),
            publish_id: entry.publish_id,
            author_wallet: self.vault_address,
            page_id: self.pageId(entryId),
            page_offset: self.pageOffset(entryId),
            created_at: entry.created_at,
            header_0_hash: header0Hash,
            header_1_hash: header1Hash,
            body_hash: entry.body_hash,
            header_0: entry.header_0,
            header_1: entry.header_1
        };
    }

    // clean-16 ИНК1: the SOLE private-lane index getter. Keyed by the opaque bucketKey; there is no
    // sender-keyed or recipient-keyed getter anymore, so the on-chain private lane exposes NO who-to-whom
    // edge. A party fetches its own incoming/outgoing CONV entries by deriving its own bucketKeys client-side.
    get fun get_private_bucket_index(bucketKey: Int): PrivateBucketIndexView {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_bucket_index.get(bucketKey);
        if (indexOpt == null) {
            return PrivateBucketIndexView {
                exists: false,
                bucket_key: bucketKey,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PrivateCapsuleKeyIndex = indexOpt!!;
        return PrivateBucketIndexView {
            exists: true,
            bucket_key: bucketKey,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    // clean-16 ИНК4 INTRO getters. get_intro_entry returns one stored INTRO capsule; get_intro_scan_bounds gives
    // the live scan window; get_intro_scan_page returns up to 64 scan rows (view_tag + ephemeral_R read straight
    // out of header_0) so the recipient trial-decrypts without fetching bodies. No sender/recipient index exists.
    get fun get_intro_entry(entryId: Int): IntroCapsuleEntryView {
        let entryOpt: IntroCapsuleEntry? = self.intro_entries.get(entryId);
        if (entryOpt == null) {
            return IntroCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                entry_uid: 0,
                publish_id: 0,
                created_at: 0,
                header_0_hash: 0,
                header_1_hash: 0,
                body_hash: 0,
                header_0: emptyCell(),
                header_1: emptyCell()
            };
        }
        let entry: IntroCapsuleEntry = entryOpt!!;
        let header0Hash: Int = entry.header_0.hash();
        let header1Hash: Int = entry.header_1.hash();
        return IntroCapsuleEntryView {
            exists: true,
            entry_id: entryId,
            entry_uid: self.computeVaultIntroEntryUid(entryId, entry.publish_id, header0Hash, header1Hash, entry.body_hash),
            publish_id: entry.publish_id,
            created_at: entry.created_at,
            header_0_hash: header0Hash,
            header_1_hash: header1Hash,
            body_hash: entry.body_hash,
            header_0: entry.header_0,
            header_1: entry.header_1
        };
    }

    get fun get_intro_scan_bounds(): IntroScanBoundsView {
        return IntroScanBoundsView {
            oldest_live_id: self.intro_oldest_live_id,
            latest_id: self.intro_latest_id,
            live_count: self.intro_live_count
        };
    }

    get fun get_intro_scan_page(fromEntryId: Int, count: Int): IntroScanPageView {
        let clamped: Int = count;
        if (clamped > 64) { clamped = 64; }
        if (clamped < 0) { clamped = 0; }
        let records: map<Int as uint16, IntroScanRecord> = emptyMap();
        let i: Int = 0;
        let emitted: Int = 0;
        while (i < clamped) {
            let eid: Int = fromEntryId + i;
            let entryOpt: IntroCapsuleEntry? = self.intro_entries.get(eid);
            if (entryOpt != null) {
                let entry: IntroCapsuleEntry = entryOpt!!;
                records.set(emitted, IntroScanRecord {
                    entry_id: eid,
                    created_at: entry.created_at,
                    view_tag: self.introHeaderViewTag(entry.header_0),
                    ephemeral_r: self.introHeaderEphemeralR(entry.header_0)
                });
                emitted += 1;
            }
            i += 1;
        }
        return IntroScanPageView { from_entry_id: fromEntryId, count: emitted, records: records };
    }

    get fun get_public_author_index(keyId: Int): PublicCapsuleKeyIndexView {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_author_index.get(keyId);
        if (indexOpt == null) {
            return PublicCapsuleKeyIndexView {
                exists: false,
                key_id: keyId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PublicCapsuleKeyIndex = indexOpt!!;
        return PublicCapsuleKeyIndexView {
            exists: true,
            key_id: keyId,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    // clean-11: latest profile entry link for a channel (keyId = publicAuthorKeyId(author)). exists=false /
    // entry_link=0 when the channel never published a profile. The returned entry MAY be evicted — the client
    // cross-checks with get_public_entry(entry_id).exists (dangling-tolerant by design).
    get fun get_public_profile_index(keyId: Int): PublicCapsuleKeyIndexView {
        let linkOpt: Int? = self.public_profile_index.get(keyId);
        if (linkOpt == null) {
            return PublicCapsuleKeyIndexView {
                exists: false,
                key_id: keyId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let link: Int = linkOpt!!;
        return PublicCapsuleKeyIndexView {
            exists: true,
            key_id: keyId,
            latest_entry_id: self.entryIdFromLink(link),
            latest_entry_link: link,
            entry_count: 1
        };
    }

    // clean-11: head link of the global profile chain (0 = no profile ever). The client walks it newest-first via
    // get_public_entry(...).profile_prev_link for COMPLETE described-channel discovery.
    get fun get_public_profile_head(): Int {
        return self.public_profile_head;
    }

    get fun get_public_parent_index(parentEntryId: Int): PublicCapsuleKeyIndexView {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_parent_index.get(parentEntryId);
        if (indexOpt == null) {
            return PublicCapsuleKeyIndexView {
                exists: false,
                key_id: parentEntryId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PublicCapsuleKeyIndex = indexOpt!!;
        return PublicCapsuleKeyIndexView {
            exists: true,
            key_id: parentEntryId,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    get fun get_public_entry(entryId: Int): PublicCapsuleEntryView {
        let entryOpt: PublicCapsuleEntry? = self.public_entries.get(entryId);
        if (entryOpt == null) {
            return PublicCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                entry_uid: 0,
                publish_id: 0,
                channel_id: 0,
                page_id: self.pageId(entryId),
                page_offset: self.pageOffset(entryId),
                created_at: 0,
                header_hash: 0,
                body_hash: 0,
                parent_link: 0,
                prev_link: 0,
                profile_prev_link: 0,
                header: emptyCell()
            };
        }
        let entry: PublicCapsuleEntry = entryOpt!!;
        let headerHash: Int = entry.header.hash();
        return PublicCapsuleEntryView {
            exists: true,
            entry_id: entryId,
            entry_uid: self.computeVaultPublicEntryUid(entryId, entry.publish_id, entry.channel_id, headerHash, entry.body_hash),
            publish_id: entry.publish_id,
            channel_id: entry.channel_id,
            page_id: self.pageId(entryId),
            page_offset: self.pageOffset(entryId),
            created_at: entry.created_at,
            header_hash: headerHash,
            body_hash: entry.body_hash,
            parent_link: entry.parent_link,
            prev_link: entry.prev_link,
            profile_prev_link: entry.profile_prev_link,
            header: entry.header
        };
    }

    get fun get_private_page(pageId: Int): CapsuleHubPageView {
        if (!self.pageExists(pageId, self.private_latest_id)) {
            return CapsuleHubPageView {
                exists: false,
                page_id: pageId,
                first_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                next_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                entry_count: 0,
                opened_at: 0,
                updated_at: 0
            };
        }
        return CapsuleHubPageView {
            exists: true,
            page_id: pageId,
            first_entry_id: self.pageFirstEntryId(pageId),
            next_entry_id: self.pageNextEntryId(pageId, self.private_latest_id),
            entry_count: self.pageEntryCount(pageId, self.private_latest_id),
            opened_at: 0,
            updated_at: 0
        };
    }

    get fun get_public_page(pageId: Int): CapsuleHubPageView {
        if (!self.pageExists(pageId, self.public_latest_id)) {
            return CapsuleHubPageView {
                exists: false,
                page_id: pageId,
                first_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                next_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                entry_count: 0,
                opened_at: 0,
                updated_at: 0
            };
        }
        return CapsuleHubPageView {
            exists: true,
            page_id: pageId,
            first_entry_id: self.pageFirstEntryId(pageId),
            next_entry_id: self.pageNextEntryId(pageId, self.public_latest_id),
            entry_count: self.pageEntryCount(pageId, self.public_latest_id),
            opened_at: 0,
            updated_at: 0
        };
    }

    get fun get_state(): CapsuleHubStateView {
        return CapsuleHubStateView {
            sealed: self.sealed,
            vault_bound: self.vault_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            private_latest_id: self.private_latest_id,
            public_latest_id: self.public_latest_id,
            private_page_count: self.pageCount(self.private_latest_id),
            public_page_count: self.pageCount(self.public_latest_id),
            page_size: CAPSULEHUB_PAGE_SIZE,
            index_storage_years: CAPSULEHUB_INDEX_STORAGE_YEARS,
            index_retention_seconds: CAPSULEHUB_INDEX_RETENTION_SECONDS,
            accrued_plato_fee_ton: self.accrued_plato_fee_ton,
            fee_accumulator_address: self.fee_accumulator_address,
            vault_address: self.vault_address,
            genesis_controller_address: self.genesis_controller_address,
            private_live_count: self.private_live_count,
            public_live_count: self.public_live_count,
            intro_latest_id: self.intro_latest_id,
            intro_oldest_live_id: self.intro_oldest_live_id,
            intro_live_count: self.intro_live_count,
            recovery_live_count: self.recovery_live_count,
            index_storage_reserve_ton: self.indexStorageReserve(),
            protected_reserve_ton: self.protectedReserve(),
            reserve_floor_ton: CAPSULEHUB_MIN_PROTECTED_RESERVE_TON,
            reserve_buffer_numerator: CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR,
            reserve_buffer_denominator: CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR
        };
    }

    // clean-16 B3 observability getters (§9/§4/§5).
    get fun get_anon_pool_state(): AnonPoolStateView {
        return AnonPoolStateView {
            credit_issuer_bound: self.credit_issuer_bound,
            credit_issuer_address: self.credit_issuer_address,
            nullifier_live_count: self.nullifier_live_count,
            nullifier_latest: self.nullifier_latest,
            nullifier_oldest_live: self.nullifier_oldest_live,
            anon_pool_outstanding: self.anon_pool_outstanding,
            prepaid_unit: CAPSULEHUB_PREPAID_UNIT,
            max_batch_parts_anon: MAX_BATCH_PARTS_ANON
        };
    }

    get fun get_issuer_slot(slot: Int): IssuerSlotView {
        let s: IssuerSlot? = self.issuer_mirror.get(slot);
        if (s == null) {
            return IssuerSlotView { exists: false, slot: slot, pubkey: 0, active: false, version: 0 };
        }
        return IssuerSlotView { exists: true, slot: slot, pubkey: s!!.pubkey, active: s!!.active, version: s!!.version };
    }

    // Live (funded − spent) credits still backing an epoch bucket; 0 once reclaimed or fully spent.
    get fun get_epoch_funding(epoch: Int): Int {
        return self.epochFunded(epoch) - self.epochSpent(epoch);
    }

    // Membership probe for the nullifier ledger: the insert_time of a spent serial's key, or 0 if unspent.
    get fun get_nullifier_insert_time(serial: Int): Int {
        let t: Int? = self.spent_nullifiers.get(self.nullifierKey(serial));
        if (t == null) { return 0; }
        return t!!;
    }

    receive() {
        throw(13999);
    }
}
