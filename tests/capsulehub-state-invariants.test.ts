import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { CapsuleHub, FlushFees } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  OP_CAPSULE_HUB_BATCH_ACK,
  marketingCell,
  partsList,
} from './helpers/vpb2';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

// VPB2 Session 4/5 — migrated onto the batch ingest (PublishBatchToHub). The original suite drove the Hub
// through the REMOVED single-publish receivers (PublishPrivateFromVault / PublishPublicFromVault) and counted
// CapsuleHubPublishAck replies on a MockVaultAckSink. The batch path replaces each single publish step with a
// 1-part PublishBatchToHub of the matching kind: it stores one entry, advances the same counters by one,
// accrues msg.protocol_fee_total, and ACKs the bound Vault with CapsuleHubBatchAck (op 0x874E5771). Because
// the new ACK op is not a CapsuleHubPublishAck, the MockVaultAckSink can no longer count it — so the bound
// Vault is now a plain treasury and ack_count is observed directly off the emitted CapsuleHubBatchAck message.
// Every counter, page-count, and accrued-fee assertion is preserved exactly. Forged-sender and malformed-part
// steps map to a non-Vault sender (13500) and a body-hash-zero private part (13512); both must change nothing.

// Per-step protocol fee accrued by a successful 1-part batch (== the old single-publish protocol_fee_paid).
const PRIVATE_FEE = 10_000_000n; // PLATO_PRIVATE_LONG_TERM_FEE_TON (hybrid full fee)
const PUBLIC_FEE = 10_000_000n;  // PLATO_PUBLIC_POST_FEE_TON
// Value forwarded with a funded batch — comfortably above the Phase-A floor (fee + 1M/part + 30M ACK reserve)
// and the full-value gate (storage endowments + gas). Mirrors the working HUB-BATCH-* funded sends.
const FUNDED_VALUE = toNano('0.1');
// Value forwarded with an underfunded batch — below the Phase-A gross-underfunding floor (op 13509), so the
// batch bounces before the part walk and stores nothing. floor = fee(10M) + 1M + 30M = 41M; 20M < 41M.
const UNDERFUNDED_VALUE = toNano('0.02');
// FlushFees exec budget (matches the old suite): 30M ACK reserve + 2M local exec reserve.
const ACK_RESERVE = 30_000_000n;
const FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;

const MANIFEST_HASH = hash256('capsulehub-state-invariants-manifest');

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.INV.${label}`).digest('hex'));
}

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.CAPSULE.INV.${label}`).digest());
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

// A valid 1-part private batch payload (reuses the helper part builders via partsList).
function privateParts(): Cell {
  return partsList(KIND_PRIVATE, 1);
}

// A valid 1-part public batch payload.
function publicParts(): Cell {
  return partsList(KIND_PUBLIC, 1);
}

// A malformed private part: valid shape but body_hash field zeroed -> trips the bh!=0 gate (13512). The whole
// batch aborts and nothing is stored. (Stand-in for the old "invalid-private" header_0_hash:0 step.)
function privatePartZeroBodyHash(): Cell {
  const h0 = finalPrivateHeader0Cell();
  const h1 = finalPrivateHeader1Cell();
  const body = finalPrivateBodyCell(1n);
  return beginCell()
    .storeUint(1n, 8).storeUint(2n, 8) // size_class=1K, suite=hybrid
    .storeUint(cellHash(h0), 256).storeUint(cellHash(h1), 256).storeUint(0n, 256) // body_hash = 0
    .storeRef(h0).storeRef(h1).storeRef(body)
    .endCell();
}

// Builds a PublishBatchToHub message struct. publishId must be non-zero (13501); we derive a deterministic
// non-zero id per step. protocolFeeTotal is what the Hub accrues. marketing marker is required for public.
function batchMsg(opts: {
  kind: bigint;
  step: number;
  parts: Cell;
  authorWallet: Address;
  protocolFeeTotal: bigint;
}) {
  return {
    $$type: 'PublishBatchToHub',
    bounce_id: BigInt(10_000 + opts.step),
    bounce_tag: BigInt(30_000 + opts.step),
    publish_id: hash256(`batch-${opts.kind}-${opts.step}`),
    publish_kind: opts.kind,
    part_count: 1n,
    protocol_fee_total: opts.protocolFeeTotal,
    author_wallet: opts.authorWallet,
    parts: opts.parts,
    marketing: opts.kind === KIND_PUBLIC ? marketingCell() : null,
  } as any;
}

