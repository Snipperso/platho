// clean-17 client — clause-blind-Schnorr issuance (the unlinkable publish token). This is the missing link between
// "the client paid a credit" and "the client holds an issuer_sig publish-builder can spend": the issuer blind-signs
// the token's serial so it can NEVER link the issued token to the paying wallet, and clause-blinding makes that
// unlinkability hold even under concurrent sessions (ROS / Wagner resistance).
//
//   ┌ ISSUER (off-chain service, holds the CAC-authorized subkey secret) ─────────────────────────────────────────┐
//   │  round 1  issuerCommit()            -> two nonce commitments Rc[0], Rc[1]  (learns nothing)                   │
//   │  round 2  issuerSignClause(...)     -> signs ONE RANDOM clause b over the client's blinded challenges        │
//   └───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
//   ┌ CLIENT (this module) ─────────────────────────────────────────────────────────────────────────────────────┐
//   │  blindChallenges({Rc, message, issuerPublicKey})  -> two blinded challenges + a session (M stays local)      │
//   │  unblindToken({session, clause, sClause})         -> a standard ed25519 sig over M == the issuer_sig         │
//   └───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
//
// M = the token's serial as 32-byte big-endian (serialToMessage) — exactly what the NullifierShard gate 13601 checks
// via checkSignature(serial, issuer_sig, subkey_pubkey). The output is a plain ed25519 R||s signature, verified on
// the real TVM opcode (tests/blind-schnorr-checksig.test.ts, BLIND-CHECKSIG-01, 40/40).
//
// ⚠ AUDIT-CRITICAL: the unlinkability (issuer transcript ⟂ M) and the ROS/Wagner resistance of the clause-blinding
// are seal-blockers that an EXTERNAL crypto audit must establish — see artifacts/PLATHO_CLEAN17_CRYPTO_AUDIT_BRIEF.md.
// The tests here prove FUNCTIONAL correctness (tokens verify on-chain, the split matches the monolithic prototype,
// the issuer never receives M); they do NOT by themselves prove unlinkability. Math mirrors the reviewed prototype
// in tests/blind-schnorr-checksig.test.ts byte-for-byte.

import { ed25519 } from '../vendor/@noble/curves/ed25519.js';
import { sha512 } from '../vendor/@noble/hashes/sha2.js';

const P = ed25519.Point;
const B = P.BASE;
const L = P.Fn.ORDER;

const mod = (a, m = L) => { const r = a % m; return r >= 0n ? r : r + m; };
const b2nLE = (u) => { let x = 0n; for (let i = u.length - 1; i >= 0; i -= 1) x = (x << 8n) | BigInt(u[i]); return x; };
const n2bLE = (n, l = 32) => { const u = new Uint8Array(l); let v = n; for (let i = 0; i < l; i += 1) { u[i] = Number(v & 0xffn); v >>= 8n; } return u; };
const cat = (...a) => { const t = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(t); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
const tb = (pt) => pt.toBytes();
const smul = (pt, k) => pt.multiplyUnsafe(mod(k));
const rand = () => mod(b2nLE(crypto.getRandomValues(new Uint8Array(64)))) || 1n;
const randBit = () => crypto.getRandomValues(new Uint8Array(1))[0] & 1;
// The ed25519 challenge over the (unblinded) R' — SHA512(R' ‖ A ‖ M) mod L.
const chal = (Rb, Ab, M) => mod(b2nLE(sha512(cat(Rb, Ab, M))));

/** The 32-byte big-endian message the issuer signs, from the token's serial (uint256). Matches gate 13601's checkSignature. */
export function serialToMessage(serial) {
  const u = new Uint8Array(32); let v = BigInt(serial);
  for (let i = 31; i >= 0; i -= 1) { u[i] = Number(v & 0xffn); v >>= 8n; }
  return u;
}

// ── ISSUER (reference implementation of the off-chain signing service; documents the exact protocol) ──────────────

/** Round 1: the issuer commits two fresh nonces. Keep `r` secret; hand `Rc` (two 32-byte points) to the client. */
export function issuerCommit() {
  const r = [rand(), rand()];
  return { r, Rc: [tb(smul(B, r[0])), tb(smul(B, r[1]))] };
}

/**
 * Round 2: sign ONE RANDOM clause over the client's two blinded challenges. Picking the clause randomly (not letting
 * the client choose) is the ROS/Wagner resistance. `secret` is the issuer subkey scalar; `challenges` are the two
 * blinded challenges from the client. The issuer never sees M.
 */
export function issuerSignClause({ r, challenges, secret }) {
  const b = randBit();
  const sClause = mod(r[b] + mod(challenges[b] * mod(secret)));
  return { clause: b, sClause };
}

// ── CLIENT ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Blind the two nonces against the local message M and return the blinded challenges for the issuer, plus a session
 * to finish with. The issuer learns nothing about M: each challenge is masked by a fresh random `be[j]`.
 * @param Rc two 32-byte issuer commitments (bytes).
 * @param message the 32-byte M (serialToMessage(serial)).
 * @param issuerPublicKey the issuer subkey pubkey, 32 bytes.
 */
export function blindChallenges({ Rc, message, issuerPublicKey }) {
  const A = P.fromBytes(issuerPublicKey);
  const Ab = issuerPublicKey instanceof Uint8Array ? issuerPublicKey : Uint8Array.from(issuerPublicKey);
  const al = [rand(), rand()];
  const be = [rand(), rand()];
  const Rp = [];
  const challenges = [];
  for (const j of [0, 1]) {
    const Rcj = P.fromBytes(Rc[j] instanceof Uint8Array ? Rc[j] : Uint8Array.from(Rc[j]));
    const Rpj = Rcj.add(smul(B, al[j])).add(smul(A, be[j]));   // R'[j] = Rc[j] + B·α[j] + A·β[j]
    Rp[j] = tb(Rpj);
    challenges[j] = mod(chal(Rp[j], Ab, message) + be[j]);     // c'[j] = chal(R'[j],A,M) + β[j]  (β hides M)
  }
  return { challenges, session: { al, Rp } };
}

/**
 * Finish: unblind the clause the issuer signed into a standard ed25519 signature R'||s over M — the issuer_sig
 * publish-builder spends. `clause`/`sClause` come from issuerSignClause.
 */
export function unblindToken({ session, clause, sClause }) {
  const s = mod(sClause + session.al[clause]);
  return cat(session.Rp[clause], n2bLE(s, 32));
}

/**
 * Convenience: run the full client↔issuer exchange with an issuer callback (round1 + round2), returning the issuer_sig.
 * `issuer` = { commit(): {r,Rc}, sign({r,challenges}): {clause,sClause} } — models the two off-chain round-trips. Used
 * by tests and by a client that talks to a real issuer via its transport.
 */
export function requestBlindToken({ serial, issuerPublicKey, issuer }) {
  const message = serialToMessage(serial);
  const { r, Rc } = issuer.commit();
  const { challenges, session } = blindChallenges({ Rc, message, issuerPublicKey });
  const { clause, sClause } = issuer.sign({ r, challenges });
  return unblindToken({ session, clause, sClause });
}
