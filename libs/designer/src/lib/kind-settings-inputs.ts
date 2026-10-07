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
 * time's and a time's step of minutes, and a time's earliest and latest;
 * keywords' suggestions, separator and most; a progress bar's most, colour
 * and percent.
 */

export interface InputSettings {
  elements: HTMLElement[];
  refresh(page: Page, node: FieldNode): void;
}
type Part = Omit<InputSettings, 'elements'> & { element: HTMLElement };

const numberOrNull = (text: string) => (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text));

export function inputSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): InputSettings | null {
  const w = designer.words.questions;
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
    const input = limitBox(w.mostCharacters, 'size', { min: '1', step: '1', placeholder: w.any });
    return { element: word(w.mostCharacters, input), refresh: (page, node) => show(input, own(page.fields[node.field], 'size')) };
  }

  /** A paragraph's rows, and whether it grows as people type. */
  function rows(): Part {
    const count = select(w.rows, Array.from({ length: 11 }, (_, i) => [String(i + 2), String(i + 2)]));
    count.addEventListener('change', () => designer.setWidgetOptions(id, { rows: count.value === '3' ? null : Number(count.value) }));
    const grows = toggle(w.growsAsTyped, (on) => designer.setWidgetOptions(id, { autoGrow: on ? null : false }));
    return {
      element: row(word(w.rows, count), grows.element),
      refresh(_page, node) {
        const n = node.options?.['rows'];
        count.value = String(typeof n === 'number' ? n : 3);
        grows.button.setAttribute('aria-checked', String(node.options?.['autoGrow'] !== false));
      },
    };
  }

  /** Where a number or an amount runs from and to, and its decimals. */
  function range(): Part {
    const from = limitBox(w.from, 'min', { step: 'any', placeholder: w.any });
    const to = limitBox(w.toLabel, 'max', { step: 'any', placeholder: w.any });
    const decimals = select(w.decimals, [['', w.usual], ...Array.from({ length: 7 }, (_, d): [string, string] => [String(d), String(d)])]);
    decimals.addEventListener('change', () => designer.setLimits(id, { decimals: numberOrNull(decimals.value) }));
    return {
      element: row(word(w.from, from), word(w.to, to), word(w.decimals, decimals)),
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
    const before = box(w.unitBefore, 'prefix', '≈');
    const after = box(w.unitAfter, 'suffix', 'kg');
    return {
      element: row(word(w.unitBefore, before), word(w.unitAfter, after)),
      refresh(_page, node) {
        show(before, node.options?.['prefix']);
        show(after, node.options?.['suffix']);
      },
    };
  }

  /** A rating's look: stars, hearts, thumbs up or numbers. */
  function look(): Part {
    const icon = select(w.icon, [['', w.stars], ['heart', w.hearts], ['thumb', w.thumbs], ['number', w.numbers]]);
    icon.addEventListener('change', () => designer.setWidgetOptions(id, { icon: icon.value || null }));
    return { element: word(w.icon, icon), refresh: (_page, node) => show(icon, node.options?.['icon']) };
  }

  /** Words at either end, under the first and last points, as a scale has them. */
  function ends(): Part {
    const box = (which: 'start' | 'end') => {
      const input = el('input', { class: 'fd-inline-input fd-inline-end-words', 'aria-label': w.wordsAt(which), placeholder: w.labelOptional, autocomplete: 'off' }) as HTMLInputElement;
      input.addEventListener('input', () => designer.setWidgetOptions(id, { [`${which}Label`]: input.value }));
      return input;
    };
    const [start, end] = [box('start'), box('end')];
    return {
      element: row(word(w.start, start), word(w.end, end)),
      refresh(_page, node) {
        show(start, node.options?.['startLabel']);
        show(end, node.options?.['endLabel']);
      },
    };
  }

  /** A linear scale made NPS in one step, and coloured as NPS when it runs 0 to 10. */
  function nps(): Part {
    const make = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.makeNps) as HTMLButtonElement;
    make.addEventListener('click', () => designer.makeNps(id));
    const colours = toggle(w.colourNps, (on) => designer.setWidgetOptions(id, { nps: on || null }));
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
    const name = which === 'min' ? w.earliest : w.latest;
    const how = select(name, [['', w.anyDay], ['today', w.today], ['after', w.daysAfter], ['before', w.daysBefore], ['day', w.aDay]]);
    const days = numberBox('', { min: '1', step: '1' });
    const date = el('input', { type: 'date', class: 'fd-inline-input', 'aria-label': w.dayOf(which) }) as HTMLInputElement;
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
        days.setAttribute('aria-label', w.daysFrom(mode === 'before', which));
        date.hidden = mode !== 'day';
      },
    };
  }

  /** The weekends a date may not fall on: Saturday and Sunday, or Friday and Saturday. */
  function weekends(): Part {
    const WEEKS: Record<string, number[]> = { 'sat-sun': [1, 2, 3, 4, 5], 'fri-sat': [1, 2, 3, 4, 7] };
    const weekend = select(w.weekends, [['', w.allowed], ['sat-sun', w.notSatSun], ['fri-sat', w.notFriSat], ['own', w.someDays]]);
    weekend.addEventListener('change', () => weekend.value !== 'own' && designer.setLimits(id, { days: WEEKS[weekend.value] ?? null }));
    return {
      element: word(w.weekends, weekend),
      refresh(page, node) {
        const days = JSON.stringify(own(page.fields[node.field], 'days') ?? null);
        weekend.value = days === 'null' ? '' : (Object.keys(WEEKS).find((k) => JSON.stringify(WEEKS[k]) === days) ?? 'own');
        (weekend.options[3] as HTMLOptionElement).hidden = weekend.value !== 'own';
      },
    };
  }

  /** A date that starts on the day the form is opened. */
  function startsToday(): Part {
    const today = toggle(w.startsToday, (on) => designer.setLimits(id, { startsToday: on }));
    return { element: today.element, refresh: (page, node) => today.button.setAttribute('aria-checked', String(own(page.fields[node.field], 'default') === 'today')) };
  }

  /** The minutes a date and time's or a time's picker steps by. */
  function minutes(): Part {
    const step = select(w.minutes, ['1', '5', '10', '15', '30'].map((m): [string, string] => [m, m === '1' ? w.anyMinute : w.every(m)]));
    step.addEventListener('change', () => designer.setWidgetOptions(id, { step: step.value === '1' ? null : Number(step.value) }));
    return { element: word(w.minutes, step), refresh: (_page, node) => (step.value = String(node.options?.['step'] ?? 1)) };
  }

  /** A time's earliest and latest: "09:00", "17:30". */
  function hours(): Part {
    const box = (label: string, key: string) => {
      const input = el('input', { type: 'time', class: 'fd-inline-input', 'aria-label': label }) as HTMLInputElement;
      input.addEventListener('change', () => designer.setWidgetOptions(id, { [key]: input.value || null }));
      return input;
    };
    const [from, to] = [box(w.earliestTime, 'min'), box(w.latestTime, 'max')];
    return {
      element: row(word(w.earliestTime, from), word(w.latestTime, to)),
      refresh(_page, node) {
        show(from, node.options?.['min']);
        show(to, node.options?.['max']);
      },
    };
  }

  /** Keywords: the suggestions offered as people type, one a line; what keeps them apart; at most how many. */
  function keywords(): Part {
    const list = el('textarea', { class: 'fd-inline-input fd-inline-list', 'aria-label': w.suggestionsLabel, rows: '3', placeholder: 'oak\nglass' }) as HTMLTextAreaElement;
    list.addEventListener('input', () => designer.setWidgetList(id, 'suggestions', list.value.split('\n')));
    const separator = select(w.separator, [[',', w.comma], [';', w.semicolon]]);
    separator.addEventListener('change', () => designer.setWidgetOptions(id, { separator: separator.value === ',' ? null : separator.value }));
    const most = numberBox(w.atMost, { min: '1', step: '1', placeholder: w.any });
    most.addEventListener('change', () => {
      const n = numberOrNull(most.value);
      designer.setWidgetOptions(id, { max: n !== null && Number.isInteger(n) && n > 0 ? n : null });
    });
    return {
      element: el('div', { class: 'fd-kind-block' }, word(w.suggestions, list), row(word(w.separator, separator), word(w.atMost, most))),
      refresh(_page, node) {
        const suggestions = node.options?.['suggestions'];
        if (!focused(list)) list.value = Array.isArray(suggestions) ? suggestions.join('\n') : '';
        separator.value = String(node.options?.['separator'] ?? ',');
        show(most, node.options?.['max']);
      },
    };
  }

  /** A progress bar's most, its colour — by how far it has come, or always one — and whether the percent shows on it. */
  function progress(): Part {
    const most = limitBox(w.most, 'max', { min: '1', step: '1' });
    const colour = select(w.colour, [['', w.byProgress], ['success', w.green], ['warning', w.amber], ['danger', w.red], ['info', w.blue]]);
    colour.addEventListener('change', () => designer.setWidgetOptions(id, { color: colour.value || null }));
    const percent = toggle(w.showsPercent, (on) => designer.setWidgetOptions(id, { showPercent: on ? null : false }));
    return {
      element: row(word(w.most, most), word(w.colour, colour), percent.element),
      refresh(page, node) {
        show(most, own(page.fields[node.field], 'max') ?? 100);
        show(colour, node.options?.['color']);
        percent.button.setAttribute('aria-checked', String(node.options?.['showPercent'] !== false));
      },
    };
  }

  /**
   * A field of the page an option names (`endField`, `startField`,
   * `currencyField`, `dueField`): those the kind can read, none at the start.
   */
  function fieldPick(label: string, key: string, suits: (field: Field, name: string, own: string) => boolean): Part {
    const pick = select(label, []);
    pick.addEventListener('change', () => designer.setWidgetOptions(id, { [key]: pick.value || null }));
    return {
      element: word(label, pick),
      refresh(page, node) {
        const fields = Object.entries(page.fields).filter(([name, field]) => name !== node.field && suits(field, name, node.field));
        const keyOf = JSON.stringify(fields.map(([name, field]) => [name, field.label]));
        if (pick.dataset['fields'] !== keyOf) {
          pick.dataset['fields'] = keyOf;
          pick.replaceChildren(el('option', { value: '' }, w.noField), ...fields.map(([name, field]) => el('option', { value: name }, field.label || name)));
        }
        show(pick, node.options?.[key]);
      },
    };
  }

  /** A box whose text, once typed, is a widget's option: a model's name. */
  function optionText(label: string, key: string, placeholder: string): Part {
    const input = el('input', { class: 'fd-inline-input', 'aria-label': label, placeholder, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    input.addEventListener('change', () => designer.setWidgetOptions(id, { [key]: input.value.trim() || null }));
    return { element: word(label, input), refresh: (_page, node) => show(input, node.options?.[key]) };
  }

  /** A switch that sets a widget's option to true, or takes it away. */
  function optionToggle(label: string, key: string): Part {
    const on = toggle(label, (yes) => designer.setWidgetOptions(id, { [key]: yes || null }));
    return { element: on.element, refresh: (_page, node) => on.button.setAttribute('aria-checked', String(node.options?.[key] === true)) };
  }

  /** A frame's height in pixels. */
  function height(): Part {
    const box = numberBox(w.heightPx, { min: '120', step: '20', placeholder: '480' });
    box.addEventListener('change', () => {
      const n = numberOrNull(box.value);
      designer.setWidgetOptions(id, { height: n !== null && n > 0 ? Math.round(n) : null });
    });
    return { element: word(w.heightPx, box), refresh: (_page, node) => show(box, node.options?.['height']) };
  }

  /** A duration's words after it, inside its box: "hours". */
  function after(): Part {
    const input = el('input', { class: 'fd-inline-input fd-inline-unit', 'aria-label': w.unitAfter, placeholder: 'hours', autocomplete: 'off' }) as HTMLInputElement;
    input.addEventListener('input', () => designer.setWidgetOptions(id, { suffix: input.value.trim() || null }));
    return { element: word(w.unitAfter, input), refresh: (_page, node) => show(input, node.options?.['suffix']) };
  }

  /** What a timer's hours are kept in: hours, or minutes as a work order's are. */
  function keptIn(): Part {
    const unit = select(w.keptIn, [['', w.inHours], ['minutes', w.inMinutes]]);
    unit.addEventListener('change', () => designer.setWidgetOptions(id, { unit: unit.value || null }));
    return { element: word(w.keptIn, unit), refresh: (_page, node) => show(unit, node.options?.['unit']) };
  }

  /** How many columns properties take, one or two. */
  function propertyColumns(): Part {
    const count = select(w.propertyColumns, [['', '1'], ['2', '2']]);
    count.addEventListener('change', () => designer.setWidgetOptions(id, { columns: count.value ? 2 : null }));
    return { element: word(w.propertyColumns, count), refresh: (_page, node) => show(count, node.options?.['columns'] === 2 ? '2' : '') };
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
  if (kind === 'keywords') parts.push(keywords());
  if (kind === 'progress') parts.push(progress());
  // The business kinds: the fields they read beside their own, and their looks.
  const sameType = (field: Field, _name: string, own: string) => field.type === designer.getPage().fields[own]?.type;
  if (kind === 'duration') parts.push(after());
  if (kind === 'date-range') parts.push(fieldPick(w.endsOn, 'endField', sameType));
  if (kind === 'timer') parts.push(fieldPick(w.runsFrom, 'startField', (field) => field.type === 'datetime'), keptIn());
  if (kind === 'state-dot') parts.push(optionToggle(w.wordsBeside, 'label'));
  if (kind === 'pdf' || kind === 'embed') parts.push(height());
  if (kind === 'distribution') parts.push(optionText(w.accountsFrom, 'model', 'account.analytic.account'));
  if (kind === 'tax-totals' || kind === 'payments') parts.push(fieldPick(w.currencyFrom, 'currencyField', (field) => field.type === 'many2one' || field.type === 'char'));
  if (kind === 'tax-totals') parts.push(optionToggle(w.taxTyped, 'editable'));
  if (kind === 'payments') parts.push(fieldPick(w.amountDueFrom, 'dueField', (field) => field.type === 'monetary' || field.type === 'float'));
  if (kind === 'properties') parts.push(propertyColumns(), optionToggle(w.canAddProperty, 'add'));
  if (!parts.length) return null;
  return { elements: parts.map((p) => p.element), refresh: (page, node) => parts.forEach((p) => p.refresh(page, node)) };
}
