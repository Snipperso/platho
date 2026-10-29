import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, Cell, Address } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';


const CLOCK = 1_790_000_000;
const THREE_YEARS = 94_608_000;
const ENDOWMENT = 30_400_000n;
const MIN_VALUE = 38_400_000n;
const MAX_BLOB_CELLS = 79;
const SLOT_DOMAIN = 0x52534C4Bn;
const RECOVERY_DOMAIN = 0x42525331n;
const G8_MARGIN = 1.5;

const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));
const slotKeyForOwner = (ownerPub: bigint, slotIndex: number): bigint =>
  bufToInt(beginCell().storeUint(SLOT_DOMAIN, 32).storeUint(ownerPub, 256)
    .storeUint(slotIndex, 32).endCell().hash());

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

    const payer = await bc.treasury('rent-payer');
    const blob = blobOf(MAX_BLOB_CELLS);
    const bind = await rs.send(payer.getSender(), { value: MIN_VALUE },
      storeMsg(owner, rs.address, selfBucket, 0n, 1n, blob) as any);
    expect(bind.transactions.some((t: any) => t.description?.computePhase?.exitCode === 0)).toBe(true);

    const held = (await bc.getContract(rs.address)).balance;
    expect(held, 'the slot keeps exactly the endowment and returns the change').toBe(ENDOWMENT);

    bc.now = CLOCK + THREE_YEARS;
    const poke = await payer.send({ to: rs.address, value: toNano('1'), bounce: false } as any);
    const tx: any = poke.transactions.find(
      (t: any) => t.inMessage?.info?.dest?.toString() === rs.address.toString());
    const rent3yr = BigInt(tx.description.storagePhase.storageFeesCollected);

    const margin = Number(ENDOWMENT) / Number(rent3yr);
    // eslint-disable-next-line no-console
    console.log(`[RENT-01] 3-year rent measured: ${rent3yr}  endowment: ${ENDOWMENT}  margin: ${margin.toFixed(4)}x`);

    expect(rent3yr, 'the slot must not already be insolvent at the retention horizon').toBeLessThan(ENDOWMENT);
    expect(margin, `endowment ${ENDOWMENT} delivers ${margin.toFixed(4)}x, below the project ${G8_MARGIN}x rule`)
      .toBeGreaterThanOrEqual(G8_MARGIN);
  }, 180_000);

  it('RENT-03: does a RecoveryStore refresh top the endowment up, or only move the deadline?', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x43));
    const selfBucket = slotKeyForOwner(bufToInt(owner.publicKey), 0);
    const init = await RecoveryShard.init(selfBucket);
    const rs = bc.openContract(new RecoveryShard(await RecoveryShard.fromInit(selfBucket).then((c) => c.address), init));
    const payer = await bc.treasury('rent-refresh-payer');
    const blob = blobOf(MAX_BLOB_CELLS);

    await rs.send(payer.getSender(), { value: MIN_VALUE }, storeMsg(owner, rs.address, selfBucket, 0n, 1n, blob) as any);
    const afterBind = (await bc.getContract(rs.address)).balance;
    expect(afterBind, 'first bind keeps exactly the endowment').toBe(ENDOWMENT);

    const trail: string[] = [];
    let seq = 2n;
    let frozenAtYear: number | null = null;
    for (let year = 1; year <= 8; year += 1) {
      bc.now = CLOCK + year * 31_536_000;
      await rs.send(payer.getSender(), { value: MIN_VALUE }, storeMsg(owner, rs.address, selfBucket, 0n, seq, blob) as any);
      seq += 1n;
      const bal = (await bc.getContract(rs.address)).balance;
      trail.push(`y${year}=${bal}`);
      if (bal <= 0n && frozenAtYear === null) frozenAtYear = year;
    }
    // eslint-disable-next-line no-console
    console.log(`[RENT-03] afterBind=${afterBind} | ${trail.join(' ')} | frozenAtYear=${frozenAtYear ?? 'not within 8y'}`);

    for (let i = 0; i < trail.length; i += 1) {
      const bal = BigInt(trail[i].split('=')[1]);
      expect(bal, `refresh in year ${i + 1} must keep the slot solvent (balance stays at the endowment)`).toBe(ENDOWMENT);
    }
    expect(frozenAtYear, 'a diligently-refreshed slot must never freeze').toBeNull();
  }, 300_000);

  it('RENT-02: the blob cap is what the endowment is calibrated for — one cell over is refused, not absorbed', async () => {
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
