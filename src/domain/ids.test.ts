import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId, uuidV4 } from './ids.ts';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ids', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates RFC 4122 v4 formatted ids', () => {
    expect(createId()).toMatch(UUID_V4_PATTERN);
  });

  it('creates unique ids over 10,000 samples', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => createId()));
    expect(ids.size).toBe(10_000);
  });

  it('builds v4 ids from random bytes when randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff) });
    expect(createId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('uuidV4 applies version and variant bits to the supplied bytes', () => {
    const id = uuidV4((bytes) => bytes.fill(0));
    expect(id).toBe('00000000-0000-4000-8000-000000000000');
  });
});
