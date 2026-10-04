import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** The bar's checks, the Publish dialog with what changed, and earlier versions one click away. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page = blankPage('survey', 'Event feedback')) {
  const host = document.createElement('div');
  document.body.append(host);
  const store = createMemoryPageStore();
  const designer = createDesigner({ page, store });
  handle = mountSurveyEditor(host, { designer });
  return { host, designer, store };
}
const shown = (element: Element | null | undefined) => !!element && !element.closest('[hidden]');
const button = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && shown(b)) as HTMLButtonElement | undefined;
const nodes = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const checksButton = (host: Element) => host.querySelector('.fd-designer-bar [data-checks]') as HTMLButtonElement;

/** A survey with one question, named. */
function ready() {
  const mounted = mount();
  const q = mounted.designer.addQuestion('short-answer') as string;
  mounted.designer.updateQuestion(q, { label: 'Your name' });
  mounted.designer.select(null);
  return { ...mounted, q };
}

describe('checks in the bar', () => {
  it('counts what to look at, and says all clear when there is nothing', () => {
    const { host, designer } = ready();
    expect(checksButton(host).getAttribute('aria-label')).toBe('Checks: all clear');
    designer.addContainer('Page 2');
    expect(checksButton(host).getAttribute('aria-label')).toBe('Checks: 1 to look at');
    expect(checksButton(host).textContent).toContain('1');
  });

  it('lists each check with its fix, and the fix does it', () => {
    const { host, designer } = ready();
    designer.addContainer('Page 2');
    checksButton(host).click();
    const list = document.querySelector('.fd-checks') as HTMLElement;
    expect(list.querySelector('.fd-check-severity')?.textContent).toBe('Should fix');
    expect(list.querySelector('.fd-check-text')?.textContent).toBe('“Page 2” has no questions: people would see an empty page.');
    (button(list, 'Delete the page') as HTMLButtonElement).click();
    expect((designer.getPage().layout as WizardNode).children).toHaveLength(1);
    expect(document.querySelector('.fd-checks')).toBeNull();
    expect(checksButton(host).getAttribute('aria-label')).toBe('Checks: all clear');
  });

  // A dialog takes focus, so it is read; with nothing to fix it has no button, so it takes focus itself.
  it('all clear: the list takes focus, Escape gives it back, and it closes when focus leaves it', () => {
    const { host } = ready();
    const opener = checksButton(host);
    opener.focus();
    opener.click();
    const list = document.querySelector('.fd-checks') as HTMLElement;
    expect(document.activeElement).toBe(list);
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.fd-checks')).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.click();
    const again = document.querySelector('.fd-checks') as HTMLElement;
    const elsewhere = host.querySelector('.fd-designer-title') as HTMLElement;
    elsewhere.focus();
    again.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: elsewhere }));
    expect(document.querySelector('.fd-checks')).toBeNull();
    expect(opener.getAttribute('aria-expanded')).toBe('false');
  });

  it('takes the cursor to the words a check is about', () => {
    const { host, designer } = ready();
    const fresh = designer.addQuestion('short-answer') as string;
    designer.select(null);
    checksButton(host).click();
    (button(document.querySelector('.fd-checks') as HTMLElement, 'Type its words') as HTMLButtonElement).click();
    expect(designer.getState().selected).toBe(fresh);
    expect(document.activeElement).toBe(host.querySelector(`.fd-q[data-node="${fresh}"] .fd-q-label`));
  });
});

describe('publishing', () => {
  it('asks first, saying what goes out, then publishes the version', async () => {
    const { host } = ready();
    (button(host, 'Publish') as HTMLButtonElement).click();
    expect(dialog()?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.getElementById(dialog()?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Publish version 1?');
    expect([...(dialog()?.querySelectorAll('.fd-publish-changes li') ?? [])].map((li) => li.textContent)).toEqual(['The first version: 1 question on 1 page']);
    (button(dialog() as HTMLElement, 'Publish version 1') as HTMLButtonElement).click();
    await settle();
    expect(dialog()).toBeNull();
    expect(host.querySelector('.fd-designer-status')?.textContent).toBe('Published · version 1');
  });

  it('lists what changed since the last version, and Escape keeps editing', async () => {
    const { host, designer, q } = ready();
    await designer.publish();
    designer.updateQuestion(q, { label: 'Full name', required: true });
    (button(host, 'Publish') as HTMLButtonElement).click();
    expect([...(dialog()?.querySelectorAll('.fd-publish-changes li') ?? [])].map((li) => li.textContent)).toEqual(['Renamed “Your name” to “Full name”', '“Full name” is now required']);
    expect(dialog()?.textContent).toContain('Version 1 stays one click away');
    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog()).toBeNull();
    expect(designer.getState().versions).toHaveLength(1);
  });

  it('holds back a page with something that must be fixed, saying what, with its fix', () => {
    const { host, designer } = mount();
    void designer;
    (button(host, 'Publish') as HTMLButtonElement).click();
    expect(dialog()?.querySelector('.fd-publish-blocked')?.textContent).toContain('The survey has no questions yet, so there is nothing to answer.');
    expect(button(dialog() as HTMLElement, 'Publish version 1')).toBeUndefined();
  });
});

describe('earlier versions', () => {
  it('opens an earlier version as the draft, one click away, and Undo brings back what was there', async () => {
    const { host, designer, q } = ready();
    await designer.publish();
    designer.updateQuestion(q, { label: 'Full name' });
    await designer.publish();
    designer.updateQuestion(q, { label: 'Name, please' });
    (host.querySelector('.fd-designer-status') as HTMLButtonElement).click();
    const items = [...document.querySelectorAll<HTMLElement>('.fd-menu [role^="menuitem"]')];
    expect(items.map((i) => i.textContent?.replace(/\s+·.*$/, ''))).toEqual(['Version 2', 'Version 1']);
    items[1].click();
    const label = () => designer.getPage().fields[nodes(designer.getPage())[0].field].label;
    expect(label()).toBe('Your name');
    expect(host.querySelector('.fd-designer-status')?.textContent).toBe('Changes not published yet');
    (button(host, 'Undo') as HTMLButtonElement).click();
    expect(label()).toBe('Name, please');
  });
});
