import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { Vault, BindDeploymentManifest as VaultBind, BindOfficialAthWallet as VaultBindAth, SealGenesis as VaultSeal, DepositTon } from '../build/Vault/Vault_Vault';
import { CapsuleHub, BindDeploymentManifest as CapsuleBind, SealGenesis as CapsuleSeal, PublishPublicDirect } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}


function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

async function deployUnboundPair() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('deployer');
  const user = await blockchain.treasury('user');
  const feeAccumulator = await blockchain.treasury('fee-accumulator');
  const athWallet = await blockchain.treasury('vault-ath-wallet');

  const vaultInit = await Vault.init(deployer.address, deployer.address, fixtureAddress('UNBOUND_CAPSULE_PLACEHOLDER'), addressHash(deployer.address), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('2'),
    workchain: vaultAddress.workChain,
  }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

  const capsuleInit = await CapsuleHub.init(feeAccumulator.address, fixtureAddress('UNBOUND_VAULT_PLACEHOLDER'), false, false, 0n, deployer.address);
  const capsuleAddress = contractAddress(0, capsuleInit);
  await blockchain.setShardAccount(capsuleAddress, createShardAccount({
    address: capsuleAddress,
    code: capsuleInit.code,
    data: capsuleInit.data,
    balance: toNano('2'),
    workchain: capsuleAddress.workChain,
  }));
  const capsule = blockchain.openContract(new CapsuleHub(capsuleAddress, capsuleInit));

  return { blockchain, deployer, user, athWallet, vault, vaultAddress, capsule, capsuleAddress };
}

describe('Deployment binding profile', () => {
  it('DEPLOY-BIND-01/02/03/08: Vault and CapsuleHub bind each other once before seal and expose manifest hash', async () => {
    const { vault, capsule, vaultAddress, capsuleAddress, deployer, athWallet } = await deployUnboundPair();

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: capsuleAddress,
    } as VaultBind);

    await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: vaultAddress,
    } as CapsuleBind);
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: athWallet.address,
    } as VaultBindAth);

    const vg = await vault.getGetGlobal();
    const cs = await capsule.getGetState();
    expect(vg.sealed).toBe(false);
    expect(vg.capsule_hub_bound).toBe(true);
    expect(vg.capsule_hub_address.equals(capsuleAddress)).toBe(true);
    expect(vg.deployment_manifest_hash).toBe(MANIFEST_HASH);

    expect(cs.sealed).toBe(false);
    expect(cs.vault_bound).toBe(true);
    expect(cs.vault_address.equals(vaultAddress)).toBe(true);
    expect(cs.deployment_manifest_hash).toBe(MANIFEST_HASH);
  });

  it('DEPLOY-BIND-04: second binding attempt is rejected and cannot overwrite counterpart address', async () => {
    const { vault, capsuleAddress, deployer } = await deployUnboundPair();
    const attackerAddress = fixtureAddress('ATTACKER_COUNTERPART');

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: capsuleAddress,
    } as VaultBind);

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: attackerAddress,
    } as VaultBind);

    const vg = await vault.getGetGlobal();
    expect(vg.capsule_hub_address.equals(capsuleAddress)).toBe(true);
    expect(vg.capsule_hub_address.equals(attackerAddress)).toBe(false);
  });

  it('DEPLOY-BIND-05/06: user operations before seal are rejected and seal fails if binding is missing', async () => {
    const { vault, capsule, capsuleAddress, deployer, user } = await deployUnboundPair();

    await vault.send(user.getSender(), { value: toNano('1.1') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
    } as DepositTon);
    expect((await vault.getGetGlobal()).user_count).toBe(0n);

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);
    expect((await vault.getGetGlobal()).sealed).toBe(false);

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: capsuleAddress,
    } as VaultBind);

    await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as CapsuleSeal);
    expect((await capsule.getGetState()).sealed).toBe(false);
  });

  it('DEPLOY-BIND-07/09: post-seal binding is rejected forever and user operations work only after seal', async () => {
    const { vault, capsule, vaultAddress, capsuleAddress, deployer, user, athWallet } = await deployUnboundPair();

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: capsuleAddress,
    } as VaultBind);
    await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: vaultAddress,
    } as CapsuleBind);
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: athWallet.address,
    } as VaultBindAth);
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);
    await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as CapsuleSeal);

    expect((await vault.getGetGlobal()).sealed).toBe(true);
    expect((await capsule.getGetState()).sealed).toBe(true);

    const bad = fixtureAddress('POST_SEAL_REBIND');
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: bad,
    } as VaultBind);
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: bad,
    } as VaultBindAth);
    const sealedGlobal = await vault.getGetGlobal();
    expect(sealedGlobal.capsule_hub_address.equals(capsuleAddress)).toBe(true);
    expect(sealedGlobal.vault_ath_wallet_address.equals(athWallet.address)).toBe(true);

    await vault.send(user.getSender(), { value: toNano('1.1') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
    } as DepositTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('1'));
  });
});
