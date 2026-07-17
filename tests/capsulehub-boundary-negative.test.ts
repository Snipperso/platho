import { describe, expect, it } from 'vitest';
import { beginCell, Cell, toNano } from '@ton/core';
import { KeyPair, sign } from '@ton/crypto';
import { webcrypto } from 'crypto';
import {
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPrivateBodyCell,
  finalPublicHeaderCell,
  finalPublicBodyCell,
  snakeCell,
} from './helpers/capsule-cells';
import {
  SIZE_1K,
  SUITE_HYBRID,
  KIND_PRIVATE,
  KIND_PUBLIC,
  cellHash,
  marketingCell,
  refChainCell,
  hubTxExit,
} from './helpers/vpb2';
import {
  ISSUER_SIG_DOMAIN,
  SPEND_DOMAIN,
  FRAMECOMMIT_DOMAIN,
  bufToInt,
  spendKey,
  deployAnonReady,
  anonBatch,
  PartToken,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// CapsuleHub payload-shape boundary negative matrix — clean-16 B3 migration onto the permissionless PublishAnonBatch
// ingest (op 0x50415542). The old Vault-forwarded PublishBatchToHub path (sender()==vault, a relay-declared
// protocol_fee_total, an address-keyed author index) is GONE; publish is now an INTERNAL message from ANY treasury,
// authorized per-part by a spend token (issuer_sig over the serial + spend_sig over the frame) drawn from a prepaid
// per-epoch pool. deployAnonReady sets up the bound+sealed pair, mirrors one issuer slot, and funds the pool.
//
// The lane-parse / integrity gates (13510-13558) are PRESERVED verbatim from the Vault path, so this matrix still
// asserts the exact same shape/hash exit codes — it just reaches them through a valid spend token instead of the
// removed Vault gate. Receiver check order (per part): verifyIssuerToken FIRST, THEN lane-parse (13510-13527),
// THEN spend_sig (13605), THEN spendPoolCredit (13613). Every shape/hash gate therefore fires BEFORE spend_sig, so a
// bad frame reaches its lane-parse code even when the token happens to commit to that same (bad) frame.

// The Hub accrues protocolFee from its OWN constants (a relay cannot spoof it): PLATO_PRIVATE_LONG_TERM_FEE_TON and
// PLATO_PUBLIC_POST_FEE_TON, both 0.01 GRAM per stored part.
const PLATO_FEE_PER_PART = 10_000_000n;

// ---------------------------------------------------------------------------
// Local part+token builders. These mirror the anon.ts kit but expose per-CELL and per-declared-HASH override knobs the
// payload-shape negatives need (feed a wrong-sized cell, or declare a hash that lies about the ref). The token always
// COMMITS to the frame's declared scalars; for a shape/hash negative the receiver throws at the lane-parse gate before
// it ever checks spend_sig, so a committing token is equivalent to a bare valid issuer token there. Kept local because
// anon.ts (the shared kit) must not be edited and its convPartToken/publicPartToken have no cell-level overrides.
// ---------------------------------------------------------------------------

function convCommit(opts: {
  issuer: KeyPair; spend: KeyPair; slot: bigint; epoch: bigint; nonce: bigint;
  header0?: Cell; header1?: Cell; body?: Cell;
  h0?: bigint; h1?: bigint; bh?: bigint;             // declared-hash overrides (default = cellHash of the cell)
  next?: PartToken | null;
}): PartToken {
  const size = SIZE_1K;
  const header0 = opts.header0 ?? finalPrivateHeader0Cell(0x30);
  const header1 = opts.header1 ?? finalPrivateHeader1Cell(0x31);
  const body = opts.body ?? finalPrivateBodyCell(SIZE_1K, 0x40);
  const h0 = opts.h0 ?? cellHash(header0);
  const h1 = opts.h1 ?? cellHash(header1);
  const bh = opts.bh ?? cellHash(body);

  const pb = beginCell()
    .storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256)
    .storeRef(header0).storeRef(header1).storeRef(body);
  if (opts.next) pb.storeRef(opts.next.part);
  const part = pb.endCell();

  const spendPub = bufToInt(opts.spend.publicKey);
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64).endCell().hash();
  const serial = bufToInt(serialBuf);
  const issuerSig = sign(serialBuf, opts.issuer.secretKey);
  const frameCommit = bufToInt(beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell().hash());
  const spendSig = sign(beginCell()
    .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(KIND_PRIVATE, 8)
    .storeUint(frameCommit, 256).endCell().hash(), opts.spend.secretKey);

  const tb = beginCell()
    .storeUint(serial, 256).storeUint(opts.slot, 8).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .storeRef(beginCell().storeBuffer(issuerSig).endCell())
    .storeRef(beginCell().storeBuffer(spendSig).endCell());
  if (opts.next) tb.storeRef(opts.next.tok);
  return { part, tok: tb.endCell(), serial, spendPub };
}

