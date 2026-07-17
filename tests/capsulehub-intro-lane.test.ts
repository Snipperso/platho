import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { beginCell, Cell, toNano } from '@ton/core';
import { sign, KeyPair } from '@ton/crypto';
import { webcrypto } from 'crypto';
import { SIZE_1K, SUITE_HYBRID, cellHash, hubTxExit, KIND_PRIVATE } from './helpers/vpb2';
import {
  finalIntroBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  snakeCellFromBytes,
  FINAL_INTRO_HEADER0_BYTES,
} from './helpers/capsule-cells';
import {
  KIND_INTRO,
  ISSUER_SIG_DOMAIN,
  SPEND_DOMAIN,
  FRAMECOMMIT_DOMAIN,
  deployAnonReady,
  convPartToken,
  anonBatch,
  spendKey,
  bufToInt,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the INTRO first-contact lane onto the permissionless anon-publish path. The old Vault-
// forwarded PublishBatchToHub (sender()==vault trusted) is GONE; INTRO now rides receive(PublishAnonBatch) with
// publish_kind = INTRO(3), authorized per-part by a spend token (issuer_sig over the serial + spend_sig over the
// frame) against a prepaid pool credit. The INTRO lane SEMANTICS are unchanged: publish_kind=3 carries a 336-bit
// (42-byte) header0 (ephemeral_R + view_tag) + a larger body (ct_root), lands in a SEPARATE pool (intro_entries)
// with NO who-to-whom index (the recipient trial-decrypts the scan stream), its own meta-assert (13549) binds
// header0 byte@5==INTRO, and a wrong-shape header0 fails closed (13544). A valid INTRO frame + token is built via
// the shared anon.ts convPartToken({ kind: KIND_INTRO }); the two lane-parse negatives need a malformed header0, so
// they are assembled by hand (introPartTokenCustom) with a VALID issuer_sig/spend_sig — the token verify passes so
// the receiver reaches the lane-parse assert under test.

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');

// A 42-byte INTRO header0 with an explicit publishKind at byte@5 (for the 13549 meta-assert negative case).
function introHeader0WithPublishKind(publishKind: number): Cell {
  const bytes = Buffer.alloc(FINAL_INTRO_HEADER0_BYTES, 0x33);
  bytes[5] = publishKind;
  return snakeCellFromBytes(bytes);
}

// Build an INTRO part frame with an ARBITRARY header0 cell + its matching spend token. Mirrors anon.ts convPartToken's
// INTRO branch exactly (issuer_sig over the serial, spend_sig over the frameCommit of the real h0/h1/bh), so only the
// intended lane-parse check (header0 shape/publishKind) diverges from a valid INTRO. Used by the 13544/13549 negatives.
function introPartTokenCustom(opts: {
  issuer: KeyPair; spend: KeyPair; slot: bigint; epoch: bigint; nonce: bigint; header0: Cell;
}): { part: Cell; tok: Cell } {
  const size = SIZE_1K;
  const h0 = opts.header0;
  const h1 = finalPrivateHeader1Cell(0x31);
  const body = finalIntroBodyCell(size, 0x40);
  const h0h = cellHash(h0);
  const h1h = cellHash(h1);
  const bh = cellHash(body);

  const part = beginCell()
    .storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256)
    .storeRef(h0).storeRef(h1).storeRef(body)
    .endCell();

  const spendPub = bufToInt(opts.spend.publicKey);
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .endCell().hash();
  const serial = bufToInt(serialBuf);
  const issuerSig = sign(serialBuf, opts.issuer.secretKey);

  const frameCommit = bufToInt(beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256)
    .endCell().hash());
  const spendDigestBuf = beginCell()
    .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(KIND_INTRO, 8)
    .storeUint(frameCommit, 256)
    .endCell().hash();
  const spendSig = sign(spendDigestBuf, opts.spend.secretKey);

  const tok = beginCell()
    .storeUint(serial, 256).storeUint(opts.slot, 8).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .storeRef(beginCell().storeBuffer(issuerSig).endCell())
    .storeRef(beginCell().storeBuffer(spendSig).endCell())
    .endCell();
  return { part, tok };
}

