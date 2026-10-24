import { createMemoryDataSource, type DataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor, surveyFlowPart } from './viewer-parts';

/**
 * One question at a time (`flow: "one"`), as a person answers: each question alone with the words before it, OK (the
 * form's submit, as Enter presses it) going on once it is answered, a required one refused where it stands, a pick
 * going on by itself, a question an answer hides passed over, how far said; on a wizard, its steps entered as it goes;
 * a form opened with answers at the first still to answer; the review's Edit back at its screen.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const words = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const current = (host: Element) => host.querySelector('[data-fd-current]')?.getAttribute('data-node');
const away = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`)?.hasAttribute('data-fd-away');
const box = (host: Element, node: string) => host.querySelector(`[data-node="${node}"] input, [data-node="${node}"] textarea`) as HTMLInputElement;
function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const ok = (host: Element) => host.querySelector('.fd-flow-ok') as HTMLButtonElement;
const pick = (host: Element, node: string, label: string) => {
  const input = ([...host.querySelectorAll(`[data-node="${node}"] .fd-choice`)].find((choice) => words(choice) === label)?.querySelector('input') as HTMLInputElement);
  input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  input.click();
};

const homes = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.13',
  id: 'homes',
  data: { kind: 'responses' },
  flow: 'one',
  fields: {
    name: { type: 'char', label: 'Your name', required: true },
    kind: { type: 'selection', label: 'Looking for', options: [{ value: 'flat', label: 'A flat' }, { value: 'office', label: 'An office' }] },
    beds: { type: 'selection', label: 'Bedrooms', options: [{ value: '2', label: 'Two' }, { value: '3', label: 'Three' }] },
    notes: { type: 'text', label: 'Anything else?' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'text', id: 'hello', text: 'One question at a time.' },
      { type: 'field', id: 'q-name', field: 'name' },
      { type: 'field', id: 'q-kind', field: 'kind', widget: 'radio' },
      { type: 'field', id: 'q-beds', field: 'beds', widget: 'radio', invisible: "kind == 'office'" },
      { type: 'field', id: 'q-notes', field: 'notes' },
    ],
  },
  ...more,
});

async function mount(page: Page, dataSource: DataSource = createMemoryDataSource(), values?: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource, ...(values ? { values: values as never } : {}) });
  await handle.drawn;
  await flush();
  return host;
}

describe('one question at a time', () => {
  it('is drawn by the survey part, which a page with it asks for', () => {
    expect(partsFor(homes())).toContain(surveyFlowPart);
    expect(partsFor(homes({ flow: undefined }))).not.toContain(surveyFlowPart);
  });

  it('shows each question alone, the words before it with it; OK goes on once answered; a pick goes on by itself; a hidden one is passed', async () => {
    const host = await mount(homes());
    expect(current(host)).toBe('q-name');
    expect(away(host, 'hello')).toBe(false);
    expect(away(host, 'q-kind')).toBe(true);
    expect(words(host.querySelector('.fd-flow-count'))).toBe('Question 1 of 4');
    expect(ok(host).type).toBe('submit');
    // Nothing typed: refused where it stands.
    ok(host).click();
    await flush();
    expect(current(host)).toBe('q-name');
    expect(host.querySelector('[data-node="q-name"] [aria-invalid="true"]')).toBeTruthy();
    type(box(host, 'q-name'), 'Mona');
    ok(host).click();
    await flush();
    expect(current(host)).toBe('q-kind');
    expect(away(host, 'hello')).toBe(true);
    // A pick by the pointer goes on by itself, a moment later; an office has no bedrooms.
    jest.useFakeTimers();
    pick(host, 'q-kind', 'An office');
    jest.advanceTimersByTime(500);
    jest.useRealTimers();
    await flush();
    await flush();
    expect(current(host)).toBe('q-notes');
    expect(words(host.querySelector('.fd-flow-count'))).toBe('Question 3 of 3');
    // The last says the page's own words to send.
    expect(words(ok(host))).toBe('Submit');
    (host.querySelector('.fd-flow-move[aria-label="Previous question"]') as HTMLButtonElement).click();
    await flush();
    expect(current(host)).toBe('q-kind');
  });

  it('goes through a wizard’s steps as it goes, and opens with answers at the first still to answer', async () => {
    const page = homes({
      layout: {
        type: 'wizard',
        id: 'w',
        children: [
          { type: 'step', id: 's1', label: 'You', children: [{ type: 'field', id: 'q-name', field: 'name' }, { type: 'field', id: 'q-kind', field: 'kind', widget: 'radio' }] },
          { type: 'step', id: 's2', label: 'Home', children: [{ type: 'field', id: 'q-beds', field: 'beds', widget: 'radio' }, { type: 'field', id: 'q-notes', field: 'notes' }] },
        ],
      },
    });
    const host = await mount(page, createMemoryDataSource(), { name: 'Mona', kind: 'flat' });
    // Answered so far: the first still to answer, its step entered.
    expect(current(host)).toBe('q-beds');
    expect(host.querySelector('[data-node="s2"]')?.hasAttribute('hidden')).toBe(false);
    expect(words(host.querySelector('.fd-flow-count'))).toBe('Question 3 of 4');
  });

  it('takes the review’s Edit back to that question’s screen', async () => {
    const host = await mount(homes({ review: true }), createMemoryDataSource(), { name: 'Mona', kind: 'flat', beds: '2' });
    expect(current(host)).toBe('q-notes');
    expect(words(ok(host))).toBe('Review your answers');
    ok(host).click();
    await flush();
    const review = host.querySelector('.fd-review') as HTMLElement;
    expect(review.hidden).toBe(false);
    (review.querySelector('[data-field="kind"] .fd-review-edit') as HTMLButtonElement).click();
    await flush();
    expect(review.hidden).toBe(true);
    expect(current(host)).toBe('q-kind');
  });
});
