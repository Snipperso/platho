import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  DepositTon,
  RegisterMessagingKeys,
  storeRegisterMessagingKeys,
  Vault,
} from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SIZE_STANDARD = 1n;
const SIZE_16K = 16n;
const SIZE_32K = 32n;
const SUITE_HYBRID = 2n;
const SUITE_PUBLIC_NONE = 0n;
const BODY_CELL = finalPrivateBodyCell();
const HEADER0_CELL = finalPrivateHeader0Cell();
const HEADER1_CELL = finalPrivateHeader1Cell();
const BODY_HASH = BigInt('0x' + BODY_CELL.hash().toString('hex'));
const HEADER0 = BigInt('0x' + HEADER0_CELL.hash().toString('hex'));
const HEADER1 = BigInt('0x' + HEADER1_CELL.hash().toString('hex'));
const OP_REMOVED_DIRECT_PUBLISH_PRIVATE = 0x686694C6;
const OP_PUBLISH_PRIVATE_FROM_VAULT_BALANCE = 0x7E1F5031;
const OP_PUBLISH_PUBLIC_FROM_VAULT_BALANCE = 0x7E1F5032;
const VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE = 12_000_000n;
const VAULT_PUBLISH_PRIVATE_HYBRID_16K_LOCAL_EXEC_RESERVE = 38_900_000n;
const VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE = 67_600_000n;
const VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE = 8_700_000n;
const VAULT_PUBLISH_PUBLIC_32K_LOCAL_EXEC_RESERVE = 67_600_000n;
const VAULT_PUBLISH_SIGNING_DOMAIN = 0x56504231n;

function cellHash(cell: any): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + address.hash.toString('hex'));
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vault-balance-publish-user');
  const capsuleHub = await blockchain.treasury('vault-balance-publish-capsulehub');
  const athWallet = await blockchain.treasury('vault-balance-publish-ath-wallet');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user };
}

async function contractBalance(blockchain: Blockchain, address: any): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

async function deployExtraVault(blockchain: Blockchain, label: string, manifestHash: bigint = GENESIS_HASH) {
  const capsuleHub = await blockchain.treasury(`${label}-capsulehub`);
  const athWallet = await blockchain.treasury(`${label}-ath-wallet`);
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, manifestHash, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new Vault(address, init));
}

async function registerKeys(vault: any, user: any) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, 8));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, 78));
  await vault.send(user.getSender(), { value: toNano('0.05') }, {
    $$type: 'RegisterMessagingKeys',
    ...hybridMessagingKeyFields(
      1n,
      BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
      BigInt('0x' + authKeyPair.publicKey.toString('hex')),
    ),
  } as RegisterMessagingKeys);
  return authKeyPair;
}

async function registerKeysFromAddress(blockchain: Blockchain, vault: any, owner: Address, seedByte: number) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte + 64));
  await blockchain.sendMessage(internal({
    from: owner,
    to: vault.address,
    value: toNano('0.05'),
    body: beginCell().store(storeRegisterMessagingKeys({
      $$type: 'RegisterMessagingKeys',
      ...hybridMessagingKeyFields(
        1n,
        BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
        BigInt('0x' + authKeyPair.publicKey.toString('hex')),
      ),
    } as RegisterMessagingKeys)).endCell(),
  }));
  return authKeyPair;
}

async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 12_000_000n }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

