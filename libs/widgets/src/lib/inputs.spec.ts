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

describe('a number’s unit', () => {
  const units = (el: Element) => [...el.querySelectorAll('.fd-unit')].map((u) => u.textContent);

  it('sits inside the box, before or after the number, and is read with it', () => {
    const { el, form } = mountKind({ type: 'float', digits: [16, 1] }, { options: { suffix: 'kg' } });
    expect([...el.children].map((c) => c.tagName)).toEqual(['INPUT', 'SPAN']);
    expect(units(el)).toEqual(['kg']);
    expect(input(el).id).toBe('fd-x');
    expect(input(el).getAttribute('aria-describedby')).toBe(el.querySelector('.fd-unit')?.id);
    form.setValue('x', 12.5);
    expect(input(el).value).toBe('12.5');
    const before = mountKind({ type: 'integer' }, { options: { prefix: '≈' } }).el;
    expect([...before.children].map((c) => c.tagName)).toEqual(['SPAN', 'INPUT']);
    expect(units(before)).toEqual(['≈']);
  });

  it('keeps the help and the error it is described by', () => {
    const { el, refresh } = mountKind({ type: 'float' }, { options: { suffix: '°C' } });
    refresh({ invalid: true, describedBy: 'help error' });
    expect(input(el).getAttribute('aria-describedby')).toBe(`help error ${el.querySelector('.fd-unit')?.id}`);
  });

  it('is left out where there is none', () => {
    expect(mountKind({ type: 'float' }).el.tagName).toBe('INPUT');
  });
});

describe('an amount’s currency', () => {
  const unit = (el: Element) => el.querySelector('.fd-currency') as HTMLElement;
  const order = (el: Element) => [...el.children].map((c) => c.tagName);

  it('shows the currency’s symbol where the page’s language writes it', () => {
    const en = mountKind({ type: 'monetary', currency: 'USD' }).el;
    expect(unit(en).textContent).toBe('$');
    expect(order(en)).toEqual(['SPAN', 'INPUT']);
    const de = mountKind({ type: 'monetary', currency: 'EUR' }, {}, { locale: 'de' }).el;
    expect(unit(de).textContent).toBe('€');
    expect(order(de)).toEqual(['INPUT', 'SPAN']);
    expect(de.classList.contains('fd-currency-after')).toBe(true);
    expect(unit(mountKind({ type: 'monetary', currency: 'EGP' }).el).textContent).toBe('E£');
  });

  it('goes where the page says, when it says', () => {
    expect(order(mountKind({ type: 'monetary', currency: 'EUR' }, { options: { symbol: 'before' } }, { locale: 'de' }).el)).toEqual(['SPAN', 'INPUT']);
    expect(order(mountKind({ type: 'monetary', currency: 'USD' }, { options: { symbol: 'after' } }).el)).toEqual(['INPUT', 'SPAN']);
  });

  it('keeps a name that is no currency code as it is', () => {
    const { el } = mountKind({ type: 'monetary' }, { options: {} });
    expect(unit(el).textContent).toBe('');
  });
});

describe('a rating’s look', () => {
  const points = (el: Element) => [...el.querySelectorAll('[role=radio]')] as HTMLButtonElement[];
  const on = (el: Element) => points(el).map((p) => p.classList.contains('fd-on'));

  it('is stars unless the page picks hearts, thumbs up or numbers', () => {
    expect(points(mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'rating' }).el).map((p) => p.textContent)).toEqual(['★', '★', '★', '★', '★']);
    const hearts = mountKind({ type: 'integer', min: 1, max: 3 }, { widget: 'rating', options: { icon: 'heart' } }).el;
    expect(points(hearts).map((p) => p.textContent)).toEqual(['♥', '♥', '♥']);
    expect(hearts.querySelector('.fd-rating-heart')).not.toBeNull();
    const thumbs = mountKind({ type: 'integer', min: 1, max: 3 }, { widget: 'rating', options: { icon: 'thumb' } }).el;
    expect(points(thumbs).every((p) => p.querySelector('svg[aria-hidden="true"]'))).toBe(true);
  });

  it('fills up to the one picked, but numbers mark the one picked alone', () => {
    const hearts = mountKind({ type: 'integer', min: 1, max: 4 }, { widget: 'rating', options: { icon: 'heart' } });
    hearts.form.setValue('x', 3);
    expect(on(hearts.el)).toEqual([true, true, true, false]);
    const numbers = mountKind({ type: 'integer', min: 1, max: 4 }, { widget: 'rating', options: { icon: 'number' } });
    expect(points(numbers.el).map((p) => p.textContent)).toEqual(['1', '2', '3', '4']);
    numbers.form.setValue('x', 3);
    expect(on(numbers.el)).toEqual([false, false, true, false]);
    expect(points(numbers.el)[2].getAttribute('aria-label')).toBe('3 of 4');
  });

  it('has words at each end, as a scale has', () => {
    const { el } = mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'rating', options: { startLabel: 'Poor', endLabel: 'Great' } });
    expect([...el.querySelectorAll('.fd-scale-ends span')].map((s) => s.textContent)).toEqual(['Poor', 'Great']);
    expect(el.querySelector('[role=radiogroup]')?.getAttribute('aria-description')).toBe('Poor … Great');
  });
});

