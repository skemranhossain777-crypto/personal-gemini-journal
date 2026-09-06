import { expect } from 'vitest';
import axe from 'axe-core';

/**
 * Runs axe-core against `container` and asserts zero violations. Two rules are
 * always disabled because jsdom cannot evaluate them faithfully:
 *  - `color-contrast`: requires real computed styles/layout.
 *  - `region`: components are unit-tested in isolation; the app shell provides
 *    the landmark structure.
 */
export async function expectAxeClean(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
    },
  });
  const failures = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
  expect(
    failures,
    JSON.stringify(failures, null, 2),
  ).toEqual([]);
}
