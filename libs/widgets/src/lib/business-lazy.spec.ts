import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { installPartStyles, installStyles, PART_RANK } from './styles';
import { businessPart, relationsPart, type PartFactory } from './widget-parts';
import { plainNumber } from './business-plain';
import { builtInWidgets, createWidget, widgetPart, type Widget } from './widgets';

/**
 * Flectra's business widgets in the business part (business-part.ts): each
 * kind's factory says so — an analytic distribution's with the relations
 * part beside it, for its lines' links — and a widget made before the part came — by
 * something that did not wait for it, as the viewer does — shows its value
 * plainly (business-plain.ts), then the part's own widget takes its place
 * with the last value, the focus, and anything typed meanwhile. This file
 * starts with no part loaded (src/test-parts.ts leaves it so).
 */

const fields: Record<string, Field> = {
  state: { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
  stage: { type: 'many2one', label: 'Stage', relation: 'stage' },
  priority: { type: 'selection', label: 'Priority', options: ['0', '1', '2', '3'].map((value) => ({ value, label: `Level ${value}` })) },
  starred: { type: 'boolean', label: 'Starred' },
  kanban: { type: 'selection', label: 'Kanban', options: [{ value: 'normal', label: 'In progress' }, { value: 'blocked', label: 'Blocked' }] },
  hours: { type: 'float', label: 'Hours' },
  share: { type: 'float', label: 'Share' },
  split: { type: 'json', label: 'Analytic' },
  totals: { type: 'json', label: 'Totals' },
  paid: { type: 'json', label: 'Payments' },
  currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
  code: { type: 'char', label: 'Code' },
  clock: { type: 'float', label: 'Time spent' },
};
const NODES: FieldNode[] = [
  { type: 'field', id: 'f-state', field: 'state', widget: 'statusbar' },
  { type: 'field', id: 'f-stage', field: 'stage', widget: 'statusbar' },
  { type: 'field', id: 'f-priority', field: 'priority', widget: 'priority' },
  { type: 'field', id: 'f-starred', field: 'starred', widget: 'priority' },
  { type: 'field', id: 'f-hours', field: 'hours', widget: 'duration' },
  { type: 'field', id: 'f-share', field: 'share', widget: 'percentage' },
  { type: 'field', id: 'f-split', field: 'split', widget: 'distribution' },
  { type: 'field', id: 'f-totals', field: 'totals', widget: 'tax-totals', options: { currencyField: 'currency_id' } },
  { type: 'field', id: 'f-paid', field: 'paid', widget: 'payments', options: { currencyField: 'currency_id' } },
  { type: 'field', id: 'f-code', field: 'code', widget: 'copy' },
  { type: 'field', id: 'f-clock', field: 'clock', widget: 'timer' },
];
const page = { fieldia: '0.1', id: 'p', title: 'P', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: NODES } } as unknown as Page;
const VALUES = {
  state: 'done',
  stage: { id: 4, label: 'Won' },
  priority: '2',
  starred: true,
  hours: 6.5,
  share: 0.25,
  split: { '12': 60, '14': 40 },
  totals: { untaxed: 1000, groups: [{ name: 'VAT 14%', amount: 140 }], total: 1140 },
  paid: [{ date: '2026-10-15', amount: 500, name: 'PAY/1' }],
  currency_id: { id: 1, label: 'EGP' },
  code: 'INV/2026/0001',
  clock: 1.5,
};

afterEach(() => document.body.replaceChildren());

describe('the business widgets’ part', () => {
  it('is named by each business kind’s factory, and by no other', () => {
    for (const node of NODES.filter((one) => one.widget !== 'distribution')) {
      expect((builtInWidgets[`${fields[node.field].type}.${node.widget}`] as PartFactory).partOf(node)).toBe(businessPart);
      expect(widgetPart(fields[node.field], node)).toBe(businessPart);
    }
    // An analytic distribution's lines each draw a link's box: the business part, in once the relations part is too.
    const split = widgetPart(fields['split'], NODES.find((node) => node.widget === 'distribution') as FieldNode);
    expect([split?.name, split === businessPart, split?.loaded]).toEqual(['business', false, undefined]);
    // The same fields drawn plainly — a stage as a link to its record, in the relations part; and an app's own statusbar.
    for (const node of NODES) expect(widgetPart(fields[node.field], { ...node, widget: undefined })).toBe(node.field === 'stage' ? relationsPart : undefined);
    const own = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(widgetPart(fields['state'], NODES[0], { 'selection.statusbar': own })).toBeUndefined();
    // A state's dot stays in the main script: a work item's State is one, and its list is the pickers' (pick-list.ts).
    expect(widgetPart(fields['kanban'], { type: 'field', id: 'f-kanban', field: 'kanban', widget: 'dot' })).toBeUndefined();
  });

  it('puts its sheet first among the parts’, between Fieldia’s two', () => {
    document.head.replaceChildren();
    installStyles(document);
    installPartStyles(document, 'path', '.a{}', PART_RANK.picker);
    installPartStyles(document, 'business', '.b{}', PART_RANK.business);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'business', 'path', 'fieldia-styles-looks']);
    document.head.replaceChildren();
  });
});

