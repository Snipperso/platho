import {
  PROFILE_APPEARANCE_KIND_LOOK,
  PROFILE_APPEARANCE_KIND_TELEGRAM_GIFT,
  PROFILE_BLOCK_CONTENT_VERSION,
  PROFILE_DESCRIPTION_MAX_BYTES,
  PROFILE_GROUPS_MAX,
  decodeProfileLook,
  normalizeProfileAppearance,
  normalizeProfileTags,
  normalizeProfileWornGift,
  truncateUtf8ToBytes,
} from '../../web/capsule-part-policy.mjs';

export function decodeProfileBlockContentOf1424(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  if (bytes.length < 4 || bytes[0] !== PROFILE_BLOCK_CONTENT_VERSION) return null;
  const descLength = (bytes[1] << 8) | bytes[2];
  if (3 + descLength + 1 > bytes.length) return null;
  const decoder = new TextDecoder();
  const description = truncateUtf8ToBytes(decoder.decode(bytes.subarray(3, 3 + descLength)), PROFILE_DESCRIPTION_MAX_BYTES);
  let offset = 3 + descLength;
  const tagCount = bytes[offset];
  offset += 1;
  const rawTags = [];
  for (let index = 0; index < tagCount; index += 1) {
    if (offset + 1 > bytes.length) return null;
    const tagLength = bytes[offset];
    offset += 1;
    if (offset + tagLength > bytes.length) return null;
    rawTags.push(decoder.decode(bytes.subarray(offset, offset + tagLength)));
    offset += tagLength;
  }
  const tags = normalizeProfileTags(rawTags);
  let ownerUsername = '';
  if (offset < bytes.length) {
    const usernameLength = bytes[offset];
    offset += 1;
    if (usernameLength > 0 && offset + usernameLength <= bytes.length) {
      ownerUsername = decoder.decode(bytes.subarray(offset, offset + usernameLength));
      offset += usernameLength;
    }
  }
  let appearance = null;
  if (offset < bytes.length) {
    const appearanceLength = bytes[offset];
    offset += 1;
    if (appearanceLength > 1 && offset + appearanceLength <= bytes.length) {
      if (bytes[offset] === PROFILE_APPEARANCE_KIND_TELEGRAM_GIFT) {
        appearance = normalizeProfileAppearance({
          kind: 'telegram-gift',
          itemAddress: decoder.decode(bytes.subarray(offset + 1, offset + appearanceLength)),
        });
      } else if (bytes[offset] === PROFILE_APPEARANCE_KIND_LOOK) {
        appearance = decodeProfileLook(bytes.subarray(offset + 1, offset + appearanceLength));
      }
      offset += appearanceLength;
    }
  }
  let wornGift = null;
  if (offset < bytes.length) {
    const wornGiftLength = bytes[offset];
    offset += 1;
    if (wornGiftLength > 0 && offset + wornGiftLength <= bytes.length) {
      wornGift = normalizeProfileWornGift(decoder.decode(bytes.subarray(offset, offset + wornGiftLength)));
      offset += wornGiftLength;
    }
  }
  const groups = [];
  if (offset < bytes.length) {
    const count = bytes[offset];
    offset += 1;
    for (let index = 0; index < count && index < PROFILE_GROUPS_MAX; index += 1) {
      if (offset + 33 > bytes.length) break;
      let groupId = '';
      for (let byte = 0; byte < 32; byte += 1) groupId += bytes[offset + byte].toString(16).padStart(2, '0');
      offset += 32;
      const nameLength = bytes[offset];
      offset += 1;
      if (offset + nameLength > bytes.length) break;
      groups.push({ groupId, name: decoder.decode(bytes.subarray(offset, offset + nameLength)) });
      offset += nameLength;
    }
  }
  if (offset < bytes.length && bytes[offset] === groups.length && offset + 1 + groups.length * 64 <= bytes.length) {
    offset += 1;
    for (const group of groups) {
      const pair = [];
      for (let k = 0; k < 2; k += 1) {
        let hex = '';
        let zero = true;
        for (let byte = 0; byte < 32; byte += 1) {
          const value = bytes[offset + byte];
          if (value !== 0) zero = false;
          hex += value.toString(16).padStart(2, '0');
        }
        offset += 32;
        pair.push(zero ? null : hex);
      }
      if (pair[0]) group.founder = pair[0];
      if (pair[1]) group.owner = pair[1];
    }
  }
  return { description, tags, ownerUsername, appearance, wornGift, groups };
}
