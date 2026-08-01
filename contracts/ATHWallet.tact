// Platho v1 ATH Wallet implementation.
// Scope: deterministic wallet derivation, authenticated burn request forwarding,
// and owner-authorized bounce-safe ATH transfers.

const ATH_TRANSFER_NOTIFY_ACK_VALUE: Int = 1000000;
const ATH_REGISTRY_RESPONSE_ACK_VALUE: Int = 3000000;
const ATH_INTERNAL_TRANSFER_ACK_VALUE: Int = 3000000;
// [MEASURED 2026-07-29, raised 1M -> 4M] THIS FUNDS THE ONLY PATH THAT CLEARS pending_outgoing_transfers, and that
// map has no bound, no prune and no getter. The value IS the gas budget: ATHWallet never calls accept_message, so an
// incoming internal message may burn at most value/gas_price units — 1M bought exactly 15 000 at 66.667/unit.
// Clearing costs a hash plus a dict get and delete on a 257-bit key, and that grows with the DEPTH of the tree.
// Measured in the sandbox (worst of 24 sampled keys per size):
//     N=1 -> 6 499 gas | N=2000 -> 14 724 (276 spare) | N=4000 -> 14 999 and exit -14 on 2 of 24
//     N=6000 -> 6 of 24 fail | N=9000 -> 10 of 24 fail
// Past ~4 000 entries the ack simply runs out of gas. It is sent bounce:false, so nobody — not the sender, not the
// recipient, not the client — learns anything; the entry becomes PERMANENT while sending keeps working on a budget
// 48x larger. Each stuck entry deepens the tree, so the failing fraction grows: a one-way ratchet toward the
// ~65 536-cell account ceiling, on an immutable contract, invisible from outside because there is no getter.
// 4M buys 60 000 units — 4x the measured ceiling, and ~71 tree levels at the measured ~748 gas per level, i.e.
// beyond any depth an account can physically hold. It also puts this path above ATH_PRUNE_NOTIFICATION_EXEC_RESERVE
// (2M), which does the same dict work on the BOUNDED sibling map and was funded twice as well as this one.
// Raising it costs the caller: the constant is composed into gates 14212/14314/14563/14663/14714/14717 and into
// required_value, so every funding floor moves with it by construction — which is exactly why it is safe to raise.
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE: Int = 4000000;
// [MEASURED 2026-08-01, lowered 21M -> 8M] What it costs to carry the sender's leg to the recipient wallet. This was
// the one large constant in this contract with no measurement recorded against it, and it was the single biggest term
// in a transfer floor that sat ABOVE what an ordinary wallet attaches: at 21,000,000 the plain TEP-74 floor was
// 56,000,000, Tonkeeper attaches 50,000,000, and ATH could not be sent from any standard wallet at all.
//
// Measured in tests/ath-transfer-cost-anatomy.test.ts (COST-01), through the real sender, which attaches the wallet
// code on EVERY transfer whether or not the recipient already exists — so both cases cost the same:
//     empty forward_payload   2 650 155
//     8 cells                 2 691 577
//     100 cells               3 231 314
//     250 cells               4 111 321      <- worst measured, growth ~5 844 per cell
// 8,000,000 is 1.95x the worst measured and ~3x the ordinary case, and leaves room for ~900 further payload cells.
// Beyond that the arrival simply falls short of gate 14717/14212 and BOUNCES, restoring the sender's balance — the
// failure mode is a refusal, not a loss, which is why a generous-but-finite allowance is the right shape here.
const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE: Int = 8000000;
const ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE: Int = 2000000;
// [MEASURED 2026-07-20, raised 30M -> 45M] This floor is what keeps a REFUSED registry purchase refundable.
// When a registry throws, the notification bounces and the ATH goes home as an ATHInternalTransfer funded by
// SendRemainingValue out of what bounced — and the payer's own wallet gates that arrival at 14212
// (2M + 3M + 4M + 20M = 29M; it was 26M until the source-ack constant above was raised 1M -> 4M on 2026-07-29,
// and 14212 composes that constant, so the gate moved with it). The sender-side gate on the same money, 14335,
// only demands 12M, so between the two there is a
// window where the refund is SENT, arrives under-funded, throws, and the buyer's ATH is stranded on the
// registry's official wallet. Immutable after seal, so the floor has to be measured, not modelled.
//
// Measured (tests/ath-notify-refund-floor.test.ts), refusal overhead deducted from notify_value before arrival:
//     30,000,000 -> arrives 24,037,796  => BELOW 26M: refund throws 14212, ATH stranded
//     empty registry   overhead 6,236,737
//     200 profiles     overhead 6,336,737
//     800 profiles     overhead 6,383,404
// The refusing transaction's gas is paid out of the notification, and dictionary gas grows with DEPTH, so the
// overhead rises as the product grows: ~+46,667 per doubling at the 800-profile point, i.e. ~6.9M extrapolated at
// a million profiles. A floor calibrated on an empty registry would decay into the stranding window silently,
// years after the seal. 45M leaves ~38.6M on arrival against the now-29M gate (~1.33x) and tolerates the refusal
// overhead growing ~2.5x (to ~16M) before anyone loses money. It was ~1.47x / nearly-triple against the old 26M
// gate; the source-ack raise consumed part of that headroom deliberately, and the remaining margin still covers
// the extrapolated ~6.9M overhead at a million profiles more than twice over. Re-check this line if either
// constant moves again — the two are coupled through 14212 and nothing else states it.
const ATH_TRANSFER_NOTIFY_MIN_VALUE: Int = 45000000;
// [COMMENT CORRECTED 2026-07-19] This used to be justified as rent for one `processed_notifications` entry — the
// permanent replay tombstone, which was DELETED (see the state declaration below for why). What still justifies it
// is the RECIPIENT wallet's own rent: an inbound transfer may DEPLOY that wallet, and this endowment is the only
// thing funding it.
//
// That paragraph used to end "paying rent forever" and defer the sizing as "its own job". MEASURED 2026-07-31, so
// the deferral is closed and the number is written down instead of promised:
//
//   81 deduplicated code cells + 3 for the account and data, at the frozen 64,962 per cell-year => 5,456,808/year.
//   Cross-checks against this repo's own MSTAB-09 figure: the treasury wallet's 24,832,861 => 4.55 years.
//   So 20,000,000 funds 3.67 years of positive balance, after which rent accrues as due_payment.
//   basechain freeze_due_limit is 100,000,000 (config param 21, parsed to a zero-bit remainder; an earlier read of
//   this took the fields one position short and reported 10,000,000, which is block_gas_limit).
//   Freeze therefore lands at (20,000,000 + 100,000,000) / 5,456,808 = ~22 YEARS. Deletion is ~165 years after that.
//
// TWENTY-TWO YEARS IS A FLOOR, NOT AN EXPECTATION: every inbound transfer retains another 20,000,000, so the clock
// only runs on a wallet that receives nothing whatsoever in that time.
//
// [Owner decision 2026-07-31: leave the value.] Buying the 100-year horizon this protocol uses for its permanent
// accounts costs 446,000,000 here — a transfer goes from 0.048 to 0.474 GRAM and the airdrop's per-delivery leg
// grows by the same factor across every recipient. That is a bad trade against a clock any single transfer resets.
//
// Lowering it still requires the measurement above: it feeds gate 14212 and would under-fund every freshly deployed
// wallet. Raising it is an economics decision, not a safety one.
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT: Int = 20000000;
const ATH_INTERNAL_TRANSFER_EXEC_RESERVE: Int = 2000000;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE: Int = 7000000;
const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
// EXACTLY what gate 14212 demands of an arriving ATHInternalTransfer. Named because a refund leg has to be sized
// against it: the refund travels with SendRemainingValue, so it can never DELIVER more than arrived, and a refund
// funded below this floor is one that is guaranteed to bounce.
const ATH_INTERNAL_TRANSFER_ARRIVAL_MIN: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE
    + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
