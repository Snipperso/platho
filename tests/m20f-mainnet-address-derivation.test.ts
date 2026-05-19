import { Address, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { BuybackBurn } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { ATHWallet } from '../build/BuybackBurn/BuybackBurn_ATHWallet';
import {
  createM20FMainnetAddressDerivationReport,
  M20FMainnetAddressDerivationInput,
} from '../scripts/m20f_mainnet_address_derivation';

function fixtureAddress(label: string) {
  return new Address(0, createHash('sha256').update(`PLATHO.M20F.ADDRESS.${label}`).digest());
}

function addressHash(address: Address): bigint {
  return BigInt(`0x${beginCell().storeAddress(address).endCell().hash().toString('hex')}`);
}

function stateInitHash(init: { code: any; data: any }) {
  return beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
}

function baseInput(): M20FMainnetAddressDerivationInput {
  return {
    document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_DERIVATION_INPUT',
    network: 'mainnet',
    status: 'FINAL_MAINNET_ADDRESS_INPUT',
    genesisControllerAddress: fixtureAddress('genesis-controller').toString({ testOnly: false }),
    athMasterAddress: fixtureAddress('ath-master').toString({ testOnly: false }),
    proofRefs: {
      finalGenesisControllerProof: 'sha256:final-genesis-controller-mainnet',
      athDeploymentManifest: 'sha256:ath-deployment-mainnet',
      buybackBurnBuildArtifact: 'sha256:buybackburn-build-mainnet',
    },
  };
}

describe('M20F mainnet address derivation', () => {
  it('blocks without final mainnet input instead of deriving placeholder addresses', async () => {
    const report = await createM20FMainnetAddressDerivationReport({ input: null });

    expect(report.status).toBe('BLOCKED_MISSING_FINAL_MAINNET_ADDRESS_INPUTS');
    expect(report.address_derivation_ready).toBe(false);
    expect(report.production_buyback_burn_unlocked).toBe(false);
    expect(report.blockers).toContain('MISSING_FINAL_MAINNET_ADDRESS_INPUTS');
    expect(report.derived.buybackBurnAddress).toBeNull();
  });

  it('rejects testnet-friendly address inputs for mainnet derivation', async () => {
    const testnetGenesis = fixtureAddress('testnet-genesis').toString({ testOnly: true });
    const report = await createM20FMainnetAddressDerivationReport({
      input: {
        ...baseInput(),
        genesisControllerAddress: testnetGenesis,
      },
    });

    expect(report.status).toBe('BLOCKED_TESTNET_OR_NONPROD_ADDRESS_INPUT');
    expect(report.address_derivation_ready).toBe(false);
    expect(report.rejectedNonProdInputs).toContain('genesisControllerAddress');
  });

  it('derives BuybackBurn StateInit address and official ATH wallet from final mainnet inputs', async () => {
    const input = baseInput();
    const report = await createM20FMainnetAddressDerivationReport({ input });
    const genesisController = Address.parse(input.genesisControllerAddress);
    const athMaster = Address.parse(input.athMasterAddress);
    const expectedBuybackInit = await BuybackBurn.init(addressHash(genesisController), athMaster);
    const expectedBuybackAddress = contractAddress(0, expectedBuybackInit);
    const expectedOfficialWalletInit = await ATHWallet.init(0n, expectedBuybackAddress, athMaster);
    const expectedOfficialWalletAddress = contractAddress(expectedBuybackAddress.workChain, expectedOfficialWalletInit);

    expect(report.status).toBe('DERIVED_MAINNET_BUYBACKBURN_ADDRESSES');
    expect(report.address_derivation_ready).toBe(true);
    expect(report.production_buyback_burn_unlocked).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.derived.buybackBurnAddress).toBe(expectedBuybackAddress.toString({ testOnly: false }));
    expect(report.derived.buybackBurnStateInitHash).toBe(stateInitHash(expectedBuybackInit));
    expect(report.derived.buybackBurnOfficialAthWalletAddress).toBe(expectedOfficialWalletAddress.toString({ testOnly: false }));
    expect(report.derived.buybackBurnOfficialAthWalletStateInitHash).toBe(stateInitHash(expectedOfficialWalletInit));
    expect(report.nextM20FInputs.buybackBurnAddress).toBe(report.derived.buybackBurnAddress);
    expect(report.nextM20FInputs.buybackBurnOfficialAthWalletAddress).toBe(report.derived.buybackBurnOfficialAthWalletAddress);
  });
});
