import { describe, expect, it, beforeEach } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract, createShardAccount } from '@ton/sandbox';
import { keyPairFromSeed } from '@ton/crypto';
import { CreditIssuer } from '../build/CreditIssuer/CreditIssuer_CreditIssuer';
import { CapsuleHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';

const MANIFEST_HASH = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const PRICE = toNano('0.1');

function codeOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString(),
  );
  return Number(tx?.description?.computePhase?.exitCode ?? -1);
}

function issuerPubkey(i: number): bigint {
  return BigInt('0x' + keyPairFromSeed(Buffer.alloc(32, 100 + i)).publicKey.toString('hex'));
}

async function deployCI(blockchain: Blockchain, controller: TreasuryContract, sealed = false) {
  const ci = blockchain.openContract(await CreditIssuer.fromInit(controller.address, MANIFEST_HASH, 0n, sealed));
  await ci.send(controller.getSender(), { value: toNano('1') }, null);
  return ci;
}

async function uploadIssuer(ci: SandboxContract<CreditIssuer>, controller: TreasuryContract, slot: number, pubkey = issuerPubkey(slot)) {
  return ci.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'CreditUploadIssuerKey', slot: BigInt(slot), pubkey,
  });
}

async function setPrice(ci: SandboxContract<CreditIssuer>, controller: TreasuryContract, price = PRICE) {
  return ci.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'CreditSetPrice', credit_price: price });
}

async function fillIssuers(ci: SandboxContract<CreditIssuer>, controller: TreasuryContract, n: number) {
  for (let i = 0; i < n; i++) await uploadIssuer(ci, controller, i);
}

async function bindHub(ci: SandboxContract<CreditIssuer>, controller: TreasuryContract, hubAddr: Address) {
  return ci.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'CreditBindHub', capsule_hub_address: hubAddr,
  });
}

async function seal(ci: SandboxContract<CreditIssuer>, controller: TreasuryContract) {
  return ci.send(controller.getSender(), { value: toNano('0.1') }, {
    $$type: 'CreditSealGenesis', deployment_manifest_hash: MANIFEST_HASH,
  });
}

// clean-16 B3: seal now requires a bound Hub. A treasury stands in for the Hub in lifecycle/key tests; the pool
// forward on a buy is absorbed by it (a wallet accepts the value, no FundAnonPool receiver needed) — the real
// pool-funding round-trip is exercised in the RECON test with an actual CapsuleHub.
async function fullSetupSealed(blockchain: Blockchain, controller: TreasuryContract, n = 8) {
  const ci = await deployCI(blockchain, controller);
  await fillIssuers(ci, controller, n);
  await setPrice(ci, controller);
  const hub = await blockchain.treasury('ci-hub-stub');
  await bindHub(ci, controller, hub.address);
  await seal(ci, controller);
  return ci;
}

// A real cross-bound CreditIssuer + CapsuleHub pair. Genesis mirrors each CI issuer slot into the Hub at version 0
// (the seal-ceremony invariant, §9). sealHub=false leaves the Hub unsealed (for bounce/refund tests).
async function deployReconPair(blockchain: Blockchain, opts: { sealHub?: boolean } = {}) {
  const deployer = await blockchain.treasury('recon-pair-deployer');
  const dummyVault = await blockchain.treasury('recon-pair-vault');
  const feeAcc = await blockchain.treasury('recon-pair-fee');
  const ci = blockchain.openContract(await CreditIssuer.fromInit(deployer.address, MANIFEST_HASH, 0n, false));
  await ci.send(deployer.getSender(), { value: toNano('1') }, null);
  const hubInit = await CapsuleHub.init(feeAcc.address, dummyVault.address, false, false, 0n, deployer.address);
  const hubAddr = contractAddress(0, hubInit);
  await blockchain.setShardAccount(hubAddr, createShardAccount({
    address: hubAddr, code: hubInit.code, data: hubInit.data, balance: toNano('200'), workchain: 0,
  }));
  const hub = blockchain.openContract(new CapsuleHub(hubAddr, hubInit));
  const dep = (to: any, body: any, v = '0.05') => to.send(deployer.getSender(), { value: toNano(v) }, body);
  await dep(hub, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: dummyVault.address });
  await dep(hub, { $$type: 'BindCreditIssuer', credit_issuer_address: ci.address });
  for (let i = 0; i < 8; i++) {
    await dep(ci, { $$type: 'CreditUploadIssuerKey', slot: BigInt(i), pubkey: issuerPubkey(i) });
    await dep(hub, { $$type: 'HubMirrorIssuerKey', slot: BigInt(i), pubkey: issuerPubkey(i), active: true, version: 0n });
  }
  await dep(ci, { $$type: 'CreditSetPrice', credit_price: PRICE });
  await dep(ci, { $$type: 'CreditBindHub', capsule_hub_address: hubAddr });
  if (opts.sealHub !== false) await dep(hub, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH });
  await dep(ci, { $$type: 'CreditSealGenesis', deployment_manifest_hash: MANIFEST_HASH }, '0.1');
  return { deployer, ci, hub, hubAddr, dep };
}

