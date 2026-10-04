import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { jsonView, type JsonView } from './json-view';
import { tryIt, type TryIt } from './try-it';

let view: JsonView | null = null;
let trial: TryIt | null = null;
afterEach(() => {
  view?.destroy();
  trial?.destroy();
  view = trial = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});

function setup() {
  jest.useFakeTimers();
  const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
  const coming = designer.addQuestion('yes-no') as string;
  designer.updateQuestion(coming, { label: 'Coming?' });
  const why = designer.addQuestion('paragraph') as string;
  designer.updateQuestion(why, { label: 'Why not?' });
  const el = elementFactory(document);
  const body = el('div', { class: 'body' });
  trial = tryIt({ el, doc: document, designer, skin: 'outlined', onChange: (trying) => (body.hidden = trying) });
  view = jsonView({ el, doc: document, designer, trial, body });
  document.body.append(trial.toggle, body, trial.element, view.element);
  const button = (mode: string) => trial?.toggle.querySelector(`button[data-mode="${mode}"]`) as HTMLButtonElement;
  const box = () => view?.element.querySelector('textarea') as HTMLTextAreaElement;
  const type = (text: string) => {
    box().value = text;
    box().dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(400);
  };
  const named = (words: string) => [...(view?.element.querySelectorAll('button') ?? [])].find((b) => b.textContent === words && !b.closest('[hidden]')) as HTMLButtonElement | undefined;
  const rows = () => [...(view?.element.querySelectorAll('.fd-json-problem') ?? [])].map((li) => li.textContent);
  const node = (page: Page, id: string) => (page.layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode;
  return { designer, coming, why, body, button, box, type, named, rows, node };
}

const key = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('the JSON view', () => {
  it('sits beside Design and Try it, and shows the page as JSON in place of the editor', () => {
    const { designer, body, button, box } = setup();
    expect(view?.element.hidden).toBe(true);
    button('json').click();
    expect(view?.open).toBe(true);
    expect(body.hidden).toBe(true);
    expect(view?.element.hidden).toBe(false);
    expect(button('json').getAttribute('aria-pressed')).toBe('true');
    expect(button('design').getAttribute('aria-pressed')).toBe('false');
    expect(box().value).toBe(designer.pageJson());
    expect(view?.element.querySelector('.fd-json-gutter')?.textContent?.split('\n').length).toBe(designer.pageJson().split('\n').length);
    button('design').click();
    expect(view?.open).toBe(false);
    expect(body.hidden).toBe(false);
    expect(button('design').getAttribute('aria-pressed')).toBe('true');
  });

  it('applies a change typed in the text as one edit, from the button or with Ctrl+Enter', () => {
    const { designer, button, box, type, named } = setup();
    button('json').click();
    expect(named('Apply')).toBeUndefined();
    expect(view?.element.querySelector('.fd-json-state')?.textContent).toBe('Nothing to apply: the text is the page as it is.');
    type(box().value.replace('"Coming?"', '"Attending?"'));
    named('Apply')?.click();
    expect(Object.values(designer.getPage().fields).map((f) => f.label)).toEqual(['Attending?', 'Why not?']);
    expect(view?.element.querySelector('.fd-json-state')?.textContent).toBe('Applied. Undo takes it back.');
    type(box().value.replace('"Why not?"', '"Why?"'));
    key(box(), { key: 'Enter', ctrlKey: true });
    expect(Object.values(designer.getPage().fields).map((f) => f.label)).toEqual(['Attending?', 'Why?']);
    designer.undo();
    expect(box().value).toBe(designer.pageJson());
    expect(box().value).toContain('"Why not?"');
  });

  it('says at once that the text changed, before the checks catch up', () => {
    const { button, box, named } = setup();
    button('json').click();
    box().value = box().value.replace('"Coming?"', '"Attending?"');
    box().dispatchEvent(new Event('input', { bubbles: true }));
    expect(view?.element.querySelector('.fd-json-state')?.textContent).toMatch(/^Changed here, not applied yet/);
    expect(named('Apply')).toBeDefined();
  });

  it('marks a mistake on its line and lists it; Apply waits until it is put right', () => {
    const { designer, button, box, type, named, rows } = setup();
    button('json').click();
    const page = designer.getPage();
    const text = box().value.replace('"fieldia": "0.1",', '"fieldia": "0.1"');
    type(text);
    expect(rows()).toEqual(['Line 3Cannot applyA comma is missing before this']);
    expect([...(view?.element.querySelectorAll('.fd-json-mark') ?? [])].map((m) => m.getAttribute('data-line'))).toEqual(['3']);
    expect(named('Apply')).toBeUndefined();
    expect(view?.element.querySelector('.fd-json-state')?.textContent).toBe('1 problem to put right before this can be applied.');
    key(box(), { key: 'Enter', metaKey: true });
    expect(designer.getPage()).toBe(page);
    // Its line takes the cursor there.
    (view?.element.querySelector('.fd-json-at') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(box());
    const lines = box().value.split('\n');
    expect(box().selectionStart).toBe(lines[0].length + 1 + lines[1].length + 1 + 2);
  });

  it('fixes a rule on a field the page lacks with the check’s own fix, in the text', () => {
    const { designer, coming, why, node, button, box, type, named, rows } = setup();
    designer.setCondition(why, { field: node(designer.getPage(), coming).field, equals: false });
    button('json').click();
    const page = JSON.parse(box().value) as Page;
    node(page, why).invisible = "colour != 'red'";
    type(JSON.stringify(page, null, 2));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('reads "colour", which is not a field of this page');
    named('Remove that rule')?.click();
    jest.advanceTimersByTime(400);
    expect(rows()).toEqual([]);
    expect(node(JSON.parse(box().value), why).invisible).toBeUndefined();
    expect(named('Apply')).toBeDefined();
  });

  it('asks in the page before leaving changes not applied: keep editing, discard, or apply', () => {
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    const { designer, button, box, type, named } = setup();
    button('json').click();
    type(box().value.replace('"Coming?"', '"Attending?"'));
    button('design').click();
    const question = view?.element.querySelector('.fd-json-leave') as HTMLElement;
    expect(question.hidden).toBe(false);
    expect(question.getAttribute('role')).toBe('alertdialog');
    expect(view?.open).toBe(true);
    named('Keep editing')?.click();
    expect(question.hidden).toBe(true);
    expect(document.activeElement).toBe(box());
    // Leaving for Try it: discarded, and Try it opens.
    button('try').click();
    named('Discard')?.click();
    expect(view?.open).toBe(false);
    expect(trial?.trying).toBe(true);
    expect(Object.values(designer.getPage().fields).map((f) => f.label)).toEqual(['Coming?', 'Why not?']);
    // Back to the text: applied on the way out.
    button('json').click();
    expect(trial?.trying).toBe(false);
    type(box().value.replace('"Coming?"', '"Attending?"'));
    button('design').click();
    (question.querySelector('button') as HTMLButtonElement).click();
    expect(view?.open).toBe(false);
    expect(Object.values(designer.getPage().fields).map((f) => f.label)).toEqual(['Attending?', 'Why not?']);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('indents with Tab, and lets Tab leave the box after Escape', () => {
    const { button, box } = setup();
    button('json').click();
    box().value = '{\n"a": 1\n}';
    box().setSelectionRange(2, 2);
    expect(key(box(), { key: 'Tab' }).defaultPrevented).toBe(true);
    expect(box().value).toBe('{\n  "a": 1\n}');
    expect(box().selectionStart).toBe(4);
    key(box(), { key: 'Escape' });
    expect(key(box(), { key: 'Tab' }).defaultPrevented).toBe(false);
    // Once out and back, Tab indents again.
    expect(key(box(), { key: 'Tab' }).defaultPrevented).toBe(true);
    expect(view?.element.querySelector('.fd-json-hint')?.textContent).toContain('Esc, then Tab');
  });

  it('copies the text, or selects it for the person to copy', async () => {
    const { button, box, named } = setup();
    button('json').click();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    named('Copy JSON')?.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(box().value);
    expect(view?.element.querySelector('.fd-json-state')?.textContent).toBe('Copied.');
    Object.assign(navigator, { clipboard: undefined });
    named('Copy JSON')?.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect([box().selectionStart, box().selectionEnd]).toEqual([0, box().value.length]);
    expect(view?.element.querySelector('.fd-json-state')?.textContent).toMatch(/^Selected: press (⌘|Ctrl\+)C to copy\.$/);
  });

  it('offers itself in Find anything, and the way back', () => {
    const { button } = setup();
    expect(view?.items().map((i) => i.label)).toEqual(['Edit the page as JSON']);
    view?.items()[0].run();
    expect(view?.open).toBe(true);
    expect(view?.items().map((i) => i.label)).toEqual(['Back to designing']);
    view?.items()[0].run();
    expect(view?.open).toBe(false);
    expect(button('design').getAttribute('aria-pressed')).toBe('true');
  });
});
