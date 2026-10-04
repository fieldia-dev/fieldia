import { elementFactory } from './chrome';
import type { Designer } from './designer';
import { outlineView, type OutlineView } from './outline-view';
import { employeeDesigner } from './test-layout';

/**
 * Dragging rows of the outline, as the approved mockup drags them: a line
 * where the row would go, drawn as far in as the depth it lands at, or the
 * row it would go into washed; a chip by the pointer saying so in words, or
 * saying why not. Let go, it moves there as one edit, said aloud.
 */

const ROW = 28;
let view: OutlineView;
let designer: Designer;
let said: string[];
let rail: HTMLElement;

function mount() {
  designer = employeeDesigner();
  said = [];
  rail = document.createElement('div');
  document.body.append(rail);
  const tree = () => view.element.querySelector('[role="tree"]') as HTMLElement;
  const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  const rectOf = (element: Element): DOMRect => {
    if (element === rail) return box(0, 0, 228, 400);
    const rows = [...tree().children].filter((c) => c.getAttribute('role') === 'treeitem');
    if (element === tree()) return box(0, -rail.scrollTop, 228, rows.length * ROW - rail.scrollTop);
    const at = rows.indexOf(element);
    return at === -1 ? element.getBoundingClientRect() : box(0, at * ROW - rail.scrollTop, 228, (at + 1) * ROW - rail.scrollTop);
  };
  view = outlineView({ el: elementFactory(document), doc: document, designer, survey: false, reveal: () => undefined, several: () => true, say: (words) => said.push(words), rectOf });
  rail.append(view.element);
  view.update(designer.getState(), true);
  designer.subscribe((state) => view.update(state, true));
}
afterEach(() => {
  document.body.replaceChildren();
  jest.useRealTimers();
});

