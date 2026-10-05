import type { Field, FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { InputLimits } from './input-commands';

/**
 * The text, number and date kinds' settings, in the picked field itself
 * beside the rest of its kind's, and in the side panel the same way: the
 * most characters a box takes, a paragraph's rows and whether it grows; a
 * number's or an amount's range and decimals, and a number's unit; a
 * rating's look and the words at a rating's or a slider's ends; a linear
 * scale made NPS, and coloured as NPS; a date's earliest and latest day,
 * fixed or counted from today, its weekends and its start; a date and
 * time's and a time's step of minutes, and a time's earliest and latest.
 */

export interface InputSettings {
  elements: HTMLElement[];
  refresh(page: Page, node: FieldNode): void;
}
type Part = Omit<InputSettings, 'elements'> & { element: HTMLElement };

const numberOrNull = (text: string) => (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text));

export function inputSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): InputSettings | null {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const row = (...parts: HTMLElement[]) => el('div', { class: 'fd-inline-row' }, ...parts);
  const numberBox = (label: string, extra: Record<string, string> = {}) =>
    el('input', { type: 'number', class: 'fd-inline-input fd-inline-number', 'aria-label': label, inputmode: 'decimal', ...extra }) as HTMLInputElement;
  const select = (label: string, choices: [string, string][]) =>
    el('select', { class: 'fd-inline-select', 'aria-label': label }, ...choices.map(([value, words]) => el('option', { value }, words))) as HTMLSelectElement;
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  /** A box shows what is saved, unless the cursor is in it. */
  const show = (input: HTMLInputElement | HTMLSelectElement, value: unknown) => {
    if (!focused(input)) input.value = value === undefined || value === null ? '' : String(value);
  };
  /** A number box whose number, once typed and left, is a limit of the field. */
  const limitBox = (label: string, key: keyof InputLimits, extra: Record<string, string> = {}) => {
    const input = numberBox(label, extra);
    input.addEventListener('change', () => designer.setLimits(id, { [key]: numberOrNull(input.value) }));
    return input;
  };
  const own = (field: Field, key: string) => (field as Record<string, unknown>)[key];

  /** The most characters a short answer or a paragraph takes: a count shows under its box. */
  function most(): Part {
    const input = limitBox('Most characters', 'size', { min: '1', step: '1', placeholder: 'Any' });
    return { element: word('Most characters', input), refresh: (page, node) => show(input, own(page.fields[node.field], 'size')) };
  }

  /** A paragraph's rows, and whether it grows as people type. */
  function rows(): Part {
    const count = select('Rows', Array.from({ length: 11 }, (_, i) => [String(i + 2), String(i + 2)]));
    count.addEventListener('change', () => designer.setWidgetOptions(id, { rows: count.value === '3' ? null : Number(count.value) }));
    const grows = toggle('Grows as people type', (on) => designer.setWidgetOptions(id, { autoGrow: on ? null : false }));
    return {
      element: row(word('Rows', count), grows.element),
      refresh(_page, node) {
        const n = node.options?.['rows'];
        count.value = String(typeof n === 'number' ? n : 3);
        grows.button.setAttribute('aria-checked', String(node.options?.['autoGrow'] !== false));
      },
    };
  }

  /** Where a number or an amount runs from and to, and its decimals. */
  function range(): Part {
    const from = limitBox('From', 'min', { step: 'any', placeholder: 'Any' });
    const to = limitBox('To', 'max', { step: 'any', placeholder: 'Any' });
    const decimals = select('Decimals', [['', 'Usual'], ...Array.from({ length: 7 }, (_, d): [string, string] => [String(d), String(d)])]);
    decimals.addEventListener('change', () => designer.setLimits(id, { decimals: numberOrNull(decimals.value) }));
    return {
      element: row(word('From', from), word('to', to), word('Decimals', decimals)),
      refresh(page, node) {
        const def = page.fields[node.field];
        show(from, own(def, 'min'));
        show(to, own(def, 'max'));
        show(decimals, def.type === 'float' || def.type === 'monetary' ? def.digits?.[1] : undefined);
      },
    };
  }

  /** A unit inside the number's box, before or after it: "kg", "°C", "%". */
  function units(): Part {
    const box = (label: string, key: string, placeholder: string) => {
      const input = el('input', { class: 'fd-inline-input fd-inline-unit', 'aria-label': label, placeholder, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      input.addEventListener('input', () => designer.setWidgetOptions(id, { [key]: input.value.trim() || null }));
      return input;
    };
    const before = box('Unit before', 'prefix', '≈');
    const after = box('Unit after', 'suffix', 'kg');
    return {
      element: row(word('Unit before', before), word('Unit after', after)),
      refresh(_page, node) {
        show(before, node.options?.['prefix']);
        show(after, node.options?.['suffix']);
      },
    };
  }

  /** A rating's look: stars, hearts, thumbs up or numbers. */
  function look(): Part {
    const icon = select('Icon', [['', 'Stars'], ['heart', 'Hearts'], ['thumb', 'Thumbs up'], ['number', 'Numbers']]);
    icon.addEventListener('change', () => designer.setWidgetOptions(id, { icon: icon.value || null }));
    return { element: word('Icon', icon), refresh: (_page, node) => show(icon, node.options?.['icon']) };
  }

  /** Words at either end, under the first and last points, as a scale has them. */
  function ends(): Part {
    const box = (which: 'start' | 'end') => {
      const input = el('input', { class: 'fd-inline-input fd-inline-end-words', 'aria-label': `Words at the ${which}`, placeholder: 'Label (optional)', autocomplete: 'off' }) as HTMLInputElement;
      input.addEventListener('input', () => designer.setWidgetOptions(id, { [`${which}Label`]: input.value }));
      return input;
    };
    const [start, end] = [box('start'), box('end')];
    return {
      element: row(word('Start', start), word('End', end)),
      refresh(_page, node) {
        show(start, node.options?.['startLabel']);
        show(end, node.options?.['endLabel']);
      },
    };
  }

  /** A linear scale made NPS in one step, and coloured as NPS when it runs 0 to 10. */
  function nps(): Part {
    const make = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Make it NPS') as HTMLButtonElement;
    make.addEventListener('click', () => designer.makeNps(id));
    const colours = toggle('Colour as NPS', (on) => designer.setWidgetOptions(id, { nps: on || null }));
    return {
      element: row(make, colours.element),
      refresh(page, node) {
        const def = page.fields[node.field];
        const nps = 'min' in def && def.min === 0 && def.max === 10;
        colours.element.hidden = !nps;
        colours.button.setAttribute('aria-checked', String(node.options?.['nps'] === true));
      },
    };
  }

  /**
   * A date's earliest or latest day: any, today, days after or before today,
   * or a day — "today", "today+30", "today-7", "2026-03-02" in the format.
   */
  function day(which: 'min' | 'max'): Part {
    const name = which === 'min' ? 'Earliest' : 'Latest';
    const how = select(name, [['', 'Any day'], ['today', 'Today'], ['after', 'Days after today'], ['before', 'Days before today'], ['day', 'A day']]);
    const days = numberBox('', { min: '1', step: '1' });
    const date = el('input', { type: 'date', class: 'fd-inline-input', 'aria-label': `${name} day` }) as HTMLInputElement;
    // A day picked to be fixed waits for its date: until then the limit stays as it was.
    let waiting = false;
    const save = () => {
      const n = numberOrNull(days.value) ?? 1;
      const limit = { '': null, today: 'today', after: `today+${n}`, before: `today-${n}`, day: date.value || null }[how.value];
      waiting = how.value === 'day' && !limit;
      if (waiting) return refreshed();
      designer.setLimits(id, { [which]: limit === 'today+0' || limit === 'today-0' ? 'today' : limit });
    };
    let refreshed = () => undefined as void;
    how.addEventListener('change', save);
    days.addEventListener('change', save);
    date.addEventListener('change', save);
    return {
      element: row(word(name, how), days, date),
      refresh(page, node) {
        refreshed = () => this.refresh(page, node);
        const limit = own(page.fields[node.field], which);
        const counted = typeof limit === 'string' ? /^today([+-])(\d+)$/.exec(limit) : null;
        const mode = waiting || (typeof limit === 'string' && !counted && limit !== 'today') ? 'day' : typeof limit !== 'string' ? '' : limit === 'today' ? 'today' : (counted as RegExpExecArray)[1] === '+' ? 'after' : 'before';
        if (!focused(how)) how.value = mode;
        if (counted) show(days, counted[2]);
        if (mode === 'day' && !waiting) show(date, limit);
        days.hidden = mode !== 'after' && mode !== 'before';
        days.setAttribute('aria-label', `Days ${mode === 'before' ? 'before' : 'after'} today, ${name.toLowerCase()}`);
        date.hidden = mode !== 'day';
      },
    };
  }

  /** The weekends a date may not fall on: Saturday and Sunday, or Friday and Saturday. */
  function weekends(): Part {
    const WEEKS: Record<string, number[]> = { 'sat-sun': [1, 2, 3, 4, 5], 'fri-sat': [1, 2, 3, 4, 7] };
    const weekend = select('Weekends', [['', 'Allowed'], ['sat-sun', 'Not Saturday or Sunday'], ['fri-sat', 'Not Friday or Saturday'], ['own', 'Some days only']]);
    weekend.addEventListener('change', () => weekend.value !== 'own' && designer.setLimits(id, { days: WEEKS[weekend.value] ?? null }));
    return {
      element: word('Weekends', weekend),
      refresh(page, node) {
        const days = JSON.stringify(own(page.fields[node.field], 'days') ?? null);
        weekend.value = days === 'null' ? '' : (Object.keys(WEEKS).find((k) => JSON.stringify(WEEKS[k]) === days) ?? 'own');
        (weekend.options[3] as HTMLOptionElement).hidden = weekend.value !== 'own';
      },
    };
  }

  /** A date that starts on the day the form is opened. */
  function startsToday(): Part {
    const today = toggle('Starts on today', (on) => designer.setLimits(id, { startsToday: on }));
    return { element: today.element, refresh: (page, node) => today.button.setAttribute('aria-checked', String(own(page.fields[node.field], 'default') === 'today')) };
  }

  /** The minutes a date and time's or a time's picker steps by. */
  function minutes(): Part {
    const step = select('Minutes', ['1', '5', '10', '15', '30'].map((m): [string, string] => [m, m === '1' ? 'Any minute' : `Every ${m}`]));
    step.addEventListener('change', () => designer.setWidgetOptions(id, { step: step.value === '1' ? null : Number(step.value) }));
    return { element: word('Minutes', step), refresh: (_page, node) => (step.value = String(node.options?.['step'] ?? 1)) };
  }

  /** A time's earliest and latest: "09:00", "17:30". */
  function hours(): Part {
    const box = (label: string, key: string) => {
      const input = el('input', { type: 'time', class: 'fd-inline-input', 'aria-label': label }) as HTMLInputElement;
      input.addEventListener('change', () => designer.setWidgetOptions(id, { [key]: input.value || null }));
      return input;
    };
    const [from, to] = [box('Earliest time', 'min'), box('Latest time', 'max')];
    return {
      element: row(word('Earliest time', from), word('Latest time', to)),
      refresh(_page, node) {
        show(from, node.options?.['min']);
        show(to, node.options?.['max']);
      },
    };
  }

  const parts: Part[] = [];
  if (kind === 'short-answer' || kind === 'paragraph') parts.push(most());
  if (kind === 'paragraph') parts.push(rows());
  if (kind === 'number' || kind === 'amount') parts.push(range());
  if (kind === 'number') parts.push(units());
  if (kind === 'rating') parts.push(look());
  if (kind === 'rating' || kind === 'slider') parts.push(ends());
  if (kind === 'scale') parts.push(nps());
  if (kind === 'date' || kind === 'date-time') parts.push(day('min'), day('max'), weekends());
  if (kind === 'date') parts.push(startsToday());
  if (kind === 'time') parts.push(hours());
  if (kind === 'date-time' || kind === 'time') parts.push(minutes());
  if (!parts.length) return null;
  return { elements: parts.map((p) => p.element), refresh: (page, node) => parts.forEach((p) => p.refresh(page, node)) };
}
