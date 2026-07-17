import "./RecordShard.tact";
import "./IntroShard.tact";

// NullifierShard — clean-17 sharded anon-publish. Increments 1 (double-spend) + 2 (CAC authority) + 3 (forward).
//
// One (epoch, lane) partition of the spent-nullifier ledger the monolithic CapsuleHub could not scale (see the
// ~182-user ceiling in [[capsulehub-account-state-cell-ceiling]]). Deployed lazily, address = f(StateInit{epoch,
// lane}), dies with its epoch. Holds NO authority state and reads nothing synchronously — everything it trusts is
// either frozen in its code or carried in the message it is validating.
//
// ── INCREMENT 1: the token binds to exactly ONE shard (cross-shard double-spend closed) ──────────────────────
// Five gates, all recomputed on-chain, nothing trusted from the sender:
//   (1) 13600  token epoch within the wall-clock window
//   (2) 13621  token epoch == THIS shard's epoch      <- self.epoch is init-data the deployer (attacker) picks;
//              without this a token is accepted by a shard of ANY epoch (measured 9/9). Gate (1) checks the token
//              vs the clock; gate (2) checks it vs THIS shard's identity. Neither substitutes for the other.
//   (3) 13622  serial mod LANE_COUNT == THIS shard's lane, RECOMPUTED from the serial (the x4096 hole)
//   (4) 13601  the token is signed by a currently-authorized issuer subkey (see CAC below)
//   (5) 13605  [RT1-BLOCKER-1] the FRAME is bound to the token — spend_sig, by the spend key, over a digest of the
//              serial AND every routing/content field (bucket_key, frame_commit, kind, intro_*). Without it the
//              token is a BEARER token: a relay the user handed it to, or any observer who front-runs it in
//              transport, spends it with a swapped frame and misdelivers the message while the nullifier burns —
//              silent, unrecoverable. The monolith gated this (classified BLOCKER); the sharded rewrite dropped the
//              gate AND the field. Gates (1)-(4) bind WHICH token and WHERE it may be spent; (5) binds WHAT it says.
//
// ── INCREMENT 2: CAC — Carried Authority Certificate (how a stateless shard knows which key is valid) ─────────
// The monolith kept a mutable issuer_mirror and a multisig could Replace/Revoke a slot INSTANTLY. A sharded,
// lazily-deployed, stateless shard has nowhere to put "current" — so instant revocation is impossible here. CAC
// is the honest replacement: M-of-N ROOT keys are frozen in this code; a root ceremony signs a per-window issuer
// SUBKEY; the subkey blind-signs tokens online. The certificate (subkey authorized by the roots, for a window)
// travels IN THE TOKEN, exactly as the endowment travels in msg.value. There is no mirror, so there is nothing to
// go out of sync.
//
// REVOCATION granularity = the ceremony cadence, and NOTHING FINER — this is an OWNER decision baked into the
// operational regime, not the code:
//   * a leaked SUBKEY is valid only within its cert's [valid_from, valid_to]; the next ceremony issues a fresh
//     subkey and the leaked one dies when its window ends. Damage window <= (valid_to - now).
//   * a leaked ROOT is total (it can mint certs at will) and is redeploy-only — hence M-of-N, cold, geographically
//     split. A shard CANNOT observe WHEN a cert was signed, only its declared window, so no gate bounds a
//     compromised root; only M-of-N custody does.
// The wall-clock gate (1) still caps how far in the future a token may be spent, so a cert with a distant valid_to
// does not by itself enable spending — the attacker also needs a live subkey signature.
//
// EMPTY ACTION PHASE: success stores the nullifier and sends NOTHING (0 outgoing, 0 nativeReserve). The ACTION
// phase therefore has no failure surface — the class of silent code-50 loss removed by construction, not by a
// check. Every refusal is a COMPUTE throw, which bounces and refunds the relay. The forward-to-record hop is
// increment 3.

