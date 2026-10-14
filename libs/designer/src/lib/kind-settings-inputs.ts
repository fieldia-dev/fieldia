import type { Field, FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { CODE_LANGUAGE_CHOICES } from './code-languages';
import type { InputLimits } from './input-commands';
import { settingNumber, type SettingNumberOptions } from './number-box';

/**
 * The text, number and date kinds' settings, in the picked field itself
 * beside the rest of its kind's, and in the side panel the same way: the
 * most characters a box takes, a paragraph's rows and whether it grows; a
 * number's or an amount's range and decimals, and a number's unit; how
 * an amount is written where it is read (by code, after it, short); a
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
/** A setting's number as the page holds it, or null. */
const held = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function inputSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): InputSettings | null {
  const w = designer.words.questions;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const row = (...parts: HTMLElement[]) => el('div', { class: 'fd-inline-row' }, ...parts);
  /** The designer's number box: Arabic digits and a decimal comma read, kept as it is left, what does not fit said. */
  const numberBox = (options: SettingNumberOptions & { placeholder?: string }) =>
    settingNumber(el, designer, { ...options, attrs: { class: 'fd-inline-input fd-inline-number', ...(options.placeholder ? { placeholder: options.placeholder } : {}), ...options.attrs } });
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
  /**
   * A number box whose number, once typed and left, is a limit of the field (`key`), or takes it away when emptied; what
   * the page holds is `saved` as it last drew. A whole-number field's limits are whole numbers.
   */
  const limitBox = (label: string, key: keyof InputLimits, more: Partial<SettingNumberOptions> & { placeholder?: string } = {}) => {
    let saved: number | null = null;
    const options: SettingNumberOptions & { placeholder?: string } = { label, optional: true, ...more, saved: () => saved, commit: (n) => designer.setLimits(id, { [key]: n }) };
    const box = numberBox(options);
    return {
      input: box.input,
      show(field: Field, value: unknown) {
        if (more.integer === undefined) options.integer = field.type === 'integer';
        saved = held(value);
        box.refresh();
      },
    };
  };
  const own = (field: Field, key: string) => (field as Record<string, unknown>)[key];

  /** The most characters a short answer or a paragraph takes: a count shows under its box. */
  function most(): Part {
    const box = limitBox(w.mostCharacters, 'size', { integer: true, min: 1, placeholder: w.any });
    return { element: word(w.mostCharacters, box.input), refresh: (page, node) => box.show(page.fields[node.field], own(page.fields[node.field], 'size')) };
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
    const from = limitBox(w.from, 'min', { placeholder: w.any });
    const to = limitBox(w.toLabel, 'max', { placeholder: w.any });
    const decimals = select(w.decimals, [['', w.usual], ...Array.from({ length: 7 }, (_, d): [string, string] => [String(d), String(d)])]);
    decimals.addEventListener('change', () => designer.setLimits(id, { decimals: numberOrNull(decimals.value) }));
    return {
      element: row(word(w.from, from.input), word(w.to, to.input), word(w.decimals, decimals)),
      refresh(page, node) {
        const def = page.fields[node.field];
        from.show(def, own(def, 'min'));
        to.show(def, own(def, 'max'));
        show(decimals, def.type === 'float' || def.type === 'monetary' ? def.digits?.[1] : undefined);
      },
    };
  }

  /** How an amount is written where it is read: its currency by symbol or code, before or after it, and short ("4.5M"). */
  function money(): Part {
    const as = select(w.currencyShown, [['symbol', w.currencyAs.symbol], ['code', w.currencyAs.code]]);
    as.addEventListener('change', () => designer.setMoneyLook(id, { currency: as.value === 'code' ? 'code' : null }));
    const at = select(w.currencyGoes, [['', w.currencyWhere.usual], ['before', w.currencyWhere.before], ['after', w.currencyWhere.after]]);
    at.addEventListener('change', () => designer.setMoneyLook(id, { at: (at.value || null) as 'before' | 'after' | null }));
    const short = toggle(w.shortAmount, (on) => designer.setMoneyLook(id, { short: on || null }));
    return {
      element: row(word(w.currencyShown, as), word(w.currencyGoes, at), short.element),
      refresh(page, node) {
        const def = page.fields[node.field];
        const look = def.type === 'monetary' ? def.money : undefined;
        show(as, look?.currency ?? 'symbol');
        show(at, look?.at);
        short.button.setAttribute('aria-checked', String(!!look?.short));
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
    /** How many days from today: the limit's, else the last good count, else 1 — never one left in a hidden box. */
    let count = 1;
    const counting: SettingNumberOptions = {
      label: w.daysFrom(false, which),
      integer: true,
      min: 1,
      saved: () => count,
      commit(n) {
        const before = count;
        count = n ?? count;
        const done = save();
        if (!done) count = before;
        return done;
      },
    };
    const days = numberBox(counting);
    const date = el('input', { type: 'date', class: 'fd-inline-input', 'aria-label': w.dayOf(which) }) as HTMLInputElement;
    // A day picked to be fixed waits for its date: until then the limit stays as it was.
    let waiting = false;
    function save(): boolean {
      const limit = { '': null, today: 'today', after: `today+${count}`, before: `today-${count}`, day: date.value || null }[how.value];
      waiting = how.value === 'day' && !limit;
      if (waiting) {
        refreshed();
        return true;
      }
      return designer.setLimits(id, { [which]: limit });
    }
    let refreshed = () => undefined as void;
    how.addEventListener('change', save);
    date.addEventListener('change', save);
    return {
      element: row(word(name, how), days.input, date),
      refresh(page, node) {
        refreshed = () => this.refresh(page, node);
        const limit = own(page.fields[node.field], which);
        const counted = typeof limit === 'string' ? /^today([+-])(\d+)$/.exec(limit) : null;
        const mode = waiting || (typeof limit === 'string' && !counted && limit !== 'today') ? 'day' : typeof limit !== 'string' ? '' : limit === 'today' ? 'today' : (counted as RegExpExecArray)[1] === '+' ? 'after' : 'before';
        if (!focused(how)) how.value = mode;
        if (counted && Number(counted[2]) >= 1) count = Number(counted[2]);
        if (mode === 'day' && !waiting) show(date, limit);
        days.input.hidden = mode !== 'after' && mode !== 'before';
        counting.label = w.daysFrom(mode === 'before', which);
        days.input.setAttribute('aria-label', counting.label);
        days.refresh();
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
    // At most how many: a whole number, 1 or more; emptied, any.
    let atMost: number | null = null;
    const most = numberBox({ label: w.atMost, integer: true, min: 1, optional: true, placeholder: w.any, saved: () => atMost, commit: (n) => designer.setWidgetOptions(id, { max: n }) });
    return {
      element: el('div', { class: 'fd-kind-block' }, word(w.suggestions, list), row(word(w.separator, separator), word(w.atMost, most.input))),
      refresh(_page, node) {
        const suggestions = node.options?.['suggestions'];
        if (!focused(list)) list.value = Array.isArray(suggestions) ? suggestions.join('\n') : '';
        separator.value = String(node.options?.['separator'] ?? ',');
        atMost = held(node.options?.['max']);
        most.refresh();
      },
    };
  }

  /** A progress bar's most, its colour — by how far it has come, or always one — and whether the percent shows on it. */
  function progress(): Part {
    // More than 0, said so: a bar's most, 100 unless said.
    const most = limitBox(w.most, 'max', { above: 0 });
    const colour = select(w.colour, [['', w.byProgress], ['success', w.green], ['warning', w.amber], ['danger', w.red], ['info', w.blue]]);
    colour.addEventListener('change', () => designer.setWidgetOptions(id, { color: colour.value || null }));
    const percent = toggle(w.showsPercent, (on) => designer.setWidgetOptions(id, { showPercent: on ? null : false }));
    return {
      element: row(word(w.most, most.input), word(w.colour, colour), percent.element),
      refresh(page, node) {
        most.show(page.fields[node.field], own(page.fields[node.field], 'max') ?? 100);
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
    // A whole number of pixels, 120 to 4000; emptied, the usual 480.
    let height: number | null = null;
    const box = numberBox({ label: w.heightPx, integer: true, min: 120, max: 4000, step: 20, optional: true, placeholder: '480', saved: () => height, commit: (n) => designer.setWidgetOptions(id, { height: n }) });
    return {
      element: word(w.heightPx, box.input),
      refresh(_page, node) {
        height = held(node.options?.['height']);
        box.refresh();
      },
    };
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

  /** The language code is written in, for its colours; none for JSON, which is JSON. */
  function codeLanguage(): Part {
    const list = select(w.codeLanguage, [['', w.plainText], ...CODE_LANGUAGE_CHOICES.map(([value, name]): [string, string] => [value, name])]);
    list.addEventListener('change', () => designer.setWidgetOptions(id, { language: list.value || null }));
    const element = word(w.codeLanguage, list);
    return {
      element,
      refresh(page, node) {
        element.hidden = page.fields[node.field]?.type === 'json';
        show(list, node.options?.['language']);
      },
    };
  }

  const parts: Part[] = [];
  if (kind === 'code' || kind === 'vscode') parts.push(codeLanguage());
  if (kind === 'short-answer' || kind === 'paragraph') parts.push(most());
  if (kind === 'paragraph') parts.push(rows());
  if (kind === 'number' || kind === 'amount') parts.push(range());
  if (kind === 'number') parts.push(units());
  if (kind === 'amount') parts.push(money());
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
