import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A page of responses' endings, and `{field}` words in its own words, as a person sees them: an ending chosen by the
 * answers with the reference the app gave; labels, help, choices, steps and buttons naming the answers given, as a
 * sentence says them, following them as they change.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const words = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const button = (host: Element, text: string) => [...host.querySelectorAll('button')].find((b) => words(b) === text && visible(b)) as HTMLButtonElement;

/** A clinic's booking: a branch, a day, a service with its price, a name — and what it says once sent. */
function booking(more: Partial<Page> = {}): Page {
  return {
    fieldia: '0.6',
    id: 'booking',
    data: { kind: 'responses' },
    look: { dateOrder: 'mdy' },
    fields: {
      name: { type: 'char', label: 'Your name' },
      branch: {
        type: 'selection',
        label: 'Branch',
        options: [
          { value: 'zamalek', label: 'Zamalek' },
          { value: 'maadi', label: 'Maadi' },
        ],
      },
      day: { type: 'date', label: 'Day' },
      price: { type: 'monetary', label: 'Price', currency: 'EGP' },
      first: { type: 'boolean', label: 'First visit' },
      rating: { type: 'integer', label: 'How was your visit to {branch}?', help: 'Only the {branch} team reads it.' },
      reach: { type: 'selection', label: 'Reach me', options: [{ value: 'branch', label: 'Call me from {branch}' }, { value: 'mail', label: 'By email' }] },
      way: { type: 'selection', label: 'Or', options: [{ value: 'x', label: 'At {branch}' }, { value: 'y', label: 'Online' }] },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-name', field: 'name' },
        { type: 'field', id: 'f-branch', field: 'branch' },
        { type: 'field', id: 'f-day', field: 'day' },
        { type: 'field', id: 'f-price', field: 'price' },
        { type: 'field', id: 'f-first', field: 'first' },
        { type: 'field', id: 'f-rating', field: 'rating' },
        { type: 'field', id: 'f-reach', field: 'reach', widget: 'radio' },
        { type: 'field', id: 'f-way', field: 'way' },
        { type: 'text', id: 't-sum', text: 'Booked: {day}, {price}, first visit {first}.' },
        { type: 'button', id: 'b-call', label: 'Call {branch}', steps: [{ do: 'say', message: 'Calling' }] },
      ],
    },
    ...more,
  } as Page;
}

function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  return { host, form: handle.form };
}

