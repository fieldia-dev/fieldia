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

let said: string[];

function mount(d: Designer = employeeDesigner(), options: { several?: boolean } = {}) {
  designer = d;
  revealed = [];
  said = [];
  view = outlineView({ el: elementFactory(document), doc: document, designer, survey: false, reveal: (id) => revealed.push(id), several: () => options.several ?? true, say: (words) => said.push(words) });
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

  it('names read in their own direction, and a group’s columns stay desktop first', () => {
    mount();
    expect(row('who').querySelector('.fd-outline-name')?.getAttribute('dir')).toBe('auto');
    expect(row('who').querySelector('.fd-outline-badge')?.getAttribute('dir')).toBe('ltr');
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

describe('several picked in the outline', () => {
  const click = (id: string, more: MouseEventInit = {}) => row(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...more }));
  const picked = () => designer.getState().picked;

  it('Shift-click picks every row from the one picked to the one clicked', () => {
    mount();
    click('f-first_name');
    click('f-mobile', { shiftKey: true });
    expect(picked()).toEqual(['f-first_name', 'f-last_name', 'f-email', 'f-mobile']);
    expect(designer.getState().selected).toBe('f-mobile');
    // From the same start, up the other way.
    click('f-photo', { shiftKey: true });
    expect(picked()).toEqual(['f-first_name', 'who', 'f-photo']);
    expect(rows().filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.dataset['pick'])).toEqual(['f-photo', 'who', 'f-first_name']);
  });

  it('⌘- or Ctrl-click adds a row, or lets it go, and a range starts from it', () => {
    mount();
    click('f-city');
    click('f-country', { metaKey: true });
    click('f-street', { ctrlKey: true });
    expect(picked()).toEqual(['f-city', 'f-country', 'f-street']);
    click('f-country', { metaKey: true });
    expect(picked()).toEqual(['f-city', 'f-street']);
    click('f-postcode', { shiftKey: true });
    expect(picked()).toEqual(['f-country', 'f-postcode']);
  });

  it('Shift with ↑ or ↓ takes the pick along', () => {
    mount();
    click('f-email');
    key('ArrowDown', { shiftKey: true });
    key('ArrowDown', { shiftKey: true });
    expect(picked()).toEqual(['f-email', 'f-mobile', 'f-birthday']);
    expect(focused()).toBe('f-birthday');
    key('ArrowUp', { shiftKey: true });
    expect(picked()).toEqual(['f-email', 'f-mobile']);
    key('ArrowDown');
    expect(picked()).toEqual(['f-birthday']);
  });

  it('picks one at a time where several cannot be picked: Simple on a screen', () => {
    mount(employeeDesigner(), { several: false });
    click('f-city');
    click('f-country', { shiftKey: true });
    expect(picked()).toEqual(['f-country']);
    click('f-street', { metaKey: true });
    expect(picked()).toEqual(['f-street']);
    key('ArrowDown', { shiftKey: true });
    expect(picked()).toEqual(['f-city']);
  });

  it('shows what is picked on the canvas, kept in step both ways', () => {
    mount();
    designer.pick('f-city');
    designer.pick('f-iban', { add: true });
    expect(rows().filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.dataset['pick'])).toEqual(['f-city', 'f-iban']);
  });

  it('a part picked on the canvas opens the rows round it, and comes into view in the outline', () => {
    mount();
    row('tab-pay').focus();
    key('ArrowLeft');
    row('personal').focus();
    key('ArrowLeft');
    expect(row('f-iban')).toBeNull();
    // The rail scrolls; its rows are 28px apart.
    const rail = document.createElement('div');
    rail.style.overflowY = 'auto';
    document.body.append(rail);
    rail.append(view.element);
    Object.defineProperty(rail, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(rail, 'scrollHeight', { value: 2000, configurable: true });
    rail.getBoundingClientRect = () => ({ top: 0, bottom: 200, left: 0, right: 228, width: 228, height: 200 }) as DOMRect;
    designer.select('f-iban');
    expect(row('tab-pay').getAttribute('aria-expanded')).toBe('true');
    expect(row('f-iban')).not.toBeNull();
    row('f-iban').getBoundingClientRect = () => ({ top: 900, bottom: 928, left: 0, right: 228, width: 228, height: 28 }) as DOMRect;
    designer.select('f-bank_name');
    designer.select('f-iban');
    expect(rail.scrollTop).toBe(728);
    // What the person folded and did not pick stays folded.
    expect(row('personal').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('moving rows from the keyboard', () => {
  const kids = (id: string) => [...view.element.querySelectorAll<HTMLElement>(`[role="treeitem"]`)].filter((r) => r.getAttribute('aria-level') === String(Number(row(id).getAttribute('aria-level')) + 1)).map((r) => r.dataset['pick']);

  it('Alt+↑ and Alt+↓ move the rows picked, each move said aloud; the row keeps the keyboard', () => {
    mount();
    row('f-city').click();
    key('ArrowUp', { altKey: true });
    expect(ids().slice(ids().indexOf('f-city') - 1, ids().indexOf('f-city') + 2)).toEqual(['address', 'f-city', 'f-street']);
    expect(said).toEqual(['City: before “Street and number”']);
    expect(focused()).toBe('f-city');
    key('ArrowDown', { altKey: true });
    expect(said[1]).toBe('City: after “Street and number”');
    expect(designer.getState().picked).toEqual(['f-city']);
  });

  it('Alt+← takes them out of their group, Alt+→ puts them in the group before', () => {
    mount();
    row('f-ec_name').click();
    key('ArrowLeft', { altKey: true });
    expect(said).toEqual(['Name: into “Side by side”, at the end']);
    expect(row('f-ec_name').getAttribute('aria-level')).toBe('2');
    key('ArrowRight', { altKey: true });
    expect(said[1]).toBe('Name: into “Emergency contact”, at the end');
    expect(kids('emergency')).toContain('f-ec_name');
  });

  it('says why when they cannot move, and moves nothing', () => {
    mount();
    const before = designer.getPage();
    row('f-street').click();
    key('ArrowUp', { altKey: true });
    expect(said).toEqual(['It is at the top of “Home address”: Alt+← takes it out']);
    row('tab-job').click();
    key('ArrowLeft', { altKey: true });
    expect(said[1]).toBe('A tab moves only among its tabs');
    expect(designer.getPage()).toBe(before);
  });

  it('moves several picked together', () => {
    mount();
    row('f-city').click();
    key('ArrowDown', { shiftKey: true });
    key('ArrowUp', { altKey: true });
    expect(said).toEqual(['2 parts: before “Street and number”']);
  });

  it('Delete takes every row picked off the page', () => {
    mount();
    row('f-city').click();
    key('ArrowDown', { shiftKey: true });
    key('Delete');
    expect(row('f-city')).toBeNull();
    expect(row('f-postcode')).toBeNull();
    expect(said).toEqual(['Took 2 off the page']);
    // The keyboard stays in the outline.
    expect(focused()).toBeTruthy();
  });
});
