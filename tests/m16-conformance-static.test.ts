import { describe, expect, it } from 'vitest';
import { Cell } from '@ton/core';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildImplementedSubsetManifest, computeManifestCell } from '../scripts/deployment_manifest_m15';

const productionContracts = [
  'ATHMaster.tact',
  'ATHVesting.tact',
  'ATHWallet.tact',
  'BuybackBurn.tact',
  'CapsuleHub.tact',
  'FeeAccumulator.tact',
  'MarketStabilitySeller.tact',
  'ProfileRegistry.tact',
  'UsernameNFTItem.tact',
  'UsernameRegistry.tact',
  'Vault.tact',
];

const storageTopUpReceivers: Array<[string, string]> = [
  ['ATHVesting.tact', 'ATHVestingTopUpStorageReserve'],
  ['BuybackBurn.tact', 'TopUpStorageReserve'],
  ['CapsuleHub.tact', 'TopUpStorageReserve'],
  ['FeeAccumulator.tact', 'TopUpStorageReserve'],
  ['MarketStabilitySeller.tact', 'MarketStabilityTopUpStorageReserve'],
  ['ProfileRegistry.tact', 'ProfileRegistryTopUpStorageReserve'],
  ['UsernameNFTItem.tact', 'TopUpStorageReserve'],
  ['UsernameRegistry.tact', 'UsernameRegistryTopUpStorageReserve'],
  ['Vault.tact', 'TopUpStorageReserve'],
];

function file(path: string): string {
  return readFileSync(path, 'utf8');
}

function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function contractSource(name: string): string {
  return stripLineComments(file(join('contracts', name)));
}

function contractEntrypointBlock(source: string, marker: string): string {
  const start = source.indexOf(marker);
  expect(start, `${marker} must exist`).toBeGreaterThanOrEqual(0);
  const nextMarkers = [
    source.indexOf('\n    external(msg:', start + marker.length),
    source.indexOf('\n    receive(msg:', start + marker.length),
    source.indexOf('\n    bounced(msg:', start + marker.length),
    source.indexOf('\n    get fun ', start + marker.length),
  ].filter((index) => index >= 0);
  const end = nextMarkers.length > 0 ? Math.min(...nextMarkers) : source.length;
  return source.slice(start, end);
}

function compiledVaultPreAcceptBlock(source: string, entrypoint: string): string {
  const marker = `;; Receive ${entrypoint} message`;
  const start = source.indexOf(marker);
  expect(start, `${marker} must exist in compiled Vault FunC`).toBeGreaterThanOrEqual(0);
  const accept = source.indexOf('$global_acceptMessage();', start);
  expect(accept, `${entrypoint} must call acceptMessage in compiled Vault FunC`).toBeGreaterThan(start);
  return source.slice(start, accept);
}

function compiledFunCLines(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(';;'));
}

