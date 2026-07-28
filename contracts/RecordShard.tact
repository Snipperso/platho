// RecordShard — clean-17 sharded CONV lane: one (bucket_key, epoch) partition = a conversation-direction for a day.
//
// DIRECT-PAID (no tokens, no nullifiers, no issuer). [OWNER 2026-07-18: all external infrastructure is forbidden in
// this project and always has been.] The earlier design routed every publish through a NullifierShard that burnt a
// blind-issued token. That token layer only bought unlinkability against the ISSUER — a chain observer still reads
// the spend transaction's `src` — so it paid off only in combination with an external relay. Two mandatory online
// services in the send path is exactly what this project does not do, so the whole layer is gone. What actually
// closed the metadata-graph leak is the opaque bucket_key, and that is pure client-side crypto:
//     bucket_key = HKDF(K_epoch ‖ dir ‖ epoch),  K_epoch = HKDF(K_root, epoch)
//
// WRITE AUTHORIZATION = A SIGNATURE UNDER THE BUCKET'S OWN KEY. An earlier draft of this rewrite claimed that
// merely KNOWING the bucket key was the capability, since only the two participants can derive it. That was WRONG
// and was caught by measurement: the bucket key goes into this contract's ADDRESS, and the address is public the
// instant anyone publishes (it is the destination of that transaction). A stranger who had only observed one publish
// appended junk to a private conversation, and filling SAFE_CAP to deny a conversation-day cost ~11 TON.
// ADDRESS PRIVACY IS NOT AUTHORIZATION.
//
// So the shard's identity is a PUBLIC KEY: write_pubkey = ed25519(HKDF(K_epoch ‖ dir ‖ epoch, "PLATHO.CONV.WRITE.V1")),
// derived from the conversation's shared K_root. Knowing the address (a hash) does not let anyone sign. A publish
// must carry a signature over (seq ‖ the commitment this contract computes), so an outsider can neither forge new
// content nor splice a captured signature onto different cells.
//
// The monotonic `seq` closes REPLAY, which the signature alone does not: without it a captured (cells, sig) pair
// could be re-sent to burn SAFE_CAP slots at the same ~11 TON, leaving the denial-of-service intact. It doubles as
// the client's ordering key. Anti-spam beyond that is the rent itself, bounded by SAFE-CAP and by the shard's
// own death: nothing removes a single record, the whole shard is retired at once (see RetireShard).
//
// BODY CARRIAGE — the bug this rewrite fixes. The two-hop design could not deliver a message at all: the forward
// carried only {serial, frame_commit}, so the ciphertext existed nowhere on chain and the recipient had nothing to
// decrypt. Publishing DIRECTLY to the terminal shard fixes it by construction: the client's own transaction lands
// here carrying the capsule cells, so the content lives in THIS account's transaction history, authenticated by the
// stored commit. That is the proven monolith pattern (headers/body recovered from hub tx history).
//
// STATE STAYS THIN: the account stores only (frame_commit, created_at) per record — the capsule cells are NOT copied
// into state. That is what keeps a shard's state bounded and the ~65536-cell account ceiling irrelevant. The durability
// tradeoff is explicit and inherited from the monolith: content lives in transaction history, so a message is
// recoverable as long as history is. The RECOVERY lane exists precisely because the K_root blob must survive even
// that, and it alone stores its blob on chain.
//
// TERMINAL + CARRY: success stores the record and returns the payer's change (one send to the sender's wallet, which
// cannot fail), keeping only the shard's own rent. Every refusal is a COMPUTE throw, which bounces and refunds.

const RS_SAFE_CAP: Int = 4096;        // records per (bucket_key, epoch); refuse in COMPUTE, not code 50 in ACTION
// 1 year. Once RS_RETENTION has passed for the NEWEST record the whole shard is dead, and because the publish
// gate admits only epoch +/-1 the newest record is written before (epoch+2)*86400 — so the shard's death instant
// is a pure function of its ADDRESS. That is what makes an O(1) retire possible; see RetireShard below.
const RS_RETENTION: Int = 31536000;

// frame_commit preimage tag. The CONTRACT defines the commitment, so client and reader cannot disagree about it.
const RS_FRAME_DOMAIN: Int = 0x52534643;   // "RSFC"
const RS_WRITE_DOMAIN: Int = 0x52535744;   // "RSWD" — the write-authorization digest preimage

