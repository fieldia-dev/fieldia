import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type DraftStore, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(name: string, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: page(name), ...options });
  return { host, handle, form: handle.form };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const input = (host: Element, node: string) => at(host, node).querySelector('input, textarea, select') as HTMLInputElement;
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const button = (host: Element, text: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text && visible(b)) as HTMLButtonElement;
function type(el: HTMLInputElement, text: string) {
  el.focus();
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a survey (wizard)', () => {
  it('shows the first step, its questions and the progress', () => {
    const { host } = mount('survey');
    expect(host.querySelector('.fd-step:not([hidden]) .fd-step-title')?.textContent).toBe('About you');
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('Step 1 of 3');
    expect(at(host, 'q-name').querySelector('.fd-label')?.textContent).toBe('Your name');
    expect(at(host, 'q-name').classList.contains('fd-required')).toBe(true);
    expect(visible(at(host, 'step-usage'))).toBe(false);
  });

  it('refuses to move on without a required answer, then clears the error', () => {
    const { host } = mount('survey');
    button(host, 'Next').click();
    const error = at(host, 'q-name').querySelector('.fd-error') as HTMLElement;
    expect(visible(error)).toBe(true);
    expect(error.textContent).toBe('Your name is required');
    expect(input(host, 'q-name').getAttribute('aria-invalid')).toBe('true');
    type(input(host, 'q-name'), 'Sara');
    expect(visible(error)).toBe(false);
    button(host, 'Next').click();
    expect(host.querySelector('.fd-step:not([hidden]) .fd-step-title')?.textContent).toBe('Using the product');
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('Step 2 of 3');
  });

  it('branches when an answer opens a step', () => {
    const { host } = mount('survey');
    type(input(host, 'q-name'), 'Sara');
    button(host, 'Next').click();
    (at(host, 'q-uses').querySelectorAll('input[type=radio]')[0] as HTMLInputElement).click();
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('Step 2 of 4');
    button(host, 'Next').click();
    expect(host.querySelector('.fd-step:not([hidden]) .fd-step-title')?.textContent).toBe('Your experience');
    expect(at(host, 'q-rating').querySelectorAll('[role=radio]')).toHaveLength(5);
    button(host, 'Back').click();
    expect(host.querySelector('.fd-step:not([hidden]) .fd-step-title')?.textContent).toBe('Using the product');
  });

  it('submits the answers that were shown and thanks the person', async () => {
    const dataSource = createMemoryDataSource();
    const { host, form } = mount('survey', { dataSource });
    type(input(host, 'q-name'), 'Sara');
    button(host, 'Next').click();
    (at(host, 'q-uses').querySelectorAll('input[type=radio]')[1] as HTMLInputElement).click();
    button(host, 'Next').click();
    type(input(host, 'q-reason'), 'Too expensive for us');
    button(host, 'Next').click();
    button(host, 'Submit').click();
    await form.settled();
    await flush();
    expect(dataSource.responses).toHaveLength(1);
    expect(dataSource.responses[0].values['reason_not']).toBe('Too expensive for us');
    expect(visible(host.querySelector('.fd-done'))).toBe(true);
    button(host, 'Submit another response').click();
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('Step 1 of 3');
    expect(input(host, 'q-name').value).toBe('');
  });
});

