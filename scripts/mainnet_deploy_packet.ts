import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type Draft = {
  document: string;
  generated_at: string;
  production_deploy_executed: boolean;
  manifest: {
    manifest_hash_hex: string;
    addresses: Record<string, string>;
    code_hashes: Record<string, string>;
    state_init_hashes: Record<string, string>;
    constants: Record<string, string>;
  };
  role_summary: Record<string, { label: string; normalized_address: string }>;
  initial_state_init: Record<string, { address: string; raw_address: string; state_init_hash: string }>;
  official_ath_wallets: Record<string, string>;
  funding_checklist: Array<{
    phase: string;
    recipient: string;
    amount_ath: string;
    amount_atomic: string;
    requirement: string;
  }>;
  pre_seal_bindings: Array<[string, string]>;
};

const ARTIFACTS_LOCAL_DIR = join(process.cwd(), 'artifacts', 'local');
const DEFAULT_DRAFT_PATH = join(ARTIFACTS_LOCAL_DIR, 'mainnet_final_manifest_draft.json');
const DEFAULT_OUTPUT_JSON = join(ARTIFACTS_LOCAL_DIR, 'mainnet_deploy_packet.json');
const DEFAULT_OUTPUT_MD = join(ARTIFACTS_LOCAL_DIR, 'MAINNET_DEPLOY_PACKET.md');

function loadDraft(path: string): Draft {
  const draft = JSON.parse(readFileSync(path, 'utf8')) as Draft;
  if (draft.document !== 'PLATHO.V1.MAINNET_FINAL_MANIFEST_DRAFT') {
    throw new Error(`Unexpected draft document: ${draft.document}`);
  }
  if (draft.production_deploy_executed !== false) {
    throw new Error('Draft claims production_deploy_executed is not false');
  }
  return draft;
}

function role(draft: Draft, key: string): string {
  const entry = draft.role_summary[key];
  if (!entry?.normalized_address) throw new Error(`Missing role ${key}`);
  return entry.normalized_address;
}

function address(draft: Draft, key: string): string {
  const value = draft.manifest.addresses[key];
  if (!value) throw new Error(`Missing manifest address ${key}`);
  return value;
}

function stateHash(draft: Draft, key: string): string {
  const value = draft.manifest.state_init_hashes[key];
  if (!value) throw new Error(`Missing state init hash ${key}`);
  return value;
}

function codeHash(draft: Draft, key: string): string {
  const value = draft.manifest.code_hashes[key];
  if (!value) throw new Error(`Missing code hash ${key}`);
  return value;
}

