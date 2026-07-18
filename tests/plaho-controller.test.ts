import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { PlathoController } from '../build/PlathoController/PlathoController_PlathoController';
import { Vault } from '../build/Vault/Vault_Vault';

// clean-16 L4/#9 — PlathoController: 3-of-5 ed25519 multisig + ~14-day timelock, sole caller of the Vault's
// AnnounceSuccessorManifest (the migration trust-root). The controller does NOT store the Vault address (that would
// create a genesis address cycle, since Vault.genesis_config_hash = hash(controller addr)); instead the target Vault
// is part of each SIGNED proposal.

const DOMAIN = 0x504C4331n; // "PLC1"
const ACT_ANNOUNCE = 1n;
const ACT_ROTATE = 2n;
const ACT_CANCEL = 3n;
const TIMELOCK = 604800; // 7 days (owner 2026-07-18)
const T0 = 1_700_000_000;

const pkInt = (kp: KeyPair) => BigInt('0x' + kp.publicKey.toString('hex'));
const cellHashInt = (c: Cell) => BigInt('0x' + c.hash().toString('hex'));
const addressCellHash = (a: Address) => BigInt('0x' + beginCell().storeAddress(a).endCell().hash().toString('hex'));

function keys(): KeyPair[] {
  return [0, 1, 2, 3, 4].map((i) => keyPairFromSeed(Buffer.alloc(32, 100 + i)));
}

async function deploy() {
  const bc = await Blockchain.create();
  bc.now = T0;
  const ks = keys();
  const init = await PlathoController.init(pkInt(ks[0]), pkInt(ks[1]), pkInt(ks[2]), pkInt(ks[3]), pkInt(ks[4]));
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('10'), workchain: 0 }));
  const ctrl = bc.openContract(new PlathoController(addr, init));
  return { bc, ctrl, addr, ks };
}

function actionDigest(ctrlAddr: Address, nonce: bigint, kind: bigint, paramHash: bigint): Cell {
  return beginCell().storeUint(DOMAIN, 32).storeAddress(ctrlAddr).storeUint(nonce, 64).storeUint(kind, 8).storeUint(paramHash, 256).endCell();
}

function approvals(digestCell: Cell, signers: Array<{ slot: number; kp: KeyPair }>): Cell {
  const digest = digestCell.hash();
  let next: Cell | null = null;
  for (let i = signers.length - 1; i >= 0; i -= 1) {
    const b = beginCell().storeUint(signers[i].slot, 8).storeBuffer(sign(digest, signers[i].kp.secretKey));
    if (next) b.storeRef(next);
    next = b.endCell();
  }
  return next!;
}

const announceParamHash = (target: Address, manifest: bigint, succ: Address) =>
  cellHashInt(beginCell().storeAddress(target).storeUint(manifest, 256).storeAddress(succ).endCell());

async function propose(bc: Blockchain, ctrl: any, addr: Address, nonce: bigint, target: Address, manifest: bigint, succ: Address, signers: Array<{ slot: number; kp: KeyPair }>) {
  const appr = approvals(actionDigest(addr, nonce, ACT_ANNOUNCE, announceParamHash(target, manifest, succ)), signers);
  return ctrl.send(bc.sender((await bc.treasury('poker' + nonce + manifest)).address), { value: toNano('0.1') }, {
    $$type: 'ControllerProposeSuccessor', nonce, target_vault: target, successor_manifest_hash: manifest, successor_vault: succ, approvals: appr,
  } as any);
}

function ctrlExit(res: any, addr: Address): number {
  const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === addr.toString());
  const cp: any = tx?.description?.computePhase;
  return cp?.type === 'vm' ? Number(cp.exitCode) : 0;
}

