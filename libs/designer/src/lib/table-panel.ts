import type { ButtonNode, Field, FieldNode, Page, ScreenWidth, Tone, ToneWhen } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findField } from './page-tree';
import { onTab } from './panel-controls';
import { formulaProblem } from './rules-formula';
import { formulaBox, type FormulaBox } from './rules-formula-box';
import type { CellRule, TableButtonPlace } from './table-commands';

/**
 * A field's tone and a table's own rules in the panel: its value's tones and
 * bold (Rules); a table's lines' tones and bold, and each column's cells by
 * their line — blank, read-only, required, bold, toned, a pill, a width — and
 * the column hidden by the record (Rules); its buttons on each line, for the
 * lines chosen and beside Add a line (Content); how a line opens, how it shows
 * on a phone, its columns' widths, a line copied (Layout); and the widths of
 * the form a field is hidden at (Layout). Each a row the panel's search finds.
 */

const TONES: Tone[] = ['danger', 'warning', 'success', 'info', 'muted'];
const WIDTHS: ScreenWidth[] = ['narrow', 'medium', 'wide'];
type Lines = Extract<Field, { type: 'one2many' }>;

/** The page a line's conditions read: its fields, and the record as parent. */
const linePage = (page: Page, def: Lines): Page => ({ ...page, fields: { ...def.fields, parent: { type: 'json', label: 'parent' } } }) as unknown as Page;

export interface TableSettings {
  rows: HTMLElement[];
  update(page: Page): void;
}

