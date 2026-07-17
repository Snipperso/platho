import { describe, expect, it } from 'vitest';
import { beginCell, Cell, toNano } from '@ton/core';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { webcrypto } from 'crypto';
import {
  SIZE_1K,
  SIZE_32K,
  SUITE_HYBRID,
  KIND_PRIVATE,
  KIND_PUBLIC,
  cellHash,
  hubTxExit,
  marketingCell,
  deployBoundSealedPair,
} from './helpers/vpb2';
import {
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPrivateBodyCell,
  finalIntroHeader0Cell,
  finalIntroBodyCell,
  finalPublicHeaderCell,
  finalPublicBodyCell,
  snakeCellFromBytes,
  FINAL_PRIVATE_HEADER0_BYTES,
} from './helpers/capsule-cells';

const KIND_INTRO = 3n;
const KIND_RECOVERY = 4n;
const PUBLIC_CHANNEL_DOMAIN = 0x42504331n;   // "BPC1"
const RECOVERY_SLOT_DOMAIN = 0x42525331n;    // "BRS1"

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 anon-publish spend-token validation. This exercises the WHOLE new permissionless path on real
// ed25519: issuer_sig over the serial, spend_sig over (serial ‖ kind ‖ frameCommit), the epoch-nullifier
// double-spend ledger, and the prepaid per-epoch pool guard. The relay is an arbitrary wallet (permissionless).

// Domains — MUST mirror CapsuleHub.tact exactly.
const ISSUER_SIG_DOMAIN = 0x42534931n;   // "BSI1"
const SPEND_DOMAIN = 0x42535031n;        // "BSP1"
const FRAMECOMMIT_DOMAIN = 0x42464331n;  // "BFC1"
const EPOCH_SECONDS = 86400;
const PREPAID_UNIT = 23_100_000n;        // CAPSULEHUB_PREPAID_UNIT

const NONZERO_PUBLISH_ID = 0x51A7B0B3B3B0000000000000000000000000000000000000000000000005EED1n;

const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));

interface PartToken { part: Cell; tok: Cell; serial: bigint; spendPub: bigint; }

// Build a CONV part frame AND its parallel spend-token from ONE set of scalars, so the token's frameCommit binds
// the exact bytes the Hub re-derives from the part. Override knobs let negative tests desync one field.
function convPartToken(opts: {
  issuer: KeyPair;
  spend: KeyPair;
  slot: bigint;
  epoch: bigint;
  nonce: bigint;
  fill?: number;
  next?: PartToken | null;
  kind?: bigint;                   // KIND_PRIVATE (default) or KIND_INTRO — same token machinery, different frame
  // negatives:
  serialOverride?: bigint;         // corrupt the token's declared serial (13601)
  issuerSigKey?: KeyPair;          // sign the serial with a wrong issuer key (13603)
  spendSigFrame?: { h0: bigint; h1: bigint; bh: bigint } | null; // sign spend_sig over a DIFFERENT frame (13605)
}): PartToken {
  const size = SIZE_1K;
  const kind = opts.kind ?? KIND_PRIVATE;
  const isIntro = kind === KIND_INTRO;
  const f = opts.fill ?? 0;
  const h0 = isIntro ? finalIntroHeader0Cell(0x30 + f) : finalPrivateHeader0Cell(0x30 + f);
  const h1 = finalPrivateHeader1Cell(0x31 + f);
  const body = isIntro ? finalIntroBodyCell(size, 0x40 + f) : finalPrivateBodyCell(size, 0x40 + f);
  const h0h = cellHash(h0);
  const h1h = cellHash(h1);
  const bh = cellHash(body);

  const pb = beginCell()
    .storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256)
    .storeRef(h0).storeRef(h1).storeRef(body);
  if (opts.next) pb.storeRef(opts.next.part);
  const part = pb.endCell();

  const spendPub = bufToInt(opts.spend.publicKey);

  // serial = H(ISSUER_SIG_DOMAIN ‖ spendPub ‖ epoch ‖ nonce)
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .endCell().hash();
  const trueSerial = bufToInt(serialBuf);
  const declaredSerial = opts.serialOverride ?? trueSerial;
  // issuer signs the TRUE serial (the value it blind-signed); a wrong key models a forged/other-slot issuer_sig.
  const issuerKey = opts.issuerSigKey ?? opts.issuer;
  const issuerSig = sign(serialBuf, issuerKey.secretKey);

  // spend_sig over (SPEND_DOMAIN ‖ serial ‖ kind ‖ frameCommit); frameCommit binds the frame scalars.
  const frame = opts.spendSigFrame ?? { h0: h0h, h1: h1h, bh };
  const frameCommit = bufToInt(beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(frame.h0, 256).storeUint(frame.h1, 256).storeUint(frame.bh, 256)
    .endCell().hash());
  const spendDigestBuf = beginCell()
    .storeUint(SPEND_DOMAIN, 32).storeUint(declaredSerial, 256).storeUint(kind, 8)
    .storeUint(frameCommit, 256)
    .endCell().hash();
  const spendSig = sign(spendDigestBuf, opts.spend.secretKey);

  const tb = beginCell()
    .storeUint(declaredSerial, 256).storeUint(opts.slot, 8).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .storeRef(beginCell().storeBuffer(issuerSig).endCell())
    .storeRef(beginCell().storeBuffer(spendSig).endCell());
  if (opts.next) tb.storeRef(opts.next.tok);
  const tok = tb.endCell();

  return { part, tok, serial: declaredSerial, spendPub };
}

