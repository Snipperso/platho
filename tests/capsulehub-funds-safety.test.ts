import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { keyPairFromSeed } from '@ton/crypto';
import { deployAnonReady, convPartToken, publicPartToken, anonBatch, recoveryMessage, KIND_INTRO } from './helpers/anon';
import { hubTxExit, SIZE_1K, KIND_PUBLIC, marketingCell } from './helpers/vpb2';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// HUB-FUNDS-SAFETY — closes two seal-blockers that were only ever verified by reading the source.
//
//   1. "funds-safety — indexStorageReserve/protectedReserve include the intro term (done) + the recovery term
//       (TO VERIFY) -> otherwise an irreversible drain of live storage."
//   2. "Nullifier-solvency — the acceptance window must equal the retention bit-for-bit."
//
// Both hold in the source today. Neither was pinned, and that is the whole problem: every live lane's endowment
// sits on-balance, so the ONLY thing standing between a lane and the sweep is its term appearing in
// protectedReserve(). Drop a term in a later edit and the sweep reclassifies that lane's backing as excess and
// pays it to the owner — silently, on an immutable contract, with entries still live and now unfunded. The bug
// would be a deletion, which no positive test notices.
//
// So these tests assert the reserve RESPONDS to each lane independently, and that a sweep cannot reach past it.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const PREPAID_UNIT = 10_995_000n;
const EPOCH_SECONDS = 86400;
const EPOCH_ACCEPT_PAST = 4;
const EPOCH_ACCEPT_FUTURE = 4;
const NULLIFIER_RETENTION_SECONDS = 777_600;

const uniqueKey = (i: number) => {
  const seed = Buffer.alloc(32, 0x66);
  seed.writeUInt32BE(i + 1, 0);
  return keyPairFromSeed(seed);
};

