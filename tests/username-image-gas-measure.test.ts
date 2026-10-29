import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, Dictionary, contractAddress, toNano, TupleReader } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { readFileSync } from 'fs';


const GAS_CEILING = 3_000_000n;

const ART_PAYLOAD: Record<string, string> = JSON.parse(readFileSync('artifacts/username_art_v2/art_payload.json', 'utf8'));
function plainSnake(s: string): Cell {
  const bytes = Buffer.from(s, 'utf8'); const CHUNK = 127; const chunks: Buffer[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) chunks.push(bytes.subarray(i, i + CHUNK));
  if (chunks.length === 0) chunks.push(Buffer.alloc(0));
  let next: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) { const b = beginCell().storeBuffer(chunks[i]); if (next) b.storeRef(next); next = b.endCell(); }
  return next!;
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}
function metadataKey(field: string): bigint {
  return BigInt('0x' + createHash('sha256').update(field).digest('hex'));
}
function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(0xC5CC7CD6, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell().hash().toString('hex'));
}

function readSnakeBytes(cell: Cell, hasMarker: boolean): Buffer {
  let current: Cell | null = cell;
  let first = true;
  const chunks: Buffer[] = [];
  while (current) {
    const slice = current.beginParse();
    if (first && hasMarker) {
      slice.loadUint(8);
      first = false;
    }
    chunks.push(slice.loadBuffer(Math.floor(slice.remainingBits / 8)));
    current = slice.remainingRefs > 0 ? slice.loadRef() : null;
  }
  return Buffer.concat(chunks);
}

function slimItemContent(username: string): Cell {
  const nameCell = beginCell()
    .storeUint(0, 8)
    .storeBuffer(Buffer.from(username, 'ascii'))
    .storeUint(0x2e617468, 32)
    .endCell();
  const descCell = beginCell()
    .storeUint(0, 8)
    .storeBuffer(Buffer.from('Platho username', 'ascii'))
    .endCell();
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  dict.set(metadataKey('name'), nameCell);
  dict.set(metadataKey('description'), descCell);
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

async function deployRegistry() {
  const blockchain = await Blockchain.create();
  const deployer = await blockchain.treasury('measure-deployer');
  const init = await UsernameRegistry.init(
    fixtureAddress('RENDER_PLACEHOLDER_ATH_WALLET'),
    fixtureAddress('RENDER_ATH_MASTER'),
    fixtureAddress('RENDER_TREASURY'),
    false, 0n, 0n, deployer.address,
  );
  const addr = contractAddress(0, init);
  await blockchain.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: toNano('5'), workchain: 0,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(addr, init));
  for (const k of Object.keys(ART_PAYLOAD).map(Number).sort((a, b) => a - b)) {
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'UploadArt', key: BigInt(k), data: plainSnake(ART_PAYLOAD[String(k)]) });
  }
  return { blockchain, addr };
}

function nameOfLength(n: number): string {
  const base = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < n; i++) s += base[i % base.length];
  return s;
}

describe('UsernameRegistry image_data gas measurement', () => {
  const lengths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

  it('MEASURE: get_nft_content gas per name length < 3M, image_data fontless paths, no percent image', async () => {
    const { blockchain, addr } = await deployRegistry();
    const GAS_LIMIT = 1_000_000_000n;

    const rows: { len: number; gas: bigint; rawLen: number }[] = [];

    for (const len of lengths) {
      const username = nameOfLength(len);
      const stack = [
        { type: 'int', value: nameHash(username) } as const,
        { type: 'cell', cell: slimItemContent(username) } as const,
      ];
      const res = await blockchain.runGetMethod(addr, 'get_nft_content', stack as any, { gasLimit: GAS_LIMIT });
      expect(res.exitCode).toBe(0);

      const reader = res.stackReader as TupleReader;
      const content = reader.readCell();
      const slice = content.beginParse();
      expect(slice.loadUint(8)).toBe(0);
      const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

      for (const key of ['name', 'description', 'image_data'] as const) {
        const valueCell = dict.get(metadataKey(key));
        expect(valueCell, `metadata value ${key} present`).toBeTruthy();
        expect(valueCell!.beginParse().loadUint(8), `${key} TEP-64 0x00 snake marker`).toBe(0);
      }
      expect(dict.get(metadataKey('image')), 'percent image must be absent').toBeUndefined();

      const rawSvg = readSnakeBytes(dict.get(metadataKey('image_data'))!, true).toString('utf8');
      expect(rawSvg.startsWith('<svg')).toBe(true);
      expect(rawSvg.endsWith('</svg>')).toBe(true);
      expect(rawSvg.includes('<text')).toBe(false);
      expect(rawSvg.includes('font-family')).toBe(false);
      expect(rawSvg.includes('<path')).toBe(true);

      expect(res.gasUsed).toBeLessThan(GAS_CEILING);

      rows.push({ len, gas: res.gasUsed, rawLen: rawSvg.length });
    }

    // eslint-disable-next-line no-console
    console.log('\\n=== image_data GETTER GAS TABLE (gate: < 3,000,000) ===');
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`len=${String(r.len).padStart(2)}  gas=${String(r.gas).padStart(10)}  image_dataBytes=${r.rawLen}  ${r.gas < GAS_CEILING ? 'OK' : 'OVER'}`);
    }

    // eslint-disable-next-line no-console
    console.log('LAYER: image_data=raw PATHS (fontless) — sole render source, verified all lengths');
  }, 120000);
});