async function assertSlotConverged(ci: SandboxContract<CreditIssuer>, hub: SandboxContract<CapsuleHub>, slot: number) {
  const c = await ci.getGetIssuerSlot(BigInt(slot));
  const h = await hub.getGetIssuerSlot(BigInt(slot));
  expect(h.exists).toBe(c.exists);
  expect(h.pubkey).toBe(c.pubkey);
  expect(h.active).toBe(c.active);
  expect(h.version).toBe(c.version);
}

describe('CreditIssuer — clean-16 Durable-Core (B2)', () => {
  let blockchain: Blockchain;
  let controller: TreasuryContract;
  let stranger: TreasuryContract;
  let buyer: TreasuryContract;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;   // fixed time → nowEpoch = 19675, so the RECON epoch is inside the funding window
    controller = await blockchain.treasury('controller');
    stranger = await blockchain.treasury('stranger');
    buyer = await blockchain.treasury('buyer');
  });

  describe('CREDIT-LIFECYCLE', () => {
    it('rejects credit purchase before seal (requireSealed)', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 8);
      await setPrice(ci, controller);
      const res = await ci.send(buyer.getSender(), { value: toNano('1') }, {
        $$type: 'CreditBuyCredits', credits_k: 1n, redeem_pubkey: issuerPubkey(99), epoch: 100n,
      });
      expect(codeOf(res, ci.address)).toBe(21100);
    });

    it('only the controller can upload / set price / seal', async () => {
      const ci = await deployCI(blockchain, controller);
      const up = await ci.send(stranger.getSender(), { value: toNano('0.05') }, {
        $$type: 'CreditUploadIssuerKey', slot: 0n, pubkey: issuerPubkey(0),
      });
      expect(codeOf(up, ci.address)).toBe(21033);
      const sp = await ci.send(stranger.getSender(), { value: toNano('0.05') }, { $$type: 'CreditSetPrice', credit_price: PRICE });
      expect(codeOf(sp, ci.address)).toBe(21033);
    });

    it('seal requires >= 8 slots', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 7);
      await setPrice(ci, controller);
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(21042);
      expect((await ci.getGetGlobal()).sealed).toBe(false);
    });

    it('seal requires a positive price', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 8);
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(21045);
    });

    it('seal requires a bound hub (clean-16 B3)', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 8);
      await setPrice(ci, controller);
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(21046);
      expect((await ci.getGetGlobal()).sealed).toBe(false);
    });

    it('seal requires the price to cover prepaidUnit (clean-16 B3; fund_gas is per-PURCHASE, not per-credit)', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 8);
      const g0 = await ci.getGetGlobal();
      // A price one nanoton below the per-credit backing cannot fund the pool -> rejected.
      await setPrice(ci, controller, g0.prepaid_unit - 1n);
      const hub = await blockchain.treasury('ci-hub-lowprice');
      await bindHub(ci, controller, hub.address);
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(21047);
    });

    it('seal ACCEPTS a price of exactly prepaidUnit (fund_gas is charged once per purchase, not per credit)', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 8);
      const g0 = await ci.getGetGlobal();
      await setPrice(ci, controller, g0.prepaid_unit);
      const hub = await blockchain.treasury('ci-hub-exactprice');
      await bindHub(ci, controller, hub.address);
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(0);
      expect((await ci.getGetGlobal()).sealed).toBe(true);
    });

    it('seals with 8 slots + price + bound hub, and is one-shot', async () => {
      const ci = await deployCI(blockchain, controller);
      await fillIssuers(ci, controller, 8);
      await setPrice(ci, controller);
      const hub = await blockchain.treasury('ci-hub-seal');
      await bindHub(ci, controller, hub.address);
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(0);
      const g = await ci.getGetGlobal();
      expect(g.sealed).toBe(true);
      expect(g.issuer_slot_count).toBe(8n);
      expect(g.active_slot_count).toBe(8n);
      expect(g.credit_price).toBe(PRICE);
      expect(g.hub_bound).toBe(true);
      expect(g.capsule_hub_address.toString()).toBe(hub.address.toString());
      expect(codeOf(await seal(ci, controller), ci.address)).toBe(21000);
    });

    it('rejects uploading an issuer key after seal', async () => {
      const ci = await fullSetupSealed(blockchain, controller);
      expect(codeOf(await uploadIssuer(ci, controller, 8), ci.address)).toBe(21000);
    });
  });

  describe('CREDIT-ISSUER-KEYS', () => {
    it('validates uploads: nonzero pubkey, slot < 16, no duplicate', async () => {
      const ci = await deployCI(blockchain, controller);
      expect(codeOf(await uploadIssuer(ci, controller, 0, 0n), ci.address)).toBe(21011);
      expect(codeOf(await uploadIssuer(ci, controller, 16), ci.address)).toBe(21010);
      await uploadIssuer(ci, controller, 3);
      expect(codeOf(await uploadIssuer(ci, controller, 3), ci.address)).toBe(21012);
    });

    it('resolves an uploaded slot via get_issuer_slot', async () => {
      const ci = await deployCI(blockchain, controller);
      await uploadIssuer(ci, controller, 5);
      const s = await ci.getGetIssuerSlot(5n);
      expect(s.exists).toBe(true);
      expect(s.pubkey).toBe(issuerPubkey(5));
      expect(s.active).toBe(true);
      expect(s.version).toBe(0n);
      expect((await ci.getGetIssuerSlot(6n)).exists).toBe(false);
    });

    it('controller can replace a compromised slot post-seal (version bumps, key changes)', async () => {
      const ci = await fullSetupSealed(blockchain, controller);
      const fresh = issuerPubkey(200);
      const res = await ci.send(controller.getSender(), { value: toNano('0.05') }, {
        $$type: 'CreditReplaceIssuerKey', slot: 2n, new_pubkey: fresh,
      });
      expect(codeOf(res, ci.address)).toBe(0);
      const s = await ci.getGetIssuerSlot(2n);
      expect(s.pubkey).toBe(fresh);
      expect(s.active).toBe(true);
      expect(s.version).toBe(1n);
    });

    it('rejects a replace from a non-controller', async () => {
      const ci = await fullSetupSealed(blockchain, controller);
      const res = await ci.send(stranger.getSender(), { value: toNano('0.05') }, {
        $$type: 'CreditReplaceIssuerKey', slot: 2n, new_pubkey: issuerPubkey(201),
      });
      expect(codeOf(res, ci.address)).toBe(21033);
    });

    it('controller can revoke a slot; revoking twice is rejected', async () => {
      const ci = await fullSetupSealed(blockchain, controller);
      const rev = await ci.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'CreditRevokeIssuerKey', slot: 1n });
      expect(codeOf(rev, ci.address)).toBe(0);
      const s = await ci.getGetIssuerSlot(1n);
      expect(s.active).toBe(false);
      expect(s.version).toBe(1n);   // clean-16 B3: revoke bumps the version so it can be mirrored into the Hub
      expect((await ci.getGetGlobal()).active_slot_count).toBe(7n);
      // revoke again -> already inactive
      expect(codeOf(await ci.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'CreditRevokeIssuerKey', slot: 1n }), ci.address)).toBe(21056);
    });

    it('replacing a revoked slot reactivates it', async () => {
      const ci = await fullSetupSealed(blockchain, controller);
      await ci.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'CreditRevokeIssuerKey', slot: 4n });
      expect((await ci.getGetGlobal()).active_slot_count).toBe(7n);
      await ci.send(controller.getSender(), { value: toNano('0.05') }, {
        $$type: 'CreditReplaceIssuerKey', slot: 4n, new_pubkey: issuerPubkey(202),
      });
      const s = await ci.getGetIssuerSlot(4n);
      expect(s.active).toBe(true);
      expect(s.version).toBe(2n);   // clean-16 B3: revoke (0->1) then replace (1->2) — every slot change bumps version
      expect((await ci.getGetGlobal()).active_slot_count).toBe(8n);
    });
  });

  describe('CREDIT-BUY', () => {
    let ci: SandboxContract<CreditIssuer>;
    beforeEach(async () => {
      ci = await fullSetupSealed(blockchain, controller);
    });

    it('sells credits when value >= k*price + reserve, and accounts the pool', async () => {
      const k = 3n;
      const value = k * PRICE + toNano('0.05');
      const res = await ci.send(buyer.getSender(), { value }, {
        $$type: 'CreditBuyCredits', credits_k: k, redeem_pubkey: issuerPubkey(50), epoch: 100n,
      });
      expect(codeOf(res, ci.address)).toBe(0);
      const g = await ci.getGetGlobal();
      expect(g.credits_sold).toBe(3n);
      expect(g.pool_collected).toBe(k * PRICE);
    });

    it('rejects an underfunded purchase', async () => {
      const res = await ci.send(buyer.getSender(), { value: PRICE }, {
        $$type: 'CreditBuyCredits', credits_k: 5n, redeem_pubkey: issuerPubkey(51), epoch: 100n,
      });
      expect(codeOf(res, ci.address)).toBe(21063);
      expect((await ci.getGetGlobal()).credits_sold).toBe(0n);
    });

    it('rejects credits_k out of bounds and zero redeem_pubkey', async () => {
      expect(codeOf(await ci.send(buyer.getSender(), { value: toNano('1') }, {
        $$type: 'CreditBuyCredits', credits_k: 0n, redeem_pubkey: issuerPubkey(52), epoch: 100n,
      }), ci.address)).toBe(21060);
      expect(codeOf(await ci.send(buyer.getSender(), { value: toNano('200') }, {
        $$type: 'CreditBuyCredits', credits_k: 1001n, redeem_pubkey: issuerPubkey(53), epoch: 100n,
      }), ci.address)).toBe(21061);
      expect(codeOf(await ci.send(buyer.getSender(), { value: toNano('1') }, {
        $$type: 'CreditBuyCredits', credits_k: 1n, redeem_pubkey: 0n, epoch: 100n,
      }), ci.address)).toBe(21062);
    });
  });

  describe('CREDIT-RESOLVE', () => {
    it('exposes config via get_global', async () => {
      const ci = await fullSetupSealed(blockchain, controller);
      const g = await ci.getGetGlobal();
      expect(g.min_issuer_slots).toBe(8n);
      expect(g.max_issuer_slots).toBe(16n);
      expect(g.max_credits_per_buy).toBe(1000n);
      expect(g.genesis_controller_address.toString()).toBe(controller.address.toString());
    });
  });

  // clean-16 B3 co-obligatory pair: BuyCredits on the real CreditIssuer must FUND the real CapsuleHub pool end-to-end.
  describe('CREDIT-RECON (real Hub pool funding)', () => {
    it('CREDIT-RECON-01: BuyCredits forwards FundAnonPool → the Hub pool funds the declared epoch bucket', async () => {
      const deployer = await blockchain.treasury('recon-deployer');
      const dummyVault = await blockchain.treasury('recon-vault');
      const feeAcc = await blockchain.treasury('recon-fee');

      // Real CreditIssuer (unsealed).
      const ci = blockchain.openContract(await CreditIssuer.fromInit(deployer.address, MANIFEST_HASH, 0n, false));
      await ci.send(deployer.getSender(), { value: toNano('1') }, null);

      // Real CapsuleHub (unsealed), then cross-bind to the CI and seal.
      const hubInit = await CapsuleHub.init(feeAcc.address, dummyVault.address, false, false, 0n, deployer.address);
      const hubAddr = contractAddress(0, hubInit);
      await blockchain.setShardAccount(hubAddr, createShardAccount({
        address: hubAddr, code: hubInit.code, data: hubInit.data, balance: toNano('200'), workchain: 0,
      }));
      const hub = blockchain.openContract(new CapsuleHub(hubAddr, hubInit));
      const dep = (to: any, body: any, v = '0.05') => to.send(deployer.getSender(), { value: toNano(v) }, body);
      await dep(hub, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: dummyVault.address });
      await dep(hub, { $$type: 'BindCreditIssuer', credit_issuer_address: ci.address });
      await dep(hub, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH });
      expect((await hub.getGetState()).sealed).toBe(true);

      // Seal the CI, bound to the real Hub.
      for (let i = 0; i < 8; i++) await dep(ci, { $$type: 'CreditUploadIssuerKey', slot: BigInt(i), pubkey: issuerPubkey(i) });
      await dep(ci, { $$type: 'CreditSetPrice', credit_price: PRICE });
      await dep(ci, { $$type: 'CreditBindHub', capsule_hub_address: hubAddr });
      await dep(ci, { $$type: 'CreditSealGenesis', deployment_manifest_hash: MANIFEST_HASH }, '0.1');

      // G-PREPAID: the CI's prepaidUnit matches the Hub's CAPSULEHUB_PREPAID_UNIT constant (23.1M). A drift would make
      // the forward under/over-fund; the end-to-end funding assertion below confirms they are compatible.
      expect((await ci.getGetGlobal()).prepaid_unit).toBe(10_995_000n);

      // A buyer purchases 4 credits declaring epoch E → CI forwards FundAnonPool(4, E) → Hub pool funds bucket E.
      const buyer2 = await blockchain.treasury('recon-buyer');
      const E = 19675n;
      const res = await ci.send(buyer2.getSender(), { value: 4n * PRICE + toNano('0.1') }, {
        $$type: 'CreditBuyCredits', credits_k: 4n, redeem_pubkey: issuerPubkey(70), epoch: E,
      });
      expect(codeOf(res, ci.address)).toBe(0);

      expect(await hub.getGetEpochFunding(E)).toBe(4n);
      expect((await hub.getGetAnonPoolState()).anon_pool_outstanding).toBe(4n);
      // The Hub's ack cleared the pending purchase (success → no refund).
      expect((await ci.getGetPendingPurchase(0n)).exists).toBe(false);
      expect((await ci.getGetGlobal()).credits_sold).toBe(4n);
    });

    it('CREDIT-RECON-02: a bounced pool forward refunds the exact buyer and reverses the sale (§5.5 true refund)', async () => {
      const deployer = await blockchain.treasury('recon2-deployer');
      const dummyVault = await blockchain.treasury('recon2-vault');
      const feeAcc = await blockchain.treasury('recon2-fee');

      const ci = blockchain.openContract(await CreditIssuer.fromInit(deployer.address, MANIFEST_HASH, 0n, false));
      await ci.send(deployer.getSender(), { value: toNano('1') }, null);

      // Deploy the Hub and bind the CI, but DO NOT seal the Hub → FundAnonPool hits requireSealed (12900) → bounce.
      const hubInit = await CapsuleHub.init(feeAcc.address, dummyVault.address, false, false, 0n, deployer.address);
      const hubAddr = contractAddress(0, hubInit);
      await blockchain.setShardAccount(hubAddr, createShardAccount({
        address: hubAddr, code: hubInit.code, data: hubInit.data, balance: toNano('200'), workchain: 0,
      }));
      const hub = blockchain.openContract(new CapsuleHub(hubAddr, hubInit));
      const dep = (to: any, body: any, v = '0.05') => to.send(deployer.getSender(), { value: toNano(v) }, body);
      await dep(hub, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: dummyVault.address });
      await dep(hub, { $$type: 'BindCreditIssuer', credit_issuer_address: ci.address });
      // (Hub left UNSEALED on purpose.)

      for (let i = 0; i < 8; i++) await dep(ci, { $$type: 'CreditUploadIssuerKey', slot: BigInt(i), pubkey: issuerPubkey(i) });
      await dep(ci, { $$type: 'CreditSetPrice', credit_price: PRICE });
      await dep(ci, { $$type: 'CreditBindHub', capsule_hub_address: hubAddr });
      await dep(ci, { $$type: 'CreditSealGenesis', deployment_manifest_hash: MANIFEST_HASH }, '0.1');

      const buyer2 = await blockchain.treasury('recon2-buyer');
      const res = await ci.send(buyer2.getSender(), { value: 3n * PRICE + toNano('0.2') }, {
        $$type: 'CreditBuyCredits', credits_k: 3n, redeem_pubkey: issuerPubkey(71), epoch: 19675n,
      });
      expect(codeOf(res, ci.address)).toBe(0);   // the BuyCredits itself succeeds; the FAILURE is the async forward

      // The bounce reversed the sale and cleared the pending entry.
      const g = await ci.getGetGlobal();
      expect(g.credits_sold).toBe(0n);
      expect(g.pool_collected).toBe(0n);
      expect((await ci.getGetPendingPurchase(0n)).exists).toBe(false);
      // The Hub pool was NOT funded (the forward bounced).
      expect(await hub.getGetEpochFunding(19675n)).toBe(0n);
      // A CreditPurchaseRefund (op 0x43524438) was sent to the exact buyer for the full price.
      const refund = res.transactions.find((t: any) => {
        if (t.inMessage?.info?.type !== 'internal') return false;
        if (t.inMessage?.info?.dest?.toString() !== buyer2.address.toString()) return false;
        try { return Number(t.inMessage.body.beginParse().loadUint(32)) === 0x43524438; } catch { return false; }
      });
      expect(refund).toBeDefined();
    });

    it('CREDIT-RECON-03 / G-PREPAID: CreditIssuer prepaidUnit equals the Hub CAPSULEHUB_PREPAID_UNIT (both compiled)', async () => {
      const { ci, hub } = await deployReconPair(blockchain);
      const ciUnit = (await ci.getGetGlobal()).prepaid_unit;
      const hubUnit = (await hub.getGetAnonPoolState()).prepaid_unit;
      // The seal-gate equality (§5.6): a drift here would make every FundAnonPool forward under/over-fund.
      expect(ciUnit).toBe(hubUnit);
      // G8-CANONICAL PRIVATE lane (worst): protocolFee(10M) + endowment 784k*1.25 + nullifier 12k*1.25.
      expect(ciUnit).toBe(10_995_000n);
    });

    it('CREDIT-RECON-04 / version-sync: the Hub issuer mirror converges with CreditIssuer across genesis + Replace + Revoke', async () => {
      const { ci, hub, deployer, dep } = await deployReconPair(blockchain);
      // Genesis: all 8 slots mirror bit-for-bit at version 0.
      for (let s = 0; s < 8; s++) await assertSlotConverged(ci, hub, s);

      // Replace slot 2 (compromise recovery): CI version 0 -> 1, then mirror it into the Hub (Hub-first is the rule,
      // but for the sync-convergence test the order does not matter — we assert both agree afterwards).
      const fresh = issuerPubkey(200);
      await dep(ci, { $$type: 'CreditReplaceIssuerKey', slot: 2n, new_pubkey: fresh });
      expect((await ci.getGetIssuerSlot(2n)).version).toBe(1n);
      await dep(hub, { $$type: 'HubMirrorIssuerKey', slot: 2n, pubkey: fresh, active: true, version: 1n });
      await assertSlotConverged(ci, hub, 2);

      // Revoke slot 1: CI version 0 -> 1 (the fix — revoke bumps so it is mirror-able), then mirror the deactivation.
      await dep(ci, { $$type: 'CreditRevokeIssuerKey', slot: 1n });
      const revoked = await ci.getGetIssuerSlot(1n);
      expect(revoked.active).toBe(false);
      expect(revoked.version).toBe(1n);
      await dep(hub, { $$type: 'HubMirrorIssuerKey', slot: 1n, pubkey: revoked.pubkey, active: false, version: 1n });
      await assertSlotConverged(ci, hub, 1);
      // The mirrored slot is now inactive → a token pointing at slot 1 would fail verifyIssuerToken (13602) at spend.
      expect((await hub.getGetIssuerSlot(1n)).active).toBe(false);

      // Version-monotone guard: re-mirroring slot 2 at a NON-greater version is rejected (13615, anti-reorder/replay).
      const reMirror = await hub.send(deployer.getSender(), { value: toNano('0.05') }, {
        $$type: 'HubMirrorIssuerKey', slot: 2n, pubkey: fresh, active: true, version: 1n,
      });
      expect(codeOf(reMirror, hub.address)).toBe(13615);
    });
  });
});
