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
    expect(artifact.fields).toEqual({
      name: 'Platho ATH',
      symbol: 'ATH',
      decimals: '9',
      description: 'Utility token of the Platho communication protocol.',
      deployment_id: 'platho-mainnet-20260608-clean-04',
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0].equals(content)).toBe(true);
    expect(content.hash().toString('hex')).toBe(artifact.contentHashHex);
    expect(artifact.contentHashHex).toBe('2bd5a2a31ae443cd1c1b812ae7a255ed556fa22b3b391082c3593cca99067816');

    const slice = content.beginParse();
    expect(slice.loadUint(8)).toBe(0);
    const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    expect(dict.size).toBe(5);
  });
});
