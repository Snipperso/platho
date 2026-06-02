import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { runUsernameRegistryStorageEconomics } from '../scripts/username_registry_storage_economics';

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function currentCodeHashes(): Record<string, string> {
  return Object.fromEntries(readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const [key, value] = line.split('=', 2);
      return [key, value];
    }));
}

describe('UsernameRegistry storage economics', () => {
  it('USERNAME-STORAGE-01: mint/refund/item paths retain the modeled permanent endowments', async () => {
    const report = await runUsernameRegistryStorageEconomics(false);

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.username_registry).toBe(currentCodeHashes().USERNAME_REGISTRY_CODE_HASH);
    expect(report.code_hashes.username_nft_item).toBe(currentCodeHashes().USERNAME_NFT_ITEM_CODE_HASH);
    expect(report.cases.map((item) => item.label)).toEqual([
      'SUCCESS_4_CHAR',
      'SUCCESS_5_CHAR',
      'SUCCESS_6_PLUS',
      'REJECTED_NEW_REFUND_DUE',
      'REJECTED_EXISTING_REFUND_DUE',
      'ITEM_DEPLOY_BOUNCE_REFUND_REQUEST',
      'ITEM_RESEND_ACK_CALLER_FUNDED',
      'ITEM_TRANSFER_EXACT_MIN',
      'ITEM_TRANSFER_WITH_FORWARD',
    ]);

    for (const item of report.cases) {
      if (BigInt(item.expected_registry_endowment_nanotons) > 0n) {
        expect(BigInt(item.retained_margin_vs_registry_endowment_nanotons), item.label)
          .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
      } else {
        expect(BigInt(item.retained_margin_vs_registry_endowment_nanotons), item.label)
          .toBeGreaterThanOrEqual(0n);
      }
      if (BigInt(item.expected_item_floor_nanotons) > 0n) {
        expect(BigInt(item.item_margin_vs_floor_nanotons), item.label)
          .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
      } else {
        expect(BigInt(item.item_margin_vs_floor_nanotons), item.label)
          .toBeGreaterThanOrEqual(0n);
      }
    }
  }, 30000);

  it('USERNAME-STORAGE-02: checked artifact is tied to current UsernameRegistry and UsernameNFTItem code hashes', () => {
    const report = readJson('artifacts/username_registry_storage_economics_report.json');
    const hashes = currentCodeHashes();

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.username_registry).toBe(hashes.USERNAME_REGISTRY_CODE_HASH);
    expect(report.code_hashes.username_nft_item).toBe(hashes.USERNAME_NFT_ITEM_CODE_HASH);
    expect(BigInt(report.constants.minimum_storage_margin_nanotons)).toBe(1_000_000n);
    expect(BigInt(report.worst_registry_margin_nanotons))
      .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
    expect(BigInt(report.worst_item_margin_nanotons))
      .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
  });
});
