import type { ButtonNode, Page, Part } from '@fieldia/core';
import type { FormActsPart } from '../../../core/src/lib/record/acts-later';

/**
 * What no page draws from comes in the acts part, asked for right after the whole check: a page's steps run (the form's
 * half), its dialogs and a page opened, its questions, a save over someone else's and the changes Reload set aside (the
 * viewer's half). A page is drawn whole without it. What comes before it — a press, a question, a conflict, a link's
 * dialog — is held: the control that asked busy, and done as the part lands (`withActs`, and the form's `runTop`). Where
 * it cannot come, nothing is done unasked: a press says so with Retry, "Discard your changes?" is asked by the browser's
 * own question, a conflict is said in plain words, a dialog that cannot open says so. This file starts with no part
 * loaded; every case has fresh modules, and the part comes, or fails, when the test lets it.
 */

/** The acts part as each case holds it: its load waits for `release`, then comes — or fails, for every ask then waiting, `failing` times. */
const mockHeld: { release?: () => void; failing: number; asked: number } = { failing: 0, asked: 0 };
jest.mock('../../../core/src/lib/record/acts-later', () => {
  const real = jest.requireActual<typeof import('../../../core/src/lib/record/acts-later')>('../../../core/src/lib/record/acts-later');
  let gate: Promise<void> | null = null;
  const held: Part<FormActsPart> = {
    name: 'acts',
    get loaded() {
      return gate === null ? real.formActsPart.loaded : undefined;
    },
    get coming() {
      return gate !== null;
    },
    asksAgain: true,
    load() {
      mockHeld.asked++;
      // One answer for every ask waiting as it is let go: it comes, or it fails.
      gate ??= new Promise<boolean>((resolve) => (mockHeld.release = () => resolve(mockHeld.failing > 0 && mockHeld.failing-- > 0))).then((fails) => {
        gate = null;
        if (fails) throw new Error('fieldia.acts.js could not be loaded');
      });
      return gate.then(() => real.formActsPart.load());
    },
  };
  return { ...real, formActsPart: held };
});

beforeEach(() => {
  jest.resetModules();
  Object.assign(mockHeld, { release: undefined, failing: 0, asked: 0 });
  document.body.replaceChildren();
});

