import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  SIZE_1K,
  SUITE_HYBRID,
  cellHash,
  marketingCell,
  OP_CAPSULE_HUB_BATCH_ACK,
} from './helpers/vpb2';
import {
  deployAnonReady,
  fundPool,
  convPartToken,
  publicPartToken,
  anonBatch,
  spendKey,
  issuerKey,
} from './helpers/anon';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';
import { FlushFees } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the CapsuleHub state-machine invariant sweep onto the permissionless PublishAnonBatch
// path. The original suite drove the Hub through the REMOVED Vault-forwarded PublishBatchToHub (op 0xA4F862D1),
// where the SOLE authorization was sender()==bound_vault and the Vault brought msg.protocol_fee_total +
// msg.author_wallet. That whole path is gone: publishing is now permissionless and authorized PER PART by a
// spend-token (issuer_sig over the serial + spend_sig over the frame) drawn from a prepaid epoch pool, and the
// protocol fee is accrued from the Hub's OWN constants (a relay cannot spoof it). Every counter, page-count,
// live-count and accrued-fee invariant is preserved EXACTLY; only the ingress and the authorization model change.
//
// Op-by-op mapping of the deterministic simulation:
//   - private/public publish -> a 1-part PublishAnonBatch of the matching kind, funded from the epoch pool, sent
//     by ANY relay treasury; the Hub emits exactly one CapsuleHubBatchAck (op 0x874E5771) to the RELAY (no longer
//     to the bound Vault). accrued += privateFullFee(HYBRID)=10M / PLATO_PUBLIC_POST_FEE_TON=10M.
//   - underfunded publish -> value below the Phase-A floor (13509: part*1M + 30M ack); nothing stored, no ACK.
//   - forged authorization -> REPLACES the removed sender()==vault forge step (old 13500). Authorization moved
//     from sender-identity to crypto tokens, so the faithful successor is a token whose issuer_sig is signed by
//     the WRONG issuer key: verifyIssuerToken rejects it (13603) before any lane-parse; nothing stored, no ACK.
//   - invalid-private (body_hash=0) -> a valid spend-token paired with a valid-shaped private part whose body_hash
//     field is zeroed; verifyIssuerToken passes, then the lane-parse bh!=0 gate (13512) aborts the batch. Unchanged.
//   - flush -> FlushFees against the REAL deployed FeeAccumulator (deployBoundSealedPair wires one). When accrued>0
//     the flush succeeds and debits accrued by the flushed amount (the accumulator credits it); when accrued==0 the
//     amount (10M) exceeds accrued and the flush reverts (13201) — a no-op. Either way the publish counters are
//     untouched, which is the invariant under test.
//
// REMOVED (not migrated): the msg.protocol_fee_total / msg.author_wallet fields (fee now Hub-internal; the public
// author key is channel_id=H(spend_pubkey), not the author wallet) and the sender()==vault gate (13500) — the
// forge step is re-expressed as the token-authorization negative above.

// Per-part protocol fee accrued by a successful 1-part batch (Hub-internal constant; == the old single-publish fee).
const PRIVATE_FEE = 10_000_000n; // privateFullFee(CRYPTO_SUITE_HYBRID) == PLATO_PRIVATE_LONG_TERM_FEE_TON
const PUBLIC_FEE = 10_000_000n;  // PLATO_PUBLIC_POST_FEE_TON
// Value forwarded with a funded 1-part batch — comfortably above the Phase-A floor (part*1M + 30M ack) and the
// full gas gate (13530). Mirrors the reference migration's funded sends (capsulehub-public-index).
const FUNDED_VALUE = toNano('0.3');
// Value forwarded with an underfunded batch — below the Phase-A gross-underfunding floor (13509 = 1*1M + 30M = 31M),
// so the batch bounces before the part walk and stores nothing. 20M < 31M.
const UNDERFUNDED_VALUE = toNano('0.02');
// FlushFees caller reserve: DepositProtocolFee exec reserve (2M) + local exec reserve (2M). The amount+2M sent to
// the accumulator comes from the Hub balance, not from this value.
const FLUSH_VALUE = toNano('0.05');
// Credits funded per seed. Max successful publishes across the three seeds is 15 (deterministic); fund with margin.
const POOL_CREDITS = 34n;

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