// [MEASURED 2026-07-28 — G8 gate CLEARED on the current artifacts, and now re-proved on every run by
//  tests/conv-intro-rent-solvency.test.ts rather than resting on the note below. Worst-case birth (gate 13656
//  admits epoch-1, so the life is 3 days + retention, not 2): retained 3_800_000 vs rent 1_375_418 at one record
//  = 2.76x, and 7_100_000 vs 3_536_790 at twelve = 2.01x. Both clear the 1.5x rule. The reserve arithmetic
//  reconciles exactly — 3_500_000 base + n x 300_000 — which is what confirms the measurement read this contract
//  and not a float left on top of it.]
// Storage is 64962 nanoton/cell/year (config-18, bits free).
//   record endowment: 3 MEASURED cells x 64962 x 1yr x 1.5 = 292_329 -> 300_000 (the record lives 1 year).
//     The earlier "2 cells" figure lost the G8 1.5x margin by coincidence: 2 x 64962 x 1.5 == 3 x 64962 == 194_886,
//     so the number looked right while the real margin was 1.026x. config-18 is a SCHEDULE and has already moved
//     (500/1 -> 135/0 in Apr 2026); a 3% rise would make a full shard rent-insolvent before its own retention ends,
//     and an immutable contract cannot be repriced afterwards.
//   base endowment:   the shard's own code+data rent over its 1-year life, with margin
//   publish gas:      this contract's own compute + the change-return, measured ~1.6M on the old terminal hop
const RS_RECORD_ENDOWMENT: Int = 300000;
// The shard's own code+data rent over its life, PLUS the cost of the one call that ends it. Raised 2_000_000 ->
// 3_500_000 on 2026-07-19 when per-record eviction was deleted: retiring a shard costs a MEASURED 960_339 flat,
// independent of how many records it holds, so its funding belongs in the one per-shard purse rather than in a
// per-record levy. See RetireShard.
const RS_BASE_ENDOWMENT: Int = 3500000;
const RS_PUBLISH_GAS: Int = 2500000;

// PROTOCOL FEE — 0.01 GRAM per published capsule. NOT storage: this is the service fee that funds the liquidity
// pool, and it is the other half of the airdrop's economics (owner's frozen math: 1.5M capsules -> 15M ATH paid out
// -> 15k GRAM collected). It carried the same value in the deleted CreditSale (CS_CREDIT_FEE_DEFAULT = 10000000,
// commented "owner: 10M nanoTON -> 15k GRAM at 1.5M"), and dropping the token layer silently dropped it with them.
// Restoring it also removes what looked like an airdrop-farm: publishing must cost the fee, not just the rent.
const RS_PROTOCOL_FEE: Int = 10000000;

// THE FEE PASSES THROUGH THIS SHARD — IT DOES NOT LIVE HERE. [OWNER 2026-07-19: "в шарде должна быть только
// его рента на год, а моя комиссия это моя комиссия".] The publish receiver forwards it to FeeAccumulator in the
// same transaction that stores the record, so this account's balance is its own rent and nothing else.
//
// THE PREVIOUS REVISION ACCUMULATED IT, AND THAT WAS AN ARCHITECTURE BUILT AROUND ANOTHER CONTRACT'S WRONG
// CONSTANT. FeeAccumulator demanded a 2_000_000 execution reserve per deposit, which is noise for CapsuleHub's
// rare bulk flush but 18% of a per-capsule fee — so the fee was pooled in `accrued_fee` and remitted once per
// shard, purely to pay that constant once instead of a million times. Measuring it (199_068 actual, against the
// live mainnet gas config) and fixing it at the source removed the reason for the whole mechanism, and with it:
// accrued_fee, the remit receiver, the solvency test, the bounty-outranks-fee ordering, the stranding of a fee
// whose shard was never swept, and the dependence of protocol revenue on somebody choosing to run eviction.
//
// WHY THE FEE GOES THROUGH THE SHARD AT ALL, rather than the client paying FeeAccumulator directly: because a
// contract cannot see the other messages of the sender's transaction. If the fee were a separate message from
// the wallet, gate 13652 could not check it, and a modified client would simply omit it — publishing would
// succeed and the fee would be optional. Routing it through here is what makes it mandatory.
//
// THE ADDRESS IS A CONSTANT, NOT A BINDING. A shard deploys LAZILY and UNBOUND — the first publisher creates the
// account — so any post-deploy bind receiver would let a stranger bind their own address and walk off with every
// fee that shard ever collects. A constant is the only form that cannot be captured.
// This was expected to force a genesis ordering constraint (sink address -> shard code -> shard addresses).
// MEASURED 2026-07-19: it does not. FeeAccumulator.init takes only (treasury_receiver, buyback_burn) with NO
// deployment_id, so its address is a pure function of its code and the owner's two wallets — the current build
// deployment_id, so its address is a pure function of its code and the owner's two addresses.
// THAT TURNED OUT TO BE TRUE ONLY WHILE ITS CODE WAS UNTOUCHED. Lowering FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE
// changed its code hash and moved its address, and the shards kept pointing at the old one — every publish's fee
// bounced straight back, caught by tests/shard-fee-passthrough.test.ts. So the genesis ordering IS real and it is:
// FeeAccumulator code -> its address -> shard code -> shard addresses. PT-04b derives the address fresh rather
// than comparing against a literal, so changing that contract again fails loudly instead of routing real money
// into a dead address.
// [MOVED 2026-07-19 — AND THIS IS THE ORDERING CONSTRAINT I WRONGLY DECLARED NON-EXISTENT.] Earlier today I
// measured that FeeAccumulator.init carries no deployment_id, concluded its address is fixed forever, and told
// the owner there was no genesis ordering to respect. That was true only while its CODE was untouched. Lowering
// FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE changed its code hash and therefore its address, and the shards kept
// pointing at the old one — every publish's fee bounced straight back, caught by tests/shard-fee-passthrough.
// So the constraint is real and it is this: FeeAccumulator code -> its address -> shard code -> shard addresses.
// No cycle, but it must be walked in that order at genesis, and PT-04/PIN pins the result.
const RS_FEE_SINK: Address = address("EQAnVFHvZwSidVZ5y46nz7y4KibSp_8pHD3C1y73BJ3kQM1K");

