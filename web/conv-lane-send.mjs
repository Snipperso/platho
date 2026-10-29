
import { buildConvPublishBrowser } from './conv-publish-browser.mjs?v=48';
import { parseBocBase64, serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=93';
import { applyShardSurcharge, surchargeExtraNanotons, LANE_CONV } from './shard-debt.mjs?v=82';
import { buildVaultDeployMessage, buildVaultInternalPublishMessage, vaultInternalPublishValue, FV_DEPLOY_FUNDING, FV_PROTOCOL_FEE } from './fee-vault.mjs?v=39';
import { feeVaultCodeBoc, recordShardCodeCellFor, recordShardDataCellFor } from './shard-address.mjs?v=47';
import { CUTOVER_EPOCH, generationForEpoch } from './cutover-epoch.mjs?v=7';

function convCapsuleCells(capsule) {
  const cells = capsule?.chainCells;
  if (!cells?.header0?.boc || !cells?.header1?.boc || !cells?.body?.boc) {
    throw new Error('CONV capsule is missing its on-chain payload cells (chainCells.header0/header1/body)');
  }
  return {
    header0: parseBocBase64(cells.header0.boc),
    header1: parseBocBase64(cells.header1.boc),
    body: parseBocBase64(cells.body.boc),
  };
}

export async function buildConvPublishWalletMessage({ writePublicKey, writeSecret, sign, seq, epoch, capsule, value, boundary }) {
  const cells = convCapsuleCells(capsule);
  const built = await buildConvPublishBrowser({
    writePublicKey, seq, epoch, value,
    ...(writeSecret === undefined ? {} : { writeSecret }),
    ...(sign === undefined ? {} : { sign }),
    ...(boundary === undefined ? {} : { boundary }),
    header0: cells.header0, header1: cells.header1, body: cells.body,
  });
  return {
    to: built.to,
    value: built.value,
    generation: built.generation,
    commit: built.commit,
    init: built.init,
    body: built.body,
    message: {
      address: built.to,
      amount: built.value,
      payload: tonCell.bytesToBase64(serializeBoc(built.body)),
      stateInit: built.init,
      bounce: true,
    },
  };
}

export async function buildConvPublishViaVaultMessage({
  writePublicKey, writeSecret, sign, seq, epoch, capsule, vaultAddress, capsuleBytes, feeDue,
  boundary = CUTOVER_EPOCH, attachStateInit = true, value, prices = null,
}) {
  if (!vaultAddress) throw new Error('buildConvPublishViaVaultMessage requires the payer own vault address');
  if (capsuleBytes === undefined || capsuleBytes === null) {
    throw new Error('buildConvPublishViaVaultMessage: capsuleBytes is required — the second hop is charged per byte');
  }
  if (feeDue === undefined || feeDue === null) {
    throw new Error('buildConvPublishViaVaultMessage: feeDue is required — pass the vault own get_vault().fee_due');
  }
  const direct = await buildConvPublishWalletMessage({
    writePublicKey, seq, epoch, capsule, value, boundary,
    ...(writeSecret === undefined ? {} : { writeSecret }),
    ...(sign === undefined ? {} : { sign }),
  });
  const generation = direct.generation;
  if (generation < 18) {
    throw new RangeError(`buildConvPublishViaVaultMessage: epoch ${epoch} belongs to generation ${generation}, `
      + 'whose RecordShard has no vault door — send the clean-17 direct message for this epoch');
  }
  const pub = typeof writePublicKey === 'bigint'
    ? writePublicKey
    : [...writePublicKey].reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
  const halves = attachStateInit
    ? { shardCode: recordShardCodeCellFor(generation), shardData: recordShardDataCellFor(generation, pub, epoch) }
    : { shardCode: null, shardData: null };
  const shardAddress = direct.to;
  const message = buildVaultInternalPublishMessage(vaultAddress, {
    shard: shardAddress,
    record: direct.body,
    ...halves,
    value: vaultInternalPublishValue({
      directValue: direct.value, capsuleBytes, feeDue,
      stateInit: halves.shardCode ? { code: halves.shardCode, data: halves.shardData } : null,
      prices,
    }),
  });
  return { to: message.address, value: message.amount, commit: direct.commit, shard: shardAddress, message };
}

export async function prepareConvLaneParts({ ownerWallet = null, vaultAddress = null, feeDue = null, deployVault = false, vaultCodeBoc = null, prices = null } = {}, parts) {
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('prepareConvLaneParts requires at least one part');
  const prepared = [];
  let route = null;
  for (const [index, part] of parts.entries()) {
    const direct = await buildConvPublishWalletMessage(part);
    const door = direct.generation < 18 ? 'direct' : 'vault';
    if (route !== null && route !== door) {
      throw new RangeError(`prepareConvLaneParts: parts straddle the generation flip (${route} then ${door}) — one transfer, one door`);
    }
    route = door;
    if (door === 'direct') {
      prepared.push({ ...direct, route: 'direct' });
      continue;
    }
    if (!vaultAddress) {
      const error = new Error(`prepareConvLaneParts: epoch ${part.epoch} belongs to generation ${direct.generation}, `
        + 'whose RecordShard has no direct door — the payer own vault address is required');
      error.code = 'CONV_VAULT_DOOR_REQUIRED';
      throw error;
    }
    const viaVault = await buildConvPublishViaVaultMessage({
      ...part,
      vaultAddress,
      capsuleBytes: serializeBoc(direct.body).length,
      feeDue: feeDue ?? FV_PROTOCOL_FEE,
      attachStateInit: index === 0 && !part.shardLive,
      prices,
    });
    prepared.push({ ...viaVault, generation: direct.generation, route: 'vault' });
  }
  let deploy = null;
  if (route === 'vault' && deployVault) {
    if (!ownerWallet) throw new Error('prepareConvLaneParts: deploying the vault needs the owner wallet address');
    deploy = buildVaultDeployMessage(vaultCodeBoc ?? feeVaultCodeBoc(), ownerWallet, vaultAddress);
  }
  return { prepared, deploy, route };
}

export function quoteConvVaultMessageNanotons({ capsuleBytes, directValue, feeDue = FV_PROTOCOL_FEE, epoch, shardLive = false, deployVault = false, prices = null }) {
  if (!Array.isArray(capsuleBytes) || capsuleBytes.length === 0) throw new Error('quoteConvVaultMessageNanotons needs the record size of every part');
  if (generationForEpoch(Number(epoch)) < 18) {
    throw new RangeError(`quoteConvVaultMessageNanotons: epoch ${epoch} belongs to generation ${generationForEpoch(Number(epoch))}, whose private message takes the direct door`);
  }
  let total = 0n;
  for (const [index, bytes] of capsuleBytes.entries()) {
    const halves = index === 0 && !shardLive;
    total += vaultInternalPublishValue({
      directValue, capsuleBytes: bytes, feeDue,
      stateInit: halves ? { code: recordShardCodeCellFor(18), data: recordShardDataCellFor(18, 0n, epoch) } : null,
      prices,
    });
  }
  return total + (deployVault ? FV_DEPLOY_FUNDING : 0n);
}

export async function publishConvLaneParts({ wallet, transport, vaultAddress = null, feeDue = null, deployVault = false, prices = null }, parts, options = {}) {
  if (!wallet) throw new Error('publishConvLaneParts requires a wallet');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('publishConvLaneParts requires at least one part');
  const { prepared, deploy } = await prepareConvLaneParts({ ownerWallet: wallet.address, vaultAddress, feeDue, deployVault, prices }, parts);
  const { shardDebt, assertAffordable, assertSent, onSigned, ...sendOptions } = options;
  const { cushion } = await applyShardSurcharge(LANE_CONV, prepared, { resolver: shardDebt });
  if (typeof assertSent === 'function') {
    await assertSent(prepared.reduce((sum, item) => sum + BigInt(item?.message?.amount ?? 0), 0n) + BigInt(deploy?.amount ?? 0));
  } else {
    const aboveBudget = surchargeExtraNanotons({ prepared, budgeted: parts.map((part) => part.value), cushion, deploy });
    if (aboveBudget > 0n && typeof assertAffordable === 'function') await assertAffordable(aboveBudget);
  }
  const messages = [...(deploy ? [deploy] : []), ...prepared.map((p) => p.message)];
  let result;
  try {
    result = await sendPlathoWalletTransaction(wallet, { messages }, {
      ...sendOptions, transport,
      ...(typeof onSigned === 'function' ? { onSigned: (signed) => onSigned({ ...signed, preparedParts: prepared, deploy }) } : {}),
    });
  } catch (error) {
    if (error && !error.preparedParts) error.preparedParts = prepared;
    throw error;
  }
  return { parts: prepared, deploy, result };
}

export async function publishConvLane({ wallet, transport, vaultAddress = null, feeDue = null, deployVault = false, prices = null, ...part }, options = {}) {
  const { parts, deploy, result } = await publishConvLaneParts({ wallet, transport, vaultAddress, feeDue, deployVault, prices }, [part], options);
  return { ...parts[0], deploy, result };
}
