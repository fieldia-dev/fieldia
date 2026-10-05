import { mountKind, typeInto } from './test-kinds';

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

describe('a count of characters', () => {
  const box = (el: Element) => el.querySelector('input, textarea') as HTMLInputElement;
  const count = (el: Element) => el.querySelector('.fd-count') as HTMLElement;

  it('shows how many of the most are typed, under the box, and the box stops at the most', () => {
    const { el } = mountKind({ type: 'char', size: 20 });
    expect(count(el).textContent).toBe('0 / 20');
    expect(box(el).maxLength).toBe(20);
    typeInto(box(el), 'Nile Traders');
    expect(count(el).textContent).toBe('12 / 20');
    expect(count(el).getAttribute('aria-hidden')).toBe('true');
    expect(count(el).compareDocumentPosition(box(el)) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('turns to the warning colour near the most', () => {
    const { el } = mountKind({ type: 'text', size: 20 });
    typeInto(box(el) as never, 'a'.repeat(17));
    expect(count(el).classList.contains('fd-count-near')).toBe(false);
    typeInto(box(el) as never, 'a'.repeat(18));
    expect(count(el).classList.contains('fd-count-near')).toBe(true);
  });

  it('tells a screen reader politely how many are left, once typing pauses, in the page’s language', () => {
    jest.useFakeTimers();
    try {
      const { el } = mountKind({ type: 'char', size: 20 }, {}, { locale: 'de' });
      const said = el.querySelector('[aria-live="polite"]') as HTMLElement;
      jest.advanceTimersByTime(2000);
      // Nothing is said of a box nobody types in.
      expect(said.textContent).toBe('');
      typeInto(box(el), 'Nil');
      expect(said.textContent).toBe('');
      jest.advanceTimersByTime(1000);
      expect(said.textContent).toBe('Noch 17 Zeichen');
    } finally {
      jest.useRealTimers();
    }
  });

  it('is left out of a box with no most, and of a table’s cells', () => {
    expect(count(mountKind({ type: 'char' }).el)).toBeNull();
    const { el } = mountKind({ type: 'one2many', relation: 'l', fields: { name: { type: 'char', label: 'Name', size: 10 } } });
    expect(el.querySelector('.fd-count')).toBeNull();
  });
});

describe('a paragraph', () => {
  const area = (el: Element) => el.querySelector('textarea') ?? (el as HTMLTextAreaElement);

  it('starts with the rows the page asks for, three if none', () => {
    expect(area(mountKind({ type: 'text' }).el).rows).toBe(3);
    expect(area(mountKind({ type: 'text' }, { options: { rows: 6 } }).el).rows).toBe(6);
  });

  it('grows as people type, unless the page says not to', () => {
    const grows = area(mountKind({ type: 'text' }).el);
    Object.defineProperty(grows, 'scrollHeight', { configurable: true, get: () => 180 });
    typeInto(grows as never, 'line\n'.repeat(9));
    expect(grows.style.height).toBe('180px');
    const fixed = area(mountKind({ type: 'text' }, { options: { autoGrow: false } }).el);
    Object.defineProperty(fixed, 'scrollHeight', { configurable: true, get: () => 180 });
    typeInto(fixed as never, 'line\n'.repeat(9));
    expect(fixed.style.height).toBe('');
  });
});
