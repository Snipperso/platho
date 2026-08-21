// key-shard-register-send — send a KeyShard registration direct-pay from the user's own wallet.
//
// The clean-17 replacement for submitVaultRegisterMessagingKeys: the browser builder (key-shard-register-browser) makes
// the byte-exact KSG1 message + StateInit, and platho-wallet signs and broadcasts the v5 external that carries it as one
// internal message to the user's KeyShard. Thin, like conv-lane-send / public-lane-send. The wallet is the payer AND the
// authorisation (KeyShard checks sender() == owner_wallet), so nothing else is needed — no auth external, no relay.
//
// IDEMPOTENT RETRY is the caller's job (a re-broadcast of the SAME signed external runs at most once — the v5 seqno is
// consumed), exactly as the CONV/INTRO sends. A rebuild would be safe here too (re-registering the same bundle is a
// self-replace no-op that only bumps key_generation), but re-broadcast avoids even that.

import { buildKeyShardRegisterBrowser } from './key-shard-register-browser.mjs?v=4';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=37';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=35';

/**
 * Register (or replace) the user's messaging keys on their KeyShard. `wallet` is the app's WalletContractV5R1 handle;
 * `transport` is the RPC transport; `ownerWallet`/`profileRegistry` are the raw addresses the KeyShard commits to;
 * `keyRecord` is the RegisterMessagingKeys draft; `value` is the shard's min_register_value (first) / min_replace_value.
 * Returns the built message plus the wallet-send result.
 */
export async function publishKeyShardRegister({ wallet, transport, ownerWallet, profileRegistry, keyRecord, value }, options = {}) {
  if (!wallet) throw new Error('publishKeyShardRegister requires a wallet');
  const built = await buildKeyShardRegisterBrowser({ ownerWallet, profileRegistry, keyRecord, value });
  const message = {
    address: built.to,
    amount: built.value,
    payload: tonCell.bytesToBase64(serializeBoc(built.body)),
    stateInit: built.init,   // storeInternalMessage takes the StateInit cell directly (lazy deploy on first register)
    bounce: true,            // a refused register bounces the funds back
  };
  const result = await sendPlathoWalletTransaction(wallet, { messages: [message] }, { ...options, transport });
  return { ...built, message, result };
}