function compiledPreAcceptWeight(line: string): number {
  let weight = 1;
  if (/__tact_context_get\(/.test(line)) weight += 8;
  if (/__tact_verify_address\(/.test(line)) weight += 5;
  if (/__tact_address_eq\(/.test(line)) weight += 4;
  if (/__tact_not_null\(/.test(line)) weight += 3;
  if (/__tact_dict_get/.test(line)) weight += 22;
  if (/~?load_msg_addr\(/.test(line)) weight += 8;
  if (/~?load_ref\(/.test(line)) weight += 8;
  if (/~?load_bits\(/.test(line)) weight += 6;
  if (/~?load_uint\(/.test(line)) weight += 3;
  if (/~?load_int\(/.test(line)) weight += 3;
  if (/cell_hash\(/.test(line)) weight += 20;
  if (/slice_hash\(/.test(line)) weight += 18;
  if (/checkSignature|check_signature/.test(line)) weight += 70;
  if (/throw_unless\(/.test(line)) weight += 2;
  if (/throw_if\(/.test(line)) weight += 2;
  if (/my_address\(/.test(line)) weight += 5;
  return weight;
}

function builtCodeHash(contractDir: string, artifactName: string): string {
  const boc = readFileSync(join('build', contractDir, `${artifactName}.code.boc`));
  return Cell.fromBoc(boc)[0].hash().toString('hex');
}

function artifactHash(name: string): string {
  return file(join('artifacts', name)).trim();
}

describe('M16 production conformance static checks', () => {
  it('M16-CONF-01: production contracts contain no ignored-error send mode, session-spender contract, or rescue/governance/admin-control message surface', () => {
    const forbidden = [
      /SendIgnoreErrors/,
      /ignored[-_ ]error/i,
      /MessageSession/,
      /SessionSpender/,
      /session[-_ ]spender/i,
      /message\s*\([^)]*\)\s*(Admin|OwnerOverride|Pause|Upgrade|Governance|Rescue|Fallback)/,
      /const\s+OP_(ADMIN|OWNER_OVERRIDE|PAUSE|UPGRADE|GOVERNANCE|RESCUE|FALLBACK)\b/,
    ];

    for (const contract of productionContracts) {
      const source = contractSource(contract);
      for (const pattern of forbidden) {
        expect(source, `${contract} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('M16-CONF-01B: production runtime contains no legacy message-budget or wallet-funded publish surface', () => {
    const runtimeFiles = [
      ...productionContracts.map((name) => join('contracts', name)),
      join('web', 'app.js'),
      join('web', 'pwa-contract-transactions.mjs'),
      join('web', 'vault-chain-provider.mjs'),
      join('web', 'vault-ton-rpc-provider.mjs'),
      join('scripts', 'deployment_manifest_m15.ts'),
      join('scripts', 'mainnet_genesis_verify.ts'),
    ];
    const forbidden = [
      /message_budget_ton/,
      /TopUpMessageBudget/,
      /budget_epoch/,
      /SetSession/,
      /RevokeSession/,
      /PublishPrivateFromWallet/,
      /PublishPublicFromWallet/,
    ];

    for (const runtimeFile of runtimeFiles) {
      const source = stripLineComments(file(runtimeFile));
      for (const pattern of forbidden) {
        expect(source, `${runtimeFile} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('M16-CONF-01B2: Vault-auth service external payloads bind manifest, Vault, and owner domains', () => {
    const vault = contractSource('Vault.tact');
    // All hash-bound externals still bind manifest + Vault-address hash pre-accept. Owner-domain binding
    // differs by entrypoint after the receive-intent pre-accept-gas restructure (publish-external pattern):
    //  - ReplaceMessagingKeys: signed owner hash bound pre-accept (room in the 10k credit).
    //  - CreateReceiveIntent: signed owner hash re-validated POST-accept (re-parse), since binding it pre-accept
    //    pushes the external over the 10k pre-accept credit; sig-authenticated so a mismatch reverts cleanly.
    //  - Claim/Cancel ReceiveIntent: owner-domain separation enforced by the intent's recipient_wallet /
    //    sender_wallet equality check (the signed owner hash is skipped pre-accept to fit the credit).
    const hashBoundEntrypoints = [
      'CreateReceiveIntent',
      'ClaimReceiveIntent',
      'CancelReceiveIntent',
      'ReplaceMessagingKeys',
    ];
    const addressBoundEntrypoints = [
      'WithdrawTonFromVaultBalance',
      'WithdrawAthFromVaultBalance',
      'SetProfileAvatarFromVaultBalance',
      'MintUsernameFromVaultBalance',
    ];

    for (const entrypoint of hashBoundEntrypoints) {
      const block = contractEntrypointBlock(vault, `external(msg: ${entrypoint})`);
      expect(block, `${entrypoint} must verify deployment manifest`).toMatch(/signedManifestHash[\s\S]*self\.deployment_manifest_hash/);
      expect(block, `${entrypoint} signed payload must include Vault address hash`).toMatch(/signedVaultHash:\s*Int\s*=\s*signedPayload\.loadUint\(256\)/);
      expect(block, `${entrypoint} signed Vault hash must match current Vault`).toMatch(/signedVaultHash\s*==\s*vaultAddressSlice\.loadUint\(256\)/);
    }

    // ReplaceMessagingKeys keeps the pre-accept signed-owner-hash binding.
    {
      const block = contractEntrypointBlock(vault, 'external(msg: ReplaceMessagingKeys)');
      expect(block, 'ReplaceMessagingKeys signed payload must include owner wallet hash').toMatch(/signedOwnerHash:\s*Int\s*=\s*signedPayload\.loadUint\(256\)/);
      expect(block, 'ReplaceMessagingKeys signed owner hash must match outer owner').toMatch(/signedOwnerHash\s*==\s*ownerPrefix\.loadUint\(256\)/);
    }

    // CreateReceiveIntent re-validates the signed owner hash post-accept against the outer owner wallet.
    {
      const block = contractEntrypointBlock(vault, 'external(msg: CreateReceiveIntent)');
      expect(block, 'CreateReceiveIntent must re-parse the signed owner hash post-accept').toMatch(/createOwnerReparse:\s*Slice\s*=\s*msg\.signed_payload\.beginParse\(\)/);
      expect(block, 'CreateReceiveIntent post-accept owner binding must compare signed owner hash to outer owner').toMatch(/createOwnerReparse\.loadUint\(256\)\s*==\s*createOwnerSlice\.loadUint\(256\)/);
    }

    // Claim/Cancel ReceiveIntent enforce owner domain via the stored intent's recipient/sender wallet.
    {
      const claim = contractEntrypointBlock(vault, 'external(msg: ClaimReceiveIntent)');
      expect(claim, 'ClaimReceiveIntent must enforce owner domain via intent.recipient_wallet').toMatch(/intent\.recipient_wallet/);
      const cancel = contractEntrypointBlock(vault, 'external(msg: CancelReceiveIntent)');
      expect(cancel, 'CancelReceiveIntent must enforce owner domain via intent.sender_wallet').toMatch(/intent\.sender_wallet/);
    }

    for (const entrypoint of addressBoundEntrypoints) {
      const block = contractEntrypointBlock(vault, `external(msg: ${entrypoint})`);
      expect(block, `${entrypoint} must verify deployment manifest`).toMatch(/signedManifestHash[\s\S]*self\.deployment_manifest_hash/);
      expect(block, `${entrypoint} signed payload must include owner wallet`).toMatch(/signedOwner:\s*Address\s*=\s*signedPayload\.loadAddress\(\)/);
      expect(block, `${entrypoint} signed owner must match outer owner`).toMatch(/signedOwner\s*==\s*msg\.owner_wallet/);
      expect(block, `${entrypoint} signed payload must include Vault address`).toMatch(/signedVaultAddress:\s*Address\s*=\s*signedPayload\.loadAddress\(\)/);
      expect(block, `${entrypoint} signed Vault must match current Vault`).toMatch(/signedVaultAddress\s*==\s*myAddress\(\)/);
    }
  });

  it('M16-CONF-01B3: Vault-balance publish avoids full budget checks before acceptMessage', () => {
    const vault = contractSource('Vault.tact');
    const publishEntrypoints: string[] = [];

    for (const entrypoint of publishEntrypoints) {
      const block = contractEntrypointBlock(vault, `external(msg: ${entrypoint})`);
      const acceptIndex = block.indexOf('acceptMessage();');
      expect(acceptIndex, `${entrypoint} must accept after auth gates`).toBeGreaterThanOrEqual(0);
      const preAccept = block.slice(0, acceptIndex);
      const postAccept = block.slice(acceptIndex);
      expect(preAccept, `${entrypoint} must not compare full maxCharge before accept`).not.toMatch(/user\.ton_balance\s*>=\s*maxCharge/);
      expect(preAccept, `${entrypoint} must not compare maxCharge to local reserve before accept`).not.toMatch(/maxCharge\s*>=\s*localExecReserve/);
      expect(preAccept, `${entrypoint} must still require local reserve backing before accept`).toMatch(/user\.ton_balance\s*>=\s*localExecReserve/);
      expect(postAccept, `${entrypoint} must gate CapsuleHub send on remaining publish budget`).toMatch(/remainingCharge:\s*Int\s*=\s*maxCharge\s*-\s*localExecReserve[\s\S]*user\.ton_balance\s*>=\s*remainingCharge/);
    }
  });

  it('M16-CONF-01B4: Vault external pre-accept FunC stays inside the audited gas envelope', () => {
    const vaultFunC = file(join('build', 'Vault', 'Vault_Vault.fc'));
    const budgets = [
      { entrypoint: 'WithdrawTonFromVaultBalance', maxLines: 25, maxWeight: 168, maxDictReads: 1 },
      { entrypoint: 'WithdrawAthFromVaultBalance', maxLines: 25, maxWeight: 168, maxDictReads: 1 },
      { entrypoint: 'ReplaceMessagingKeys', maxLines: 32, maxWeight: 201, maxDictReads: 1 },
      { entrypoint: 'CreateReceiveIntent', maxLines: 28, maxWeight: 192, maxDictReads: 1 },
      { entrypoint: 'ClaimReceiveIntent', maxLines: 33, maxWeight: 229, maxDictReads: 2 },
      { entrypoint: 'CancelReceiveIntent', maxLines: 31, maxWeight: 222, maxDictReads: 2 },
      { entrypoint: 'SetProfileAvatarFromVaultBalance', maxLines: 26, maxWeight: 172, maxDictReads: 1 },
      { entrypoint: 'MintUsernameFromVaultBalance', maxLines: 26, maxWeight: 172, maxDictReads: 1 },
    ];

    for (const budget of budgets) {
      const block = compiledVaultPreAcceptBlock(vaultFunC, budget.entrypoint);
      const lines = compiledFunCLines(block);
      const weight = lines.reduce((sum, line) => sum + compiledPreAcceptWeight(line), 0);
      const dictReads = lines.filter((line) => /__tact_dict_get/.test(line)).length;
      const signatureChecks = lines.filter((line) => /checkSignature|check_signature/.test(line)).length;
      const stateWrites = lines.filter((line) => /__tact_dict_set|global_commit|send_raw_message|__tact_send/.test(line));
      const builders = lines.filter((line) => /\bbegin_cell\(/.test(line));

      expect(lines.length, `${budget.entrypoint} pre-accept compiled line count changed`).toBeLessThanOrEqual(budget.maxLines);
      expect(weight, `${budget.entrypoint} pre-accept compiled weight changed`).toBeLessThanOrEqual(budget.maxWeight);
      expect(dictReads, `${budget.entrypoint} pre-accept dictionary reads changed`).toBeLessThanOrEqual(budget.maxDictReads);
      expect(signatureChecks, `${budget.entrypoint} must keep exactly one auth signature check before accept`).toBe(1);
      expect(stateWrites, `${budget.entrypoint} must not mutate state or send messages before accept`).toHaveLength(0);
      expect(builders, `${budget.entrypoint} must not build cells before accept`).toHaveLength(0);
    }
  });

  it('M16-CONF-01B5: receive-intent externals keep owner and Vault binding hash-only before acceptMessage', () => {
    const vaultFunC = file(join('build', 'Vault', 'Vault_Vault.fc'));
    const receiveIntentEntrypoints = [
      'CreateReceiveIntent',
      'ClaimReceiveIntent',
      'CancelReceiveIntent',
    ];

    for (const entrypoint of receiveIntentEntrypoints) {
      const block = compiledVaultPreAcceptBlock(vaultFunC, entrypoint);
      expect(block, `${entrypoint} must not re-add a pre-accept owner basechain throw`).not.toMatch(/ownerPrefix~load_uint\(11\)\s*==\s*1024/);
      expect(block, `${entrypoint} must not re-add a pre-accept Vault basechain throw`).not.toMatch(/vaultAddressPrefix\s*==\s*1024/);
      // Vault address is still hash-bound pre-accept (target-Vault binding cannot be deferred).
      expect(block, `${entrypoint} must still hash-bind signed Vault address before accept`).toMatch(/signedVaultHash[\s\S]*vaultAddressSlice~load_uint\(256\)/);
      // The signed owner hash is NOT equality-bound pre-accept anymore: it is skipped to fit the 10k pre-accept
      // gas credit, and owner-domain is enforced after accept (re-parse for Create; intent.recipient/sender
      // wallet for Claim/Cancel). Guard that no owner-hash equality comparison creeps back into the pre-accept
      // block, while a single skip of the 256-bit owner hash remains.
      expect(block, `${entrypoint} must skip the owner hash slot before accept`).toMatch(/skip_bits\(256\)|256\)/);
      expect(block, `${entrypoint} must not equality-bind the signed owner hash before accept`).not.toMatch(/signedOwnerHash[\s\S]*ownerPrefix~load_uint\(256\)/);
    }
  });

  it('M16-CONF-01C: production docs do not reference stale ATH distribution or seller gates', () => {
    const productionDocs = [
      join('PRODUCTION_READINESS.md'),
      join('MAINNET_RELEASE_CHECKLIST.md'),
      join('DEPLOYMENT_RUNBOOK.md'),
      join('web', 'docs', 'ath-whitepaper.md'),
      join('web', 'docs', 'crypto-protocol.md'),
      join('web', 'CRYPTO_PROTOCOL.md'),
      join('artifacts', 'platho_v1_open_values_v0_49_final_tokenomics_market_stability.md'),
      join('artifacts', 'platho_v1_open_values_v0_20y_activity_airdrop_15pct_tokenomics.md'),
    ];
    const forbidden = [
      /\b45M ATH\b/,
      /\b45,000,000 ATH\b/,
      /30%\s+activity airdrop/i,
      /activity_airdrop_30pct/i,
      /M20Y_ACTIVITY_AIRDROP_30PCT/i,
      /founder/i,
      /x2\.\.x16/i,
      /\bx16\b.*tranche/i,
      /airdrop remaining\s+`?<=\s*15M ATH`?/i,
      /half of the final `15,000,000 ATH` activity airdrop allocation/i,
      /remaining `15,000,000 ATH` activity airdrop allocation continues/i,
      /allocated across activity, liquidity, treasury, and market stability/i,
      /embedded Platho wallet seed/i,
      /Platho wallet seed/i,
    ];
    const activityBonusDocs = new Set([
      join('PRODUCTION_READINESS.md'),
      join('MAINNET_RELEASE_CHECKLIST.md'),
      join('DEPLOYMENT_RUNBOOK.md'),
      join('web', 'docs', 'ath-whitepaper.md'),
      join('artifacts', 'platho_v1_open_values_v0_20y_activity_airdrop_15pct_tokenomics.md'),
    ]);

    for (const productionDoc of productionDocs) {
      const source = file(productionDoc);
      expect(source, `${productionDoc} must stay English-only`).not.toMatch(/[\u0400-\u04FF]/);
      if (activityBonusDocs.has(productionDoc)) {
        expect(source, `${productionDoc} must define ATH rewards as activity bonus`).toMatch(/activity bonus/i);
        expect(source, `${productionDoc} must reject refund/cashback framing`).toMatch(/not (a )?(TON )?refund|not a refund/i);
        expect(source, `${productionDoc} must reject investment framing`).toMatch(/investment return|profit expectation|profit promise|price guarantee/i);
      }
      const isMarketStabilityDoc = productionDoc.endsWith('PRODUCTION_READINESS.md')
        || productionDoc.endsWith('DEPLOYMENT_RUNBOOK.md')
        || productionDoc.endsWith(join('docs', 'ath-whitepaper.md'))
        || productionDoc.endsWith('platho_v1_open_values_v0_49_final_tokenomics_market_stability.md');
      if (isMarketStabilityDoc) {
        expect(source).toMatch(/pricing freeze is a real one-time launch authority/i);
        expect(source).toMatch(/60,000,000 ATH|60M/);
        expect(source).toMatch(/x2[\s\S]*x21|x2\.\.x21/i);
      }
      if (source.includes('reserve_due_ath')) {
        expect(source).toMatch(/reserve_funded_total_ath/);
        expect(source).toMatch(/official (seller )?(ATH )?wallet (backs at least|balance above)/i);
        expect(source).toMatch(/readiness warning|warning/i);
        expect(source).toMatch(/can remain stuck/i);
      }
      if (productionDoc.endsWith('PRODUCTION_READINESS.md')) {
        expect(source).toMatch(/Canonical ATH Tokenomics/);
        expect(source).toMatch(/15,000,000 ATH` activity airdrop/);
        expect(source).toMatch(/15,000,000 ATH` initial ATH\/TON liquidity/);
        expect(source).toMatch(/10,000,000 ATH` long-term protocol vesting reserve/);
        expect(source).toMatch(/100,000 ATH` per 365-day period/);
        expect(source).toMatch(/60,000,000 ATH` MarketStabilitySeller reserve/);
        expect(source).toMatch(/20` tranches of `3,000,000 ATH`, from `x2` through `x21`/);
        expect(source).toMatch(/obsolete tokenomics brief/);
        expect(source).toMatch(/CapsuleHub v1 accepts retrievable publish body cells/);
        expect(source).toMatch(/body_hash[\s\S]*accepted publish transaction body/);
        expect(source).toMatch(/verified mainnet manifest/);
        expect(source).toMatch(/must be pinned to the verified mainnet manifest/);
        const genesisVerified = readFileSync('artifacts/MAINNET_GENESIS_VERIFIED.txt', 'utf8').trim().toLowerCase() === 'true';
        if (genesisVerified) {
          expect(source).toMatch(/is pinned now and must be pinned to the verified mainnet manifest/);
          expect(source).not.toMatch(/current archive may still be preview-blocked/i);
        } else {
          expect(source).toMatch(/current archive may still be preview-blocked/i);
          expect(source).not.toMatch(/is pinned to the verified mainnet manifest/);
        }
        expect(source).not.toMatch(/a26530cd84ff29b49e3e305eedeead677584ac335277d92cfddb33b665265cdd/);
        expect(source).toMatch(/must remain untracked and absent from release\/audit archives/);
        expect(source).not.toMatch(/points the UI at testnet preview data/);
        expect(source).not.toMatch(/\.env\.testnet\.local exists for faucet\/testnet work/);
        expect(source).not.toMatch(/counter-only \/ anchor-only/);
      }
      if (productionDoc.endsWith('DEPLOYMENT_RUNBOOK.md')) {
        expect(source).toMatch(/Canonical ATH tokenomics for auditors/);
        expect(source).toMatch(/`15M` activity airdrop/);
        expect(source).toMatch(/`15M` initial liquidity/);
        expect(source).toMatch(/`10M` long-term vesting/);
        expect(source).toMatch(/`100,000 ATH` per 365-day period/);
        expect(source).toMatch(/`60M` MarketStabilitySeller reserve/);
        expect(source).toMatch(/`20` tranches of `3M ATH`, from `x2` through `x21`/);
        expect(source).toMatch(/obsolete and must not be used as an audit baseline/);
      }
      if (productionDoc.endsWith('MAINNET_RELEASE_CHECKLIST.md')) {
        expect(source).toMatch(/Username Resolver Invariant/);
        expect(source).toMatch(/UsernameRegistry\.name_records\[name_hash\]\.item_address[\s\S]*UsernameNFTItem\.owner_wallet/);
        expect(source).toMatch(/get_name_record\.owner_wallet[\s\S]*not the current owner after transfer/);
      }
      for (const pattern of forbidden) {
        expect(source, `${productionDoc} must not match stale tokenomics pattern ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('M16-CONF-01D: username NFT address derivation is name-hash only, not owner-scoped', () => {
    const registry = contractSource('UsernameRegistry.tact');
    const provider = file(join('web', 'username-ton-rpc-provider.mjs'));

    expect(registry).toMatch(/get fun get_username_item_address\s*\(\s*name_hash:\s*Int\s*\)/);
    expect(registry).not.toMatch(/get fun get_username_item_address\s*\(\s*owner_wallet:\s*Address/);
    expect(provider).toMatch(/method:\s*'get_username_item_address'[\s\S]*stack:\s*\[stackNumber\(nameHash\)\]/);
    expect(provider).toMatch(/async getUsernameItemAddress\(nameHash, callOptions = \{\}\)/);
  });

  it('M16-CONF-02: all production contracts reject empty fallback explicitly', () => {
    for (const contract of productionContracts) {
      const source = contractSource(contract);
      expect(source, `${contract} must define an empty receive fallback`).toMatch(/receive\s*\(\s*\)\s*\{/);
      expect(source, `${contract} empty fallback must throw`).toMatch(/receive\s*\(\s*\)\s*\{[\s\S]*?throw\s*\(/);
    }
  });

  it('M16-CONF-02A: storage top-up ABI is explicit on v1 contracts that pin a top-up opcode', () => {
    for (const [contract, messageName] of storageTopUpReceivers) {
      const source = contractSource(contract);
      expect(source, `${contract} must expose ${messageName}`).toMatch(new RegExp(`receive\\s*\\(\\s*msg:\\s*${messageName}\\s*\\)`));
    }
  });

  it('M16-CONF-03: built code hashes match the pinned artifacts exactly', () => {
    const checks: Array<[string, string, string]> = [
      ['ATHMaster', 'ATHMaster_ATHMaster', 'ATHMASTER_CODE_HASH.txt'],
      ['ATHVesting', 'ATHVesting_ATHVesting', 'ATHVESTING_CODE_HASH.txt'],
      ['ATHWallet', 'ATHWallet_ATHWallet', 'ATH_WALLET_CODE_HASH.txt'],
      ['BuybackBurn', 'BuybackBurn_BuybackBurn', 'BUYBACKBURN_CODE_HASH.txt'],
      ['MarketStabilitySeller', 'MarketStabilitySeller_MarketStabilitySeller', 'MARKET_STABILITY_SELLER_CODE_HASH.txt'],
      ['CapsuleHub', 'CapsuleHub_CapsuleHub', 'CAPSULEHUB_CODE_HASH.txt'],
      ['FeeAccumulator', 'FeeAccumulator_FeeAccumulator', 'FEEACCUMULATOR_CODE_HASH.txt'],
      ['ProfileRegistry', 'ProfileRegistry_ProfileRegistry', 'PROFILE_REGISTRY_CODE_HASH.txt'],
      ['UsernameNFTItem', 'UsernameNFTItem_UsernameNFTItem', 'USERNAME_NFT_ITEM_CODE_HASH.txt'],
      ['UsernameRegistry', 'UsernameRegistry_UsernameRegistry', 'USERNAME_REGISTRY_CODE_HASH.txt'],
      ['Vault', 'Vault_Vault', 'VAULT_CODE_HASH.txt'],
    ];

    for (const [dir, artifactName, hashArtifact] of checks) {
      expect(builtCodeHash(dir, artifactName), hashArtifact).toBe(artifactHash(hashArtifact));
    }
    expect(artifactHash('FEE_ACCUMULATOR_CODE_HASH.txt')).toBe(artifactHash('FEEACCUMULATOR_CODE_HASH.txt'));

    const storedReport = JSON.parse(file(join('artifacts', 'm16_conformance_report.json')));
    for (const [dir, artifactName, hashArtifact] of checks) {
      const key = hashArtifact.replace('.txt', '');
      expect(storedReport.hashes[key].built, `${key} stored M16 built hash must not be stale`).toBe(builtCodeHash(dir, artifactName));
      expect(storedReport.hashes[key].pinned, `${key} stored M16 pinned hash must not be stale`).toBe(artifactHash(hashArtifact));
      expect(storedReport.hashes[key].match, `${key} stored M16 match flag must not be stale`).toBe(true);
    }
  });

  it('M16-CONF-04: implemented-subset manifest remains canonical and explicitly non-final while blockers remain', async () => {
    const { manifest } = await buildImplementedSubsetManifest();
    const recomputed = computeManifestCell({
      addresses: manifest.addresses,
      code_hashes: manifest.code_hashes,
      state_init_hashes: manifest.state_init_hashes,
      constants: manifest.constants,
      blockers_before_final_genesis: manifest.blockers_before_final_genesis,
    }).hash().toString('hex');

    expect(manifest.status).toBe('IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS');
    expect(manifest.manifest_hash_hex).toBe(recomputed);
    expect(manifest.blockers_before_final_genesis.length).toBeGreaterThan(0);
    expect(manifest.blockers_before_final_genesis).toContain('ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT');
    expect(manifest.blockers_before_final_genesis).toContain('VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS');
    expect(manifest.blockers_before_final_genesis.join('\n')).not.toMatch(/STONFI/);
    expect(manifest.constants.vault_pending_publish_stale_ttl_seconds).toBe('86400');
    expect(manifest.constants.vault_activity_airdrop_total_atomic).toBe('15000000000000000');
    expect(manifest.constants.vault_activity_airdrop_reward_per_message_atomic).toBe('10000000000');
    expect(manifest.constants.vault_activity_airdrop_per_wallet_cap_atomic).toBe('0');
    expect(manifest.constants.profile_avatar_price_ath_atomic).toBe('100000000000');
    expect(manifest.constants.profile_avatar_max_parts).toBe('16');
    expect(manifest.constants.username_pending_mint_stale_ttl_seconds).toBe('86400');
    expect(manifest.constants.username_item_ack_forward_reserve_nanotons).toBe('3000000');
  });

  it('M16-CONF-05: source tree contains no extra production routes/adapters/migration hooks beyond the implemented subset', () => {
    const contractFiles = readdirSync('contracts').filter((name) => name.endsWith('.tact')).sort();
    expect(contractFiles).toEqual([
      'ATHMaster.tact',
      'ATHVesting.tact',
      'ATHWallet.tact',
      'BuybackBurn.tact',
      'CapsuleHub.tact',
      'FeeAccumulator.tact',
      'M20TBuybackBurnHarness.tact',
      'M20TFeeAccumulatorHarness.tact',
      'MarketStabilitySeller.tact',
      'MockAthWalletNoAck.tact',
      'MockRegistryNotificationNoAck.tact',
      'MockUsernameNFTItemNoAck.tact',
      'MockUsernameRegistryAckSink.tact',
      'MockVaultAckSink.tact',
      'MockVaultAthWallet.tact',
      'ProfileRegistry.tact',
      'UsernameNFTItem.tact',
      'UsernameRegistry.tact',
      'Vault.tact',
    ]);
    expect(file(join('contracts', 'M20TBuybackBurnHarness.tact'))).toMatch(/Testnet-only M20T/);
    expect(file(join('contracts', 'M20TFeeAccumulatorHarness.tact'))).toMatch(/Testnet-only M20T/);
  });
});
