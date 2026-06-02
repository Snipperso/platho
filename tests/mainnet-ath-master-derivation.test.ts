import { Address, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  createMainnetAthMasterDerivationReport,
  MainnetAthMasterDerivationInput,
} from '../scripts/mainnet_ath_master_derivation';

function fixtureAddress(label: string) {
  return new Address(0, createHash('sha256').update(`PLATHO.MAINNET.ATH.${label}`).digest());
}

function contentBocBase64(label = 'ATH') {
  return beginCell().storeBuffer(Buffer.from(label)).endCell().toBoc().toString('base64');
}

function stateInitHash(init: { code: Cell; data: Cell }) {
  return beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
}

function currentCodeHashes(): Record<string, string> {
  return Object.fromEntries(readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const [key, value] = line.split('=', 2);
      return [key, value];
    }));
}

function baseInput(): MainnetAthMasterDerivationInput {
  return {
    document: 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION_INPUT',
    network: 'mainnet',
    status: 'FINAL_MAINNET_ATH_MASTER_INPUT',
    treasuryOwnerAddress: fixtureAddress('treasury-owner').toString({ testOnly: false }),
    contentBocBase64: contentBocBase64(),
    proofRefs: {
      treasuryOwnerProof: 'sha256:treasury-owner-mainnet',
      contentCellProof: 'sha256:ath-content-mainnet',
      athMasterBuildArtifact: 'sha256:ath-master-build-mainnet',
    },
  };
}

describe('Mainnet ATH Master derivation', () => {
  it('blocks without final input instead of deriving fixture ATH Master address', async () => {
    const report = await createMainnetAthMasterDerivationReport({ input: null });

    expect(report.status).toBe('BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS');
    expect(report.ath_master_derivation_ready).toBe(false);
    expect(report.production_deploy_executed).toBe(false);
    expect(report.blockers).toContain('MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS');
    expect(report.derived.athMasterAddress).toBeNull();
  });

  it('rejects testnet treasury owner for mainnet ATH Master derivation', async () => {
    const report = await createMainnetAthMasterDerivationReport({
      input: {
        ...baseInput(),
        treasuryOwnerAddress: fixtureAddress('testnet-owner').toString({ testOnly: true }),
      },
    });

    expect(report.status).toBe('BLOCKED_TESTNET_OR_NONPROD_ATH_MASTER_INPUT');
    expect(report.ath_master_derivation_ready).toBe(false);
    expect(report.rejectedNonProdInputs).toContain('treasuryOwnerAddress');
  });

  it('rejects invalid metadata content BOC', async () => {
    const report = await createMainnetAthMasterDerivationReport({
      input: {
        ...baseInput(),
        contentBocBase64: 'not-base64-cell',
      },
    });

    expect(report.status).toBe('BLOCKED_INVALID_ATH_MASTER_INPUT');
    expect(report.invalidInputs).toContain('contentBocBase64');
  });

  it('reports a valid draft content hash even while final owner inputs are still blocked', async () => {
    const input = {
      ...baseInput(),
      status: 'DRAFT_MAINNET_ATH_MASTER_INPUT',
      treasuryOwnerAddress: 'REQUIRED_FINAL_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
      proofRefs: {
        ...baseInput().proofRefs,
        treasuryOwnerProof: 'required: immutable treasury owner proof path/hash',
      },
    } satisfies MainnetAthMasterDerivationInput;
    const report = await createMainnetAthMasterDerivationReport({ input });
    const content = Cell.fromBoc(Buffer.from(input.contentBocBase64, 'base64'))[0];

    expect(report.status).toBe('BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS');
    expect(report.ath_master_derivation_ready).toBe(false);
    expect(report.inputs.contentHash).toBe(content.hash().toString('hex'));
    expect(report.derived.athMasterAddress).toBeNull();
  });

  it('derives ATH Master address, code hash, data hash, and StateInit hash from final input', async () => {
    const input = baseInput();
    const report = await createMainnetAthMasterDerivationReport({ input });
    const treasuryOwner = Address.parse(input.treasuryOwnerAddress);
    const content = Cell.fromBoc(Buffer.from(input.contentBocBase64, 'base64'))[0];
    const expectedInit = await ATHMaster.init(treasuryOwner, content);
    const expectedAddress = contractAddress(0, expectedInit);
    const expectedTreasuryWalletInit = await ATHWallet.init(0n, treasuryOwner, expectedAddress);
    const expectedTreasuryWalletAddress = contractAddress(treasuryOwner.workChain, expectedTreasuryWalletInit);

    expect(report.status).toBe('DERIVED_MAINNET_ATH_MASTER_ADDRESS');
    expect(report.ath_master_derivation_ready).toBe(true);
    expect(report.production_deploy_executed).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.inputs.contentHash).toBe(content.hash().toString('hex'));
    expect(report.derived.athMasterAddress).toBe(expectedAddress.toString({ testOnly: false }));
    expect(report.derived.athMasterStateInitHash).toBe(stateInitHash(expectedInit));
    expect(report.derived.athMasterCodeHash).toBe(expectedInit.code.hash().toString('hex'));
    expect(report.derived.athMasterDataHash).toBe(expectedInit.data.hash().toString('hex'));
    expect(report.derived.treasuryOwnerAthWalletAddress).toBe(expectedTreasuryWalletAddress.toString({ testOnly: false }));
    expect(report.derived.treasuryOwnerAthWalletStateInitHash).toBe(stateInitHash(expectedTreasuryWalletInit));
    expect(report.derived.athWalletCodeHash).toBe(expectedTreasuryWalletInit.code.hash().toString('hex'));
    expect(report.treasurySupplyDeployment.messageType).toBe('DeployTreasurySupply');
    expect(report.treasurySupplyDeployment.senderAddress).toBe(input.treasuryOwnerAddress);
    expect(report.treasurySupplyDeployment.recipientAthWalletAddress).toBe(report.derived.treasuryOwnerAthWalletAddress);
    expect(report.treasurySupplyDeployment.amountAtomic).toBe('100000000000000000');
    expect(report.treasurySupplyDeployment.requiredValueNanotons).toBe('5000000');
    expect(report.treasurySupplyDeployment.downstreamWalletValueNanotons).toBe('3000000');
    expect(report.treasurySupplyDeployment.ownerFirstHopExecReserveNanotons).toBe('2000000');
    expect(report.nextM20FInputs.athMasterAddress).toBe(report.derived.athMasterAddress);
    expect(report.nextM20FInputs.athMasterCodeHash).toBe(report.derived.athMasterCodeHash);
  });

  it('keeps the committed ATH Master derivation artifact tied to current ATH code hashes', () => {
    const report = JSON.parse(readFileSync('artifacts/mainnet_ath_master_derivation.json', 'utf8'));
    const current = currentCodeHashes();

    expect(report.derived.athMasterCodeHash).toBe(current.ATHMASTER_CODE_HASH);
    expect(report.derived.athWalletCodeHash).toBe(current.ATH_WALLET_CODE_HASH);
    expect(report.proofRefs.athMasterBuildArtifact).toContain(current.ATHMASTER_CODE_HASH);
  });
});