describe('hours and a per cent drawn plainly', () => {
  // The stand-in itself: drawn through createWidget it would ask for its part, which the test below needs not come yet.
  const drawPlain = (name: 'hours' | 'share', value: number) => {
    const form = createForm({ page: { ...page, fields: { ...fields, share: { type: 'float', label: 'Share', digits: [5, 2] } } } as Page, values: { [name]: value } as never });
    const node = NODES.find((one) => one.field === name) as FieldNode;
    const widget = plainNumber({ form, name, field: form.page.fields[name], node, id: `w-${name}`, document });
    document.body.append(widget.element);
    form.subscribe(() => widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false }));
    widget.update({ value: value, values: form.getState().values, readonly: false, required: false, invalid: false });
    return { form, input: widget.element as HTMLInputElement };
  };

  it('a per cent read as its part’s box reads it: "12.345" in one of two places is kept unread with why, never 0.12345', () => {
    const { form, input } = drawPlain('share', 0.1);
    input.focus();
    input.value = '12.345';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    expect({ value: form.getState().values['share'], unread: form.getState().unread['share'] }).toEqual({ value: 0.1, unread: { text: '12.345', message: 'Share takes at most 2 decimal places' } });
    expect(input.value).toBe('12.345');
  });

  it('passed through, nothing typed, hours keep the value they came with: 6.51 shown as 06:31 is never 6.5167', () => {
    const { form, input } = drawPlain('hours', 6.51);
    expect(input.value).toBe('06:31');
    input.focus();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    expect(form.getState().values['hours']).toBe(6.51);
  });
});

describe('a business widget made before its part came', () => {
  it('shows its value plainly, keeps what is typed, then is the part’s own in the same place, with the last value and the focus', async () => {
    expect(businessPart.loaded).toBeUndefined();
    const form = createForm({ page, values: VALUES as never });
    const host = document.createElement('div');
    document.body.append(host);
    const widgets: Record<string, Widget> = {};
    for (const node of NODES) {
      widgets[node.id] = createWidget({ form, name: node.field, field: fields[node.field], node, id: `w-${node.id}`, document });
      host.append(widgets[node.id].element);
    }
    const refresh = () => {
      for (const node of NODES) widgets[node.id].update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
    };
    form.subscribe(refresh);
    refresh();
    const element = (id: string) => widgets[id].element;
    // Words as a person reads them: a symbol's space that never breaks, as any other.
    const words = (id: string) => element(id).textContent?.replace(/\s+/g, ' ');
    // Meanwhile, the value in words: the state's, the stars' count, the shares, the total, each payment's day and amount.
    expect(element('f-state').textContent).toBe('Done');
    expect(element('f-stage').textContent).toBe('Won');
    expect(element('f-priority').textContent).toBe('★ 2 of 3');
    expect(element('f-starred').textContent).toBe('★ 1 of 1');
    expect(element('f-split').textContent).toBe('60% · 40%');
    expect(words('f-totals')).toBe('Total E£ 1,140.00');
    expect(words('f-paid')).toBe('Paid on 15 Oct 2026 E£ 500.00');
    // A timer's time, standing still; a value to copy in a plain text box, which keeps it.
    expect(element('f-clock').textContent).toBe('01:30:00');
    expect((element('f-code') as HTMLInputElement).value).toBe('INV/2026/0001');
    // Hours and a per cent in a plain box that reads them as they are typed.
    const hours = element('f-hours') as HTMLInputElement;
    const share = element('f-share') as HTMLInputElement;
    expect([hours.tagName, hours.value, share.value]).toEqual(['INPUT', '06:30', '25%']);
    share.focus();
    share.value = '35';
    share.dispatchEvent(new Event('input', { bubbles: true }));
    share.blur();
    expect(form.getState().values['share']).toBe(0.35);
    expect(share.value).toBe('35%');
    // Hours half typed as the part comes: kept in the box as typed, never a value made of it, never read under the keys.
    hours.focus();
    hours.value = '7:';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['hours']).toBe(6.5);
    expect(form.getState().unread['hours']).toBeUndefined();
    await businessPart.load();
    await Promise.resolve();
    // The distribution waits for its links' part too: its shares in words until it has come.
    expect(element('f-split').textContent).toBe('60% · 40%');
    await relationsPart.load();
    await Promise.resolve();
    // Each the part's own, in its place (a box's hint beside it), with the value it was given.
    expect([...host.children].filter((child) => !child.matches('.fd-refusal-hint'))).toEqual(NODES.map((node) => widgets[node.id].element));
    expect(host.querySelector('[data-fd-plain]')).toBeNull();
    expect(element('f-state').querySelector('[aria-current="step"]')?.textContent).toBe('Done');
    expect(element('f-priority').querySelectorAll('.fd-priority-star.fd-on')).toHaveLength(2);
    expect(element('f-split').querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element('f-totals').classList.contains('fd-tax-totals')).toBe(true);
    expect(element('f-paid').querySelectorAll('.fd-payment')).toHaveLength(1);
    expect(element('f-clock').querySelector('.fd-timer-time')?.textContent).toBe('01:30:00');
    expect((element('f-code').querySelector('input') as HTMLInputElement).value).toBe('INV/2026/0001');
    expect((element('f-share').querySelector('input') as HTMLInputElement).value).toBe('35');
    // The hours' own box has the focus and the text as it stood: typing goes on where it was.
    const box = element('f-hours') as HTMLInputElement;
    expect(box.matches('.fd-duration')).toBe(true);
    expect(document.activeElement).toBe(box);
    expect(box.value).toBe('7:');
    box.value = '7:15';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['hours']).toBe(7.25);
    expect(form.getState().unread['hours']).toBeUndefined();
    expect(document.getElementById('fieldia-business-styles')).not.toBeNull();
    // From now on each is the part's own, at once.
    expect(createWidget({ form, name: 'state', field: fields['state'], node: NODES[0], id: 'w-again', document }).element.classList.contains('fd-statusbar')).toBe(true);
    for (const widget of Object.values(widgets)) widget.destroy?.();
  });
});
