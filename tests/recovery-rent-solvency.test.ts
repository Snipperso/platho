import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, Cell, Address } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// RECOVERY RENT SOLVENCY — the endowment measured against the rent the chain ACTUALLY charges.
//
// RS_RECOVERY_ENDOWMENT is the only money this lane ever keeps: unlike its two siblings it has no separate base
// endowment, and it must carry a worst-case account for the full 3-year retention. If it falls short the slot
// freezes and the recovery blob is lost — at the one moment it is needed, which is the failure the whole lane
// exists to prevent.
//
// WHY THIS FILE EXISTS RATHER THAN A COMMENT WITH ARITHMETIC. The constant was derived by counting a MODEL of the
// account — "79 blob + 17 code + 2 data = 98 cells" — and that model omits the StateInit wrapper cell, so it
// understates the account by one cell and overstates the margin. The error is invisible to every other test,
// because nothing else reads the storage phase. Both sibling lanes had their endowment raised pre-seal for the
// same class of mistake (RecordShard at 1.026x, IntroShard at 1.21x), and both were caught by measuring rather
// than recomputing.
//
// THE CLOCK IS THE MEASUREMENT. TON's config-18 is a SCHEDULE, not a constant: before April 2026 a cell costs
// 486975/year and after it 64962. A sandbox left at its 2023 default therefore reports rent 7.5x too high and has
// already produced one false under-funding conclusion in this project. Every test here pins bc.now into the
// frozen-rate era.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;          // inside the 64962/cell/year era
const THREE_YEARS = 94_608_000;       // RS_RECOVERY_RETENTION
const ENDOWMENT = 29_000_000n;        // RS_RECOVERY_ENDOWMENT
const MIN_VALUE = 37_000_000n;        // RS_RECOVERY_ENDOWMENT + RS_RECOVERY_PATH_GAS
const MAX_BLOB_CELLS = 79;
const SLOT_DOMAIN = 0x52534C4Bn;
const RECOVERY_DOMAIN = 0x42525331n;
const G8_MARGIN = 1.5;                // the project rule: an endowment carries 1.5x its worst-case rent

const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));
const slotKeyForOwner = (ownerPub: bigint, slotIndex: number): bigint =>
  bufToInt(beginCell().storeUint(SLOT_DOMAIN, 32).storeUint(ownerPub, 256)
    .storeUint(slotIndex, 32).endCell().hash());

/** A blob of exactly `cells` cells — the worst case the cap admits, which is what the endowment must carry. */
function blobOf(cells: number): Cell {
  let c = beginCell().storeUint(0xAB, 8).endCell();
  for (let i = 1; i < cells; i += 1) c = beginCell().storeUint(i, 16).storeRef(c).endCell();
  return c;
}

function storeMsg(owner: any, shard: Address, selfBucket: bigint, slotIndex: bigint, seq: bigint, body: Cell) {
  const h0 = 0x111n, h1 = 0x222n, bh = bufToInt(body.hash());
  const digest = beginCell()
    .storeUint(RECOVERY_DOMAIN, 32).storeAddress(shard).storeUint(selfBucket, 256).storeUint(seq, 64)
    .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
    .endCell().hash();
  return {
    $$type: 'RecoveryStore' as const,
    owner_pubkey: bufToInt(owner.publicKey), slot_index: slotIndex, seq, h0, h1, bh, body,
    owner_sig: beginCell().storeBuffer(sign(digest, owner.secretKey)).endCell(),
  };
}

describe('RECOVERY RENT SOLVENCY — measured against the storage phase, not a cell model', () => {
  it('RENT-01: the endowment carries a worst-case slot for the full 3-year retention at the project 1.5x margin', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x41));
    const selfBucket = slotKeyForOwner(bufToInt(owner.publicKey), 0);
    const init = await RecoveryShard.init(selfBucket);
    const rs = bc.openContract(new RecoveryShard(await RecoveryShard.fromInit(selfBucket).then((c) => c.address), init));

    // Deploy BY the publish, with no pre-funding. Pre-funding a shard before measuring is how the first pass at
    // this got inflated numbers: nativeReserve uses ReserveAddOriginalBalance, so any float sitting on the account
    // is kept ON TOP of the endowment and every balance afterwards reads high.
    const payer = await bc.treasury('rent-payer');
    const blob = blobOf(MAX_BLOB_CELLS);
    const bind = await rs.send(payer.getSender(), { value: MIN_VALUE },
      storeMsg(owner, rs.address, selfBucket, 0n, 1n, blob) as any);
    expect(bind.transactions.some((t: any) => t.description?.computePhase?.exitCode === 0)).toBe(true);

    const held = (await bc.getContract(rs.address)).balance;
    expect(held, 'the slot keeps exactly the endowment and returns the change').toBe(ENDOWMENT);

    // THE MEASUREMENT. Advance exactly the retention window and let the chain charge what it charges — the storage
    // phase of the next transaction reports the real figure, including whatever the cell model missed.
    bc.now = CLOCK + THREE_YEARS;
    const poke = await payer.send({ to: rs.address, value: toNano('1'), bounce: false } as any);
    const tx: any = poke.transactions.find(
      (t: any) => t.inMessage?.info?.dest?.toString() === rs.address.toString());
    const rent3yr = BigInt(tx.description.storagePhase.storageFeesCollected);

    const margin = Number(ENDOWMENT) / Number(rent3yr);
    // eslint-disable-next-line no-console
    console.log(`[RENT-01] 3-year rent measured: ${rent3yr}  endowment: ${ENDOWMENT}  margin: ${margin.toFixed(4)}x`);

    expect(rent3yr, 'the slot must not already be insolvent at the retention horizon').toBeLessThan(ENDOWMENT);
    // The rule the two sibling lanes were both raised to satisfy. If this fails the endowment is short and the
    // constant must move — pre-seal is the only time that is possible.
    expect(margin, `endowment ${ENDOWMENT} delivers ${margin.toFixed(4)}x, below the project ${G8_MARGIN}x rule`)
      .toBeGreaterThanOrEqual(G8_MARGIN);
  }, 180_000);

  it('RENT-02: the blob cap is what the endowment is calibrated for — one cell over is refused, not absorbed', async () => {
    // The cap and the endowment are one decision in two constants. If the cap could be exceeded the slot would buy
    // storage it never funded, which is the same insolvency from the other direction.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x42));
    const selfBucket = slotKeyForOwner(bufToInt(owner.publicKey), 0);
    const init = await RecoveryShard.init(selfBucket);
    const rs = bc.openContract(new RecoveryShard(await RecoveryShard.fromInit(selfBucket).then((c) => c.address), init));
    const payer = await bc.treasury('rent-payer2');

    const over = await rs.send(payer.getSender(), { value: MIN_VALUE, bounce: true },
      storeMsg(owner, rs.address, selfBucket, 0n, 1n, blobOf(MAX_BLOB_CELLS + 1)) as any);
    const overTx: any = over.transactions.find(
      (t: any) => t.inMessage?.info?.dest?.toString() === rs.address.toString());
    expect(Number(overTx?.description?.computePhase?.exitCode), 'one cell over the cap -> 13560').toBe(13560);
    expect((await bc.getContract(rs.address)).balance, 'and nothing was kept').toBe(0n);
  }, 180_000);
});
