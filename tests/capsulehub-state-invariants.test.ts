import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  PublishPrivateDirect,
  PublishPublicDirect,
  PublishPrivateFromVault,
  PublishPublicFromVault,
  FlushFees,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { MockVaultAckSink } from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';

const PRIVATE_STANDARD_FEE = 5_000_000n;
const PUBLIC_FEE = 5_000_000n;
const PRIVATE_REQUIRED = 5_000_000n + 3_000_000n + 1_000_000n + 4_000_000n + 10_000_000n;
const PUBLIC_REQUIRED = 5_000_000n + 3_000_000n + 1_000_000n + 3_000_000n + 10_000_000n;
const ACK_RESERVE = 30_000_000n;
const FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;
const VAULT_PRIVATE_REQUIRED = PRIVATE_REQUIRED + ACK_RESERVE;
const VAULT_PUBLIC_REQUIRED = PUBLIC_REQUIRED + ACK_RESERVE;
const PAGE_SIZE = 256n;
const PRIVATE_NO_PAGE_REQUIRED = 5_000_000n + 3_000_000n + 1_000_000n + 4_000_000n;
const PUBLIC_NO_PAGE_REQUIRED = 5_000_000n + 3_000_000n + 1_000_000n + 3_000_000n;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.INV.${label}`).digest('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.CAPSULE.INV.${label}`).digest());
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const author = await blockchain.treasury('capsule-inv-author');
  const attacker = await blockchain.treasury('capsule-inv-attacker');
  const operator = await blockchain.treasury('capsule-inv-operator');

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

  const init = await CapsuleHub.init(fixtureAddress('MISSING_FEE_ACCUMULATOR'), mockVaultAddress, true, true, 0n, fixtureAddress('GENESIS_CONTROLLER'));
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  return { blockchain, capsule: blockchain.openContract(new CapsuleHub(address, init)), mockVault, mockVaultAddress, author, attacker, operator };
}

function privateDirect(step: number, overrides?: Partial<PublishPrivateDirect>): PublishPrivateDirect {
  return {
    $$type: 'PublishPrivateDirect',
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: hash256(`h0-${step}`),
    header_1_hash: hash256(`h1-${step}`),
    body_hash: hash256(`body-${step}`),
    protocol_fee_paid: PRIVATE_STANDARD_FEE,
    ...overrides,
  } as PublishPrivateDirect;
}

function publicDirect(author: Address, step: number, overrides?: Partial<PublishPublicDirect>): PublishPublicDirect {
  return {
    $$type: 'PublishPublicDirect',
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    body_hash: hash256(`public-${step}`),
    protocol_fee_paid: PUBLIC_FEE,
    ...overrides,
  } as PublishPublicDirect;
}

function vaultPrivate(step: number, overrides?: Partial<PublishPrivateFromVault>): PublishPrivateFromVault {
  return {
    $$type: 'PublishPrivateFromVault',
    bounce_id: BigInt(10_000 + step),
    publish_id: hash256(`vault-private-${step}`),
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: hash256(`vault-h0-${step}`),
    header_1_hash: hash256(`vault-h1-${step}`),
    body_hash: hash256(`vault-body-${step}`),
    protocol_fee_paid: PRIVATE_STANDARD_FEE,
    ...overrides,
  } as PublishPrivateFromVault;
}

function vaultPublic(author: Address, step: number, overrides?: Partial<PublishPublicFromVault>): PublishPublicFromVault {
  return {
    $$type: 'PublishPublicFromVault',
    bounce_id: BigInt(20_000 + step),
    publish_id: hash256(`vault-public-${step}`),
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    body_hash: hash256(`vault-public-body-${step}`),
    protocol_fee_paid: PUBLIC_FEE,
    ...overrides,
  } as PublishPublicFromVault;
}

