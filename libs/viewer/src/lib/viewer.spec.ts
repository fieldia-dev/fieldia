import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, saveRefused, type DraftStore, type Page } from '@fieldia/core';
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
    button(host, 'Send my answers').click();
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

describe('a wizard’s own labels, skips and step list', () => {
  function mountSurvey(change: (layout: any) => void, options: Partial<ViewerOptions> = {}) {
    const p = page('survey');
    change(p.layout);
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: p, ...options });
    return { host, form: handle.form };
  }
  const stepTitle = (host: Element) => host.querySelector('.fd-step:not([hidden]) .fd-step-title')?.textContent;

  it('names its buttons as the page says, and shows a step’s icon', () => {
    const { host } = mountSurvey((layout) => {
      Object.assign(layout, { nextLabel: 'Continue', backLabel: 'Previous', finishLabel: 'Send my answers' });
      layout.children[0].icon = 'user';
    });
    expect(host.querySelector('.fd-step:not([hidden]) .fd-step-title svg')?.getAttribute('data-icon')).toBe('user');
    type(input(host, 'q-name'), 'Sara');
    button(host, 'Continue').click();
    expect(button(host, 'Previous')).toBeDefined();
    (at(host, 'q-uses').querySelectorAll('input[type=radio]')[1] as HTMLInputElement).click();
    button(host, 'Continue').click();
    type(input(host, 'q-reason'), 'Too expensive');
    button(host, 'Continue').click();
    expect(stepTitle(host)).toBe('Last thing');
    expect(button(host, 'Send my answers')).toBeDefined();
    expect(button(host, 'Continue')).toBeUndefined();
  });

  it('offers Skip on an optional step only, and passes it over', () => {
    const { host, form } = mountSurvey((layout) => {
      layout.children[1].optional = true;
    });
    expect(button(host, 'Skip')).toBeUndefined();
    type(input(host, 'q-name'), 'Sara');
    button(host, 'Next').click();
    expect(stepTitle(host)).toBe('Using the product');
    button(host, 'Skip').click();
    expect(stepTitle(host)).toBe('Last thing');
    expect(form.getState().skipped).toEqual(['step-usage']);
    expect(button(host, 'Skip')).toBeUndefined();
  });

  it('lists its steps to click when it is clickable: back at once, forward only past complete steps', () => {
    const { host } = mountSurvey((layout) => {
      layout.clickable = true;
    });
    const list = host.querySelector('nav.fd-steps') as HTMLElement;
    const steps = () => [...list.querySelectorAll('button')].filter((b) => visible(b));
    expect(steps().map((b) => b.textContent)).toEqual(['About you', 'Using the product', 'Last thing']);
    expect(steps()[0].getAttribute('aria-current')).toBe('step');
    steps()[2].click();
    expect(stepTitle(host)).toBe('About you');
    expect(visible(at(host, 'q-name').querySelector('.fd-error'))).toBe(true);
    type(input(host, 'q-name'), 'Sara');
    (steps()[1] as HTMLButtonElement).click();
    expect(stepTitle(host)).toBe('Using the product');
    expect(steps()[1].getAttribute('aria-current')).toBe('step');
    expect(steps()[0].classList.contains('fd-step-done')).toBe(true);
    steps()[0].click();
    expect(stepTitle(host)).toBe('About you');
  });

  it('shows no step list unless it is clickable', () => {
    const { host } = mountSurvey((layout) => {
      delete layout.clickable;
    });
    expect(host.querySelector('nav.fd-steps')).toBeNull();
  });
});

