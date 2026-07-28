// clean-17 client — INTRO recipient scan (the stealth first-contact discovery path).
//
// A recipient cannot know which IntroShard bucket a sender used, so it reads the compact (r, view_tag) of every
// live intro in its catch-up window (via web/shard-discovery.mjs -> introScanAddresses) and filters here. This is a
// TWO-STAGE scan, which is what keeps a LEAK-FREE full scan cheap:
//
//   Stage 1 (this module): the 16-bit view_tag filter. For each intro's (r, view_tag), recompute the tag from the
//     recipient's OWN scan secret and the intro's ephemeral point r; a match is a CANDIDATE. This is cheap and runs
//     over ALL intros (measured ~66 bytes/intro read, ~1.8 MB/day at 1e9-scale traffic).
//   Stage 2 (the caller): for each candidate, fetch the body from the publishing transaction's history (keyed by
//     body_commit) and attempt the full decrypt + transcript-signature verify. This eliminates the ~1/65536 false
//     positives the 16-bit tag admits, and is what actually establishes K_root.
//
// The tag equality holds by X25519 symmetry: the sender put deriveStealthViewTagForRecipient(eph_sec, eph_pub,
// scan_pub) on-chain, and X25519(eph_sec, scan_pub) == X25519(scan_sec, eph_pub), so the recipient's
// computePrivateScanViewTag(scan_sec, eph_pub) reproduces it. No secret leaves the client.

// privateScanViewTagOrNull, NOT computePrivateScanViewTag: every entry here came from a STRANGER, and `r` is an
// opaque uint256 the contract cannot validate. A degenerate point makes X25519 throw, and a throw inside this loop
// aborts the caller's whole pass before its cursors are saved — so one 0.0153-GRAM publish would stop first contact
// for the entire network, permanently, since the next pass re-reads the same page. Skipping loses nothing: a real
// sender never publishes a point that cannot produce a shared secret, so such a record was addressed to no one.
import { privateScanViewTagOrNull } from './crypto/platho-crypto.mjs?v=12';

/**
 * Stage-1 filter over a batch of intro entries.
 * @param scanSecretKey the recipient's X25519 scan secret (bytes or hex).
 * @param entries array of { r, view_tag, ...} as read from the IntroShards (r/view_tag may be bigint or number).
 * @returns the subset that matched the 16-bit tag — CANDIDATES for stage-2 full decrypt.
 */
export async function scanIntros(scanSecretKey, entries) {
  const candidates = [];
  for (const e of entries) {
    const tag = await privateScanViewTagOrNull(scanSecretKey, BigInt(e.r));
    if (tag === null) continue;
    if ((tag & 0xffff) === (Number(e.view_tag) & 0xffff)) {
      candidates.push(e);
    }
  }
  return candidates;
}

/** Convenience: scan and return only the matching (r, view_tag) pairs' indices. */
export async function scanIntroIndices(scanSecretKey, entries) {
  const out = [];
  for (let i = 0; i < entries.length; i += 1) {
    const tag = await privateScanViewTagOrNull(scanSecretKey, BigInt(entries[i].r));
    if (tag === null) continue;
    if ((tag & 0xffff) === (Number(entries[i].view_tag) & 0xffff)) out.push(i);
  }
  return out;
}