describe('a sections page', () => {
  it('lays out sections with their titles and columns', () => {
    const { host } = mount('signup');
    const titles = [...host.querySelectorAll('.fd-section-title')].map((t) => t.textContent);
    expect(titles).toEqual(['About you', 'Your work', 'The day']);
    expect((at(host, 'about').querySelector('.fd-grid') as HTMLElement).style.getPropertyValue('--fd-columns')).toBe('2');
  });

  it('shows and requires a field only when its condition holds', async () => {
    const { host } = mount('signup', { dataSource: createMemoryDataSource() });
    expect(visible(at(host, 'f-other-role'))).toBe(false);
    const role = input(host, 'f-role') as unknown as HTMLSelectElement;
    role.value = '3';
    role.dispatchEvent(new Event('change', { bubbles: true }));
    expect(visible(at(host, 'f-other-role'))).toBe(true);
    expect(at(host, 'f-other-role').classList.contains('fd-required')).toBe(true);
    button(host, 'Submit').click();
    await flush();
    expect(at(host, 'f-other-role').querySelector('.fd-error')?.textContent).toBe('Which role? is required');
  });

  it('hides the dietary question until dinner is chosen', () => {
    const { host } = mount('signup');
    expect(visible(at(host, 'f-dietary'))).toBe(false);
    input(host, 'f-dinner').click();
    expect(visible(at(host, 'f-dietary'))).toBe(true);
  });

  it('links help text to its input', () => {
    const { host } = mount('signup');
    const help = at(host, 'f-email').querySelector('.fd-help') as HTMLElement;
    expect(help.textContent).toBe('We send the joining details here.');
    expect(input(host, 'f-email').getAttribute('aria-describedby')).toContain(help.id);
  });

  it('shows a read-only price with its currency', () => {
    const { host } = mount('signup');
    expect(input(host, 'f-ticket').readOnly).toBe(true);
    expect(input(host, 'f-ticket').value).toBe('1500');
    expect(at(host, 'f-ticket').querySelector('.fd-currency')?.textContent).toBe('EGP');
  });

  it('moves focus to the first problem when submitting fails', async () => {
    const { host } = mount('signup', { dataSource: createMemoryDataSource() });
    button(host, 'Submit').click();
    await flush();
    expect(document.activeElement).toBe(input(host, 'f-name'));
  });
});

const customer = {
  name: 'Nile Traders',
  is_company: true,
  state: 'active',
  email: 'hello@nile.example',
  country_id: { id: 1, label: 'Egypt' },
  sale_order_count: 4,
  invoice_count: 2,
  credit_limit: 5000,
  currency_id: { id: 1, label: 'EGP' },
  notes: '<p>Pays on time.</p>',
};

function sheet(options: Partial<ViewerOptions> = {}) {
  const dataSource = createMemoryDataSource({ records: { partner: { 1: customer } } });
  const mounted = mount('customer', { dataSource, recordId: 1, ...options });
  return { ...mounted, dataSource };
}

describe('a record sheet', () => {
  it('loads the record and shows its title, statusbar and stat buttons', async () => {
    const { host, form } = sheet();
    await form.settled();
    expect((host.querySelector('.fd-title input') as HTMLInputElement).value).toBe('Nile Traders');
    const states = [...host.querySelectorAll('.fd-statusbar li')].map((li) => li.textContent);
    expect(states).toEqual(['Draft', 'Active', 'Blocked']);
    expect(host.querySelector('.fd-statusbar [aria-current="step"]')?.textContent).toBe('Active');
    const stats = [...host.querySelectorAll('.fd-stat')].map((s) => s.textContent);
    expect(stats).toEqual(['4Sales', '2Invoices']);
  });

  it('asks before a button with a confirmation runs', async () => {
    const pressed: string[] = [];
    const { host, form } = sheet({ onAction: (r) => void pressed.push(r.action) });
    await form.settled();
    expect(button(host, 'Activate')).toBeUndefined(); // already active
    button(host, 'Block').click();
    const dialog = document.querySelector('[role=alertdialog]') as HTMLElement;
    expect(dialog.textContent).toContain('Block this customer? New orders will be refused.');
    button(dialog, 'Cancel').click();
    await flush();
    expect(pressed).toEqual([]);
    button(host, 'Block').click();
    button(document.querySelector('[role=alertdialog]') as HTMLElement, 'OK').click();
    await form.settled();
    await flush();
    expect(pressed).toEqual(['block']);
  });

  it('moves the record when a clickable state is chosen', async () => {
    const { host, form } = sheet();
    await form.settled();
    (host.querySelector('.fd-statusbar li:nth-child(3) button') as HTMLButtonElement).click();
    expect(form.getState().values['state']).toBe('blocked');
    expect(visible(host.querySelector('.fd-ribbon'))).toBe(true);
    expect(host.querySelector('.fd-ribbon')?.textContent).toBe('Blocked');
    expect(input(host, 'f-credit-limit').readOnly).toBe(true);
  });

  it('switches tabs, and hides a tab whose condition fails', async () => {
    const { host, form } = sheet();
    await form.settled();
    const tab = (label: string) => [...host.querySelectorAll('[role=tab]')].find((t) => t.textContent === label) as HTMLElement;
    expect(visible(tab('Contacts'))).toBe(true);
    tab('Notes').click();
    expect(tab('Notes').getAttribute('aria-selected')).toBe('true');
    expect(visible(at(host, 'f-notes'))).toBe(true);
    form.setValue('is_company', false);
    expect(visible(tab('Contacts'))).toBe(false);
  });

  it('offers Save once something changes, and saves', async () => {
    const { host, form, dataSource } = sheet();
    await form.settled();
    expect(button(host, 'Save')).toBeUndefined();
    type(input(host, 'f-website'), 'https://nile.example');
    button(host, 'Save').click();
    await form.settled();
    await flush();
    expect(dataSource.records['partner'][1]['website']).toBe('https://nile.example');
    expect(host.querySelector('.fd-status')?.textContent).toBe('Saved');
    expect(button(host, 'Save')).toBeUndefined();
  });

  it('hands the side panel to the app', async () => {
    const { host, form } = sheet({ slots: { chatter: (el) => void (el.textContent = 'Activity feed') } });
    await form.settled();
    expect(host.querySelector('.fd-slot[data-slot="chatter"]')?.textContent).toBe('Activity feed');
  });
});

