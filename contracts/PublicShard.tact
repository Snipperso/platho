// PublicShard — clean-17 PUBLIC lane: posts, comments, channel announcements (the directory), and avatar image
// bytes. It replaces the public/recovery machinery of the retired monolith CapsuleHub, whose own comment
// (CapsuleHub.tact:98-100) said it "honestly supports ~4300 live entries… Reaching them is the signal to shard,
// not to raise them." This is that shard.
//
// ONE CONTRACT, FOUR SELF-VERIFYING DOMAINS. The address commits to two things: WHICH partition, and — folded
// into epoch_tag — WHICH KIND and WHICH ERA. Putting the kind in the ADDRESS rather than in state keeps the
// retire gate and the era length pure arithmetic on the address, the property RecordShard.tact:330-335 relies on.
//
//   epoch_tag = (kind << 32) | era_index
//   kind 0 CHANNEL  partition_key = H(PS_CHANNEL_DOMAIN ‖ senderHash ‖ shard_seq)   era 30 d
//   kind 1 THREAD   partition_key = H(PS_THREAD_DOMAIN  ‖ post_uid   ‖ shard_seq)   era 30 d
//   kind 2 BEACON   partition_key = H(PS_BEACON_DOMAIN  ‖ bucket)                   era 1 y   (the directory)
//   kind 3 AVATAR   partition_key = H(PS_AVATAR_DOMAIN  ‖ senderHash)               era 1 y
//
// THE PREIMAGE GATE IS THE WHOLE AUTHORIZATION, AND IT NEEDS NO STORED AUTHORITY. The publish message names the
// preimage; the contract recomputes the hash and compares it to its OWN partition_key. A liar lands on a
// DIFFERENT address, so the check is self-verifying:
//   * CHANNEL and AVATAR fold sender() — ONLY the owner wallet can match, so there is no signature and no ed25519
//     at all (cheaper than RecordShard, which must checkSignature because a CONV bucket has to be unlinkable to a
//     wallet — a PUBLIC post is public by definition and already exposes its `src`).
//   * THREAD folds post_uid = H(PS_POST_UID_DOMAIN ‖ channel_pk ‖ epoch_tag ‖ entry_id) — anyone who can SEE a
//     post derives it and may comment. Exactly the intended openness.
//   * BEACON folds only a bucket index — open to all, like IntroShard.
//
// A CHANNEL IS A WALLET, NOT A KEYPAIR. This is the deliberate break from CapsuleHub.tact:811
// (channel_id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pubkey)). That keypair existed only because publishing was
// relayed and permissionless (PublishAnonBatch); clean-17 is direct-pay, so the wallet IS present and IS the
// authority. It also makes channel -> KeyShard(owner_wallet, profile_registry) -> paid avatar pointer a pure
// local derivation, which the old one-way channel_id made impossible.
//
// THE BEACON REPLACES THE GLOBAL PROFILE CHAIN. CapsuleHub kept public_profile_head / public_profile_index /
// profile_prev_link (CapsuleHub.tact:429-432, :626-631) — a single global newest-first chain a client walked for
// discovery. A chain lives in ONE account and cannot be sharded. In its place a channel announces itself with a
// beacon entry in a publisher-chosen bucket [0, PUBLIC_BEACON_READ_SPACE); a fresh client sweeps those buckets in
// ONE batched accountStates read (1024 friendly addresses fit one 64 KiB request — measured 2026-07-18) and
// ranks by entry_count, NOT by last_transaction_lt: a bucket touched by a value message with no StateInit runs
// its compute phase skipped and no gate fires, so lt-ranking would let an attacker firehose the top of Discover
// for a forward fee. entry_count moves only on an accepted, paid publish.
// PUBLIC_BEACON_READ_SPACE is a CLIENT constant (web/shard-discovery.mjs), in NO gate here, so it is widen-only
// with no redeploy — the only capacity lever that survives seal.
//
// STATE STAYS THIN, exactly as RecordShard: per entry only (publisher, body_commit, created_at). The capsule
// cells ride in this account's transaction HISTORY and are recovered from there; they are NOT copied into state,
// which is what keeps the ~65536-cell account ceiling irrelevant. body_commit is computed HERE from the cell
// hashes, so a captured body cannot be spliced onto a different commit and publisher/reader cannot disagree.

