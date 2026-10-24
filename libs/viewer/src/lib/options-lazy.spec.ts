import { createMemoryDataSource, optionRulesPart, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor } from './viewer-parts';

/**
 * Options shown by a condition, or carried from an earlier question, come in @fieldia/core's options part: asked for
 * only where a page has any, and waited for before it is drawn, so a choice offers what it should at once. This file
 * starts with no part loaded (src/test-parts.ts leaves it so), its tests in order.
 */

const listing = (garden: Record<string, unknown> = { invisible: "kind != 'villa'" }): Page =>
  ({
    fieldia: '0.11',
    id: 'listing',
    data: { kind: 'responses' },
    fields: {
      kind: { type: 'selection', label: 'Kind', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Flat' }] },
      extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'garden', label: 'Garden', ...garden }, { value: 'lift', label: 'Lift' }] },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-kind', field: 'kind' }, { type: 'field', id: 'f-extras', field: 'extras' }] },
  }) as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}
const mount = (page: Page) => {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource(), values: { kind: 'flat' } });
  return host;
};

describe("the form's options part", () => {
  it('is asked for by a page whose options show by a condition, never by another', () => {
    expect(partsFor(listing())).toEqual([optionRulesPart]);
    expect(partsFor(listing({}))).toEqual([]);
  });

  it('a page with none never loads it', async () => {
    const host = mount(listing({}));
    await until(() => host.querySelector('[data-node="f-extras"]'));
    await new Promise((done) => setTimeout(done, 30));
    expect(optionRulesPart.loaded).toBeUndefined();
  });

  it('a page with some waits for it, then offers what its answers allow', async () => {
    const host = mount(listing());
    expect(host.querySelector('[data-node="f-extras"]')).toBeNull();
    await until(() => host.querySelector('[data-node="f-extras"]'));
    expect(optionRulesPart.loaded).toBeDefined();
    const offered = host.querySelector('[data-node="f-extras"]')?.textContent ?? '';
    expect(host.querySelectorAll('[data-node="f-extras"] input')).toHaveLength(1);
    expect(offered).toContain('Lift');
    expect(offered).not.toContain('Garden');
  });
});
