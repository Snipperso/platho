import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, Dictionary, contractAddress, toNano, TupleReader } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { readFileSync } from 'fs';

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

// Option B: glyph/static art parts live in the `art` dict (uploaded at genesis). The
// gas measurement reflects get_nft_content reading them via cell.asSlice().asString().
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
    address: addr, code: init.code, data: init.data, balance: toNano('5'), workchain: 0,
  }));
  // Upload all art parts as the genesis controller (deployer) so image_data renders the glyphs.
  const registry = blockchain.openContract(new UsernameRegistry(addr, init));
  for (const k of Object.keys(ART_PAYLOAD).map(Number).sort((a, b) => a - b)) {
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'UploadArt', key: BigInt(k), data: plainSnake(ART_PAYLOAD[String(k)]) });
  }
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

  it('MEASURE: get_nft_content gas per name length < 3M + text/paths layer split', async () => {
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

      // REGRESSION GUARD (TEP-64): EVERY on-chain content value MUST begin with the
      // 0x00 snake marker. A missing marker on `image` (the beginString regression)
      // is neither snake (0x00) nor chunked (0x01), so tonapi / GetGems / Tonkeeper
      // reject the ENTIRE content dict -> blank metadata. Assert it on every value.
      for (const key of ['name', 'description', 'image', 'image_data'] as const) {
        const valueCell = dict.get(metadataKey(key));
        expect(valueCell, `metadata value ${key} present`).toBeTruthy();
        expect(valueCell!.beginParse().loadUint(8), `${key} TEP-64 0x00 snake marker`).toBe(0);
      }

      const imageStr = readSnakeBytes(dict.get(metadataKey('image'))!, true).toString('utf8');
      const rawSvg = readSnakeBytes(dict.get(metadataKey('image_data'))!, true).toString('utf8');

      // image is a PERCENT data-URI, not base64.
      expect(imageStr.startsWith(PERCENT_PREFIX)).toBe(true);
      expect(imageStr.startsWith('data:image/svg+xml;base64,')).toBe(false);
      // ARCHITECTURE (text-as-paths render fix): the two image layers are now
      // DIFFERENT by design (no longer a byte-for-byte round-trip):
      //   image      = percent data-URI, TEXT SVG  -> GetGems / browsers / Plato app
      //                render it with their system fonts (proven working).
      //   image_data = raw, PATHS SVG (Arimo glyph outlines) -> tonapi / Tonkeeper
      //                rasterize it WITHOUT system fonts, so every glyph is a vector
      //                <path> and renders correctly (text-as-text would be tofu).
      const decodedImage = percentDecode(imageStr.slice(PERCENT_PREFIX.length));
      expect(decodedImage.startsWith('<svg')).toBe(true);
      expect(decodedImage.endsWith('</svg>')).toBe(true);
      // image (browser text layer): keeps <text> + Arial font-family.
      expect(decodedImage.includes('<text')).toBe(true);
      expect(decodedImage.includes('font-family="Arial')).toBe(true);
      // image_data (fontless paths layer): NO <text>, NO font-family — pure outlines.
      expect(rawSvg.startsWith('<svg')).toBe(true);
      expect(rawSvg.endsWith('</svg>')).toBe(true);
      expect(rawSvg.includes('<text')).toBe(false);
      expect(rawSvg.includes('font-family')).toBe(false);
      expect(rawSvg.includes('<path')).toBe(true);

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

    // eslint-disable-next-line no-console
    console.log('LAYERS: image=percent TEXT (browser fonts), image_data=raw PATHS (fontless) — verified all lengths');
  }, 120000);
});
