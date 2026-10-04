import { validatePage, type Field, type LayoutNode, type Page, type SectionNode } from '@fieldia/core';
import { createDesigner, type Designer } from './designer';

/**
 * For the layout tests: the approved mockup's "New employee" page in Fieldia's
 * format, and what a test asks of a page — where a part sits, and in what.
 *
 * Personal details has three columns: the photo, then an arrangement two
 * columns wide of six fields. Home address and Emergency contact sit side by
 * side in a row; Job, Documents and Pay are tabs; then a line, a heading, a
 * note, a tick box and a button.
 */

const char = (label: string, extra: Partial<Field> = {}): Field => ({ type: 'char', label, ...extra }) as Field;
const choice = (label: string, ...options: string[]): Field => ({ type: 'selection', label, options: options.map((o) => ({ value: o.toLowerCase().replace(/\W+/g, '_'), label: o })) });
const f = (name: string, extra: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...extra }) as LayoutNode;

export function employeePage(): Page {
  return {
    fieldia: '0.1',
    id: 'new-employee',
    title: 'New employee',
    description: 'Everything HR needs from you before your first day.',
    data: { kind: 'record', model: 'hr.employee' },
    look: { accent: '#1677ff', font: 'system', density: 'comfortable', corners: 'soft', labels: 'above', labelWidth: 140 },
    fields: {
      photo: { type: 'image', label: 'Photo' },
      first_name: char('First name', { required: true }),
      last_name: char('Last name', { required: true }),
      email: char('Work email', { required: true }),
      mobile: char('Mobile'),
      birthday: { type: 'date', label: 'Date of birth' },
      nationality: choice('Nationality', 'Egyptian', 'Emirati', 'Saudi', 'Other'),
      street: char('Street and number'),
      city: char('City'),
      postcode: char('Postcode'),
      country: choice('Country', 'Egypt', 'United Arab Emirates', 'Saudi Arabia'),
      ec_name: char('Name', { required: true }),
      ec_relation: choice('Relation', 'Partner', 'Parent', 'Friend'),
      ec_phone: char('Phone', { required: true }),
      job_title: char('Job title', { required: true }),
      department: { type: 'many2one', label: 'Department', relation: 'hr.department' },
      manager: { type: 'many2one', label: 'Manager', relation: 'hr.employee' },
      start_date: { type: 'date', label: 'Start date', required: true },
      contract: choice('Contract', 'Permanent', 'Fixed term', 'Contractor'),
      end_date: { type: 'date', label: 'Contract ends' },
      salary: { type: 'monetary', label: 'Monthly salary', currency: 'EGP' },
      id_doc: { type: 'binary', label: 'ID or passport', required: true },
      contract_doc: { type: 'binary', label: 'Signed contract' },
      certificates: { type: 'binary', label: 'Certificates' },
      bank_name: char('Bank'),
      pay_currency: choice('Paid in', 'EGP', 'USD', 'AED'),
      iban: char('IBAN'),
      confirm: { type: 'boolean', label: 'I confirm these details are correct', required: true },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        {
          type: 'section', id: 'personal', title: 'Personal details', description: 'As written on your ID.', columns: { wide: 3, medium: 3, narrow: 1 },
          children: [
            f('photo'),
            { type: 'section', id: 'who', style: 'plain', colspan: 2, columns: 2, children: [f('first_name'), f('last_name'), f('email', { widget: 'email' }), f('mobile', { widget: 'phone' }), f('birthday'), f('nationality')] },
          ],
        },
        {
          type: 'section', id: 'side-1', style: 'plain', columns: { wide: 2, medium: 1 },
          children: [
            { type: 'section', id: 'address', title: 'Home address', columns: { wide: 2, narrow: 1 }, children: [f('street', { colspan: 2 }), f('city'), f('postcode'), f('country', { colspan: 2 })] },
            { type: 'section', id: 'emergency', title: 'Emergency contact', columns: 1, children: [f('ec_name'), f('ec_relation', { widget: 'radio' }), f('ec_phone')] },
          ],
        },
        {
          type: 'tabs', id: 'job-tabs',
          children: [
            { type: 'tab', id: 'tab-job', label: 'Job', children: [{ type: 'section', id: 'role', title: 'Role', style: 'line', columns: { wide: 3, medium: 2, narrow: 1 }, children: [f('job_title'), f('department'), f('manager'), f('start_date'), f('contract', { colspan: 2, widget: 'radio' }), f('end_date'), f('salary')] }] },
            { type: 'tab', id: 'tab-docs', label: 'Documents', children: [{ type: 'section', id: 'docs', style: 'plain', columns: { wide: 3, medium: 1 }, children: [f('id_doc'), f('contract_doc'), f('certificates')] }] },
            { type: 'tab', id: 'tab-pay', label: 'Pay', children: [{ type: 'section', id: 'bank', title: 'Bank account', style: 'framed', collapsible: true, labels: 'beside', labelWidth: 120, columns: { wide: 2, narrow: 1 }, children: [f('bank_name'), f('pay_currency'), f('iban', { colspan: 2 })] }] },
          ],
        },
        { type: 'divider', id: 'div-1' },
        { type: 'text', id: 'h-send', style: 'heading', text: 'Before you send' },
        { type: 'text', id: 't-note', style: 'note', text: 'HR goes through every detail with you on your first day. Nothing here is shared outside the company.' },
        f('confirm'),
        { type: 'button', id: 'send', label: 'Send to HR', action: 'send', style: 'primary' },
      ],
    },
  };
}

/** Every page a watched designer shows, that does not validate: none, after each test. */
const invalid: string[] = [];
afterEach(() => expect(invalid.splice(0)).toEqual([]));

