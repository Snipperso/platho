import { describe, expect, it } from 'vitest';
import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { CapsuleHub, PublishPrivateFromVault } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  CRYPTO_SUITES,
  createEncryptedPrivateCapsule,
  createMessagingIdentity,
  exportSignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';

const PRIVATE_LONG_TERM_REQUIRED = 10_000_000n + 4_000_000n + 1_000_000n + 4_000_000n + 30_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.CAPSULE.FINAL.${label}`).digest());
}

function hashHexToBigInt(hash: string): bigint {
  return BigInt(hash.startsWith('0x') ? hash : `0x${hash}`);
}

function cellFromPayload(payload: { boc: string }): Cell {
  return Cell.fromBoc(Buffer.from(payload.boc, 'base64'))[0];
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const vaultAddress = fixtureAddress('VAULT');
  const init = await CapsuleHub.init(
    fixtureAddress('FEE_ACCUMULATOR'),
    vaultAddress,
    true,
    true,
    0n,
    fixtureAddress('GENESIS_CONTROLLER'),
  );
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  return { blockchain, capsule: blockchain.openContract(new CapsuleHub(address, init)), vaultAddress };
}

describe('CapsuleHub final capsule byte layout', () => {
  it('CAPSULE-FINAL-01: accepts PWA-generated hybrid capsule cells with exact final sizes', async () => {
    const { blockchain, capsule, vaultAddress } = await setup();
    const alice = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
    const bob = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
    const bobBundle = await exportSignedPublicKeyBundle(bob, {
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_060_000_000,
      purpose: 'capsulehub-final-layout',
    });
    const encrypted = await createEncryptedPrivateCapsule('final capsule layout', bobBundle, alice, {
      now: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_060_000_000,
      clientNonce: 'AAAAAAAAAAAAAAAAAAAAAA',
    });

    expect(encrypted.publish.header_0_cell.bytes).toBe(140);
    expect(encrypted.publish.header_1_cell.bytes).toBe(30);
    expect(encrypted.publish.body_cell.bytes).toBe(2228);

    await capsule.send(blockchain.sender(vaultAddress), { value: PRIVATE_LONG_TERM_REQUIRED }, {
      $$type: 'PublishPrivateFromVault',
      bounce_id: 9001n,
      bounce_tag: 9001n,
      publish_id: hashHexToBigInt(encrypted.publish.body_hash),
      size_class: 2n,
      crypto_suite: 2n,
      header_0_hash: hashHexToBigInt(encrypted.publish.header_0_hash),
      header_1_hash: hashHexToBigInt(encrypted.publish.header_1_hash),
      body_hash: hashHexToBigInt(encrypted.publish.body_hash),
      header_0: cellFromPayload(encrypted.publish.header_0_cell),
      header_1: cellFromPayload(encrypted.publish.header_1_cell),
      body: cellFromPayload(encrypted.publish.body_cell),
      protocol_fee_paid: 10_000_000n,
    } as PublishPrivateFromVault);

    const stored = await capsule.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.header_0.hash().toString('hex')).toBe(encrypted.publish.header_0_hash.slice(2));
    expect(stored.header_1.hash().toString('hex')).toBe(encrypted.publish.header_1_hash.slice(2));
    expect(stored.body.hash().toString('hex')).toBe(encrypted.publish.body_hash.slice(2));
  });
});
