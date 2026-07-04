import { describe, expect, it } from 'vitest';
import { Address, Dictionary, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { buildMetaParts, readSnakeString } from '../scripts/mainnet_upload_collection_meta';

// End-to-end proof that the CEREMONY uploader's cells (scripts/mainnet_upload_collection_meta.ts) are byte-for-byte
// correct against the IMMUTABLE contract: build the real 3 parts (description + avatar + the multi-cell banner),
// UploadCollectionMeta -> SealCollectionMeta -> get_collection_data, and assert the TEP-64 dict round-trips every
// value. The banner is genuinely ~50 cells, so this pins the verbatim-serve (metaCell) against truncation.

const metaKey = (s: string) => BigInt('0x' + createHash('sha256').update(s).digest('hex'));
const fixtureAddress = (label: string) => new Address(0, createHash('sha256').update(`PLATHO.META.${label}`).digest());

describe('UsernameRegistry clean-11 collection metadata (real ceremony content)', () => {
  it('USERNAME-META-01: ceremony uploader parts round-trip byte-for-byte through upload -> seal -> get_collection_data (incl. multi-cell banner)', async () => {
    const parts = buildMetaParts();
    expect(parts.map((p) => Number(p.key))).toEqual([1, 2, 3]);
    // the banner MUST be multi-cell — otherwise this wouldn't exercise the verbatim-serve truncation hazard
    expect(parts[2].cell.refs.length).toBeGreaterThan(0);
    for (const p of parts) expect(readSnakeString(p.cell)).toBe(p.content); // builder self-consistency

    const bc = await Blockchain.create();
    bc.now = 1_700_000_000;
    const deployer = await bc.treasury('meta-deployer'); // = genesis controller
    const init = await UsernameRegistry.init(
      fixtureAddress('PLACEHOLDER_ATH'), fixtureAddress('ATH_MASTER'), fixtureAddress('TREASURY'),
      false, 0n, 0n, deployer.address,
    );
    const addr = contractAddress(0, init);
    await bc.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('2'), workchain: 0 }));
    const registry = bc.openContract(new UsernameRegistry(addr, init));

    // get_collection_data reverts (19360) until sealed.
    await expect(registry.getGetCollectionData()).rejects.toThrow(/19360/);

    for (const p of parts) {
      await registry.send(deployer.getSender(), { value: toNano('0.3') }, { $$type: 'UploadCollectionMeta', key: p.key, data: p.cell });
    }
    expect(await registry.getGetMetaCount()).toBe(3n);
    await registry.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'SealCollectionMeta' });
    expect(await registry.getGetMetaSealed()).toBe(true);

    const collection = await registry.getGetCollectionData();
    const cs = collection.collection_content.beginParse();
    expect(cs.loadUint(8)).toBe(0); // TEP-64 on-chain marker
    const dict = cs.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

    expect(readSnakeString(dict.get(metaKey('name'))!)).toBe('Platho usernames');
    expect(readSnakeString(dict.get(metaKey('description'))!)).toBe(parts[0].content);
    const image = readSnakeString(dict.get(metaKey('image'))!);
    expect(image).toBe(parts[1].content);
    expect(image.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const cover = readSnakeString(dict.get(metaKey('cover_image'))!);
    expect(cover).toBe(parts[2].content); // multi-cell banner survives the verbatim serve byte-for-byte
    expect(cover.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