/** Validate every page the designer shows, after every edit, undo and redo. */
export function watched(designer: Designer): Designer {
  let seen = 0;
  designer.subscribe((state) => {
    seen++;
    const checked = validatePage(state.page);
    if (!checked.ok) invalid.push(...checked.issues.map((i) => `after change ${seen}: ${i.path}: ${i.message}`));
  });
  return designer;
}

/** A designer on the employee page; the model, when given, holds Work email and a field not on the page yet. */
export function employeeDesigner(options: { model?: boolean } = {}): Designer {
  const model: Record<string, Field> | undefined = options.model
    ? { email: { type: 'char', label: 'Work email', required: true }, employee_no: { type: 'char', label: 'Employee number' } }
    : undefined;
  return watched(createDesigner({ page: employeePage(), model }));
}

type Holder = { id: string; type: string; children?: (LayoutNode | { id: string; type: string })[] };

/** A part, its parent and its place, wherever it sits (tabs among their tabs too). */
export function spot(page: Page, id: string): { node: Holder & Record<string, unknown>; parent: Holder & Record<string, unknown>; index: number } | null {
  const walk = (holder: Holder): ReturnType<typeof spot> => {
    for (const [index, node] of (holder.children ?? []).entries()) {
      if (node.id === id) return { node: node as never, parent: holder as never, index };
      const deeper = walk(node as Holder);
      if (deeper) return deeper;
    }
    return null;
  };
  return walk(page.layout as Holder);
}

/** What holds a part, as the mockup's checks ask it: the parent, its look and columns, its parts, and what holds it. */
export function where(page: Page, id: string) {
  const at = spot(page, id);
  if (!at) return null;
  const parent = at.parent as Partial<SectionNode> & Holder;
  return {
    parent: parent.id,
    style: parent.style,
    title: parent.title,
    columns: parent.columns,
    colspan: parent.colspan,
    kids: (parent.children ?? []).map((c) => c.id),
    grand: spot(page, parent.id)?.parent.id ?? null,
  };
}

/** A part's own settings, by id. */
export const nodeOf = (page: Page, id: string) => spot(page, id)?.node;

/** The page validates, or the test says why not. */
export function expectValid(page: Page): void {
  const checked = validatePage(page);
  expect(checked.ok ? [] : checked.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
}

/**
 * The employee page drawn on a canvas by hand, with the boxes a browser would
 * give it, for the tests of what a drop means and of dragging:
 *
 *  root ── personal (0,0 → 900,400): photo (20,60 → 290,180)
 *                                     who (310,60 → 880,380): first | last  (row 1, 70–130)
 *                                                             email | mobile (row 2, 150–210)
 *                                                             birthday | nationality (row 3, 230–290)
 *       ── emergency (0,440 → 900,700): ec_name, ec_relation, ec_phone, one under another
 *       ── an empty group, “New group” (0,740 → 900,840)
 */
export function fakeCanvas(page: Page = employeePage()) {
  const rects = new Map<Element, DOMRect>();
  const place = (element: Element, left: number, top: number, right: number, bottom: number) =>
    rects.set(element, { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) } as DOMRect);
  const part = (id: string, parent: HTMLElement, box: [number, number, number, number], className = '') => {
    const element = document.createElement('div');
    element.dataset['node'] = id;
    if (className) element.className = className;
    parent.append(element);
    place(element, ...box);
    return element;
  };
  const content = (id: string, owner: HTMLElement, box: [number, number, number, number]) => {
    const element = document.createElement('div');
    element.dataset['container'] = id;
    owner.append(element);
    place(element, ...box);
    return element;
  };
  const root = document.createElement('div');
  root.dataset['container'] = page.layout.id;
  document.body.append(root);
  place(root, 0, 0, 900, 900);
  const personal = part('personal', root, [0, 0, 900, 400]);
  const grid = content('personal', personal, [20, 50, 880, 390]);
  part('f-photo', grid, [20, 60, 290, 180], 'fd-canvas-field');
  const who = part('who', grid, [310, 60, 880, 380]);
  const inner = content('who', who, [310, 60, 880, 380]);
  ['first_name', 'last_name', 'email', 'mobile', 'birthday', 'nationality'].forEach((name, i) => {
    const left = i % 2 ? 600 : 310;
    const top = 70 + Math.floor(i / 2) * 80;
    part(`f-${name}`, inner, [left, top, left + 280, top + 60], 'fd-canvas-field');
  });
  const emergency = part('emergency', root, [0, 440, 900, 700]);
  const list = content('emergency', emergency, [20, 480, 880, 690]);
  ['ec_name', 'ec_relation', 'ec_phone'].forEach((name, i) => part(`f-${name}`, list, [20, 480 + i * 70, 880, 540 + i * 70], 'fd-canvas-field'));
  // An empty group, as one fresh from the toolbox.
  if (!JSON.stringify(page.layout).includes('"empty"')) (page.layout as { children: unknown[] }).children.push({ type: 'section', id: 'empty', title: 'New group', columns: 2, children: [] });
  const empty = part('empty', root, [0, 740, 900, 840]);
  content('empty', empty, [20, 780, 880, 830]);
  const rectOf = (e: Element) => rects.get(e) ?? e.getBoundingClientRect();
  /** The deepest element at a point, as elementFromPoint gives it. */
  const under = (x: number, y: number): Element | null =>
    [...rects.keys()]
      .filter((e) => {
        const r = rects.get(e) as DOMRect;
        return e.isConnected && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      })
      .sort((a, b) => (a.contains(b) ? 1 : b.contains(a) ? -1 : 0))[0] ?? null;
  return { root, page, rectOf, under, place };
}