// PUBLIC part frame (592 bits) + its token. channel_id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pubkey).
function publicPartToken(opts: {
  issuer: KeyPair; spend: KeyPair; slot: bigint; epoch: bigint; nonce: bigint;
  fill?: number; reserved?: bigint; parentLink?: bigint; sizeClass?: bigint; next?: PartToken | null;
}): PartToken {
  const size = opts.sizeClass ?? SIZE_1K;
  const f = opts.fill ?? 0;
  const reserved = opts.reserved ?? 0n;
  const parentLink = opts.parentLink ?? 0n;
  const header = finalPublicHeaderCell(0x50, 8);
  const body = finalPublicBodyCell(0x40 + f, Number(size) * 1024);
  const h0h = cellHash(header);
  const bh = cellHash(body);

  const pb = beginCell()
    .storeUint(size, 8).storeUint(reserved, 8).storeUint(parentLink, 64)
    .storeUint(h0h, 256).storeUint(bh, 256)
    .storeRef(header).storeRef(body);
  if (opts.next) pb.storeRef(opts.next.part);
  const part = pb.endCell();

  const spendPub = bufToInt(opts.spend.publicKey);
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .endCell().hash();
  const serial = bufToInt(serialBuf);
  const issuerSig = sign(serialBuf, opts.issuer.secretKey);

  // PUBLIC frameCommit binds size, reserved, parentLink, h0, bh (§3.3 public variant).
  const frameCommit = bufToInt(beginCell()
    .storeUint(FRAMECOMMIT_DOMAIN, 32).storeUint(size, 8).storeUint(reserved, 8).storeUint(parentLink, 64)
    .storeUint(h0h, 256).storeUint(bh, 256)
    .endCell().hash());
  const spendDigestBuf = beginCell()
    .storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(KIND_PUBLIC, 8)
    .storeUint(frameCommit, 256)
    .endCell().hash();
  const spendSig = sign(spendDigestBuf, opts.spend.secretKey);

  const tb = beginCell()
    .storeUint(serial, 256).storeUint(opts.slot, 8).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .storeRef(beginCell().storeBuffer(issuerSig).endCell())
    .storeRef(beginCell().storeBuffer(spendSig).endCell());
  if (opts.next) tb.storeRef(opts.next.tok);
  return { part, tok: tb.endCell(), serial, spendPub };
}

const publicChannelId = (spendPub: bigint): bigint =>
  bufToInt(beginCell().storeUint(PUBLIC_CHANNEL_DOMAIN, 32).storeUint(spendPub, 256).endCell().hash());

// A 40-byte CONV-shaped RECOVERY header0 with byte@5 = KIND_RECOVERY (4). bucketKey = bytes[8,40) → slotKey.
function recoveryHeader0(fill = 0x35): Cell {
  const bytes = Buffer.alloc(FINAL_PRIVATE_HEADER0_BYTES, fill);
  bytes[5] = 4;
  return snakeCellFromBytes(bytes);
}

