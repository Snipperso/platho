// conv-lane-send — the SEND half of the clean-17 PRIVATE CONV lane, wired to the user's wallet.
//
// The read half (conv-lane / conv-discovery) turns RecordShards back into conversation messages. This turns an
// already-sealed CONV capsule into a signed, direct-pay wallet transaction to the RecordShard that stores it. It is
// deliberately thin: createEncryptedConvCapsule already sealed the bytes, buildConvPublishBrowser already builds and
// pins the message (opcode, StateInit, frameCommit, ed25519 write signature) against the contract, and
// platho-wallet.sendPlathoWalletTransaction already signs and broadcasts the v5 external — this module only marries
// the three and shapes the wallet message. Exact mirror of public-lane-send.mjs.
//
// 🔴 CUTOVER: contracts18/docs/CUTOVER.md item 11 — in clean-18 the vault RETURNS, as the only CONV door
// [OWNER 2026-08-30]: the fee books there and flushes in aggregate, which is what kills the 64-query metadata
// tap. This module keeps speaking clean-17's direct door until the flip.
// DIRECT-PAY, no Vault, no CapsuleHub. clean-15 sent an EXTERNAL message to the user's Vault, which relayed it; clean-17
// sends an INTERNAL message from the user's own wallet straight to the RecordShard, StateInit attached so the shard
// deploys lazily on the first publish of the epoch. The write key (not the sender wallet) is the shard's identity —
// the wallet is only the payer.
//
// WHAT STAYS PRIVATE, PRECISELY (do NOT overstate — RecordShard.tact says it plainly: "ADDRESS PRIVACY IS NOT
// AUTHORIZATION", and a chain observer reads the spend tx's src). The payer wallet is NOT hidden from its OWN outgoing
// conversation-direction: the publish tx src is the wallet, and RecordShard forwards a DepositCapsuleFee to the global
// fee sink carrying publisher=sender() alongside init_arg0=write_pubkey in cleartext — so wallet↔own-direction (write
// key + epoch) is public and network-harvestable. What the design DOES protect is the who-talks-to-whom GRAPH: the two
// directions of a conversation (P_ab, P_ba) are independent HKDF(K_epoch) outputs, unlinkable without the shared K_root,
// so an observer sees a wallet publishing into some direction but never its counterparty. Graph unlinkability is the
// property the lane relies on; payer-direction unlinkability is NOT claimed. [conv-privacy-core]
//
// TWO THINGS ARE LOAD-BEARING, both silent if wrong (identical to public/intro):
//   * StateInit MUST be attached (a RecordShard is new every epoch and deployed lazily).
//   * The three snake cells must serialise byte-for-byte as RecordShard expects — it recomputes frameCommit from the
//     cells it receives, and a near-miss stores a commitment the recipient's delivery check rejects (money spent,
//     nothing arrives). The capsule already produced those cells; we only carry them, never re-encode them.
//
// FUNDING: always CONV_PUBLISH_VALUE (the deploy figure). The shard keeps only what it needs and returns the surplus
// mode-128, so overpaying an already-deployed shard costs nothing — and "pay more only when absent" is forgeable on a
// public bucket space. tests/conv-lane-send.test.ts pins the message against a REAL sealed capsule and a live RecordShard.

import { buildConvPublishBrowser } from './conv-publish-browser.mjs?v=30';
import { parseBocBase64, serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=47';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=57';
import { applyShardSurcharge, surchargeExtraNanotons, LANE_CONV } from './shard-debt.mjs?v=12';
import { buildVaultDeployMessage, buildVaultInternalPublishMessage, vaultInternalPublishValue, FV_PROTOCOL_FEE } from './fee-vault.mjs?v=8';
import { feeVaultCodeBoc, recordShardCodeCellFor, recordShardDataCellFor } from './shard-address.mjs?v=29';
import { CUTOVER_EPOCH } from './cutover-epoch.mjs?v=4';

/**
 * The capsule's three on-chain snake cells, as CLIENT cells buildConvPublishBrowser consumes. createEncryptedConvCapsule
 * hands back chainCells as snake PAYLOAD objects (carrying the serialised .boc), not raw cells, so each is parsed back
 * to a cell here. The parse round-trips the exact cell tree (same hash), so the frameCommit the shard recomputes matches.
 */
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

/**
 * Shape a CONV publish as the wallet-message form sendPlathoWalletTransaction consumes:
 *   { address, amount, payload (base64 BoC of the body), stateInit (cell), bounce }.
 * `writePublicKey`/`writeSecret` are the conversation-direction write keypair (conv-routing, derived from the
 * conversation K_root via outgoingRecordShard); `seq` must strictly exceed the shard's last_seq; `epoch` is the CONV
 * epoch; `capsule` is a createEncryptedConvCapsule result; `value` is CONV_PUBLISH_VALUE. Returns the built message plus
 * the address/value/commit the caller may want for tracking.
 */
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
      stateInit: built.init,   // storeInternalMessage takes the StateInit cell directly
      bounce: true,            // a rejected publish bounces the funds back, exactly like the reference path
    },
  };
}