// TRANSPORT OF THE FEE, PAID BY THE PUBLISHER. [OWNER 2026-07-19, asked directly whose column this comes out of:
// "естественно платит публикатор... Рожа у пользователей не треснет?"] So the fee arrives at the pool WHOLE —
// 15_000 GRAM, not 14_550 — and the publish minimum carries the cost instead. It is the same ~450 GRAM either
// way; only the payer differs.
//
// Mirror of FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE, which gate 15056 demands on top of the principal. If the
// two constants drift apart the deposit is refused and the fee bounces back here, so PT-04 in
// tests/shard-fee-passthrough.test.ts reads both out of the sources and pins them against each other.
//
// 400_000 -> 1_400_000 -> 2_600_000. The first raise was reasoning, the second is measurement. Both earlier
// figures descend from 199_068 — the cost of the OLD permissionless deposit, which did no sender proof at all.
// The capsule deposit now derives the shard's address to authenticate it (9,542 gas = 636,134 on its own) and
// then sends an airdrop credit with StateInit attached, and the two together cost the sink 2,105,535. MEASURED
// 2026-07-20; see the comment on FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE for the full decomposition.
//
// The protocol fee itself is untouched and still reaches the pool whole — only the transport the publisher pays
// grows, from 0.0134 to 0.0156 GRAM per capsule. That is the airdrop credit's real price, charged to the
// publisher who receives the airdrop.
const RS_FEE_SINK_DEPOSIT_RESERVE: Int = 2600000;
// The forward fee for the deposit message. MEASURED 2026-07-19 at ~75_000, and flat in shard size because the
// deposit body is a fixed 160 bits. 200_000 keeps ~2.7x headroom against a config-25 repricing; unlike the
// deposit reserve, slack here is simply returned to the publisher with their change, so it is free to be
// generous and expensive to be tight.
const RS_FEE_SINK_FWD_RESERVE: Int = 200000;
const RS_FEE_TRANSPORT: Int = RS_FEE_SINK_DEPOSIT_RESERVE + RS_FEE_SINK_FWD_RESERVE;

// RETIRING A SHARD — what replaced per-record eviction, and why.
//
// [MEASURED 2026-07-19 with a real WalletContractV5R1, which matters: a @ton/sandbox treasury does no ed25519
// check and understates a caller's cost by ~224_200, which had made every earlier eviction figure optimistic.]
//   retiring a whole shard: 5140 gas, CONSTANT at N = 1, 2, 10, 64, 256, 1024, 4096; caller's total cost 960_339
//   evicting 64 of 1024 records: 425_835 gas, sixteen calls needed, and the account is still alive afterwards
//
// So the work is O(1) and the old bounty was O(N). That mismatch was the whole defect: at RS_SAFE_CAP the bounty
// collected 4096 x 800_000 = 3.28 GRAM to pay for a 0.00096 GRAM job — 3400x overfunded — while a one-record
// shard was still UNDERfunded, netting a real wallet -191_740. Every publisher paid 0.0008 GRAM for a service
// that a rational caller would never perform. Deleting it makes a publish cheaper AND the contract simpler.
//
// The retire is permissionless and destroys the account, so the address-derived time gate is the only guard that
// matters. It is exact: refused at death-1s and at death itself, accepted at death+1s.
// A retire is worth roughly the shard's residual, so it decays with rent — measured self-funding for ~290-300
// days past the death instant, after which nobody will ever bother. That is accepted, not solved: the money is
// the publishers' own prepaid rent, and rent is what consumes it either way.

