import type { FieldNode, Line } from '@fieldia/core';
import { mountKind, typeInto } from './test-kinds';

/** A repeating group: each line a small card of the lines' fields, added and removed between a least and a most. */

const GUESTS = {
  type: 'one2many',
  label: 'Who moves with you?',
  relation: 'guest',
  fields: { name: { type: 'char', label: 'Name', required: true }, team: { type: 'char', label: 'Team' }, seq: { type: 'integer', label: 'Order' } },
  sequenceField: 'seq',
};
const cards = (options: FieldNode['options'] = {}) => mountKind(GUESTS, { widget: 'cards', options });
const shown = (el: Element) => [...el.querySelectorAll<HTMLElement>('.fd-card')];
const titles = (el: Element) => shown(el).map((c) => c.querySelector('.fd-card-title')?.textContent);
const add = (el: Element) => el.querySelector('.fd-cards-add') as HTMLButtonElement;
const lines = (value: unknown) => value as Line[];
const said = (el: Element) => el.querySelector('[aria-live=polite]')?.textContent;

describe('repeating group', () => {
  it('starts with as many cards as it needs at least, each a group named by its title, with the lines’ fields', () => {
    const { el, value } = cards({ min: 2, itemLabel: 'Person' });
    expect([el.id, el.getAttribute('role')]).toEqual(['fd-x', 'group']);
    expect(lines(value())).toHaveLength(2);
    expect(titles(el)).toEqual(['Person 1', 'Person 2']);
    const card = shown(el)[0];
    expect(card.getAttribute('role')).toBe('group');
    expect(card.getAttribute('aria-labelledby')).toBe(card.querySelector('.fd-card-title')?.id);
    // The field that keeps the order is not asked for.
    expect([...card.querySelectorAll('label')].map((l) => l.textContent)).toEqual(['Name', 'Team']);
    const input = card.querySelector('input') as HTMLInputElement;
    expect(card.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Name');
  });

  it('starts with none when it needs none, and adds one with the page’s words, the cursor in its first field', () => {
    const { el, value } = cards({ addLabel: 'Add a person' });
    expect(shown(el)).toHaveLength(0);
    expect(add(el).textContent).toBe('Add a person');
    add(el).click();
    expect(lines(value())).toHaveLength(1);
    expect(titles(el)).toEqual(['Entry 1']);
    expect(document.activeElement).toBe(shown(el)[0].querySelector('input'));
    typeInto(document.activeElement as HTMLInputElement, 'Sara');
    expect(lines(value())[0].values['name']).toBe('Sara');
    expect(add(cards().el).textContent).toBe('Add another');
  });

  it('adds no more than it may have', () => {
    const { el } = cards({ max: 2 });
    add(el).click();
    expect(add(el).hidden).toBe(false);
    add(el).click();
    expect(shown(el)).toHaveLength(2);
    expect(add(el).hidden).toBe(true);
  });

  it('removes a card down to the least it needs, saying so, numbering the rest again and keeping the cursor nearby', () => {
    const { el, value } = cards({ min: 1, itemLabel: 'Person' });
    add(el).click();
    add(el).click();
    typeInto(shown(el)[2].querySelector('input') as HTMLInputElement, 'Omar');
    const remove = shown(el)[1].querySelector('[aria-label="Remove Person 2"]') as HTMLButtonElement;
    remove.click();
    expect(lines(value()).map((l) => l.values['name'])).toEqual([null, 'Omar']);
    expect(titles(el)).toEqual(['Person 1', 'Person 2']);
    expect(said(el)).toBe('Person 2 removed');
    // The card that took its place.
    expect(document.activeElement).toBe(shown(el)[1].querySelector('input'));
    (shown(el)[1].querySelector('.fd-card-remove') as HTMLButtonElement).click();
    // The last one left: back to the card before it.
    expect(document.activeElement).toBe(shown(el)[0].querySelector('input'));
    // At the least it needs, a card cannot go.
    expect((shown(el)[0].querySelector('.fd-card-remove') as HTMLElement).hidden).toBe(true);
  });

  it('goes to "Add another" when the last card goes', () => {
    const { el } = cards();
    add(el).click();
    (shown(el)[0].querySelector('.fd-card-remove') as HTMLButtonElement).click();
    expect(shown(el)).toHaveLength(0);
    expect(document.activeElement).toBe(add(el));
  });

  it('shows what is wrong with a card’s field under it', () => {
    const { el, form } = cards({ min: 1 });
    form.validate();
    const error = shown(el)[0].querySelector('.fd-cell-error') as HTMLElement;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/Name/);
  });

  it('can only be read when read-only', () => {
    const { el, refresh } = cards({ min: 1 });
    refresh({ readonly: true });
    expect(add(el).hidden).toBe(true);
    expect((shown(el)[0].querySelector('.fd-card-remove') as HTMLElement).hidden).toBe(true);
    expect((shown(el)[0].querySelector('input') as HTMLInputElement).readOnly).toBe(true);
  });
});
