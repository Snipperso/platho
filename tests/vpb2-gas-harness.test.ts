import { describe, expect, it } from 'vitest';
import { beginCell, external, toNano } from '@ton/core';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  SIZE_1K,
  partsList,
  marketingCell,
  batchExternalBody,
  setupHub,
  setupVault,
  registerHybrid,
  depositTon,
} from './helpers/vpb2';

// VPB2 gas harness — measures the ACTUAL compute gas of the CapsuleHub batch ingest + the Vault batch external
// across part counts / size classes, so the fee constants stay calibrated. GAS-GATE-G8 is the permanent
// release gate: the worst sendable 8-part batch must stay under 50% of the 1M tx limit. Wire format and
// deploy scaffolding come from ./helpers/vpb2 (single source of truth).

const BATCH_PUBLISH_ID = 0x9999000000000000000000000000000000000000000000000000000000009999n;

// approx stored body bytes per private hybrid size class (overhead 1204 + class*1024)
const privBodyBytes = (size: number): number => 1204 + size * 1024;

async function ingestGas(kind: bigint, n: number, size: bigint = SIZE_1K): Promise<number> {
  const { hub, vault } = await setupHub();
  const res = await hub.send(vault.getSender(), { value: toNano('5') }, {
    $$type: 'PublishBatchToHub',
    bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: kind,
    part_count: BigInt(n), protocol_fee_total: 0n, author_wallet: vault.address,
    parts: partsList(kind, n, size), marketing: kind === KIND_PUBLIC ? marketingCell() : null,
  } as any);
  const tx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === hub.address.toString());
  return Number((tx!.description as any).computePhase.gasUsed);
}

// Measures Hub ingest gas of an n-part batch that ALSO auto-evicts n entries: seed n at T0, advance past the
// 1-year retention window, then send a second n-part batch (which adds n AND evicts the n now-expired seeds).
const EVICT_RETENTION = 31536000;
const EVICT_T0 = 1_700_000_000;
async function ingestGasWithEviction(kind: bigint, n: number, size: bigint = SIZE_1K): Promise<number> {
  const { hub, vault, blockchain } = (await setupHub()) as any;
  const send = (pid: bigint, bid: bigint) => hub.send(vault.getSender(), { value: toNano('5') }, {
    $$type: 'PublishBatchToHub',
    bounce_id: bid, bounce_tag: bid + 1000n, publish_id: pid, publish_kind: kind,
    part_count: BigInt(n), protocol_fee_total: 0n, author_wallet: vault.address,
    parts: partsList(kind, n, size), marketing: kind === KIND_PUBLIC ? marketingCell() : null,
  } as any);
  blockchain.now = EVICT_T0;
  await send(0x1111n, 1n);
  blockchain.now = EVICT_T0 + EVICT_RETENTION + 60;
  const res = await send(0x2222n, 2n);
  const tx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === hub.address.toString());
  return Number((tx!.description as any).computePhase.gasUsed);
}

async function vaultBatchGas(n: number, size: bigint = SIZE_1K): Promise<number> {
  const { blockchain, vault, user } = await setupVault({ balance: toNano('10') });
  await registerHybrid(vault, user);
  await depositTon(vault, user, toNano('8'));
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const body = batchExternalBody({
    vaultAddr: vault.address, owner: user.address,
    maxCharge: toNano('5'), partCount: BigInt(n), partsRoot: partsList(KIND_PRIVATE, n, size), nonce,
  });
  const res = await blockchain.sendMessage(external({ to: vault.address, body }));
  const tx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString());
  return Number((tx!.description as any).computePhase.gasUsed);
}

function fit(points: Array<[number, number]>): { base: number; perPart: number } {
  const [n0, g0] = points[0];
  const [n1, g1] = points[points.length - 1];
  const perPart = (g1 - g0) / (n1 - n0);
  const base = g0 - perPart * n0;
  return { base: Math.round(base), perPart: Math.round(perPart) };
}