function buildPacket(draft: Draft) {
  const manifestHash = draft.manifest.manifest_hash_hex;
  const deploymentSteps = [
    {
      id: 'D01',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Deploy ATHMaster',
      target_address: address(draft, 'ath_master'),
      code_hash: codeHash(draft, 'ath_master'),
      state_init_hash: stateHash(draft, 'ath_master'),
      stop_check: 'ATHMaster getter: total_supply=100M ATH, treasury_owner matches role, treasury_supply_deployed=false.',
    },
    {
      id: 'D02',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Call ATHMaster.DeployTreasurySupply',
      target_address: address(draft, 'ath_master'),
      value_nanotons_min: '5000000',
      stop_check: 'Treasury owner ATH wallet receives exactly 100M ATH; treasury_supply_deployed=true.',
    },
    {
      id: 'D03',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy BuybackBurn',
      target_address: address(draft, 'buyback_burn'),
      code_hash: codeHash(draft, 'buyback_burn'),
      state_init_hash: stateHash(draft, 'buyback_burn_initial'),
      stop_check: 'BuybackBurn unsealed, fee/official wallet unbound, route not frozen.',
    },
    {
      id: 'D04',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy MarketStabilitySeller',
      target_address: address(draft, 'market_stability_seller'),
      code_hash: codeHash(draft, 'market_stability_seller'),
      state_init_hash: stateHash(draft, 'market_stability_seller_initial'),
      stop_check: 'MarketStabilitySeller unsealed, pricing not frozen, no reserve/sale state.',
    },
    {
      id: 'D05',
      signer_role: 'ton_treasury_receiver',
      signer_address: role(draft, 'ton_treasury_receiver'),
      action: 'Deploy FeeAccumulator',
      target_address: address(draft, 'fee_accumulator'),
      code_hash: codeHash(draft, 'fee_accumulator'),
      state_init_hash: stateHash(draft, 'fee_accumulator'),
      stop_check: 'FeeAccumulator buyback split disabled and all buckets zero.',
    },
    {
      id: 'D06',
      signer_role: 'ath_long_term_vesting_beneficiary',
      signer_address: role(draft, 'ath_long_term_vesting_beneficiary'),
      action: 'Deploy ATHVesting',
      target_address: address(draft, 'ath_long_term_vesting'),
      code_hash: codeHash(draft, 'ath_vesting'),
      state_init_hash: stateHash(draft, 'ath_long_term_vesting_initial'),
      stop_check: 'ATHVesting beneficiary/schedule match manifest, claimed=0, idle phase.',
    },
    {
      id: 'D07',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy Vault',
      target_address: address(draft, 'vault'),
      code_hash: codeHash(draft, 'vault'),
      state_init_hash: stateHash(draft, 'vault_initial'),
      stop_check: 'Vault unsealed, CapsuleHub not bound, official ATH wallet not yet bound.',
    },
    {
      id: 'D08',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy CapsuleHub',
      target_address: address(draft, 'capsulehub'),
      code_hash: codeHash(draft, 'capsulehub'),
      state_init_hash: stateHash(draft, 'capsulehub_initial'),
      stop_check: 'CapsuleHub unsealed and Vault not bound.',
    },
    {
      id: 'D09',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy UsernameRegistry',
      target_address: address(draft, 'username_registry'),
      code_hash: codeHash(draft, 'username_registry'),
      state_init_hash: stateHash(draft, 'username_registry_initial'),
      stop_check: 'UsernameRegistry unsealed, official ATH wallet placeholder still present.',
    },
    {
      id: 'D10',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy ProfileRegistry',
      target_address: address(draft, 'profile_registry'),
      code_hash: codeHash(draft, 'profile_registry'),
      state_init_hash: stateHash(draft, 'profile_registry_initial'),
      stop_check: 'ProfileRegistry unsealed, official ATH wallet placeholder still present.',
    },
  ];

  const bindingSteps = draft.pre_seal_bindings.map(([message, value], index) => ({
    id: `B${String(index + 1).padStart(2, '0')}`,
    signer_role: 'genesis_controller_one_shot',
    signer_address: role(draft, 'genesis_controller_one_shot'),
    message,
    value,
    deployment_manifest_hash: manifestHash,
    stop_check: 'Getter must show bound value exactly; second/replay binding must remain impossible after seal.',
  }));

  const sealSteps = [
    ['S01', 'Vault.SealGenesis', address(draft, 'vault')],
    ['S02', 'CapsuleHub.SealGenesis', address(draft, 'capsulehub')],
    ['S03', 'UsernameRegistry.SealGenesis', address(draft, 'username_registry')],
    ['S04', 'ProfileRegistry.SealGenesis', address(draft, 'profile_registry')],
    ['S05', 'BuybackBurn.SealBuybackBurnGenesis', address(draft, 'buyback_burn')],
    ['S06', 'MarketStabilitySeller.SealMarketStabilityGenesis', address(draft, 'market_stability_seller')],
  ].map(([id, message, target_address]) => ({
    id,
    signer_role: 'genesis_controller_one_shot',
    signer_address: role(draft, 'genesis_controller_one_shot'),
    message,
    target_address,
    deployment_manifest_hash: manifestHash,
    stop_check: 'Getter must show sealed=true and deployment_manifest_hash equals manifest hash; no user activity before final genesis verification.',
  }));

  const fundingSteps = [
    {
      id: 'F01',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Transfer exactly 15M ATH to Vault official ATH wallet',
      recipient: address(draft, 'vault_official_ath_wallet'),
      amount_atomic: draft.manifest.constants.vault_activity_airdrop_total_atomic,
      stop_check: 'Vault official ATHWallet balance is exactly 15M ATH; Vault airdrop_remaining_ath is 15M and distributed is 0.',
    },
    {
      id: 'F02',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Transfer exactly 10M ATH to ATHVesting official ATH wallet',
      recipient: address(draft, 'ath_long_term_vesting_official_ath_wallet'),
      amount_atomic: draft.manifest.constants.ath_long_term_vesting_allocation_atomic,
      stop_check: 'ATHVesting official ATHWallet balance is exactly 10M ATH; ATHVesting remains idle/clean.',
    },
  ];

  return {
    document: 'PLATHO.V1.MAINNET_DEPLOY_PACKET',
    generated_at: new Date().toISOString(),
    source_draft_generated_at: draft.generated_at,
    production_deploy_executed: false,
    manifest_hash_hex: manifestHash,
    roles: draft.role_summary,
    contract_addresses: Object.fromEntries(
      Object.entries(draft.initial_state_init).map(([key, value]) => [key, value.address]),
    ),
    official_ath_wallets: draft.official_ath_wallets,
    phase_1_deploy_contracts: deploymentSteps,
    phase_2_pre_seal_bindings: bindingSteps,
    phase_3_seal_contracts: sealSteps,
    phase_4_final_genesis_funding: fundingSteps,
    phase_5_final_genesis_verification: {
      template: 'artifacts/mainnet_genesis_verify_input_template.json',
      command: 'npm.cmd run mainnet:genesis:verify',
      must_pass_before: [
        'public PWA mainnet config release',
        'initial liquidity pool launch',
        'MarketStability pricing freeze',
        'Buyback route freeze',
        'EnableBuybackSplit',
      ],
    },
    post_pool_not_in_this_packet: [
      'Open 15M ATH / 100,000 TON liquidity pool.',
      'Collect STON.fi route evidence and run M20F route preflights.',
      'Freeze BuybackBurn route.',
      'Freeze MarketStabilitySeller pricing.',
      'Fund 60M ATH seller reserve through official reserve notify flow.',
      'Run market_stability_seller_readiness.',
      'Run enable_buyback_split_preflight only after airdrop is fully distributed.',
      'Enable FeeAccumulator buyback split.',
    ],
    hard_stops: [
      'Stop on any address mismatch between this packet, Tonkeeper transaction preview, and live getter.',
      'Stop if a wallet asks for seed phrase in a browser page.',
      'Stop if final manifest hash changes after funding begins.',
      'Stop if any official ATHWallet balance is overfunded or underfunded at final genesis.',
      'Stop if any post-seal binding still succeeds.',
    ],
  };
}

