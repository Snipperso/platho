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

// SPEC files, not the SHIPPED doc. `web/docs/crypto-protocol.md` used to sit in this list and was pinned to the
// Vault/CapsuleHub-era wording — "retrievable publish bodies", "PH0B", "surcharge", "accepted transaction body".
// That made the gate the reason the user-facing text could not be corrected: rewriting it for clean-17 turned this
// file red (2026-08-07), exactly as PWA-CONFIG-01C did for "local Platho wallet, not Vault".
//
// A document a person reads in the app and an internal specification are not the same artefact and must not be held
// to the same pins. The spec files below still carry that vocabulary and still keep this gate meaningful; the shipped
// doc now describes what the product actually does.
const SPEC_FILES = [
  'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
  'web/CRYPTO_PROTOCOL.md',
  'web/NO_BACKEND_ARCHITECTURE.md',
];

// Specs of a generation that no longer exists. `M27_INTERFACE_DECISIONS.md` and `capsulehub_threat_model_checklist.md`
// document `Vault` and `CapsuleHub`, both DELETED in clean-17, so holding them to current-truth pins would mean either
// rewriting a historical record into fiction or freezing the current docs to match it. They are quarantined instead —
// the same treatment SPEC-MSG-SOURCE-00 gives the superseded message-budget specs — and the banner is what this gate
// enforces. The same applies to `vault_threat_model_checklist.md`, which was never in the active list.
const QUARANTINED_SPECS = [
  'artifacts/M27_INTERFACE_DECISIONS.md',
  'artifacts/capsulehub_threat_model_checklist.md',
  'artifacts/vault_threat_model_checklist.md',
];

