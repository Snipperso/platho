import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planStake, VAULT_ABSENT, VAULT_LIVE } from '../web/vault-account.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { toWireAddress } from '../web/shard-reader.mjs';
import { FV_DEPLOY_FUNDING, FV_FLOAT_TOPUP_BELOW, FV_RENT_FLOAT } from '../web/fee-vault.mjs';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests, rawAddress } from '../web/shard-address.mjs';
import { RECORDSHARD_CODE_BOC } from '../web/shard-code.mjs';


const OWNER = '0:' + 'aa'.repeat(32);
const VAULT = '0:' + 'bb'.repeat(32);
const ATH_WALLET = '0:' + 'cc'.repeat(32);
const snapshotAt = (balance: bigint, state = VAULT_LIVE) => ({
  state, staked: 0n, balance, pending: 0n, exitWindow: { open: false, exited: 0n, secondsLeft: 0 },
});
const plan = (snapshot: any) => planStake({ ownerWallet: OWNER, vaultAddress: VAULT, athWalletAddress: ATH_WALLET, ath: 100, snapshot });

describe('VAULT-FLOAT-TOPUP — a correctly funded vault is not starved', () => {
  it('VFT-01: the line is half the float, and the three states a live vault can be in are told apart', () => {
    __setLaneGenerationCodeForTests('vault', 18, RECORDSHARD_CODE_BOC);
    try {
      expect(FV_FLOAT_TOPUP_BELOW).toBe(FV_RENT_FLOAT / 2n);
      expect(FV_DEPLOY_FUNDING, 'the funding IS the float, which is why the float itself cannot be the line').toBe(FV_RENT_FLOAT);
      const healthy = plan(snapshotAt(49_728_932n));
      expect(healthy.ok).toBe(true);
      expect([healthy.deploys, healthy.topsUp], 'not topped up: it holds what a deploy leaves').toEqual([false, false]);
      expect(healthy.messages.length, 'the stake transfer alone').toBe(1);
      for (const balance of [FV_FLOAT_TOPUP_BELOW - 1n, 1_000_000n, 0n]) {
        const low = plan(snapshotAt(balance));
        expect(low.ok).toBe(true);
        expect([low.deploys, low.topsUp], `${balance}: topped up`).toEqual([true, true]);
        expect(low.messages.length, 'the funding message rides ahead of the transfer').toBe(2);
        expect(BigInt(low.messages[0].amount)).toBe(FV_DEPLOY_FUNDING);
        expect(low.messages[0].address).toBe(VAULT);
      }
      const onTheLine = plan(snapshotAt(FV_FLOAT_TOPUP_BELOW));
      expect([onTheLine.deploys, onTheLine.topsUp]).toEqual([false, false]);
      const absent = plan(snapshotAt(0n, VAULT_ABSENT));
      expect([absent.deploys, absent.topsUp]).toEqual([true, false]);
      expect(absent.messages.length).toBe(2);
      expect(absent.messages[0].stateInit, 'a deploy carries the StateInit; on a live account it is ignored').toBeTruthy();
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('VFT-02: the custody balance is read under the key its own reader uses, and the conversion that looks right throws', () => {
    const custody = `0:${'dd'.repeat(32)}`;
    expect(addrKey(custody), 'the raw form is already canonical, so this is a normalisation and not a conversion').toBe(custody);

    const rows = new Map([[addrKey(toWireAddress(custody)), { status: 'active', balance: 12n }]]);
    expect(rows.get(addrKey(custody))?.balance, 'the app key finds the row').toBe(12n);

    expect(() => (rawAddress as any)(custody)).toThrow();

    const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
    const resolver = app.slice(app.indexOf('async function resolveVaultCustodyWallet('), app.indexOf('async function submitStakeAth('));
    expect(resolver, 'the custody address is keyed with the reader own key function').toContain('return publicAddrKey(custody);');
    expect(app, 'and the stake call site takes it from there').toContain('custodyWallet = await resolveVaultCustodyWallet(vaultAddress);');
    expect(app.includes('rawShardAddress(custody)'), 'never with the {workchain, hash} one').toBe(false);
    expect(app, 'an unread balance is not a low one: only an ABSENT row is zero')
      .toContain("custodyBalance = row === null ? 0n : (row.status === 'unknown' ? null : BigInt(row.balance ?? 0n));");
  });
});
