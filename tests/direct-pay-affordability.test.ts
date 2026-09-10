import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A DIRECT-PAY ACTION MUST CHECK BOTH CURRENCIES BEFORE IT SIGNS.
//
// decided 2026-08-20
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

// The lanes that spend the user's ATH as well as GRAM. Only two, and both by construction (a name mint and an
// avatar publish carry an ATH price); the GRAM set below is DERIVED, because a hand-kept list is what failed.
const DIRECT_PAY_LANES = ['submitUsernameMintDirect', 'submitProfileAvatarDirect'];

/**
 * EVERY LANE THAT SIGNS A VALUE-CARRYING SEND, read out of app.js rather than listed by hand.
 *
 * [audit 2026-09-01, round 9.] This file used to assert its property over two named lanes, with a comment saying
 * "add a lane here when you add one — that is the point of the list". Four lanes were then added or overlooked and
 * nobody added them: the conversation-key BACKUP, the prefs snapshot, the GRAM transfer and the.ath name
 * transfer all signed with no affordability check at all. The first two are the worst of the four — they are
 * background writes nothing reads back, so an underfunded publish was dropped by IGNORE_ERRORS, the wallet's
 * transaction still succeeded, the caller cleared its dirty flag, and every conversation in that recovery slot
 * became permanently undecryptable after a reinstall.
 *
 * A list you must remember to extend cannot catch the case where you forgot. This enumerates instead: any
 * top-level function whose body reaches a sender must carry the check. A lane added tomorrow is covered the day
 * it is written.
 */
const SENDER_CALLS = /\bsendPlathoWalletTransaction\(|\bpublishConvLaneParts\(|\bpublishConvLane\(|\bpublishPublicLaneParts\(/;

function sendingLanes(): Array<{ name: string; body: string }> {
  const marks: Array<{ name: string; at: number }> = [];
  const re = /\n(?:async )?function (\w+)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(app)) !== null) marks.push({ name: m[1], at: m.index });
  const out: Array<{ name: string; body: string }> = [];
  for (let i = 0; i < marks.length; i += 1) {
    const body = app.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : app.length);
    if (SENDER_CALLS.test(body)) out.push({ name: marks[i].name, body });
  }
  return out;
}

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
  it('DIRECTPAY-05: EVERY lane that signs a value-carrying send checks GRAM first — enumerated, not listed', () => {
    const lanes = sendingLanes();
    // The enumeration itself must be alive: if the sender names are renamed out from under it, it would pass
    // vacuously over an empty set, which is the failure mode this whole file exists to prevent.
    expect(lanes.length, 'no sending lanes found — the sender names must have moved').toBeGreaterThanOrEqual(10);
    expect(lanes.map((lane) => lane.name)).toContain('attemptConvMessagePublishDirect');
    // NAMED WHERE THE BODY IS. `runRecoveryBackup` is now the re-entry guard around `…Unguarded`, which is what
    // actually signs — the enumeration finds it on its own, and this literal has to point at the same place.
    expect(lanes.map((lane) => lane.name)).toContain('runRecoveryBackupUnguarded');

    const unchecked = lanes.filter((lane) => !lane.body.includes('assertWalletGramAtLeast(')).map((lane) => lane.name);
    expect(unchecked, `these sign without asking whether the wallet can pay:\n${unchecked.join('\n')}`).toEqual([]);

    // …and the check must come BEFORE the signature in each of them: a check afterwards checks a decision already
    // taken, and IGNORE_ERRORS means the decision cannot be observed to have failed.
    for (const lane of lanes) {
      const check = lane.body.indexOf('assertWalletGramAtLeast(');
      const sign = lane.body.search(SENDER_CALLS);
      expect(check, `${lane.name}: the check must be there`).toBeGreaterThan(-1);
      expect(sign, `${lane.name}: the sender must be there`).toBeGreaterThan(-1);
      expect(check, `${lane.name} signs before checking`).toBeLessThan(sign);
    }
  });

  it('DIRECTPAY-06: the two self-lanes reserve for the body they actually built', () => {
    // The recovery blob and the prefs snapshot are not capsules, so no size class comes with them — and a fixed
    // class would be wrong at both ends. MEASURED by bisecting a real RecoveryShard deploy: a FULL slot (28
    // conversations, 10,485 payload bytes) needs 52,040,098 held, which the class-8 quote does not cover; while a
    // one-conversation slot quoted at that class would REFUSE a backup that would have succeeded — on the lane
    // whose absence is what makes conversations undecryptable after a reinstall.
    for (const lane of ['runRecoveryBackupUnguarded', 'submitPrefsSnapshotDirect']) {
      const body = bodyOf(lane);
      expect(body, `${lane} must size its reserve from the body it built`)
        .toContain('walletSendSizeClassForPayloadBytes(tonCell.serializeBoc(built.body).length)');
      expect(body, `${lane} must reserve the value it carries too`).toContain('RECOVERY_PUBLISH_VALUE');
    }
    // The primitive rounds UP, so the quote it picks provably covers the body.
    expect(app).toContain('walletSendSizeClassForPayloadBytes');
    const fee = readFileSync('web/wallet-send-fee.mjs', 'utf8');
    expect(fee).toContain('export function walletSendSizeClassForPayloadBytes(payloadBytes)');
    expect(fee).toContain('if (bytes <= WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass]) return sizeClass;');
  });
});
