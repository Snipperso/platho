
import { readFileSync, writeFileSync } from 'node:fs';
import { Cell } from '@ton/core';
import {
  CONV_MIN_VALUE, CONV_PUBLISH_VALUE,
  INTRO_MIN_VALUE, INTRO_PUBLISH_VALUE,
  RECOVERY_PUBLISH_VALUE, KEYSHARD_REGISTER_VALUE,
  PUBLIC_CHANNEL_PUBLISH_VALUE, PUBLIC_THREAD_PUBLISH_VALUE,
  PUBLIC_BEACON_PUBLISH_VALUE, PUBLIC_AVATAR_PUBLISH_VALUE,
} from '../web/publish-price.mjs';

function constOf(src, name) {
  const m = src.match(new RegExp(`^const ${name}: Int = ([^;]+);`, 'm'));
  if (!m) throw new Error(`${name} not found`);
  const expr = m[1].trim();
  if (/^\d+$/.test(expr)) return BigInt(expr);
  return expr.split('+').map((t) => t.trim())
    .reduce((sum, t) => sum + (/^\d+$/.test(t) ? BigInt(t) : constOf(src, t)), 0n);
}

function codeHash(path) {
  return Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
}

const REC = readFileSync('contracts/RecordShard.tact', 'utf8');
const INT = readFileSync('contracts/IntroShard.tact', 'utf8');
const RCV = readFileSync('contracts/RecoveryShard.tact', 'utf8');
const PUB = readFileSync('contracts/PublicShard.tact', 'utf8');
const KEY = readFileSync('contracts/KeyShard.tact', 'utf8');

const PUBLIC_TAIL = constOf(PUB, 'PS_PUBLISH_GAS') + constOf(PUB, 'PS_PROTOCOL_FEE') + constOf(PUB, 'PS_FEE_TRANSPORT');
const publicDeployMin = (entry, base) => constOf(PUB, entry) + constOf(PUB, base) + PUBLIC_TAIL;


const LANES = [
  { id: 'conv_first_publish', lane: 'CONV', contract: 'RecordShard', gate: 'RS_DEPLOY_MIN_VALUE',
    contractFloor: constOf(REC, 'RS_DEPLOY_MIN_VALUE'), clientAttaches: CONV_PUBLISH_VALUE },
  { id: 'conv_steady_publish', lane: 'CONV', contract: 'RecordShard', gate: 'RS_MIN_VALUE',
    contractFloor: constOf(REC, 'RS_MIN_VALUE'), clientAttaches: CONV_PUBLISH_VALUE },
  { id: 'intro_first_publish', lane: 'INTRO', contract: 'IntroShard', gate: 'IS_DEPLOY_MIN_VALUE',
    contractFloor: constOf(INT, 'IS_DEPLOY_MIN_VALUE'), clientAttaches: INTRO_PUBLISH_VALUE },
  { id: 'intro_steady_publish', lane: 'INTRO', contract: 'IntroShard', gate: 'IS_MIN_VALUE',
    contractFloor: constOf(INT, 'IS_MIN_VALUE'), clientAttaches: INTRO_PUBLISH_VALUE },
  { id: 'recovery_write', lane: 'RECOVERY', contract: 'RecoveryShard', gate: 'RS_MIN_VALUE',
    contractFloor: constOf(RCV, 'RS_MIN_VALUE'), clientAttaches: RECOVERY_PUBLISH_VALUE },
  { id: 'keyshard_register', lane: 'KEY', contract: 'KeyShard', gate: 'KS_MIN_REGISTER_VALUE',
    contractFloor: constOf(KEY, 'KS_MIN_REGISTER_VALUE'), clientAttaches: KEYSHARD_REGISTER_VALUE },
  { id: 'public_channel_first', lane: 'PUBLIC/CHANNEL', contract: 'PublicShard', gate: 'deployMinValue(POST)',
    contractFloor: publicDeployMin('PS_ENTRY_ENDOWMENT_POST', 'PS_BASE_ENDOWMENT_POST'),
    clientAttaches: PUBLIC_CHANNEL_PUBLISH_VALUE },
  { id: 'public_thread_first', lane: 'PUBLIC/THREAD', contract: 'PublicShard', gate: 'deployMinValue(POST)',
    contractFloor: publicDeployMin('PS_ENTRY_ENDOWMENT_POST', 'PS_BASE_ENDOWMENT_POST'),
    clientAttaches: PUBLIC_THREAD_PUBLISH_VALUE },
  { id: 'public_beacon_first', lane: 'PUBLIC/BEACON', contract: 'PublicShard', gate: 'deployMinValue(BEACON)',
    contractFloor: publicDeployMin('PS_ENTRY_ENDOWMENT_BEACON', 'PS_BASE_ENDOWMENT_BEACON'),
    clientAttaches: PUBLIC_BEACON_PUBLISH_VALUE },
  { id: 'public_avatar_first', lane: 'PUBLIC/AVATAR', contract: 'PublicShard', gate: 'deployMinValue(AVATAR)',
    contractFloor: publicDeployMin('PS_ENTRY_ENDOWMENT_AVATAR', 'PS_BASE_ENDOWMENT_AVATAR'),
    clientAttaches: PUBLIC_AVATAR_PUBLISH_VALUE },
];

