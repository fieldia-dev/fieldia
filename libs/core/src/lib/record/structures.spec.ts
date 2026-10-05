import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import type { Page } from '../format/page';
import { createForm } from './form';
import { MESSAGES } from './messages';

/**
 * What the structures ask of their answers beyond Required: an address's
 * parts that must be filled, and a table's or a repeating group's least and
 * most lines.
 */

function ask(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: keyof typeof MESSAGES = 'en') {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Home address', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page, messages: MESSAGES[locale] });
  return { form, problem: (value: unknown) => (form.setValue('x', value as never), form.problem('x')) };
}

describe('an address’s parts that must be filled', () => {
  const address = (locale?: keyof typeof MESSAGES, required = false) =>
    ask({ type: 'json', ...(required ? { required: true } : {}) }, { widget: 'address', options: { parts: ['street', 'line2', 'city', 'region', 'country'], requiredParts: ['street', 'city', 'country'] } }, locale).problem;

  it('names the first part missing, in its order', () => {
    const problem = address();
    expect(problem({ city: 'Cairo' })).toBe('Street address is required');
    expect(problem({ street: '12 Nile Street', line2: 'Floor 4' })).toBe('City is required');
    expect(problem({ street: '12 Nile Street', city: '  ', country: 'EG' })).toBe('City is required');
    expect(problem({ street: '12 Nile Street', city: 'Cairo' })).toBe('Country is required');
    expect(problem({ street: '12 Nile Street', city: 'Cairo', country: 'EG' })).toBeNull();
  });

  it('asks nothing of an address left out, unless the address is required', () => {
    expect(address()(null)).toBeNull();
    expect(address(undefined, true)(null)).toBe('Home address is required');
  });

  it('says it in the page’s language', () => {
    expect(address('ar')({ street: 'شارع النيل' })).toBe('المدينة مطلوب');
    expect(address('de')({ street: 'Nilstraße 12' })).toBe('Ort ist erforderlich');
    expect(address('fr')({ street: '12 rue du Nil' })).toBe('Ville est obligatoire');
  });

  it('asks nothing of parts it does not ask for, nor of a box that is not an address', () => {
    expect(ask({ type: 'json' }, { widget: 'address', options: { parts: ['city'], requiredParts: ['street', 'city'] } }).problem({ city: 'Cairo' })).toBeNull();
    expect(ask({ type: 'json' }, { options: { requiredParts: ['street'] } }).problem({ city: 'Cairo' })).toBeNull();
  });
});

describe('a table’s least and most lines', () => {
  const lines = (count: number) => Array.from({ length: count }, (_, i) => ({ key: `k${i}`, values: { name: `Line ${i + 1}` } }));
  const table = (widget?: string) =>
    ask({ type: 'one2many', label: 'Milestones', relation: 'line', fields: { name: { type: 'char', label: 'Name' } } }, { ...(widget ? { widget } : {}), options: { min: 2, max: 3 } }).problem;

  it('asks for the least, once there is a line, and refuses past the most', () => {
    const problem = table();
    expect(problem(lines(1))).toBe('Add at least 2 to Milestones');
    expect(problem(lines(2))).toBeNull();
    expect(problem(lines(3))).toBeNull();
    expect(problem(lines(4))).toBe('Too many in Milestones: at most 3');
  });

  it('counts a repeating group’s cards the same way', () => {
    expect(table('cards')(lines(4))).toBe('Too many in Milestones: at most 3');
  });

  it('asks nothing of an empty table: Required asks for one, as with several files', () => {
    expect(table()([])).toBeNull();
  });
});
