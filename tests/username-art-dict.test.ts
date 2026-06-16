import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano, TupleReader } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';

// Option B: glyph/static path-`d` strings live in the registry `art` dict (uploaded by the
// genesis controller while unsealed, locked by SealGenesis). get_nft_content assembles
// image_data (paths) by reading parts via cell.asSlice().asString(). This proves the
// assembled image_data == the validated reference SVG byte-for-byte, gas < 3M, and that
// SealGenesis refuses an incomplete art set.

const PAYLOAD: Record<string, string> = JSON.parse(readFileSync('artifacts/username_art_v2/art_payload.json', 'utf8'));
const REF: Record<number, string> = {};
for (const n of [4, 5, 6, 7, 8, 16]) REF[n] = readFileSync(`artifacts/username_art_v2/ref_${n}.svg`, 'utf8');
const NAME_FOR: Record<number, string> = { 4: 'epic', 5: 'plato', 6: 'platho', 7: 'abcdefg', 8: 'abcdefgh', 16: 'abcdefghijklmnop' };

function fixtureAddress(label: string): Address { return new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest()); }
function metadataKey(f: string): bigint { return BigInt('0x' + createHash('sha256').update(f).digest('hex')); }
function nameHash(name: string): bigint { return BigInt('0x' + beginCell().storeUint(0xC5CC7CD6, 32).storeBuffer(Buffer.from(name, 'ascii')).endCell().hash().toString('hex')); }
function readSnake(cell: Cell, hasMarker: boolean): string {
  let cur: Cell | null = cell, first = true; const out: Buffer[] = [];
  while (cur) { const s = cur.beginParse(); if (first && hasMarker) { s.loadUint(8); first = false; } out.push(s.loadBuffer(Math.floor(s.remainingBits / 8))); cur = s.remainingRefs > 0 ? s.loadRef() : null; }
  return Buffer.concat(out).toString('utf8');
}
function plainSnake(s: string): Cell { // Tact-String format: 127-byte chunks + refs, NO marker
  const bytes = Buffer.from(s, 'utf8'); const CHUNK = 127; const chunks: Buffer[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) chunks.push(bytes.subarray(i, i + CHUNK));
  if (chunks.length === 0) chunks.push(Buffer.alloc(0));
  let next: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) { const b = beginCell().storeBuffer(chunks[i]); if (next) b.storeRef(next); next = b.endCell(); }
  return next!;
}
function slimItemContent(username: string): Cell {
  const nameCell = beginCell().storeUint(0, 8).storeBuffer(Buffer.from(username, 'ascii')).storeUint(0x2e617468, 32).endCell();
  const descCell = beginCell().storeUint(0, 8).storeBuffer(Buffer.from('Platho username', 'ascii')).endCell();
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  dict.set(metadataKey('name'), nameCell); dict.set(metadataKey('description'), descCell);
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

async function deployRegistry() {
  const blockchain = await Blockchain.create();
  const controller = await blockchain.treasury('art-controller');
  const init = await UsernameRegistry.init(
    fixtureAddress('ATH_WALLET'), fixtureAddress('ATH_MASTER'), fixtureAddress('TREASURY'),
    false, 0n, 0n, controller.address,
  );
  const addr = contractAddress(0, init);
  await blockchain.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('5'), workchain: 0 }));
  const registry = blockchain.openContract(new UsernameRegistry(addr, init));
  return { blockchain, registry, controller, addr };
}

async function uploadAll(registry: any, controller: any, keys?: number[]) {
  const allKeys = (keys ?? Object.keys(PAYLOAD).map(Number)).sort((a, b) => a - b);
  for (const k of allKeys) {
    await registry.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'UploadArt', key: BigInt(k), data: plainSnake(PAYLOAD[String(k)]) });
  }
}

