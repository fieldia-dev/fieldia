import type { FieldNode, Page, SectionNode, WizardNode } from '@fieldia/core';
import type { WidgetFactory } from '@fieldia/widgets';
import type { AppKind } from './app-kinds';
import { blankPage, createDesigner, type Designer } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/**
 * An app's own kind in both editors, as a person meets it: a tile in the
 * toolbox with its picture, a row in "Shown as", its own settings on the
 * picked field and in the panel, and the app's widget drawing it on the
 * canvas, on the cards and in Try it.
 */

const ICON = '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 12h10"/>';
/** Whether an icon is the app's own drawing. */
const isAppIcon = (svg: Element | null | undefined) => !!svg?.querySelector('rect[x="3"][y="6"][width="18"]') && !!svg.querySelector('path[d="M7 12h10"]');

/** The app's settings: one choice, the country, kept on the field's place on the page. */
const countrySettings: AppKind['settings'] = (context) => {
  const select = context.document.createElement('select');
  select.setAttribute('aria-label', 'Country');
  for (const code of ['', 'DE', 'EG']) select.append(Object.assign(context.document.createElement('option'), { value: code, textContent: code || 'Any' }));
  select.addEventListener('change', () => context.set({ country: select.value || null }));
  return {
    element: select,
    refresh(_page, node) {
      select.value = String(node.options?.['country'] ?? '');
    },
  };
};

const iban: AppKind = { id: 'iban', label: 'IBAN', icon: ICON, field: (label) => ({ type: 'char', label }), settings: countrySettings };

/** The app's widget: a box that says which country it checks. */
const ibanWidget: WidgetFactory = ({ document, node }) => {
  const element = document.createElement('input');
  element.className = 'app-iban';
  element.dataset['country'] = String(node.options?.['country'] ?? '');
  return { element, update: () => undefined, focus: () => element.focus() };
};
const widgets = { 'char.iban': ibanWidget };

let surveyHandle: SurveyEditorHandle | null = null;
let screenHandle: ScreenEditorHandle | null = null;
afterEach(() => {
  surveyHandle?.destroy();
  screenHandle?.destroy();
  surveyHandle = screenHandle = null;
  document.body.replaceChildren();
});

function host() {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}
function survey(kinds: AppKind[] = [iban]) {
  const designer = createDesigner({ page: blankPage('survey', 'Payout'), kinds });
  const root = host();
  surveyHandle = mountSurveyEditor(root, { designer, widgets });
  return { root, designer };
}
function screen(kinds: AppKind[] = [iban]) {
  const designer = createDesigner({ page: blankPage('screen', 'Supplier'), kinds });
  const root = host();
  screenHandle = mountScreenEditor(root, { designer, widgets });
  return { root, designer };
}

const shown = (element: Element) => !element.closest('[hidden]');
const groupOf = (root: Element, name: string) =>
  [...root.querySelectorAll<HTMLElement>('.fd-tool-group')].find((g) => g.querySelector('.fd-tool-heading-name')?.textContent === name && shown(g));
const tilesOf = (group: Element | undefined) => [...(group?.querySelectorAll<HTMLElement>('.fd-tool') ?? [])].filter(shown).map((t) => t.dataset['tool']);
const nodes = (page: Page): FieldNode[] => ((page.layout as WizardNode | { children: SectionNode[] }).children as { children: FieldNode[] }[]).flatMap((c) => c.children);
const lastNode = (designer: Designer) => nodes(designer.getPage()).slice(-1)[0];
function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
/** The items Find anything lists, by their words. */
function findWords(root: Element): string[] {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  const words = [...document.querySelectorAll('.fd-find-option .fd-find-label')].map((o) => o.textContent ?? '');
  document.querySelector('.fd-find-backdrop')?.remove();
  return words;
}

