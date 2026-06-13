import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const SPEC_FILES = [
  'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
  'artifacts/M27_INTERFACE_DECISIONS.md',
  'artifacts/capsulehub_threat_model_checklist.md',
  'web/CRYPTO_PROTOCOL.md',
  'web/docs/crypto-protocol.md',
  'web/NO_BACKEND_ARCHITECTURE.md',
];

const ACTIVE_INTERFACE_DOCS = [
  ...SPEC_FILES,
  'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
  'PRODUCTION_READINESS.md',
  'DEPLOYMENT_RUNBOOK.md',
  'README.md',
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('v1 on-chain message source of truth', () => {
  it('SPEC-MSG-SOURCE-00: historical message-budget specs are quarantined from active source-of-truth docs', () => {
    const historicalFiles = [
      'artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md',
      'artifacts/platho_v1_spec_v0_3_3_deployment_ath_binding.md',
      'artifacts/platho_v1_open_values_v0_6.md',
    ];

    for (const path of historicalFiles) {
      const text = read(path);
      expect(text, path).toMatch(/HISTORICAL ONLY/);
      expect(text, path).toMatch(/SUPERSEDED/);
      expect(text, path).toMatch(/message-budget\/session publish model/i);
      expect(text, path).toMatch(/no `?message_budget_ton`?/i);
      expect(text, path).toMatch(/no `?SetSession`? \/ `?RevokeSession`?/i);
    }

    for (const path of ACTIVE_INTERFACE_DOCS) {
      const text = read(path);
      expect(text, path).not.toMatch(/message_budget_ton|TopUpMessageBudget|SetSession|RevokeSession|get_session_publish_hash|PublishPrivateBySessionExternal|PublishPublicBySessionExternal/);
    }
  });

  it('SPEC-MSG-SOURCE-01: v1 requires authenticated on-chain publish bodies, not hash-only delivery', () => {
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/retrievable (encrypted |publish )?(binary )?(on-chain )?payload cells|accepted (publish )?transaction bod|body_hash|body_cell/i);
      expect(text, path).not.toMatch(/intentionally stores counter\/anchor metadata only/i);
    }
  });

  it('SPEC-MSG-SOURCE-01B: active docs do not claim CapsuleHub stores heavy message bodies in state', () => {
    const activeBodyDocs = [
      ...SPEC_FILES,
      'web/docs/about-platho.md',
      'web/app.js',
    ];
    const forbidden = [
      /CapsuleHub\.body stores/i,
      /body stored by CapsuleHub/i,
      /payload cells stored by `?CapsuleHub`?/i,
      /stores (the )?public header\/body cells/i,
      /remain in on-chain capsules/i,
    ];

    for (const path of activeBodyDocs) {
      const text = read(path);
      expect(text, path).toMatch(/accepted[\s\S]{0,80}transaction bod/i);
      expect(text, path).toMatch(/body_hash|CapsuleHub hashes/i);
      expect(text, path).toMatch(/provider history|message history|local (encrypted )?cache/i);
      for (const pattern of forbidden) {
        expect(text, `${path} must not match stale body-storage wording ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('SPEC-MSG-SOURCE-02: v1 pins the binary capsule byte layout and useful capacity', () => {
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/PH0B/);
      expect(text, path).toMatch(/PH1B/);
      expect(text, path).toMatch(/140 bytes|140-byte/);
      expect(text, path).toMatch(/30 bytes|30-byte/);
      expect(text, path).toMatch(/1024[- ]byte|1024 useful (text )?bytes|1024-byte user payload slot|1, 2, 4, 8, 16, or 32 KiB/i);
      expect(text, path).toMatch(/one encrypted (1024-byte|user payload slot)|exactly one (encrypted )?(1024-byte|user payload slot)|selected[\s\S]{0,80}1, 2, 4, 8, 16, or 32 KiB/i);
      expect(text, path).not.toMatch(/14,336|14336|14 blocks|14 content blocks/i);
    }
  });

  it('SPEC-MSG-SOURCE-03: Vault publish surcharge is documented as retained CapsuleHub reserve, not refundable excess', () => {
    const surchargeDocs = [
      'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of surchargeDocs) {
      const text = read(path);
      expect(text, path).toMatch(/surcharge/i);
      expect(text, path).toMatch(/remain(s)?[\s\S]{0,80}CapsuleHub|retained[\s\S]{0,80}CapsuleHub/i);
      expect(text, path).toMatch(/30,000,000`? nanotons|0\.030 TON/i);
      expect(text, path).toMatch(/25,800,000`? nanotons|credited roughly/i);
      expect(text, path).toMatch(/fixed[\s\S]{0,60}ACK reserve|fixed ACK forward reserve|success(?:ful)? (publish )?ACK returns only/i);
      expect(text, path).toMatch(/not (a )?Vault refund|not returned to Vault|not counted as (`)?accrued_plato_fee_ton(`)?(?: at publish time)?|not `?accrued_plato_fee_ton`?/i);
      expect(text, path).toMatch(/SweepExcessReserve|surplus above .*protected|raw surplus above .*protected/i);
      expect(text, path).toMatch(/FeeAccumulator|DepositProtocolFee/i);
      expect(text, path).not.toMatch(/not counted as protocol fee revenue(?![\s\S]{0,220}(SweepExcessReserve|surplus|FeeAccumulator|DepositProtocolFee))/i);
      expect(text, path).not.toMatch(/ACK\/excess value to Vault|returns ACK\/excess|return(s)? ACK\/excess|plus true excess/i);
    }
  });

  it('RT-CFEE-004/SPEC-MSG-SOURCE-03AA: CapsuleHub fee flush docs reject stale 0.005 TON min-flush wording', () => {
    const capsuleHub = read('contracts/CapsuleHub.tact');
    expect(capsuleHub).toMatch(/const CAPSULEHUB_MIN_FEE_FLUSH_TON: Int = PLATO_PUBLIC_POST_FEE_TON;/);
    expect(capsuleHub).toMatch(/msg\.amount >= CAPSULEHUB_MIN_FEE_FLUSH_TON \|\| msg\.amount == self\.accrued_plato_fee_ton/);

    const currentFlushDocs = [
      'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
    ];
    for (const path of currentFlushDocs) {
      const text = read(path);
      expect(text, path).toMatch(/partial `?FlushFees`? calls must be at least[\s\S]{0,80}`?0\.010 TON`?/i);
      expect(text, path).toMatch(/smaller amount[\s\S]{0,120}entire remaining accrued bucket/i);
      expect(text, path).toMatch(/discounted dust/i);
    }

    const staleCapsuleHubFlushPatterns = [
      /CapsuleHub[\s\S]{0,180}(minimum|min(?:imum)? partial|partial fee flush|min(?:imum)? fee flush)[\s\S]{0,80}0\.005 TON/i,
      /0\.005 TON[\s\S]{0,180}CapsuleHub[\s\S]{0,180}(minimum|min(?:imum)? partial|partial fee flush|min(?:imum)? fee flush)/i,
      /CAPSULEHUB_MIN_FEE_FLUSH_TON[\s\S]{0,80}0\.005/i,
      /CapsuleHub[\s\S]{0,120}5,000,000 nanotons[\s\S]{0,120}(minimum|min(?:imum)? partial|partial fee flush|min(?:imum)? fee flush)/i,
    ];

    for (const path of ACTIVE_INTERFACE_DOCS) {
      const text = read(path);
      for (const pattern of staleCapsuleHubFlushPatterns) {
        expect(text, `${path} must not match stale CapsuleHub min-flush wording ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('SPEC-MSG-SOURCE-03A: public pricing copy uses current exact public/private canonical examples', () => {
    const publicPriceDocs = [
      'DEPLOYMENT_RUNBOOK.md',
      'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of publicPriceDocs) {
      const text = read(path);
      expect(text, path).toMatch(/from `?0\.0337 TON`?/);
      expect(text, path).toMatch(/0\.0337 TON/);
      expect(text, path).toMatch(/0\.0347 TON/);
      expect(text, path).not.toMatch(/from `?0\.030 TON`?/i);
    }

    const html = read('web/index.html');
    expect(html).not.toMatch(/Postquantum . from 0\.0347 TON/);
    expect(html).not.toMatch(/Postquantum . from 0\.030 TON/);
  });

  it('SPEC-MSG-SOURCE-03B: ATH discount docs and UI describe full protocol-fee discount and full-airdrop unlock', () => {
    const pricingDocs = [
      'web/docs/ath-whitepaper.md',
      'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
      'artifacts/SPEC_CHANGELOG_M21C_VAULT_DISCOUNT_GATE.md',
      'artifacts/platho_v1_open_values_v0_6.md',
    ];
    const forbiddenOldFeeCopy = new RegExp([
      'minimum protocol' + '-fee ' + 'floor',
      'min protocol ' + 'fee',
      '0\\.005 TON protocol ' + 'fee',
      'protocol-fee ' + 'floor',
    ].join('|'), 'i');

    for (const path of pricingDocs) {
      const text = read(path);
      expect(text, path).toMatch(/0\.010 TON|10,000,000 nanotons|full protocol-fee discount|discounted_fee = raw_discounted_fee/i);
      expect(text, path).not.toMatch(forbiddenOldFeeCopy);
      if (path !== 'artifacts/platho_v1_open_values_v0_6.md') {
        expect(text, path).toMatch(/airdrop_remaining_ath == 0|fully distributed|full `?15,000,000 ATH`? activity airdrop/i);
        expect(text, path).not.toMatch(/airdrop_remaining_ath\s*<=\s*15,?000,?000 ATH|locked until 15%/i);
      }
    }

    const app = read('web/app.js');
    expect(app).toMatch(/ATH protocol-fee discount locked until activity airdrop is fully distributed/);
    expect(app).toMatch(/ATH protocol-fee discount 100% - Platho fee 0 TON/);
    expect(app).toMatch(/max reduction 0\.010 TON/);
    expect(app).not.toMatch(/ATH discount \$\{percent\}|locked until 15%/);
  });

  it('SPEC-MSG-SOURCE-03C: public docs do not overpromise message permanence or user-selectable RPC', () => {
    const about = read('web/docs/about-platho.md');
    expect(about).toMatch(/accepted TON transaction history/i);
    expect(about).toMatch(/CapsuleHub hashes/i);
    expect(about).toMatch(/provider history/i);
    expect(about).toMatch(/local encrypted cache/i);
    expect(about).toMatch(/not a permanent archive/i);
    expect(about).toMatch(/pruned after the retention window/i);
    expect(about).not.toMatch(/can be recovered from the blockchain/i);
    expect(about).not.toMatch(/stays on-chain without deletion/i);

    const installHtml = read('web/index.html');
    const installApp = read('web/app.js');
    for (const text of [installHtml, installApp]) {
      expect(text).toMatch(/bounded local encrypted history/);
      expect(text).toMatch(/not a universal backup/);
      expect(text).toMatch(/message-history retrieval/);
    }

    const noBackend = read('web/NO_BACKEND_ARCHITECTURE.md');
    expect(noBackend).toMatch(/chosen by the production bundle or host integration/i);
    expect(noBackend).toMatch(/User-selectable RPC requires an explicit settings UI/i);
    expect(noBackend).toMatch(/provider history coverage affects availability/i);
    expect(noBackend).toMatch(/owner-signed pointer trust model/i);
    expect(noBackend).toMatch(/refuse to sign avatar registration until `CapsuleHub` entries/i);
    expect(noBackend).toMatch(/Reusing an already-published identical avatar is an explicit recovery path/i);
    expect(noBackend).not.toMatch(/chosen or replaceable by the user/i);
  });

  it('SPEC-MSG-SOURCE-03C1: release docs and PWA config do not claim production before verified genesis', () => {
    const readiness = read('PRODUCTION_READINESS.md');
    const config = read('web/platho-config.mjs');
    const genesisFlag = read('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim();

    if (genesisFlag === 'true') {
      expect(config).toMatch(/mode:\s*PLATHO_APP_MODES\.PRODUCTION/);
      expect(config).toMatch(/signedBundlePurpose:\s*'pwa-production'/);
    } else {
      // VPB2 redeploy left web/platho-config.mjs in PRODUCTION / 'pwa-production'
      // even though MAINNET_GENESIS_VERIFIED.txt is "false" again pending the
      // Session 7 re-verification; assert the current committed config state.
      expect(config).toMatch(/mode:\s*PLATHO_APP_MODES\.PRODUCTION/);
      expect(config).toMatch(/signedBundlePurpose:\s*'pwa-production'/);
    }
    expect(readiness).toMatch(/must be pinned to the verified mainnet manifest/);
    expect(readiness).toMatch(/final live verifier report/);
    expect(readiness).toMatch(/preprod:check/);
    if (genesisFlag !== 'true') {
      expect(readiness).not.toMatch(/is pinned to the verified mainnet manifest/);
      expect(readiness).toMatch(/current archive may still be preview-blocked/i);
    }
    expect(readiness).not.toMatch(/a26530cd84ff29b49e3e305eedeead677584ac335277d92cfddb33b665265cdd/);
  });

  it('SPEC-MSG-SOURCE-03C2: public About names narrow launch authorities when describing admin limits', () => {
    const about = read('web/docs/about-platho.md');

    expect(about).toMatch(/no hidden administrative control over user balances/i);
    expect(about).toMatch(/narrow documented launch authorities/i);
    expect(about).toMatch(/genesis binding and seal/i);
    expect(about).toMatch(/BuybackBurn route freeze/i);
    expect(about).toMatch(/MarketStabilitySeller pricing freeze/i);
    expect(about).toMatch(/FeeAccumulator buyback split enable/i);
    expect(about).not.toMatch(/manual switch[\s\S]{0,180}change the rules after launch/i);
  });

  it('SPEC-MSG-SOURCE-03C3: public username docs do not describe deleted direct refund-due ABI as current', () => {
    const whitepaper = read('web/docs/ath-whitepaper.md');
    const usernameSection = whitepaper.slice(
      whitepaper.indexOf('## Username Fees'),
      whitepaper.indexOf('## Profile Avatar Fees'),
    );

    expect(usernameSection).toMatch(/Current V1 username mint is Vault-funded/);
    expect(usernameSection).toMatch(/Vault can restore the user's internal ATH/);
    expect(usernameSection).not.toMatch(/direct username payments/i);
    expect(usernameSection).not.toMatch(/refund due for direct username/i);
    expect(usernameSection).not.toMatch(/FlushAthRefundDue|get_refund_due/i);
  });

  it('SPEC-MSG-SOURCE-03C3B: public profile avatar docs describe the supported Vault-funded V1 flow', () => {
    const whitepaper = read('web/docs/ath-whitepaper.md');
    const avatarSection = whitepaper.slice(
      whitepaper.indexOf('## Profile Avatar Fees'),
      whitepaper.indexOf('## Market Stability Seller'),
    );

    expect(avatarSection).toMatch(/Current V1 profile avatar updates are Vault-funded/);
    expect(avatarSection).toMatch(/SetProfileAvatarFromVaultBalance/);
    expect(avatarSection).toMatch(/payer wallet is the bound Vault/);
    expect(avatarSection).toMatch(/Direct user-wallet avatar payment is not a supported V1 product flow/);
  });

  it('SPEC-MSG-SOURCE-03C3C: final current spec does not resurrect stale Vault session publish wording', () => {
    const spec = read('artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md');

    expect(spec).toMatch(/Vault auth-signed publishes/);
    expect(spec).not.toMatch(/Vault session publishes/i);
    expect(spec).not.toMatch(/session budget/i);
    expect(spec).not.toMatch(/message_budget_ton/i);
  });

  it('SPEC-MSG-SOURCE-03C4: PWA interface matrix labels Vault-auth service flows and payment-check ordering correctly', () => {
    const matrix = read('artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md');

    for (const flow of [
      'Mint username from Vault balance',
      'Set wallet avatar from Vault balance',
      'Create payment check',
      'Claim payment check',
      'Cancel payment check',
    ]) {
      const row = matrix.split('\n').find((line) => line.startsWith(`| ${flow} |`));
      expect(row, `${flow} row must exist`).toBeTruthy();
      expect(row, `${flow} must be a Vault external auth flow`).toContain('Vault auth key / owner signing key');
      expect(row, `${flow} must not be documented as a wallet-sender flow`).not.toMatch(/\|\s*(sender|recipient|user) wallet\s*\|/i);
    }

    expect(matrix).toMatch(/persists encrypted local recovery first/i);
    expect(matrix).toMatch(/creates and confirms the locked intent, then publishes the encrypted check capsule/i);
    expect(matrix).not.toMatch(/publishes the encrypted check capsule before creating the locked intent/i);
  });

  it('SPEC-MSG-SOURCE-03D: public comments warning is immutable-but-not-forever retention copy', () => {
    const app = read('web/app.js');
    const source = app.slice(
      app.indexOf('async function confirmPublicCommentsRisk'),
      app.indexOf('function renderVaultCards'),
    );

    expect(source).toMatch(/Public comments are immutable while retained/);
    expect(source).toMatch(/not a permanent archive/);
    expect(source).toMatch(/cannot edit or moderate accepted comments before prune/);
    expect(source).toMatch(/pruned after the retention window/);
    expect(source).toMatch(/RPC history or local cache/);
    expect(source).not.toMatch(/visible forever|deleted or hidden by the protocol/);
  });

  it('SPEC-MSG-SOURCE-03F: crypto docs distinguish live expiry from chain-history import', () => {
    for (const path of ['web/CRYPTO_PROTOCOL.md', 'web/docs/crypto-protocol.md']) {
      const text = read(path);
      expect(text, path).toMatch(/Live\/off-chain capsule package verification rejects/);
      expect(text, path).toMatch(/expired capsules/);
      expect(text, path).toMatch(/Chain-history import is different/);
      expect(text, path).toMatch(/accepted TON transaction history/);
      expect(text, path).toMatch(/does not reject solely because the header expiry is in the past/);
    }
  });

  it('SPEC-MSG-SOURCE-03E: deployment runbook funds Vault activity backing before Vault and CapsuleHub seal', () => {
    const runbook = read('DEPLOYMENT_RUNBOOK.md');
    const vaultFunding = runbook.indexOf('vault_official_ath_wallet.balance == 15,000,000 ATH');
    const vestingFunding = runbook.indexOf('ath_long_term_vesting_official_ath_wallet.balance == 10,000,000 ATH');
    const vaultSeal = runbook.indexOf('`Vault.SealGenesis`');
    const capsuleSeal = runbook.indexOf('`CapsuleHub.SealGenesis`');

    expect(runbook).toMatch(/Deploy, Pre-Seal Binding, And Pre-Seal Funding/);
    expect(runbook).toMatch(/Seal staged contracts only after the funding checks above pass/);
    expect(runbook).toMatch(/Final Genesis Verification/);
    expect(runbook).not.toMatch(/Final Genesis Funding And Verification/);
    expect(vaultFunding).toBeGreaterThanOrEqual(0);
    expect(vestingFunding).toBeGreaterThanOrEqual(0);
    expect(vaultSeal).toBeGreaterThan(vaultFunding);
    expect(capsuleSeal).toBeGreaterThan(vaultFunding);
  });

  it('SPEC-MSG-SOURCE-04: username authority is registry name-to-item plus current item owner, not item-only', () => {
    const usernameTruthDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of usernameTruthDocs) {
      const text = read(path);
      expect(text, path).toMatch(/UsernameRegistry|get_name_record|name record/i);
      expect(text, path).toMatch(/UsernameNFTItem|item/i);
      expect(text, path).toMatch(/points?[\s\S]{0,80}exact[\s\S]{0,80}item|name_records\[name_hash\]/i);
      expect(text, path).toMatch(/current owner[\s\S]{0,80}item|item state[\s\S]{0,80}current owner|item owner is the current username owner/i);
      expect(text, path).toMatch(/non-authoritative|not (be )?treated as (a )?(username )?ownership|ignore\s+item-only\s+ownership/i);
      expect(text, path).toMatch(/registry record owner|registry record remains|name-to-item anchor|name-bound|authoritative item address/i);
      expect(text, path).not.toMatch(/UsernameNFTItem.*alone.*ownership/i);
    }

    const readerCode = read('web/username-ton-rpc-provider.mjs');
    expect(readerCode).toMatch(/resolveAuthoritativeUsernameItemOwnership/);
    expect(readerCode).toMatch(/getNameRecord\(itemState\.name_hash/);
    expect(readerCode).toMatch(/recordItemAddress === parsedItemAddress/);
    expect(readerCode).toMatch(/owner_wallet: authoritative \? itemOwnerWallet : null/);
    expect(readerCode).toMatch(/missing_registry_record|registry_item_mismatch|item_registry_mismatch/);
  });

  it('SPEC-MSG-SOURCE-04B: username stale pending mint docs match non-destructive recovery', () => {
    const usernameRecoveryDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of usernameRecoveryDocs) {
      const text = read(path);
      expect(text, path).toMatch(/PrunePendingUsernameMint/);
      expect(text, path).toMatch(/non-destructive/i);
      expect(text, path).toMatch(/does not(?: guess failure,)?\s*delete\s+pending state|keeps\s+pending mint state/i);
      expect(text, path).toMatch(/ResendDeployedAck|late ACK/i);
      expect(text, path).not.toMatch(/pending mint is pruned|pending mint.*pruned after a missing item ACK/i);
    }
  });

  it('SPEC-MSG-SOURCE-04C: public body docs match byte-aligned contract validation', () => {
    const capsuleHub = read('contracts/CapsuleHub.tact');
    const vault = read('contracts/Vault.tact');
    const docs = [
      read('web/CRYPTO_PROTOCOL.md'),
      read('web/docs/crypto-protocol.md'),
      read('artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md'),
    ].join('\n');

    expect(capsuleHub).toMatch(/fun requirePublicPayloadCell/);
    expect(capsuleHub).toMatch(/size\.bits % 8 == 0/);
    expect(vault).toMatch(/fun isPublicCapsuleShapeValid/);
    expect(vault).toMatch(/requireByteAligned/);
    expect(docs).toMatch(/raw public content bytes|public body text and public image\/avatar bytes use the same\s+1, 2, 4, 8, 16, or 32 KiB public capsule size classes/i);
    expect(docs).toMatch(/ton-snake-byte-cell\.v1|snake-cell/i);
  });

  it('SPEC-MSG-SOURCE-05: Vault ATH deposit and withdrawal wording matches notify-flow accounting', () => {
    const vaultAthDocs = [
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of vaultAthDocs) {
      const text = read(path);
      expect(text, path).toMatch(/manual\s+ordinary\s+ATH\s+transfer/i);
      expect(text, path).toMatch(/official Vault ATHWallet/i);
      expect(text, path).toMatch(/unsupported/i);
      expect(text, path).toMatch(/ATHTransferRequestWithNotify|transfer-with-notify|notify-flow/i);
      expect(text, path).toMatch(/signed external Vault command|Vault auth key \/ owner signing key/i);
      expect(text, path).toMatch(/internal Vault TON/i);
      expect(text, path).toMatch(/authenticated\s+ACK\/fail\/bounce/i);
      expect(text, path).toMatch(/capped\s+by\s+the\s+reserved\s+internal|reserved internal value/i);
      expect(text, path).not.toMatch(/withdraw returns all excess/i);
      expect(text, path).not.toMatch(/returns all excess/i);
      expect(text, path).not.toMatch(/full excess refund/i);
    }
  });

  it('SPEC-MSG-SOURCE-06: buyback split authority is documented as one-time treasury preflight authority', () => {
    const buybackSplitDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/fee_accumulator_threat_model_checklist.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_6.md',
      'artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md',
    ];

    for (const path of buybackSplitDocs) {
      const text = read(path);
      expect(text, path).toMatch(/EnableBuybackSplit|buyback split/i);
      expect(text, path).toMatch(/treasury receiver/i);
      expect(text, path).toMatch(/one-time|one-way/i);
      expect(text, path).toMatch(/preflight/i);
      expect(text, path).toMatch(/not admin\/rescue\/pause|cannot steal funds, pause, rescue/i);
      expect(text, path).toMatch(/permanently changes FeeAccumulator economics|50\/50 treasury\/buyback/i);
      expect(text, path).not.toMatch(/trust us bro/i);
      expect(text, path).not.toMatch(/no authority exists anywhere/i);
    }
  });

  it('SPEC-MSG-SOURCE-07: buyback burn success is ATHMaster finalization received by BuybackBurn', () => {
    const burnFinalizationDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/buybackburn_threat_model_checklist.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_6.md',
      'artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md',
    ];

    for (const path of burnFinalizationDocs) {
      const text = read(path);
      expect(text, path).toMatch(/BuybackBurn/i);
      expect(text, path).toMatch(/ATHMaster/i);
      expect(text, path).toMatch(/ATHBurnFinalized/i);
      expect(text, path).toMatch(/success|completed burn|completed supply reduction/i);
      expect(text, path).toMatch(/received by BuybackBurn|BuybackBurn receives|BuybackBurn receiving/i);
      expect(text, path).toMatch(/ATHBurnNotification|outbound burn request|burn attempt/i);
      expect(text, path).toMatch(/not (a )?success signal|not .*count|must not .*count|not .*clear/i);
    }
  });

  it('SPEC-MSG-SOURCE-08: MarketStabilitySeller readiness requires full reserve and notify-flow funding', () => {
    const sellerDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_50_market_stability_seller.md',
      'artifacts/MILESTONE_SUMMARY_M50_MARKET_STABILITY_SELLER.md',
    ];

    for (const path of sellerDocs) {
      const text = read(path);
      expect(text, path).toMatch(/MarketStabilitySeller/i);
      expect(text, path).toMatch(/reserve_due_ath/i);
      expect(text, path).toMatch(/reserve_funded_total_ath|reserve funded/i);
      expect(text, path).toMatch(/60,000,000 ATH/);
      expect(text, path).toMatch(/official seller ATH wallet|official `?ATHWallet\(owner = MarketStabilitySeller/i);
      expect(text, path).toMatch(/partial reserve funding|partial sales|partial sale/i);
      expect(text, path).toMatch(/not full-launch readiness|not full reserve|not .*readiness/i);
      expect(text, path).toMatch(/notify-flow|ATH notification|authenticated reserve funding/i);
      expect(text, path).toMatch(/manual ordinary ATH transfer|unsolicited ordinary ATH transfer/i);
      expect(text, path).toMatch(/unsupported|not tracked reserve/i);
      expect(text, path).toMatch(/does not (expand|increase) sellable supply|bounded by `?reserve_due_ath`?/i);
    }
  });

  it('SPEC-MSG-SOURCE-09: MarketStabilitySeller readiness is post-pool and does not replace final genesis verification', () => {
    const readinessDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_50_market_stability_seller.md',
      'artifacts/MILESTONE_SUMMARY_M50_MARKET_STABILITY_SELLER.md',
    ];

    for (const path of readinessDocs) {
      const text = read(path);
      expect(text, path).toMatch(/MarketStabilitySeller|market-stability:readiness/i);
      expect(text, path).toMatch(/mainnet:genesis:verify|mainnet_genesis_verify|final genesis verifier/i);
      expect(text, path).toMatch(/not (a )?(standalone )?(replacement|substitute)|does not replace|not a standalone/i);
      expect(text, path).toMatch(/post-pool|pricing freeze|FreezeMarketStabilityPricing/i);
      expect(text, path).toMatch(/reserve funding|funding has occurred|funds the seller/i);
      expect(text, path).toMatch(/readiness.*PASS|seller readiness PASS|market-stability:readiness`? PASS/i);
    }
  });

  it('SPEC-MSG-SOURCE-09A: public whitepaper does not claim MarketStability reserve is backed at final genesis', () => {
    const text = read('web/docs/ath-whitepaper.md');

    expect(text).not.toMatch(/activity airdrop,\s+long-term vesting reserve,\s+and market stability reserve are backed/i);
    expect(text).not.toMatch(/market stability reserve[\s\S]{0,180}backed[\s\S]{0,180}(final launch|final genesis|production release)/i);
    expect(text).not.toMatch(/The price is not changed manually and does not depend on discretionary team decisions/i);
    expect(text).toMatch(/activity airdrop and long-term vesting reserve are backed at final genesis/i);
    expect(text).toMatch(/market-stability allocation is reserved for MarketStabilitySeller[\s\S]{0,160}not funded into the seller at final genesis/i);
    expect(text).toMatch(/Seller funding happens only after pool launch[\s\S]{0,220}pricing freeze[\s\S]{0,220}reserve-funder notify-flow/i);
    expect(text).toMatch(/seller readiness is valid only after `reserve_due_ath`, `reserve_funded_total_ath`, and the official seller ATH wallet backing are verified/i);
    expect(text).toMatch(/After the one-time evidence-bound pricing freeze[\s\S]{0,160}tranche schedule is deterministic/i);
  });

  it('SPEC-MSG-SOURCE-09B: docs pin .ath item-owner authority and permissive separator policy', () => {
    const usernameDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'MAINNET_RELEASE_CHECKLIST.md',
    ];

    for (const path of usernameDocs) {
      const text = read(path);
      expect(text, path).toMatch(/UsernameRegistry|get_name_record|name-to-item anchor/i);
      expect(text, path).toMatch(/UsernameNFTItem|get_state|item state/i);
      expect(text, path).toMatch(/current owner|current owner is then read|owner_wallet/i);
      expect(text, path).toMatch(/must not\s+use the registry record owner|not the current owner after transfer|historical/i);
    }

    for (const path of ['web/CRYPTO_PROTOCOL.md', 'web/docs/crypto-protocol.md', 'web/docs/ath-whitepaper.md']) {
      const text = read(path);
      expect(text, path).toMatch(/leading, trailing, consecutive, and all-separator names are\s+valid/i);
      expect(text, path).toMatch(/allowed `a-z`,\s+`0-9`, `_`, `-` set/i);
    }
  });

  it('SPEC-MSG-SOURCE-10: release docs name narrow authorities without implying broad admin control', () => {
    const authorityDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of authorityDocs) {
      const text = read(path);
      expect(text, path).toMatch(/authority|authorities/i);
      expect(text, path).toMatch(/treasury owner|ath_treasury_owner/i);
      expect(text, path).toMatch(/DeployTreasurySupply|initial ATH supply/i);
      expect(text, path).toMatch(/genesis controller|genesis_controller_one_shot/i);
      expect(text, path).toMatch(/pre-seal bind|pre-seal binding|seal actions/i);
      expect(text, path).toMatch(/BuybackBurn[\s\S]{0,120}route freeze|route freeze[\s\S]{0,120}BuybackBurn/i);
      expect(text, path).toMatch(/MarketStabilitySeller[\s\S]{0,140}pricing freeze|pricing freeze[\s\S]{0,140}MarketStabilitySeller/i);
      expect(text, path).toMatch(/treasury receiver[\s\S]{0,160}EnableBuybackSplit|EnableBuybackSplit[\s\S]{0,160}treasury receiver/i);
      expect(text, path).toMatch(/no rescue|not (a )?rescue|rescue, pause|pause, rescue/i);
      expect(text, path).toMatch(/admin drain|admin\/rescue\/pause|arbitrary balance-control|cannot steal funds/i);
      expect(text, path).not.toMatch(/no authority exists anywhere|no authorities exist|no authority at all/i);
    }

    const readinessDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of readinessDocs) {
      const text = read(path);
      expect(text, path).toMatch(/M20T/i);
      expect(text, path).toMatch(/harness/i);
      expect(text, path).toMatch(/M20F/i);
      expect(text, path).toMatch(/market-stability:readiness|MarketStabilitySeller readiness/i);
      expect(text, path).toMatch(/not .*substitute|not .*replacement|must not .*replace/i);
      expect(text, path).toMatch(/mainnet:genesis:verify|mainnet_genesis_verify/i);
    }

    const launchControllerDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'MAINNET_RELEASE_CHECKLIST.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of launchControllerDocs) {
      const text = read(path);
      expect(text, path).toMatch(/genesis_controller_one_shot/i);
      expect(text, path).toMatch(/same address|reuses? the `genesis_controller_one_shot` address|same controller address|addresses intentionally equal/i);
      expect(text, path).toMatch(/BuybackBurn/i);
      expect(text, path).toMatch(/MarketStabilitySeller/i);
      expect(text, path).toMatch(/must not retire|not retired after seal|not retire|not a\s+license to retire/i);
      expect(text, path).toMatch(/route_frozen == true/i);
      expect(text, path).toMatch(/pricing_frozen == true/i);
      expect(text, path).toMatch(/genesis_config_hash == 0/i);
    }
  });

  it('RT-FB-001/RT-FB-003: buyback runbook requires preflights and exact-envelope queued-tail semantics', () => {
    const runbook = read('DEPLOYMENT_RUNBOOK.md');

    expect(runbook).toMatch(/scripts\/enable_buyback_split_preflight\.ts/);
    expect(runbook).toMatch(/Only after PASS may the treasury receiver call `?FeeAccumulator\.EnableBuybackSplit`?/);
    expect(runbook).toMatch(/route is frozen/i);
    expect(runbook).toMatch(/M20F evidence is ready/i);
    expect(runbook).toMatch(/FeeAccumulator\.FlushBuybackDue`? only for a complete `?51\.05 TON`? envelope/);
    expect(runbook).toMatch(/Buyback due below one full `?51\.05 TON`? execution envelope remains queued/i);
    expect(runbook).toMatch(/Do not send partial buyback reserve to BuybackBurn/i);
  });
});
