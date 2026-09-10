// m21c-envelope — the ONE place the client knows what a discounted publish looks like on the wire.
//
// WHY IT EXISTS. A publish that takes the M21C fee discount does not arrive at its shard as a bare
// `PublicPublish` / `CapsulePublish`. The user's FeeVault sends it, wrapped:
//
//     message(0x4D323143) VaultPublish { fee_memo: coins; payer: Address; record: ^Cell }
//
// [2026-08-30, the fee-routing decision] The fee field moved AHEAD of the payer and became fee_memo: the fee no
// longer rides to the shard at all (the vault books it in accrued_fee and flushes aggregates to the treasury),
// and the field's one reader is the vault's own bounce handler, which must find it inside the bounce's 224-bit
// budget — the 267-bit payer cannot fit there, so it yields the front seat.
//
// The shard unwraps `record`, stamps `publisher = payer`, and stores exactly the entry a direct publish would
// have stored (contracts18/contracts/{PublicShard,RecordShard}.tact, `receive(VaultPublish)`). So the CHAIN is
// right — but the two client readers walk the shard's message HISTORY, and there they meet the envelope. Both
// hard-matched the direct opcode and returned null on anything else, which made every discounted message
// invisible: on chain, paid for, correctly attributed, and shown to nobody — including its own author.
// MEASURED 2026-08-29 by two independent audits: direct body parses, the same body wrapped does not, on both
// lanes. contracts18/docs/DESIGN-M21C-fee-discount.md calls it a CUTOVER BLOCKER, and it is.
//
// THE LAYOUT IS DEFINED HERE ONCE, and both readers import it, because two copies of a wire layout is how the
// two halves of a protocol drift apart. It takes the caller's own `cellReader` rather than carrying a third
// copy of that dual-mode helper — the two readers already mirror each other's, and a third would be one more
// thing to keep in step.

/** "M21C" — the envelope opcode. Mirrors `message(0x4D323143) VaultPublish` in contracts18/contracts/vault-wire.tact. */
export const M21C_VAULT_PUBLISH_OPCODE = 0x4D323143;

/**
 * Unwrap a VaultPublish envelope. Returns `{ payer, feeMemo, record }`, or NULL for anything
 * that is not one. On the CONV lane every publish is one [OWNER 2026-08-30: the vault is the ONLY door]; on the
 * PUBLIC lane the bare direct publish stays the common case and must stay free.
 *
 * `payer` is the raw `workchain:hex` account the shard stamped as the entry's publisher. Trusting it is safe and
 * that is worth stating, because it looks like trusting a field an attacker controls: shard gate 13720 (PUBLIC) /
 * 13670 (CONV) refuses any VaultPublish whose SENDER is not `vaultAddressOf(payer)`, so a row bearing that
 * payer's tag can only have been written by that payer's own vault. A forged envelope naming someone else is
 * refused in COMPUTE and creates no row for a reader to match against.
 *
 * STILL AVAILABLE, DELIBERATELY NOT DONE YET: also requiring `message.source == vaultAddressOf(payer)`, which
 * makes the reader's check identical to the shard's. It needs the FeeVault code hash and depth in the client
 * (the arithmetic derivation in contracts18/contracts/derive.tact), which arrives with the cutover. Until then
 * the residue is that a refused envelope still sits in the shard's inbound history and can be matched instead of
 * the real message — for identical bytes and identical attribution, since matching is by body commitment.
 */
export function parseVaultPublishEnvelope(bodyCell, cellReader) {
  if (!bodyCell || typeof cellReader !== 'function') return null;
  try {
    const r = cellReader(bodyCell);
    // op(32) | coins(4 + 8n) | addr_std(267) | ^record
    // The leading `refund_to_vault` BIT IS GONE [2026-09-01]. It existed to tell the vault's two doors apart —
    // the internal one funded by the wallet, the external one by a standing float — and the external door was
    // deleted, so a publish is always funded by the wallet that sent it and the change always goes to the payer.
    if (r.remaining() < 32 + 4 + 267) return null;
    if (Number(r.loadUint(32)) !== M21C_VAULT_PUBLISH_OPCODE) return null;
    const coinBytes = Number(r.loadUint(4));
    if (r.remaining() < coinBytes * 8 + 267) return null;
    const feeMemo = coinBytes === 0 ? 0n : r.loadUint(coinBytes * 8);
    // addr_std$10 anycast:(Maybe Anycast) workchain_id:int8 address:bits256 — the only form a Tact Address that
    // reached a contract can take. Anything else is not this message.
    if (Number(r.loadUint(2)) !== 0b10) return null;
    if (Number(r.loadUint(1)) !== 0) return null;              // no anycast
    const workchainRaw = Number(r.loadUint(8));
    const workchain = workchainRaw > 127 ? workchainRaw - 256 : workchainRaw;   // int8
    const account = r.loadUint(256);
    if (r.refs() < 1) return null;
    const record = r.loadRef();
    if (!record) return null;
    return {
      payer: `${workchain}:${account.toString(16).padStart(64, '0')}`,
      feeMemo,
      record,
    };
  } catch {
    return null;
  }
}
