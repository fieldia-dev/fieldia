import type { Field, SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { screenCanvas, type ScreenCanvas } from './screen-canvas';

const model: Record<string, Field> = {
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
  stage: { type: 'selection', label: 'Stage', options: [{ value: 'lead', label: 'Lead' }, { value: 'won', label: 'Won' }] },
  invoice_count: { type: 'integer', label: 'Invoices' },
};

let canvas: ScreenCanvas;
function setup() {
  const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
  const host = document.createElement('div');
  host.className = 'fd-form';
  document.body.append(host);
  canvas = screenCanvas({ designer, doc: document, more: () => undefined, dropTool: () => undefined });
  host.append(canvas.element);
  designer.subscribe((state) => canvas.update(state));
  canvas.update(designer.getState());
  const q = <T extends Element = HTMLElement>(selector: string) => canvas.element.querySelector(selector) as T;
  const add = (kind: string) => q<HTMLButtonElement>(`[data-add-part="${kind}"]`).click();
  return { designer, q, add, sheet: () => designer.getPage().layout as SheetNode };
}

afterEach(() => {
  canvas?.destroy();
  document.body.replaceChildren();
});

describe('a record’s header on the canvas', () => {
  it('offers to add each part where it goes, and nothing for a screen of sections', () => {
    const { q } = setup();
    expect(q('.fd-canvas-header').hidden).toBe(false);
    expect([...canvas.element.querySelectorAll('[data-add-part]')].map((b) => b.textContent)).toEqual(['Add a button', 'Add status steps', 'Add a counter', 'Add a badge']);
    const screen = createDesigner({ page: blankPage('screen', 'Visit') });
    const other = screenCanvas({ designer: screen, doc: document, more: () => undefined, dropTool: () => undefined });
    other.update(screen.getState());
    expect((other.element.querySelector('.fd-canvas-header') as HTMLElement).hidden).toBe(true);
    other.destroy();
  });

  it('adds a button that looks like the viewer’s, its words picked to be typed over where it stands', () => {
    const { designer, q, add, sheet } = setup();
    add('button');
    const id = sheet().buttons?.[0].id as string;
    expect(designer.getState().selected).toBe(id);
    const input = q<HTMLInputElement>(`[data-part="${id}"] input`);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
    input.value = 'Confirm';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sheet().buttons?.[0].label).toBe('Confirm');
    expect(q<HTMLInputElement>(`[data-part="${id}"] input`)).toBe(input);
    designer.select(null);
    const shown = q(`[data-part="${id}"]`);
    expect(shown.tagName).toBe('BUTTON');
    expect(shown.classList.contains('fd-button')).toBe(true);
    expect(shown.textContent).toBe('Confirm');
  });

  it('shows status steps as the real widget, from a field picked in a menu of the fields that can be steps', () => {
    const { designer, q, add, sheet } = setup();
    add('statusbar');
    const items = [...document.querySelectorAll('.fd-menu [role="menuitemradio"]')].map((i) => i.textContent);
    expect(items).toEqual(['Status', 'Stage']);
    (document.querySelector('.fd-menu [data-item="state"]') as HTMLElement).click();
    expect(sheet().statusbar).toEqual({ field: 'state' });
    expect(designer.getState().selected).toBe('#statusbar');
    const steps = q('[data-part="#statusbar"]');
    expect(steps.querySelector('.fd-canvas-widget')?.hasAttribute('inert')).toBe(true);
    expect(steps.textContent).toContain('Draft');
    expect(q('[data-add-part="statusbar"]')).toBeNull();
  });

  it('adds counters and badges on the card, each picked by a click', () => {
    const { designer, q, add, sheet } = setup();
    add('stat');
    add('badge');
    const stat = sheet().statButtons?.[0].id as string;
    const badge = sheet().badges?.[0].id as string;
    designer.select(null);
    expect(q(`.fd-stats [data-part="${stat}"]`).classList.contains('fd-stat')).toBe(true);
    expect(q(`.fd-badges [data-part="${badge}"]`).classList.contains('fd-badge')).toBe(true);
    q(`[data-part="${stat}"]`).click();
    expect(designer.getState().selected).toBe(stat);
    q(`[data-part="${badge}"]`).click();
    expect(designer.getState().selected).toBe(badge);
  });

  it('moves and deletes the part picked from the bar on it', () => {
    const { q, add, sheet } = setup();
    add('button');
    add('button');
    const [first, second] = sheet().buttons?.map((b) => b.id) as string[];
    q<HTMLButtonElement>(`[data-part="${second}"] [aria-label="Move left"]`).click();
    expect(sheet().buttons?.map((b) => b.id)).toEqual([second, first]);
    expect(q(`[data-part="${second}"] [aria-label="Move left"]`).hidden).toBe(true);
    q<HTMLButtonElement>(`[data-part="${second}"] [aria-label="Delete"]`).click();
    expect(sheet().buttons?.map((b) => b.id)).toEqual([first]);
  });
});