function publicCommit(opts: {
  issuer: KeyPair; spend: KeyPair; slot: bigint; epoch: bigint; nonce: bigint;
  header?: Cell; body?: Cell; h0?: bigint; bh?: bigint;
  reserved?: bigint; parentLink?: bigint; sizeClass?: bigint;
  next?: PartToken | null;
}): PartToken {
  const size = opts.sizeClass ?? SIZE_1K;
  const reserved = opts.reserved ?? 0n;
  const parentLink = opts.parentLink ?? 0n;
  const header = opts.header ?? finalPublicHeaderCell(0x50, 8);
  const body = opts.body ?? finalPublicBodyCell(0x40, Number(size) * 1024);
  const h0 = opts.h0 ?? cellHash(header);
  const bh = opts.bh ?? cellHash(body);

  const pb = beginCell()
    .storeUint(size, 8).storeUint(reserved, 8).storeUint(parentLink, 64)
    .storeUint(h0, 256).storeUint(bh, 256)
    .storeRef(header).storeRef(body);
  if (opts.next) pb.storeRef(opts.next.part);
  const part = pb.endCell();

  const spendPub = bufToInt(opts.spend.publicKey);
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64).endCell().hash();
  const serial = bufToInt(serialBuf);
  const issuerSig = sign(serialBuf, opts.issuer.secretKey);
  const frameCommit = bufToInt(beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(size, 8).storeUint(reserved, 8).storeUint(parentLink, 64)
    .storeUint(h0, 256).storeUint(bh, 256).endCell().hash());
  const spendSig = sign(beginCell()
    .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(KIND_PUBLIC, 8)
    .storeUint(frameCommit, 256).endCell().hash(), opts.spend.secretKey);

  const tb = beginCell()
    .storeUint(serial, 256).storeUint(opts.slot, 8).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .storeRef(beginCell().storeBuffer(issuerSig).endCell())
    .storeRef(beginCell().storeBuffer(spendSig).endCell());
  if (opts.next) tb.storeRef(opts.next.tok);
  return { part, tok: tb.endCell(), serial, spendPub };
}

// deployAnonReady + a permissionless relay treasury (the publish is not gated on WHO sends it).
async function setup(credits: bigint) {
  const env: any = await deployAnonReady({ credits });
  env.relay = await env.blockchain.treasury('bnd-relay');
  return env;
}

// A CapsuleHubBatchAck (op 0x874E5771) lands at `addr` (now the RELAY, not the Vault). Match the exact opcode on a
// NON-bounced internal message, so a bounced-back underfunded batch (which also returns to the relay) is not a false ACK.
const ACK_OP = 0x874e5771;
const ackTo = (res: any, addr: any) => res.transactions.find((t: any) => {
  if (t.inMessage?.info?.type !== 'internal' || t.inMessage.info.bounced) return false;
  if (t.inMessage.info.dest?.toString() !== addr.toString()) return false;
  const body = t.inMessage.body?.beginParse();
  return body && body.remainingBits >= 32 && body.loadUint(32) === ACK_OP;
});

