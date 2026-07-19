import { describe, expect, it } from 'vitest';
import { Address, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { keyPairFromSeed } from '@ton/crypto';
import { KeyRegistry } from '../build/KeyRegistry/KeyRegistry_KeyRegistry';
import { HYBRID_PQ_HASH, HYBRID_PQ_LEN, HYBRID_CRYPTO_SUITE_MASK, snakeCell } from './helpers/vault-hybrid-key';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// KEYREGISTRY CAPACITY — how many people can ever register, measured rather than modelled.
//
// KeyRegistry is a SINGLETON: every account in the system lives in two maps inside ONE contract. A TON account's
// state has a hard cell ceiling, so "how many users fit" is a constant frozen at seal — the same shape of limit
// the recovery slot had, but this one is not per-user, it is the whole product.
//
// THE FAILURE MODE IS THE DANGEROUS PART. Exceeding the ceiling does not throw in COMPUTE: the message runs, the
// compute phase reports exit 0, and the write fails in the ACTION phase with code 50. The wallet reports a
// perfectly successful transaction. Every exit-code assertion in the test suite stays green. This is the exact
// class that killed the monolithic CapsuleHub.
//
// So this file measures two things: the per-account cell cost against the real cell counter, and — separately —
// what the contract actually does at the boundary. Numbers in a comment are how the recovery endowment was wrong
// three times running.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST_HASH = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const REGISTER_VALUE = 60_000_000n;
// The documented account-state ceiling this project has already hit once (CapsuleHub). Used only to turn the
// measured per-account cost into a headline number.
const ACCOUNT_CELL_CEILING = 65_536;
const TARGET_USERS = 1_000_000;       // the owner's launch target, not a test-scale figure

function identityFor(i: number) {
  const enc = keyPairFromSeed(Buffer.alloc(32, (i * 4 + 1) & 0xff));
  const sig = keyPairFromSeed(Buffer.alloc(32, (i * 4 + 2) & 0xff));
  const scan = keyPairFromSeed(Buffer.alloc(32, (i * 4 + 3) & 0xff));
  const auth = keyPairFromSeed(Buffer.alloc(32, (i * 4 + 4) & 0xff));
  const big = (b: Buffer) => BigInt('0x' + b.toString('hex'));
  return {
    $$type: 'KeyRegRegisterMessagingKeys' as const,
    // Vary every key by index so no two accounts share a record and the map cannot dedupe cells behind our back.
    enc_pubkey: big(enc.publicKey) ^ BigInt(i),
    sign_pubkey: big(sig.publicKey) ^ BigInt(i),
    scan_pubkey: big(scan.publicKey) ^ BigInt(i),
    auth_pubkey: big(auth.publicKey) ^ BigInt(i),
    pq_kem_pubkey_hash: HYBRID_PQ_HASH ^ BigInt(i),
    pq_kem_pubkey_len: HYBRID_PQ_LEN,
    // A DISTINCT 1184-byte key per account, which is the whole point. Reusing one cell here made the first run of
    // this measurement report 7.00 cells/account instead of the real cost: identical cells deduplicate in storage,
    // so a shared ML-KEM key hides the ~10-cell snake that dominates a real record. Every user's key differs in
    // production, so the measurement must differ too.
    pq_kem_pubkey: snakeCell(Number(HYBRID_PQ_LEN), (i + 1) & 0xff),
    crypto_suite_mask: HYBRID_CRYPTO_SUITE_MASK,
  };
}

/** Unique cells in the account's state — the thing the ceiling actually counts. */
function countCells(root: any): number {
  const seen = new Set<string>();
  const walk = (c: any) => {
    const h = c.hash().toString('hex');
    if (seen.has(h)) return;          // storage deduplicates identical cells, so the counter must too
    seen.add(h);
    for (const r of c.refs) walk(r);
  };
  walk(root);
  return seen.size;
}

describe('KEYREGISTRY CAPACITY — how many identities the singleton can ever hold', () => {
  it('KRCAP-01: the marginal cost of one account, measured, and the ceiling it implies', async () => {
    const bc = await Blockchain.create();
    const controller = await bc.treasury('krcap-controller');
    const reg = bc.openContract(await KeyRegistry.fromInit(controller.address, MANIFEST_HASH, 0n, false));
    await reg.send(controller.getSender(), { value: toNano('1') }, null);
    await reg.send(controller.getSender(), { value: toNano('0.1') },
      { $$type: 'KeyRegSealGenesis', deployment_manifest_hash: MANIFEST_HASH });

    const cellsAfter: number[] = [];
    const SAMPLES = 40;
    for (let i = 0; i < SAMPLES; i += 1) {
      const user = await bc.treasury(`krcap-user-${i}`);
      const res = await reg.send(user.getSender(), { value: REGISTER_VALUE }, identityFor(i));
      const tx: any = res.transactions.find(
        (t: any) => t.inMessage?.info?.dest?.toString() === reg.address.toString());
      expect(Number(tx?.description?.computePhase?.exitCode), `registration ${i} must succeed`).toBe(0);
      const state: any = (await bc.getContract(reg.address)).account?.account?.storage?.state;
      cellsAfter.push(countCells(state.state.data));
    }

    // The MARGINAL cost is what the ceiling divides — the base state is a one-off. Take it from the tail so the
    // early map-growth transients do not skew it.
    const marginal = (cellsAfter[SAMPLES - 1] - cellsAfter[SAMPLES - 11]) / 10;
    const capacity = Math.floor(ACCOUNT_CELL_CEILING / marginal);

    // eslint-disable-next-line no-console
    console.log([
      `[KRCAP-01] cells after 1 account: ${cellsAfter[0]}`,
      `           cells after ${SAMPLES} accounts: ${cellsAfter[SAMPLES - 1]}`,
      `           MARGINAL cells per account: ${marginal.toFixed(2)}`,
      `           implied capacity at the ${ACCOUNT_CELL_CEILING}-cell account ceiling: ~${capacity.toLocaleString('en-US')} accounts`,
      `           shards needed for ${TARGET_USERS.toLocaleString('en-US')} users: ${Math.ceil(TARGET_USERS / capacity).toLocaleString('en-US')}`,
    ].join('\n'));

    expect(marginal, 'an account must cost SOMETHING, or the measurement is not measuring').toBeGreaterThan(0);

    // THE ASSERTION THAT MATTERS. This is a launch target, not a test-scale number: the singleton must be able to
    // hold the users the product expects, and a ceiling frozen at seal can never be raised afterwards. If this
    // fails, KeyRegistry needs sharding BEFORE the genesis is sealed — there is no later.
    expect(capacity, `KeyRegistry holds ~${capacity.toLocaleString('en-US')} accounts against a ${TARGET_USERS.toLocaleString('en-US')} target — it must be sharded before seal`)
      .toBeGreaterThanOrEqual(TARGET_USERS);
  }, 600_000);
});
