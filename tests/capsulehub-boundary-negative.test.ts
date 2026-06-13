import { describe, expect, it } from 'vitest';
import { beginCell, Cell, toNano } from '@ton/core';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
  snakeCell,
} from './helpers/capsule-cells';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  SIZE_1K,
  SIZE_32K,
  SUITE_HYBRID,
  PROTOCOL_FEE_TON_BATCH,
  cellHash,
  marketingCell,
  partsList,
  privatePartCustom,
  publicPartCustom,
  refChainCell,
  publishBatchToHub,
  setupHub,
  hubTxExit,
} from './helpers/vpb2';

// CapsuleHub payload-shape boundary negative matrix — migrated onto the VPB2 batch ingest (PublishBatchToHub).
// The removed single-publish receivers used per-message VALUE/STORAGE boundaries; the batch receiver instead
// validates each part's declared-hash + cell-shape during the atomic part walk and maps every defect to a
// 135xx exit code (a per-part throw reverts the WHOLE batch — nothing stored, message bounces). These tests
// drive the Hub directly from the bound Vault treasury (setupHub) and assert the exact code via hubTxExit.
//
// Value-boundary coverage (former min-1 / exact-reserve assertions) is not re-expressed per old fixture: in
// VPB2 gross underfunding is one Phase-A gate (13509, covered by HUB-BATCH-05) and the full per-part value
// gate is 13530 (covered below). Each migrated test repoints to the shape/hash gate it actually exercised.

// Generous funding so the value gates (13509/13530) never fire spuriously while shape/hash gates are probed.
const FUND = toNano('1');

