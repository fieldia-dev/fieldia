import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { answersPart, partsFor } from './viewer-parts';

/**
 * The answers said in a page's own words, and its endings, come in a part of their own: asked for only where a page
 * has any — a `{field}` in a label, a help, a choice, a step, a wizard's or a button's words, or `endings` — and
 * waited for before it is drawn, so its words are whole at once. A text's and an alert's `{field}`s alone ask for
 * nothing, as before. This file starts with no part loaded (src/test-parts.ts leaves it so), its tests in order.
 */

const page = (more: Partial<Page> = {}, label = 'Rating'): Page =>
  ({
    fieldia: '0.12',
    id: 'feedback',
    data: { kind: 'responses' },
    fields: {
      branch: { type: 'selection', label: 'Branch', options: [{ value: 'maadi', label: 'Maadi' }] },
      overall: { type: 'integer', label },
    },
    layout: {
      type: 'sections',
      id: 's',
      children: [
        { type: 'field', id: 'f-branch', field: 'branch' },
        { type: 'field', id: 'f-overall', field: 'overall' },
        { type: 'text', id: 't-note', text: 'Thanks for visiting {branch}.' },
      ],
    },
    ...more,
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
  handle = mountViewer(host, { page: shown, dataSource: createMemoryDataSource(), values: { branch: 'maadi' } });
  return host;
};
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}

describe('the answers part', () => {
  it('is asked for by a page whose own words name an answer, or that has endings — not by a text’s words alone', () => {
    expect(partsFor(page())).toEqual([]);
    expect(partsFor(page({}, 'How was {branch}?'))).toEqual([answersPart]);
    expect(partsFor(page({ endings: [{ title: 'Thanks' }] }))).toEqual([answersPart]);
    const button = page({ layout: { type: 'sections', id: 's', children: [{ type: 'button', id: 'b', label: 'Call {branch}', steps: [{ do: 'say', message: 'Calling' }] }] } });
    expect(partsFor(button)).toEqual([answersPart]);
  });

  it('a page with none never loads it, and its text says its values as before', async () => {
    const host = mount(page());
    await new Promise((done) => setTimeout(done, 30));
    expect(answersPart.loaded).toBeUndefined();
    expect(host.querySelector('[data-node="t-note"]')?.textContent).toBe('Thanks for visiting Maadi.');
  });

  it('a page with some waits for it, then draws its words whole', async () => {
    const host = mount(page({}, 'How was your visit to {branch}?'));
    await until(() => host.querySelector('[data-node="f-overall"] .fd-label'));
    expect(answersPart.loaded).toBeDefined();
    expect(host.querySelector('[data-node="f-overall"] .fd-label')?.textContent).toBe('How was your visit to Maadi?');
  });
});
