import { blankPage, createDesigner, type Designer } from './designer';
import { elementFactory } from './chrome';
import { outlineView, type OutlineView } from './outline-view';
import { employeeDesigner } from './test-layout';

/**
 * The outline as a tree a screen reader and a keyboard know: a tree of rows,
 * each with its level, its place among its own, whether it is open, and
 * whether it is picked; one row to Tab to, and the arrows, Home, End and
 * letters to go from row to row.
 */

let view: OutlineView;
let designer: Designer;
let revealed: string[];

function mount(d: Designer = employeeDesigner(), options: { several?: boolean } = {}) {
  designer = d;
  revealed = [];
  view = outlineView({ el: elementFactory(document), doc: document, designer, survey: false, reveal: (id) => revealed.push(id), several: () => options.several ?? true, say: () => undefined });
  document.body.append(view.element);
  view.update(designer.getState(), true);
  designer.subscribe((state) => view.update(state, true));
  return view;
}
afterEach(() => document.body.replaceChildren());

const tree = () => view.element.querySelector('[role="tree"]') as HTMLElement;
const row = (id: string) => view.element.querySelector(`[role="treeitem"][data-pick="${id}"]`) as HTMLElement;
const rows = () => [...view.element.querySelectorAll<HTMLElement>('[role="treeitem"]')];
const ids = () => rows().map((r) => r.dataset['pick']);
const focused = () => (document.activeElement as HTMLElement | null)?.dataset['pick'];
const key = (name: string, more: KeyboardEventInit = {}) => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...more }));

describe('the outline as a tree', () => {
  it('is a tree of rows, each with its level, its place among its own, and open or not', () => {
    mount();
    expect(tree().getAttribute('aria-label')).toBe('The page’s parts');
    expect(tree().getAttribute('aria-multiselectable')).toBe('true');
    expect(row('personal').getAttribute('aria-level')).toBe('1');
    expect(row('who').getAttribute('aria-level')).toBe('2');
    expect(row('f-email').getAttribute('aria-level')).toBe('3');
    expect(row('f-email').getAttribute('aria-posinset')).toBe('3');
    expect(row('f-email').getAttribute('aria-setsize')).toBe('6');
    expect(row('personal').getAttribute('aria-expanded')).toBe('true');
    expect(row('f-email').hasAttribute('aria-expanded')).toBe(false);
  });

  it('reads an arrangement as what it is: side by side, or columns', () => {
    mount();
    expect(row('side-1').querySelector('.fd-outline-label')?.textContent).toBe('Side by side');
    expect(row('who').querySelector('.fd-outline-label')?.textContent).toBe('2 columns');
    expect(row('f-email').getAttribute('aria-label')).toBe('Work email, Email, required');
  });

  it('marks what is picked, and has one row to Tab to: the one picked, or the first', () => {
    mount();
    expect(rows().filter((r) => r.tabIndex === 0).map((r) => r.dataset['pick'])).toEqual(['personal']);
    designer.select('f-city');
    expect(row('f-city').getAttribute('aria-selected')).toBe('true');
    expect(row('f-street').getAttribute('aria-selected')).toBe('false');
    expect(rows().filter((r) => r.tabIndex === 0).map((r) => r.dataset['pick'])).toEqual(['f-city']);
  });

  it('↓ and ↑ go from row to row, picking each, and show it on the page', () => {
    mount();
    row('personal').focus();
    key('ArrowDown');
    expect(focused()).toBe('f-photo');
    expect(designer.getState().picked).toEqual(['f-photo']);
    expect(revealed).toEqual(['f-photo']);
    key('ArrowDown');
    key('ArrowUp');
    expect(focused()).toBe('f-photo');
    expect(rows().filter((r) => r.tabIndex === 0)).toHaveLength(1);
  });

  it('← folds a row and → opens it again; Home and End go to the ends', () => {
    mount();
    row('personal').focus();
    key('ArrowLeft');
    expect(row('personal').getAttribute('aria-expanded')).toBe('false');
    expect(row('f-photo')).toBeNull();
    key('ArrowDown');
    expect(focused()).toBe('side-1');
    key('Home');
    key('ArrowRight');
    expect(row('personal').getAttribute('aria-expanded')).toBe('true');
    key('ArrowRight');
    expect(focused()).toBe('f-photo');
    key('ArrowLeft');
    expect(focused()).toBe('personal');
    key('End');
    expect(focused()).toBe('send');
  });

  it('keeps what is folded while the page changes', () => {
    mount();
    row('tab-job').focus();
    key('ArrowLeft');
    designer.updateQuestion('f-city', { label: 'Town' });
    expect(row('tab-job').getAttribute('aria-expanded')).toBe('false');
    expect(row('f-job_title')).toBeNull();
    expect(row('f-city').textContent).toContain('Town');
  });

  it('a click on the arrow folds the row without picking it', () => {
    mount();
    (row('who').querySelector('[data-twist]') as HTMLElement).click();
    expect(row('who').getAttribute('aria-expanded')).toBe('false');
    expect(designer.getState().picked).toEqual([]);
  });

  it('letters go to the next row whose name starts with them', () => {
    mount();
    row('personal').focus();
    key('c');
    expect(focused()).toBe('f-city');
    key('o');
    expect(focused()).toBe('f-country');
  });

  it('Enter picks the row and shows it on the page; a click does too', () => {
    mount();
    row('personal').focus();
    key('ArrowDown');
    revealed = [];
    designer.select(null);
    key('Enter');
    expect(designer.getState().picked).toEqual(['f-photo']);
    expect(revealed).toEqual(['f-photo']);
    row('f-city').click();
    expect(designer.getState().selected).toBe('f-city');
    expect(focused()).toBe('f-city');
  });

  it('keeps the row it is on focused while the page changes around it', () => {
    mount();
    row('f-city').click();
    designer.updateQuestion('f-street', { label: 'Street' });
    expect(focused()).toBe('f-city');
  });

  it('right to left, ← opens and → folds', () => {
    mount();
    view.element.setAttribute('dir', 'rtl');
    view.element.style.direction = 'rtl';
    row('who').focus();
    key('ArrowRight');
    expect(row('who').getAttribute('aria-expanded')).toBe('false');
    key('ArrowLeft');
    expect(row('who').getAttribute('aria-expanded')).toBe('true');
  });

  it('outlines a survey’s pages and questions; a page holds its questions', () => {
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    d.addQuestion('short-answer');
    mount(d);
    expect(ids()).toEqual(['step-1', 'q-1']);
    expect(row('step-1').getAttribute('aria-expanded')).toBe('true');
    expect(row('q-1').getAttribute('aria-level')).toBe('2');
  });
});
