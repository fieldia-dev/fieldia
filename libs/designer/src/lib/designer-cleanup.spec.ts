import { answerButton } from './answer-picker';
import { canvasGuides } from './canvas-guides';
import { elementFactory } from './chrome';
import { blankPage, createDesigner, UNDO_STEPS } from './designer';
import { closeMenusIn, openMenu } from './menu';
import { mountScreenEditor } from './screen-editor';
import { employeePage, watched } from './test-layout';

/**
 * What the designer keeps is let go (the performance audit's L2): the guides' ResizeObserver lets a cell go once the
 * canvas no longer has it, and disconnects as the canvas is taken away; Undo keeps the last UNDO_STEPS edits, not every
 * page a long session ever had; a menu or a list of answers open as its editor is taken away takes its listener on the
 * document with it.
 */

/** The document's capture listeners for a press, as they are added and taken away. */
function pressListeners() {
  const live = new Set<EventListenerOrEventListenerObject>();
  const add = jest.spyOn(document, 'addEventListener').mockImplementation(function (this: Document, type, listener, options) {
    if (type === 'pointerdown' && listener && (options === true || (typeof options === 'object' && options.capture))) live.add(listener);
    return EventTarget.prototype.addEventListener.call(this, type, listener, options);
  });
  const remove = jest.spyOn(document, 'removeEventListener').mockImplementation(function (this: Document, type, listener, options) {
    if (type === 'pointerdown' && listener) live.delete(listener);
    return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
  });
  return { live, restore: () => (add.mockRestore(), remove.mockRestore()) };
}

describe('a menu open as its editor is taken away', () => {
  it('closes, its listener on the document gone with it — a menu and a list of answers alike', () => {
    const presses = pressListeners();
    try {
      const designer = createDesigner({ page: blankPage('screen', 'Visit report') });
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      // The document's own watch on presses, once a document whatever is mounted (press.ts): there before it.
      mountScreenEditor(host, { designer }).destroy();
      const once = presses.live.size;
      const editor = mountScreenEditor(host, { designer });
      const root = host.firstElementChild as HTMLElement;
      const el = elementFactory(document);
      const anchor = el('button', { type: 'button' }, 'More');
      const box = el('input', { 'aria-label': 'Title' }) as HTMLInputElement;
      const picker = answerButton(el, designer, box);
      root.append(anchor, box, picker);
      const before = presses.live.size;
      openMenu({ el, anchor, items: [{ id: 'a', label: 'A' }], onPick: () => undefined });
      picker.click();
      expect(document.querySelectorAll('.fd-menu')).toHaveLength(2);
      expect(presses.live.size).toBe(before + 2);
      editor.destroy();
      expect(document.querySelector('.fd-menu')).toBeNull();
      expect(presses.live.size).toBe(once);
    } finally {
      presses.restore();
    }
  });

  it('closeMenusIn leaves a menu of another editor open', () => {
    const el = elementFactory(document);
    const mine = el('div', { class: 'fd-form' }, el('button', { type: 'button' }, 'Mine'));
    const theirs = el('div', { class: 'fd-form' }, el('button', { type: 'button' }, 'Theirs'));
    document.body.replaceChildren(mine, theirs);
    openMenu({ el, anchor: theirs.firstElementChild as HTMLElement, items: [{ id: 'a', label: 'A' }], onPick: () => undefined });
    closeMenusIn(mine);
    expect(theirs.querySelector('.fd-menu')).not.toBeNull();
    closeMenusIn(theirs);
    expect(theirs.querySelector('.fd-menu')).toBeNull();
  });
});

describe('the canvas guides’ watch on shared cells', () => {
  it('lets a cell go once it is gone, and disconnects as the canvas is taken away', () => {
    const live = new Set<Element>();
    let disconnected = 0;
    const real = window.ResizeObserver;
    window.ResizeObserver = class {
      observe(target: Element) {
        live.add(target);
      }
      unobserve(target: Element) {
        live.delete(target);
      }
      disconnect() {
        disconnected++;
        live.clear();
      }
    } as unknown as typeof ResizeObserver;
    try {
      const designer = watched(createDesigner({ page: employeePage() }));
      const root = document.createElement('div');
      root.dataset['container'] = 'root';
      document.body.replaceChildren(root);
      const drawShared = () => {
        // A shared cell and its grid, drawn anew as the canvas redraws.
        const section = document.createElement('fieldset');
        section.dataset['node'] = 'personal';
        const grid = document.createElement('div');
        grid.dataset['container'] = 'personal';
        const cell = document.createElement('div');
        cell.dataset['node'] = 'who';
        cell.dataset['place'] = 'shared';
        const inner = document.createElement('div');
        inner.dataset['container'] = 'who';
        inner.style.setProperty('--fd-columns', '2');
        cell.append(inner);
        grid.append(cell);
        section.append(grid);
        root.replaceChildren(section);
        return cell;
      };
      const guides = canvasGuides({ root, designer });
      designer.select('who');
      for (let redraw = 0; redraw < 30; redraw++) {
        const cell = drawShared();
        guides.update(designer.getState(), true);
        expect(live.has(cell)).toBe(true);
      }
      // One cell on the canvas, one watched: never the thirty it has drawn.
      expect(live.size).toBe(1);
      guides.destroy();
      expect(disconnected).toBe(1);
      expect(live.size).toBe(0);
    } finally {
      if (real) window.ResizeObserver = real;
      else delete (window as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });
});

describe('Undo’s history', () => {
  it(`keeps the last ${UNDO_STEPS} edits`, () => {
    const designer = createDesigner({ page: blankPage('survey', 'Long session') });
    const a = designer.addQuestion('short-answer') as string;
    const b = designer.addQuestion('short-answer') as string;
    // Each label typed in turn into one question and the other: an edit of its own each time.
    for (let edit = 0; edit < UNDO_STEPS + 50; edit++) designer.updateQuestion(edit % 2 ? b : a, { label: `Label ${edit}` });
    let undone = 0;
    while (designer.getState().canUndo) {
      designer.undo();
      undone++;
    }
    expect(undone).toBe(UNDO_STEPS);
    // Back to where the history starts: the labels as they were 200 edits ago, and Redo brings each one back.
    for (let redo = 0; redo < UNDO_STEPS; redo++) designer.redo();
    expect(designer.getState().canRedo).toBe(false);
  });
});
