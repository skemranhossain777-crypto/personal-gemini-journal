import { describe, expect, it } from 'vitest';
import { getRoute, isProtectedRoute } from '../routes';

describe('getRoute', () => {
  it('maps the public home route', () => {
    expect(getRoute({ pathname: '/', hash: '' })).toBe('home');
  });

  it('maps the protected workspace route', () => {
    expect(getRoute({ pathname: '/', hash: '#/app' })).toBe('app');
  });

  it('maps the public design gallery route', () => {
    expect(getRoute({ pathname: '/', hash: '#/design' })).toBe('design');
  });

  it('treats unknown hashes as unknown', () => {
    expect(getRoute({ pathname: '/', hash: '#/settings' })).toBe('unknown');
  });
});

describe('isProtectedRoute', () => {
  it('marks only the workspace as protected', () => {
    expect(isProtectedRoute('app')).toBe(true);
    expect(isProtectedRoute('home')).toBe(false);
    expect(isProtectedRoute('design')).toBe(false);
  });
});
