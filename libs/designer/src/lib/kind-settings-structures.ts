import { ADDRESS_PARTS, type FieldNode, type Page } from '@fieldia/core';
import { countriesIn } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { USUAL_ADDRESS } from './kind-commands';

/**
 * The settings of the kinds that hold more than one value — a signature, an
 * address, a table of lines, links to records and rich text — in the picked
 * field itself, beside the rest of its kind's, and in the side panel the
 * same way: a signature's pen, its words and an upload; an address's parts
 * that must be filled and its country to start with; a table's least and
 * most lines, its button's words, the sentence it says when empty, its
 * totals and the columns people may hide; whether a link makes new records
 * and which records it offers; whether rich text has its toolbar.
 */

export interface StructurePart {
  element: HTMLElement;
  refresh(page: Page, node: FieldNode): void;
}

/** A signature's inks, by name: the first is the usual one, kept as nothing. */
export const PEN_COLOURS: [string, string][] = [
  ['#1b2a5c', 'Blue-black'],
  ['#111111', 'Black'],
  ['#1d4ed8', 'Blue'],
];

export function structureSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): StructurePart[] {
  const w = designer.words.questions;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const row = (...parts: HTMLElement[]) => el('div', { class: 'fd-inline-row' }, ...parts);
  const select = (label: string, choices: [string, string][]) =>
    el('select', { class: 'fd-inline-select', 'aria-label': label }, ...choices.map(([value, words]) => el('option', { value }, words))) as HTMLSelectElement;
  const textBox = (label: string, placeholder: string) => el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': label, placeholder, autocomplete: 'off' }) as HTMLInputElement;
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  /** A box shows what is saved, unless the cursor is in it. */
  const show = (input: HTMLInputElement | HTMLSelectElement, value: unknown) => {
    if (!focused(input)) input.value = value === undefined || value === null ? '' : String(value);
  };
  const widget = (patch: Record<string, string | number | boolean | null>) => designer.setWidgetOptions(id, patch);
  const option = (node: FieldNode, key: string) => node.options?.[key];

  /** A signature's pen — its ink and width — the words on the pad and under it, and whether a picture may be uploaded. */
  function signature(): StructurePart {
    const inks = PEN_COLOURS.map(([colour], i) => {
      const name = w.pens[colour];
      const chip = el('button', { type: 'button', class: 'fd-inline-chip fd-pen-ink', 'aria-pressed': 'false', style: `--fd-ink: ${colour}` }, el('span', { class: 'fd-pen-dot', 'aria-hidden': 'true' }), name) as HTMLButtonElement;
      chip.addEventListener('click', () => widget({ color: i === 0 ? null : colour }));
      return { chip, colour };
    });
    const width = select(w.penWidth, [['2', w.thin], ['3', w.medium], ['5', w.thick]]);
    width.addEventListener('change', () => widget({ penWidth: width.value === '3' ? null : Number(width.value) }));
    const pad = textBox(w.wordsOnPad, w.signHere);
    pad.addEventListener('input', () => designer.updateQuestion(id, { placeholder: pad.value }));
    const under = textBox(w.wordsUnder, w.agree);
    under.addEventListener('input', () => widget({ footerLabel: under.value }));
    const upload = toggle(w.uploadSignature, (on) => widget({ upload: on || null }));
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        row(el('span', {}, w.ink), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.ink }, ...inks.map((i) => i.chip)), word(w.penWidth, width)),
        row(word(w.wordsOnPad, pad), word(w.wordsUnder, under)),
        upload.element
      ),
      refresh(_page, node) {
        const colour = option(node, 'color') ?? PEN_COLOURS[0][0];
        for (const ink of inks) ink.chip.setAttribute('aria-pressed', String(ink.colour === colour));
        width.value = String(option(node, 'penWidth') ?? 3);
        show(pad, node.placeholder);
        show(under, option(node, 'footerLabel'));
        upload.button.setAttribute('aria-checked', String(option(node, 'upload') === true));
      },
    };
  }

  /** An address's parts that must be filled, among those it asks for, and the country it starts on. */
  function address(): StructurePart {
    let needed: string[] = [];
    const chips = ADDRESS_PARTS.map((part) => {
      const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false', 'data-part': part }, w.addressParts[part]) as HTMLButtonElement;
      chip.addEventListener('click', () => designer.setWidgetList(id, 'requiredParts', needed.includes(part) ? needed.filter((p) => p !== part) : ADDRESS_PARTS.filter((p) => p === part || needed.includes(p))));
      return { part, chip };
    });
    const country = select(w.startsOn, [['', w.noCountry]]);
    country.addEventListener('change', () => widget({ country: country.value || null }));
    let listed = false;
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        row(el('span', {}, w.mustBeFilled), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.partsFilled }, ...chips.map((c) => c.chip))),
        word(w.startsOn, country)
      ),
      refresh(_page, node) {
        const asked = option(node, 'parts');
        const parts = Array.isArray(asked) ? asked : USUAL_ADDRESS;
        const kept = option(node, 'requiredParts');
        needed = Array.isArray(kept) ? kept.filter((p): p is string => typeof p === 'string') : [];
        for (const { part, chip } of chips) {
          chip.hidden = !parts.includes(part);
          chip.setAttribute('aria-pressed', String(needed.includes(part)));
        }
        // The countries a form lists, named once the setting is first drawn.
        if (!listed) {
          listed = true;
          country.append(...countriesIn(designer.locale ?? 'en').map(([code, name]) => el('option', { value: code }, name)));
        }
        country.value = String(option(node, 'country') ?? '');
        country.parentElement!.hidden = !parts.includes('country');
      },
    };
  }

  /** A whole number, 1 or more, saved once typed and left; anything else takes it away. */
  const countBox = (label: string, key: string) => {
    const input = el('input', { type: 'number', class: 'fd-inline-input fd-inline-number', 'aria-label': label, min: '0', step: '1', inputmode: 'numeric', placeholder: w.any }) as HTMLInputElement;
    input.addEventListener('change', () => {
      const n = Number(input.value);
      widget({ [key]: input.value.trim() !== '' && Number.isInteger(n) && n > 0 ? n : null });
    });
    return input;
  };

  /**
   * A table's least and most lines, its button's words, the sentence it says
   * while empty, asking before a line goes; and each column added up under
   * the table, or one people may hide, shown or hidden to start with.
   */
  function table(): StructurePart {
    const least = countBox(w.atLeast, 'min');
    const most = countBox(w.atMost, 'max');
    const button = textBox(w.buttonWords, w.addALine);
    button.addEventListener('input', () => widget({ addLabel: button.value }));
    const empty = textBox(w.whenEmpty, w.noLines);
    empty.addEventListener('input', () => widget({ emptyLabel: empty.value }));
    const ask = toggle(w.askBeforeRemoving, (on) => widget({ confirmDelete: on || null }));
    const list = el('ul', { class: 'fd-line-columns' });
    let drawn = '';
    let totals: string[] = [];
    let optional: Record<string, 'show' | 'hide'> = {};
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        row(word(w.atLeast, least), word(w.atMost, most)),
        row(word(w.buttonWords, button), word(w.whenEmpty, empty)),
        ask.element,
        el('span', { class: 'fd-prop-name' }, w.eachColumn),
        list
      ),
      refresh(page, node) {
        const def = page.fields[node.field];
        if (def.type !== 'one2many') return;
        totals = node.totals ?? [];
        optional = node.optionalColumns ?? {};
        const columns = Object.entries(def.fields).filter(([name]) => name !== def.sequenceField && name !== def.lineKinds?.field);
        const key = JSON.stringify(columns.map(([name, f]) => [name, f.label, f.type]));
        if (key !== drawn) {
          drawn = key;
          list.replaceChildren(
            ...columns.map(([name, f]) => {
              const adds = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false', 'aria-label': w.addUpNamed(f.label), 'data-column': name }, w.addUp) as HTMLButtonElement;
              adds.hidden = !['integer', 'float', 'monetary'].includes(f.type);
              adds.addEventListener('click', () => designer.setLineTable(id, { totals: totals.includes(name) ? totals.filter((t) => t !== name) : [...totals, name] }));
              const shown = select(w.shownNamed(f.label), [['', w.alwaysShown], ['show', w.canHide], ['hide', w.hiddenToStart]]);
              shown.dataset['column'] = name;
              shown.addEventListener('change', () => {
                const next = { ...optional };
                if (shown.value) next[name] = shown.value as 'show' | 'hide';
                else delete next[name];
                designer.setLineTable(id, { optionalColumns: next });
              });
              return el('li', { class: 'fd-line-column' }, el('span', { class: 'fd-line-column-name' }, f.label), adds, shown);
            })
          );
        }
        for (const chip of list.querySelectorAll<HTMLButtonElement>('button[data-column]')) chip.setAttribute('aria-pressed', String(totals.includes(chip.dataset['column'] ?? '')));
        for (const shown of list.querySelectorAll<HTMLSelectElement>('select')) shown.value = optional[shown.dataset['column'] ?? ''] ?? '';
        show(least, option(node, 'min'));
        show(most, option(node, 'max'));
        show(button, option(node, 'addLabel'));
        show(empty, option(node, 'emptyLabel'));
        ask.button.setAttribute('aria-checked', String(option(node, 'confirmDelete') === true));
      },
    };
  }

  /** Whether a link makes new records from a typed name, and the records it offers: only where one of their fields has a value. */
  function link(): StructurePart {
    const create = toggle(w.canCreate, (on) => widget({ create: on ? null : false }));
    const where = textBox(w.onlyWhere, 'active');
    const value = textBox(w.hasTheValue, 'true');
    // Saved once typed and left: "true" and "false" are yes and no, a number a number.
    const save = () => {
      const typed = value.value.trim();
      designer.setLinkFilter(id, where.value.trim() ? { field: where.value, value: typed === 'true' ? true : typed === 'false' ? false : typed !== '' && Number.isFinite(Number(typed)) ? Number(typed) : typed } : null);
    };
    where.addEventListener('change', save);
    value.addEventListener('change', save);
    const simple = row(word(w.onlyWhere, where), word(w.hasTheValue, value));
    const own = el('span', { class: 'fd-help' }, w.ownFilter);
    return {
      element: el('div', { class: 'fd-kind-block' }, create.element, simple, own),
      refresh(page, node) {
        create.button.setAttribute('aria-checked', String(option(node, 'create') !== false));
        const def = page.fields[node.field];
        const filter = def.type === 'many2one' || def.type === 'many2many' ? (def.filter ?? []) : [];
        const one = filter.length === 1 && 'op' in filter[0] && filter[0].op === '=' && filter[0].valueFrom === undefined ? filter[0] : null;
        // A filter the boxes cannot show is left as it is.
        simple.hidden = filter.length > 0 && !one;
        own.hidden = !simple.hidden;
        show(where, one?.field);
        show(value, one ? String(one.value) : '');
      },
    };
  }

  const parts: StructurePart[] = [];
  if (kind === 'signature') parts.push(signature());
  if (kind === 'link' || kind === 'links') parts.push(link());
  // Rich text with its formatting toolbar, or plain of it.
  if (kind === 'rich-text') {
    const bar = toggle(w.toolbar, (on) => widget({ toolbar: on ? null : false }));
    parts.push({ element: bar.element, refresh: (_page, node) => bar.button.setAttribute('aria-checked', String(option(node, 'toolbar') !== false)) });
  }
  if (kind === 'lines') parts.push(table());
  if (kind === 'address') parts.push(address());
  return parts;
}

