import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from '../record/form';
import { createMemoryDataSource } from '../record/memory-data-source';
import { fill } from '../record/messages';
import { compileModifier } from './modifier';
import { compileExpression } from './expression';

describe('an expression reads a record’s own values, never what every object inherits (S-I1, S-I2)', () => {
  it('reads no inherited property: a name’s constructor, a value’s __proto__ (the audit’s proof)', () => {
    for (const [source, values] of [
      ['name.constructor', { name: 'x' }],
      ['name.constructor.constructor', { name: 'x' }],
      ['x.__proto__', { x: {} }],
      ['toString', {}],
      ['partner.hasOwnProperty', { partner: { id: 1 } }],
    ] as const) {
      expect([source, compileExpression(source).evaluate(values)]).toEqual([source, null]);
      expect([source, compileModifier(source).evaluate(values)]).toEqual([source, false]);
    }
    // Its own still read: a text's length, a link's name, a value's field.
    expect(compileModifier('name.length > 3').evaluate({ name: 'abcd' })).toBe(true);
    expect(compileExpression('partner.label').evaluate({ partner: { id: 1, label: 'Acme' } })).toBe('Acme');
  });

  it('a compute that reads one keeps nothing of it', () => {
    const page = { fieldia: '0.13', id: 'p', data: { kind: 'responses' }, fields: { name: { type: 'char', label: 'Name' }, out: { type: 'char', label: 'Out', compute: 'name.constructor.constructor' } }, layout: { type: 'sheet', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'o', field: 'out' }] } };
    const checked = checkPage(page);
    expect(checked.ok).toBe(true);
    const form = createForm({ page: checked.ok ? checked.page : (page as never), dataSource: createMemoryDataSource() });
    form.setValue('name', 'x');
    expect(form.getState().values['out']).toBeNull();
    form.dispose();
  });

  it('fills a message’s blanks from the values given alone: "{constructor}" stays as written', () => {
    expect(fill('Check {label}: {constructor} / {toString} / {__proto__}', { label: 'Code' })).toBe('Check Code: {constructor} / {toString} / {__proto__}');
  });

  it('refuses a field named as every object’s own — constructor, __proto__, prototype — in checkPage and validatePage', () => {
    for (const name of ['constructor', '__proto__', 'prototype']) {
      const page = JSON.parse(`{"fieldia":"0.13","id":"p","data":{"kind":"responses"},"fields":{"${name}":{"type":"char","label":"L"}},"layout":{"type":"sheet","id":"root","children":[{"type":"field","id":"a","field":"${name}"}]}}`);
      expect([name, checkPage(page).ok, validatePage(page).ok]).toEqual([name, false, false]);
    }
    // A word that is no object's own is a name as any other.
    const page = { fieldia: '0.13', id: 'p', data: { kind: 'responses' }, fields: { toString_x: { type: 'char', label: 'L' } }, layout: { type: 'sheet', id: 'root', children: [{ type: 'field', id: 'a', field: 'toString_x' }] } };
    expect(checkPage(page).ok).toBe(true);
  });
});
