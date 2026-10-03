import { type FieldNode, type Page, type StepNode, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page = blankPage('survey', 'Event feedback'), store = createMemoryPageStore()) {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page, store });
  handle = mountSurveyEditor(host, { designer });
  return { host, designer, store };
}

const button = (root: Element, name: string) =>
  [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement;
const cards = (host: Element) => [...host.querySelectorAll<HTMLElement>('.fd-q')];
const open = (host: Element) => host.querySelector('.fd-q-selected') as HTMLElement;
const label = (card: Element) => card.querySelector('.fd-q-label') as HTMLInputElement;
const nodes = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);
const fieldOf = (page: Page, node: FieldNode) => page.fields[node.field];
const tile = (host: Element, spec: string) => host.querySelector(`.fd-toolbox [data-tool="${spec}"]`) as HTMLButtonElement;
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const key = (k: string, options: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...options }));
/** Switch the open question's kind from its menu. */
function kind(host: Element, id: string) {
  (open(host).querySelector('.fd-q-kind') as HTMLButtonElement).click();
  (document.querySelector(`.fd-menu [data-item="${id}"]`) as HTMLElement).click();
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('survey editor — questions as people see them, the one picked open', () => {
  it('adds a question, opens it, and puts the cursor in its words, every word selected', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    expect(cards(host)).toHaveLength(1);
    expect(cards(host)[0].classList.contains('fd-q-selected')).toBe(true);
    const words = label(cards(host)[0]);
    expect(document.activeElement).toBe(words);
    expect([words.selectionStart, words.selectionEnd]).toEqual([0, 'Untitled question'.length]);
    expect(nodes(designer.getPage())).toHaveLength(1);
  });

  it('shows a question not picked as people will see it: its words, its help and its real answer box, not usable here', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    type(label(open(host)), 'Your name');
    type(open(host).querySelector('.fd-q-help') as HTMLInputElement, 'As on your badge');
    designer.updateQuestion(nodes(designer.getPage())[0].id, { required: true });
    designer.select(null);
    const card = cards(host)[0];
    expect(card.classList.contains('fd-q-selected')).toBe(false);
    expect(card.querySelector('.fd-q-label')).toBeNull();
    expect(card.querySelector('.fd-q-text')?.textContent).toBe('Your name');
    expect(card.classList.contains('fd-required')).toBe(true);
    expect(card.querySelector('.fd-help')?.textContent).toBe('As on your badge');
    expect((card.querySelector('.fd-help') as HTMLElement).hidden).toBe(false);
    // A question with no help shows none.
    designer.updateQuestion(nodes(designer.getPage())[0].id, { help: '' });
    expect((cards(host)[0].querySelector('.fd-help') as HTMLElement).hidden).toBe(true);
    const answer = card.querySelector('.fd-q-answer') as HTMLElement;
    expect(answer.hasAttribute('inert')).toBe(true);
    expect(answer.querySelector('input')).not.toBeNull();
  });

  it('opens a question where it is clicked, the cursor in its words when they were clicked', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    button(host, 'Add question').click();
    designer.select(null);
    (cards(host)[0].querySelector('.fd-q-text') as HTMLElement).click();
    expect(open(host)).toBe(cards(host)[0]);
    expect(document.activeElement).toBe(label(cards(host)[0]));
    expect(cards(host).filter((c) => c.classList.contains('fd-q-selected'))).toHaveLength(1);
  });

  it('writes typed words into the page, keeping the cursor while it does', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const words = label(open(host));
    type(words, 'What did you think?');
    expect(document.activeElement).toBe(words);
    expect(label(open(host))).toBe(words);
    expect(fieldOf(designer.getPage(), nodes(designer.getPage())[0]).label).toBe('What did you think?');
  });

  it('switches kind from a menu with icons, offering only what a survey asks; then the options are typed in place', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const menuButton = open(host).querySelector('.fd-q-kind') as HTMLButtonElement;
    expect(menuButton.getAttribute('aria-label')).toBe('Kind of question: Short answer');
    menuButton.click();
    const offered = [...document.querySelectorAll('.fd-menu [role="menuitemradio"]')].map((i) => i.getAttribute('data-item'));
    expect(offered).toContain('multiple-choice');
    expect(offered).not.toContain('link');
    expect(document.querySelector('.fd-menu [data-item="multiple-choice"] svg')).not.toBeNull();
    (document.querySelector('.fd-menu [data-item="multiple-choice"]') as HTMLElement).click();
    const optionInputs = () => [...open(host).querySelectorAll<HTMLInputElement>('.fd-q-option input')];
    expect(optionInputs().map((i) => i.value)).toEqual(['Option 1']);
    // A choice shows its options to type, in place of its answer box.
    expect((open(host).querySelector('.fd-q-answer') as HTMLElement).hidden).toBe(true);
    button(open(host), 'Add option').click();
    type(optionInputs()[0], 'Yes');
    type(optionInputs()[1], 'No');
    expect(fieldOf(designer.getPage(), nodes(designer.getPage())[0])).toMatchObject({ type: 'selection', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] });
    button(open(host), 'Remove option No').click();
    expect(optionInputs().map((i) => i.value)).toEqual(['Yes']);
  });

  it('makes a question required with its switch', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const required = button(open(host), 'Required');
    expect(required.getAttribute('role')).toBe('switch');
    expect(required.getAttribute('aria-checked')).toBe('false');
    required.click();
    expect(fieldOf(designer.getPage(), nodes(designer.getPage())[0])).toMatchObject({ required: true });
    expect(button(open(host), 'Required').getAttribute('aria-checked')).toBe('true');
  });

  it('moves, duplicates and deletes questions', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    type(label(open(host)), 'First');
    button(host, 'Add question').click();
    type(label(open(host)), 'Second');
    button(open(host), 'Move up').click();
    const labels = () => nodes(designer.getPage()).map((n) => fieldOf(designer.getPage(), n).label);
    expect(labels()).toEqual(['Second', 'First']);
    expect(cards(host)[0].classList.contains('fd-q-selected')).toBe(true);
    // At the top, it cannot go further up.
    expect(button(open(host), 'Move up')).toBeUndefined();
    expect(button(open(host), 'Move down')).toBeTruthy();
    button(open(host), 'Duplicate').click();
    expect(labels()).toEqual(['Second', 'Second', 'First']);
    // The copy is picked, right after what it copies.
    expect(cards(host)[1].classList.contains('fd-q-selected')).toBe(true);
    button(open(host), 'Delete').click();
    expect(labels()).toEqual(['Second', 'First']);
    expect(Object.keys(designer.getPage().fields)).toHaveLength(2);
  });

  it('adds from the toolbox after the question picked, or at the end of the page picked', () => {
    const { host, designer } = mount();
    expect(tile(host, 'kind:link')).toBeNull();
    button(host, 'Add question').click();
    button(host, 'Add question').click();
    const [first] = nodes(designer.getPage());
    designer.select(first.id);
    tile(host, 'kind:rating').click();
    expect(nodes(designer.getPage()).map((n) => n.widget ?? '')).toEqual(['', 'rating', '']);
    expect(document.activeElement).toBe(label(open(host)));
    button(host, 'Add page').click();
    // The first page picked, not the last: the question goes to the end of it.
    designer.select((designer.getPage().layout as WizardNode).children[0].id);
    tile(host, 'kind:yes-no').click();
    const steps = (designer.getPage().layout as WizardNode).children as StepNode[];
    expect(steps.map((s) => s.children.length)).toEqual([4, 0]);
    expect((steps[0].children[3] as FieldNode).widget).toBe('toggle');
  });

  it('moves the question picked with Alt and an arrow, deletes it with Delete, and puts it down with Escape', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    type(label(open(host)), 'First');
    button(host, 'Add question').click();
    type(label(open(host)), 'Second');
    const labels = () => nodes(designer.getPage()).map((n) => fieldOf(designer.getPage(), n).label);
    // In the words, the keys are the box's own.
    key('Delete', {}, label(open(host)));
    expect(labels()).toEqual(['First', 'Second']);
    key('Escape', {}, label(open(host)));
    expect(open(host)).toBeNull();
    designer.select(nodes(designer.getPage())[1].id);
    key('ArrowUp', { altKey: true }, document.body);
    expect(labels()).toEqual(['Second', 'First']);
    key('Delete', {}, document.body);
    expect(labels()).toEqual(['First']);
  });

  it('adds a page that is shown only for one answer', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    kind(host, 'yes-no');
    type(label(open(host)), 'Coming?');
    button(host, 'Add page').click();
    // The first page has nothing before it to depend on.
    expect((host.querySelectorAll<HTMLElement>('.fd-design-step')[0].querySelector('.fd-step-when') as HTMLElement).hidden).toBe(true);
    const page2 = host.querySelectorAll<HTMLElement>('.fd-design-step')[1];
    const when = page2.querySelector('.fd-when-field') as HTMLSelectElement;
    expect([...when.options].map((o) => o.textContent)).toEqual(['Always', 'Coming?']);
    when.value = nodes(designer.getPage())[0].field;
    when.dispatchEvent(new Event('change', { bubbles: true }));
    const equals = page2.querySelector('.fd-when-answer') as HTMLSelectElement;
    expect([...equals.options].map((o) => o.textContent)).toEqual(['is Yes', 'is No', 'is not Yes', 'is not No']);
    equals.value = 'is:true';
    equals.dispatchEvent(new Event('change', { bubbles: true }));
    const step = (designer.getPage().layout as WizardNode).children[1] as StepNode;
    expect(step.invisible).toBe(`${nodes(designer.getPage())[0].field} != True`);
  });

  it('undoes and redoes, showing each button only when it can act', () => {
    const { host, designer } = mount();
    expect(button(host, 'Undo')).toBeUndefined();
    button(host, 'Add question').click();
    button(host, 'Undo').click();
    expect(nodes(designer.getPage())).toHaveLength(0);
    expect(cards(host)).toHaveLength(0);
    button(host, 'Redo').click();
    expect(cards(host)).toHaveLength(1);
    expect(button(host, 'Redo')).toBeUndefined();
  });

  it('undoes from the keyboard even when focus is on the page itself', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    (document.activeElement as HTMLElement).blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(nodes(designer.getPage())).toHaveLength(0);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(nodes(designer.getPage())).toHaveLength(1);
  });

  it('publishes, and says which version is live', async () => {
    const { host } = mount();
    button(host, 'Add question').click();
    button(host, 'Publish').click();
    await wait(10);
    expect(host.querySelector('.fd-designer-status')?.textContent).toBe('Published · version 1');
    expect(button(host, 'Publish')).toBeUndefined();
    type(label(open(host)), 'Changed');
    expect(host.querySelector('.fd-designer-status')?.textContent).toBe('Changes not published yet');
  });

  it('shows why an edit was refused', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    kind(host, 'yes-no');
    button(host, 'Add page').click();
    const step = (designer.getPage().layout as WizardNode).children[1].id;
    designer.setCondition(step, { field: nodes(designer.getPage())[0].field, equals: true });
    designer.select(nodes(designer.getPage())[0].id);
    button(open(host), 'Delete').click(); // a later page depends on this question
    expect(host.querySelector('.fd-designer-issues')?.textContent).toMatch(/reads "q_1", which is not a field/);
    expect(cards(host)).toHaveLength(1);
  });

  it('previews the page as people will see it', async () => {
    const { host } = mount();
    button(host, 'Add question').click();
    type(label(open(host)), 'Your name');
    await wait(200);
    expect(host.querySelector('.fd-designer-preview .fd-label')?.textContent).toBe('Your name');
  });

  it('says the preview is busy while it is being drawn again, so no one tries the old one', async () => {
    const { host } = mount();
    const preview = host.querySelector('.fd-designer-preview-host') as HTMLElement;
    button(host, 'Add question').click();
    expect(preview.getAttribute('aria-busy')).toBe('true');
    await wait(200);
    expect(preview.hasAttribute('aria-busy')).toBe(false);
  });
});

