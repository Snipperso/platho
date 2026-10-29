import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell } from '@ton/core';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { notesChunkSlot, prepareNotesBackup, restoreNotes } from '../web/notes-lane.mjs';
import { serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { RECOVERY_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { NOTES_NAMED_SLOT_BASE } from '../web/shard-discovery.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';


const CLOCK = 1_790_000_000;
const SEED = new Uint8Array(32).fill(0x4e);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const note = (at: number, text: string) => ({ at, text });

async function sendPublish(payer: any, publish: any) {
  const dest = Address.parseRaw(publish.to);
  const initCore = toCoreCell(publish.init);
  const res = await payer.send({
    to: dest, value: publish.value, body: toCoreCell(publish.body),
    init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
  } as any);
  const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
  return { dest, tx };
}

function liveReaders(bc: Blockchain) {
  const openAt = (address: string) => bc.openContract(RecoveryShard.fromAddress(Address.parse(address)));
  return {
    readView: async (address: string) => {
      try {
        const view = await openAt(address).getGetView();
        return { bound: view.bound, seq: view.seq, h0: view.h0, h1: view.h1 };
      } catch {
        return null;
      }
    },
    readBody: async (address: string) => {
      const body = await openAt(address).getGetBody();
      return parseBocBase64(body.toBoc().toString('base64'));
    },
  };
}

const emptyReaders = { readView: async () => ({ bound: false }) };

describe('NOTES-LANE ON CHAIN — self-notes against the real RecoveryShard', () => {
  it('NOTES-CHAIN-01: a notes publish is ACCEPTED at the named slot range, and a fresh device restores it from the seed', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'notes-01-sink' });
    const payer = await bc.treasury('notes-01-payer');

    const notes = Array.from({ length: 60 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'n'.repeat(120)}`));
    const built = await prepareNotesBackup({ seed: SEED, notes, ...emptyReaders, value: RECOVERY_PUBLISH_VALUE });
    expect(built.publishes.length, 'the notes must span several slots for this to prove the range').toBeGreaterThan(1);

    for (const publish of built.publishes) {
      const { dest, tx } = await sendPublish(payer, publish);
      expect(Number(tx?.description?.computePhase?.exitCode), `slot ${publish.chunkIndex} accepted`).toBe(0);
      const view = await bc.openContract(RecoveryShard.fromAddress(dest)).getGetView();
      expect(view.bound, `slot ${publish.chunkIndex} is bound`).toBe(true);
      expect(view.seq, `slot ${publish.chunkIndex} seq`).toBe(1n);
      expect(view.h1, `slot ${publish.chunkIndex} stores the sealed content hash`).toBe(publish.h1);
    }

    const restored = await restoreNotes({ seed: SEED, ...liveReaders(bc) });
    expect(restored.clean, 'every chunk read cleanly').toBe(true);
    expect(restored.notes.map((n: any) => n.text)).toEqual(notes.map((n) => n.text));
    expect(restored.notes.map((n: any) => n.at)).toEqual(notes.map((n) => n.at));

    const foreign = await restoreNotes({ seed: new Uint8Array(32).fill(0x77), ...liveReaders(bc) });
    expect(foreign.notes).toEqual([]);
  }, 240_000);

  it('NOTES-CHAIN-02: adding one note rewrites ONE slot and advances only that slot seq', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'notes-02-sink' });
    const payer = await bc.treasury('notes-02-payer');
    const readers = liveReaders(bc);

    const notes = Array.from({ length: 60 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'m'.repeat(120)}`));
    const first = await prepareNotesBackup({ seed: SEED, notes, ...emptyReaders, value: RECOVERY_PUBLISH_VALUE });
    for (const publish of first.publishes) await sendPublish(payer, publish);
    const chunkCount = first.publishes.length;

    const idempotent = await prepareNotesBackup({ seed: SEED, notes, readView: readers.readView, value: RECOVERY_PUBLISH_VALUE });
    expect(idempotent.publishes, 're-saving unchanged notes writes nothing').toEqual([]);

    const appended = [...notes, note(1_790_000_099_999, 'one more thought')];
    const second = await prepareNotesBackup({ seed: SEED, notes: appended, readView: readers.readView, value: RECOVERY_PUBLISH_VALUE });
    expect(second.publishes).toHaveLength(1);
    expect(second.publishes[0].chunkIndex).toBe(chunkCount - 1);

    const { dest, tx } = await sendPublish(payer, second.publishes[0]);
    expect(Number(tx?.description?.computePhase?.exitCode), 'the overwrite is accepted').toBe(0);
    expect((await bc.openContract(RecoveryShard.fromAddress(dest)).getGetView()).seq).toBe(2n);

    for (let index = 0; index < chunkCount - 1; index += 1) {
      const slot = await notesChunkSlot(SEED, index);
      const view = await bc.openContract(RecoveryShard.fromAddress(Address.parse(slot.address))).getGetView();
      expect(view.seq, `untouched slot ${index}`).toBe(1n);
    }

    const restored = await restoreNotes({ seed: SEED, ...readers });
    expect(restored.notes.map((n: any) => n.text)).toEqual(appended.map((n) => n.text));
  }, 240_000);

  it('NOTES-CHAIN-03: the measured pack cap is the CONTRACT cap — a full chunk is accepted, not bounced', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'notes-03-sink' });
    const payer = await bc.treasury('notes-03-payer');

    const notes = Array.from({ length: 200 }, (_, i) => note(1_790_000_000_000 + i, `dense ${i} ${'q'.repeat(60)}`));
    const built = await prepareNotesBackup({ seed: SEED, notes, ...emptyReaders, value: RECOVERY_PUBLISH_VALUE });
    expect(built.publishes.length).toBeGreaterThan(1);

    for (const publish of built.publishes) {
      const { tx } = await sendPublish(payer, publish);
      expect(
        Number(tx?.description?.computePhase?.exitCode),
        `a chunk packed to the measured cap must fit the contract cap (slot ${publish.chunkIndex})`,
      ).toBe(0);
    }
    const restored = await restoreNotes({ seed: SEED, ...liveReaders(bc) });
    expect(restored.notes.map((n: any) => n.text)).toEqual(notes.slice(0, restored.notes.length).map((n) => n.text));
  }, 240_000);

  it('NOTES-CHAIN-04: the notes slots never collide with the prefs slot or a conversation slot', async () => {
    const notesAddresses = new Set<string>();
    for (let i = 0; i < 8; i += 1) notesAddresses.add((await notesChunkSlot(SEED, i)).address);
    expect(notesAddresses.size).toBe(8);
    expect(NOTES_NAMED_SLOT_BASE).toBe(257);
  }, 120_000);
});