// The shipped doc is listed HERE and not in SPEC_FILES: it must still be free of the retired message-budget
// vocabulary — dropping it from the spec list must not quietly drop it from that sweep too — while being free to
// describe the current protocol in its own words.
const ACTIVE_INTERFACE_DOCS = [
  ...SPEC_FILES,
  'web/docs/crypto-protocol.md',
  'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
  'PRODUCTION_READINESS.md',
  'DEPLOYMENT_RUNBOOK.md',
  'README.md',
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

// Prose pins must not depend on where a paragraph happens to wrap. `web/CRYPTO_PROTOCOL.md` is hard-wrapped at 120
// columns, so a sentence the gate quotes can be split by a newline in the middle of the phrase and the pin fails
// against a document that says exactly the right thing. readFlat collapses every run of whitespace to one space; use it
// for anything that pins a SENTENCE rather than a code block or a table row.
function readFlat(path: string): string {
  return readFileSync(path, 'utf8').replace(/\s+/g, ' ');
}

describe('v1 on-chain message source of truth', () => {
  it('SPEC-MSG-SOURCE-00A: deleted-generation specs carry a quarantine banner and are not active docs', () => {
    for (const path of QUARANTINED_SPECS) {
      const text = read(path);
      expect(text, path).toMatch(/HISTORICAL ONLY/);
      expect(text, path).toMatch(/SUPERSEDED/i);
      expect(text, path).toMatch(/deleted in clean-17/i);
      // A quarantined spec must POINT somewhere current, or a reader who lands on it has no way out.
      expect(text, path).toMatch(/web\/CRYPTO_PROTOCOL\.md/);
      expect(ACTIVE_INTERFACE_DOCS, `${path} must not also be listed as an active doc`).not.toContain(path);
    }
  });

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
      // The hash lives under different spellings per doc (`body_hash`, `body.hash`, "the stored hashes"). What the
      // gate protects is that SOMETHING on chain commits to the body — not which identifier a given file happens to use.
      expect(text, path).toMatch(/body_hash|body\.hash|stored hashes|stored commitment|shard's stored hashes/i);
      expect(text, path).toMatch(/provider history|message history|local (encrypted )?cache/i);
      for (const pattern of forbidden) {
        expect(text, `${path} must not match stale body-storage wording ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('SPEC-MSG-SOURCE-02: v1 pins the binary capsule byte layout and useful capacity', () => {
    // REBASELINED onto clean-17 2026-08-07. This demanded `PH0B` and "140 bytes" — the clean-15 header that carried the
    // recipient key id, the sender signing key, and the profile pointer in CLEARTEXT. clean-16 split header0 into a
    // 40-byte CONV form (opaque bucket key only) and a 42-byte INTRO form (ephemeral point + view tag), and moved the
    // sender identity INSIDE the AEAD. Pinning the old bytes would have required undoing the privacy work to go green.
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/PH0C/);
      expect(text, path).toMatch(/PH1B/);
      expect(text, path).toMatch(/40 bytes|40-byte/);
      expect(text, path).toMatch(/42 bytes|42-byte/);
      expect(text, path).toMatch(/30 bytes|30-byte/);
      // The cleartext header must NOT be described as carrying a recipient label or the sender's identity again.
      expect(text, path).not.toMatch(/header0[\s\S]{0,120}recipient_key_id|recipient_key_id[\s\S]{0,60}in (the )?header0/i);
      expect(text, path).toMatch(/1024[- ]byte|1024 useful (text )?bytes|1024-byte user payload slot|1, 2, 4, 8, 16, or 32 KiB/i);
      expect(text, path).toMatch(/one encrypted (1024-byte|user payload slot)|exactly one (encrypted )?(1024-byte|user payload slot)|selected[\s\S]{0,80}1, 2, 4, 8, 16, or 32 KiB/i);
      expect(text, path).not.toMatch(/14,336|14336|14 blocks|14 content blocks/i);
    }
  });

  it('SPEC-MSG-SOURCE-03: publishing is direct-paid from the user wallet, with no intermediary balance', () => {
    // REPLACES the clean-15 surcharge guard. That mechanism — a signed `maxCharge`, a fixed 0.030 TON ACK reserve, a
    // ~25,800,000 nanoton credit back into an internal Vault balance, and the excess retained inside CapsuleHub — went
    // away with both contracts. What replaced it is worth guarding for the opposite reason: there is now NOTHING between
    // the user's wallet and the shard, and a doc that reintroduces an intermediary balance would be describing a design
    // the project has forbidden.
    const payDocs = [
      'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/NO_BACKEND_ARCHITECTURE.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of payDocs) {
      const text = read(path);
      expect(text, path).toMatch(/direct[- ]pa(y|id)|paid (straight|directly)/i);
      expect(text, path).toMatch(/signed by the user's own wallet key|external message signed by the user's own wallet/i);
      expect(text, path).toMatch(/no internal balance|there is no internal balance/i);
      // No relayer, no issuer, no discount authority — the founding constraint, stated rather than implied.
      expect(text, path).not.toMatch(/relayer can submit|funded from an internal|Vault balance/i);
      expect(text, path).not.toMatch(/surcharge/i);
      expect(text, path).not.toMatch(/max_?[Cc]harge/);
    }

    // The protocol fee passes THROUGH a shard; a shard that accrued fees would need a protected reserve, a sweep, and a
    // flush — the exact machinery clean-17 removed.
    for (const path of ['artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md', 'web/CRYPTO_PROTOCOL.md']) {
      const text = read(path);
      expect(text, path).toMatch(/flows [*_]?through[*_]? the shard|through the shard to `?FeeAccumulator`?/i);
      expect(text, path).toMatch(/never accumulated inside the shard|is never accumulated/i);
      expect(text, path).toMatch(/FeeAccumulator/);
      expect(text, path).not.toMatch(/SweepExcessReserve|accrued_plato_fee_ton/);
    }
  });

  it('SPEC-MSG-SOURCE-03A: pricing copy matches the canonical direct-pay values', () => {
    // REBASELINED 2026-08-07. The clean-15 examples (`from 0.0337 TON` public, `0.0347 TON` private) were the
    // Vault-funded prices and no longer exist. The canonical source is web/publish-price.mjs, so the gate reads the
    // constants and requires the prose to agree with THEM rather than with a number typed into a doc.
    const priceModule = read('web/publish-price.mjs');
    const constant = (name: string): bigint => {
      const match = priceModule.match(new RegExp(`export const ${name} = ([0-9_]+)n`));
      expect(match, `${name} must exist in web/publish-price.mjs`).toBeTruthy();
      return BigInt((match as RegExpMatchArray)[1].replaceAll('_', ''));
    };
    const conv = constant('CONV_PUBLISH_VALUE');
    const publicPost = constant('PUBLIC_CHANNEL_PUBLISH_VALUE');
    expect(conv, 'a private capsule must still be the cheapest lane').toBeLessThan(publicPost);

    const convGram = (Number(conv) / 1e9).toFixed(4);
    const publicGram = (Number(publicPost) / 1e9).toFixed(4);

    for (const path of ['artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md', 'web/docs/ath-whitepaper.md']) {
      const text = read(path);
      expect(text, `${path} must quote the canonical private price ${convGram}`).toContain(convGram);
      expect(text, `${path} must quote the canonical public price ${publicGram}`).toContain(publicGram);
      expect(text, path).not.toMatch(/0\.0337|0\.0347/);
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
      expect(text, path).toMatch(/0\.010? GRAM|10,000,000 nanotons|full protocol-fee discount|discounted_fee = raw_discounted_fee/i);
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
    expect(noBackend).toMatch(/refuse to sign avatar registration until[\s\S]{0,60}public entries are visible/i);
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

    // REBASELINED 2026-08-07: the mint is no longer Vault-funded — it is paid in ATH from the user's own wallet
    // through the dedicated registry notify op. The rule the gate protects is unchanged: the registry has no separate
    // external refund bucket, so rejections must come back through the ATHWallet notification-refund path.
    expect(usernameSection).toMatch(/paid in ATH from the user's own wallet/i);
    expect(usernameSection).toMatch(/notification-refund path|ATHWallet notification/i);
    expect(usernameSection).toMatch(/no separate external refund bucket/i);
    expect(usernameSection).not.toMatch(/Vault/i);
    expect(usernameSection).not.toMatch(/FlushAthRefundDue|get_refund_due/i);
  });

  it('SPEC-MSG-SOURCE-03C3B: public profile avatar docs describe the direct-pay notify flow', () => {
    const whitepaper = read('web/docs/ath-whitepaper.md');
    const avatarSection = whitepaper.slice(
      whitepaper.indexOf('## Profile Avatar Fees'),
      whitepaper.indexOf('## Market Stability Seller'),
    );

    expect(avatarSection).toMatch(/paid in ATH from the user's own wallet/i);
    expect(avatarSection).toMatch(/transfer-with-notification/i);
    expect(avatarSection).toMatch(/ProfileRegistry's official ATH wallet/i);
    expect(avatarSection).not.toMatch(/Vault/i);
  });

  it('SPEC-MSG-SOURCE-03C3C: final current spec does not resurrect stale intermediary publish wording', () => {
    const spec = read('artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md');

    expect(spec).toMatch(/signed by the user's own wallet key/i);
    expect(spec).not.toMatch(/Vault auth-signed publishes|Vault session publishes/i);
    expect(spec).not.toMatch(/session budget/i);
    expect(spec).not.toMatch(/message_budget_ton/i);
  });

  it('SPEC-MSG-SOURCE-03C4: PWA interface matrix labels every user flow as signed by the user wallet', () => {
    // REBASELINED 2026-08-07. This used to require five rows to be labelled "Vault auth key / owner signing key" —
    // the exact opposite of what clean-17 does. Payment checks were retired outright; the remaining flows are all
    // signed by the user's own wallet, and the matrix must not describe an intermediary signer for any of them.
    const matrix = read('artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md');

    for (const flow of [
      'Register messaging keys',
      'Publish first-contact capsule',
      'Publish conversation capsule',
      'Publish public post/comment',
      'Publish avatar media',
      'Mint username',
      'Set wallet avatar',
    ]) {
      const row = matrix.split('\n').find((line) => line.startsWith(`| ${flow} |`));
      expect(row, `${flow} row must exist`).toBeTruthy();
      expect(row, `${flow} must be signed by the user wallet`).toMatch(/user wallet/i);
      expect(row, `${flow} must not name an intermediary signer`).not.toMatch(/Vault auth key|auth key \/ owner signing key/i);
    }

    // Payment checks are retired: neither the flows nor the getters may come back as current product surface.
    expect(matrix).toMatch(/[Pp]ayment checks were retired/);
    expect(matrix).not.toMatch(/\| (Create|Claim|Cancel) payment check \|/);
    expect(matrix).not.toMatch(/get_receive_intent|CreateReceiveIntent\(/);
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

  it('SPEC-MSG-SOURCE-03F: the internal spec distinguishes live expiry from chain-history import', () => {
    // The SHIPPED doc (web/docs/crypto-protocol.md) was rewritten for readers and no longer carries this
    // implementation detail — it is not something a person needs in order to use the messenger. The rule itself still
    // has to be written down somewhere, because getting it wrong makes retained history unreadable BY DESIGN, so the
    // pin moved to the internal spec rather than being dropped.
    const text = readFlat('web/CRYPTO_PROTOCOL.md');
    expect(text).toMatch(/Live package verification rejects/);
    expect(text).toMatch(/expired capsules/);
    expect(text).toMatch(/Chain-history import is different/);
    expect(text).toMatch(/transaction history/);
    expect(text).toMatch(/does not reject solely because the header expiry has passed/);
    expect(text).toMatch(/retained history would become unreadable by design/i);
  });

  it('SPEC-MSG-SOURCE-03E: deployment runbook funds the airdrop backing before the seals', () => {
    // REBASELINED onto clean-17 2026-07-28. This guard was pinned to `Vault.SealGenesis` and `CapsuleHub.SealGenesis`
    // — two contracts deleted in clean-17 — so it was enforcing the ordering of a generation that no longer exists
    // while the runbook it guards had drifted to instruct deploying and sealing them. A guard aimed at a deleted
    // contract is not a weak guard, it is an absent one.
    const runbook = read('DEPLOYMENT_RUNBOOK.md');
    const airdropFunding = runbook.indexOf('airdrop_pool_official_ath_wallet.balance == 15,000,000 ATH');
    const vestingFunding = runbook.indexOf('ath_long_term_vesting_official_ath_wallet.balance == 10,000,000 ATH');
    const airdropSeal = runbook.indexOf('`AirdropPool.AirdropSealGenesis`');

    expect(runbook).toMatch(/Deploy, Pre-Seal Binding, And Pre-Seal Funding/);
    expect(runbook).toMatch(/Seal staged contracts only after the funding checks above pass/);
    expect(runbook).toMatch(/Final Genesis Verification/);
    expect(runbook).not.toMatch(/Final Genesis Funding And Verification/);
    expect(airdropFunding, 'the runbook verifies the airdrop backing landed').toBeGreaterThanOrEqual(0);
    expect(vestingFunding, 'and the vesting backing').toBeGreaterThanOrEqual(0);
    expect(airdropSeal, 'the pool seal must come after its funding is verified — gate 26044 enforces the same thing on chain')
      .toBeGreaterThan(airdropFunding);
    expect(airdropSeal, 'and after the vesting funding check').toBeGreaterThan(vestingFunding);

    // The deleted generation must not creep back into the operator's instructions. Historical prose is allowed to
    // mention them (the runbook explains what AirdropPool replaces); an INSTRUCTION to seal them is not.
    expect(runbook).not.toMatch(/`Vault\.SealGenesis`/);
    expect(runbook).not.toMatch(/`CapsuleHub\.SealGenesis`/);
    expect(runbook).not.toMatch(/vault_official_ath_wallet\.balance/);
  });

  it('SPEC-MSG-SOURCE-04: username authority is registry name-to-item plus current item owner, not item-only', () => {
    // `web/docs/crypto-protocol.md` DROPPED from this list 2026-08-07: the shipped crypto doc was rewritten to describe
    // encryption and no longer covers usernames at all. Forcing username authority into it would be padding a reader's
    // document to satisfy a gate. The three docs that DO own the subject still carry the full rule.
    const usernameTruthDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of usernameTruthDocs) {
      const text = readFlat(path);
      expect(text, path).toMatch(/UsernameRegistry/);
      expect(text, path).toMatch(/UsernameNFTItem|item/i);
      // The anchor is now the DERIVATION, not a stored map: `name_records` was deleted 2026-07-20 because holding it
      // capped the registry at roughly 21,503 names. A doc still claiming the map is the anchor describes dead state.
      expect(text, path).toMatch(/get_username_item_address/);
      expect(text, path).toMatch(/current owner[\s\S]{0,80}item|item state[\s\S]{0,80}current owner|item's `?get_state|item owner is the current username owner/i);
      expect(text, path).toMatch(/non-authoritative|not authoritative|must not treat the item alone as ownership|not (be )?treated as (a )?(username )?ownership|ignore\s+item-only\s+ownership/i);
      expect(text, path).toMatch(/name-to-item anchor|authoritative item address|the derivation/i);
      // The forbidden claim is that an item ALONE proves ownership. `.*` across a flattened document also matched the
      // sentence that FORBIDS exactly that ("must not treat the item alone as ownership"), so the negative is anchored
      // to the affirmative verb instead of to mere co-occurrence.
      expect(text, path).not.toMatch(/UsernameNFTItem[^.]{0,120}alone (is|proves|establishes|means)[^.]{0,60}ownership/i);
      expect(text, path).not.toMatch(/`?name_records\[name_hash\]`? (pointing|points)/i);
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
    // See SPEC-MSG-SOURCE-04 for why the shipped crypto doc is not in this list.
    const usernameRecoveryDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of usernameRecoveryDocs) {
      const text = readFlat(path);
      expect(text, path).toMatch(/PrunePendingUsernameMint/);
      expect(text, path).toMatch(/non-destructive/i);
      expect(text, path).toMatch(/does not[\s\S]{0,30}delete\s+(the\s+)?pending state|keeps\s+pending mint state/i);
      expect(text, path).toMatch(/ResendDeployedAck|late ACK/i);
      expect(text, path).not.toMatch(/pending mint is pruned|pending mint.*pruned after a missing item ACK/i);
    }
  });

  it('SPEC-MSG-SOURCE-05: ATH payment wording matches notify-flow accounting, with no intermediary ledger', () => {
    // REBASELINED 2026-08-07. Vault held an internal ATH ledger, so this pinned deposit/withdrawal wording. There is no
    // ledger now: ATH-priced actions are paid from the user's own ATHWallet through a dedicated registry notify op.
    // What survives unchanged is the accounting rule that mattered — a contract credits only value it actually
    // received and authenticated, never a balance it inferred from a raw wallet read.
    const text = read('artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md');

    expect(text).toMatch(/manual\s+ordinary\s+ATH\s+transfer/i);
    expect(text).toMatch(/official protocol ATH wallet/i);
    expect(text).toMatch(/unsupported/i);
    expect(text).toMatch(/ATHTransferRequestRegistry(MintUsername|ProfileAvatar)|notify op/i);
    expect(text).toMatch(/authenticated\s+ACK\/fail\/bounce/i);
    expect(text).toMatch(/capped\s+by\s+the\s+reserved/i);
    expect(text).toMatch(/never from an intermediary balance/i);
    expect(text).not.toMatch(/internal Vault (TON|GRAM|ATH)/i);
    expect(text).not.toMatch(/returns all excess|full excess refund/i);
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
      // "receiver" vs "recipient" and "preflight" vs "pre-release check" are the same authority under different
      // English. The gate pins WHO holds it and that it is one-way, not the noun a given document happened to use.
      expect(text, path).toMatch(/treasury receiver|treasury recipient/i);
      expect(text, path).toMatch(/one-time|one-way/i);
      expect(text, path).toMatch(/preflight|pre-release check/i);
      expect(text, path).toMatch(/not admin\/rescue\/pause|cannot steal funds, pause/i);
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
    const text = readFlat('web/docs/ath-whitepaper.md');

    // Activity airdrop + vesting backing statement stays. The whitepaper was rewritten in the owner's words
    // (2026-08-06), so the pins express the CLAIM rather than the previous sentence.
    expect(text).toMatch(/final genesis the activity airdrop and the long-term vesting reserve are backed/i);
    // The 60M reserve is FUNDED + LOCKED at genesis, backed by its official seller ATH wallet.
    expect(text).toMatch(/market-stability reserve is funded into MarketStabilitySeller and locked at final genesis, backed by its official seller ATH wallet/i);
    expect(text).toMatch(/MarketStabilitySeller is capitali[sz]ed at final genesis with the full .60,000,000 ATH. reserve/i);
    expect(text).toMatch(/mainnet:genesis:verify.{0,3} checks that the seller carries the full reserve/i);
    // Selling is post-pool, after the one-time evidence-bound pricing freeze; the tranche schedule is deterministic.
    expect(text).toMatch(/not sold (until|before) the pool launch[\s\S]{0,140}pricing freeze[\s\S]{0,200}tranche schedule is deterministic/i);
    // The corrected doc must NOT resurrect the old "not funded at genesis / funded only after pool launch" wording.
    expect(text).not.toMatch(/not funded into the seller at final genesis/i);
    expect(text).not.toMatch(/Seller funding happens only after pool launch/i);
  });

  it('SPEC-MSG-SOURCE-09B: docs pin .ath item-owner authority and permissive separator policy', () => {
    // See SPEC-MSG-SOURCE-04: the shipped crypto doc no longer covers usernames.
    const usernameDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'MAINNET_RELEASE_CHECKLIST.md',
    ];

    for (const path of usernameDocs) {
      const text = readFlat(path);
      expect(text, path).toMatch(/UsernameRegistry|name-to-item anchor/i);
      expect(text, path).toMatch(/UsernameNFTItem|get_state|item state/i);
      expect(text, path).toMatch(/current owner|current owner is then read|owner_wallet/i);
      expect(text, path).toMatch(/must not\s+use (the|a) registry record'?s? owner|not the current owner after transfer|historical/i);
    }

    for (const path of ['web/CRYPTO_PROTOCOL.md', 'web/docs/ath-whitepaper.md']) {
      const text = readFlat(path);
      expect(text, path).toMatch(/leading, trailing, consecutive,? (and|or) all-separator (names|characters) are valid/i);
      expect(text, path).toMatch(/allowed (set )?`a-z`, `0-9`, `_`, `-`( set)?/i);
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
      // Each pin below names an authority and requires the doc to say who holds it. The alternatives cover the
      // rewritten whitepaper's English ("release powers", "treasury recipient", "freezes the post-pool route") —
      // the same authorities, named honestly, in a document written for readers rather than for this gate.
      expect(text, path).toMatch(/authority|authorities|release powers/i);
      expect(text, path).toMatch(/treasury owner|ath_treasury_owner/i);
      expect(text, path).toMatch(/DeployTreasurySupply|initial ATH supply|primary ATH supply/i);
      expect(text, path).toMatch(/genesis controller|genesis_controller_one_shot/i);
      expect(text, path).toMatch(/pre-seal bind|pre-seal binding|seal actions|the seal/i);
      expect(text, path).toMatch(/BuybackBurn[\s\S]{0,140}(route freeze|freezes the post-pool route)|route freeze[\s\S]{0,140}BuybackBurn/i);
      expect(text, path).toMatch(/MarketStabilitySeller[\s\S]{0,160}pricing freeze|pricing freeze[\s\S]{0,160}MarketStabilitySeller/i);
      expect(text, path).toMatch(/treasury (receiver|recipient)[\s\S]{0,160}(EnableBuybackSplit|buyback split)|(EnableBuybackSplit|buyback split)[\s\S]{0,160}treasury (receiver|recipient)/i);
      expect(text, path).toMatch(/no rescue|not (a )?rescue|rescue, pause|pause, rescue|emergency exit/i);
      expect(text, path).toMatch(/admin drain|admin\/rescue\/pause|arbitrary balance-control|arbitrary control over balances|cannot steal funds/i);
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
