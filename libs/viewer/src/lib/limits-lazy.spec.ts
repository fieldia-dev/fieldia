import { createMemoryDataSource, formLimitsPart, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { limitsPart, partsFor } from './viewer-parts';

/**
 * A page's limits come in parts: its form's (@fieldia/core's `formLimitsPart`: when it takes answers, each choice's
 * places) for a page with `limits` or options with `seats`, and the viewer's (`limitsPart`: a closed form's words,
 * Continue later) for a page with `limits` or `continueLater` — one script in the one-tag script. A page with none
 * asks for neither. This file starts with no part loaded (src/test-parts.ts leaves it so), its tests in order.
 */

const signup = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.8',
    id: 'event-signup',
    data: { kind: 'responses' },
    fields: {
      name: { type: 'char', label: 'Name' },
      session: { type: 'selection', label: 'Session', options: [{ value: 'am', label: 'Morning workshop', seats: 2 }] },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-session', field: 'session' }] },
    limits: { closes: '2026-11-20' },
    ...more,
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

describe("a page's limits parts", () => {
  it('are asked for by a page with limits, places or Continue later — each its own — never by another', () => {
    expect(partsFor(signup())).toEqual([limitsPart, formLimitsPart]);
    expect(partsFor(signup({ limits: undefined }))).toEqual([formLimitsPart]);
    expect(partsFor(signup({ limits: undefined, continueLater: true, fields: { name: { type: 'char', label: 'Name' } } }))).toEqual([limitsPart]);
    expect(partsFor(signup({ limits: undefined, fields: { name: { type: 'char', label: 'Name' } } }))).toEqual([]);
  });

  it('a closed page waits for both, then says so in place of its questions', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: signup(), dataSource: createMemoryDataSource(), now: () => new Date('2026-11-25T10:00:00Z') });
    expect(host.querySelector('.fd-field')).toBeNull();
    await until(() => host.querySelector('.fd-closed:not([hidden]) .fd-closed-title'));
    expect(formLimitsPart.loaded).toBeDefined();
    expect(host.querySelector('.fd-closed-title')?.textContent).toBe('This form closed on 20 Nov 2026.');
    expect([...host.querySelectorAll('.fd-field')].every((field) => field.closest('[hidden]'))).toBe(true);
  });
});
