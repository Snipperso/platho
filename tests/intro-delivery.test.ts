import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { scanIntroWindow } from '../web/intro-receive.mjs';
import { fetchIntroCapsule, createEntryReader } from '../web/intro-transport.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { createMemoryIntroCursorStore, pruneCursors, cursorEntry } from '../web/intro-cursor-store.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';


const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  return cell;
};

describe('INTRO-DELIVERY — from a hit to a readable message', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  const READ_SPACE = 8;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('id-payer');
  });

  const readStates = async (addresses: any[]) => {
    const out = new Map<string, any>();
    for (const address of addresses) {
      const contract = await blockchain.getContract(Address.parse(String(address)));
      const state: any = contract.accountState;
      if (!state || state.type !== 'active') continue;
      out.set(addrKey(address), {
        address, status: 'active', balance: contract.balance,
        dataHash: state.state?.data?.hash()?.toString('hex') ?? null,
        lastLt: String(contract.lastTransactionLt ?? ''), dataBoc: null,
      });
    }
    return out;
  };

  const readScanPage = async (address: any, fromId: number, maxCount: number) => {
    const contract = await blockchain.getContract(Address.parse(String(address)));
    if (!contract.accountState || (contract.accountState as any).type !== 'active') return null;
    return blockchain.openContract(IntroShard.fromAddress(Address.parse(String(address)))).getGetScanPage(BigInt(fromId), BigInt(maxCount));
  };

  const readEntry = createEntryReader(async ({ address, method, stack }: any) => {
    const shard = blockchain.openContract(IntroShard.fromAddress(Address.parse(address)));
    const entry = await shard.getGetEntry(BigInt(stack[0].value));
    return {
      exit_code: 0,
      stack: [
        { type: 'num', value: entry.exists ? '-1' : '0' },
        { type: 'num', value: '0x' + entry.r.toString(16) },
        { type: 'num', value: '0x' + entry.view_tag.toString(16) },
        { type: 'num', value: '0x' + entry.body_commit.toString(16) },
        { type: 'num', value: '0x' + entry.created_at.toString(16) },
      ],
    };
  });

  const deliveries = new Map<string, any[]>();
  const readMessages = async (address: any) => (deliveries.get(addrKey(address)) ?? [])
    .slice().reverse().map((cell: any) => parseBocBase64(cell.toBoc().toString('base64')));

  async function publishIntroTo(ownerScanSecret: Uint8Array, bucket: number, bodyFill: number) {
    const ephemeralSecret = x25519.utils.randomSecretKey();
    const R = x25519.getPublicKey(ephemeralSecret);
    const tag = await computePrivateScanViewTag(ownerScanSecret, R);
    const header0 = cellOf(bodyFill);
    const body = cellOf(bodyFill + 1, 256);
    const built = await buildIntroPublish({
      epoch, bucket: BigInt(bucket), r: BigInt('0x' + Buffer.from(R).toString('hex')), viewTag: BigInt(tag),
      header0, body, value: toNano('0.05'),
    });
    await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    const key = addrKey(built.to);
    deliveries.set(key, [...(deliveries.get(key) ?? []), built.body]);
    return { R, header0, body, address: built.to };
  }

  it('DELIVERY-01: a hit is turned into the exact capsule the sender published', async () => {
    const mine = x25519.utils.randomSecretKey();
    const theirs = x25519.utils.randomSecretKey();
    await publishIntroTo(theirs, 2, 0x10);
    const target = await publishIntroTo(mine, 2, 0x20);
    await publishIntroTo(theirs, 2, 0x30);

    const scan = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(scan.hits.length).toBe(1);

    const hit = scan.hits[0];
    const address = contractAddress(0, await IntroShard.init(BigInt(hit.epoch), BigInt(hit.bucket)));
    const capsule = await fetchIntroCapsule({ address, entryId: hit.entryId, readEntry, readMessages });

    expect(capsule, 'the capsule is recovered from transaction history').not.toBeNull();
    const { computeCellHashAndDepth } = await import('../web/pwa-contract-transactions.mjs');
    const sameAs = async (clientCell: any, reference: any) =>
      Buffer.from((await computeCellHashAndDepth(clientCell)).hash).equals(reference.hash());
    expect(await sameAs(capsule!.body, target.body), 'byte-for-byte the body that was sent').toBe(true);
    expect(await sameAs(capsule!.header0, target.header0)).toBe(true);
  }, 240_000);

  it('DELIVERY-02: a body that does not match the contract commitment is REFUSED, not shown', async () => {
    const mine = x25519.utils.randomSecretKey();
    const target = await publishIntroTo(mine, 1, 0x40);

    const scan = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    const hit = scan.hits[0];
    const address = contractAddress(0, await IntroShard.init(BigInt(hit.epoch), BigInt(hit.bucket)));

    const forged = await buildIntroPublish({
      epoch, bucket: 1n, r: 1n, viewTag: 1n, header0: cellOf(0xEE), body: cellOf(0xEF, 256), value: toNano('0.05'),
    });
    const tampered = async () => [parseBocBase64(forged.body.toBoc().toString('base64'))];
    expect(await fetchIntroCapsule({ address, entryId: hit.entryId, readEntry, readMessages: tampered }),
      'the commitment does not reproduce, so nothing is delivered').toBeNull();

    const honest = await fetchIntroCapsule({ address, entryId: hit.entryId, readEntry, readMessages });
    const { computeCellHashAndDepth } = await import('../web/pwa-contract-transactions.mjs');
    expect(Buffer.from((await computeCellHashAndDepth(honest!.body)).hash).equals(target.body.hash())).toBe(true);
  }, 240_000);

  it('DELIVERY-03: cursors survive a restart, so nothing is re-delivered', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 3, 0x50);

    const store = createMemoryIntroCursorStore();
    const first = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: await store.load(), readStates, readScanPage });
    expect(first.hits.length).toBe(1);
    await store.save(first.cursors);

    const reopened = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: await store.load(), readStates, readScanPage });
    expect(reopened.stats.changed, 'nothing moved while we were away').toBe(0);
    expect(reopened.hits, 'and the same intro is NOT delivered twice').toEqual([]);

    await publishIntroTo(mine, 3, 0x60);
    const later = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: await store.load(), readStates, readScanPage });
    expect(later.hits.length).toBe(1);
    expect(later.stats.candidates, 'and only the new entry was fetched').toBe(1);
  }, 240_000);

  it('DELIVERY-04: cursors for epochs past the window are pruned, so the map cannot grow forever', async () => {
    const cursors = new Map([
      ['old-a', cursorEntry('m1', 5)],
      ['old-b', cursorEntry('m2', 7)],
      ['current', cursorEntry('m3', 2)],
    ]);
    const keyEpochs = new Map([['old-a', epoch - 30], ['old-b', epoch - 10], ['current', epoch]]);
    const kept = pruneCursors(cursors, keyEpochs, epoch - 8);
    expect([...kept.keys()], 'only shards still inside the window survive').toEqual(['current']);
  });

  it('DELIVERY-05: the store round-trips exactly what the scanner needs', async () => {
    const store = createMemoryIntroCursorStore();
    expect((await store.load()).size, 'a fresh install starts empty, not broken').toBe(0);
    await store.save(new Map([['k', { marker: '12345', nextId: 9 }]]));
    const loaded = await store.load();
    expect(loaded.get('k')).toEqual({ marker: '12345', nextId: 9 });
    await store.saveMeta({ lastFullSweepAt: 1234, highestLiveBucket: 3 });
    expect(await store.loadMeta()).toEqual({ lastFullSweepAt: 1234, highestLiveBucket: 3 });
  });
});
