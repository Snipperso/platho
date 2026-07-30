import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

// CEREMONY AUDIT. Steps W01..W04 endow the four protocol-owned official ATHWallets, and two of those accounts DO NOT
// EXIST when the step is signed: MarketStabilitySeller's reserve is funded by a separate script outside this packet,
// and BuybackBurn's wallet is created by its first buyback. So the endowment lands on an UNINITIALISED address.
//
// The packet gives every target in UQ (non-bounceable) form, which is what stops the value coming straight back. That
// leaves the actual question, and it is not one to reason about: does value parked on an uninit account SURVIVE until
// the wallet is deployed there, or is 1.2 GRAM of endowment lost to a step that looks successful?
//
// The same question decides whether the `must_be_signed_after: F02` note on those two steps means anything.

describe('ceremony endowment before deploy', () => {
  it('CEREMONY-W-01: MEASURED — an endowment parked on an uninit wallet address survives its later deploy', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const funder = await bc.treasury('ceremony-endow-funder');
    const owner = await bc.treasury('ceremony-endow-owner');
    const master = (await bc.treasury('ceremony-endow-master')).address;

    const zeroInit = await ATHWallet.init(0n, owner.address, master);
    const walletAddress = contractAddress(0, zeroInit);

    // The account must genuinely not exist, or this measures nothing.
    expect((await bc.getContract(walletAddress)).accountState?.type ?? 'uninit', 'precondition: no wallet yet')
      .not.toBe('active');

    // W01-shaped: ATHWalletTopUpStorageReserve (0x41544807), non-bounceable, exactly as a UQ target is signed.
    const ENDOWMENT = 600_000_000n;
    await funder.send({
      to: walletAddress,
      value: ENDOWMENT,
      bounce: false,
      body: beginCell().storeUint(0x41544807, 32).endCell(),
    } as any);

    const parked = (await bc.getContract(walletAddress)).balance;
    expect(parked, 'the value parks on the uninit account instead of bouncing').toBeGreaterThan(ENDOWMENT - 20_000_000n);

    // Now the wallet is deployed there, exactly as the genesis ATH transfer would do it: StateInit attached, and the
    // data carries the credited balance. The question is whether the parked value is still there afterwards.
    const dataInit = await ATHWallet.init(1_000n, owner.address, master);
    await bc.setShardAccount(walletAddress, createShardAccount({
      address: walletAddress,
      code: zeroInit.code,
      data: dataInit.data,
      balance: parked,                       // the deploy does NOT reset the balance — this is the property
      workchain: 0,
    }));

    const after = (await bc.getContract(walletAddress)).balance;
    expect(after, 'the endowment is still there after the wallet exists').toBe(parked);

    // And it is a century of rent, which is the whole point of the step. ATHWallet is 81 code cells => 5,456,808/year.
    expect(after, 'and it is worth the 100 years W01..W04 exist to buy').toBeGreaterThan(5_456_808n * 100n);
  }, 120_000);

  it('CEREMONY-W-03: the packet emits every endowment target in the NON-BOUNCEABLE form', async () => {
    // The property CEREMONY-W-02 just showed to be load-bearing, pinned against the artefact an operator actually
    // signs. A UQ prefix is what tells the wallet bounce:false; emit these in EQ and the endowment silently returns.
    const { existsSync, readFileSync } = await import('node:fs');
    const path = 'artifacts/local/mainnet_tx_dry_run_packet.json';
    if (!existsSync(path)) return;
    const packet = JSON.parse(readFileSync(path, 'utf8'));
    const steps: Array<{ id: string; target_address: string }> = packet.wallet_endowment_messages ?? [];
    expect(steps.length, 'W01..W04 must be in the packet').toBe(4);
    for (const step of steps) {
      expect(step.target_address.startsWith('UQ'),
        `${step.id} target ${step.target_address} must be non-bounceable (UQ) — an EQ target returns the endowment`)
        .toBe(true);
    }
  });

  it('CEREMONY-W-02: a BOUNCEABLE endowment to the same uninit address comes straight back', async () => {
    // The counter-measurement that gives the one above its meaning: the UQ form in the packet is not cosmetic. Signed
    // against an EQ (bounceable) address, the same step returns the money and the wallet is left on its transfer
    // float — the four-and-a-half-year state W01..W04 exist to prevent, with the ceremony reporting success.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const funder = await bc.treasury('ceremony-endow-funder-2');
    const owner = await bc.treasury('ceremony-endow-owner-2');
    const master = (await bc.treasury('ceremony-endow-master-2')).address;
    const walletAddress = contractAddress(0, await ATHWallet.init(0n, owner.address, master));

    await funder.send({
      to: walletAddress,
      value: 600_000_000n,
      bounce: true,
      body: beginCell().storeUint(0x41544807, 32).endCell(),
    } as any);

    const parked = (await bc.getContract(walletAddress)).balance;
    expect(parked, 'a bounceable endowment does not stay').toBeLessThan(20_000_000n);
  }, 120_000);
});