describe('keys', () => {
  const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));

  it('saves with Ctrl+Enter or Cmd+Enter, from a field still being typed in', async () => {
    const { host, form, dataSource } = sheet();
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    press(input(host, 'f-phone'), 'Enter', { ctrlKey: true });
    await form.settled();
    expect(dataSource.records['partner'][1]['phone']).toBe('+20 2 1111 2222');
    type(input(host, 'f-phone'), '+20 2 3333 4444');
    press(input(host, 'f-phone'), 'Enter', { metaKey: true });
    await form.settled();
    expect(dataSource.records['partner'][1]['phone']).toBe('+20 2 3333 4444');
  });

  it('keeps a tag typed but not yet added when Ctrl+Enter saves', async () => {
    const dataSource = createMemoryDataSource({ records: { project: { 1: { name: 'Office fit-out', materials: 'oak' } } } });
    const { host, form } = mount('fields', { dataSource, recordId: 1 });
    await form.settled();
    const tags = at(host, 'f-materials').querySelector('input') as HTMLInputElement;
    type(tags, 'steel');
    press(tags, 'Enter', { ctrlKey: true });
    await form.settled();
    expect(dataSource.records['project'][1]['materials']).toBe('oak, steel');
  });

  it('leaves Ctrl+Enter alone when the page turns it off, and a plain Enter in a text box to the text box', async () => {
    const { host, form, dataSource } = sheet({ keys: { saveWithCtrlEnter: false } });
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    expect(press(input(host, 'f-phone'), 'Enter', { ctrlKey: true })).toBe(true);
    await form.settled();
    expect(dataSource.calls.filter((c) => c.method === 'save')).toEqual([]);
    const fields = mount('fields', { keys: { enterMovesToNext: true } });
    const scope = at(fields.host, 'f-scope').querySelector('textarea') as HTMLTextAreaElement;
    expect(press(scope, 'Enter')).toBe(true); // not prevented: the line break is the text box's
  });

  it('moves to the next field on Enter when the page asks, without sending anything', async () => {
    const dataSource = createMemoryDataSource();
    const { host } = mount('signup', { dataSource, keys: { enterMovesToNext: true } });
    input(host, 'f-name').focus();
    expect(press(input(host, 'f-name'), 'Enter')).toBe(false);
    expect(document.activeElement).toBe(input(host, 'f-email'));
    press(input(host, 'f-email'), 'Enter');
    expect(document.activeElement).toBe(input(host, 'f-company'));
    await flush();
    expect(dataSource.responses).toEqual([]);
  });

  it('lets a field use Enter itself first: an open list picks, and the focus stays', async () => {
    const dataSource = createMemoryDataSource({ records: { partner: { 1: customer }, country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } } } });
    const { host, form } = mount('customer', { dataSource, recordId: 1, keys: { enterMovesToNext: true } });
    await form.settled();
    const country = at(host, 'f-country').querySelector('input') as HTMLInputElement;
    type(country, 'jor');
    await new Promise((resolve) => setTimeout(resolve, 260));
    press(country, 'ArrowDown');
    press(country, 'Enter');
    expect(form.getState().values['country_id']).toEqual({ id: 2, label: 'Jordan' });
    expect(document.activeElement).toBe(country);
  });

  it('takes what an app’s own field still holds before Ctrl+Enter saves', async () => {
    // An app's field that keeps what is typed until it changes, as many do.
    const later = ({ form, name, document: doc }: { form: { setValue(n: string, v: unknown): void }; name: string; document: Document }) => {
      const box = doc.createElement('input');
      box.addEventListener('change', () => form.setValue(name, box.value));
      return { element: box, update: () => undefined };
    };
    const p = page('customer');
    (p.layout as any).children[0].children.find((n: { id: string }) => n.id === 'f-phone').widget = 'later';
    const dataSource = createMemoryDataSource({ records: { partner: { 1: customer } } });
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: p, dataSource, recordId: 1, widgets: { 'char.later': later as never } });
    await handle.form.settled();
    const box = at(host, 'f-phone').querySelector('input') as HTMLInputElement;
    box.focus();
    box.value = '+20 2 9999 0000';
    press(box, 'Enter', { ctrlKey: true });
    await handle.form.settled();
    expect(dataSource.records['partner'][1]['phone']).toBe('+20 2 9999 0000');
  });

  it('leaves Enter in a table of lines to the table', () => {
    const { host, form } = mount('fields', { keys: { enterMovesToNext: true } });
    form.addLine('milestone_ids', { name: 'Site survey' });
    const cell = host.querySelector('[data-node="f-milestones"] input') as HTMLInputElement;
    cell.focus();
    expect(press(cell, 'Enter')).toBe(true);
    expect(document.activeElement).toBe(cell);
  });

  it('leaves the keys in an app’s own slot to it: Ctrl+Enter there saves nothing, Enter moves nowhere', async () => {
    let box: HTMLTextAreaElement | null = null;
    const { host, form, dataSource } = sheet({
      keys: { enterMovesToNext: true },
      slots: {
        chatter: (element) => {
          box = element.ownerDocument.createElement('textarea');
          const field = element.ownerDocument.createElement('input');
          element.append(box, field);
        },
      },
    });
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    const typed = box as unknown as HTMLTextAreaElement;
    typed.focus();
    expect(press(typed, 'Enter', { ctrlKey: true })).toBe(true);
    const field = host.querySelector('.fd-slot[data-slot="chatter"] input') as HTMLInputElement;
    field.focus();
    expect(press(field, 'Enter')).toBe(true);
    expect(document.activeElement).toBe(field);
    await form.settled();
    expect(dataSource.calls.filter((c) => c.method === 'save')).toEqual([]);
  });

  it('does not move on Enter unless asked', () => {
    const { host } = mount('signup');
    input(host, 'f-name').focus();
    press(input(host, 'f-name'), 'Enter');
    expect(document.activeElement).toBe(input(host, 'f-name'));
  });
});

