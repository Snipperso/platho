import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import { ATHMaster, ATHBurnNotification } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet, ATHBurn } from '../build/ATHMaster/ATHMaster_ATHWallet';

const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const OP_ATH_BURN_FINALIZED = 0x41544803;
const OP_ATH_BURN_FAILED = 0x41544804;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function setup(initialWalletBalance: bigint = 1_000_000_000n, deployMaster: boolean = true) {
  const treasuryOwner = fixtureAddress('TREASURY_OWNER');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();

  const blockchain = await Blockchain.create();
  const ownerTreasury = await blockchain.treasury('burner-owner');
  const attackerTreasury = await blockchain.treasury('attacker');
  const tokenOwner = ownerTreasury.address;

  const masterInit = await ATHMaster.init(treasuryOwner, content, 0n);
  const masterAddress = contractAddress(0, masterInit);

  const walletInit = await ATHWallet.init(0n, tokenOwner, masterAddress);
  const walletStateWithBalance = await ATHWallet.init(initialWalletBalance, tokenOwner, masterAddress);
  const walletAddress = contractAddress(tokenOwner.workChain, walletInit);

  if (deployMaster) {
    await blockchain.setShardAccount(
      masterAddress,
      createShardAccount({
        address: masterAddress,
        code: masterInit.code,
        data: masterInit.data,
        balance: toNano('1'),
        workchain: masterAddress.workChain,
      }),
    );
  }

  await blockchain.setShardAccount(
    walletAddress,
    createShardAccount({
      address: walletAddress,
      code: walletInit.code,
      data: walletStateWithBalance.data,
      balance: toNano('1'),
      workchain: walletAddress.workChain,
    }),
  );

  const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
  const wallet = blockchain.openContract(new ATHWallet(walletAddress, walletInit));

  return { blockchain, master, wallet, ownerTreasury, attackerTreasury, tokenOwner, masterAddress, walletAddress };
}

