
import { privateScanViewTagOrNull } from './crypto/platho-crypto.mjs?v=31';

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

export async function scanIntroIndices(scanSecretKey, entries) {
  const out = [];
  for (let i = 0; i < entries.length; i += 1) {
    const tag = await privateScanViewTagOrNull(scanSecretKey, BigInt(entries[i].r));
    if (tag === null) continue;
    if ((tag & 0xffff) === (Number(entries[i].view_tag) & 0xffff)) out.push(i);
  }
  return out;
}
