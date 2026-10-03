import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Finding things in the screen designer the way a person sees them. A card is
 * found by its field's label through the page being built: the card being
 * edited shows its label in a box, which text matching cannot read.
 */

declare global {
  interface Window {
    fieldiaDesigner: { designer: { getPage(): any; getState(): any }; reopen(): Promise<void> };
  }
}

/** The ids of the fields on the page, by the label each shows. */
async function nodeIds(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const built = window.fieldiaDesigner.designer.getPage();
    const walk = (nodes: any[]): any[] => nodes.flatMap((n) => (n.type === 'field' ? [n] : n.children ? walk(n.children) : []));
    return Object.fromEntries(walk(built.layout.children).map((n) => [n.label ?? built.fields[n.field].label, n.id]));
  });
}

export async function cardOf(page: Page, label: string): Promise<Locator> {
  const ids = await nodeIds(page);
  return page.locator(`.fd-canvas-field[data-node="${ids[label] ?? '-none-'}"]`);
}

/** Each section's fields as "Label:width", read from the page being built. */
export function layout(page: Page): Promise<string[][]> {
  return page.evaluate(() => {
    const built = window.fieldiaDesigner.designer.getPage();
    const sections = (nodes: any[]): any[] => nodes.flatMap((n) => (n.type === 'section' ? [n] : n.children ? sections(n.children) : []));
    return sections(built.layout.children).map((s: any) => s.children.map((n: any) => `${n.label ?? built.fields[n.field].label}:${n.colspan ?? 1}`));
  });
}

/** Press, move in steps at hand speed, release. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, options: { release?: boolean } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { steps: 3 });
  if (options.release !== false) await page.mouse.up();
}

export function tile(page: Page, spec: string): Locator {
  return page.locator(`.fd-toolbox [data-tool="${spec}"]`);
}

/** The field being edited, and the box its label is typed in. */
export function editing(page: Page): { card: Locator; label: Locator; help: Locator } {
  const card = page.locator('.fd-canvas-field.fd-editing');
  return { card, label: card.locator('[data-inline="label"]'), help: card.locator('[data-inline="help"]') };
}

/** Add a kind from the toolbox and name it where it stands. */
export async function addField(page: Page, kind: string, label: string) {
  await tile(page, `kind:${kind}`).click();
  await expect(editing(page).label).toBeFocused();
  await page.keyboard.type(label);
  await expect(editing(page).label).toHaveValue(label);
}

/** Collect page errors and console errors, for an empty list at the end. */
export function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  return problems;
}
