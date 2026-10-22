import { elementFactory } from './chrome';
import { DESIGNER_WORDS } from './designer-words';
import { toolsSheet } from './tools-sheet';

/** The toolbox where it cannot sit beside the page: behind a +, in a sheet that is a dialog while it is open. */
describe('the toolbox’s sheet', () => {
  const el = elementFactory(document);
  const setup = () => {
    const tab = el('button', { type: 'button', role: 'tab', 'aria-selected': 'true' }, 'Add');
    const tile = el('button', { type: 'button', class: 'fd-tool' }, 'Dropdown');
    const side = el('aside', { class: 'fd-rail' }, tab, tile);
    const canvas = el('div', { class: 'fd-canvas' });
    const body = el('div', { class: 'fd-survey-body' }, side, canvas);
    const plus = el('button', { type: 'button', 'aria-expanded': 'false' }, '+');
    const root = el('div', { class: 'fd-designer' }, body, plus);
    document.body.append(root);
    const sheet = toolsSheet({ el, doc: document, root, side, words: DESIGNER_WORDS.en });
    return { root, body, side, canvas, plus, tab, tile, sheet };
  };
  afterEach(() => document.body.replaceChildren());

  it('holds the editor’s side while it is up, as a dialog, the + saying so; and gives it back to its place', () => {
    const { root, body, side, canvas, plus, tab, sheet } = setup();
    sheet.show(plus);
    expect(sheet.open).toBe(true);
    const dialog = root.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Add, outline and data');
    expect(dialog.contains(side)).toBe(true);
    expect(plus.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(tab);
    sheet.close();
    expect(sheet.open).toBe(false);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect([...body.children]).toEqual([side, canvas]);
    expect(plus.getAttribute('aria-expanded')).toBe('false');
  });

  it('goes on Escape, by its ×, and at a press beside it, and not at a press in it', () => {
    const { root, plus, tile, sheet } = setup();
    sheet.show(plus);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    tile.dispatchEvent(escape);
    expect(sheet.open).toBe(false);
    expect(escape.defaultPrevented).toBe(true);
    sheet.show(plus);
    (root.querySelector('[aria-label="Close the toolbox"]') as HTMLButtonElement).click();
    expect(sheet.open).toBe(false);
    sheet.show(plus);
    tile.click();
    expect(sheet.open).toBe(true);
    (root.querySelector('.fd-tools-backdrop') as HTMLElement).click();
    expect(sheet.open).toBe(false);
  });

  it('puts itself away before a pick runs, so what the pick makes takes the focus', () => {
    const { plus, sheet, canvas } = setup();
    const made = el('input', { 'aria-label': 'Question' });
    sheet.show(plus);
    let openWhileRunning = true;
    sheet.closeFor(() => {
      openWhileRunning = sheet.open;
      canvas.append(made);
      made.focus();
    });
    expect(openWhileRunning).toBe(false);
    expect(document.activeElement).toBe(made);
    // Shut, a pick simply runs.
    let ran = false;
    sheet.closeFor(() => (ran = true));
    expect(ran).toBe(true);
  });
});
