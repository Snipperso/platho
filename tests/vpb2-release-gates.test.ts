import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { beginCell, external, toNano } from '@ton/core';
import {
  KIND_PRIVATE,
  ACT_PUBLISH_BATCH,
  RJ_PART_SHAPE,
  privatePart,
  partsList,
  batchExternalBody,
  setupVault,
  registerHybrid,
  depositTon,
} from './helpers/vpb2';

// VPB2 release gates — the two mainnet-blocking economic/gas invariants that the calibration rests on, asserted
// DYNAMICALLY in the sandbox (the static FunC envelope is m16-CONF-01B4; this is the runtime confirmation).
//
//   G1  the batch external's worst-case PRE-ACCEPT work fits inside TON's 10,000-gas pre-accept credit. If it
//       didn't, the external would OOG (exit -14) BEFORE acceptMessage and could not even reject-with-refund.
//   G2  the PINNED reject floor (batchChargeFloor = BASE + PER_PART*n, used because computing the floor at runtime
//       would itself blow the pre-accept credit) is >= what the Vault actually spends, AND <= max_charge, so on
//       every reject the refund is >= 0 (user not overcharged) and the Vault recovers its cost (no drain).
//
// Constants are READ FROM THE CONTRACT SOURCE so the gate tracks the pins instead of restating them.

