import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { Vault, AnnounceSuccessorManifest } from '../build/Vault/Vault_Vault';

// VPB2 Group E — the one-shot successor-manifest record (spec section 6). The genesis controller's identity is
// preserved across seal in genesis_controller_hash (genesis_config_hash is repurposed to the airdrop pool at
// seal), so the controller can authenticate this post-seal announcement.

const OP_ANNOUNCE_SUCCESSOR = 0x5355434dn;
const SUCC_MANIFEST = 0x1111111111111111111111111111111111111111111111111111111111111111n;

function addressCellHash(addr: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(addr).endCell().hash().toString('hex'));
}

async function setup() {
  const bc = await Blockchain.create();
  bc.now = 1_700_000_000;
  const controller = await bc.treasury('successor-controller');
  const ath = await bc.treasury('successor-ath');
  const hub = await bc.treasury('successor-hub');
  // Deploy SEALED with genesis_config_hash = hash(cell{controller}) so genesis_controller_hash authenticates it.
  const init = await Vault.init(ath.address, ath.address, hub.address, addressCellHash(controller.address), true, true, 0n);
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
  }));
  const vault = bc.openContract(new Vault(addr, init));
  return { bc, vault, controller };
}

function vaultTxExit(res: any, vault: any): number {
  const vtx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString());
  const cp: any = vtx?.description?.computePhase;
  return cp?.type === 'vm' ? cp.exitCode : 0;
}

function announceBody(manifestHash: bigint, successorVault: Address): any {
  return beginCell().storeUint(OP_ANNOUNCE_SUCCESSOR, 32).storeUint(manifestHash, 256).storeAddress(successorVault).endCell();
}

describe('Vault VPB2: successor-manifest record (Group E)', () => {
  it('SUCCESSOR-01: the genesis controller announces a successor; get_successor reflects it', async () => {
    const { bc, vault, controller } = await setup();
    expect((await vault.getGetSuccessor()).announced).toBe(false);

    const successorVault = (await bc.treasury('the-successor-vault')).address;
    await vault.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'AnnounceSuccessorManifest',
      successor_manifest_hash: SUCC_MANIFEST,
      successor_vault: successorVault,
    } as AnnounceSuccessorManifest);

    const s = await vault.getGetSuccessor();
    expect(s.announced).toBe(true);
    expect(s.successor_manifest_hash).toBe(SUCC_MANIFEST);
    expect(addressCellHash(s.successor_vault)).toBe(addressCellHash(successorVault));
    expect(s.announced_at).toBe(1_700_000_000n);
  });

  it('SUCCESSOR-02: clean-16 L4/#9 — the successor slot is REPLACEABLE: the controller can overwrite it', async () => {
    const { bc, vault, controller } = await setup();
    const v1 = (await bc.treasury('succ-1')).address;
    await vault.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'AnnounceSuccessorManifest', successor_manifest_hash: SUCC_MANIFEST, successor_vault: v1,
    } as AnnounceSuccessorManifest);
    expect(addressCellHash((await vault.getGetSuccessor()).successor_vault)).toBe(addressCellHash(v1));

    // A SECOND announcement from the controller now OVERWRITES the record (was one-shot; L4 made it replaceable so a
    // mistaken/griefed announce can be corrected and the migration path stays open across multiple hops). The
    // ~14-day timelock that gates this in production lives in the controller multisig, not the Vault.
    const v2 = (await bc.treasury('succ-2')).address;
    const res = await bc.sendMessage(internal({
      from: controller.address, to: vault.address, value: toNano('0.05'), bounce: true,
      body: announceBody(0xdead0002n, v2),
    }));
    expect(vaultTxExit(res, vault)).toBe(0); // accepted
    const s = await vault.getGetSuccessor();
    expect(s.announced).toBe(true);
    expect(s.successor_manifest_hash).toBe(0xdead0002n);
    expect(addressCellHash(s.successor_vault)).toBe(addressCellHash(v2)); // overwritten
  });

  it('SUCCESSOR-03: a non-controller sender cannot announce (15051)', async () => {
    const { bc, vault } = await setup();
    const attacker = await bc.treasury('succ-attacker');
    const res = await bc.sendMessage(internal({
      from: attacker.address, to: vault.address, value: toNano('0.05'), bounce: true,
      body: announceBody(0xdeadn, attacker.address),
    }));
    expect(vaultTxExit(res, vault)).toBe(15051);
    expect((await vault.getGetSuccessor()).announced).toBe(false);
  });
});