describe('VPB2 gas harness: CapsuleHub batch ingest', () => {
  it('GAS-HUB-INGEST: measures private + public ingest gas vs part_count', async () => {
    const counts = [1, 2, 4, 8]; // MAX_BATCH_PARTS = 8
    for (const kind of [KIND_PRIVATE, KIND_PUBLIC] as const) {
      const pts: Array<[number, number]> = [];
      for (const n of counts) {
        const g = await ingestGas(kind, n);
        pts.push([n, g]);
      }
      const f = fit(pts);
      const label = kind === KIND_PRIVATE ? 'PRIVATE' : 'PUBLIC ';
      // eslint-disable-next-line no-console
      console.log(`GAS-HUB ${label} gasUsed: ${pts.map(([n, g]) => `n=${n}:${g}`).join('  ')}  | fit base=${f.base} perPart=${f.perPart}`);
    }
  });

  it('GAS-VAULT-BATCH: measures the Vault batch external compute gas vs part_count', async () => {
    const counts = [1, 2, 4, 8]; // MAX_BATCH_PARTS = 8
    const pts: Array<[number, number]> = [];
    for (const n of counts) pts.push([n, await vaultBatchGas(n)]);
    const f = fit(pts);
    // eslint-disable-next-line no-console
    console.log(`GAS-VAULT gasUsed: ${pts.map(([n, g]) => `n=${n}:${g}`).join('  ')}  | fit base=${f.base} perPart=${f.perPart}`);
  });

  it('GAS-GATE-G8: the worst sendable 8-part batch stays under 50% of the 1M tx limit; one 32K stays under 1M', async () => {
    // Worst gas-heavy 8-part batch that still fits the 65,535-byte external cap = 8x4K (8x5470 bytes = 43,760).
    const worst8 = await vaultBatchGas(8, 4n);
    // eslint-disable-next-line no-console
    console.log(`GAS-GATE  8x4K vaultGas=${worst8} (G8 budget 500000)`);
    expect(worst8).toBeLessThan(500_000);
    const one32k = await vaultBatchGas(1, 32n);
    // eslint-disable-next-line no-console
    console.log(`GAS-GATE  1x32K vaultGas=${one32k} (hard limit 1000000)`);
    expect(one32k).toBeLessThan(1_000_000);
  });

  it('GAS-GATE-EVICT: a publish that auto-evicts part_count entries stays within the funded HUB_PART_GAS provision', async () => {
    // Worst case: an 8-part batch (largest that fits the 65,535-byte external as 8x4K) that ALSO auto-evicts 8
    // now-expired entries. The Hub's value gate funds getComputeFee(HUB_BATCH_BASE_GAS + part_count*HUB_PART_GAS_*);
    // the actual add+evict compute MUST stay under that provision, or the publish would value-shortfall once the
    // contract is >1yr old. Mirrors contracts/CapsuleHub.tact HUB_BATCH_BASE_GAS=14000, HUB_PART_GAS_PUBLIC=180000,
    // HUB_PART_GAS_PRIVATE=170000.
    const HUB_BATCH_BASE_GAS = 14000;
    for (const [label, kind, perPart] of [['PUBLIC ', KIND_PUBLIC, 180000], ['PRIVATE', KIND_PRIVATE, 170000]] as const) {
      const gas = await ingestGasWithEviction(kind, 8, 4n);
      const provisioned = HUB_BATCH_BASE_GAS + 8 * perPart;
      // eslint-disable-next-line no-console
      console.log(`GAS-GATE-EVICT ${label} 8x4K add+evict gasUsed=${gas} provisioned=${provisioned} headroom=${provisioned - gas} perPartUsed≈${Math.round((gas - HUB_BATCH_BASE_GAS) / 8)}/${perPart}`);
      expect(gas).toBeLessThan(provisioned);
    }
  });

  it('GAS-BY-SIZE: per-capsule gas + capacity at each private size class (1 part each)', async () => {
    const sizes = [1, 2, 4, 8, 16, 32];
    const VAULT_BASE = 47000;       // extrapolated n=0 intercept from the 1K count-sweep
    const HARD = 1_000_000;          // tx gas limit
    const G8 = 500_000;              // 50% post-accept-walk budget
    const EXT = 65535;               // external byte ceiling
    // eslint-disable-next-line no-console
    console.log('GAS-BY-SIZE  size | vaultGas(1) hubGas(1) | perPart(vault) | bodyB | Nmax: gas1M / G8 / extByte / BINDING');
    for (const s of sizes) {
      const vg = await vaultBatchGas(1, BigInt(s));
      const hg = await ingestGas(KIND_PRIVATE, 1, BigInt(s));
      const perPart = vg - VAULT_BASE;
      const body = privBodyBytes(s);
      const nHard = Math.max(0, Math.floor((HARD - VAULT_BASE) / Math.max(1, perPart)));
      const nG8 = Math.max(0, Math.floor(G8 / Math.max(1, perPart)));
      const nExt = Math.floor(EXT / body);
      const binding = Math.min(nHard, nG8, nExt);
      // eslint-disable-next-line no-console
      console.log(`GAS-BY-SIZE  ${String(s).padStart(2)}K | ${String(vg).padStart(9)} ${String(hg).padStart(8)} | ${String(perPart).padStart(8)} | ${String(body).padStart(5)} | ${nHard} / ${nG8} / ${nExt} / ${binding}`);
    }
  });
});