// What an OWNER-INITIATED clawback must carry, so that the refund it produces actually clears the payer's floor.
// [ADDED 2026-07-29, wave-8 HIGH] Gate 14335 alone asks for 9,000,000 plus the ack, which is 2.2-2.6x SHORT of
// ATH_INTERNAL_TRANSFER_ARRIVAL_MIN — no measurement needed, the inequality is arithmetic. A refund funded to the
// old floor destroyed the escrow record (it is deleted before delivery is proven), bounced at the payer's 14212,
// and was re-credited to the RECIPIENT by the ordinary outgoing-bounce handler: the payer paid, received nothing,
// and lost the claim, because nothing in this contract ever recreates a pending_notifications entry. Deliberately
// applied ONLY on the owner-initiated path, where the caller chooses the value and can always fund it properly.
// The bounce-driven path keeps the lower floor on purpose: a bounce carries whatever came back, and raising the
// bar there would turn "an underfunded refund" into "no refund at all, and the one bounce spent" — see the
// bounced handlers.
// SIZED, NOT GUESSED: the first attempt at this constant also added ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE (21M)
// and came out at 60,000,000 — above the 45,000,000 both registries actually send, so it refused the very refunds
// it exists to protect. The registry suites caught it immediately. What the leg really needs is the arrival floor,
// plus this receiver's own execution and forward fee, plus the ack leg the flat lane pays out of the same value.
// Pinned by ATH-REFUND-FLOOR-01, which funds a refund at EXACTLY this number and requires it to be accepted.
const ATH_NOTIFY_REFUND_OWNER_MIN_VALUE: Int = ATH_INTERNAL_TRANSFER_ARRIVAL_MIN + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
    + ATH_REGISTRY_RESPONSE_ACK_VALUE;
const ATH_OWNER_REQUEST_EXEC_RESERVE: Int = 2000000;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE: Int = 10000000;
const ATH_OWNER_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const ATH_GENESIS_SUPPLY_EXEC_RESERVE: Int = 2000000;
const ATH_GENESIS_SUPPLY_ACK_VALUE: Int = 1000000;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN: Int = 0x41544E49; // "ATNI"
const ATH_OUTGOING_TRANSFER_ID_DOMAIN: Int = 0x41544F47; // "ATOG"

// [ADDED 2026-07-29, wave-8 HIGH] Grace before a stranger may unwind a pending_outgoing_transfers entry.
//
// A legitimate entry lives for SECONDS: the recipient wallet credits the ATH and sends send_source_wallet_ack in the
// SAME transaction that acks the requester, and that ack deletes the entry here. Nothing legitimate holds one open.
// 30 days is therefore not a tuned figure but a deliberate absurdity — it is longer than ATH_REGISTRY_PENDING_TTL
// (the longest escrow window anywhere in this contract) by more than four times, so no honest flow can ever reach it.
const ATH_OUTGOING_STUCK_RECOVERY_GRACE_SECONDS: Int = 2592000; // 30 days
// The unwind emits ATHTransferFailed into a counterparty that will do real work with it (MarketStabilitySeller
// refunds the buyer, the registries unwind an escrow), so the caller must fund that leg. Sized from this contract's
// own largest receiver reserve plus a response ack, not guessed.
const ATH_OUTGOING_STUCK_RECOVERY_MIN_VALUE: Int = ATH_OWNER_REQUEST_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
    + ATH_REGISTRY_RESPONSE_ACK_VALUE;
const ATH_NOTIFY_REFUND_QUERY_DOMAIN: Int = 0x41545246; // "ATRF"
const ATH_QUERY_ID_MOD: Int = 18446744073709551616;
const ATH_SENDER_KEY_MOD: Int = 1461501637330902918203684832716283019655932542976; // 2^160
const ATH_PENDING_NOTIFICATION_TTL: Int = 86400; // 24 hours — plain lane
// [OWNER DECISION 2026-07-19] The registry lanes (username mint / profile avatar) used to be UNPRUNABLE outright:
// gate 14353 refused any prune of a pending carrying the registry marker, at any age, forever. That handed anyone a
// permanent griefing primitive — measured, a stuck pending costs 3 cells, so ~21,845 of them fill an ordinary
// user's ATH wallet to the account ceiling for about 1333 GRAM, after which every write to that wallet fails
// SILENTLY (compute exit 0, ACTION code 50) and the user can never buy a name, set a paid avatar, or receive ATH
// again. Immutable, so unfixable after seal.
//
// A TTL closes it without giving up what 14353 was protecting. The danger of pruning is pruning a LIVE pending: the
// balance is credited on the inbound message, so if the entry disappears before the registry settles, the buyer has
// paid and the mint never completes. A legitimate settlement — the registry acking, or refusing and refunding —
// happens within seconds. A week is six orders of magnitude of headroom over that, while still making the attack
// something the attacker must pay for again every week instead of once forever.
const ATH_REGISTRY_PENDING_TTL: Int = 604800; // 7 days — registry lanes, deliberately far longer than the plain one
const JETTON_EXCESSES_VALUE: Int = 1000000;

message(0x41544801) ATHBurn {
    query_id: Int as uint64;
    amount: Int as uint128;
    response_destination: Address;
}

// Field order is intentional: query_id + amount fit inside bounced-message prefix.
// This lets ATHWallet restore balance if the burn notification bounces.
message(0x41544802) ATHBurnNotification {
    query_id: Int as uint64;
    amount: Int as uint128;
    owner_address: Address;
    response_destination: Address;
}

message(0x41544803) ATHBurnFinalized {
    query_id: Int as uint64;
    amount: Int as uint128;
    owner_address: Address;
}

message(0x41544804) ATHBurnFailed {
    query_id: Int as uint64;
    amount: Int as uint128;
}

// ATH Master -> official treasury wallet. One-shot fixed-supply genesis credit.
message(0x41544805) ATHGenesisSupplyCredit {
    query_id: Int as uint64;
    amount: Int as uint128;
    response_destination: Address;
}

message(0x41544806) ATHGenesisSupplyAck {
    query_id: Int as uint64;
    amount: Int as uint128;
    owner_address: Address;
}

message(0x472D9D7D) AthTransferNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    sender_wallet: Address;
}

message(0x472D9D7E) AthTransferNotificationAck {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint160;
}

message(0x4154481E) AthTransferNotificationRefund {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint160;
}

message(0x504E5052) PruneStaleNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
}

