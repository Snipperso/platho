import { Address, beginCell, Cell, contractAddress, storeStateInit } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function hex(cell: Cell): string {
  return cell.hash().toString('hex');
}

async function main() {
  mkdirSync('artifacts', { recursive: true });

  const treasuryOwner = fixtureAddress('TREASURY_OWNER');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();

  const masterInit = await ATHMaster.init(treasuryOwner, content, 0n);
  const masterAddress = contractAddress(0, masterInit);

  const walletCodeBoc = readFileSync('build/ATHWallet/ATHWallet_ATHWallet.code.boc');
  const walletCodeFromArtifact = Cell.fromBoc(walletCodeBoc)[0];
  const walletCodeHash = walletCodeFromArtifact.hash().toString('hex');

  const sampleWalletInit = await ATHWallet.init(0n, treasuryOwner, masterAddress);
  if (!sampleWalletInit.code.equals(walletCodeFromArtifact)) {
    throw new Error('ATH wallet wrapper code cell differs from compiled artifact code cell');
  }

  const blockchain = await Blockchain.create();
  await blockchain.setShardAccount(
    masterAddress,
    createShardAccount({
      address: masterAddress,
      code: masterInit.code,
      data: masterInit.data,
      balance: 1_000_000_000n,
      workchain: masterAddress.workChain,
    }),
  );
  const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));

  const owners = [
    { label: 'Vault fixture owner', address: fixtureAddress('VAULT') },
    { label: 'BuybackBurn fixture owner', address: fixtureAddress('BUYBACK_BURN') },
    { label: 'UsernameRegistry fixture owner', address: fixtureAddress('USERNAME_REGISTRY') },
    { label: 'Treasury ATH receiver fixture owner', address: fixtureAddress('TREASURY_ATH_RECEIVER') },
    { label: 'Random user wallet fixture owner', address: fixtureAddress('RANDOM_USER_WALLET') },
    { label: 'Masterchain owner workchain check fixture', address: fixtureAddress('MASTERCHAIN_OWNER', -1) },
  ];

  const vectors = [];
  for (const owner of owners) {
    const walletInit = await ATHWallet.init(0n, owner.address, masterAddress);
    const stateInitCell = beginCell().store(storeStateInit(walletInit)).endCell();
    const localAddress = contractAddress(owner.address.workChain, walletInit);
    const getterAddress = await master.getGetWalletAddress(owner.address);

    if (!getterAddress.equals(localAddress)) {
      throw new Error(`${owner.label}: getter address mismatch: ${getterAddress.toString()} != ${localAddress.toString()}`);
    }

    vectors.push({
      label: owner.label,
      owner_address: owner.address.toString(),
      owner_workchain: owner.address.workChain,
      ATH_MASTER_ADDRESS: masterAddress.toString(),
      ATH_WALLET_CODE_HASH: walletCodeHash,
      ath_wallet_data_cell_hash: hex(walletInit.data),
      ath_wallet_state_init_hash: hex(stateInitCell),
      derived_ath_wallet_address: localAddress.toString(),
      ath_master_get_wallet_address_result: getterAddress.toString(),
      match: getterAddress.equals(localAddress),
    });
  }

  const manifest = {
    milestone: 'ATH-derivation-and-burn-bounce-safe-v1',
    generated_at_utc: 'DETERMINISTIC_ARTIFACT',
    source_profile: 'platho_v1_open_values_v0_5_ath_burn_bounce_safe.md',
    tact_compiler: require('@tact-lang/compiler/package.json').version,
    ton_core: require('@ton/core/package.json').version,
    ATH_MASTER_ADDRESS: masterAddress.toString(),
    ATH_WALLET_CODE_HASH: walletCodeHash,
    ATH_WALLET_CODE_BOC_SHA256: createHash('sha256').update(walletCodeBoc).digest('hex'),
    invariant: 'ATH Master get_wallet_address(owner) == local StateInit derivation using owner workchain',
    vectors,
  };

  writeFileSync('artifacts/ath_wallet_derivation_vectors.json', JSON.stringify(manifest, null, 2));
  writeFileSync('artifacts/ATH_WALLET_CODE_HASH.txt', `${walletCodeHash}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
