import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, storeStateInit, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { ATHMaster, DeployTreasurySupply } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet, ATHGenesisSupplyCredit, storeATHGenesisSupplyCredit } from '../build/ATHWallet/ATHWallet_ATHWallet';

const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const ATH_GENESIS_SUPPLY_DOWNSTREAM_VALUE = 3_000_000n;
const ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE = 8_000_000n; // raised 2M -> 8M, wave-8: see the GENESIS-ACTION block
const ATH_GENESIS_SUPPLY_REQUIRED_VALUE = ATH_GENESIS_SUPPLY_DOWNSTREAM_VALUE + ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

describe('ATH wallet derivation profile', () => {
  it('compiled wallet code hash comes from the ATH Wallet artifact', async () => {
    const treasuryOwner = fixtureAddress('TREASURY_OWNER');
    const masterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const masterAddress = contractAddress(0, masterInit);
    const wrapperWalletInit = await ATHWallet.init(0n, treasuryOwner, masterAddress);
    const artifactWalletCode = Cell.fromBoc(readFileSync('build/ATHWallet/ATHWallet_ATHWallet.code.boc'))[0];

    expect(wrapperWalletInit.code.hash().toString('hex')).toBe(artifactWalletCode.hash().toString('hex'));
  });

  it('TEP-74: get_wallet_data returns the standard 4-tuple {balance, owner, jetton_master, jetton_wallet_code} — the clean-12 indexer/Tonkeeper-visibility fix', async () => {
    const treasuryOwner = fixtureAddress('TREASURY_OWNER');
    const masterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const masterAddress = contractAddress(0, masterInit);
    const owner = fixtureAddress('RANDOM_USER_WALLET');
    const walletInit = await ATHWallet.init(1234n, owner, masterAddress);
    const walletAddress = contractAddress(0, walletInit);

    const blockchain = await Blockchain.create();
    await blockchain.setShardAccount(
      walletAddress,
      createShardAccount({
        address: walletAddress,
        code: walletInit.code,
        data: walletInit.data,
        balance: toNano('1'),
        workchain: 0,
      }),
    );
    const wallet = blockchain.openContract(new ATHWallet(walletAddress, walletInit));
    const data = await wallet.getGetWalletData();

    // Positional fields 1-3 (int balance, slice owner, slice jetton_master) — unchanged from clean-11.
    expect(data.balance).toBe(1234n);
    expect(data.owner_address.toString()).toBe(owner.toString());
    expect(data.ath_master_address.toString()).toBe(masterAddress.toString());
    // Positional field 4 (cell jetton_wallet_code) — the NEW clean-12 field. Indexers (tonapi) + wallets (Tonkeeper)
    // require exactly this 4-tuple to classify the contract as a jetton wallet and read the balance; clean-11 omitted
    // it (3-tuple) → holders:0, invisible. It must be the wallet's OWN code cell for the master round-trip to resolve.
    expect(data.jetton_wallet_code).toBeDefined();
    expect(data.jetton_wallet_code.hash().toString('hex')).toBe(walletInit.code.hash().toString('hex'));
  });

  it('ATH Master get_wallet_address(owner) equals local StateInit derivation', async () => {
    const treasuryOwner = fixtureAddress('TREASURY_OWNER');
    const masterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const masterAddress = contractAddress(0, masterInit);

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
      fixtureAddress('VAULT'),
      fixtureAddress('BUYBACK_BURN'),
      fixtureAddress('USERNAME_REGISTRY'),
      fixtureAddress('TREASURY_ATH_RECEIVER'),
      fixtureAddress('RANDOM_USER_WALLET'),
      fixtureAddress('MASTERCHAIN_OWNER', -1),
    ];

    for (const owner of owners) {
      const walletInit = await ATHWallet.init(0n, owner, masterAddress);
      const localAddress = contractAddress(owner.workChain, walletInit);
      const getterAddress = await master.getGetWalletAddress(owner);
      const stateInitCellHash = beginCell().store(storeStateInit(walletInit)).endCell().hash().toString('hex');

      expect(stateInitCellHash).toHaveLength(64);
      expect(getterAddress.equals(localAddress)).toBe(true);
    }
  });

  it('ATH Master deploys the fixed supply once into the official treasury wallet', async () => {
    const blockchain = await Blockchain.create();
    const treasuryOwner = await blockchain.treasury('ath-genesis-treasury-owner');
    const attacker = await blockchain.treasury('ath-genesis-attacker');
    const masterInit = await ATHMaster.init(treasuryOwner.address, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
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

    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const treasuryWalletAddress = await master.getGetWalletAddress(treasuryOwner.address);
    const treasuryWalletInit = await ATHWallet.init(0n, treasuryOwner.address, masterAddress);
    const treasuryWallet = blockchain.openContract(new ATHWallet(treasuryWalletAddress, treasuryWalletInit));

    const attackerAttempt = await master.send(attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'DeployTreasurySupply',
      query_id: 1n,
      response_destination: attacker.address,
    } as DeployTreasurySupply);

    expect(findTransaction(attackerAttempt.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
      success: true,
    })).toBeUndefined();

    const underfundedAttempt = await master.send(treasuryOwner.getSender(), { value: 2_999_999n }, {
      $$type: 'DeployTreasurySupply',
      query_id: 2n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect(findTransaction(underfundedAttempt.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
      success: true,
    })).toBeUndefined();

    const oldExactMinAttempt = await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_DOWNSTREAM_VALUE }, {
      $$type: 'DeployTreasurySupply',
      query_id: 22n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect(findTransaction(oldExactMinAttempt.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
      success: true,
    })).toBeUndefined();

    await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_REQUIRED_VALUE }, {
      $$type: 'DeployTreasurySupply',
      query_id: 3n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect((await treasuryWallet.getGetWalletData()).balance).toBe(ATH_TOTAL_SUPPLY_ATOMIC);

    await master.send(treasuryOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'DeployTreasurySupply',
      query_id: 4n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect((await treasuryWallet.getGetWalletData()).balance).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
    expect((await master.getGetJettonData()).total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
  });

  it('ATH Master forged genesis bounce cannot reopen deploy after successful treasury credit', async () => {
    const blockchain = await Blockchain.create();
    const treasuryOwner = await blockchain.treasury('ath-genesis-forged-bounce-owner');
    const attacker = await blockchain.treasury('ath-genesis-forged-bounce-attacker');
    const masterInit = await ATHMaster.init(treasuryOwner.address, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
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

    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const treasuryWalletAddress = await master.getGetWalletAddress(treasuryOwner.address);
    const treasuryWalletInit = await ATHWallet.init(0n, treasuryOwner.address, masterAddress);
    const treasuryWallet = blockchain.openContract(new ATHWallet(treasuryWalletAddress, treasuryWalletInit));

    await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_REQUIRED_VALUE }, {
      $$type: 'DeployTreasurySupply',
      query_id: 37n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect((await treasuryWallet.getGetWalletData()).balance).toBe(ATH_TOTAL_SUPPLY_ATOMIC);

    const forgedBounce = await blockchain.sendMessage(internal({
      from: attacker.address,
      to: master.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .store(storeATHGenesisSupplyCredit({
          $$type: 'ATHGenesisSupplyCredit',
          query_id: 37n,
          amount: ATH_TOTAL_SUPPLY_ATOMIC,
          response_destination: treasuryOwner.address,
        } as ATHGenesisSupplyCredit))
        .endCell(),
    }));

    expect(findTransaction(forgedBounce.transactions, {
      from: attacker.address,
      to: master.address,
      success: false,
      exitCode: 14130,
    })).toBeDefined();

    const secondDeployAttempt = await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_REQUIRED_VALUE }, {
      $$type: 'DeployTreasurySupply',
      query_id: 38n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect(findTransaction(secondDeployAttempt.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
    })).toBeUndefined();
    expect((await treasuryWallet.getGetWalletData()).balance).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
  });

  // [INVERTED 2026-07-29, wave-8 MED] This used to assert the opposite — that overpayment must NOT reach the treasury
  // wallet — which described the refund that has now been removed. Refunding was the defect: this send is the only
  // path that ever creates the wallet holding 100% of the supply, and it is never redeployable, so refusing to let
  // the ceremony endow it left it with 1,624,999 against a MEASURED 5,132,011 of rent a year.
  it('ATH Master forwards DeployTreasurySupply overpayment INTO the treasury ATH wallet as its rent endowment', async () => {
    const blockchain = await Blockchain.create();
    const treasuryOwner = await blockchain.treasury('ath-genesis-overpay-treasury-owner');
    const masterInit = await ATHMaster.init(treasuryOwner.address, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
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

    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const treasuryWalletAddress = await master.getGetWalletAddress(treasuryOwner.address);
    const treasuryWalletInit = await ATHWallet.init(0n, treasuryOwner.address, masterAddress);
    const treasuryWallet = blockchain.openContract(new ATHWallet(treasuryWalletAddress, treasuryWalletInit));

    await master.send(treasuryOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'DeployTreasurySupply',
      query_id: 33n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect((await treasuryWallet.getGetWalletData()).balance).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
    // 0.2 GRAM sent, 8,000,000 kept by the master for its own gas and forward fees: the rest is the wallet's.
    expect(await contractBalance(blockchain, treasuryWalletAddress)).toBeGreaterThan(toNano('0.18'));
  });

  it('ATH Master tiny DeployTreasurySupply overpayment does not cancel genesis credit', async () => {
    const blockchain = await Blockchain.create();
    const treasuryOwner = await blockchain.treasury('ath-genesis-dust-overpay-owner');
    const masterInit = await ATHMaster.init(treasuryOwner.address, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
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

    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const treasuryWalletAddress = await master.getGetWalletAddress(treasuryOwner.address);
    const treasuryWalletInit = await ATHWallet.init(0n, treasuryOwner.address, masterAddress);
    const treasuryWallet = blockchain.openContract(new ATHWallet(treasuryWalletAddress, treasuryWalletInit));

    const result = await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_REQUIRED_VALUE + 1n }, {
      $$type: 'DeployTreasurySupply',
      query_id: 34n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect(findTransaction(result.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
      success: true,
    })).toBeDefined();
    expect((await treasuryWallet.getGetWalletData()).balance).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
  });

  it('ATH Master refunds bounced treasury genesis credit envelope when treasury wallet rejects', async () => {
    const blockchain = await Blockchain.create();
    const treasuryOwner = await blockchain.treasury('ath-genesis-bounce-refund-owner');
    const masterInit = await ATHMaster.init(treasuryOwner.address, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
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

    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const treasuryWalletAddress = await master.getGetWalletAddress(treasuryOwner.address);
    const treasuryWalletInit = await ATHWallet.init(0n, treasuryOwner.address, masterAddress);
    const rejectingWalletDataInit = await ATHWallet.init(1n, treasuryOwner.address, masterAddress);
    await blockchain.setShardAccount(
      treasuryWalletAddress,
      createShardAccount({
        address: treasuryWalletAddress,
        code: treasuryWalletInit.code,
        data: rejectingWalletDataInit.data,
        balance: toNano('1'),
        workchain: treasuryWalletAddress.workChain,
      }),
    );

    const result = await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_REQUIRED_VALUE }, {
      $$type: 'DeployTreasurySupply',
      query_id: 35n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect(findTransaction(result.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
      success: false,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: master.address,
      to: treasuryOwner.address,
      success: true,
    })).toBeDefined();

    const retryResult = await master.send(treasuryOwner.getSender(), { value: ATH_GENESIS_SUPPLY_REQUIRED_VALUE }, {
      $$type: 'DeployTreasurySupply',
      query_id: 36n,
      response_destination: treasuryOwner.address,
    } as DeployTreasurySupply);

    expect(findTransaction(retryResult.transactions, {
      from: master.address,
      to: treasuryWalletAddress,
    })).toBeDefined();
  });

  it('ATH treasury wallet rejects direct genesis supply credit from a non-master sender', async () => {
    const blockchain = await Blockchain.create();
    const treasuryOwner = await blockchain.treasury('ath-genesis-direct-owner');
    const attacker = await blockchain.treasury('ath-genesis-direct-attacker');
    const master = fixtureAddress('ATH_GENESIS_DIRECT_MASTER');
    const walletInit = await ATHWallet.init(0n, treasuryOwner.address, master);
    const walletAddress = contractAddress(treasuryOwner.address.workChain, walletInit);
    await blockchain.setShardAccount(
      walletAddress,
      createShardAccount({
        address: walletAddress,
        code: walletInit.code,
        data: walletInit.data,
        balance: toNano('1'),
        workchain: walletAddress.workChain,
      }),
    );

    const wallet = blockchain.openContract(new ATHWallet(walletAddress, walletInit));
    await wallet.send(attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHGenesisSupplyCredit',
      query_id: 4n,
      amount: ATH_TOTAL_SUPPLY_ATOMIC,
      response_destination: attacker.address,
    } as ATHGenesisSupplyCredit);

    expect((await wallet.getGetWalletData()).balance).toBe(0n);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// GENESIS-ACTION — the FIRST step of the ceremony, and the phase its gate does not look at.
//
// MEASURED 2026-07-28, FIXED 2026-07-29. These three tests were written to PIN a defect, and now pin its absence.
//
// What was wrong. Gate 14124 checked context().value >= 5,000,000, which was not the binding constraint. The handler
// kept only ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE (2,000,000) out of the message and refunded everything above
// required_value — while the downstream send carries the FULL ATHWallet StateInit with SendPayFwdFeesSeparately,
// whose forward fee is charged to BALANCE on top of `value`. MEASURED: 754,268 of gas and 3,826,734 of forward fees
// against a 2,000,000 reserve. Two things made it nasty: COMPUTE exited 0 with treasury_supply_deployed set before
// the whole transaction aborted and rolled back, so an exit-code check saw success while zero of the 100,000,000 ATH
// was minted; and sending MORE did not help, because the excess was refunded and never became balance. It worked in
// production only by a number nobody had tied to it — D01 happens to fund ATHMaster with 500,000,000 first.
//
// What changed. The reserve is now 8,000,000, covering the measured cost ~1.75x, so the inbound message pays for its
// own transaction and the master's balance stops being a hidden precondition. The refund is gone: the surplus is
// FORWARDED to the treasury wallet as its permanent rent endowment, which is the only path that ever creates that
// wallet. These tests therefore now assert the inverse of what they used to.
//
// Still true and still unfixed elsewhere: scripts/tier2_p1_deploy_ath.ts sends deploy+mint as a SINGLE message,
// which cannot work at any value — a rehearsal script, not the ceremony packet.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

async function runGenesisSupply(masterOwnBalance: bigint, sentValue: bigint) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_790_000_000;
  const treasuryOwner = await blockchain.treasury('genesis-action-owner');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();
  const masterInit = await ATHMaster.init(treasuryOwner.address, content);
  const masterAddress = contractAddress(0, masterInit);

  await blockchain.setShardAccount(masterAddress, createShardAccount({
    address: masterAddress, code: masterInit.code, data: masterInit.data,
    balance: masterOwnBalance, workchain: 0,
  }));

  const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
  const walletAddress = contractAddress(0, await ATHWallet.init(0n, treasuryOwner.address, masterAddress));

  const result = await master.send(treasuryOwner.getSender(), { value: sentValue }, {
    $$type: 'DeployTreasurySupply', query_id: 1n, response_destination: treasuryOwner.address,
  } as DeployTreasurySupply);

  const tx: any = result.transactions.find((t: any) =>
    t.inMessage?.info?.dest?.toString() === masterAddress.toString() && t.description?.type === 'generic');

  return {
    computeExit: tx?.description?.computePhase?.exitCode,
    aborted: tx?.description?.aborted,
    actionCode: tx?.description?.actionPhase?.resultCode,
    walletState: (await blockchain.getContract(walletAddress)).accountState?.type ?? 'uninit',
    walletBalance: (await blockchain.getContract(walletAddress)).balance,
  };
}

describe('ATHMaster storage top-up', () => {
  it('MASTER-TOPUP-01: an ordinary bounceable top-up now funds the master instead of bouncing off 13001', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    const funder = await blockchain.treasury('ath-master-topup-funder');
    const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();
    const masterInit = await ATHMaster.init(funder.address, content);
    const masterAddress = contractAddress(0, masterInit);
    await blockchain.setShardAccount(masterAddress, createShardAccount({
      address: masterAddress, code: masterInit.code, data: masterInit.data,
      balance: toNano('0.05'), workchain: 0,
    }));
    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));

    // After genesis no handler leaves value here — both remaining legs forward the remainder with SendRemainingValue
    // and 14121 closes DeployTreasurySupply forever — while rent runs at a MEASURED 6,236,368 a year on a contract
    // that is never to be redeployed. Before this receiver existed the fallback threw 13001, so the ordinary
    // bounceable transfer a wallet sends to a known contract came straight back.
    const before = await contractBalance(blockchain, masterAddress);
    await master.send(funder.getSender(), { value: toNano('1'), bounce: true }, {
      $$type: 'ATHMasterTopUpStorageReserve',
    } as any);
    const after = await contractBalance(blockchain, masterAddress);
    expect(after - before, 'a century of rent can be delivered in one ordinary transfer').toBeGreaterThan(toNano('0.99'));
  });
});

describe('GENESIS-ACTION — DeployTreasurySupply pays for itself, and its surplus endows the treasury wallet', () => {
  it('GENESIS-ACTION-01: a master holding NOTHING of its own now completes the mint at the gate minimum', async () => {
    for (const balance of [0n, ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE]) {
      const r = await runGenesisSupply(balance, ATH_GENESIS_SUPPLY_REQUIRED_VALUE);
      expect(r.computeExit, `balance ${balance}: COMPUTE succeeds`).toBe(0);
      expect(r.aborted, `balance ${balance}: and so does ACTION — no rc37 rollback behind a green exit code`).toBe(false);
      expect(r.actionCode, `balance ${balance}: ACTION clean`).toBe(0);
      expect(r.walletState, `balance ${balance}: the 100,000,000 ATH is minted`).toBe('active');
    }
  }, 120_000);

  it('GENESIS-ACTION-02: the master\'s own balance is no longer a hidden precondition', async () => {
    // The old requirement was ~3,000,000 of PRE-EXISTING balance, tied to nothing the gate checked and satisfied in
    // production only because D01 funds the master first. One nanoton of its own is now enough.
    const r = await runGenesisSupply(1n, ATH_GENESIS_SUPPLY_REQUIRED_VALUE);
    expect(r.aborted).toBe(false);
    expect(r.actionCode).toBe(0);
    expect(r.walletState, 'the treasury wallet is deployed and credited').toBe('active');
  }, 60_000);

  it('GENESIS-ACTION-03: sending MORE now ENDOWS the treasury wallet instead of bouncing off a refund', async () => {
    // 0.62 GRAM — the ceremony's raised D02 value — against a master with nothing of its own.
    const r = await runGenesisSupply(0n, 620_000_000n);
    expect(r.computeExit).toBe(0);
    expect(r.aborted, 'value now funds the transaction it pays for').toBe(false);
    expect(r.actionCode).toBe(0);
    expect(r.walletState).toBe('active');
    // The surplus landed where the supply lives. At the MEASURED 5,132,011 a year this is a century of rent, which
    // is what the 100-year vesting schedule requires of a wallet that can never be redeployed.
    expect(r.walletBalance, 'the wallet holds a century of its own rent').toBeGreaterThan(513_201_100n);
  }, 60_000);
});