// Official username ATH wallet -> UsernameRegistry for a registry-funded username mint. payer_wallet is stamped by
// the official ATH wallet from the real payer's derived address, owner_wallet is the wallet receiving the NFT.
// (Named "Vault" until 2026-07-19: this lane predates the Vault's cancellation and the registries took the role.)
// [§4c 2026-07-23] username is a `Cell` (a dedicated ref), NOT `Slice as remaining` like its 0x4154481C/1D
// siblings. Those siblings carry >1023 fixed bits, so Tact auto-spills the trailing remaining-slice into a fresh
// cell and a 16-char name fits. THIS message's fixed part is only 926 bits (op32+query_id64+sender_key160+
// amount128+payer267+owner267+len8), leaving 97 inline bits = 12 chars; a 13..16-char name (all sold at full
// price) overflowed the 1023-bit cell → exit 8 when the wallet built the notification. A `Cell` field is always a
// ref, so the name now lives in its own cell (name bytes only, still FLAT — UsernameRegistry.isValidUsernameBytes
// parses it and requires refsEmpty + bits==len*8). Root = 926 bits + 1 ref; fits any name up to 127 chars.
message(0x89129D60) AthTransferNotificationRegistryMintUsername {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Cell;
}

// Official profile ATH wallet -> ProfileRegistry for a registry-funded profile avatar. payer_wallet is stamped by
// the official ATH wallet from the real payer's derived address, owner_wallet is the wallet whose public avatar
// pointer is being updated.
message(0xA11A7002) AthTransferNotificationRegistryProfileAvatar {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

// Owner -> own official ATH wallet. Field order is intentional for owner-side bounce recovery.
message(0x41544810) ATHTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

message(0x41544814) ATHTransferRequestWithNotify {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_destination: Address;
    notify_value: Int as uint128;
}

message(0x4154481A) ATHTransferRequestRegistryProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x4154481C) ATHTransferRequestRegistryMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

// ATH wallet -> recipient ATH wallet. Field order is intentional for wallet-side bounce recovery.
message(0x41544812) ATHInternalTransfer {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
}

message(0x41544815) ATHInternalTransferWithNotify {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_destination: Address;
    notify_value: Int as uint128;
}

message(0x4154481B) ATHInternalTransferRegistryProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x4154481D) ATHInternalTransferRegistryMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

// Recipient ATH wallet -> response destination after successful credit.
message(0x41544811) ATHTransferAck {
    query_id: Int as uint64;
    amount: Int as uint128;
}

// Source ATH wallet -> response destination after internal transfer bounce/failure.
message(0x41544813) ATHTransferFailed {
    query_id: Int as uint64;
    amount: Int as uint128;
}

// TEP-74 compatible surface used by external jetton routers. Platho system
// contracts still consume the authenticated ATH* messages above.
message(0x0F8A7EA5) JettonTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x178D4519) JettonInternalTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    from: Address;
    response_address: Address;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x7362D09C) JettonTransferNotification {
    query_id: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forward_payload: Slice as remaining;
}

message(0xD53276DB) JettonExcesses {
    query_id: Int as uint64;
}

// "ATH"+0x1F — [ADDED 2026-08-01] change from a custom-lane transfer, returned to the response_destination the
// sender named. A distinct opcode rather than reusing JettonExcesses: the counterparties on this lane are CONTRACTS
// with strict receivers, and an unknown opcode arriving at one of them throws. Sent bounce:false so a refusal costs
// nothing — but it must not collide with something they already handle.
//
// 0x1F chosen after enumerating the whole ATH space: 01..0A and 10..15, 1A..1E are taken. The first number that
// looked natural, 0x41544809, is ATHMaster.DeployTreasurySupply — an opcode collision is a defect this project has
// already had once, and it is invisible until the wrong receiver runs.
message(0x4154481F) ATHTransferExcess {
    query_id: Int as uint64;
}

message(0x41544807) ATHWalletTopUpStorageReserve {} // "ATH"+0x07 — F11/#2: no-authority storage-reserve top-up

// "ATH"+0x08 — [ADDED 2026-07-29, wave-8 HIGH] unwind an outgoing transfer that can no longer terminate.
//
// WHY THIS EXISTS. Every contract that spends ATH through this wallet — ATHVesting, MarketStabilitySeller,
// FeeAccumulator, both registries — parks itself in a PENDING phase until one of ATHTransferAck / ATHTransferFailed /
// bounced<ATHTransferRequest> comes back. If none ever does, that phase is terminal: the counterparty freezes forever,
// and for MarketStabilitySeller that freezes the entire 60,000,000 ATH reserve together with a buyer's paid TON.
// Since a contract is IMMUTABLE after seal, the exit has to exist before the seal or it never exists.
//
// WHY IT CANNOT LOSE OR DOUBLE-SPEND. The obvious escape — let the stuck counterparty time out on its own — forces it
// to GUESS whether the ATH moved, and both guesses are wrong: crediting the claim destroys a tranche, releasing it
// pays twice. This wallet never has to guess, because the pending entry IS the answer. It is written before the
// internal transfer leaves (store_pending_outgoing) and deleted the moment the recipient's ack arrives, and the
// recipient emits that ack in the SAME transaction as the requester's. So an entry still present after the grace
// proves the transfer did not complete, and the unwind — balance restored here, ATHTransferFailed to the RECORDED
// response_destination — is the truth, not a bet. If the transfer did complete, there is no entry and 14251 refuses.
//
// WHY IT IS PERMISSIONLESS. It reads its destination out of storage and can never be pointed anywhere by the caller;
// the ATH returns to this wallet's own balance, so there is nothing for a caller to take. It must be open precisely
// because the counterparty is usually the frozen party, and an owner-only exit would be locked behind the freeze.
message(0x41544808) ATHRecoverStuckOutgoing {
    query_id: Int as uint64;
    recipient_wallet: Address;
}

// TEP-74 standard get_wallet_data shape: positional 4-tuple {int balance, slice owner, slice jetton_master,
// cell jetton_wallet_code}. The 4th field (jetton_wallet_code) is what indexers (tonapi) + wallets (Tonkeeper)
// require to classify this as a jetton wallet and read the balance — clean-11 omitted it (3-tuple) → invisible.
struct ATHWalletDataView {
    balance: Int;
    owner_address: Address;
    ath_master_address: Address;
    jetton_wallet_code: Cell;
}

struct PendingAthTransferNotificationView {
    exists: Bool;
    sender_owner: Address;
    response_destination: Address;
    amount: Int;
    created_at: Int;
}

struct PendingAthTransferNotification {
    sender_owner: Address;
    response_destination: Address;
    response_ack_value: Int as uint64;
    amount: Int as uint128;
    created_at: Int as uint64;
}

struct PendingAthOutgoingTransfer {
    recipient_wallet: Address;
    response_destination: Address;
    amount: Int as uint128;
    created_at: Int as uint64;
}