const NS_ISSUER_SIG_DOMAIN: Int = 0x42534931;   // "BSI1" — serial preimage, MUST mirror CapsuleHub.tact
const NS_NULL_DOMAIN: Int = 0x424E4C31;         // "BNL1" — nullifier key, MUST mirror CapsuleHub.tact
const NS_CERT_DOMAIN: Int = 0x43414331;         // "CAC1" — certificate preimage (root-signed subkey authorization)
const NS_SPEND_DOMAIN: Int = 0x42535031;        // "BSP1" — spend digest preimage, MUST mirror CapsuleHub.tact (RT1-BLOCKER-1)
const NS_FRAME_DOMAIN: Int = 0x4E534652;        // "NSFR" — the frame-routing commitment (binds ALL routing/content fields)
const NS_EPOCH_SECONDS: Int = 86400;
const NS_EPOCH_ACCEPT_PAST: Int = 4;
const NS_EPOCH_ACCEPT_FUTURE: Int = 4;
const NS_LANE_COUNT: Int = 1048576;             // 2^20 lanes per epoch (lazy deploy: only touched lanes are born)
const NS_SAFE_CAP: Int = 4096;                  // per-shard live-nullifier ceiling (refuse in COMPUTE, not code 50 in ACTION)

// [OWNER 2026-07-17] Ceremony cadence = YEARLY. The root ceremony signs a fresh subkey cert once a year, with an
// OVERLAPPING ~15-month window so a slightly-late ceremony never leaves a gap (a gap halts anon-publishing). This
// cap is DEFENSE-IN-DEPTH on ONE cert's window length: it refuses an absurdly-long window from a ceremony error or
// a single rogue signing, bounding a LEAKED SUBKEY to <= ~18 months. It does NOT bound a compromised ROOT (which
// can pre-sign a chain of back-to-back capped certs) — that stays redeploy-only, mitigated by M-of-N cold custody,
// not by this number. Tolerable because a leaked subkey costs only forgone protocol-fee revenue (it still
// self-funds gas + endowment per message via CARRY), so a long worst-case window is acceptable.
const NS_MAX_CERT_EPOCHS: Int = 550;            // ~18 months, in day-epochs (yearly ceremony + operational slack)

// Increment 3+4: after burning the nullifier, forward the record (+ its carried endowment) to the RecordShard AND
// return the relay's excess. CARRY's value flow: the relay brings the money in msg.value; the shard keeps only its
// own storage, forwards only the record endowment, and hands the rest BACK — otherwise every message stranded
// ~0.198 GRAM on this shard forever (measured; the shard is ephemeral so stranded value is lost). All amounts are
// gated in COMPUTE (13624) before the burn, so the sends below cannot fail in ACTION for lack of funds.
//   record endowment: 2 measured cells x 64962/cell/yr x 1yr x 1.5  = 194_886 -> 200_000 (the record lives 1 year)
//   nullifier endowment: ~3 cells x 64962 x (9 days / 365) x 1.5             ~= 7_200 -> 10_000 (nullifier: 9 days)
//   path gas: measured NullShard 16816 + RecordShard 7697 gas (~1.6M nanoTON) + 2 fwd fees, with margin
const NS_RECORD_ENDOWMENT: Int = 200000;        // stays on the RecordShard as the record's 1-year storage endowment
const NS_INTRO_ENDOWMENT: Int = 8000;           // stays on the IntroShard (measured 4 cells x 64962 x 7/365 x 1.5 -> 7500)
const NS_RECORD_GAS: Int = 2500000;             // the RecordShard's OWN compute (~1.6M measured) — the recipient pays gas
                                                //   from the message value, so the forward must carry endowment + this
const NS_NULLIFIER_ENDOWMENT: Int = 10000;      // this shard keeps this per burnt nullifier (9-day rent)
const NS_BASE_ENDOWMENT: Int = 1000000;         // this shard's own keepalive floor (code rent over its ~9-day life)
const NS_PATH_GAS: Int = 5000000;               // this shard's own gas + fwd fees + the return-send (measured ~2M, +margin)
const NS_FORWARD_VALUE: Int = NS_RECORD_ENDOWMENT + NS_RECORD_GAS + NS_NULLIFIER_ENDOWMENT + NS_PATH_GAS;  // min incoming (13624)

