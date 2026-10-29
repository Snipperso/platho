import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { FV_FLOAT_TOPUP_BELOW, FV_PROTOCOL_FEE } from '../web/fee-vault.mjs';
import { VAULT_ABSENT, VAULT_LIVE, VAULT_UNKNOWN } from '../web/vault-account.mjs';
import { convMessageFinalCost } from '../web/publish-final-cost.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
const WALLET = '0:' + 'ab'.repeat(32);
const VAULT = '0:' + 'cd'.repeat(32);

function termsWith({ snapshot = null as any, kept = null as any, outdated = false } = {}) {
  const reads: string[] = [];
  const terms = lift({
    feeVaultState: { wallet: snapshot ? WALLET : null, address: snapshot ? VAULT : null, snapshot },
    plathoWallet: { address: WALLET },
    rememberedVaultReading: kept,
    vaultSnapshotOutdated: () => outdated,
    composerChainFact: (key: string) => { reads.push(key); },
    refreshFeeVaultState: () => {},
    ownVaultFeeDue: (s: any) => BigInt(s.feeDue),
    VAULT_LIVE, VAULT_UNKNOWN, FV_PROTOCOL_FEE, FV_FLOAT_TOPUP_BELOW,
  }, [fn('function composerVaultTerms() {')], 'composerVaultTerms')();
  return { terms, reads };
}