describe('CapsuleHub state-machine invariants', () => {
  it('CAPSULE-INV-01: deterministic direct/Vault publish and flush walks preserve counters and accrued fees', async () => {
    for (const seed of [0xcab50001, 0xcab50002, 0xcab50003]) {
      const { blockchain, capsule, mockVault, mockVaultAddress, author, attacker, operator } = await setup();
      const rng = makeRng(seed);
      let privateLatest = 0n;
      let publicLatest = 0n;
      let privateCount = 0n;
      let publicCount = 0n;
      let privatePages = 0n;
      let publicPages = 0n;
      let accrued = 0n;
      let ackCount = 0n;
      let debugContext = `seed ${seed} initial`;

      async function assertModel() {
        const state = await capsule.getGetState();
        expect(state.private_latest_id, `${debugContext}: private_latest`).toBe(privateLatest);
        expect(state.public_latest_id, `${debugContext}: public_latest`).toBe(publicLatest);
        expect(state.private_entry_count, `${debugContext}: private_count`).toBe(privateCount);
        expect(state.public_entry_count, `${debugContext}: public_count`).toBe(publicCount);
        expect(state.private_page_count, `${debugContext}: private_page_count`).toBe(privatePages);
        expect(state.public_page_count, `${debugContext}: public_page_count`).toBe(publicPages);
        expect(state.accrued_plato_fee_ton, `${debugContext}: accrued`).toBe(accrued);
        expect((await mockVault.getGetState()).ack_count, `${debugContext}: ack_count`).toBe(ackCount);
      }

      function notePrivateSuccess(fee: bigint) {
        if ((privateLatest % PAGE_SIZE) === 0n) privatePages += 1n;
        privateCount += 1n;
        privateLatest += 1n;
        accrued += fee;
      }

      function notePublicSuccess(fee: bigint) {
        if ((publicLatest % PAGE_SIZE) === 0n) publicPages += 1n;
        publicCount += 1n;
        publicLatest += 1n;
        accrued += fee;
      }

      for (let step = 0; step < 45; step += 1) {
        const op = rng() % 8;
        if (op === 0) {
          const underfunded = (rng() % 5) === 0;
          const required = (privateLatest % PAGE_SIZE) === 0n ? PRIVATE_REQUIRED : PRIVATE_NO_PAGE_REQUIRED;
          debugContext = `seed ${seed} step ${step} private-direct underfunded=${underfunded}`;
          await capsule.send(author.getSender(), { value: underfunded ? required - 1n : required }, privateDirect(step));
          if (!underfunded) notePrivateSuccess(PRIVATE_STANDARD_FEE);
        } else if (op === 1) {
          const underfunded = (rng() % 5) === 0;
          const required = (publicLatest % PAGE_SIZE) === 0n ? PUBLIC_REQUIRED : PUBLIC_NO_PAGE_REQUIRED;
          debugContext = `seed ${seed} step ${step} public-direct underfunded=${underfunded}`;
          await capsule.send(author.getSender(), { value: underfunded ? required - 1n : required }, publicDirect(author.address, step));
          if (!underfunded) notePublicSuccess(PUBLIC_FEE);
        } else if (op === 2) {
          debugContext = `seed ${seed} step ${step} public-spoof`;
          await capsule.send(attacker.getSender(), { value: PUBLIC_REQUIRED }, publicDirect(author.address, step));
        } else if (op === 3) {
          const underfunded = (rng() % 5) === 0;
          const required = ((privateLatest % PAGE_SIZE) === 0n ? PRIVATE_REQUIRED : PRIVATE_NO_PAGE_REQUIRED) + ACK_RESERVE;
          debugContext = `seed ${seed} step ${step} vault-private underfunded=${underfunded}`;
          await capsule.send(blockchain.sender(mockVaultAddress), { value: underfunded ? required - 1n : required }, vaultPrivate(step));
          if (!underfunded) {
            notePrivateSuccess(PRIVATE_STANDARD_FEE);
            ackCount += 1n;
          }
        } else if (op === 4) {
          const underfunded = (rng() % 5) === 0;
          const required = ((publicLatest % PAGE_SIZE) === 0n ? PUBLIC_REQUIRED : PUBLIC_NO_PAGE_REQUIRED) + ACK_RESERVE;
          debugContext = `seed ${seed} step ${step} vault-public underfunded=${underfunded}`;
          await capsule.send(blockchain.sender(mockVaultAddress), { value: underfunded ? required - 1n : required }, vaultPublic(author.address, step));
          if (!underfunded) {
            notePublicSuccess(PUBLIC_FEE);
            ackCount += 1n;
          }
        } else if (op === 5) {
          debugContext = `seed ${seed} step ${step} forged-vault`;
          await capsule.send(attacker.getSender(), { value: VAULT_PRIVATE_REQUIRED }, vaultPrivate(step));
        } else if (op === 6) {
          debugContext = `seed ${seed} step ${step} invalid-private`;
          await capsule.send(author.getSender(), { value: PRIVATE_REQUIRED }, privateDirect(step, { header_0_hash: 0n }));
        } else {
          const amount = accrued > 0n ? (accrued > PUBLIC_FEE ? PUBLIC_FEE : accrued) : PUBLIC_FEE;
          debugContext = `seed ${seed} step ${step} flush amount=${amount}`;
          await capsule.send(operator.getSender(), { value: ACK_RESERVE + FLUSH_LOCAL_EXEC_RESERVE }, {
            $$type: 'FlushFees',
            amount,
          } as FlushFees);
          // The configured accumulator address is intentionally missing, so bounce recovery restores accrued.
        }
        await assertModel();
      }
    }
  }, 30000);
});
