import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import {
  finalIntroHeader0Cell,
  finalIntroBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  snakeCellFromBytes,
} from './helpers/capsule-cells';
import {
  KIND_INTRO,
  KIND_PRIVATE,
  privatePartCustom,
  publishBatchToHub,
  setupHub,
  hubTxExit,
} from './helpers/vpb2';

// clean-16 Фаза 4 · ИНК4 — INTRO first-contact lane (tests-first).
//
// INTRO (publish_kind=3) is the first-contact stealth lane: a fresh, un-established peer publishes a handshake
// capsule the recipient finds by SCANNING (ephemeral_R + view_tag in header0), not by an index lookup. It rides
// the same 784-bit private part frame but with a 336-bit (42-byte) header0 and a larger body (ct_root). It lands
// in a SEPARATE pool (intro_entries) with NO who-to-whom index — the recipient trial-decrypts the scan stream.
// Its own meta-assert (13549) binds header0 byte@5==INTRO; a wrong-shape header0 fails closed (13544).

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');
const FUND = toNano('1');

// A 42-byte INTRO header0 with an explicit publishKind at byte@5 (for the meta-assert negative case).
function introHeader0WithPublishKind(publishKind: number): ReturnType<typeof finalIntroHeader0Cell> {
  const bytes = Buffer.alloc(42, 0x33);
  bytes[5] = publishKind;
  return snakeCellFromBytes(bytes);
}

function introPart(opts: { h0?: ReturnType<typeof finalIntroHeader0Cell> } = {}) {
  return privatePartCustom({
    h0Cell: opts.h0 ?? finalIntroHeader0Cell(),
    h1Cell: finalPrivateHeader1Cell(),
    bodyCell: finalIntroBodyCell(1),
  });
}

describe('CapsuleHub INTRO first-contact lane (clean-16 Фаза 4 ИНК4)', () => {
  it('INTRO-SRC-01: the INTRO lane surface exists (kind, pool, getters, eviction, sweep, meta-assert)', () => {
    for (const sym of [
      'CAPSULEHUB_ENTRY_KIND_INTRO',
      'CAPSULEHUB_INTRO_HEADER0_BITS',
      'CAPSULEHUB_INTRO_SWEEP_CAP',
      'intro_entries',
      'intro_live_count',
      'fun evictExpiredIntro',
      'fun introHeaderEphemeralR',
      'fun introHeaderViewTag',
      'get fun get_intro_entry',
      'get fun get_intro_scan_bounds',
      'get fun get_intro_scan_page',
      '13549', // INTRO meta-assert
      '13544', // INTRO header0 shape fail-closed
    ]) {
      expect(HUB, `INTRO surface must include: ${sym}`).toContain(sym);
    }
  });

  it('INTRO-01: an INTRO batch lands in the intro pool, NOT the private/public pools', async () => {
    const { hub, vault } = await setupHub();

    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: introPart(), authorWallet: vault.address, kind: KIND_INTRO }));

    const state = await hub.getGetState();
    expect(state.intro_latest_id).toBe(1n);
    expect(state.intro_live_count).toBe(1n);
    expect(state.private_latest_id).toBe(0n); // NOT a private entry
    expect(state.public_latest_id).toBe(0n);

    const entry = await hub.getGetIntroEntry(0n);
    expect(entry.exists).toBe(true);

    const bounds = await hub.getGetIntroScanBounds();
    expect(bounds.latest_id).toBe(1n);
    expect(bounds.oldest_live_id).toBe(0n);
    expect(bounds.live_count).toBe(1n);
  });

  it('INTRO-02: an INTRO header0 whose byte@5 != INTRO bounces (13549), nothing stored', async () => {
    const { hub, vault } = await setupHub();
    // byte@5 = 1 (PRIVATE/CONV) but the batch is publish_kind = INTRO(3) -> mislabel -> reject.
    const bad = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: introPart({ h0: introHeader0WithPublishKind(1) }), authorWallet: vault.address, kind: KIND_INTRO }));
    expect(hubTxExit(bad, hub)).toBe(13549);
    expect((await hub.getGetState()).intro_latest_id).toBe(0n);
  });

  it('INTRO-03: a CONV-sized (320-bit) header0 under kind=INTRO fails closed (13544)', async () => {
    const { hub, vault } = await setupHub();
    // A 40-byte (320-bit) header0 in the INTRO branch is the wrong shape (INTRO wants 336) -> 13544.
    const wrongShape = privatePartCustom({
      h0Cell: finalPrivateHeader0Cell(),
      h1Cell: finalPrivateHeader1Cell(),
      bodyCell: finalIntroBodyCell(1),
    });
    const bad = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: wrongShape, authorWallet: vault.address, kind: KIND_INTRO }));
    expect(hubTxExit(bad, hub)).toBe(13544);
    expect((await hub.getGetState()).intro_latest_id).toBe(0n);
  });

  it('INTRO-04: an INTRO batch does not disturb a subsequent CONV publish (separate id spaces)', async () => {
    const { hub, vault } = await setupHub();
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: introPart(), authorWallet: vault.address, kind: KIND_INTRO }));
    // A normal CONV publish still starts its own id space at 0.
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: privatePartCustom({ h0Cell: finalPrivateHeader0Cell() }), authorWallet: vault.address, kind: KIND_PRIVATE }));
    const state = await hub.getGetState();
    expect(state.intro_latest_id).toBe(1n);
    expect(state.private_latest_id).toBe(1n);
  });
});