/**
 * Publish SEVERAL CONV capsule parts in ONE wallet transfer — the multipart case: a message split across N capsules is
 * N separate records in the SAME conversation-direction RecordShard (grouped on read by the shared stream), so one
 * signed transfer carries all N. `parts` is an array of buildConvPublishWalletMessage args ({ writePublicKey,
 * writeSecret, seq, epoch, capsule, value }); every part shares the same write key / epoch (so the same shard), with
 * strictly increasing seq — the first publish deploys the shard (StateInit), the rest just publish. Returns the
 * prepared parts (for commit tracking) and the single wallet-send result.
 *
 * `wallet` is the app's WalletContractV5R1 handle; `transport` is the RPC transport (sendBoc + runGetMethod for seqno).
 */
/**
 * THE SAME CAPSULE, THROUGH THE PAYER'S OWN FEE VAULT. clean-18's RecordShard has no direct publish door at all —
 * its only one is `VaultPublish`, and gate 13670 refuses anything whose sender is not `vaultAddressOf(payer)`. A
 * clean-17-shaped CapsulePublish sent there is refused at exit 130 with the value bounced back, MEASURED against
 * the compiled contract; so past the flip this is not the cheaper route for CONV, it is the only one.
 *
 * The RECORD IS THE SAME CELL the direct door carries — byte for byte, the one `buildConvPublishBrowser` already
 * pins against the compiled `storeCapsulePublish`. Nothing about the capsule changes; the envelope and the
 * addressee do. `shard_code`/`shard_data` are the StateInit halves, because the vault door takes them as two
 * independent Maybe refs rather than as one StateInit: there the shard is deployed by the VAULT's outgoing
 * message, not by the wallet's. Pass them as null once the shard is known to be live — they are the largest part
 * of the body and their carriage is charged per byte.
 */