describe('the fee vault reading kept for the price line', () => {
  it('VKEEP-01: before the session reads the vault the line prices from the kept reading — and only then', () => {
    const kept = { wallet: WALLET, address: VAULT, feeDue: 0n, low: false };
    const before = termsWith({ kept: null });
    expect(before.terms, 'MEASURED before: the full fee and the setup, whatever the stake').toEqual({ feeDue: FV_PROTOCOL_FEE, vaultDeposit: true });
    const now = termsWith({ kept });
    expect(now.terms, 'a 100 % stake priced at once, no setup').toEqual({ feeDue: 0n, vaultDeposit: false });
    expect(now.reads, 'and the session read is still asked for').toEqual(['vault']);
    expect(termsWith({ snapshot: { state: VAULT_UNKNOWN }, kept }).terms).toEqual({ feeDue: 0n, vaultDeposit: false });
    expect(termsWith({ kept: { ...kept, low: true } }).terms.vaultDeposit).toBe(true);
    const live = { state: VAULT_LIVE, feeDue: 8_140_000n, balance: FV_FLOAT_TOPUP_BELOW };
    expect(termsWith({ snapshot: live, kept }).terms).toEqual({ feeDue: 8_140_000n, vaultDeposit: false });
    expect(termsWith({ snapshot: { state: VAULT_ABSENT, feeDue: FV_PROTOCOL_FEE }, kept }).terms).toEqual({ feeDue: FV_PROTOCOL_FEE, vaultDeposit: true });
    expect(termsWith({ snapshot: live, kept, outdated: true }).terms.feeDue).toBe(FV_PROTOCOL_FEE);
    expect(termsWith({ kept: { ...kept, wallet: '0:' + 'ef'.repeat(32) } }).terms).toEqual({ feeDue: FV_PROTOCOL_FEE, vaultDeposit: true });
  });

  it('VKEEP-02: the first private price after an unlock is the stake\'s, not the dearest case', () => {
    const kept = { wallet: WALLET, address: VAULT, feeDue: 0n, low: false };
    const priced = (terms: any) => convMessageFinalCost({ generation: 18, sizeClasses: [1], first: true, recordIndex: 1, feeDue: terms.feeDue, vaultDeposit: terms.vaultDeposit });
    const before = priced(termsWith({ kept: null }).terms);
    expect([before.cost, before.deposit], 'MEASURED before: 0.0263 and a 0.05 setup on screen').toEqual([26_248_410n, 49_999_999n]);
    const now = priced(termsWith({ kept }).terms);
    expect([now.cost, now.deposit], 'the first message of the day at a 100 % stake: 0.0133, nothing to set up').toEqual([13_327_942n, 0n]);
  });

  it('VKEEP-03: every answer of the chain is kept — the fee and the float line, once per change — and an absent vault is forgotten', () => {
    const values = new Map<string, string>();
    let writes = 0;
    const store = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { writes += 1; values.set(key, value); },
      removeItem: (key: string) => { writes += 1; values.delete(key); },
    };
    const env = { plathoWallet: { address: WALLET }, walletLocalStorage: () => store, VAULT_LIVE, VAULT_ABSENT, FV_PROTOCOL_FEE, FV_FLOAT_TOPUP_BELOW };
    const prelude = "let rememberedVaultReading = null; const WALLET_LOCAL_VAULT_READING_KEY = 'vaultReading';";
    const remember = lift(env, [fn('function rememberVaultReading(wallet, address, snapshot) {')],
      '{ remember: rememberVaultReading, held: () => rememberedVaultReading }', prelude);
    remember.remember(WALLET, VAULT, { state: VAULT_LIVE, feeDue: 0n, balance: 88_667_923n });
    expect(JSON.parse(values.get('vaultReading')!)).toEqual({ address: VAULT, feeDue: '0', low: false });
    expect(remember.held()).toEqual({ wallet: WALLET, address: VAULT, feeDue: 0n, low: false });
    remember.remember(WALLET, VAULT, { state: VAULT_LIVE, feeDue: 0n, balance: 98_000_000n });
    expect(writes, 'one write for two equal readings').toBe(1);
    remember.remember(WALLET, VAULT, { state: VAULT_LIVE, feeDue: 5n, balance: 0n, assumed: true });
    remember.remember(WALLET, VAULT, { state: VAULT_LIVE, feeDue: 5n, balance: 0n, stale: true });
    expect(writes).toBe(1);
    remember.remember(WALLET, VAULT, { state: VAULT_ABSENT });
    expect(values.has('vaultReading'), 'an absent vault is forgotten').toBe(false);
    expect(remember.held()).toBeNull();
    const refresh = code(fn('async function refreshFeeVaultState({ critical = false } = {}) {'));
    const assigned = refresh.indexOf('feeVaultState = { wallet, address, snapshot, realAtoms };');
    const kept = refresh.indexOf('rememberVaultReading(wallet, address, snapshot);', assigned);
    expect(assigned).toBeGreaterThan(-1);
    expect(kept).toBeGreaterThan(assigned);
    expect(refresh.slice(assigned, kept)).not.toContain('return');
  });

  it('VKEEP-04: taken back at the unlock only for the vault this wallet derives now, a fee inside the band, and no session answer yet', async () => {
    const run = async (held: any, { session = null as any, derived = VAULT } = {}) => {
      const values = new Map<string, string>(held === undefined ? [] : [['vaultReading', JSON.stringify(held)]]);
      let redraws = 0;
      const wallet = { address: WALLET };
      const env = {
        plathoWallet: wallet, walletLocalStorage: () => ({
          getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
        }),
        vaultSupported: () => true, vaultAddressFor: async () => derived, sameWalletAddress: (a: string, b: string) => a === b,
        feeVaultState: { wallet: session ? WALLET : null, snapshot: session }, FV_PROTOCOL_FEE, refreshComposerCostStatus: () => { redraws += 1; },
      };
      const prelude = "let rememberedVaultReading = null; const WALLET_LOCAL_VAULT_READING_KEY = 'vaultReading';";
      const lifted = lift(env, [fn('async function loadRememberedVaultReading(wallet) {')],
        '{ load: loadRememberedVaultReading, held: () => rememberedVaultReading }', prelude);
      await lifted.load(wallet);
      return { held: lifted.held(), kept: values.has('vaultReading'), redraws };
    };
    const reading = { address: VAULT, feeDue: '0', low: false };
    const taken = await run(reading);
    expect(taken.held).toEqual({ wallet: WALLET, address: VAULT, feeDue: 0n, low: false });
    expect(taken.redraws, 'the line is drawn again with it').toBe(1);
    const otherVault = await run(reading, { derived: '0:' + '99'.repeat(32) });
    expect([otherVault.held, otherVault.kept], 'another code is another vault: dropped').toEqual([null, false]);
    const outOfBand = await run({ ...reading, feeDue: String(FV_PROTOCOL_FEE + 1n) });
    expect([outOfBand.held, outOfBand.kept]).toEqual([null, false]);
    const answered = await run(reading, { session: { state: VAULT_LIVE } });
    expect(answered.held, 'a session answer that came first stands').toBeNull();
    expect((await run(undefined)).held).toBeNull();
    const boot = code(fn('async function bootWalletScopedLocalStores() {'));
    expect(boot.indexOf('if (wallet) void loadRememberedVaultReading(wallet);')).toBeGreaterThan(boot.indexOf('await loadWalletSets(wallet);'));
    expect(code(app)).toContain('feeVaultState = { wallet: null, address: null, snapshot: null };\n  rememberedVaultReading = null;');
  });

  it('VKEEP-05: no send reads it — the private, group and public routings decide from their own read', () => {
    for (const name of ['async function convVaultRouting() {', 'async function publicPublishRouting() {', 'function composerPublicRoutes(']) {
      expect(code(fn(name)), name).not.toContain('rememberedVaultReading');
    }
    const readers = [...code(app).matchAll(/rememberedVaultReading/g)].length;
    expect(readers).toBe(10);
    expect(code(fn('async function openVaultRestoreDialog(')).match(/rememberedVaultReading/g)?.length, 'the stake clause alone').toBe(2);
  });
});