describe('a slider’s words at each end', () => {
  it('stand under its ends’ numbers, and are read with it', () => {
    const { el } = mountKind({ type: 'integer', min: 0, max: 5 }, { widget: 'slider', options: { startLabel: 'Never', endLabel: 'Every day' } });
    expect([...el.querySelectorAll('.fd-slider-ends > span')].map((s) => s.textContent)).toEqual(['0Never', '5Every day']);
    expect([...el.querySelectorAll('.fd-slider-word')].map((s) => s.textContent)).toEqual(['Never', 'Every day']);
    expect(el.querySelector('input')?.getAttribute('aria-description')).toBe('Never … Every day');
  });

  it('leave the ends as numbers where there are none', () => {
    const { el } = mountKind({ type: 'integer', min: 0, max: 5 }, { widget: 'slider' });
    expect([...el.querySelectorAll('.fd-slider-ends > span')].map((s) => s.textContent)).toEqual(['0', '5']);
    expect(el.querySelector('input')?.hasAttribute('aria-description')).toBe(false);
  });
});

describe('a scale coloured as NPS', () => {
  const tones = (el: Element) => [...el.querySelectorAll('[role=radio]')].map((p) => (p as HTMLElement).dataset['tone']);

  it('tells 0–6, 7–8 and 9–10 apart', () => {
    const { el } = mountKind({ type: 'integer', min: 0, max: 10 }, { widget: 'scale', options: { nps: true } });
    expect(el.querySelector('.fd-nps')).not.toBeNull();
    expect(tones(el)).toEqual(['low', 'low', 'low', 'low', 'low', 'low', 'low', 'mid', 'mid', 'high', 'high']);
  });

  it('is a plain scale without the option, or on another range', () => {
    expect(mountKind({ type: 'integer', min: 0, max: 10 }, { widget: 'scale' }).el.querySelector('.fd-nps')).toBeNull();
    expect(mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'scale', options: { nps: true } }).el.querySelector('.fd-nps')).toBeNull();
  });
});

describe('a date’s, a date and time’s and a time’s limits on the input', () => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it('gives a date’s picker its earliest and latest day, fixed or counted from today', () => {
    const date = input(mountKind({ type: 'date', min: 'today', max: 'today+30' }).el);
    expect([date.min, date.max]).toEqual([day(0), day(30)]);
    const fixed = input(mountKind({ type: 'date', min: '2026-03-02' }).el);
    expect([fixed.min, fixed.max]).toEqual(['2026-03-02', '']);
  });

  it('gives a date and time’s picker the whole of its first and last day, and its minutes’ step', () => {
    const at = input(mountKind({ type: 'datetime', min: 'today', max: '2030-01-31' }, { options: { step: 15 } }).el);
    expect([at.min, at.max, at.step]).toEqual([`${day(0)}T00:00`, '2030-01-31T23:59', '900']);
  });

  it('is a time box for a time of day, its earliest, latest and step from the page', () => {
    const { el, form } = mountKind({ type: 'char' }, { widget: 'time', options: { min: '09:00', max: '17:30', step: 30 } });
    const time = input(el);
    expect([time.type, time.min, time.max, time.step]).toEqual(['time', '09:00', '17:30', '1800']);
    typeInto(time, '10:30');
    expect(form.getState().values['x']).toBe('10:30');
  });
});

describe('keywords at most', () => {
  it('stop taking more once there are as many as the page allows', () => {
    const { el, value, form } = mountKind({ type: 'char' }, { widget: 'tags', options: { max: 2 } });
    const box = el.querySelector('input') as HTMLInputElement;
    typeInto(box, 'oak,');
    typeInto(box, 'glass,');
    expect(value()).toBe('oak, glass');
    expect(box.closest('[hidden]')).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove glass');
    typeInto(box, 'steel,');
    expect(value()).toBe('oak, glass');
    form.setValue('x', 'oak');
    expect(box.closest('[hidden]')).toBeNull();
  });
});

describe('a progress bar’s range', () => {
  it('is the field’s own, unless the page gives the bar one', () => {
    const own = mountKind({ type: 'integer', min: 0, max: 320 }, { widget: 'progressbar' });
    own.form.setValue('x', 160);
    const bar = own.el.querySelector('[role=progressbar]') ?? own.el;
    expect([bar.getAttribute('aria-valuemax'), bar.getAttribute('aria-valuetext')]).toEqual(['320', '50%']);
    const given = mountKind({ type: 'integer', min: 0, max: 100 }, { widget: 'progressbar', options: { max: 200 } });
    given.form.setValue('x', 50);
    expect((given.el.querySelector('[role=progressbar]') ?? given.el).getAttribute('aria-valuetext')).toBe('25%');
  });
});
