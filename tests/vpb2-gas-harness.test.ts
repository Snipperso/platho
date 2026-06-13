import { describe, expect, it } from 'vitest';
import { beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { external } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { CapsuleHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { Vault, RegisterMessagingKeys } from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
} from './helpers/capsule-cells';

// VPB2 gas harness — measures the ACTUAL compute gas of the CapsuleHub batch ingest across part counts so the
// HUB_BATCH_BASE_GAS / HUB_PART_GAS_* fee constants can be calibrated (currently placeholders). Logs measured
// numbers + a linear (base + per-part) fit. Not an assertion gate yet — calibration step 1.

const MANIFEST = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SUITE_HYBRID = 2n;
const SIZE_1K = 1n;
const MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;
const BATCH_PUBLISH_ID = 0x9999000000000000000000000000000000000000000000000000000000009999n;

const cellHash = (c: Cell): bigint => BigInt('0x' + c.hash().toString('hex'));
const marketingCell = (): Cell => beginCell().storeUint(MARKETING_NOTE, 152).endCell();

function partsList(kind: bigint, n: number, size: bigint = SIZE_1K): Cell {
  let next: Cell | null = null;
  for (let i = n - 1; i >= 0; i -= 1) {
    let b;
    if (kind === KIND_PRIVATE) {
      const h0 = finalPrivateHeader0Cell(0x30 + (i % 90));
      const h1 = finalPrivateHeader1Cell(0x31 + (i % 90));
      const body = finalPrivateBodyCell(size, 0x40 + (i % 90));
      b = beginCell().storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
        .storeUint(cellHash(h0), 256).storeUint(cellHash(h1), 256).storeUint(cellHash(body), 256)
        .storeRef(h0).storeRef(h1).storeRef(body);
    } else {
      const header = finalPublicHeaderCell(0x50, 8);
      const body = finalPublicBodyCell(0x40 + (i % 90), Number(size) * 1024);
      b = beginCell().storeUint(size, 8).storeUint(0, 8)
        .storeUint(cellHash(header), 256).storeUint(cellHash(body), 256)
        .storeRef(header).storeRef(body);
    }
    if (next) b.storeRef(next);
    next = b.endCell();
  }
  return next!;
}

// approx stored body bytes per private hybrid size class (overhead 1204 + class*1024)
const privBodyBytes = (size: number): number => 1204 + size * 1024;

async function setupHub() {
  const bc = await Blockchain.create();
  bc.now = 1_700_000_000;
  const feeAcc = await bc.treasury('gas-fee-acc');
  const vault = await bc.treasury('gas-vault');
  const controller = await bc.treasury('gas-controller');
  const init = await CapsuleHub.init(feeAcc.address, vault.address, true, true, MANIFEST, controller.address);
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('500'), workchain: 0 }));
  const hub = bc.openContract(new CapsuleHub(addr, init));
  return { bc, hub, vault };
}

async function ingestGas(kind: bigint, n: number, size: bigint = SIZE_1K): Promise<number> {
  const { bc, hub, vault } = await setupHub();
  const res = await hub.send(vault.getSender(), { value: toNano('5') }, {
    $$type: 'PublishBatchToHub',
    bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: kind,
    part_count: BigInt(n), protocol_fee_total: 0n, author_wallet: vault.address,
    parts: partsList(kind, n, size), marketing: kind === KIND_PUBLIC ? marketingCell() : null,
  } as any);
  const tx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === hub.address.toString());
  return Number((tx!.description as any).computePhase.gasUsed);
}

function fit(points: Array<[number, number]>): { base: number; perPart: number } {
  // simple two-point fit on the endpoints
  const [n0, g0] = points[0];
  const [n1, g1] = points[points.length - 1];
  const perPart = (g1 - g0) / (n1 - n0);
  const base = g0 - perPart * n0;
  return { base: Math.round(base), perPart: Math.round(perPart) };
}

// ---- Vault batch external measurement ----
const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const AUTH_KP = keyPairFromSeed(Buffer.alloc(32, 0x66));
const AUTH_0V = BigInt('0x' + AUTH_KP.publicKey.toString('hex'));
const OP_PUBLISH_BATCH = 0x7e1f5041n;
const DOMAIN_VPB2 = 0x56504232n;
const addrHash = (a: any): bigint => BigInt('0x' + a.hash.toString('hex'));
function snake(n: number, fill = 0x5a): Cell {
  let tail: Cell | null = null;
  for (let o = n; o > 0;) { const s = Math.max(0, o - 127); const b = beginCell().storeBuffer(Buffer.alloc(o - s, fill)); if (tail) b.storeRef(tail); tail = b.endCell(); o = s; }
  return tail ?? beginCell().endCell();
}
const PQV = snake(1184);

async function setupVault() {
  const bc = await Blockchain.create();
  bc.now = 1_700_000_000;
  const user = await bc.treasury('gv-user');
  const ath = await bc.treasury('gv-ath');
  const hub = await bc.treasury('gv-hub');
  const init = await Vault.init(ath.address, ath.address, hub.address, GENESIS_HASH, true, true, 0n);
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('10'), workchain: 0 }));
  const vault = bc.openContract(new Vault(addr, init));
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'RegisterMessagingKeys', enc_pubkey: 1n, sign_pubkey: 2n, auth_pubkey: AUTH_0V,
    pq_kem_pubkey_hash: 5n, pq_kem_pubkey_len: 1184n, pq_kem_pubkey: PQV, crypto_suite_mask: 2n,
  } as RegisterMessagingKeys);
  await vault.send(user.getSender(), { value: toNano('8') + 2_000_000n }, { $$type: 'DepositTon', amount: toNano('8') } as any);
  return { bc, vault, user, addr };
}

async function vaultBatchGas(n: number, size: bigint = SIZE_1K): Promise<number> {
  const { bc, vault, user, addr } = await setupVault();
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const parts = partsList(KIND_PRIVATE, n, size);
  const root = beginCell()
    .storeUint(DOMAIN_VPB2, 32).storeUint(GENESIS_HASH, 256).storeUint(addrHash(addr), 256)
    .storeUint(KIND_PRIVATE, 8).storeUint(addrHash(user.address), 256).storeUint(nonce, 64)
    .storeUint(toNano('5'), 128).storeUint(BigInt(n), 8).storeUint(1n, 8).storeRef(parts).endCell();
  const sig = sign(root.hash(), AUTH_KP.secretKey);
  const body = beginCell().storeUint(OP_PUBLISH_BATCH, 32).storeAddress(user.address).storeBuffer(sig).storeRef(root).endCell();
  const res = await bc.sendMessage(external({ to: addr, body }));
  const tx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === addr.toString());
  return Number((tx!.description as any).computePhase.gasUsed);
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
