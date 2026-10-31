
import { buildIntroPublishBrowser } from './intro-publish-browser.mjs?v=105';
import { parseBocBase64, serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=94';
import { applyShardSurcharge, surchargeExtraNanotons, LANE_INTRO } from './shard-debt.mjs?v=83';
import { directWriteLiveSurchargeNanotons, DIRECT_WRITE_GAS_MAX } from './fee-vault.mjs?v=39';

function b64urlToBytes(value) {
  const b64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

function introPublishFieldsFromCapsule(capsule) {
  const cells = capsule?.chainCells;
  if (!cells?.header0?.boc || !cells?.body?.boc) {
    throw new Error('INTRO capsule is missing its on-chain payload cells (chainCells.header0/body)');
  }
  const ephemeralR = capsule.header0?.ephemeralR ?? capsule.header0?.ephemeral_r;
  if (!ephemeralR) throw new Error('INTRO capsule header0 is missing the ephemeral R');
  return {
    header0: parseBocBase64(cells.header0.boc),
    body: parseBocBase64(cells.body.boc),
    r: bytesToBig(b64urlToBytes(ephemeralR)),
    viewTag: BigInt(capsule.header0?.viewTag ?? capsule.header0?.view_tag ?? 0),
  };
}

export function introCapsuleStealthFields(capsule) {
  const ephemeralR = capsule?.header0?.ephemeralR ?? capsule?.header0?.ephemeral_r;
  if (!ephemeralR) throw new Error('INTRO capsule header0 is missing the ephemeral R');
  return { r: bytesToBig(b64urlToBytes(ephemeralR)), viewTag: BigInt(capsule?.header0?.viewTag ?? capsule?.header0?.view_tag ?? 0) };
}

export async function buildIntroPublishWalletMessage({ epoch, bucket, capsule, value }) {
  const { header0, body, r, viewTag } = introPublishFieldsFromCapsule(capsule);
  const built = await buildIntroPublishBrowser({ epoch, bucket, r, viewTag, header0, body, value });
  return {
    to: built.to,
    value: built.value,
    init: built.init,
    body: built.body,
    epoch,
    bucket,
    r,
    viewTag,
    message: {
      address: built.to,
      amount: built.value,
      payload: tonCell.bytesToBase64(serializeBoc(built.body)),
      stateInit: built.init,
      bounce: true,
    },
  };
}

export async function publishIntroLane({ wallet, transport, epoch, bucket, capsule, value, prices = null }, options = {}) {
  if (!wallet) throw new Error('publishIntroLane requires a wallet');
  const live = BigInt(value) + directWriteLiveSurchargeNanotons({ prices, receiverGas: DIRECT_WRITE_GAS_MAX.intro });
  const prepared = await buildIntroPublishWalletMessage({ epoch, bucket, capsule, value: live });
  const { shardDebt, assertAffordable, ...sendOptions } = options;
  const { cushion } = await applyShardSurcharge(LANE_INTRO, [prepared], { resolver: shardDebt });
  const aboveBudget = surchargeExtraNanotons({ prepared: [prepared], budgeted: [value], cushion });
  if (aboveBudget > 0n && typeof assertAffordable === 'function') await assertAffordable(aboveBudget);
  const result = await sendPlathoWalletTransaction(wallet, { messages: [prepared.message] }, { ...sendOptions, transport });
  return { ...prepared, result };
}
