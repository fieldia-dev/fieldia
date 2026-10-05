import { mountKind } from './test-kinds';

/** The text, number and date kinds' details: what a browser may fill in, a count of characters, units, limits. */

const input = (el: Element) => (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;

describe('what the browser may fill in', () => {
  it('offers a person’s own email, phone and web address, and nothing for other boxes', () => {
    expect(input(mountKind({ type: 'char' }, { widget: 'email' }).el).autocomplete).toBe('email');
    expect(input(mountKind({ type: 'char' }, { widget: 'phone' }).el).autocomplete).toBe('tel');
    expect(input(mountKind({ type: 'char' }, { widget: 'url' }).el).autocomplete).toBe('url');
    expect(input(mountKind({ type: 'char' }).el).autocomplete).toBe('off');
  });
});

