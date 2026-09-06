import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL auto-cleanup is global-only; with `globals: false` we wire it manually.
// Some suites (e.g. security-rules tests) run under the `node` environment and
// have no DOM, so guard the DOM-specific teardown.
afterEach(() => {
  cleanup();
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
});
