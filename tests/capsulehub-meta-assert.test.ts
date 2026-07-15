import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Cell, toNano } from '@ton/core';
import { snakeCellFromBytes } from './helpers/capsule-cells';
import {
  KIND_PRIVATE,
  privatePartCustom,
  publishBatchToHub,
  setupHub,
  hubTxExit,
} from './helpers/vpb2';

// clean-16 Фаза 4 · ИНК3 — CONV meta-assert (tests-first).
//
// CONV (publish_kind=PRIVATE) and RECOVERY (publish_kind=RECOVERY, wired in ИНК6) share an IDENTICAL 320-bit
// header0 length. The receive path therefore cannot tell them apart by shape — the ONLY on-chain discriminator
// is the batch-level publish_kind cross-checked against the publishKind embedded in header0 byte@5. ИНК3 binds
// them: throwUnless(13519, privateHeaderPublishKind(header0) == msg.publish_kind) in the private (CONV) branch.
// This is LOAD-BEARING: without it a mislabeled RECOVERY capsule would land in the 1-year CONV pool and be
// evicted, permanently losing the user's K_root. The extractor was added in ИНК1; ИНК3 wires the assert.

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');
const FUND = toNano('1');

// A well-formed 320-bit (40-byte, 1 cell, 0 refs) CONV header0 with an explicit publishKind at byte@5.
function convHeader0WithPublishKind(publishKind: number): Cell {
  const bytes = Buffer.alloc(40, 0x44);
  bytes.write('PH0C', 0, 'ascii'); // magic
  bytes[4] = 1; // version
  bytes[5] = publishKind; // byte@5 = embedded publishKind (bits[40,48))
  bytes[6] = 1; // sizeClass
  bytes[7] = 2; // cryptoSuite = HYBRID
  return snakeCellFromBytes(bytes);
}

describe('CapsuleHub CONV meta-assert (clean-16 Фаза 4 ИНК3)', () => {
  it('META-ASSERT-01: the CONV branch binds header0 byte@5 to the batch publish_kind (13519)', () => {
    expect(HUB, 'CONV meta-assert present').toMatch(
      /throwUnless\(13519,\s*self\.privateHeaderPublishKind\(header0\)\s*==\s*msg\.publish_kind\)/,
    );
  });

  it('META-ASSERT-02: a CONV part whose header0 publishKind != batch kind bounces (13519), nothing stored', async () => {
    const { hub, vault } = await setupHub();

    // header0 byte@5 = 2 (PUBLIC) but the batch is publish_kind = PRIVATE(1) -> mislabel -> reject before storing.
    const mislabeled = privatePartCustom({ h0Cell: convHeader0WithPublishKind(2) });
    const bad = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: mislabeled, authorWallet: vault.address }));
    expect(hubTxExit(bad, hub)).toBe(13519);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);

    // The SAME shape with a matching byte@5 = 1 (PRIVATE/CONV) stores exactly one entry.
    const good = privatePartCustom({ h0Cell: convHeader0WithPublishKind(1) });
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: good, authorWallet: vault.address }));
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
  });
});