contract ATHWallet {
    balance: Int as uint128;
    owner_address: Address;
    ath_master_address: Address;
    // [DELETED 2026-07-19: processed_notifications, the permanent replay tombstone. DO NOT RESTORE IT.]
    //
    // It was one permanent map entry per inbound notification, with ZERO `.del` anywhere in this contract, on an
    // account that is a SINGLETON for its owner — a jetton wallet is one per (owner, master) by TEP-74 and cannot be
    // sharded. Measured: 3.00 cells/entry => ~21,845 inbound notifications, ever, then the ~65536-cell account
    // ceiling is hit and writes fail SILENTLY (compute exit 0, ACTION code 50, wallet reports success). Since a
    // .ath name and a paid avatar are both bought with ATH and land on the registry's ONE official wallet, that
    // capped usernames and profiles at ~21,845 for the whole product, against a million-user target, forever.
    //
    // IT NEVER PROTECTED THE BALANCE, which is why deleting it is safe rather than a trade:
    //   1. `derive_wallet_address` returns contractAddressExt(workchain, code, data) — the address IS the hash of
    //      code+data, so gate 14311/14561/14661 proves the sender runs THIS EXACT bytecode. A forged sender wallet
    //      cannot exist.
    //   2. That same bytecode debits before sending and restores only via bounce, where the pending key is `.del`ed,
    //      so a restore happens exactly once. Every credit is therefore backed by exactly one debit.
    //   3. The credit happens on the INBOUND message; the tombstone was written LATER, on the ack. It could not
    //      guard money that had already moved.
    //   4. The one reachable double-processing window — a duplicate arriving while the first is still pending — is
    //      closed by 14315/14565/14665, which are untouched.
    // Replay safety now lives on the SEMANTIC key at the consumer, which is both stronger and the pattern this
    // contract already uses: the TEP-74 lane below (`JettonInternalTransfer`) has never written a tombstone, and
    // says so explicitly.
    //   * UsernameRegistry rejects a repeat by name_hash. [UPDATED 2026-07-20 — this used to name gates
    //     19172/19173, and 19172 no longer exists: the registry's name_records map was deleted (it was that
    //     contract's ~21,500-name ceiling, the same disease as this tombstone). The property is unchanged and the
    //     refusal simply moved to the contract that always owned it — the per-name UsernameNFTItem refuses
    //     re-initialisation at its own gate 18011, the message bounces, and the buyer's ATH is refunded. 19173
    //     still guards an in-flight duplicate.]
    //   * ProfileRegistry rejects a repeat of the current avatar pointer at 21115, added in the same change
    //     because it had no guard at all.
    //
    // Residual, and it is NARROWER than this note first claimed. "A resend with the same query_id is paid for by
    // a SECOND debit, so it is a second genuine purchase" holds only where the consumer's semantic key produces a
    // REFUSAL — which is the registry lanes above, both of which refund. It does NOT hold for a consumer that
    // dedupes silently and answers ACK: there the second debit buys nothing and the ATH is stranded on the
    // recipient's official wallet, credited to no one.
    // MEASURED (tests/vault-ath-integration.test.ts VAULT-ATH-04): a replayed deposit query_id leaves the payer
    // 700 units short, parks them on the official wallet, and the Vault credits 1,000 — because the Vault dedupes
    // on its own ledger and replies ACK instead of refunding. That is a real loss on the VAULT lane, and it is one
    // more reason Vault must actually leave the clean-17 deploy set rather than merely be called cancelled while
    // the scripts still deploy it. Any future consumer of this notification must REFUND a duplicate, not ACK it.
    pending_notifications: map<Int, PendingAthTransferNotification>;
    pending_outgoing_transfers: map<Int, PendingAthOutgoingTransfer>;

    init(balance: Int, owner_address: Address, ath_master_address: Address) {
        self.balance = balance;
        self.owner_address = owner_address;
        self.ath_master_address = ath_master_address;
        self.pending_notifications = emptyMap();
        self.pending_outgoing_transfers = emptyMap();
    }

    fun derive_wallet_address(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun is_basechain_address(owner: Address): Bool {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        return owner_std.workchain == 0;
    }

    fun require_basechain_owner_path(recipient: Address, response_destination: Address) {
        throwUnless(14600, self.is_basechain_address(self.owner_address));
        throwUnless(14601, self.is_basechain_address(recipient));
        throwUnless(14602, self.is_basechain_address(response_destination));
    }

    fun compute_sender_key(query_id: Int, sender_owner: Address): Int {
        return beginCell()
            .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
            .storeUint(query_id, 64)
            .storeAddress(sender_owner)
            .endCell()
            .hash() % ATH_SENDER_KEY_MOD;
    }

    fun compute_pending_notification_key(query_id: Int, sender_key: Int): Int {
        return sender_key;
    }

    fun compute_pending_outgoing_key(query_id: Int, recipient_wallet: Address): Int {
        return beginCell()
            .storeUint(ATH_OUTGOING_TRANSFER_ID_DOMAIN, 32)
            .storeUint(query_id, 64)
            .storeAddress(recipient_wallet)
            .endCell()
            .hash();
    }

    fun compute_notify_refund_query_id(query_id: Int, sender_key: Int, refund_wallet: Address): Int {
        return beginCell()
            .storeUint(ATH_NOTIFY_REFUND_QUERY_DOMAIN, 32)
            .storeUint(query_id, 64)
            .storeUint(sender_key, 160)
            .storeAddress(refund_wallet)
            .endCell()
            .hash() % ATH_QUERY_ID_MOD;
    }

    fun notify_transfer_value(notify_value: Int): Int {
        return notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
    }

    fun registry_notify_transfer_value(notify_value: Int): Int {
        return notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT + ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE;
    }

    fun store_pending_outgoing(query_id: Int, amount: Int, recipient_wallet: Address, response_destination: Address) {
        let pending_key: Int = self.compute_pending_outgoing_key(query_id, recipient_wallet);
        throwUnless(14230, !self.pending_outgoing_transfers.exists(pending_key));
        self.pending_outgoing_transfers.set(pending_key, PendingAthOutgoingTransfer {
            recipient_wallet: recipient_wallet,
            response_destination: response_destination,
            amount: amount,
            created_at: now()
        });
    }

    fun restore_bounced_outgoing(query_id: Int, amount: Int) {
        throwUnless(14220, amount > 0);
        let pending_key: Int = self.compute_pending_outgoing_key(query_id, sender());
        let pendingOpt: PendingAthOutgoingTransfer? = self.pending_outgoing_transfers.get(pending_key);
        throwUnless(14221, pendingOpt != null);
        let pending: PendingAthOutgoingTransfer = pendingOpt!!;
        throwUnless(14222, pending.amount == amount);
        throwUnless(14223, sender() == pending.recipient_wallet);
        self.pending_outgoing_transfers.del(pending_key);
        self.balance += amount;

        if (pending.response_destination != myAddress()) {
            message(MessageParameters {
                to: pending.response_destination,
                value: 0,
                mode: SendRemainingValue,
                bounce: true,
                body: ATHTransferFailed {
                    query_id: query_id,
                    amount: amount
                }.toCell()
            });
        }
    }

    fun send_source_wallet_ack(query_id: Int, amount: Int, source_wallet: Address) {
        message(MessageParameters {
            to: source_wallet,
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: query_id,
                amount: amount
            }.toCell()
        });
    }

    fun refund_owner_excess(destination: Address, amount: Int) {
        if (amount < ATH_OWNER_EXCESS_REFUND_MIN_VALUE) {
            return;
        }

        message(MessageParameters {
            to: destination,
            value: amount,
            bounce: false,
            mode: SendDefaultMode,
            body: null
        });
    }

    // [W1-004 — KNOWN, ACCEPTED 2026-07-24. DO NOT "fix" this refund in isolation without re-reading the analysis.]
    // This clawback refunds the payer with SendRemainingValue (below), i.e. with whatever value came back on the
    // notification bounce. A MALICIOUS notify recipient can BURN compute gas in its owner-contract before throwing, so
    // the bounce returns with less; the refund then arrives below the payer's 14212 floor, bounces, and the recipient's
    // ordinary outgoing-bounce handler RE-CREDITS it — the recipient keeps the ATH, the payer gets nothing. Measured in
    // tests/ath-notify-theft-w1004.test.ts (theft at >= ~2000 burn iterations). Raising the notify floor cannot close
    // it: the attacker simply burns more.
    //
    // WHY IT IS ACCEPTED rather than fixed: it is NOT a privilege escalation. Gate 14300 means only the PAYER's own key
    // can initiate a WithNotify, and 14302 forces notify_destination == recipient, so the theft requires the victim to
    // SIGN sending their OWN ATH to the attacker's wallet — which a plain ATHTransferRequest to the same attacker would
    // lose identically. The attack gives the attacker nothing beyond a normal transfer, and cannot touch anyone who is
    // not already sending ATH to them. A malicious/forked client that could trigger this could equally trigger a plain
    // transfer, so the real boundary is client-distribution integrity, not this receiver. The only genuine delta is a
    // victim who trusts a malicious recipient with a REFUNDABLE transfer — narrow, and the same recipient could rob them
    // otherwise. A correct fix is an escrow redesign (credit only on the owner's accept), disproportionate to a latent,
    // no-privilege-gain issue on the immutable core token wallet. [Owner decision: accept + document.]
    //
    // [WAVE 8, 2026-07-29 — a SECOND way into the same accepted family, recorded so it is not rediscovered as new.]
    // A THROW inside this function consumes the caller's only trigger when the caller is a bounce handler: a bounced
    // message does not bounce twice, so the transaction reverts, pending_notifications survives, and the one chance
    // to settle it is gone. Three gates here can throw on that path — 14335 (the bounce came back too thin), 14331
    // (the owner spent the credited balance first) and, inside store_pending_outgoing, 14230 on a key collision.
    // The collision is the sharpest: for the REGISTRY lanes refund_query_id is set to the PAYER'S query_id below,
    // and pending_notifications is deleted BEFORE store_pending_outgoing runs, so a payer may immediately re-use the
    // same query_id and make the next refund collide. The stranded entry is then erased by PruneStaleNotification
    // WITHOUT a refund once the TTL passes. Not fixed here for the same reason as the paragraph above: every honest
    // repair is the escrow redesign the owner declined, and echoing the payer's query_id is a protocol requirement
    // of the registry lane, not an accident. What IS fixed is the owner-initiated path's funding floor (14347),
    // which is the only half of this that could strike an honest, non-malicious refund.
    fun refund_pending_notification(query_id: Int, sender_key: Int, amount: Int) {
        throwUnless(14330, amount > 0);
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14332, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14335, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + pending.response_ack_value);
        throwUnless(14331, self.balance >= amount);
        throwUnless(14333, pending.amount == amount);
        throwUnless(14334, self.compute_sender_key(query_id, pending.sender_owner) == sender_key);

        self.balance -= amount;
        self.pending_notifications.del(pending_key);

        let refund_wallet: Address = self.derive_wallet_address(pending.sender_owner);
        let refund_init: StateInit = initOf ATHWallet(0, pending.sender_owner, self.ath_master_address);
        let refund_query_id: Int = self.compute_notify_refund_query_id(query_id, sender_key, refund_wallet);
        let refund_response_destination: Address = pending.sender_owner;
        let outgoing_failure_destination: Address = pending.sender_owner;

        if (pending.response_ack_value == ATH_REGISTRY_RESPONSE_ACK_VALUE) {
            refund_query_id = query_id;
            refund_response_destination = pending.response_destination;
            outgoing_failure_destination = myAddress();
        } else {
            message(MessageParameters {
                to: pending.response_destination,
                value: pending.response_ack_value,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: ATHTransferFailed {
                    query_id: query_id,
                    amount: amount
                }.toCell()
            });
        }

        self.store_pending_outgoing(refund_query_id, amount, refund_wallet, outgoing_failure_destination);

        send(SendParameters {
            to: refund_wallet,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            code: refund_init.code,
            data: refund_init.data,
            body: ATHInternalTransfer {
                query_id: refund_query_id,
                amount: amount,
                sender_owner: self.owner_address,
                response_destination: refund_response_destination
            }.toCell()
        });
    }

    fun refund_bounced_notification(query_id: Int, sender_key: Int) {
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14337, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14338, self.compute_sender_key(query_id, pending.sender_owner) == sender_key);
        self.refund_pending_notification(query_id, sender_key, pending.amount);
    }

    receive(msg: ATHBurn) {
        throwUnless(14000, sender() == self.owner_address);
        throwUnless(14001, msg.amount > 0);
        throwUnless(14002, self.balance >= msg.amount);
        throwUnless(14005, msg.response_destination == self.owner_address);
        let required_value: Int = ATH_BURN_NOTIFICATION_EXEC_RESERVE + ATH_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14006, context().value >= required_value);
        let downstream_value: Int = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE;

        self.balance -= msg.amount;

        message(MessageParameters {
            to: self.ath_master_address,
            value: downstream_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHBurnNotification {
                query_id: msg.query_id,
                amount: msg.amount,
                owner_address: self.owner_address,
                response_destination: msg.response_destination
            }.toCell()
        });
    }

    bounced(msg: bounced<ATHBurnNotification>) {
        throwUnless(14003, sender() == self.ath_master_address);
        throwUnless(14004, msg.amount > 0);
        self.balance += msg.amount;

        message(MessageParameters {
            to: self.owner_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHBurnFailed {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: ATHGenesisSupplyCredit) {
        throwUnless(14400, sender() == self.ath_master_address);
        throwUnless(14401, msg.amount > 0);
        throwUnless(14402, self.balance == 0);
        throwUnless(14403, context().value >= ATH_GENESIS_SUPPLY_EXEC_RESERVE + ATH_GENESIS_SUPPLY_ACK_VALUE);

        self.balance += msg.amount;

        message(MessageParameters {
            to: msg.response_destination,
            value: ATH_GENESIS_SUPPLY_ACK_VALUE,
            mode: SendDefaultMode,
            bounce: false,
            body: ATHGenesisSupplyAck {
                query_id: msg.query_id,
                amount: msg.amount,
                owner_address: self.owner_address
            }.toCell()
        });
    }

    receive(msg: ATHTransferRequest) {
        throwUnless(14200, sender() == self.owner_address);
        throwUnless(14201, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14202, msg.amount > 0);
        throwUnless(14203, self.balance >= msg.amount);
        // [CORRECTED 2026-08-01] Built from what the ARRIVAL actually needs, not from a second hand-written list of
        // terms. The old sum was EXEC + ACK + ENDOWMENT + FWD + OWNER_EXEC and omitted ATH_INTERNAL_TRANSFER_SOURCE_
        // ACK_VALUE, which gate 14212 demands on arrival — measured at 29,000,000 in COST-04. The omission was
        // invisible only because the forward allowance was fat enough to cover it, so shrinking that allowance
        // without this line would have broken the lane exactly the way the 60,000,000 refund floor once did.
        let required_value: Int = ATH_OWNER_REQUEST_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ARRIVAL_MIN
            + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE;
        throwUnless(14204, context().value >= required_value);
        let downstream_value: Int = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE;

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendDefaultMode,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransfer {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination
            }.toCell()
        });
    }

    receive(msg: ATHTransferRequestWithNotify) {
        throwUnless(14300, sender() == self.owner_address);
        throwUnless(14301, msg.response_destination == self.owner_address);
        throwUnless(14302, msg.notify_destination == msg.recipient);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14303, msg.amount > 0);
        throwUnless(14304, msg.notify_value > 0);
        throwUnless(14305, self.balance >= msg.amount);
        throwUnless(14306, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14307, context().value >= required_value);

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransferWithNotify {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_destination: msg.notify_destination,
                notify_value: msg.notify_value
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: ATHTransferRequestRegistryMintUsername) {
        throwUnless(14550, sender() == self.owner_address);
        throwUnless(14551, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14552, self.is_basechain_address(msg.owner_wallet));
        throwUnless(14553, msg.amount > 0);
        throwUnless(14554, msg.notify_value > 0);
        throwUnless(14555, self.balance >= msg.amount);
        throwUnless(14556, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.registry_notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14557, context().value >= required_value);

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransferRegistryMintUsername {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_value: msg.notify_value,
                owner_wallet: msg.owner_wallet,
                username_len: msg.username_len,
                username: msg.username
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: ATHTransferRequestRegistryProfileAvatar) {
        throwUnless(14650, sender() == self.owner_address);
        throwUnless(14651, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14652, self.is_basechain_address(msg.owner_wallet));
        throwUnless(14653, msg.amount > 0);
        throwUnless(14654, msg.notify_value > 0);
        throwUnless(14655, self.balance >= msg.amount);
        throwUnless(14656, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.registry_notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14657, context().value >= required_value);

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransferRegistryProfileAvatar {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_value: msg.notify_value,
                owner_wallet: msg.owner_wallet,
                avatar_hash: msg.avatar_hash,
                avatar_entry_id: msg.avatar_entry_id,
                avatar_stream_id: msg.avatar_stream_id,
                avatar_part_count: msg.avatar_part_count,
                media_format: msg.media_format
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: JettonTransfer) {
        throwUnless(14700, sender() == self.owner_address);
        self.require_basechain_owner_path(msg.destination, msg.response_destination);
        throwUnless(14701, msg.amount > 0);
        throwUnless(14702, self.balance >= msg.amount);
        // [CHANGED 2026-08-01] This used to demand `forward == 0 || forward >= ATH_TRANSFER_NOTIFY_MIN_VALUE`, i.e.
        // it REFUSED every forward amount between 1 and 45,000,000. That range is exactly how a wallet attaches a
        // comment to a jetton transfer — a tiny forward so the recipient emits the notification carrying the text —
        // so ATH could not be sent with a message at all.
        //
        // The 45,000,000 floor was measured, but for a different lane: it is what lets a REFUSED registry purchase
        // refund itself past the payer's gate 14212. That machinery lives on the custom notify lanes, which keep the
        // floor in their own gates (14306 and siblings). The standard lane is fire-and-forget with no escrow, so it
        // never needed it. What actually has to hold here is that the recipient can afford to emit the
        // notification, and required_value below demands exactly that via ATH_TRANSFER_NOTIFY_EXEC_RESERVE.
        //
        // The gate number is KEPT, not deleted, and now asserts something still true: a caller cannot forward more
        // than it attached. Retiring a number outright is how a gate quietly stops existing.
        throwUnless(14703, msg.forward_ton_amount < context().value);
        // [CORRECTED 2026-08-01] Two defects in one line, both measured.
        //
        // ATH_TRANSFER_NOTIFY_EXEC_RESERVE was charged UNCONDITIONALLY, including when forward_ton_amount is 0 and no
        // notification is ever emitted. The receiving side already knew better: its own gate on that branch, 14717,
        // does not ask for it. The sender was billed 7,000,000 for work that does not happen — and that alone is
        // most of the gap between this floor and what an ordinary wallet attaches.
        //
        // The floor is now composed from what the arrival really demands, measured by bisection in COST-02:
        //     no notification   26,000,000 = EXEC + SOURCE_ACK + ENDOWMENT          (gate 14717)
        //     notification F    F + 31,000,000 = F + SOURCE_ACK + NOTIFY_EXEC + ENDOWMENT (gate 14714)
        let arrival_min: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
        if (msg.forward_ton_amount > 0) {
            // The recipient's 14714 also charges the fee of forwarding the notification, which scales with the
            // payload. Estimated here from the fee of the owner's own message, which carries the same payload — the
            // sender must fund the notification it asked for, or the transfer bounces at the far end.
            arrival_min = msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
                + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
                + context().readForwardFee();
        }
        let required_value: Int = ATH_OWNER_REQUEST_EXEC_RESERVE + arrival_min
            + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE;
        throwUnless(14704, context().value >= required_value);
        let downstream_value: Int = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE;

        let recipient_wallet: Address = self.derive_wallet_address(msg.destination);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.destination, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendDefaultMode,
            code: recipient_init.code,
            data: recipient_init.data,
            body: JettonInternalTransfer {
                query_id: msg.query_id,
                amount: msg.amount,
                from: self.owner_address,
                response_address: msg.response_destination,
                forward_ton_amount: msg.forward_ton_amount,
                forward_payload: msg.forward_payload
            }.toCell()
        });
    }

    receive(msg: ATHInternalTransfer) {
        throwUnless(14210, msg.amount > 0);
        throwUnless(14211, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14212, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);

        self.balance += msg.amount;

        message(MessageParameters {
            to: msg.response_destination,
            value: ATH_INTERNAL_TRANSFER_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        // [ADDED 2026-08-01] RETURN THE CHANGE HERE TOO. The standard lane below was taught to hand back what it
        // does not need; this one was left burying it, and this is the lane every protocol PAYOUT uses — vesting
        // claims, MarketStabilitySeller sales, airdrop deliveries, both registries. Each of those callers funds the
        // leg from a hand-set constant well above the gate (58,000,000 from vesting and MSS, 48,000,000 from the
        // registries, against a requirement of 39,000,000), so the surplus was landing on the recipient's wallet
        // and staying there — an ATHWallet has no path that pays TON to its owner. It is the same money the airdrop
        // already accounts for as irrecoverable per delivery.
        //
        // Subtracted with ATH_INTERNAL_TRANSFER_ARRIVAL_MIN, which IS gate 14212 above, so the wallet can never
        // give away what it was required to keep. No payload travels on this lane and both acks are fixed size, so
        // unlike the standard lane there is no payload-proportional fee to reserve.
        let excess: Int = context().value - ATH_INTERNAL_TRANSFER_ARRIVAL_MIN;
        if (excess >= JETTON_EXCESSES_VALUE) {
            message(MessageParameters {
                to: msg.response_destination,
                value: excess,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: ATHTransferExcess { query_id: msg.query_id }.toCell()
            });
        }
    }

    receive(msg: JettonInternalTransfer) {
        throwUnless(14710, msg.amount > 0);
        throwUnless(14711, sender() == self.derive_wallet_address(msg.from));
        throwUnless(14712, self.is_basechain_address(msg.from));

        if (msg.forward_ton_amount > 0) {
            // [CHANGED 2026-08-01] The twin of 14703 on the receiving side: it demanded forward >= 45,000,000 and so
            // refused the small forward a wallet uses to attach a comment. The floor belongs to the custom notify
            // lanes, which enforce it themselves; what has to hold HERE is that this wallet can afford to emit the
            // notification, and 14714 below demands exactly that. Number kept, condition made true rather than
            // arbitrary — a gate that stops existing is worse than a gate that checks less.
            throwUnless(14713, msg.forward_ton_amount < context().value);
            // clean-12 Lane A (standard TEP-74): fire-and-forget standard JettonTransferNotification, NO custom
            // escrow/tombstone. Replay-safety now lives in each consumer's OWN idempotency map (Vault
            // processed_ath_deposits, BuybackBurn phase+query_id, MSS supply-cap). The forward_payload passes
            // through VERBATIM (Slice as remaining) so DEX routers' swap/LP ops inside it are bit-preserved.
            // Guard = forwarded notify value + the source-ack (still sent below) + exec reserve.
            // [FIX 2026-07-29, wave-8 LOW] ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT was MISSING here, and it is the
            // only thing that funds the rent of a wallet this very message may DEPLOY. Both sibling gates demand
            // it — 14717 on the forward==0 branch and 14212 on the custom lane — so this branch was the odd one
            // out. It mattered because the sender's ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE is a fixed 21,000,000
            // while the forward_payload passes through VERBATIM and is charged by the bit: a large enough payload
            // eats the allowance, less arrives than the sender was charged for, and this gate waved it through —
            // deploying a fresh wallet on an immutable contract with well under half its intended endowment.
            // Adding the term makes that case BOUNCE instead, which is recoverable; an under-funded wallet is not.
            // The honest path is untouched — see ATH-ENDOW-14714 for the margin, measured rather than assumed.
            // [ADDED 2026-08-01] + the fee this wallet is about to pay to FORWARD the notification.
            //
            // The notification goes out with SendPayFwdFeesSeparately, so its forward fee comes out of THIS wallet's
            // balance — and it scales with forward_payload, which passes through verbatim. Until the 45,000,000
            // floor was lifted from 14713 the case could not be reached; with a one-nanoton forward it can, and it
            // was MEASURED to eat the endowment: at 100 payload cells the wallet finished on 18,390,462 against an
            // endowment of 20,000,000. A fixed allowance cannot cover it — a message holds ~500 cells, i.e. ~24M of
            // fee, and reserving that would push the comment floor above what a wallet attaches.
            //
            // context().readForwardFee() is the fee of the message that just arrived, which carries the SAME payload
            // and a heavier header. Measured ratio of outgoing notification fee to incoming fee: 0.02 at an empty
            // payload rising asymptotically to ~0.66 at 100 cells — always below 1, so this is an upper bound that
            // costs the sender only what the payload actually costs. Same primitive, same shape as the allowance in
            // UsernameNFTItem. Over the bound the transfer is REFUSED here and bounces, which is recoverable; an
            // under-funded wallet is not.
            throwUnless(14714, context().value >= msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT + context().readForwardFee());

            self.balance += msg.amount;
            message(MessageParameters {
                to: self.owner_address,
                value: msg.forward_ton_amount,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: JettonTransferNotification {
                    query_id: msg.query_id,
                    amount: msg.amount,
                    sender: msg.from,
                    forward_payload: msg.forward_payload
                }.toCell()
            });
        } else {
            throwUnless(14717, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
            self.balance += msg.amount;
        }

        self.send_source_wallet_ack(msg.query_id, msg.amount, sender());

        // [CHANGED 2026-08-01] RETURN THE CHANGE, NOT A TOKEN GESTURE.
        //
        // This used to send a fixed JETTON_EXCESSES_VALUE of 1,000,000 and keep the rest. MEASURED before the fix:
        // three consecutive transfers left 44,047,996 / 88,099,059 / 132,150,122 on the recipient's wallet — about
        // 44,000,000 per transfer, forever. "Forever" is literal: every entry point of this contract was enumerated
        // and NONE pays TON back to the wallet's owner, so the sender's change was not delayed, it was buried. Of
        // the 55,425,870 an owner spent per transfer, roughly 6,800,000 was fee and the rest was immobilised.
        //
        // What must stay behind is the storage endowment — the rent float this wallet may have just been deployed
        // with. Everything above that is the sender's, and goes home. The subtraction is the SAME expression the
        // branch gates assert above, so the wallet can never promise away money it was required to keep.
        let consumed: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
        if (msg.forward_ton_amount > 0) {
            // The same forward-fee term gate 14714 demands above: it was spent forwarding the notification, so it
            // must NOT be handed back as change or the endowment leaves with it.
            consumed = msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
                + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
                + context().readForwardFee();
        }
        let excess: Int = context().value - consumed;
        if (excess >= JETTON_EXCESSES_VALUE) {
            message(MessageParameters {
                to: msg.response_address,
                value: excess,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: JettonExcesses {
                    query_id: msg.query_id
                }.toCell()
            });
        }
    }

    receive(msg: ATHInternalTransferWithNotify) {
        throwUnless(14310, msg.amount > 0);
        throwUnless(14311, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14312, msg.notify_destination == self.owner_address);
        throwUnless(14313, msg.notify_value > 0);
        throwUnless(14314, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        // [14315 IS THE BALANCE GUARD, AND IT STAYS.] It blocks a duplicate while the first is still in flight —
        // the only reachable double-processing window. The permanent tombstone that used to sit beside it (14317)
        // was DELETED 2026-07-19; see the state declaration for why it never protected the balance.
        throwUnless(14315, !self.pending_notifications.exists(pending_key));
        throwUnless(14316, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            response_destination: msg.response_destination,
            response_ack_value: ATH_TRANSFER_NOTIFY_ACK_VALUE,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: msg.notify_destination,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotification {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                sender_wallet: msg.sender_owner
            }.toCell()
        });

        message(MessageParameters {
            to: msg.response_destination,
            value: ATH_TRANSFER_NOTIFY_ACK_VALUE,
            mode: SendDefaultMode,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: ATHInternalTransferRegistryMintUsername) {
        throwUnless(14560, msg.amount > 0);
        throwUnless(14561, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14562, msg.notify_value > 0);
        throwUnless(14563, context().value >= msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        throwUnless(14564, self.is_basechain_address(msg.owner_wallet));
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        // 14565 is this lane's in-flight guard (see 14315). Its permanent-tombstone twin (14567) was deleted
        // 2026-07-19; the username lane's replay guard is UsernameRegistry's own name_hash check (19172/19173),
        // which is strictly stronger because it keys on WHAT was bought rather than on a message id.
        throwUnless(14565, !self.pending_notifications.exists(pending_key));
        throwUnless(14566, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            response_destination: msg.response_destination,
            response_ack_value: ATH_REGISTRY_RESPONSE_ACK_VALUE,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotificationRegistryMintUsername {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                payer_wallet: msg.sender_owner,
                owner_wallet: msg.owner_wallet,
                username_len: msg.username_len,
                // Wrap the inbound remaining-slice name into its own ref cell (see the message decl for why).
                username: beginCell().storeSlice(msg.username).endCell()
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: ATHInternalTransferRegistryProfileAvatar) {
        throwUnless(14660, msg.amount > 0);
        throwUnless(14661, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14662, msg.notify_value > 0);
        throwUnless(14663, context().value >= msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        throwUnless(14664, self.is_basechain_address(msg.owner_wallet));
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        // 14665 is this lane's in-flight guard (see 14315). Its permanent-tombstone twin (14667) was deleted
        // 2026-07-19. NOTE: unlike the username lane, ProfileRegistry carries NO replay guard of its own, so the
        // avatar lane's protection now rests entirely on the pointer gate added there in the same change.
        throwUnless(14665, !self.pending_notifications.exists(pending_key));
        throwUnless(14666, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            response_destination: msg.response_destination,
            response_ack_value: ATH_REGISTRY_RESPONSE_ACK_VALUE,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotificationRegistryProfileAvatar {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                payer_wallet: msg.sender_owner,
                owner_wallet: msg.owner_wallet,
                avatar_hash: msg.avatar_hash,
                avatar_entry_id: msg.avatar_entry_id,
                avatar_stream_id: msg.avatar_stream_id,
                avatar_part_count: msg.avatar_part_count,
                media_format: msg.media_format
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: ATHTransferAck) {
        throwUnless(14240, msg.amount > 0);
        let pending_key: Int = self.compute_pending_outgoing_key(msg.query_id, sender());
        let pendingOpt: PendingAthOutgoingTransfer? = self.pending_outgoing_transfers.get(pending_key);
        throwUnless(14241, pendingOpt != null);
        let pending: PendingAthOutgoingTransfer = pendingOpt!!;
        throwUnless(14242, pending.amount == msg.amount);
        throwUnless(14243, sender() == pending.recipient_wallet);
        self.pending_outgoing_transfers.del(pending_key);
    }

    receive(msg: ATHRecoverStuckOutgoing) {
        throwUnless(14250, context().value >= ATH_OUTGOING_STUCK_RECOVERY_MIN_VALUE);
        let pending_key: Int = self.compute_pending_outgoing_key(msg.query_id, msg.recipient_wallet);
        let pendingOpt: PendingAthOutgoingTransfer? = self.pending_outgoing_transfers.get(pending_key);
        // No entry means the transfer already terminated. There is nothing stuck and nothing to give back; unwinding
        // anyway is exactly the double-spend this receiver exists to avoid.
        throwUnless(14251, pendingOpt != null);
        let pending: PendingAthOutgoingTransfer = pendingOpt!!;
        throwUnless(14252, now() > pending.created_at + ATH_OUTGOING_STUCK_RECOVERY_GRACE_SECONDS);

        self.pending_outgoing_transfers.del(pending_key);
        self.balance += pending.amount;

        if (pending.response_destination != myAddress()) {
            message(MessageParameters {
                to: pending.response_destination,
                value: 0,
                mode: SendRemainingValue,
                // Bounceable on purpose, matching restore_bounced_outgoing: a counterparty that refuses this returns
                // the value rather than swallowing it. This wallet's own state is already correct either way.
                bounce: true,
                body: ATHTransferFailed {
                    query_id: msg.query_id,
                    amount: pending.amount
                }.toCell()
            });
        }
    }

    receive(msg: AthTransferNotificationAck) {
        throwUnless(14340, sender() == self.owner_address);
        throwUnless(14341, msg.amount > 0);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        if (pendingOpt == null) {
            // A LATE OR DUPLICATE ACK IS A TOLERATED NO-OP, and that property is load-bearing: the owner is a
            // registry, and a registry that acks twice (or acks after a prune) must not have its message bounce.
            // This branch used to prove the ack matched a TOMBSTONE (14342/14345). With the tombstone gone there is
            // nothing left to prove and nothing to do — this handler moves NO money, it only clears the pending
            // entry and forwards a response ack, and with no pending there is neither. Returning quietly is the
            // whole correct behaviour. Note 14340 above already restricts this receiver to the owner, so a stranger
            // cannot reach it at all.
            return;
        }
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14343, pending.amount == msg.amount);
        throwUnless(14344, self.compute_sender_key(msg.query_id, pending.sender_owner) == msg.sender_key);
        self.pending_notifications.del(pending_key);

        message(MessageParameters {
            to: pending.response_destination,
            value: pending.response_ack_value,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: AthTransferNotificationRefund) {
        throwUnless(14346, sender() == self.owner_address);
        // See ATH_NOTIFY_REFUND_OWNER_MIN_VALUE. Fail CLOSED here, before refund_pending_notification deletes the
        // escrow record: an owner who underfunds this gets a bounce and keeps the claim, instead of erasing the
        // payer's only claim on a refund that could never have been delivered.
        throwUnless(14347, context().value >= ATH_NOTIFY_REFUND_OWNER_MIN_VALUE);
        self.refund_pending_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    receive(msg: PruneStaleNotification) {
        throwUnless(14349, context().value >= ATH_PRUNE_NOTIFICATION_EXEC_RESERVE);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14350, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14351, self.compute_sender_key(msg.query_id, pending.sender_owner) == msg.sender_key);
        // The registry lanes get a LONGER age requirement, not an exemption. 14353 used to sit here and refuse them
        // outright — see ATH_REGISTRY_PENDING_TTL for why that had to go and what the week is protecting.
        let ttl: Int = pending.response_ack_value == ATH_REGISTRY_RESPONSE_ACK_VALUE
            ? ATH_REGISTRY_PENDING_TTL
            : ATH_PENDING_NOTIFICATION_TTL;
        throwUnless(14352, now() >= pending.created_at + ttl);
        // Pruning now genuinely FREES the entry. It used to convert pending into a permanent tombstone, so the
        // "prune" only moved the cost from one map to another that could never be reclaimed — the stale entry was
        // cleared and the account grew anyway. With the tombstone gone this is a real reclaim.
        self.pending_notifications.del(pending_key);
    }

    bounced(msg: bounced<ATHInternalTransfer>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferWithNotify>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferRegistryMintUsername>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferRegistryProfileAvatar>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<JettonInternalTransfer>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<AthTransferNotification>) {
        throwUnless(14336, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key);
    }

    bounced(msg: bounced<AthTransferNotificationRegistryMintUsername>) {
        throwUnless(14570, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key);
    }

    bounced(msg: bounced<AthTransferNotificationRegistryProfileAvatar>) {
        throwUnless(14670, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key);
    }

    get fun get_wallet_data(): ATHWalletDataView {
        return ATHWalletDataView {
            balance: self.balance,
            owner_address: self.owner_address,
            ath_master_address: self.ath_master_address,
            jetton_wallet_code: (initOf ATHWallet(0, self.owner_address, self.ath_master_address)).code
        };
    }

    get fun get_pending_notification(query_id: Int, sender_key: Int): PendingAthTransferNotificationView {
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        if (pendingOpt == null) {
            return PendingAthTransferNotificationView {
                exists: false,
                sender_owner: self.owner_address,
                response_destination: self.owner_address,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingAthTransferNotification = pendingOpt!!;
        return PendingAthTransferNotificationView {
            exists: true,
            sender_owner: pending.sender_owner,
            response_destination: pending.response_destination,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }

    receive(msg: ATHWalletTopUpStorageReserve) {
        // F11/#2: accept TON for storage reserve ONLY (no balance credit, no auth, no state change). Lets the
        // monotonic processed_notifications replay-tombstone on the ECOSYSTEM wallets (Vault / treasury /
        // UsernameRegistry / ProfileRegistry official ATH wallets, which write it) be externally funded, so a
        // config-18 storage-price rise over the 100yr horizon cannot bleed them below the rent floor with no way to
        // replenish. Standard user-to-user wallets never write that map, so their custody is unaffected either way.
        // Mirrors the no-authority top-up already on CapsuleHub / ATHVesting / BuybackBurn / MarketStabilitySeller.
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(13000);
    }
}
