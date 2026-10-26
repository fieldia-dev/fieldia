import { type Page } from '@playwright/test';
import { expect } from './fixtures';

/** What a demo puts on `window.fieldiaDemo` that holding reads: its source, and the answers held. */
interface Holding {
  dataSource: Record<string, (request: unknown) => Promise<unknown>>;
  held: (() => void)[];
  release(): void;
}

/**
 * A demo's source's saves (or sends) held until the test lets them go, so a press or a change is certainly made while
 * one is on its way — never timed against the source's own delay, which a slow runner outlasts. The demo's source is
 * `window.fieldiaDemo.dataSource`. `asked()` resolves once a held one waits; `held()` says how many do; `release()` lets
 * every held one answer, holding going on.
 */
export async function holdSaves(page: Page, method: 'save' | 'submit' = 'save') {
  await page.evaluate(
    (name) => {
      const demo = (window as unknown as { fieldiaDemo: Holding }).fieldiaDemo;
      const source = demo.dataSource;
      const real = source[name].bind(source);
      demo.held = [];
      demo.release = () => demo.held.splice(0).forEach((go) => go());
      source[name] = async (request: unknown) => {
        await new Promise<void>((go) => demo.held.push(go));
        return real(request);
      };
    },
    method
  );
  const held = () => page.evaluate(() => (window as unknown as { fieldiaDemo: Holding }).fieldiaDemo.held.length);
  return {
    asked: () => expect.poll(held).toBeGreaterThan(0),
    held,
    release: () => page.evaluate(() => (window as unknown as { fieldiaDemo: Holding }).fieldiaDemo.release()),
  };
}