// gate 13652, the STEADY-STATE publish. RS_FEE_TRANSPORT is in here because the publisher pays it: the fee must
// reach FeeAccumulator whole.
const RS_MIN_VALUE: Int = RS_RECORD_ENDOWMENT + RS_PUBLISH_GAS + RS_PROTOCOL_FEE + RS_FEE_TRANSPORT;
// What the FIRST publish into a shard must bring: it also funds the account's own lifetime and its retirement.
// This is charged EXPLICITLY rather than left to the reserve, because leaving it to the reserve is what HEAD did
// and it was silently broken — a first publish paying exactly the old minimum left the shard 201_469 SHORT of
// its own reserve target, since ReserveAtMost simply clamps. An under-endowed shard cannot fund its own retire,
// which would make it immortal. Clients read both figures from get_view (min_value / deploy_min_value) and must
// pay the deploy figure whenever the account is absent OR record_count == 0.
const RS_DEPLOY_MIN_VALUE: Int = RS_MIN_VALUE + RS_BASE_ENDOWMENT;

// The capsule a client publishes. The three cells are carried so they land in this account's transaction history;
// they are NOT stored in state. frame_commit is recomputed here from their hashes — nothing is trusted from the sender.
message(0x52535031) CapsulePublish {   // "RSP1"
    seq: Int as uint64;               // strictly increasing per shard — closes replay, and orders records
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    sig: Cell;                        // ed25519 over H(RS_WRITE_DOMAIN ‖ seq ‖ frame_commit) under write_pubkey
}

// "RSP3" — permissionless one-shot retirement: drop every record and destroy the account. Carries no fields:
// there is nothing to choose, the only question is whether the shard is dead yet and that is fixed by its address.
message(0x52535033) RetireShard {}

// Declared locally with FeeAccumulator's opcode, exactly as CapsuleHub does — Tact compiles one contract per
// project, so the sink's message type is mirrored rather than imported. The opcode is what must match.
message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

// The airdrop-bearing deposit, mirroring FeeAccumulator's opcode. Carries the publisher (stamped by the VM from
// sender(), never from the body) and this shard's own init arguments POSITIONALLY, so the sink can rebuild this
// address from its bound code and prove the deposit came from a real shard. `lane` says which code that is —
// the two lanes have different init arguments, so naming the fields would bake in one lane's shape.
message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}

struct RecordEntry {
    frame_commit: Int;
    created_at: Int;
}

struct CapsuleRecordView {
    exists: Bool;
    frame_commit: Int;
    created_at: Int;     // the client orders/ages records by this; the contract stamps it, so it cannot be gamed
}

struct RecordShardView {
    write_pubkey: Int;
    epoch: Int;
    last_seq: Int;
    record_count: Int;   // records stored; also the SAFE-CAP counter, since nothing removes one before the end
    safe_cap: Int;
    retention: Int;
    min_value: Int;         // what a further publish must bring (clients read this, never a hardcoded mirror)
    deploy_min_value: Int;  // what the FIRST publish must bring — pay this whenever record_count == 0
    protocol_fee: Int;      // the per-capsule service fee included in both figures
    retire_at: Int;         // the exact second this shard becomes retireable; read it, never recompute it
    fee_sink: Address;      // where each publish forwards the fee; a constant, readable without disassembly
}

