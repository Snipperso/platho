import { Cell, Dictionary } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  buildAthMetadataArtifact,
  buildAthMetadataContent,
} from '../scripts/generate_ath_metadata_content';

describe('ATH metadata content artifact', () => {
  it('pins deterministic TEP-64 on-chain metadata for ATHMaster content', () => {
    const artifact = buildAthMetadataArtifact();
    const content = buildAthMetadataContent();
    const parsed = Cell.fromBoc(Buffer.from(artifact.contentBocBase64, 'base64'));

    expect(artifact.document).toBe('PLATHO.V1.ATH_METADATA_CONTENT');
    expect(artifact.format).toBe('TEP64_ONCHAIN_METADATA');
    expect(artifact.fields.name).toBe('PLATHO');
    expect(artifact.fields.symbol).toBe('ATH');
    expect(artifact.fields.decimals).toBe('9');
    expect(artifact.fields.deployment_id).toBe('platho-mainnet-20260706-clean-14');
    expect(artifact.fields.description).toContain('The utility token of Platho');
    expect(artifact.fields.description.endsWith('https://platho.app')).toBe(true);
    expect(artifact.fields.image).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].equals(content)).toBe(true);
    expect(content.hash().toString('hex')).toBe(artifact.contentHashHex);
    expect(artifact.contentHashHex).toBe('459c23c452a35c8a55bdfe3cfdf24fed7297a9e148e199fa6ed50f45f38988ef');

    const slice = content.beginParse();
    expect(slice.loadUint(8)).toBe(0);
    const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    expect(dict.size).toBe(6);
  });
});
