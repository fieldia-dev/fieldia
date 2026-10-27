import type { Page } from '@playwright/test';
import type { Hand } from '../hand';

/** What several of the building-blocks demos’ replays share (e2e/how-to/building-blocks/*.ts). */

/** A part of the form by its layout id. */
export const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);

/**
 * A link of the frame's bar at the top — a framework, the code demo's editor — pressed as a person reaches it: in the
 * bar on a desktop; on a phone, under the bar's Options, opened first.
 */
export async function atTheTop({ page, press }: Hand, bar: string, link: string) {
  const target = page.getByRole('navigation', { name: bar }).getByRole('link', { name: link, exact: true });
  const options = page.getByRole('button', { name: 'Framework, look and links' });
  if (!(await target.isVisible()) && (await options.isVisible())) await press(options);
  await press(target);
}

/** Save safety's two tabs (demos/save-safety): the person's own (Sara's), beside Mona's. */
export const yourTab = (page: Page) => page.getByRole('region', { name: 'Your tab' });

/**
 * The page's source, as a person reads it: View Source (Ctrl+U) opens it in a tab of its own — a page the browser
 * draws of the source's lines. Playwright cannot press the browser's own keys, so the tab is opened at its address.
 */
export async function viewSource(page: Page) {
  const source = await page.context().newPage();
  await source.goto(`view-source:${page.url()}`);
  return source;
}
