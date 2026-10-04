import type { Field } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { screenCanvas, type ScreenCanvas } from './screen-canvas';

/**
 * Typing in one field of a big screen redraws that field, not the others: a
 * card whose field did not change, nor whether it is picked, nor the record
 * filling the page, is left as it was drawn — and one that did is drawn again.
 */

const model: Record<string, Field> = { state: { type: 'selection', label: 'Status', options: [{ value: 'a', label: 'Active' }] } };
let canvas: ScreenCanvas;
afterEach(() => {
  canvas?.destroy();
  document.body.replaceChildren();
});

function setup() {
  const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
  canvas = screenCanvas({ designer, doc: document, more: () => undefined, dropTool: () => undefined });
  document.body.append(canvas.element);
  designer.subscribe((state) => canvas.update(state));
  const ids = ['Customer', 'Visit date', 'Notes'].map((words) => {
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: words, help: `About ${words}` });
    return id;
  });
  designer.select(null);
  canvas.update(designer.getState());
  const card = (id: string) => canvas.element.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;
  /** The words drawn for a card's label: written again, they are a new text. */
  const words = (id: string) => card(id).querySelector('.fd-label')?.firstChild;
  return { designer, ids, card, words };
}

/** What was written to `root` while `act` ran, as the elements written to. */
function written(root: Element, act: () => void): Element[] {
  const watch = new MutationObserver(() => undefined);
  watch.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  act();
  const records = watch.takeRecords();
  watch.disconnect();
  return records.map((r) => (r.target.nodeType === Node.TEXT_NODE ? (r.target.parentElement as Element) : (r.target as Element)));
}

describe('a big screen, edited', () => {
  it('writes to nothing but the field typed in, its sections and the others left as they were', () => {
    const { designer, ids, card } = setup();
    designer.addContainer('Second');
    designer.setLook({ font: 'serif', accent: '#225588' });
    designer.select(ids[0]);
    expect(canvas.element.getAttribute('data-font')).toBe('serif');
    const parts = written(canvas.element, () => designer.updateQuestion(ids[0], { label: 'Client' }));
    expect(parts.filter((part) => !card(ids[0]).contains(part)).map((p) => p.outerHTML.slice(0, 90))).toEqual([]);
    designer.setLook({ font: null });
    expect(canvas.element.hasAttribute('data-font')).toBe(false);
    expect(canvas.element.getAttribute('data-accent')).not.toBeNull();
  });


  it('leaves the cards of fields it did not touch as they were drawn', () => {
    const { designer, ids, card, words } = setup();
    const [customer, date, notes] = ids;
    const drawn = { date: words(date), notes: words(notes), help: card(notes).querySelector('.fd-help')?.firstChild, widget: card(notes).querySelector('.fd-canvas-widget')?.firstChild };
    designer.updateQuestion(customer, { label: 'Client' });
    expect(card(customer).querySelector('.fd-label')?.textContent).toBe('Client');
    expect(words(date)).toBe(drawn.date);
    expect(words(notes)).toBe(drawn.notes);
    expect(card(notes).querySelector('.fd-help')?.firstChild).toBe(drawn.help);
    expect(card(notes).querySelector('.fd-canvas-widget')?.firstChild).toBe(drawn.widget);
  });

  it('draws a card again when its field changes, when it is picked with others, and for a record filling the page', () => {
    const { designer, ids, card, words } = setup();
    const [customer, date, notes] = ids;
    const drawn = words(notes);
    designer.updateQuestion(notes, { label: 'Remarks', required: true });
    expect(words(notes)).not.toBe(drawn);
    expect(card(notes).querySelector('.fd-label')?.textContent).toBe('Remarks');
    expect(card(notes).classList.contains('fd-required')).toBe(true);
    designer.pickMany([customer, date]);
    expect(card(date).classList.contains('fd-canvas-picked')).toBe(true);
    designer.select(null);
    expect(card(date).classList.contains('fd-canvas-picked')).toBe(false);
    const widget = card(date).querySelector('.fd-canvas-widget')?.firstChild;
    canvas.setSample(0);
    canvas.update(designer.getState());
    expect(card(date).querySelector('.fd-canvas-widget')?.firstChild).not.toBe(widget);
  });

  it('opens the field picked to edit in place, and closes it again as it was', () => {
    const { designer, ids, card } = setup();
    designer.select(ids[1]);
    expect(card(ids[1]).classList.contains('fd-editing')).toBe(true);
    expect((card(ids[1]).querySelector('.fd-canvas-label-input') as HTMLInputElement).value).toBe('Visit date');
    designer.select(null);
    expect(card(ids[1]).classList.contains('fd-editing')).toBe(false);
    expect(card(ids[1]).querySelector('.fd-label')?.textContent).toBe('Visit date');
    expect(card(ids[1]).querySelector('.fd-help')?.textContent).toBe('About Visit date');
  });
});
