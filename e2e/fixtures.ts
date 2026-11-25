import { test as base } from '@playwright/test';
import { quietMapServers } from './map-support';

/**
 * The browser tests' own `test`: Playwright's, with every map server a demo
 * can call answered by stand-ins in each test's browser (map-support.ts), so
 * no test reaches a real provider and none fails on a server's bad day.
 * Every spec takes `test` and `expect` from here; e2e/fixtures-guard.spec.ts
 * keeps it so.
 *
 * `FIELDIA_CPU_SLOW=N` runs each test's page N times slower in Chromium (its
 * own CPU throttling): a machine under load, or a slow phone, put on at will —
 * how a test that failed only in a busy suite is made to fail on purpose.
 */
const slow = Number(process.env['FIELDIA_CPU_SLOW'] ?? 0);

export const test = base.extend<{ quietMaps: void }>({
  quietMaps: [
    async ({ context }, use) => {
      await quietMapServers(context);
      await use();
    },
    { auto: true },
  ],
  page: async ({ page, browserName }, use) => {
    if (slow > 1 && browserName === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slow });
    await use(page);
  },
});

export { expect } from '@playwright/test';