// [IMMUTABLE] The M-of-N root of trust, frozen in code (never in data — a key in data would enter the shard
// address and let an attacker deploy a shard trusting a key they control). 2-of-3 here. Values are test roots
// (seeds 0x21/0x22/0x23); the genesis ceremony substitutes the real cold keys. Losing M-of-N of these stops the
// network; stealing M-of-N of them requires a redeploy — the whole reason they are cold and split.
const NS_ROOT_THRESHOLD: Int = 2;
const NS_ROOT_0: Int = 0x884b8857f4eaa1613c61504db34d4beaf346517a0e31de3cddd4d9b4201d9d0b;
const NS_ROOT_1: Int = 0xa09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0;
const NS_ROOT_2: Int = 0x74f85cda34d1c27c4621484731e91579c3d9c6cfc0d94b281aa11e9162058aa9;

message(0x4E535032) NullifierSpend {            // "NSP2"
    // token
    spend_pubkey: Int as uint256;
    epoch: Int as uint32;
    nonce: Int as uint64;
    // certificate: the roots authorized subkey_pubkey to issue for [valid_from, valid_to]
    subkey_pubkey: Int as uint256;
    valid_from: Int as uint32;
    valid_to: Int as uint32;
    root_idx_a: Int as uint8;
    root_idx_b: Int as uint8;
    // lane discriminator (increment 6): 1 = CONV (record), 2 = INTRO (first contact, stealth)
    kind: Int as uint8;
    // CONV: where the record goes + its frame commitment. INTRO reuses frame_commit as the body commitment.
    bucket_key: Int as uint256;
    frame_commit: Int as uint256;
    // INTRO: the sender-chosen (epoch, bucket) partition + the stealth fields (ignored for CONV)
    intro_bucket: Int as uint32;
    intro_r: Int as uint256;
    intro_view_tag: Int as uint16;
    // signatures live in refs — four 512-bit sigs do not fit one cell
    issuer_sig: Cell;                           // subkey over the serial (WHICH token is authorized)
    cert_sig_a: Cell;                           // root a over the cert digest
    cert_sig_b: Cell;                           // root b over the cert digest
    spend_sig: Cell;                            // [RT1-BLOCKER-1] spend key over the frame-binding digest (serial + WHAT it says)
}

struct NullifierShardView {
    epoch: Int;
    lane: Int;
    spent_count: Int;
    lane_count: Int;
    safe_cap: Int;
    root_threshold: Int;
    max_cert_epochs: Int;
}

