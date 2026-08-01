#!/usr/bin/env node
/*
 * THE ORDER IN WHICH A CONTRACT EDIT PROPAGATES.
 *
 * Editing ATHWallet moves every contract that embeds its code, which moves FeeAccumulator's address, which is BAKED
 * into four other contracts, which moves their code hashes, which are pinned in tests, reports, ceremony packets and
 * two hand-written input files. Eleven steps, and the order is not optional.
 *
 * Written 2026-08-01 after running this by hand three times in one day and losing a full-suite pass each time to a
 * step remembered late. Every step verifies rather than assumes, and the run stops at the first thing that does not
 * hold, naming what a human has to decide.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: rebake FEE_SINK. That constant is a copy of a DERIVED address, and this project
 * has already baked one from a test literal instead of from the ceremony — the airdrop was dead on arrival while a
 * guard proved a self-consistent fiction. So when the sink has moved, this prints the exact edit and STOPS. A tool
 * that silently rewrites the address a guard then checks is a tool that turns the guard into an echo.
 *
 *   node scripts/rebaseline_cascade.mjs          report what is stale, change nothing
 *   node scripts/rebaseline_cascade.mjs --run    regenerate everything that is derived
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { Address } from '@ton/core';

const RUN = process.argv.includes('--run');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const STEPS = [
  { name: 'сборка контрактов', cmd: `${npm} run build` },
  { name: 'хеши кода', cmd: 'node scripts/hash_codes.js' },
  { name: 'web/shard-code.mjs', cmd: 'node scripts/generate_shard_code.mjs' },
  { name: 'черновик манифеста', cmd: `${npm} run mainnet:manifest:draft` },
  // The sink check lives here, between the draft and the packets: the draft is what knows the new FeeAccumulator
  // address, and the packets are what would embed a wrong one.
  { name: 'СТОП-ПРОВЕРКА: FEE_SINK', check: checkFeeSink },
  { name: 'СТОП-ПРОВЕРКА: фикстура FA_BUYBACK', check: checkBuybackFixture },
  { name: 'пакет деплоя', cmd: `${npm} run mainnet:deploy:packet` },
  { name: 'пакет транзакций', cmd: `${npm} run mainnet:tx:dry-run` },
  { name: 'деривация ATHMaster', cmd: `${npm} run mainnet:ath-master:derive` },
  { name: 'деривация m20f', cmd: `${npm} run m20f:derive-addresses` },
  { name: 'экономика ATHWallet', cmd: tsNode('scripts/ath_wallet_tombstone_economics.ts') },
  { name: 'экономика ProfileRegistry', cmd: tsNode('scripts/profile_registry_storage_economics.ts') },
  { name: 'экономика UsernameRegistry', cmd: tsNode('scripts/username_registry_storage_economics.ts') },
  { name: 'отчёт цен публикации', cmd: `${npm} run pricing:report` },
  { name: 'проверка генезиса', cmd: `${npm} run mainnet:genesis:verify`, allowFail: true },
  { name: 'веб-препреп (preview)', cmd: `${npm} run web:deploy:prepare` },
  // Both of these exit non-zero before genesis and are SUPPOSED to: the production bundle is blocked on
  // MAINNET_GENESIS_NOT_VERIFIED, which cannot clear until the chain is read after deployment. They still write
  // their artifacts, which is what the rest of the tree pins, so a non-zero code here is not a cascade failure.
  { name: 'веб-препреп (production)', cmd: `${npm} run web:deploy:prepare:prod`, allowFail: true },
];

function tsNode(script) {
  return `npx ts-node --compiler-options "{\\"module\\":\\"CommonJS\\"}" ${script}`;
}

function draftAddresses() {
  const path = 'artifacts/local/mainnet_final_manifest_draft.json';
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')).manifest?.addresses ?? null;
}

/** The four contracts that carry a copy of FeeAccumulator's address. */
function checkFeeSink() {
  const addresses = draftAddresses();
  if (!addresses) return { ok: true, note: 'черновика нет — пропуск' };
  const want = addresses.fee_accumulator;
  const files = {
    'contracts/RecordShard.tact': 'RS_FEE_SINK',
    'contracts/IntroShard.tact': 'IS_FEE_SINK',
    'contracts/PublicShard.tact': 'PS_FEE_SINK',
    'contracts/AirdropTicket.tact': 'AT_FEE_SINK',
  };
  const stale = [];
  for (const [file, constant] of Object.entries(files)) {
    const m = readFileSync(file, 'utf8').match(new RegExp(`const ${constant}: Address = address\\("([^"]+)"\\)`));
    if (!m) return { ok: false, note: `${constant} не найден в ${file} — константу переименовали или удалили` };
    if (!sameAddress(m[1], want)) stale.push(`  ${file}: ${constant} = ${m[1]}`);
  }
  if (!stale.length) return { ok: true };
  return {
    ok: false,
    note: `FeeAccumulator церемонии = ${want}\n${stale.join('\n')}\n`
      + '  ЧЕЛОВЕК: впиши bounceable (EQ) форму этого адреса в четыре константы и запусти заново.\n'
      + '  Автоматически не переписываю: это копия ВЫВОДИМОГО адреса, и однажды сюда уже попал тестовый литерал.',
  };
}

