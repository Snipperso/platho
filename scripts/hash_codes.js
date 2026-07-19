const { Cell } = require('@ton/core');
const fs = require('fs');
const paths = {
ATH_WALLET_CODE_HASH:'build/ATHWallet/ATHWallet_ATHWallet.code.boc',
ATHMASTER_CODE_HASH:'build/ATHMaster/ATHMaster_ATHMaster.code.boc',
ATHVESTING_CODE_HASH:'build/ATHVesting/ATHVesting_ATHVesting.code.boc',
BUYBACKBURN_CODE_HASH:'build/BuybackBurn/BuybackBurn_BuybackBurn.code.boc',
MARKET_STABILITY_SELLER_CODE_HASH:'build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller.code.boc',
CAPSULEHUB_CODE_HASH:'build/CapsuleHub/CapsuleHub_CapsuleHub.code.boc',
FEEACCUMULATOR_CODE_HASH:'build/FeeAccumulator/FeeAccumulator_FeeAccumulator.code.boc',
VAULT_CODE_HASH:'build/Vault/Vault_Vault.code.boc',
USERNAME_NFT_ITEM_CODE_HASH:'build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem.code.boc',
USERNAME_REGISTRY_CODE_HASH:'build/UsernameRegistry/UsernameRegistry_UsernameRegistry.code.boc',
PROFILE_REGISTRY_CODE_HASH:'build/ProfileRegistry/ProfileRegistry_ProfileRegistry.code.boc',
MOCK_VAULT_ATH_WALLET_CODE_HASH:'build/MockVaultAthWallet/MockVaultAthWallet_MockVaultAthWallet.code.boc',
MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH:'build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck.code.boc',
// The clean-17 shard lane. It was missing here entirely, which mattered more than a gap usually does: a shard's
// ADDRESS is derived from its code hash, so every CONV, INTRO and RECOVERY address in the network moves when this
// changes — and the release Stop Rule ("final manifest code hashes match current build outputs") could not see
// any of it. Found by the 2026-07-19 consistency audit.
RECORD_SHARD_CODE_HASH:'build/RecordShard/RecordShard_RecordShard.code.boc',
INTRO_SHARD_CODE_HASH:'build/IntroShard/IntroShard_IntroShard.code.boc',
RECOVERY_SHARD_CODE_HASH:'build/RecoveryShard/RecoveryShard_RecoveryShard.code.boc',
};
const productionKeys = [
  'ATH_WALLET_CODE_HASH',
  'ATHMASTER_CODE_HASH',
  'ATHVESTING_CODE_HASH',
  'BUYBACKBURN_CODE_HASH',
  'MARKET_STABILITY_SELLER_CODE_HASH',
  'CAPSULEHUB_CODE_HASH',
  'FEEACCUMULATOR_CODE_HASH',
  'VAULT_CODE_HASH',
  'USERNAME_NFT_ITEM_CODE_HASH',
  'USERNAME_REGISTRY_CODE_HASH',
  'PROFILE_REGISTRY_CODE_HASH',
  'RECORD_SHARD_CODE_HASH',
  'INTRO_SHARD_CODE_HASH',
  'RECOVERY_SHARD_CODE_HASH',
];
const hashes = {};
let out='';
for (const [k,p] of Object.entries(paths)) {
  const boc=fs.readFileSync(p);
  const cell=Cell.fromBoc(boc)[0];
  const hash=cell.hash().toString('hex');
  console.log(`${k}=${hash}`);
  hashes[k] = hash;
  out += `${k}=${hash}\n`;
}
fs.writeFileSync('artifacts/CURRENT_CODE_HASHES.txt', out);
fs.writeFileSync(
  'artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt',
  productionKeys.map((key) => `${key}=${hashes[key]}`).join('\n') + '\n',
);
for (const [k,line] of out.trim().split('\n').map(l=>l.split('='))) {
 fs.writeFileSync(`artifacts/${k}.txt`, `${line}\n`);
}