// [MEASURED 2026-07-24 — the figures below are no longer derivations. They are pinned against the REAL storage
//  phase by tests/public-shard-rent-solvency.test.ts at blockchain.now >= 1_790_000_000 (config-18 is a SCHEDULE:
//  with the sandbox clock at 2023 a cell costs 486975 and the whole table misreads as catastrophically
//  under-funded). That test also deploys the fee sink: a bounceable fee to a NON-existent sink bounces BACK and
//  inflates the shard's retained balance by ~9_647_932, which reports a margin the live lane does not have.]

const PS_SAFE_CAP: Int = 4096;             // entries per shard; refuse in COMPUTE, never code 50 in ACTION

const PS_ERA_SHORT: Int = 2592000;         // 30 days — CHANNEL and THREAD roll monthly
const PS_ERA_LONG: Int = 31536000;         // 1 year  — BEACON and AVATAR

// Retentions are per kind. A post lives a year like a private message [OWNER 2026-07-21]; a beacon and an avatar
// live longer so the directory and the profile picture are not lost between infrequent refreshes.
const PS_RETENTION_POST: Int = 31536000;   // 1 year  (CHANNEL, THREAD)
const PS_RETENTION_BEACON: Int = 31536000; // 1 year
const PS_RETENTION_AVATAR: Int = 94608000; // 3 years (= CapsuleHub's recovery-pool retention)

const PS_KIND_CHANNEL: Int = 0;
const PS_KIND_THREAD: Int = 1;
const PS_KIND_BEACON: Int = 2;
const PS_KIND_AVATAR: Int = 3;

const PS_CHANNEL_DOMAIN: Int = 0x50534348;   // "PSCH"
const PS_THREAD_DOMAIN: Int = 0x50535448;    // "PSTH"
const PS_BEACON_DOMAIN: Int = 0x50534243;    // "PSBC"
const PS_AVATAR_DOMAIN: Int = 0x50534156;    // "PSAV"
const PS_BODY_DOMAIN: Int = 0x50534644;      // "PSFD" — the stored commitment's preimage tag
const PS_POST_UID_DOMAIN: Int = 0x50535544;  // "PSUD" — how a comment thread's key is derived from its post

// Storage endowments. Lifetime = (era+2)*eraSeconds + retention, and the shard can be created as early as
// (era-1)*eraSeconds (the freshness gate admits era-1), so the FUNDING basis is 3*eraSeconds + retention — NOT
// 2*eraSeconds. Using the 2-era figure under-funds every shard by one era of rent, and the failure is regressive
// and silent: sparse shards (small new channels, the ones the directory exists for) starve first while full ones
// look healthy, and re-measuring cell count would never catch it because the error is in the lifetime multiplier.
// [MEASURED 2026-07-24 — the per-entry figures below are CONFIRMED solvent: measured marginal per-entry rent is
//  242_941 / 779_546 / 1_169_319, so these constants deliver 2.05x each, comfortably over the 1.5x rule. Only the
//  BASE endowments were short; see the block below.]
//   CHANNEL/THREAD  4 x 64962 x (3*2592000+31536000)/31536000 x 1.5 =  485_900 ->   500_000
//   BEACON          4 x 64962 x (4*31536000)/31536000          x 1.5 = 1_559_088 -> 1_600_000
//   AVATAR          4 x 64962 x (3*31536000+94608000)/31536000  x 1.5 = 2_338_632 -> 2_400_000
const PS_ENTRY_ENDOWMENT_POST: Int = 500000;
const PS_ENTRY_ENDOWMENT_BEACON: Int = 1600000;
const PS_ENTRY_ENDOWMENT_AVATAR: Int = 2400000;

