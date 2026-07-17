import { describe, expect, it, beforeEach } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { NullifierShard, loadNullifierSpend } from '../build/NullifierShard/NullifierShard_NullifierShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard, loadRecoveryStore } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { buildConvSpend, buildIntroSpend, buildRecoveryPublish } from '../web/publish-builder.mjs';
import { addrKey, laneOf } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLISH-BUILDER — the client SEND path: a message the client BUILDS is accepted, byte-for-byte, by the on-chain
// shard. This is the mirror of the discovery/scan RECEIVE path. The strength of the test is that it does NOT use the
// tests' own ad-hoc message builder — it feeds the real web/publish-builder.mjs output straight into the contract, so
// any drift between the client's serialization / digest / signing and the contract's expectation fails here. The
// client signs spend_sig itself (RT1-BLOCKER-1) and owner_sig itself (RECOVERY); the cert + issuer_sig are inputs.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CERT_DOMAIN = 0x43414331n;       // "CAC1"
const ISSUER_SIG_DOMAIN = 0x42534931n; // "BSI1"
const ROOTS = [0x21, 0x22, 0x23].map((s) => keyPairFromSeed(Buffer.alloc(32, s)));
const subkey = keyPairFromSeed(Buffer.alloc(32, 0x30));
const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));

// The CAC certificate the client receives with its token: roots 0 and 1 authorize the subkey for a window.
function makeCert(epoch: number) {
  const validFrom = epoch - 3, validTo = epoch + 3;
  const digest = beginCell().storeUint(CERT_DOMAIN, 32).storeUint(bufToInt(subkey.publicKey), 256)
    .storeUint(BigInt(validFrom), 32).storeUint(BigInt(validTo), 32).endCell().hash();
  return {
    subkeyPublicKey: bufToInt(subkey.publicKey), validFrom, validTo, rootIdxA: 0, rootIdxB: 1,
    certSigA: sign(digest, ROOTS[0].secretKey), certSigB: sign(digest, ROOTS[1].secretKey),
  };
}

// The issuer's blind signature over the serial (the subkey signs H(BSI1 ‖ spend_pub ‖ epoch ‖ nonce)).
function issuerSigFor(spendPub: bigint, epoch: number, nonce: bigint): Buffer {
  const serialBuf = beginCell().storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(BigInt(epoch), 32).storeUint(nonce, 64).endCell().hash();
  return sign(serialBuf, subkey.secretKey);
}

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

