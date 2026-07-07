import { Address, beginCell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { MarketStabilitySeller, storeAthTransferNotification } from '../../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import { ATHWallet } from '../../build/ATHWallet/ATHWallet_ATHWallet';

const TOTAL_RESERVE = 60000000000000000n;
const addrHash = (a: Address) => BigInt('0x' + beginCell().storeAddress(a).endCell().hash().toString('hex'));

export async function setup(base: bigint = 3000000000n) {
  const bc = await Blockchain.create();
  const controller = await bc.treasury('controller');
  const athMaster = await bc.treasury('athmaster');
  const reserveFunder = await bc.treasury('reservefunder');
  const treasuryRecv = await bc.treasury('treasuryrecv');
  const attacker = await bc.treasury('attacker');
  const genesisHash = addrHash(controller.address);

  const seller = bc.openContract(await MarketStabilitySeller.fromInit(genesisHash, athMaster.address));
  await seller.send(controller.getSender(), { value: toNano('1') }, { $$type: 'MarketStabilityTopUpStorageReserve' } as any);
  const sellerAddr = seller.address;
  const officialWalletAddr: Address = await seller.getGetOfficialAthWalletAddress();
  const manifest = 12345n;

  await seller.send(controller.getSender(), { value: toNano('0.2') }, { $$type: 'BindMarketStabilityReserveFunder', deployment_manifest_hash: manifest, reserve_funder_address: reserveFunder.address } as any);
  await seller.send(controller.getSender(), { value: toNano('0.2') }, { $$type: 'BindMarketStabilityOfficialAthWallet', deployment_manifest_hash: manifest, official_ath_wallet_address: officialWalletAddr } as any);
  await seller.send(controller.getSender(), { value: toNano('0.2') }, { $$type: 'BindMarketStabilityTreasury', deployment_manifest_hash: manifest, ton_treasury_receiver_address: treasuryRecv.address } as any);
  await seller.send(controller.getSender(), { value: toNano('0.2') }, { $$type: 'SealMarketStabilityGenesis', deployment_manifest_hash: manifest } as any);

  const officialWallet = bc.openContract(await ATHWallet.fromInit(0n, sellerAddr, athMaster.address));
  await officialWallet.send(athMaster.getSender(), { value: toNano('0.1') }, { $$type: 'ATHGenesisSupplyCredit', query_id: 1n, amount: TOTAL_RESERVE, response_destination: athMaster.address } as any);

  const notifBody = beginCell().store(storeAthTransferNotification({ $$type: 'AthTransferNotification', query_id: 2n, amount: TOTAL_RESERVE, sender_key: 0n, sender_wallet: reserveFunder.address })).endCell();
  await bc.sendMessage({ info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false, src: officialWalletAddr, dest: sellerAddr, value: { coins: toNano('0.05') }, ihrFee: 0n, forwardFee: 0n, createdLt: 0n, createdAt: 0 }, body: notifBody } as any);

  await seller.send(controller.getSender(), { value: toNano('0.2') }, { $$type: 'FreezeMarketStabilityPricing', deployment_manifest_hash: manifest, base_tranche_price_nanotons: base, evidence_x1_tranche_quote_nanotons: base, pricing_evidence_hash: 999n } as any);

  return { bc, seller, sellerAddr, officialWalletAddr, officialWallet, attacker, controller, reserveFunder, treasuryRecv, athMaster, base };
}
