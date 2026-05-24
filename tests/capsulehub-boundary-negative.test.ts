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

const PRIVATE_STANDARD_FEE = 5_000_000n;
const PRIVATE_LONG_TERM_FEE = 10_000_000n;
const PUBLIC_FEE = 5_000_000n;
const PRIVATE_STANDARD_EXEC = 3_000_000n;
const PRIVATE_LONG_TERM_EXEC = 4_000_000n;
const PUBLIC_EXEC = 3_000_000n;
const KEEPALIVE = 1_000_000n;
const PRIVATE_ENTRY_STORAGE = 4_000_000n;
const PUBLIC_ENTRY_STORAGE = 1_000_000n;
const ACK_RESERVE = 30_000_000n;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.BND.${label}`).digest('hex'));
}

function payloadCell(label: string): Cell {
  return beginCell().storeBuffer(Buffer.from(`PLATHO.V1.CAPSULE.BND.PAYLOAD.${label}`, 'utf8')).endCell();
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

  const init = await CapsuleHub.init(feeAccumulator, mockVaultAddress, true, true, 0n, genesisController);
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
  const header_0 = overrides?.header_0 ?? finalPrivateHeader0Cell(0x76);
  const header_1 = overrides?.header_1 ?? finalPrivateHeader1Cell(0x77);
  const body = overrides?.body ?? finalPrivateBodyCell(sizeClass, 0x78);
  return {
    $$type: 'PublishPrivateFromVault',
    bounce_id: 1n,
    bounce_tag: 1n,
    publish_id: hash256('vault-private-publish'),
    size_class: sizeClass,
    crypto_suite: 1n,
    header_0_hash: cellHash(header_0),
    header_1_hash: cellHash(header_1),
    body_hash: cellHash(body),
    header_0,
    header_1,
    body,
    protocol_fee_paid: PRIVATE_STANDARD_FEE,
    ...overrides,
  } as PublishPrivateFromVault;
}

function vaultPublic(author: Address, overrides?: Partial<PublishPublicFromVault>): PublishPublicFromVault {
  const header = overrides?.header ?? finalPublicHeaderCell(0x50);
  const body = overrides?.body ?? finalPublicBodyCell(0x79);
  return {
    $$type: 'PublishPublicFromVault',
    bounce_id: 2n,
    bounce_tag: 2n,
    publish_id: hash256('vault-public-publish'),
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

describe('CapsuleHub value/storage boundary negative matrix', () => {
  it('CAPSULE-BND-01: Vault private publish rejects min-1 and accepts exact/surcharge fixed reserve', async () => {
    const { blockchain, capsule, mockVaultAddress } = await setup();
    const required = PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required - 1n }, vaultPrivate());
    expect((await capsule.getGetState()).private_latest_id).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPrivate({ publish_id: hash256('private-boundary-exact') }));
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required + 1n }, vaultPrivate({ publish_id: hash256('private-boundary-surcharge') }));
    const state = await capsule.getGetState();
    expect(state.private_latest_id).toBe(2n);
    expect(state.accrued_plato_fee_ton).toBe(PRIVATE_STANDARD_FEE * 2n);
  });

  it('CAPSULE-BND-02: long-term private and public Vault exact boundaries are enforced', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const longTermRequired = PRIVATE_LONG_TERM_FEE + PRIVATE_LONG_TERM_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE;
    const publicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: longTermRequired - 1n }, vaultPrivate({
      publish_id: hash256('long-term-underfunded'),
      size_class: 2n,
      crypto_suite: 2n,
      protocol_fee_paid: PRIVATE_LONG_TERM_FEE,
    }));
    expect((await capsule.getGetState()).private_latest_id).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: longTermRequired }, vaultPrivate({
      publish_id: hash256('long-term-exact'),
      size_class: 2n,
      crypto_suite: 2n,
      protocol_fee_paid: PRIVATE_LONG_TERM_FEE,
    }));
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicRequired - 1n }, vaultPublic(author.address, {
      publish_id: hash256('public-underfunded'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-exact-1'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicRequired + 1n }, vaultPublic(author.address, {
      publish_id: hash256('public-exact-plus-1'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(2n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicRequired - 1n }, vaultPublic(author.address, {
      publish_id: hash256('public-underfunded-2'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(2n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: publicRequired }, vaultPublic(author.address, {
      publish_id: hash256('public-exact-2'),
    }));
    expect((await capsule.getGetState()).public_latest_id).toBe(3n);
  });

  it('CAPSULE-BND-03: Vault publish paths reject min-1 and accept exact ACK/value boundaries', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress, author } = await setup();
    const vaultPrivateRequired = PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE;
    const vaultPublicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;

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
    const vaultPublicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;

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
    const required = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-mismatched-hash'),
      body_hash: cellHash(payloadCell('different-body')),
    }));

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  });

  it('CAPSULE-PAYLOAD-02: final private payload cells are stored and retrievable by entry id', async () => {
    const { blockchain, capsule, mockVaultAddress } = await setup();
    const required = PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE;
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
    expect(stored.body.hash().toString('hex')).toBe(body.hash().toString('hex'));
  }, 30000);

  it('CAPSULE-PAYLOAD-02B: private publish rejects non-final header/body byte sizes', async () => {
    const { blockchain, capsule, mockVaultAddress } = await setup();
    const required = PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE;
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

  it('CAPSULE-PAYLOAD-03: public publish accepts variable bodies up to 1024 bytes and rejects larger bodies', async () => {
    const { blockchain, capsule, mockVaultAddress, author } = await setup();
    const required = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE;
    const tinyBody = payloadCell('public-short');
    const maxBody = snakeCell(1024, 0x6f);
    const tooLargeBody = snakeCell(1025, 0x6e);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-tiny'),
      body_hash: cellHash(tinyBody),
      body: tinyBody,
    }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-max'),
      body_hash: cellHash(maxBody),
      body: maxBody,
    }));

    await capsule.send(blockchain.sender(mockVaultAddress), { value: required }, vaultPublic(author.address, {
      publish_id: hash256('public-too-large'),
      body_hash: cellHash(tooLargeBody),
      body: tooLargeBody,
    }));

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(2n);
    expect(state.accrued_plato_fee_ton).toBe(PUBLIC_FEE * 2n);
  }, 30000);
});
