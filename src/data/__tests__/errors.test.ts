import { describe, expect, it } from 'vitest';
import { DataError, toDataError, isDataError } from '../errors';

describe('toDataError', () => {
  it('passes through an existing DataError', () => {
    const d = new DataError({ code: 'invalid-data', operation: 'create' });
    expect(toDataError(d, 'create')).toBe(d);
  });
  it('maps Firestore permission-denied', () => {
    const e = toDataError({ code: 'permission-denied' }, 'read', 'users/u/x');
    expect(e.code).toBe('permission-denied');
    expect(e.path).toBe('users/u/x');
    expect(e.message).toMatch(/denied/i);
  });
  it('maps network errors', () => {
    expect(toDataError({ code: 'unavailable' }, 'list').code).toBe('network');
    expect(toDataError({ code: 'deadline-exceeded' }, 'list').code).toBe('network');
  });
  it('maps not-found', () => {
    expect(toDataError({ code: 'not-found' }, 'read').code).toBe('not-found');
  });
  it('falls back to unknown and never leaks raw codes', () => {
    const e = toDataError({ code: 'internal-funky' }, 'create');
    expect(e.code).toBe('unknown');
    expect(e.message).not.toContain('internal-funky');
  });
  it('isDataError narrows', () => {
    expect(isDataError(new DataError({ code: 'conflict', operation: 'update' }))).toBe(true);
    expect(isDataError(new Error('x'))).toBe(false);
  });
});