contract NullifierShard {
    epoch: Int as uint32;
    lane: Int as uint32;
    spent: map<Int, Bool>;
    spent_count: Int as uint32;

    init(epoch: Int, lane: Int) {
        self.epoch = epoch;
        self.lane = lane;
        self.spent = emptyMap();
        self.spent_count = 0;
    }

    // TOTAL by construction: every uint8 index maps to a key or throws. The design round shipped an UNDEFINED
    // rootKey() and a gate that checked index distinctness instead of KEY distinctness — this fixes both.
    fun rootKey(idx: Int): Int {
        throwUnless(13635, idx <= 2);   // total: validate the index FIRST, so every branch below returns a value
        if (idx == 0) { return NS_ROOT_0; }
        if (idx == 1) { return NS_ROOT_1; }
        return NS_ROOT_2;               // idx == 2 (the throwUnless above guarantees idx in {0,1,2})
    }

    fun computeSerial(spendPubkey: Int, epoch: Int, nonce: Int): Int {
        return beginCell()
            .storeUint(NS_ISSUER_SIG_DOMAIN, 32)
            .storeUint(spendPubkey, 256)
            .storeUint(epoch, 32)
            .storeUint(nonce, 64)
            .endCell()
            .hash();
    }

    fun certDigest(subkeyPubkey: Int, validFrom: Int, validTo: Int): Int {
        return beginCell()
            .storeUint(NS_CERT_DOMAIN, 32)
            .storeUint(subkeyPubkey, 256)
            .storeUint(validFrom, 32)
            .storeUint(validTo, 32)
            .endCell()
            .hash();
    }

    fun nullifierKey(serial: Int): Int {
        return beginCell().storeUint(NS_NULL_DOMAIN, 32).storeUint(serial, 256).endCell().hash();
    }

    // [RT1-BLOCKER-1] The frame-binding digest the spend_sig signs. Two-level so it fits a cell: an inner commitment
    // over EVERY routing/content field the shard acts on (kind, bucket_key, frame_commit, and the INTRO stealth
    // fields) — 856 bits, one cell — then an outer hash tying it to the serial. Because the spend key that signs
    // this is the one committed inside the serial (serial = H(BSI1 ‖ spend_pubkey ‖ epoch ‖ nonce)), only the token
    // holder can produce it, and altering ANY frame field changes the digest -> checkSignature fails.
    fun frameBindingDigest(serial: Int, kind: Int, bucketKey: Int, frameCommit: Int, introBucket: Int, introR: Int, introViewTag: Int): Int {
        let fc: Int = beginCell()
            .storeUint(NS_FRAME_DOMAIN, 32)
            .storeUint(kind, 8)
            .storeUint(bucketKey, 256)
            .storeUint(frameCommit, 256)
            .storeUint(introBucket, 32)
            .storeUint(introR, 256)
            .storeUint(introViewTag, 16)
            .endCell()
            .hash();
        return beginCell()
            .storeUint(NS_SPEND_DOMAIN, 32)
            .storeUint(serial, 256)
            .storeUint(fc, 256)
            .endCell()
            .hash();
    }

    receive(msg: NullifierSpend) {
        let nowEpoch: Int = now() / NS_EPOCH_SECONDS;

        // (1) wall-clock window — cheapest gate first, so a stale/absurd token is refused before any hashing or
        //     signature work (a cheap COMPUTE refusal stays bounceable).
        throwUnless(13600, (msg.epoch >= nowEpoch - NS_EPOCH_ACCEPT_PAST) && (msg.epoch <= nowEpoch + NS_EPOCH_ACCEPT_FUTURE));
        throwUnless(13625, (msg.kind == 1) || (msg.kind == 2));   // known lane (cheap, before any crypto)
        // (2) THIS shard's epoch — the load-bearing gate the design list omitted.
        throwUnless(13621, msg.epoch == self.epoch);

        let serial: Int = self.computeSerial(msg.spend_pubkey, msg.epoch, msg.nonce);
        // (3) lane routing recomputed from the serial, not taken from the sender.
        throwUnless(13622, (serial % NS_LANE_COUNT) == self.lane);

        // ── CAC: the subkey that signed this token must be currently authorized by the roots ──
        // cert window must cover the token's epoch. A subkey whose window has passed is dead — this is exactly how
        // revocation works: the next ceremony simply does not renew a compromised subkey's window.
        throwUnless(13630, (msg.epoch >= msg.valid_from) && (msg.epoch <= msg.valid_to));
        // defense-in-depth: refuse an over-long cert window (ceremony error / rogue single signing). Written as an
        // addition, not a subtraction, so a valid_to < valid_from can never underflow here.
        throwUnless(13636, msg.valid_to <= msg.valid_from + NS_MAX_CERT_EPOCHS);
        // 2-of-3: the two roots must be DISTINCT. idx_a < idx_b forces distinct indices and a canonical order;
        // rootKey(a) != rootKey(b) additionally defends against a ceremony that set two root constants equal, which
        // would otherwise let one signature presented twice satisfy the threshold (the design round's silent
        // 2-of-3 -> 1-of-1 collapse).
        throwUnless(13631, msg.root_idx_a < msg.root_idx_b);
        let ka: Int = self.rootKey(msg.root_idx_a);
        let kb: Int = self.rootKey(msg.root_idx_b);
        throwUnless(13632, ka != kb);
        let cd: Int = self.certDigest(msg.subkey_pubkey, msg.valid_from, msg.valid_to);
        throwUnless(13633, checkSignature(cd, msg.cert_sig_a.beginParse(), ka));
        throwUnless(13634, checkSignature(cd, msg.cert_sig_b.beginParse(), kb));
        // NS_ROOT_THRESHOLD is 2; this contract verifies exactly two distinct root sigs above. If the threshold is
        // ever raised, the message and this block must carry/verify that many — the constant documents the intent.

        // (4) the authorized subkey actually signed THIS serial. Splicing a different serial fails here.
        throwUnless(13601, checkSignature(serial, msg.issuer_sig.beginParse(), msg.subkey_pubkey));

        // (5) [RT1-BLOCKER-1] the FRAME is bound to the token. The spend key (committed inside the serial) signs a
        // digest over the serial AND every routing/content field, so the frame cannot be altered by anyone but the
        // token holder. This is the second factor the monolith had and the sharded rewrite dropped: without it the
        // token is a bearer token — a relay it was handed to, or a front-runner who sees it in transport, spends it
        // with a swapped bucket_key/frame_commit/kind/intro_* and the message is misdelivered while the nullifier
        // burns (silent, no bounce, unrecoverable). Placed after 13601 so the whole token+frame is proven before the
        // ledger is touched; it is a COMPUTE throw, so a forged frame bounces and refunds the relay.
        throwUnless(13605, checkSignature(
            self.frameBindingDigest(serial, msg.kind, msg.bucket_key, msg.frame_commit, msg.intro_bucket, msg.intro_r, msg.intro_view_tag),
            msg.spend_sig.beginParse(), msg.spend_pubkey));

        let nk: Int = self.nullifierKey(serial);
        throwUnless(13604, self.spent.get(nk) == null);                 // double spend within this partition
        throwUnless(13623, self.spent_count < NS_SAFE_CAP);             // SAFE-CAP: refuse in COMPUTE, not code 50 in ACTION
        throwUnless(13624, context().value >= NS_FORWARD_VALUE);        // enough value to carry the record forward (COMPUTE, so the forward can't fail in ACTION)

        self.spent.set(nk, true);
        self.spent_count = self.spent_count + 1;

        // Keep ONLY this shard's own storage funded: its base keepalive + one nullifier-endowment per burnt token
        // (including the one just added). Everything above that is the relay's, and goes back below. ReserveAtMost
        // never over-reserves; the 13624 gate guarantees the balance exceeds this, so the sends that follow have
        // funds and cannot fail in ACTION.
        nativeReserve(NS_BASE_ENDOWMENT + self.spent_count * NS_NULLIFIER_ENDOWMENT, ReserveAtMost);

        // Forward to the lane's shard with its endowment. Both cases carry a bounce (a SAFE-CAP refusal at the
        // target is effectively unreachable; if it bounces, the value returns and the nullifier stays burnt — a
        // documented accepted residual). The value was gated in COMPUTE (13624) so this send cannot fail in ACTION.
        if (msg.kind == 1) {
            // CONV -> RecordShard(bucket_key, epoch)
            send(SendParameters{
                to: contractAddress(initOf RecordShard(msg.bucket_key, self.epoch)),
                value: NS_RECORD_ENDOWMENT + NS_RECORD_GAS,
                mode: SendPayGasSeparately,
                bounce: true,
                body: RecordStore{ serial: serial, frame_commit: msg.frame_commit }.toCell(),
            });
        } else {
            // INTRO -> IntroShard(epoch, intro_bucket). frame_commit doubles as the intro body commitment.
            send(SendParameters{
                to: contractAddress(initOf IntroShard(self.epoch, msg.intro_bucket)),
                value: NS_INTRO_ENDOWMENT + NS_RECORD_GAS,
                mode: SendPayGasSeparately,
                bounce: true,
                body: IntroStore{ serial: serial, r: msg.intro_r, view_tag: msg.intro_view_tag, body_commit: msg.frame_commit }.toCell(),
            });
        }

        // Return the relay's excess: whatever remains after the reserve and the record forward. A message to an
        // existing wallet cannot fail here, so this stays within the ACTION-can't-fail guarantee.
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendIgnoreErrors,
            bounce: false,
        });
    }

    bounced(_: bounced<RecordStore>) {}   // accepted residual: value returns, nullifier stays burnt (see above)
    bounced(_: bounced<IntroStore>) {}    // same accepted residual for the INTRO lane

    receive() {}   // plain top-up / lazy deploy carrier

    get fun get_view(): NullifierShardView {
        return NullifierShardView{
            epoch: self.epoch,
            lane: self.lane,
            spent_count: self.spent_count,
            lane_count: NS_LANE_COUNT,
            safe_cap: NS_SAFE_CAP,
            root_threshold: NS_ROOT_THRESHOLD,
            max_cert_epochs: NS_MAX_CERT_EPOCHS,
        };
    }

    get fun is_spent(serial: Int): Bool {
        return self.spent.get(self.nullifierKey(serial)) != null;
    }
}
