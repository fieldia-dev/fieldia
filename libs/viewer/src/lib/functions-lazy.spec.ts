import { createMemoryDataSource, functionsPart, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor } from './viewer-parts';

/**
 * The bodies of Fieldia's functions beyond the plain ones come in @fieldia/core's functions part: asked for only where
 * a page's formulas call one, and waited for before the page is drawn, so a value worked out from one is whole at once.
 * This file starts with no part loaded (src/test-parts.ts leaves it so), its tests in order.
 */

const page = (compute: string): Page =>
  ({
    fieldia: '0.5',
    id: 'visit',
    data: { kind: 'responses' },
    fields: {
      birth: { type: 'date', label: 'Birth date' },
      age: { type: 'integer', label: 'Age', compute, readonly: true },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-birth', field: 'birth' }, { type: 'field', id: 'f-age', field: 'age' }] },
  }) as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const mount = (shown: Page) => {
  const host = document.createElement('div');
  document.body.append(host);
  // The app's own function, which these pages call not: given to every page, it asks for nothing on one calling none.
  handle = mountViewer(host, { page: shown, dataSource: createMemoryDataSource(), values: { birth: '1990-10-20' }, now: () => new Date('2026-10-20T12:00:00Z'), functions: { vatRate: () => 0.14 } });
  return host;
};
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}

describe("the form's functions part", () => {
  it('is asked for by a page whose formulas call one of its functions, never by another', () => {
    // (A date's box is the date part's, whatever the formulas.)
    expect(partsFor(page('2026 - 1990'))).not.toContain(functionsPart);
    expect(partsFor(page('age(birth)'))).toContain(functionsPart);
  });

  it('a page calling none never loads it, whatever functions of its own the app gives', async () => {
    const host = mount(page('36'));
    await until(() => host.querySelector('[data-node="f-age"]'));
    await new Promise((done) => setTimeout(done, 30));
    expect(functionsPart.loaded).toBeUndefined();
  });

  it('a page calling one waits for it, then draws the value worked out', async () => {
    const host = mount(page('age(birth)'));
    expect(host.querySelector('[data-node="f-age"]')).toBeNull();
    await until(() => host.querySelector('[data-node="f-age"]'));
    expect(functionsPart.loaded).toBeDefined();
    expect(handle?.form.getState().values['age']).toBe(36);
    expect(handle?.form.getState().asked).toEqual({});
    expect(host.querySelector('[data-node="f-age"] [data-waits]')).toBeNull();
  });
});
