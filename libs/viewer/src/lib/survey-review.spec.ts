import { createMemoryDataSource, type DataSource, type Page, type WizardNode } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor, surveyFlowPart } from './viewer-parts';

/**
 * A review before sending (`review` on a page of responses), as a person goes through it: the last step's button reads
 * "Review your answers", the answers checked as a step's are, then every answer shown by step with Edit; Edit goes to
 * that question in its step, "Back to review" shows them again, and Send sends. On a page of sections, its Submit
 * reviews them first.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const words = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const button = (host: Element, text: string) => [...host.querySelectorAll('button')].find((b) => words(b) === text && visible(b)) as HTMLButtonElement;
const box = (host: Element, node: string) => host.querySelector(`[data-node="${node}"] input, [data-node="${node}"] textarea`) as HTMLInputElement;
function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const intake = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.7',
  id: 'intake',
  data: { kind: 'responses' },
  review: true,
  fields: {
    name: { type: 'char', label: 'Your name', required: true },
    phone: { type: 'char', label: 'Phone' },
    visit: { type: 'selection', label: 'Visit', options: [{ value: 'first', label: 'First visit' }, { value: 'again', label: 'Coming back' }] },
    notes: { type: 'text', label: 'Anything else?' },
  },
  layout: {
    type: 'wizard',
    id: 'w',
    finishLabel: 'Send my answers',
    children: [
      { type: 'step', id: 'you', label: 'About you', children: [{ type: 'field', id: 'q-name', field: 'name' }, { type: 'field', id: 'q-phone', field: 'phone' }] },
      { type: 'step', id: 'visit', label: 'Your visit', children: [{ type: 'field', id: 'q-visit', field: 'visit', widget: 'radio' }, { type: 'field', id: 'q-notes', field: 'notes' }] },
    ],
  } as WizardNode,
  ...more,
});

async function mount(page: Page, dataSource: DataSource = createMemoryDataSource()) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource });
  await handle.drawn;
  return host;
}

describe('a review before sending', () => {
  it('is drawn by the survey part, which a page with a review asks for', () => {
    expect(partsFor(intake())).toContain(surveyFlowPart);
    expect(partsFor(intake({ review: undefined }))).not.toContain(surveyFlowPart);
  });

  it('shows every answer by step, each with Edit, once the last step is checked; Edit goes to the question, Back to review comes back', async () => {
    const sent: unknown[] = [];
    const ds = createMemoryDataSource();
    const submit = ds.submit.bind(ds);
    ds.submit = (request) => (sent.push(request.values), submit(request));
    const host = await mount(intake(), ds);
    type(box(host, 'q-name'), 'Mona Adel');
    button(host, 'Next').click();
    await flush();
    expect(button(host, 'Review your answers')).toBeTruthy();
    expect(button(host, 'Send my answers')).toBeUndefined();
    ([...host.querySelectorAll('[data-node="q-visit"] .fd-choice')].find((choice) => words(choice) === 'First visit')?.querySelector('input') as HTMLInputElement).click();
    button(host, 'Review your answers').click();
    await flush();
    const review = host.querySelector('.fd-review') as HTMLElement;
    expect(visible(review)).toBe(true);
    expect(visible(host.querySelector('.fd-wizard'))).toBe(false);
    expect(document.activeElement).toBe(review.querySelector('.fd-review-title'));
    expect(words(review.querySelector('.fd-review-title'))).toBe('Check your answers');
    expect([...review.querySelectorAll('.fd-review-group-title')].map(words)).toEqual(['About you', 'Your visit']);
    expect([...review.querySelectorAll('.fd-review-row')].map((row) => [words(row.querySelector('dt')), words(row.querySelector('.fd-review-answer'))])).toEqual([
      ['Your name', 'Mona Adel'],
      ['Phone', 'Not answered'],
      ['Visit', 'First visit'],
      ['Anything else?', 'Not answered'],
    ]);
    // Each Edit says which question it changes to a screen reader.
    expect(words(review.querySelector('[data-field="phone"] .fd-review-edit'))).toBe('Edit Phone');
    // Edit: the question in its step, the review put away; Back to review shows them again with the change.
    (review.querySelector('[data-field="phone"] .fd-review-edit') as HTMLButtonElement).click();
    await flush();
    expect(visible(review)).toBe(false);
    expect(document.activeElement).toBe(box(host, 'q-phone'));
    type(box(host, 'q-phone'), '+20 100 123 4567');
    button(host, 'Back to review').click();
    await flush();
    expect(visible(review)).toBe(true);
    expect(words(review.querySelector('[data-field="phone"] .fd-review-answer'))).toBe('+20 100 123 4567');
    expect(sent).toEqual([]);
    button(host, 'Send my answers').click();
    await flush();
    await flush();
    expect(sent).toEqual([{ name: 'Mona Adel', phone: '+20 100 123 4567', visit: 'first', notes: null }]);
    expect(visible(host.querySelector('.fd-done'))).toBe(true);
  });

  it('checks the last step before it shows them: a problem is said there, and no review shows', async () => {
    const page = intake();
    (page.fields['notes'] as { required?: boolean }).required = true;
    const host = await mount(page);
    type(box(host, 'q-name'), 'Mona Adel');
    button(host, 'Next').click();
    await flush();
    button(host, 'Review your answers').click();
    await flush();
    expect(visible(host.querySelector('.fd-review'))).toBe(false);
    expect(host.querySelector('[data-node="q-notes"] [aria-invalid="true"]')).toBeTruthy();
  });

  it('reviews a page of sections from its Submit', async () => {
    const host = await mount(
      intake({
        review: { title: 'Before you send', text: 'Press Edit to change one.' },
        layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', title: 'You', children: [{ type: 'field', id: 'q-name', field: 'name' }] }, { type: 'field', id: 'q-notes', field: 'notes' }] },
      })
    );
    type(box(host, 'q-name'), 'Mona Adel');
    button(host, 'Review your answers').click();
    await flush();
    const review = host.querySelector('.fd-review') as HTMLElement;
    expect(words(review.querySelector('.fd-review-title'))).toBe('Before you send');
    expect(words(review.querySelector('.fd-review-text'))).toBe('Press Edit to change one.');
    expect([...review.querySelectorAll('.fd-review-group')].map((group) => words(group.querySelector('.fd-review-group-title')))).toEqual(['You', '']);
    expect(button(host, 'Submit')).toBeTruthy();
    button(host, 'Back').click();
    expect(visible(review)).toBe(false);
  });
});