export function tableSettings(el: ElementFactory, designer: Designer, id: string): TableSettings {
  const words = designer.words;
  const w = words.tables;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  let page = designer.getPage();
  let node: FieldNode | null = null;
  let lines: Lines | null = null;

  /** A condition's box: its fields suggested, what is wrong said under it, handed on as it reads. */
  function whenBox(label: string, scope: () => Page, save: (source: string | null) => void, placeholder = w.whenPlaceholder) {
    const box = formulaBox(el, { words, label, placeholder, check: (on, source) => formulaProblem(on, source, words), commit: (source) => save(source || null) });
    const element = el('div', { class: 'fd-answer-rule-field fd-table-when' }, el('span', { class: 'fd-answer-rule-word' }, label), box.element, box.problem);
    return { element, box, show: (source: string | undefined) => box.update(scope(), source ?? '') };
  }

  /** Tones, each a colour while its condition holds, the first that holds; a new one kept once its condition reads. */
  function toneList(scope: () => Page, read: () => ToneWhen[], save: (tones: ToneWhen[] | null) => boolean) {
    const list = el('ul', { class: 'fd-table-tones' });
    const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-table-add-tone' }, w.addTone);
    let drafting = false;
    let rows: { element: HTMLElement; tone: HTMLSelectElement; when: FormulaBox; remove: HTMLButtonElement }[] = [];
    add.addEventListener('click', () => {
      drafting = true;
      draw();
      rows[rows.length - 1]?.when.input.focus();
    });
    function row(index: number) {
      const tone = el('select', { class: 'fd-input fd-select fd-table-tone', 'aria-label': w.toneOf }, ...TONES.map((t) => el('option', { value: t }, w.tones[t]))) as HTMLSelectElement;
      const keep = (when: string) => {
        if (!when) return;
        const items = [...read()];
        items[index] = { tone: tone.value as Tone, when };
        const begun = index >= read().length;
        if (begun) drafting = false;
        if (!save(items) && begun) drafting = true;
      };
      const when = formulaBox(el, { words, label: w.when, placeholder: w.whenPlaceholder, check: (on, source) => formulaProblem(on, source, words), commit: (source) => keep(source) });
      tone.addEventListener('change', () => keep(when.input.value.trim()));
      const remove = iconButton(el, w.removeTone(index + 1), '×', () => {
        if (index >= read().length) {
          drafting = false;
          return draw();
        }
        const items = read().filter((_, i) => i !== index);
        save(items.length ? items : null);
      });
      const element = el('li', { class: 'fd-table-tone-row' }, tone, el('div', { class: 'fd-table-tone-when' }, when.element, when.problem), remove);
      return { element, tone, when, remove };
    }
    function draw() {
      const items = read();
      const count = items.length + (drafting ? 1 : 0);
      while (rows.length > count) rows.pop()?.element.remove();
      while (rows.length < count) {
        const made = row(rows.length);
        rows.push(made);
        list.append(made.element);
      }
      rows.forEach((r, i) => {
        const item = items[i];
        if (!focused(r.tone)) r.tone.value = item?.tone ?? 'danger';
        r.when.update(scope(), item && typeof item.when === 'string' ? item.when : item ? String(item.when) : r.when.input.value);
      });
      list.hidden = !count;
      add.hidden = drafting;
    }
    return { element: el('div', { class: 'fd-table-tone-list' }, list, add), draw };
  }

  // ---- Rules: a field's value in a tone ----
  const fieldTones = toneList(() => page, () => node?.tones ?? [], (tones) => designer.setFieldTones(id, tones));
  const fieldBold = whenBox(w.boldWhen, () => page, (source) => designer.setFieldBold(id, source));
  const toneRow = onTab(el('div', { class: 'fd-prop fd-table-setting' }, el('span', { class: 'fd-prop-name' }, w.tone), fieldTones.element, fieldBold.element, el('p', { class: 'fd-properties-hint fd-set-hint' }, w.toneHint)), 'rules', 'Tone');

  // ---- Rules: a table's lines, and each column's cells ----
  const lineScope = () => (lines ? linePage(page, lines) : page);
  const rowTones = toneList(lineScope, () => node?.rowTones ?? [], (tones) => designer.setRowTones(id, tones));
  const rowBold = whenBox(w.boldWhen, lineScope, (source) => designer.setRowBold(id, source));
  const column = el('select', { class: 'fd-input fd-select fd-table-column', 'aria-label': w.column }) as HTMLSelectElement;
  const current = () => column.value;
  const rule = (key: CellRule, label: string) => {
    const box = whenBox(label, key === 'hidden' ? () => page : lineScope, (source) => designer.setCellRule(id, current(), key, source));
    box.element.dataset['cellRule'] = key;
    return { key, box };
  };
  const cellRules = [rule('invisible', w.hiddenOnLineWhen), rule('readonly', w.readonlyWhen), rule('required', w.requiredWhen), rule('bold', w.boldWhen), rule('hidden', w.columnHiddenWhen)];
  const cellTones = toneList(lineScope, () => node?.cells?.[current()]?.tones ?? [], (tones) => designer.setCellTones(id, current(), tones));
  const badge = el('input', { type: 'checkbox', class: 'fd-checkbox', 'aria-label': w.badge }) as HTMLInputElement;
  badge.addEventListener('change', () => designer.setCellLook(id, current(), { badge: badge.checked || null }));
  const width = el('input', { type: 'number', class: 'fd-input fd-inline-number', min: '1', max: '200', step: '1', 'aria-label': w.width }) as HTMLInputElement;
  width.addEventListener('change', () => designer.setCellLook(id, current(), { width: width.value.trim() ? Number(width.value) : null }));
  column.addEventListener('change', () => drawColumn());
  const columnBox = el(
    'div',
    { class: 'fd-table-column-rules' },
    el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.column), column),
    ...cellRules.map((r) => r.box.element),
    el('p', { class: 'fd-properties-hint fd-set-hint' }, w.columnHiddenHint),
    el('span', { class: 'fd-answer-rule-word' }, w.toneOf),
    cellTones.element,
    el('label', { class: 'fd-inline-setting' }, badge, el('span', {}, w.badge)),
    el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.width), width)
  );
  const linesRow = onTab(
    el(
      'div',
      { class: 'fd-prop fd-table-setting' },
      el('span', { class: 'fd-prop-name' }, w.lineRules),
      el('span', { class: 'fd-answer-rule-word' }, w.linesTone),
      rowTones.element,
      rowBold.element,
      el('p', { class: 'fd-properties-hint fd-set-hint' }, w.linesHint),
      columnBox
    ),
    'rules',
    'Line rules'
  );
  function drawColumn() {
    const rules = node?.cells?.[current()] ?? {};
    for (const r of cellRules) r.box.show(typeof rules[r.key] === 'string' ? (rules[r.key] as string) : undefined);
    cellTones.draw();
    badge.checked = rules.badge === true;
    if (!focused(width)) width.value = rules.width ? String(rules.width) : '';
  }

  // ---- Content: the table's buttons ----
  function buttonList(place: TableButtonPlace, title: string) {
    const list = el('ul', { class: 'fd-table-buttons', 'data-place': place });
    const add = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.addButton);
    const read = (): ButtonNode[] => node?.[place] ?? [];
    const save = (items: ButtonNode[]) => designer.setTableButtons(id, place, items.map((b) => ({ id: b.id, label: b.label, action: b.action, invisible: typeof b.invisible === 'string' ? b.invisible : undefined })));
    add.addEventListener('click', () => {
      save([...read(), { type: 'button', id: '', label: w.newButton }]);
      (list.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
    });
    let drawn: { element: HTMLElement; words: HTMLInputElement; action: HTMLInputElement; hidden: ReturnType<typeof whenBox>; remove: HTMLButtonElement }[] = [];
    function draw() {
      const items = read();
      while (drawn.length > items.length) drawn.pop()?.element.remove();
      while (drawn.length < items.length) {
        const index = drawn.length;
        const change = (patch: Partial<ButtonNode>) => save(read().map((b, i) => (i === index ? { ...b, ...patch } : b)));
        const words = el('input', { class: 'fd-input', 'aria-label': w.buttonWords }) as HTMLInputElement;
        words.addEventListener('input', () => words.value.trim() && change({ label: words.value }));
        const action = el('input', { class: 'fd-input fd-answer-rule-code', 'aria-label': w.action, spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
        action.addEventListener('change', () => change({ action: action.value.trim() || undefined }));
        const hidden = whenBox(w.hiddenWhen, place === 'rowButtons' ? lineScope : () => page, (source) => change({ invisible: source ?? undefined }));
        const remove = iconButton(el, w.removeButton(read()[index]?.label ?? ''), '×', () => {
          const kept = read().filter((_, i) => i !== index);
          designer.setTableButtons(id, place, kept.length ? kept.map((b) => ({ id: b.id, label: b.label, action: b.action, invisible: typeof b.invisible === 'string' ? b.invisible : undefined })) : null);
        });
        const element = el(
          'li',
          { class: 'fd-table-button' },
          el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.buttonWords), words),
          el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.action), action),
          hidden.element,
          remove
        );
        drawn.push({ element, words, action, hidden, remove });
        list.append(element);
      }
      drawn.forEach((d, i) => {
        const item = items[i];
        if (!focused(d.words)) d.words.value = item.label;
        if (!focused(d.action)) d.action.value = item.action ?? '';
        d.hidden.show(typeof item.invisible === 'string' ? item.invisible : undefined);
        d.remove.setAttribute('aria-label', w.removeButton(item.label));
        d.remove.title = w.removeButton(item.label);
      });
    }
    return { element: el('div', { class: 'fd-table-button-place' }, el('span', { class: 'fd-answer-rule-word' }, title), list, add), draw };
  }
  const buttonPlaces = [buttonList('rowButtons', w.onEachLine), buttonList('selectedButtons', w.forChosenLines), buttonList('controlButtons', w.besideAdd)];
  const buttonsRow = onTab(el('div', { class: 'fd-prop fd-table-setting' }, el('span', { class: 'fd-prop-name' }, w.tableButtons), ...buttonPlaces.map((p) => p.element)), 'content', 'Table buttons');

  // ---- Layout: the table's shape, and the widths a field is hidden at ----
  const select = (label: string, choices: [string, string][], change: (value: string) => void) => {
    const box = el('select', { class: 'fd-input fd-select', 'aria-label': label }, ...choices.map(([value, text]) => el('option', { value }, text))) as HTMLSelectElement;
    box.addEventListener('change', () => change(box.value));
    return box;
  };
  const opens = select(w.lineOpens, [['', w.opensFields], ['record', w.opensRecord]], (value) => designer.setTableShape(id, { lineOpens: value ? 'record' : null }));
  const phone = select(w.onAPhone, [['', w.rows], ['narrow', w.cardsOnPhone], ['always', w.cardsAlways]], (value) => designer.setTableShape(id, { cards: (value || null) as 'narrow' | 'always' | null }));
  const fit = select(w.columnWidths, [['', w.shareWidth], ['content', w.fitContent]], (value) => designer.setTableShape(id, { fit: value ? 'content' : null }));
  const copy = el('input', { type: 'checkbox', class: 'fd-checkbox', 'aria-label': w.copyLine }) as HTMLInputElement;
  copy.addEventListener('change', () => designer.setTableShape(id, { copy: copy.checked || null }));
  const field = (label: string, control: HTMLElement) => el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, label), control);
  const shapeRow = onTab(
    el('div', { class: 'fd-prop fd-table-setting' }, el('span', { class: 'fd-prop-name' }, w.table), field(w.lineOpens, opens), field(w.onAPhone, phone), field(w.columnWidths, fit), el('label', { class: 'fd-inline-setting' }, copy, el('span', {}, w.copyLine))),
    'layout',
    'Table'
  );
  const chips = WIDTHS.map((width) => {
    const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false', 'data-width': width }, w.widths[width]) as HTMLButtonElement;
    chip.addEventListener('click', () => {
      const now = node?.hideOn ?? [];
      designer.setHideOn(id, now.includes(width) ? now.filter((x) => x !== width) : [...now, width]);
    });
    return chip;
  });
  const hiddenOnRow = onTab(
    el('div', { class: 'fd-prop fd-table-setting' }, el('span', { class: 'fd-prop-name' }, w.hiddenOn), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.hiddenOn }, ...chips), el('p', { class: 'fd-properties-hint fd-set-hint' }, w.hiddenOnHint)),
    'layout',
    'Hidden on'
  );

  return {
    rows: [toneRow, linesRow, buttonsRow, shapeRow, hiddenOnRow],
    update(next) {
      page = next;
      const found = findField(page, id);
      node = found?.node ?? null;
      if (!node) return;
      const def = page.fields[node.field];
      lines = def?.type === 'one2many' ? def : null;
      // A value's tone is for a field that shows one value; a table has its lines'.
      toneRow.hidden = !def || ['one2many', 'many2many', 'binary', 'image', 'html', 'matrix', 'properties', 'json'].includes(def.type);
      linesRow.hidden = buttonsRow.hidden = shapeRow.hidden = !lines;
      if (!toneRow.hidden) {
        fieldTones.draw();
        fieldBold.show(typeof node.bold === 'string' ? node.bold : undefined);
      }
      if (lines) {
        rowTones.draw();
        rowBold.show(typeof node.rowBold === 'string' ? node.rowBold : undefined);
        const names = Object.keys(lines.fields).filter((name) => name !== lines!.sequenceField && name !== lines!.lineKinds?.field);
        const key = JSON.stringify(names.map((name) => [name, lines!.fields[name].label]));
        if (column.dataset['drawn'] !== key) {
          const was = column.value;
          column.dataset['drawn'] = key;
          column.replaceChildren(...names.map((name) => el('option', { value: name }, lines!.fields[name].label)));
          if (names.includes(was)) column.value = was;
        }
        drawColumn();
        for (const place of buttonPlaces) place.draw();
        opens.value = node.lineOpens === 'record' ? 'record' : '';
        phone.value = node.cards ?? '';
        fit.value = node.fit ?? '';
        copy.checked = node.options?.['copy'] === true;
      }
      for (const chip of chips) chip.setAttribute('aria-pressed', String(node.hideOn?.includes(chip.dataset['width'] as ScreenWidth) ?? false));
    },
  };
}
