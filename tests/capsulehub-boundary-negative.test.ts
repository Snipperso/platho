import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  PublishPrivateFromVault,
  PublishPublicFromVault,
  storePublishPublicFromVault,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { MockVaultAckSink } from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
  snakeCell,
} from './helpers/capsule-cells';

const PRIVATE_HYBRID_FEE = 10_000_000n;
const PRIVATE_LONG_TERM_FEE = 10_000_000n;
const PUBLIC_FEE = 10_000_000n;
const PRIVATE_HYBRID_EXEC_BY_SIZE_CLASS = new Map<bigint, bigint>([
  [1n, 4_200_000n],
  [2n, 4_300_000n],
  [4n, 4_500_000n],
  [8n, 5_000_000n],
  [16n, 5_800_000n],
  [32n, 7_600_000n],
]);
const PUBLIC_EXEC = 2_400_000n;
const PUBLIC_EXEC_BY_SIZE_CLASS = new Map<bigint, bigint>([
  [1n, 2_400_000n],
  [2n, 4_300_000n],
  [4n, 4_500_000n],
  [8n, 5_000_000n],
  [16n, 5_800_000n],
  [32n, 7_600_000n],
]);
const KEEPALIVE = 1_000_000n;
const PRIVATE_ENTRY_STORAGE = 3_300_000n;
const PUBLIC_ENTRY_STORAGE = 7_400_000n;
const PAGE_STORAGE = 0n;
const ACK_RESERVE = 30_000_000n;
const MANIFEST_HASH = hash256('capsulehub-boundary-manifest');
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.BND.${label}`).digest('hex'));
}

function payloadCell(label: string): Cell {
  return beginCell().storeBuffer(Buffer.from(`PLATHO.V1.CAPSULE.BND.PAYLOAD.${label}`, 'utf8')).endCell();
}

function refChainCell(cells: number, fill = 0x41): Cell {
  let tail = beginCell().storeUint(fill, 8).endCell();
  for (let i = 1; i < cells; i += 1) {
    tail = beginCell().storeUint(fill + i, 8).storeRef(tail).endCell();
  }
  return tail;
}

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.CAPSULE.BND.${label}`).digest());
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const author = await blockchain.treasury('capsule-bnd-author');
  const operator = await blockchain.treasury('capsule-bnd-operator');
  const feeAccumulator = fixtureAddress('FEE_ACCUMULATOR');
  const genesisController = fixtureAddress('GENESIS_CONTROLLER');

  const mockVaultInit = await MockVaultAckSink.init();
  const mockVaultAddress = contractAddress(0, mockVaultInit);
  await blockchain.setShardAccount(mockVaultAddress, createShardAccount({
    address: mockVaultAddress,
    code: mockVaultInit.code,
    data: mockVaultInit.data,
    balance: toNano('1'),
    workchain: mockVaultAddress.workChain,
  }));
  const mockVault = blockchain.openContract(new MockVaultAckSink(mockVaultAddress, mockVaultInit));

  const init = await CapsuleHub.init(feeAccumulator, mockVaultAddress, true, true, MANIFEST_HASH, genesisController);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));

  return { blockchain, capsule: blockchain.openContract(new CapsuleHub(address, init)), mockVault, mockVaultAddress, author, operator };
}

function vaultPrivate(overrides?: Partial<PublishPrivateFromVault>): PublishPrivateFromVault {
  const sizeClass = overrides?.size_class ?? 1n;
  const cryptoSuite = overrides?.crypto_suite ?? 2n;
  const header_0 = overrides?.header_0 ?? finalPrivateHeader0Cell(0x76);
  const header_1 = overrides?.header_1 ?? finalPrivateHeader1Cell(0x77);
  const body = overrides?.body ?? finalPrivateBodyCell(sizeClass, 0x78, cryptoSuite);
  return {
    $$type: 'PublishPrivateFromVault',
    bounce_id: 1n,
    bounce_tag: 1n,
    publish_id: hash256('vault-private-publish'),
    size_class: sizeClass,
    crypto_suite: cryptoSuite,
    header_0_hash: cellHash(header_0),
    header_1_hash: cellHash(header_1),
    body_hash: cellHash(body),
    header_0,
    header_1,
    body,
    protocol_fee_paid: PRIVATE_HYBRID_FEE,
    ...overrides,
  } as PublishPrivateFromVault;
}

