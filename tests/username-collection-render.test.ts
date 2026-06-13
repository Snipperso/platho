import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';

// V2 collection-render: the per-item SVG art was moved out of UsernameNFTItem and into the
// UsernameRegistry.get_nft_content renderer (TEP-62 "collection completes the item partial content").
// The item now carries only a slim { name, description } content; the registry adds image + image_data.

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

function readSnakeText(cell: Cell): string {
  let current: Cell | null = cell;
  let first = true;
  const chunks: Buffer[] = [];
  while (current) {
    const slice = current.beginParse();
    if (first) {
      expect(slice.loadUint(8)).toBe(0);
      first = false;
    }
    chunks.push(slice.loadBuffer(Math.floor(slice.remainingBits / 8)));
    current = slice.remainingRefs > 0 ? slice.loadRef() : null;
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Faithful replica of the slimmed UsernameNFTItem.individualContent(): { marker:0, { name, description } }.
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
    balance: toNano('2'),
    workchain: 0,
  }));
  return blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
}

describe('UsernameRegistry collection-render', () => {
  // epic (4), rare (5), common single-row (<=8), and common two-row (max 16).
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
      expect(slice.loadUint(8)).toBe(0); // TEP-64 on-chain marker
      const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

      // The collection ADDS image + image_data; name/description pass through from the item.
      expect(readSnakeText(dict.get(metadataKey('name'))!)).toBe(`${username}.ath`);
      expect(readSnakeText(dict.get(metadataKey('description'))!)).toBe('Platho username');

      const svg = readSnakeText(dict.get(metadataKey('image_data'))!);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('linearGradient');
      expect(svg).toContain(label);                  // tier badge
      expect(svg).toContain('PLATHO USERNAME');
      expect(svg).toContain(`${username}.ath`);      // rendered username line
      for (const ch of new Set(username)) {
        expect(svg).toContain(`>${ch}</text>`);      // per-character tile
      }

      const imageUri = readSnakeText(dict.get(metadataKey('image'))!);
      expect(imageUri.startsWith('data:image/svg+xml,')).toBe(true);
      expect(imageUri).not.toMatch(/^https?:|^ipfs:/);
    });
  }

  it('RENDER-03: common 16-char username renders two rows of eight tiles', async () => {
    const registry = await deployRegistry();
    const content = await registry.getGetNftContent(nameHash('wwwwwwwwwwwwwwww'), slimItemContent('wwwwwwwwwwwwwwww'));
    const slice = content.beginParse();
    expect(slice.loadUint(8)).toBe(0);
    const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    const svg = readSnakeText(dict.get(metadataKey('image_data'))!);

    expect(svg).toContain('COMMON');
    expect(svg).toContain('wwwwwwwwwwwwwwww.ath');
    expect((svg.match(/>w<\/text>/g) ?? []).length).toBe(16);
    expect(svg).toContain('x="164" y="372" width="80" height="80"'); // top-left tile
    expect(svg).toContain('x="780" y="372" width="80" height="80"'); // top-right tile
    expect(svg).toContain('x="164" y="464" width="80" height="80"'); // bottom-left tile
    expect(svg).toContain('x="780" y="464" width="80" height="80"'); // bottom-right tile
  });

  it('RENDER-02: rejects content whose name is too short to carry a 4..16 char username', async () => {
    const registry = await deployRegistry();
    // name = "xy.ath" -> username "xy" (2 chars) must be rejected (19353)
    const badName = beginCell().storeUint(0, 8).storeBuffer(Buffer.from('xy', 'ascii')).storeUint(0x2e617468, 32).endCell();
    const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    dict.set(metadataKey('name'), badName);
    const content = beginCell().storeUint(0, 8).storeDict(dict).endCell();
    await expect(registry.getGetNftContent(nameHash('xy'), content)).rejects.toThrow();
  });
});
