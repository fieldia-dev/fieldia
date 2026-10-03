import { type FieldNode, type Page, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** The survey editor's cards, the Google Forms way: a header card, quiet cards, the picked one open with its tools beside it. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page = blankPage('survey', 'Event feedback')) {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page });
  handle = mountSurveyEditor(host, { designer });
  return { host, designer };
}
const shown = (element: Element | null | undefined) => !!element && !element.closest('[hidden]');
const button = (root: Element, name: string) =>
  [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && shown(b)) as HTMLButtonElement | undefined;
const open = (host: Element) => host.querySelector('.fd-q-selected') as HTMLElement;
const nodes = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);
const labels = (designer: ReturnType<typeof createDesigner>) => nodes(designer.getPage()).map((n) => designer.getPage().fields[n.field].label);
function type(input: HTMLInputElement | null, text: string) {
  if (!input) throw new Error('No box to type in');
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
/** The open card's ⋮ menu, and an item of it. */
function more(host: Element): HTMLElement[] {
  (button(open(host), 'More options') as HTMLButtonElement).click();
  return [...document.querySelectorAll<HTMLElement>('.fd-menu [role^="menuitem"]')];
}
const item = (items: HTMLElement[], words: string) => items.find((i) => i.textContent?.trim() === words);
const key = (k: string, options: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...options }));