// The shard's own code+data rent over its life plus the one retire call, independent of entry count.
//
// [RAISED 2026-07-24 — WAS 3_500_000 / 7_000_000 / 11_000_000, WHICH WAS INSOLVENT AT TODAY'S RATE.]
// The old figures borrowed RecordShard's flat ~960_339, but THIS contract's code is far larger, and the base
// endowment is what carries the CODE rent. Measured against the real storage phase
// (tests/public-shard-rent-solvency.test.ts, clock 1_790_000_000, rate 64962, fee sink deployed so the fee really
// leaves) a 1-entry shard cost MORE than it kept:
//     AVATAR  kept 13_400_000 vs 15_201_146 rent over 6.00y  = 0.88x  -> froze BEFORE its 3-year retention
//     BEACON  kept  8_600_000 vs 10_134_097 rent over 4.00y  = 0.85x  -> same
//     CHANNEL kept  4_000_000 vs  3_158_229 rent over 1.25y  = 1.27x  -> solvent but under the 1.5x rule
// Decomposed by measuring 1-entry vs 11-entry shards (PS-CAL), the rent splits as:
//     CHANNEL/THREAD  base 2_915_288  per-entry   242_941   -> base >= 4_372_933
//     BEACON          base 9_354_551  per-entry   779_546   -> base >= 14_031_827
//     AVATAR          base 14_031_827 per-entry 1_169_319   -> base >= 21_047_741
// The ENTRY endowments already clear 1.5x (2.05x each) and are unchanged; only the BASE was short.
const PS_BASE_ENDOWMENT_POST: Int = 4500000;      // 1.54x measured base rent
const PS_BASE_ENDOWMENT_BEACON: Int = 14500000;   // 1.55x
const PS_BASE_ENDOWMENT_AVATAR: Int = 21500000;   // 1.53x

const PS_PUBLISH_GAS: Int = 2500000;       // this receiver's own compute + the change-return; no ed25519 here

// PROTOCOL FEE — 0.01 GRAM per capsule. FROZEN: it is the other half of the airdrop economics (1.5M capsules ->
// 15M ATH paid out -> 15k GRAM collected). It passes THROUGH this shard to FeeAccumulator and mints an airdrop
// credit on the publisher's AirdropTicket. Routing it through here is what makes it MANDATORY — a contract cannot
// see the other messages of a transaction, so a client-sent fee could simply be omitted (RecordShard.tact:88-91).
const PS_PROTOCOL_FEE: Int = 10000000;

// FeeAccumulator's address, baked as a constant exactly as RecordShard/IntroShard bake it. A shard deploys LAZILY
// and UNBOUND, so any post-deploy bind receiver would let a stranger bind their own address and steal every fee.
// GENESIS ORDERING (this constant makes it real): FeeAccumulator code -> its address -> shard constants -> shard
// code -> shard addresses -> BindPublicShardCode. Adding lane 2 to FeeAccumulator CHANGES its code hash and
// therefore this address; PT-04b derives it fresh rather than comparing a literal, so a drift bounces loudly.
const PS_FEE_SINK: Address = address("EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP");
const PS_FEE_SINK_DEPOSIT_RESERVE: Int = 2600000;  // mirror of FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE — drift => bounce
const PS_FEE_SINK_FWD_RESERVE: Int = 200000;       // slack returns to the publisher, so generosity is free
const PS_FEE_TRANSPORT: Int = PS_FEE_SINK_DEPOSIT_RESERVE + PS_FEE_SINK_FWD_RESERVE;

const PS_RETIRE_SLACK: Int = 86400;        // one day past the death instant before a retire is allowed

const PS_UINT32_MAX: Int = 4294967295;

// The capsule a client publishes. header/body ride into this account's transaction history; only the commitment
// is stored. kind + key_arg + shard_seq must reproduce this shard's partition_key or gate 13702 bounces.
message(0x50535031) PublicPublish {   // "PSP1"
    kind: Int as uint8;               // must equal (epoch_tag >> 32)
    key_arg: Int as uint256;          // THREAD: post_uid. BEACON: bucket. CHANNEL/AVATAR: unused (pass 0).
    shard_seq: Int as uint32;         // CHANNEL/THREAD overflow index; 0 for BEACON/AVATAR
    header: Cell;
    body: Cell;
}

// "PSP3" — permissionless one-shot retirement, like RecordShard's. No fields: the only question is whether the
// shard is dead yet, and that is fixed by its address.
message(0x50535033) RetirePublicShard {}

// Mirrored from FeeAccumulator by opcode (Tact compiles one contract per project). The wire layout is IDENTICAL
// to RecordShard's and IntroShard's — the sink authenticates a shard by rebuilding its address from init_arg0 /
// init_arg1 positionally, so naming the fields per lane would bake one lane's shape in. `lane` says which code.
message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}

struct PublicEntry {
    publisher: Address;   // stamped by the VM from sender(), NEVER taken from the body
    body_commit: Int;
    created_at: Int;
}

struct PublicEntryView {
    exists: Bool;
    publisher: Address;
    body_commit: Int;
    created_at: Int;
}