function vaultPublic(author: Address, overrides?: Partial<PublishPublicFromVault>): PublishPublicFromVault {
  const sizeClass = overrides?.size_class ?? 1n;
  const header = overrides?.header ?? finalPublicHeaderCell(0x50);
  const body = overrides?.body ?? finalPublicBodyCell(0x79);
  return {
    $$type: 'PublishPublicFromVault',
    bounce_id: 2n,
    bounce_tag: 2n,
    publish_id: hash256('vault-public-publish'),
    size_class: sizeClass,
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    header_hash: cellHash(header),
    body_hash: cellHash(body),
    header,
    body,
    protocol_fee_paid: PUBLIC_FEE,
    ...overrides,
  } as PublishPublicFromVault;
}

function privateExecReserve(sizeClass: bigint): bigint {
  const value = PRIVATE_HYBRID_EXEC_BY_SIZE_CLASS.get(sizeClass);
  if (value === undefined) throw new Error(`missing private exec reserve for size class ${sizeClass}`);
  return value;
}

function privateRequired(sizeClass = 1n): bigint {
  return PRIVATE_HYBRID_FEE + privateExecReserve(sizeClass) + KEEPALIVE + PRIVATE_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
}

function publicExecReserve(sizeClass = 1n): bigint {
  const value = PUBLIC_EXEC_BY_SIZE_CLASS.get(sizeClass);
  if (value === undefined) throw new Error(`missing public exec reserve for size class ${sizeClass}`);
  return value;
}

function publicRequired(sizeClass = 1n): bigint {
  return PUBLIC_FEE + publicExecReserve(sizeClass) + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
}

