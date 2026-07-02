import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Wallet->Vault activation reserve (owner-flagged trap 2026-07-02): depositing into the Vault needs no
// activation, but WITHDRAWING does (the withdraw external is signed by the on-chain-registered auth key), and
// activation is itself a wallet transaction — so moving all GRAM in while un-activated strands the funds.
// These guards pin the reserve + the pre-deposit confirm so the trap can't silently reopen.
describe('vault activation-reserve trap guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('VAULT-RESERVE-01: MAX keeps the activation cost in the wallet while un-activated', () => {
    expect(app).toMatch(/function vaultMoveWalletTonReserveNanotons\(\)/);
    // Just the gas keep once activated; gas keep + activation fee while not.
    expect(app).toMatch(/if \(hasActivePlathoAccount\(\)\) return VAULT_MOVE_WALLET_TON_GAS_KEEP_NANOTONS;/);
    // Un-activated: gas keep + activation fee + a buffer for the deposit's own on-chain overhead + fee margin.
    expect(app).toMatch(/return VAULT_MOVE_WALLET_TON_GAS_KEEP_NANOTONS\s*\+ plathoAccountActivationFeeNanotons\(\)\s*\+ VAULT_MOVE_ACTIVATION_RESERVE_BUFFER_NANOTONS;/);
    expect(app).toMatch(/const VAULT_MOVE_ACTIVATION_RESERVE_BUFFER_NANOTONS = 25_000_000n/);
    // vaultMoveMaxAmount uses the reserve for wallet-source TON.
    const maxFn = app.slice(app.indexOf('function vaultMoveMaxAmount'), app.indexOf('function vaultMoveMaxAmount') + 500);
    expect(maxFn).toMatch(/const reserve = vaultMoveWalletTonReserveNanotons\(\);\s*return balance > reserve \? balance - reserve : 0n;/);
  });

  it('VAULT-RESERVE-02: a stranding deposit is confirm-gated (only wallet->Vault TON, only un-activated)', () => {
    expect(app).toMatch(/async function confirmVaultDepositKeepsActivationReserve\(amount\)/);
    // Passes silently when activated or the kept amount is enough / balance unknown.
    expect(app).toMatch(/if \(hasActivePlathoAccount\(\)\) return true;/);
    expect(app).toMatch(/if \(walletBal - amt >= reserve\) return true;/);
    // It is a CONFIRM ("Move anyway"), not a hard block — a user funding activation elsewhere may proceed.
    expect(app).toMatch(/submitLabel: 'Move anyway'/);
    // The guard lives INSIDE submitVaultDepositTonAmount so EVERY deposit entry point is covered (card submit,
    // the submitVaultDepositTon wrapper, and the globalThis export) — not just the card handler.
    expect(app).toMatch(/async function submitVaultDepositTonAmount\(amount\) \{[\s\S]{0,300}if \(!\(await confirmVaultDepositKeepsActivationReserve\(amount\)\)\) \{\s*setVaultStatus\('move cancelled'\);\s*return null;/);
  });

  it('VAULT-RESERVE-03: the reserve note is class-styled (prod CSP bans inline styles)', () => {
    expect(app).toMatch(/card\.note\.className = 'vault-move-note'/);
    expect(app).toMatch(/to activate your account/);
    expect(css).toMatch(/\.vault-move-note \{/);
    expect(app).not.toMatch(/style\s*=\s*["'`][^"'`]*vault-move-note/);
  });
});
