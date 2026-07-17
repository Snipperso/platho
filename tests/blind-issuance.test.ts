import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano, Slice } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { MockCheckSig } from '../build/MockCheckSig/MockCheckSig_MockCheckSig';
import { NullifierShard, loadNullifierSpend } from '../build/NullifierShard/NullifierShard_NullifierShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import {
  issuerCommit, issuerSignClause, blindChallenges, requestBlindToken, serialToMessage,
} from '../web/crypto/blind-issuance.mjs';
import { buildConvSpend } from '../web/publish-builder.mjs';
import { laneOf } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// BLIND-ISSUANCE — the split client↔issuer clause-blind-Schnorr protocol produces the unlinkable publish token.
//
// These tests prove FUNCTIONAL correctness only: (1) the split protocol yields a standard ed25519 sig the REAL TVM
// checkSignature accepts, matching the monolithic prototype (tests/blind-schnorr-checksig.test.ts); (2) end-to-end,
// a blind-issued token spends through web/publish-builder.mjs and passes the NullifierShard's issuer gate 13601;
// (3) no forgery under a different issuer key; (4) behavioural unlinkability — the issuer sees no M and re-issuing
// the same serial yields a distinct token. The UNLINKABILITY + ROS proofs are seal-blockers for the EXTERNAL crypto
// audit (PLATHO_CLEAN17_CRYPTO_AUDIT_BRIEF.md); a passing functional test does not establish them.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const P = ed25519.Point;
const B = P.BASE;
const L = P.Fn.ORDER;
const mod = (a: bigint, m = L) => { const r = a % m; return r >= 0n ? r : r + m; };
const b2nLE = (u: Uint8Array) => { let x = 0n; for (let i = u.length - 1; i >= 0; i -= 1) x = (x << 8n) | BigInt(u[i]); return x; };
const rand = () => mod(b2nLE(crypto.getRandomValues(new Uint8Array(64)))) || 1n;
const pubBig = (b: Uint8Array): bigint => BigInt('0x' + Buffer.from(b).toString('hex'));
const sigSlice = (sig: Uint8Array): Slice => beginCell().storeBuffer(Buffer.from(sig)).endCell().beginParse();

// A blind-Schnorr issuer: a raw scalar x with pubkey A = x·B (a valid ed25519 pubkey, accepted by checkSignature).
function newIssuer() { const x = rand(); const A = B.multiplyUnsafe(x); return { x, A, Ab: A.toBytes() as Uint8Array }; }
// Wrap the reference issuer functions into the { commit, sign } shape requestBlindToken drives (two round-trips).
const refIssuer = (x: bigint) => ({
  commit: () => issuerCommit(),
  sign: ({ r, challenges }: any) => issuerSignClause({ r, challenges, secret: x }),
});

