
export function stackNum(value, name = 'value') {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`${name}: ${value} is not a safe integer`);
    return BigInt(value);
  }
  if (value === null || value === undefined) throw new Error(`${name} missing`);
  const text = String(value).trim();
  if (text === '') throw new Error(`${name} missing`);
  if (text.startsWith('-')) return -BigInt(text.slice(1));
  return BigInt(text);
}

export function stackNumOr0(value, name = 'value') {
  if (value === null || value === undefined || value === '') return 0n;
  return stackNum(value, name);
}

export function stackBool(value, name = 'flag') {
  return stackNumOr0(value, name) !== 0n;
}