describe('a ✓ on a valid field', () => {
  const marked = (host: Element, id: string) => at(host, id).classList.contains('fd-valid') && visible(at(host, id).querySelector('.fd-valid-mark'));

  it('marks a field once the person has filled it in right, and takes the mark away when it goes wrong', () => {
    const { host } = mount('signup', { showValid: true });
    expect(marked(host, 'f-name')).toBe(false); // nothing typed yet
    type(input(host, 'f-name'), 'Sara Hassan');
    expect(marked(host, 'f-name')).toBe(true);
    type(input(host, 'f-email'), 'sara@');
    expect(marked(host, 'f-email')).toBe(false);
    type(input(host, 'f-email'), 'sara@example.com');
    expect(marked(host, 'f-email')).toBe(true);
    type(input(host, 'f-name'), '');
    expect(marked(host, 'f-name')).toBe(false);
  });

  it('marks no field the person has not touched, however right its value', async () => {
    const { host, form } = sheet({ showValid: true });
    await form.settled();
    expect(input(host, 'f-email').value).not.toBe('');
    expect(marked(host, 'f-email')).toBe(false);
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    expect(marked(host, 'f-phone')).toBe(true);
  });

  it('marks nothing unless the page asks', () => {
    const { host } = mount('signup');
    type(input(host, 'f-name'), 'Sara Hassan');
    expect(marked(host, 'f-name')).toBe(false);
    expect(at(host, 'f-name').querySelector('.fd-valid-mark')).toBeNull();
  });

  it('marks no yes/no box: a tick there would say nothing', () => {
    const { host } = mount('signup', { showValid: true });
    (input(host, 'f-newsletter') as HTMLInputElement).click();
    expect(marked(host, 'f-newsletter')).toBe(false);
  });
});

describe('a refused save', () => {
  /** The customer sheet over a source whose save fails as told until it is let through. */
  function refusing(failure: () => unknown, options: Partial<ViewerOptions> = {}) {
    const memory = createMemoryDataSource({ records: { partner: { 1: customer } } });
    let fail = true;
    const dataSource = { ...memory, load: memory.load, save: async (r: Parameters<NonNullable<typeof memory.save>>[0]) => {
      if (fail) throw failure();
      return memory.save!(r);
    } };
    const mounted = mount('customer', { dataSource, recordId: 1, ...options });
    return { ...mounted, memory, letThrough: () => (fail = false) };
  }
  const announced = (host: Element) => host.querySelector('.fd-announce')?.textContent ?? '';
  const statusText = (host: Element) => host.querySelector('.fd-status')?.textContent ?? '';

  it('puts a server’s field errors under their fields, names them beside Save, and announces it', async () => {
    const { host, form } = refusing(() => saveRefused({ kind: 'fields', message: 'Check the email', fields: { email: 'This email is taken' } }));
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    button(host, 'Save').click();
    await form.settled();
    await flush();
    const error = at(host, 'f-email').querySelector('.fd-error') as HTMLElement;
    expect(visible(error)).toBe(true);
    expect(error.textContent).toBe('This email is taken');
    expect(error.getAttribute('role')).toBeNull();
    expect(statusText(host)).toBe('Not saved. Check: Email');
    expect(announced(host)).toBe('Not saved. Check: Email');
    // Said once, by the announcer: the status beside Save shows it, and keeps quiet.
    expect(host.querySelector('.fd-status')?.getAttribute('aria-live')).toBe('off');
    // Nothing to retry: the fields have to change first.
    expect(button(host.querySelector('.fd-status-box') as HTMLElement, 'Retry')).toBeUndefined();
    expect(host.querySelector('.fd-announce')?.getAttribute('aria-live')).toBe('assertive');
    expect(document.activeElement).toBe(input(host, 'f-email'));
  });

  it('shows a business rule in a dialog', async () => {
    const { host, form } = refusing(() => saveRefused({ kind: 'rule', message: 'A blocked customer cannot be given credit.' }));
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    button(host, 'Save').focus();
    button(host, 'Save').click();
    // Hidden while it saves, Save lets go of focus, as a browser does: the notice still brings it back there.
    (document.activeElement as HTMLElement).blur();
    await form.settled();
    await flush();
    const notice = document.querySelector('[role=alertdialog]') as HTMLElement;
    expect(notice.textContent).toContain('A blocked customer cannot be given credit.');
    expect(statusText(host)).toBe('Not saved');
    // Modal: Tab stays on its one button, and Escape closes it, focus going back to Save.
    const ok = button(notice, 'OK');
    expect(document.activeElement).toBe(ok);
    ok.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(ok);
    ok.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[role=alertdialog]')).toBeNull();
    expect(document.activeElement).toBe(button(host, 'Save'));
  });

  it('shows a network failure in a banner with Retry, and Retry saves again', async () => {
    const { host, form, memory, letThrough } = refusing(() => new TypeError('Failed to fetch'));
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    button(host, 'Save').click();
    await form.settled();
    await flush();
    const banner = host.querySelector('.fd-banner') as HTMLElement;
    expect(visible(banner)).toBe(true);
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('Could not reach the server. Your changes are still here.');
    letThrough();
    button(banner, 'Retry').click();
    await form.settled();
    await flush();
    expect(memory.records['partner'][1]['phone']).toBe('+20 2 1111 2222');
    expect(visible(banner)).toBe(false);
  });

  it('shows any other failure beside Save, with Retry', async () => {
    const { host, form, letThrough } = refusing(() => new Error('The server said no'));
    await form.settled();
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    button(host, 'Save').click();
    await form.settled();
    await flush();
    expect(statusText(host)).toBe('The server said no');
    expect(announced(host)).toBe('The server said no');
    letThrough();
    button(host.querySelector('.fd-status-box') as HTMLElement, 'Retry').click();
    await form.settled();
    await flush();
    expect(statusText(host)).toBe('Saved');
    // How a save goes is said politely by the status itself.
    expect(host.querySelector('.fd-status')?.getAttribute('aria-live')).toBe('polite');
    expect(button(host.querySelector('.fd-status-box') as HTMLElement, 'Retry')).toBeUndefined();
  });

  it('announces a send the page’s own checks stop, naming the fields', async () => {
    const { host, form } = mount('signup', { dataSource: createMemoryDataSource() });
    button(host, 'Submit').click();
    await form.settled();
    await flush();
    expect(announced(host)).toBe('Not sent. Check: Full name, Email, Your role');
  });

  it('shows the status as a toast or as a bar when asked', async () => {
    const toast = sheet({ saveStatus: 'toast' });
    await toast.form.settled();
    expect(toast.host.querySelector('.fd-status-box')?.classList.contains('fd-toast')).toBe(true);
    expect(toast.host.querySelector('.fd-status')?.closest('.fd-header')).toBeNull();
    toast.host.remove();
    const bar = sheet({ saveStatus: 'bar' });
    await bar.form.settled();
    const status = bar.host.querySelector('.fd-status-box') as HTMLElement;
    expect(status.classList.contains('fd-status-bar')).toBe(true);
    expect(bar.host.querySelector('.fd-content')?.firstElementChild).toBe(status);
  });
});