describe('CapsuleHub anon-publish payload-shape boundary negative matrix', () => {
  // CAPSULE-BND-01: the original asserted the single-publish value boundary (min-1 reject + exact/surcharge accept).
  // On the anon path the endowment is PREPAID on-balance (not brought by the relay); the relay only covers gas + ack.
  // The Phase-A lower bound is 13509 (context().value >= part_count*HUB_MIN_PER_PART_VALUE + ACK_FORWARD_RESERVE,
  // checked BEFORE any token verify). Re-expressed as: a grossly underfunded batch bounces (13509) and stores nothing;
  // an adequately funded one stores; and a larger surcharge still stores exactly one more (no double counting).
  it('CAPSULE-BND-01: relay value lower bound — underfunded bounces (13509), funded stores, surcharge stores one', async () => {
    const env = await setup(3n);
    const a = convCommit({ issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 101n });

    // Under the 13509 floor (1*1M + 30M ack = 0.031) → bounces, nothing stored (token never even parsed).
    const under = await env.hub.send(env.relay.getSender(), { value: toNano('0.025') },
      anonBatch({ parts: a.part, tokens: a.tok, partCount: 1n }));
    expect(hubTxExit(under, env.hub)).toBe(13509);
    expect((await env.hub.getGetState()).private_latest_id).toBe(0n);

    // Same batch, adequately funded → stores (the underfunded attempt reverted, so its serial is still fresh).
    await env.hub.send(env.relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: a.part, tokens: a.tok, partCount: 1n }));
    expect((await env.hub.getGetState()).private_latest_id).toBe(1n);

    // A larger surcharge stores exactly one more (distinct token) — no double counting / over-charge.
    const b = convCommit({ issuer: env.issuer, spend: spendKey(1), slot: env.slot, epoch: env.nowEpoch, nonce: 102n });
    await env.hub.send(env.relay.getSender(), { value: toNano('0.7') },
      anonBatch({ parts: b.part, tokens: b.tok, partCount: 1n }));
    const state = await env.hub.getGetState();
    expect(state.private_latest_id).toBe(2n);
    expect(state.private_live_count).toBe(2n);
  });

  // RT-VCAPS-004: a surcharge above the required value never inflates accrued_plato_fee_ton. On the anon path the Hub
  // accrues ONLY its OWN per-part constant (privateFullFee / PLATO_PUBLIC_POST_FEE_TON) — the relay-declared
  // protocol_fee_total field is REMOVED, so the fee is independent of how much GRAM the relay forwarded. Probed
  // private + public across two surcharge levels: accrued == exactly one part's protocol fee, regardless of value.
  it.each([
    ['private', toNano('0.2')],
    ['private', toNano('1')],
    ['public', toNano('0.4')],
    ['public', toNano('1')],
  ] as const)('RT-VCAPS-004: %s surcharge %s never increases accrued_plato_fee_ton', async (kind, value) => {
    const env = await setup(2n);
    const isPrivate = kind === 'private';
    const pt = isPrivate
      ? convCommit({ issuer: env.issuer, spend: spendKey(2), slot: env.slot, epoch: env.nowEpoch, nonce: 210n })
      : publicCommit({ issuer: env.issuer, spend: spendKey(3), slot: env.slot, epoch: env.nowEpoch, nonce: 211n });

    await env.hub.send(env.relay.getSender(), { value }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n,
      kind: isPrivate ? KIND_PRIVATE : KIND_PUBLIC,
      marketing: isPrivate ? null : marketingCell(),
    }));

    const state = await env.hub.getGetState();
    if (isPrivate) expect(state.private_latest_id).toBe(1n);
    else expect(state.public_latest_id).toBe(1n);
    // accrued == exactly one part's protocol fee (the Hub's OWN constant), NOT the forwarded surcharge.
    expect(state.accrued_plato_fee_ton).toBe(PLATO_FEE_PER_PART);
  });

  // CAPSULE-BND-02: the original enforced the per-size-class exact value boundary on the single-publish path. On the
  // anon path the full gas requirement scales with part_count via the post-walk gate 13530 (context().value >=
  // getComputeFee(base) + ack + sum per-part(getComputeFee(part_gas)+getComputeFee(token_verify))) — NOT the endowment,
  // which is prepaid. Re-expressed as: a 3-part batch funded above the cheap Phase-A floor (13509) but below the full
  // gas requirement bounces with 13530 and stores nothing; the same parts adequately funded store all three.
  it('CAPSULE-BND-02: full gas gate (13530) — under-gassed multi-part bounces, funded stores all parts', async () => {
    const env = await setup(5n);
    // 3 linked CONV parts, distinct spend keys + nonces (each part spends one credit; funded 5).
    const build = () => {
      const p2 = convCommit({ issuer: env.issuer, spend: spendKey(12), slot: env.slot, epoch: env.nowEpoch, nonce: 503n });
      const p1 = convCommit({ issuer: env.issuer, spend: spendKey(11), slot: env.slot, epoch: env.nowEpoch, nonce: 502n, next: p2 });
      const p0 = convCommit({ issuer: env.issuer, spend: spendKey(10), slot: env.slot, epoch: env.nowEpoch, nonce: 501n, next: p1 });
      return p0;
    };

    // Above the 13509 floor (3*1M + 30M = 0.033) but below the full gas requirement → 13530, nothing stored.
    const starved = build();
    const under = await env.hub.send(env.relay.getSender(), { value: toNano('0.05') },
      anonBatch({ parts: starved.part, tokens: starved.tok, partCount: 3n }));
    expect(hubTxExit(under, env.hub)).toBe(13530);
    expect((await env.hub.getGetState()).private_latest_id).toBe(0n);

    // Adequately funded: all 3 CONV entries store (the starved attempt reverted, so the serials are still fresh).
    const funded = build();
    await env.hub.send(env.relay.getSender(), { value: toNano('2') },
      anonBatch({ parts: funded.part, tokens: funded.tok, partCount: 3n }));
    expect((await env.hub.getGetState()).private_latest_id).toBe(3n);

    // And a PUBLIC batch stores under adequate funding.
    const pub = publicCommit({ issuer: env.issuer, spend: spendKey(13), slot: env.slot, epoch: env.nowEpoch, nonce: 504n });
    await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: pub.part, tokens: pub.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect((await env.hub.getGetState()).public_latest_id).toBe(1n);
  });

  // CAPSULE-BND-03: the original observed the successful-ingest ACK to the bound Vault. On the anon path the ingest
  // ACKs the RELAY that sent the batch (permissionless — there is no bound-Vault ACK target anymore); an underfunded
  // batch bounces (13509) with no store and no ACK. Re-expressed against both CONV + PUBLIC paths, asserting the ACK
  // reaches the relay.
  it('CAPSULE-BND-03: a successful batch ACKs the relay; an underfunded batch bounces with no commit', async () => {
    const env = await setup(3n);

    // Underfunded CONV: bounces (13509), nothing stored, no ACK.
    const a = convCommit({ issuer: env.issuer, spend: spendKey(14), slot: env.slot, epoch: env.nowEpoch, nonce: 301n });
    const under = await env.hub.send(env.relay.getSender(), { value: toNano('0.025') },
      anonBatch({ parts: a.part, tokens: a.tok, partCount: 1n }));
    expect(hubTxExit(under, env.hub)).toBe(13509);
    expect((await env.hub.getGetState()).private_latest_id).toBe(0n);
    expect(ackTo(under, env.relay.address)).toBeUndefined();

    // Funded CONV: stores and ACKs the relay.
    const okPriv = await env.hub.send(env.relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: a.part, tokens: a.tok, partCount: 1n }));
    expect((await env.hub.getGetState()).private_latest_id).toBe(1n);
    expect(ackTo(okPriv, env.relay.address)).toBeDefined();

    // Funded PUBLIC: stores and ACKs the relay.
    const b = publicCommit({ issuer: env.issuer, spend: spendKey(15), slot: env.slot, epoch: env.nowEpoch, nonce: 302n });
    const okPub = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: b.part, tokens: b.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect((await env.hub.getGetState()).public_latest_id).toBe(1n);
    expect(ackTo(okPub, env.relay.address)).toBeDefined();
  });

  // CAPSULE-BND-04: the public marketing marker is REQUIRED and must carry the exact ASCII note. Both legs are live
  // Phase-A gates (throwUnless 13507 null / 13508 wrong value), checked before the per-part loop, so a valid token is
  // present but never parsed. Preserved verbatim from the Vault path.
  it('CAPSULE-BND-04: a public batch with a missing (13507) or wrong (13508) marketing marker is rejected', async () => {
    const missing = await setup(2n);
    const m = publicCommit({ issuer: missing.issuer, spend: spendKey(16), slot: missing.slot, epoch: missing.nowEpoch, nonce: 401n });
    const r1 = await missing.hub.send(missing.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: m.part, tokens: m.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: null }));
    expect(hubTxExit(r1, missing.hub)).toBe(13507);
    expect((await missing.hub.getGetState()).public_latest_id).toBe(0n);

    const wrong = await setup(2n);
    const w = publicCommit({ issuer: wrong.issuer, spend: spendKey(17), slot: wrong.slot, epoch: wrong.nowEpoch, nonce: 402n });
    const r2 = await wrong.hub.send(wrong.relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: w.part, tokens: w.tok, partCount: 1n, kind: KIND_PUBLIC,
      marketing: beginCell().storeUint(1n, 152).endCell(), // 152-bit cell, but not the PLATHO marker ASCII
    }));
    expect(hubTxExit(r2, wrong.hub)).toBe(13508);
    expect((await wrong.hub.getGetState()).public_latest_id).toBe(0n);
  });

  // CAPSULE-BND-05: removed — the marketing-marker serialization was a Vault-message-body assertion on the removed
  // single-publish path; the marker is now a standalone marketing cell (marketingCell()), asserted by 13507/13508.

  // CAPSULE-PAYLOAD-01: a declared hash field that does not match the actual ref cell hash is rejected. Private body
  // hash mismatch -> 13517; public body hash mismatch -> 13526 (both fire during the part walk, before spend_sig).
  it('CAPSULE-PAYLOAD-01: declared hash != cell hash is rejected (private 13517 / public 13526)', async () => {
    const env = await setup(2n);

    // Private: body_hash field lies about the body ref (declared = a DIFFERENT body's hash).
    const priv = convCommit({
      issuer: env.issuer, spend: spendKey(18), slot: env.slot, epoch: env.nowEpoch, nonce: 511n,
      bh: cellHash(finalPrivateBodyCell(SIZE_1K, 0x99)),
    });
    const privRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: priv.part, tokens: priv.tok, partCount: 1n }));
    expect(hubTxExit(privRes, env.hub)).toBe(13517);

    // Public: body_hash field lies about the body ref.
    const pub = publicCommit({
      issuer: env.issuer, spend: spendKey(19), slot: env.slot, epoch: env.nowEpoch, nonce: 512n,
      bh: cellHash(finalPublicBodyCell(0x99, 1024)),
    });
    const pubRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: pub.part, tokens: pub.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(pubRes, env.hub)).toBe(13526);

    const state = await env.hub.getGetState();
    expect(state.private_latest_id).toBe(0n);
    expect(state.public_latest_id).toBe(0n);
  });

  // CAPSULE-PAYLOAD-02: final private headers are STORED verbatim (recovered from the entry), while the body is
  // authenticated by hash only (not stored). A valid CONV batch stores the entry; the stored header cells hash-match
  // the supplied headers and the entry records body_hash.
  it('CAPSULE-PAYLOAD-02: private headers stored verbatim, body authenticated by hash only', async () => {
    const env = await setup(2n);
    const header0 = finalPrivateHeader0Cell(0x68);
    const header1 = finalPrivateHeader1Cell(0x69);
    const body = finalPrivateBodyCell(SIZE_1K, 0x62);
    const pt = convCommit({ issuer: env.issuer, spend: spendKey(20), slot: env.slot, epoch: env.nowEpoch, nonce: 601n, header0, header1, body });

    await env.hub.send(env.relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));

    const stored = await env.hub.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.header_0.hash().toString('hex')).toBe(header0.hash().toString('hex'));
    expect(stored.header_1.hash().toString('hex')).toBe(header1.hash().toString('hex'));
    expect(stored.body_hash).toBe(cellHash(body)); // body kept by hash, not stored
    const page = await env.hub.getGetPrivatePage(0n);
    expect(page.exists).toBe(true);
    expect(page.entry_count).toBe(1n);
  }, 30000);

  // CAPSULE-PAYLOAD-02B: a private header/body whose declared hash matches but whose byte SIZE is wrong is rejected by
  // the exact-shape gate (header_0 -> 13514, body -> 13518). requireExactPayloadCell checks cells/bits/refs after the
  // hash check, with the size exit being the second of each pair. header_0 is now the CONV 320-bit / 40-byte shape.
  it('CAPSULE-PAYLOAD-02B: private header/body wrong byte size rejected (13514 header0 / 13518 body)', async () => {
    const env = await setup(2n);

    // Wrong header_0 size: 35 bytes (280 bits) instead of 40 bytes (320 bits); declared hash matches the wrong cell,
    // so the hash gate (13513) passes and the shape gate (13514) is what fires.
    const wrongHeader0 = snakeCell(35, 0x68);
    const h0Res = await env.hub.send(env.relay.getSender(), { value: toNano('0.2') }, anonBatch({
      parts: convCommit({ issuer: env.issuer, spend: spendKey(21), slot: env.slot, epoch: env.nowEpoch, nonce: 611n, header0: wrongHeader0 }).part,
      tokens: convCommit({ issuer: env.issuer, spend: spendKey(21), slot: env.slot, epoch: env.nowEpoch, nonce: 611n, header0: wrongHeader0 }).tok,
      partCount: 1n,
    }));
    expect(hubTxExit(h0Res, env.hub)).toBe(13514);

    // Wrong body size: 1139 bytes instead of 2228 (1K hybrid).
    const wrongBody = snakeCell(1139, 0x62);
    const bodyPt = convCommit({ issuer: env.issuer, spend: spendKey(22), slot: env.slot, epoch: env.nowEpoch, nonce: 612n, body: wrongBody });
    const bodyRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: bodyPt.part, tokens: bodyPt.tok, partCount: 1n }));
    expect(hubTxExit(bodyRes, env.hub)).toBe(13518);

    expect((await env.hub.getGetState()).private_latest_id).toBe(0n);
  }, 30000);

  // CAPSULE-PAYLOAD-03: public size-class bounds. An allowed class (1K) stores; a body that overflows the class's
  // cell/bit envelope is rejected by the public body shape gate (13527). A disallowed size_class value (3) is rejected
  // by the size-class allow-list gate (13522).
  it('CAPSULE-PAYLOAD-03: public size class bounds — overflow 13527, disallowed class 13522', async () => {
    const env = await setup(3n);

    // Allowed 1K class with a correctly sized body stores.
    const ok = publicCommit({ issuer: env.issuer, spend: spendKey(23), slot: env.slot, epoch: env.nowEpoch, nonce: 701n, sizeClass: SIZE_1K });
    await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: ok.part, tokens: ok.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect((await env.hub.getGetState()).public_latest_id).toBe(1n);

    // 1K class but a body one byte over the class envelope -> public payload shape gate (13527).
    const overflow = publicCommit({ issuer: env.issuer, spend: spendKey(24), slot: env.slot, epoch: env.nowEpoch, nonce: 702n, sizeClass: SIZE_1K, body: snakeCell(1025, 0x6e) });
    const overRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: overflow.part, tokens: overflow.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(overRes, env.hub)).toBe(13527);

    // A size_class value that is not in the allow list (3) -> 13522.
    const badClass = publicCommit({ issuer: env.issuer, spend: spendKey(25), slot: env.slot, epoch: env.nowEpoch, nonce: 703n, sizeClass: 3n });
    const badRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: badClass.part, tokens: badClass.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(badRes, env.hub)).toBe(13522);

    expect((await env.hub.getGetState()).public_latest_id).toBe(1n);
  }, 30000);

  // CAPSULE-PAYLOAD-04: the public header is bounded to one byte-aligned cell with no refs. The max valid header (72
  // bytes) stores; a header carrying a ref, or one over the byte cap, is rejected by the public header shape gate
  // (13525).
  it('CAPSULE-PAYLOAD-04: public header must be a single byte-aligned ref-free cell (13525)', async () => {
    const env = await setup(3n);

    // Max valid header (72 bytes) stores.
    const maxHeader = finalPublicHeaderCell(0x51, 72);
    const ok = publicCommit({ issuer: env.issuer, spend: spendKey(26), slot: env.slot, epoch: env.nowEpoch, nonce: 711n, header: maxHeader });
    await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: ok.part, tokens: ok.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect((await env.hub.getGetState()).public_latest_id).toBe(1n);

    // Header carrying a ref violates the ref-free shape -> 13525.
    const refHeader = beginCell()
      .storeBuffer(Buffer.alloc(8, 0x53))
      .storeRef(beginCell().storeUint(0x54, 8).endCell())
      .endCell();
    const refPt = publicCommit({ issuer: env.issuer, spend: spendKey(27), slot: env.slot, epoch: env.nowEpoch, nonce: 712n, header: refHeader });
    const refRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: refPt.part, tokens: refPt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(refRes, env.hub)).toBe(13525);

    // Over-large header (73 bytes > 72) also -> 13525.
    const bigPt = publicCommit({ issuer: env.issuer, spend: spendKey(28), slot: env.slot, epoch: env.nowEpoch, nonce: 713n, header: finalPublicHeaderCell(0x52, 73) });
    const bigRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: bigPt.part, tokens: bigPt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(bigRes, env.hub)).toBe(13525);

    expect((await env.hub.getGetState()).public_latest_id).toBe(1n);
  }, 30000);

  // CAPSULE-PAYLOAD-05: the public body cannot be empty, non-byte-aligned, or exceed the size-class ref envelope.
  // Empty / unaligned / ref-overflow bodies are all rejected by the public payload shape gate (13527).
  it('CAPSULE-PAYLOAD-05: public body empty / unaligned / too-many-refs rejected (13527)', async () => {
    const env = await setup(2n);

    const emptyPt = publicCommit({ issuer: env.issuer, spend: spendKey(29), slot: env.slot, epoch: env.nowEpoch, nonce: 721n, body: beginCell().endCell() });
    const emptyRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: emptyPt.part, tokens: emptyPt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(emptyRes, env.hub)).toBe(13527);

    const unalignedPt = publicCommit({ issuer: env.issuer, spend: spendKey(30), slot: env.slot, epoch: env.nowEpoch, nonce: 722n, body: beginCell().storeUint(1, 1).endCell() });
    const unalignedRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: unalignedPt.part, tokens: unalignedPt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(unalignedRes, env.hub)).toBe(13527);

    // A ref chain longer than the 1K class envelope (9 cells / 8 refs) -> ref overflow.
    const refPt = publicCommit({ issuer: env.issuer, spend: spendKey(31), slot: env.slot, epoch: env.nowEpoch, nonce: 723n, body: refChainCell(12) });
    const refRes = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: refPt.part, tokens: refPt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell() }));
    expect(hubTxExit(refRes, env.hub)).toBe(13527);

    expect((await env.hub.getGetState()).public_latest_id).toBe(0n);
  }, 30000);

  // CAPSULE-BND-06: removed — it asserted the removed relay-declared protocol_fee_total==0 -> accrued_plato_fee_ton==0
  // semantic. On the anon path the fee is the Hub's OWN constant (a relay cannot declare a zero fee), so a "zero-fee"
  // public batch no longer exists. The surviving "public stores + ACKs" coverage lives in CAPSULE-BND-03 / -PAYLOAD-03.
});