// A malformed private part: valid 784-bit / 3-ref CONV shape but with its body_hash field zeroed -> trips the
// bh!=0 lane-parse gate (13512). The whole batch aborts and nothing is stored. (Stand-in for the old
// "invalid-private" step.) The paired spend-token is valid, so verifyIssuerToken passes and the receiver reaches
// lane-parse; 13512 fires before the spend_sig (13605) check, so the token frame need not match this part.
function privatePartZeroBodyHash(fill: number): Cell {
  const h0 = finalPrivateHeader0Cell(0x30 + fill);
  const h1 = finalPrivateHeader1Cell(0x31 + fill);
  const body = finalPrivateBodyCell(SIZE_1K, 0x40 + fill);
  return beginCell()
    .storeUint(SIZE_1K, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(h0), 256).storeUint(cellHash(h1), 256).storeUint(0n, 256) // body_hash = 0
    .storeRef(h0).storeRef(h1).storeRef(body)
    .endCell();
}

// Counts CapsuleHubBatchAck messages emitted to `dest` in a send result. A successful 1-part batch emits exactly
// one, to the RELAY that sent the PublishAnonBatch (the old bound-Vault ACK target is gone).
function countBatchAcks(res: any, dest: Address): number {
  let count = 0;
  for (const tx of res.transactions) {
    const inMsg = tx.inMessage;
    if (!inMsg || inMsg.info?.type !== 'internal') continue;
    if (inMsg.info.dest?.toString() !== dest.toString()) continue;
    const body = inMsg.body;
    if (!body) continue;
    const cs = body.beginParse();
    if (cs.remainingBits < 32) continue;
    if (cs.loadUint(32) === Number(OP_CAPSULE_HUB_BATCH_ACK)) count += 1;
  }
  return count;
}

async function setup() {
  // deployBoundSealedPair (via deployAnonReady) wires a bound+sealed Hub to a REAL deployed FeeAccumulator and a
  // treasury CreditIssuer whose sender FundAnonPool accepts. Fund the epoch pool with enough credits for every
  // successful publish this seed will make (one credit per part).
  const env: any = await deployAnonReady({ credits: 4n });
  await fundPool(env.hub, env.creditIssuer, POOL_CREDITS, env.nowEpoch);
  env.relay = await env.blockchain.treasury('capsule-inv-relay');
  env.operator = await env.blockchain.treasury('capsule-inv-operator');
  return env;
}

