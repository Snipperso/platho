import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, toNano, Cell } from '@ton/core';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { buildRecoveryPublishBrowser } from '../web/recovery-publish-browser.mjs';
import { sealRecoveryBlob, openRecoveryBlob } from '../web/recovery-blob.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { decodeRecoveryViewStack, decodeRecoveryBodyStack } from '../web/recovery-transport.mjs';
import { serializeBoc, computeCellHashAndDepth } from '../web/pwa-contract-transactions.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// RECOVERY-TRANSPORT — the restore-path decoders, driven against a REAL RecoveryShard getter stack from the compiled
// contract (not a hand-written fixture — a stale index would shift every value and be caught here, not silently in
// production). get_view feeds the anti-rollback seq + the self-verifying bh; get_body feeds the sealed blob to open.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const SEED = new Uint8Array(32).fill(0x9c);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/** Shape a sandbox getter stack the way toncenter hands it over, so the production decoder sees what it will see. */
const wireStack = (stack: any[]) => (stack as any[]).map((item: any) =>
  item.type === 'cell' || item.type === 'slice'
    ? { type: 'cell', value: item.cell.toBoc().toString('base64') }
    : { type: 'int', value: String(item.value) });

describe('RECOVERY-TRANSPORT', () => {
  it('RT-01: the get_view + get_body decoders decode a REAL RecoveryShard getter stack, self-verifying via bh', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'rt-01-sink' });
    const payer = await bc.treasury('rt-01-payer');

    const A = new Uint8Array(32).fill(0x11);
    const B = new Uint8Array(32).fill(0x22);
    const kRootAB = new Uint8Array(32).fill(0x5a);
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(A, B, { kRoot: kRootAB, createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: 'w-A' });
    const map = store.snapshot();
    const convId = [...map.keys()][0];

    const { body, h0, h1 } = await sealRecoveryBlob(SEED, map);
    const built = await buildRecoveryPublishBrowser({ seed: SEED, slotIndex: 4, seq: 1, h0, h1, body, value: toNano('0.05') });
    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    await payer.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const shard = bc.openContract(RecoveryShard.fromAddress(dest));

    // get_view: real getter stack → wire shape → production decoder → compared field-for-field to the wrapper.
    const rawView: any = await bc.runGetMethod(dest, 'get_view', [] as any);
    expect(rawView.exitCode, 'the getter itself succeeds').toBe(0);
    const wireView = wireStack(rawView.stack);
    expect(wireView.length, 'RecoveryShardView is 12 stack items — pin it so a struct change is loud here').toBe(12);
    const view = decodeRecoveryViewStack(wireView);
    const ref = await shard.getGetView();
    expect(view.bound).toBe(true);
    expect(view.seq, 'seq (the anti-rollback floor a backup reads)').toBe(ref.seq);
    expect(view.self_bucket_key).toBe(ref.self_bucket_key);
    expect(view.owner_pubkey).toBe(ref.owner_pubkey);
    expect(view.h0).toBe(h0);
    expect(view.h1).toBe(h1);
    expect(view.bh).toBe(ref.bh);
    expect(view.max_slots, 'clients probe [0, max_slots) on restore').toBe(Number(ref.max_slots));

    // get_body: real getter stack → wire → decoder → open. bh self-check: the decoded body IS what the slot committed to.
    const rawBody: any = await bc.runGetMethod(dest, 'get_body', [] as any);
    expect(rawBody.exitCode).toBe(0);
    const decodedBody = decodeRecoveryBodyStack(wireStack(rawBody.stack));
    expect(decodedBody, 'the blob cell decodes').toBeTruthy();
    const bodyHash = BigInt('0x' + Buffer.from((await computeCellHashAndDepth(decodedBody)).hash).toString('hex'));
    expect(bodyHash, 'decoded body hash == view.bh (self-verifying read)').toBe(view.bh);

    const restored = await openRecoveryBlob(SEED, decodedBody);
    expect(hex(restored.get(convId)!.kRootCurrent), 'the restored K_root is the one that was backed up').toBe(hex(kRootAB));
  }, 240_000);
});