export async function buildConvPublishViaVaultMessage({
  writePublicKey, writeSecret, sign, seq, epoch, capsule, vaultAddress, capsuleBytes, feeDue,
  boundary = CUTOVER_EPOCH, attachStateInit = true, value,
}) {
  if (!vaultAddress) throw new Error('buildConvPublishViaVaultMessage requires the payer own vault address');
  // NEITHER OF THESE GETS A DEFAULT, and the reason is written at vaultActionValue: both once had one, and both
  // defaults under-attached silently. `feeDue` is the caller's `get_vault().fee_due` — it depends on the payer's
  // stake, so no value computed here could be right for more than one user; `capsuleBytes` prices the extra
  // carriage of the second hop. Guessing either produces a message the vault ACCEPTS and books a take for, which
  // the shard then refuses with nothing stored.
  if (capsuleBytes === undefined || capsuleBytes === null) {
    throw new Error('buildConvPublishViaVaultMessage: capsuleBytes is required — the second hop is charged per byte');
  }
  if (feeDue === undefined || feeDue === null) {
    throw new Error('buildConvPublishViaVaultMessage: feeDue is required — pass the vault own get_vault().fee_due');
  }
  // NO `generation` PARAMETER, and the first draft had one — which was a fourth place the generation could
  // disagree with itself. THE EPOCH OWNS THE GENERATION here as everywhere: the digest derives it that way, the
  // shard address derives it that way, and so must the StateInit halves. Passing it separately produced an
  // envelope that named one generation's shard while carrying the other's code, and the vault forwarded it into
  // the void with exit 0 — caught by CONVVAULT-01. Nor is it derived AGAIN here: the direct builder already
  // resolved it for the address it returned, so the halves take that answer rather than recomputing one that
  // could differ.
  const direct = await buildConvPublishWalletMessage({
    writePublicKey, seq, epoch, capsule, value, boundary,
    ...(writeSecret === undefined ? {} : { writeSecret }),
    ...(sign === undefined ? {} : { sign }),   // a group member's lane key is blinded: a signer, not a seed
  });
  const generation = direct.generation;
  // AND THE VAULT DOOR EXISTS ONLY IN GENERATION 18 [audit 2026-09-02]. clean-17's RecordShard has
  // `CapsulePublish` and `RetireShard` and nothing else, so an envelope built here for an epoch that still
  // belongs to 17 would be forwarded into a receiver that does not exist — vault 0, shard 130, message gone.
  // PUBLIC can fall back to its direct door; this lane cannot, because past the flip the vault is the only
  // door there is. So this refuses loudly rather than choosing for the caller: at generation 17 the CALLER
  // must still be sending the clean-17 direct message, and reaching here means the flip wiring ran early.
  if (generation < 18) {
    throw new RangeError(`buildConvPublishViaVaultMessage: epoch ${epoch} belongs to generation ${generation}, `
      + 'whose RecordShard has no vault door — send the clean-17 direct message for this epoch');
  }
  // The write key arrives as BYTES on this path (conv-publish-browser takes it that way), and the shard's init
  // argument is the same 32 bytes read big-endian. Converted here rather than demanded of the caller, so both
  // doors take the identical input and cannot disagree about which shard they mean.
  const pub = typeof writePublicKey === 'bigint'
    ? writePublicKey
    : [...writePublicKey].reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
  const halves = attachStateInit
    ? { shardCode: recordShardCodeCellFor(generation), shardData: recordShardDataCellFor(generation, pub, epoch) }
    : { shardCode: null, shardData: null };
  // THE ADDRESS FOLLOWS THE GENERATION TOO, and this is where the first draft was wrong: it took `direct.to`,
  // which buildConvPublishBrowser derives at generation 17, while the StateInit halves below were built from the
  // generation asked for. The envelope then named one shard and carried another shard's code. CAUGHT BY
  // CONVVAULT-01: the vault accepted the envelope with exit 0 and forwarded to an address the test was not
  // watching — a green vault and a message that reached no shard, which is the silent shape this lane fears most.
  const shardAddress = direct.to;   // already the generation's own address — the epoch chose it
  const message = buildVaultInternalPublishMessage(vaultAddress, {
    shard: shardAddress,
    record: direct.body,
    ...halves,
    // The vault forwards the shard's own demand and keeps its take; vaultActionValue is what prices the two
    // together, from the SAME direct figure this path would otherwise have attached.
    // `vaultInternalPublishValue`, NOT `vaultActionValue` — the twin of the PUBLIC fix [audit 2026-09-02].
    // The door's own gates 28021/28022 demand the vault's self reserve and the forward headroom on top of
    // what the shard needs, and the vault forwards `value - take - FV_PUBLISH_SELF_RESERVE`. Short by
    // 2,000,000, every conversation-creating first message would be refused at the shard and lost. This
    // lane has no direct door past the flip, so here it is not a lost post but a lost conversation.
    // AND THE HALVES ARE PRICED WHEN THEY RIDE [2026-09-05]: the vault -> shard hop is charged on the shard's
    // code cell by cell, which no byte slope sees — the twin of the PUBLIC fix PDR-01 measured (a deploying
    // publish forwarded 293,468 short and refused 13704). CONVVAULT-01 now lands this envelope at exactly the
    // figure built here, with no headroom of its own.
    value: vaultInternalPublishValue({
      directValue: direct.value, capsuleBytes, feeDue,
      stateInit: halves.shardCode ? { code: halves.shardCode, data: halves.shardData } : null,
    }),
  });
  return { to: message.address, value: message.amount, commit: direct.commit, shard: shardAddress, message };
}