describe('the viewer itself', () => {
  it('refuses a page that does not validate, naming the problem', () => {
    const broken = page('survey');
    (broken.layout as { children: { children: { field?: string }[] }[] }).children[0].children[1].field = 'nickname';
    expect(() => mountViewer(document.createElement('div'), { page: broken })).toThrow(/no field "nickname"/);
  });

  it('wears a skin, switches it, and installs the stylesheet once', () => {
    const first = mount('signup', { skin: 'outlined' });
    expect(first.handle.element.getAttribute('data-fd-skin')).toBe('outlined');
    first.handle.setSkin('underline');
    expect(first.handle.element.getAttribute('data-fd-skin')).toBe('underline');
    const second = mountViewer(document.body.appendChild(document.createElement('div')), { page: page('survey') });
    expect(document.querySelectorAll('style#fieldia-styles')).toHaveLength(1);
    expect(second.element.getAttribute('data-fd-skin')).toBe('underline');
    second.destroy();
  });

  it('takes translated labels and runs right to left', () => {
    const { host } = mount('survey', { labels: { next: 'التالي', stepOf: 'الخطوة {n} من {total}' }, dir: 'rtl' });
    expect(host.querySelector('.fd-form')?.getAttribute('dir')).toBe('rtl');
    expect(button(host, 'التالي')).toBeDefined();
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('الخطوة 1 من 3');
  });

  it('offers a saved draft back', () => {
    const items = new Map<string, string>([
      ['fieldia:draft:product-feedback:new', JSON.stringify({ savedAt: '2026-10-02T09:00:00.000Z', values: { name: 'Sara' } })],
    ]);
    const store: DraftStore = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: (k) => void items.delete(k) };
    const { host } = mount('survey', { drafts: { store } });
    expect(visible(host.querySelector('.fd-draft'))).toBe(true);
    button(host, 'Restore').click();
    expect(input(host, 'q-name').value).toBe('Sara');
    expect(visible(host.querySelector('.fd-draft'))).toBe(false);
  });

  it('removes itself and stops listening when destroyed', () => {
    const { host, form } = mount('survey');
    handle?.destroy();
    handle = null;
    expect(host.children).toHaveLength(0);
    expect(() => form.setValue('name', 'later')).not.toThrow();
  });
});