// Build a PublishRecovery message (single CONV frame + owner_sig over the seq-bound digest). Overridable owner key +
// seq model the overwrite / anti-replay guards. slotKey depends only on the header0 fill, so a fixed fill + varying seq
// exercises overwrite of the SAME slot.
function recoveryMessage(opts: { owner: KeyPair; fill?: number; publishId?: bigint; seq?: bigint }) {
  const f = opts.fill ?? 0;
  const seq = opts.seq ?? 1n;
  const h0 = recoveryHeader0(0x35 + f);
  const h1 = finalPrivateHeader1Cell(0x31 + f);
  const body = finalPrivateBodyCell(SIZE_1K, 0x40 + f);
  const h0h = cellHash(h0);
  const h1h = cellHash(h1);
  const bh = cellHash(body);
  const part = beginCell()
    .storeUint(SIZE_1K, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256)
    .storeRef(h0).storeRef(h1).storeRef(body)
    .endCell();
  // slotKey = header0 bits[64,320) = bytes[8,40).
  const h0Bytes = Buffer.alloc(FINAL_PRIVATE_HEADER0_BYTES, 0x35 + f);
  h0Bytes[5] = 4;
  const slotKey = bufToInt(h0Bytes.subarray(8, FINAL_PRIVATE_HEADER0_BYTES));
  const recoveryDigest = beginCell()
    .storeUint(RECOVERY_SLOT_DOMAIN, 32).storeUint(slotKey, 256).storeUint(seq, 64)
    .storeRef(beginCell().storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256).endCell())
    .endCell().hash();
  const ownerSig = sign(recoveryDigest, opts.owner.secretKey);
  const msg = {
    $$type: 'PublishRecovery',
    bounce_id: 3n,
    bounce_tag: 4n,
    publish_id: opts.publishId ?? NONZERO_PUBLISH_ID,
    part,
    owner_pubkey: bufToInt(opts.owner.publicKey),
    seq,
    owner_sig: beginCell().storeBuffer(ownerSig).endCell(),
  } as any;
  return { msg, slotKey };
}

function anonBatch(opts: {
  parts: Cell; tokens: Cell; partCount: bigint; kind?: bigint; publishId?: bigint; marketing?: Cell | null;
}) {
  return {
    $$type: 'PublishAnonBatch',
    bounce_id: 7n,
    bounce_tag: 9n,
    publish_id: opts.publishId ?? NONZERO_PUBLISH_ID,
    publish_kind: opts.kind ?? KIND_PRIVATE,
    part_count: opts.partCount,
    parts: opts.parts,
    tokens: opts.tokens,
    marketing: opts.marketing ?? null,
  } as any;
}

// Deploy the sealed pair, mirror ONE issuer slot, and fund the pool for `nowEpoch`.
async function anonReady(opts?: { credits?: bigint; slot?: bigint; fundEpoch?: bigint; issuerSeed?: number }) {
  const ctx = await deployBoundSealedPair();
  const { blockchain, hub, deployer, creditIssuer } = ctx;
  const nowEpoch = BigInt(Math.floor(blockchain.now! / EPOCH_SECONDS));
  const slot = opts?.slot ?? 0n;
  const issuer = keyPairFromSeed(Buffer.alloc(32, opts?.issuerSeed ?? 0x11));

  await hub.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'HubMirrorIssuerKey', slot, pubkey: bufToInt(issuer.publicKey), active: true, version: 0n,
  } as any);

  const credits = opts?.credits ?? 4n;
  await hub.send(creditIssuer.getSender(), { value: toNano('0.5') }, {
    $$type: 'FundAnonPool', credits_k: credits, epoch: opts?.fundEpoch ?? nowEpoch, purchase_id: 0n,
  } as any);

  return { ctx, issuer, slot, nowEpoch };
}

// A fresh spend keypair per credit (INV-C1: single-use spend_pubkey). Index keeps them distinct.
const spendKey = (i: number): KeyPair => keyPairFromSeed(Buffer.alloc(32, 0x80 + i));

