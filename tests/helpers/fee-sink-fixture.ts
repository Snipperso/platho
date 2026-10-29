import { Address, contractAddress, toNano } from '@ton/core';
import type { Blockchain } from '@ton/sandbox';
import { FeeAccumulator } from '../../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { RecordShard } from '../../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../../build/IntroShard/IntroShard_IntroShard';
import { AirdropTicket } from '../../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { PublicShard } from '../../build/PublicShard/PublicShard_PublicShard';


export const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
export const FA_BUYBACK = Address.parse('UQCPTImetCChvmoOq58-jF_rtvXXu6MlZBFwhU9ZbQmQz9Ve');
export const FA_POOL = Address.parse('UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH');

export const FEE_SINK = contractAddress(0, await FeeAccumulator.init(FA_TREASURY, FA_BUYBACK));

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