describe('a page in the app’s own words', () => {
  const catalog: Record<string, string> = { 'Full name': 'Nom complet', 'About you': 'À propos de vous', Submit: 'Envoyer' };
  const translate = (text: string) => catalog[text] ?? text;

  it('shows the page’s words through the app’s translator, in its messages too, and never the data', async () => {
    const dataSource = createMemoryDataSource();
    const { host, form } = mount('signup', { dataSource, translate });
    expect(at(host, 'f-name').querySelector('.fd-label')?.textContent).toBe('Nom complet');
    expect(at(host, 'about').querySelector('legend')?.textContent).toBe('À propos de vous');
    type(input(host, 'f-company'), 'Full name');
    expect(input(host, 'f-company').value).toBe('Full name');
    button(host, 'Submit').click();
    await form.settled();
    expect(at(host, 'f-name').querySelector('.fd-error')?.textContent).toBe('Nom complet is required');
  });

  it('opens related records in dialogs in the same words', async () => {
    const dataSource = createMemoryDataSource({ records: { partner: { 1: customer } } });
    const { host, form } = mount('fields', { dataSource, translate: (t) => (t === 'Name' ? 'Nom' : t), relatedPages: { partner: page('customer') } });
    form.setValue('client_id', { id: 1, label: 'Nile Traders' });
    await flush();
    (at(host, 'f-client').querySelector('button.fd-combo-open') as HTMLButtonElement).click();
    await flush();
    const dialog = document.querySelector('.fd-form-dialog') as HTMLElement;
    expect(dialog.querySelector('[data-node="#title"] .fd-label')?.textContent).toBe('Nom');
  });
});

