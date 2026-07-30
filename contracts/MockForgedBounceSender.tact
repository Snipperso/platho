// TEST-ONLY probe. Emits an internal message with the `bounced` header bit SET, through the real ACTION phase.
//
// Every `bounced(...)` receiver in this codebase is reached by that one bit. Tact's dispatcher routes on it and does
// not, by itself, establish who sent the message. Most bounced receivers here re-check sender() against the address
// the original message went to; AirdropTicket's two do not, and they ADD CREDITS. Whether that is exploitable turns
// entirely on a question no amount of reading settles: does TON let a contract set `bounced` on a message it sends,
// or does the action phase reject / clear it?
//
// So this mock asks the emulator instead of guessing. It is NOT part of the deployed set.

message(0xB0117E51) ForgeBounce {
    target: Address;
    body: Cell;          // full bounced body, including the 0xFFFFFFFF prefix and the original opcode
    attach: Int as coins;
}

contract MockForgedBounceSender {
    receive(msg: ForgeBounce) {
        // int_msg_info$0 ihr_disabled:Bool bounce:Bool bounced:Bool src:MsgAddress dest:MsgAddressInt
        //   value:CurrencyCollection ihr_fee:Grams fwd_fee:Grams created_lt:uint64 created_at:uint32
        //   init:(Maybe ..) body:(Either X ^X)
        let raw: Cell = beginCell()
            .storeUint(0, 1)                 // int_msg_info$0
            .storeUint(1, 1)                 // ihr_disabled
            .storeUint(0, 1)                 // bounce = false (a real bounce is never itself bounceable)
            .storeUint(1, 1)                 // bounced = TRUE — the whole point of this probe
            .storeUint(0, 2)                 // src = addr_none; the network fills in the true source
            .storeAddress(msg.target)
            .storeCoins(msg.attach)
            .storeUint(0, 1)                 // no extra currencies
            .storeCoins(0)                   // ihr_fee
            .storeCoins(0)                   // fwd_fee
            .storeUint(0, 64)                // created_lt
            .storeUint(0, 32)                // created_at
            .storeUint(0, 1)                 // no state init
            .storeUint(1, 1)                 // body as a ref
            .storeRef(msg.body)
            .endCell();
        sendRawMessage(raw, 0);
    }

    receive() {}
}
