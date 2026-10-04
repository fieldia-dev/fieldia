import type { LayoutNode, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * How a page is laid out: groups side by side, arrangements on their grid's
 * columns, the look of each group, where labels sit, and the widths of tabs,
 * words and buttons. What a browser draws from these is checked in
 * e2e/layout.spec.ts; here, what the viewer hands the stylesheet.
 */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const field = (id: string, extra: Record<string, unknown> = {}): LayoutNode => ({ type: 'field', id, field: id, ...extra }) as LayoutNode;

const fields = {
  photo: { type: 'image', label: 'Photo' },
  first: { type: 'char', label: 'First name' },
  last: { type: 'char', label: 'Last name' },
  email: { type: 'char', label: 'Work email' },
  a: { type: 'char', label: 'Amount' },
  b: { type: 'char', label: 'Unit' },
  c: { type: 'char', label: 'Inner' },
  street: { type: 'char', label: 'Street' },
  phone: { type: 'char', label: 'Phone' },
  role: { type: 'char', label: 'Role' },
  team: { type: 'char', label: 'Team' },
  rate: { type: 'matrix', label: 'How was it?', rows: [{ value: 'food', label: 'Food' }], columns: [{ value: 1, label: 'Poor' }, { value: 2, label: 'Fine' }] },
} as Page['fields'];

const page = (children: LayoutNode[], extra: Partial<Page> = {}): Page => ({
  fieldia: '0.1',
  id: 'layout',
  data: { kind: 'responses' },
  fields,
  layout: { type: 'sections', id: 'root', children },
  ...extra,
});

function mount(p: Page) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: p, skin: 'outlined' });
  return host;
}
const at = (host: Element, id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
const gridOf = (section: HTMLElement) => section.querySelector(':scope > .fd-grid') as HTMLElement;
const span = (element: HTMLElement) => element.style.getPropertyValue('--fd-span');

/** The mockup's "Personal details": a photo beside a block of two columns, in a card of three. */
const personal: LayoutNode = {
  type: 'section', id: 'personal', title: 'Personal details', columns: { wide: 3, medium: 3, narrow: 1 }, labels: 'beside', labelWidth: 120,
  children: [
    field('photo'),
    { type: 'section', id: 'who', style: 'plain', colspan: 2, columns: 2, children: [field('first', { labels: 'hidden' }), field('last'), field('email', { labels: 'hidden', placeholder: 'name@acme.com' })] },
    { type: 'section', id: 'pair', style: 'plain', columns: 2, children: [field('a'), field('b')] },
    { type: 'section', id: 'inner', title: 'Inner', style: 'framed', colspan: 2, labels: 'above', children: [field('c')] },
    { type: 'section', id: 'nested-card', title: 'Nested', children: [] },
  ],
};
/** Home address beside Emergency contact: two cards in an arrangement on the page. */
const sideBySide: LayoutNode = {
  type: 'section', id: 'side', style: 'plain', columns: { wide: 2, medium: 1 },
  children: [
    { type: 'section', id: 'home', title: 'Home address', children: [field('street')] },
    { type: 'section', id: 'emergency', title: 'Emergency contact', style: 'card', children: [field('phone')] },
  ],
};
const role: LayoutNode = {
  type: 'section', id: 'job', title: 'Role', style: 'line',
  children: [field('role'), { type: 'section', id: 'loose', style: 'plain', columns: 2, children: [field('team')] }, { type: 'section', id: 'in-line', title: 'Card in a line', children: [] }],
};

describe('groups side by side', () => {
  it('gives a group the columns it spans in the group round it', () => {
    const host = mount(page([personal]));
    expect(span(at(host, 'inner'))).toBe('2');
    expect(span(at(host, 'who'))).toBe('2');
    expect(span(at(host, 'pair'))).toBe('');
  });

  it('keeps each group’s columns at each width its own', () => {
    const host = mount(page([personal, sideBySide]));
    const grid = gridOf(at(host, 'personal'));
    expect(grid.style.getPropertyValue('--fd-columns')).toBe('3');
    expect(grid.getAttribute('data-columns-medium')).toBe('3');
    expect(grid.getAttribute('data-columns-narrow')).toBe('1');
    const side = gridOf(at(host, 'side'));
    expect(side.style.getPropertyValue('--fd-columns')).toBe('2');
    expect(side.getAttribute('data-columns-medium')).toBe('1');
  });
});

describe('arrangements: parts side by side or one under another, with nothing drawn', () => {
  it('lays an arrangement in a group with columns on the columns it covers there', () => {
    const host = mount(page([personal]));
    const who = at(host, 'who');
    expect(who.tagName).toBe('DIV');
    expect(who.getAttribute('data-place')).toBe('tracks');
    const grid = gridOf(who);
    // Its columns are its group's: none of its own, at any width.
    expect(grid.style.getPropertyValue('--fd-columns')).toBe('');
    expect(grid.getAttributeNames().filter((name) => name.startsWith('data-columns'))).toEqual([]);
    expect([...grid.children].map((c) => c.getAttribute('data-node'))).toEqual(['first', 'last', 'email']);
  });

  it('puts parts side by side in one cell when the arrangement is one column wide with columns of its own', () => {
    const host = mount(page([personal]));
    const pair = at(host, 'pair');
    expect(pair.getAttribute('data-place')).toBe('shared');
    expect(gridOf(pair).style.getPropertyValue('--fd-columns')).toBe('2');
  });

  it('gives an arrangement on the page, in a tab or in one column a grid of its own', () => {
    const host = mount(page([sideBySide, role]));
    expect(at(host, 'side').tagName).toBe('DIV');
    expect(at(host, 'side').hasAttribute('data-place')).toBe(false);
    expect(at(host, 'loose').hasAttribute('data-place')).toBe(false);
    expect(gridOf(at(host, 'loose')).style.getPropertyValue('--fd-columns')).toBe('2');
  });

  it('is a group with a name once it has a title, whatever its style', () => {
    const host = mount(page([{ type: 'section', id: 'titled', title: 'Titled', style: 'plain', children: [] }]));
    const titled = at(host, 'titled');
    expect(titled.tagName).toBe('FIELDSET');
    expect(titled.querySelector(':scope > legend')?.textContent).toBe('Titled');
    expect(titled.hasAttribute('data-place')).toBe(false);
  });
});

describe('how a group looks', () => {
  it('names its style for the stylesheet: a card unless it says otherwise', () => {
    const host = mount(page([personal, sideBySide, role]));
    expect(at(host, 'personal').getAttribute('data-style')).toBe('card');
    expect(at(host, 'inner').getAttribute('data-style')).toBe('framed');
    expect(at(host, 'job').getAttribute('data-style')).toBe('line');
    expect(at(host, 'who').getAttribute('data-style')).toBe('plain');
  });

  it('marks the cards that sit on the page itself, through arrangements, lines and tabs, and not those inside a box', () => {
    const tabs: LayoutNode = { type: 'tabs', id: 'tabs', children: [{ type: 'tab', id: 'tab', label: 'Job', children: [{ type: 'section', id: 'in-tab', title: 'In a tab', children: [] }] }] };
    const host = mount(page([personal, sideBySide, role, tabs]));
    const onPage = (id: string) => at(host, id).hasAttribute('data-on-page');
    expect(onPage('personal')).toBe(true);
    expect(onPage('home')).toBe(true);
    expect(onPage('emergency')).toBe(true);
    expect(onPage('in-line')).toBe(true);
    expect(onPage('in-tab')).toBe(true);
    expect(onPage('nested-card')).toBe(false);
    // Only a card is boxed by sitting on the page.
    expect(onPage('job')).toBe(false);
  });

  it('marks no card in a record sheet or a wizard’s step: the sheet and the step are the box', () => {
    const sheet = mount({ ...page([]), data: { kind: 'record', model: 'x' }, layout: { type: 'sheet', id: 'sheet', children: [{ type: 'section', id: 'on-sheet', title: 'On a sheet', children: [] }] } });
    expect(at(sheet, 'on-sheet').hasAttribute('data-on-page')).toBe(false);
    handle?.destroy();
    const wizard = mount({ ...page([]), layout: { type: 'wizard', id: 'w', children: [{ type: 'step', id: 'st', label: 'One', children: [{ type: 'section', id: 'in-step', title: 'In a step', children: [] }] }] } });
    expect(at(wizard, 'in-step').hasAttribute('data-on-page')).toBe(false);
  });
});

describe('where labels sit', () => {
  it('takes the field’s own place, else its nearest group’s, else the page’s', () => {
    const host = mount(page([personal, sideBySide], { look: { labels: 'above', labelWidth: 150 } }));
    const labels = (id: string) => at(host, id).getAttribute('data-labels');
    expect(labels('photo')).toBe('beside');
    expect(labels('last')).toBe('beside');
    expect(labels('first')).toBe('hidden');
    expect(labels('c')).toBe('above');
    expect(labels('street')).toBe('above');
  });

  it('leaves a field the skin’s own way when nothing says where its label goes', () => {
    const host = mount(page([sideBySide]));
    expect(at(host, 'street').hasAttribute('data-labels')).toBe(false);
  });

  it('hands a group’s label width to the fields inside it', () => {
    const host = mount(page([personal]));
    expect(at(host, 'personal').style.getPropertyValue('--fd-label-width')).toBe('120px');
  });

  it('keeps the label of a table above it: there is no room beside a table', () => {
    const host = mount(page([{ type: 'section', id: 's', labels: 'beside', children: [field('rate')] }]));
    expect(at(host, 'rate').getAttribute('data-labels')).toBe('above');
  });

  it('hides a label from sight, keeps it as the box’s name, and shows it in the empty box instead', () => {
    const host = mount(page([personal]));
    const first = at(host, 'first');
    const input = first.querySelector('input') as HTMLInputElement;
    const label = first.querySelector('.fd-label') as HTMLLabelElement;
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toBe('First name');
    expect(input.placeholder).toBe('First name');
    // A placeholder the page gives is kept.
    expect((at(host, 'email').querySelector('input') as HTMLInputElement).placeholder).toBe('name@acme.com');
  });
});

describe('widths for tabs, words and buttons', () => {
  it('lets tabs, words and buttons span columns in a group, like fields', () => {
    const host = mount(
      page([
        {
          type: 'section', id: 's', columns: 3,
          children: [
            { type: 'tabs', id: 'tb', colspan: 2, children: [{ type: 'tab', id: 'tab', label: 'One', children: [] }] },
            { type: 'text', id: 'note', text: 'Read this', style: 'note', colspan: 3 },
            { type: 'button', id: 'go', label: 'Go', action: 'go', colspan: 1 },
            { type: 'text', id: 'plain-text', text: 'No width' },
          ],
        },
      ])
    );
    expect(span(at(host, 'tb'))).toBe('2');
    expect(span(at(host, 'note'))).toBe('3');
    expect(span(at(host, 'go'))).toBe('1');
    expect(span(at(host, 'plain-text'))).toBe('');
  });
});