contract RecordShard {
    write_pubkey: Int as uint256;     // the bucket's identity AND its write authority (see the header)
    epoch: Int as uint32;
    last_seq: Int as uint64;          // replay floor: a publish must strictly exceed it
    records: map<Int, RecordEntry>;   // entry_id -> (frame_commit, created_at)
    record_count: Int as uint32;      // records stored; nothing removes one, so this is also the live count

    init(write_pubkey: Int, epoch: Int) {
        self.write_pubkey = write_pubkey;
        self.epoch = epoch;
        self.last_seq = 0;
        self.records = emptyMap();
        self.record_count = 0;
    }

    // The commitment binding a record to its capsule cells. Defined HERE so the publisher and the reader derive it
    // identically by construction — a client-supplied commit could silently disagree with the cells it ships.
    fun frameCommit(h0: Cell, h1: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(RS_FRAME_DOMAIN, 32)
            .storeUint(h0.hash(), 256)
            .storeUint(h1.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    receive(msg: CapsulePublish) {
        // Funding gated in COMPUTE, before any state change, so an underfunded publish bounces and is refunded
        // rather than half-committing. The record's rent must be present or the shard slowly starves.
        // THE SHARD MUST BELONG TO ROUGHLY NOW. Without this the epoch was a free parameter: MEASURED — a publish
        // into the shard for an epoch 300 days PAST and one 300 days FUTURE were both accepted with exit 0.
        // Two things go wrong, and the first is a plain product bug rather than an attack. A client whose clock is
        // off publishes into a shard nobody scans; the recipient's window is the retention period, so the message
        // is lost FOREVER while the wallet reports success. That is the same silent-success family as sending to
        // an uninitialised account, and it is the worst failure mode this project has.
        // The second is that it makes past epochs mutable, so nothing derived from a past epoch's state can be
        // trusted to be the same for two readers — an attacker can move it after one client has read it and before
        // another has. Any client-side rule that reads history (for instance sizing the bucket space from observed
        // fill) rests on epochs being closed, and they were not.
        // The tolerance is +/-1 epoch, not exact equality: a message signed just before midnight may well be
        // processed just after it, and bouncing those would be a real bug for no gain. One epoch of slack is safe
        // because the recipient's scan window is the whole retention period, which is far wider than a day.
        let nowEpoch: Int = now() / 86400;
        throwUnless(13656, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
        throwUnless(13652, context().value >= (self.record_count == 0 ? RS_DEPLOY_MIN_VALUE : RS_MIN_VALUE));
        // SAFE-CAP in COMPUTE, so a full partition bounces instead of hitting code 50 in ACTION.
        throwUnless(13651, self.record_count < RS_SAFE_CAP);
        // Replay floor: a captured (cells, sig) pair cannot be re-sent to burn slots.
        throwUnless(13653, msg.seq > self.last_seq);

        // WRITE AUTHORIZATION: the commitment is computed HERE from the attached cells, so the signature binds the
        // exact capsule — a captured signature cannot be spliced onto different content, and an outsider who knows
        // only the address cannot sign at all.
        let commit: Int = self.frameCommit(msg.header_0, msg.header_1, msg.body);
        let digest: Int = beginCell()
            .storeUint(RS_WRITE_DOMAIN, 32).storeUint(msg.seq, 64).storeUint(commit, 256)
            .endCell().hash();
        throwUnless(13654, checkSignature(digest, msg.sig.beginParse(), self.write_pubkey));

        self.last_seq = msg.seq;
        // created_at is stamped by the CONTRACT (now()) rather than taken from the sender. Nothing reads it on
        // chain any more — retirement is arithmetic on `epoch` alone — but a client orders and ages records by it,
        // so a client-supplied field would still be worth forging.
        self.records.set(self.record_count, RecordEntry{ frame_commit: commit, created_at: now() });
        self.record_count = self.record_count + 1;

        // THE FEE LEAVES FIRST, AND THE ORDER IS THE SAFETY PROPERTY. Actions execute in the order they are
        // queued, so putting the deposit AHEAD of the reserve means it is drawn from the value this message
        // brought — which gate 13652 has already checked covers RS_PROTOCOL_FEE + RS_FEE_TRANSPORT. Queue it
        // after the reserve instead and it competes with money the reserve has just set aside; if the reserve
        // won, the explicit send would fail, and an ACTION-phase failure DOES NOT BOUNCE — the shard would
        // silently swallow the publisher's value. That is exactly the defect three attackers reproduced against
        // the design panel's winner on what was then the eviction path, and the reason every refusal here is a
        // COMPUTE throw.
        message(MessageParameters {
            to: RS_FEE_SINK,
            value: RS_PROTOCOL_FEE + RS_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositCapsuleFee{ amount: RS_PROTOCOL_FEE, lane: 0,
                                     init_arg0: self.write_pubkey, init_arg1: self.epoch,
                                     publisher: sender() }.toCell(),
        });

        // Reserve the INCREMENT this message adds, ON TOP OF the balance the account already had
        // (ReserveAddOriginalBalance), and return only THIS message's change. An absolute reserve was wrong and the
        // monolith says so in as many words at CapsuleHub.tact:1722 — "reserve(protectedReserve) would be WRONG, it
        // would leak the sweepable surplus". With an absolute target the balance becomes a hard ceiling: every
        // surplus (a deliberate top-up to extend a conversation, a mistaken transfer, the deploy float) is swept to
        // whoever publishes next, and the balance also becomes an exact public message counter. ReserveAtMost keeps
        // it from ever exceeding the balance, so ACTION still cannot fail.
        // THE FEE IS NOT IN THIS SUM ANY MORE. It has already gone; what stays is the shard's own rent and the
        // record's own storage endowment, plus the base endowment on the publish that creates the shard.
        nativeReserve(
            RS_RECORD_ENDOWMENT + (self.record_count == 1 ? RS_BASE_ENDOWMENT : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // RETIRE THE WHOLE SHARD. One call, constant cost, and the account is gone.
    //
    // WHY THE GATE IS SAFE WITHOUT ANY OTHER CHECK. The publish gate (13656) admits only epoch +/-1, so the last
    // record this shard can ever hold was written before (epoch+2)*86400. Every record is therefore dead by
    // (epoch+2)*86400 + RS_RETENTION, and that instant depends ONLY on `epoch`, which is an init parameter and
    // thus baked into the address. Nobody can retire a shard early by any amount of money or timing: the
    // condition is arithmetic on the address, not on state a caller could influence.
    //
    // It is deliberately LATER than per-record eviction would have been, never earlier — the oldest record could
    // have gone at created_at + RS_RETENTION. Records therefore live slightly longer than the retention promise,
    // never shorter, which is the safe direction for a messenger.
    //
    // NO record_count > 0 GATE, on purpose. A shard that was created and never written to must stay retireable,
    // or the base endowment somebody funded is stranded in an immortal account — the exact failure this replaced
    // eviction to avoid. The cost is that a stranger may retire an empty shard and collect its residual; they
    // will find it is not worth the gas, which is a pointless errand rather than a permanent lock-up.
    //
    // THE PAYOUT IS THE RESIDUAL, and mode 128 sends it with the forward fee deducted FROM the value, so the
    // action cannot fail for insufficiency at any balance including zero. That is why there is no minimum-residual
    // floor: an attacker's version of this receiver with such a floor was measured to create permanently
    // unretireable zombie shards, because a drained shard could then never be cleaned up by anybody.
    receive(msg: RetireShard) {
        throwUnless(13655, now() > (self.epoch + 2) * 86400 + RS_RETENTION);
        self.records = emptyMap();
        self.record_count = 0;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    // The sink refused the deposit or was unreachable, so the value came back. There is no fee ledger to restore
    // any more — the money simply stays in this account, mixed with the rent, which is the one case where that
    // happens and it is an error path rather than the design. Handled explicitly so the bounce does not abort the
    // transaction; the sender gate stands because the bounced flag is an ordinary header bit any account may set.
    // This should be unreachable: the deposit carries exactly what gate 15002 demands, and FeeAccumulator is
    // deployed at genesis and immutable. tests/shard-fee-passthrough.test.ts covers it anyway.
    bounced(msg: bounced<DepositCapsuleFee>) {
        throwUnless(13657, sender() == RS_FEE_SINK);
        throwUnless(13658, msg.amount > 0);
    }

    receive() {}   // plain top-up / lazy deploy carrier

    get fun get_record(entry_id: Int): CapsuleRecordView {
        let e: RecordEntry? = self.records.get(entry_id);
        if (e == null) {
            return CapsuleRecordView{ exists: false, frame_commit: 0, created_at: 0 };
        }
        let v: RecordEntry = e!!;
        return CapsuleRecordView{ exists: true, frame_commit: v.frame_commit, created_at: v.created_at };
    }

    get fun get_view(): RecordShardView {
        return RecordShardView{
            write_pubkey: self.write_pubkey,
            epoch: self.epoch,
            last_seq: self.last_seq,
            record_count: self.record_count,
            safe_cap: RS_SAFE_CAP,
            retention: RS_RETENTION,
            min_value: RS_MIN_VALUE,
            deploy_min_value: RS_DEPLOY_MIN_VALUE,
            retire_at: (self.epoch + 2) * 86400 + RS_RETENTION,
            protocol_fee: RS_PROTOCOL_FEE,
            fee_sink: RS_FEE_SINK,
        };
    }
}
