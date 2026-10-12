import { test as base } from '@playwright/test';
import { quietMapServers } from './map-support';

/**
 * The browser tests' own `test`: Playwright's, with every map server a demo
 * can call answered by stand-ins in each test's browser (map-support.ts), so
 * no test reaches a real provider and none fails on a server's bad day.
 * Every spec takes `test` and `expect` from here; e2e/fixtures-guard.spec.ts
 * keeps it so.
 */
export const test = base.extend<{ quietMaps: void }>({
  quietMaps: [
    async ({ context }, use) => {
      await quietMapServers(context);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
