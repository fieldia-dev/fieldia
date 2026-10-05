import { mountKind, press, typeInto } from './test-kinds';
import { shownOptions } from './shuffle';

/**
 * The choice kinds' details: a yes or no as two buttons, a limit on how many
 * boxes are ticked, "None of these", columns, a dropdown that searches its
 * list, tags of one's own, options kept in place when shuffled, a ranking
 * kept as it is shown, and a matrix's rows.
 */

const ROOMS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'quiet', label: 'Quiet room' },
  { value: 'gym', label: 'Gym' },
  { value: 'library', label: 'Library' },
  { value: 'none', label: 'None of these', exclusive: true },
];
const radios = (el: Element) => [...el.querySelectorAll<HTMLElement>('[role=radio]')];
const boxes = (el: Element) => [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];

describe('a yes or no as two buttons', () => {
  const yesNo = (node: Record<string, unknown> = {}, field: Record<string, unknown> = {}, locale?: 'ar') =>
    mountKind({ type: 'boolean', default: null, ...field }, { widget: 'buttons', ...node }, { locale, dir: locale ? 'rtl' : undefined });

  it('is a radio group of “Yes” and “No”, nothing picked until one is', () => {
    const { el, value } = yesNo();
    const group = el.querySelector('[role=radiogroup]') as HTMLElement;
    expect(group.id).toBe('fd-x');
    expect(radios(el).map((r) => r.textContent)).toEqual(['Yes', 'No']);
    expect(radios(el).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    expect(value()).toBeNull();
    // One stop for Tab: the first, while none is picked.
    expect(radios(el).map((r) => r.tabIndex)).toEqual([0, -1]);
  });

  it('picks by a click, and “No” is an answer', () => {
    const { el, value } = yesNo();
    radios(el)[1].click();
    expect(value()).toBe(false);
    expect(radios(el).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(radios(el).map((r) => r.tabIndex)).toEqual([-1, 0]);
    radios(el)[0].click();
    expect(value()).toBe(true);
  });

  it('moves and picks with the arrows, the cursor going with it', () => {
    const { el, value } = yesNo();
    radios(el)[0].focus();
    press(radios(el)[0], 'ArrowRight');
    expect(value()).toBe(false);
    expect(document.activeElement).toBe(radios(el)[1]);
    press(radios(el)[1], 'ArrowDown');
    expect(value()).toBe(true);
    expect(document.activeElement).toBe(radios(el)[0]);
  });

  it('takes words of its own, and speaks the page’s language without them', () => {
    expect(radios(yesNo({ options: { yesLabel: 'I will', noLabel: 'I won’t' } }).el).map((r) => r.textContent)).toEqual(['I will', 'I won’t']);
    expect(radios(yesNo({}, {}, 'ar').el).map((r) => r.textContent)).toEqual(['نعم', 'لا']);
  });

  it('offers “Clear selection” when it need not be answered, never when it must', () => {
    const { el, value, refresh } = yesNo();
    radios(el)[0].click();
    const clear = el.querySelector('.fd-choice-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(value()).toBeNull();
    radios(el)[0].click();
    refresh({ required: true });
    expect(clear.hidden).toBe(true);
    expect((el.querySelector('[role=radiogroup]') as HTMLElement).getAttribute('aria-required')).toBe('true');
  });

  it('cannot be changed when read-only', () => {
    const { el, value, refresh } = yesNo();
    refresh({ readonly: true });
    expect(radios(el).every((r) => (r as HTMLButtonElement).disabled)).toBe(true);
    radios(el)[0].focus();
    press(radios(el)[0], 'ArrowRight');
    expect(value()).toBeNull();
  });
});

describe('checkboxes with a limit', () => {
  const limited = (atMost = 2) => mountKind({ type: 'selection', multiple: true, options: ROOMS }, { widget: 'checkboxes', validate: [{ atMost }] });

  it('turns the rest off once the most are ticked, and says how many it takes', () => {
    const { el, value } = limited();
    const note = el.querySelector('.fd-choice-limit') as HTMLElement;
    expect(note.getAttribute('role')).toBe('status');
    expect(note.textContent).toBe('');
    boxes(el)[0].click();
    boxes(el)[2].click();
    expect(value()).toEqual(['kitchen', 'gym']);
    expect(boxes(el).map((b) => b.disabled)).toEqual([false, true, false, true, false]);
    expect(note.textContent).toBe('Up to 2');
    boxes(el)[0].click();
    expect(boxes(el).some((b) => b.disabled)).toBe(false);
    expect(note.textContent).toBe('');
  });

  it('keeps no limit that holds only sometimes, or only warns', () => {
    const { el } = mountKind({ type: 'selection', multiple: true, options: ROOMS }, { widget: 'checkboxes', validate: [{ atMost: 1, when: 'x' }, { atMost: 1, level: 'warning' }] });
    boxes(el)[0].click();
    expect(boxes(el).some((b) => b.disabled)).toBe(false);
  });
});

describe('“None of these”', () => {
  it('unticks the others when ticked, and is unticked by another', () => {
    const { el, value } = mountKind({ type: 'selection', multiple: true, options: ROOMS, other: true }, { widget: 'checkboxes' });
    boxes(el)[0].click();
    boxes(el)[1].click();
    boxes(el)[4].click();
    expect(value()).toEqual(['none']);
    expect(boxes(el).map((b) => b.checked)).toEqual([false, false, false, false, true, false]);
    boxes(el)[2].click();
    expect(value()).toEqual(['gym']);
  });

  it('goes alone among pictures and tags too', () => {
    const pictures = mountKind({ type: 'selection', multiple: true, options: ROOMS }, { widget: 'image-choice' });
    const cards = [...pictures.el.querySelectorAll<HTMLButtonElement>('.fd-image-card')];
    cards[0].click();
    cards[4].click();
    expect(pictures.value()).toEqual(['none']);
    cards[1].click();
    expect(pictures.value()).toEqual(['quiet']);

    const tags = mountKind({ type: 'selection', multiple: true, options: ROOMS }, { widget: 'tags' });
    const input = tags.el.querySelector('input') as HTMLInputElement;
    typeInto(input, 'Gym');
    press(input, 'Enter');
    typeInto(input, 'None');
    press(input, 'Enter');
    expect(tags.value()).toEqual(['none']);
  });
});

describe('options in columns', () => {
  it('lays radios and checkboxes in as many columns as asked', () => {
    const { el } = mountKind({ type: 'selection', options: ROOMS }, { widget: 'radio', options: { columns: 3 } });
    const group = el.querySelector('[role=radiogroup]') as HTMLElement;
    expect(group.classList.contains('fd-choices-columns')).toBe(true);
    expect(group.style.getPropertyValue('--fd-choice-columns')).toBe('3');
  });

  it('lays pictures in columns, or all in a row', () => {
    const columns = mountKind({ type: 'selection', options: ROOMS }, { widget: 'image-choice', options: { columns: 2 } });
    expect((columns.el.querySelector('.fd-image-choices') as HTMLElement).style.getPropertyValue('--fd-choice-columns')).toBe('2');
    const row = mountKind({ type: 'selection', options: ROOMS }, { widget: 'image-choice', options: { columns: 'row' } });
    expect(row.el.querySelector('.fd-image-choices')?.classList.contains('fd-choices-row')).toBe(true);
  });
});

describe('pictures: their words, size and fit', () => {
  const desk = [{ value: 'a', label: 'Standing desk', image: 'a.png', alt: 'A tall desk by a window' }, { value: 'b', label: 'Bench', image: 'b.png' }];
  it('says what each picture shows', () => {
    const { el } = mountKind({ type: 'selection', options: desk }, { widget: 'image-choice' });
    expect([...el.querySelectorAll('img')].map((i) => i.alt)).toEqual(['A tall desk by a window', '']);
  });

  it('hides the words under the pictures, keeping them as each card’s name', () => {
    const { el } = mountKind({ type: 'selection', options: desk }, { widget: 'image-choice', options: { showLabels: false, imageSize: 'large', imageFit: 'whole' } });
    const group = el.querySelector('.fd-image-choices') as HTMLElement;
    expect(group.classList.contains('fd-image-choices-bare')).toBe(true);
    expect(group.dataset['size']).toBe('large');
    expect(group.dataset['fit']).toBe('whole');
    expect([...el.querySelectorAll('.fd-image-card')].map((c) => c.getAttribute('aria-label'))).toEqual(['Standing desk', 'Bench']);
  });
});

describe('a dropdown that searches its list', () => {
  const MANY = Array.from({ length: 20 }, (_, i) => ({ value: `f${i + 1}`, label: `Floor ${i + 1}` }));
  const box = (el: Element) => el.querySelector('input[role=combobox]') as HTMLInputElement;
  const list = (el: Element) => el.querySelector('[role=listbox]') as HTMLElement;
  const offered = (el: Element) => [...list(el).querySelectorAll('[role=option]')].map((o) => o.textContent);

  it('is a native select for a short list, and a combobox when asked or the list is long', () => {
    expect(mountKind({ type: 'selection', options: ROOMS }).el.tagName).toBe('SELECT');
    expect(box(mountKind({ type: 'selection', options: ROOMS }, { options: { search: true } }).el)).not.toBeNull();
    expect(box(mountKind({ type: 'selection', options: MANY }).el).id).toBe('fd-x');
    expect(mountKind({ type: 'selection', options: MANY }, { options: { search: false } }).el.tagName).toBe('SELECT');
  });

  it('filters as one types, picks with the arrows and Enter, and shows the choice in the box', () => {
    const { el, value } = mountKind({ type: 'selection', options: MANY });
    const input = box(el);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    typeInto(input, '1');
    expect(offered(el)).toEqual(['Floor 1', 'Floor 10', 'Floor 11', 'Floor 12', 'Floor 13', 'Floor 14', 'Floor 15', 'Floor 16', 'Floor 17', 'Floor 18', 'Floor 19']);
    press(input, 'ArrowDown');
    press(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe((list(el).querySelector('[aria-selected=true]') as HTMLElement).id);
    press(input, 'Enter');
    expect(value()).toBe('f10');
    expect(input.value).toBe('Floor 10');
    expect(list(el).hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('puts back the choice’s words when left half typed, and empties it when the box is emptied', () => {
    const { el, value } = mountKind({ type: 'selection', options: MANY });
    const input = box(el);
    typeInto(input, 'Floor 3');
    press(input, 'Enter');
    expect(value()).toBe('f3');
    typeInto(input, 'Flo');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('Floor 3');
    typeInto(input, '');
    input.dispatchEvent(new Event('blur'));
    expect(value()).toBeNull();
  });

  it('closes on Escape without choosing', () => {
    const { el, value } = mountKind({ type: 'selection', options: MANY });
    const input = box(el);
    typeInto(input, '2');
    press(input, 'Escape');
    expect(list(el).hidden).toBe(true);
    expect(value()).toBeNull();
  });
});

describe('tags of one’s own', () => {
  it('adds what was typed when nothing matches, offering it in the list', () => {
    const { el, value } = mountKind({ type: 'selection', multiple: true, options: ROOMS, ownAnswers: true }, { widget: 'tags' });
    const input = el.querySelector('input') as HTMLInputElement;
    typeInto(input, 'Bike rack');
    expect([...el.querySelectorAll('[role=option]')].map((o) => o.textContent)).toEqual(['Create “Bike rack”']);
    press(input, 'Enter');
    expect(value()).toEqual(['Bike rack']);
    expect([...el.querySelectorAll('.fd-chip-label')].map((c) => c.textContent)).toEqual(['Bike rack']);
  });

  it('adds nothing of its own without the setting', () => {
    const { el, value } = mountKind({ type: 'selection', multiple: true, options: ROOMS }, { widget: 'tags' });
    const input = el.querySelector('input') as HTMLInputElement;
    typeInto(input, 'Bike rack');
    press(input, 'Enter');
    expect(value()).toEqual([]);
  });
});

describe('shuffled options kept in place', () => {
  it('keeps an option held in place where it was written, and one that goes alone last', () => {
    const options = Array.from({ length: 8 }, (_, i) => ({ value: i, label: `O${i}`, ...(i === 0 ? { fixed: true } : {}), ...(i === 3 ? { exclusive: true } : {}) }));
    for (let n = 0; n < 12; n++) {
      const shown = shownOptions(options, {}, `q${n}`, { options: { shuffle: true } });
      expect(shown[0].label).toBe('O0');
      expect(shown[7].label).toBe('O3');
      expect(new Set(shown.map((o) => o.value)).size).toBe(8);
    }
  });
});

describe('a ranking kept as it is shown', () => {
  const ranking = (node: Record<string, unknown> = {}) =>
    mountKind({ type: 'selection', multiple: true, options: ROOMS.slice(0, 4) }, { widget: 'ranking', ...node });
  it('is answered by “Keep this order”, which then goes', () => {
    const { el, value } = ranking();
    const keep = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Keep this order') as HTMLButtonElement;
    expect(keep.hidden).toBe(false);
    keep.click();
    expect(value()).toEqual(['kitchen', 'quiet', 'gym', 'library']);
    expect(keep.hidden).toBe(true);
  });

  it('ranks only the top few: picked, then put in order', () => {
    const { el, value } = ranking({ options: { top: 2 } });
    const pick = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.fd-rank-pick')].find((b) => b.textContent === label) as HTMLButtonElement;
    const add = (label: string) => pick(label).click();
    expect(el.querySelector('.fd-choice-limit')?.textContent).toBe('Up to 2');
    expect(el.querySelectorAll('.fd-rank-item')).toHaveLength(0);
    add('Gym');
    add('Kitchen');
    expect(value()).toEqual(['gym', 'kitchen']);
    expect([...el.querySelectorAll('.fd-rank-item .fd-rank-words')].map((w) => w.textContent)).toEqual(['Gym', 'Kitchen']);
    // Full: the rest wait.
    expect(pick('Library').disabled).toBe(true);
    expect(pick('Gym').hidden).toBe(true);
    (el.querySelector('[aria-label="Move Kitchen up"]') as HTMLButtonElement).click();
    expect(value()).toEqual(['kitchen', 'gym']);
    (el.querySelector('[aria-label="Remove Gym"]') as HTMLButtonElement).click();
    expect(value()).toEqual(['kitchen']);
    expect(pick('Library').disabled).toBe(false);
    expect(pick('Gym').hidden).toBe(false);
  });
});

describe('a matrix', () => {
  const field = (extra: Record<string, unknown> = {}) => ({
    type: 'matrix',
    rows: [{ value: 'a', label: 'Setup' }, { value: 'b', label: 'Daily use' }, { value: 'c', label: 'Help' }],
    columns: [{ value: 1, label: 'Hard' }, { value: 2, label: 'OK' }, { value: 3, label: 'Easy' }],
    ...extra,
  });
  const rows = (el: Element) => [...el.querySelectorAll('tbody tr')].map((r) => r.getAttribute('aria-label'));

  it('marks each row required when it is', () => {
    const { el, refresh } = mountKind(field());
    refresh({ required: true });
    expect([...el.querySelectorAll('[role=radiogroup]')].map((r) => r.getAttribute('aria-required'))).toEqual(['true', 'true', 'true']);
  });

  it('shows each column’s words beside its box, for a phone’s cards', () => {
    const { el } = mountKind(field());
    expect([...el.querySelectorAll('tbody tr:first-child .fd-matrix-column')].map((c) => c.textContent)).toEqual(['Hard', 'OK', 'Easy']);
  });

  it('shuffles its rows when asked', () => {
    const orders = new Set<string>();
    for (let n = 0; n < 10; n++) orders.add(String(rows(mountKind(field(), { options: { shuffle: true } }).el)));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('takes each column once: picking it in a row takes it from the row that had it', () => {
    const { el, value } = mountKind(field({ onePerColumn: true }));
    const cell = (row: number, column: number) => el.querySelectorAll<HTMLInputElement>('tbody tr')[row].querySelectorAll('input')[column];
    cell(0, 0).click();
    cell(1, 0).click();
    expect(value()).toEqual({ b: 1 });
    expect(cell(0, 0).checked).toBe(false);
  });
});
