import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, Dictionary, contractAddress, toNano, TupleReader } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';

// Measurement harness for the on-chain PERCENT data-URI SVG image path.
// Deploys UsernameRegistry, calls get_nft_content via blockchain.runGetMethod with a
// high gas limit (so it completes for measurement), reads back gasUsed, and verifies
// the percent image round-trips to the raw image_data SVG bytes.
//
// The `image` metadata value is a percent data-URI ("data:image/svg+xml,<percent>"),
// NOT base64. Base64 made this getter cost ~3.3-5M gas (one table lookup per 3-byte
// group over the ~3KB SVG), risking tonapi's get-method gas limit -> blank in
// Tonkeeper. Percent is chunk-granular and cheap (~2M). HARD GATE: gas < 3,000,000
// for ALL valid lengths 4..16.

const PERCENT_PREFIX = 'data:image/svg+xml,';
const GAS_CEILING = 3_000_000n;

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

// Read a snake cell as raw bytes. If hasMarker, the first byte (null/0) is skipped.
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
    .storeUint(0x2e617468, 32) // ".ath"
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
    address: addr, code: init.code, data: init.data, balance: toNano('2'), workchain: 0,
  }));
  return { blockchain, addr };
}

function nameOfLength(n: number): string {
  // ascii lowercase, deterministic
  const base = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < n; i++) s += base[i % base.length];
  return s;
}

// Decode a percent-encoded URI body the way a browser / GetGems / decodeURIComponent
// would: turn each %XX into its byte, pass everything else through. The contract only
// emits %XX for the reserved set (space " # , / : < = > and never a literal %), so a
// straight percent decode is exact.
function percentDecode(s: string): string {
  return Buffer.from(s.replace(/%([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
}

describe('UsernameRegistry percent image gas measurement', () => {
  // Every valid length 4..16 (HARD GATE asserts < 3M across ALL of them).
  const lengths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

  it('MEASURE: get_nft_content gas per name length < 3M + percent round-trip', async () => {
    const { blockchain, addr } = await deployRegistry();
    const GAS_LIMIT = 1_000_000_000n; // very high so the getter always completes

    const rows: { len: number; gas: bigint; imgLen: number; rawLen: number }[] = [];

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

      const imageStr = readSnakeBytes(dict.get(metadataKey('image'))!, false).toString('utf8');
      const rawSvg = readSnakeBytes(dict.get(metadataKey('image_data'))!, true).toString('utf8');

      // image is a PERCENT data-URI, not base64.
      expect(imageStr.startsWith(PERCENT_PREFIX)).toBe(true);
      expect(imageStr.startsWith('data:image/svg+xml;base64,')).toBe(false);
      // percent-decode(image) == image_data, byte-for-byte.
      const decoded = percentDecode(imageStr.slice(PERCENT_PREFIX.length));
      expect(decoded).toBe(rawSvg);
      expect(rawSvg.startsWith('<svg')).toBe(true);
      expect(rawSvg.endsWith('</svg>')).toBe(true);

      // HARD GATE: getter gas must be well under the base64 ~5M ceiling.
      expect(res.gasUsed).toBeLessThan(GAS_CEILING);

      rows.push({ len, gas: res.gasUsed, imgLen: imageStr.length, rawLen: rawSvg.length });
    }

    // eslint-disable-next-line no-console
    console.log('\\n=== PERCENT GETTER GAS TABLE (gate: < 3,000,000) ===');
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`len=${String(r.len).padStart(2)}  gas=${String(r.gas).padStart(10)}  rawSvgBytes=${r.rawLen}  imageUriBytes=${r.imgLen}  ${r.gas < GAS_CEILING ? 'OK' : 'OVER'}`);
    }

    // Explicit round-trip log for the constraint-required lengths.
    // eslint-disable-next-line no-console
    console.log('ROUNDTRIP lengths 4,5,6,16: percent-decode(image) == image_data: PASS');
  }, 120000);
});
