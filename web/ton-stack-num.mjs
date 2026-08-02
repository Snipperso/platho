/**
 * ONE PLACE THAT KNOWS HOW A TVM INTEGER ARRIVES ON THE WIRE.
 *
 * toncenter renders get-method stack integers as HEX STRINGS, and negative ones carry the sign OUTSIDE the radix
 * prefix: `-0x1`. `BigInt('-0x1')` throws — JavaScript accepts `0x1` and `-1` but not `-0x1`. That matters far more
 * than it looks, because a Tact `Bool` is a TVM integer of exactly -1 when true. So EVERY true boolean read through a
 * getter arrives in the one shape the obvious parser cannot handle.
 *
 * MEASURED 2026-08-02 against the live clean-17 IntroShard, on the owner's first message after genesis:
 *
 *     get_entry -> stack[0] = {"type":"num","value":"-0x1"}      BigInt(value) => TypeError
 *
 * The INTRO was on chain and correct — shard active, entry 0 stored, created_at stamped. The client threw while
 * READING it back, six retries in a row, and failed closed with "resend to establish the conversation". Resending
 * could never help: the parser fails on success, so the healthier the chain the more reliably it broke.
 *
 * Why it survived a green suite: the sandbox tests read through the Tact wrapper, which hands back real booleans, so
 * nothing in 1539 tests ever saw the wire shape. Seven RPC provider modules had already met this and each grew its own
 * private three-line fix; the three newest lanes (INTRO, CONV, RECOVERY) were written without them. That is the whole
 * argument for this file existing: the idiom was known and still absent where it was needed.
 */

/**
 * Parse one toncenter stack integer. Accepts the wire forms (`0x…`, `-0x…`, decimal strings) plus already-native
 * numbers and bigints, so callers can pass a value through without knowing which transport produced it.
 *
 * @param {string|number|bigint|null|undefined} value  raw `stack[i].value`
 * @param {string} [name]  field name, used only to make the throw legible
 * @returns {bigint}
 */
export function stackNum(value, name = 'value') {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`${name}: ${value} is not a safe integer`);
    return BigInt(value);
  }
  if (value === null || value === undefined) throw new Error(`${name} missing`);
  const text = String(value).trim();
  if (text === '') throw new Error(`${name} missing`);
  // The sign sits outside the radix prefix, so it has to be split off before BigInt sees the string.
  if (text.startsWith('-')) return -BigInt(text.slice(1));
  return BigInt(text);
}

/** Same, but defaulting an absent value to 0n — for optional trailing fields a getter may not carry. */
export function stackNumOr0(value, name = 'value') {
  if (value === null || value === undefined || value === '') return 0n;
  return stackNum(value, name);
}

/**
 * A Tact `Bool` off the wire. TRUE is -1, not 1, so a `=== 1n` test would read every true boolean as false — compare
 * against zero and nothing else.
 */
export function stackBool(value, name = 'flag') {
  return stackNumOr0(value, name) !== 0n;
}
