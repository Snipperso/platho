import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { scanIntroWindow } from '../web/intro-receive.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';


const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

describe('INTRO-RECEIVE — can a stranger actually reach me?', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  const READ_SPACE = 8;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('ir-payer');
  });

  const readStates = async (addresses: any[]) => {
    const out = new Map<string, any>();
    for (const address of addresses) {
      const contract = await blockchain.getContract(Address.parse(String(address)));
      const state: any = contract.accountState;
      if (!state || state.type !== 'active') continue;
      out.set(addrKey(address), {
        address,
        status: 'active',
        balance: contract.balance,
        dataHash: state.state?.data?.hash()?.toString('hex') ?? null,
        lastLt: String(contract.lastTransactionLt ?? ''),
        dataBoc: null,
      });
    }
    return out;
  };

  const readScanPage = async (address: any, fromId: number, maxCount: number) => {
    const contract = await blockchain.getContract(Address.parse(String(address)));
    if (!contract.accountState || (contract.accountState as any).type !== 'active') return null;
    const shard = blockchain.openContract(IntroShard.fromAddress(Address.parse(String(address))));
    return shard.getGetScanPage(BigInt(fromId), BigInt(maxCount));
  };

  async function publishIntroTo(ownerScanSecret: Uint8Array, bucket: number, atEpoch = epoch) {
    const ephemeralSecret = x25519.utils.randomSecretKey();
    const R = x25519.getPublicKey(ephemeralSecret);
    const tag = await computePrivateScanViewTag(ownerScanSecret, R);
    const built = await buildIntroPublish({
      epoch: atEpoch, bucket: BigInt(bucket),
      r: BigInt('0x' + Buffer.from(R).toString('hex')), viewTag: BigInt(tag),
      header0: cellOf(1), body: cellOf(2), value: toNano('0.05'),
    });
    await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    return { R, tag, bucket, epoch: atEpoch };
  }

  it('IR-01: a first contact from a stranger is found, and the decoys are not', async () => {
    const mine = x25519.utils.randomSecretKey();
    const theirs = x25519.utils.randomSecretKey();

    const target = await publishIntroTo(mine, 5);
    for (const bucket of [0, 1, 5, 6]) await publishIntroTo(theirs, bucket);

    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });

    expect(res.hits.length, 'exactly the one intro addressed to me').toBe(1);
    expect(res.hits[0].bucket, 'and it names the bucket it came from').toBe(target.bucket);
    expect(res.hits[0].r).toBe(BigInt('0x' + Buffer.from(target.R).toString('hex')));
    expect(res.stats.probed).toBe(READ_SPACE);
  }, 180_000);

  it('IR-02: empty buckets are read as empty, not as failures — the lazy-deploy case', async () => {
    const mine = x25519.utils.randomSecretKey();
    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(res.hits).toEqual([]);
    expect(res.stats.live, 'no bucket exists yet').toBe(0);
    expect(res.stats.changed).toBe(0);
    expect(res.stats.pagesRead, 'nothing was opened').toBe(0);
  }, 120_000);

  it('IR-03: the cursor makes a second pass cheap, and a new intro still arrives', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 2);

    const first = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(first.hits.length).toBe(1);
    expect(first.stats.pagesRead).toBeGreaterThan(0);

    const idle = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: first.cursors, readStates, readScanPage });
    expect(idle.stats.changed, 'no bucket moved').toBe(0);
    expect(idle.stats.pagesRead, 'so nothing was opened').toBe(0);
    expect(idle.hits, 'and nothing is re-delivered').toEqual([]);

    await publishIntroTo(mine, 2);
    const second = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: idle.cursors, readStates, readScanPage });
    expect(second.stats.changed, 'exactly one bucket moved').toBe(1);
    expect(second.stats.candidates, 'and only the NEW entry was fetched, not the old one').toBe(1);
    expect(second.hits.length).toBe(1);
    expect(second.hits[0].entryId, 'it is the second entry of that bucket').toBe(1);
  }, 180_000);

  it('IR-04: an intro published under the neighbouring epoch is still delivered', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 3, epoch - 1);

    const narrow = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(narrow.hits.length, 'a one-epoch window misses it — this is why the window is wider').toBe(0);

    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch - 1, readSpace: READ_SPACE, readStates, readScanPage });
    expect(res.hits.length).toBe(1);
    expect(res.hits[0].epoch).toBe(epoch - 1);
  }, 180_000);

  it('IR-05: a bucket with more entries than one page still yields every hit', async () => {
    const mine = x25519.utils.randomSecretKey();
    const theirs = x25519.utils.randomSecretKey();
    for (let i = 0; i < 7; i += 1) await publishIntroTo(theirs, 4);
    await publishIntroTo(mine, 4);
    for (let i = 0; i < 5; i += 1) await publishIntroTo(theirs, 4);

    const res = await scanIntroWindow({
      scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE,
      readStates, readScanPage, pageSize: 3,
    });
    expect(res.stats.candidates, 'every entry in the bucket was walked exactly once').toBe(13);
    expect(res.stats.pagesRead).toBeGreaterThan(3);
    expect(res.hits.length).toBe(1);
    expect(res.hits[0].entryId, 'and the hit is the 8th entry').toBe(7);
  }, 240_000);

  it('IR-06: a bucket whose read FAILED is retried, not marked done — the one-hiccup-loses-a-contact bug', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 6);

    let failNext = true;
    const flaky = async (address: any, fromId: number, maxCount: number) => {
      if (failNext) { failNext = false; throw new Error('502 Bad Gateway from the RPC edge'); }
      return readScanPage(address, fromId, maxCount);
    };

    const first = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage: flaky });
    expect(first.hits, 'the failing read delivers nothing, as it must').toEqual([]);
    expect(first.stats.failed, 'and it is reported rather than swallowed').toBe(1);

    const second = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: first.cursors, readStates, readScanPage });
    expect(second.stats.changed, 'the bucket was NOT marked as done').toBe(1);
    expect(second.hits.length, 'so the first contact still arrives').toBe(1);
  }, 180_000);

  it('IR-07: a page loop cannot be made to run forever by a broken or hostile endpoint', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 7);

    let calls = 0;
    const evil = async (address: any, fromId: number, maxCount: number) => {
      calls += 1;
      const honest = await readScanPage(address, fromId, maxCount);
      if (!honest) return null;
      return { ...honest, count: BigInt(maxCount), next_id: 4294967295n };
    };

    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage: evil, pageSize: 64 });
    expect(calls, 'bounded by what an honest shard could possibly hold').toBeLessThanOrEqual(Math.ceil(8000 / 64) + 2);
    expect(res, 'and the pass still returns').toBeTruthy();

    const shardKey = addrKey(contractAddress(0, await IntroShard.init(BigInt(epoch), 7n)));
    expect(res.cursors.get(shardKey)?.marker, 'an undrained bucket keeps no completion marker').toBeFalsy();

    const after = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: res.cursors, readStates, readScanPage });
    expect(after.hits.length, 'the first contact survives a hostile endpoint').toBe(1);
  }, 240_000);

  it('IR-08: the window reaches TOMORROW, because the publish gate lets a sender write there', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 4, epoch + 1);

    const res = await scanIntroWindow({ scanSecretKey: mine, currentEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(res.stats.window[1], 'the window ends at tomorrow, not today').toBe(epoch + 1);
    expect(res.hits.length, 'so an intro written there is delivered now, not in a day').toBe(1);
    expect(res.hits[0].epoch).toBe(epoch + 1);
  }, 180_000);
});
