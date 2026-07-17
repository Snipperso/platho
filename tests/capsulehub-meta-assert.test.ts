import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { beginCell, Cell, toNano } from '@ton/core';
import { sign, KeyPair } from '@ton/crypto';
import { webcrypto } from 'crypto';
import { SIZE_1K, SUITE_HYBRID, KIND_PRIVATE, cellHash, hubTxExit } from './helpers/vpb2';
import {
  finalPrivateHeader1Cell,
  finalPrivateBodyCell,
  snakeCellFromBytes,
  FINAL_PRIVATE_HEADER0_BYTES,
} from './helpers/capsule-cells';
import {
  anonBatch,
  spendKey,
  bufToInt,
  deployAnonReady,
  ISSUER_SIG_DOMAIN,
  SPEND_DOMAIN,
  FRAMECOMMIT_DOMAIN,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 Фаза 4 · ИНК3 — CONV meta-assert (B3 anon-publish migration).
//
// CONV (publish_kind=PRIVATE) and RECOVERY (publish_kind=RECOVERY) share an IDENTICAL 320-bit header0 length.
// The receive path therefore cannot tell them apart by shape — the ONLY on-chain discriminator is the batch-level
// publish_kind cross-checked against the publishKind embedded in header0 byte@5. ИНК3 binds them:
// throwUnless(13519, privateHeaderPublishKind(header0) == msg.publish_kind) in the private (CONV) branch. This is
// LOAD-BEARING: without it a mislabeled RECOVERY capsule would land in the 1-year CONV pool and be evicted,
// permanently losing the user's K_root.
//
// B3 migration note: the old Vault-forwarded PublishBatchToHub path is gone. The sole publish path is the
// permissionless PublishAnonBatch, per-part authorized by a spend-token. The receiver order is verifyIssuerToken
// (token integrity) → lane-parse (13510..13519) → spend_sig (13605). To REACH the 13519 lane-parse assert the
// spend-token must be VALID; so the bad frame below carries a valid token whose spend_sig commits to the exact
// (mislabeled) header0 — only header0 byte@5 disagrees with the batch publish_kind.

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');

// A well-formed 320-bit (40-byte, 1 cell, 0 refs) CONV header0 with an explicit publishKind at byte@5. The Hub's
// privateHeaderPublishKind reads byte@5 only (skip 40 bits meta, then load 8); magic/version are shape-fill.
function convHeader0WithPublishKind(publishKind: number): Cell {
  const bytes = Buffer.alloc(FINAL_PRIVATE_HEADER0_BYTES, 0x44);
  bytes.write('PH0C', 0, 'ascii'); // magic
  bytes[4] = 1; // version
  bytes[5] = publishKind; // byte@5 = embedded publishKind (bits[40,48)) — the sole 13519 discriminator
  bytes[6] = 1; // sizeClass
  bytes[7] = 2; // cryptoSuite = HYBRID
  return snakeCellFromBytes(bytes);
}

// Build a single CONV (publish_kind=PRIVATE) part frame AND its parallel spend-token, mirroring anon.ts convPartToken
// exactly, but with a CALLER-SUPPLIED header0 cell so a negative test can mislabel byte@5 while keeping a valid token
// (the token's spend_sig commits to this header0's REAL hash, so verifyIssuerToken + spend_sig both pass and control
// reaches the CONV lane-parse 13519 assert). Single part → isLast, no `next` refs.
function convPartCustomH0(opts: {
  issuer: KeyPair; spend: KeyPair; slot: bigint; epoch: bigint; nonce: bigint; header0: Cell; fill?: number;
}): { part: Cell; tok: Cell } {
  const size = SIZE_1K;
  const f = opts.fill ?? 0;
  const h0 = opts.header0;
  const h1 = finalPrivateHeader1Cell(0x31 + f);
  const body = finalPrivateBodyCell(size, 0x40 + f);
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

  // spend_sig commits to the REAL frame scalars (incl. this header0's hash) → checkSignature over the part passes.
  const frameCommit = bufToInt(beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256)
    .endCell().hash());
  const spendDigestBuf = beginCell()
    .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(KIND_PRIVATE, 8)
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

describe('CapsuleHub CONV meta-assert (clean-16 Фаза 4 ИНК3, B3 anon path)', () => {
  it('META-ASSERT-01: the CONV branch binds header0 byte@5 to the batch publish_kind (13519)', () => {
    expect(HUB, 'CONV meta-assert present').toMatch(
      /throwUnless\(13519,\s*self\.privateHeaderPublishKind\(header0\)\s*==\s*msg\.publish_kind\)/,
    );
  });

  it('META-ASSERT-02: a CONV part whose header0 publishKind != batch kind bounces (13519), nothing stored', async () => {
    const env: any = await deployAnonReady({ credits: 4n });
    const relay = await env.blockchain.treasury('meta-relay');

    // header0 byte@5 = 2 (PUBLIC) but the batch is publish_kind = PRIVATE(1) -> mislabel -> reject before storing.
    // The token is fully valid (verifyIssuerToken + spend_sig pass), so control reaches the CONV lane-parse assert.
    const bad = convPartCustomH0({
      issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 500n,
      header0: convHeader0WithPublishKind(2), fill: 1,
    });
    const badRes = await env.hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({
      parts: bad.part, tokens: bad.tok, partCount: 1n, kind: KIND_PRIVATE,
    }));
    expect(hubTxExit(badRes, env.hub)).toBe(13519);
    expect((await env.hub.getGetState()).private_latest_id).toBe(0n);   // fail-closed: nothing stored

    // The SAME shape with a matching byte@5 = 1 (PRIVATE/CONV) stores exactly one entry.
    const good = convPartCustomH0({
      issuer: env.issuer, spend: spendKey(1), slot: env.slot, epoch: env.nowEpoch, nonce: 501n,
      header0: convHeader0WithPublishKind(1), fill: 2,
    });
    const goodRes = await env.hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({
      parts: good.part, tokens: good.tok, partCount: 1n, kind: KIND_PRIVATE,
    }));
    expect(hubTxExit(goodRes, env.hub)).toBe(0);
    expect((await env.hub.getGetState()).private_latest_id).toBe(1n);
  });
});
