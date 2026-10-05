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

describe('a rating', () => {
  it('names each point in the page’s language', () => {
    for (const [locale, name] of [['en', '3 of 5'], ['ar', '3 من 5'], ['de', '3 von 5'], ['fr', '3 sur 5']] as const) {
      const { el } = mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'rating' }, { locale });
      expect(el.querySelectorAll('[role=radio]')[2].getAttribute('aria-label')).toBe(name);
    }
  });
});