const cases = LANES.map((l) => ({
  id: l.id,
  lane: l.lane,
  contract: l.contract,
  contract_gate: l.gate,
  contract_floor_nanotons: l.contractFloor.toString(),
  client_attaches_nanotons: l.clientAttaches.toString(),
  margin_nanotons: (l.clientAttaches - l.contractFloor).toString(),
  protocol_fee_nanotons: '10000000',
}));

const underfunded = cases.filter((c) => BigInt(c.margin_nanotons) < 0n);

const report = {
  profile: 'PLATHO.V1.PUBLISH_RESERVE_PRICING',
  status: underfunded.length === 0 ? 'PASS' : 'BLOCKED',
  generated_at: 'DETERMINISTIC_ARTIFACT',
  model: 'clean-17 direct-pay: a flat per-lane wallet send whose floor is the receiving shard gate; the shard '
    + 'reserves its rent and returns the surplus. No hold, no max_charge, no size classes — those belonged to the '
    + 'deleted Vault batch model.',
  code_hashes: {
    ath_wallet: codeHash('build/ATHWallet/ATHWallet_ATHWallet.code.boc'),
    record_shard: codeHash('build/RecordShard/RecordShard_RecordShard.code.boc'),
    intro_shard: codeHash('build/IntroShard/IntroShard_IntroShard.code.boc'),
    public_shard: codeHash('build/PublicShard/PublicShard_PublicShard.code.boc'),
    recovery_shard: codeHash('build/RecoveryShard/RecoveryShard_RecoveryShard.code.boc'),
    key_shard: codeHash('build/KeyShard/KeyShard_KeyShard.code.boc'),
  },
  fee_config_snapshot: {
    config_18_latest_utime_since: '1777500000',
    config_18_latest_bit_price_ps: '0',
    config_18_latest_cell_price_ps: '135',
    config_21_flat_gas_price: '6667',
    config_21_gas_price: '4369067',
    config_25_lump_price: '66667',
    config_25_bit_price: '4369067',
    config_25_cell_price: '436906667',
  },
  cases,
  worst_margin_nanotons: cases.reduce((w, c) => (BigInt(c.margin_nanotons) < BigInt(w) ? c.margin_nanotons : w),
    cases[0].margin_nanotons),
  underfunded_lanes: underfunded.map((c) => c.id),
  zero_margin_note: 'A margin of ZERO on the first-publish lanes is the DESIGN, not a shortfall: the client '
    + 'attaches exactly the shard deploy floor and the sending wallet pays forward fees from its own balance, so the '
    + 'full value arrives. tests/publish-price.test.ts PP-02 measures a real first publish and a real steady publish '
    + 'in sandbox against the compiled shards; PP-03 measures that the STEADY figure is refused on a fresh shard, '
    + 'which is why the client must always attach the deploy figure. Recorded explicitly because a zero-margin money '
    + 'path is otherwise indistinguishable from an unnoticed one.',
  note: 'Both sides are read from their own source — the contract floor from contracts/*.tact, the attached value '
    + 'from web/publish-price.mjs — so this artefact cannot be satisfied by copying one into the other. The proof '
    + 'that the figures are CORRECT is tests/publish-price.test.ts (PP-01..PP-04), which pins the mirrors against '
    + 'the .tact sources and measures a first and a steady publish in sandbox.',
};

writeFileSync('artifacts/publish_reserve_pricing_report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  status: report.status,
  lanes: cases.length,
  worst_margin_nanotons: report.worst_margin_nanotons,
  underfunded: report.underfunded_lanes,
}, null, 2));
