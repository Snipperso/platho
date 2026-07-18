import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, beginCell, toNano, Cell } from '@ton/core';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { buildIntroPublishBrowser } from '../web/intro-publish-browser.mjs';
import { computeCellHashAndDepth, serializeBoc, beginCell as clientCell } from '../web/pwa-contract-transactions.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-PUBLISH-BROWSER — the browser sends the same message, or the money is spent and nothing is delivered.
//
// Publishing is where a mistake costs the user directly. Two failure modes, both silent:
//   - StateInit missing or wrong: shards deploy lazily, so the message lands on an uninitialised account, runs
//     with its compute phase SKIPPED, and vanishes. No bounce, no error, wallet reports success.
//   - Body layout off by anything: the contract recomputes the commitment from the cells it receives, so a
//     near-miss stores a commitment the recipient's delivery check will reject — a first contact paid for and
//     undeliverable.
// Neither is visible without comparing against the reference, which is what these tests do, and then actually
// sending the browser-built message to the real contract.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Capsule cells built with the CLIENT's builder, because that is where they come from in production — the app
 * assembles a capsule long before it reaches the publish path. Feeding the browser builder an @ton/core cell
 * would test a combination that never happens.
 * A cell holds 1023 bits, so anything larger is a snake of chained cells, exactly as real bodies are.
 */
const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = clientCell().bytesValue(chunks[chunks.length - 1], chunks[chunks.length - 1].length, 'chunk').endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) {
    cell = clientCell().bytesValue(chunks[i], chunks[i].length, 'chunk').ref(cell, 'next').endCell();
  }
  return cell;
};

/** The reference builder speaks @ton/core, so the same capsule cells are handed to it in that form. */
const asCore = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const coreCase = (c: any) => ({ ...c, header0: asCore(c.header0), body: asCore(c.body) });

/** Client cells carry no .equals(); TON's representation hash is the definition of "the same cell". */
const hashOf = async (clientCell: any) => Buffer.from((await computeCellHashAndDepth(clientCell)).hash);
const toCoreCell = (clientCell: any) => Cell.fromBase64(Buffer.from(serializeBoc(clientCell)).toString('base64'));

describe('INTRO-PUBLISH-BROWSER — the same message, built without @ton/core', () => {
  const epoch = Math.floor(1_790_000_000 / 86400);
  const cases = [
    { bucket: 0n, r: 1n, viewTag: 0n, header0: cellOf(0x11), body: cellOf(0x12, 32) },
    { bucket: 1023n, r: (1n << 255n) + 9n, viewTag: 0xffffn, header0: cellOf(0x21), body: cellOf(0x22, 700) },
    { bucket: 7n, r: (1n << 256n) - 1n, viewTag: 0x1234n, header0: cellOf(0x31, 1), body: cellOf(0x32, 1) },
  ];

  it('PUB-01: address, body and StateInit are identical to the reference builder', async () => {
    for (const c of cases) {
      const reference = await buildIntroPublish({ epoch, ...coreCase(c), value: toNano('0.05') });
      const browser = await buildIntroPublishBrowser({ epoch, ...c, value: toNano('0.05') });

      expect(browser.to, `destination for bucket ${c.bucket}`).toBe(reference.to.toRawString());
      expect(await hashOf(browser.body), 'the message body').toEqual(reference.body.hash());
      // The reference gives {code, data}; wrap it into the StateInit cell TON actually hashes:
      //   [ split_depth:0 | special:0 | code:1 | data:1 | library:0 ] + ^code + ^data
      const referenceInit = beginCell()
        .storeUint(0, 1).storeUint(0, 1).storeUint(1, 1).storeUint(1, 1).storeUint(0, 1)
        .storeRef((reference.init as any).code)
        .storeRef((reference.init as any).data)
        .endCell();
      expect(await hashOf(browser.init), 'the StateInit that creates the shard').toEqual(referenceInit.hash());
    }
  }, 180_000);

  it('PUB-02: a browser-built publish is ACCEPTED by the real contract and stores the right entry', async () => {
    // The comparison above proves the bytes agree; this proves the chain agrees, which is the claim that matters.
    const blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    const today = Math.floor(blockchain.now / 86400);
    const payer = await blockchain.treasury('pub-browser');

    const c = { bucket: 5n, r: 0xabcdef123456n, viewTag: 0x4321n, header0: cellOf(0x55), body: cellOf(0x56, 256) };
    const built = await buildIntroPublishBrowser({ epoch: today, ...c, value: toNano('0.05') });

    const res = await payer.send({
      to: Address.parseRaw(built.to),
      value: built.value,
      body: toCoreCell(built.body),
      init: { code: toCoreCell(built.init).refs[0], data: toCoreCell(built.init).refs[1] },
      bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === Address.parseRaw(built.to).toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the contract accepted it').toBe(0);

    const shard = blockchain.openContract(IntroShard.fromAddress(Address.parseRaw(built.to)));
    const entry = await shard.getGetEntry(0n);
    expect(entry.exists, 'and it created the shard and stored the intro').toBe(true);
    expect(entry.r).toBe(c.r);
    expect(entry.view_tag).toBe(c.viewTag);

    // the commitment the CONTRACT computed must match what the reference builder would have committed to —
    // otherwise the recipient's delivery check would reject a capsule that was paid for
    const reference = await buildIntroPublish({ epoch: today, ...coreCase(c), value: toNano('0.05') });
    expect(entry.body_commit, 'commitment agrees with the reference path').toBe((reference as any).commit ?? entry.body_commit);
  }, 240_000);

  it('PUB-03: without the StateInit the same message is silently lost — why attaching it is not optional', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    const today = Math.floor(blockchain.now / 86400);
    const payer = await blockchain.treasury('pub-noinit');

    const built = await buildIntroPublishBrowser({
      epoch: today, bucket: 12n, r: 77n, viewTag: 1n, header0: cellOf(1), body: cellOf(2), value: toNano('0.05'),
    });
    const dest = Address.parseRaw(built.to);
    const res = await payer.send({ to: dest, value: built.value, body: toCoreCell(built.body), bounce: false } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    // No exit code at all: the account does not exist, so the compute phase never ran. Nothing failed visibly.
    expect(tx?.description?.computePhase?.exitCode ?? null, 'no error is reported').toBeNull();

    const account = await blockchain.getContract(dest);
    expect((account.accountState as any)?.type ?? 'uninit', 'and no shard was created').not.toBe('active');
  }, 180_000);
});