describe('PUBLISH-BUILDER — client-built messages are accepted by the on-chain shards', () => {
  let blockchain: Blockchain;
  let relay: SandboxContract<TreasuryContract>;
  let epoch: number;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    relay = await blockchain.treasury('pb-relay');
  });

  async function deploy<T>(c: SandboxContract<T>): Promise<SandboxContract<T>> {
    await (c as any).send(relay.getSender(), { value: toNano('0.1') }, null);
    return c;
  }
  // Send the client-BUILT body by parsing it and dispatching through the target wrapper (the standard sandbox send
  // path; a raw internal-message injection trips an unrelated emulator quirk). The body was produced by the client's
  // storeNullifierSpend/storeRecoveryStore, so parsing it and re-sending exercises the exact client bytes + the
  // client's serial/digest/spend_sig/owner_sig, all validated against the contract's gates.
  const sendSpend = (ns: SandboxContract<NullifierShard>, built: { value: bigint; body: any }) =>
    ns.send(relay.getSender(), { value: built.value, bounce: true }, loadNullifierSpend(built.body.beginParse()) as any);
  const sendRecovery = (rs: SandboxContract<RecoveryShard>, built: { value: bigint; body: any }) =>
    rs.send(relay.getSender(), { value: built.value, bounce: true }, loadRecoveryStore(built.body.beginParse()) as any);

  it('PB-01: buildConvSpend lands the record at its RecordShard (client message == contract expectation)', async () => {
    const spendSeed = Buffer.alloc(32, 0x71);
    const spendPub = bufToInt(keyPairFromSeed(spendSeed).publicKey);
    const nonce = 3n, bucketKey = 0xB0BA_F00Dn, frameCommit = 0xCAFE_1234n;
    const built = await buildConvSpend({
      spendSecretKey: spendSeed, epoch, nonce, cert: makeCert(epoch), issuerSig: issuerSigFor(spendPub, epoch, nonce),
      bucketKey, frameCommit,
    });

    const nsInit = await NullifierShard.init(BigInt(epoch), laneOf(built.serial));
    const ns = await deploy(blockchain.openContract(new NullifierShard(contractAddress(0, nsInit), nsInit)));
    const rsInit = await RecordShard.init(bucketKey, BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, rsInit), rsInit)));

    // the builder targeted exactly the deployed NullifierShard
    expect(addrKey(built.to)).toBe(addrKey(ns.address));

    const res = await sendSpend(ns, built);
    expect(exitOf(res, ns.address), 'nullifier burnt').toBe(0);
    expect(await ns.getIsSpent(built.serial)).toBe(true);
    const rec = await rs.getGetRecord(0n);
    expect(rec.exists).toBe(true);
    expect(rec.frame_commit).toBe(frameCommit);
  }, 120_000);

  it('PB-02: buildIntroSpend lands the (R, view_tag, commit) at its IntroShard', async () => {
    const spendSeed = Buffer.alloc(32, 0x72);
    const spendPub = bufToInt(keyPairFromSeed(spendSeed).publicKey);
    const nonce = 4n, introBucket = 77n, introR = 0xABCDn, introViewTag = 0x1234n, bodyCommit = 0xC0FFEEn;
    const built = await buildIntroSpend({
      spendSecretKey: spendSeed, epoch, nonce, cert: makeCert(epoch), issuerSig: issuerSigFor(spendPub, epoch, nonce),
      introBucket, introR, introViewTag, bodyCommit,
    });

    const nsInit = await NullifierShard.init(BigInt(epoch), laneOf(built.serial));
    const ns = await deploy(blockchain.openContract(new NullifierShard(contractAddress(0, nsInit), nsInit)));
    const isInit = await IntroShard.init(BigInt(epoch), introBucket);
    const is = await deploy(blockchain.openContract(new IntroShard(contractAddress(0, isInit), isInit)));

    const res = await sendSpend(ns, built);
    expect(exitOf(res, ns.address), 'nullifier burnt').toBe(0);
    const e = await is.getGetEntry(0n);
    expect(e.exists).toBe(true);
    expect(e.r).toBe(introR);
    expect(e.view_tag).toBe(introViewTag);
    expect(e.body_commit).toBe(bodyCommit);
  }, 120_000);

  it('PB-03: the builder binds the frame into the signature — same token, different frame => different body', async () => {
    // The serial does NOT depend on the frame, so the two builds target the SAME shard; but the frame IS inside the
    // spend_sig, so a different frame produces a byte-different body. That is exactly why a relay/front-runner cannot
    // reuse the signatures with a swapped frame — the on-chain rejection (13605) is proven in NS-06; the builder never
    // emits such a mismatch because it signs precisely what it sends.
    const spendSeed = Buffer.alloc(32, 0x73);
    const spendPub = bufToInt(keyPairFromSeed(spendSeed).publicKey);
    const nonce = 5n;
    const a = await buildConvSpend({ spendSecretKey: spendSeed, epoch, nonce, cert: makeCert(epoch), issuerSig: issuerSigFor(spendPub, epoch, nonce), bucketKey: 0xAAAAn, frameCommit: 0xBBBBn });
    const b = await buildConvSpend({ spendSecretKey: spendSeed, epoch, nonce, cert: makeCert(epoch), issuerSig: issuerSigFor(spendPub, epoch, nonce), bucketKey: 0xCCCCn, frameCommit: 0xBBBBn });
    expect(a.serial).toBe(b.serial);                     // token identity is frame-independent
    expect(addrKey(a.to)).toBe(addrKey(b.to));           // ...so both target the same NullifierShard
    expect(a.body.equals(b.body)).toBe(false);           // ...but the signed body differs: the frame is bound in
  }, 120_000);

  it('PB-04: buildRecoveryPublish lands the owner-signed blob at the owner-bound RecoveryShard', async () => {
    const seed = new Uint8Array(32).fill(0x64);
    const body = beginCell().storeUint(0xD00D_F00Dn, 32).endCell();
    const built = await buildRecoveryPublish({ seed, seq: 1, h0: 0x111n, h1: 0x222n, bh: 0x333n, body });

    const rsInit = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, rsInit), rsInit)));
    expect(addrKey(built.to)).toBe(addrKey(rs.address));

    const res = await sendRecovery(rs, built);
    expect(exitOf(res, rs.address), 'recovery stored').toBe(0);
    const v = await rs.getGetView();
    expect(v.bound).toBe(true);
    expect(v.seq).toBe(1n);
    expect(v.owner_pubkey).toBe(BigInt('0x' + Buffer.from(built.ownerPublicKey).toString('hex')));
  }, 120_000);
});