describe('BLIND-ISSUANCE — clause-blind-Schnorr split protocol produces the unlinkable publish token', () => {
  it('BLIND-ISSUE-01: the split protocol yields a token the real TVM checkSignature accepts (20/20)', async () => {
    const blockchain = await Blockchain.create();
    const mock = blockchain.openContract(await MockCheckSig.fromInit());
    await mock.send((await blockchain.treasury('d')).getSender(), { value: toNano('0.1') }, null);
    const iss = newIssuer();
    for (let i = 0; i < 20; i += 1) {
      const serial = b2nLE(crypto.getRandomValues(new Uint8Array(32))) % (1n << 256n);
      const sig = requestBlindToken({ serial, issuerPublicKey: iss.Ab, issuer: refIssuer(iss.x) });
      // the JS ed25519 verifier agrees over M = serial (32-byte BE) ...
      expect(ed25519.verify(sig, serialToMessage(serial), iss.Ab)).toBe(true);
      // ... and the real on-chain checkSignature opcode accepts it (this is exactly gate 13601's verifier)
      expect(await mock.getCheck(serial, sigSlice(sig), pubBig(iss.Ab))).toBe(true);
    }
  }, 120_000);

  it('BLIND-ISSUE-02: a blind-issued token spends through publish-builder — the shard 13601 accepts it', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const epoch = Math.floor(blockchain.now / 86400);
    const relay = await blockchain.treasury('bi-relay');
    const iss = newIssuer();

    // the client computes its serial locally, blind-issues over it (the issuer never sees it), and never reveals it
    const spendSeed = Buffer.alloc(32, 0x71);
    const spendPub = pubBig(keyPairFromSeed(spendSeed).publicKey);
    const nonce = 7n;
    const serial = pubBig(beginCell().storeUint(0x42534931n, 32).storeUint(spendPub, 256)
      .storeUint(BigInt(epoch), 32).storeUint(nonce, 64).endCell().hash());
    const issuerSig = requestBlindToken({ serial, issuerPublicKey: iss.Ab, issuer: refIssuer(iss.x) });

    // a CAC cert authorizing THIS blind issuer's pubkey (the roots sign it)
    const ROOTS = [0x21, 0x22, 0x23].map((s) => keyPairFromSeed(Buffer.alloc(32, s)));
    const validFrom = epoch - 3, validTo = epoch + 3;
    const cd = beginCell().storeUint(0x43414331n, 32).storeUint(pubBig(iss.Ab), 256)
      .storeUint(BigInt(validFrom), 32).storeUint(BigInt(validTo), 32).endCell().hash();
    const cert = {
      subkeyPublicKey: pubBig(iss.Ab), validFrom, validTo, rootIdxA: 0, rootIdxB: 1,
      certSigA: sign(cd, ROOTS[0].secretKey), certSigB: sign(cd, ROOTS[1].secretKey),
    };

    const bucketKey = 0xB0BAn, frameCommit = 0xF00Dn;
    const built = await buildConvSpend({ spendSecretKey: spendSeed, epoch, nonce, cert, issuerSig, bucketKey, frameCommit });
    expect(built.serial).toBe(serial);   // the client's serial IS the one that was blind-signed

    const nsInit = await NullifierShard.init(BigInt(epoch), laneOf(built.serial));
    const ns = blockchain.openContract(new NullifierShard(contractAddress(0, nsInit), nsInit));
    await ns.send(relay.getSender(), { value: toNano('0.1') }, null);
    const rsInit = await RecordShard.init(bucketKey, BigInt(epoch));
    const rs = blockchain.openContract(new RecordShard(contractAddress(0, rsInit), rsInit));
    await rs.send(relay.getSender(), { value: toNano('0.1') }, null);

    const res = await ns.send(relay.getSender(), { value: built.value, bounce: true }, loadNullifierSpend(built.body.beginParse()) as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === ns.address.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'blind-issued token accepted at gate 13601').toBe(0);
    expect(await ns.getIsSpent(built.serial)).toBe(true);
    expect((await rs.getGetRecord(0n)).exists).toBe(true);
  }, 120_000);

  it('BLIND-ISSUE-03: the issuer sees no M, and re-issuing the same serial yields a distinct (unlinkable) token', async () => {
    const iss = newIssuer();
    const serial = 0x1234_5678_90ab_cdefn;
    // The issuer API takes NO message: issuerCommit() and issuerSignClause({r,challenges,secret}) never receive M.
    const t1 = requestBlindToken({ serial, issuerPublicKey: iss.Ab, issuer: refIssuer(iss.x) });
    const t2 = requestBlindToken({ serial, issuerPublicKey: iss.Ab, issuer: refIssuer(iss.x) });
    // same serial, but fresh blinding each time -> byte-different tokens (unlinkable at the token level)
    expect(Buffer.from(t1).equals(Buffer.from(t2))).toBe(false);
    expect(ed25519.verify(t1, serialToMessage(serial), iss.Ab)).toBe(true);
    expect(ed25519.verify(t2, serialToMessage(serial), iss.Ab)).toBe(true);
    // the blinded challenges the issuer sees are re-randomized for the SAME M (β masks it uniformly)
    const c1 = blindChallenges({ Rc: issuerCommit().Rc, message: serialToMessage(serial), issuerPublicKey: iss.Ab }).challenges;
    const c2 = blindChallenges({ Rc: issuerCommit().Rc, message: serialToMessage(serial), issuerPublicKey: iss.Ab }).challenges;
    expect(c1[0]).not.toBe(c2[0]);
    expect(c1[1]).not.toBe(c2[1]);
  });

  it('BLIND-ISSUE-04: a token is rejected under a DIFFERENT issuer key and when tampered (no forgery)', async () => {
    const blockchain = await Blockchain.create();
    const mock = blockchain.openContract(await MockCheckSig.fromInit());
    await mock.send((await blockchain.treasury('d')).getSender(), { value: toNano('0.1') }, null);
    const iss = newIssuer(), other = newIssuer();
    const serial = 0xDEAD_BEEFn;
    const sig = requestBlindToken({ serial, issuerPublicKey: iss.Ab, issuer: refIssuer(iss.x) });

    expect(await mock.getCheck(serial, sigSlice(sig), pubBig(iss.Ab)), 'valid under its own key').toBe(true);
    expect(await mock.getCheck(serial, sigSlice(sig), pubBig(other.Ab)), 'rejected under a foreign key').toBe(false);
    const bad = new Uint8Array(sig); bad[40] ^= 0x01;
    expect(await mock.getCheck(serial, sigSlice(bad), pubBig(iss.Ab)), 'tampered s rejected').toBe(false);
    // replay onto a different serial is rejected (the sig binds M)
    expect(await mock.getCheck(serial ^ 0x1n, sigSlice(sig), pubBig(iss.Ab)), 'wrong serial rejected').toBe(false);
  }, 120_000);
});
