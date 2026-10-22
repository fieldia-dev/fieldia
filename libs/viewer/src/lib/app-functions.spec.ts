import type { AppFunctions, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * The viewer with the app's own functions (`functions`): its page checked
 * with them, a value worked out from one that asks the server waiting with an
 * ellipsis and said, its failure said in sight; and options a change takes
 * out of an answer said under their field.
 */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const stay = {
  fieldia: '0.10',
  id: 'stay',
  data: { kind: 'responses' },
  fields: {
    nights: { type: 'integer', label: 'Nights' },
    country: { type: 'char', label: 'Country' },
    rate: { type: 'monetary', label: 'Night rate', currency: 'EGP', compute: 'nightRate(country)' },
    total: { type: 'monetary', label: 'Total', currency: 'EGP', compute: 'nights * rate' },
    kind: { type: 'selection', label: 'Room', options: [{ value: 'suite', label: 'Suite' }, { value: 'single', label: 'Single' }] },
    extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'jacuzzi', label: 'Jacuzzi', invisible: "kind != 'suite'" }, { value: 'late', label: 'Late check-out' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nights', field: 'nights' },
      { type: 'field', id: 'f-country', field: 'country' },
      { type: 'field', id: 'f-rate', field: 'rate' },
      { type: 'field', id: 'f-total', field: 'total' },
      { type: 'field', id: 'f-kind', field: 'kind' },
      { type: 'field', id: 'f-extras', field: 'extras' },
    ],
  },
} as unknown as Page;

function mount(functions?: AppFunctions) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: stay, ...(functions ? { functions } : {}) });
  const part = (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
  return { host, part, form: handle.form };
}

const tick = () => new Promise((go) => setTimeout(go, 0));

describe('the app’s functions in the viewer', () => {
  it('are needed to show a page that calls them, and said when missing', () => {
    expect(() => mount()).toThrow(/This page cannot be shown:\n {2}fields\.rate\.compute: cannot read "nightRate\(country\)": no function "nightRate"/);
  });

  it('show a value worked out from one that asks as an ellipsis, said, then its value', async () => {
    let answer: (rate: number) => void = () => undefined;
    const { part, form } = mount({ nightRate: () => new Promise<number>((go) => (answer = go)) });
    form.setValue('nights', 3);
    form.setValue('country', 'EG');
    const total = part('f-total');
    expect(total.hasAttribute('data-asking')).toBe(true);
    const mark = total.querySelector('.fd-value-waits') as HTMLElement;
    expect(mark.firstElementChild?.textContent).toBe('…');
    expect(mark.getAttribute('title')).toBe('Working out Total…');
    expect(mark.querySelector('.fd-sr-only')?.textContent).toBe('Working out Total…');
    answer(1200);
    await tick();
    expect(total.hasAttribute('data-asking')).toBe(false);
    expect(mark.hidden).toBe(true);
    expect(form.getState().values['total']).toBe(3600);
  });

  it('say in sight why an answer did not come, and that saving tries again', async () => {
    let fail: (why: Error) => void = () => undefined;
    const { part, form } = mount({ nightRate: () => new Promise<number>((_, no) => (fail = no)) });
    form.setValue('country', 'EG');
    fail(new Error('The rates server is down'));
    await tick();
    const why = part('f-rate').querySelector('.fd-value-waits-why') as HTMLElement;
    expect(why.textContent).toBe('Night rate could not be worked out: The rates server is down. Saving tries again.');
    expect(part('f-rate').querySelector('.fd-value-waits')?.firstElementChild?.textContent).toBe('—');
  });
});

describe('options a change takes out of an answer, in the viewer', () => {
  it('are said under their field', () => {
    const { part, form } = mount({ nightRate: () => 1000 });
    form.setValue('kind', 'suite');
    form.setValue('extras', ['jacuzzi', 'late']);
    form.setValue('kind', 'single');
    const warning = part('f-extras').querySelector(':scope > .fd-warning') as HTMLElement;
    expect(warning.hidden).toBe(false);
    expect(warning.getAttribute('role')).toBe('status');
    expect(warning.textContent).toBe('Jacuzzi is no longer offered, so it was taken out');
    form.setValue('extras', ['late']);
    expect(warning.hidden).toBe(true);
  });
});