describe('{field} words in a page’s own words', () => {
  it('show the answers given in a label, a help, a choice and a button, and follow them as they change', async () => {
    const { host, form } = mount(booking());
    const label = at(host, 'f-rating').querySelector('.fd-label');
    expect(words(label)).toBe('How was your visit to ?');
    form.setValue('branch', 'zamalek');
    await flush();
    expect(words(label)).toBe('How was your visit to Zamalek?');
    expect(words(at(host, 'f-rating').querySelector('.fd-help'))).toBe('Only the Zamalek team reads it.');
    expect(words(at(host, 'f-reach').querySelector('.fd-choice'))).toBe('Call me from Zamalek');
    expect([...at(host, 'f-way').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['', 'At Zamalek', 'Online']);
    expect(words(at(host, 'b-call'))).toBe('Call Zamalek');
    form.setValue('branch', 'maadi');
    await flush();
    expect(words(label)).toBe('How was your visit to Maadi?');
    expect(words(at(host, 'f-reach').querySelector('.fd-choice'))).toBe('Call me from Maadi');
    expect([...at(host, 'f-way').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['', 'At Maadi', 'Online']);
    expect(words(at(host, 'b-call'))).toBe('Call Maadi');
    // The value set apart from the words round it, for a page read right to left.
    expect(label?.querySelector('bdi.fd-value')?.textContent).toBe('Maadi');
  });

  it('say the page’s words while an answer is empty, as the words round them, and the answer once given', async () => {
    const page = booking();
    page.fields['rating'] = { ...page.fields['rating'], label: 'How was your visit to {branch|this branch}?' } as Page['fields'][string];
    const { host, form } = mount(page);
    await flush();
    const label = at(host, 'f-rating').querySelector('.fd-label');
    expect(words(label)).toBe('How was your visit to this branch?');
    expect(label?.querySelector('.fd-value')?.hasAttribute('data-empty')).toBe(true);
    form.setValue('branch', 'zamalek');
    await flush();
    expect(words(label)).toBe('How was your visit to Zamalek?');
    expect(label?.querySelector('.fd-value')?.hasAttribute('data-empty')).toBe(false);
  });

  it('write a day in the page’s order, money with its currency, a yes or no in words', async () => {
    const { host, form } = mount(booking());
    form.setValues({ day: '2026-10-15', price: 1500, first: true });
    await flush();
    expect(words(at(host, 't-sum'))).toBe('Booked: Oct 15, 2026, E£ 1,500.00, first visit Yes.');
    form.setValue('first', false);
    await flush();
    expect(words(at(host, 't-sum'))).toMatch(/first visit No\.$/);
  });

  it('name the field in a message as the page shows its label', async () => {
    const page = booking();
    (page.fields['rating'] as { required?: boolean }).required = true;
    const { host, form } = mount(page, { dataSource: createMemoryDataSource() });
    form.setValue('branch', 'maadi');
    expect(await form.save()).toBe(false);
    await flush();
    expect(words(at(host, 'f-rating').querySelector('.fd-error'))).toBe('Please answer “How was your visit to Maadi?”');
  });

  it('show the answers in a step’s title and words, its place in the list of steps, and the wizard’s button', async () => {
    const page = booking({
      layout: {
        type: 'wizard',
        id: 'w',
        clickable: true,
        finishLabel: 'Book at {branch}',
        children: [
          { type: 'step', id: 's1', label: 'Where', children: [{ type: 'field', id: 'f-branch', field: 'branch' }] },
          { type: 'step', id: 's2', label: 'Your visit to {branch}', description: 'Thank you, {name}.', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
        ],
      },
    });
    const { host, form } = mount(page);
    form.setValues({ branch: 'zamalek', name: 'Mona' });
    await flush();
    expect(words(host.querySelector('[data-node="s2"] .fd-step-title'))).toBe('Your visit to Zamalek');
    expect(words(host.querySelector('[data-node="s2"] .fd-section-description'))).toBe('Thank you, Mona.');
    expect([...host.querySelectorAll('.fd-step-link')].map(words)).toEqual(['Where', 'Your visit to Zamalek']);
    expect(form.next()).toBe(true);
    await flush();
    expect(button(host, 'Book at Zamalek')).toBeTruthy();
  });
});

describe('an ending, once the answers are sent', () => {
  const endings: Page['endings'] = [
    { when: 'rating <= 2', title: 'We are sorry, {name}', text: '{branch} will call you today.\nThank you for telling us.', again: false },
    { title: 'Thank you, {name}', text: 'Your booking is {id}: {day} at [our {branch} branch](https://example.com/branches/{branch}?ref={id}).', again: 'Book another' },
  ];

  async function send(host: HTMLElement, form: ViewerHandle['form'], values: Record<string, unknown>) {
    form.setValues(values as never);
    host.querySelector<HTMLButtonElement>('button[type=submit]')?.click();
    await form.settled();
    await flush();
  }

  it('says the default with the reference the app gave, its link, and its own button to start again', async () => {
    const dataSource = createMemoryDataSource({ submitted: (_, count) => ({ id: `B-${1042 + count}` }) });
    const { host, form } = mount(booking({ endings }), { dataSource });
    await send(host, form, { name: 'Mona', branch: 'zamalek', day: '2026-10-15', rating: 5 });
    const done = host.querySelector('.fd-done') as HTMLElement;
    expect(visible(done)).toBe(true);
    expect(words(done.querySelector('.fd-done-title'))).toBe('Thank you, Mona');
    expect(words(done.querySelector('.fd-done-text'))).toBe('Your booking is B-1043: Oct 15, 2026 at our Zamalek branch.');
    expect(done.querySelector('a')?.getAttribute('href')).toBe('https://example.com/branches/zamalek?ref=B-1043');
    // It takes the focus, so the reference is read out.
    expect(document.activeElement).toBe(done.querySelector('.fd-done-title'));
    button(host, 'Book another').click();
    await flush();
    expect(visible(done)).toBe(false);
    expect(form.getState().sent).toBeNull();
  });

  it('says the first whose condition holds, each line its paragraph, and no button when it says none', async () => {
    const { host, form } = mount(booking({ endings }), { dataSource: createMemoryDataSource() });
    await send(host, form, { name: 'Sara', branch: 'maadi', rating: 1 });
    const done = host.querySelector('.fd-done') as HTMLElement;
    expect(words(done.querySelector('.fd-done-title'))).toBe('We are sorry, Sara');
    expect([...done.querySelectorAll('.fd-done-words')].map(words)).toEqual(['Maadi will call you today.', 'Thank you for telling us.']);
    expect(visible(done.querySelector('button'))).toBe(false);
  });

  it('says the viewer’s own thanks where none holds, and on a page with none, as before', async () => {
    const some = mount(booking({ endings: [{ when: 'rating <= 2', title: 'Sorry' }] }), { dataSource: createMemoryDataSource() });
    await send(some.host, some.form, { rating: 5 });
    expect(words(some.host.querySelector('.fd-done-title'))).toBe('Thank you. Your answers were sent.');
    expect(visible(button(some.host, 'Submit another response'))).toBe(true);
    handle?.destroy();
    document.body.replaceChildren();
    const none = mount(booking(), { dataSource: createMemoryDataSource() });
    await send(none.host, none.form, { rating: 5 });
    const done = none.host.querySelector('.fd-done') as HTMLElement;
    expect([...done.children].map(words)).toEqual(['Thank you. Your answers were sent.', 'Submit another response']);
  });

  it('shows words alone, without a title, and the values the app added as it kept the response', async () => {
    const dataSource = createMemoryDataSource({ submitted: () => ({ id: 7, values: { day: '2026-11-02' } }) });
    const { host, form } = mount(booking({ endings: [{ text: 'See you on {day}. Reference {id}.' }] }), { dataSource });
    await send(host, form, { day: '2026-10-15' });
    expect(visible(host.querySelector('.fd-done-title'))).toBe(false);
    expect(words(host.querySelector('.fd-done-text'))).toBe('See you on Nov 2, 2026. Reference 7.');
    expect(document.activeElement).toBe(host.querySelector('.fd-done-words'));
  });
});
