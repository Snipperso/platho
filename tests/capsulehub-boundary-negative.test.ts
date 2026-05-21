import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  PublishPrivateDirect,
  PublishPublicDirect,
  PublishPrivateFromVault,
  PublishPublicFromVault,
  storePublishPublicDirect,
  storePublishPublicFromVault,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { MockVaultAckSink } from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';

const PRIVATE_STANDARD_FEE = 5_000_000n;
const PRIVATE_LONG_TERM_FEE = 10_000_000n;
const PUBLIC_FEE = 5_000_000n;
const PRIVATE_STANDARD_EXEC = 3_000_000n;
const PRIVATE_LONG_TERM_EXEC = 4_000_000n;
const PUBLIC_EXEC = 3_000_000n;
const KEEPALIVE = 1_000_000n;
const PRIVATE_ENTRY_STORAGE = 4_000_000n;
const PUBLIC_ENTRY_STORAGE = 3_000_000n;
const PAGE_STORAGE = 10_000_000n;
const ACK_RESERVE = 30_000_000n;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.BND.${label}`).digest('hex'));
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

function privateDirect(overrides?: Partial<PublishPrivateDirect>): PublishPrivateDirect {
  return {
    $$type: 'PublishPrivateDirect',
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: hash256('h0'),
    header_1_hash: hash256('h1'),
    body_hash: hash256('body'),
    protocol_fee_paid: PRIVATE_STANDARD_FEE,
    ...overrides,
  } as PublishPrivateDirect;
}

function publicDirect(author: Address, overrides?: Partial<PublishPublicDirect>): PublishPublicDirect {
  return {
    $$type: 'PublishPublicDirect',
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    body_hash: hash256('public-body'),
    protocol_fee_paid: PUBLIC_FEE,
    ...overrides,
  } as PublishPublicDirect;
}

function vaultPrivate(overrides?: Partial<PublishPrivateFromVault>): PublishPrivateFromVault {
  return {
    $$type: 'PublishPrivateFromVault',
    bounce_id: 1n,
    publish_id: hash256('vault-private-publish'),
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: hash256('vault-h0'),
    header_1_hash: hash256('vault-h1'),
    body_hash: hash256('vault-body'),
    protocol_fee_paid: PRIVATE_STANDARD_FEE,
    ...overrides,
  } as PublishPrivateFromVault;
}

function vaultPublic(author: Address, overrides?: Partial<PublishPublicFromVault>): PublishPublicFromVault {
  return {
    $$type: 'PublishPublicFromVault',
    bounce_id: 2n,
    publish_id: hash256('vault-public-publish'),
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    body_hash: hash256('vault-public-body'),
    protocol_fee_paid: PUBLIC_FEE,
    ...overrides,
  } as PublishPublicFromVault;
}

describe('CapsuleHub value/storage boundary negative matrix', () => {
  it('CAPSULE-BND-01: direct private publish rejects min-1 and accepts exact first-page reserves', async () => {
    const { capsule, author } = await setup();
    const required = PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + PAGE_STORAGE;

    await capsule.send(author.getSender(), { value: required - 1n }, privateDirect());
    expect((await capsule.getGetState()).private_entry_count).toBe(0n);

    await capsule.send(author.getSender(), { value: required + 1n }, privateDirect());
    expect((await capsule.getGetState()).private_entry_count).toBe(0n);

    await capsule.send(author.getSender(), { value: required }, privateDirect());
    const state = await capsule.getGetState();
    expect(state.private_entry_count).toBe(1n);
    expect(state.private_page_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PRIVATE_STANDARD_FEE);
  });

  it('CAPSULE-BND-02: long-term private and public direct exact boundaries are enforced', async () => {
    const { capsule, author } = await setup();
    const longTermRequired = PRIVATE_LONG_TERM_FEE + PRIVATE_LONG_TERM_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + PAGE_STORAGE;
    const publicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE;
    const publicSamePageRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE;

    await capsule.send(author.getSender(), { value: longTermRequired - 1n }, privateDirect({
      size_class: 2n,
      crypto_suite: 2n,
      protocol_fee_paid: PRIVATE_LONG_TERM_FEE,
    }));
    expect((await capsule.getGetState()).private_entry_count).toBe(0n);

    await capsule.send(author.getSender(), { value: longTermRequired }, privateDirect({
      size_class: 2n,
      crypto_suite: 2n,
      protocol_fee_paid: PRIVATE_LONG_TERM_FEE,
    }));
    expect((await capsule.getGetState()).private_entry_count).toBe(1n);

    await capsule.send(author.getSender(), { value: publicRequired - 1n }, publicDirect(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(0n);

    await capsule.send(author.getSender(), { value: publicRequired }, publicDirect(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(1n);

    await capsule.send(author.getSender(), { value: publicRequired }, publicDirect(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(1n);

    await capsule.send(author.getSender(), { value: publicSamePageRequired - 1n }, publicDirect(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(1n);

    await capsule.send(author.getSender(), { value: publicSamePageRequired }, publicDirect(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(2n);
    expect((await capsule.getGetState()).public_page_count).toBe(1n);
  });

  it('CAPSULE-BND-03: Vault publish paths reject min-1 and accept exact ACK/value boundaries', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress, author } = await setup();
    const vaultPrivateRequired = PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;
    const vaultPublicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE + ACK_RESERVE;

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPrivateRequired - 1n }, vaultPrivate());
    expect((await capsule.getGetState()).private_entry_count).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPrivateRequired }, vaultPrivate());
    expect((await capsule.getGetState()).private_entry_count).toBe(1n);
    expect((await mockVault.getGetState()).ack_count).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPublicRequired - 1n }, vaultPublic(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(1n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPublicRequired }, vaultPublic(author.address));
    expect((await capsule.getGetState()).public_entry_count).toBe(1n);
    expect((await mockVault.getGetState()).ack_count).toBe(2n);
  });

  it('CAPSULE-BND-04: public publish requires the Platho marketing marker', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress, author } = await setup();
    const publicRequired = PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE;
    const vaultPublicRequired = publicRequired + ACK_RESERVE;

    await capsule.send(author.getSender(), { value: publicRequired }, publicDirect(author.address, {
      marketing_note: 0n,
    }));
    expect((await capsule.getGetState()).public_entry_count).toBe(0n);

    await capsule.send(blockchain.sender(mockVaultAddress), { value: vaultPublicRequired }, vaultPublic(author.address, {
      marketing_note: 0n,
    }));
    expect((await capsule.getGetState()).public_entry_count).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(0n);
  });

  it('CAPSULE-BND-05: public marker serializes as clear ASCII in the publish body', () => {
    const author = fixtureAddress('MARKER_SERIALIZATION_AUTHOR');
    const marker = Buffer.from('sent via Platho.App', 'utf8').toString('hex');
    const directBody = beginCell().store(storePublishPublicDirect(publicDirect(author))).endCell();
    const vaultBody = beginCell().store(storePublishPublicFromVault(vaultPublic(author))).endCell();

    expect(directBody.toBoc().toString('hex')).toContain(marker);
    expect(vaultBody.toBoc().toString('hex')).toContain(marker);
  });
});
