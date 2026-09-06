import { describe, expect, it } from 'vitest';
import { buildDocPath, buildCollectionPath, assertSafeId, MAX_DOC_ID_LENGTH } from '../paths';
import { DataError } from '../errors';

describe('assertSafeId', () => {
  it('accepts safe ids', () => {
    expect(() => assertSafeId('abc-123')).not.toThrow();
    expect(() => assertSafeId('a'.repeat(128))).not.toThrow();
  });
  it('rejects empty and over-length ids', () => {
    expect(() => assertSafeId('')).toThrow(DataError);
    expect(() => assertSafeId('a'.repeat(MAX_DOC_ID_LENGTH + 1))).toThrow(DataError);
  });
  it('rejects path separators (malicious doc ids)', () => {
    expect(() => assertSafeId('a/b')).toThrow(DataError);
    expect(() => assertSafeId('..')).toThrow(DataError);
    expect(() => assertSafeId('.')).toThrow(DataError);
  });
  it('rejects prototype-pollution segments', () => {
    expect(() => assertSafeId('__proto__')).toThrow(DataError);
    expect(() => assertSafeId('constructor')).toThrow(DataError);
  });
});

describe('ownership path builders', () => {
  it('builds a scoped collection path', () => {
    expect(buildCollectionPath('uid-1', 'journalEntries')).toBe('users/uid-1/journalEntries');
  });
  it('builds a scoped doc path', () => {
    expect(buildDocPath('uid-1', 'memories', 'mem-1')).toBe('users/uid-1/memories/mem-1');
  });
  it('forbids id traversal in builders', () => {
    expect(() => buildDocPath('uid-1', 'journalEntries', 'a/b')).toThrow(DataError);
  });
});
