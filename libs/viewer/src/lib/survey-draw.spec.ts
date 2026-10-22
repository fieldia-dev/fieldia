import { createMemoryDataSource, drawOrder, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor, surveyFlowPart } from './viewer-parts';

/**
 * Questions in an order drawn for each respondent, and N of M (`order: "random"`, `draw`), as a person sees them: the
 * questions laid in the order the form drew, the words before them kept in their place, those not drawn hidden and
 * never asked; the review listing them in that order.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');

const bank = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.9',
  id: 'bank',
  data: { kind: 'responses' },
  fields: Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'q5'].map((name) => [name, { type: 'char', label: `Question ${name.slice(1)}`, required: true }])) as Page['fields'],
  layout: {
    type: 'sections',
    id: 'root',
    order: 'random',
    draw: 3,
    children: [{ type: 'text', id: 'words', text: 'Answer each.' }, ...['q1', 'q2', 'q3', 'q4', 'q5'].map((field) => ({ type: 'field' as const, id: `f-${field}`, field }))],
  } as Page['layout'],
  ...more,
});

describe('questions in an order drawn', () => {
  it('are laid by the survey part, which a page that draws asks for', () => {
    expect(partsFor(bank())).toContain(surveyFlowPart);
  });

  it('shows the questions drawn, in the order drawn, the words first where they stood; the rest hidden and never asked', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const sent: Record<string, unknown>[] = [];
    const ds = createMemoryDataSource();
    const submit = ds.submit.bind(ds);
    ds.submit = (request) => (sent.push(request.values), submit(request));
    handle = mountViewer(host, { page: bank(), dataSource: ds, seed: 'mona' });
    await handle.drawn;
    await flush();
    const order = drawOrder(bank(), 'mona')['root'];
    const shown = [...host.querySelectorAll('.fd-sections > [data-node]')].filter((part) => visible(part)).map((part) => part.getAttribute('data-node'));
    expect(shown).toEqual(order);
    expect(order[0]).toBe('words');
    // Only those drawn are asked: the form sends without the two left out.
    for (const id of order.slice(1)) {
      const input = host.querySelector(`[data-node="${id}"] input`) as HTMLInputElement;
      input.value = 'yes';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    for (let turn = 0; turn < 50 && !sent.length; turn++) await flush();
    expect(Object.keys(sent[0]).sort()).toEqual(order.slice(1).map((id) => id.slice(2)).sort());
  });
});
