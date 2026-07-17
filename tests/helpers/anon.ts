import { beginCell, Cell, toNano } from '@ton/core';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { SIZE_1K, SUITE_HYBRID, KIND_PRIVATE, KIND_PUBLIC, cellHash, deployBoundSealedPair } from './vpb2';
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
} from './capsule-cells';

// ---------------------------------------------------------------------------
// clean-16 B3 anon-publish test kit — the permissionless PublishAnonBatch + spend-token path that REPLACED the old
// Vault-forwarded PublishBatchToHub. A part is published only if a parallel spend-token verifies (issuer_sig over the
// serial + spend_sig over the frame) and a prepaid pool credit for the token's epoch exists. This kit builds a part
// frame and its matching token together, so the frameCommit the Hub re-derives always matches. Mirrors CapsuleHub.tact.
// ---------------------------------------------------------------------------

export const KIND_INTRO = 3n;
export const KIND_RECOVERY = 4n;

// Domains — MUST mirror CapsuleHub.tact exactly.
export const ISSUER_SIG_DOMAIN = 0x42534931n;   // "BSI1"
export const SPEND_DOMAIN = 0x42535031n;        // "BSP1"
export const FRAMECOMMIT_DOMAIN = 0x42464331n;  // "BFC1"
export const PUBLIC_CHANNEL_DOMAIN = 0x42504331n; // "BPC1"
export const RECOVERY_SLOT_DOMAIN = 0x42525331n; // "BRS1"
export const EPOCH_SECONDS = 86400;
export const PREPAID_UNIT = 10_995_000n;      // CAPSULEHUB_PREPAID_UNIT (G8-CANONICAL, PRIVATE = worst lane)

export const NONZERO_PUBLISH_ID = 0x51A7B0B3B3B0000000000000000000000000000000000000000000000005EED1n;

export const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));

// A fresh single-use spend keypair per credit (INV-C1). Index keeps them distinct.
//
// The index is spread across 4 BYTES, not folded into one. The previous form — Buffer.alloc(32, 0x80 + i) — passes
// the index as a FILL BYTE, so Node truncates it mod 256 and the keys WRAP: spendKey(0) === spendKey(256), and a
// 600-index run yielded only 256 distinct keys. That silently collides channel_ids (PUBLIC keys its channel by
// H(domain||spend_pubkey)) and nullifiers, so any measurement over a long run reports a fictitious number — it made
// PUBLIC's per-entry cost read 4.491 cells instead of the true 6.020 and nearly under-provisioned an immutable
// endowment by 34%. Same index -> same key still holds, which is what PUBINDEX's "one author = one stable channel"
// relies on.
export const spendKey = (i: number): KeyPair => {
  const seed = Buffer.alloc(32, 0x80);
  seed.writeUInt32BE(i >>> 0, 0);
  return keyPairFromSeed(seed);
};
export const issuerKey = (seed = 0x11): KeyPair => keyPairFromSeed(Buffer.alloc(32, seed));

export const publicChannelId = (spendPub: bigint): bigint =>
  bufToInt(beginCell().storeUint(PUBLIC_CHANNEL_DOMAIN, 32).storeUint(spendPub, 256).endCell().hash());

export interface PartToken { part: Cell; tok: Cell; serial: bigint; spendPub: bigint; }

// Build a CONV (or INTRO) part frame AND its parallel spend-token from ONE set of scalars.
export function convPartToken(opts: {
  issuer: KeyPair; spend: KeyPair; slot: bigint; epoch: bigint; nonce: bigint;
  fill?: number; next?: PartToken | null; kind?: bigint; sizeClass?: bigint;
  serialOverride?: bigint; issuerSigKey?: KeyPair; spendSigFrame?: { h0: bigint; h1: bigint; bh: bigint } | null;
}): PartToken {
  const size = opts.sizeClass ?? SIZE_1K;
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
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(opts.epoch, 32).storeUint(opts.nonce, 64)
    .endCell().hash();
  const trueSerial = bufToInt(serialBuf);
  const declaredSerial = opts.serialOverride ?? trueSerial;
  const issuerSig = sign(serialBuf, (opts.issuerSigKey ?? opts.issuer).secretKey);

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
  return { part, tok: tb.endCell(), serial: declaredSerial, spendPub };
}

// Build a PUBLIC part frame (592 bits) + its token. channel_id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pubkey).
export function publicPartToken(opts: {
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

// A 40-byte CONV-shaped RECOVERY header0 with byte@5 = KIND_RECOVERY (4). bucketKey = bytes[8,40) → slotKey.
export function recoveryHeader0(fill = 0x35): Cell {
  const bytes = Buffer.alloc(FINAL_PRIVATE_HEADER0_BYTES, fill);
  bytes[5] = 4;
  return snakeCellFromBytes(bytes);
}

// Build a PublishRecovery message (single CONV frame + owner_sig over the seq-bound digest).
export function recoveryMessage(opts: { owner: KeyPair; fill?: number; publishId?: bigint; seq?: bigint }) {
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

export function anonBatch(opts: {
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

// Deploy the bound+sealed pair, mirror ONE issuer slot, and fund the pool for `nowEpoch`. Returns everything a spend
// test needs (the fixture already binds a treasury `creditIssuer` whose sender the Hub's FundAnonPool gate accepts).
export async function deployAnonReady(opts?: { credits?: bigint; slot?: bigint; fundEpoch?: bigint; issuerSeed?: number }) {
  const ctx = await deployBoundSealedPair();
  const { blockchain, hub, deployer, creditIssuer } = ctx as any;
  const nowEpoch = BigInt(Math.floor(blockchain.now! / EPOCH_SECONDS));
  const slot = opts?.slot ?? 0n;
  const issuer = issuerKey(opts?.issuerSeed ?? 0x11);

  await hub.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'HubMirrorIssuerKey', slot, pubkey: bufToInt(issuer.publicKey), active: true, version: 0n,
  } as any);

  const credits = opts?.credits ?? 4n;
  await hub.send(creditIssuer.getSender(), { value: toNano('0.5') }, {
    $$type: 'FundAnonPool', credits_k: credits, epoch: opts?.fundEpoch ?? nowEpoch, purchase_id: 0n,
  } as any);

  return { ctx, blockchain, hub, deployer, creditIssuer, issuer, slot, nowEpoch };
}

// Top up the pool with more credits for a given epoch (for tests that publish more parts than the initial fund).
export async function fundPool(hub: any, creditIssuer: any, credits: bigint, epoch: bigint) {
  await hub.send(creditIssuer.getSender(), { value: toNano('1') }, {
    $$type: 'FundAnonPool', credits_k: credits, epoch, purchase_id: 0n,
  } as any);
}