describe('UsernameRegistry art-dict (option B)', () => {
  it('ART-01: get_nft_content image_data == reference SVG after uploading all 56 parts', async () => {
    const { blockchain, registry, controller, addr } = await deployRegistry();
    await uploadAll(registry, controller);

    for (const n of [4, 5, 6, 7, 8, 16]) {
      const username = NAME_FOR[n];
      const res = await blockchain.runGetMethod(addr, 'get_nft_content', [
        { type: 'int', value: nameHash(username) },
        { type: 'cell', cell: slimItemContent(username) },
      ] as any, { gasLimit: 1_000_000_000n });
      expect(res.exitCode, `len ${n}`).toBe(0);
      const content = (res.stackReader as TupleReader).readCell();
      const slice = content.beginParse(); expect(slice.loadUint(8)).toBe(0);
      const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
      const imageData = readSnake(dict.get(metadataKey('image_data'))!, true);
      expect(imageData, `image_data len ${n} matches reference`).toBe(REF[n]);
      expect(res.gasUsed, `gas len ${n} < 3M`).toBeLessThan(3_000_000n);
    }
  }, 120000);

  it('ART-03: production upload value (0.17 TON/part) funds the registry storage for 100+ years', async () => {
    // Mainnet storage price (config 18, basechain): bit_price_ps=0, cell_price_ps=135.
    // 100yr rent per cell = 135 * (100*365.25*86400 sec) / 2^16 nanotons.
    const PER_CELL_100YR = (135n * 3155760000n) / 65536n;
    // Registry base storage = code cells + uploaded art-dict cells (empty name/pending maps add ~0).
    const codeBoc = readFileSync('build/UsernameRegistry/UsernameRegistry_UsernameRegistry.code.boc');
    const countCells = (c: Cell) => { let n = 0; const seen = new Set<string>(); const w = (x: Cell) => { const h = x.hash().toString('hex'); if (seen.has(h)) return; seen.add(h); n++; for (const r of x.refs) w(r); }; w(c); return n; };
    const codeCells = countCells(Cell.fromBoc(codeBoc)[0]);
    const artDict = Dictionary.empty(Dictionary.Keys.Uint(16), Dictionary.Values.Cell());
    for (const k of Object.keys(PAYLOAD)) artDict.set(Number(k), plainSnake(PAYLOAD[k]));
    const artCells = countCells(beginCell().storeDict(artDict).endCell());
    const baseCells = BigInt(codeCells + artCells);
    const rent100yr = baseCells * PER_CELL_100YR;

    // Deploy with only an operational balance (like the D09 deploy value); the reserve comes
    // entirely from the art uploads at the PRODUCTION value.
    const blockchain = await Blockchain.create();
    const controller = await blockchain.treasury('art-survival');
    const init = await UsernameRegistry.init(fixtureAddress('ATH_WALLET'), fixtureAddress('ATH_MASTER'), fixtureAddress('TREASURY'), false, 0n, 0n, controller.address);
    const addr = contractAddress(0, init);
    await blockchain.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('0.5'), workchain: 0 }));
    const registry = blockchain.openContract(new UsernameRegistry(addr, init));
    for (const k of Object.keys(PAYLOAD).map(Number).sort((a, b) => a - b)) {
      await registry.send(controller.getSender(), { value: toNano('0.17') }, { $$type: 'UploadArt', key: BigInt(k), data: plainSnake(PAYLOAD[String(k)]) });
    }
    const bal = (await blockchain.getContract(addr)).balance;
    const years = Number((bal * 100n) / rent100yr);
    // eslint-disable-next-line no-console
    console.log(`ART-03: base ${baseCells} cells, 100yr rent ${rent100yr} nanotons, registry balance ${bal} -> ~${years} years (worst case, zero mints)`);
    expect(bal).toBeGreaterThanOrEqual(rent100yr); // survives 100+ years with no mints at all
  }, 120000);

  it('ART-02: SealArt requires all 56 parts and then locks further uploads (19060/19061)', async () => {
    const { blockchain, registry, controller, addr } = await deployRegistry();
    // partial upload -> SealArt is rejected (art_count != 56), art stays unsealed
    await uploadAll(registry, controller, Object.keys(PAYLOAD).map(Number).slice(0, 10));
    await registry.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'SealArt' });
    expect(await registry.getGetArtSealed()).toBe(false);
    // full upload -> count 56 -> SealArt succeeds
    await uploadAll(registry, controller);
    expect(Number(await registry.getGetArtCount())).toBe(56);
    await registry.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'SealArt' });
    expect(await registry.getGetArtSealed()).toBe(true);
    // after seal, UploadArt is rejected (19061) — count unchanged
    await registry.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'UploadArt', key: 97n, data: plainSnake('SHOULD_NOT_APPLY') });
    expect(Number(await registry.getGetArtCount())).toBe(56);
    // and the art still renders
    const res = await blockchain.runGetMethod(addr, 'get_nft_content', [
      { type: 'int', value: nameHash('platho') },
      { type: 'cell', cell: slimItemContent('platho') },
    ] as any, { gasLimit: 1_000_000_000n });
    expect(res.exitCode).toBe(0);
  }, 120000);
});
