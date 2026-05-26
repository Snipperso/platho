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
};
let out='';
for (const [k,p] of Object.entries(paths)) {
  const boc=fs.readFileSync(p);
  const cell=Cell.fromBoc(boc)[0];
  const hash=cell.hash().toString('hex');
  console.log(`${k}=${hash}`);
  out += `${k}=${hash}\n`;
}
fs.writeFileSync('artifacts/CURRENT_CODE_HASHES.txt', out);
for (const [k,line] of out.trim().split('\n').map(l=>l.split('='))) {
 fs.writeFileSync(`artifacts/${k}.txt`, `${line}\n`);
}
