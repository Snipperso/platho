import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { readFileSync } from 'fs';

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
    .endCell()
    .hash()
    .toString('hex'));
}

function readSnakeText(cell: Cell, hasMarker = true): string {
  let current: Cell | null = cell;
  let first = true;
  const chunks: Buffer[] = [];
  while (current) {
    const slice = current.beginParse();
    if (first) {
      if (hasMarker) {
        expect(slice.loadUint(8)).toBe(0);
      }
      first = false;
    }
    chunks.push(slice.loadBuffer(Math.floor(slice.remainingBits / 8)));
    current = slice.remainingRefs > 0 ? slice.loadRef() : null;
  }
  return Buffer.concat(chunks).toString('utf8');
}

function percentDecode(s: string): string {
  return Buffer.from(s.replace(/%([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
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
  const deployer = await blockchain.treasury('render-deployer');
  const registryInit = await UsernameRegistry.init(
    fixtureAddress('RENDER_PLACEHOLDER_ATH_WALLET'),
    fixtureAddress('RENDER_ATH_MASTER'),
    fixtureAddress('RENDER_TREASURY'),
    false,
    0n,
    0n,
    deployer.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('5'),
    workchain: 0,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  for (const k of Object.keys(ART_PAYLOAD).map(Number).sort((a, b) => a - b)) {
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'UploadArt', key: BigInt(k), data: plainSnake(ART_PAYLOAD[String(k)]) });
  }
  return registry;
}

describe('UsernameRegistry collection-render', () => {
  for (const { username, label } of [
    { username: 'ab12', label: 'EPIC' },
    { username: 'plato', label: 'RARE' },
    { username: 'platho', label: 'COMMON' },
    { username: 'longusername1234', label: 'COMMON' },
  ]) {
    it(`RENDER-01: get_nft_content renders the ${label} on-chain SVG for "${username}"`, async () => {
      const registry = await deployRegistry();
      const content = await registry.getGetNftContent(nameHash(username), slimItemContent(username));

      const slice = content.beginParse();
      expect(slice.loadUint(8)).toBe(0);
      const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

      expect(readSnakeText(dict.get(metadataKey('name'))!)).toBe(`${username}.ath`);
      expect(readSnakeText(dict.get(metadataKey('description'))!)).toBe('Platho username');

      const svg = readSnakeText(dict.get(metadataKey('image_data'))!);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('linearGradient');
      expect(svg.includes('<text')).toBe(false);
      expect(svg.includes('font-family')).toBe(false);
      expect(svg).toContain('<path fill="#f4f7f5" transform="matrix(');

      expect(svg).toContain('<linearGradient id="teal" x1="0" y1="1" x2="1" y2="0">');
      expect(svg).not.toMatch(/id="teal"[^>]*gradientUnits="userSpaceOnUse"/);
      expect(svg).toContain('transform="matrix(0.160156 0 0 -0.160156 130 210)"');
      expect(svg).not.toContain('viewBox="0 0 512 512"');
      expect(svg).not.toContain('translate(0 512) scale(1 -1)');
      expect((svg.match(/<svg\b/g) ?? []).length).toBe(1);
      expect((svg.match(/<\/svg>/g) ?? []).length).toBe(1);

      expect(dict.get(metadataKey('image'))).toBeUndefined();
    });
  }

  it('RENDER-03: common 16-char username renders two rows of eight tiles', async () => {
    const registry = await deployRegistry();
    const content = await registry.getGetNftContent(nameHash('wwwwwwwwwwwwwwww'), slimItemContent('wwwwwwwwwwwwwwww'));
    const slice = content.beginParse();
    expect(slice.loadUint(8)).toBe(0);
    const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    const svg = readSnakeText(dict.get(metadataKey('image_data'))!);
    expect(svg.includes('<text')).toBe(false);
    expect(svg).toContain('x="164" y="372" width="80" height="80"');
    expect(svg).toContain('x="780" y="372" width="80" height="80"');
    expect(svg).toContain('x="164" y="464" width="80" height="80"');
    expect(svg).toContain('x="780" y="464" width="80" height="80"');
    expect((svg.match(/<path fill="#f4f7f5" transform="matrix\(/g) ?? []).length).toBe(16);
    expect(svg).toContain('<linearGradient id="teal" x1="0" y1="1" x2="1" y2="0">');
    expect(svg).toContain('transform="matrix(0.160156 0 0 -0.160156 130 210)"');
    expect(svg).not.toContain('viewBox="0 0 512 512"');

    expect(dict.get(metadataKey('image'))).toBeUndefined();
  });

  it('RENDER-02: rejects content whose name is too short to carry a 4..16 char username', async () => {
    const registry = await deployRegistry();
    const badName = beginCell().storeUint(0, 8).storeBuffer(Buffer.from('xy', 'ascii')).storeUint(0x2e617468, 32).endCell();
    const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    dict.set(metadataKey('name'), badName);
    const content = beginCell().storeUint(0, 8).storeDict(dict).endCell();
    await expect(registry.getGetNftContent(nameHash('xy'), content)).rejects.toThrow();
  });
});