describe('a read-only form', () => {
  const title = (host: Element) => host.querySelector('[data-node="#title"] input') as HTMLInputElement;

  it('shows every field read-only when asked, with no Save and a statusbar that cannot be clicked, until switched', async () => {
    const { host, form, handle } = sheet({ readonly: true });
    await form.settled();
    expect(input(host, 'f-phone').readOnly).toBe(true);
    expect(title(host).readOnly).toBe(true);
    expect(host.querySelectorAll('.fd-statusbar button:not([disabled])')).toHaveLength(0);
    expect(handle.isReadonly()).toBe(true);
    // Actions still run in a read-only record, as in Odoo.
    expect(button(host, 'Block')).toBeDefined();
    // A change from the app's own code offers no Save while the record is locked.
    form.setValue('phone', '+20 2 1111 2222');
    expect(button(host, 'Save')).toBeUndefined();
    handle.setReadonly(false);
    expect(input(host, 'f-phone').readOnly).toBe(false);
    expect(host.querySelectorAll('.fd-statusbar button:not([disabled])').length).toBeGreaterThan(0);
    expect(handle.isReadonly()).toBe(false);
  });

  it('offers Edit and Done when asked: Done saves first, and stays editing when the save is refused', async () => {
    const { host, form, dataSource } = sheet({ readonly: true, editSwitch: true });
    await form.settled();
    expect(button(host, 'Done')).toBeUndefined();
    button(host, 'Edit').click();
    expect(input(host, 'f-phone').readOnly).toBe(false);
    type(input(host, 'f-phone'), '+20 2 1111 2222');
    button(host, 'Done').click();
    await form.settled();
    await flush();
    expect(dataSource.records['partner'][1]['phone']).toBe('+20 2 1111 2222');
    expect(input(host, 'f-phone').readOnly).toBe(true);
    button(host, 'Edit').click();
    type(title(host), '');
    button(host, 'Done').click();
    await form.settled();
    await flush();
    expect(button(host, 'Done')).toBeDefined();
    expect(title(host).readOnly).toBe(false);
  });

  it('leaves a form editable, with no switch, unless asked', async () => {
    const { host, form } = sheet();
    await form.settled();
    expect(input(host, 'f-phone').readOnly).toBe(false);
    expect(button(host, 'Edit')).toBeUndefined();
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
    expect(input(host, 'f-ticket').value).toBe('1,500.00');
    expect(at(host, 'f-ticket').querySelector('.fd-currency')?.textContent).toBe('E£');
  });

  it('moves focus to the first problem when submitting fails', async () => {
    const { host } = mount('signup', { dataSource: createMemoryDataSource() });
    button(host, 'Submit').click();
    await flush();
    expect(document.activeElement).toBe(input(host, 'f-name'));
  });

  it('hands every widget the page’s preference store, the browser’s when none is given', () => {
    const seen: unknown[] = [];
    const spy = (context: { preferences?: unknown; document: Document }) => {
      seen.push(context.preferences);
      return { element: context.document.createElement('div'), update: () => undefined };
    };
    const store = { get: () => null, set: () => undefined };
    const signup = page('signup');
    (signup.layout as any).children[0].children.find((n: any) => n.id === 'f-name').widget = 'spy';
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    mountViewer(host, { page: signup, widgets: { 'char.spy': spy as any }, preferences: store }).destroy();
    expect(seen[0]).toBe(store);
    mountViewer(host, { page: signup, widgets: { 'char.spy': spy as any } }).destroy();
    expect(typeof (seen[1] as { get?: unknown })?.get).toBe('function');
  });

  it('a header statusbar on a read-only field cannot be clicked', () => {
    const customer = page('customer') as any;
    customer.fields.state.readonly = true;
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const viewer = mountViewer(host, { page: customer });
    const buttons = [...host.querySelectorAll('.fd-header .fd-statusbar button')] as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(1);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    viewer.destroy();
  });

  it('writes numbers the way readers of the page’s language write them', () => {
    const { host, form } = mount('signup', { locale: 'de' });
    form.setValue('hourly_rate', 1234.5);
    expect(input(host, 'f-rate').value).toBe('1.234,50');
    expect(input(host, 'f-ticket').value).toBe('1.500,00');
  });

  it('lets a widget that knows where its problem is take the focus there', async () => {
    const signup = page('signup');
    const name = (signup.layout as any).children[0].children.find((n: any) => n.id === 'f-name');
    name.widget = 'own';
    let inner: HTMLButtonElement | null = null;
    const own = ({ document: doc }: { document: Document }) => {
      const box = doc.createElement('div');
      const first = doc.createElement('button');
      inner = doc.createElement('button');
      box.append(first, inner);
      box.addEventListener('fd-focus-problem', (event) => {
        event.preventDefault();
        inner?.focus();
      });
      return { element: box, update: (state: { invalid: boolean }) => box.setAttribute('aria-invalid', String(state.invalid)) };
    };
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const handle = mountViewer(host, { page: signup, dataSource: createMemoryDataSource(), widgets: { 'char.own': own as any } });
    button(host, 'Submit').click();
    await flush();
    expect(document.activeElement).toBe(inner);
    handle.destroy();
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
    expect((host.querySelector('[data-node="#title"] input') as HTMLInputElement).value).toBe('Nile Traders');
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

  it('opens the first tab that is visible once the record loads, until someone picks one', async () => {
    const { host, form } = sheet();
    await form.settled();
    const selected = () => host.querySelector('[role=tab][aria-selected="true"]')?.textContent;
    expect(selected()).toBe('Contacts'); // hidden while loading, shown once is_company arrives
    ([...host.querySelectorAll('[role=tab]')].find((t) => t.textContent === 'Notes') as HTMLElement).click();
    form.setValue('website', 'https://x.example');
    expect(selected()).toBe('Notes');
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

  it('shows an onchange warning under the field that changed, and clears it', async () => {
    const dataSource = createMemoryDataSource({ records: { partner: { 1: customer } } });
    dataSource.onchange = async ({ changed, values }) =>
      changed === 'credit_limit' && Number(values['credit_limit']) > 100000 ? { warning: 'Above the approval limit' } : {};
    const { host, form } = mount('customer', { dataSource, recordId: 1 });
    await form.settled();
    (host.querySelector('.fd-tab[data-node="tab-billing"]') as HTMLButtonElement).click();
    type(input(host, 'f-credit-limit'), '250000');
    input(host, 'f-credit-limit').dispatchEvent(new Event('change', { bubbles: true }));
    await form.settled();
    await flush();
    const warning = at(host, 'f-credit-limit').querySelector('.fd-warning') as HTMLElement;
    expect(visible(warning)).toBe(true);
    expect(warning.textContent).toBe('Above the approval limit');
    expect(warning.getAttribute('role')).toBe('status');
    type(input(host, 'f-credit-limit'), '5000');
    input(host, 'f-credit-limit').dispatchEvent(new Event('change', { bubbles: true }));
    await form.settled();
    await flush();
    expect(visible(at(host, 'f-credit-limit').querySelector('.fd-warning'))).toBe(false);
  });

  it('shows the avatar beside the title', async () => {
    const { host, form } = sheet();
    await form.settled();
    form.setValue('image', { name: 'logo.png', type: 'image/png', size: 3, url: 'https://cdn.example/logo.png' });
    expect((host.querySelector('.fd-title-row .fd-avatar img') as HTMLImageElement).src).toBe('https://cdn.example/logo.png');
  });

  it('hands the side panel to the app', async () => {
    const { host, form } = sheet({ slots: { chatter: (el) => void (el.textContent = 'Activity feed') } });
    await form.settled();
    expect(host.querySelector('.fd-slot[data-slot="chatter"]')?.textContent).toBe('Activity feed');
  });
});

describe('the parts of a sheet', () => {
  function mountCustomer(change: (layout: any) => void) {
    const p = page('customer');
    change(p.layout);
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: p });
    return { host, form: handle.form };
  }
  const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('shows badges over the title, each with its tone and icon, each by its condition', () => {
    const { host, form } = mountCustomer((layout) => {
      layout.badges = [
        { id: 'b-company', label: 'Company', tone: 'info', icon: 'building', invisible: 'not is_company' },
        { id: 'b-blocked', label: 'Blocked', tone: 'danger', invisible: "state != 'blocked'" },
      ];
    });
    const company = at(host, 'b-company');
    expect(company.closest('.fd-badges')).not.toBeNull();
    expect(company.textContent).toBe('Company');
    expect(company.classList.contains('fd-tone-info')).toBe(true);
    expect(company.querySelector('svg')?.getAttribute('data-icon')).toBe('building');
    expect(follows(company, host.querySelector('[data-node="#title"] input')!)).toBe(true);
    expect(visible(company)).toBe(false); // a new record is not a company yet
    form.setValue('is_company', true);
    expect(visible(company)).toBe(true);
    expect(visible(at(host, 'b-blocked'))).toBe(false);
  });

  it('lets a dismissible alert be closed, and keeps it closed until the page opens again', () => {
    const { host, form } = mountCustomer((layout) => {
      layout.alerts[0].dismissible = true;
    });
    form.setValue('over_limit', true);
    const alert = at(host, 'over-limit');
    expect(visible(alert)).toBe(true);
    const close = alert.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement;
    close.click();
    expect(visible(alert)).toBe(false);
    form.setValue('over_limit', false);
    form.setValue('over_limit', true);
    expect(visible(alert)).toBe(false);
  });

  it('gives an alert no × unless it may be dismissed', () => {
    const { host, form } = mountCustomer((layout) => {
      delete layout.alerts[0].dismissible;
    });
    form.setValue('over_limit', true);
    expect(at(host, 'over-limit').querySelector('button')).toBeNull();
  });

  it('shows fields over and under the title, in that order', () => {
    const { host } = mountCustomer((layout) => {
      layout.title.above = [{ type: 'field', id: 't-company', field: 'is_company' }];
      layout.title.below = [{ type: 'field', id: 't-website', field: 'website' }];
    });
    const title = host.querySelector('[data-node="#title"] input') as HTMLElement;
    expect(at(host, 't-company').closest('.fd-title-above')).not.toBeNull();
    expect(at(host, 't-website').closest('.fd-title-below')).not.toBeNull();
    expect(follows(at(host, 't-company'), title)).toBe(true);
    expect(follows(title, at(host, 't-website'))).toBe(true);
  });

  it('puts the statusbar under the title when asked, leaving the header its buttons', () => {
    const { host } = mountCustomer((layout) => {
      layout.statusbar.position = 'title';
    });
    expect(host.querySelector('.fd-header .fd-statusbar')).toBeNull();
    const bar = host.querySelector('.fd-card .fd-statusbar') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(follows(host.querySelector('[data-node="#title"] input')!, bar)).toBe(true);
    expect(button(host, 'Activate').closest('.fd-header')).not.toBeNull();
  });
});

describe('a record laid out in sections', () => {
  it('offers Save and Discard only once something changes, as a sheet does', async () => {
    const dataSource = createMemoryDataSource({ records: { project: { 1: { name: 'Office fit-out', seats: 48 } } } });
    const { host, form } = mount('fields', { dataSource, recordId: 1 });
    await form.settled();
    expect(button(host, 'Save')).toBeUndefined();
    expect(button(host, 'Discard')).toBeUndefined();
    type(input(host, 'f-seats'), '52');
    expect(button(host, 'Save')).toBeDefined();
    button(host, 'Discard').click();
    await flush();
    expect(input(host, 'f-seats').value).toBe('48');
    expect(button(host, 'Save')).toBeUndefined();
  });
});

describe('collapsible sections', () => {
  const folding: Page = {
    fieldia: '0.1',
    id: 'fold',
    title: 'Delivery',
    data: { kind: 'responses' },
    fields: {
      address: { type: 'char', label: 'Address' },
      gate: { type: 'char', label: 'Gate code', required: true },
    },
    layout: {
      type: 'sections',
      id: 'sections',
      children: [
        { type: 'section', id: 'main', title: 'Where', children: [{ type: 'field', id: 'f-address', field: 'address' }] },
        { type: 'section', id: 'more', title: 'Access details', collapsible: true, collapsed: true, children: [{ type: 'field', id: 'f-gate', field: 'gate' }] },
      ],
    },
  };
  function mountFolding(changes: Partial<Page> = {}) {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: { ...folding, ...changes }, dataSource: createMemoryDataSource() });
    return host;
  }
  const toggle = (host: Element) => at(host, 'more').querySelector('.fd-section-toggle') as HTMLButtonElement;

  it('folds and unfolds from its title, and says which it is', () => {
    const host = mountFolding();
    expect(toggle(host).getAttribute('aria-expanded')).toBe('false');
    expect(visible(input(host, 'f-gate'))).toBe(false);
    toggle(host).click();
    expect(toggle(host).getAttribute('aria-expanded')).toBe('true');
    expect(visible(input(host, 'f-gate'))).toBe(true);
    expect(document.getElementById(toggle(host).getAttribute('aria-controls') as string)?.contains(input(host, 'f-gate'))).toBe(true);
    toggle(host).click();
    expect(visible(input(host, 'f-gate'))).toBe(false);
  });

  it('starts open unless it is marked collapsed, and a plain section has no toggle', () => {
    const host = mountFolding();
    expect(at(host, 'main').querySelector('.fd-section-toggle')).toBeNull();
    handle?.destroy();
    document.body.replaceChildren();
    const open = mountFolding({
      layout: { ...folding.layout, children: [{ ...(folding.layout as any).children[1], collapsed: undefined }] } as Page['layout'],
    });
    expect(toggle(open).getAttribute('aria-expanded')).toBe('true');
    expect(visible(input(open, 'f-gate'))).toBe(true);
  });

  it('opens a folded section when one of its fields stops the answers being sent', async () => {
    const host = mountFolding();
    button(host, 'Submit').click();
    await flush();
    expect(toggle(host).getAttribute('aria-expanded')).toBe('true');
    expect(visible(input(host, 'f-gate'))).toBe(true);
    expect(document.activeElement).toBe(input(host, 'f-gate'));
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

  it('speaks the page language: labels, messages and direction', () => {
    const { host } = mount('survey', { locale: 'ar' });
    expect(host.querySelector('.fd-form')?.getAttribute('dir')).toBe('rtl');
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('الخطوة 1 من 3');
    button(host, 'التالي').click();
    expect(at(host, 'q-name').querySelector('.fd-error')?.textContent).toBe('Your name مطلوب');
  });

  it('lets labels passed in win over the language defaults', () => {
    const { host } = mount('survey', { locale: 'de', labels: { next: 'Los' } });
    expect(button(host, 'Los')).toBeDefined();
    expect(host.querySelector('.fd-progress-text')?.textContent).toBe('Schritt 1 von 3');
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

describe('icons', () => {
  function mountPage(p: Page, options: Partial<ViewerOptions> = {}) {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: p, ...options });
    return host;
  }
  const iconOf = (el: Element | null) => el?.querySelector('svg.fd-icon')?.getAttribute('data-icon') ?? null;

  it('draws the icons a page names on its sections, tabs, buttons and stat buttons, beside their words', () => {
    const p = page('customer');
    const layout = p.layout as any;
    Object.assign(layout.children[0], { title: 'Contact', icon: 'user' });
    layout.children[1].children[1].icon = 'money';
    layout.buttons[0].icon = 'check';
    const host = mountPage(p);
    expect(iconOf(at(host, 'main').querySelector('legend'))).toBe('user');
    expect(at(host, 'main').querySelector('legend')?.textContent).toBe('Contact');
    expect(iconOf(host.querySelector('[role=tab][data-node="tab-billing"]'))).toBe('money');
    expect(iconOf(at(host, 'activate'))).toBe('check');
    expect(at(host, 'activate').textContent).toBe('Activate');
    expect(iconOf(at(host, 'sales'))).toBe('cart');
    expect(iconOf(at(host, 'invoices'))).toBe('receipt');
    // No icon named, none drawn.
    expect(iconOf(host.querySelector('[role=tab][data-node="tab-notes"]'))).toBeNull();
  });

  it('draws an app’s own icons, and nothing for a name no one has', () => {
    const p = page('customer');
    const layout = p.layout as any;
    Object.assign(layout.children[0], { title: 'Contact', icon: 'rocket' });
    layout.children[1].children[1].icon = 'no-such-icon';
    const host = mountPage(p, { icons: { rocket: '<path d="M12 2v20"/>' } });
    expect(iconOf(at(host, 'main').querySelector('legend'))).toBe('rocket');
    expect(host.querySelector('[role=tab][data-node="tab-billing"] svg')).toBeNull();
  });

  it('draws a collapsible section’s icon inside the button that folds it', () => {
    const p = page('signup');
    Object.assign((p.layout as any).children[1], { collapsible: true, icon: 'building' });
    const host = mountPage(p);
    expect(iconOf(host.querySelector('[data-node="work"] .fd-section-toggle'))).toBe('building');
  });
});

describe('columns per width', () => {
  it('hands the counts for narrower widths to the stylesheet, and only those given', () => {
    const p = page('signup');
    (p.layout as any).children[0].columns = { wide: 3, medium: 2 };
    (p.layout as any).children[1].columns = 2;
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: p });
    const about = at(host, 'about').querySelector('.fd-grid') as HTMLElement;
    expect(about.style.getPropertyValue('--fd-columns')).toBe('3');
    expect(about.getAttribute('data-columns-medium')).toBe('2');
    expect(about.style.getPropertyValue('--fd-columns-medium')).toBe('2');
    expect(about.hasAttribute('data-columns-narrow')).toBe(false);
    const work = at(host, 'work').querySelector('.fd-grid') as HTMLElement;
    expect(work.style.getPropertyValue('--fd-columns')).toBe('2');
    expect(work.hasAttribute('data-columns-medium')).toBe(false);
  });
});

describe('a page’s width and where its Save sits', () => {
  function mountPage(p: Page) {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: p });
    return host;
  }
  const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('puts a sections page’s Save above its sections when asked, and below them by default', () => {
    const below = mountPage(page('signup'));
    expect(before(below.querySelector('.fd-sections')!, below.querySelector('.fd-actions')!)).toBe(true);
    below.remove();
    const p = page('signup');
    p.actionsPosition = 'top';
    const host = mountPage(p);
    expect(before(host.querySelector('.fd-actions')!, host.querySelector('.fd-sections')!)).toBe(true);
    expect(host.querySelector('.fd-actions')?.classList.contains('fd-actions-top')).toBe(true);
  });

  it('puts a sheet’s Save and Discard at the foot of the sheet when asked, its buttons staying in the header', async () => {
    const p = page('customer');
    p.actionsPosition = 'bottom';
    const host = mountPage(p);
    type(input(host, 'f-phone'), '+20 2 0000 0000');
    await flush();
    const save = button(host, 'Save');
    expect(save).toBeDefined();
    expect(save.closest('.fd-header')).toBeNull();
    expect(save.closest('.fd-card')).not.toBeNull();
    expect(button(host, 'Discard').closest('.fd-sheet-foot')).not.toBeNull();
    expect(button(host, 'Block').closest('.fd-header')).not.toBeNull();
  });

  it('hands the page’s width to the stylesheet', () => {
    const p = page('signup');
    p.maxWidth = 'narrow';
    expect(mountPage(p).querySelector('.fd-form')?.getAttribute('data-max-width')).toBe('narrow');
    expect(mountPage(page('signup')).querySelector('.fd-form')?.hasAttribute('data-max-width')).toBe(false);
  });
});