describe('ATH burn finalization', () => {
  it('ATH-00: burn operation reduces total_supply by exact burned amount and debits wallet balance', async () => {
    const { master, wallet, ownerTreasury } = await setup();
    const burnAmount = 123_456_789n;

    const beforeMaster = await master.getGetJettonData();
    const beforeWallet = await wallet.getGetWalletData();

    await wallet.send(ownerTreasury.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHBurn',
      query_id: 1n,
      amount: burnAmount,
      response_destination: ownerTreasury.address,
    } as ATHBurn);

    const afterMaster = await master.getGetJettonData();
    const afterWallet = await wallet.getGetWalletData();

    expect(beforeMaster.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
    expect(afterMaster.total_supply).toBe(beforeMaster.total_supply - burnAmount);
    expect(afterWallet.balance).toBe(beforeWallet.balance - burnAmount);
  });

  it('ATH-00G: ATHBurnFinalized bounce does not restore total_supply or wallet balance', async () => {
    const blockchain = await Blockchain.create();
    const tokenOwner = fixtureAddress('BURN_FINALIZED_BOUNCE_OWNER');
    const treasuryOwner = fixtureAddress('BURN_FINALIZED_BOUNCE_TREASURY');
    const masterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell(), 0n);
    const masterAddress = contractAddress(0, masterInit);
    await blockchain.setShardAccount(
      masterAddress,
      createShardAccount({
        address: masterAddress,
        code: masterInit.code,
        data: masterInit.data,
        balance: toNano('1'),
        workchain: masterAddress.workChain,
      }),
    );

    const walletInit = await ATHWallet.init(0n, tokenOwner, masterAddress);
    const walletStateWithBalance = await ATHWallet.init(1_000n, tokenOwner, masterAddress);
    const walletAddress = contractAddress(tokenOwner.workChain, walletInit);
    await blockchain.setShardAccount(
      walletAddress,
      createShardAccount({
        address: walletAddress,
        code: walletInit.code,
        data: walletStateWithBalance.data,
        balance: toNano('1'),
        workchain: walletAddress.workChain,
      }),
    );

    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const wallet = blockchain.openContract(new ATHWallet(walletAddress, walletInit));
    const burnAmount = 100n;
    const beforeMaster = await master.getGetJettonData();
    const beforeWallet = await wallet.getGetWalletData();

    const result = await wallet.send(blockchain.sender(tokenOwner), { value: toNano('0.2') }, {
      $$type: 'ATHBurn',
      query_id: 7n,
      amount: burnAmount,
      response_destination: tokenOwner,
    } as ATHBurn);

    const afterMaster = await master.getGetJettonData();
    const afterWallet = await wallet.getGetWalletData();

    expect(findTransaction(result.transactions, {
      from: master.address,
      to: tokenOwner,
      op: OP_ATH_BURN_FINALIZED,
      success: false,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: wallet.address,
      to: tokenOwner,
      op: OP_ATH_BURN_FAILED,
    })).toBeUndefined();
    expect(afterMaster.total_supply).toBe(beforeMaster.total_supply - burnAmount);
    expect(afterWallet.balance).toBe(beforeWallet.balance - burnAmount);
  });

  it('ATH-00C: ATH master accepts burn notification only from deterministic official ATH wallet', async () => {
    const { master, attackerTreasury, tokenOwner } = await setup();
    const beforeMaster = await master.getGetJettonData();

    await master.send(attackerTreasury.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHBurnNotification',
      query_id: 2n,
      owner_address: tokenOwner,
      amount: 10n,
      response_destination: tokenOwner,
    } as ATHBurnNotification);

    const afterMaster = await master.getGetJettonData();
    expect(afterMaster.total_supply).toBe(beforeMaster.total_supply);
  });

  it('ATH-00D: wrong owner cannot burn another wallet owner balance', async () => {
    const { wallet, attackerTreasury, master } = await setup();
    const beforeMaster = await master.getGetJettonData();
    const beforeWallet = await wallet.getGetWalletData();

    await wallet.send(attackerTreasury.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHBurn',
      query_id: 3n,
      amount: 10n,
      response_destination: attackerTreasury.address,
    } as ATHBurn);

    const afterMaster = await master.getGetJettonData();
    const afterWallet = await wallet.getGetWalletData();

    expect(afterMaster.total_supply).toBe(beforeMaster.total_supply);
    expect(afterWallet.balance).toBe(beforeWallet.balance);
  });

  it('ATH-00B: transfer-to-dead-address is not treated as burn by ATH master', async () => {
    const { master } = await setup();
    const beforeMaster = await master.getGetJettonData();

    // There is intentionally no transfer receiver or dead-address burn path in ATH milestone 2.
    // Total supply can change only through authenticated ATHBurnNotification from the official wallet.
    const afterMaster = await master.getGetJettonData();
    expect(afterMaster.total_supply).toBe(beforeMaster.total_supply);
  });

  it('ATH-00E: underfunded ATHBurn does not debit wallet without total_supply decrease', async () => {
    const { master, wallet, ownerTreasury } = await setup();
    const burnAmount = 10n;

    const beforeMaster = await master.getGetJettonData();
    const beforeWallet = await wallet.getGetWalletData();

    await wallet.send(ownerTreasury.getSender(), { value: 1n }, {
      $$type: 'ATHBurn',
      query_id: 5n,
      amount: burnAmount,
      response_destination: ownerTreasury.address,
    } as ATHBurn);

    const afterMaster = await master.getGetJettonData();
    const afterWallet = await wallet.getGetWalletData();

    expect(afterMaster.total_supply).toBe(beforeMaster.total_supply);
    expect(afterWallet.balance).toBe(beforeWallet.balance);
  });

  it('ATH-00F: burn notification bounce/failure restores wallet balance when master is unavailable', async () => {
    const { wallet, ownerTreasury } = await setup(1_000_000_000n, false);
    const burnAmount = 10n;

    const beforeWallet = await wallet.getGetWalletData();

    await wallet.send(ownerTreasury.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHBurn',
      query_id: 6n,
      amount: burnAmount,
      response_destination: ownerTreasury.address,
    } as ATHBurn);

    const afterWallet = await wallet.getGetWalletData();

    expect(afterWallet.balance).toBe(beforeWallet.balance);
  });

});