function signedPrivatePublishBody(
  owner: any,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: {
    sizeClass?: bigint;
    cryptoSuite?: bigint;
    header0Hash?: bigint;
    header1Hash?: bigint;
    bodyHash?: bigint;
    header0Cell?: any;
    header1Cell?: any;
    bodyCell?: any;
    domainMagic?: bigint;
    manifestHash?: bigint;
    vaultAddress?: any;
    publishKind?: bigint;
  } = {},
) {
  if (!overrides.vaultAddress) {
    throw new Error('vaultAddress is required for signed publish test body');
  }
  const sizeClass = overrides.sizeClass ?? SIZE_STANDARD;
  const cryptoSuite = overrides.cryptoSuite ?? SUITE_HYBRID;
  const header0Cell = overrides.header0Cell ?? HEADER0_CELL;
  const header1Cell = overrides.header1Cell ?? HEADER1_CELL;
  const bodyCell = overrides.bodyCell ?? BODY_CELL;
  const payload = beginCell()
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeUint(overrides.header0Hash ?? cellHash(header0Cell), 256)
    .storeUint(overrides.header1Hash ?? cellHash(header1Cell), 256)
    .storeUint(overrides.bodyHash ?? cellHash(bodyCell), 256)
    .storeRef(header0Cell)
    .storeRef(header1Cell)
    .storeRef(bodyCell)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(overrides.domainMagic ?? VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(overrides.manifestHash ?? GENESIS_HASH, 256)
    .storeUint(addressHash(overrides.vaultAddress), 256)
    .storeUint(overrides.publishKind ?? KIND_PRIVATE, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PRIVATE_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function signedPrivatePublishBodyWithTrailingPayloadBit(
  owner: any,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: {
    sizeClass?: bigint;
    cryptoSuite?: bigint;
    domainMagic?: bigint;
    manifestHash?: bigint;
    vaultAddress?: any;
    publishKind?: bigint;
  } = {},
) {
  if (!overrides.vaultAddress) {
    throw new Error('vaultAddress is required for signed publish test body');
  }
  const sizeClass = overrides.sizeClass ?? SIZE_STANDARD;
  const cryptoSuite = overrides.cryptoSuite ?? SUITE_HYBRID;
  const payload = beginCell()
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .storeBit(true)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(overrides.domainMagic ?? VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(overrides.manifestHash ?? GENESIS_HASH, 256)
    .storeUint(addressHash(overrides.vaultAddress), 256)
    .storeUint(overrides.publishKind ?? KIND_PRIVATE, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PRIVATE_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function signedPublicPublishBody(
  owner: any,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: {
    bodyHash?: bigint;
    headerCell?: any;
    bodyCell?: any;
    domainMagic?: bigint;
    manifestHash?: bigint;
    vaultAddress?: any;
    vaultHash?: bigint;
    publishKind?: bigint;
    ownerHash?: bigint;
    messageOwner?: any;
    sizeClass?: bigint;
    cryptoSuite?: bigint;
  } = {},
) {
  if (!overrides.vaultAddress) {
    throw new Error('vaultAddress is required for signed publish test body');
  }
  const sizeClass = overrides.sizeClass ?? SIZE_STANDARD;
  const cryptoSuite = overrides.cryptoSuite ?? SUITE_PUBLIC_NONE;
  const headerCell = overrides.headerCell ?? HEADER0_CELL;
  const bodyCell = overrides.bodyCell ?? BODY_CELL;
  const payload = beginCell()
    .storeUint(cellHash(headerCell), 256)
    .storeUint(overrides.bodyHash ?? cellHash(bodyCell), 256)
    .storeRef(headerCell)
    .storeRef(bodyCell)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(overrides.domainMagic ?? VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(overrides.manifestHash ?? GENESIS_HASH, 256)
    .storeUint(overrides.vaultHash ?? addressHash(overrides.vaultAddress), 256)
    .storeUint(overrides.publishKind ?? KIND_PUBLIC, 8)
    .storeUint(overrides.ownerHash ?? addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PUBLIC_FROM_VAULT_BALANCE, 32)
    .storeAddress(overrides.messageOwner ?? owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function signedPublicPublishBodyWithTrailingPayloadBit(
  owner: any,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: { manifestHash?: bigint; vaultAddress?: any } = {},
) {
  if (!overrides.vaultAddress) {
    throw new Error('vaultAddress is required for signed publish test body');
  }
  const payload = beginCell()
    .storeUint(HEADER0, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(BODY_CELL)
    .storeBit(true)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(overrides.manifestHash ?? GENESIS_HASH, 256)
    .storeUint(addressHash(overrides.vaultAddress), 256)
    .storeUint(KIND_PUBLIC, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_PUBLIC_NONE, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PUBLIC_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function preDomainSignedPrivatePublishBody(owner: any, nonce: bigint, maxCharge: bigint, secretKey: Buffer) {
  const payload = beginCell()
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .endCell();
  const signedPayload = beginCell()
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PRIVATE_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function oversizedPublicBodyCell() {
  let cell = beginCell().storeUint(1n, 8).endCell();
  for (let index = 0; index < 9; index += 1) {
    cell = beginCell().storeUint(1n, 8).storeRef(cell).endCell();
  }
  return cell;
}

function removedDirectPublishBody(maxCharge: bigint) {
  return beginCell()
    .storeUint(OP_REMOVED_DIRECT_PUBLISH_PRIVATE, 32)
    .storeUint(0n, 64)
    .storeUint(maxCharge, 128)
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .endCell();
}

describe('Vault balance-funded publish gate', () => {
  it('VAULT-BALANCE-PUBLISH-01: signed publish requires activated messaging keys', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = keyPairFromSeed(Buffer.alloc(32, 8));
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
      }),
    }))).rejects.toMatchObject({ exitCode: 16454 });

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(before.ton_balance);
  });

  it('VAULT-BALANCE-PUBLISH-01B: signed publish is bound to the target Vault address', async () => {
    const { blockchain, vault, user } = await setup();
    const otherVault = await deployExtraVault(blockchain, 'vault-balance-publish-other');
    const keyPair = await registerKeys(vault, user);
    await registerKeys(otherVault, user);
    const maxCharge = await otherVault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    await depositTon(otherVault, user, maxCharge * 2n);
    const beforeOther = await otherVault.getGetUser(user.address);
    const messageForFirstVault = signedPrivatePublishBody(user.address, beforeOther.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await expect(blockchain.sendMessage(external({
      to: otherVault.address,
      body: messageForFirstVault,
    }))).rejects.toMatchObject({ exitCode: 16466 });

    const afterOther = await otherVault.getGetUser(user.address);
    expect(afterOther.ton_balance).toBe(beforeOther.ton_balance);
    expect(afterOther.publish_nonce).toBe(beforeOther.publish_nonce);
    expect((await otherVault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01B2: public signed publish is bound to the deployment manifest', async () => {
    const { blockchain, vault, user } = await setup();
    const otherVault = await deployExtraVault(blockchain, 'vault-balance-public-publish-other', GENESIS_HASH + 1n);
    const keyPair = await registerKeys(vault, user);
    await registerKeys(otherVault, user);
    const maxCharge = await otherVault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    await depositTon(otherVault, user, maxCharge * 2n);
    const beforeOther = await otherVault.getGetUser(user.address);
    const messageForFirstVault = signedPublicPublishBody(user.address, beforeOther.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await expect(blockchain.sendMessage(external({
      to: otherVault.address,
      body: messageForFirstVault,
    }))).rejects.toMatchObject({ exitCode: 16494 });

    const afterOther = await otherVault.getGetUser(user.address);
    expect(afterOther.ton_balance).toBe(beforeOther.ton_balance);
    expect(afterOther.publish_nonce).toBe(beforeOther.publish_nonce);
    expect((await otherVault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01B3: public signed publish is bound to the target Vault address', async () => {
    const { blockchain, vault, user } = await setup();
    const otherVault = await deployExtraVault(blockchain, 'vault-balance-public-publish-other-same-manifest');
    const keyPair = await registerKeys(vault, user);
    await registerKeys(otherVault, user);
    const maxCharge = await otherVault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    await depositTon(otherVault, user, maxCharge * 2n);
    const beforeOther = await otherVault.getGetUser(user.address);
    const messageForFirstVault = signedPublicPublishBody(user.address, beforeOther.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await expect(blockchain.sendMessage(external({
      to: otherVault.address,
      body: messageForFirstVault,
    }))).rejects.toMatchObject({ exitCode: 16495 });

    const afterOther = await otherVault.getGetUser(user.address);
    expect(afterOther.ton_balance).toBe(beforeOther.ton_balance);
    expect(afterOther.publish_nonce).toBe(beforeOther.publish_nonce);
    expect((await otherVault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01B4: public signed publish rejects domain, kind, owner, and suite mismatches before balance mutation', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        domainMagic: VAULT_PUBLISH_SIGNING_DOMAIN + 1n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16493 });

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        publishKind: KIND_PRIVATE,
      }),
    }))).rejects.toMatchObject({ exitCode: 16496 });

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        ownerHash: addressHash(user.address) + 1n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16498 });

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        cryptoSuite: SUITE_HYBRID,
      }),
    }))).rejects.toMatchObject({ exitCode: 16499 });

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance);
    expect(after.publish_nonce).toBe(before.publish_nonce);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01B5: same-auth public publish cannot be replayed under another owner', async () => {
    const { blockchain, vault, user } = await setup();
    const other = await blockchain.treasury('vault-balance-publish-same-auth-other');
    const keyPair = await registerKeys(vault, user);
    await registerKeysFromAddress(blockchain, vault, other.address, 14);
    const maxCharge = await vault.getGetCanonicalPublishCharge(other.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    await depositTon(vault, other, maxCharge * 2n);
    const beforeOther = await vault.getGetUser(other.address);
    const signedForUserWrappedAsOther = signedPublicPublishBody(user.address, beforeOther.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
      messageOwner: other.address,
    });

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedForUserWrappedAsOther,
    }))).rejects.toMatchObject({ exitCode: 16498 });

    const afterOther = await vault.getGetUser(other.address);
    expect(afterOther.ton_balance).toBe(beforeOther.ton_balance);
    expect(afterOther.publish_nonce).toBe(beforeOther.publish_nonce);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01C: signed publish rejects manifest and kind domain mismatches before balance mutation', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);

    const beforeManifest = await vault.getGetUser(user.address);
    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, beforeManifest.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        domainMagic: VAULT_PUBLISH_SIGNING_DOMAIN + 1n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16464 });
    const afterDomain = await vault.getGetUser(user.address);
    expect(afterDomain.ton_balance).toBe(beforeManifest.ton_balance);
    expect(afterDomain.publish_nonce).toBe(beforeManifest.publish_nonce);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, beforeManifest.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        manifestHash: GENESIS_HASH + 1n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16465 });
    const afterManifest = await vault.getGetUser(user.address);
    expect(afterManifest.ton_balance).toBe(beforeManifest.ton_balance);
    expect(afterManifest.publish_nonce).toBe(beforeManifest.publish_nonce);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, beforeManifest.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        publishKind: KIND_PUBLIC,
      }),
    }))).rejects.toMatchObject({ exitCode: 16467 });
    const afterKind = await vault.getGetUser(user.address);
    expect(afterKind.ton_balance).toBe(beforeManifest.ton_balance);
    expect(afterKind.publish_nonce).toBe(beforeManifest.publish_nonce);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01D: pre-domain signed payload is rejected before balance mutation', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: preDomainSignedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey),
    }))).rejects.toMatchObject({ exitCode: 16464 });

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance);
    expect(after.publish_nonce).toBe(before.publish_nonce);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-02: removed direct publish opcode is not handled', async () => {
    const { blockchain, vault, user } = await setup();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);

    await blockchain.sendMessage(internal({
      from: user.address,
      to: vault.address,
      value: maxCharge,
      body: removedDirectPublishBody(maxCharge),
    }));

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-03: valid signature with underpriced payload only charges local exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE, keyPair.secretKey, {
        vaultAddress: vault.address,
      }),
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-04: valid signature with mismatched cell hash only charges local exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const badBody = signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
      bodyHash: BODY_HASH + 1n,
    });

    await blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    const rawAfter = await contractBalance(blockchain, vault.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }))).rejects.toMatchObject({ exitCode: 16453 });
    const replayed = await vault.getGetUser(user.address);
    const rawAfterReplay = await contractBalance(blockchain, vault.address);
    expect(replayed.ton_balance).toBe(after.ton_balance);
    expect(replayed.publish_nonce).toBe(after.publish_nonce);
    expect(rawAfterReplay).toBe(rawAfter);
  });

  it('VAULT-BALANCE-PUBLISH-04A: valid private signature with malformed envelope only charges local exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const rawBefore = await contractBalance(blockchain, vault.address);
    const badBody = signedPrivatePublishBodyWithTrailingPayloadBit(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }));

    const after = await vault.getGetUser(user.address);
    const rawAfter = await contractBalance(blockchain, vault.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect(rawAfter - after.ton_balance).toBeGreaterThanOrEqual(rawBefore - before.ton_balance);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }))).rejects.toMatchObject({ exitCode: 16453 });
    const replayed = await vault.getGetUser(user.address);
    const rawAfterReplay = await contractBalance(blockchain, vault.address);
    expect(replayed.ton_balance).toBe(after.ton_balance);
    expect(replayed.publish_nonce).toBe(after.publish_nonce);
    expect(rawAfterReplay).toBe(rawAfter);
  });

  it('VAULT-BALANCE-PUBLISH-04B: stale nonce replay is rejected before raw Vault gas spend', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const staleBody = signedPrivatePublishBody(user.address, before.publish_nonce + 1n, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });
    const rawBefore = await contractBalance(blockchain, vault.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: staleBody,
    }))).rejects.toMatchObject({ exitCode: 16453 });

    const after = await vault.getGetUser(user.address);
    const rawAfter = await contractBalance(blockchain, vault.address);
    expect(after.ton_balance).toBe(before.ton_balance);
    expect(after.publish_nonce).toBe(before.publish_nonce);
    expect(rawAfter).toBe(rawBefore);
  });

  it('VAULT-BALANCE-PUBLISH-04C: below-local maxCharge charges local reserve without CapsuleHub publish', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const canonical = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await depositTon(vault, user, canonical * 2n);
    const before = await vault.getGetUser(user.address);
    const rawBefore = await contractBalance(blockchain, vault.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE - 1n, keyPair.secretKey, {
        vaultAddress: vault.address,
      }),
    }));

    const after = await vault.getGetUser(user.address);
    const rawAfter = await contractBalance(blockchain, vault.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect(rawAfter - after.ton_balance).toBeGreaterThanOrEqual(rawBefore - before.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-04C2: large private size classes cannot be validated for the 1K exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const oneKiBMaxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    const max32KiBCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_32K, SUITE_HYBRID);
    await depositTon(vault, user, max32KiBCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const rawBefore = await contractBalance(blockchain, vault.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, oneKiBMaxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        sizeClass: SIZE_32K,
        bodyCell: finalPrivateBodyCell(SIZE_32K, 0x32),
      }),
    }));

    const after32KiBAttempt = await vault.getGetUser(user.address);
    const rawAfter32KiBAttempt = await contractBalance(blockchain, vault.address);
    expect(after32KiBAttempt.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE);
    expect(after32KiBAttempt.publish_nonce).toBe(before.publish_nonce + 1n);
    expect(rawAfter32KiBAttempt - after32KiBAttempt.ton_balance).toBeGreaterThanOrEqual(rawBefore - before.ton_balance);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, after32KiBAttempt.publish_nonce, oneKiBMaxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        sizeClass: SIZE_16K,
        bodyCell: finalPrivateBodyCell(SIZE_16K, 0x16),
      }),
    }));

    const after16KiBAttempt = await vault.getGetUser(user.address);
    const rawAfter16KiBAttempt = await contractBalance(blockchain, vault.address);
    expect(after16KiBAttempt.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE - VAULT_PUBLISH_PRIVATE_HYBRID_16K_LOCAL_EXEC_RESERVE);
    expect(after16KiBAttempt.publish_nonce).toBe(before.publish_nonce + 2n);
    expect(rawAfter16KiBAttempt - after16KiBAttempt.ton_balance).toBeGreaterThanOrEqual(rawBefore - before.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-04D: underfunded user ledger is rejected before raw Vault gas spend', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    const before = await vault.getGetUser(user.address);
    const rawBefore = await contractBalance(blockchain, vault.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
      }),
    }))).rejects.toMatchObject({ exitCode: 16463 });

    const after = await vault.getGetUser(user.address);
    const rawAfter = await contractBalance(blockchain, vault.address);
    expect(after.ton_balance).toBe(before.ton_balance);
    expect(after.publish_nonce).toBe(before.publish_nonce);
    expect(rawAfter).toBe(rawBefore);
  });

  it('VAULT-BALANCE-PUBLISH-04E: non-basechain signed private publish owner is rejected before raw Vault gas spend', async () => {
    const { blockchain, vault } = await setup();
    const owner = new Address(-1, Buffer.alloc(32, 0x64));
    const keyPair = await registerKeysFromAddress(blockchain, vault, owner, 0x64);
    const before = await vault.getGetUser(owner);
    const rawBefore = await contractBalance(blockchain, vault.address);
    const maxCharge = 100_000_000n;

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(owner, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
      }),
    }))).rejects.toMatchObject({ exitCode: 16450 });
    const afterPrivate = await vault.getGetUser(owner);
    const rawAfterPrivate = await contractBalance(blockchain, vault.address);
    expect(afterPrivate.ton_balance).toBe(before.ton_balance);
    expect(afterPrivate.publish_nonce).toBe(before.publish_nonce);
    expect(rawAfterPrivate).toBe(rawBefore);

  });

  it('VAULT-BALANCE-PUBLISH-05: public signed payload mismatch also advances nonce without pending publish', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        bodyHash: BODY_HASH + 1n,
      }),
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-05A: valid public signature with malformed envelope only charges local exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const rawBefore = await contractBalance(blockchain, vault.address);
    const badBody = signedPublicPublishBodyWithTrailingPayloadBit(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }));

    const after = await vault.getGetUser(user.address);
    const rawAfter = await contractBalance(blockchain, vault.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect(rawAfter - after.ton_balance).toBeGreaterThanOrEqual(rawBefore - before.ton_balance);
  });

  it('VAULT-BALANCE-PUBLISH-06: public oversized body is rejected before outbound publish', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        bodyCell: oversizedPublicBodyCell(),
      }),
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-06A: invalid public size class is rejected before accept', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_32K, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const rawBefore = await contractBalance(blockchain, vault.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        sizeClass: 3n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16331 });

    const after = await vault.getGetUser(user.address);
    const rawAfter = await contractBalance(blockchain, vault.address);
    expect(after.ton_balance).toBe(before.ton_balance);
    expect(after.publish_nonce).toBe(before.publish_nonce);
    expect(rawAfter).toBe(rawBefore);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });
});