// One getter call returns a whole page of authenticated rows, mirroring IntroShard.get_scan_page — so a feed
// page is ONE runGetMethod per shard, not one per entry. Rows are (body_commit, created_at); the PUBLISHER is
// NOT packed, because it is recovered from the `source` of the /messages entry whose body hashes to body_commit,
// and forging a body to a stored commit is a sha256 preimage. ids are IMPLICIT: row i is entry (from_id + i),
// sound because nothing removes an entry, so [0, entry_count) is contiguous.
const PS_PAIRS_PER_CELL: Int = 3;      // (uint256 commit, uint64 created_at) = 320 bits; 3 x 320 = 960 <= 1023
const PS_PAGE_CAP: Int = 96;           // keep the get-method well under its gas ceiling

struct PublicPage {
    from_id: Int;
    count: Int;
    entry_count: Int;    // the shard's append cursor, so a client knows whether more pages remain
    rows: Cell;          // `count` x (uint256 body_commit, uint64 created_at), 3 per cell, chained by ref
}

struct PublicShardView {
    partition_key: Int;
    epoch_tag: Int;
    kind: Int;
    era_index: Int;
    entry_count: Int;    // entries stored; also the SAFE-CAP counter and the honest Discover ranking key
    safe_cap: Int;
    era_seconds: Int;
    retention: Int;
    min_value: Int;         // what a further publish must bring (clients read this, never a hardcoded mirror)
    deploy_min_value: Int;  // what the FIRST publish must bring — pay this whenever entry_count == 0
    protocol_fee: Int;
    retire_at: Int;         // the exact second this shard becomes retireable; read it, never recompute it
    fee_sink: Address;
}