describe('CapsuleHub INTRO first-contact lane (clean-16 B3 anon path)', () => {
  it('INTRO-SRC-01: the INTRO lane surface exists (kind, pool, getters, eviction, sweep, meta-assert)', () => {
    for (const sym of [
      'CAPSULEHUB_ENTRY_KIND_INTRO',
      'CAPSULEHUB_INTRO_HEADER0_BITS',
      'CAPSULEHUB_INTRO_SWEEP_CAP',
      'intro_entries',
      'intro_live_count',
      'fun evictExpiredIntro',
      'fun introHeaderEphemeralR',
      'fun introHeaderViewTag',
      'get fun get_intro_entry',
      'get fun get_intro_scan_bounds',
      'get fun get_intro_scan_page',
      '13549', // INTRO meta-assert (header0 byte@5 == publish_kind)
      '13544', // INTRO header0 shape fail-closed
    ]) {
      expect(HUB, `INTRO surface must include: ${sym}`).toContain(sym);
    }
  });

  it('INTRO-01: an INTRO batch lands in the intro pool, NOT the private/public pools', async () => {
    const env = await deployAnonReady({ credits: 2n });
    const relay = await env.blockchain.treasury('intro-relay-01');

    const pt = convPartToken({
      issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 101n, kind: KIND_INTRO,
    });
    const res = await env.hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_INTRO }));
    expect(hubTxExit(res, env.hub)).toBe(0);

    const state = await env.hub.getGetState();
    expect(state.intro_latest_id).toBe(1n);
    expect(state.intro_live_count).toBe(1n);
    expect(state.private_latest_id).toBe(0n); // NOT a private/CONV entry
    expect(state.public_latest_id).toBe(0n);

    const entry = await env.hub.getGetIntroEntry(0n);
    expect(entry.exists).toBe(true);

    const bounds = await env.hub.getGetIntroScanBounds();
    expect(bounds.latest_id).toBe(1n);
    expect(bounds.oldest_live_id).toBe(0n);
    expect(bounds.live_count).toBe(1n);
  });

  it('INTRO-02: an INTRO header0 whose byte@5 != INTRO bounces (13549), nothing stored', async () => {
    const env = await deployAnonReady();
    const relay = await env.blockchain.treasury('intro-relay-02');
    // 42-byte INTRO-shaped header0 (passes the 336-bit shape check) but byte@5 = 1 (PRIVATE/CONV) while the batch is
    // publish_kind = INTRO(3) → mislabel → the meta-assert rejects it. Token is valid, so we reach the lane-parse assert.
    const { part, tok } = introPartTokenCustom({
      issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 102n,
      header0: introHeader0WithPublishKind(1),
    });
    const bad = await env.hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: part, tokens: tok, partCount: 1n, kind: KIND_INTRO }));
    expect(hubTxExit(bad, env.hub)).toBe(13549);
    expect((await env.hub.getGetState()).intro_latest_id).toBe(0n);
  });

  it('INTRO-03: a CONV-sized (320-bit) header0 under kind=INTRO fails closed (13544)', async () => {
    const env = await deployAnonReady();
    const relay = await env.blockchain.treasury('intro-relay-03');
    // A 40-byte (320-bit) CONV header0 in the INTRO branch is the wrong shape (INTRO wants 336 bits) → requireExact-
    // PayloadCell's size check trips 13544. The frame's h0 hash matches the header cell, so the hash check (13543) passes.
    const { part, tok } = introPartTokenCustom({
      issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 103n,
      header0: finalPrivateHeader0Cell(),
    });
    const bad = await env.hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: part, tokens: tok, partCount: 1n, kind: KIND_INTRO }));
    expect(hubTxExit(bad, env.hub)).toBe(13544);
    expect((await env.hub.getGetState()).intro_latest_id).toBe(0n);
  });

  it('INTRO-04: an INTRO batch does not disturb a subsequent CONV publish (separate id spaces)', async () => {
    const env = await deployAnonReady({ credits: 2n });
    const relay = await env.blockchain.treasury('intro-relay-04');

    const intro = convPartToken({
      issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 104n, kind: KIND_INTRO,
    });
    const introRes = await env.hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: intro.part, tokens: intro.tok, partCount: 1n, kind: KIND_INTRO }));
    expect(hubTxExit(introRes, env.hub)).toBe(0);

    // A normal CONV publish still starts its own id space at 0 (distinct spend key + nonce → distinct serial).
    const conv = convPartToken({
      issuer: env.issuer, spend: spendKey(1), slot: env.slot, epoch: env.nowEpoch, nonce: 105n, kind: KIND_PRIVATE,
    });
    const convRes = await env.hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: conv.part, tokens: conv.tok, partCount: 1n, kind: KIND_PRIVATE }));
    expect(hubTxExit(convRes, env.hub)).toBe(0);

    const state = await env.hub.getGetState();
    expect(state.intro_latest_id).toBe(1n);
    expect(state.private_latest_id).toBe(1n);
  });
});
