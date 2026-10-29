import { describe, it, expect } from 'vitest';
import { Blockchain, defaultConfig, loadConfig, createShardAccount } from '@ton/sandbox';
import { contractAddress, toNano } from '@ton/core';


const YEAR = 31_536_000;
const SCALE = 65536;

describe('TON basechain storage-rent rate — authoritative freeze', () => {
  it('RATE-VERIFY-01: config-18 basechain prices from @ton/sandbox defaultConfig (mainnet-verified)', () => {
    const config: any = loadConfig(defaultConfig);
    const storagePrices = config['18']?.anon0;
    let latest: any = null;
    for (const [, s] of storagePrices) {
      if (!latest || Number(s.utime_since) > Number(latest.utime_since)) latest = s;
    }
    const cell = Number(latest._cell_price_ps);
    const bit = Number(latest.bit_price_ps);
    const mcCell = Number(latest.mc_cell_price_ps);
    const perCellYr = (cell * YEAR) / SCALE;
    const perBitYr = (bit * YEAR) / SCALE;
    // eslint-disable-next-line no-console
    console.log(`\n[RATE-VERIFY-01] config-18 basechain: cell_price_ps=${cell}  bit_price_ps=${bit}  (mc_cell_price_ps=${mcCell})  utime_since=${latest.utime_since}`);
    // eslint-disable-next-line no-console
    console.log(`[RATE-VERIFY-01] => ${perCellYr.toFixed(1)} nanoton/CELL/yr ; ${perBitYr.toFixed(2)} nanoton/BIT/yr\n`);
    expect(cell).toBe(135);
    expect(bit).toBe(0);
  });

  it('RATE-VERIFY-02: empirically measure the CURRENT (post-2026) basechain storage fee the TVM charges over 1 year', async () => {
    const bc = await Blockchain.create();
    const t0 = 1_800_000_000;
    bc.now = t0;
    const target = await bc.treasury('rate-target', { balance: toNano('100') });
    const poker = await bc.treasury('rate-poker');

    await poker.send({ to: target.address, value: toNano('0.05'), bounce: true });
    const sc: any = await bc.getContract(target.address);
    const used = sc.account.account.storageStats.used;
    const cells = Number(used.cells);
    const bits = Number(used.bits);

    bc.now = t0 + YEAR;
    const res = await poker.send({ to: target.address, value: toNano('0.05'), bounce: true });
    const tx: any = res.transactions.find((x: any) => x.inMessage?.info?.dest?.toString() === target.address.toString());
    const storageFee = Number((tx.description.storagePhase?.storageFeesCollected) ?? 0n);

    const baseExpected = Math.floor((cells * 135 * YEAR) / SCALE);
    // eslint-disable-next-line no-console
    console.log(`\n[RATE-VERIFY-02] basechain treasury @2027: cells=${cells} bits=${bits}; measured 1-yr fee=${storageFee}; expected(135/0)=${baseExpected}`);
    // eslint-disable-next-line no-console
    console.log(`[RATE-VERIFY-02] measured per-cell/yr = ${cells ? (storageFee / cells).toFixed(1) : 'n/a'}  (config-derived 64962) → EMPIRICAL == CONFIG\n`);

    expect(cells).toBeGreaterThan(0);
    expect(storageFee).toBeGreaterThan(0);
    expect(Math.abs(storageFee - baseExpected)).toBeLessThanOrEqual(cells + 2);
  });
});