describe('survey editor — the Google Forms way', () => {
  it('heads the form with a card of its title and description, typed where they stand', () => {
    const { host, designer } = mount();
    const head = host.querySelector('.fd-survey-head') as HTMLElement;
    const title = head.querySelector('[aria-label="Form heading"]') as HTMLInputElement;
    expect(title.value).toBe('Event feedback');
    type(title, 'Launch party');
    expect(designer.getPage().title).toBe('Launch party');
    type(head.querySelector('[aria-label="Form description"]') as HTMLInputElement, 'Tell us how it went.');
    expect(designer.getPage().description).toBe('Tell us how it went.');
    // The bar's title follows.
    expect((host.querySelector('.fd-designer-bar [aria-label="Form title"]') as HTMLInputElement).value).toBe('Launch party');
  });

  it('shows a text question’s answer as a dotted line with words saying what goes there', () => {
    const { host, designer } = mount();
    const short = designer.addQuestion('short-answer') as string;
    const long = designer.addQuestion('paragraph') as string;
    designer.select(null);
    const preview = (id: string) => host.querySelector(`.fd-q[data-node="${id}"] .fd-q-preview`)?.textContent;
    expect(preview(short)).toBe('Short answer text');
    expect(preview(long)).toBe('Long answer text');
    // Open, the same line under the question's words.
    designer.select(short);
    expect(shown(open(host).querySelector('.fd-q-preview'))).toBe(true);
  });

  it('gives a question not picked a grip too, to carry it by', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('short-answer') as string;
    designer.select(null);
    expect(host.querySelector(`.fd-q[data-node="${q}"] [data-grip]`)?.getAttribute('aria-label')).toBe('Drag to move');
  });

  it('shows a dropdown not picked as its numbered options', () => {
    const { host, designer } = mount();
    const role = designer.addQuestion('dropdown') as string;
    designer.setOptions(role, ['Developer', 'Manager']);
    designer.select(null);
    const items = [...host.querySelectorAll(`.fd-q[data-node="${role}"] .fd-q-preview li`)].map((li) => li.textContent);
    expect(items).toEqual(['1. Developer', '2. Manager']);
  });

  it('keeps the open card quiet: a description box only once there are words, or one is asked for from ⋮', () => {
    const { host, designer } = mount();
    designer.addQuestion('short-answer');
    const help = () => open(host).querySelector('.fd-q-help') as HTMLInputElement;
    expect(shown(help())).toBe(false);
    const asked = item(more(host), 'Description') as HTMLElement;
    expect(asked.getAttribute('role')).toBe('menuitemcheckbox');
    expect(asked.getAttribute('aria-checked')).toBe('false');
    asked.click();
    expect(shown(help())).toBe(true);
    expect(document.activeElement).toBe(help());
    type(help(), 'As on your badge');
    expect(designer.getPage().fields[nodes(designer.getPage())[0].field].help).toBe('As on your badge');
    // With words in it, it stays; ⋮ takes it away, words and all.
    expect(item(more(host), 'Description')?.getAttribute('aria-checked')).toBe('true');
    item(more(host), 'Description')?.click();
    expect(shown(help())).toBe(false);
    expect(designer.getPage().fields[nodes(designer.getPage())[0].field].help).toBeUndefined();
  });

  it('moves the open card up and down, and sets when it shows, from its ⋮ menu', () => {
    const { host, designer } = mount();
    const coming = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(coming, { label: 'Coming?' });
    const why = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(why, { label: 'Why not?' });
    let items = more(host);
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Description', 'Show only when…', 'Move up']);
    item(items, 'Move up')?.click();
    expect(labels(designer)).toEqual(['Why not?', 'Coming?']);
    items = more(host);
    // At the top now: no earlier question to depend on, and nowhere further up to go.
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Description', 'Move down']);
    item(items, 'Move down')?.click();
    item(more(host), 'Show only when…')?.click();
    expect(shown(open(host).querySelector('.fd-when'))).toBe(true);
    expect(shown(open(host).querySelector('select[aria-label="Show this question"]'))).toBe(true);
  });

  it('makes one option of each line pasted into an option, as Google Forms does', () => {
    const { host, designer } = mount();
    const colour = designer.addQuestion('multiple-choice') as string;
    const first = open(host).querySelector('.fd-q-option input') as HTMLInputElement;
    first.focus();
    first.select();
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'Red\r\nGreen\n\n  Blue  \n' } });
    first.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    const field = designer.getPage().fields[nodes(designer.getPage()).find((n) => n.id === colour)?.field as string];
    expect(field.type === 'selection' && field.options.map((o) => o.label)).toEqual(['Red', 'Green', 'Blue']);
    // The cursor ends on the last of them.
    expect(document.activeElement).toBe([...open(host).querySelectorAll('.fd-q-option input')].at(-1));
    // One line is pasted as it is, by the box itself.
    const single = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(single, 'clipboardData', { value: { getData: () => 'Purple' } });
    first.dispatchEvent(single);
    expect(single.defaultPrevented).toBe(false);
  });

  it('keeps tools beside the card picked: a question added after it, or a page', () => {
    const { host, designer } = mount();
    const rail = host.querySelector('.fd-q-rail') as HTMLElement;
    const first = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(first, { label: 'First' });
    designer.addQuestion('short-answer');
    designer.select(first);
    expect(shown(rail)).toBe(true);
    (button(rail, 'Add a question after this one') as HTMLButtonElement).click();
    expect(labels(designer)).toEqual(['First', 'Untitled question', 'Untitled question']);
    expect(open(host)?.dataset['node']).toBe(nodes(designer.getPage())[1].id);
    expect(document.activeElement).toBe(open(host).querySelector('.fd-q-label'));
    // A page after it, as Forms adds a section: the questions under it go onto the new page.
    (button(rail, 'Add a page after this one') as HTMLButtonElement).click();
    const steps = (designer.getPage().layout as WizardNode).children;
    expect(steps.map((s) => s.children.length)).toEqual([2, 1]);
    expect(steps[1].label).toBe('Page 2');
    expect(designer.getState().selected).toBe(steps[1].id);
    expect(document.activeElement).toBe(host.querySelector(`.fd-design-step[data-node="${steps[1].id}"] .fd-step-title`));
  });

  it('takes Google Forms’ keys: a question after this one, a copy of it, and up and down', () => {
    const { host, designer } = mount();
    const first = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(first, { label: 'First' });
    const words = open(host).querySelector('.fd-q-label') as HTMLInputElement;
    key('Enter', { ctrlKey: true, shiftKey: true }, words);
    expect(labels(designer)).toEqual(['First', 'Untitled question']);
    key('d', { ctrlKey: true, shiftKey: true }, document.body);
    expect(labels(designer)).toEqual(['First', 'Untitled question', 'Untitled question']);
    designer.select(first);
    key('j', { ctrlKey: true, shiftKey: true }, document.body);
    expect(labels(designer)).toEqual(['Untitled question', 'First', 'Untitled question']);
    key('k', { metaKey: true, shiftKey: true }, document.body);
    expect(labels(designer)).toEqual(['First', 'Untitled question', 'Untitled question']);
  });
});

describe('survey editor — putting a question down', () => {
  const click = (target: Element) => target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  it('closes the open card at a click on the page around the cards, or outside the editor', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('short-answer') as string;
    for (const target of [host.querySelector('.fd-survey-canvas') as HTMLElement, host.querySelector('.fd-survey-column') as HTMLElement, document.body]) {
      designer.select(q);
      expect(open(host)).not.toBeNull();
      click(target);
      expect(open(host)).toBeNull();
    }
  });

  it('keeps it open at a click in it, or on the bar beside it', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('short-answer') as string;
    designer.select(q);
    click(open(host).querySelector('.fd-q-label') as HTMLElement);
    click(open(host).querySelector('.fd-q-foot') as HTMLElement);
    click(host.querySelector('.fd-q-rail') as HTMLElement);
    expect(designer.getState().selected).toBe(q);
  });
});