describe('CapsuleHub VPB2 payload-shape boundary negative matrix', () => {
  // CAPSULE-BND-01: the original asserted private min-1 reject + exact/surcharge accept on the single-publish
  // value boundary. In VPB2 the value boundary is the Phase-A lower bound (13509) and the post-walk full gate
  // (13530); the "exact accepts, +1 still accepts" behavior is the batch's value monotonicity. Re-expressed as:
  // grossly underfunded private batch bounces (13509), an exactly/over-funded one stores and advances.
  it('CAPSULE-BND-01: private batch value boundary — underfunded bounces (13509), funded stores', async () => {
    const { hub, vault } = await setupHub();

    const underfunded = await hub.send(vault.getSender(), { value: toNano('0.025') },
      publishBatchToHub({ parts: partsList(KIND_PRIVATE, 1), authorWallet: vault.address }));
    expect(hubTxExit(underfunded, hub)).toBe(13509);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);

    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: partsList(KIND_PRIVATE, 1), authorWallet: vault.address }));
    expect((await hub.getGetState()).private_latest_id).toBe(1n);

    // A larger surcharge still stores exactly one more (no double counting / over-charge).
    await hub.send(vault.getSender(), { value: FUND + toNano('0.5') },
      publishBatchToHub({ parts: partsList(KIND_PRIVATE, 1), authorWallet: vault.address }));
    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(2n);
    expect(state.private_live_count).toBe(2n);
  });

  // RT-VCAPS-004: a surcharge above the required value never inflates accrued_plato_fee_ton — the Hub accrues
  // ONLY protocol_fee_total, independent of how much TON the Vault forwarded. Probed private + public.
  it.each([
    ['private', toNano('0.2')],
    ['private', toNano('1')],
    ['public', toNano('0.2')],
    ['public', toNano('1')],
  ] as const)('RT-VCAPS-004: %s surcharge %s never increases accrued_plato_fee_ton', async (kind, surcharge) => {
    const { hub, vault } = await setupHub();
    const isPrivate = kind === 'private';

    await hub.send(vault.getSender(), { value: FUND + surcharge }, publishBatchToHub({
      parts: partsList(isPrivate ? KIND_PRIVATE : KIND_PUBLIC, 1),
      authorWallet: vault.address,
      kind: isPrivate ? KIND_PRIVATE : KIND_PUBLIC,
      protocolFeeTotal: PROTOCOL_FEE_TON_BATCH,
    }));

    const state = await hub.getGetState();
    if (isPrivate) expect(state.private_latest_id).toBe(1n);
    else expect(state.public_latest_id).toBe(1n);
    // accrued == the declared protocol_fee_total, NOT the forwarded surcharge.
    expect(state.accrued_plato_fee_ton).toBe(PROTOCOL_FEE_TON_BATCH);
  });

  // CAPSULE-BND-02: the original enforced long-term-private and public exact value boundaries (per size class).
  // In VPB2 the per-part value requirement scales with part_count via the post-walk full gate (13530). Re-
  // expressed as: a multi-part batch funded just below the full per-part requirement bounces with 13530 and
  // stores nothing; the same parts adequately funded store all entries (private 32K + public exercised).
  it('CAPSULE-BND-02: per-part full value gate (13530) — underfunded multi-part bounces, funded stores', async () => {
    const { hub, vault } = await setupHub();

    // 3 private 32K parts: passes Phase A (13509 lower bound) but starves the post-walk full gate (13530).
    const starved = await hub.send(vault.getSender(), { value: toNano('0.045') }, publishBatchToHub({
      parts: partsList(KIND_PRIVATE, 3, SIZE_32K),
      authorWallet: vault.address,
      partCount: 3n,
    }));
    expect(hubTxExit(starved, hub)).toBe(13530);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);

    // Adequately funded: all 3 private 32K entries store.
    await hub.send(vault.getSender(), { value: toNano('2') }, publishBatchToHub({
      parts: partsList(KIND_PRIVATE, 3, SIZE_32K),
      authorWallet: vault.address,
      partCount: 3n,
    }));
    expect((await hub.getGetState()).private_latest_id).toBe(3n);

    // And the public path stores under adequate funding.
    await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: partsList(KIND_PUBLIC, 1),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
  });

  // CAPSULE-BND-03: the original asserted private + public publish paths reject min-1 and accept the exact
  // ACK/value boundary, observing the ACK to the Vault. In VPB2 a successful ingest ALWAYS ACKs the bound
  // Vault (CapsuleHubBatchAck); underfunding bounces with no ACK. Re-expressed against both paths.
  it('CAPSULE-BND-03: successful batch ACKs the Vault; underfunded batch bounces with no commit', async () => {
    const { hub, vault } = await setupHub();
    const ackToVault = (res: any) => res.transactions.find((t: any) =>
      t.inMessage?.info?.type === 'internal' &&
      t.inMessage.info.dest?.toString() === vault.address.toString() &&
      t.inMessage.body && t.inMessage.body.beginParse().remainingBits >= 32);

    // Underfunded private batch: bounces (13509), nothing stored, no ACK to the Vault.
    const under = await hub.send(vault.getSender(), { value: toNano('0.025') },
      publishBatchToHub({ parts: partsList(KIND_PRIVATE, 1), authorWallet: vault.address }));
    expect(hubTxExit(under, hub)).toBe(13509);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);

    // Funded private batch: stores and ACKs the Vault.
    const okPriv = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: partsList(KIND_PRIVATE, 1), authorWallet: vault.address }));
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
    expect(ackToVault(okPriv)).toBeDefined();

    // Funded public batch: stores and ACKs the Vault.
    const okPub = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: partsList(KIND_PUBLIC, 1), authorWallet: vault.address, kind: KIND_PUBLIC }));
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
    expect(ackToVault(okPub)).toBeDefined();
  });

  // CAPSULE-BND-04: the public marketing marker is REQUIRED and must carry the exact ASCII note. HUB-BATCH-03
  // only exercises the happy path (a valid marker), so the rejection legs (13507 null / 13508 wrong value) are
  // kept here — they are live Phase-A gates (CapsuleHub.tact throwUnless 13507/13508) covered nowhere else.
  it('CAPSULE-BND-04: a public batch with a missing (13507) or wrong (13508) marketing marker is rejected, nothing stored', async () => {
    const missing = await setupHub();
    const r1 = await missing.hub.send(missing.vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: partsList(KIND_PUBLIC, 1), authorWallet: missing.vault.address, kind: KIND_PUBLIC, marketing: null,
    }));
    expect(hubTxExit(r1, missing.hub)).toBe(13507);
    expect((await missing.hub.getGetState()).public_latest_id).toBe(0n);

    const wrong = await setupHub();
    const r2 = await wrong.hub.send(wrong.vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: partsList(KIND_PUBLIC, 1), authorWallet: wrong.vault.address, kind: KIND_PUBLIC,
      marketing: beginCell().storeUint(1n, 152).endCell(), // 152-bit cell, but not the PLATHO marker ASCII
    }));
    expect(hubTxExit(r2, wrong.hub)).toBe(13508);
    expect((await wrong.hub.getGetState()).public_latest_id).toBe(0n);
  });

  // CAPSULE-BND-05: removed — the marketing-marker serialization was a Vault-message-body assertion on the
  // removed single-publish path; the marker is now a standalone marketing cell (marketingCell()), not a field
  // serialized inside a publish body.

  // CAPSULE-PAYLOAD-01: a declared hash field that does not match the actual ref cell hash is rejected. Private
  // body hash mismatch -> 13517; public body hash mismatch -> 13526 (verified in CapsuleHub.tact part walk).
  it('CAPSULE-PAYLOAD-01: declared hash != cell hash is rejected (private 13517 / public 13526)', async () => {
    const { hub, vault } = await setupHub();

    // Private: body_hash field lies about the body ref.
    const wrongBodyHash = cellHash(finalPrivateBodyCell(SIZE_1K, 0x99));
    const privRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: privatePartCustom({ bodyHash: wrongBodyHash }),
      authorWallet: vault.address,
    }));
    expect(hubTxExit(privRes, hub)).toBe(13517);

    // Public: body_hash field lies about the body ref.
    const wrongPublicBodyHash = cellHash(finalPublicBodyCell(0x99, 1024));
    const pubRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ bodyHash: wrongPublicBodyHash }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(pubRes, hub)).toBe(13526);

    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(0n);
    expect(state.public_latest_id).toBe(0n);
  });

  // CAPSULE-PAYLOAD-02: final private headers are STORED (recovered verbatim from the entry), while the body is
  // authenticated by hash only (not stored). A valid private batch stores the entry; the stored header cells
  // hash-match the supplied headers and the entry records the body_hash.
  it('CAPSULE-PAYLOAD-02: private headers stored verbatim, body authenticated by hash only', async () => {
    const { hub, vault } = await setupHub();
    const header0 = finalPrivateHeader0Cell(0x68);
    const header1 = finalPrivateHeader1Cell(0x69);
    const body = finalPrivateBodyCell(SIZE_1K, 0x62);

    await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: privatePartCustom({ h0Cell: header0, h1Cell: header1, bodyCell: body }),
      authorWallet: vault.address,
    }));

    const stored = await hub.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.header_0.hash().toString('hex')).toBe(header0.hash().toString('hex'));
    expect(stored.header_1.hash().toString('hex')).toBe(header1.hash().toString('hex'));
    expect(stored.body_hash).toBe(cellHash(body)); // body kept by hash, not stored
    const page = await hub.getGetPrivatePage(0n);
    expect(page.exists).toBe(true);
    expect(page.entry_count).toBe(1n);
  }, 30000);

  // CAPSULE-PAYLOAD-02B: a private header/body whose declared hash matches but whose byte SIZE is wrong is
  // rejected by the exact-shape gate (header_0 -> 13514, body -> 13518). VERIFY: requireExactPayloadCell checks
  // cells/bits/refs after the hash check, with the size exit being the second of each pair.
  it('CAPSULE-PAYLOAD-02B: private header/body wrong byte size rejected (13514 header0 / 13518 body)', async () => {
    const { hub, vault } = await setupHub();

    // Wrong header_0 size: 105 bytes instead of 140 (declared hash matches the wrong cell, so the shape gate
    // is what fires).
    const wrongHeader0 = snakeCell(105, 0x68);
    const h0Res = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: privatePartCustom({ h0Cell: wrongHeader0, h0Hash: cellHash(wrongHeader0) }),
      authorWallet: vault.address,
    }));
    expect(hubTxExit(h0Res, hub)).toBe(13514);

    // Wrong body size: 1139 bytes instead of 2228 (1K hybrid).
    const wrongBody = snakeCell(1139, 0x62);
    const bodyRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: privatePartCustom({ bodyCell: wrongBody, bodyHash: cellHash(wrongBody) }),
      authorWallet: vault.address,
    }));
    expect(hubTxExit(bodyRes, hub)).toBe(13518);

    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(0n);
  }, 30000);

  // CAPSULE-PAYLOAD-03: public size-class bounds. An allowed class (1K) stores; a body that overflows the size
  // class's cell/bit envelope is rejected by the public body shape gate (13527). A disallowed size_class value
  // (e.g. 3) is rejected by the size-class allow-list gate (13522).
  it('CAPSULE-PAYLOAD-03: public size class bounds — overflow 13527, disallowed class 13522', async () => {
    const { hub, vault } = await setupHub();

    // Allowed 1K class with a correctly sized body stores.
    await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ sizeClass: SIZE_1K }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect((await hub.getGetState()).public_latest_id).toBe(1n);

    // 1K class but a body one byte over the class envelope -> public payload shape gate (13527).
    const tooLargeBody = snakeCell(1025, 0x6e);
    const overflow = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ sizeClass: SIZE_1K, bodyCell: tooLargeBody, bodyHash: cellHash(tooLargeBody) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(overflow, hub)).toBe(13527);

    // A size_class value that is not in the allow list (3) -> 13522.
    const badClass = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ sizeClass: 3n }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(badClass, hub)).toBe(13522);

    expect((await hub.getGetState()).public_latest_id).toBe(1n);
  }, 30000);

  // CAPSULE-PAYLOAD-04: the public header is bounded to one byte-aligned cell with no refs. A header carrying a
  // ref (or otherwise violating the header shape) is rejected by the public header shape gate (13525).
  it('CAPSULE-PAYLOAD-04: public header must be a single byte-aligned ref-free cell (13525)', async () => {
    const { hub, vault } = await setupHub();

    // Max valid header (72 bytes) stores.
    const maxHeader = finalPublicHeaderCell(0x51, 72);
    await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ hCell: maxHeader, hHash: cellHash(maxHeader) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect((await hub.getGetState()).public_latest_id).toBe(1n);

    // Header carrying a ref violates the ref-free shape -> 13525.
    const refHeader = beginCell()
      .storeBuffer(Buffer.alloc(8, 0x53))
      .storeRef(beginCell().storeUint(0x54, 8).endCell())
      .endCell();
    const refRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ hCell: refHeader, hHash: cellHash(refHeader) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(refRes, hub)).toBe(13525);

    // Over-large header (73 bytes > 72) also -> 13525.
    const tooLargeHeader = finalPublicHeaderCell(0x52, 73);
    const bigRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ hCell: tooLargeHeader, hHash: cellHash(tooLargeHeader) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(bigRes, hub)).toBe(13525);

    expect((await hub.getGetState()).public_latest_id).toBe(1n);
  }, 30000);

  // CAPSULE-PAYLOAD-05: the public body cannot be empty, non-byte-aligned, or exceed the size-class ref
  // envelope. Empty / unaligned / ref-overflow bodies are all rejected by the public payload shape gate
  // (13527). Use refChainCell for the ref-overflow case.
  it('CAPSULE-PAYLOAD-05: public body empty / unaligned / too-many-refs rejected (13527)', async () => {
    const { hub, vault } = await setupHub();

    const emptyBody = beginCell().endCell();
    const emptyRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ bodyCell: emptyBody, bodyHash: cellHash(emptyBody) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(emptyRes, hub)).toBe(13527);

    const unalignedBody = beginCell().storeUint(1, 1).endCell();
    const unalignedRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ bodyCell: unalignedBody, bodyHash: cellHash(unalignedBody) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(unalignedRes, hub)).toBe(13527);

    // A ref chain longer than the 1K class envelope (9 cells / 8 refs) -> ref overflow.
    const tooManyRefsBody = refChainCell(12);
    const refRes = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: publicPartCustom({ bodyCell: tooManyRefsBody, bodyHash: cellHash(tooManyRefsBody) }),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
    }));
    expect(hubTxExit(refRes, hub)).toBe(13527);

    expect((await hub.getGetState()).public_latest_id).toBe(0n);
  }, 30000);

  // CAPSULE-BND-06: a zero-fee public batch (protocol_fee_total == 0) still stores the entry and ACKs the
  // Vault as long as the per-part value reserves are funded. accrued_plato_fee_ton stays 0.
  it('CAPSULE-BND-06: zero-fee public batch still stores the entry and ACKs the Vault', async () => {
    const { hub, vault } = await setupHub();

    const res = await hub.send(vault.getSender(), { value: FUND }, publishBatchToHub({
      parts: partsList(KIND_PUBLIC, 1),
      authorWallet: vault.address,
      kind: KIND_PUBLIC,
      protocolFeeTotal: 0n,
    }));

    const state = await hub.getGetState();
    expect(state.public_latest_id).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
    expect((await hub.getGetPublicEntry(0n)).exists).toBe(true);
    // ACK emitted to the bound Vault.
    const ack = res.transactions.find((t: any) =>
      t.inMessage?.info?.type === 'internal' &&
      t.inMessage.info.dest?.toString() === vault.address.toString() &&
      t.inMessage.body && t.inMessage.body.beginParse().remainingBits >= 32);
    expect(ack).toBeDefined();
  }, 30000);
});