// Counts CapsuleHubBatchAck messages emitted to `dest` in a send result (the bound Vault is a treasury, so we
// observe the ACK directly off the wire rather than via a mock sink). A successful 1-part batch emits exactly one.
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
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const operator = await blockchain.treasury('capsule-inv-operator');
  const attacker = await blockchain.treasury('capsule-inv-attacker');
  const author = await blockchain.treasury('capsule-inv-author');
  // The bound Vault is a plain treasury (the only sender the Hub accepts) — it receives the CapsuleHubBatchAck.
  const boundVault = await blockchain.treasury('capsule-inv-bound-vault');

  // The configured fee accumulator address is intentionally a never-deployed fixture, so a FlushFees either
  // reverts at the protected-reserve gate (13206) or its DepositProtocolFee bounces back and the bounced
  // handler restores accrued — both leave accrued unchanged (matching the original model).
  const feeAccumulator = fixtureAddress('MISSING_FEE_ACCUMULATOR');

  const init = await CapsuleHub.init(
    feeAccumulator,
    boundVault.address, // vault_address (bound)
    true,               // vault_bound
    true,               // sealed
    MANIFEST_HASH,
    fixtureAddress('GENESIS_CONTROLLER'),
  );
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  const capsule = blockchain.openContract(new CapsuleHub(address, init));
  return { blockchain, capsule, boundVault, attacker, operator, author };
}

describe('CapsuleHub state-machine invariants (VPB2 batch)', () => {
  it('CAPSULE-INV-01: deterministic Vault batch-publish and flush walks preserve counters and accrued fees', async () => {
    for (const seed of [0xcab50001, 0xcab50002, 0xcab50003]) {
      const { blockchain, capsule, boundVault, attacker, operator, author } = await setup();
      const rng = makeRng(seed);
      let privateLatest = 0n;
      let publicLatest = 0n;
      let privatePages = 0n;
      let publicPages = 0n;
      let accrued = 0n;
      let ackCount = 0n;
      let debugContext = `seed ${seed} initial`;

      async function assertModel() {
        const state = await capsule.getGetState();
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
          debugContext = `seed ${seed} step ${step} batch-private underfunded=${underfunded}`;
          const res = await capsule.send(
            boundVault.getSender(),
            { value: underfunded ? UNDERFUNDED_VALUE : FUNDED_VALUE },
            batchMsg({ kind: KIND_PRIVATE, step, parts: privateParts(), authorWallet: author.address, protocolFeeTotal: PRIVATE_FEE }),
          );
          if (!underfunded) {
            notePrivateSuccess(PRIVATE_FEE);
            ackCount += BigInt(countBatchAcks(res, boundVault.address));
          } else {
            expect(countBatchAcks(res, boundVault.address), `${debugContext}: no ack on underfunded`).toBe(0);
          }
        } else if (op === 1) {
          const underfunded = (rng() % 5) === 0;
          debugContext = `seed ${seed} step ${step} batch-public underfunded=${underfunded}`;
          const res = await capsule.send(
            boundVault.getSender(),
            { value: underfunded ? UNDERFUNDED_VALUE : FUNDED_VALUE },
            batchMsg({ kind: KIND_PUBLIC, step, parts: publicParts(), authorWallet: author.address, protocolFeeTotal: PUBLIC_FEE }),
          );
          if (!underfunded) {
            notePublicSuccess(PUBLIC_FEE);
            ackCount += BigInt(countBatchAcks(res, boundVault.address));
          } else {
            expect(countBatchAcks(res, boundVault.address), `${debugContext}: no ack on underfunded`).toBe(0);
          }
        } else if (op === 2) {
          debugContext = `seed ${seed} step ${step} forged-vault (non-Vault sender)`;
          const res = await capsule.send(
            attacker.getSender(),
            { value: FUNDED_VALUE },
            batchMsg({ kind: KIND_PRIVATE, step, parts: privateParts(), authorWallet: author.address, protocolFeeTotal: PRIVATE_FEE }),
          );
          // Non-Vault sender is rejected (13500); nothing is stored and no ACK is emitted to the bound Vault.
          expect(countBatchAcks(res, boundVault.address), `${debugContext}: no ack on forged sender`).toBe(0);
        } else if (op === 3) {
          debugContext = `seed ${seed} step ${step} invalid-private (body_hash=0)`;
          // A valid-shaped private part with its body_hash field zeroed -> trips bh!=0 (13512); whole batch aborts.
          const res = await capsule.send(
            boundVault.getSender(),
            { value: FUNDED_VALUE },
            batchMsg({ kind: KIND_PRIVATE, step, parts: privatePartZeroBodyHash(), authorWallet: author.address, protocolFeeTotal: PRIVATE_FEE }),
          );
          expect(countBatchAcks(res, boundVault.address), `${debugContext}: no ack on invalid part`).toBe(0);
        } else {
          const amount = accrued > 0n ? (accrued > PUBLIC_FEE ? PUBLIC_FEE : accrued) : PUBLIC_FEE;
          debugContext = `seed ${seed} step ${step} flush amount=${amount}`;
          await capsule.send(operator.getSender(), { value: ACK_RESERVE + FLUSH_LOCAL_EXEC_RESERVE }, {
            $$type: 'FlushFees',
            amount,
          } as FlushFees);
          // The configured accumulator address is intentionally missing and the 100 TON protected-reserve floor
          // is unmet at 1 TON balance, so the flush reverts (or bounces) and accrued is restored — unchanged.
        }
        await assertModel();
      }

      // Cross-check: every successful batch produced exactly one CapsuleHubBatchAck to the bound Vault.
      expect(ackCount, `${debugContext}: ack_count == successful batches`).toBe(privateLatest + publicLatest);
    }
  }, 30000);
});