function markdown(packet: ReturnType<typeof buildPacket>): string {
  const lines = [
    '# Mainnet Deploy Packet',
    '',
    `Generated: ${packet.generated_at}`,
    `Manifest hash: ${packet.manifest_hash_hex}`,
    `Production deploy executed: ${packet.production_deploy_executed}`,
    '',
    '## Contract Addresses',
    '',
    '| Contract | Address |',
    '| --- | --- |',
  ];

  for (const [key, value] of Object.entries(packet.contract_addresses)) {
    lines.push(`| ${key} | ${value} |`);
  }

  lines.push('', '## Official ATH Wallets', '', '| Wallet | Address |', '| --- | --- |');
  for (const [key, value] of Object.entries(packet.official_ath_wallets)) {
    lines.push(`| ${key} | ${value} |`);
  }

  lines.push('', '## Phase 1: Deploy Contracts', '', '| Step | Signer | Action | Target | Stop Check |', '| --- | --- | --- | --- | --- |');
  for (const step of packet.phase_1_deploy_contracts) {
    lines.push(`| ${step.id} | ${step.signer_role} | ${step.action} | ${step.target_address} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 2: Pre-Seal Bindings', '', '| Step | Message | Value | Stop Check |', '| --- | --- | --- | --- |');
  for (const step of packet.phase_2_pre_seal_bindings) {
    lines.push(`| ${step.id} | ${step.message} | ${step.value} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 3: Seal Contracts', '', '| Step | Message | Target | Stop Check |', '| --- | --- | --- | --- |');
  for (const step of packet.phase_3_seal_contracts) {
    lines.push(`| ${step.id} | ${step.message} | ${step.target_address} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 4: Final Genesis Funding', '', '| Step | Signer | Action | Recipient | Amount Atomic | Stop Check |', '| --- | --- | --- | --- | ---: | --- |');
  for (const step of packet.phase_4_final_genesis_funding) {
    lines.push(`| ${step.id} | ${step.signer_role} | ${step.action} | ${step.recipient} | ${step.amount_atomic} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 5: Final Genesis Verification', '');
  lines.push(`- Template: ${packet.phase_5_final_genesis_verification.template}`);
  lines.push(`- Command: \`${packet.phase_5_final_genesis_verification.command}\``);
  lines.push('- Must pass before:');
  for (const item of packet.phase_5_final_genesis_verification.must_pass_before) {
    lines.push(`  - ${item}`);
  }

  lines.push('', '## Post-Pool Tasks Not In This Packet', '');
  for (const item of packet.post_pool_not_in_this_packet) {
    lines.push(`- ${item}`);
  }

  lines.push('', '## Hard Stops', '');
  for (const stop of packet.hard_stops) {
    lines.push(`- ${stop}`);
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const draftPath = process.argv[2] ?? DEFAULT_DRAFT_PATH;
  const draft = loadDraft(draftPath);
  const packet = buildPacket(draft);
  mkdirSync(ARTIFACTS_LOCAL_DIR, { recursive: true });
  writeFileSync(DEFAULT_OUTPUT_JSON, JSON.stringify(packet, null, 2) + '\n');
  writeFileSync(DEFAULT_OUTPUT_MD, markdown(packet));
  console.log(JSON.stringify({
    ok: true,
    outputJson: DEFAULT_OUTPUT_JSON,
    outputMarkdown: DEFAULT_OUTPUT_MD,
    manifestHash: packet.manifest_hash_hex,
    deploySteps: packet.phase_1_deploy_contracts.length,
    bindingSteps: packet.phase_2_pre_seal_bindings.length,
    sealSteps: packet.phase_3_seal_contracts.length,
    fundingSteps: packet.phase_4_final_genesis_funding.length,
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