contract PublicShard {
    // BOTH init parameters are plain Int, i.e. int257 — NOT `as uint256`/`as uint64`. This is load-bearing:
    // Tact serialises init data by the PARAMETER type, and FeeAccumulator.laneShardAddress rebuilds this address
    // with storeInt(arg0, 257).storeInt(arg1, 257) (contracts/FeeAccumulator.tact). Declaring narrower widths
    // here would move every PublicShard address away from what the sink derives, and gate 15055 would refuse
    // every public fee. The state fields below narrow the stored copies; the address layout comes from init.
    partition_key: Int as uint256;
    epoch_tag: Int as uint64;
    entries: map<Int, PublicEntry>;   // entry_id -> (publisher, body_commit, created_at)
    entry_count: Int as uint32;

    init(partition_key: Int, epoch_tag: Int) {
        self.partition_key = partition_key;
        self.epoch_tag = epoch_tag;
        self.entries = emptyMap();
        self.entry_count = 0;
    }

    fun kindOf(): Int { return self.epoch_tag >> 32; }
    fun eraIndex(): Int { return self.epoch_tag & 0xFFFFFFFF; }
    fun eraSeconds(): Int { return self.kindOf() < PS_KIND_BEACON ? PS_ERA_SHORT : PS_ERA_LONG; }
    fun retention(): Int {
        let k: Int = self.kindOf();
        if (k == PS_KIND_AVATAR) { return PS_RETENTION_AVATAR; }
        if (k == PS_KIND_BEACON) { return PS_RETENTION_BEACON; }
        return PS_RETENTION_POST;
    }
    fun entryEndowment(): Int {
        let k: Int = self.kindOf();
        if (k == PS_KIND_AVATAR) { return PS_ENTRY_ENDOWMENT_AVATAR; }
        if (k == PS_KIND_BEACON) { return PS_ENTRY_ENDOWMENT_BEACON; }
        return PS_ENTRY_ENDOWMENT_POST;
    }
    fun baseEndowment(): Int {
        let k: Int = self.kindOf();
        if (k == PS_KIND_AVATAR) { return PS_BASE_ENDOWMENT_AVATAR; }
        if (k == PS_KIND_BEACON) { return PS_BASE_ENDOWMENT_BEACON; }
        return PS_BASE_ENDOWMENT_POST;
    }
    // The steady-state and first-publish minimums. The publisher carries the fee transport, so the fee reaches
    // FeeAccumulator whole (owner's 2026-07-19 decision). Clients read these from get_view, never mirror them.
    fun minValue(): Int { return self.entryEndowment() + PS_PUBLISH_GAS + PS_PROTOCOL_FEE + PS_FEE_TRANSPORT; }
    fun deployMinValue(): Int { return self.minValue() + self.baseEndowment(); }
    fun retireAt(): Int { return (self.eraIndex() + 2) * self.eraSeconds() + self.retention(); }

    // The 256-bit account hash of sender(), the idiom proven in KeyShard.tact:458-460. Basechain only: the 11-bit
    // prefix of an addr_std in workchain 0 is 0b100_00000000 = 1024.
    fun senderHash(): Int {
        let s: Slice = sender().asSlice();
        throwUnless(13707, s.loadUint(11) == 1024);
        return s.loadUint(256);
    }

    // The commitment binding an entry to its capsule cells. Defined HERE so publisher and reader derive it
    // identically and a captured body cannot be spliced onto a different commit (RecordShard.tact:242-252).
    fun bodyCommit(header: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(PS_BODY_DOMAIN, 32)
            .storeUint(header.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    // Recompute the partition_key this sender+message CLAIMS, per kind. The publish gate compares it to the
    // shard's own partition_key; a mismatch means the sender is simply not at this address.
    fun claimedPartitionKey(kind: Int, keyArg: Int, shardSeq: Int): Int {
        if (kind == PS_KIND_CHANNEL) {
            return beginCell().storeUint(PS_CHANNEL_DOMAIN, 32).storeUint(self.senderHash(), 256).storeUint(shardSeq, 32).endCell().hash();
        }
        if (kind == PS_KIND_THREAD) {
            return beginCell().storeUint(PS_THREAD_DOMAIN, 32).storeUint(keyArg, 256).storeUint(shardSeq, 32).endCell().hash();
        }
        if (kind == PS_KIND_BEACON) {
            return beginCell().storeUint(PS_BEACON_DOMAIN, 32).storeUint(keyArg & 0xFFFFFFFF, 32).endCell().hash();
        }
        // PS_KIND_AVATAR
        return beginCell().storeUint(PS_AVATAR_DOMAIN, 32).storeUint(self.senderHash(), 256).endCell().hash();
    }

    receive(msg: PublicPublish) {
        // (1) kind agreement: the message's kind must be the one folded into this address's epoch_tag.
        throwUnless(13701, msg.kind == self.kindOf());
        // (2) THE PREIMAGE GATE — the whole authorization. A sender naming the wrong domain, the wrong bucket or
        //     someone else's channel is not at this address, so this single comparison replaces every stored
        //     owner, signature and registry bind.
        throwUnless(13702, self.claimedPartitionKey(msg.kind, msg.key_arg, msg.shard_seq) == self.partition_key);
        // (3) FRESHNESS — the silent-loss guard (RecordShard.tact:257-269). A clock-skewed client that writes into
        //     an era nobody scans loses the post FOREVER while the wallet reports success. +/-1 era of slack.
        let nowEra: Int = now() / self.eraSeconds();
        throwUnless(13703, (nowEra >= self.eraIndex() - 1) && (nowEra <= self.eraIndex() + 1));
        // (4) FUNDING, in COMPUTE, before any state change, so an underfunded publish bounces and refunds.
        throwUnless(13704, context().value >= (self.entry_count == 0 ? self.deployMinValue() : self.minValue()));
        // (5) SAFE-CAP in COMPUTE — a full shard bounces instead of landing as ACTION-phase code 50. Overflow is
        //     the client's job: it rolls shard_seq to a fresh account and readers probe 0..PS_SEQ_PROBE-1.
        throwUnless(13705, self.entry_count < PS_SAFE_CAP);
        throwUnless(13708, self.entry_count < PS_UINT32_MAX);

        // (6) STORE. publisher is stamped from sender() by the VM, never from a field, so a beacon can only ever
        //     advertise the announcer's own channel. body_commit is computed here from the attached cells.
        self.entries.set(self.entry_count, PublicEntry{
            publisher: sender(),
            body_commit: self.bodyCommit(msg.header, msg.body),
            created_at: now(),
        });
        self.entry_count = self.entry_count + 1;

        // (7) THE FEE LEAVES FIRST — queued AHEAD of the reserve, verbatim from RecordShard.tact:294-310. Behind
        //     the reserve a losing explicit send fails ACTION, which does NOT bounce, and the shard would silently
        //     swallow the publisher's value. Gate 13704 has already checked the value covers this.
        message(MessageParameters{
            to: PS_FEE_SINK,
            value: PS_PROTOCOL_FEE + PS_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositCapsuleFee{ amount: PS_PROTOCOL_FEE, lane: 2,
                                     init_arg0: self.partition_key, init_arg1: self.epoch_tag,
                                     publisher: sender() }.toCell(),
        });

        // (8) Reserve the INCREMENT this message adds on top of the existing balance (ReserveAddOriginalBalance),
        //     never an absolute target — an absolute reserve turns the balance into a ceiling and lets the surplus
        //     be swept by the next publisher (CapsuleHub.tact:1722, quoted in RecordShard.tact:312-318). The fee
        //     is already gone; what stays is this entry's endowment plus the base endowment on the shard's first
        //     publish. Then return this message's change to the sender.
        nativeReserve(
            self.entryEndowment() + (self.entry_count == 1 ? self.baseEndowment() : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // RETIRE THE WHOLE SHARD — permissionless, one-shot, O(1), gated purely on the address. The freshness gate
    // admits only era +/-1, so the last entry this shard can hold was written before (era+2)*eraSeconds; every
    // entry is dead by (era+2)*eraSeconds + retention, an instant that depends ONLY on epoch_tag and is therefore
    // baked into the address. No record_count gate: an empty shard someone funded must stay retireable, or its
    // base endowment is stranded in an immortal account. Payout is the residual via mode 128, which deducts the
    // forward fee from the value so the action cannot fail at any balance including zero.
    receive(msg: RetirePublicShard) {
        throwUnless(13706, now() > self.retireAt() + PS_RETIRE_SLACK);
        self.entries = emptyMap();
        self.entry_count = 0;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    // The sink refused the deposit or was unreachable, so the value came home. No fee ledger to restore — it stays
    // in this account, mixed with rent, the one error path where that happens. Should be unreachable: the deposit
    // carries exactly what gate 15056 demands and FeeAccumulator is immutable. Pinned anyway.
    bounced(msg: bounced<DepositCapsuleFee>) {
        throwUnless(13709, sender() == PS_FEE_SINK);
        throwUnless(13710, msg.amount > 0);
    }

    receive() {}   // plain top-up / lazy deploy carrier

    // Pack the (body_commit, created_at) rows of [start, start+n) into a ref-chained cell, built from the END
    // backwards so each cell can reference the one after it — verbatim shape from IntroShard.packPairs.
    fun packRows(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, PS_PAIRS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: PublicEntry? = self.entries.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.body_commit, 256).storeUint(e == null ? 0 : e!!.created_at, 64);
                i = i + 1;
            }
            if (isTail) { cell = b.endCell(); isTail = false; }
            else { cell = b.storeRef(cell).endCell(); }
            remaining = remaining - chunk;
        }
        return cell;
    }

    // THE FEED-READ PRIMITIVE. Clamped to the live range so a caller cannot be handed ids past the end, and capped
    // so the page cannot run the get-method out of gas. Row i is entry (from_id + i).
    get fun get_page(from_id: Int, max_count: Int): PublicPage {
        let start: Int = max(from_id, 0);
        let available: Int = self.entry_count > start ? self.entry_count - start : 0;
        let n: Int = max(0, min(min(max_count, PS_PAGE_CAP), available));
        return PublicPage{ from_id: start, count: n, entry_count: self.entry_count, rows: self.packRows(start, n) };
    }

    get fun get_entry(entry_id: Int): PublicEntryView {
        let e: PublicEntry? = self.entries.get(entry_id);
        if (e == null) {
            return PublicEntryView{ exists: false, publisher: myAddress(), body_commit: 0, created_at: 0 };
        }
        let v: PublicEntry = e!!;
        return PublicEntryView{ exists: true, publisher: v.publisher, body_commit: v.body_commit, created_at: v.created_at };
    }

    get fun get_view(): PublicShardView {
        return PublicShardView{
            partition_key: self.partition_key,
            epoch_tag: self.epoch_tag,
            kind: self.kindOf(),
            era_index: self.eraIndex(),
            entry_count: self.entry_count,
            safe_cap: PS_SAFE_CAP,
            era_seconds: self.eraSeconds(),
            retention: self.retention(),
            min_value: self.minValue(),
            deploy_min_value: self.deployMinValue(),
            protocol_fee: PS_PROTOCOL_FEE,
            retire_at: self.retireAt(),
            fee_sink: PS_FEE_SINK,
        };
    }
}
