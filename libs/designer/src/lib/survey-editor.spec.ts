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
const nodes = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('survey editor', () => {
  it('adds a question, selects it and puts the cursor in its label', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    expect(cards(host)).toHaveLength(1);
    expect(cards(host)[0].classList.contains('fd-q-selected')).toBe(true);
    expect(document.activeElement).toBe(cards(host)[0].querySelector('.fd-q-label'));
    expect(nodes(designer.getPage())).toHaveLength(1);
  });

  it('selects the placeholder label, so the first keystroke replaces it', () => {
    const { host } = mount();
    button(host, 'Add question').click();
    const label = cards(host)[0].querySelector('.fd-q-label') as HTMLInputElement;
    expect([label.selectionStart, label.selectionEnd]).toEqual([0, 'Untitled question'.length]);
  });

  it('writes a typed label into the page, keeping focus while it does', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const label = cards(host)[0].querySelector('.fd-q-label') as HTMLInputElement;
    type(label, 'What did you think?');
    expect(document.activeElement).toBe(label);
    expect(designer.getPage().fields[nodes(designer.getPage())[0].field].label).toBe('What did you think?');
  });

  it('switches kind, then edits options', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const kind = cards(host)[0].querySelector('.fd-q-kind') as HTMLSelectElement;
    kind.value = 'multiple-choice';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    const optionInputs = () => [...cards(host)[0].querySelectorAll<HTMLInputElement>('.fd-q-option input')];
    expect(optionInputs().map((i) => i.value)).toEqual(['Option 1']);
    button(cards(host)[0], 'Add option').click();
    type(optionInputs()[0], 'Yes');
    type(optionInputs()[1], 'No');
    const field = designer.getPage().fields[nodes(designer.getPage())[0].field];
    expect(field).toMatchObject({ type: 'selection', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] });
    button(cards(host)[0], 'Remove option No').click();
    expect(optionInputs().map((i) => i.value)).toEqual(['Yes']);
  });

  it('marks a question required', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    (cards(host)[0].querySelector('.fd-q-required input') as HTMLInputElement).click();
    expect(designer.getPage().fields[nodes(designer.getPage())[0].field]).toMatchObject({ required: true });
  });

  it('moves, duplicates and deletes questions', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    type(cards(host)[0].querySelector('.fd-q-label') as HTMLInputElement, 'First');
    button(host, 'Add question').click();
    type(cards(host)[1].querySelector('.fd-q-label') as HTMLInputElement, 'Second');
    button(cards(host)[1], 'Move up').click();
    const labels = () => cards(host).map((c) => (c.querySelector('.fd-q-label') as HTMLInputElement).value);
    expect(labels()).toEqual(['Second', 'First']);
    button(cards(host)[0], 'Duplicate').click();
    expect(labels()).toEqual(['Second', 'Second', 'First']);
    button(cards(host)[2], 'Delete').click();
    expect(labels()).toEqual(['Second', 'Second']);
    expect(Object.keys(designer.getPage().fields)).toHaveLength(2);
  });

  it('adds a page that is shown only for one answer', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const kind = cards(host)[0].querySelector('.fd-q-kind') as HTMLSelectElement;
    kind.value = 'yes-no';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    type(cards(host)[0].querySelector('.fd-q-label') as HTMLInputElement, 'Coming?');
    button(host, 'Add page').click();
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
    type(cards(host)[0].querySelector('.fd-q-label') as HTMLInputElement, 'Changed');
    expect(host.querySelector('.fd-designer-status')?.textContent).toBe('Changes not published yet');
  });

  it('shows why an edit was refused', () => {
    const { host, designer } = mount();
    button(host, 'Add question').click();
    const kind = cards(host)[0].querySelector('.fd-q-kind') as HTMLSelectElement;
    kind.value = 'yes-no';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    button(host, 'Add page').click();
    const step = (designer.getPage().layout as WizardNode).children[1].id;
    designer.setCondition(step, { field: nodes(designer.getPage())[0].field, equals: true });
    button(cards(host)[0], 'Delete').click(); // a later page depends on this question
    expect(host.querySelector('.fd-designer-issues')?.textContent).toMatch(/reads "q_1", which is not a field/);
    expect(cards(host)).toHaveLength(1);
  });

  it('previews the page as people will see it', async () => {
    const { host } = mount();
    button(host, 'Add question').click();
    type(cards(host)[0].querySelector('.fd-q-label') as HTMLInputElement, 'Your name');
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
    const { card, coming, role, why, field, invisible } = threeQuestions();
    expect(button(card(coming), 'Show only when…')).toBeUndefined();
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

  it('shows a condition written by hand as it is, and replaces it on request', () => {
    const { why, designer, field, coming } = threeQuestions();
    const page = designer.getPage();
    (nodes(page).find((n) => n.id === why) as FieldNode).invisible = `not (${field(coming)} == True)`;
    const { host } = mount(page);
    const custom = host.querySelector(`.fd-q[data-node="${why}"] .fd-when-custom`) as HTMLElement;
    expect(custom.textContent).toContain(`not (${field(coming)} == True)`);
    button(custom, 'Replace').click();
    expect(host.querySelector(`.fd-q[data-node="${why}"] .fd-when-custom`)?.closest('[hidden]')).not.toBeNull();
  });
});

