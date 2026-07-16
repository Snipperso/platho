import { describe, expect, it } from 'vitest';
import { beginCell, Slice } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { MockCheckSig } from '../build/MockCheckSig/MockCheckSig_MockCheckSig';

// clean-16 anonymous-publish CRYPTO GATE — belt-and-suspenders confirmation against the REAL TVM checkSignature opcode.
// Proves that a ROS-resistant clause-blind-Schnorr signature (the unlinkable publish-token) is accepted by the exact
// on-chain ed25519 verifier a CreditIssuer/CapsuleHub would use. The JS (noble RFC-8032) prototype already passed
// 300/300; this closes it against TVM itself. Conventions matched to TVM: message M = the 32-byte big-endian encoding
// of the 256-bit hash int; public_key int = big-endian read of the 32-byte ed25519 pubkey; signature = R(32)||s(32 LE).

const P = ed25519.Point;
const B = P.BASE;
const L = P.Fn.ORDER;

const mod = (a: bigint, m = L) => { const r = a % m; return r >= 0n ? r : r + m; };
const b2nLE = (u: Uint8Array) => { let x = 0n; for (let i = u.length - 1; i >= 0; i--) x = (x << 8n) | BigInt(u[i]); return x; };
const n2bLE = (n: bigint, l = 32) => { const u = new Uint8Array(l); for (let i = 0; i < l; i++) { u[i] = Number(n & 0xffn); n >>= 8n; } return u; };
const cat = (...a: Uint8Array[]) => { const t = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(t); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
const tb = (p: any): Uint8Array => p.toBytes();
const smul = (pt: any, k: bigint) => pt.multiplyUnsafe(mod(k));
const rand = () => mod(b2nLE(crypto.getRandomValues(new Uint8Array(64)))) || 1n;
const chal = (Rb: Uint8Array, Ab: Uint8Array, M: Uint8Array) => mod(b2nLE(sha512(cat(Rb, Ab, M))));
const randBit = () => crypto.getRandomValues(new Uint8Array(1))[0] & 1;

// Issuer keypair (the frozen credit-issuer key). Fixed per test run.
function newIssuer() { const x = rand(); const A = smul(B, x); return { x, A, Ab: tb(A) }; }

// ROS-resistant clause-blind-Schnorr: signer offers TWO nonces, signs ONE random clause. Output = standard ed25519 sig.
function clauseBlindSign(issuer: { x: bigint; A: any; Ab: Uint8Array }, M: Uint8Array): Uint8Array {
  const { x, A, Ab } = issuer;
  const r = [rand(), rand()];
  const Rc = [smul(B, r[0]), smul(B, r[1])];               // signer -> user: two commitments
  const al = [rand(), rand()], be = [rand(), rand()];
  const Rp: any[] = [], Rpb: Uint8Array[] = [], cbl: bigint[] = [];
  for (const j of [0, 1]) {
    Rp[j] = Rc[j].add(smul(B, al[j])).add(smul(A, be[j]));
    Rpb[j] = tb(Rp[j]);
    const cPj = chal(Rpb[j], Ab, M);
    cbl[j] = mod(cPj + be[j]);                              // blinded challenge to signer
  }
  const b = randBit();                                     // signer picks a random clause (ROS-resistance)
  const sb = mod(r[b] + mod(cbl[b] * x));
  const s = mod(sb + al[b]);                               // user unblinds the chosen clause
  return cat(Rpb[b], n2bLE(s, 32));                        // standard ed25519 sig R||s
}

function sigSlice(sig: Uint8Array): Slice {
  return beginCell().storeBuffer(Buffer.from(sig)).endCell().beginParse();
}
function pubkeyInt(Ab: Uint8Array): bigint { return BigInt('0x' + Buffer.from(Ab).toString('hex')); }
function hashToM(hash: bigint): Uint8Array { const u = new Uint8Array(32); let n = hash; for (let i = 31; i >= 0; i--) { u[i] = Number(n & 0xffn); n >>= 8n; } return u; }

describe('clean-16 anon-publish crypto gate: TVM checkSignature accepts clause-blind-Schnorr tokens', () => {
  it('BLIND-CHECKSIG-01: a ROS-resistant clause-blind-Schnorr token verifies on-chain via the real checkSignature opcode', async () => {
    const blockchain = await Blockchain.create();
    const mock = blockchain.openContract(await MockCheckSig.fromInit());
    const deployer = await blockchain.treasury('deployer');
    await mock.send(deployer.getSender(), { value: 100000000n }, null);

    const issuer = newIssuer();
    const pk = pubkeyInt(issuer.Ab);

    // 40 independent tokens over random 256-bit hashes (== H(serial||epoch)); each must pass the on-chain opcode.
    for (let i = 0; i < 40; i++) {
      const hash = b2nLE(crypto.getRandomValues(new Uint8Array(32))) % (1n << 256n);
      const M = hashToM(hash);
      const sig = clauseBlindSign(issuer, M);
      // cross-check: noble RFC-8032 verify agrees (the JS side)
      expect(ed25519.verify(sig, M, issuer.Ab)).toBe(true);
      // the REAL TVM checkSignature opcode accepts it
      const ok = await mock.getCheck(hash, sigSlice(sig), pk);
      expect(ok).toBe(true);
    }
  });

  it('BLIND-CHECKSIG-02: a tampered signature / wrong key is rejected on-chain (no forgery)', async () => {
    const blockchain = await Blockchain.create();
    const mock = blockchain.openContract(await MockCheckSig.fromInit());
    const deployer = await blockchain.treasury('deployer');
    await mock.send(deployer.getSender(), { value: 100000000n }, null);

    const issuer = newIssuer();
    const hash = b2nLE(crypto.getRandomValues(new Uint8Array(32))) % (1n << 256n);
    const M = hashToM(hash);
    const sig = clauseBlindSign(issuer, M);

    // valid baseline
    expect(await mock.getCheck(hash, sigSlice(sig), pubkeyInt(issuer.Ab))).toBe(true);

    // flip one byte of s -> rejected
    const bad = new Uint8Array(sig); bad[40] ^= 0x01;
    expect(await mock.getCheck(hash, sigSlice(bad), pubkeyInt(issuer.Ab))).toBe(false);

    // right sig, WRONG issuer key -> rejected (a forged issuer can't mint tokens under the frozen key)
    const other = newIssuer();
    expect(await mock.getCheck(hash, sigSlice(sig), pubkeyInt(other.Ab))).toBe(false);

    // right sig+key, DIFFERENT hash (replay onto another serial) -> rejected
    const hash2 = (hash ^ 0x1n);
    expect(await mock.getCheck(hash2, sigSlice(sig), pubkeyInt(issuer.Ab))).toBe(false);
  });
});