describe('CapsuleHub value/storage boundary negative matrix', () => {
  it('CAPSULE-BND-01: Vault private publish rejects min-1 and accepts exact/surcharge fixed reserve', async () => {
    const { blockchain, capsule, mockVaultAddress } = await setup();
    const firstPageRequired = privateRequired(1n);
    const samePageRequired = privateRequired(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: firstPageRequired - 1n }, vaultPrivate());
    expect((await capsule.getGetState()).private_latest_id).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: firstPageRequired }, vaultPrivate({ publish_id: hash256('private-boundary-exact') }));
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: samePageRequired + 1n }, vaultPrivate({ publish_id: hash256('private-boundary-surcharge') }));
    const state = await capsule.getGetState();
    expect(state.private_latest_id).toBe(2n);
    expect(state.private_page_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PRIVATE_HYBRID_FEE * 2n);
  });

  it.each([
    ['private', 1_000_000n],
    ['private', 50_000_000n],
    ['public', 1_000_000n],
    ['public', 50_000_000n],
  ] as const)('RT-VCAPS-004: %s publish surcharge %s never increases accrued_plato_fee_ton', async (kind, surcharge) => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();

    if (kind === 'private') {
      await capsule.send(blockchain.sender(mockVaultAddress), { value: privateRequired(1n) + surcharge }, vaultPrivate({
        publish_id: hash256(`rt-vcaps-004-private-${surcharge}`),
      }));
      const state = await capsule.getGetState();
      expect(state.private_latest_id).toBe(1n);
      expect(state.accrued_plato_fee_ton).toBe(PRIVATE_HYBRID_FEE);
      return;
    }

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicRequired(1n) + surcharge }, vaultPublic(author.address, {
      publish_id: hash256(`rt-vcaps-004-public-${surcharge}`),
    }));
    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PUBLIC_FEE);
  });

  it('CAPSULE-BND-02: long-term private and public Vault exact boundaries are enforced', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const longTermFirstPageRequired = privateRequired(1n);
    const private32kRequired = privateRequired(32n);
    const publicFirstPageRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
    const publicSamePageRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: longTermFirstPageRequired - 1n }, vaultPrivate({
      publish_id: hash256('long-term-underfunded'),
      size_class: 1n,
      crypto_suite: 2n,
      protocol_fee_paid: PRIVATE_LONG_TERM_FEE,
    }));
    expect((await capsule.getGetState()).private_latest_id).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: longTermFirstPageRequired }, vaultPrivate({
      publish_id: hash256('long-term-exact'),
      size_class: 1n,
      crypto_suite: 2n,
      protocol_fee_paid: PRIVATE_LONG_TERM_FEE,
    }));
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: private32kRequired - 1n }, vaultPrivate({
      publish_id: hash256('private-32k-underfunded'),
      size_class: 32n,
    }));
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: private32kRequired }, vaultPrivate({
      publish_id: hash256('private-32k-exact'),
      size_class: 32n,
    }));
    expect((await capsule.getGetState()).private_latest_id).toBe(2n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicFirstPageRequired - 1n }, vaultPublic(author.address, {
      publish_id: hash256('public-underfunded'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicFirstPageRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-exact-1'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicSamePageRequired + 1n }, vaultPublic(author.address, {
      publish_id: hash256('public-exact-plus-1'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(2n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicSamePageRequired - 1n }, vaultPublic(author.address, {
      publish_id: hash256('public-underfunded-2'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(2n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicSamePageRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-exact-2'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(3n);
  });

  it('CAPSULE-BND-03: Vault publish paths reject min-1 and accept exact ACK/value boundaries', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress, author } = await setup();
    const vaultPrivateRequired = privateRequired(1n);
    const vaultPublicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPrivateRequired - 1n }, vaultPrivate());
    expect((await capsule.getGetState()).private_latest_id).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPrivateRequired }, vaultPrivate());
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);
    expect((await mockVault.getGetState()).ack_count).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPublicRequired - 1n }, vaultPublic(author.address));
    expect((await capsule.getGetState()).public_latest_id).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPublicRequired }, vaultPublic(author.address));
    expect((await capsule.getGetState()).public_latest_id).toBe(1n);
    expect((await mockVault.getGetState()).ack_count).toBe(2n);
  });

  it('CAPSULE-BND-04: public publish requires the Platho marketing marker', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress, author } = await setup();
    const vaultPublicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPublicRequired }, vaultPublic(author.address, {
      marketing_note: 0n,
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(0n);
  });

  it('CAPSULE-BND-05: public marker serializes as clear ASCII in the publish body', () => {
    const author = fixtureAddress('MARKER_SERIALIZATION_AUTHOR');
    const marker = Buffer.from('sent via Platho.App', 'utf8').toString('hex');
    const vaultBody = beginCell().store(storePublishPublicFromVault(vaultPublic(author))).endCell();

    expect(vaultBody.toBoc().toString('hex')).toContain(marker);
  });

  it('CAPSULE-PAYLOAD-01: Vault publish rejects nonzero hash mismatch without creating an entry', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const required = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-mismatched-hash'),
      body_hash: cellHash(payloadCell('different-body')),
    }));

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  });

  it('CAPSULE-PAYLOAD-02: final private headers are stored and body is authenticated by hash only', async () => {
    const { blockchain, capsule, mockVaultAddress } = await setup();
    const required = privateRequired(1n);
    const header_0 = finalPrivateHeader0Cell(0x68);
    const header_1 = finalPrivateHeader1Cell(0x69);
    const body = finalPrivateBodyCell(1, 0x62);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPrivate({
      publish_id: hash256('private-payload-store'),
      header_0_hash: cellHash(header_0),
      header_1_hash: cellHash(header_1),
      body_hash: cellHash(body),
      header_0,
      header_1,
      body,
    }));

    const stored = await capsule.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.header_0.hash().toString('hex')).toBe(header_0.hash().toString('hex'));
    expect(stored.header_1.hash().toString('hex')).toBe(header_1.hash().toString('hex'));
    expect(stored.body_hash).toBe(cellHash(body));
    expect(stored.page_id).toBe(0n);
    expect(stored.page_offset).toBe(0n);
    const page = await capsule.getGetPrivatePage(0n);
    expect(page.exists).toBe(true);
    expect(page.entry_count).toBe(1n);
  }, 30000);

  it('CAPSULE-PAYLOAD-02B: private publish rejects non-final header/body byte sizes', async () => {
    const { blockchain, capsule, mockVaultAddress } = await setup();
    const required = privateRequired(1n);
    const wrongHeader0 = snakeCell(105, 0x68);
    const wrongBody = snakeCell(1139, 0x62);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPrivate({
      publish_id: hash256('private-wrong-header'),
      header_0: wrongHeader0,
      header_0_hash: cellHash(wrongHeader0),
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPrivate({
      publish_id: hash256('private-wrong-body'),
      body: wrongBody,
      body_hash: cellHash(wrongBody),
    }));

    const state = await capsule.getGetState();
    expect(state.private_latest_id).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  }, 30000);

  it('CAPSULE-PAYLOAD-03: public publish accepts selected 1-32 KiB size classes and rejects larger bodies', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const firstPageRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
    const samePageRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;
    const public32kRequired = publicRequired(32n);
    const tinyBody = payloadCell('public-short');
    const maxBody = snakeCell(1024, 0x6f);
    const tooLargeBody = snakeCell(1025, 0x6e);
    const public32kBody = snakeCell(32 * 1024, 0x5a);
    const publicTooLarge32kBody = snakeCell((32 * 1024) + 1, 0x5b);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: firstPageRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-tiny'),
      body_hash: cellHash(tinyBody),
      body: tinyBody,
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: samePageRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-max'),
      body_hash: cellHash(maxBody),
      body: maxBody,
    }));

    await capsule.send(blockchain.sender(mockVaultAddress), { value: samePageRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-too-large'),
      body_hash: cellHash(tooLargeBody),
      body: tooLargeBody,
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: public32kRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-32k'),
      size_class: 32n,
      body_hash: cellHash(public32kBody),
      body: public32kBody,
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: public32kRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-too-large-32k'),
      size_class: 32n,
      body_hash: cellHash(publicTooLarge32kBody),
      body: publicTooLarge32kBody,
    }));

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(3n);
    expect(state.public_page_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PUBLIC_FEE * 3n);
  }, 30000);

  it('CAPSULE-PAYLOAD-04: public header is bounded to one byte-aligned cell without refs', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const required = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
    const maxHeader = finalPublicHeaderCell(0x51, 72);
    const tooLargeHeader = finalPublicHeaderCell(0x52, 73);
    const refHeader = beginCell()
      .storeBuffer(Buffer.alloc(8, 0x53))
      .storeRef(beginCell().storeUint(0x54, 8).endCell())
      .endCell();
    const emptyHeader = beginCell().endCell();
    const unalignedHeader = beginCell().storeUint(1, 1).endCell();

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-header-max'),
      header_hash: cellHash(maxHeader),
      header: maxHeader,
    }));

    for (const [publish_id, header] of [
      [hash256('public-header-too-large'), tooLargeHeader],
      [hash256('public-header-ref'), refHeader],
      [hash256('public-header-empty'), emptyHeader],
      [hash256('public-header-unaligned'), unalignedHeader],
    ] as const) {
      await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
        publish_id,
        header_hash: cellHash(header),
        header,
      }));
    }

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PUBLIC_FEE);
  }, 30000);

  it('CAPSULE-PAYLOAD-05: public body cannot be empty, non-byte-aligned, or exceed the 9-cell/8-ref envelope', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const required = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
    const emptyBody = beginCell().endCell();
    const unalignedBody = beginCell().storeUint(1, 1).endCell();
    const tooManyRefsBody = refChainCell(10);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-empty-body'),
      body_hash: cellHash(emptyBody),
      body: emptyBody,
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-unaligned-body'),
      body_hash: cellHash(unalignedBody),
      body: unalignedBody,
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-too-many-body-refs'),
      body_hash: cellHash(tooManyRefsBody),
      body: tooManyRefsBody,
    }));

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  }, 30000);

  it('CAPSULE-BND-06: zero-fee public publish still stores the entry and sends ACK when exact reserves are funded', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress, author } = await setup();
    const zeroFeeRequired = PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: zeroFeeRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-zero-fee'),
      protocol_fee_paid: 0n,
    }));

    const state = await capsule.getGetState();
    const stored = await capsule.getGetPublicEntry(0n);
    expect(state.public_latest_id).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
    expect(stored.exists).toBe(true);
    expect((await mockVault.getGetState()).ack_count).toBe(1n);
  }, 30000);
});