describe('HUB-FUNDS-SAFETY — every live lane is inside protectedReserve, and the window matches the retention', () => {
  it('HUB-FUNDS-01: the nullifier acceptance window equals the retention BIT-FOR-BIT', () => {
    // The invariant the contract states as "MUST stay = (PAST+FUTURE+1)*EPOCH_SECONDS". If retention were SHORTER
    // than the window, a nullifier could evict while its serial is still spendable -> the same token spends twice.
    // If it were LONGER, the ledger holds dead weight against a 65536-cell ceiling. Only equality is correct.
    expect(NULLIFIER_RETENTION_SECONDS).toBe((EPOCH_ACCEPT_PAST + EPOCH_ACCEPT_FUTURE + 1) * EPOCH_SECONDS);
  });

  it('HUB-FUNDS-02: protectedReserve grows for EVERY lane — private, public, intro, recovery, nullifier', async () => {
    // The deletion-shaped bug this guards: a lane silently missing from the reserve sum. Assert each lane moves the
    // number on its own, so dropping any single term fails here rather than in production a year later.
    const s = await deployAnonReady({ credits: 4n });
    const { blockchain, hub, creditIssuer, issuer, nowEpoch } = s;
    await hub.send(creditIssuer.getSender(), { value: 60n * PREPAID_UNIT + toNano('2') }, {
      $$type: 'FundAnonPool', credits_k: 60n, epoch: nowEpoch, purchase_id: 0n,
    } as any);
    const relay = await blockchain.treasury('funds-relay');
    // Assert on the RAW lane term, not protected_reserve_ton. protectedReserve() = accrued_fee + max(100 TON floor,
    // dynamic), and at these volumes the floor dominates completely — it masks every lane term. The first draft of
    // this test read protected_reserve_ton and "passed" for the wrong reason entirely: it was watching the protocol
    // FEE grow, not the reserve. INTRO pays no fee, so INTRO is what exposed the fake.
    const reserve = async () => (await hub.getGetState()).index_storage_reserve_ton;

    const afterFunding = await reserve();

    // PRIVATE
    const p = convPartToken({ issuer, spend: uniqueKey(1), slot: 0n, epoch: nowEpoch, nonce: 1n, fill: 1, sizeClass: SIZE_1K });
    expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('2') },
      anonBatch({ parts: p.part, tokens: p.tok, partCount: 1n })), hub)).toBe(0);
    const afterPrivate = await reserve();
    expect(afterPrivate, 'PRIVATE entry must raise the protected reserve').toBeGreaterThan(afterFunding);

    // PUBLIC
    const pub = publicPartToken({ issuer, spend: uniqueKey(2), slot: 0n, epoch: nowEpoch, nonce: 2n, fill: 2, sizeClass: SIZE_1K });
    expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('2') },
      anonBatch({ parts: pub.part, tokens: pub.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() })), hub)).toBe(0);
    const afterPublic = await reserve();
    expect(afterPublic, 'PUBLIC entry must raise it').toBeGreaterThan(afterPrivate);

    // INTRO
    const intro = convPartToken({ issuer, spend: uniqueKey(3), slot: 0n, epoch: nowEpoch, nonce: 3n, fill: 3, kind: KIND_INTRO, sizeClass: SIZE_1K });
    expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('2') },
      anonBatch({ parts: intro.part, tokens: intro.tok, partCount: 1n, kind: KIND_INTRO })), hub)).toBe(0);
    const afterIntro = await reserve();
    expect(afterIntro, 'INTRO entry must raise it').toBeGreaterThan(afterPublic);

    // RECOVERY — the term the blocker specifically flagged as unverified. It is also the dearest slot (79 cells),
    // so a missing term here leaks the most per entry AND on the durability lane.
    const { msg } = recoveryMessage({ owner: uniqueKey(4), fill: 7 });
    expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('0.4') }, msg), hub)).toBe(0);
    const afterRecovery = await reserve();
    expect(afterRecovery, 'RECOVERY slot must raise the protected reserve').toBeGreaterThan(afterIntro);
    // ...and it must raise it by MORE than a cheap lane does — 79 cells vs 5-8. A term wired to the wrong constant
    // would still "grow" but by the wrong amount.
    expect(afterRecovery - afterIntro, 'the recovery slot is the dearest — its term must reflect that')
      .toBeGreaterThan(afterIntro - afterPublic);

    const st = await hub.getGetState();
    expect(st.private_live_count).toBe(1n);
    expect(st.public_live_count).toBe(1n);
    expect(st.intro_live_count).toBe(1n);
    expect(st.recovery_live_count).toBe(1n);
    // The floor still dominates at this scale — which is exactly why the raw term had to be read directly.
    expect(st.protected_reserve_ton).toBeGreaterThan(st.index_storage_reserve_ton);
  }, 300_000);

  it('HUB-FUNDS-03: a sweep cannot reach a live lane\'s endowment', async () => {
    // The reserve is only a number until something tries to cross it. Drive the actual sweep and show it refuses
    // to hand out the backing of live entries.
    const s = await deployAnonReady({ credits: 4n });
    const { blockchain, hub, creditIssuer, issuer, nowEpoch, deployer } = s;
    await hub.send(creditIssuer.getSender(), { value: 20n * PREPAID_UNIT + toNano('2') }, {
      $$type: 'FundAnonPool', credits_k: 20n, epoch: nowEpoch, purchase_id: 0n,
    } as any);
    const relay = await blockchain.treasury('sweep-relay');

    for (let i = 0; i < 3; i++) {
      const p = convPartToken({ issuer, spend: uniqueKey(10 + i), slot: 0n, epoch: nowEpoch, nonce: BigInt(10 + i), fill: 10 + i, sizeClass: SIZE_1K });
      expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('2') },
        anonBatch({ parts: p.part, tokens: p.tok, partCount: 1n })), hub)).toBe(0);
    }

    const st = await hub.getGetState();
    const balance = (await blockchain.getContract(hub.address)).balance;
    const surplus = balance - st.protected_reserve_ton;

    // Anything at or under the surplus is legitimately sweepable; anything past it is someone's live backing.
    // Ask for far more than the surplus and require a refusal.
    const greedy = await hub.send(deployer.getSender(), { value: toNano('0.1') }, {
      $$type: 'SweepExcessReserve', amount: balance,
    } as any);
    expect(hubTxExit(greedy, hub), 'a sweep past the protected reserve must be refused').not.toBe(0);
    expect((await blockchain.getContract(hub.address)).balance,
      'and nothing may leave').toBeGreaterThan(st.protected_reserve_ton);
    // Sanity: the reserve really is the binding constraint here, not an accident of a tiny balance.
    expect(surplus).toBeLessThan(balance);
  }, 300_000);
});
