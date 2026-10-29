import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const between = (from: string, to: string) => {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start);
  expect(start, `anchor present: ${from}`).toBeGreaterThan(-1);
  expect(end, `anchor present after it: ${to}`).toBeGreaterThan(start);
  return app.slice(start, end);
};

describe('CONV-VAULT-WIRING — the app hands the funnel the vault, the fee and the deploy decision', () => {
  it('CVW-01: convVaultRouting derives the vault from the SIGNING wallet, charges the full fee unless the read is fresh, deploys only an account the chain says is absent', () => {
    const fn = between('async function convVaultRouting()', 'function noteFeeVaultDeployed(');
    expect(fn).toContain('if (!vaultSupported() || !plathoWallet?.address) return {};');
    expect(fn).toContain('let mine = feeVaultState.wallet === plathoWallet.address ? feeVaultState : null;');
    expect(fn).toContain('const fresh = snapshot?.state === VAULT_LIVE && !snapshot.stale && !snapshot.assumed && !vaultSnapshotOutdated();');
    expect(fn).toContain('const vaultAddress = (feeVaultState.wallet === plathoWallet.address ? feeVaultState.address : null) ?? await vaultAddressFor(plathoWallet.address);');
    expect(fn).toContain('feeDue: fresh ? ownVaultFeeDue(snapshot) : FV_PROTOCOL_FEE');
    expect(fn).toContain('const wantsDeploy = (snap) => snap?.state === VAULT_ABSENT');
    expect(fn).toContain('let deployVault = wantsDeploy(mine.snapshot);');
    expect(fn).toContain('const carried = await feeVaultDeployCarriedElsewhere(plathoWallet.address);');
    expect(fn).toContain('deployVault = !carried && wantsDeploy(after);');
    expect(fn).toContain('if (deployVault) flight = openFeeVaultDeployFlight(plathoWallet.address);');
    expect(fn).toContain('deployFlight: flight,');
  });

  it('CVW-02: the CONV send routes through it, remembers a deploy, and tells the funnel what it knows about the shard', () => {
    const send = between('const routing = throughVault ? await convVaultRouting() : {};', 'globalThis.plathoLastConvSend = {');
    expect(send).toContain('if (broadcastMayHaveLanded(error)) noteFeeVaultDeployed(signer?.address, routing.vaultAddress, routing.deployFlight, { unconfirmed: unconfirmedExternalOf(error) });');
    expect(send).toContain('else settleFeeVaultDeployFlight(signer?.address, false, routing.deployFlight);');
    expect(send).toContain('publishConvLaneParts({ wallet: requireSameWallet(signer), transport, ...routing }, parts,');
    expect(send).toContain("assertAffordable: (extra) => assertWalletGramAtLeast(convNeed + extra, 'send')");
    expect(send).toContain('if (result?.deploy) noteFeeVaultDeployed(signer?.address, routing.vaultAddress, routing.deployFlight, { unconfirmed: unconfirmedExternalOf(result.result) });');
    expect(app).toContain('const shardLive = Math.max(coldFloor, convBucketSeqHighWater(route.address)) > 0;');
    expect(app).toContain('value: CONV_PUBLISH_VALUE, shardLive });');
  });

  it('CVW-03: a vault ASSUMED after a deploy is remembered as live at the full fee, and never routes a PUBLIC post through the discount door', () => {
    const note = between('function noteFeeVaultDeployed(', 'async function refreshFeeVaultState');
    expect(note).toContain('if (!wallet || plathoWallet?.address !== wallet) return;');
    expect(note).toContain("snapshot: { ...vaultSnapshot(null, vaultClock()), state: VAULT_LIVE, assumed: true, assumedAt: Date.now(), assumedFrom: from },");
    const publicRouting = between('async function publicPublishRouting()', 'async function convVaultRouting()');
    expect(publicRouting).toContain('if (snapshot.stale || snapshot.assumed) return {};');
  });
});