describe('PlathoController — 3-of-5 multisig + timelock (clean-16 L4/#9)', () => {
  it('CTRL-01: 3-of-5 valid approvals propose a successor; timelock + nonce advance', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const target = (await bc.treasury('tv')).address;
    const succ = (await bc.treasury('succ')).address;
    await propose(bc, ctrl, addr, 0n, target, 0xabc123n, succ, [{ slot: 0, kp: ks[0] }, { slot: 2, kp: ks[2] }, { slot: 4, kp: ks[4] }]);
    const s = await ctrl.getGetControllerState();
    expect(s.has_pending).toBe(true);
    expect(s.pending_kind).toBe(1n);
    expect(s.pending_manifest_hash).toBe(0xabc123n);
    expect(s.pending_effective_at).toBe(BigInt(T0 + TIMELOCK));
    expect(s.nonce).toBe(1n);
  });

  it('CTRL-02: fewer than 3 valid approvals is rejected (threshold 25014)', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const target = (await bc.treasury('tv')).address;
    const succ = (await bc.treasury('succ')).address;
    const res = await propose(bc, ctrl, addr, 0n, target, 0xabc123n, succ, [{ slot: 0, kp: ks[0] }, { slot: 2, kp: ks[2] }]);
    expect(ctrlExit(res, addr)).toBe(25014);
    expect((await ctrl.getGetControllerState()).has_pending).toBe(false);
  });

  it('CTRL-03: a forged signature (wrong key for slot) does not count (25013)', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const target = (await bc.treasury('tv')).address;
    const succ = (await bc.treasury('succ')).address;
    const res = await propose(bc, ctrl, addr, 0n, target, 0xabc123n, succ, [{ slot: 0, kp: ks[0] }, { slot: 1, kp: ks[3] }, { slot: 4, kp: ks[4] }]);
    expect(ctrlExit(res, addr)).toBe(25013);
  });

  it('CTRL-04: execute before timelock rejected (25031); after timelock sends AnnounceSuccessorManifest', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const target = (await bc.treasury('tv')).address;
    const succ = (await bc.treasury('succ')).address;
    await propose(bc, ctrl, addr, 0n, target, 0xdead77n, succ, [{ slot: 1, kp: ks[1] }, { slot: 2, kp: ks[2] }, { slot: 3, kp: ks[3] }]);
    bc.now = T0 + TIMELOCK - 10;
    const early = await ctrl.send(bc.sender((await bc.treasury('e1')).address), { value: toNano('0.1') }, { $$type: 'ControllerExecute' } as any);
    expect(ctrlExit(early, addr)).toBe(25031);
    bc.now = T0 + TIMELOCK + 10;
    const done = await ctrl.send(bc.sender((await bc.treasury('e2')).address), { value: toNano('0.2') }, { $$type: 'ControllerExecute' } as any);
    expect(done.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === target.toString())).toBeDefined();
    expect((await ctrl.getGetControllerState()).has_pending).toBe(false);
  });

  it('CTRL-05: 3-of-5 rotate replaces a signer after the timelock', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const newKp = keyPairFromSeed(Buffer.alloc(32, 200));
    const slot = 4;
    const paramHash = cellHashInt(beginCell().storeUint(slot, 8).storeUint(pkInt(newKp), 256).endCell());
    const appr = approvals(actionDigest(addr, 0n, ACT_ROTATE, paramHash), [{ slot: 0, kp: ks[0] }, { slot: 1, kp: ks[1] }, { slot: 2, kp: ks[2] }]);
    await ctrl.send(bc.sender((await bc.treasury('poker')).address), { value: toNano('0.1') }, {
      $$type: 'ControllerProposeRotate', nonce: 0n, slot: BigInt(slot), new_pubkey: pkInt(newKp), approvals: appr,
    } as any);
    bc.now = T0 + TIMELOCK + 10;
    await ctrl.send(bc.sender((await bc.treasury('exec')).address), { value: toNano('0.1') }, { $$type: 'ControllerExecute' } as any);
    expect(await ctrl.getGetSigner(BigInt(slot))).toBe(pkInt(newKp));
  });

  it('CTRL-06: 3-of-5 cancel clears a pending proposal with NO timelock', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const target = (await bc.treasury('tv')).address;
    const succ = (await bc.treasury('succ')).address;
    await propose(bc, ctrl, addr, 0n, target, 0x1111n, succ, [{ slot: 0, kp: ks[0] }, { slot: 1, kp: ks[1] }, { slot: 2, kp: ks[2] }]);
    const dCancel = actionDigest(addr, 1n, ACT_CANCEL, 0n);
    await ctrl.send(bc.sender((await bc.treasury('poker2')).address), { value: toNano('0.1') }, {
      $$type: 'ControllerProposeCancel', nonce: 1n, approvals: approvals(dCancel, [{ slot: 0, kp: ks[0] }, { slot: 3, kp: ks[3] }, { slot: 4, kp: ks[4] }]),
    } as any);
    const s = await ctrl.getGetControllerState();
    expect(s.has_pending).toBe(false);
    expect(s.nonce).toBe(2n);
  });

  it('CTRL-07: replay with a stale nonce is rejected (25001)', async () => {
    const { bc, ctrl, addr, ks } = await deploy();
    const target = (await bc.treasury('tv')).address;
    const succ = (await bc.treasury('succ')).address;
    const signers = [{ slot: 0, kp: ks[0] }, { slot: 1, kp: ks[1] }, { slot: 2, kp: ks[2] }];
    await propose(bc, ctrl, addr, 0n, target, 0x2222n, succ, signers);
    await ctrl.send(bc.sender((await bc.treasury('p2')).address), { value: toNano('0.1') }, {
      $$type: 'ControllerProposeCancel', nonce: 1n, approvals: approvals(actionDigest(addr, 1n, ACT_CANCEL, 0n), signers),
    } as any);
    // replay the SAME nonce-0 announce (nonce is now 2)
    const res = await propose(bc, ctrl, addr, 0n, target, 0x2222n, succ, signers);
    expect(ctrlExit(res, addr)).toBe(25001);
  });

  it('CTRL-E2E: the controller announces a successor into a real Vault sealed with its hash', async () => {
    const bc = await Blockchain.create();
    bc.now = T0;
    const ks = keys();
    // 1. Controller address is independent of the Vault (no cycle).
    const cInit = await PlathoController.init(pkInt(ks[0]), pkInt(ks[1]), pkInt(ks[2]), pkInt(ks[3]), pkInt(ks[4]));
    const cAddr = contractAddress(0, cInit);
    await bc.setShardAccount(cAddr, createShardAccount({ address: cAddr, code: cInit.code, data: cInit.data, balance: toNano('10'), workchain: 0 }));
    const ctrl = bc.openContract(new PlathoController(cAddr, cInit));

    // 2. Vault sealed with genesis_config_hash = hash(controller address) — so it authorizes ONLY this controller.
    const ath = await bc.treasury('e2e-ath');
    const hub = await bc.treasury('e2e-hub');
    const vInit = await Vault.init(ath.address, ath.address, hub.address, addressCellHash(cAddr), true, true, 0n);
    const vAddr = contractAddress(0, vInit);
    await bc.setShardAccount(vAddr, createShardAccount({ address: vAddr, code: vInit.code, data: vInit.data, balance: toNano('2'), workchain: 0 }));
    const vault = bc.openContract(new Vault(vAddr, vInit));

    expect((await vault.getGetSuccessor()).announced).toBe(false);

    // 3. Propose (3-of-5) → 4. timelock → 5. execute → controller sends AnnounceSuccessorManifest to the Vault.
    const successorVault = (await bc.treasury('e2e-successor')).address;
    const manifest = 0xc0ffeen;
    await propose(bc, ctrl, cAddr, 0n, vAddr, manifest, successorVault, [{ slot: 0, kp: ks[0] }, { slot: 2, kp: ks[2] }, { slot: 4, kp: ks[4] }]);
    bc.now = T0 + TIMELOCK + 10;
    await ctrl.send(bc.sender((await bc.treasury('e2e-exec')).address), { value: toNano('0.2') }, { $$type: 'ControllerExecute' } as any);

    // 6. The Vault recorded the successor announced BY the controller.
    const s = await vault.getGetSuccessor();
    expect(s.announced).toBe(true);
    expect(s.successor_manifest_hash).toBe(manifest);
    expect(addressCellHash(s.successor_vault)).toBe(addressCellHash(successorVault));
  });
});
