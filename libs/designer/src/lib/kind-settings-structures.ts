import { ADDRESS_PARTS, readNumber, type FieldNode, type Page } from '@fieldia/core';
import { countriesIn } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { USUAL_ADDRESS } from './kind-commands';
import { linksPart, richTextPart } from './work-text';
import { settingNumber } from './number-box';

/**
 * The settings of the kinds that hold more than one value — a signature, a
 * photo set, an address, a table of lines, links to records and rich text — in the picked
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

  /**
   * A signature's pen — its ink and width — the words on the pad and under it, whether a picture may be uploaded, and
   * the answers it signs (`signs`: every answer, or those chosen) with the field naming who signs (`signerField`).
   */
  function signature(): StructurePart {
    const inks = PEN_COLOURS.map(([colour], i) => {
      const name = w.pens[colour];
      const chip = el('button', { type: 'button', class: 'fd-inline-chip fd-pen-ink', 'aria-pressed': 'false' }, el('span', { class: 'fd-pen-dot', 'aria-hidden': 'true' }), name) as HTMLButtonElement;
      // Its ink through its style object, never a style attribute: a strict Content-Security-Policy lets one be.
      chip.style.setProperty('--fd-ink', colour);
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
    // The answers it signs: none, every answer, or those chosen — each field a chip — and who signs, by a field of words.
    let answers: [string, string][] = [];
    let chosen: string[] = [];
    const signs = select(w.signs, [['', w.signsNothing], ['form', w.signsForm], ['chosen', w.signsChosen]]);
    signs.addEventListener('change', () => designer.setWidgetOptions(id, { signs: signs.value === 'form' ? 'form' : signs.value === 'chosen' ? answers.map(([name]) => name) : null, ...(signs.value ? {} : { signerField: null }) }));
    const chips = el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.answersSigned });
    const signer = select(w.signerName, [['', w.signerTyped]]);
    signer.addEventListener('change', () => widget({ signerField: signer.value || null }));
    const signsHelp = el('span', { class: 'fd-kind-hint' }, w.signsHelp);
    const signerRow = word(w.signerName, signer);
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        row(el('span', {}, w.ink), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.ink }, ...inks.map((i) => i.chip)), word(w.penWidth, width)),
        row(word(w.wordsOnPad, pad), word(w.wordsUnder, under)),
        upload.element,
        word(w.signs, signs),
        chips,
        signerRow,
        signsHelp
      ),
      refresh(page, node) {
        // Every other answer of the page, never a signature: what it may sign, by name and label.
        const signatures = new Set<string>();
        const walk = (part: unknown) => {
          if (Array.isArray(part)) return part.forEach(walk);
          if (!part || typeof part !== 'object') return;
          const one = part as Partial<FieldNode>;
          if (one.type === 'field' && one.widget === 'signature' && typeof one.field === 'string') signatures.add(one.field);
          Object.values(part).forEach(walk);
        };
        walk(page.layout);
        answers = Object.entries(page.fields)
          .filter(([name]) => name !== node.field && !signatures.has(name))
          .map(([name, def]) => [name, def.label || name]);
        const asked = option(node, 'signs');
        chosen = Array.isArray(asked) ? asked.filter((name): name is string => typeof name === 'string') : [];
        if (!focused(signs)) signs.value = asked === 'form' ? 'form' : chosen.length ? 'chosen' : '';
        chips.replaceChildren(
          ...answers.map(([name, label]) => {
            const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': String(chosen.includes(name)), 'data-answer': name }, label) as HTMLButtonElement;
            chip.addEventListener('click', () => {
              const next = chosen.includes(name) ? chosen.filter((one) => one !== name) : answers.map(([one]) => one).filter((one) => one === name || chosen.includes(one));
              designer.setWidgetOptions(id, { signs: next.length ? next : null, ...(next.length ? {} : { signerField: null }) });
            });
            return chip;
          })
        );
        chips.hidden = !chosen.length;
        // Who signs: a field that holds a name — words, or a link's record.
        const names = Object.entries(page.fields).filter(([name, def]) => name !== node.field && (def.type === 'char' || def.type === 'many2one'));
        signer.replaceChildren(el('option', { value: '' }, w.signerTyped), ...names.map(([name, def]) => el('option', { value: name }, def.label || name)));
        signer.value = String(option(node, 'signerField') ?? '');
        signerRow.hidden = signsHelp.hidden = asked === undefined;
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

  /** A whole number, `least` or more, saved once typed and left; emptied, it goes; anything else is said, and the count kept. */
  const countBox = (label: string, key: string, least: number) => {
    let saved: number | null = null;
    const box = settingNumber(el, designer, {
      label,
      attrs: { class: 'fd-inline-input fd-inline-number', placeholder: w.any },
      integer: true,
      min: least,
      optional: true,
      saved: () => saved,
      commit: (n) => widget({ [key]: n === 0 ? null : n }),
    });
    return {
      input: box.input,
      show(value: unknown) {
        saved = typeof value === 'number' ? value : null;
        box.refresh();
      },
    };
  };

  /**
   * A table's least and most lines, its button's words, the sentence it says
   * while empty, asking before a line goes; and each column added up under
   * the table, or one people may hide, shown or hidden to start with.
   */
  function table(): StructurePart {
    const least = countBox(w.atLeast, 'min', 0);
    const most = countBox(w.atMost, 'max', 1);
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
        row(word(w.atLeast, least.input), word(w.atMost, most.input)),
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
        least.show(option(node, 'min'));
        most.show(option(node, 'max'));
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
    // Saved once typed and left: "true" and "false" are yes and no, a number a number — read as every box reads one,
    // in the designer's language (٥ is 5, 1,5 one and a half), never hex or an exponent ("0x10" and "1e3" stay words).
    const save = () => {
      const typed = value.value.trim();
      const read = readNumber(typed, designer.locale ?? 'en');
      designer.setLinkFilter(id, where.value.trim() ? { field: where.value, value: typed === 'true' ? true : typed === 'false' ? false : read.ok && read.value !== null ? read.value : typed } : null);
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

  /**
   * A photo set's own (`"widget": "photos"`): whether the first is the cover, a caption under each photo, crop and turn
   * — and with it whether the original of a photo cropped is kept — and the shape every crop keeps, or any.
   */
  function photos(): StructurePart {
    const cover = toggle(w.photoCover, (on) => widget({ cover: on ? null : false }));
    const captions = toggle(w.photoCaptions, (on) => widget({ captions: on || null }));
    const edit = toggle(w.photoEdit, (on) => widget({ edit: on ? null : false, ...(on ? {} : { keepOriginal: null, aspect: null }) }));
    const original = toggle(w.photoOriginal, (on) => widget({ keepOriginal: on ? null : false }));
    const shapes: [string, string][] = [['', w.photoShapeAny], ...['1:1', '4:3', '3:2', '16:9', '3:4'].map((shape): [string, string] => [shape, shape])];
    const shape = select(w.photoShape, shapes);
    shape.addEventListener('change', () => widget({ aspect: shape.value || null }));
    const shapeRow = word(w.photoShape, shape);
    return {
      element: el('div', { class: 'fd-kind-block' }, cover.element, captions.element, edit.element, original.element, shapeRow, el('span', { class: 'fd-kind-hint' }, w.photosHelp)),
      refresh(_page, node) {
        cover.button.setAttribute('aria-checked', String(option(node, 'cover') !== false));
        captions.button.setAttribute('aria-checked', String(option(node, 'captions') === true));
        const editing = option(node, 'edit') !== false;
        edit.button.setAttribute('aria-checked', String(editing));
        original.button.setAttribute('aria-checked', String(option(node, 'keepOriginal') !== false));
        // What a crop keeps, only where photos are cropped: hidden, never disabled, where they are not.
        original.element.hidden = !editing;
        shapeRow.hidden = !editing;
        const aspect = option(node, 'aspect');
        // A shape the page set that is none of these is shown as it is.
        if (typeof aspect === 'string' && aspect && !shapes.some(([value]) => value === aspect)) shape.append(el('option', { value: aspect }, aspect));
        show(shape, typeof aspect === 'string' ? aspect : '');
      },
    };
  }

  const parts: StructurePart[] = [];
  if (kind === 'signature') parts.push(signature());
  if (kind === 'photos') parts.push(photos());
  if (kind === 'link' || kind === 'links') parts.push(link());
  // A many2many as tags or as a work item's links box, with its Add link, help and empty link.
  if (kind === 'links') parts.push(linksPart(el, designer, id));
  // Rich text with its formatting toolbar, or plain of it; then where it shows, its tools and editors.
  if (kind === 'rich-text') {
    const bar = toggle(w.toolbar, (on) => widget({ toolbar: on ? null : false }));
    parts.push({ element: bar.element, refresh: (_page, node) => bar.button.setAttribute('aria-checked', String(option(node, 'toolbar') !== false && option(node, 'toolbar') !== 'never')) });
    parts.push(richTextPart(el, designer, id));
  }
  if (kind === 'lines') parts.push(table());
  if (kind === 'address') parts.push(address());
  return parts;
}