function checkBuybackFixture() {
  const addresses = draftAddresses();
  const path = 'tests/helpers/fee-sink-fixture.ts';
  if (!addresses || !existsSync(path)) return { ok: true, note: 'черновика нет — пропуск' };
  const m = readFileSync(path, 'utf8').match(/export const FA_BUYBACK = Address\.parse\('([^']+)'\)/);
  if (!m) return { ok: false, note: 'FA_BUYBACK не найден в фикстуре' };
  if (sameAddress(m[1], addresses.buyback_burn)) return { ok: true };
  return {
    ok: false,
    note: `фикстура = ${m[1]}\n  церемония = ${addresses.buyback_burn}\n`
      + '  ЧЕЛОВЕК: обнови FA_BUYBACK в tests/helpers/fee-sink-fixture.ts.',
  };
}

/**
 * UQ and EQ are the same account with a different bounceable flag. Slicing the strings does NOT work: base64 packs
 * three bytes into four characters, so the flag byte shares its characters with the start of the hash and the
 * checksum differs too. Parse and compare what identifies the account.
 */
function sameAddress(a, b) {
  try {
    return Address.parse(String(a)).toRawString() === Address.parse(String(b)).toRawString();
  } catch {
    return false;
  }
}

let failed = 0;
for (const step of STEPS) {
  if (step.check) {
    const result = step.check();
    if (result.ok) {
      console.log(`  ok   ${step.name}${result.note ? ` (${result.note})` : ''}`);
      continue;
    }
    console.log(`  СТОП ${step.name}\n${result.note}`);
    failed = 1;
    break;
  }
  if (!RUN) {
    console.log(`  --   ${step.name} (сухой прогон)`);
    continue;
  }
  try {
    execSync(step.cmd, { stdio: 'pipe' });
    console.log(`  ok   ${step.name}`);
  } catch (e) {
    if (step.allowFail) {
      console.log(`  ok   ${step.name} (ненулевой код — ожидаемо до генезиса)`);
      continue;
    }
    console.log(`  ПАДЕНИЕ ${step.name}\n${String(e.stdout ?? e).slice(-1200)}`);
    failed = 1;
    break;
  }
}

if (!failed) {
  console.log(RUN
    ? '\n  Каскад пройден. Дальше вручную: пины хешей шардов в тестах и рукописные *_input.json — их не двигает ничто, кроме рук.'
    : '\n  Сухой прогон. Запусти с --run, чтобы пересобрать.');
}
process.exit(failed);
