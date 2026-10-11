const RANDOM_BYTE_COUNT = 16;
const VERSION_INDEX = 6;
const VARIANT_INDEX = 8;
const VERSION_4 = 0x40;
const VERSION_MASK = 0x0f;
const RFC_VARIANT = 0x80;
const VARIANT_MASK = 0x3f;
const GROUP_LENGTHS = [8, 4, 4, 4, 12];

export type RandomFill = (bytes: Uint8Array) => Uint8Array;

const fillRandom: RandomFill = (bytes) => globalThis.crypto.getRandomValues(bytes);

export const uuidV4 = (fill: RandomFill = fillRandom): string => {
  const bytes = fill(new Uint8Array(RANDOM_BYTE_COUNT));
  bytes[VERSION_INDEX] = (bytes[VERSION_INDEX] & VERSION_MASK) | VERSION_4;
  bytes[VARIANT_INDEX] = (bytes[VARIANT_INDEX] & VARIANT_MASK) | RFC_VARIANT;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const groups: string[] = [];
  let offset = 0;
  for (const length of GROUP_LENGTHS) {
    groups.push(hex.slice(offset, offset + length));
    offset += length;
  }
  return groups.join('-');
};

export const createId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : uuidV4();