const row = (id: string) => view.element.querySelector(`[role="treeitem"][data-pick="${id}"]`) as HTMLElement;
const index = (id: string) => [...view.element.querySelectorAll('[role="treeitem"]')].indexOf(row(id));
/** The point a fraction of the way down a row, `x` across. */
const on = (id: string, fraction: number, x = 120) => ({ x, y: index(id) * ROW + fraction * ROW - rail.scrollTop });
const pointer = (type: string, target: EventTarget, at: { x: number; y: number }) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, button: 0 }));
/** Press on a row, move there in steps of 40 to 80 pixels, as a hand does, and maybe let go. */
function drag(from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  pointer('pointerdown', document.elementFromPoint?.(from.x, from.y) ?? rowAt(from.y), from);
  const steps = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 60));
  for (let i = 1; i <= steps; i++) pointer('pointermove', document, { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (release) pointer('pointerup', document, to);
}
const rowAt = (y: number) => [...view.element.querySelectorAll('[role="treeitem"]')][Math.floor((y + rail.scrollTop) / ROW)] as HTMLElement;
const chip = () => document.querySelector('.fd-outline-chip') as HTMLElement | null;
const line = () => view.element.querySelector('.fd-outline-line') as HTMLElement | null;
const kids = (id: string) => JSON.stringify(designer.getPage()).includes(id) && (function find(nodes: { id: string; children?: unknown[] }[]): string[] {
  for (const n of nodes) {
    if (n.id === id) return ((n.children ?? []) as { id: string }[]).map((c) => c.id);
    const deeper = find((n.children ?? []) as never);
    if (deeper.length) return deeper;
  }
  return [];
})((designer.getPage().layout as unknown as { children: never[] }).children);

describe('dragging in the outline', () => {
  beforeEach(() => (document.elementFromPoint = undefined as never));

  it('a row let go on the middle of a group goes into it, at its end; the group is washed while it would', () => {
    mount();
    drag(on('f-email', 0.5), on('address', 0.5), false);
    expect(row('address').classList.contains('fd-outline-into')).toBe(true);
    expect(row('f-email').classList.contains('fd-outline-carried')).toBe(true);
    expect(chip()?.textContent).toBe('Work emailinto “Home address”, at the end');
    expect(line()?.hidden).toBe(true);
    pointer('pointerup', document, on('address', 0.5));
    expect(kids('address')).toEqual(['f-street', 'f-city', 'f-postcode', 'f-country', 'f-email']);
    expect(said).toEqual(['Work email: into “Home address”, at the end']);
    expect(chip()).toBeNull();
    expect(row('f-email').classList.contains('fd-outline-carried')).toBe(false);
  });

  it('a line between rows, drawn as far in as the depth it lands at', () => {
    mount();
    drag(on('f-email', 0.5), on('f-city', 0.1), false);
    expect(line()?.hidden).toBe(false);
    expect(line()?.style.getPropertyValue('--fd-drop-level')).toBe('2');
    expect(line()?.style.top).toBe(`${index('f-city') * ROW}px`);
    expect(chip()?.querySelector('.fd-outline-chip-where')?.textContent).toBe('into “Home address”, before “City”');
    pointer('pointerup', document, on('f-city', 0.1));
    expect(kids('address')).toEqual(['f-street', 'f-email', 'f-city', 'f-postcode', 'f-country']);
  });

  it('moved across as well as down, it lands shallower: out of a group, after it', () => {
    mount();
    // Under “Country”, the last of Home address, the pointer a row's indent nearer the start.
    drag(on('f-street', 0.5, 120), on('f-country', 0.9, 106));
    expect(kids('side-1')).toEqual(['address', 'f-street', 'emergency']);
  });

  it('says why not where it cannot go, and changes nothing there', () => {
    mount();
    const before = designer.getPage();
    drag(on('personal', 0.5), on('f-email', 0.5), false);
    expect(chip()?.classList.contains('fd-outline-refused')).toBe(true);
    expect(chip()?.querySelector('.fd-outline-chip-where')?.textContent).toBe('A part cannot go inside itself');
    expect(line()?.classList.contains('fd-outline-line-refused')).toBe(true);
    pointer('pointerup', document, on('f-email', 0.5));
    expect(designer.getPage()).toBe(before);
    expect(said).toEqual(['A part cannot go inside itself']);
  });

  it('a tab over another tab goes before or after it, among its tabs', () => {
    mount();
    drag(on('tab-pay', 0.5), on('tab-job', 0.2));
    expect(kids('job-tabs')).toEqual(['tab-pay', 'tab-job', 'tab-docs']);
  });

  it('carries every row picked, when it starts on one of them', () => {
    mount();
    designer.pickMany(['f-first_name', 'f-last_name']);
    drag(on('f-last_name', 0.5), on('emergency', 0.5));
    expect(kids('emergency')).toEqual(['f-ec_name', 'f-ec_relation', 'f-ec_phone', 'f-first_name', 'f-last_name']);
    expect(said).toEqual(['2 parts: into “Emergency contact”, at the end']);
    expect(designer.getState().picked).toEqual(['f-first_name', 'f-last_name']);
  });

  it('Escape puts it back down where it was', () => {
    mount();
    const before = designer.getPage();
    drag(on('f-email', 0.5), on('address', 0.5), false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    pointer('pointerup', document, on('address', 0.5));
    expect(designer.getPage()).toBe(before);
    expect(chip()).toBeNull();
  });

  it('a press that does not move is a click: it picks', () => {
    mount();
    pointer('pointerdown', row('f-city'), on('f-city', 0.5));
    pointer('pointerup', document, on('f-city', 0.5));
    row('f-city').click();
    expect(designer.getState().picked).toEqual(['f-city']);
  });

  it('held near the bottom of the rail, the rail scrolls under it', () => {
    jest.useFakeTimers();
    mount();
    Object.defineProperty(rail, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(rail, 'scrollHeight', { value: 2000, configurable: true });
    rail.style.overflowY = 'auto';
    drag(on('f-email', 0.5), { x: 120, y: 392 }, false);
    jest.advanceTimersByTime(600);
    expect(rail.scrollTop).toBeGreaterThan(0);
    pointer('pointerup', document, { x: 120, y: 392 });
  });
});
