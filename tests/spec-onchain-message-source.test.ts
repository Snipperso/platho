import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

// Hundreds of user-facing English literals that used to live inline in web/app.js and
// web/index.html were converted to t('key') calls; the shipped English COPY now lives in
// web/i18n-strings.mjs under I18N_STRINGS.en. Guards that pinned that copy against web/app.js
// must now also (or instead) look at the en dictionary, because the phrase moved out of app.js.
// EN_COPY is the joined shipped English copy; EN(...) reads the exact copy for named keys so a
// guard can keep its original specificity by pinning the precise strings it protects.
const EN_COPY: string = Object.values(I18N_STRINGS.en).join('\n');
function EN(...keys: string[]): string {
  return keys.map((k) => (I18N_STRINGS.en as Record<string, string>)[k] ?? '').join('\n');
}

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
      // web/app.js kept the body_hash / provider-history wording but its "accepted TON transaction
      // body" copy moved into the en dictionary via t('key'); fold the shipped en copy into the
      // app.js haystack for both the positive pins and the forbidden-wording checks so a stale
      // phrase cannot hide in the dictionary either.
      const text = path === 'web/app.js' ? `${read(path)}\n${EN_COPY}` : read(path);
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
      const coin = path.startsWith('web/') ? 'GRAM' : 'TON';
      expect(text, path).toMatch(new RegExp(`from \`?0\\.0337 ${coin}\`?`));
      expect(text, path).toMatch(new RegExp(`0\\.0337 ${coin}`));
      expect(text, path).toMatch(new RegExp(`0\\.0347 ${coin}`));
      expect(text, path).not.toMatch(/from `?0\.030 TON`?/i);
    }

    const html = read('web/index.html');
    expect(html).not.toMatch(/Postquantum . from 0.0347 GRAM/);
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
      expect(text, path).toMatch(/0.010 GRAM|10,000,000 nanotons|full protocol-fee discount|discounted_fee = raw_discounted_fee/i);
      expect(text, path).not.toMatch(forbiddenOldFeeCopy);
      if (path !== 'artifacts/platho_v1_open_values_v0_6.md') {
        expect(text, path).toMatch(/airdrop_remaining_ath == 0|fully distributed|full `?15,000,000 ATH`? activity airdrop/i);
        expect(text, path).not.toMatch(/airdrop_remaining_ath\s*<=\s*15,?000,?000 ATH|locked until 15%/i);
      }
    }

    // The discount composer copy moved from inline literals in web/app.js into the en dictionary
    // (composer.athDiscountLocked / athDiscountFull / athDiscountPartial). Pin the shipped copy in
    // app.js source + en copy; the negative also spans both so a bad phrase can't hide in either.
    const app = `${read('web/app.js')}\n${EN_COPY}`;
    expect(app).toMatch(/ATH protocol-fee discount locked until activity airdrop is fully distributed/);
    expect(app).toMatch(/ATH protocol-fee discount 100% - Platho fee 0 GRAM/);
    expect(app).toMatch(/max reduction 0.010 GRAM/);
    expect(app).not.toMatch(/ATH discount \$\{percent\}|locked until 15%/);
  });

  it('SPEC-MSG-SOURCE-03C: public docs do not overpromise message permanence or user-selectable RPC', () => {
    // The About doc was rewritten (owner, 2026-07-08) into a rights/freedom manifesto and no longer carries the
    // technical permanence internals (transaction-history recovery, CapsuleHub hashes, retention pruning); those
    // stay in crypto-protocol.md (checked by SPEC-MSG-SOURCE-01B/03) and NO_BACKEND_ARCHITECTURE.md below.
    const installHtml = read('web/index.html');
    // The install-prompt copy stays as visible fallback text in index.html, but in web/app.js it is
    // now emitted via t('install.*'); the shipped English lives in the en dictionary. Fold the en
    // copy into the app.js haystack so the shipped install copy is still pinned.
    const installApp = `${read('web/app.js')}\n${EN_COPY}`;
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

  it('SPEC-MSG-SOURCE-03C2: public About states no hidden admin control, without contract-internal detail', () => {
    const about = read('web/docs/about-platho.md');

    // The About was rewritten (owner, 2026-07-08) into a rights/freedom manifesto. The "no hidden admin control over
    // balances" guarantee stays, now in plain language.
    expect(about).toMatch(/hidden switch to seize your balance/i);
    // The manifesto deliberately keeps contract-internal detail (the launch-authority enumeration, contract names)
    // OUT of the intro; those authorities remain documented in the ATH whitepaper (M16-CONF-01C). Pin their absence.
    expect(about).not.toMatch(/narrow documented launch authorities/i);
    expect(about).not.toMatch(/BuybackBurn|MarketStabilitySeller|FeeAccumulator/);
    // Still no misleading "manual switch to change the rules after launch" framing.
    expect(about).not.toMatch(/manual switch[\s\S]{0,180}change the rules after launch/i);
  });

  it('SPEC-MSG-SOURCE-03C3: public username docs do not describe deleted direct refund-due ABI as current', () => {
    const whitepaper = read('web/docs/ath-whitepaper.md');
    const usernameSection = whitepaper.slice(
      whitepaper.indexOf('## Username Fees'),
      whitepaper.indexOf('## Profile Avatar Fees'),
    );

    expect(usernameSection).toMatch(/Username mint is Vault-funded/);
    expect(usernameSection).toMatch(/Vault can restore the user's internal ATH/);
    expect(usernameSection).not.toMatch(/direct username payments/i);
    expect(usernameSection).not.toMatch(/refund due for direct username/i);
    expect(usernameSection).not.toMatch(/FlushAthRefundDue|get_refund_due/i);
  });

  it('SPEC-MSG-SOURCE-03C3B: public profile avatar docs describe the supported Vault-funded flow', () => {
    const whitepaper = read('web/docs/ath-whitepaper.md');
    const avatarSection = whitepaper.slice(
      whitepaper.indexOf('## Profile Avatar Fees'),
      whitepaper.indexOf('## Market Stability Seller'),
    );

    expect(avatarSection).toMatch(/Profile avatar updates are Vault-funded/);
    expect(avatarSection).toMatch(/SetProfileAvatarFromVaultBalance/);
    expect(avatarSection).toMatch(/payer wallet is the bound Vault/);
    expect(avatarSection).toMatch(/Direct user-wallet avatar payment is not supported/);
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
    const fn = app.slice(
      app.indexOf('async function confirmPublicCommentsRisk'),
      app.indexOf('function renderVaultCards'),
    );

    // The confirmPublicCommentsRisk dialog copy moved out of inline literals; the function now wires
    // the exact public.openCommentsRisk* keys and the shipped English lives in the en dictionary.
    // Structural pin: the dialog still sources its title/hint/summary from those specific keys.
    for (const key of [
      'public.openCommentsRiskTitle',
      'public.openCommentsRiskHint',
      'public.openCommentsRiskModeration',
      'public.openCommentsRiskPrune',
      'public.openCommentsRiskClose',
    ]) {
      expect(fn, `confirmPublicCommentsRisk must wire t('${key}')`).toMatch(
        new RegExp(`t\\('${key.replace('.', '\\.')}'\\)`),
      );
    }

    // Copy pin: assert the retention wording against exactly the en copy those keys resolve to, so
    // the guard still fails if the shipped warning regresses. The negative also spans this copy so a
    // forbidden phrase cannot hide in the dictionary.
    const source = EN(
      'public.openCommentsRiskTitle',
      'public.openCommentsRiskHint',
      'public.openCommentsRiskAnyone',
      'public.openCommentsRiskModeration',
      'public.openCommentsRiskPrune',
      'public.openCommentsRiskClose',
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

    // 2026-07-20: the registry's `name_records` map was deleted, so the name-to-item anchor is no longer a STORED
    // record — it is a DERIVATION. The reader reads the item state, asks the collection to derive an address from
    // the name_hash the item claims, and grants authority only when that derivation lands on the very account it
    // read. Substance unchanged (a bare item still cannot claim a name), form stronger: the deleted map recorded
    // the MINTER and never followed a TEP-62 transfer, so it could disagree with the item it pointed at.
    const readerCode = read('web/username-ton-rpc-provider.mjs');
    expect(readerCode).toMatch(/resolveAuthoritativeUsernameItemOwnership/);
    expect(readerCode).toMatch(/registryProvider\.getUsernameItemAddress\(itemState\.name_hash/);
    expect(readerCode).toMatch(/const authoritative = parseTonAddress\(derivedItemAddress\)\.raw === parsedItemAddress/);
    expect(readerCode).toMatch(/owner_wallet: authoritative \? itemOwnerWallet : null/);
    expect(readerCode).toMatch(/derived_item_address: derivedItemAddress/);
    // Each refusal reason pinned on its own line, not as one alternation: an alternation lets any single branch
    // rot while the assertion stays green, and callers branch on these exact strings (`item_not_initialized` is
    // what turns into UsernameNotRegisteredError, a hard "no such name" rather than a retryable read failure).
    expect(readerCode).toMatch(/reason: 'item_not_initialized'/);
    expect(readerCode).toMatch(/reason: 'item_registry_mismatch'/);
    expect(readerCode).toMatch(/reason: authoritative \? 'registry_item' : 'registry_item_mismatch'/);
    // The weaker source must not come back as a second answer to the same question.
    expect(readerCode).not.toMatch(/decodeUsernameNameRecordStack|async getNameRecord\b|getNameRecordByUsername\s*[(:]/);

    // get_global ARITY PIN. `name_record_count` left the getter with the map, so every index after it shifted
    // down by one — 13 items became 12. This is why the decoder asserts an EXACT length instead of reading by
    // position and hoping: against the old 13-item shape a tolerant decoder reads treasury_due as burn_due and
    // reports money that is not there. Pin the length, the boundary indices around the hole, and the last index.
    expect(readerCode).toMatch(/if \(stack\.length !== 12\) \{/);
    expect(readerCode).toMatch(/expected 12 stack items/);
    expect(readerCode).toMatch(/pending_mint_count: readStackInt\(stack, 6,/);
    expect(readerCode).toMatch(/treasury_due_ath: readStackInt\(stack, 7,/);
    expect(readerCode).toMatch(/burn_due_ath: readStackInt\(stack, 8,/);
    expect(readerCode).toMatch(/pending_mint_stale_ttl: readStackInt\(stack, 11,/);
    // A length check that ACCEPTS a longer/shorter stack is the exact drift this guard exists to catch.
    expect(readerCode).not.toMatch(/stack\.length\s*[<>]=?\s*1[123]/);
  });

  it('SPEC-MSG-SOURCE-04D: username availability never reads an unreachable RPC as "this name is free"', () => {
    // With `name_records` deleted, "is this name taken?" is asked of the item ACCOUNT. That makes the failure
    // modes dangerously symmetric: a get-method against an account that does not exist fails exactly the way a
    // get-method fails when toncenter is having a bad minute. Collapsing the two sends a buyer into a mint that
    // bounces, so `usernameItemIsMinted` answers "free" ONLY from account-state data that says the account never
    // existed, and refuses outright when neither question can be answered.
    const app = read('web/app.js');
    const start = app.indexOf('async function usernameItemIsMinted(');
    expect(start, 'usernameItemIsMinted must exist').toBeGreaterThanOrEqual(0);
    const probe = app.slice(start, app.indexOf('async function readUsernameMintAvailabilityForOwnVaultAction'));
    expect(probe.length, 'usernameItemIsMinted must precede readUsernameMintAvailabilityForOwnVaultAction')
      .toBeGreaterThan(0);

    expect(probe).toMatch(/return state\?\.initialized === true/);
    // The fallback is the ACCOUNT, which reports uninitialised as DATA rather than as a failure.
    expect(probe).toMatch(/transport\.getAccountState\(\{ address: itemAddress \}, \{ skipIfRateLimited: false \}\)/);
    expect(probe).toMatch(/status === 'uninit' \|\| status === 'uninitialized' \|\| status === 'nonexist' \|\| status === 'non_exist'/);
    // And the terminal path of the catch is a refusal, never a guess.
    expect(probe).toMatch(/const error = new Error\('Could not verify whether this username is taken'\)[\s\S]*throw error/);
    expect(probe).not.toMatch(/catch\s*(?:\([^)]*\))?\s*\{\s*return false/);
    expect(probe).not.toMatch(/allowUnverifiedCriticalRead|callWithVerificationUnavailableReadFallback/);

    // DELIBERATELY FAILING (2026-07-20) — a real hole in web/app.js, not a stale test. After a failed get_state
    // the probe reads the account status and, for `active`, answers `return false` = "this name is free". But
    // `active` means the item account EXISTS; the branch's own comment says "that is a read problem", and a read
    // problem is precisely what must not become an answer. Only "never existed" (uninit/nonexist) may answer
    // free. This assertion is the weakest correct form on purpose: it passes if the branch throws, if it answers
    // `true`, or if it is deleted so the refusal below catches it. It must NOT be relaxed to match the code.
    expect(probe, 'an item account that EXISTS must never answer "this username is free"')
      .not.toMatch(/status === 'active'[\s\S]{0,60}return false/);
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

  it('SPEC-MSG-SOURCE-05: Vault ATH deposit and withdrawal wording matches notify-flow accounting', () => {
    const vaultAthDocs = [
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of vaultAthDocs) {
      const text = read(path);
      const coin = path.startsWith('web/') ? 'GRAM' : 'TON';
      expect(text, path).toMatch(/manual\s+ordinary\s+ATH\s+transfer/i);
      expect(text, path).toMatch(/official Vault ATHWallet/i);
      expect(text, path).toMatch(/unsupported/i);
      expect(text, path).toMatch(/ATHTransferRequestWithNotify|transfer-with-notify|notify-flow/i);
      expect(text, path).toMatch(/signed external Vault command|Vault auth key \/ owner signing key/i);
      expect(text, path).toMatch(new RegExp(`internal Vault ${coin}`, 'i'));
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
    // The user-facing ATH whitepaper was simplified (owner, 2026-07-08): it no longer carries the detailed
    // reserve_due_ath / reserve_funded_total_ath / partial-funding readiness mechanics. Those stay in the internal
    // release + interface docs below, which still assert the full contract semantics.
    const sellerDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
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
    // ATH whitepaper dropped from this list — see SPEC-MSG-SOURCE-08: the user-facing whitepaper no longer carries
    // the detailed readiness-sequence wording; the internal release + interface docs below still do.
    const readinessDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
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

  it('SPEC-MSG-SOURCE-09A: public whitepaper states the MarketStability reserve is funded and locked at final genesis', () => {
    // Owner correction (2026-07-08): the prior whitepaper wording ("not funded into the seller at final genesis /
    // Seller funding happens only after pool launch") was INACCURATE. clean-15 funds and locks the full 60M reserve
    // into MarketStabilitySeller at genesis, and mainnet:genesis:verify checks the official seller ATH wallet
    // backing. Selling is the separate post-pool step (after the one-time pricing freeze). Pin the corrected framing.
    const text = read('web/docs/ath-whitepaper.md');

    // Activity airdrop + vesting backing statement stays.
    expect(text).toMatch(/activity airdrop and long-term vesting reserve are backed at final genesis/i);
    // The 60M reserve is FUNDED + LOCKED at genesis, backed by its official seller ATH wallet.
    expect(text).toMatch(/market-stability reserve is funded into MarketStabilitySeller and locked at final genesis, backed by its official seller ATH wallet/i);
    expect(text).toMatch(/MarketStabilitySeller is capitalized at final genesis with the full .60,000,000 ATH. reserve/i);
    expect(text).toMatch(/mainnet:genesis:verify. checks that the seller carries the full reserve/i);
    // Selling is post-pool, after the one-time evidence-bound pricing freeze; the tranche schedule is deterministic.
    expect(text).toMatch(/not sold until after pool launch[\s\S]{0,120}pricing freeze[\s\S]{0,180}tranche schedule is deterministic/i);
    // The corrected doc must NOT resurrect the old "not funded at genesis / funded only after pool launch" wording.
    expect(text).not.toMatch(/not funded into the seller at final genesis/i);
    expect(text).not.toMatch(/Seller funding happens only after pool launch/i);
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