describe('an app’s kind in the survey editor', () => {
  it('is a tile in the toolbox, under “Your kinds”, with its own picture', () => {
    const { root } = survey();
    const group = groupOf(root, 'Your kinds');
    expect(tilesOf(group)).toEqual(['kind:iban']);
    const tile = group?.querySelector('[data-tool="kind:iban"]') as HTMLButtonElement;
    expect(tile.textContent).toBe('IBAN');
    expect(isAppIcon(tile.querySelector('svg'))).toBe(true);
    // After Fieldia's groups.
    const names = [...root.querySelectorAll('.fd-tool-group')].filter(shown).map((g) => g.querySelector('.fd-tool-heading-name')?.textContent);
    expect(names[names.length - 1]).toBe('Your kinds');
  });

  it('adds a question of its kind, named on the card with its picture, and offered in the kind menu', () => {
    const { root, designer } = survey();
    (root.querySelector('[data-tool="kind:iban"]') as HTMLButtonElement).click();
    expect(lastNode(designer).widget).toBe('iban');
    const kind = root.querySelector('.fd-q-selected .fd-q-kind') as HTMLButtonElement;
    expect(kind.getAttribute('aria-label')).toBe('Kind of question: IBAN');
    expect(isAppIcon(kind.querySelector('.fd-q-kind-icon svg'))).toBe(true);
    kind.click();
    const item = document.querySelector('.fd-menu [data-item="iban"]') as HTMLElement;
    expect(item.getAttribute('aria-checked')).toBe('true');
    expect(item.textContent).toBe('IBAN');
  });

  it('shows its own settings on the open card, kept on the page and drawn again after each edit', () => {
    const { root, designer } = survey();
    (root.querySelector('[data-tool="kind:iban"]') as HTMLButtonElement).click();
    const country = root.querySelector('.fd-q-selected select[aria-label="Country"]') as HTMLSelectElement;
    expect(country).not.toBeNull();
    choose(country, 'DE');
    expect(lastNode(designer).options).toEqual({ country: 'DE' });
    designer.undo();
    expect((root.querySelector('.fd-q-selected select[aria-label="Country"]') as HTMLSelectElement).value).toBe('');
  });

  it('draws with the app’s widget on a closed card', () => {
    const { root, designer } = survey();
    const id = designer.addQuestion('iban') as string;
    designer.setWidgetOptions(id, { country: 'EG' });
    designer.select(null);
    const drawn = root.querySelector(`.fd-q-closed[data-node="${id}"] .app-iban`) as HTMLElement;
    expect(drawn).not.toBeNull();
    expect(drawn.dataset['country']).toBe('EG');
  });

  it('reads as its preview’s words on a closed card, when it gives some', () => {
    const { root, designer } = survey([{ ...iban, preview: 'IBAN, such as DE89 3704 0044' }]);
    const id = designer.addQuestion('iban') as string;
    designer.select(null);
    const card = root.querySelector(`.fd-q-closed[data-node="${id}"]`) as HTMLElement;
    expect(card.querySelector('.fd-q-preview')?.textContent).toBe('IBAN, such as DE89 3704 0044');
    expect(card.querySelector('.app-iban')).toBeNull();
  });

  it('draws as its preview draws it, when that is a drawing', () => {
    const preview: AppKind['preview'] = ({ document, node }) => Object.assign(document.createElement('div'), { className: 'app-iban-preview', textContent: `Account in ${node.options?.['country'] ?? 'any country'}` });
    const { root, designer } = survey([{ ...iban, preview }]);
    const id = designer.addQuestion('iban') as string;
    designer.setWidgetOptions(id, { country: 'DE' });
    designer.select(null);
    expect(root.querySelector(`.fd-q-closed[data-node="${id}"] .app-iban-preview`)?.textContent).toBe('Account in DE');
  });

  it('works in Try it with the app’s widget', () => {
    const { root, designer } = survey();
    designer.addQuestion('iban');
    (root.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    expect(root.querySelector('.fd-try-frame .app-iban')).not.toBeNull();
  });

  it('is added from Find anything', () => {
    const { root } = survey();
    expect(findWords(root)).toContain('Add a question: IBAN');
  });
});

describe('an app’s kind in the screen editor', () => {
  it('sits in the toolbox group it names, before Layout; a group Fieldia has takes it at its end', () => {
    const { root } = screen([{ ...iban, group: 'Banking' }, { id: 'sku', label: 'Product code', field: (label) => ({ type: 'char', label }), group: 'Text' }]);
    expect(tilesOf(groupOf(root, 'Banking'))).toEqual(['kind:iban']);
    expect(tilesOf(groupOf(root, 'Text')).slice(-1)).toEqual(['kind:sku']);
    const names = [...root.querySelectorAll('.fd-tool-group')].filter(shown).map((g) => g.querySelector('.fd-tool-heading-name')?.textContent);
    expect(names.slice(-2)).toEqual(['Banking', 'Layout']);
    // A kind with no icon of its own: a text box's.
    expect(groupOf(root, 'Text')?.querySelector('[data-tool="kind:sku"] svg')?.innerHTML).toBe(root.querySelector('[data-tool="kind:short-answer"] svg')?.innerHTML);
  });

  it('draws with the app’s widget on the canvas, and is named on the field’s bar', () => {
    const { root, designer } = screen();
    (root.querySelector('[data-tool="kind:iban"]') as HTMLButtonElement).click();
    const id = lastNode(designer).id;
    const field = root.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;
    expect(field.querySelector('.app-iban')).not.toBeNull();
    expect(field.querySelector('.fd-bar-kind')?.getAttribute('aria-label')).toBe('Show as: IBAN');
  });

  it('is offered in “Shown as” on the field’s bar, under its group', () => {
    const { root, designer } = screen();
    const id = designer.addQuestion('short-answer') as string;
    designer.select(id);
    (root.querySelector(`.fd-canvas-field[data-node="${id}"] .fd-bar-kind`) as HTMLButtonElement).click();
    const menu = document.querySelector('.fd-menu') as HTMLElement;
    const headings = [...menu.querySelectorAll('.fd-menu-heading')].map((h) => h.textContent);
    expect(headings[headings.length - 1]).toBe('Your kinds');
    (menu.querySelector('[data-item="iban"]') as HTMLButtonElement).click();
    expect(lastNode(designer).widget).toBe('iban');
  });

  it('shows its own settings on the panel’s Content tab, and on the field picked', () => {
    const { root, designer } = screen();
    (root.querySelector('[data-tool="kind:iban"]') as HTMLButtonElement).click();
    const row = root.querySelector('.fd-properties [data-setting="IBAN settings"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.dataset['tab']).toBe('content');
    const country = row.querySelector('select[aria-label="Country"]') as HTMLSelectElement;
    choose(country, 'EG');
    expect(lastNode(designer).options).toEqual({ country: 'EG' });
    // The field's own settings on the canvas, drawn again with it.
    expect((root.querySelector('.fd-canvas-field.fd-editing select[aria-label="Country"]') as HTMLSelectElement).value).toBe('EG');
    expect((root.querySelector('.fd-canvas-field.fd-editing .app-iban') as HTMLElement).dataset['country']).toBe('EG');
  });

  it('has no settings row for a kind without settings, nor for another kind', () => {
    const settingsShown = (root: Element) => [...root.querySelectorAll<HTMLElement>('.fd-properties [data-setting$=" settings"]')].filter((r) => !r.hidden && shown(r)).length;
    const plain = screen([{ ...iban, settings: undefined }]);
    plain.designer.select(plain.designer.addQuestion('iban') as string);
    expect(settingsShown(plain.root)).toBe(0);
    screenHandle?.destroy();
    const other = screen();
    other.designer.select(other.designer.addQuestion('short-answer') as string);
    expect(settingsShown(other.root)).toBe(0);
    other.designer.select(other.designer.addQuestion('iban') as string);
    expect(settingsShown(other.root)).toBe(1);
  });

  it('works in Try it with the app’s widget, and is added from Find anything', () => {
    const { root, designer } = screen();
    expect(findWords(root)).toContain('Add a field: IBAN');
    designer.addQuestion('iban');
    (root.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    expect(root.querySelector('.fd-try-frame .app-iban')).not.toBeNull();
  });
});