const VAULT_SRC = readFileSync('contracts/Vault.tact', 'utf8');
function srcIntConst(name: string): bigint {
  const m = VAULT_SRC.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*(\\d+)`));
  if (!m) throw new Error(`could not read const ${name} from contracts/Vault.tact`);
  return BigInt(m[1]);
}
const BATCH_FLOOR_BASE_PIN = srcIntConst('BATCH_FLOOR_BASE_PIN');
const BATCH_FLOOR_PER_PART_PIN = srcIntConst('BATCH_FLOOR_PER_PART_PIN');
const MAX_BATCH_PARTS = Number(srcIntConst('MAX_BATCH_PARTS'));
const PRE_ACCEPT_CREDIT = 10_000; // TON basechain external pre-accept gas credit

const pinnedFloor = (parts: number): bigint => BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN * BigInt(parts);

// A batch external whose nonce/signature/floor all PASS but whose ledger balance fails (16463) — i.e. it walks the
// entire pre-accept path right up to the last gate before acceptMessage. The reject throws (no acceptMessage), so
// the gas the VM reports under `credit=10000` IS the worst-case pre-accept gas.
async function preAcceptGas(parts: number): Promise<{ exitCode: number; gasUsed: number }> {
  const { blockchain, vault, user } = await setupVault();
  await registerHybrid(vault, user);
  await depositTon(vault, user, 30_000_000n); // tiny ledger -> balance gate (16463) fails last, after sig+nonce+floor
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const maxCharge = pinnedFloor(parts) + toNano('1'); // clears the floor; far above the tiny ledger
  const body = batchExternalBody({
    vaultAddr: vault.address, owner: user.address, nonce, maxCharge,
    partCount: BigInt(parts), partsRoot: partsList(KIND_PRIVATE, parts),
  });
  try {
    await blockchain.sendMessage(external({ to: vault.address, body }));
    return { exitCode: 0, gasUsed: -1 };
  } catch (e: any) {
    const logs = `${e.vmLogs ?? ''}\n${e.blockchainLogs ?? ''}`;
    const m = logs.match(/gas:\s*used=(\d+)[^\n]*credit=10000/);
    return { exitCode: Number(e.exitCode), gasUsed: m ? Number(m[1]) : NaN };
  }
}

// A 1..n part batch whose LAST part is malformed (wrong bit width): the post-accept walk validates the first n-1
// real parts, then rejects part n-1 with RJ_PART_SHAPE — exercising the full per-part walk cost for n-1 parts.
function batchTrailingBadPart(parts: number) {
  let tail = beginCell().storeUint(0, 100).endCell(); // bad last part (not 784 bits) -> RJ_PART_SHAPE
  for (let i = parts - 2; i >= 0; i -= 1) tail = privatePart({ fillBase: i % 90, next: tail });
  return tail;
}

async function rejectTx(parts: number) {
  const { blockchain, vault, user } = await setupVault({ balance: toNano('400') });
  await registerHybrid(vault, user);
  await depositTon(vault, user, toNano('300')); // funds the floor + walk for up to MAX_BATCH_PARTS
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const balBefore = (await vault.getGetUser(user.address)).ton_balance;
  const maxCharge = pinnedFloor(parts) + toNano('10');
  const body = batchExternalBody({
    vaultAddr: vault.address, owner: user.address, nonce, maxCharge,
    partCount: BigInt(parts), partsRoot: batchTrailingBadPart(parts),
  });
  const res = await blockchain.sendMessage(external({ to: vault.address, body }));
  const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString());
  const charged = balBefore - (await vault.getGetUser(user.address)).ton_balance;
  const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
  return { tx, charged, gasFees: BigInt(tx.description.computePhase.gasFees), slot, maxCharge };
}

describe('VPB2 release gate G1: pre-accept fits the 10k credit', () => {
  it('G1-PREACCEPT-01: worst-case pre-accept (max parts, valid sig, balance-fail) stays under the 10k credit, not OOG', async () => {
    const worst = await preAcceptGas(MAX_BATCH_PARTS);
    // eslint-disable-next-line no-console
    console.log(`G1 pre-accept gas @ ${MAX_BATCH_PARTS} parts = ${worst.gasUsed} / ${PRE_ACCEPT_CREDIT} credit (exit ${worst.exitCode})`);
    expect(worst.exitCode).toBe(16463);              // reached the LAST pre-accept gate -> did NOT OOG (-14)
    expect(worst.gasUsed).toBeGreaterThan(0);        // parsed a real number
    expect(worst.gasUsed).toBeLessThanOrEqual(PRE_ACCEPT_CREDIT);
  });

  it('G1-PREACCEPT-02: a 1-part external is also within credit (pre-accept gas is part-count-stable)', async () => {
    const one = await preAcceptGas(1);
    expect(one.exitCode).toBe(16463);
    expect(one.gasUsed).toBeLessThanOrEqual(PRE_ACCEPT_CREDIT);
    // pre-accept skips the parts subtree (the walk is post-accept), so 1 vs MAX parts must barely differ
    const worst = await preAcceptGas(MAX_BATCH_PARTS);
    expect(Math.abs(worst.gasUsed - one.gasUsed)).toBeLessThan(500);
  });
});

describe('VPB2 release gate G2: pinned reject floor is solvent', () => {
  it('G2-FLOOR-01: a post-accept reject charges EXACTLY batchChargeFloor(n) and refunds the rest (refund >= 0)', async () => {
    for (let n = 1; n <= MAX_BATCH_PARTS; n += 1) {
      const r = await rejectTx(n);
      expect(r.slot!.action).toBe(ACT_PUBLISH_BATCH);
      expect(r.slot!.result).toBe(RJ_PART_SHAPE);
      expect(r.charged).toBe(pinnedFloor(n));        // runtime reject_fee == the pinned floor for n parts
      expect(r.charged).toBeLessThanOrEqual(r.maxCharge); // refund = maxCharge - floor >= 0
    }
  });

  it('G2-FLOOR-02: the pinned floor exceeds the Vault\'s ACTUAL reject compute cost (no drain on reject)', async () => {
    for (const n of [1, MAX_BATCH_PARTS]) {
      const r = await rejectTx(n);
      // The user is charged the pinned floor; the Vault's real cost to process the reject is its compute gas fee
      // (the sandbox sets the external import fee to 0). The floor must dominate it with a wide margin.
      expect(r.charged).toBeGreaterThan(r.gasFees);
      // eslint-disable-next-line no-console
      console.log(`G2 reject @ ${n} parts: charged floor ${r.charged} >> reject gasFees ${r.gasFees}`);
    }
  });

  it('G2-FLOOR-03: BATCH_FLOOR_PER_PART_PIN covers the measured per-part walk cost', async () => {
    // Reject after walking the full part list (last part bad): the cost grows ~linearly in the parts walked.
    const g1 = (await rejectTx(1)).gasFees;
    const gN = (await rejectTx(MAX_BATCH_PARTS)).gasFees;
    const perPartActual = (gN - g1) / BigInt(MAX_BATCH_PARTS - 1);
    // eslint-disable-next-line no-console
    console.log(`G2 per-part walk gasFees ~ ${perPartActual} vs pin ${BATCH_FLOOR_PER_PART_PIN}`);
    expect(perPartActual).toBeLessThanOrEqual(BATCH_FLOOR_PER_PART_PIN);
  });
});