describe('survey editor — a question shown for some answers', () => {
  /** "Name", "Coming?" (yes or no), "Role" (a dropdown) and "Why not?" on one page. */
  function threeQuestions() {
    const mounted = mount();
    const { designer } = mounted;
    // A question with no answers to choose from, which no condition can test.
    designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Name' });
    const coming = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(coming, { label: 'Coming?' });
    const role = designer.addQuestion('dropdown') as string;
    designer.updateQuestion(role, { label: 'Role' });
    designer.setOptions(role, ['Developer', 'Manager']);
    const why = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(why, { label: 'Why not?' });
    const card = (id: string) => mounted.host.querySelector(`.fd-q[data-node="${id}"]`) as HTMLElement;
    const field = (id: string) => (nodes(designer.getPage()).find((n) => n.id === id) as FieldNode).field;
    const invisible = (id: string) => (nodes(designer.getPage()).find((n) => n.id === id) as FieldNode).invisible;
    return { ...mounted, coming, role, why, card, field, invisible };
  }
  const choose = (select: HTMLSelectElement, value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const selectIn = (root: Element, label: string) => root.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;

  it('offers a condition only from questions before it, and builds one rule by rule', () => {
    const { designer, card, coming, role, why, field, invisible } = threeQuestions();
    designer.select(coming);
    expect(card(coming).classList.contains('fd-q-selected')).toBe(true);
    expect(button(card(coming), 'Show only when…')).toBeUndefined();
    designer.select(why);
    button(card(why), 'Show only when…').click();
    const first = selectIn(card(why), 'Show this question');
    expect([...first.options].map((o) => o.textContent)).toEqual(['Always', 'Coming?', 'Role']);
    expect(invisible(why)).toBe(`${field(coming)} != True`);
    choose(selectIn(card(why), 'When the answer is'), 'is:false');
    expect(invisible(why)).toBe(`${field(coming)} != False`);
    button(card(why), 'Add a condition').click();
    choose(selectIn(card(why), 'Condition 2'), field(role));
    choose(selectIn(card(why), 'Answer 2'), 'not:manager');
    expect(invisible(why)).toBe(`${field(coming)} != False or ${field(role)} == 'manager'`);
    choose(selectIn(card(why), 'Match'), 'any');
    expect(invisible(why)).toBe(`${field(coming)} != False and ${field(role)} == 'manager'`);
    button(card(why), 'Remove condition 2').click();
    expect(invisible(why)).toBe(`${field(coming)} != False`);
    expect(selectIn(card(why), 'Match').closest('[hidden]')).not.toBeNull();
    choose(selectIn(card(why), 'Show this question'), '');
    expect(invisible(why)).toBeUndefined();
    expect(button(card(why), 'Show only when…')).toBeTruthy();
  });

  it('marks a question not picked that shows only for some answers', () => {
    const { designer, card, coming, why, field } = threeQuestions();
    designer.setCondition(why, { field: field(coming), equals: false });
    designer.select(null);
    expect(card(why).querySelector('.fd-q-when-note')?.textContent).toBe('Shown only for some answers');
    expect(card(coming).querySelector('.fd-q-when-note')).toBeNull();
  });

  it('shows a condition written by hand as it is, and replaces it on request', () => {
    const { why, designer, field, coming } = threeQuestions();
    const page = designer.getPage();
    (nodes(page).find((n) => n.id === why) as FieldNode).invisible = `not (${field(coming)} == True)`;
    const { host, designer: second } = mount(page);
    second.select(why);
    const custom = host.querySelector(`.fd-q[data-node="${why}"] .fd-when-custom`) as HTMLElement;
    expect(custom.textContent).toContain(`not (${field(coming)} == True)`);
    button(custom, 'Replace').click();
    expect(host.querySelector(`.fd-q[data-node="${why}"] .fd-when-custom`)?.closest('[hidden]')).not.toBeNull();
  });
});