/** A few turns of the event loop: what is not held settles. */
const settle = async () => {
  for (let turn = 0; turn < 8; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
};
async function until(check: () => unknown) {
  for (let waited = 0; !check(); waited += 10) {
    if (waited >= 2000) throw new Error(`Waited two seconds, and it never held: ${check.toString()}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const lead = (buttons: ButtonNode[] = []): Page => ({
  fieldia: '0.14',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name' },
    phone: { type: 'char', label: 'Phone' },
    note: { type: 'text', label: 'Note' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-phone', field: 'phone' },
      { type: 'field', id: 'f-note', field: 'note' },
      ...buttons,
    ],
  },
});
const companyPage: Page = {
  fieldia: '0.14',
  id: 'company',
  title: 'Company',
  data: { kind: 'record', model: 'company' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'c-name', field: 'name' }] },
};
const fill = (id: string): ButtonNode => ({ type: 'button', id, label: 'Fill', steps: [{ do: 'set', field: 'note', value: "'filled'" }] });

async function mount(page: Page, more: Record<string, unknown> = {}) {
  const { mountViewer } = await import('./viewer');
  const { createMemoryDataSource } = await import('@fieldia/core');
  const source = createMemoryDataSource({ records: { lead: { 1: { name: 'Villa', phone: '+201001234567' } }, company: { 3: { name: 'Nile Traders' } } }, versions: { by: 'Mona' } });
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page, dataSource: source, recordId: 1, relatedPages: { company: companyPage }, ...more });
  return { host, handle, source };
}
const button = (scope: ParentNode, words: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((one) => one.textContent?.trim() === words && !one.closest('[hidden]'));
const type = (host: Element, field: string, value: string) => {
  const input = host.querySelector(`[data-field="${field}"] input, [data-field="${field}"] textarea`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('the acts part: what no page draws from', () => {
  it('a page is drawn whole without it, and asks for it only once its whole check came', async () => {
    const { host, handle } = await mount(lead([fill('b-fill')]));
    expect(host.querySelector('[data-node="f-name"] input')).not.toBeNull();
    await handle.drawn;
    expect(mockHeld.asked).toBe(0);
    const { pageCheckPart } = await import('@fieldia/core');
    await until(() => mockHeld.asked > 0);
    expect(pageCheckPart.loaded).toBeDefined();
  });

  it("a press before it came: its button busy, then its steps run as it lands", async () => {
    const { host, handle } = await mount(lead([fill('b-fill')]));
    await handle.form.settled();
    const fillButton = button(host, 'Fill') as HTMLButtonElement;
    fillButton.click();
    await settle();
    expect(fillButton.getAttribute('aria-busy')).toBe('true');
    expect(handle.form.getState().values['note']).toBeNull();
    mockHeld.release?.();
    await until(() => handle.form.getState().values['note'] === 'filled');
    await until(() => !fillButton.hasAttribute('aria-busy'));
  });

  it("a press's question before it came: asked as it lands, the button busy meanwhile", async () => {
    const { host, handle } = await mount(lead([{ ...fill('b-fill'), confirm: 'Fill the note?' }]));
    await handle.form.settled();
    const fillButton = button(host, 'Fill') as HTMLButtonElement;
    fillButton.click();
    await settle();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(fillButton.getAttribute('aria-busy')).toBe('true');
    mockHeld.release?.();
    await until(() => document.querySelector('[role="alertdialog"]'));
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Fill the note?');
    button(document.querySelector('[role="alertdialog"]') as HTMLElement, 'Fill')?.click();
    await until(() => handle.form.getState().values['note'] === 'filled');
  });

  it('where it cannot come, a press does nothing and says so with Retry, which presses it again', async () => {
    const { host, handle } = await mount(lead([fill('b-fill')]));
    await handle.form.settled();
    mockHeld.failing = 1;
    const fillButton = button(host, 'Fill') as HTMLButtonElement;
    fillButton.click();
    await settle();
    mockHeld.release?.();
    await until(() => host.querySelector('.fd-say'));
    const said = host.querySelector('.fd-say') as HTMLElement;
    expect(said.textContent).toContain('This action could not load, so nothing was done. Try again.');
    expect(host.querySelectorAll('.fd-say')).toHaveLength(1);
    expect(handle.form.getState().values['note']).toBeNull();
    expect(fillButton.hasAttribute('aria-busy')).toBe(false);
    button(said, 'Retry')?.click();
    await settle();
    expect(fillButton.getAttribute('aria-busy')).toBe('true');
    mockHeld.release?.();
    await until(() => handle.form.getState().values['note'] === 'filled');
  });

  it("where it cannot come, a press's question is not asked: nothing done, said", async () => {
    const { host, handle } = await mount(lead([{ ...fill('b-fill'), confirm: 'Fill the note?' }]));
    await handle.form.settled();
    mockHeld.failing = 1;
    button(host, 'Fill')?.click();
    await settle();
    mockHeld.release?.();
    await until(() => host.querySelector('.fd-say'));
    expect(host.querySelector('.fd-say')?.textContent).toContain('This action could not load, so nothing was done. Try again.');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(handle.form.getState().values['note']).toBeNull();
  });

  it('"Discard your changes?" where it cannot come: the browser\'s own question, never discarded unasked', async () => {
    const asked: string[] = [];
    let answer = false;
    window.confirm = (message?: string) => (asked.push(String(message)), answer);
    const { host, handle } = await mount(lead());
    await handle.form.settled();
    type(host, 'name', 'Villa with garden');
    mockHeld.failing = 2;
    // A way out that counts every change (a dialog's ×): the change at risk, asked about first.
    const kept = handle.form.leave({ changes: true });
    await settle();
    mockHeld.release?.();
    expect(await kept).toBe(false);
    expect(asked).toEqual(['Discard your changes?']);
    expect(handle.form.getState().values['name']).toBe('Villa with garden');
    answer = true;
    const dropped = handle.form.leave({ changes: true });
    await settle();
    mockHeld.release?.();
    // Answered Discard: let go, as the box's Discard lets it go.
    expect(await dropped).toBe(true);
    expect(asked).toHaveLength(2);
  });

  it("someone else's save before it came: the conflict drawn as it lands, with Reload and Keep mine", async () => {
    const { host, handle, source } = await mount(lead());
    await handle.form.settled();
    type(host, 'phone', '+201009998887');
    source.changeElsewhere('lead', 1, { name: 'Villa (sold)' }, { by: 'Mona' });
    expect(await handle.save()).toBe(false);
    await settle();
    expect(host.querySelector('.fd-conflict:not([hidden])')).toBeNull();
    mockHeld.release?.();
    await until(() => host.querySelector('.fd-conflict:not([hidden]) [role="alert"]'));
    expect(host.querySelector('.fd-conflict')?.textContent).toMatch(/^Mona changed this record at .* They changed: Name\./);
    expect(button(host.querySelector('.fd-conflict') as HTMLElement, 'Keep mine')).toBeDefined();
  });

  it('a conflict where it cannot come: said in plain words, and over the page', async () => {
    const { host, handle, source } = await mount(lead());
    await handle.form.settled();
    type(host, 'phone', '+201009998887');
    source.changeElsewhere('lead', 1, { name: 'Villa (sold)' }, { by: 'Mona' });
    mockHeld.failing = 1;
    expect(await handle.save()).toBe(false);
    await settle();
    mockHeld.release?.();
    await until(() => host.querySelector('.fd-conflict:not([hidden])'));
    // Who, said plainly: the choice is the part's, and the page asks for a reload.
    expect(host.querySelector('.fd-conflict:not([hidden])')?.textContent).toBe('Mona changed this record after you opened it.');
    expect(host.querySelector('.fd-parts-unloaded:not([hidden])')?.textContent).toContain('Part of this page could not load');
    // What was typed is kept.
    expect(handle.form.getState().values['phone']).toBe('+201009998887');
  });

  it("a link's dialog before it came: opens as it lands; where it cannot come, says so and opens nothing", async () => {
    const { openFormDialog } = await import('./dialog');
    const opened = openFormDialog({ page: companyPage, title: 'Company', mode: 'values', values: { name: 'Nile' } });
    await settle();
    expect(document.querySelector('.fd-form-dialog')).toBeNull();
    mockHeld.release?.();
    await until(() => document.querySelector('.fd-form-dialog'));
    (document.querySelector('.fd-dialog-close') as HTMLElement).click();
    expect(await opened).toMatchObject({ saved: false });
    // And through a page's own link (its Search more…'s dialog's twin): said in the viewer's words, nothing opened.
    jest.resetModules();
    mockHeld.failing = 1;
    const { pageDialogs } = await import('./related');
    const said: string[] = [];
    const dialogs = pageDialogs({ page: lead(), relatedPages: { company: companyPage } } as never, (message) => said.push(message));
    const record = dialogs.openRecord?.('company', { recordId: 3, title: 'Nile Traders' });
    await settle();
    mockHeld.release?.();
    expect(await record).toBeNull();
    expect(said).toEqual(['This form could not be loaded.']);
    expect(document.querySelector('.fd-form-dialog')).toBeNull();
  });
});
