import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A DIRECT-PAY ACTION MUST CHECK BOTH CURRENCIES BEFORE IT SIGNS.
//
// Owner, 2026-08-20: "есть проблема с минтом юзернеймов. В каких-то случаях деньги за юзернейм списываются, а
// юзер не минтится."
//
// MEASURED on the failing transaction the owner linked (wallet 0:FE09FD41…, tx ab75abfc…):
//   balance before 0.266225197 GRAM, after 0.265632119 GRAM, fee 0.000593078
//   action phase:  tot_actions 1, skipped_actions 1, msgs_created 0
//
// The wallet held the name's ATH but not its 1.1 GRAM. The mint checked ATH only, so it signed an external the
// wallet contract could not execute: with SendIgnoreErrors the action was SILENTLY SKIPPED, the seqno advanced,
// and the client read that as sent. Nothing was stolen — an explorer showing "-1.1 GRAM Failed" is rendering the
// INTENDED action — but the user got no name, no reason, and tried nine times.
//
// The avatar lane already carried both checks and says why in its own comment. The mint lane never grew the
// second one. So this gate asserts the SET: every direct-pay lane, not just the one that broke.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

/** The body of a function, from its declaration to the next top-level `async function` / `function`. */
function bodyOf(name: string): string {
  const start = app.indexOf(`async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const rest = app.slice(start + 10);
  const next = rest.search(/\n(?:async )?function \w+\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

// Every lane that spends the user's ATH and GRAM in one signed external. Add a lane here when you add one —
// that is the point of the list.
const DIRECT_PAY_LANES = ['submitUsernameMintDirect', 'submitProfileAvatarDirect'];

describe('DIRECTPAY — affordability is checked in both currencies, before signing', () => {
  it.each(DIRECT_PAY_LANES)('DIRECTPAY-01: %s checks ATH *and* GRAM', (lane) => {
    const body = bodyOf(lane);
    expect(body, `${lane} does not check the ATH price`).toContain('assertConnectedAthAtLeast(');
    // The one that was missing. Without it the external is signed, the send action is dropped by
    // SendIgnoreErrors, and the failure is indistinguishable from success on the client.
    expect(body, `${lane} does not check the GRAM the send carries`).toContain('assertWalletGramAtLeast(');
  });

  it.each(DIRECT_PAY_LANES)('DIRECTPAY-02: %s checks BEFORE it signs, not after', (lane) => {
    const body = bodyOf(lane);
    const gram = body.indexOf('assertWalletGramAtLeast(');
    // The two lanes sign through different senders — the mint builds one wallet transfer, the avatar publishes
    // shard parts with the ATH request riding along — so the marker is "whichever sender this lane uses", not a
    // single function name. A lane whose sender is neither would fail here rather than pass vacuously.
    const senders = ['sendPlathoWalletTransaction(', 'publishPublicLaneParts(']
      .map((name) => body.indexOf(name))
      .filter((at) => at > -1);
    expect(gram).toBeGreaterThan(-1);
    expect(senders.length, `${lane} uses an unrecognised sender — teach this gate about it`).toBeGreaterThan(0);
    const sign = Math.min(...senders);
    // A check after the signature is a check of a decision already taken.
    expect(gram, `${lane} signs before checking`).toBeLessThan(sign);
  });

  it('DIRECTPAY-03: the mint reserves the value it actually sends, plus fees', () => {
    const body = bodyOf('submitUsernameMintDirect');
    // Not a typed-in figure: the same constant the message carries, so the two cannot drift apart.
    expect(body).toContain('USERNAME_MINT_DIRECT_REQUEST_VALUE + walletSendFeeReserveNanotons()');
    expect(body).toContain("valueNanotons: USERNAME_MINT_DIRECT_REQUEST_VALUE");
  });

  it('DIRECTPAY-04: the shortfall is fatal and speaks the user language', () => {
    // assertWalletGramAtLeast raises PLATHO_WALLET_GRAM_REQUIRED with errors.walletNeedsGram; the send-status
    // path already treats that code as fatal (no retry ladder against a balance that will not change) and prints
    // the message. Pinned here so a refactor of either half cannot quietly orphan this lane.
    const assertion = app.slice(app.indexOf('async function assertWalletGramAtLeast'));
    expect(assertion.slice(0, 700)).toContain("t('errors.walletNeedsGram'");
    expect(assertion.slice(0, 700)).toContain("error.code = 'PLATHO_WALLET_GRAM_REQUIRED'");
    expect(app).toContain("error?.code === 'PLATHO_WALLET_GRAM_REQUIRED'");
  });
});