describe('CapsuleHub state-machine invariants (B3 anon path)', () => {
  it('CAPSULE-INV-01: deterministic anon publish + flush walks preserve counters and accrued fees', async () => {
    for (const seed of [0xcab50001, 0xcab50002, 0xcab50003]) {
      const env = await setup();
      const hub = env.hub;
      const relay = env.relay.address as Address;
      const rng = makeRng(seed);
      let privateLatest = 0n;
      let publicLatest = 0n;
      let privatePages = 0n;
      let publicPages = 0n;
      let accrued = 0n;
      let ackCount = 0n;
      let uid = 0; // monotonic per-seed nonce/spend-key index (distinct serial per attempt)
      let debugContext = `seed ${seed} initial`;

      async function assertModel() {
        const state = await hub.getGetState();
        expect(state.private_latest_id, `${debugContext}: private_latest`).toBe(privateLatest);
        expect(state.public_latest_id, `${debugContext}: public_latest`).toBe(publicLatest);
        expect(state.private_live_count, `${debugContext}: private_live`).toBe(privateLatest);
        expect(state.public_live_count, `${debugContext}: public_live`).toBe(publicLatest);
        expect(state.private_page_count, `${debugContext}: private_page_count`).toBe(privatePages);
        expect(state.public_page_count, `${debugContext}: public_page_count`).toBe(publicPages);
        expect(state.accrued_plato_fee_ton, `${debugContext}: accrued`).toBe(accrued);
      }

      function notePrivateSuccess(fee: bigint) {
        if ((privateLatest % 256n) === 0n) privatePages += 1n;
        privateLatest += 1n;
        accrued += fee;
      }

      function notePublicSuccess(fee: bigint) {
        if ((publicLatest % 256n) === 0n) publicPages += 1n;
        publicLatest += 1n;
        accrued += fee;
      }

      for (let step = 0; step < 45; step += 1) {
        const op = rng() % 5;
        if (op === 0) {
          const underfunded = (rng() % 5) === 0;
          debugContext = `seed ${seed} step ${step} anon-private underfunded=${underfunded}`;
          const pt = convPartToken({
            issuer: env.issuer, spend: spendKey(uid), slot: env.slot, epoch: env.nowEpoch,
            nonce: BigInt(uid), fill: uid % 90, kind: KIND_PRIVATE,
          });
          uid += 1;
          const res = await hub.send(
            env.relay.getSender(),
            { value: underfunded ? UNDERFUNDED_VALUE : FUNDED_VALUE },
            anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PRIVATE }),
          );
          if (!underfunded) {
            notePrivateSuccess(PRIVATE_FEE);
            ackCount += BigInt(countBatchAcks(res, relay));
          } else {
            expect(countBatchAcks(res, relay), `${debugContext}: no ack on underfunded`).toBe(0);
          }
        } else if (op === 1) {
          const underfunded = (rng() % 5) === 0;
          debugContext = `seed ${seed} step ${step} anon-public underfunded=${underfunded}`;
          const pt = publicPartToken({
            issuer: env.issuer, spend: spendKey(uid), slot: env.slot, epoch: env.nowEpoch,
            nonce: BigInt(uid), fill: uid % 90,
          });
          uid += 1;
          const res = await hub.send(
            env.relay.getSender(),
            { value: underfunded ? UNDERFUNDED_VALUE : FUNDED_VALUE },
            anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }),
          );
          if (!underfunded) {
            notePublicSuccess(PUBLIC_FEE);
            ackCount += BigInt(countBatchAcks(res, relay));
          } else {
            expect(countBatchAcks(res, relay), `${debugContext}: no ack on underfunded`).toBe(0);
          }
        } else if (op === 2) {
          // REPLACES the removed sender()==vault forge (old 13500). Authorization is now the spend-token, so the
          // forge is a token whose issuer_sig is signed by the WRONG issuer key -> verifyIssuerToken rejects at
          // 13603 before any store. Nothing is stored and no ACK is emitted.
          debugContext = `seed ${seed} step ${step} forged-token (wrong issuer sig -> 13603)`;
          const pt = convPartToken({
            issuer: env.issuer, spend: spendKey(uid), slot: env.slot, epoch: env.nowEpoch,
            nonce: BigInt(uid), fill: uid % 90, kind: KIND_PRIVATE, issuerSigKey: issuerKey(0x99),
          });
          uid += 1;
          const res = await hub.send(
            env.relay.getSender(),
            { value: FUNDED_VALUE },
            anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PRIVATE }),
          );
          expect(countBatchAcks(res, relay), `${debugContext}: no ack on forged token`).toBe(0);
        } else if (op === 3) {
          debugContext = `seed ${seed} step ${step} invalid-private (body_hash=0 -> 13512)`;
          // Valid spend-token (verifyIssuerToken passes) paired with a valid-shaped private part whose body_hash
          // is zeroed -> lane-parse bh!=0 (13512) aborts the whole batch.
          const pt = convPartToken({
            issuer: env.issuer, spend: spendKey(uid), slot: env.slot, epoch: env.nowEpoch,
            nonce: BigInt(uid), fill: uid % 90, kind: KIND_PRIVATE,
          });
          const res = await hub.send(
            env.relay.getSender(),
            { value: FUNDED_VALUE },
            anonBatch({ parts: privatePartZeroBodyHash(uid % 90), tokens: pt.tok, partCount: 1n, kind: KIND_PRIVATE }),
          );
          uid += 1;
          expect(countBatchAcks(res, relay), `${debugContext}: no ack on invalid part`).toBe(0);
        } else {
          const amount = accrued > 0n ? (accrued > PUBLIC_FEE ? PUBLIC_FEE : accrued) : PUBLIC_FEE;
          debugContext = `seed ${seed} step ${step} flush amount=${amount} accrued=${accrued}`;
          await hub.send(env.operator.getSender(), { value: FLUSH_VALUE }, {
            $$type: 'FlushFees',
            amount,
          } as FlushFees);
          // Real flush against the deployed FeeAccumulator: when accrued>0 the flush succeeds and debits accrued by
          // `amount` (accumulator credits it); when accrued==0 the amount (10M) exceeds accrued and the flush
          // reverts (13201) — a no-op. Publish counters are untouched either way.
          if (accrued > 0n) accrued -= amount;
        }
        await assertModel();
      }

      // Cross-check: every successful batch produced exactly one CapsuleHubBatchAck to the relay.
      expect(ackCount, `${debugContext}: ack_count == successful batches`).toBe(privateLatest + publicLatest);
    }
  }, 90000);
});