describe('related records in dialogs', () => {
  const people = () =>
    createMemoryDataSource({
      records: {
        project: { 1: { name: 'Fit-out', client_id: { id: 1, label: 'Nile Traders' } } },
        partner: { 1: { name: 'Nile Traders', is_company: true, state: 'active' } },
      },
    });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 250));
  const formDialog = () => document.querySelector('.fd-form-dialog') as HTMLElement | null;

  async function mountProject() {
    const dataSource = people();
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const viewer = mountViewer(host, { page: page('fields'), dataSource, recordId: 1, relatedPages: { partner: page('customer') } });
    await viewer.form.settled();
    return { host, viewer, dataSource, client: at(host, 'f-client').querySelector('input') as HTMLInputElement };
  }

  it('makes a new client in its own page, from the name typed, and links it', async () => {
    const { host, viewer, dataSource, client } = await mountProject();
    client.focus();
    client.value = 'Hilton Cairo';
    client.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    ([...at(host, 'f-client').querySelectorAll('[role="option"]')].find((o) => o.textContent === 'Create and edit…') as HTMLElement).click();
    await settle();
    const title = formDialog()?.querySelector('[data-node="#title"] input') as HTMLInputElement;
    expect(title.value).toBe('Hilton Cairo');
    ([...(formDialog()?.querySelectorAll('.fd-form-dialog-foot button') ?? [])].find((b) => b.textContent === 'Save & Close') as HTMLButtonElement).click();
    await settle();
    expect(formDialog()).toBeNull();
    expect(viewer.form.getState().values['client_id']).toEqual({ id: 2, label: 'Hilton Cairo' });
    expect(dataSource.records['partner'][2]).toEqual(expect.objectContaining({ name: 'Hilton Cairo' }));
    viewer.destroy();
  });

  it('opens the linked client, and a new name it is saved with follows back', async () => {
    const { host, viewer, dataSource } = await mountProject();
    (at(host, 'f-client').querySelector('button[aria-label="Open Nile Traders"]') as HTMLButtonElement).click();
    await settle();
    const title = formDialog()?.querySelector('[data-node="#title"] input') as HTMLInputElement;
    expect(title.value).toBe('Nile Traders');
    title.value = 'Nile Traders Ltd';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    ([...(formDialog()?.querySelectorAll('.fd-form-dialog-foot button') ?? [])].find((b) => b.textContent === 'Save & Close') as HTMLButtonElement).click();
    await settle();
    expect(viewer.form.getState().values['client_id']).toEqual({ id: 1, label: 'Nile Traders Ltd' });
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders Ltd');
    viewer.destroy();
  });
});