/**
 * ROUTE EVERY PART BY ITS GENERATION AND BUILD WHAT THE WALLET WILL SIGN — pure, so a gate can replay the messages
 * against the real contracts without a wallet in the loop. [CUTOVER item 11, WRITTEN 2026-09-03]
 *
 * Generation 17 (today): the direct door — the same `buildConvPublishWalletMessage` bytes as ever. Generation 18
 * (past the flip): RecordShard has ONE door, the payer's own FeeVault, so every part becomes a
 * `buildConvPublishViaVaultMessage` envelope. There is no fallback to choose and none is offered: a generation-18
 * part with no `vaultAddress` is refused HERE, loudly, rather than sent to a receiver that does not exist.
 *   * `feeDue` is the payer's `get_vault().fee_due` when the caller holds a FRESH read; otherwise the FULL protocol
 *     fee. That is the safe direction — the vault takes what the stake on chain says and the shard returns the
 *     rest as change — whereas a stale discount under-attaches, and the vault then ACCEPTS and books its take
 *     while the shard refuses with nothing stored.
 *   * `deployVault`: a payer who has no vault gets one DEPLOYED by the same transfer — `buildVaultDeployMessage`,
 *     funded at FV_DEPLOY_FUNDING, as the FIRST message, so it exists by the time the envelope arrives (one source,
 *     one destination: the chain delivers them in order). A deploy aimed at a vault that already exists is a
 *     top-up of the payer's own float, withdrawable, never lost.
 *   * The shard's StateInit halves ride only the FIRST part, and only when the caller does not know the shard to be
 *     live (`part.shardLive`): they are the largest part of the body and the vault door charges their carriage on
 *     two hops. A later part of the same transfer follows a first that deployed the shard.
 *
 * Returns `{ prepared, deploy, route }`: `prepared` in part order (each carrying `message`, `commit`, `shard`,
 * `route`), `deploy` the vault deploy message or null, `route` 'direct' | 'vault'.
 */
export async function prepareConvLaneParts({ ownerWallet = null, vaultAddress = null, feeDue = null, deployVault = false, vaultCodeBoc = null } = {}, parts) {
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

export async function publishConvLaneParts({ wallet, transport, vaultAddress = null, feeDue = null, deployVault = false }, parts, options = {}) {
  if (!wallet) throw new Error('publishConvLaneParts requires a wallet');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('publishConvLaneParts requires at least one part');
  const { prepared, deploy } = await prepareConvLaneParts({ ownerWallet: wallet.address, vaultAddress, feeDue, deployVault }, parts);
  // THE SQUAT SURCHARGE, PER SHARD [2026-09-03]: every message carries a refundable cushion (a year of an empty shard's
  // rent) and, for an account seen pre-created and starved, the debt its age says it owes — the value gate of every
  // clean-18 shard demands `myStorageDue()` on top of the price (13712/13660/13688) and refuses a publish that cannot
  // cover it, so this is what turns a stranger's squat from a lost post into a few thousandths of a GRAM. The amount is
  // resolved by web/shard-debt.mjs (two reads at most, cached per address; none when the account does not exist). On a
  // routed message the surcharge follows `shard`, the account the vault forwards to.
  const { shardDebt, assertAffordable, ...sendOptions } = options;
  const { cushion } = await applyShardSurcharge(LANE_CONV, prepared, { resolver: shardDebt });
  // EVERYTHING ABOVE THE CALLER'S BUDGET IS ASSERTED BEFORE SIGNING: the caller holds `part.value + cushion` per part;
  // past the flip the vault door's overhead and, on a first send, the vault's deploy sit on top of that.
  const aboveBudget = surchargeExtraNanotons({ prepared, budgeted: parts.map((part) => part.value), cushion, deploy });
  if (aboveBudget > 0n && typeof assertAffordable === 'function') await assertAffordable(aboveBudget);
  const messages = [...(deploy ? [deploy] : []), ...prepared.map((p) => p.message)];
  let result;
  try {
    result = await sendPlathoWalletTransaction(wallet, { messages }, { ...sendOptions, transport });
  } catch (error) {
    // Attach the prepared parts (each carries its frame_commit) so the caller can arm the delivery confirm on the SAME
    // commits even when the broadcast throws ambiguously — symmetric with platho-wallet attaching error.builtBoc. Without
    // this, an ambiguous send that actually landed could never be verified. [conv delivery confirm]
    if (error && !error.preparedParts) error.preparedParts = prepared;
    throw error;
  }
  return { parts: prepared, deploy, result };
}

/** The single-capsule case (one wallet transfer, one record). Thin over publishConvLaneParts; routing passes through. */
export async function publishConvLane({ wallet, transport, vaultAddress = null, feeDue = null, deployVault = false, ...part }, options = {}) {
  const { parts, deploy, result } = await publishConvLaneParts({ wallet, transport, vaultAddress, feeDue, deployVault }, [part], options);
  return { ...parts[0], deploy, result };
}
