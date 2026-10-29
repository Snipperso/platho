import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');

function bodyOf(name: string): string {
  const start = app.indexOf(`async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const rest = app.slice(start + 10);
  const next = rest.search(/\n(?:async )?function \w+\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

const DIRECT_PAY_LANES = ['submitUsernameMintDirect', 'submitProfileAvatarDirect'];

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
    expect(body, `${lane} does not check the GRAM the send carries`).toContain('assertWalletGramAtLeast(');
  });

  it.each(DIRECT_PAY_LANES)('DIRECTPAY-02: %s checks BEFORE it signs, not after', (lane) => {
    const body = bodyOf(lane);
    const gram = body.indexOf('assertWalletGramAtLeast(');
    const senders = ['sendPlathoWalletTransaction(', 'publishPublicLaneParts(']
      .map((name) => body.indexOf(name))
      .filter((at) => at > -1);
    expect(gram).toBeGreaterThan(-1);
    expect(senders.length, `${lane} uses an unrecognised sender — teach this gate about it`).toBeGreaterThan(0);
    const sign = Math.min(...senders);
    expect(gram, `${lane} signs before checking`).toBeLessThan(sign);
  });

  it('DIRECTPAY-03: the mint reserves the value it actually sends, plus fees', () => {
    const body = bodyOf('submitUsernameMintDirect');
    expect(body).toContain('USERNAME_MINT_DIRECT_REQUEST_VALUE + walletSendFeeReserveNanotons()');
    expect(body).toContain("valueNanotons: USERNAME_MINT_DIRECT_REQUEST_VALUE");
  });

  it('DIRECTPAY-04: the shortfall is fatal and speaks the user language', () => {
    const from = app.indexOf('async function assertWalletGramAtLeast');
    const assertion = app.slice(from, app.indexOf('\n}\n', from) + 2);
    expect(assertion).toContain("t('dialog.labelPrefix', { label: t('common.balanceNeeded') })");
    expect(assertion).toContain("t('common.balanceNeededShort', {");
    expect(assertion).toContain("error.code = 'PLATHO_WALLET_GRAM_REQUIRED'");
    expect(app).toContain("error?.code === 'PLATHO_WALLET_GRAM_REQUIRED'");
  });
  it('DIRECTPAY-05: EVERY lane that signs a value-carrying send checks GRAM first — enumerated, not listed', () => {
    const lanes = sendingLanes();
    expect(lanes.length, 'no sending lanes found — the sender names must have moved').toBeGreaterThanOrEqual(10);
    expect(lanes.map((lane) => lane.name)).toContain('attemptConvMessagePublishDirect');
    expect(lanes.map((lane) => lane.name)).toContain('runRecoveryBackupLocked');

    const unchecked = lanes.filter((lane) => !lane.body.includes('assertWalletGramAtLeast(')).map((lane) => lane.name);
    expect(unchecked, `these sign without asking whether the wallet can pay:\n${unchecked.join('\n')}`).toEqual([]);

    for (const lane of lanes) {
      const check = lane.body.indexOf('assertWalletGramAtLeast(');
      const sign = lane.body.search(SENDER_CALLS);
      expect(check, `${lane.name}: the check must be there`).toBeGreaterThan(-1);
      expect(sign, `${lane.name}: the sender must be there`).toBeGreaterThan(-1);
      expect(check, `${lane.name} signs before checking`).toBeLessThan(sign);
    }
  });

  it('DIRECTPAY-06: the two self-lanes reserve for the body they actually built', () => {
    for (const [lane, sized] of [
      ['runRecoveryBackupLocked', 'walletSendSizeClassForPayloadBytes(tonCell.serializeBoc(built.body).length)'],
      ['submitPrefsSnapshotDirect', 'prefsSizeClasses.push(walletSendSizeClassForPayloadBytes(tonCell.serializeBoc(write.body).length));'],
    ]) {
      const body = bodyOf(lane);
      expect(body, `${lane} must size its reserve from the body it built`).toContain(sized);
      expect(body, `${lane} must reserve the value it carries too`).toContain('RECOVERY_PUBLISH_VALUE');
    }
    expect(app).toContain('walletSendSizeClassForPayloadBytes');
    const fee = readFileSync('web/wallet-send-fee.mjs', 'utf8');
    expect(fee).toContain('export function walletSendSizeClassForPayloadBytes(payloadBytes)');
    expect(fee).toContain('if (bytes <= WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass]) return sizeClass;');
  });
});
