import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { scanIntroWindow } from '../web/intro-receive.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-RECEIVE — the first-contact receive path, end to end.
//
// Everything else in this lane was tested in pieces: the contract stores an entry, the getter pages it, the
// filter matches a tag. None of that proves a recipient can actually RECEIVE a first contact, which is the only
// thing that matters — and the piecewise version of this lane has already shipped a getter that measured
// beautifully and could not drive a scan at all.
//
// So these tests drive the real module against a real chain: real X25519 keys, real publishes, the real batched
// state read, the real cursor logic, the real filter. The transport is injected, so the sandbox stands in for
// toncenter with the same contract — the shape measured against live toncenter (empty buckets absent from the
// response, one batched call for the whole space) is reproduced here rather than mocked away.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

describe('INTRO-RECEIVE — can a stranger actually reach me?', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  // A small read space keeps the test quick; the production value is INTRO_READ_SPACE and the logic is identical.
  const READ_SPACE = 8;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;   // after the Apr-2026 config-18 switch, so rent is priced at the live rate
    epoch = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('ir-payer');
  });

  // The injected transport. readStates mirrors what toncenter does: accounts that were never deployed are simply
  // ABSENT from the result — the single most important behaviour for a lane where most buckets are empty.
  const readStates = async (addresses: any[]) => {
    const out = new Map<string, any>();
    for (const address of addresses) {
      const contract = await blockchain.getContract(Address.parse(String(address)));
      const state: any = contract.accountState;
      if (!state || state.type !== 'active') continue;                       // uninit -> absent, never an error
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

  /** Publish one intro addressed to `ownerScanSecret`, in a bucket the sender picks. */
  async function publishIntroTo(ownerScanSecret: Uint8Array, bucket: number, atEpoch = epoch) {
    const ephemeralSecret = x25519.utils.randomSecretKey();
    const R = x25519.getPublicKey(ephemeralSecret);
    // X25519 is symmetric, so the tag the sender publishes equals the one the recipient recomputes.
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
    for (const bucket of [0, 1, 5, 6]) await publishIntroTo(theirs, bucket);   // noise, including the same bucket

    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });

    expect(res.hits.length, 'exactly the one intro addressed to me').toBe(1);
    expect(res.hits[0].bucket, 'and it names the bucket it came from').toBe(target.bucket);
    expect(res.hits[0].r).toBe(BigInt('0x' + Buffer.from(target.R).toString('hex')));
    // the scan looked at every bucket, which is the privacy property, not an inefficiency
    expect(res.stats.probed).toBe(READ_SPACE);
  }, 180_000);

  it('IR-02: empty buckets are read as empty, not as failures — the lazy-deploy case', async () => {
    const mine = x25519.utils.randomSecretKey();
    // nothing published anywhere: every bucket in the space is an uninitialised account
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

    // Nothing changed: the cheap pass must recognise that and open nothing at all.
    const idle = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: first.cursors, readStates, readScanPage });
    expect(idle.stats.changed, 'no bucket moved').toBe(0);
    expect(idle.stats.pagesRead, 'so nothing was opened').toBe(0);
    expect(idle.hits, 'and nothing is re-delivered').toEqual([]);

    // A new intro lands in the same bucket: the cursor must pick up only the new entry.
    await publishIntroTo(mine, 2);
    const second = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: idle.cursors, readStates, readScanPage });
    expect(second.stats.changed, 'exactly one bucket moved').toBe(1);
    expect(second.stats.candidates, 'and only the NEW entry was fetched, not the old one').toBe(1);
    expect(second.hits.length).toBe(1);
    expect(second.hits[0].entryId, 'it is the second entry of that bucket').toBe(1);
  }, 180_000);

  it('IR-04: an intro published under the neighbouring epoch is still delivered', async () => {
    // The publish gate accepts epoch +/-1, so a sender whose clock is a little off — or who sends just before
    // midnight — writes into the neighbouring day's shard. The scan window has to cover that, or those first
    // contacts vanish silently, which is the failure mode this lane can least afford.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 3, epoch - 1);

    const narrow = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(narrow.hits.length, 'a one-epoch window misses it — this is why the window is wider').toBe(0);

    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch - 1, readSpace: READ_SPACE, readStates, readScanPage });
    expect(res.hits.length).toBe(1);
    expect(res.hits[0].epoch).toBe(epoch - 1);
  }, 180_000);

  it('IR-05: a bucket with more entries than one page still yields every hit', async () => {
    // Paging is where an off-by-one silently drops first contacts, and a dropped first contact is unrecoverable.
    const mine = x25519.utils.randomSecretKey();
    const theirs = x25519.utils.randomSecretKey();
    for (let i = 0; i < 7; i += 1) await publishIntroTo(theirs, 4);
    await publishIntroTo(mine, 4);
    for (let i = 0; i < 5; i += 1) await publishIntroTo(theirs, 4);

    const res = await scanIntroWindow({
      scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE,
      readStates, readScanPage, pageSize: 3,          // force several pages over the 13 entries
    });
    expect(res.stats.candidates, 'every entry in the bucket was walked exactly once').toBe(13);
    expect(res.stats.pagesRead).toBeGreaterThan(3);
    expect(res.hits.length).toBe(1);
    expect(res.hits[0].entryId, 'and the hit is the 8th entry').toBe(7);
  }, 240_000);

  it('IR-06: a bucket whose read FAILED is retried, not marked done — the one-hiccup-loses-a-contact bug', async () => {
    // The cursor used to be committed after the paging loop no matter what, so a single transient RPC error left
    // the bucket flagged "already processed at this state". The epoch gate then closes that shard to further
    // writes, so nothing would ever move its marker again and every intro in it was lost silently and forever.
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

    // the very next pass, with the endpoint behaving, must still find it
    const second = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: first.cursors, readStates, readScanPage });
    expect(second.stats.changed, 'the bucket was NOT marked as done').toBe(1);
    expect(second.hits.length, 'so the first contact still arrives').toBe(1);
  }, 180_000);

  it('IR-07: a page loop cannot be made to run forever by a broken or hostile endpoint', async () => {
    // Termination used to depend entirely on server-supplied count and next_id. An endpoint answering
    // {count: pageSize, next_id: huge} forever meant scanIntroWindow never returned, so NO first contact from ANY
    // bucket was delivered and the UI just showed nothing arriving.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 7);

    let calls = 0;
    const evil = async (address: any, fromId: number, maxCount: number) => {
      calls += 1;
      const honest = await readScanPage(address, fromId, maxCount);
      if (!honest) return null;
      return { ...honest, count: BigInt(maxCount), next_id: 4294967295n };   // "there is always more"
    };

    const res = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage: evil, pageSize: 64 });
    expect(calls, 'bounded by what an honest shard could possibly hold').toBeLessThanOrEqual(Math.ceil(8000 / 64) + 2);
    expect(res, 'and the pass still returns').toBeTruthy();

    // AND the bucket must NOT be recorded as fully read. Bailing out on the page bound means we never reached the
    // end, so committing the change marker here would mark it "processed at this state" and — because the epoch
    // gate closes the shard to further writes — nothing would ever reopen it. The entries would be lost silently.
    const shardKey = addrKey(contractAddress(0, await IntroShard.init(BigInt(epoch), 7n)));
    expect(res.cursors.get(shardKey)?.marker, 'an undrained bucket keeps no completion marker').toBeFalsy();

    // so an honest pass afterwards still sees it as changed and delivers the intro
    const after = await scanIntroWindow({ scanSecretKey: mine, toEpoch: epoch, fromEpoch: epoch, readSpace: READ_SPACE, cursors: res.cursors, readStates, readScanPage });
    expect(after.hits.length, 'the first contact survives a hostile endpoint').toBe(1);
  }, 240_000);

  it('IR-08: the window reaches TOMORROW, because the publish gate lets a sender write there', async () => {
    // Gate 13684 accepts epoch +/-1, so a sender with a fast clock legitimately publishes into tomorrow's shard.
    // A window ending at today could not see it until the client's own epoch rolled over.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 4, epoch + 1);

    const res = await scanIntroWindow({ scanSecretKey: mine, currentEpoch: epoch, readSpace: READ_SPACE, readStates, readScanPage });
    expect(res.stats.window[1], 'the window ends at tomorrow, not today').toBe(epoch + 1);
    expect(res.hits.length, 'so an intro written there is delivered now, not in a day').toBe(1);
    expect(res.hits[0].epoch).toBe(epoch + 1);
  }, 180_000);
});
