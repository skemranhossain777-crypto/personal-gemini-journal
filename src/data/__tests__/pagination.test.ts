import { describe, expect, it } from 'vitest';
import { buildPage, normalizePageOptions, MAX_PAGE_SIZE } from '../pagination';

describe('normalizePageOptions', () => {
  it('clamps limit into the allowed range', () => {
    expect(normalizePageOptions({}).limit).toBe(25);
    expect(normalizePageOptions({ limit: 0 }).limit).toBe(1);
    expect(normalizePageOptions({ limit: 9999 }).limit).toBe(MAX_PAGE_SIZE);
    expect(normalizePageOptions({ limit: 10 }).limit).toBe(10);
  });
});

describe('buildPage', () => {
  function snap(n: number) {
    return {
      docs: Array.from({ length: n }, (_, i) => ({ id: `doc-${i}`, data: () => ({ id: `doc-${i}` }) })),
    } as never;
  }
  it('returns hasMore=false when under the page size', () => {
    const page = buildPage(snap(2), 25);
    expect(page.items.length).toBe(2);
    expect(page.hasMore).toBe(false);
    expect(page.next).toBeTruthy();
  });
  it('truncates to the requested limit and reports hasMore', () => {
    const page = buildPage(snap(26), 25);
    expect(page.items.length).toBe(25);
    expect(page.hasMore).toBe(true);
    expect(page.next).toBeTruthy();
  });
});
