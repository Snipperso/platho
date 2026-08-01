import { Address, contractAddress, toNano } from '@ton/core';
import type { Blockchain } from '@ton/sandbox';
import { FeeAccumulator } from '../../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { RecordShard } from '../../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../../build/IntroShard/IntroShard_IntroShard';
import { AirdropTicket } from '../../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { PublicShard } from '../../build/PublicShard/PublicShard_PublicShard';

// THE FEE SINK AS GENESIS LEAVES IT — one copy, deliberately.
//
// Binding is not scaffolding. Gate 15055 authenticates a depositing shard by REBUILDING its address from the
// bound shard code, so an unbound sink refuses every capsule fee. A publish whose fee is refused does not store
// its record, which makes the shard poorer than it should be — and the damage surfaces far from its cause, as a
// retire that pays its caller a NEGATIVE amount.
//
// This file exists because that is exactly what happened. Gate 15055 arrived with the airdrop-bearing deposit and
// only ONE of the five suites that stand up a sink had its private copy of the fixture updated. The other
// four went red — shard-retire, intro-lane, publish-price — and read as protocol defects for a day. A fixture
// duplicated five times is a change that has to land five times, and it will not.

export const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
// [REBAKED 2026-07-29, wave-8 cascade] BuybackBurn's address is DERIVED from its code, and its code changed, so this
// is not a fixed role address — it is a copy of a derived value and it went stale. The ceremony's own figure is
// artifacts/local/mainnet_final_manifest_draft.json -> addresses.fee_accumulator_buyback_burn, and FA-SOURCE-01 in
// tests/fee-sink-fixture-source.test.ts pins this constant to it whenever that scaffolding is present. Baking the
// FEE_SINK from a TEST literal instead of from the ceremony is a mistake this project has already made once, and it
// killed the airdrop while PT-04b proved a self-consistent fiction — hence the pin rather than another hand-edit.
// [REBAKED 2026-08-01, transfer-floor cascade] BuybackBurn embeds ATHWallet's code, so lowering the wallet's forward
// allowance moved this address again — exactly the drift the note above describes, arriving on schedule.
export const FA_BUYBACK = Address.parse('UQA7gCVxXYOWnyRn_ZUBLgYumgFCjpeYen02N-mC_p-EULYy');
export const FA_POOL = Address.parse('UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH');

/**
 * The sink's own address, DERIVED — never a literal.
 *
 * It is the address the four immutable *_FEE_SINK constants name, and it is a pure function of the two inputs above
 * plus FeeAccumulator's code. Four suites used to keep it as a hand-copied string, so every edit to FeeAccumulator
 * left them naming an address nobody occupies — a whole class of red that reads as a protocol defect. Derived here,
 * it cannot go stale, and FA-SOURCE-02 fails if a copy reappears anywhere.
 */
export const FEE_SINK = contractAddress(0, await FeeAccumulator.init(FA_TREASURY, FA_BUYBACK));

/**
 * Deploy the fee sink and, unless `bind: false`, send the four genesis binds exactly as the ceremony does:
 * treasury-only, one-shot (gates 15050 / 15051 / 15052 / 15053 / 15057), before any publish exists.
 *
 * Pass `bind: false` only to assert the refusal itself.
 */
export async function deployFeeSink(bc: Blockchain, opts: { bind?: boolean; funderSeed?: string } = {}) {
  const sink = bc.openContract(await FeeAccumulator.fromInit(FA_TREASURY, FA_BUYBACK));
  const funder = await bc.treasury(opts.funderSeed ?? 'fee-sink-funder');
  await sink.send(funder.getSender(), { value: toNano('1') }, { $$type: 'TopUpStorageReserve' } as any);
  if (opts.bind === false) return sink;

  const gov = bc.sender(FA_TREASURY);
  const send = (body: any) => sink.send(gov, { value: toNano('0.1') }, body);
  await send({ $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindIntroShardCode', intro_shard_code: (await IntroShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindPublicShardCode', public_shard_code: (await PublicShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindTicketCode', ticket_code: (await AirdropTicket.init(FA_TREASURY)).code } as any);
  await send({ $$type: 'BindAirdropPool', airdrop_pool_address: FA_POOL } as any);
  return sink;
}