describe('CapsuleHub B3 anon-publish spend path (CONV)', () => {
  it('HUB-SPEND-01: a valid CONV token publishes permissionlessly; state, nullifier, and pool all move', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: 3n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-1');

    const pt = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 111n });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));

    expect(hubTxExit(res, hub)).toBe(0);
    const st = await hub.getGetState();
    expect(st.private_latest_id).toBe(1n);
    expect(st.private_live_count).toBe(1n);
    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(true);

    const pool = await hub.getGetAnonPoolState();
    expect(pool.nullifier_live_count).toBe(1n);
    expect(pool.anon_pool_outstanding).toBe(2n);                 // 3 funded − 1 spent
    expect(await hub.getGetEpochFunding(nowEpoch)).toBe(2n);
    expect(await hub.getGetNullifierInsertTime(pt.serial)).toBe(BigInt(blockchain.now!));
  });

  it('HUB-SPEND-01-INTRO: a valid INTRO token publishes through the same token machinery', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: 2n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-intro');
    const pt = convPartToken({ issuer, spend: spendKey(20), slot, epoch: nowEpoch, nonce: 121n, kind: KIND_INTRO });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_INTRO }));
    expect(hubTxExit(res, hub)).toBe(0);
    const st = await hub.getGetState();
    expect(st.intro_latest_id).toBe(1n);
    expect(st.intro_live_count).toBe(1n);
    expect(st.private_latest_id).toBe(0n);                       // INTRO does not touch the CONV lane
    expect((await hub.getGetIntroEntry(0n)).exists).toBe(true);
    expect((await hub.getGetAnonPoolState()).nullifier_live_count).toBe(1n);
  });

  it('HUB-PERM-01: any relay wallet (not the Vault) can publish a valid token', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady();
    const { blockchain, hub } = ctx;
    const stranger = await blockchain.treasury('anon-random-relay');
    const pt = convPartToken({ issuer, spend: spendKey(1), slot, epoch: nowEpoch, nonce: 222n });
    const res = await hub.send(stranger.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, hub)).toBe(0);
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
  });

  it('HUB-SPEND-02: token-splicing — swapping the two parts\' tokens fails spend_sig (13605)', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: 4n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-splice');

    // Two independent valid (part, token) pairs.
    const a = convPartToken({ issuer, spend: spendKey(2), slot, epoch: nowEpoch, nonce: 301n, fill: 1 });
    const b = convPartToken({ issuer, spend: spendKey(3), slot, epoch: nowEpoch, nonce: 302n, fill: 2 });

    // parts = [a, b]; tokens = [b, a] (spliced). a.part is verified against b's spend_sig → mismatch.
    const partsRoot = beginCell().storeSlice(a.part.beginParse()).storeRef(b.part).endCell();
    const tokensRoot = beginCell().storeSlice(b.tok.beginParse()).storeRef(a.tok).endCell();

    const res = await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({ parts: partsRoot, tokens: tokensRoot, partCount: 2n }));
    expect(hubTxExit(res, hub)).toBe(13605);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);         // fail-closed: nothing stored
    expect((await hub.getGetAnonPoolState()).nullifier_live_count).toBe(0n);
  });

  it('HUB-NULLIFIER-01: an intra-batch duplicate serial is rejected on the second part (13604)', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: 4n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-dup');

    // Same spend key + epoch + nonce → same serial on both parts.
    const dupOpts = { issuer, spend: spendKey(4), slot, epoch: nowEpoch, nonce: 404n } as const;
    const first = convPartToken({ ...dupOpts, fill: 3, next: convPartToken({ ...dupOpts, fill: 4 }) });

    const res = await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({ parts: first.part, tokens: first.tok, partCount: 2n }));
    expect(hubTxExit(res, hub)).toBe(13604);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });

  it('HUB-SOLV-01: a token whose epoch bucket was never funded is rejected by the pool guard (13613)', async () => {
    // Fund a DIFFERENT epoch than the token's → per-epoch guard trips.
    const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: 2n, fundEpoch: 40n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-unfunded');
    const pt = convPartToken({ issuer, spend: spendKey(5), slot, epoch: nowEpoch, nonce: 505n });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, hub)).toBe(13613);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });

  it('HUB-SPEND-04: a token whose declared serial ≠ H(preimage) is rejected (13601)', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-serial');
    const pt = convPartToken({ issuer, spend: spendKey(6), slot, epoch: nowEpoch, nonce: 606n, serialOverride: 0xDEADBEEFn });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, hub)).toBe(13601);
  });

  it('HUB-SPEND-03: an issuer_sig from the wrong key is rejected against the mirrored slot (13603)', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-issuer');
    const wrongIssuer = keyPairFromSeed(Buffer.alloc(32, 0x99));
    const pt = convPartToken({ issuer, spend: spendKey(7), slot, epoch: nowEpoch, nonce: 707n, issuerSigKey: wrongIssuer });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, hub)).toBe(13603);
  });

  it('HUB-SPEND-06: a token pointing at an unmirrored/inactive slot is rejected (13602)', async () => {
    const { ctx, issuer, nowEpoch } = await anonReady({ slot: 0n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-slot');
    // slot 5 was never mirrored → get(slot) == null.
    const pt = convPartToken({ issuer, spend: spendKey(8), slot: 5n, epoch: nowEpoch, nonce: 808n });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, hub)).toBe(13602);
  });

  it('HUB-SPEND-05: spend_sig signed over a different frame (relay re-targets a header) is rejected (13605)', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-frame');
    // spend_sig commits to a frame whose h0 differs from the real part's h0 → checkSignature over the real frame fails.
    const pt = convPartToken({ issuer, spend: spendKey(9), slot, epoch: nowEpoch, nonce: 909n, spendSigFrame: { h0: 1n, h1: 2n, bh: 3n } });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, hub)).toBe(13605);
  });

  it('HUB-ANON-01: a PUBLIC post publishes anonymously; the channel key = H(spend_pubkey), no author wallet', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: 2n });
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-public');
    const spend = spendKey(30);
    const pt = publicPartToken({ issuer, spend, slot, epoch: nowEpoch, nonce: 141n });
    const res = await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell(),
    }));
    expect(hubTxExit(res, hub)).toBe(0);

    const st = await hub.getGetState();
    expect(st.public_latest_id).toBe(1n);
    expect(st.public_live_count).toBe(1n);
    const entry = await hub.getGetPublicEntry(0n);
    expect(entry.exists).toBe(true);
    // author_wallet is gone: the entry carries the crypto-bound channel_id instead.
    const expectChannel = publicChannelId(bufToInt(spend.publicKey));
    expect(entry.channel_id).toBe(expectChannel);
    // ...and the post is discoverable via the channel-keyed author index (structure unchanged, key = channel_id).
    const idx = await hub.getGetPublicAuthorIndex(expectChannel);
    expect(idx.exists).toBe(true);
    expect(idx.entry_count).toBe(1n);
  });

  it('HUB-ANON-01b: PUBLIC without the marketing note is rejected (13507)', async () => {
    const { ctx, issuer, slot, nowEpoch } = await anonReady();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('anon-relay-public-nomk');
    const pt = publicPartToken({ issuer, spend: spendKey(31), slot, epoch: nowEpoch, nonce: 142n });
    const res = await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: null,
    }));
    expect(hubTxExit(res, hub)).toBe(13507);
  });

  it('HUB-SOLV-06: a RECOVERY publish is self-funded, binds owner_pubkey, and stores the on-chain blob', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('recovery-relay');
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x55));
    const { msg, slotKey } = recoveryMessage({ owner, seq: 1n });

    const res = await hub.send(relay.getSender(), { value: toNano('1') }, msg);
    expect(hubTxExit(res, hub)).toBe(0);
    expect((await hub.getGetState()).recovery_live_count).toBe(1n);
    const slot = await hub.getGetRecoveryCapsule(slotKey);
    expect(slot.exists).toBe(true);
    expect(slot.owner_pubkey).toBe(bufToInt(owner.publicKey));
    expect(slot.seq).toBe(1n);

    // The SAME owner may overwrite (retention refresh) with a HIGHER seq; a NEW slot is not created.
    const again = await hub.send(relay.getSender(), { value: toNano('1') }, recoveryMessage({ owner, seq: 2n }).msg);
    expect(hubTxExit(again, hub)).toBe(0);
    expect((await hub.getGetState()).recovery_live_count).toBe(1n);
    expect((await hub.getGetRecoveryCapsule(slotKey)).seq).toBe(2n);
  });

  it('HUB-SOLV-06d: an old validly-signed recovery message cannot roll the K_root blob back (anti-replay, 13564)', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('recovery-relay-replay');
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x55));

    // v1 (blob A, seq 1), then v2 (blob B, seq 2). Distinct fill → distinct body, SAME slotKey (fill is on 0x35 base;
    // both use fill 0 so header0/slotKey match — the body differs via a different publish, seq differs).
    const v1 = recoveryMessage({ owner, seq: 1n });
    await hub.send(relay.getSender(), { value: toNano('1') }, v1.msg);
    const v2 = recoveryMessage({ owner, seq: 2n });
    await hub.send(relay.getSender(), { value: toNano('1') }, v2.msg);
    expect((await hub.getGetRecoveryCapsule(v1.slotKey)).seq).toBe(2n);

    // Attacker replays the EXACT bytes of the old v1 message (seq 1) after v2 landed → rejected, slot stays at seq 2.
    const replay = await hub.send(relay.getSender(), { value: toNano('1') }, v1.msg);
    expect(hubTxExit(replay, hub)).toBe(13564);
    expect((await hub.getGetRecoveryCapsule(v1.slotKey)).seq).toBe(2n);
  });

  it('HUB-FUND-01: FundAnonPool rejects an out-of-window epoch so the pool stays bounded (13617)', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub, creditIssuer } = ctx;
    const nowEpoch = BigInt(Math.floor(blockchain.now! / EPOCH_SECONDS));

    // A far-future epoch would create a never-spendable, never-reclaimable bucket → rejected before any state change.
    const far = await hub.send(creditIssuer.getSender(), { value: toNano('0.5') }, {
      $$type: 'FundAnonPool', credits_k: 1n, epoch: nowEpoch + 100n, purchase_id: 0n,
    } as any);
    expect(hubTxExit(far, hub)).toBe(13617);
    expect(await hub.getGetEpochFunding(nowEpoch + 100n)).toBe(0n);
    expect((await hub.getGetAnonPoolState()).anon_pool_outstanding).toBe(0n);

    // The current epoch (and anything within the acceptance window) funds normally.
    const ok = await hub.send(creditIssuer.getSender(), { value: toNano('0.5') }, {
      $$type: 'FundAnonPool', credits_k: 1n, epoch: nowEpoch, purchase_id: 0n,
    } as any);
    expect(hubTxExit(ok, hub)).toBe(0);
    expect(await hub.getGetEpochFunding(nowEpoch)).toBe(1n);
  });

  it('HUB-SOLV-06b: a DIFFERENT owner_pubkey cannot overwrite an existing recovery slot (13563)', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('recovery-relay-2');
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x55));
    await hub.send(relay.getSender(), { value: toNano('1') }, recoveryMessage({ owner }).msg);

    const attacker = keyPairFromSeed(Buffer.alloc(32, 0x66));
    const res = await hub.send(relay.getSender(), { value: toNano('1') }, recoveryMessage({ owner: attacker }).msg);
    expect(hubTxExit(res, hub)).toBe(13563);
  });

  it('HUB-PERM-04 / G-GAS: the part_count cap is enforced and an EMPTY-Hub batch fits the basechain limit', async () => {
    // SCOPE (narrowed 2026-07-17 — read this before quoting any number below as a safety margin):
    // This measures an EMPTY Hub and the PUBLIC lane. That is NOT the worst case, and these figures are NOT the
    // production margin:
    //   * Empty Hub => zero live entries => auto-eviction never runs. Eviction dominates per-part gas, and only
    //     starts once entries outlive CAPSULEHUB_INDEX_RETENTION_SECONDS (a YEAR after launch).
    //   * CONV, not PUBLIC, is the dearer lane (by a flat ~84_737 gas).
    // In steady state a 4-part batch reaches 96-98% of the limit, not the 62% below. What this test still earns:
    // the 13503 part_count guard works, and the receiver is sane on a fresh contract.
    // The REAL basis for the irreversible cap (over-limit batches revert without consuming tokens; n=1 is always
    // safe) is pinned in tests/capsulehub-gas-degradation.test.ts. See MAX_BATCH_PARTS_ANON in CapsuleHub.tact.
    async function measurePublic(n: number): Promise<{ exit: number; gas: bigint }> {
      const { ctx, issuer, slot, nowEpoch } = await anonReady({ credits: BigInt(n) });
      const { blockchain, hub } = ctx;
      const relay = await blockchain.treasury(`gas-relay-${n}`);
      let chain: PartToken | null = null;
      for (let i = n - 1; i >= 0; i--) {
        // Worst case (§3.5): the largest size class (32K) — its ~258-cell body makes requirePublicPayloadCell's
        // computeDataSize the dominant per-part gas term.
        chain = publicPartToken({ issuer, spend: spendKey(40 + i), slot, epoch: nowEpoch, nonce: BigInt(1000 + i), fill: i, sizeClass: SIZE_32K, next: chain });
      }
      const res = await hub.send(relay.getSender(), { value: toNano('10') }, anonBatch({
        parts: chain!.part, tokens: chain!.tok, partCount: BigInt(n), kind: KIND_PUBLIC, marketing: marketingCell(),
      }));
      const hubTx: any = res.transactions.find((t: any) =>
        t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === hub.address.toString());
      return { exit: hubTxExit(res, hub), gas: BigInt(hubTx?.description?.computePhase?.gasUsed ?? 0) };
    }

    // The compiled cap (pinned below). At/under it, the batch must EXECUTE (exit 0) on a fresh contract; above it,
    // the receiver must REJECT it (13503). Note the guard bounds part_count, NOT gas: at scale a batch at the cap
    // CAN still out-of-gas, which reverts harmlessly (HUB-GAS-DEGRADE-01).
    const MAX_BATCH_PARTS_ANON = 4;   // MUST match the compiled constant. (62%-of-limit on an empty Hub; the
                                      // production figure is 96-98% — see the scope note above.)

    const rows: string[] = [];
    let maxOk = 0;
    for (let n = 1; n <= MAX_BATCH_PARTS_ANON + 1; n++) {
      const m = await measurePublic(n);
      rows.push(`${n}-part: exit=${m.exit} gas=${m.gas}`);
      if (m.exit === 0) maxOk = n;
    }
    // eslint-disable-next-line no-console
    console.log(`[G-GAS] PUBLIC 32K on an EMPTY Hub (gas_limit=1,000,000, cap=${MAX_BATCH_PARTS_ANON}): ${rows.join('  |  ')}  →  max exit-0 = ${maxOk}  [NOT the production margin — see HUB-GAS-DEGRADE]`);

    // Every batch up to the cap fits the gas limit ON AN EMPTY HUB...
    expect(maxOk).toBe(MAX_BATCH_PARTS_ANON);
    const atCap = await measurePublic(MAX_BATCH_PARTS_ANON);
    expect(atCap.exit).toBe(0);
    expect(Number(atCap.gas)).toBeLessThan(1_000_000);
    // ...and one part over the cap is rejected by part_count guard (13503), NOT run into out-of-gas.
    expect((await measurePublic(MAX_BATCH_PARTS_ANON + 1)).exit).toBe(13503);
  });

  it('HUB-SOLV-06c: a recovery publish with a wrong owner_sig is rejected (13571)', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub } = ctx;
    const relay = await blockchain.treasury('recovery-relay-3');
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x55));
    const { msg } = recoveryMessage({ owner });
    // Corrupt owner_sig by re-signing the digest with a different key while keeping owner_pubkey = owner.
    const wrong = keyPairFromSeed(Buffer.alloc(32, 0x77));
    const bad = recoveryMessage({ owner: wrong });
    msg.owner_sig = bad.msg.owner_sig;   // signature from `wrong`, but owner_pubkey stays `owner`
    const res = await hub.send(relay.getSender(), { value: toNano('1') }, msg);
    expect(hubTxExit(res, hub)).toBe(13571);
  });
});