describe('survey editor — every kind’s own details, as Google Forms has them', () => {
  const fieldOfQ = (designer: ReturnType<typeof createDesigner>, id: string) => designer.getPage().fields[nodes(designer.getPage()).find((n) => n.id === id)?.field as string];
  const nodeOfQ = (designer: ReturnType<typeof createDesigner>, id: string) => nodes(designer.getPage()).find((n) => n.id === id) as FieldNode;

  it('adds “Other” to multiple choice from beside “Add option”, shows it after the options, and takes it away', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('multiple-choice') as string;
    expect(open(host).querySelector('.fd-q-add-row')?.textContent).toBe('Add optionoradd “Other”');
    (button(open(host), 'add “Other”') as HTMLButtonElement).click();
    expect(fieldOfQ(designer, q)).toMatchObject({ other: true });
    expect(shown(open(host).querySelector('.fd-q-option-other'))).toBe(true);
    expect(open(host).querySelector('.fd-q-option-other')?.textContent).toContain('Other…');
    // Once there, it is not offered again.
    expect(button(open(host), 'add “Other”')).toBeUndefined();
    // The closed card shows it as people will see it: “Other:” and its box.
    designer.select(null);
    expect(host.querySelector(`.fd-q[data-node="${q}"] .fd-choice-other`)?.textContent).toContain('Other:');
    designer.select(q);
    (button(open(host), 'Remove “Other”') as HTMLButtonElement).click();
    expect(fieldOfQ(designer, q)).not.toHaveProperty('other');
    expect(button(open(host), 'add “Other”')).toBeDefined();
  });

  it('numbers a dropdown’s options, and offers it no “Other”', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('dropdown') as string;
    designer.setOptions(q, ['Red', 'Green']);
    expect([...open(host).querySelectorAll('.fd-q-options .fd-q-bullet')].map((b) => b.textContent)).toEqual(['1.', '2.']);
    expect(open(host).querySelector('.fd-q-option-box')?.hasAttribute('data-numbered')).toBe(true);
    expect(button(open(host), 'add “Other”')).toBeUndefined();
  });

  it('puts words at a linear scale’s ends, typed beside its first and last numbers', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('scale') as string;
    const start = open(host).querySelector('[aria-label="Words at the start"]') as HTMLInputElement;
    expect(start.closest('.fd-inline-end')?.textContent).toContain('0');
    type(start, 'Not likely');
    type(open(host).querySelector('[aria-label="Words at the end"]') as HTMLInputElement, 'Very likely');
    expect(nodeOfQ(designer, q).options).toEqual({ startLabel: 'Not likely', endLabel: 'Very likely' });
    designer.select(null);
    expect([...host.querySelectorAll(`.fd-q[data-node="${q}"] .fd-scale-ends span`)].map((s) => s.textContent)).toEqual(['Not likely', 'Very likely']);
  });

  it('says which files an upload takes, and the largest', () => {
    const { host, designer } = mount();
    const q = designer.addQuestion('file') as string;
    (button(open(host), 'Images') as HTMLButtonElement).click();
    (button(open(host), 'PDF') as HTMLButtonElement).click();
    expect(fieldOfQ(designer, q)).toMatchObject({ accept: ['image/*', 'application/pdf'] });
    expect(button(open(host), 'Images')?.getAttribute('aria-pressed')).toBe('true');
    const largest = open(host).querySelector('[aria-label="Largest file"]') as HTMLSelectElement;
    expect(largest.value).toBe(String(10 * 1024 * 1024));
    largest.value = String(1024 * 1024);
    largest.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldOfQ(designer, q)).toMatchObject({ maxSize: 1048576 });
    (button(open(host), 'Images') as HTMLButtonElement).click();
    (button(open(host), 'PDF') as HTMLButtonElement).click();
    // None picked: any file.
    expect(fieldOfQ(designer, q)).not.toHaveProperty('accept');
  });

  it('shows a date as a dotted line saying what goes there, with a calendar', () => {
    const { host, designer } = mount();
    const day = designer.addQuestion('date') as string;
    const moment = designer.addQuestion('date-time') as string;
    designer.select(null);
    expect(host.querySelector(`.fd-q[data-node="${day}"] .fd-q-preview`)?.textContent).toBe('Day, month, year');
    expect(host.querySelector(`.fd-q[data-node="${moment}"] .fd-q-preview`)?.textContent).toBe('Day, month, year, time');
    expect(host.querySelector(`.fd-q[data-node="${day}"] .fd-q-preview svg`)).not.toBeNull();
  });
});
